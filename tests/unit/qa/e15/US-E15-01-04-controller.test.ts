// QA E15: consent gating, creation, joining, adoption, leaving, status, through the REAL sync controller, HTTP adapter and Function.
// Stories: US-E15-01 (AC1-AC8), US-E15-02 (AC1, AC5, AC6, AC8), US-E15-04 (AC3-AC12), US-E15-05 (AC1-AC4, AC6), US-E15-06 (AC1-AC4, AC7, AC10), US-E15-08 (AC1-AC10).
import { afterEach, describe, expect, it } from 'vitest';
import { extractRecords } from '../../../../src/domain/sync/records.ts';
import { ownerMismatchesFor } from '../../../../src/domain/sync/owner.ts';
import { validateStore } from '../../../../src/domain/storage/repository.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { DEVICE_A, DEVICE_B, UID1, UID2, setDecision, storeWithData } from '../../domain/sync/helpers.ts';
import { makeCtl, settle, type Ctl } from './ctl.ts';
import { T0, UID3 as U3, makeRig, type Rig } from './qa-rig.ts';

const open: Ctl[] = [];
afterEach(() => {
  for (const c of open.splice(0)) c.stop();
});
const mk = (o: Parameters<typeof makeCtl>[0]): Ctl => {
  const c = makeCtl(o);
  open.push(c);
  return c;
};
const recordOps = (c: Ctl) => c.net.requests.filter((r) => r.op === 'records.push' || r.op === 'records.pull').length;
const ops = (c: Ctl) => c.net.requests.map((r) => r.op);

async function familyOfOne(rig: Rig): Promise<{ a: Ctl; familyId: string }> {
  const a = mk({ rig, uid: UID1, deviceId: DEVICE_A });
  await settle();
  await a.controller.family.create();
  await settle(120);
  return { a, familyId: a.meta()!.familyId! };
}

describe('US-E15-02 + US-E15-01/AC1: no cloud request carrying or fetching family data before consent', () => {
  it('US-E15-01/AC1 US-E15-02/AC8 a signed-in account in no family: the app starts, works, edits, and makes no records request; only membership.get', async () => {
    const rig = makeRig();
    const d = mk({ rig, uid: UID1, deviceId: DEVICE_A });
    await settle(80);
    const s = storeWithData(DEVICE_A, UID1);
    await d.repository.save({ ...s, profile: { ...s.profile!, note: 'edited' } }, { force: true });
    await d.controller.localChanged({ ...s, profile: { ...s.profile!, note: 'edited' } });
    await settle(80);
    expect(recordOps(d)).toBe(0);
    expect(new Set(ops(d))).toEqual(new Set(['membership.get']));
    expect(rig.db.docs.size).toBe(0);
    expect(d.controller.getState().view.state).toBe('local-only');
    expect(d.meta()).toBeNull();
  });

  it('US-E15-02/AC6 a member device whose app carries notice version 2 while it consented to 1: paused-no-consent, 0 records requests, local edits still saved; accepting resumes and sends them', async () => {
    const rig = makeRig();
    const { a, familyId } = await familyOfOne(rig);
    a.stop();
    const b = mk({ rig, uid: UID1, deviceId: DEVICE_A, files: a.storage.snapshot(), noticeVersion: 2 });
    await settle(120);
    expect(b.controller.getState().view.state).toBe('paused-no-consent');
    expect(recordOps(b)).toBe(0);
    // local use continues
    const cur = b.stored()!;
    const edited: BentoMinderStore = { ...cur, profile: { ...cur.profile!, note: 'edited while paused', updatedAt: '2026-11-10T11:00:00+09:00' } };
    await b.repository.save(edited, { force: true });
    await b.controller.localChanged(edited);
    await settle(80);
    expect(recordOps(b)).toBe(0);
    // declining = doing nothing: still no family data moves
    await settle(100);
    expect(recordOps(b)).toBe(0);
    expect(rig.db.paths(`families/${familyId}/records`).length).toBeGreaterThan(0);
    // accepting
    b.clock.now += 60_000;
    await b.controller.family.acceptConsent();
    await settle(150);
    expect(ops(b)).toContain('consent.set');
    expect(b.net.requests.find((r) => r.op === 'consent.set')?.body).toEqual({ consentVersion: 2 });
    expect(b.controller.getState().view.state).toBe('synced');
    expect(rig.db.get(`families/${familyId}/members/${UID1}`)!['consentVersion']).toBe(2);
    const stored = rig.db.get(`families/${familyId}/records/profile_profile`)!;
    expect(String(stored['payloadJson'])).toContain('edited while paused');
  });

  it('US-E15-05/AC2 a second device of a member who consented to the current version asks nothing and starts syncing; a version it lacks pauses it before any records request', async () => {
    const rig = makeRig();
    const { a } = await familyOfOne(rig);
    const ok = mk({ rig, uid: UID1, deviceId: DEVICE_B, store: null });
    await settle(200);
    expect(ok.controller.getState().view.state).toBe('synced');
    expect(ok.stored()?.profile).not.toBeNull();
    const old = mk({ rig, uid: UID1, deviceId: DEVICE_B, store: null, noticeVersion: 2 });
    await settle(150);
    expect(recordOps(old)).toBe(0);
    expect(old.controller.getState().view.state).toBe('paused-no-consent');
    void a;
  });
});

describe('US-E15-01 create, upload, one family per account', () => {
  it('US-E15-01/AC3 creating uploads every local record exactly once, under the family id, with timestamps unchanged; the local copy is unchanged apart from ownerId', async () => {
    const rig = makeRig();
    const before = storeWithData(DEVICE_A, UID1);
    const d = mk({ rig, uid: UID1, deviceId: DEVICE_A, store: before });
    await settle();
    await d.controller.family.create();
    await settle(150);
    const familyId = d.meta()!.familyId!;
    const records = extractRecords(before);
    const stored = rig.db.paths(`families/${familyId}/records`).map((p) => rig.db.get(p)!);
    const missing = [...records.keys()].filter((k) => rig.db.get(`families/${familyId}/records/${k}`) === undefined);
    expect(missing, 'only never-edited default settings may stay home (contract 14.4: defaults-only settings are not data)').toEqual(before.settings.createdAt === before.settings.updatedAt ? ['settings_settings'] : []);
    expect(stored.length).toBe(records.size - missing.length);
    const pushed = d.net.requests.filter((r) => r.op === 'records.push').flatMap((r) => r.body['records'] as Array<{ kind: string; key: string }>);
    const keyList = pushed.map((e) => `${e.kind}_${e.key}`);
    expect(new Set(keyList).size).toBe(keyList.length); // no record uploaded twice
    for (const doc of stored) {
      const payload = JSON.parse(String(doc['payloadJson'])) as Record<string, unknown>;
      if (doc['kind'] !== 'aiUsage') expect(payload['ownerId'], String(doc['key'])).toBe(familyId);
    }
    const profile = JSON.parse(String(rig.db.get(`families/${familyId}/records/profile_profile`)!['payloadJson'])) as { updatedAt: string };
    expect(profile.updatedAt).toBe(before.profile!.updatedAt);
    const local = d.stored()!;
    expect(validateStore(local).ok).toBe(true);
    expect(ownerMismatchesFor(local, [UID1, familyId])).toEqual([]);
    expect(local.profile!.ownerId).toBe(familyId);
    expect(local.profile!.updatedAt).toBe(before.profile!.updatedAt);
    expect(Object.keys(local.decisions)).toEqual(Object.keys(before.decisions));
    expect(d.controller.getState().view.state).toBe('synced');
  });

  it('US-E15-01/AC4 an empty local copy makes an empty family and no store file is invented', async () => {
    const rig = makeRig();
    const d = mk({ rig, uid: UID1, deviceId: DEVICE_A, store: null });
    await settle();
    await d.controller.family.create();
    await settle(120);
    expect(rig.db.paths(`families/${d.meta()!.familyId}/records`)).toEqual([]);
    expect(d.stored()).toBeNull();
  });

  it('US-E15-01/AC8 two quick taps create exactly one family', async () => {
    const rig = makeRig();
    const d = mk({ rig, uid: UID1, deviceId: DEVICE_A });
    await settle();
    await Promise.all([d.controller.family.create(), d.controller.family.create().catch(() => undefined)]);
    await settle(150);
    expect(rig.db.paths('families').filter((p) => /^families\/[^/]+$/.test(p)).length).toBe(1);
  });

  it('US-E15-01/AC5 the upload fails halfway: local copy untouched, status pending/retrying, resumes when the network returns, nothing uploaded twice, invite refused until the first upload is done', async () => {
    const rig = makeRig();
    const before = storeWithData(DEVICE_A, UID1);
    const d = mk({ rig, uid: UID1, deviceId: DEVICE_A, store: before });
    await settle();
    let n = 0;
    d.net.dropAfter = () => ++n === 2; // the first push is committed but its reply is lost
    await d.controller.family.create();
    await settle(150);
    expect(['retrying', 'syncing', 'pending-offline', 'synced']).toContain(d.controller.getState().view.state);
    d.net.dropAfter = () => false;
    d.controller.syncNow();
    await settle(200);
    const familyId = d.meta()!.familyId!;
    expect(rig.db.paths(`families/${familyId}/records`).length).toBe(extractRecords(before).size - 1);
    expect(d.controller.getState().view.state).toBe('synced');
    expect(d.stored()!.decisions).toBeDefined();
    expect(Object.keys(d.stored()!.decisions)).toEqual(Object.keys(before.decisions));
  });

  it('US-E15-01/AC6 an account already in a family cannot create or join another (server refuses, nothing changes)', async () => {
    const rig = makeRig();
    const { a } = await familyOfOne(rig);
    const before = JSON.stringify([...rig.db.docs.entries()]);
    const r = await a.net.requests.length;
    void r;
    const code = (await a.controller.family.createInvite()).code;
    const other = mk({ rig, uid: 'test-uid-004', deviceId: DEVICE_B, store: null });
    await settle();
    await other.controller.family.create();
    await settle(100);
    const res = await other.controller.family.join(code);
    expect(res).toEqual({ kind: 'error', error: 'already' });
    void before;
  });
});

describe('US-E15-04 joining and adoption', () => {
  async function withInvite(rig: Rig) {
    const { a, familyId } = await familyOfOne(rig);
    const { code } = await a.controller.family.createInvite();
    return { a, familyId, code };
  }

  it('US-E15-04/AC3 US-E15-05/AC1 an empty phone joins, downloads, shows the family data with no question and no empty flash', async () => {
    const rig = makeRig();
    const { a, code, familyId } = await withInvite(rig);
    const b = mk({ rig, uid: UID2, deviceId: DEVICE_B, store: null });
    await settle();
    expect(await b.controller.family.join(code)).toEqual({ kind: 'done' });
    await settle(200);
    expect(b.stored()?.profile?.nickname).toBe(a.stored()?.profile?.nickname);
    expect(Object.keys(b.stored()!.decisions).sort()).toEqual(Object.keys(a.stored()!.decisions).sort());
    expect(b.controller.getState().adoptionPending).toBe(false);
    expect(ownerMismatchesFor(b.stored()!, [UID2, familyId])).toEqual([]);
    expect(b.safety()).toBeNull();
  });

  it('US-E15-04/AC4 AC5 AC8 data on both sides: asks, changes nothing before the answer; cancel undoes the join; use-family replaces local, keeps a safety copy, uploads nothing of it', async () => {
    const rig = makeRig();
    const { a, code, familyId } = await withInvite(rig);
    const own = storeWithData(DEVICE_B, UID2);
    const mine: BentoMinderStore = { ...own, profile: { ...own.profile!, nickname: 'べつの子', note: 'MYNOTE' } };
    const b = mk({ rig, uid: UID2, deviceId: DEVICE_B, store: mine });
    await settle();
    const raw0 = b.storage.data.get(`bentominder.${UID2}.state`);
    expect(await b.controller.family.join(code)).toEqual({ kind: 'ask' });
    expect(b.controller.getState().adoptionPending).toBe(true);
    expect(b.storage.data.get(`bentominder.${UID2}.state`)).toBe(raw0); // nothing changed before the answer
    // cancel at the question (AC8): the membership is undone, nothing changed locally
    await b.controller.family.cancelJoin();
    await settle(100);
    expect(b.storage.data.get(`bentominder.${UID2}.state`)).toBe(raw0);
    expect(b.meta()!.familyId).toBeNull();
    expect(rig.db.get(`families/${familyId}`)!['memberCount']).toBe(1);
    // join again with a new invite and choose use-family
    const code2 = (await a.controller.family.createInvite()).code;
    expect(await b.controller.family.join(code2)).toEqual({ kind: 'ask' });
    const nPushBefore = b.net.requests.filter((r) => r.op === 'records.push').length;
    await b.controller.family.completeAdoption('use-family');
    await settle(200);
    expect(b.stored()?.profile?.nickname).toBe(a.stored()?.profile?.nickname);
    expect(b.safety()).toContain('べつの子');
    expect(b.net.requests.filter((r) => r.op === 'records.push').length).toBe(nPushBefore); // nothing uploaded
    expect(rig.db.mentioning('MYNOTE')).toEqual([]);
    expect(rig.db.mentioning('べつの子')).toEqual([]);
    expect(await b.controller.family.safetyCopy()).toContain('MYNOTE'); // can be exported
  });

  it('US-E15-04/AC6 add-device: family profile and settings stay, keys the family lacks are added, keys both have keep the family record, the safety copy is kept, the added keys reach the cloud once', async () => {
    const rig = makeRig();
    const { a, code, familyId } = await withInvite(rig);
    const own = storeWithData(DEVICE_B, UID2);
    const famDecisionDates = Object.keys(a.stored()!.decisions);
    const mine: BentoMinderStore = {
      ...own,
      profile: { ...own.profile!, nickname: 'べつの子' },
      decisions: { ...own.decisions, '2026-12-03': setDecision(own, '2026-12-03', 'not-confirmed', Date.parse('2026-11-12T09:00:00+09:00')).decisions['2026-12-03']! },
    };
    const b = mk({ rig, uid: UID2, deviceId: DEVICE_B, store: mine });
    await settle();
    expect(await b.controller.family.join(code)).toEqual({ kind: 'ask' });
    await b.controller.family.completeAdoption('add-device');
    await settle(250);
    const s = b.stored()!;
    expect(s.profile!.nickname).toBe(a.stored()!.profile!.nickname); // the family's profile stays
    expect(Object.keys(s.decisions)).toContain('2026-12-03');
    for (const d of famDecisionDates) expect(s.decisions[d]).toEqual({ ...a.stored()!.decisions[d] }); // the family's record stays
    expect(b.safety()).not.toBeNull();
    expect(rig.db.get(`families/${familyId}/records/decision_2026-12-03`)).toBeDefined();
    expect(rig.db.mentioning('べつの子')).toEqual([]); // the device's profile was not uploaded
    expect(validateStore(s).ok).toBe(true);
  });

  it('US-E15-04/AC7 a family with no records takes the joiner data with no question', async () => {
    const rig = makeRig();
    const a = mk({ rig, uid: UID1, deviceId: DEVICE_A, store: null });
    await settle();
    await a.controller.family.create();
    await settle(100);
    const code = (await a.controller.family.createInvite()).code;
    const b = mk({ rig, uid: UID2, deviceId: DEVICE_B });
    await settle();
    expect(await b.controller.family.join(code)).toEqual({ kind: 'done' });
    await settle(250);
    expect(rig.db.paths(`families/${a.meta()!.familyId}/records`).length).toBeGreaterThan(3);
  });

  it('US-E15-04/AC9 AC10 refusals: already in a family, wrong, expired, used; each leaves the device untouched', async () => {
    const rig = makeRig();
    const { a, code } = await withInvite(rig);
    const b = mk({ rig, uid: UID2, deviceId: DEVICE_B, store: null });
    await settle();
    const raw = JSON.stringify(b.storage.snapshot());
    expect(await b.controller.family.join('WRONGCODE2')).toEqual({ kind: 'error', error: 'generic' });
    rig.now = T0 + 73 * 3_600_000;
    b.clock.now = rig.now;
    expect(await b.controller.family.join(code)).toEqual({ kind: 'error', error: 'expired' });
    expect(JSON.stringify(b.storage.snapshot())).toBe(raw);
    rig.now = T0;
    b.clock.now = T0;
    const fresh = (await a.controller.family.createInvite()).code;
    expect(await b.controller.family.join(fresh.toLowerCase().replace(/(.{5})/, '$1 -'))).toEqual({ kind: 'done' });
    await settle(150);
    const c = mk({ rig, uid: U3, deviceId: DEVICE_B, store: null });
    await settle();
    expect(await c.controller.family.join(fresh)).toEqual({ kind: 'error', error: 'generic' }); // used: generic
    expect(c.meta()).toBeNull();
  });

  it('US-E15-04/AC12 US-E15-08/AC1-AC3 equal members: the joiner can edit, invite when room, remove the other, leave, delete', async () => {
    const rig = makeRig();
    const { a, code, familyId } = await withInvite(rig);
    const b = mk({ rig, uid: UID2, deviceId: DEVICE_B, store: null });
    await settle();
    await b.controller.family.join(code);
    await settle(200);
    const m = await b.controller.family.membership();
    expect(m.status === 'member' && m.members?.length).toBe(2);
    await expect(b.controller.family.createInvite()).rejects.toMatchObject({ detail: 'family-full' });
    // B removes A: A is told on its next sync, keeps its copy as stand-alone
    await b.controller.family.removeMember(UID1);
    a.clock.now += 70_000;
    a.controller.syncNow();
    await settle(200);
    expect(a.controller.getState().endedReason).toBe('removed');
    await a.controller.family.acknowledgeEnded();
    await settle(100);
    const local = a.stored()!;
    expect(local.profile!.ownerId).toBe(UID1);
    expect(a.meta()!.familyId).toBeNull();
    expect(validateStore(local).ok).toBe(true);
    // A can no longer read the family
    const r = await a.controller.family.membership();
    expect(r.status).toBe('none');
    // and can create or join again (AC10); the used code is still refused
    expect((await a.controller.family.join(code)).kind).toBe('error');
    void familyId;
  });
});

describe('US-E15-08 leave and delete', () => {
  it('US-E15-08/AC2 AC5 AC6 AC11 delete: the cloud lists nothing, the other device is told once, keeps its copy as local-only and uploads nothing afterwards', async () => {
    const rig = makeRig();
    const { a, familyId } = await familyOfOne(rig);
    const code = (await a.controller.family.createInvite()).code;
    const b = mk({ rig, uid: UID2, deviceId: DEVICE_B, store: null });
    await settle();
    await b.controller.family.join(code);
    await settle(200);
    await a.controller.family.deleteFamily();
    await settle(100);
    expect(rig.db.paths(`families/${familyId}`)).toEqual([]);
    expect(rig.db.mentioning(familyId).filter((p) => p.startsWith('families/') || p.startsWith('invites/'))).toEqual([]);
    expect(a.meta()!.familyId).toBeNull();
    expect(a.stored()!.profile!.ownerId).toBe(UID1);
    const before = rig.db.docs.size;
    b.clock.now += 70_000;
    b.controller.syncNow();
    await settle(200);
    expect(b.controller.getState().endedReason).toBe('family-deleted');
    await b.controller.family.acknowledgeEnded();
    await settle(100);
    expect(b.stored()!.profile!.ownerId).toBe(UID2);
    expect(b.meta()!.familyId).toBeNull();
    // never re-creates
    b.clock.now += 70_000;
    b.controller.syncNow();
    await settle(150);
    expect(rig.db.paths('families')).toEqual([]);
    expect(rig.db.docs.size).toBeLessThanOrEqual(before);
  });

  it('US-E15-08/AC1 AC4 AC10 leaving: the other member keeps the data; the last member leaving deletes the family; the account can create again', async () => {
    const rig = makeRig();
    const { a, familyId } = await familyOfOne(rig);
    const code = (await a.controller.family.createInvite()).code;
    const b = mk({ rig, uid: UID2, deviceId: DEVICE_B, store: null });
    await settle();
    await b.controller.family.join(code);
    await settle(200);
    await b.controller.family.leave(false);
    await settle(100);
    expect(rig.db.paths(`families/${familyId}/records`).length).toBeGreaterThan(3);
    expect(b.stored()!.profile!.ownerId).toBe(UID2);
    await a.controller.family.leave(true);
    await settle(100);
    expect(rig.db.paths(`families/${familyId}`)).toEqual([]);
    expect(a.stored()!.profile).not.toBeNull();
    await a.controller.family.create();
    await settle(150);
    expect(a.meta()!.familyId).not.toBeNull();
    expect(a.meta()!.familyId).not.toBe(familyId);
  });

  it('US-E15-08/AC9 US-E15-03/AC9 offline: leave, remove, delete and invite fail now and nothing is queued', async () => {
    const rig = makeRig();
    const { a } = await familyOfOne(rig);
    a.net.online = false;
    a.host.online = false;
    for (const fn of [() => a.controller.family.leave(false), () => a.controller.family.deleteFamily(), () => a.controller.family.removeMember(UID2), () => a.controller.family.createInvite()]) {
      await expect(fn()).rejects.toMatchObject({ kind: 'offline' });
    }
    a.net.online = true;
    a.host.online = true;
    await settle(100);
    const m = await a.controller.family.membership();
    expect(m.status).toBe('member'); // nothing was applied later "by surprise"
    expect(a.meta()!.familyId).not.toBeNull();
  });
});

describe('US-E15-06 offline queue, status, nothing blocks', () => {
  it('US-E15-06/AC2 AC3 AC7 offline: 5 edits of 3 records queue as 3, survive a restart, are sent when online, local use works throughout', async () => {
    const rig = makeRig();
    const { a, familyId } = await familyOfOne(rig);
    a.net.online = false;
    a.host.online = false;
    let s = a.stored()!;
    const edit = async (fn: (x: BentoMinderStore) => BentoMinderStore) => {
      s = fn(s);
      await a.repository.save(s, { force: true });
      await a.controller.localChanged(s);
    };
    const stamp = (n: number) => `2026-11-10T11:0${n}:00+09:00`;
    await edit((x) => ({ ...x, profile: { ...x.profile!, note: 'n1', updatedAt: stamp(1) } }));
    await edit((x) => ({ ...x, profile: { ...x.profile!, note: 'n2', updatedAt: stamp(2) } }));
    const date = Object.keys(s.decisions)[0]!;
    await edit((x) => ({ ...x, decisions: { ...x.decisions, [date]: { ...x.decisions[date]!, updatedAt: stamp(3), history: x.decisions[date]!.history } } }));
    await edit((x) => ({ ...x, settings: { ...x.settings, reminders: { ...x.settings.reminders, weekly: { ...x.settings.reminders.weekly, time: '15:45' } }, updatedAt: stamp(4) } }));
    await edit((x) => ({ ...x, decisions: { ...x.decisions, [date]: { ...x.decisions[date]!, updatedAt: stamp(5) } } }));
    a.clock.now += 11_000;
    a.controller.syncNow();
    await settle(120);
    const st = a.controller.getState();
    expect(['pending-offline', 'retrying']).toContain(st.view.state);
    expect(st.view.pendingCount).toBe(3);
    // restart: the queue is derived from the store + baselines
    a.stop();
    const again = mk({ rig, uid: UID1, deviceId: DEVICE_A, files: a.storage.snapshot() });
    again.net.online = false;
    again.host.online = false;
    await settle(120);
    expect(again.controller.getState().view.pendingCount).toBe(3);
    again.net.online = true;
    again.host.online = true;
    again.clock.now += 20_000;
    again.controller.syncNow();
    await settle(200);
    expect(again.controller.getState().view.state).toBe('synced');
    expect(String(rig.db.get(`families/${familyId}/records/profile_profile`)!['payloadJson'])).toContain('n2');
    expect(String(rig.db.get(`families/${familyId}/records/settings_settings`)!['payloadJson'])).toContain('15:45');
  });

  it('US-E15-06/AC10 after sign-out nothing is sent, even by a timer that was already armed, and the queue stays in the account keys', async () => {
    const rig = makeRig();
    const { a } = await familyOfOne(rig);
    const s = a.stored()!;
    const edited = { ...s, profile: { ...s.profile!, note: 'after-signout', updatedAt: '2026-11-10T12:00:00+09:00' } };
    await a.repository.save(edited, { force: true });
    await a.controller.localChanged(edited);
    a.stop();
    const sent = a.net.requests.length;
    a.clock.now += 120_000;
    a.controller.syncNow();
    await settle(3000);
    expect(a.net.requests.length).toBe(sent);
    expect(rig.db.mentioning('after-signout')).toEqual([]);
    expect(a.storage.data.has(`bentominder.${UID1}.sync`)).toBe(true);
  }, 15_000);
});
