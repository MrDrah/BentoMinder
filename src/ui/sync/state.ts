// The state slice D renders (types and the "sync is off" value only, so the app shell can use it without loading the engine).
import type { LostEdit } from '../../domain/sync/cycle.ts';
import type { StatusView } from '../../domain/sync/status.ts';
import type { EndedReason } from '../../domain/sync/types.ts';

export interface SyncState {
  /** False when sync is not configured at all (no VITE_SYNC_BASE_URL): the app is exactly as before E15. */
  enabled: boolean;
  /** The one of nine statuses plus last-synced time, pending count and the retry-now flag (US-E15-06/AC4-AC6). */
  view: StatusView;
  /** Why membership ended (slice D shows the notice and acknowledges), else null. */
  endedReason: EndedReason | null;
  /** Local edits that lost to a newer family edit, not yet shown (US-E15-07/AC8). */
  lostEdits: readonly LostEdit[];
  /** Downloaded records that were ignored, not yet shown once (US-E15-06/AC9). */
  ignoredRecords: number;
}

export const DISABLED_SYNC_STATE: SyncState = {
  enabled: false,
  view: { state: 'local-only', lastSyncedAt: null, pendingCount: 0, oldestPendingAt: null, stale: false, showRetryNow: false },
  endedReason: null,
  lostEdits: [],
  ignoredRecords: 0,
};
