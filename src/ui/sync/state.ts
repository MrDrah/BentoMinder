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
  /** Slice D. The family the metadata names, else null. */
  familyId: string | null;
  /** The cached consent of this device (version and ISO time), else null. */
  consent: { version: number; at: string } | null;
  /** A join was committed but the question "what happens to this device's data" is not answered (US-E15-04/AC4, AC11). */
  adoptionPending: boolean;
  /** The question was raised by this session's membership read (a further device of a member), not by a join (US-E15-05/AC6). */
  adoptionFromDiscovery: boolean;
  /** When the backup copy of the pre-join data was made, else null (US-E15-04/AC5). */
  safetyCreatedAt: string | null;
  /** The start-up membership read (US-E15-05): unknown until it answered; failed = could not read. */
  membership: 'unknown' | 'none' | 'member' | 'failed';
  /** Why a size or write limit stopped sending, to choose the status word (US-E15-10/AC1, AC3). */
  limitScope: 'record' | 'family' | 'writes' | null;
}

export const DISABLED_SYNC_STATE: SyncState = {
  enabled: false,
  view: { state: 'local-only', lastSyncedAt: null, pendingCount: 0, oldestPendingAt: null, stale: false, showRetryNow: false },
  endedReason: null,
  lostEdits: [],
  ignoredRecords: 0,
  familyId: null,
  consent: null,
  adoptionPending: false,
  adoptionFromDiscovery: false,
  safetyCreatedAt: null,
  membership: 'none',
  limitScope: null,
};
