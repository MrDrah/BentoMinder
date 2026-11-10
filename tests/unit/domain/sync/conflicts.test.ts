// US-E15-07 through the cycle: two simulated devices, offline edits, conflicts, tombstones, the long-offline
// device, retention and the lost-edit note (AC8).
import { describe, expect, it } from 'vitest';
import { validateStore } from '../../../../src/domain/storage/repository.ts';
import type { SyncPort } from '../../../../src/domain/sync/types.ts';
import { DAY, SEC, clearDecision, familyOfTwo, setDecision, setNote, setWeeklyTime, settle, syncedView, testClock } from './helpers.ts';

const D = '2026-11-18';

describe('last edit wins per record (US-E15-07/AC1, AC2)', () => {
  it('US-E15-07/AC1 A at 10:00:00 and B at 10:00:05 while both are offline: both devices end with B', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    a.fake.offline = true;
    b.fake.offline = true;
    const t = clock.now + 60 * SEC;
    a.edit((s) => setDecision(s, D, 'not-confirmed', t));
    b.edit((s) => setDecision(s, D, 'school-lunch-planned', t + 5 * SEC));
    clock.advance(120 * SEC);
    a.fake.offline = false;
    b.fake.offline = false;
    await settle([a, b], clock);
    expect(a.store.decisions[D]?.state).toBe('school-lunch-planned');
    expect(b.store.decisions[D]?.state).toBe('school-lunch-planned');
    expect(syncedView(a.store)).toEqual(syncedView(b.store));
  });

  it('US-E15-07/AC1 the order the devices come online in does not change the result', async () => {
    for (const first of ['a', 'b'] as const) {
      const clock = testClock();
      const { a, b } = await familyOfTwo(clock);
      const t = clock.now + 60 * SEC;
      a.edit((s) => setDecision(s, D, 'not-confirmed', t));
      b.edit((s) => setDecision(s, D, 'school-lunch-planned', t + 5 * SEC));
      clock.advance(120 * SEC);
      await (first === 'a' ? [a, b] : [b, a]).reduce(async (p, d) => (await p, void (await d.sync())), Promise.resolve());
      await settle([a, b], clock);
      expect(a.store.decisions[D]?.state).toBe('school-lunch-planned');
      expect(b.store.decisions[D]?.state).toBe('school-lunch-planned');
    }
  });

  it('US-E15-07/AC2 the same updatedAt: the greater deviceId wins on both devices (B before A in string order)', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    const t = clock.now + 60 * SEC;
    a.edit((s) => setDecision(s, D, 'not-confirmed', t));
    b.edit((s) => setDecision(s, D, 'school-lunch-planned', t));
    clock.advance(120 * SEC);
    await settle([a, b], clock);
    expect(a.store.deviceId < b.store.deviceId).toBe(true);
    expect(a.store.decisions[D]?.state).toBe('school-lunch-planned');
    expect(b.store.decisions[D]?.state).toBe('school-lunch-planned');
    expect(b.lost).toEqual([]);
  });
});

describe('deleting is a tombstone (US-E15-07/AC4, AC5)', () => {
  it('US-E15-07/AC4 clearing a plan syncs as a tombstone and the other device removes the record', async () => {
    const clock = testClock();
    const { a, b, backend, familyId } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    a.edit((s) => clearDecision(s, '2026-11-04', clock.now));
    await settle([a, b], clock);
    expect(b.store.decisions['2026-11-04']).toBeUndefined();
    const stored = backend.families.get(familyId)?.records.get('decision_2026-11-04');
    expect(stored?.deletedAt).toBeDefined();
    expect(stored?.payloadJson).toBeUndefined();
    expect(validateStore(b.store).ok).toBe(true);
  });

  it('US-E15-07/AC4 removing the profile syncs as a tombstone', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    a.edit((s) => ({ ...s, profile: null }));
    await settle([a, b], clock);
    expect(b.store.profile).toBeNull();
  });

  it('US-E15-07/AC4 a record created by another device before the delete is not deleted by it', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    clock.advance(60 * SEC);
    // B creates the decision, then A (who has never seen it) deletes a different decision; B's stays
    b.edit((s) => setDecision(s, D, 'not-confirmed', clock.now));
    a.edit((s) => clearDecision(s, '2026-11-04', clock.now + 10 * SEC), clock.now + 10 * SEC);
    await settle([a, b], clock);
    expect(a.store.decisions[D]?.state).toBe('not-confirmed');
    expect(b.store.decisions[D]?.state).toBe('not-confirmed');
    expect(b.store.decisions['2026-11-04']).toBeUndefined();
  });

  it('US-E15-07/AC5 an edit at 10:00:30 on a device that was offline beats a tombstone from 10:00:00: the record exists again everywhere', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    const t = clock.now + 60 * SEC;
    a.edit((s) => clearDecision(s, '2026-11-04', t), t);
    const bd = b.store.decisions['2026-11-04'];
    if (bd === undefined) throw new Error('decision');
    b.edit((s) => setDecision(s, '2026-11-04', 'school-lunch-planned', t + 30 * SEC, { createdAt: bd.createdAt }));
    clock.advance(120 * SEC);
    await settle([a, b], clock);
    expect(a.store.decisions['2026-11-04']?.state).toBe('school-lunch-planned');
    expect(b.store.decisions['2026-11-04']?.state).toBe('school-lunch-planned');
  });

  it('US-E15-07/AC5 with the times swapped the delete wins on both devices', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    const t = clock.now + 60 * SEC;
    const bd = b.store.decisions['2026-11-04'];
    if (bd === undefined) throw new Error('decision');
    b.edit((s) => setDecision(s, '2026-11-04', 'school-lunch-planned', t, { createdAt: bd.createdAt }));
    a.edit((s) => clearDecision(s, '2026-11-04', t + 30 * SEC), t + 30 * SEC);
    clock.advance(120 * SEC);
    await settle([a, b], clock);
    expect(a.store.decisions['2026-11-04']).toBeUndefined();
    expect(b.store.decisions['2026-11-04']).toBeUndefined();
  });

  it('US-E15-07/AC5 a record removed and created again on the same device inside one second still resolves to the newest content', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    clock.advance(30 * SEC);
    a.edit((s) => clearDecision(s, '2026-11-04', clock.now));
    await a.sync();
    a.edit((s) => setDecision(s, '2026-11-04', 'not-confirmed', clock.now));
    await settle([a, b], clock);
    expect(b.store.decisions['2026-11-04']?.state).toBe('not-confirmed');
    expect(a.store.decisions['2026-11-04']?.state).toBe('not-confirmed');
  });
});

describe('the lost edit is noted once (US-E15-07/AC8)', () => {
  it('US-E15-07/AC8 a pending local edit that loses to a newer remote edit is reported once with kind and key', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    const t = clock.now + 60 * SEC;
    a.edit((s) => setDecision(s, D, 'not-confirmed', t));
    b.edit((s) => setDecision(s, D, 'school-lunch-planned', t + 5 * SEC));
    clock.advance(120 * SEC);
    await b.sync();
    const r = await a.sync();
    expect(r.lostEdits).toEqual([{ kind: 'decision', key: D }]);
    clock.advance(30 * SEC);
    expect((await a.sync()).lostEdits).toEqual([]);
    expect(a.lost).toHaveLength(1);
  });

  it('US-E15-07/AC8 the winner is not told it lost', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    const t = clock.now + 60 * SEC;
    a.edit((s) => setDecision(s, D, 'not-confirmed', t + 5 * SEC));
    b.edit((s) => setDecision(s, D, 'school-lunch-planned', t));
    clock.advance(120 * SEC);
    await b.sync();
    await a.sync();
    await settle([a, b], clock);
    expect(a.lost).toEqual([]);
    expect(b.lost).toEqual([]);
    expect(b.store.decisions[D]?.state).toBe('not-confirmed');
  });

  it('US-E15-07/AC8 an edit that loses the race at push time (the server answers with a newer winner) is also noted and replaced', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    const t = clock.now + 60 * SEC;
    a.edit((s) => setDecision(s, D, 'not-confirmed', t));
    clock.advance(120 * SEC);
    const real = a.port;
    const racing = Object.create(real) as SyncPort;
    racing.pull = async (cursor) => {
      const page = await real.pull(cursor);
      // between A's pull and A's push, B's newer edit reaches the cloud
      b.edit((s) => setDecision(s, D, 'school-lunch-planned', t + 5 * SEC));
      await b.sync();
      return page;
    };
    a.port = racing;
    const r = await a.sync();
    expect(r.lostEdits).toEqual([{ kind: 'decision', key: D }]);
    expect(a.store.decisions[D]?.state).toBe('school-lunch-planned');
    a.port = real;
    await settle([a, b], clock);
    expect(syncedView(a.store)).toEqual(syncedView(b.store));
  });
});

describe('the long-offline device (US-E15-07/AC6)', () => {
  async function scenario(offlineDays: number) {
    const clock = testClock();
    const ctx = await familyOfTwo(clock);
    const { a, b, backend, familyId } = ctx;
    // B deletes a decision and A, still online, gets the tombstone only later: A goes offline first.
    clock.advance(30 * SEC);
    a.fake.offline = true;
    b.edit((s) => clearDecision(s, '2026-11-04', clock.now));
    await b.sync();
    const deletedAt = clock.now;
    clock.advance(offlineDays * DAY);
    // the cloud purges tombstones older than 90 days
    backend.purgeTombstones(familyId, clock.now - 90 * DAY);
    a.fake.offline = false;
    return { ...ctx, clock, deletedAt };
  }

  it('US-E15-07/AC6 day 90: the tombstone is still in the cloud and the normal pull removes the record', async () => {
    const { a, backend, familyId, clock } = await scenario(90);
    expect(backend.families.get(familyId)?.records.get('decision_2026-11-04')?.deletedAt).toBeDefined();
    const r = await a.sync();
    expect(a.store.decisions['2026-11-04']).toBeUndefined();
    expect(r.lostEdits).toEqual([]);
    expect(a.last?.pushed).toEqual([]);
    clock.advance(20 * SEC);
    expect((await a.sync()).pendingCount).toBe(0);
  });

  it('US-E15-07/AC6 day 91: the tombstone is purged; the device reconciles, drops the unchanged record and does not resurrect it', async () => {
    const { a, b, backend, familyId, clock } = await scenario(91);
    expect(backend.families.get(familyId)?.records.has('decision_2026-11-04')).toBe(false);
    const r = await a.sync();
    expect(a.store.decisions['2026-11-04']).toBeUndefined();
    expect(r.pushed).toEqual([]);
    expect(backend.families.get(familyId)?.records.has('decision_2026-11-04')).toBe(false);
    clock.advance(20 * SEC);
    await settle([a, b], clock);
    expect(b.store.decisions['2026-11-04']).toBeUndefined();
    expect(validateStore(a.store).ok).toBe(true);
  });

  it('US-E15-07/AC6 day 91: a record the device changed after its last sync is sent, not dropped', async () => {
    const { a, b, backend, familyId, clock } = await scenario(91);
    const bd = a.store.decisions['2026-11-04'];
    if (bd === undefined) throw new Error('decision');
    a.edit((s) => setDecision(s, '2026-11-04', 'school-lunch-planned', clock.now - 60 * DAY, { createdAt: bd.createdAt }));
    const r = await a.sync();
    expect(r.pushed).toContain('decision_2026-11-04');
    expect(backend.families.get(familyId)?.records.get('decision_2026-11-04')?.deletedAt).toBeUndefined();
    clock.advance(20 * SEC);
    await settle([a, b], clock);
    expect(b.store.decisions['2026-11-04']?.state).toBe('school-lunch-planned');
  });

  it('US-E15-07/AC6 day 91: unchanged settings are not dropped just because the cloud lacks a settings record', async () => {
    const { a, backend, familyId } = await scenario(91);
    backend.families.get(familyId)?.records.delete('settings_settings');
    await a.sync();
    expect(a.store.settings.reminders.weekly.time).toBe('14:00');
  });
});

describe('retention pruning is a delete (US-E15-07/AC12)', () => {
  it('US-E15-07/AC12 a month pruned on one device becomes a tombstone, the other device removes it, and nobody resurrects it', async () => {
    const clock = testClock(Date.parse('2026-01-10T10:00:00+09:00'));
    const { a, b, backend, familyId } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    // an old decision that is inside the 13 months today
    a.edit((s) => setDecision(s, '2025-01-05', 'not-confirmed', clock.now));
    await settle([a, b], clock);
    expect(b.store.decisions['2025-01-05']).toBeDefined();
    // ten months later it is beyond 13 months: A prunes it locally
    clock.advance(300 * DAY);
    a.edit((s) => clearDecision(s, '2025-01-05', clock.now));
    await settle([a, b], clock);
    expect(b.store.decisions['2025-01-05']).toBeUndefined();
    expect(backend.families.get(familyId)?.records.get('decision_2025-01-05')?.deletedAt).toBeDefined();
    // an old live record that still sits in the cloud is not applied to a device that pulls it now
    const fam = backend.families.get(familyId);
    const live = fam?.records.get('decision_2026-11-04');
    if (fam === undefined || live === undefined) throw new Error('fixture');
    fam.seq += 1;
    fam.records.set('decision_2024-02-02', { ...live, key: '2024-02-02', payloadJson: (live.payloadJson ?? '').replace('2026-11-04', '2024-02-02'), seq: fam.seq });
    clock.advance(20 * SEC);
    await a.sync();
    expect(a.store.decisions['2024-02-02']).toBeUndefined();
  });

  it('US-E15-07/AC12 a record beyond retention is not written to the cloud', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    a.edit((s) => setDecision(s, '2024-03-04', 'not-confirmed', clock.now));
    const r = await a.sync();
    expect(r.pushed).toEqual([]);
    expect(r.pendingCount).toBe(0);
    expect(backend.families.get(familyId)?.records.has('decision_2024-03-04')).toBe(false);
  });
});

describe('whole-record granularity (US-E15-07/AC9)', () => {
  it('US-E15-07/AC9 two edits of one record: the later whole record wins and the merged store still validates', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    const t = clock.now + 60 * SEC;
    a.edit((s) => setNote(s, 'Aのメモ', t));
    b.edit((s) => setNote(s, 'Bのメモ', t + 10 * SEC));
    clock.advance(120 * SEC);
    await settle([a, b], clock);
    expect(a.store.profile?.note).toBe('Bのメモ');
    expect(validateStore(a.store).ok).toBe(true);
  });

  it('weekly reminder edits on both devices at different times converge on the later one', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    const t = clock.now + 60 * SEC;
    a.edit((s) => setWeeklyTime(s, '15:00', t));
    b.edit((s) => setWeeklyTime(s, '16:00', t + SEC));
    clock.advance(120 * SEC);
    await settle([a, b], clock);
    expect(a.store.settings.reminders.weekly.time).toBe('16:00');
  });
});
