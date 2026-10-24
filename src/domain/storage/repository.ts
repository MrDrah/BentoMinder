// ADR 003: the saved-data repository over the Storage port. Pure orchestration: validation,
// migrations, the last-good copy and recovery. Never silently wipes data.
import type { Clock, Storage } from '../ports.ts';
import { STORAGE_KEYS } from '../ports.ts';
import {
  bentoMinderStoreSchema,
  CURRENT_SCHEMA_VERSION,
  toRuleIssues,
  type BentoMinderStore,
  type RuleIssue,
} from '../schema/store.ts';
import { todayJst } from '../time/jst.ts';
import { migrate, MigrationError, migrations as shippedMigrations, type MigrationMap } from './migrations/index.ts';

export type CorruptReason = 'json-parse' | 'schema-invalid' | 'migration-failed';

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; state: BentoMinderStore; migratedFrom?: number }
  | { kind: 'recovered-from-prev'; state: BentoMinderStore; reason: CorruptReason }
  | { kind: 'corrupt'; raw: string; reason: CorruptReason }
  | { kind: 'too-new'; version: number };

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

export interface RepositoryOptions {
  migrations?: MigrationMap;
  currentVersion?: number;
}

export interface Repository {
  load(): Promise<LoadResult>;
  save(state: BentoMinderStore): Promise<void>;
  exportJson(state: BentoMinderStore): string;
  exportFileName(): string;
  importJson(text: string): ImportResult;
  deleteAll(): Promise<void>;
}

export function validateStore(doc: unknown): { ok: true; state: BentoMinderStore } | { ok: false; issues: RuleIssue[] } {
  const parsed = bentoMinderStoreSchema.safeParse(doc);
  return parsed.success ? { ok: true, state: parsed.data } : { ok: false, issues: toRuleIssues(parsed.error) };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function createRepository(storage: Storage, clock: Clock, options: RepositoryOptions = {}): Repository {
  const map = options.migrations ?? shippedMigrations;
  const current = options.currentVersion ?? CURRENT_SCHEMA_VERSION;

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
    const checked = validateStore(migrated);
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

  return {
    async load() {
      const raw = await storage.read('bentominder.state');
      if (raw === null) return { kind: 'empty' };
      const result = decode(raw);
      if (result.ok) {
        if (result.migratedFrom !== undefined) {
          // US-E10-02/AC2: keep the original as the backup copy, then store the migrated document.
          await storage.write('bentominder.state.prev', raw);
          await storage.write('bentominder.state', JSON.stringify(result.state));
          return { kind: 'ok', state: result.state, migratedFrom: result.migratedFrom };
        }
        return { kind: 'ok', state: result.state };
      }
      if (result.error === 'too-new') return { kind: 'too-new', version: result.version };
      const reason = reasonOf(result);
      const prevRaw = await storage.read('bentominder.state.prev');
      const prev = prevRaw === null ? null : decode(prevRaw);
      if (prev?.ok === true) return { kind: 'recovered-from-prev', state: prev.state, reason };
      return { kind: 'corrupt', raw, reason };
    },

    async save(state) {
      const checked = validateStore(state);
      if (!checked.ok) throw new StoreValidationError(checked.issues);
      const existing = await storage.read('bentominder.state');
      if (existing !== null && decode(existing).ok) await storage.write('bentominder.state.prev', existing);
      await storage.write('bentominder.state', JSON.stringify(checked.state));
    },

    exportJson(state) {
      const checked = validateStore(state);
      if (!checked.ok) throw new StoreValidationError(checked.issues);
      return JSON.stringify(checked.state, null, 2);
    },

    exportFileName() {
      return `bentominder-export-${todayJst(clock.now())}.json`;
    },

    importJson(text) {
      return decode(text);
    },

    async deleteAll() {
      for (const key of STORAGE_KEYS) await storage.remove(key);
    },
  };
}
