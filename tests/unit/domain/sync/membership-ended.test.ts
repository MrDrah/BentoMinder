// US-E15-08 (domain parts: AC10 and the effects of AC2/AC3/AC5), contract 14.7: membership-ended, never re-create the family.
import { describe, expect, it } from 'vitest';
import { endMembership } from '../../../../src/domain/sync/membership.ts';
import { computeStatus } from '../../../../src/domain/sync/status.ts';
import { statusFactsOf } from '../../../../src/domain/sync/cycle.ts';
import { validateStore } from '../../../../src/domain/storage/repository.ts';
import { SEC, UID1, UID2, familyOfTwo, setDecision, syncedView, testClock } from './helpers.ts';

describe('left, removed, family deleted', () => {
  it('US-E15-08/AC3 a removed member loses access at once: the next data call reports membership-ended with the reason and the local copy is untouched', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    await a.fake.removeMember(UID2);
    clock.advance(20 * SEC);
    b.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    const before = b.store;
    const r = await b.sync();
    expect(r.outcome).toEqual({ kind: 'membership-ended', reason: 'removed' });
    expect(r.store).toBe(before);
    expect(computeStatus(statusFactsOf(r, { online: true }))).toBe('membership-ended');
  });

  it('US-E15-08/AC2 AC3 after the end is handled the copy is stand-alone: ownerId is the uid, no family id, status local-only, and the next cycle makes no call', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    const expected = syncedView(b.store);
    await a.fake.removeMember(UID2);
    const ended = await b.sync();
    const stand = endMembership(ended.store, ended.meta, UID2);
    b.store = stand.store;
    b.meta = stand.meta;
    expect(b.store.profile?.ownerId).toBe(UID2);
    expect(b.meta.familyId).toBeNull();
    expect(validateStore(b.store, UID2).ok).toBe(true);
    expect(Object.keys(b.store.decisions)).toEqual(Object.keys((expected as { decisions: object }).decisions));
    const calls = b.fake.calls.length;
    clock.advance(30 * SEC);
    const next = await b.sync();
    expect(next.outcome).toEqual({ kind: 'no-family' });
    expect(b.fake.calls).toHaveLength(calls);
    expect(computeStatus(statusFactsOf(next, { online: true }))).toBe('local-only');
  });

  it('US-E15-08/AC10 family data deleted by the other member: reason family-deleted, and the device never re-creates the family by itself', async () => {
    const clock = testClock();
    const { a, b, backend } = await familyOfTwo(clock);
    await a.fake.deleteFamily();
    expect(backend.families.size).toBe(0);
    const r = await b.sync();
    expect(r.outcome).toEqual({ kind: 'membership-ended', reason: 'family-deleted' });
    const stand = endMembership(r.store, r.meta, UID2);
    b.store = stand.store;
    b.meta = stand.meta;
    await b.fake.ackMembershipEnd();
    clock.advance(30 * SEC);
    for (let i = 0; i < 3; i++) {
      expect((await b.sync()).outcome).toEqual({ kind: 'no-family' });
      clock.advance(30 * SEC);
    }
    expect(b.fake.calls.map((c) => c.op)).not.toContain('createFamily');
    expect(backend.families.size).toBe(0);
    expect(backend.listAll('fam-test-001')).toEqual([]);
  });

  it('US-E15-08/AC1 AC5 a member who leaves keeps the local copy; the family data stays for the remaining member and last member leaving deletes it', async () => {
    const clock = testClock();
    const { a, b, backend, familyId } = await familyOfTwo(clock);
    await b.fake.leave();
    expect(backend.families.get(familyId)?.members.size).toBe(1);
    expect(backend.families.get(familyId)?.records.size).toBeGreaterThan(0);
    const r = await b.sync();
    expect(r.outcome).toEqual({ kind: 'membership-ended', reason: 'left' });
    await a.fake.leave();
    expect(backend.families.has(familyId)).toBe(false);
    expect(backend.listAll(familyId)).toEqual([]);
  });

  it('US-E15-09/AC4 a device that was never a member, and a removed member, can neither read nor write family data', async () => {
    const clock = testClock();
    const { a, b, backend } = await familyOfTwo(clock);
    const stranger = backend.portFor('test-uid-003');
    await expect(stranger.pull(0)).rejects.toMatchObject({ kind: 'refused' });
    await expect(stranger.push([])).rejects.toMatchObject({ kind: 'refused' });
    await a.fake.removeMember(UID2);
    await expect(b.fake.pull(0)).rejects.toMatchObject({ kind: 'membership-ended' });
    await expect(b.fake.push([])).rejects.toMatchObject({ kind: 'membership-ended' });
  });

  it('a member cannot remove themselves through removeMember or a stranger', async () => {
    const clock = testClock();
    const { a, backend } = await familyOfTwo(clock);
    await expect(a.fake.removeMember(UID1)).rejects.toMatchObject({ kind: 'refused' });
    await expect(a.fake.removeMember('test-uid-003')).rejects.toMatchObject({ kind: 'refused' });
    await expect(backend.portFor('test-uid-003').leave()).rejects.toMatchObject({ kind: 'refused' });
  });
});
