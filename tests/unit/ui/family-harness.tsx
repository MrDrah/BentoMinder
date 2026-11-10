// Slice D test support: the whole app in jsdom with a REAL sync controller over a FakeBackend (the same fake the engine
// tests use), an in-memory storage per device, and switches for the network. Also a stub controller for the status screens.
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { FileExport, Share } from '../../../src/domain/ports.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/store.ts';
import { storeKeysFor } from '../../../src/domain/storage/keys.ts';
import { createRepository } from '../../../src/domain/storage/repository.ts';
import { FakeBackend, type FakeSyncPort } from '../../../src/domain/sync/fake-port.ts';
import type { HostEvent, SyncHost } from '../../../src/domain/sync/host.ts';
import { emptySyncMeta, serializeSyncMeta, syncMetaKey } from '../../../src/domain/sync/meta.ts';
import { startMembership } from '../../../src/domain/sync/membership.ts';
import { createOwnerScope } from '../../../src/domain/sync/owner-scope.ts';
import { App } from '../../../src/ui/App.tsx';
import { AccountContext } from '../../../src/ui/auth/account-context.tsx';
import { AppProvider, type AppServices } from '../../../src/ui/app-store.tsx';
import { resetConsentPrompt } from '../../../src/ui/sync/consent-prompt.ts';
import { createSyncController, type SyncController } from '../../../src/ui/sync/controller.ts';
import { clearFreshJoin } from '../../../src/ui/sync/family/join-session.ts';
import { DISABLED_SYNC_STATE, type SyncState } from '../../../src/ui/sync/state.ts';
import { DEVICE_A, DEVICE_B, UID1, UID2, emptyStore, storeWithData } from '../domain/sync/helpers.ts';
import { loadFixture } from '../helpers/fixtures.ts';
import { fixedClock, memoryStorage, type MemoryStorage } from '../helpers/memory-storage.ts';

export const NOW_MS = Date.parse('2026-11-14T15:30:00Z');
export const clock = fixedClock('2026-11-14T15:30:00Z');
export { DEVICE_A, DEVICE_B, UID1, UID2, emptyStore, storeWithData };

class QuietHost implements SyncHost {
  online = true;
  private handlers = new Set<(e: HostEvent) => void>();
  isOnline = () => this.online;
  isVisible = () => true;
  subscribe(h: (e: HostEvent) => void) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
}

export interface FamilyDevice {
  uid: string;
  storage: MemoryStorage;
  port: FakeSyncPort;
  controller: SyncController;
  repository: ReturnType<typeof createRepository>;
  network: { online: boolean };
  setOnline(value: boolean): void;
  stored(): BentoMinderStore | null;
  meta(): ReturnType<typeof JSON.parse>;
  services: Partial<AppServices> & { fileExport: { save: ReturnType<typeof vi.fn<FileExport['save']>> }; share: Share & { copy: ReturnType<typeof vi.fn> } };
  callOps(): string[];
}

export interface DeviceOptions {
  backend: FakeBackend;
  uid?: string;
  deviceId?: string;
  store?: BentoMinderStore | null;
  /** Seeds the metadata as a member of this family (after create or join). */
  familyId?: string | null;
  consent?: boolean;
  /** The notice version this app carries (default 1). */
  noticeVersion?: number;
}

/** One device of one account: storage, repository, controller. The app is rendered with `renderDevice`. */
export function makeDevice(o: DeviceOptions): FamilyDevice {
  const uid = o.uid ?? UID1;
  const storage = memoryStorage();
  const scope = createOwnerScope(uid);
  const familyId = o.familyId ?? null;
  const seedStore = o.store === undefined ? storeWithData(o.deviceId ?? DEVICE_A, uid) : o.store;
  const base = startMembership({ store: seedStore ?? emptyStore(DEVICE_A, uid), meta: emptySyncMeta(), familyId: familyId ?? 'x', consentVersion: 1, nowMs: NOW_MS });
  if (familyId !== null) {
    void storage.write(syncMetaKey(uid), serializeSyncMeta(o.consent === false ? { ...base.meta, consent: null } : { ...base.meta, adoption: { familyId, choice: 'upload', done: true } }));
    scope.setFamilyId(familyId);
  }
  if (seedStore !== null) void storage.write(storeKeysFor(uid).state, JSON.stringify(familyId === null ? seedStore : base.store));
  const repository = createRepository(storage, clock, { accountId: uid, allowedOwnerIds: () => scope.ids() });
  const port = o.backend.portFor(uid);
  const host = new QuietHost();
  const network = { online: true };
  const controller = createSyncController({
    uid,
    port,
    repository,
    storage,
    scope,
    host,
    nowMs: () => NOW_MS,
    random: () => 0,
    freshStore: () => emptyStore(o.deviceId ?? DEVICE_B, uid),
    alive: { current: true },
    ...(o.noticeVersion === undefined ? {} : { noticeVersion: o.noticeVersion }),
  });
  const services = {
    isOnline: () => network.online,
    fileExport: { save: vi.fn<FileExport['save']>(() => Promise.resolve()) },
    share: { canShare: () => false, share: vi.fn(() => Promise.resolve('shared' as const)), copy: vi.fn(() => Promise.resolve(true)) },
    dictionary: loadFixture('../../data/dictionary.json'),
  } as unknown as FamilyDevice['services'];
  return {
    uid,
    storage,
    port,
    controller,
    repository,
    network,
    setOnline(value) {
      network.online = value;
      port.offline = !value;
      host.online = value;
      window.dispatchEvent(new Event(value ? 'online' : 'offline'));
    },
    stored: () => {
      const raw = storage.data.get(storeKeysFor(uid).state);
      return raw === undefined ? null : (JSON.parse(raw) as BentoMinderStore);
    },
    meta: () => JSON.parse(storage.data.get(syncMetaKey(uid)) ?? 'null'),
    services,
    callOps: () => port.calls.map((c) => c.op),
  };
}

export function resetFamilyUi(): void {
  resetConsentPrompt();
  clearFreshJoin();
}

/** Renders the app on this device. `hash` is the screen to open. */
export function renderDevice(device: FamilyDevice, hash = '#/settings') {
  window.location.hash = hash;
  return render(
    <AccountContext.Provider value={{ user: { uid: device.uid, displayName: 'Test Parent', email: 'parent@example.test', photoUrl: null }, signOut: () => Promise.resolve(true) }}>
      <AppProvider repository={device.repository} clock={clock} newDeviceId={() => DEVICE_B} services={device.services} sync={device.controller}>
        <App />
      </AppProvider>
    </AccountContext.Provider>,
  );
}

/** A controller that never talks to anything: the state is whatever the test sets (status screens, notes). */
export function stubController(initial: Partial<SyncState> = {}) {
  let state: SyncState = { ...DISABLED_SYNC_STATE, enabled: true, membership: 'member', familyId: 'fam-1', consent: { version: 1, at: '2026-11-10T10:00:00+09:00' }, ...initial };
  const listeners = new Set<() => void>();
  const family = {
    membership: vi.fn(() => Promise.resolve({ status: 'member' as const, familyId: 'fam-1', consentVersion: 1, maxMembers: 2, members: [{ uid: UID1, you: true, email: 'me@example.test' }], invite: null })),
    discover: vi.fn(),
    create: vi.fn(() => Promise.resolve()),
    acceptConsent: vi.fn(() => Promise.resolve()),
    createInvite: vi.fn(),
    cancelInvite: vi.fn(() => Promise.resolve()),
    join: vi.fn(),
    localSummary: vi.fn(() => Promise.resolve({ profile: true, months: 2, decisions: 5 })),
    completeAdoption: vi.fn(() => Promise.resolve()),
    cancelJoin: vi.fn(() => Promise.resolve()),
    leave: vi.fn(() => Promise.resolve()),
    removeMember: vi.fn(() => Promise.resolve()),
    deleteFamily: vi.fn(() => Promise.resolve()),
    acknowledgeEnded: vi.fn(() => Promise.resolve()),
    deleteSafetyCopy: vi.fn(() => Promise.resolve()),
    safetyCopy: vi.fn(() => Promise.resolve(null)),
  };
  const controller = {
    getState: () => state,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    start: vi.fn(),
    stop: vi.fn(),
    active: true,
    syncNow: vi.fn(),
    localChanged: vi.fn(() => Promise.resolve()),
    localDataDeleted: vi.fn(() => Promise.resolve()),
    metaChanged: vi.fn(() => Promise.resolve()),
    onStoreApplied: vi.fn(() => () => undefined),
    clearNotices: vi.fn(() => {
      state = { ...state, lostEdits: [], ignoredRecords: 0 };
      for (const l of [...listeners]) l();
    }),
    retryDiscovery: vi.fn(),
    family,
  };
  return {
    controller: controller as unknown as SyncController,
    family,
    mocks: controller,
    set(next: Partial<SyncState>) {
      state = { ...state, ...next };
      for (const l of [...listeners]) l();
    },
  };
}

export function renderWithController(controller: SyncController, o: { store?: BentoMinderStore; hash?: string; online?: boolean; services?: Partial<AppServices> } = {}) {
  const storage = memoryStorage(o.store === undefined ? {} : { 'bentominder.state': JSON.stringify(o.store) });
  window.location.hash = o.hash ?? '#/settings';
  const online = { value: o.online ?? true };
  const services = {
    isOnline: () => online.value,
    fileExport: { save: vi.fn<FileExport['save']>(() => Promise.resolve()) },
    share: { canShare: () => false, share: vi.fn(() => Promise.resolve('shared' as const)), copy: vi.fn(() => Promise.resolve(true)) },
    dictionary: loadFixture('../../data/dictionary.json'),
    ...o.services,
  } as unknown as Partial<AppServices>;
  const result = render(
    <AppProvider repository={createRepository(storage, clock)} clock={clock} newDeviceId={() => DEVICE_B} services={services} sync={controller}>
      <App />
    </AppProvider>,
  );
  return { ...result, storage, online, services };
}

export const waitScreen = (id: string) => screen.findByTestId(id);
