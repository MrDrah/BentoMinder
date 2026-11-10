// E15 slice E: leave / remove / delete effects, the safety copy, migration to a family and back (with crash injection),
// import into a family and delete-all as a member, over the real controller and a FakeBackend (US-E15-08, US-E15-11).
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeBackend } from '../../../src/domain/sync/fake-port.ts';
import { safetyCopyKey, serializeSyncMeta, syncMetaKey } from '../../../src/domain/sync/meta.ts';
import { prepareFamilyImport } from '../../../src/domain/sync/import.ts';
import { extractRecords } from '../../../src/domain/sync/records.ts';
import { SyncPortError } from '../../../src/domain/sync/types.ts';
import { toJstTimestamp, type Instant } from '../../../src/domain/time/jst.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/store.ts';
import { storeKeysFor } from '../../../src/domain/storage/keys.ts';
import type { MemoryStorage } from '../helpers/memory-storage.ts';
import { clearDecision, setDecision, setNote } from '../domain/sync/helpers.ts';
import { DEVICE_A, DEVICE_B, NOW_MS, UID1, UID2, driftMs, makeDevice, type FamilyDevice } from './family-harness.tsx';

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend({ nowMs: () => NOW_MS });
  driftMs.value = 0;
});

const settle = async (ms = 60) => {
  await new Promise((r) => setTimeout(r, ms));
};
const instant = async () => undefined;

/** Everything that syncs, by record key, ignoring device-only parts. */
const syncedView = (s: BentoMinderStore | null): Record<string, string> => {
  if (s === null) return {};
  return Object.fromEntries([...extractRecords(s)].filter(([k]) => !k.startsWith('aiUsage_') && !k.startsWith('settings_')).map(([k, r]) => [k, r.payloadJson.replace(/"ownerId":"[^"]*"/g, '"ownerId":"-"')]));
};
const owners = (s: BentoMinderStore | null): string[] => [...new Set((JSON.stringify(s).match(/"ownerId":"[^"]*"/g) ?? []).map((m) => m.slice(11, -1)))];

async function startFamily(opts: { aStore?: BentoMinderStore | null } = {}) {
  const a = makeDevice({ backend, uid: UID1, ...(opts.aStore === undefined ? {} : { store: opts.aStore }), wait: instant });
  a.controller.start();
  await settle();
  await a.controller.family.create();
  await settle(150);
  return a;
}
async function joiner(a: FamilyDevice, o: { uid?: string; store?: BentoMinderStore | null } = {}) {
  const code = (await a.controller.family.createInvite()).code;
  const b = makeDevice({ backend, uid: o.uid ?? UID2, store: o.store === undefined ? null : o.store, deviceId: DEVICE_B, wait: instant });
  b.controller.start();
  await settle();
  const r = await b.controller.family.join(code);
  await settle(150);
  return { b, code, r };
}

describe('US-E15-08 leave, remove, delete: what the devices keep', () => {
  it('US-E15-08/AC1 US-E15-08/AC2 leaving: the other member keeps the family data, the leaver keeps a stand-alone local copy, sync stops, status local-only', async () => {
    const a = await startFamily();
    const { b } = await joiner(a);
    const before = syncedView(b.stored());
    await b.controller.family.leave(false);
    await settle(100);
    expect(b.meta().familyId).toBeNull();
    expect(owners(b.stored())).toEqual([UID2]);
    expect(syncedView(b.stored())).toEqual(Object.fromEntries(Object.entries(before)));
    expect(b.controller.getState().view.state).toBe('local-only');
    const opsAfter = b.callOps().length;
    b.controller.syncNow();
    await settle(100);
    expect(b.callOps().length).toBe(opsAfter); // sync stopped: nothing is sent after leaving
    expect([...backend.families.values()][0]?.members.has(UID1)).toBe(true);
    expect(a.controller.getState().view.state).toBe('synced');
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-08/AC3 removing the other member: it is told once, keeps its copy as stand-alone and cannot read or write the family data', async () => {
    const a = await startFamily();
    const { b } = await joiner(a);
    await a.controller.family.removeMember(UID2);
    b.controller.syncNow();
    await settle(100);
    expect(b.controller.getState().endedReason).toBe('removed');
    expect(b.controller.getState().view.state).toBe('membership-ended');
    await expect(b.port.pull(0)).rejects.toMatchObject({ kind: 'membership-ended' });
    await expect(b.port.push([])).rejects.toBeInstanceOf(SyncPortError);
    await b.controller.family.acknowledgeEnded();
    await settle(100);
    expect(b.meta().familyId).toBeNull();
    expect(owners(b.stored())).toEqual([UID2]);
    expect(b.stored()?.profile).not.toBeNull();
    expect(b.controller.getState().view.state).toBe('local-only');
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-08/AC4 the last member leaving removes the family and keeps the local copy', async () => {
    const a = await startFamily();
    await a.controller.family.leave(true);
    await settle(100);
    expect(backend.families.size).toBe(0);
    expect(a.meta().familyId).toBeNull();
    expect(a.stored()?.profile?.ownerId).toBe(UID1);
    a.controller.stop();
  });

  it('US-E15-08/AC5 US-E15-08/AC11 deleting the family\'s data leaves nothing stored for that family id, and the removed member cannot read it', async () => {
    const a = await startFamily();
    const { b } = await joiner(a);
    const familyId = a.meta().familyId as string;
    expect(backend.listAll(familyId).length).toBeGreaterThan(0);
    await a.controller.family.deleteFamily();
    await settle(100);
    expect(backend.listAll(familyId)).toEqual([]);
    expect(backend.families.has(familyId)).toBe(false);
    await expect(b.port.pull(0)).rejects.toBeInstanceOf(SyncPortError);
    expect(await a.port.readMembership()).toEqual({ status: 'none' }); // the deleter's own marker is gone
    expect(a.meta().familyId).toBeNull();
    expect(owners(a.stored())).toEqual([UID1]);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-08/AC6 after a delete the other member is told, keeps its copy stand-alone, and nothing is uploaded to the old family', async () => {
    const a = await startFamily();
    const { b } = await joiner(a);
    await a.controller.family.deleteFamily();
    b.controller.syncNow();
    await settle(100);
    expect(b.controller.getState().endedReason).toBe('family-deleted');
    await b.controller.family.acknowledgeEnded();
    // an edit after the end stays local
    const edited = setNote(b.stored() as BentoMinderStore, 'あとから', NOW_MS - 1000);
    await b.repository.save(edited, { force: true });
    await b.controller.localChanged(edited);
    b.controller.syncNow();
    await settle(100);
    expect(backend.families.size).toBe(0);
    expect(b.callOps().filter((op) => op === 'push').length).toBe(0);
    expect(b.stored()?.profile?.nickname).toBe(a.stored()?.profile?.nickname);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-08/AC5 an unfinished delete is asked again, and only a finished one changes the device', async () => {
    const a = await startFamily();
    let tries = 0;
    const inner = a.port.deleteFamily.bind(a.port);
    a.port.deleteFamily = async () => {
      tries += 1;
      if (tries < 3) throw new SyncPortError('temporary', 'deleting');
      await inner();
    };
    await a.controller.family.deleteFamily();
    expect(tries).toBe(3);
    await settle(50);
    expect(a.meta().familyId).toBeNull();
    // and when it never finishes: still a member, nothing changed, nothing queued
    const b = await startFamilyFor(UID2);
    b.port.deleteFamily = () => Promise.reject(new SyncPortError('temporary', 'deleting'));
    await expect(b.controller.family.deleteFamily()).rejects.toMatchObject({ kind: 'temporary' });
    expect(b.meta().familyId).not.toBeNull();
    expect(owners(b.stored())).not.toContain(UID2);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-08/AC9 offline: the action fails at once, the device is unchanged and nothing is queued for later', async () => {
    const a = await startFamily();
    const { b } = await joiner(a);
    const familyId = a.meta().familyId;
    a.setOnline(false);
    await expect(a.controller.family.leave(false)).rejects.toMatchObject({ kind: 'offline' });
    await expect(a.controller.family.deleteFamily()).rejects.toMatchObject({ kind: 'offline' });
    expect(a.meta().familyId).toBe(familyId);
    a.setOnline(true);
    await settle(100);
    expect(backend.families.size).toBe(1);
    expect([...backend.families.values()][0]?.members.size).toBe(2);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-08/AC10 after leaving the account can create or join again, and the used invite code is refused', async () => {
    const a = await startFamily();
    const { b, code } = await joiner(a);
    await b.controller.family.leave(false);
    await settle(100);
    expect(await b.controller.family.join(code)).toEqual({ kind: 'error', error: 'generic' });
    const second = (await a.controller.family.createInvite()).code;
    expect(await b.controller.family.join(second)).toMatchObject({ kind: expect.stringMatching(/done|ask/) as unknown as string });
    await settle(150);
    expect(b.meta().familyId).toBe(a.meta().familyId);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-08/AC6 a leave or delete that finished in the cloud but not on the device is finished at the next open (not-member)', async () => {
    const a = await startFamily();
    await a.port.deleteFamily(); // the cloud step only: the app was closed before the local step
    const restarted = makeDevice({ backend, uid: UID1, store: null, storage: a.storage, wait: instant });
    a.controller.stop();
    restarted.controller.start();
    await settle(200);
    expect(restarted.meta().familyId).toBeNull();
    expect(owners(restarted.stored())).toEqual([UID1]);
    expect(restarted.controller.getState().view.state).toBe('local-only');
    restarted.controller.stop();
  });
});

async function startFamilyFor(uid: string): Promise<FamilyDevice> {
  const d = makeDevice({ backend, uid, wait: instant });
  d.controller.start();
  await settle();
  await d.controller.family.create();
  await settle(100);
  return d;
}

describe('US-E15-04/AC5 the safety copy of a joiner\'s old data', () => {
  const ownData = (): BentoMinderStore => {
    const own = setNote(makeDevice({ backend: new FakeBackend({ nowMs: () => NOW_MS }), uid: UID2, deviceId: DEVICE_B }).stored() as BentoMinderStore, 'べつの子の控え', NOW_MS - 5000);
    return own;
  };

  it('US-E15-04/AC5 it is made on joining (before anything is replaced), survives leaving, and exports the old data', async () => {
    const a = await startFamily();
    const { b, r } = await joiner(a, { store: ownData() });
    expect(r).toEqual({ kind: 'ask' });
    await b.controller.family.completeAdoption('use-family');
    await settle(100);
    const raw = await b.controller.family.safetyCopy();
    expect(raw).toContain('べつの子の控え');
    expect(b.stored()?.profile?.note).not.toBe('べつの子の控え');
    await b.controller.family.leave(false);
    await settle(100);
    expect(await b.controller.family.safetyCopy()).toContain('べつの子の控え'); // leaving keeps it until its own expiry
    expect(b.controller.getState().safetyCreatedAt).not.toBeNull();
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-04/AC5 it is deleted after 30 days, not before', async () => {
    const a = await startFamily();
    const { b } = await joiner(a, { store: ownData() });
    await b.controller.family.completeAdoption('add-device');
    await settle(100);
    const stored = b.meta();
    b.controller.stop();
    const young = { ...stored, safety: { createdAt: toJstTimestamp((NOW_MS - 29 * 86_400_000) as Instant) } };
    await b.storage.write(syncMetaKey(UID2), serializeSyncMeta(young));
    const r1 = makeDevice({ backend, uid: UID2, store: null, storage: b.storage, wait: instant });
    r1.controller.start();
    await settle(150);
    expect(await r1.controller.family.safetyCopy()).not.toBeNull();
    r1.controller.stop();
    await b.storage.write(syncMetaKey(UID2), serializeSyncMeta({ ...stored, safety: { createdAt: toJstTimestamp((NOW_MS - 31 * 86_400_000) as Instant) } }));
    const r2 = makeDevice({ backend, uid: UID2, store: null, storage: b.storage, wait: instant });
    r2.controller.start();
    await settle(150);
    expect(await r2.controller.family.safetyCopy()).toBeNull();
    expect(r2.controller.getState().safetyCreatedAt).toBeNull();
    expect(r2.stored()?.profile).not.toBeNull(); // the data itself is untouched
    r2.controller.stop();
    a.controller.stop();
  });
});

describe('US-E15-11 migration to a family and back, and delete-all as a member', () => {
  it('US-E15-11/AC1 US-E15-11/AC2 without sharing nothing is renamed or uploaded; the local key stays the offline copy under the same name', async () => {
    const d = makeDevice({ backend, uid: UID1, wait: instant });
    const before = d.storage.data.get(storeKeysFor(UID1).state);
    d.controller.start();
    await settle(100);
    expect(d.storage.data.get(storeKeysFor(UID1).state)).toBe(before);
    expect([...d.storage.data.keys()].sort()).toEqual([storeKeysFor(UID1).state]);
    await d.controller.family.create();
    await settle(150);
    expect(d.storage.data.has(storeKeysFor(UID1).state)).toBe(true); // still the same key while a member
    expect(JSON.parse(d.storage.data.get(storeKeysFor(UID1).state) as string).schemaVersion).toBe(1);
    d.controller.stop();
  });

  it('US-E15-11/AC3 ownerId follows membership: the family id while a member, the uid again after leaving', async () => {
    const a = await startFamily();
    const familyId = a.meta().familyId as string;
    expect(owners(a.stored())).toEqual([familyId]);
    await a.controller.family.leave(true);
    await settle(80);
    expect(owners(a.stored())).toEqual([UID1]);
    a.controller.stop();
  });

  it('US-E15-11/AC3 a store left uid-owned by an interrupted create or join is finished at the next open', async () => {
    const a = await startFamily();
    const familyId = a.meta().familyId as string;
    const text = a.storage.data.get(storeKeysFor(UID1).state) as string;
    a.controller.stop();
    await a.storage.write(storeKeysFor(UID1).state, text.replaceAll(familyId, UID1)); // the metadata was written, the store was not
    const r = makeDevice({ backend, uid: UID1, store: null, storage: a.storage, wait: instant });
    r.controller.start();
    await settle(200);
    expect(owners(r.stored())).toEqual([familyId]);
    r.controller.stop();
  });

  /** A crash: from the `after`-th storage write on, every write fails. The returned function "restarts" the device. */
  function crashAfter(storage: MemoryStorage, after: number): () => void {
    const write = storage.write.bind(storage);
    let n = 0;
    storage.write = (key, value) => {
      n += 1;
      return n > after ? Promise.reject(new Error('crash')) : write(key, value);
    };
    return () => {
      storage.write = write;
    };
  }

  it('US-E15-11/AC3 US-E15-01/AC3 a crash at any write of "create the family" loses nothing and the next open completes it', async () => {
    for (let k = 0; k <= 8; k += 1) {
      backend = new FakeBackend({ nowMs: () => NOW_MS });
      const d = makeDevice({ backend, uid: UID1, wait: instant });
      const nickname = d.stored()?.profile?.nickname;
      const restart = crashAfter(d.storage, k);
      d.controller.start();
      await settle(20);
      await d.controller.family.create().catch(() => undefined);
      await settle(40);
      d.controller.stop();
      restart();
      const r = makeDevice({ backend, uid: UID1, store: null, storage: d.storage, wait: instant });
      r.controller.start();
      await settle(250);
      const loaded = await r.repository.load();
      expect(loaded.kind, `k=${k}`).toBe('ok');
      expect(r.stored()?.profile?.nickname, `k=${k}`).toBe(nickname);
      const familyId = r.meta()?.familyId as string | undefined;
      expect(familyId, `k=${k}`).toBe([...backend.families.keys()][0]);
      expect(owners(r.stored()), `k=${k}`).toEqual([familyId]);
      expect([...backend.families.values()][0]?.records.size, `k=${k}`).toBeGreaterThan(3);
      r.controller.stop();
    }
  });

  it('US-E15-11/AC3 US-E15-08/AC2 a crash at any write of "leave" loses nothing and the next open ends the membership', async () => {
    for (let k = 0; k <= 6; k += 1) {
      backend = new FakeBackend({ nowMs: () => NOW_MS });
      const a = await startFamily();
      const before = syncedView(a.stored());
      const restart = crashAfter(a.storage, k);
      await a.controller.family.leave(false).catch(() => undefined);
      await settle(30);
      a.controller.stop();
      restart();
      const r = makeDevice({ backend, uid: UID1, store: null, storage: a.storage, wait: instant });
      r.controller.start();
      await settle(200);
      if (r.controller.getState().endedReason !== null) await r.controller.family.acknowledgeEnded();
      await settle(100);
      expect((await r.repository.load()).kind, `k=${k}`).toBe('ok');
      expect(r.meta().familyId, `k=${k}`).toBeNull();
      expect(owners(r.stored()), `k=${k}`).toEqual([UID1]);
      expect(Object.keys(syncedView(r.stored())).sort(), `k=${k}`).toEqual(Object.keys(before).sort());
      r.controller.stop();
    }
  });

  it('US-E15-04/AC11 US-E15-11/AC3 a crash at any write of the adoption never loses the old data: the safety copy keeps it and the answer can be given again', async () => {
    for (let k = 0; k <= 7; k += 1) {
      backend = new FakeBackend({ nowMs: () => NOW_MS });
      const a = await startFamily();
      const own = setNote(makeDevice({ backend: new FakeBackend({ nowMs: () => NOW_MS }), uid: UID2, deviceId: DEVICE_B }).stored() as BentoMinderStore, 'べつの子の控え', NOW_MS - 5000);
      const { b } = await joiner(a, { store: own });
      expect(b.controller.getState().adoptionPending, `k=${k}`).toBe(true);
      const restart = crashAfter(b.storage, k);
      await b.controller.family.completeAdoption('use-family').catch(() => undefined);
      await settle(30);
      b.controller.stop();
      restart();
      const r = makeDevice({ backend, uid: UID2, store: null, storage: b.storage, wait: instant });
      r.controller.start();
      await settle(150);
      expect((await r.repository.load()).kind, `k=${k}`).toBe('ok');
      if (r.controller.getState().adoptionPending) await r.controller.family.completeAdoption('use-family');
      await settle(150);
      expect(await r.controller.family.safetyCopy(), `k=${k}`).toContain('べつの子の控え');
      expect(r.stored()?.profile?.note, `k=${k}`).toBe(a.stored()?.profile?.note);
      expect(owners(r.stored()), `k=${k}`).toEqual([a.meta().familyId]);
      a.controller.stop();
      r.controller.stop();
    }
  });

  it('US-E15-11/AC7 delete-all as a member removes the local keys (also the backup copy), sends no deletions, and the next sign-in downloads the family data again', async () => {
    const a = await startFamily();
    const { b } = await joiner(a, { store: setNote(makeDevice({ backend: new FakeBackend({ nowMs: () => NOW_MS }), uid: UID2, deviceId: DEVICE_B }).stored() as BentoMinderStore, 'べつの子の控え', NOW_MS - 5000) });
    await b.controller.family.completeAdoption('add-device');
    await settle(100);
    const familyId = b.meta().familyId as string;
    const cloudBefore = backend.listAll(familyId).length;
    expect(await b.controller.family.safetyCopy()).not.toBeNull();
    await b.repository.deleteAll(); // what the app's "delete all" does
    await b.controller.localDataDeleted();
    expect(b.storage.data.has(safetyCopyKey(UID2))).toBe(false);
    await settle(200);
    expect(backend.listAll(familyId).length).toBe(cloudBefore); // nothing was sent as a deletion
    expect(b.stored()?.profile).toBeTruthy(); // downloaded again
    expect(syncedView(b.stored())).toEqual(syncedView(a.stored()));
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-11/AC4 US-E15-11/AC8 the export file is the plain store: the family id, nothing of the sync metadata, no device id of the metadata', async () => {
    const a = await startFamily();
    const text = a.repository.exportJson(a.stored() as BentoMinderStore);
    const doc = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(doc).sort()).toEqual(Object.keys(a.stored() as object).sort());
    expect(text).not.toMatch(/tombstone|baselines|cursor|members|invite|adoption/);
    expect(owners(a.stored())).toEqual([a.meta().familyId]);
    const back = a.repository.importJson(text);
    expect(back.ok).toBe(true);
    a.controller.stop();
  });
});

describe('US-E15-11/AC6 import into a family', () => {
  const importInto = async (d: FamilyDevice, file: BentoMinderStore) => {
    const current = d.stored() as BentoMinderStore;
    const prepared = prepareFamilyImport({ imported: file, deviceId: current.deviceId, familyId: d.meta().familyId as string, nowIso: toJstTimestamp(NOW_MS as Instant) });
    await d.repository.save(prepared, { force: true });
    await d.controller.localChanged(prepared);
    driftMs.value += 40_000; // past the write-coalescing window
    d.controller.syncNow();
    await settle(150);
    return prepared;
  };

  it('US-E15-11/AC6 the records get the family id and "now", the device id stays, and records not in the file become tombstones', () => {
    const d = makeDevice({ backend, uid: UID1, deviceId: DEVICE_A });
    const file = { ...(d.stored() as BentoMinderStore), deviceId: DEVICE_B };
    const out = prepareFamilyImport({ imported: file, deviceId: DEVICE_A, familyId: 'fam-x', nowIso: toJstTimestamp(NOW_MS as Instant) });
    expect(owners(out)).toEqual(['fam-x']);
    expect(out.deviceId).toBe(DEVICE_A);
    expect(out.profile?.updatedAt).toBe(toJstTimestamp(NOW_MS as Instant));
    expect(Object.values(out.decisions).every((r) => r.updatedAt === toJstTimestamp(NOW_MS as Instant))).toBe(true);
    expect(Object.keys(out.decisions)).toEqual(Object.keys(file.decisions));
  });

  it('US-E15-11/AC6 two devices of the family show the imported data after syncing; what the file lacks is gone for everyone', async () => {
    const a = await startFamily();
    const { b } = await joiner(a);
    const a2 = makeDevice({ backend, uid: UID1, store: null, deviceId: 'c0000000-0000-4000-8000-00000000000c', wait: instant });
    a2.controller.start();
    await settle(200);
    const dates = Object.keys((a.stored() as BentoMinderStore).decisions);
    expect(dates.length).toBeGreaterThan(1);
    const file = clearDecision(setNote(a.stored() as BentoMinderStore, '読み込んだ', NOW_MS - 120_000), dates[0] as string, NOW_MS - 120_000);
    const prepared = await importInto(a, file);
    b.controller.syncNow();
    a2.controller.syncNow();
    await settle(250);
    for (const d of [b, a2]) {
      expect(d.stored()?.profile?.note, d.uid).toBe('読み込んだ');
      expect(Object.keys(d.stored()?.decisions ?? {}), d.uid).not.toContain(dates[0]);
      expect(syncedView(d.stored()), d.uid).toEqual(syncedView(prepared));
    }
    const family = [...backend.families.values()][0];
    expect([...(family?.records.values() ?? [])].some((r) => r.kind === 'decision' && r.key === dates[0] && r.deletedAt !== undefined)).toBe(true);
    a.controller.stop();
    b.controller.stop();
    a2.controller.stop();
  });

  it('US-E15-11/AC6 US-E15-08/AC10 three devices converge after one leaves, edits alone, and joins again', async () => {
    const a = await startFamily();
    const { b } = await joiner(a);
    const a2 = makeDevice({ backend, uid: UID1, store: null, deviceId: 'c0000000-0000-4000-8000-00000000000c', wait: instant });
    a2.controller.start();
    await settle(200);
    await b.controller.family.leave(false);
    await settle(100);
    // while apart: b edits alone, a edits in the family
    const bEdit = setDecision(b.stored() as BentoMinderStore, '2026-11-20', 'not-confirmed', NOW_MS - 90_000);
    await b.repository.save(bEdit, { force: true });
    const aEdit = setNote(a.stored() as BentoMinderStore, '家族の変更', NOW_MS - 60_000);
    await a.repository.save(aEdit, { force: true });
    await a.controller.localChanged(aEdit);
    driftMs.value += 40_000;
    a.controller.syncNow();
    await settle(150);
    const second = (await a.controller.family.createInvite()).code;
    expect(await b.controller.family.join(second)).toEqual({ kind: 'ask' });
    await b.controller.family.completeAdoption('add-device');
    await settle(150);
    for (const d of [a, a2, b]) d.controller.syncNow();
    await settle(300);
    const reference = syncedView(a.stored());
    expect(syncedView(a2.stored())).toEqual(reference);
    expect(syncedView(b.stored())).toEqual(reference);
    expect(a2.stored()?.profile?.note).toBe('家族の変更');
    expect(Object.keys(reference).some((k) => k.endsWith('2026-11-20'))).toBe(true);
    a.controller.stop();
    b.controller.stop();
    a2.controller.stop();
  });
});
