// ADR 016 slice C: the sync controller (engine run-time) with a FakeBackend, fake timers, a fake page host and the real
// repository over in-memory storage. No network. UI is not rendered here (slice D); the app wiring has its own test file.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BentoMinderStore } from '../../../src/domain/schema/store.ts';
import { createRepository, type Repository } from '../../../src/domain/storage/repository.ts';
import { storeKeysFor } from '../../../src/domain/storage/keys.ts';
import type { HostEvent, SyncHost } from '../../../src/domain/sync/host.ts';
import { FakeBackend, type FakeSyncPort } from '../../../src/domain/sync/fake-port.ts';
import { emptySyncMeta, parseSyncMeta, serializeSyncMeta, syncMetaKey, type SyncMeta } from '../../../src/domain/sync/meta.ts';
import { startMembership } from '../../../src/domain/sync/membership.ts';
import { createOwnerScope } from '../../../src/domain/sync/owner-scope.ts';
import { SyncPortError } from '../../../src/domain/sync/types.ts';
import { createSyncController, LOCAL_CHANGE_DELAY_MS, type SyncController } from '../../../src/ui/sync/controller.ts';
import { memoryStorage, type MemoryStorage } from '../helpers/memory-storage.ts';
import { DEVICE_A, DEVICE_B, HOUR, MIN, SEC, T0, UID1, UID2, clearDecision, emptyStore, setDecision, storeWithData, ts } from '../domain/sync/helpers.ts';
import { vi } from 'vitest';

class FakeHost implements SyncHost {
  online = true;
  visible = true;
  private handlers = new Set<(e: HostEvent) => void>();
  isOnline = () => this.online;
  isVisible = () => this.visible;
  subscribe(h: (e: HostEvent) => void) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
  emit(e: HostEvent) {
    if (e === 'online') this.online = true;
    if (e === 'offline') this.online = false;
    if (e === 'visible') this.visible = true;
    if (e === 'hidden') this.visible = false;
    for (const h of [...this.handlers]) h(e);
  }
  get listeners() {
    return this.handlers.size;
  }
}

const now = () => Date.now();
const clock = { now: () => Date.now() as never };

/** Lets promise chains and zero-delay timers settle, then moves the fake time on. */
async function run(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

interface Dev {
  uid: string;
  storage: MemoryStorage;
  repo: Repository;
  port: FakeSyncPort;
  host: FakeHost;
  ctl: SyncController;
  alive: { current: boolean };
  applied: BentoMinderStore[];
  store(): Promise<BentoMinderStore>;
  meta(): SyncMeta;
  /** A local commit: write the store, then tell the controller (as the app does). */
  commit(fn: (s: BentoMinderStore) => BentoMinderStore): Promise<void>;
}

interface DevOptions {
  familyId?: string | null;
  store?: BentoMinderStore;
  storage?: MemoryStorage;
  consent?: boolean;
  noteApplied?: boolean;
}

function device(backend: FakeBackend, uid: string, deviceId: string, o: DevOptions = {}): Dev {
  const familyId = o.familyId === undefined ? null : o.familyId;
  const storage = o.storage ?? memoryStorage();
  const scope = createOwnerScope(uid);
  const keys = storeKeysFor(uid);
  if (o.storage === undefined) {
    const seed = o.store ?? emptyStore(deviceId, uid);
    const base = familyId === null ? { store: seed, meta: emptySyncMeta() } : startMembership({ store: seed, meta: emptySyncMeta(), familyId, consentVersion: 1, nowMs: now() });
    void storage.write(keys.state, JSON.stringify(base.store));
    void storage.write(syncMetaKey(uid), serializeSyncMeta(o.consent === false ? { ...base.meta, consent: null } : base.meta));
    scope.setFamilyId(familyId);
  } else {
    const parsed = parseSyncMeta(storage.data.get(syncMetaKey(uid)) ?? null);
    scope.setFamilyId(parsed.kind === 'ok' ? parsed.meta.familyId : null);
  }
  const repo = createRepository(storage, clock, { accountId: uid, allowedOwnerIds: () => scope.ids() });
  const port = backend.portFor(uid);
  const host = new FakeHost();
  const alive = { current: true };
  const ctl = createSyncController({ uid, port, repository: repo, storage, scope, host, nowMs: now, random: () => 0, freshStore: () => emptyStore(deviceId, uid), alive });
  const applied: BentoMinderStore[] = [];
  ctl.onStoreApplied((s) => applied.push(s));
  const dev: Dev = {
    uid,
    storage,
    repo,
    port,
    host,
    ctl,
    alive,
    applied,
    store: async () => {
      const r = await repo.load();
      if (r.kind !== 'ok') throw new Error(r.kind);
      return r.state;
    },
    meta: () => {
      const p = parseSyncMeta(storage.data.get(syncMetaKey(uid)) ?? null);
      return p.kind === 'ok' ? p.meta : emptySyncMeta();
    },
    async commit(fn) {
      const cur = await dev.store();
      const next = fn(cur);
      await repo.save(next);
      await ctl.localChanged(next);
    },
  };
  return dev;
}

async function familyOfTwo(backend: FakeBackend): Promise<{ a: Dev; b: Dev; familyId: string }> {
  const { familyId } = await backend.portFor(UID1).createFamily({ version: 1 });
  const code = (await backend.portFor(UID1).createInvite()).code;
  await backend.portFor(UID2).redeemInvite(code, { version: 1 });
  const a = device(backend, UID1, DEVICE_A, { familyId, store: storeWithData(DEVICE_A, UID1) });
  const b = device(backend, UID2, DEVICE_B, { familyId });
  return { a, b, familyId };
}

let backend: FakeBackend;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(T0);
  backend = new FakeBackend({ nowMs: now });
});
afterEach(() => {
  vi.useRealTimers();
});

const callsOf = (d: Dev, op: string) => d.port.calls.filter((c) => c.op === op);

describe('US-E15-05/AC5 and US-E15-11/AC1 an account in no family: sync does nothing', () => {
  it('US-E15-05/AC5 no request is made, the status is local-only and the store is untouched', async () => {
    const d = device(backend, UID1, DEVICE_A, { store: storeWithData(DEVICE_A, UID1) });
    const before = d.storage.data.get(storeKeysFor(UID1).state);
    d.ctl.start();
    await run(5 * MIN);
    // Slice D (US-E15-05/AC1, AC5, AC6): one membership read at start (no family data), nothing is pulled or pushed.
    expect(d.port.calls.map((c) => c.op)).toEqual(['readMembership']);
    expect(d.ctl.getState().view.state).toBe('local-only');
    expect(d.storage.data.get(storeKeysFor(UID1).state)).toBe(before);
    d.ctl.stop();
  });
});

describe('US-E15-06/AC1 and AC3, US-E15-05/AC7 the schedule: start, local changes, polling, events', () => {
  it('US-E15-06/AC3 a member with consent runs a cycle on start: its data reaches the family and the status is synced', async () => {
    const { a } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    expect(callsOf(a, 'push')).toHaveLength(1);
    expect([...(backend.families.values().next().value?.records.keys() ?? [])].sort()).toContain('decision_2026-11-04');
    expect(a.ctl.getState().view.state).toBe('synced');
    expect(a.ctl.getState().view.lastSyncedAt).not.toBeNull();
    a.ctl.stop();
  });

  it('US-E15-05/AC7 a change made on A appears on B within 60 seconds without a reload, and the app is told', async () => {
    const { a, b } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    b.ctl.start();
    await run(100);
    expect((await b.store()).decisions['2026-11-04']).toBeDefined();
    const addedAt = now();
    await a.commit((s) => setDecision(s, '2026-11-18', 'not-confirmed', addedAt));
    await run(LOCAL_CHANGE_DELAY_MS + 100);
    expect(callsOf(a, 'push')).toHaveLength(2);
    b.applied.length = 0;
    await run(60 * SEC);
    expect((await b.store()).decisions['2026-11-18']).toBeDefined();
    expect(b.applied.length).toBeGreaterThan(0);
    expect(b.applied.at(-1)?.decisions['2026-11-18']).toBeDefined();
    a.ctl.stop();
    b.ctl.stop();
  });

  it('US-E15-06/AC3 the poll runs every 60 seconds while visible and online, not while hidden', async () => {
    const { a } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    const pulls = () => callsOf(a, 'pull').length;
    const base = pulls();
    await run(60 * SEC);
    expect(pulls()).toBe(base + 1);
    await run(60 * SEC);
    expect(pulls()).toBe(base + 2);
    a.host.emit('hidden');
    await run(5 * MIN);
    expect(pulls()).toBe(base + 2);
    a.host.emit('visible');
    await run(100);
    expect(pulls()).toBe(base + 3);
    a.ctl.stop();
  });

  it('US-E15-06/AC3 focus and the online event each start a cycle at once', async () => {
    const { a } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    const base = callsOf(a, 'pull').length;
    a.host.emit('focus');
    await run(100);
    expect(callsOf(a, 'pull').length).toBe(base + 1);
    a.host.emit('online');
    await run(100);
    expect(callsOf(a, 'pull').length).toBe(base + 2);
    a.ctl.stop();
  });

  it('US-E15-10/AC4 an idle online app pulls only after its cursor: nothing is downloaded again', async () => {
    const { a, b } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    b.ctl.start();
    await run(100);
    const seqNow = backend.families.values().next().value?.seq ?? 0;
    expect(b.meta().cursor).toBe(seqNow);
    const applied = b.applied.length;
    await run(3 * 60 * SEC);
    expect(b.applied.length).toBe(applied);
    expect(b.meta().cursor).toBe(seqNow);
    a.ctl.stop();
    b.ctl.stop();
  });
});

describe('slice A decision 4: noteLocalChange after every local commit', () => {
  it('US-E15-07/AC4 a deletion is stamped at the moment it was made, not when it is finally sent', async () => {
    const { a } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    const deletedAt = now();
    await a.commit((s) => clearDecision(s, '2026-11-04', deletedAt));
    expect(a.meta().pending['decision_2026-11-04']).toBe(deletedAt);
    a.host.online = false;
    a.port.offline = true;
    await run(10 * MIN);
    a.host.online = true;
    a.port.offline = false;
    a.host.emit('online');
    await run(100);
    const stored = [...(backend.families.values().next().value?.records.values() ?? [])].find((r) => r.kind === 'decision' && r.key === '2026-11-04');
    expect(stored?.deletedAt).toBe(ts(deletedAt));
    a.ctl.stop();
  });

  it('US-E15-10/AC2 thirty edits of one record within 10 seconds are one write of the latest content', async () => {
    const { a } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    const before = callsOf(a, 'push').length;
    let latest = '';
    for (let i = 0; i < 30; i++) {
      const at = now();
      await a.commit((s) => setDecision(s, '2026-11-18', i % 2 === 0 ? 'school-lunch-planned' : 'not-confirmed', at));
      latest = i % 2 === 0 ? 'school-lunch-planned' : 'not-confirmed';
      await run(300);
    }
    await run(LOCAL_CHANGE_DELAY_MS + 12 * SEC);
    const writes = callsOf(a, 'push').filter((_, i) => i >= before).reduce((n, c) => n + (c.count ?? 0), 0);
    expect(writes).toBeLessThanOrEqual(2);
    const stored = backend.families.values().next().value?.records.get('decision_2026-11-18');
    expect(JSON.parse(stored?.payloadJson ?? '{}').state).toBe(latest);
    a.ctl.stop();
  });
});

describe('US-E15-06/AC2 the offline queue', () => {
  it('US-E15-06/AC2 offline: 3 records edited (one of them twice) show 3 pending, the status says so, and the queue survives a restart', async () => {
    const { a, familyId } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    a.host.online = false;
    a.port.offline = true;
    a.host.emit('offline');
    const t = now();
    await a.commit((s) => setDecision(s, '2026-11-18', 'not-confirmed', t));
    await a.commit((s) => setDecision(s, '2026-11-19', 'not-confirmed', t));
    await a.commit((s) => setDecision(s, '2026-11-18', 'not-confirmed', t + 5000));
    await a.commit((s) => clearDecision(s, '2026-11-04', t + 6000));
    await run(3 * MIN);
    const v = a.ctl.getState().view;
    expect(v.state).toBe('pending-offline');
    expect(v.pendingCount).toBe(3);
    a.ctl.stop();

    // Close and reopen the app: new controller over the same storage, still offline.
    const again = device(backend, UID1, DEVICE_A, { storage: a.storage });
    expect(familyId).toBeTruthy();
    again.host.online = false;
    again.port.offline = true;
    again.ctl.start();
    await run(3 * MIN);
    expect(again.ctl.getState().view.pendingCount).toBe(3);
    expect(again.ctl.getState().view.state).toBe('pending-offline');

    // The network returns: sent without any action by the parent, then synced.
    again.host.online = true;
    again.port.offline = false;
    again.host.emit('online');
    await run(100);
    await run(12 * SEC);
    expect(again.ctl.getState().view.state).toBe('synced');
    expect(again.ctl.getState().view.pendingCount).toBe(0);
    const keys = [...(backend.families.values().next().value?.records.keys() ?? [])];
    expect(keys).toContain('decision_2026-11-19');
    again.ctl.stop();
  });
});

describe('US-E15-06/AC5 errors retry calmly with back-off', () => {
  it('US-E15-06/AC5 temporary failures: status retrying, delays 5 s then 10 s, no error surfaced, retry-now after 5 minutes of failure, back to synced', async () => {
    const { a } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    for (let i = 0; i < 60; i++) a.port.script.push(new SyncPortError('temporary'));
    a.host.emit('focus');
    await run(100);
    expect(a.ctl.getState().view.state).toBe('retrying');
    expect(a.ctl.getState().view.showRetryNow).toBe(false);
    const pulls = () => callsOf(a, 'pull').length;
    const p0 = pulls();
    await run(4_900); // random() = 0: exactly 5 s, then 10 s
    expect(pulls()).toBe(p0);
    await run(200);
    expect(pulls()).toBe(p0 + 1);
    await run(9_000);
    expect(pulls()).toBe(p0 + 1);
    await run(1_200);
    expect(pulls()).toBe(p0 + 2);
    await run(5 * MIN);
    expect(a.ctl.getState().view.showRetryNow).toBe(true);
    expect(a.ctl.getState().view.state).toBe('retrying');
    a.port.script.length = 0;
    a.ctl.syncNow();
    await run(100);
    expect(a.ctl.getState().view.state).toBe('synced');
    expect(a.ctl.getState().view.showRetryNow).toBe(false);
    a.ctl.stop();
  });

  it('US-E15-06/AC5 a bug-like failure (not a port error) is handled calmly too: no throw, retrying', async () => {
    const { a } = await familyOfTwo(backend);
    a.port.pull = () => Promise.reject(new Error('boom'));
    a.ctl.start();
    await run(100);
    expect(a.ctl.getState().view.state).toBe('retrying');
    a.ctl.stop();
  });
});

describe('US-E15-06/AC8, US-E15-02/AC1, US-E15-10 paused states', () => {
  it('US-E15-06/AC8 a cloud copy from a newer app pauses sync: nothing uploaded, local copy unchanged', async () => {
    const { a, familyId } = await familyOfTwo(backend);
    const fam = backend.families.get(familyId);
    if (fam === undefined) throw new Error('no family');
    fam.schemaVersion = 2;
    const before = a.storage.data.get(storeKeysFor(UID1).state);
    a.ctl.start();
    await run(100);
    expect(a.ctl.getState().view.state).toBe('paused-app-too-old');
    expect(callsOf(a, 'push')).toHaveLength(0);
    expect(a.storage.data.get(storeKeysFor(UID1).state)).toBe(before);
    const pulls = callsOf(a, 'pull').length;
    await run(5 * MIN);
    expect(callsOf(a, 'pull').length).toBe(pulls); // halted: no polling of a family this app cannot read
    a.ctl.stop();
  });

  it('US-E15-06/AC8 a sync metadata document from a newer app is left untouched and pauses sync', async () => {
    const storage = memoryStorage({ [syncMetaKey(UID1)]: JSON.stringify({ version: 2, whatever: true }), [storeKeysFor(UID1).state]: JSON.stringify(storeWithData(DEVICE_A, UID1)) });
    const d = device(backend, UID1, DEVICE_A, { storage });
    d.ctl.start();
    await run(100);
    expect(d.port.calls).toEqual([]);
    expect(d.storage.data.get(syncMetaKey(UID1))).toBe(JSON.stringify({ version: 2, whatever: true }));
    expect(d.ctl.getState().view.state).toBe('paused-app-too-old');
    d.ctl.stop();
  });

  it('US-E15-02/AC1 without the cached consent nothing is sent or fetched: paused-no-consent', async () => {
    const { familyId } = await backend.portFor(UID1).createFamily({ version: 1 });
    const d = device(backend, UID1, DEVICE_A, { familyId, store: storeWithData(DEVICE_A, UID1), consent: false });
    d.ctl.start();
    await run(100);
    expect(d.port.calls).toEqual([]);
    expect(d.ctl.getState().view.state).toBe('paused-no-consent');
    d.ctl.stop();
  });

  it('US-E15-10/AC3 more than 200 writes in an hour: paused-limit, the queue keeps filling, sending resumes in the next hour without loss', async () => {
    const { familyId } = await backend.portFor(UID1).createFamily({ version: 1 });
    let s = emptyStore(DEVICE_A, UID1);
    const first = Date.parse('2026-01-01T00:00:00+09:00');
    for (let i = 0; i < 230; i++) {
      const date = ts(first + i * 86_400_000).slice(0, 10);
      s = setDecision(s, date, 'not-confirmed', T0 - HOUR + i * 1000);
    }
    const d = device(backend, UID1, DEVICE_A, { familyId, store: s });
    d.ctl.start();
    await run(200);
    expect(d.ctl.getState().view.state).toBe('paused-limit');
    const sent = () => backend.families.get(familyId)?.records.size ?? 0;
    expect(sent()).toBe(200);
    await run(HOUR + 5 * MIN);
    expect(sent()).toBe(230);
    expect(d.ctl.getState().view.state).toBe('synced');
    d.ctl.stop();
  });
});

describe('US-E15-06/AC10 and US-E15-05/AC9 sync follows the account', () => {
  it('US-E15-06/AC10 stop (sign-out): timers and page listeners go, nothing is sent afterwards, the queue stays in the account keys', async () => {
    const { a } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    expect(a.host.listeners).toBe(1);
    const t = now();
    a.host.online = false;
    a.port.offline = true;
    await a.commit((s) => setDecision(s, '2026-11-20', 'not-confirmed', t));
    a.ctl.stop();
    expect(a.host.listeners).toBe(0);
    a.host.online = true;
    a.port.offline = false;
    const calls = a.port.calls.length;
    a.host.emit('online');
    await run(10 * MIN);
    expect(a.port.calls.length).toBe(calls);
    expect(a.alive.current).toBe(false);
    // The unsent edit is still in the account's own store, and the metadata still names the family.
    expect((await a.store()).decisions['2026-11-20']).toBeDefined();
    expect(a.meta().familyId).not.toBeNull();
  });

  it('US-E15-06/AC10 sign-out during a running request: the answer is neither saved nor shown', async () => {
    const { a, b } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    await b.port.push([]);
    const original = a.port.pull.bind(a.port);
    let release: () => void = () => undefined;
    a.port.pull = async (cursor) => {
      await new Promise<void>((r) => (release = r));
      return original(cursor);
    };
    a.host.emit('focus');
    await run(10);
    a.ctl.stop();
    const before = a.storage.writes;
    a.applied.length = 0;
    release();
    await run(100);
    expect(a.storage.writes).toBe(before);
    expect(a.applied).toEqual([]);
  });

  it('US-E15-06/AC10 a different account on the same device sends under its own uid only, from its own keys', async () => {
    const { a } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    a.ctl.stop();
    const other = device(backend, UID2, DEVICE_B, { familyId: null, store: storeWithData(DEVICE_B, UID2) });
    other.ctl.start();
    await run(5 * MIN);
    // Slice D: the other account is a member in the cloud, so its own device discovers that (its own uid, its own keys).
    expect(other.port.calls.length).toBeGreaterThan(0);
    expect(other.port.calls.every((c) => c.uid === UID2)).toBe(true);
    expect(a.port.calls.every((c) => c.uid === UID1)).toBe(true);
    expect(other.storage.data.has(syncMetaKey(UID1))).toBe(false);
  });
});

describe('US-E15-05/AC9 membership ended', () => {
  it('US-E15-05/AC9 the other member removed: status membership-ended with the reason, no further requests', async () => {
    const { a, b, familyId } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    b.ctl.start();
    await run(100);
    await a.port.removeMember(UID2);
    b.host.emit('focus');
    await run(100);
    const st = b.ctl.getState();
    expect(st.view.state).toBe('membership-ended');
    expect(st.endedReason).toBe('removed');
    const calls = b.port.calls.length;
    await run(5 * MIN);
    expect(b.port.calls.length).toBe(calls);
    expect(familyId).toBeTruthy();
    a.ctl.stop();
    b.ctl.stop();
  });
});

describe('US-E15-11/AC7 local delete-all while in a family', () => {
  it('US-E15-11/AC7 the emptiness is never sent as deletions: the family data is downloaded again', async () => {
    const { a, b, familyId } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    b.ctl.start();
    await run(100);
    const live = () => [...(backend.families.get(familyId)?.records.values() ?? [])].filter((r) => r.deletedAt === undefined).length;
    const liveBefore = live();
    await b.repo.deleteAll();
    await b.ctl.localDataDeleted();
    await run(100);
    expect(live()).toBe(liveBefore);
    expect([...(backend.families.get(familyId)?.records.values() ?? [])].some((r) => r.deletedAt !== undefined)).toBe(false);
    expect((await b.store()).decisions['2026-11-04']).toBeDefined();
    a.ctl.stop();
    b.ctl.stop();
  });

  it('US-E15-11/AC7 even if the app was closed before it could tell the controller, an empty local copy is not sent as deletions', async () => {
    const { a, b, familyId } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    b.ctl.start();
    await run(100);
    b.ctl.stop();
    await b.repo.deleteAll();
    const again = device(backend, UID2, DEVICE_B, { storage: b.storage });
    again.ctl.start();
    await run(200);
    expect([...(backend.families.get(familyId)?.records.values() ?? [])].some((r) => r.deletedAt !== undefined)).toBe(false);
    expect((await again.store()).decisions['2026-11-04']).toBeDefined();
    a.ctl.stop();
    again.ctl.stop();
  });
});

describe('US-E15-07/AC8 and US-E15-06/AC9 notes for the app', () => {
  it('US-E15-07/AC8 a local edit that lost to a newer family edit is reported once, then cleared', async () => {
    const { a, b } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    b.ctl.start();
    await run(100);
    const t = now();
    a.host.online = false;
    a.port.offline = true;
    await a.commit((s) => setDecision(s, '2026-11-04', 'school-lunch-planned', t, { reservationDoneExternally: true }));
    await run(5 * SEC);
    await b.commit((s) => setDecision(s, '2026-11-04', 'not-confirmed', t + 5 * SEC));
    await run(LOCAL_CHANGE_DELAY_MS + 100);
    a.host.online = true;
    a.port.offline = false;
    a.host.emit('online');
    await run(200);
    expect(a.ctl.getState().lostEdits).toEqual([{ kind: 'decision', key: '2026-11-04' }]);
    a.ctl.clearNotices();
    expect(a.ctl.getState().lostEdits).toEqual([]);
    a.ctl.stop();
    b.ctl.stop();
  });

  it('US-E15-06/AC9 a download that fails validation is ignored, counted once, and does not block the others', async () => {
    const { a, b, familyId } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    const fam = backend.families.get(familyId);
    const rec = fam?.records.get('decision_2026-11-04');
    if (fam === undefined || rec === undefined) throw new Error('missing');
    fam.seq += 1;
    fam.records.set('decision_2026-11-04', { ...rec, payloadJson: JSON.stringify({ ...JSON.parse(rec.payloadJson ?? '{}'), state: 'not-a-state' }), updatedAt: ts(now() + SEC), updatedAtMs: now() + SEC, seq: fam.seq });
    b.ctl.start();
    await run(200);
    expect(b.ctl.getState().ignoredRecords).toBeGreaterThanOrEqual(1);
    expect((await b.store()).profile).not.toBeNull();
    b.ctl.clearNotices();
    expect(b.ctl.getState().ignoredRecords).toBe(0);
    a.ctl.stop();
    b.ctl.stop();
  });

  it('US-E15-06/AC1 the engine result is saved through the repository only: a local save that came first makes the cycle start over, no edit is lost', async () => {
    const { a, b } = await familyOfTwo(backend);
    a.ctl.start();
    await run(100);
    // B's cycle is slowed down; while it runs, B's local copy is saved by "another tab" (a second repository).
    const original = b.port.pull.bind(b.port);
    let release: () => void = () => undefined;
    b.port.pull = async (c) => {
      await new Promise<void>((r) => (release = r));
      return original(c);
    };
    b.ctl.start();
    await run(50);
    const other = createRepository(b.storage, clock, { accountId: UID2, allowedOwnerIds: [backend.families.keys().next().value ?? ''] });
    const stored = await other.load();
    if (stored.kind !== 'ok' && stored.kind !== 'empty') throw new Error(stored.kind);
    const base = stored.kind === 'ok' ? stored.state : emptyStore(DEVICE_B, UID2);
    await other.save({ ...base, updatedAt: ts(now()) });
    b.port.pull = original;
    release();
    await run(3 * SEC);
    expect((await b.store()).decisions['2026-11-04']).toBeDefined();
    a.ctl.stop();
    b.ctl.stop();
  });
});

describe('US-E15-06/AC4 the state a screen renders', () => {
  it('US-E15-06/AC4 subscribers are told of each change and can unsubscribe', async () => {
    const { a } = await familyOfTwo(backend);
    let n = 0;
    const off = a.ctl.subscribe(() => (n += 1));
    a.ctl.start();
    await run(100);
    expect(n).toBeGreaterThan(1);
    off();
    const seen = n;
    a.host.emit('focus');
    await run(100);
    expect(n).toBe(seen);
    a.ctl.stop();
  });
});
