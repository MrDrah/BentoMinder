// Contract 14.9 / US-E15-06/AC4: the status reducer. Exactly one of nine states, by a fixed precedence.
import { SYNC_LIMITS } from './config.ts';
import { retryNowOffered } from './schedule.ts';
import type { SyncStatus } from './types.ts';

export interface StatusFacts {
  /** Account membership as the device knows it. */
  membership: 'none' | 'member' | 'ended';
  online: boolean;
  /** Pending (unsent) record count. */
  pending: number;
  /** Cached consent version is at least the app's (14.5). */
  consentOk: boolean;
  /** The cloud's schemaVersion is not above the app's. */
  schemaOk: boolean;
  /** A size or write limit stopped sending (14.10). */
  limitHit: boolean;
  /** The last attempt failed with a temporary error and a retry is scheduled. */
  retrying: boolean;
  /** A push or pull is running. */
  syncing: boolean;
}

/** Precedence: membership-ended, local-only, paused-no-consent, paused-app-too-old, paused-limit, pending-offline, retrying, syncing, synced. */
export function computeStatus(f: StatusFacts): SyncStatus {
  if (f.membership === 'ended') return 'membership-ended';
  if (f.membership === 'none') return 'local-only';
  if (!f.consentOk) return 'paused-no-consent';
  if (!f.schemaOk) return 'paused-app-too-old';
  if (f.limitHit) return 'paused-limit';
  if (!f.online && f.pending > 0) return 'pending-offline';
  if (f.retrying) return 'retrying';
  if (f.syncing) return 'syncing';
  return 'synced';
}

export interface StatusView {
  state: SyncStatus;
  lastSyncedAt: string | null;
  pendingCount: number;
  oldestPendingAt: string | null;
  /** Pending changes older than 24 hours: the indicator is highlighted (US-E15-06/AC6). */
  stale: boolean;
  /** 「今すぐ再試行」 is offered (US-E15-06/AC5). */
  showRetryNow: boolean;
}

export function statusView(input: {
  facts: StatusFacts;
  lastSyncedAt: string | null;
  oldestPendingAt: string | null;
  firstFailureAtMs: number | null;
  nowMs: number;
}): StatusView {
  const { facts, nowMs } = input;
  const stale = input.oldestPendingAt !== null && nowMs - Date.parse(input.oldestPendingAt) >= SYNC_LIMITS.staleHighlightMs;
  return {
    state: computeStatus(facts),
    lastSyncedAt: input.lastSyncedAt,
    pendingCount: facts.pending,
    oldestPendingAt: input.oldestPendingAt,
    stale: stale && facts.pending > 0,
    showRetryNow: facts.retrying && retryNowOffered(input.firstFailureAtMs, nowMs),
  };
}
