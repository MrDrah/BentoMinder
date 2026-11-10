// ADR 016 slice C: the sync controller, the run-time around the pure engine (src/domain/sync/cycle.ts). One per signed-in
// account. It owns the timers and the page events, persists the sync metadata under `bentominder.<uid>.sync`, and talks
// to the local repository only: the UI reads the repository's store, never the cloud. No visible UI here; slice D renders
// `getState()` (the nine statuses, contract 14.9).
import type { Storage } from '../../domain/ports.ts';
import type { BentoMinderStore } from '../../domain/schema/store.ts';
import { StoreConflictError, type Repository } from '../../domain/storage/repository.ts';
import { CLOUD_NOTICE_VERSION } from '../../domain/sync/config.ts';
import { syncCycle, type CycleResult, type LostEdit } from '../../domain/sync/cycle.ts';
import { detectDirty, noteLocalChange } from '../../domain/sync/dirty.ts';
import type { HostEvent, SyncHost } from '../../domain/sync/host.ts';
import { emptySyncMeta, joinUnsettled, parseSyncMeta, questionOpen, safetyCopyKey, serializeSyncMeta, syncMetaKey, type SyncMeta } from '../../domain/sync/meta.ts';
import type { OwnerScope } from '../../domain/sync/owner-scope.ts';
import { hasForeignOwner, withFamilyOwner } from '../../domain/sync/owner.ts';
import { withPushGuard } from '../../domain/sync/push-guard.ts';
import { emptySchedule, nextDelay, pollDelayMs, type ScheduleState } from '../../domain/sync/schedule.ts';
import { pendingSummary } from '../../domain/sync/dirty.ts';
import { statusView, type StatusFacts } from '../../domain/sync/status.ts';
import type { EndedReason, SyncPort } from '../../domain/sync/types.ts';
import { createFamilyOps, type FamilyOps } from './family-ops.ts';
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
  /** Slice D: the actions of the family screens (create, invite, join, adoption, leave...). */
  readonly family: FamilyOps;
  /** Reads the membership again after a failed first read (the new-device retry button, US-E15-05/AC3). */
  retryDiscovery(): void;
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
  /** Waits between the retries of a delete or leave (tests pass an instant one). */
  wait?: (ms: number) => Promise<void>;
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
  let endedNote: EndedReason | null = null; // learned while a join or the adoption question was open (no family id left)
  let pending = 0;
  let oldestPendingAt: string | null = null;
  let lostEdits: LostEdit[] = [];
  let ignored = 0;
  let syncing = false;
  let discovery: SyncState['membership'] = 'unknown';
  let askedByDiscovery = false;
  let limitScope: SyncState['limitScope'] = null;
  let fresh: BentoMinderStore | null = null;
  let unsubscribeHost: (() => void) | null = null;
  let soonTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let sendTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  // Bumped by every step that changes the membership or the local copy under the cycle's feet (leave, delete, adoption...).
  // A cycle that started under an older value drops its own result: its writes are stale (US-E15-08/AC2, AC6).
  let epoch = 0;
  let metaQueue: Promise<unknown> = Promise.resolve();
  const serialMeta = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = metaQueue.then(task, task);
    metaQueue = run.catch(() => undefined);
    return run;
  };

  let state: SyncState = { ...DISABLED_SYNC_STATE, enabled: true, membership: 'unknown' };

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
      endedReason: membershipEnded ?? endedNote,
      lostEdits,
      ignoredRecords: ignored,
      familyId: meta.familyId,
      consent: meta.consent,
      adoptionFromDiscovery: askedByDiscovery,
      adoptionPending: questionOpen(meta),
      safetyCreatedAt: meta.safety === null ? null : meta.safety.createdAt,
      membership: meta.familyId !== null ? 'member' : discovery,
      limitScope: limitHit ? limitScope : null,
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

  /**
   * US-E15-11/AC3 after a crash: create, join and adoption write the metadata before the store, so a store that still has
   * the uid as owner while the metadata says the adoption is done is finished here. Idempotent; never loses data (the
   * records are only re-labelled). The leaving direction writes the store first and needs no repair.
   */
  async function repairOwnership(): Promise<void> {
    await readMeta();
    if (tooNew || meta.familyId === null || meta.consent === null || meta.adoption === null || !meta.adoption.done) return;
    const loaded = await repository.load();
    if (loaded.kind !== 'ok' && loaded.kind !== 'recovered-from-prev') return;
    if (!hasForeignOwner(loaded.state, meta.familyId)) return;
    try {
      await repository.save(withFamilyOwner(loaded.state, meta.familyId), loaded.kind === 'ok' ? {} : { force: true });
    } catch (err) {
      if (err instanceof StoreConflictError) return; // another tab saved first; the next cycle looks again
      throw err;
    }
    for (const h of [...appliedHandlers]) h(withFamilyOwner(loaded.state, meta.familyId));
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
      if (joinUnsettled(meta)) {
        // A join whose first download was not decided (network cut, unreadable copy): decide it now, never push before.
        await family.resumeJoin();
        await serialMeta(readMeta);
        if (!alive.current) return;
      } else if (questionOpen(meta)) {
        // The cycle is halted at the question and would never learn that the membership ended meanwhile.
        await family.checkPendingMembership().catch(() => undefined);
        await serialMeta(readMeta);
        if (!alive.current) return;
      }
      if (meta.familyId === null) {
        halted = true;
        membershipEnded = null;
        pending = 0;
        oldestPendingAt = null;
        return;
      }
      if (meta.safety !== null) await family.expireSafetyCopy();
      await serialMeta(repairOwnership);
      if (!alive.current) return;
      const myEpoch = epoch;
      const loaded = await repository.load();
      let store: BentoMinderStore;
      let startedFrom: string | null = null; // the stored text this cycle started from (null = no local copy)
      if (loaded.kind === 'ok' || loaded.kind === 'recovered-from-prev') {
        store = loaded.state;
        startedFrom = JSON.stringify(store);
      } else if (loaded.kind === 'empty') {
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

      // One serialised step: the check, the store write and the metadata write cannot interleave with a membership step.
      const stale = await serialMeta(async () => {
        if (epoch !== myEpoch) return true;
        if (result.storeChanged) {
          try {
            // The local copy must still be what this cycle started from; if a local save or an import came in between,
            // the result is stale and the cycle starts over (nothing is lost: the cursor did not move).
            const now = await repository.load();
            const nowText = now.kind === 'ok' || now.kind === 'recovered-from-prev' ? JSON.stringify(now.state) : null;
            if (nowText !== startedFrom) return true;
            await repository.save(result.store);
          } catch (err) {
            if (err instanceof StoreConflictError) return true; // a local save came first: start over from what is stored now
            throw err;
          }
          for (const h of [...appliedHandlers]) h(result.store);
        }
        const latest = (await loadSyncMeta(storage, uid)).meta;
        await writeMeta(mergePending(result, latest));
        return false;
      });
      if (stale) {
        again = CONFLICT_RETRY_MS;
        return;
      }
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
    // Not a member any more although the device names a family (the delete or leave finished in the cloud but not here).
    if (o.kind === 'refused' && o.detail === 'not-member') void family.reconcileMembership().catch(() => undefined);
    switch (o.kind) {
      case 'ok':
        attempt = 0;
        firstFailureAt = null;
        retryTimer = clear(retryTimer);
        break;
      case 'paused-limit':
        limitHit = true;
        limitScope = o.scope;
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

  async function discover(): Promise<void> {
    discovery = 'unknown';
    publish();
    try {
      const found = await family.discover();
      if (!alive.current) return;
      discovery = found.kind === 'member' ? 'member' : 'none';
      askedByDiscovery = found.kind === 'member' && found.adoptionAsked && meta.adoption !== null && !meta.adoption.done;
    } catch {
      if (!alive.current) return;
      discovery = 'failed'; // a device with a local copy stays quiet; a new device shows the retry screen
    }
    await serialMeta(readMeta);
    publish();
  }

  const family: FamilyOps = createFamilyOps({
    uid,
    port: deps.port,
    repository,
    storage,
    scope,
    nowMs,
    noticeVersion: deps.noticeVersion ?? CLOUD_NOTICE_VERSION,
    freshStore: () => (fresh ??= deps.freshStore()),
    serial: serialMeta,
    ...(deps.wait === undefined ? {} : { wait: deps.wait }),
    membershipChanged: () => {
      epoch += 1;
    },
    loadMeta: async () => (await loadSyncMeta(storage, uid)).meta,
    applyStore: (store) => {
      for (const h of [...appliedHandlers]) h(store);
    },
    resync: () => api.metaChanged(),
    noteEnded: (reason) => {
      endedNote = reason;
      publish();
    },
  });

  const api: SyncController = {
    family,
    retryDiscovery() {
      void discover();
    },
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
        if (meta.familyId === null && !tooNew) void discover(); // US-E15-05: a member's other device learns its family here
        else discovery = 'member';
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
        epoch += 1; // a cycle that started before the deletion must not write the old copy back
        // The backup copy of the pre-join data is local data too: delete-all removes it (BR-22, US-E10-04).
        if (meta.safety !== null || (await storage.read(safetyCopyKey(uid))) !== null) {
          await storage.remove(safetyCopyKey(uid));
          if (meta.safety !== null) await writeMeta({ ...meta, safety: null });
        }
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
  return api;
}

