// ADR 003: the saved-data repository over the Storage port. Pure orchestration: validation,
// migrations, the last-good copy and recovery. Never silently wipes data.
import type { Clock, Storage } from '../ports.ts';
import {
  bentoMinderStoreSchema,
  CURRENT_SCHEMA_VERSION,
  ownerMismatches,
  toRuleIssues,
  type BentoMinderStore,
  type RuleIssue,
} from '../schema/store.ts';
import { todayJst } from '../time/jst.ts';
import { migrate, MigrationError, migrations as shippedMigrations, type MigrationMap } from './migrations/index.ts';
import { LOCAL_OWNER_ID } from './defaults.ts';
import { storeKeysFor } from './keys.ts';
import { rewriteOwnerId } from './owner.ts';
import { repairReminderTimes } from './repair.ts';

export type CorruptReason = 'json-parse' | 'schema-invalid' | 'migration-failed';

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; state: BentoMinderStore; migratedFrom?: number }
  | { kind: 'recovered-from-prev'; state: BentoMinderStore; reason: CorruptReason }
  | { kind: 'corrupt'; raw: string; reason: CorruptReason }
  | { kind: 'too-new'; version: number; raw: string };

export type ImportResult =
  | { ok: true; state: BentoMinderStore; migratedFrom?: number }
  | { ok: false; error: CorruptReason | 'not-a-store'; issues?: RuleIssue[] }
  | { ok: false; error: 'too-new'; version: number };

/** Thrown by `save` when the state breaks the contract; the stored document is left untouched. */
export class StoreValidationError extends Error {
  readonly issues: RuleIssue[];
  constructor(issues: RuleIssue[]) {
    super(`store rejected: ${issues.map((i) => `${i.rule} at ${i.path}`).join(', ')}`);
    this.name = 'StoreValidationError';
    this.issues = issues;
  }
}

/**
 * Thrown by `save` when the stored document is no longer the one this repository last read or
 * wrote (another tab or window saved in between). Nothing is written; the caller reloads
 * (ADR 003 change log, 2026-10-25: compare-and-swap on save).
 */
export class StoreConflictError extends Error {
  constructor() {
    super('the stored data changed since it was loaded');
    this.name = 'StoreConflictError';
  }
}

export interface SaveOptions {
  /** Skips the conflict check: only for a deliberate whole-store replacement (import). */
  force?: boolean;
}

export interface RepositoryOptions {
  migrations?: MigrationMap;
  currentVersion?: number;
  /**
   * ADR 014: the signed-in account's uid. Keys become bentominder.<uid>.state(.prev), the rule
   * meta-owner-matches-account is enforced on load and save, export and delete-all act on these keys
   * only. Omitted = the legacy unkeyed pair (the not-signed-in code paths until the app is wired).
   */
  accountId?: string;
}

export interface Repository {
  /** The owner of every record this repository stores: the account uid, or `local` when unkeyed (ADR 014). */
  readonly ownerId?: string;
  load(): Promise<LoadResult>;
  save(state: BentoMinderStore, options?: SaveOptions): Promise<void>;
  exportJson(state: BentoMinderStore): string;
  exportFileName(): string;
  importJson(text: string): ImportResult;
  deleteAll(): Promise<void>;
  /** Another tab changed the stored data (when the Storage adapter can tell); returns unsubscribe. */
  onExternalChange(handler: () => void): () => void;
}

export function validateStore(doc: unknown, accountId?: string): { ok: true; state: BentoMinderStore } | { ok: false; issues: RuleIssue[] } {
  const parsed = bentoMinderStoreSchema.safeParse(doc);
  if (!parsed.success) return { ok: false, issues: toRuleIssues(parsed.error) };
  if (accountId !== undefined) {
    const issues = ownerMismatches(parsed.data, accountId);
    if (issues.length > 0) return { ok: false, issues };
  }
  return { ok: true, state: parsed.data };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function createRepository(storage: Storage, clock: Clock, options: RepositoryOptions = {}): Repository {
  const map = options.migrations ?? shippedMigrations;
  const current = options.currentVersion ?? CURRENT_SCHEMA_VERSION;
  const accountId = options.accountId;
  const keys = storeKeysFor(accountId);
  // The compare-and-swap token: the exact stored text this repository last read or wrote
  // (null = nothing stored, undefined = never loaded, so no check yet). Content, not a counter,
  // so the data contract needs no new field and any Storage adapter works.
  let known: string | null | undefined;
  // Storage operations run one at a time so read-compare-write cannot interleave within a tab.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  function decodeDoc(doc: unknown): ImportResult {
    if (!isRecord(doc) || typeof doc['schemaVersion'] !== 'number' || typeof doc['deviceId'] !== 'string') {
      return { ok: false, error: 'not-a-store' };
    }
    const version = doc['schemaVersion'];
    if (version > current) return { ok: false, error: 'too-new', version };
    let migrated = doc;
    if (version < current) {
      try {
        migrated = migrate(doc, version, current, map);
      } catch (err) {
        if (err instanceof MigrationError) return { ok: false, error: 'migration-failed' };
        throw err;
      }
    }
    const checked = validateStore(repairReminderTimes(migrated), accountId);
    if (!checked.ok) return { ok: false, error: 'schema-invalid', issues: checked.issues };
    return version < current ? { ok: true, state: checked.state, migratedFrom: version } : { ok: true, state: checked.state };
  }

  function decode(text: string): ImportResult {
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      return { ok: false, error: 'json-parse' };
    }
    return decodeDoc(doc);
  }

  const reasonOf = (r: Extract<ImportResult, { ok: false }>): CorruptReason =>
    r.error === 'json-parse' || r.error === 'migration-failed' ? r.error : 'schema-invalid';

  async function loadNow(): Promise<LoadResult> {
    {
      const raw = await storage.read(keys.state);
      if (raw === null) {
        known = null;
        return { kind: 'empty' };
      }
      const result = decode(raw);
      if (result.ok) {
        if (result.migratedFrom !== undefined) {
          // US-E10-02/AC2: keep the original as the backup copy, then store the migrated document.
          await storage.write(keys.prev, raw);
          const migratedText = JSON.stringify(result.state);
          await storage.write(keys.state, migratedText);
          known = migratedText;
          return { kind: 'ok', state: result.state, migratedFrom: result.migratedFrom };
        }
        known = raw;
        return { kind: 'ok', state: result.state };
      }
      known = raw;
      if (result.error === 'too-new') return { kind: 'too-new', version: result.version, raw };
      const reason = reasonOf(result);
      const prevRaw = await storage.read(keys.prev);
      const prev = prevRaw === null ? null : decode(prevRaw);
      if (prev?.ok === true) return { kind: 'recovered-from-prev', state: prev.state, reason };
      return { kind: 'corrupt', raw, reason };
    }
  }

  return {
    ownerId: accountId ?? LOCAL_OWNER_ID,
    load: () => serial(loadNow),

    save(state, saveOptions) {
      return serial(async () => {
        const checked = validateStore(state, accountId);
        if (!checked.ok) throw new StoreValidationError(checked.issues);
        const existing = await storage.read(keys.state);
        if (saveOptions?.force !== true && known !== undefined && existing !== known) throw new StoreConflictError();
        if (existing !== null && decode(existing).ok) await storage.write(keys.prev, existing);
        const text = JSON.stringify(checked.state);
        await storage.write(keys.state, text);
        known = text;
      });
    },

    exportJson(state) {
      const checked = validateStore(state, accountId);
      if (!checked.ok) throw new StoreValidationError(checked.issues);
      return JSON.stringify(checked.state, null, 2);
    },

    exportFileName() {
      return `bentominder-export-${todayJst(clock.now())}.json`;
    },

    importJson(text) {
      if (accountId === undefined) return decode(text);
      // ADR 014: a file imported while signed in becomes this account's data, so its records take the uid.
      let doc: unknown;
      try {
        doc = JSON.parse(text);
      } catch {
        return { ok: false, error: 'json-parse' };
      }
      return decodeDoc(rewriteOwnerId(doc, accountId));
    },

    onExternalChange: (handler) => storage.onExternalChange?.(handler) ?? (() => undefined),

    deleteAll() {
      return serial(async () => {
        for (const key of [keys.state, keys.prev]) await storage.remove(key);
        known = null;
      });
    },
  };
}
