// US-E15-05 (AC1 AC3 AC4 AC5; contract 14.8): rule new-device-no-onboarding-before-family-known.
import { describe, expect, it } from 'vitest';
import { NEW_DEVICE_LOAD_TIMEOUT_MS, startGate, type StartFacts } from '../../../../src/domain/sync/gate.ts';
import { syncCycle } from '../../../../src/domain/sync/cycle.ts';
import { emptySchedule } from '../../../../src/domain/sync/schedule.ts';
import { SyncPortError } from '../../../../src/domain/sync/types.ts';
import { DEVICE_B, SimDevice, UID2, emptyStore, familyOfTwo, testClock, syncedView } from './helpers.ts';

const f = (x: Partial<StartFacts>): StartFacts => ({ hasLocalCopy: false, membership: 'unknown', familyDataLoaded: false, readFailed: false, elapsedMs: 0, ...x });

describe('first sign-in on a new device (contract 14.8)', () => {
  it('US-E15-05/AC1 new-device-no-onboarding-before-family-known: while the membership is unknown there is a loading state, never onboarding', () => {
    expect(startGate(f({ elapsedMs: 0 }))).toBe('loading');
    expect(startGate(f({ elapsedMs: 14_999 }))).toBe('loading');
  });

  it('US-E15-05/AC1 a member waits for the family data, then the calendar shows it (never an empty calendar flash)', () => {
    expect(startGate(f({ membership: 'member', familyDataLoaded: false, elapsedMs: 2000 }))).toBe('loading');
    expect(startGate(f({ membership: 'member', familyDataLoaded: true }))).toBe('calendar-from-family');
  });

  it('US-E15-05/AC3 a failed or slow read (more than 15 seconds) gives the retry screen, not onboarding', () => {
    expect(NEW_DEVICE_LOAD_TIMEOUT_MS).toBe(15_000);
    expect(startGate(f({ readFailed: true }))).toBe('retry');
    expect(startGate(f({ elapsedMs: 15_001 }))).toBe('retry');
    expect(startGate(f({ elapsedMs: 15_000 }))).toBe('loading');
    expect(startGate(f({ membership: 'member', readFailed: true }))).toBe('retry');
    expect(startGate(f({ membership: 'member', elapsedMs: 20_000 }))).toBe('retry');
  });

  it('US-E15-05/AC3 the retry state never turns into a local-only start (no clashing local profile can be created)', () => {
    for (const elapsedMs of [0, 5_000, 15_001, 600_000]) {
      for (const readFailed of [false, true]) {
        expect(startGate(f({ elapsedMs, readFailed }))).not.toBe('normal-start');
        expect(startGate(f({ membership: 'member', elapsedMs, readFailed }))).not.toBe('normal-start');
      }
    }
  });

  it('US-E15-05/AC4 a device with a local copy opens at once from it, whatever the network or membership state is', () => {
    for (const membership of ['unknown', 'none', 'member', 'ended'] as const) {
      expect(startGate(f({ hasLocalCopy: true, membership, readFailed: true, elapsedMs: 60_000 }))).toBe('calendar-from-local');
    }
  });

  it('US-E15-05/AC5 an account in no family and a device with no copy starts normally (onboarding); a device with its own old data stays local only', () => {
    expect(startGate(f({ membership: 'none' }))).toBe('normal-start');
    expect(startGate(f({ membership: 'ended' }))).toBe('normal-start');
    expect(startGate(f({ hasLocalCopy: true, membership: 'none' }))).toBe('calendar-from-local');
  });
});

describe('a new device of a member, end to end over the fake port (US-E15-05/AC1, AC3)', () => {
  it('US-E15-05/AC1 the device with no copy ends up with the family data after one cycle', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    const phone = new SimDevice(backend, UID2, emptyStore(DEVICE_B, UID2), clock).enter(familyId);
    const before = startGate(f({ membership: 'member', familyDataLoaded: false, elapsedMs: 100 }));
    expect(before).toBe('loading');
    const r = await phone.sync();
    expect(r.outcome).toEqual({ kind: 'ok' });
    expect(startGate(f({ membership: 'member', familyDataLoaded: r.pulled > 0 }))).toBe('calendar-from-family');
    expect(phone.store.decisions['2026-11-04']).toBeDefined();
    expect(syncedView(phone.store)).toEqual(syncedView(a.store));
  });

  it('US-E15-05/AC3 when the read fails the device keeps its empty store untouched and the gate says retry', async () => {
    const clock = testClock();
    const { backend, familyId } = await familyOfTwo(clock);
    const phone = new SimDevice(backend, UID2, emptyStore(DEVICE_B, UID2), clock).enter(familyId);
    phone.fake.script.push(new SyncPortError('temporary'));
    const before = phone.store;
    const r = await syncCycle({ port: phone.port, uid: UID2, store: phone.store, meta: phone.meta, schedule: emptySchedule(), nowMs: clock.now });
    expect(r.outcome).toEqual({ kind: 'retry' });
    expect(r.store).toBe(before);
    expect(startGate(f({ membership: 'member', readFailed: r.outcome.kind === 'retry' }))).toBe('retry');
  });
});
