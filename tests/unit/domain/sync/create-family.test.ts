// US-E15-01 (domain parts: AC3 AC4 AC5 AC6 AC8) with a fake port. UI parts (AC1 AC2 AC7) belong to slice D.
import { describe, expect, it } from 'vitest';
import { startMembership } from '../../../../src/domain/sync/membership.ts';
import { emptySyncMeta } from '../../../../src/domain/sync/meta.ts';
import { FakeBackend } from '../../../../src/domain/sync/fake-port.ts';
import { SyncPortError } from '../../../../src/domain/sync/types.ts';
import { validateStore } from '../../../../src/domain/storage/repository.ts';
import { DEVICE_A, SEC, SimDevice, UID1, UID2, UID3, emptyStore, setDecision, storeWithData, testClock } from './helpers.ts';

describe('create the family and upload this device data (US-E15-01)', () => {
  it('US-E15-01/AC3 with data: every synced record is uploaded once, timestamps unchanged, ownerId = the family id; the local copy stays the working copy', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const store = storeWithData(DEVICE_A, UID1);
    const a = new SimDevice(backend, UID1, store, clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.enter(familyId);
    const r = await a.sync();
    expect(r.outcome).toEqual({ kind: 'ok' });
    expect(r.pushed.sort()).toEqual(['aiUsage_2026-11', 'decision_2026-11-04', 'decision_2026-11-05', 'menu_2026-11', 'override_2026-11-05', 'profile_profile']);
    const records = backend.families.get(familyId)?.records;
    for (const e of records?.values() ?? []) {
      if (e.kind === 'aiUsage') continue;
      expect(JSON.parse(e.payloadJson ?? '{}').ownerId).toBe(familyId);
      expect(e.updatedBy).toBe(UID1);
      expect(e.deviceId).toBe(DEVICE_A);
    }
    expect(records?.get('profile_profile')?.updatedAt).toBe(store.profile?.updatedAt);
    expect(records?.get('decision_2026-11-04')?.updatedAt).toBe('2026-11-01T10:12:00+09:00');
    expect(a.store.profile?.ownerId).toBe(familyId);
    expect(a.store.deviceId).toBe(DEVICE_A);
    expect(validateStore(a.store).ok).toBe(true);
  });

  it('US-E15-01/AC3 no record is uploaded twice: the next cycle sends nothing and the server sequence does not move', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = new SimDevice(backend, UID1, storeWithData(DEVICE_A, UID1), clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.enter(familyId);
    await a.sync();
    const seq = backend.families.get(familyId)?.seq;
    clock.advance(30 * SEC);
    const again = await a.sync();
    expect(again.pushed).toEqual([]);
    expect(a.fake.calls.filter((c) => c.op === 'push')).toHaveLength(1);
    expect(backend.families.get(familyId)?.seq).toBe(seq);
  });

  it('US-E15-01/AC4 with an empty local copy the family exists with no records; the profile created later is uploaded by the normal sync', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = new SimDevice(backend, UID1, emptyStore(DEVICE_A, UID1), clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.enter(familyId);
    const r = await a.sync();
    expect(r.pushed).toEqual([]);
    expect(backend.families.get(familyId)?.records.size).toBe(0);
    clock.advance(30 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    expect((await a.sync()).pushed).toEqual(['decision_2026-11-18']);
    expect(backend.families.get(familyId)?.records.size).toBe(1);
  });

  it('US-E15-01/AC5 a failed creation changes nothing: no family, no account entry, and the pure start of membership never touches its input', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = new SimDevice(backend, UID1, storeWithData(DEVICE_A, UID1), clock);
    a.fake.offline = true;
    await expect(a.fake.createFamily({ version: 1 })).rejects.toMatchObject({ kind: 'offline' });
    expect(backend.families.size).toBe(0);
    expect(backend.accounts.size).toBe(0);
    const before = JSON.stringify(a.store);
    const started = startMembership({ store: a.store, meta: emptySyncMeta(), familyId: 'fam-test-001', consentVersion: 1, nowMs: clock.now });
    expect(JSON.stringify(a.store)).toBe(before);
    expect(started.store.profile?.ownerId).toBe('fam-test-001');
    expect(started.meta).toMatchObject({ familyId: 'fam-test-001', cursor: 0, baselines: {}, consent: { version: 1 } });
  });

  it('US-E15-01/AC5 a crash between creating the family and the first upload resumes: everything is uploaded once at the next open', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = new SimDevice(backend, UID1, storeWithData(DEVICE_A, UID1), clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.enter(familyId);
    a.fake.script.push(new SyncPortError('temporary'));
    expect((await a.sync()).outcome).toEqual({ kind: 'retry' });
    expect(backend.families.get(familyId)?.records.size).toBe(0);
    // the app is closed and reopened: the saved metadata has the family id and no baselines, so everything is pending
    clock.advance(30 * SEC);
    const resumed = await a.sync();
    expect(resumed.pushed).toHaveLength(6);
    expect(backend.families.get(familyId)?.seq).toBe(1);
  });

  it('US-E15-01/AC6 an account that is already in a family cannot create another (one family per account)', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = backend.portFor(UID1);
    await a.createFamily({ version: 1 });
    await expect(a.createFamily({ version: 1 })).rejects.toMatchObject({ kind: 'refused', detail: 'already-in-family' });
    expect(backend.families.size).toBe(1);
  });

  it('US-E15-01/AC8 a double tap creates one family only', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = backend.portFor(UID1);
    const results = await Promise.allSettled([a.createFamily({ version: 1 }), a.createFamily({ version: 1 })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(backend.families.size).toBe(1);
  });

  it('US-E15-04/AC9 an account that is a member of another family cannot join with a code; nothing changes', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = backend.portFor(UID1);
    await a.createFamily({ version: 1 });
    const code = (await a.createInvite()).code;
    const b = backend.portFor(UID2);
    await b.createFamily({ version: 1 });
    await expect(b.redeemInvite(code, { version: 1 })).rejects.toMatchObject({ detail: 'already-in-family' });
    expect(backend.families.size).toBe(2);
    expect([...backend.families.values()].every((f) => f.members.size === 1)).toBe(true);
  });

  it('US-E15-04/AC2 AC10 US-E15-03 the code is accepted in any letter case with spaces or hyphens; wrong, used and full are refused without changing anything', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = backend.portFor(UID1);
    const { familyId } = await a.createFamily({ version: 1 });
    const { code } = await a.createInvite();
    expect(code).toBe('ABCD234567');
    await expect(backend.portFor(UID3).redeemInvite('WRONGCODE9', { version: 1 })).rejects.toMatchObject({ kind: 'refused' });
    await expect(backend.portFor(UID2).redeemInvite(' abcd-2345 67 ', { version: 1 })).resolves.toEqual({ familyId });
    await expect(backend.portFor(UID3).redeemInvite(code, { version: 1 })).rejects.toMatchObject({ kind: 'refused' });
    expect(backend.families.get(familyId)?.members.size).toBe(2);
  });
});
