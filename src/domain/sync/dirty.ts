// ADR 016 section 3 (dirty.ts): change detection without touching the store shape. The queue is derived, never
// stored: a record is pending when its hash differs from the baseline of the last synced version, a baseline key
// absent from the store is a deletion. It survives restarts for free (US-E15-06/AC2: 3 records, not 5 edits).
import { toJstTimestamp, type Instant } from '../time/jst.ts';
import { hashString, without } from './hash.ts';
import { liveEnvelope, tombstoneEnvelope } from './envelope.ts';
import { isBeyondRetention } from './merge.ts';
import type { Baseline, SyncMeta } from './meta.ts';
import { extractRecords, type LocalRecord } from './records.ts';
import type { BentoMinderStore } from '../schema/store.ts';
import type { Envelope, RecordKey } from './types.ts';

export interface DirtyRecord {
  key: RecordKey;
  envelope: Envelope;
}

export interface DirtyResult {
  /** Pending records, tombstones included, in a stable order (record key). */
  dirty: DirtyRecord[];
  /** The updated `meta.pending` (first-noticed times of deletions that are still unsent). */
  pending: Record<RecordKey, number>;
  /** Baseline keys to drop without a tombstone (aiUsage is never deleted in the cloud). */
  forget: RecordKey[];
}

const stamp = (ms: number): string => toJstTimestamp(ms as Instant);

/**
 * `updatedAt` of an envelope: the record's own, or `now` for aiUsage and deletions. A re-edit inside the same second
 * as the last synced version (stamps have one-second resolution) gets one second more than the baseline, so the newer
 * content always beats the older one (also a record re-created after its tombstone, US-E15-07/AC5).
 */
function stampFor(own: string | null, nowMs: number, baseline: Baseline | undefined): string {
  const wanted = own ?? stamp(nowMs);
  if (baseline === undefined) return wanted;
  const floor = Date.parse(baseline.updatedAt) + 1000;
  return Date.parse(wanted) < floor ? stamp(floor) : wanted;
}

/** A settings record that was never edited since it was created (createdAt = updatedAt): still the defaults. */
function isPristineSettings(rec: LocalRecord): boolean {
  if (rec.kind !== 'settings') return false;
  const doc = JSON.parse(rec.payloadJson) as { createdAt?: unknown };
  return doc.createdAt === rec.ownUpdatedAt;
}

export function detectDirty(input: {
  store: BentoMinderStore;
  baselines: Readonly<Record<RecordKey, Baseline>>;
  pending: Readonly<Record<RecordKey, number>>;
  nowMs: number;
  uid: string;
}): DirtyResult {
  const { store, baselines, nowMs, uid } = input;
  const local = extractRecords(store);
  const dirty: DirtyRecord[] = [];
  const pending: Record<RecordKey, number> = {};
  const forget: RecordKey[] = [];

  for (const [key, rec] of local) {
    const base = baselines[key];
    if (base !== undefined && base.deleted !== true && base.hash === hashString(rec.payloadJson)) continue;
    if (isBeyondRetention(rec.kind, rec.key, nowMs)) continue; // not written to the cloud (contract 14.6)
    if (base === undefined && isPristineSettings(rec)) continue; // never edited: defaults are not data (contract 14.4, US-E15-01/AC4)
    dirty.push({
      key,
      envelope: liveEnvelope({
        kind: rec.kind,
        key: rec.key,
        payloadJson: rec.payloadJson,
        updatedAt: stampFor(rec.ownUpdatedAt, nowMs, base),
        updatedBy: uid,
        deviceId: store.deviceId,
      }),
    });
  }

  for (const [key, base] of Object.entries(baselines)) {
    if (local.has(key) || base.deleted === true) continue;
    const sep = key.indexOf('_');
    const kind = key.slice(0, sep) as Envelope['kind'];
    if (kind === 'aiUsage') {
      forget.push(key);
      continue;
    }
    const first = input.pending[key] ?? nowMs;
    pending[key] = first;
    dirty.push({
      key,
      envelope: tombstoneEnvelope({
        kind,
        key: key.slice(sep + 1),
        updatedAt: stampFor(stamp(first), first, base),
        updatedBy: uid,
        deviceId: store.deviceId,
      }),
    });
  }

  dirty.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { dirty, pending, forget };
}

/**
 * To be called after every local commit (ADR 016 section 3): fixes the time of a deletion at the moment it was made, so a
 * tombstone whose push is deferred or offline does not look newer than an edit another device made in between.
 */
export function noteLocalChange(input: {
  store: BentoMinderStore;
  meta: SyncMeta;
  nowMs: number;
  uid: string;
}): SyncMeta {
  const d = detectDirty({ store: input.store, baselines: input.meta.baselines, pending: input.meta.pending, nowMs: input.nowMs, uid: input.uid });
  return { ...input.meta, pending: d.pending, baselines: d.forget.length === 0 ? input.meta.baselines : without(input.meta.baselines, d.forget) };
}

/** Records pending for the status line: how many, and the oldest pending edit's stamp (US-E15-06/AC6). */
export function pendingSummary(dirty: readonly DirtyRecord[]): { count: number; oldestPendingAt: string | null } {
  let oldest: string | null = null;
  for (const d of dirty) if (oldest === null || d.envelope.updatedAtMs < Date.parse(oldest)) oldest = d.envelope.updatedAt;
  return { count: dirty.length, oldestPendingAt: oldest };
}
