// E15-D03 fix cycle: a device that is a member but has not finished the first sync never pushes, and the adoption question is asked
// after a network cut or a crash at ANY step of the join. US-E15-04/AC4, AC5, AC11. Developer-written regression sweep (the QA probes
// of the same defect are in US-E15-04-join-interrupted.test.ts).
import { afterEach, describe, expect, it } from 'vitest';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { DEVICE_A, DEVICE_B, UID1, UID2, storeWithData } from '../../domain/sync/helpers.ts';
import { makeCtl, settle, type Ctl } from './ctl.ts';
import { newNet, type Net } from './bridge.ts';
import { makeRig, type Rig } from './qa-rig.ts';

const open: Ctl[] = [];
afterEach(() => {
  for (const c of open.splice(0)) c.stop();
});
const track = (c: Ctl): Ctl => {
  open.push(c);
  return c;
};

const MINE = 'B-WOULD-OVERWRITE';
const bData = (): BentoMinderStore => {
  const s = storeWithData(DEVICE_B, UID2);
  return { ...s, profile: { ...s.profile!, nickname: 'ORIGINAL-B', note: MINE, updatedAt: '2026-11-12T09:00:00+09:00' } };
};

async function world(): Promise<{ rig: Rig; familyId: string; code: string }> {
  const rig = makeRig();
  const a = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A }));
  await settle(20);
  await a.controller.family.create();
  await settle(120);
  const code = (await a.controller.family.createInvite()).code;
  return { rig, familyId: a.meta()!.familyId!, code };
}

const familyProfile = (w: { rig: Rig; familyId: string }): string => String(w.rig.db.get(`families/${w.familyId}/records/profile_profile`)!['payloadJson']);

/** What must hold after a restart on a good network: the question is asked, nothing was pushed, the device's data is intact. */
async function expectQuestionOwed(w: { rig: Rig; familyId: string }, files: Record<string, string>, label: string): Promise<void> {
  const again = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, files }));
  again.clock.now += 120_000;
  await settle(250);
  const acct = w.rig.db.get(`accounts/${UID2}`);
  if (acct?.['status'] !== 'member') return; // the redemption itself never reached the server: nothing was joined
  expect(again.controller.getState().adoptionPending, `${label}: question asked`).toBe(true);
  expect(familyProfile(w), `${label}: family profile untouched`).not.toContain(MINE);
  expect(JSON.stringify(again.stored()), `${label}: device data untouched`).toContain(MINE);
}

describe('US-E15-04/AC4 AC11 (E15-D03) join cut at every request', () => {
  for (const mode of ['before', 'after'] as const) {
    it(`network cut (${mode} the server) at request 1..8: reopened, the question is asked and nothing is pushed`, async () => {
      for (let k = 1; k <= 8; k++) {
        const w = await world();
        const net: Net = newNet();
        let n = 0;
        const hit = (): boolean => ++n === k;
        if (mode === 'before') net.dropBefore = hit;
        else net.dropAfter = hit;
        const b = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, store: bData(), net }));
        await settle(30);
        await b.controller.family.join(w.code).catch(() => undefined);
        await settle(100);
        // the device never pushes while the join is unsettled, even with a good network from now on
        expect(familyProfile(w), `${mode} ${k}: not pushed before the answer`).not.toContain(MINE);
        const files = b.storage.snapshot();
        b.stop();
        await expectQuestionOwed(w, files, `${mode} ${k}`);
      }
    }, 120_000);
  }

  it('the same device, left running, resumes at the question by itself once the network returns (no restart)', async () => {
    const w = await world();
    const net = newNet();
    let n = 0;
    net.dropBefore = () => ++n === 3;
    const b = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, store: bData(), net }));
    await settle(30);
    await b.controller.family.join(w.code);
    await settle(50);
    b.clock.now += 120_000;
    b.controller.syncNow();
    await settle(250);
    expect(b.controller.getState().adoptionPending).toBe(true);
    expect(familyProfile(w)).not.toContain(MINE);
  });
});

describe('US-E15-04/AC4 AC11 (E15-D03) crash at every storage write of the join', () => {
  it('after a crash at write 1..8 the restarted device asks the question and has pushed nothing', async () => {
    let crashes = 0;
    for (let k = 1; k <= 8; k++) {
      const w = await world();
      const b = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, store: bData(), crashAt: k }));
      await settle(30);
      await b.controller.family.join(w.code).catch(() => undefined);
      await settle(100);
      if (b.storage.crashed) crashes += 1;
      expect(familyProfile(w), `crash ${k}: not pushed`).not.toContain(MINE);
      const files = b.storage.snapshot();
      b.stop();
      await expectQuestionOwed(w, files, `crash ${k}`);
    }
    expect(crashes).toBeGreaterThanOrEqual(2);
  }, 120_000);
});

describe('US-E15-04/AC11 a join with nothing to ask finishes by itself after an interruption', () => {
  it('local copy empty: the interrupted join completes silently (download), no question', async () => {
    const w = await world();
    const net = newNet();
    let n = 0;
    net.dropBefore = () => ++n === 3;
    const b = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, store: null, net }));
    await settle(30);
    await b.controller.family.join(w.code);
    b.clock.now += 120_000;
    b.controller.syncNow();
    await settle(250);
    expect(b.controller.getState().adoptionPending).toBe(false);
    expect(b.meta()?.adoption?.done).toBe(true);
    expect(b.stored()?.profile).not.toBeNull();
  });
});
