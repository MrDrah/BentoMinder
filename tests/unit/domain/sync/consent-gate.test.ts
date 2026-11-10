// US-E15-02 (domain parts: AC1 AC5 AC6 AC8): no data call before consent; per member; a new notice version pauses sync.
// The notice text and the screens (AC2 AC3 AC4 AC7) belong to slice D.
import { describe, expect, it } from 'vitest';
import { CLOUD_NOTICE_VERSION } from '../../../../src/domain/sync/config.ts';
import { consentOk } from '../../../../src/domain/sync/gate.ts';
import { syncCycle, statusFactsOf } from '../../../../src/domain/sync/cycle.ts';
import { emptySchedule } from '../../../../src/domain/sync/schedule.ts';
import { startMembership } from '../../../../src/domain/sync/membership.ts';
import { emptySyncMeta } from '../../../../src/domain/sync/meta.ts';
import { FakeBackend } from '../../../../src/domain/sync/fake-port.ts';
import { computeStatus } from '../../../../src/domain/sync/status.ts';
import { DEVICE_A, DEVICE_B, SEC, SimDevice, UID1, adopt, emptyStore, familyOfTwo, setDecision, storeWithData, testClock } from './helpers.ts';

describe('consent gate (ADR 016 section 6)', () => {
  it('US-E15-02/AC1 the notice version of this build is 1 and the gate needs a cached consent at least that', () => {
    expect(CLOUD_NOTICE_VERSION).toBe(1);
    expect(consentOk({ consent: null })).toBe(false);
    expect(consentOk({ consent: { version: 1, at: 'x' } })).toBe(true);
    expect(consentOk({ consent: { version: 1, at: 'x' } }, 2)).toBe(false);
    expect(consentOk({ consent: { version: 3, at: 'x' } }, 2)).toBe(true);
  });

  it('US-E15-02/AC1 no push and no pull of family data happens before consent is recorded (recording port)', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = new SimDevice(backend, UID1, storeWithData(DEVICE_A, UID1), clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    // the device has the family but no cached consent (for example the consent screen was left half way)
    a.store = startMembership({ store: a.store, meta: emptySyncMeta(), familyId, consentVersion: 1, nowMs: clock.now }).store;
    a.meta = { ...emptySyncMeta(), familyId };
    const r = await a.sync();
    expect(r.outcome).toEqual({ kind: 'paused-no-consent' });
    expect(a.fake.calls.filter((c) => c.op === 'push' || c.op === 'pull')).toEqual([]);
    expect(backend.families.get(familyId)?.records.size).toBe(0);
    expect(computeStatus(statusFactsOf(r, { online: true }))).toBe('paused-no-consent');
  });

  it('US-E15-02/AC8 a crash and resume between the consent and the first push never sends before the consent is saved, and sends once after', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = new SimDevice(backend, UID1, storeWithData(DEVICE_A, UID1), clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.meta = { ...emptySyncMeta(), familyId };
    expect((await a.sync()).outcome.kind).toBe('paused-no-consent');
    a.enter(familyId); // consent saved
    clock.advance(30 * SEC);
    const r = await a.sync();
    expect(r.outcome).toEqual({ kind: 'ok' });
    expect(r.pushed).toHaveLength(6);
  });

  it('US-E15-02/AC5 consent is per member: a second member who has not consented sends and reads nothing while the first keeps syncing', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    const c = new SimDevice(backend, 'test-uid-003', emptyStore(DEVICE_B, 'test-uid-003'), clock);
    await backend.portFor(UID1).createInvite(); // a fresh code
    c.meta = { ...emptySyncMeta(), familyId }; // not a member and no consent
    expect((await c.sync()).outcome.kind).toBe('paused-no-consent');
    expect(c.fake.calls).toEqual([]);
    clock.advance(30 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    expect((await a.sync()).outcome).toEqual({ kind: 'ok' });
  });

  it('US-E15-02/AC5 a new device of a member whose consent is already recorded in the cloud needs no second consent for the same version', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    const phone2 = new SimDevice(backend, UID1, emptyStore('c0000000-0000-4000-8000-00000000000c', UID1), clock);
    const m = await phone2.fake.readMembership();
    expect(m).toEqual({ status: 'member', familyId, consentVersion: 1 });
    // the cached consent comes from the membership read: version 1 is recorded, so the device starts with it
    phone2.enter(familyId, m.status === 'member' ? (m.consentVersion ?? 0) : 0);
    await adopt(phone2, 'use-family', clock);
    expect((await phone2.sync()).outcome).toEqual({ kind: 'ok' });
    expect(phone2.store.profile?.nickname).toBe(a.store.profile?.nickname);
  });

  it('US-E15-02/AC6 raising the notice version pauses sync for that member until they accept it; local data is untouched', async () => {
    const clock = testClock();
    const { a } = await familyOfTwo(clock);
    clock.advance(30 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    const before = a.store;
    const calls = a.fake.calls.length;
    const paused = await syncCycle({ port: a.port, uid: UID1, store: a.store, meta: a.meta, schedule: emptySchedule(), nowMs: clock.now, noticeVersion: 2 });
    expect(paused.outcome).toEqual({ kind: 'paused-no-consent' });
    expect(paused.store).toBe(before);
    expect(a.fake.calls).toHaveLength(calls);
    // accepted: the cached consent is raised and sync resumes
    const accepted = { ...a.meta, consent: { version: 2, at: 'x' } };
    const resumed = await syncCycle({ port: a.port, uid: UID1, store: a.store, meta: accepted, schedule: emptySchedule(), nowMs: clock.now, noticeVersion: 2 });
    expect(resumed.outcome).toEqual({ kind: 'ok' });
    expect(resumed.pushed).toEqual(['decision_2026-11-18']);
  });

  it('US-E15-02/AC1 the server side refuses data calls below its minimum notice version (defence in depth): the client maps it to paused-no-consent', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn, minConsentVersion: 2 });
    const a = new SimDevice(backend, UID1, storeWithData(DEVICE_A, UID1), clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.enter(familyId, 1);
    expect((await a.sync()).outcome).toEqual({ kind: 'paused-no-consent' });
    await a.fake.setConsent({ version: 2 });
    a.meta = { ...a.meta, consent: { version: 2, at: 'x' } };
    clock.advance(30 * SEC);
    expect((await a.sync()).outcome).toEqual({ kind: 'ok' });
  });
});
