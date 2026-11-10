// US-E15-09 (ADR 016 section 2): authorisation of the sync function, one test per AC, against the fake Firestore with
// test-uid-001/002/003 and two families. Every operation is exercised, so a new operation without a gate would show here.
import { describe, expect, it } from 'vitest';
import { OP_RULES, OPS } from '../../../../functions/src/sync/authorize.ts';
import { DEFAULT_SYNC_CONFIG } from '../../../../functions/src/sync/config.ts';
import { createFamilyOf, familyOfTwo, fixtureEnvelopes, makeRig, T0, ts, UID1, UID2, UID3, UID4, type Rig } from './harness.ts';

const env = fixtureEnvelopes();
const profile = env['profile_profile']!;
const menu = env['menu_2026-11']!;

/** A request body that is valid for the operation, so a refusal can only come from authorisation. */
function bodyFor(op: string, target = UID2): unknown {
  switch (op) {
    case 'records.push':
      return { records: [profile] };
    case 'records.pull':
      return { cursor: 0 };
    case 'family.create':
    case 'invite.redeem':
      return { consentVersion: 1, code: 'ABCD234567' };
    case 'consent.set':
      return { consentVersion: 1 };
    case 'family.removeMember':
      return { uid: target };
    case 'family.delete':
    case 'family.leave':
      return { confirmation: '削除する' };
    default:
      return {};
  }
}

const MEMBER_OPS = OPS.filter((o) => OP_RULES[o].member);
const snapshot = (rig: Rig): string => JSON.stringify([...rig.db.docs.entries()].sort());

describe('US-E15-09 authorisation', () => {
  it('US-E15-09/AC1 a request with no sign-in, a bad header or a bad token is denied for every operation and writes nothing', async () => {
    const rig = makeRig();
    const familyId = await familyOfTwo(rig);
    const before = snapshot(rig);
    for (const op of OPS) {
      for (const headers of [{}, { authorization: 'Basic abc' }, { authorization: 'Bearer' }, { authorization: 'Bearer not-a-token' }]) {
        const r = await rig.call(op, null, bodyFor(op), headers);
        expect(r.status, op).toBe(401);
        expect(r.body, op).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
      }
    }
    expect(snapshot(rig)).toBe(before);
    expect(rig.db.paths(`families/${familyId}`).length).toBeGreaterThan(0);
  });

  it('US-E15-09/AC2 a signed-in non-member (test-uid-003) is refused by every member operation with one body, and changes nothing', async () => {
    const rig = makeRig();
    const familyId = await familyOfTwo(rig);
    await rig.ok('records.push', UID1, { records: [profile] });
    const before = snapshot(rig);
    const bodies = new Set<string>();
    for (const op of MEMBER_OPS) {
      // The request even names the family; the server never reads a family id from a request.
      const r = await rig.call(op, UID3, { ...(bodyFor(op, UID1) as object), familyId });
      expect(r.status, op).toBe(403);
      expect(r.body, op).toEqual({ ok: false, error: 'NOT_MEMBER' });
      bodies.add(JSON.stringify(r.body));
    }
    expect(bodies.size).toBe(1);
    expect(snapshot(rig)).toBe(before);
  });

  it('US-E15-09/AC2 the non-member learns nothing: membership.get says only "none", and no invite or member list is returned', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    const r = await rig.ok('membership.get', UID3);
    expect(r).toMatchObject({ status: 'none' });
    expect(Object.keys(r).sort()).toEqual(['ok', 'serverNowMs', 'status']);
    expect(JSON.stringify(r)).not.toMatch(/invite|members|familyId|email/);
  });

  it('US-E15-09/AC3 members of two families read and write only their own family', async () => {
    const rig = makeRig();
    const famA = await familyOfTwo(rig);
    const famB = await createFamilyOf(rig, UID4);
    expect(famA).not.toBe(famB);
    await rig.ok('records.push', UID1, { records: [profile] });
    await rig.ok('records.push', UID4, { records: [menu], familyId: famA }); // the named family is ignored
    const pullA = (await rig.ok('records.pull', UID2, { cursor: 0, familyId: famB })) as { envelopes: { kind: string }[] };
    const pullB = (await rig.ok('records.pull', UID4, { cursor: 0, familyId: famA })) as { envelopes: { kind: string }[] };
    expect(pullA.envelopes.map((e) => e.kind)).toEqual(['profile']);
    expect(pullB.envelopes.map((e) => e.kind)).toEqual(['menu']);
    expect(rig.db.paths(`families/${famA}/records`)).toEqual([`families/${famA}/records/profile_profile`]);
    expect(rig.db.paths(`families/${famB}/records`)).toEqual([`families/${famB}/records/menu_2026-11`]);
  });

  it('US-E15-09/AC3 removing a uid of another family is indistinguishable from removing an unknown uid', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    await createFamilyOf(rig, UID4);
    const other = await rig.call('family.removeMember', UID1, { uid: UID4 });
    const unknown = await rig.call('family.removeMember', UID1, { uid: 'test-uid-777' });
    expect(other.status).toBe(404);
    expect(other).toEqual({ ...unknown, headers: other.headers });
    expect(rig.db.get(`accounts/${UID4}`)).toMatchObject({ status: 'member' });
  });

  it('US-E15-09/AC4 both members have the same rights: read all, create, update and delete (tombstone) records, invite, consent', async () => {
    const rig = makeRig({ maxMembers: 3 });
    const famId = await familyOfTwo(rig);
    await rig.ok('records.push', UID1, { records: [profile, menu] });
    expect(((await rig.ok('records.pull', UID2, { cursor: 0 })) as { envelopes: unknown[] }).envelopes).toHaveLength(2);
    // uid2 updates what uid1 wrote, then uid1 deletes what uid2 wrote, then uid2 deletes it again with a later stamp.
    const edited = { ...menu, updatedAt: ts(T0 + 60_000), updatedAtMs: T0 + 60_000 };
    expect(((await rig.ok('records.push', UID2, { records: [edited] })) as { results: { status: string }[] }).results[0]?.status).toBe('accepted');
    const gone = { kind: 'menu', key: '2026-11', updatedAt: ts(T0 + 120_000), updatedAtMs: T0 + 120_000, updatedBy: 'x', deviceId: 'device-A', deletedAt: ts(T0 + 120_000) };
    expect(((await rig.ok('records.push', UID1, { records: [gone] })) as { results: { status: string }[] }).results[0]?.status).toBe('accepted');
    const back = { ...menu, updatedAt: ts(T0 + 180_000), updatedAtMs: T0 + 180_000 };
    expect(((await rig.ok('records.push', UID2, { records: [back] })) as { results: { status: string }[] }).results[0]?.status).toBe('accepted');
    const a = await rig.ok('invite.create', UID1);
    const b = await rig.ok('invite.create', UID2);
    expect(a['code']).not.toBe(b['code']);
    await rig.ok('consent.set', UID1, { consentVersion: 2 });
    await rig.ok('consent.set', UID2, { consentVersion: 2 });
    // The two member documents have the same shape and no field marks an owner.
    const shape = (uid: string): string[] => Object.keys(rig.db.get(`families/${famId}/members/${uid}`) ?? {}).sort();
    expect(shape(UID1)).toEqual(shape(UID2));
  });

  it('US-E15-09/AC5 a client cannot add itself or anyone: the only way in is redeeming a valid invite', async () => {
    const rig = makeRig();
    const famId = await familyOfTwo(rig);
    // Every operation that names accounts or families, tried by a signed-in non-member, adds nobody.
    for (const op of [...MEMBER_OPS, 'invite.redeem' as const]) await rig.call(op, UID3, { ...(bodyFor(op, UID3) as object), familyId: famId, uid: UID3, members: [UID3], maxMembers: 99 });
    expect(rig.db.get(`families/${famId}/members/${UID3}`)).toBeUndefined();
    expect(rig.db.get(`accounts/${UID3}`)).toBeUndefined();
    // family.create by uid3 is its own new family, never the existing one.
    const own = await rig.ok('family.create', UID3, { consentVersion: 1, familyId: famId, maxMembers: 99 });
    expect(own['familyId']).not.toBe(famId);
    expect(rig.db.get(`families/${own['familyId'] as string}`)).toMatchObject({ maxMembers: DEFAULT_SYNC_CONFIG.maxMembers, memberCount: 1 });
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ memberCount: 2, maxMembers: 2 });
  });

  it('US-E15-09/AC5 a member changes only their own consent fields, never another account\'s record or the member maximum', async () => {
    const rig = makeRig();
    const famId = await familyOfTwo(rig);
    const m1 = rig.db.get(`families/${famId}/members/${UID1}`);
    const m2 = rig.db.get(`families/${famId}/members/${UID2}`)!;
    const familyDoc = rig.db.get(`families/${famId}`);
    rig.now += 5000;
    await rig.ok('consent.set', UID2, { consentVersion: 3, uid: UID1, joinedAt: 'x', maxMembers: 50, familyId: 'other', email: 'evil@example.test' });
    expect(rig.db.get(`families/${famId}/members/${UID1}`)).toEqual(m1); // the other member is untouched
    const after = rig.db.get(`families/${famId}/members/${UID2}`)!;
    expect(Object.keys(after).sort()).toEqual(Object.keys(m2).sort());
    expect(after).toMatchObject({ consentVersion: 3, joinedAt: m2['joinedAt'], email: m2['email'] });
    expect(rig.db.get(`families/${famId}`)).toEqual(familyDoc); // the maximum is not a request field
  });

  it('US-E15-09/AC5 a member cannot remove themself through removeMember, and a member already in a family cannot redeem or create', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    expect((await rig.call('family.removeMember', UID1, { uid: UID1 })).status).toBe(404);
    expect((await rig.call('family.create', UID1, { consentVersion: 1 })).body).toEqual({ ok: false, error: 'ALREADY_IN_FAMILY' });
    expect((await rig.call('invite.redeem', UID2, { consentVersion: 1, code: 'ABCD234567' })).body).toEqual({ ok: false, error: 'ALREADY_IN_FAMILY' });
  });

  it('US-E15-09/AC6 invites are never returned to a non-member; documents are keyed by a hash, so no query enumerates codes', async () => {
    const rig2 = makeRig({ maxMembers: 3 });
    await familyOfTwo(rig2);
    const invite = (await rig2.ok('invite.create', UID1)) as { code: string };
    for (const uid of [UID3, UID4]) expect(JSON.stringify(await rig2.ok('membership.get', uid))).not.toContain(invite.code);
    expect(rig2.db.paths('invites').every((p) => /^invites\/[0-9a-f]{64}$/.test(p))).toBe(true);
    expect(rig2.db.paths('invites').join()).not.toContain(invite.code);
  });

  it('US-E15-09/AC6 redemption is rate limited: after the limit even a valid code is refused for the hour', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await familyOfTwo(rig);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    for (let i = 0; i < DEFAULT_SYNC_CONFIG.inviteFailedPerHour; i += 1) expect((await rig.call('invite.redeem', UID3, { code: 'WRONGCODE2', consentVersion: 1 })).status).toBe(400);
    const locked = await rig.call('invite.redeem', UID3, { code, consentVersion: 1 });
    expect(locked.status).toBe(429);
    expect(locked.body).toMatchObject({ error: 'TOO_MANY_ATTEMPTS' });
    expect(rig.db.get(`accounts/${UID3}`)).toBeUndefined();
    rig.now += 3_600_001; // the next hour
    expect((await rig.call('invite.redeem', UID3, { code, consentVersion: 1 })).status).toBe(200);
  });

  it('US-E15-09/AC7 a member\'s write must be well formed: server-set updatedBy, known kinds and keys, no unknown or server fields, size within limits', async () => {
    const rig = makeRig();
    const famId = await familyOfTwo(rig);
    const push = (rec: unknown) => rig.call('records.push', UID1, { records: [rec] });
    // updatedBy is the signed-in uid whatever the client says; the family id is the caller's own whatever the client says.
    const ok = await push({ ...profile, updatedBy: UID2 });
    expect(ok.status).toBe(200);
    expect(rig.db.get(`families/${famId}/records/profile_profile`)).toMatchObject({ updatedBy: UID1 });
    for (const bad of [
      { ...profile, extra: 1 },
      { ...profile, seq: 5 },
      { ...profile, bytes: 1 },
      { ...profile, kind: 'recipe' },
      { ...profile, key: 'other' },
      { ...menu, key: '2026-13' },
      { ...profile, updatedAt: 'yesterday' },
      { ...profile, updatedAtMs: 7 },
      { ...profile, deviceId: '' },
      { ...profile, payloadJson: undefined },
      { ...profile, payloadJson: 42 },
      { ...profile, payloadJson: '{"x":1}' },
      { ...profile, deletedAt: profile.updatedAt },
      'text',
      null,
    ]) {
      const r = await push(bad);
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(r.body['error']).toBe('INVALID_RECORD');
    }
    const huge = await push({ ...menu, payloadJson: JSON.stringify({ pad: 'x'.repeat(262_144) }) });
    expect(huge.status).toBe(413);
    expect(huge.body).toMatchObject({ error: 'LIMIT', scope: 'record' });
    expect((await rig.call('records.push', UID1, { records: 'nope' })).status).toBe(400);
    expect((await rig.call('records.push', UID1, { records: Array.from({ length: 51 }, () => profile) })).status).toBe(400);
  });

  it('US-E15-09/AC8 a removed member is denied every family operation on their very next request', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    await rig.ok('records.push', UID1, { records: [profile] });
    expect((await rig.call('records.pull', UID2, { cursor: 0 })).status).toBe(200); // still a member
    await rig.ok('family.removeMember', UID1, { uid: UID2 });
    for (const op of MEMBER_OPS) {
      const r = await rig.call(op, UID2, bodyFor(op, UID1));
      expect(r.status, op).toBe(410);
      expect(r.body, op).toEqual({ ok: false, error: 'MEMBERSHIP_ENDED', reason: 'removed' });
    }
  });

  it('US-E15-09/AC8 a member who left is denied the same way, with the reason "left"', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    await rig.ok('family.leave', UID2, {});
    for (const op of ['records.pull', 'records.push', 'invite.create'] as const) {
      expect((await rig.call(op, UID2, bodyFor(op))).body).toEqual({ ok: false, error: 'MEMBERSHIP_ENDED', reason: 'left' });
    }
  });

  it('US-E15-09/AC8 an account whose member document is gone (no cache, no claim) is denied even if its index still says member', async () => {
    const rig = makeRig();
    const famId = await familyOfTwo(rig);
    rig.db.docs.delete(`families/${famId}/members/${UID2}`); // the authority is the member document
    expect((await rig.call('records.pull', UID2, { cursor: 0 })).body).toEqual({ ok: false, error: 'NOT_MEMBER' });
  });

  it('US-E15-09/AC8 consent below CLOUD_NOTICE_MIN_VERSION blocks uploads and downloads until accepted, but not leaving', async () => {
    const rig = makeRig({ cloudNoticeMinVersion: 1 });
    await familyOfTwo(rig);
    rig.config.cloudNoticeMinVersion = 2; // the notice was raised
    expect((await rig.call('records.push', UID1, { records: [profile] })).body).toEqual({ ok: false, error: 'CONSENT_REQUIRED' });
    expect((await rig.call('records.pull', UID1, { cursor: 0 })).body).toEqual({ ok: false, error: 'CONSENT_REQUIRED' });
    expect((await rig.call('consent.set', UID1, { consentVersion: 1 })).body).toEqual({ ok: false, error: 'CONSENT_REQUIRED' }); // an outdated version never satisfies it
    await rig.ok('consent.set', UID1, { consentVersion: 2 });
    expect((await rig.call('records.push', UID1, { records: [profile] })).status).toBe(200);
    expect((await rig.call('records.pull', UID2, { cursor: 0 })).status).toBe(403); // uid2 has not accepted yet
    expect((await rig.call('family.leave', UID2, {})).status).toBe(200);
  });

  it('US-E15-09/AC8 every operation of the table has a rule, and every member operation goes through the gate (a request from a stranger never reaches its work)', async () => {
    expect(Object.keys(OP_RULES).sort()).toEqual([...OPS].sort());
    const rig = makeRig();
    for (const op of MEMBER_OPS) {
      const r = await rig.call(op, UID3, bodyFor(op));
      expect(r.status, op).toBe(403);
    }
    expect(rig.db.docs.size).toBe(0);
  });
});
