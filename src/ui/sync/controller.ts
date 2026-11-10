// ADR 016 slice C: the sync controller, the run-time around the pure engine (src/domain/sync/cycle.ts). One per signed-in
// account. It owns the timers and the page events, persists the sync metadata under `bentominder.<uid>.sync`, and talks
// to the local repository only: the UI reads the repository's store, never the cloud. No visible UI here; slice D renders
// `getState()` (the nine statuses, contract 14.9).
import type { Storage } from '../../domain/ports.ts';
import type { BentoMinderStore } from '../../domain/schema/store.ts';
import { StoreConflictError, type Repository } from '../../domain/storage/repository.ts';
import { syncCycle, type CycleResult, type LostEdit } from '../../domain/sync/cycle.ts';
import { detectDirty, noteLocalChange } from '../../domain/sync/dirty.ts';
import type { HostEvent, SyncHost } from '../../domain/sync/host.ts';
import { emptySyncMeta, parseSyncMeta, serializeSyncMeta, syncMetaKey, type SyncMeta } from '../../domain/sync/meta.ts';
import type { OwnerScope } from '../../domain/sync/owner-scope.ts';
import { withPushGuard } from '../../domain/sync/push-guard.ts';
import { emptySchedule, nextDelay, pollDelayMs, type ScheduleState } from '../../domain/sync/schedule.ts';
import { pendingSummary } from '../../domain/sync/dirty.ts';
import { statusView, type StatusFacts } from '../../domain/sync/status.ts';
import type { EndedReason, SyncPort } from '../../domain/sync/types.ts';
import { DISABLED_SYNC_STATE, type SyncState } from './state.ts';

export { DISABLED_SYNC_STATE, type SyncState };

/** After a local commit the cycle runs this soon (the engine's own coalescing decides what is actually sent). */
export const LOCAL_CHANGE_DELAY_MS = 2000;
/** A cycle that lost a race with a local save is run again after this. */
export const CONFLICT_RETRY_MS = 1000;

export interface SyncController {
  getState(): SyncState;
  subscribe(listener: () => void): () => void;
  /** Starts the page events, the 60 s poll and a first cycle. Idempotent. */
  start(): void;
  /** Sign-out or unmount: everything stops; the queue stays in the account's keys. Idempotent, final. */
  stop(): void;
  /** True until `stop()`: the token supplier of the port checks it, so nothing is sent after sign-out. */
  readonly active: boolean;
  /** 「今すぐ再試行」 and the first cycle after slice D wrote the membership: a cycle now, back-off cleared. */
  syncNow(): void;
  /** After EVERY local commit (slice A decision 4). */
  localChanged(store: BentoMinderStore): Promise<void>;
  /** Delete-all while a member (US-E15-11/AC7): forget baselines so the next cycle downloads instead of deleting. */
  localDataDeleted(): Promise<void>;
  /** Slice D wrote the metadata (create, join, leave): re-read it and run a cycle. */
  metaChanged(): Promise<void>;
  /** The store the engine applied from the family is now saved; the app shows it. */
  onStoreApplied(handler: (store: BentoMinderStore) => void): () => void;
  clearNotices(): void;
}

export interface SyncControllerDeps {
  uid: string;
  port: SyncPort;
  repository: Repository;
  storage: Storage;
  scope: OwnerScope;
  host: SyncHost;
  nowMs: () => number;
  random: () => number;
  /** A fresh empty store for a device with no local copy (kept for the life of the controller). */
  freshStore: () => BentoMinderStore;
  /** Shared with the port's token supplier: set false by `stop()`. */
  alive: { current: boolean };
  /** Ignored-download count reported by the adapter (envelopes that failed the envelope rules). */
  ignoredFromAdapter?: { take(): number };
  noticeVersion?: number;
}

export interface LoadedMeta {
  meta: SyncMeta;
  /** The stored document was written by a newer app: sync is paused and the document is never touched. */
  tooNew: boolean;
}

/** Reads the account's sync metadata; unreadable = no baselines (a first sync is safe, ADR 016 section 4). */
export async function loadSyncMeta(storage: Storage, uid: string): Promise<LoadedMeta> {
  const parsed = parseSyncMeta(await storage.read(syncMetaKey(uid)));
  if (parsed.kind === 'ok') return { meta: parsed.meta, tooNew: false };
  return { meta: emptySyncMeta(), tooNew: parsed.kind === 'too-new' };
}

export function createSyncController(deps: SyncControllerDeps): SyncController {
  const { uid, repository, storage, scope, host, nowMs, random, alive } = deps;
  const port = withPushGuard(deps.port, nowMs);
  const metaKey = syncMetaKey(uid);
  const listeners = new Set<() => void>();
  const appliedHandlers = new Set<(store: BentoMinderStore) => void>();

  let started = false;
  let running = false;
  let rerun = false;
  let halted = false; // nothing to do until syncNow / metaChanged (no family, ended, no consent, app too old)
  let tooNew = false;
  let meta: SyncMeta = emptySyncMeta();
  let schedule: ScheduleState = emptySchedule();
  let attempt = 0;
  let firstFailureAt: number | null = null;
  let retrying = false;
  let limitHit = false;
  let consentOk = true;
  let schemaOk = true;
  let membershipEnded: EndedReason | null = null;
  let pending = 0;
  let oldestPendingAt: string | null = null;
  let lostEdits: LostEdit[] = [];
  let ignored = 0;
  let syncing = false;
  let fresh: BentoMinderStore | null = null;
  let unsubscribeHost: (() => void) | null = null;
  let soonTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let sendTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let metaQueue: Promise<unknown> = Promise.resolve();
  const serialMeta = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = metaQueue.then(task, task);
    metaQueue = run.catch(() => undefined);
    return run;
  };

  let state: SyncState = { ...DISABLED_SYNC_STATE, enabled: true };

  function publish(): void {
    const facts: StatusFacts = {
      membership: membershipEnded !== null ? 'ended' : meta.familyId === null && !tooNew ? 'none' : 'member',
      online: host.isOnline(),
      pending,
      consentOk,
      schemaOk: schemaOk && !tooNew,
      limitHit,
      retrying,
      syncing,
    };
    state = {
      enabled: true,
      view: statusView({ facts, lastSyncedAt: meta.lastSyncedAt, oldestPendingAt, firstFailureAtMs: firstFailureAt, nowMs: nowMs() }),
      endedReason: membershipEnded,
      lostEdits,
      ignoredRecords: ignored,
    };
    for (const l of [...listeners]) l();
  }

  const clear = (t: ReturnType<typeof setTimeout> | null): null => {
    if (t !== null) clearTimeout(t);
    return null;
  };
  const clearAllTimers = (): void => {
    soonTimer = clear(soonTimer);
    retryTimer = clear(retryTimer);
    sendTimer = clear(sendTimer);
    pollTimer = clear(pollTimer);
  };

  function armPoll(): void {
    pollTimer = clear(pollTimer);
    if (!started || !alive.current || halted) return;
    const d = pollDelayMs({ visible: host.isVisible(), online: host.isOnline() });
    if (d !== null) pollTimer = setTimeout(() => requestCycle(0), d);
  }

  function requestCycle(delayMs: number): void {
    if (!started || !alive.current) return;
    if (running) {
      rerun = true;
      return;
    }
    soonTimer = clear(soonTimer);
    soonTimer = setTimeout(() => {
      soonTimer = null;
      void execute();
    }, delayMs);
  }

  async function readMeta(): Promise<void> {
    const loaded = await loadSyncMeta(storage, uid);
    meta = loaded.meta;
    tooNew = loaded.tooNew;
    scope.setFamilyId(meta.familyId);
    consentOk = tooNew || (meta.consent !== null && meta.consent.version >= (deps.noticeVersion ?? 1));
  }

  async function writeMeta(next: SyncMeta): Promise<void> {
    const text = serializeSyncMeta(next);
    if (text === serializeSyncMeta(meta) && (await storage.read(metaKey)) !== null) return;
    meta = next;
    try {
      await storage.write(metaKey, text);
    } catch {
      // Storage full or unavailable: the cycle's progress is simply repeated next time.
    }
  }

  /** Keeps tombstone times noted by `localChanged` while the network call was running (they are the newer truth). */
  function mergePending(result: CycleResult, latest: SyncMeta): SyncMeta {
    const pendingNow: SyncMeta['pending'] = { ...result.meta.pending };
    const sent = new Set(result.pushed);
    for (const [k, t] of Object.entries(latest.pending)) {
      if (sent.has(k)) continue;
      pendingNow[k] = Math.min(pendingNow[k] ?? t, t);
    }
    return { ...result.meta, pending: pendingNow };
  }

  const resetBaselines = (m: SyncMeta): SyncMeta => ({ ...m, cursor: 0, baselines: {}, pending: {}, lastSyncedAt: null });

  async function execute(): Promise<void> {
    if (running || !started || !alive.current) return;
    running = true;
    rerun = false;
    syncing = true;
    publish();
    let again: number | null = null;
    try {
      await serialMeta(readMeta);
      if (!alive.current) return;
      if (tooNew) {
        halted = true;
        return;
      }
      if (meta.familyId === null) {
        halted = true;
        membershipEnded = null;
        pending = 0;
        oldestPendingAt = null;
        return;
      }
      const loaded = await repository.load();
      let store: BentoMinderStore;
      if (loaded.kind === 'ok' || loaded.kind === 'recovered-from-prev') store = loaded.state;
      else if (loaded.kind === 'empty') {
        fresh ??= deps.freshStore();
        store = fresh;
        if (Object.keys(meta.baselines).length > 0) {
          // The local copy was deleted (US-E15-11/AC7): download again, never send the emptiness as deletions.
          await serialMeta(() => writeMeta(resetBaselines(meta)));
        }
      } else {
        // Unreadable or newer than this app: local recovery owns it (US-E10-02); sync leaves it alone.
        halted = true;
        return;
      }

      const t0 = nowMs();
      const result = await syncCycle({
        port,
        uid,
        store,
        meta,
        schedule,
        nowMs: t0,
        ...(deps.noticeVersion === undefined ? {} : { noticeVersion: deps.noticeVersion }),
      });
      if (!alive.current) return; // signed out meanwhile: nothing is saved or shown under this controller

      if (result.storeChanged) {
        try {
          await repository.save(result.store);
        } catch (err) {
          if (err instanceof StoreConflictError) {
            again = CONFLICT_RETRY_MS; // a local save came first: start over from what is stored now
            return;
          }
          throw err;
        }
        for (const h of [...appliedHandlers]) h(result.store);
      }
      await serialMeta(async () => {
        const latest = (await loadSyncMeta(storage, uid)).meta;
        await writeMeta(mergePending(result, latest));
      });
      schedule = result.schedule;
      lostEdits = [...lostEdits, ...result.lostEdits];
      ignored += result.quarantined.length + (deps.ignoredFromAdapter?.take() ?? 0);
      settle(result);
    } catch {
      // Anything not a port error (a bug or a storage failure) is handled calmly like a temporary failure.
      failedCalmly();
    } finally {
      running = false;
      syncing = false;
      if (alive.current) {
        publish();
        if (again !== null) requestCycle(again);
        else if (rerun) requestCycle(0);
        armPoll();
      }
    }
  }

  function failedCalmly(): void {
    retrying = true;
    firstFailureAt ??= nowMs();
    retryTimer = clear(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      requestCycle(0);
    }, nextDelay(attempt++, random));
  }

  /** Status facts and the next wake-up after a finished cycle (contract 14.9, 14.10). */
  function settle(result: CycleResult): void {
    pending = result.pendingCount;
    oldestPendingAt = result.oldestPendingAt;
    const o = result.outcome;
    retrying = false;
    limitHit = false;
    schemaOk = o.kind !== 'paused-app-too-old';
    consentOk = o.kind !== 'paused-no-consent';
    membershipEnded = o.kind === 'membership-ended' ? o.reason : null;
    halted = ['no-family', 'adoption-pending', 'paused-no-consent', 'paused-app-too-old', 'membership-ended'].includes(o.kind);
    sendTimer = clear(sendTimer);
    switch (o.kind) {
      case 'ok':
        attempt = 0;
        firstFailureAt = null;
        retryTimer = clear(retryTimer);
        break;
      case 'paused-limit':
        limitHit = true;
        break;
      case 'retry':
      case 'refused':
        retrying = true;
        firstFailureAt ??= nowMs();
        retryTimer = clear(retryTimer);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          requestCycle(0);
        }, nextDelay(attempt++, random));
        break;
      default:
        break;
    }
    if (meta.familyId !== null && result.nextSendAt !== null && !halted) {
      const wait = Math.max(0, result.nextSendAt - nowMs()) + 50;
      sendTimer = setTimeout(() => {
        sendTimer = null;
        requestCycle(0);
      }, wait);
    }
  }

  function onHostEvent(event: HostEvent): void {
    switch (event) {
      case 'online':
        attempt = 0;
        retryTimer = clear(retryTimer);
        requestCycle(0);
        break;
      case 'focus':
      case 'visible':
        if (retryTimer === null) requestCycle(0);
        armPoll();
        break;
      case 'hidden':
        pollTimer = clear(pollTimer);
        break;
      case 'offline':
        break;
    }
    publish();
  }

  async function noteChange(store: BentoMinderStore): Promise<void> {
    await serialMeta(async () => {
      await readMeta();
      if (tooNew || meta.familyId === null) return;
      const next = noteLocalChange({ store, meta, nowMs: nowMs(), uid });
      if (next.pending !== meta.pending || next.baselines !== meta.baselines) await writeMeta(next);
      const d = detectDirty({ store, baselines: meta.baselines, pending: meta.pending, nowMs: nowMs(), uid });
      const sum = pendingSummary(d.dirty);
      pending = sum.count;
      oldestPendingAt = sum.oldestPendingAt;
    });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get active() {
      return alive.current;
    },
    start() {
      alive.current = true; // StrictMode (development) stops and starts again; a real sign-out discards the controller
      if (started) return;
      started = true;
      unsubscribeHost = host.subscribe(onHostEvent);
      void serialMeta(readMeta).then(() => {
        if (!alive.current) return;
        publish();
        requestCycle(0);
      });
    },
    stop() {
      alive.current = false;
      started = false;
      clearAllTimers();
      unsubscribeHost?.();
      unsubscribeHost = null;
    },
    syncNow() {
      halted = false;
      attempt = 0;
      retryTimer = clear(retryTimer);
      requestCycle(0);
    },
    async localChanged(store) {
      if (!alive.current) return;
      await noteChange(store);
      if (!alive.current) return;
      publish();
      if (started && !halted) requestCycle(LOCAL_CHANGE_DELAY_MS);
    },
    async localDataDeleted() {
      if (!alive.current) return;
      await serialMeta(async () => {
        await readMeta();
        if (meta.familyId === null) return;
        schedule = emptySchedule();
        await writeMeta(resetBaselines(meta));
      });
      if (started) {
        halted = false;
        requestCycle(0);
      }
    },
    async metaChanged() {
      await serialMeta(readMeta);
      halted = false;
      membershipEnded = null;
      publish();
      requestCycle(0);
    },
    onStoreApplied(handler) {
      appliedHandlers.add(handler);
      return () => appliedHandlers.delete(handler);
    },
    clearNotices() {
      lostEdits = [];
      ignored = 0;
      publish();
    },
  };
}

