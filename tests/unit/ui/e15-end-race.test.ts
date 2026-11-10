// E15 slice E: a sync cycle that is mid-flight when the membership ends (leave, delete) must not write its own metadata or
// store over the result (US-E15-08/AC2, AC6). Driven through the real controller over a FakeBackend.
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeBackend } from '../../../src/domain/sync/fake-port.ts';
import { DEVICE_B, NOW_MS, UID1, UID2, driftMs, makeDevice, type FamilyDevice } from './family-harness.tsx';
import { setNote } from '../domain/sync/helpers.ts';

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend({ nowMs: () => NOW_MS });
  driftMs.value = 0;
});

const settle = async (ms = 50) => {
  await new Promise((r) => setTimeout(r, ms));
};

/** The next pull answers from the server, then waits: the cycle is "mid-flight" with an answer it has not used yet. */
function holdNextPull(d: FamilyDevice): { entered: Promise<void>; release: () => void } {
  const original = d.port.pull.bind(d.port);
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const enteredP = new Promise<void>((r) => (entered = r));
  let held = false;
  d.port.pull = async (cursor: number) => {
    const out = await original(cursor);
    if (held) return out;
    held = true;
    entered();
    await gate;
    return out;
  };
  return { entered: enteredP, release };
}

async function pair() {
  const a = makeDevice({ backend, uid: UID1 });
  a.controller.start();
  await settle();
  await a.controller.family.create();
  await settle(150);
  const code = (await a.controller.family.createInvite()).code;
  const b = makeDevice({ backend, uid: UID2, store: null, deviceId: DEVICE_B });
  b.controller.start();
  await settle();
  await b.controller.family.join(code);
  await settle(150);
  return { a, b };
}

describe('US-E15-08 a cycle in flight when the membership ends', () => {
  it('US-E15-08/AC2 leaving while a cycle is mid-flight: the cycle does not bring the family id back into the metadata', async () => {
    const { a, b } = await pair();
    const hold = holdNextPull(a);
    a.controller.syncNow();
    await hold.entered;
    await a.controller.family.leave(false);
    hold.release();
    await settle(150);
    expect(a.meta().familyId).toBeNull();
    expect(Object.keys(a.meta().baselines)).toHaveLength(0);
    expect(a.controller.getState().membership).not.toBe('member');
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-08/AC2 leaving while a cycle holds downloaded changes: the stand-alone copy keeps the uid as owner', async () => {
    const { a, b } = await pair();
    const before = b.stored();
    if (before === null) throw new Error('no store');
    const edited = setNote(before, 'ほかの端末で変更', NOW_MS - 1000);
    await b.repository.save(edited, { force: true });
    await b.controller.localChanged(edited);
    driftMs.value += 40_000; // past the write-coalescing window
    b.controller.syncNow();
    await settle(100);
    const hold = holdNextPull(a);
    a.controller.syncNow();
    await hold.entered;
    await a.controller.family.leave(false);
    hold.release();
    await settle(150);
    expect(a.stored()?.profile?.note).not.toBe('ほかの端末で変更'); // the held download was dropped, not written over the result
    expect(a.stored()?.profile?.ownerId).toBe(UID1);
    expect(a.stored()?.settings.ownerId).toBe(UID1);
    expect(a.meta().familyId).toBeNull();
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-08/AC6 deleting the family while a cycle is mid-flight: nothing is re-uploaded and the device stays stand-alone', async () => {
    const { a, b } = await pair();
    const hold = holdNextPull(a);
    a.controller.syncNow();
    await hold.entered;
    await a.controller.family.deleteFamily();
    hold.release();
    await settle(150);
    expect(a.meta().familyId).toBeNull();
    expect(backend.families.size).toBe(0);
    a.controller.stop();
    b.controller.stop();
  });
});
