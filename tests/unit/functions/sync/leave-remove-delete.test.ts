// US-E15-08 (server parts): leave, remove a member, delete the family's data (ADR 016 section 1), against the fake Firestore.
import { describe, expect, it } from 'vitest';
import { createFamilyOf, DEVICE_A, familyOfTwo, fixtureEnvelopes, makeRig, T0, ts, UID1, UID2, UID3, type Rig } from './harness.ts';

const env = fixtureEnvelopes();
const profile = env['profile_profile']!;
const CONFIRM = '削除する';

const ended = (reason: string) => ({ ok: false, error: 'MEMBERSHIP_ENDED', reason });
/** Everything left in the database after a family is gone: only per-account markers and counters, none naming the family. */
const leftovers = (rig: Rig): string[] => rig.db.paths('families', 'invites');

async function withData(rig?: Rig): Promise<{ rig: Rig; famId: string }> {
  const r = rig ?? makeRig();
  const famId = await familyOfTwo(r);
  await r.ok('records.push', UID1, { records: [profile, env['menu_2026-11']!] });
  return { rig: r, famId };
}

describe('US-E15-08 leave, remove, delete (server)', () => {
  it('US-E15-08/AC1 leaving with two members: the account is no longer a member, the other member and the family data stay', async () => {
    const { rig, famId } = await withData();
    await rig.ok('family.leave', UID2, {});
    expect(rig.db.get(`families/${famId}/members/${UID2}`)).toBeUndefined();
    expect(rig.db.get(`accounts/${UID2}`)).toMatchObject({ status: 'ended', endedReason: 'left' });
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ memberCount: 1, status: 'active' });
    expect(((await rig.ok('records.pull', UID1, { cursor: 0 })) as { envelopes: unknown[] }).envelopes).toHaveLength(2);
    expect(await rig.ok('membership.get', UID1)).toMatchObject({ status: 'member', members: [{ uid: UID1 }] });
  });

  it('US-E15-08/AC2 after leaving the account can read and write nothing of the family (its device keeps its local copy; sync stops)', async () => {
    const { rig } = await withData();
    await rig.ok('family.leave', UID2, {});
    expect((await rig.call('records.pull', UID2, { cursor: 0 })).body).toEqual(ended('left'));
    expect((await rig.call('records.push', UID2, { records: [profile] })).body).toEqual(ended('left'));
  });

  it('US-E15-08/AC3 removing the other member: they lose access at once and learn the reason at their next sync, the family stays', async () => {
    const { rig, famId } = await withData();
    await rig.ok('family.removeMember', UID1, { uid: UID2 });
    expect((await rig.call('records.pull', UID2, { cursor: 0 })).body).toEqual(ended('removed'));
    expect(await rig.ok('membership.get', UID2)).toMatchObject({ status: 'ended', reason: 'removed' });
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ memberCount: 1 });
    expect((await rig.call('records.pull', UID1, { cursor: 0 })).status).toBe(200);
  });

  it('US-E15-08/AC4 the last member leaving deletes the family, but only with the typed confirmation', async () => {
    const rig = makeRig();
    const famId = await createFamilyOf(rig, UID1);
    await rig.ok('records.push', UID1, { records: [profile] });
    const before = JSON.stringify([...rig.db.docs.entries()].sort());
    for (const body of [{}, { confirmation: '' }, { confirmation: 'delete' }, { confirmation: ' 削除する' }]) {
      const r = await rig.call('family.leave', UID1, body);
      expect(r).toMatchObject({ status: 409, body: { ok: false, error: 'CONFIRMATION_REQUIRED', why: 'last-member' } });
    }
    expect(JSON.stringify([...rig.db.docs.entries()].sort())).toBe(before);
    expect(await rig.ok('family.leave', UID1, { confirmation: CONFIRM })).toMatchObject({ deleted: true });
    expect(leftovers(rig)).toEqual([]);
    expect(rig.db.mentioning(famId)).toEqual([]);
  });

  it('US-E15-08/AC5 deleting needs the exact typed confirmation; then every record, tombstone, invite and membership of the family is gone', async () => {
    const rig = makeRig({ maxMembers: 3 });
    const famId = await familyOfTwo(rig);
    await rig.ok('records.push', UID1, { records: [profile, env['menu_2026-11']!] });
    await rig.ok('records.push', UID2, { records: [{ kind: 'menu', key: '2026-11', updatedAt: ts(T0 + 9000), updatedAtMs: T0 + 9000, updatedBy: 'x', deviceId: DEVICE_A, deletedAt: ts(T0 + 9000) }] }); // a tombstone
    const active = (await rig.ok('invite.create', UID1)) as { code: string }; // one active invite
    await rig.ok('invite.create', UID1); // the earlier one is now cancelled; the used one stays as a used record
    expect(rig.db.paths('invites').length).toBe(3);
    for (const confirmation of [undefined, '', 'delete', '削除']) {
      expect((await rig.call('family.delete', UID1, { confirmation })).status).toBe(409);
    }
    expect(rig.db.paths(`families/${famId}`).length).toBeGreaterThan(3); // nothing happened yet
    expect(await rig.ok('family.delete', UID1, { confirmation: CONFIRM })).toMatchObject({ deleted: true });
    expect(leftovers(rig)).toEqual([]);
    expect(rig.db.mentioning(famId)).toEqual([]);
    expect(rig.db.mentioning(active.code)).toEqual([]);
    expect(rig.db.docs.has(`accounts/${UID1}`)).toBe(false);
    // What may remain: per-account markers and counters, none of which carries family content.
    expect([...rig.db.docs.keys()].every((p) => /^(accounts|syncLimits|inviteAttempts)\//.test(p))).toBe(true);
  });

  it('US-E15-08/AC6 deletion reaches the other member at their next sync or open: told once, then nothing is re-created', async () => {
    const { rig, famId } = await withData();
    await rig.ok('family.delete', UID1, { confirmation: CONFIRM });
    expect((await rig.call('records.pull', UID2, { cursor: 0 })).body).toEqual(ended('family-deleted'));
    expect((await rig.call('records.push', UID2, { records: [profile] })).body).toEqual(ended('family-deleted'));
    expect(await rig.ok('membership.get', UID2)).toMatchObject({ status: 'ended', reason: 'family-deleted' });
    expect(rig.db.paths('families')).toEqual([]); // the refused push created nothing
    await rig.ok('membership.ack', UID2, {});
    expect(await rig.ok('membership.get', UID2)).toMatchObject({ status: 'none' });
    expect(rig.db.mentioning(famId)).toEqual([]);
  });

  it('US-E15-08/AC10 after leaving, the account can create or join again, and a used code is still refused', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    await rig.ok('invite.redeem', UID2, { code, consentVersion: 1 });
    await rig.ok('family.leave', UID2, {});
    expect((await rig.call('invite.redeem', UID2, { code, consentVersion: 1 })).body).toEqual({ ok: false, error: 'INVITE_INVALID' });
    const fresh = (await rig.ok('invite.create', UID1)) as { code: string };
    expect((await rig.call('invite.redeem', UID2, { code: fresh.code, consentVersion: 1 })).status).toBe(200); // joins again (ended marker cleared)
    expect(rig.db.get(`accounts/${UID2}`)).toMatchObject({ status: 'member' });
  });

  it('US-E15-08/AC11 deletion completeness: a listing of everything stored for the family id returns nothing, and a removed member cannot read it', async () => {
    const { rig, famId } = await withData();
    await rig.ok('family.removeMember', UID1, { uid: UID2 });
    await rig.ok('family.delete', UID1, { confirmation: CONFIRM });
    expect(rig.db.paths(`families/${famId}`)).toEqual([]);
    expect(rig.db.mentioning(famId)).toEqual([]);
    expect((await rig.call('records.pull', UID2, { cursor: 0 })).status).toBe(410);
    expect((await rig.call('records.pull', UID1, { cursor: 0 })).body).toEqual({ ok: false, error: 'NOT_MEMBER' }); // the deleter's own marker is gone: they are simply in no family
  });

  it('US-E15-08/AC11 a failed bulk delete cuts access first and can be repeated: access is gone, the reply is not "deleted", and the retry finishes the job', async () => {
    const { rig, famId } = await withData();
    const real = rig.db.recursiveDelete.bind(rig.db);
    rig.db.recursiveDelete = () => Promise.reject(new Error('UNAVAILABLE'));
    const failed = await rig.call('family.delete', UID1, { confirmation: CONFIRM });
    expect(failed.status).toBe(503);
    expect(failed.body).not.toHaveProperty('deleted');
    // Access was cut in the first transaction.
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ status: 'deleting' });
    expect(rig.db.get(`accounts/${UID1}`)).toMatchObject({ status: 'deleting' });
    expect((await rig.call('records.pull', UID1, { cursor: 0 })).body).toEqual(ended('family-deleted'));
    expect((await rig.call('records.pull', UID2, { cursor: 0 })).body).toEqual(ended('family-deleted'));
    expect((await rig.call('family.create', UID1, { consentVersion: 1 })).status).toBe(409); // not while the delete is unfinished
    rig.db.recursiveDelete = real;
    expect(await rig.ok('family.delete', UID1, { confirmation: CONFIRM })).toMatchObject({ deleted: true });
    expect(rig.db.mentioning(famId)).toEqual([]);
    expect(rig.db.docs.has(`accounts/${UID1}`)).toBe(false);
  });

  it('US-E15-08/AC11 a family of more than 500 documents is deleted completely, in chunks within the write limit', async () => {
    const { rig, famId } = await withData();
    for (let i = 0; i < 1200; i += 1) rig.db.seed(`families/${famId}/records/decision_2026-01-01_${i}`, { kind: 'decision', seq: 1, bytes: 1 });
    await rig.ok('family.delete', UID2, { confirmation: CONFIRM });
    expect(rig.db.paths('families')).toEqual([]);
    expect(rig.db.deletedByRecursive).toBeGreaterThan(1200);
  });

  it('US-E15-08/AC1 a non-member and a removed member cannot leave, remove or delete', async () => {
    const { rig, famId } = await withData();
    for (const [op, body] of [['family.leave', {}], ['family.removeMember', { uid: UID1 }], ['family.delete', { confirmation: CONFIRM }]] as const) {
      expect((await rig.call(op, UID3, body)).body).toEqual({ ok: false, error: 'NOT_MEMBER' });
    }
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ memberCount: 2, status: 'active' });
  });
});
