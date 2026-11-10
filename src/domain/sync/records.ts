// Contract 14.2 / ADR 016 section 3: which parts of the local store sync, and how a winner is written back.
// Device-only parts (settings.language, settings.theme, reminderLog, consent, nextMonthCardHiddenOn, deviceId and
// the store's own meta) are never extracted and never touched by an apply.
import type { BentoMinderStore } from '../schema/store.ts';
import { rewriteOwnerId } from '../storage/owner.ts';
import { validateStore } from '../storage/repository.ts';
import { canonicalJson, without } from './hash.ts';
import { validateEnvelope, validatePayload, DEVICE_ONLY_SETTINGS } from './envelope.ts';
import { ownerMismatchesFor } from './owner.ts';
import { recordKeyOf, type Envelope, type RecordKey, type RecordKind } from './types.ts';

export interface LocalRecord {
  kind: RecordKind;
  key: string;
  payloadJson: string;
  /** The record's own `updatedAt`; null for aiUsage (a bare count has none). */
  ownUpdatedAt: string | null;
}

/** Every synced record of the store, by record key. Deterministic payload text (sorted keys). */
export function extractRecords(store: BentoMinderStore): Map<RecordKey, LocalRecord> {
  const out = new Map<RecordKey, LocalRecord>();
  const add = (kind: RecordKind, key: string, payload: unknown, ownUpdatedAt: string | null) => {
    out.set(recordKeyOf({ kind, key }), { kind, key, payloadJson: canonicalJson(payload), ownUpdatedAt });
  };
  if (store.profile !== null) add('profile', 'profile', store.profile, store.profile.updatedAt);
  const settings = without<unknown>(store.settings as unknown as Record<string, unknown>, DEVICE_ONLY_SETTINGS);
  add('settings', 'settings', settings, store.settings.updatedAt);
  for (const [k, m] of Object.entries(store.menus)) add('menu', k, m, m.updatedAt);
  for (const [k, o] of Object.entries(store.overrides)) add('override', k, o, o.updatedAt);
  for (const [k, d] of Object.entries(store.decisions)) add('decision', k, d, d.updatedAt);
  for (const [k, n] of Object.entries(store.aiUsage)) add('aiUsage', k, { count: n }, null);
  return out;
}

export interface Quarantined {
  key: RecordKey;
  rule: string;
  reason: string;
}

export interface ApplyResult {
  store: BentoMinderStore;
  /** Record keys whose local content differs after the apply. */
  changed: RecordKey[];
  /** Records that were not applied because they fail the contract (US-E15-06/AC9); the local version is kept. */
  quarantined: Quarantined[];
}

type One = { ok: true; store: BentoMinderStore; stamp: string } | { ok: false; rule: string; reason: string };

const isoMs = (s: string): number => Date.parse(s);

function applyOne(store: BentoMinderStore, env: Envelope, ownerId: string): One {
  const checked = validateEnvelope(env, { allowServerFields: true });
  if (!checked.ok) return { ok: false, rule: checked.rule, reason: checked.reason };
  const stamp = env.updatedAt;
  if (env.deletedAt !== undefined) {
    switch (env.kind) {
      case 'profile':
        return { ok: true, store: { ...store, profile: null }, stamp };
      case 'menu': {
        const { [env.key]: _gone, ...rest } = store.menus;
        void _gone;
        return { ok: true, store: { ...store, menus: rest }, stamp };
      }
      case 'override': {
        const { [env.key]: _gone, ...rest } = store.overrides;
        void _gone;
        return { ok: true, store: { ...store, overrides: rest }, stamp };
      }
      case 'decision': {
        const { [env.key]: _gone, ...rest } = store.decisions;
        void _gone;
        return { ok: true, store: { ...store, decisions: rest }, stamp };
      }
      default:
        // The settings record cannot be deleted (a store always has settings); a tombstone for it changes nothing.
        return { ok: true, store, stamp };
    }
  }
  const payload = validatePayload(env.kind, env.key, env.payloadJson ?? '');
  if (!payload.ok) return { ok: false, rule: payload.rule, reason: payload.reason };
  let value: Record<string, unknown> = rewriteOwnerId(payload.value, ownerId);
  if (env.kind !== 'aiUsage' && value['updatedAt'] !== env.updatedAt) {
    // The cloud clamped a future stamp (14.6): the local record adopts the stored value.
    const createdAt = typeof value['createdAt'] === 'string' && isoMs(value['createdAt']) > env.updatedAtMs ? env.updatedAt : value['createdAt'];
    value = { ...value, updatedAt: env.updatedAt, createdAt };
  }
  switch (env.kind) {
    case 'profile':
      return { ok: true, store: { ...store, profile: value as unknown as BentoMinderStore['profile'] }, stamp };
    case 'settings':
      return {
        ok: true,
        store: { ...store, settings: { ...(value as unknown as BentoMinderStore['settings']), language: store.settings.language, theme: store.settings.theme } },
        stamp,
      };
    case 'menu':
      return { ok: true, store: { ...store, menus: { ...store.menus, [env.key]: value as unknown as BentoMinderStore['menus'][string] } }, stamp };
    case 'override':
      return { ok: true, store: { ...store, overrides: { ...store.overrides, [env.key]: value as unknown as BentoMinderStore['overrides'][string] } }, stamp };
    case 'decision':
      return { ok: true, store: { ...store, decisions: { ...store.decisions, [env.key]: value as unknown as BentoMinderStore['decisions'][string] } }, stamp };
    case 'aiUsage':
      return { ok: true, store: { ...store, aiUsage: { ...store.aiUsage, [env.key]: value['count'] as number } }, stamp };
  }
}

function storeIssues(store: BentoMinderStore, allowed: readonly string[]): boolean {
  const checked = validateStore(store);
  return checked.ok && ownerMismatchesFor(checked.state, allowed).length === 0;
}

/**
 * Writes the given winners into the store (US-E15-07/AC10). Each record is validated by the schema of its kind; a
 * record that fails is quarantined and the local version kept (US-E15-06/AC9). The whole store is validated after
 * the apply (BR-03); if that fails (a cross-record fault) the records are applied one at a time and the offender is
 * quarantined, so the result never breaks the contract. Dangling references need no repair here: the dormant and
 * cleared states of contract 3.6 are derived on read, so the stored record is kept byte for byte.
 * `ownerId` is the family id while a member (every applied record takes it); `allowedOwnerIds` is the list the
 * whole-store check accepts (uid and family id).
 */
export function applyEnvelopes(
  store: BentoMinderStore,
  envelopes: readonly Envelope[],
  options: { ownerId: string; allowedOwnerIds?: readonly string[] },
): ApplyResult {
  const allowed = options.allowedOwnerIds ?? [options.ownerId];
  const before = extractRecords(store);
  const quarantined: Quarantined[] = [];

  const run = (list: readonly Envelope[], validateEach: boolean): BentoMinderStore => {
    let current = store;
    let latest = store.updatedAt;
    for (const env of list) {
      const key = recordKeyOf(env);
      const one = applyOne(current, env, options.ownerId);
      if (!one.ok) {
        quarantined.push({ key, rule: one.rule, reason: one.reason });
        continue;
      }
      if (validateEach && !storeIssues(one.store, allowed)) {
        quarantined.push({ key, rule: 'store-invalid-after-apply', reason: 'whole-store-validation' });
        continue;
      }
      current = one.store;
      if (isoMs(one.stamp) > isoMs(latest)) latest = one.stamp;
    }
    return current === store ? store : { ...current, updatedAt: latest };
  };

  let next = run(envelopes, false);
  if (next !== store && !storeIssues(next, allowed)) {
    quarantined.length = 0;
    next = run(envelopes, true);
  }
  const after = extractRecords(next);
  const changed: RecordKey[] = [];
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    if (before.get(k)?.payloadJson !== after.get(k)?.payloadJson) changed.push(k);
  }
  // Nothing changed (a tombstone for a record that is not there, an identical record): the store object is kept as is.
  return { store: changed.length === 0 ? store : next, changed, quarantined };
}
