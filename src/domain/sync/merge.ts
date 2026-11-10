// Contract 14.6: the winner rule and merge, as pure functions (rules sync-winner-deterministic, sync-merge-convergent).
//
// Winner per record: greater `updatedAtMs`; equal: greater `deviceId` (plain string order). The contract's last step
// ("still equal: the later received write") cannot be a pure, order-independent function, so the pure order continues
// with content (a tombstone beats a live record, then the payload text, then `updatedBy`). The server serialises pushes,
// so a same-device same-millisecond rewrite is decided there by arrival; this total order is what makes merge
// commutative, associative and idempotent (ADR 016 section 3, recorded as a decision in the slice A report).
//
// aiUsage is merged by the larger count (contract 14.2) and is never a tombstone (envelope.ts), so the same total
// order with the count first keeps it a semilattice.
import { monthOf, todayJst, addMonths, type Instant, type LocalDate, type YearMonth } from '../time/jst.ts';
import { SYNC_LIMITS, DAY_MS } from './config.ts';
import type { Envelope, RecordKind } from './types.ts';

function cmp(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function aiCount(e: Envelope): number {
  if (e.payloadJson === undefined) return 0;
  try {
    const doc = JSON.parse(e.payloadJson) as { count?: unknown };
    return typeof doc.count === 'number' ? doc.count : 0;
  } catch {
    return 0;
  }
}

/** Total order on two versions of the same record: positive when `a` wins over `b`. 0 only for identical content. */
export function compareEnvelopes(a: Envelope, b: Envelope): number {
  if (a.kind === 'aiUsage' && b.kind === 'aiUsage' && a.deletedAt === undefined && b.deletedAt === undefined) {
    const c = cmp(aiCount(a), aiCount(b));
    if (c !== 0) return c;
  }
  return (
    cmp(a.updatedAtMs, b.updatedAtMs) ||
    cmp(a.deviceId, b.deviceId) ||
    cmp(a.deletedAt === undefined ? 0 : 1, b.deletedAt === undefined ? 0 : 1) ||
    cmp(a.payloadJson ?? '', b.payloadJson ?? '') ||
    cmp(a.updatedBy, b.updatedBy)
  );
}

/** The winning version of one record (both must be the same kind and key). */
export function winner<E extends Envelope>(a: E, b: E): E {
  return compareEnvelopes(a, b) >= 0 ? a : b;
}

/** Folds any number of versions of one record into its winner; undefined for an empty list. */
export function winnerOf<E extends Envelope>(versions: readonly E[]): E | undefined {
  let best: E | undefined;
  for (const v of versions) best = best === undefined ? v : winner(best, v);
  return best;
}

/** Contract 14.6 clock skew: a stamp more than 5 minutes after the receive time becomes the receive time. */
export function clampUpdatedAt(updatedAtMs: number, receivedAtMs: number): number {
  return updatedAtMs > receivedAtMs + SYNC_LIMITS.clockSkewMs ? receivedAtMs : updatedAtMs;
}

/** Contract 14.6: a record of a device whose last sync is more than 90 days old must reconcile (US-E15-07/AC6). */
export function isStaleDevice(lastSyncedAtMs: number | null, nowMs: number): boolean {
  return lastSyncedAtMs !== null && nowMs - lastSyncedAtMs > SYNC_LIMITS.tombstoneRetentionDays * DAY_MS;
}

/** True when the record's day or month is older than the 13-month retention (contract 7): never uploaded, never resurrected. */
export function isBeyondRetention(kind: RecordKind, key: string, nowMs: number): boolean {
  if (kind === 'profile' || kind === 'settings') return false;
  const thisMonth = monthOf(todayJst(nowMs as Instant));
  const cutoff: YearMonth = addMonths(thisMonth, -SYNC_LIMITS.retentionMonths);
  const month = kind === 'menu' || kind === 'aiUsage' ? key : monthOf(key as LocalDate);
  return month < cutoff;
}
