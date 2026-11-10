// QA E15: crash injection. For every write the device makes to its storage while it joins, adopts, creates, leaves or deletes, the process
// "dies" at exactly that write (N = 1, 2, 3 ... until the operation finishes without a crash), the device is restarted on what was on disk, and
// the invariants must hold: the local copy is valid, nothing of the device's data is lost (store or safety copy), the account is never a member
// with no way to finish (US-E15-04/AC11), ownerId is consistent (US-E15-11/AC3), the cloud lost nothing. Also network cuts at every request.
import { afterEach, describe, expect, it } from 'vitest';
import { validateStore } from '../../../../src/domain/storage/repository.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { ownerMismatchesFor } from '../../../../src/domain/sync/owner.ts';
import { DEVICE_A, DEVICE_B, UID1, UID2, storeWithData } from '../../domain/sync/helpers.ts';
import { makeCtl, settle, type Ctl } from './ctl.ts';
import { makeRig, type Rig } from './qa-rig.ts';
import { newNet, type Net } from './bridge.ts';

const open: Ctl[] = [];
afterEach(() => {
  for (const c of open.splice(0)) c.stop();
});
const track = (c: Ctl): Ctl => {
  open.push(c);
  return c;
};

const ORIG = 'ORIGINAL-DEVICE-B-NOTE';
const bData = (): BentoMinderStore => {
  const s = storeWithData(DEVICE_B, UID2);
  return { ...s, profile: { ...s.profile!, nickname: 'ORIGINAL-B', note: ORIG } };
};

interface World {
  rig: Rig;
  a: Ctl;
  familyId: string;
  code: string;
  recordCountBefore: number;
}
async function world(): Promise<World> {
  const rig = makeRig();
  const a = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A }));
  await settle(20);
  await a.controller.family.create();
  await settle(100);
  const familyId = a.meta()!.familyId!;
  const code = (await a.controller.family.createInvite()).code;
  return { rig, a, familyId, code, recordCountBefore: rig.db.paths(`families/${familyId}/records`).length };
}

/** After the restart: let the device do what the app does (start, answer a pending question by default, acknowledge an end). */
async function recover(w: World, files: Record<string, string>, uid: string, deviceId: string): Promise<Ctl> {
  const c = track(makeCtl({ rig: w.rig, uid, deviceId, files }));
  c.clock.now += 120_000;
  await settle(200);
  for (let i = 0; i < 3; i++) {
    const st = c.controller.getState();
    try {
      if (st.adoptionPending) await c.controller.family.completeAdoption('use-family');
      else if (st.endedReason !== null) await c.controller.family.acknowledgeEnded();
    } catch {
      /* a refusal (e.g. membership ended while the question was open: defect E15-D04, pinned elsewhere) */
    }
    c.clock.now += 60_000;
    c.controller.syncNow();
    await settle(150);
  }
  return c;
}

function invariants(w: World, c: Ctl, uid: string, label: string, strictJoin = true): void {
  const stored = c.stored();
  const raw = JSON.stringify(c.storage.snapshot());
  // I1 the local copy is valid
  if (stored !== null) expect(validateStore(stored).ok, `${label}: valid local copy`).toBe(true);
  // I2 nothing of the device's own data is lost: still in the store, or in the safety copy, or in the cloud
  const cloud = JSON.stringify([...w.rig.db.docs.entries()]);
  expect(raw.includes(ORIG) || cloud.includes(ORIG), `${label}: original data survives somewhere`).toBe(true);
  // I3 cloud membership and the device agree, and a member has finished joining
  const acct = w.rig.db.get(`accounts/${uid}`);
  const meta = c.meta();
  if (acct?.['status'] === 'member') {
    expect(meta?.familyId, `${label}: member in the cloud, so the device knows its family`).toBe(acct['familyId']);
    if (strictJoin) expect(meta?.adoption?.done, `${label}: join finished`).toBe(true);
    if (stored !== null) expect(ownerMismatchesFor(stored, [uid, String(acct['familyId'])]), `${label}: ownerId`).toEqual([]);
  } else {
    expect(meta?.familyId ?? null, `${label}: not a member, so no family id on the device`).toBeNull();
    if (stored !== null) expect(ownerMismatchesFor(stored, [uid]), `${label}: ownerId is the uid`).toEqual([]);
  }
  // I5 a crash on a device never deletes the family's data
  expect(w.rig.db.paths(`families/${w.familyId}/records`).length, `${label}: cloud keeps its records`).toBeGreaterThanOrEqual(w.recordCountBefore);
}

async function sweepStorage(name: string, run: (w: World, b: Ctl, arm: () => void) => Promise<void>, opts: { limit?: number; late?: boolean } = {}): Promise<number> {
  let crashed = 0;
  for (let n = 1; n <= (opts.limit ?? 40); n++) {
    const w = await world();
    const b = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, store: bData(), crashAt: opts.late === true ? Infinity : n }));
    await settle(20);
    try {
      await run(w, b, () => {
        b.storage.crashAt = b.storage.ops + n;
      });
    } catch {
      /* the crash, or a refusal that follows it */
    }
    await settle(60);
    const files = b.storage.snapshot();
    const didCrash = b.storage.crashed;
    b.stop();
    if (!didCrash) {
      // no crash at this point: the operation needs fewer writes than N; the sweep is complete
      invariants(w, b, UID2, `${name} complete`);
      return crashed;
    }
    crashed += 1;
    const back = await recover(w, files, UID2, DEVICE_B);
    invariants(w, back, UID2, `${name} crash at write ${n}`);
  }
  throw new Error(`${name}: the operation still needed writes after ${opts.limit ?? 40}`);
}

describe('US-E15-04/AC11 US-E15-11/AC3 crash at every storage write', () => {
  it('join with data on both sides, then "use family": 0 invariant violations at every crash point', async () => {
    const points = await sweepStorage('join+use-family', async (w, b) => {
      const r = await b.controller.family.join(w.code);
      if (r.kind === 'ask') await b.controller.family.completeAdoption('use-family');
    });
    expect(points).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it('join with data on both sides, then "add this device\'s data": 0 invariant violations at every crash point', async () => {
    const points = await sweepStorage('join+add-device', async (w, b) => {
      const r = await b.controller.family.join(w.code);
      if (r.kind === 'ask') await b.controller.family.completeAdoption('add-device');
    });
    expect(points).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it('create a family with local data: 0 invariant violations at every crash point', async () => {
    let crashed = 0;
    for (let n = 1; n <= 30; n++) {
      const rig = makeRig();
      const b = track(makeCtl({ rig, uid: UID2, deviceId: DEVICE_B, store: bData(), crashAt: n }));
      await settle(20);
      try {
        await b.controller.family.create();
        await settle(150);
      } catch {
        /* crash */
      }
      const files = b.storage.snapshot();
      const did = b.storage.crashed;
      b.stop();
      const w: World = { rig, a: b, familyId: '', code: '', recordCountBefore: 0 };
      if (!did) {
        invariants({ ...w, familyId: b.meta()!.familyId! }, b, UID2, 'create complete');
        break;
      }
      crashed += 1;
      const back = await recover(w, files, UID2, DEVICE_B);
      const fam = back.meta()?.familyId ?? '';
      invariants({ ...w, familyId: fam }, back, UID2, `create crash at write ${n}`);
      // the family that exists got all of the device's data (nothing duplicated: one record per key)
      if (fam !== '') {
        expect(rig.db.paths(`families/${fam}/records`).length, `create crash at ${n}: data uploaded after recovery`).toBeGreaterThanOrEqual(5);
      }
    }
    expect(crashed).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it('leave (cloud first, then local): 0 invariant violations at every crash point', async () => {
    const points = await sweepStorage(
      'leave',
      async (w, b, arm) => {
        await b.controller.family.join(w.code);
        await b.controller.family.completeAdoption('use-family');
        await settle(150);
        arm(); // only the writes of the leave itself can crash from here
        await b.controller.family.leave(false);
      },
      { late: true },
    );
    expect(points).toBeGreaterThanOrEqual(1);
  }, 120_000);
});

describe('US-E15-04/AC11 US-E15-01/AC5 network cut at every request', () => {
  it('join then adoption with the network cut (request lost, or reply lost after the server committed) at each request number: the device recovers and finishes', async () => {
    let cut = 0;
    for (const mode of ['before', 'after'] as const) {
      for (let k = 1; k <= 10; k++) {
        const w = await world();
        const net: Net = newNet();
        let n = 0;
        const hit = () => ++n === k;
        if (mode === 'before') net.dropBefore = hit;
        else net.dropAfter = hit;
        const b = track(makeCtl({ rig: w.rig, uid: UID2, deviceId: DEVICE_B, store: bData(), net }));
        await settle(20);
        try {
          const r = await b.controller.family.join(w.code);
          if (r.kind === 'ask') await b.controller.family.completeAdoption('use-family');
        } catch {
          /* cut */
        }
        await settle(60);
        if (n >= k) cut += 1;
        const files = b.storage.snapshot();
        b.stop();
        // restart with a reliable network; the invite may or may not have been consumed
        const back = await recover(w, files, UID2, DEVICE_B);
        invariants(w, back, UID2, `network ${mode} request ${k}`, false); // 'join finished' is not asserted here: a cut download skips the question (defect E15-D03, pinned in US-E15-04-join-interrupted)
        const acct = w.rig.db.get(`accounts/${UID2}`);
        if (acct?.['status'] !== 'member' && back.meta()?.familyId == null) {
          // the join never happened (cut before redeem): joining again must work with the same code
          const again = await back.controller.family.join(w.code);
          expect(['done', 'ask']).toContain(again.kind);
        }
      }
    }
    expect(cut).toBeGreaterThan(8);
  }, 180_000);
});
