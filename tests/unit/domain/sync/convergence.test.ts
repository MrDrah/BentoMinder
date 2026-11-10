// US-E15-07/AC10, AC11: any sequence of edits, syncs and offline periods on two or three devices ends in the same state,
// and every device's local copy is valid after every apply. Seeded random interleavings (no wall clock, no Math.random).
import { describe, expect, it } from 'vitest';
import { validateStore } from '../../../../src/domain/storage/repository.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { ownerMismatchesFor } from '../../../../src/domain/sync/owner.ts';
import { FakeBackend } from '../../../../src/domain/sync/fake-port.ts';
import { DEVICE_A, DEVICE_B, DEVICE_C, SEC, SimDevice, UID1, UID2, adopt, clearDecision, emptyStore, seeded, setDecision, setNote, setWeeklyTime, settle, storeWithData, syncedView, testClock, ts } from './helpers.ts';

const DATES = ['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18'];
const STATES = ['not-confirmed', 'school-lunch-planned', 'homemade-bento-planned'] as const;
const TIMES = ['14:00', '14:30', '15:00', '15:45', '16:00'];

async function simulate(seed: number, deviceCount: 2 | 3, steps: number): Promise<void> {
  const rnd = seeded(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
  const clock = testClock();
  const backend = new FakeBackend({ nowMs: clock.fn, pullPageSize: 4 });
  const a = new SimDevice(backend, UID1, storeWithData(DEVICE_A, UID1), clock);
  const { familyId } = await a.fake.createFamily({ version: 1 });
  a.enter(familyId);
  await a.sync();
  const devices: SimDevice[] = [a];
  const extra: [string, string][] = [[UID2, DEVICE_B], [UID1, DEVICE_C]];
  for (const [uid, deviceId] of extra.slice(0, deviceCount - 1)) {
    const d = new SimDevice(backend, uid, emptyStore(deviceId, uid), clock);
    if (uid !== UID1) await d.fake.redeemInvite((await a.fake.createInvite()).code, { version: 1 });
    d.enter(familyId);
    await adopt(d, 'use-family', clock);
    devices.push(d);
  }

  const check = (d: SimDevice) => {
    expect(validateStore(d.store).ok, `valid after apply (seed ${seed})`).toBe(true);
    expect(ownerMismatchesFor(d.store, [d.uid, familyId]), `owner (seed ${seed})`).toEqual([]);
  };

  for (let i = 0; i < steps; i++) {
    clock.advance(Math.floor(rnd() * 4) * 5 * SEC); // 0, 5, 10 or 15 s: equal stamps across devices happen
    const d = pick(devices);
    const roll = rnd();
    if (roll < 0.45) {
      const at = clock.now;
      const kind = Math.floor(rnd() * 7);
      d.edit((s: BentoMinderStore) => {
        switch (kind) {
          case 0:
          case 1:
            return setDecision(s, pick(DATES), pick(STATES), at);
          case 2:
            return clearDecision(s, pick(DATES), at);
          case 3:
            return setWeeklyTime(s, pick(TIMES), at);
          case 4:
            return s.profile === null ? s : setNote(s, `メモ${Math.floor(rnd() * 5)}`, at);
          case 5:
            return { ...s, aiUsage: { ...s.aiUsage, '2026-11': (s.aiUsage['2026-11'] ?? 0) + 1 } };
          default:
            return s.profile === null
              ? { ...s, profile: { ...(storeWithData(d.store.deviceId, d.meta.familyId ?? '').profile as NonNullable<BentoMinderStore['profile']>), createdAt: ts(at), updatedAt: ts(at) } }
              : { ...s, profile: null };
        }
      }, at);
    } else if (roll < 0.8) {
      if (!d.fake.offline) {
        await d.sync();
        check(d);
      }
    } else {
      d.fake.offline = !d.fake.offline;
    }
  }
  for (const d of devices) d.fake.offline = false;
  await settle(devices, clock, 20);
  for (const d of devices) check(d);
  const first = devices[0];
  if (first === undefined) throw new Error('no devices');
  for (const d of devices.slice(1)) expect(syncedView(d.store), `converged (seed ${seed})`).toEqual(syncedView(first.store));
  for (const d of devices) expect((await d.sync()).pendingCount, `nothing pending (seed ${seed})`).toBe(0);
}

describe('convergence over random interleavings (US-E15-07/AC11)', () => {
  it('US-E15-07/AC11 two devices: 60 seeds of edit / sync / offline interleavings converge to one state', async () => {
    for (let seed = 1; seed <= 60; seed++) await simulate(seed, 2, 40);
  });

  it('US-E15-07/AC11 three devices (two of them the same account): 40 seeds converge to one state', async () => {
    for (let seed = 1001; seed <= 1040; seed++) await simulate(seed, 3, 50);
  });

  it('US-E15-07/AC10 the merged result is valid after every apply (checked in every step of every seed above), including a long run', async () => {
    await simulate(424242, 3, 300);
  });
});
