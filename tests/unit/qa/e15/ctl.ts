// QA E15: one device = the real sync controller + real repository over an in-memory storage that can "crash" at the Nth write,
// talking through the real stack (bridge.ts). Nothing of the developers' FakeBackend is used.
import type { StorageKey } from '../../../../src/domain/ports.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { storeKeysFor } from '../../../../src/domain/storage/keys.ts';
import { createRepository } from '../../../../src/domain/storage/repository.ts';
import { emptySyncMeta, syncMetaKey, type SyncMeta } from '../../../../src/domain/sync/meta.ts';
import { createOwnerScope } from '../../../../src/domain/sync/owner-scope.ts';
import type { HostEvent, SyncHost } from '../../../../src/domain/sync/host.ts';
import { createSyncController } from '../../../../src/ui/sync/controller.ts';
import { emptyStore, storeWithData } from '../../domain/sync/helpers.ts';
import { fixedClock, memoryStorage, type MemoryStorage } from '../../helpers/memory-storage.ts';
import { bridgePort, newNet, type Net } from './bridge.ts';
import type { Rig } from './qa-rig.ts';

export const settle = (ms = 40): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface CrashStorage extends MemoryStorage {
  ops: number;
  /** from this write/remove number on, every write and remove throws (the process is gone) */
  crashAt: number;
  crashed: boolean;
  /** a copy of what is on disk (what a restart would see) */
  snapshot(): Record<string, string>;
}

export function crashStorage(initial: Record<string, string> = {}, crashAt = Infinity): CrashStorage {
  const inner = memoryStorage(initial as Partial<Record<StorageKey, string>>);
  const s: CrashStorage = {
    ...inner,
    ops: 0,
    crashAt,
    crashed: false,
    write(key, value) {
      s.ops += 1;
      if (s.ops >= s.crashAt) {
        s.crashed = true;
        return Promise.reject(new Error('CRASH'));
      }
      return inner.write(key, value);
    },
    remove(key) {
      s.ops += 1;
      if (s.ops >= s.crashAt) {
        s.crashed = true;
        return Promise.reject(new Error('CRASH'));
      }
      return inner.remove(key);
    },
    snapshot: () => Object.fromEntries(inner.data),
  };
  Object.defineProperty(s, 'data', { get: () => inner.data });
  return s;
}

class Host implements SyncHost {
  online = true;
  isOnline = () => this.online;
  isVisible = () => true;
  subscribe(handler: (e: HostEvent) => void) {
    void handler;
    return () => undefined;
  }
}

export interface Ctl {
  uid: string;
  storage: CrashStorage;
  net: Net;
  clock: { now: number };
  controller: ReturnType<typeof createSyncController>;
  repository: ReturnType<typeof createRepository>;
  host: Host;
  stored(): BentoMinderStore | null;
  meta(): SyncMeta | null;
  safety(): string | null;
  stop(): void;
}

export interface CtlOptions {
  rig: Rig;
  uid: string;
  deviceId: string;
  /** undefined = fixture data, null = no local copy */
  store?: BentoMinderStore | null;
  /** a restart: the files of an earlier run */
  files?: Record<string, string>;
  crashAt?: number;
  noticeVersion?: number;
  clock?: { now: number };
  net?: Net;
  start?: boolean;
}

export function makeCtl(o: CtlOptions): Ctl {
  const { rig, uid } = o;
  const clock = o.clock ?? { now: rig.now };
  const net = o.net ?? newNet();
  const files: Record<string, string> = { ...(o.files ?? {}) };
  if (o.files === undefined) {
    const seed = o.store === undefined ? storeWithData(o.deviceId, uid) : o.store;
    if (seed !== null) files[storeKeysFor(uid).state] = JSON.stringify(seed);
  }
  const storage = crashStorage(files, o.crashAt);
  const scope = createOwnerScope(uid);
  const repository = createRepository(storage, fixedClock('2026-11-14T15:30:00Z'), { accountId: uid, allowedOwnerIds: () => scope.ids() });
  const host = new Host();
  const alive = { current: true };
  const port = bridgePort(rig, uid, net, { signedIn: () => alive.current });
  const controller = createSyncController({
    uid,
    port,
    repository,
    storage,
    scope,
    host,
    nowMs: () => {
      rig.now = clock.now;
      return clock.now;
    },
    random: () => 0,
    freshStore: () => emptyStore(o.deviceId, uid),
    alive,
    wait: () => Promise.resolve(),
    ...(o.noticeVersion === undefined ? {} : { noticeVersion: o.noticeVersion }),
  });
  const ctl: Ctl = {
    uid,
    storage,
    net,
    clock,
    controller,
    repository,
    host,
    stored: () => {
      const raw = storage.data.get(storeKeysFor(uid).state);
      return raw === undefined ? null : (JSON.parse(raw) as BentoMinderStore);
    },
    meta: () => {
      const raw = storage.data.get(syncMetaKey(uid));
      return raw === undefined ? null : (JSON.parse(raw) as SyncMeta);
    },
    safety: () => storage.data.get(`bentominder.${uid}.safety` as StorageKey) ?? null,
    stop: () => controller.stop(),
  };
  if (o.start !== false) controller.start();
  return ctl;
}

export { emptySyncMeta, storeWithData, emptyStore };
