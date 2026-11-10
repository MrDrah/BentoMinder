// ADR 016 section 3 (engine.ts, the pure part): one pull / merge / apply / push cycle over a SyncPort. No timers, no
// clock reads, no storage: the caller (the engine of slice C, or a test driving two simulated devices) passes the store,
// the metadata, the schedule and `nowMs`, and persists what comes back. Partial progress is returned even on an error,
// so nothing that was sent is sent twice.
//
// Order: pull first (so a pending local edit is compared with what the family already holds), apply the winners,
// then push what is still pending, then apply anything the server answered with (a newer winner, a clamped stamp).
import { toJstTimestamp, type Instant } from '../time/jst.ts';
import type { BentoMinderStore } from '../schema/store.ts';
import { CURRENT_SCHEMA_VERSION } from '../schema/store.ts';
import { SYNC_LIMITS } from './config.ts';
import { detectDirty, pendingSummary, type DirtyRecord } from './dirty.ts';
import { hashString, utf8Bytes, without } from './hash.ts';
import { consentOk } from './gate.ts';
import { compareEnvelopes, isBeyondRetention, isStaleDevice, winnerOf } from './merge.ts';
import type { Baseline, SyncMeta } from './meta.ts';
import { applyEnvelopes, extractRecords, type Quarantined } from './records.ts';
import { recordWrites, selectDue, type ScheduleState } from './schedule.ts';
import { tombstoneEnvelope } from './envelope.ts';
import {
  SyncPortError,
  recordKeyOf,
  type Envelope,
  type RecordKey,
  type StoredEnvelope,
  type SyncPort,
  type EndedReason,
} from './types.ts';
import type { StatusFacts } from './status.ts';

export interface LostEdit {
  kind: Envelope['kind'];
  key: string;
}

export type CycleOutcome =
  | { kind: 'ok' }
  | { kind: 'no-family' }
  /** A join was interrupted (US-E15-04/AC11): finish it before any record is synced. */
  | { kind: 'adoption-pending' }
  | { kind: 'paused-no-consent' }
  | { kind: 'paused-app-too-old' }
  | { kind: 'paused-limit'; scope: 'record' | 'family' | 'writes' }
  | { kind: 'offline' }
  | { kind: 'retry' }
  | { kind: 'unauthenticated' }
  | { kind: 'membership-ended'; reason: EndedReason }
  | { kind: 'refused'; detail: string | undefined };

export interface CycleResult {
  store: BentoMinderStore;
  meta: SyncMeta;
  schedule: ScheduleState;
  outcome: CycleOutcome;
  /** Local pending edits that lost to a newer family edit; the app notes each once (US-E15-07/AC8). */
  lostEdits: LostEdit[];
  /** Downloaded records that failed validation and were ignored (US-E15-06/AC9). */
  quarantined: Quarantined[];
  /** Record keys sent and accepted in this cycle. */
  pushed: RecordKey[];
  /** Number of records downloaded in this cycle. */
  pulled: number;
  storeChanged: boolean;
  pendingCount: number;
  oldestPendingAt: string | null;
  limitHit: boolean;
  /** Earliest time (ms) a deferred record becomes sendable (coalescing or the hourly window); null if none. */
  nextSendAt: number | null;
}

export interface CycleInput {
  port: SyncPort;
  uid: string;
  store: BentoMinderStore;
  meta: SyncMeta;
  schedule: ScheduleState;
  nowMs: number;
  /** The app's schema version (the cloud's must not be above it). */
  appSchemaVersion?: number;
  /** The app's cloud-notice version for the consent gate. */
  noticeVersion?: number;
}

const stamp = (ms: number): string => toJstTimestamp(ms as Instant);

function outcomeOf(err: unknown): CycleOutcome {
  if (!(err instanceof SyncPortError)) throw err;
  switch (err.kind) {
    case 'offline':
      return { kind: 'offline' };
    case 'temporary':
      return { kind: 'retry' };
    case 'unauthenticated':
      return { kind: 'unauthenticated' };
    case 'consent-required':
      return { kind: 'paused-no-consent' };
    case 'app-too-old':
      return { kind: 'paused-app-too-old' };
    case 'limit': {
      const d = err.detail;
      return { kind: 'paused-limit', scope: d === 'record' || d === 'family' ? d : 'writes' };
    }
    case 'membership-ended': {
      const d = err.detail;
      return { kind: 'membership-ended', reason: d === 'left' || d === 'removed' ? d : 'family-deleted' };
    }
    case 'refused':
      return { kind: 'refused', detail: err.detail };
  }
}

/** Baseline of a record after it was applied or sent: hash of what the local store now holds for it. */
function baselineFrom(store: BentoMinderStore, env: Envelope, key: RecordKey): Baseline | null {
  if (env.deletedAt !== undefined) return { hash: '', updatedAt: env.updatedAt, deleted: true };
  const rec = extractRecords(store).get(key);
  return rec === undefined ? null : { hash: hashString(rec.payloadJson), updatedAt: env.updatedAt };
}

export async function syncCycle(input: CycleInput): Promise<CycleResult> {
  const { port, uid, nowMs } = input;
  const appSchema = input.appSchemaVersion ?? CURRENT_SCHEMA_VERSION;
  let store = input.store;
  let meta = input.meta;
  let schedule = input.schedule;
  const lostEdits: LostEdit[] = [];
  const quarantined: Quarantined[] = [];
  const pushed: RecordKey[] = [];
  let pulled = 0;
  let limitHit = false;
  let nextSendAt: number | null = null;
  let outcome: CycleOutcome = { kind: 'ok' };

  const finish = (): CycleResult => {
    const d = detectDirty({ store, baselines: meta.baselines, pending: meta.pending, nowMs, uid });
    const sum = pendingSummary(d.dirty);
    return {
      store,
      meta,
      schedule,
      outcome,
      lostEdits,
      quarantined,
      pushed,
      pulled,
      storeChanged: store !== input.store,
      pendingCount: sum.count,
      oldestPendingAt: sum.oldestPendingAt,
      limitHit,
      nextSendAt,
    };
  };

  const familyId = meta.familyId;
  if (familyId === null) return { ...finish(), outcome: { kind: 'no-family' } };
  if (meta.adoption !== null && !meta.adoption.done) return { ...finish(), outcome: { kind: 'adoption-pending' } };
  if (!consentOk(meta, input.noticeVersion)) return { ...finish(), outcome: { kind: 'paused-no-consent' } };

  const allowedOwnerIds = [uid, familyId];

  /** Applies winners to the store and moves their baselines; returns the keys actually applied. */
  const applyWinners = (winners: readonly Envelope[]): void => {
    if (winners.length === 0) return;
    const result = applyEnvelopes(store, winners, { ownerId: familyId, allowedOwnerIds });
    quarantined.push(...result.quarantined);
    const bad = new Set(result.quarantined.map((q) => q.key));
    let baselines = { ...meta.baselines };
    for (const env of winners) {
      const key = recordKeyOf(env);
      if (bad.has(key)) continue;
      if (env.kind === 'settings' && env.deletedAt !== undefined) continue;
      const b = baselineFrom(result.store, env, key);
      if (b === null) baselines = without(baselines, [key]);
      else baselines[key] = b;
    }
    store = result.store;
    meta = { ...meta, baselines };
  };

  try {
    // 1. Pull. A device idle for more than 90 days pulls everything and reconciles (US-E15-07/AC6).
    const stale = isStaleDevice(meta.lastSyncedAt === null ? null : Date.parse(meta.lastSyncedAt), nowMs);
    let cursor = stale ? 0 : meta.cursor;
    const remote: StoredEnvelope[] = [];
    for (;;) {
      const page = await port.pull(cursor);
      if (page.schemaVersion > appSchema) {
        outcome = { kind: 'paused-app-too-old' };
        return finish();
      }
      remote.push(...page.envelopes);
      cursor = page.seq;
      if (!page.hasMore) break;
    }
    pulled = remote.length;

    // 2. Decide per record against the local pending edit, then apply the winners.
    const before = detectDirty({ store, baselines: meta.baselines, pending: meta.pending, nowMs, uid });
    const pendingByKey = new Map<RecordKey, DirtyRecord>(before.dirty.map((d) => [d.key, d]));
    const byKey = new Map<RecordKey, StoredEnvelope[]>();
    for (const r of remote) {
      const k = recordKeyOf(r);
      byKey.set(k, [...(byKey.get(k) ?? []), r]);
    }
    const toApply: Envelope[] = [];
    for (const [key, versions] of byKey) {
      const r = winnerOf(versions);
      if (r === undefined) continue;
      if (r.deletedAt === undefined && isBeyondRetention(r.kind, r.key, nowMs)) continue; // never resurrect (AC12)
      const local = pendingByKey.get(key);
      if (local !== undefined) {
        if (compareEnvelopes(r, local.envelope) > 0) {
          toApply.push(r);
          lostEdits.push({ kind: r.kind, key: r.key });
        }
        continue;
      }
      const base = meta.baselines[key];
      if (base !== undefined) {
        if (r.updatedAtMs < Date.parse(base.updatedAt)) continue; // an older version than the one already synced
        const same = base.deleted === true ? r.deletedAt !== undefined : r.deletedAt === undefined && base.hash === hashString(r.payloadJson ?? '');
        if (same && base.updatedAt === r.updatedAt) continue;
      }
      toApply.push(r);
    }
    if (stale) {
      const cloud = new Set(byKey.keys());
      for (const [key, base] of Object.entries(meta.baselines)) {
        if (cloud.has(key) || base.deleted === true || pendingByKey.has(key) || key.startsWith('settings_')) continue;
        if (!extractRecords(store).has(key)) continue;
        const sep = key.indexOf('_');
        // Unchanged since the last sync and gone from the cloud: removed locally, not resurrected, not sent.
        toApply.push(
          tombstoneEnvelope({ kind: key.slice(0, sep) as Envelope['kind'], key: key.slice(sep + 1), updatedAt: base.updatedAt, updatedBy: uid, deviceId: store.deviceId }),
        );
      }
    }
    applyWinners(toApply);
    meta = { ...meta, cursor };

    // 3. Push what is still pending, as far as the schedule and the size limits allow.
    const d = detectDirty({ store, baselines: meta.baselines, pending: meta.pending, nowMs, uid });
    meta = { ...meta, pending: d.pending };
    if (d.forget.length > 0) {
      meta = { ...meta, baselines: without(meta.baselines, d.forget) };
    }
    const tooLarge = d.dirty.filter((x) => x.envelope.payloadJson !== undefined && utf8Bytes(x.envelope.payloadJson) > SYNC_LIMITS.maxRecordBytes);
    if (tooLarge.length > 0) {
      limitHit = true;
      outcome = { kind: 'paused-limit', scope: 'record' };
    }
    const eligible = d.dirty.filter((x) => !tooLarge.includes(x));
    const due = selectDue(schedule, eligible.map((x) => x.key), nowMs);
    nextSendAt = due.nextAt;
    if (due.limitHit) {
      limitHit = true;
      outcome = { kind: 'paused-limit', scope: 'writes' };
    }
    const byDirtyKey = new Map(eligible.map((x) => [x.key, x.envelope]));
    const toSend = due.send.map((k) => byDirtyKey.get(k)).filter((e): e is Envelope => e !== undefined);
    const followUp: Envelope[] = [];
    try {
      for (let i = 0; i < toSend.length; i += SYNC_LIMITS.pushBatchSize) {
        const batch = toSend.slice(i, i + SYNC_LIMITS.pushBatchSize);
        const results = await port.push(batch);
        const sentByKey = new Map(batch.map((e) => [recordKeyOf(e), e]));
        const baselines = { ...meta.baselines };
        const sentKeys: RecordKey[] = [];
        for (const res of results) {
          const key = recordKeyOf(res);
          const sent = sentByKey.get(key);
          if (sent === undefined) continue;
          sentKeys.push(key);
          if (res.status === 'accepted') {
            pushed.push(key);
            if (res.stored.updatedAtMs !== sent.updatedAtMs) followUp.push(res.stored); // clamped: adopt the stored stamp
            else if (sent.deletedAt !== undefined) baselines[key] = { hash: '', updatedAt: sent.updatedAt, deleted: true };
            else baselines[key] = { hash: hashString(sent.payloadJson ?? ''), updatedAt: sent.updatedAt };
          } else {
            lostEdits.push({ kind: res.kind, key: res.key });
            followUp.push(res.winner);
          }
        }
        meta = { ...meta, baselines };
        schedule = recordWrites(schedule, sentKeys, nowMs);
      }
    } finally {
      // Whatever the port answered before an error is kept (nothing sent is sent twice).
      applyWinners(followUp);
    }
    if (due.limitHit === false && tooLarge.length === 0) {
      meta = { ...meta, lastSyncedAt: stamp(nowMs) };
    }
  } catch (err) {
    outcome = outcomeOf(err);
    if (outcome.kind === 'paused-limit') limitHit = true;
  }
  return finish();
}

/** The status facts of a finished cycle (the engine adds `online`, `syncing`, `retrying` as it knows them). */
export function statusFactsOf(
  result: CycleResult,
  extra: { online: boolean; syncing?: boolean; retrying?: boolean },
): StatusFacts {
  const o = result.outcome.kind;
  return {
    membership: o === 'membership-ended' ? 'ended' : result.meta.familyId === null ? 'none' : 'member',
    online: extra.online && o !== 'offline',
    pending: result.pendingCount,
    consentOk: o !== 'paused-no-consent',
    schemaOk: o !== 'paused-app-too-old',
    limitHit: result.limitHit || o === 'paused-limit',
    retrying: (extra.retrying ?? false) || o === 'retry',
    syncing: extra.syncing ?? false,
  };
}
