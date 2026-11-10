// QA E15: interrupted joins and ended memberships while the adoption question is open. US-E15-04/AC4, AC8, AC11; US-E15-08/AC3, AC6.
// Each test is written to the AC as stated. Tests marked DEFECT use it.fails: they pass while the defect exists and turn red when it is fixed
// (then remove the marker). Defect ids are listed in tests/reports/qa-e15.md.
import { afterEach, describe, expect, it } from 'vitest';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { DEVICE_A, DEVICE_B, UID1, UID2, storeWithData } from '../../domain/sync/helpers.ts';
import { makeCtl, settle, type Ctl } from './ctl.ts';
import { newNet } from './bridge.ts';
import { makeRig, type Rig } from './qa-rig.ts';

const open: Ctl[] = [];
afterEach(() => {
  for (const c of open.splice(0)) c.stop();
});
const track = (c: Ctl): Ctl => {
  open.push(c);
  return c;
};

/** B's own data: a LATER profile than the family's, so that a silent last-edit-wins merge would overwrite the family's profile. */
const bData = (): BentoMinderStore => {
  const s = storeWithData(DEVICE_B, UID2);
  return { ...s, profile: { ...s.profile!, nickname: 'ORIGINAL-B', note: 'B-WOULD-OVERWRITE', updatedAt: '2026-11-12T09:00:00+09:00' } };
};

async function world(): Promise<{ rig: Rig; a: Ctl; familyId: string; code: string }> {
  const rig = makeRig();
  const a = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A }));
  await settle(20);
  await a.controller.family.create();
  await settle(120);
  const code = (await a.controller.family.createInvite()).code;
  return { rig, a, familyId: a.meta()!.familyId!, code };
}

describe('US-E15-04/AC11 a join interrupted before the download finished', () => {
  it.fails('DEFECT E15-D03 US-E15-04/AC4 AC11 after the download failed once and the app is reopened, the question is asked and nothing of the device is merged silently (observed: it syncs at once, overwriting the family profile, no safety copy)', async () => {
    const w = await world();
    const net = newNet();
    let n = 0;
    net.dropBefore = () => ++n === 3; // 1 membership.get, 2 redeem (member added), 3 the first pull is lost
    const b = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, store: bData(), net }));
    await settle(30);
    await b.controller.family.join(w.code);
    await settle(100);
    const files = b.storage.snapshot();
    b.stop();
    const again = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, files }));
    again.clock.now += 120_000;
    await settle(300);
    const familyProfile = String(w.rig.db.get(`families/${w.familyId}/records/profile_profile`)!['payloadJson']);
    const asked = again.controller.getState().adoptionPending;
    expect(asked || !familyProfile.includes('B-WOULD-OVERWRITE'), `question asked: ${asked}; family profile overwritten by the device: ${familyProfile.includes('B-WOULD-OVERWRITE')}; safety copy: ${again.safety() !== null}`).toBe(true);
  });

  it.fails('DEFECT E15-D03 (variant) a join whose local copy is unreadable at join time, recovered later, is not merged silently', async () => {
    const w = await world();
    const b = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, files: { [`bentominder.${UID2}.state`]: '{"corrupt":' } }));
    await settle(30);
    await b.controller.family.join(w.code);
    await settle(100);
    b.stop();
    const files = { ...b.storage.snapshot(), [`bentominder.${UID2}.state`]: JSON.stringify(bData()) };
    const again = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, files }));
    again.clock.now += 120_000;
    await settle(300);
    const familyProfile = String(w.rig.db.get(`families/${w.familyId}/records/profile_profile`)!['payloadJson']);
    expect(again.controller.getState().adoptionPending || !familyProfile.includes('B-WOULD-OVERWRITE')).toBe(true);
  });
});

describe('US-E15-04/AC8 US-E15-08/AC3 AC6 the membership ends while the adoption question is open', () => {
  async function pending() {
    const w = await world();
    const b = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, store: bData() }));
    await settle(30);
    expect(await b.controller.family.join(w.code)).toEqual({ kind: 'ask' });
    return { ...w, b };
  }

  it.fails('DEFECT E15-D04 US-E15-08/AC3 the removed joiner (question still open) can leave the question: answering or cancelling works and the device ends local-only with its data (observed: both fail forever)', async () => {
    const { a, b } = await pending();
    await a.controller.family.removeMember(UID2);
    b.clock.now += 120_000;
    b.controller.syncNow();
    await settle(150);
    const first = await b.controller.family.completeAdoption('use-family').then(() => 'ok', () => 'failed');
    const second = await b.controller.family.cancelJoin().then(() => 'ok', () => 'failed');
    await settle(100);
    expect([first, second], 'one of the two ways out works').toContain('ok');
    expect(b.meta()?.familyId ?? null).toBeNull();
  });

  it.fails('DEFECT E15-D04 US-E15-08/AC6 the family is deleted while a joiner has the question open: the joiner is told and ends local-only (observed: nothing is learned while the question is pending)', async () => {
    const { a, b } = await pending();
    await a.controller.family.deleteFamily();
    await settle(50);
    b.clock.now += 120_000;
    b.controller.syncNow();
    await settle(200);
    const st = b.controller.getState();
    expect(st.endedReason === 'family-deleted' || b.meta()?.familyId === null).toBe(true);
  });
});
