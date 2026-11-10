// QA E15: migration from the E13 local scheme, family -> leave -> back, export/import compatibility and the family-import replace effect.
// Stories: US-E15-11 (AC1-AC9), US-E15-08/AC7, US-E15-02 (nothing before consent).
import { afterEach, describe, expect, it } from 'vitest';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { createRepository, validateStore } from '../../../../src/domain/storage/repository.ts';
import { storeKeysFor } from '../../../../src/domain/storage/keys.ts';
import { prepareFamilyImport } from '../../../../src/domain/sync/import.ts';
import { ownerMismatchesFor } from '../../../../src/domain/sync/owner.ts';
import { toJstTimestamp, type Instant } from '../../../../src/domain/time/jst.ts';
import { DEVICE_A, DEVICE_B, UID1, UID2, storeWithData } from '../../domain/sync/helpers.ts';
import { fixedClock, memoryStorage } from '../../helpers/memory-storage.ts';
import { makeCtl, settle, type Ctl } from './ctl.ts';
import { makeRig } from './qa-rig.ts';

const open: Ctl[] = [];
afterEach(() => {
  for (const c of open.splice(0)) c.stop();
});
const track = (c: Ctl): Ctl => {
  open.push(c);
  return c;
};
const clock = fixedClock('2026-11-14T15:30:00Z');

/** An E13-era file: ownerId is the uid everywhere, schemaVersion 1, no sync artefacts. */
const e13Store = (uid: string): BentoMinderStore => storeWithData(DEVICE_A, uid);

describe('US-E15-11/AC1 AC9 no change until sharing is switched on', () => {
  it('an E13 local copy is read and left byte-for-byte as it was: no write, no key rename, no sync metadata, schemaVersion 1, no cloud request but the membership read', async () => {
    const rig = makeRig();
    const raw = JSON.stringify(e13Store(UID1));
    const files = { [`bentominder.${UID1}.state`]: raw, [`bentominder.${UID1}.state.prev`]: raw };
    const d = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A, files }));
    await settle(150);
    expect(d.storage.snapshot()).toEqual(files);
    expect(d.storage.ops).toBe(0);
    expect(JSON.parse(raw).schemaVersion).toBe(1);
    expect(d.net.requests.map((r) => r.op).every((o) => o === 'membership.get')).toBe(true);
    expect(rig.db.docs.size).toBe(0);
  });

  it('US-E15-11/AC9 the store keeps the exact top-level shape: a member export has the same top-level fields as a non-member export, no new field', async () => {
    const rig = makeRig();
    const d = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A }));
    await settle();
    const before = Object.keys(d.stored()!).sort();
    await d.controller.family.create();
    await settle(150);
    const after = Object.keys(d.stored()!).sort();
    expect(after).toEqual(before);
    expect(d.stored()!.schemaVersion).toBe(1);
  });
});

describe('US-E15-11/AC2 AC3 family -> leave -> back, keys and ownerId', () => {
  it('the local copy stays under bentominder.<uid>.state (+ .prev), metadata and safety copy are separate keys; owner is family id while a member, uid after leaving, family id again after rejoining', async () => {
    const rig = makeRig();
    const a = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A }));
    await settle();
    await a.controller.family.create();
    await settle(150);
    const keys = Object.keys(a.storage.snapshot()).sort();
    expect(keys).toContain(`bentominder.${UID1}.state`);
    expect(keys).toContain(`bentominder.${UID1}.sync`);
    for (const k of keys) expect(k).toMatch(new RegExp(`^bentominder\\.${UID1}\\.(state|state\\.prev|sync|safety)$`));
    const fam = a.meta()!.familyId!;
    expect(a.stored()!.profile!.ownerId).toBe(fam);
    // a second member and then leaving
    const code = (await a.controller.family.createInvite()).code;
    const b = track(makeCtl({ rig, uid: UID2, deviceId: DEVICE_B, store: null }));
    await settle();
    await b.controller.family.join(code);
    await settle(200);
    await b.controller.family.leave(false);
    await settle(100);
    const left = b.stored()!;
    expect(left.profile!.ownerId).toBe(UID2);
    expect(JSON.stringify(left)).not.toContain(fam); // nothing of the family id stays in a stand-alone copy
    expect(validateStore(left, UID2).ok).toBe(true);
    // the same data back into the family with a new code
    const code2 = (await a.controller.family.createInvite()).code;
    expect(await b.controller.family.join(code2)).toEqual({ kind: 'ask' }); // data on both sides
    await b.controller.family.completeAdoption('add-device');
    await settle(250);
    expect(b.stored()!.profile!.ownerId).toBe(fam);
    expect(ownerMismatchesFor(b.stored()!, [UID2, fam])).toEqual([]);
    expect(Object.keys(b.stored()!.decisions).sort()).toEqual(Object.keys(a.stored()!.decisions).sort());
    // two copies of every record would show as extra cloud records: there are none
    const cloudKeys = rig.db.paths(`families/${fam}/records`).map((p) => p.split('/').pop());
    expect(new Set(cloudKeys).size).toBe(cloudKeys.length);
  });

  it.fails('DEFECT E15-D06 US-E15-11/AC2 a device with the previous app version (owner rule: uid only) still reads the family-owned local copy (observed: it refuses the file)', async () => {
    // contract 14.11: "A device with an older app version can still read its local copy but does not sync".
    const storage = memoryStorage();
    const fam = 'FamilyIdFamilyIdFamilyId';
    const familyOwned = JSON.stringify(storeWithData(DEVICE_A, fam));
    await storage.write(storeKeysFor(UID1).state, familyOwned);
    const oldApp = createRepository(storage, clock, { accountId: UID1 }); // the E13 repository options: no allowedOwnerIds
    const loaded = await oldApp.load();
    expect(loaded.kind, JSON.stringify(loaded).slice(0, 200)).toBe('ok');
  });
});

describe('US-E15-11/AC4 AC5 AC8 export and import compatibility', () => {
  it('US-E15-11/AC4 a member exports the plain store: no tombstone, sync metadata, member, invite or envelope field anywhere; it validates and round-trips', async () => {
    const rig = makeRig();
    const a = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A }));
    await settle();
    await a.controller.family.create();
    await settle(150);
    const code = (await a.controller.family.createInvite()).code;
    const exported = a.repository.exportJson(a.stored()!);
    const doc = JSON.parse(exported) as Record<string, unknown>;
    expect(Object.keys(doc).sort()).toEqual(Object.keys(JSON.parse(JSON.stringify(storeWithData(DEVICE_A, UID1)))).sort());
    for (const banned of ['deletedAt', 'tombstone', 'payloadJson', 'updatedBy', 'seq', 'members', 'familyMembers', 'activeInviteHash', 'cursor', 'baselines', 'consentVersion', 'cloudNotice', code]) {
      expect(exported.includes(`"${banned}"`) || exported.includes(banned), banned).toBe(false);
    }
    const back = a.repository.importJson(exported);
    expect(back.ok).toBe(true);
  });

  it.fails('DEFECT E15-D05 (P4) US-E15-11/AC8 deviceId is never exported (observed: the export carries the store root deviceId, as before E15; the contract text contradicts its own "export is the store as is")', async () => {
    const rig = makeRig();
    const a = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A }));
    await settle();
    const exported = a.repository.exportJson(a.stored()!);
    expect(exported.includes(DEVICE_A)).toBe(false);
  });

  it('US-E15-11/AC5 old exports (ownerId local or a uid, schemaVersion 1) import by an account in no family exactly as before', async () => {
    const storage = memoryStorage();
    const repo = createRepository(storage, clock, { accountId: UID1 });
    for (const owner of ['local', 'some-other-uid']) {
      const old = JSON.stringify(JSON.parse(JSON.stringify(storeWithData(DEVICE_B, 'x')).replaceAll('"ownerId":"x"', `"ownerId":"${owner}"`)));
      const r = repo.importJson(old);
      expect(r.ok, owner).toBe(true);
      if (r.ok) expect(r.state.profile!.ownerId).toBe(UID1);
    }
    expect(repo.importJson('{"schemaVersion":2,"deviceId":"d"}')).toMatchObject({ ok: false, error: 'too-new' });
    expect(repo.importJson('nope')).toMatchObject({ ok: false });
  });
});

describe('US-E15-11/AC6 import into a family replaces the family data', () => {
  it('records of the file are written for the family with updatedAt = now, records absent from the file become tombstones, the other device shows the imported data, and nothing keeps an old updatedAt', async () => {
    const rig = makeRig();
    const a = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A }));
    await settle();
    await a.controller.family.create();
    await settle(150);
    const code = (await a.controller.family.createInvite()).code;
    const b = track(makeCtl({ rig, uid: UID2, deviceId: DEVICE_B, store: null }));
    await settle();
    await b.controller.family.join(code);
    await settle(250);
    const fam = a.meta()!.familyId!;
    const dates = Object.keys(b.stored()!.decisions).sort();
    expect(dates.length).toBeGreaterThanOrEqual(2);
    // the file: a copy of B's data with the first decision removed, an edited profile note, a date long ago
    const file = JSON.parse(JSON.stringify(b.stored()!)) as BentoMinderStore;
    file.decisions = Object.fromEntries(Object.entries(file.decisions).filter(([k]) => k !== dates[0]));
    file.profile = { ...file.profile!, note: 'IMPORTED-NOTE' };
    const text = b.repository.exportJson(file);
    const parsed = b.repository.importJson(text);
    expect(parsed.ok).toBe(true);
    b.clock.now += 3_600_000;
    const nowIso = toJstTimestamp(b.clock.now as Instant);
    const prepared = prepareFamilyImport({ imported: (parsed as { ok: true; state: BentoMinderStore }).state, deviceId: DEVICE_B, familyId: fam, nowIso });
    expect(prepared.deviceId).toBe(DEVICE_B);
    expect(prepared.profile!.ownerId).toBe(fam);
    for (const r of [prepared.profile!, ...Object.values(prepared.decisions), ...Object.values(prepared.menus)]) expect(r.updatedAt).toBe(nowIso);
    await b.repository.save(prepared, { force: true });
    await b.controller.localChanged(prepared);
    b.controller.syncNow();
    await settle(250);
    a.clock.now = b.clock.now + 120_000;
    a.controller.syncNow();
    await settle(250);
    const aStore = a.stored()!;
    expect(aStore.profile!.note).toBe('IMPORTED-NOTE');
    expect(Object.keys(aStore.decisions).sort()).toEqual(dates.slice(1));
    expect(rig.db.get(`families/${fam}/records/decision_${dates[0]}`)!['deletedAt']).toBeDefined();
    expect(validateStore(aStore).ok).toBe(true);
  });

  it('US-E15-11/AC6 a file made by another family\'s member (different ownerId and deviceId) never carries that identity into this family', async () => {
    const stranger = storeWithData('c0000000-0000-4000-8000-00000000000c', 'OtherFamilyIdOtherFamilyId');
    const out = prepareFamilyImport({ imported: stranger, deviceId: DEVICE_B, familyId: 'MyFamilyIdMyFamilyIdMy', nowIso: '2026-11-14T10:00:00+09:00' });
    const text = JSON.stringify(out);
    expect(text.includes('OtherFamilyId')).toBe(false);
    expect(text.includes('c0000000-0000-4000-8000-00000000000c')).toBe(false);
  });
});

describe('US-E15-11/AC7 US-E15-08/AC7 local "delete all" while in a family', () => {
  it('local keys and the safety copy go, the online data stays, the next cycle downloads the family data and sends no deletions', async () => {
    const rig = makeRig();
    const a = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A }));
    await settle();
    await a.controller.family.create();
    await settle(150);
    const fam = a.meta()!.familyId!;
    const cloudBefore = rig.db.paths(`families/${fam}/records`).length;
    await a.repository.deleteAll();
    expect(a.stored()).toBeNull(); // local keys are gone
    await a.controller.localDataDeleted();
    await settle(50);
    a.clock.now += 120_000;
    a.controller.syncNow();
    await settle(250);
    expect(rig.db.paths(`families/${fam}/records`).length).toBe(cloudBefore);
    expect(rig.db.paths(`families/${fam}/records`).map((p) => rig.db.get(p)!['deletedAt']).filter((x) => x !== undefined)).toEqual([]);
    expect(a.stored()?.profile).not.toBeNull(); // downloaded again
  });
});
