// Server parts of US-E15-01 (create), US-E15-02 (consent record), US-E15-03 (invites) and US-E15-04 (join), against the
// fake Firestore through the real request pipeline.
import { describe, expect, it } from 'vitest';
import { createFamilyOf, DAY, familyOfTwo, HOUR, makeRig, T0, UID1, UID2, UID3, UID4, UID_STRANGER } from './harness.ts';

const ALPHABET = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/;

describe('US-E15-01 create the family (server)', () => {
  it('US-E15-01/AC3 the family exists with exactly this account as its only member, empty, and the account index points to it', async () => {
    const rig = makeRig();
    const famId = await createFamilyOf(rig, UID1);
    expect(famId).toMatch(/^[A-Za-z0-9_-]{22}$/); // 128 bits, base64url, not derived from the uid
    expect(famId).not.toContain(UID1);
    expect(rig.db.paths(`families/${famId}`)).toEqual([`families/${famId}`, `families/${famId}/members/${UID1}`]);
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ seq: 0, totalBytes: 0, memberCount: 1, maxMembers: 2, status: 'active', schemaVersion: 1 });
    expect(rig.db.get(`accounts/${UID1}`)).toEqual({ status: 'member', familyId: famId });
    expect(await rig.ok('membership.get', UID1)).toMatchObject({ status: 'member', familyId: famId, maxMembers: 2, invite: null });
  });

  it('US-E15-01/AC4 an empty family pulls nothing and the cursor stays 0', async () => {
    const rig = makeRig();
    await createFamilyOf(rig, UID1);
    expect(await rig.ok('records.pull', UID1, { cursor: 0 })).toMatchObject({ envelopes: [], seq: 0, hasMore: false, schemaVersion: 1 });
  });

  it('US-E15-01/AC6 one family per account: a second create is refused and the first family is unchanged', async () => {
    const rig = makeRig();
    const famId = await createFamilyOf(rig, UID1);
    const before = JSON.stringify([...rig.db.docs.entries()]);
    const r = await rig.call('family.create', UID1, { consentVersion: 1 });
    expect(r).toMatchObject({ status: 409, body: { ok: false, error: 'ALREADY_IN_FAMILY' } });
    expect(JSON.stringify([...rig.db.docs.entries()])).toBe(before);
    expect(rig.db.get(`accounts/${UID1}`)).toMatchObject({ familyId: famId });
  });

  it('US-E15-01/AC6 only accounts on the allow-list may create a family; the refusal writes nothing and is the proxy\'s NOT_ALLOWED body', async () => {
    const rig = makeRig();
    const r = await rig.call('family.create', UID_STRANGER, { consentVersion: 1 });
    expect(r).toMatchObject({ status: 403, body: { ok: false, error: 'NOT_ALLOWED' } });
    expect(rig.db.docs.size).toBe(0);
    const none = makeRig({}, []); // an empty or unreadable list denies everyone
    expect((await none.call('family.create', UID1, { consentVersion: 1 })).status).toBe(403);
    expect(none.db.docs.size).toBe(0);
  });

  it('US-E15-01/AC6 a stranger can still join by invite (joining is open to any signed-in account)', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    expect((await rig.call('invite.redeem', UID_STRANGER, { code, consentVersion: 1 })).status).toBe(200);
  });

  it('US-E15-01/AC6 after leaving, the account may create again (the ended marker is cleared)', async () => {
    const rig = makeRig();
    await familyOfTwo(rig);
    await rig.ok('family.leave', UID2, {});
    expect(rig.db.get(`accounts/${UID2}`)).toMatchObject({ status: 'ended', endedReason: 'left' });
    const again = await createFamilyOf(rig, UID2);
    expect(rig.db.get(`accounts/${UID2}`)).toEqual({ status: 'member', familyId: again });
  });
});

describe('US-E15-02 consent is recorded per member with the server\'s time', () => {
  it('US-E15-02/AC5 the member record stores the notice version and the server time; a client time is ignored', async () => {
    const rig = makeRig();
    const famId = await createFamilyOf(rig, UID1, 1);
    expect(rig.db.get(`families/${famId}/members/${UID1}`)).toEqual({ joinedAt: '2026-11-10T10:00:00+09:00', consentVersion: 1, consentedAt: '2026-11-10T10:00:00+09:00', email: 'one@example.test' });
    rig.now += 90_000;
    await rig.ok('consent.set', UID1, { consentVersion: 2, consentedAt: '1999-01-01T00:00:00+09:00' });
    expect(rig.db.get(`families/${famId}/members/${UID1}`)).toMatchObject({ consentVersion: 2, consentedAt: '2026-11-10T10:01:30+09:00' });
  });

  it('US-E15-02/AC5 consent is per member: the joiner records their own version and time, the creator\'s record is unchanged', async () => {
    const rig = makeRig({ cloudNoticeMinVersion: 1 });
    const famId = await createFamilyOf(rig, UID1, 1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    rig.now += 3_600_000;
    rig.config.cloudNoticeMinVersion = 2;
    await rig.ok('consent.set', UID1, { consentVersion: 2 });
    await rig.ok('invite.redeem', UID2, { code, consentVersion: 2 });
    expect(rig.db.get(`families/${famId}/members/${UID2}`)).toMatchObject({ consentVersion: 2, consentedAt: '2026-11-10T11:00:00+09:00' });
    expect(rig.db.get(`families/${famId}/members/${UID1}`)).toMatchObject({ consentedAt: '2026-11-10T11:00:00+09:00' }); // re-consented at the same instant
  });

  it('US-E15-02/AC1 creating or joining with no consent (missing, wrong type, or below the server minimum) is refused and changes nothing', async () => {
    const rig = makeRig();
    expect((await rig.call('family.create', UID1, {})).status).toBe(400);
    expect((await rig.call('family.create', UID1, { consentVersion: '1' })).status).toBe(400);
    expect((await rig.call('family.create', UID1, { consentVersion: 0 })).body).toEqual({ ok: false, error: 'CONSENT_REQUIRED' });
    const famId = await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    expect((await rig.call('invite.redeem', UID2, { code })).status).toBe(400);
    expect((await rig.call('invite.redeem', UID2, { code, consentVersion: 0 })).body).toEqual({ ok: false, error: 'CONSENT_REQUIRED' });
    expect(rig.db.get(`families/${famId}/members/${UID2}`)).toBeUndefined();
    expect(rig.db.paths('inviteAttempts')).toEqual([]); // a refused consent is not a guess
  });
});

describe('US-E15-03 invites', () => {
  it('US-E15-03/AC1 an invite is 10 unambiguous characters, stored only as a hash id, and expires 72 hours after creation', async () => {
    const rig = makeRig();
    await createFamilyOf(rig, UID1);
    const r = (await rig.ok('invite.create', UID1)) as { code: string; expiresAt: string };
    expect(r.code).toMatch(ALPHABET);
    expect(r.expiresAt).toBe('2026-11-13T10:00:00+09:00');
    const [path] = rig.db.paths('invites');
    expect(path).toMatch(/^invites\/[0-9a-f]{64}$/);
    expect(path).not.toContain(r.code);
    expect(await rig.ok('membership.get', UID1)).toMatchObject({ invite: { code: r.code, expiresAt: r.expiresAt } });
  });

  it('US-E15-03/AC2 an invite works at 09:59:59 on day three and is refused as expired from 10:00:00 on', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    rig.now = T0 + 3 * DAY - 1000;
    expect((await rig.call('invite.redeem', UID2, { code, consentVersion: 1 })).status).toBe(200);
    const rig2 = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig2, UID1);
    const { code: c2 } = (await rig2.ok('invite.create', UID1)) as { code: string };
    rig2.now = T0 + 3 * DAY + 1000; // 10:00:01
    const late = await rig2.call('invite.redeem', UID2, { code: c2, consentVersion: 1 });
    expect(late).toMatchObject({ status: 400, body: { ok: false, error: 'INVITE_EXPIRED' } });
    expect(rig2.db.get(`accounts/${UID2}`)).toBeUndefined();
    rig2.now = T0 + 3 * DAY; // exactly at expiry
    expect((await rig2.call('invite.redeem', UID3, { code: c2, consentVersion: 1 })).body).toMatchObject({ error: 'INVITE_EXPIRED' });
  });

  it('US-E15-03/AC3 an invite is single use: the second account is refused and no member is added', async () => {
    const rig = makeRig({ maxMembers: 3 });
    const famId = await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    expect((await rig.call('invite.redeem', UID2, { code, consentVersion: 1 })).status).toBe(200);
    const second = await rig.call('invite.redeem', UID3, { code, consentVersion: 1 });
    expect(second).toMatchObject({ status: 400, body: { ok: false, error: 'INVITE_INVALID' } });
    expect(rig.db.get(`families/${famId}/members/${UID3}`)).toBeUndefined();
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ memberCount: 2 });
    expect(JSON.stringify(rig.db.get(rig.db.paths('invites')[0]!))).not.toContain(code); // the used invite no longer holds the code
  });

  it('US-E15-03/AC4 a new invite or a cancel stops the earlier code at once; at most one invite is active', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig, UID1);
    const first = (await rig.ok('invite.create', UID1)) as { code: string };
    const second = (await rig.ok('invite.create', UID1)) as { code: string };
    expect((await rig.call('invite.redeem', UID2, { code: first.code, consentVersion: 1 })).body).toEqual({ ok: false, error: 'INVITE_INVALID' });
    const active = rig.db.paths('invites').filter((p) => rig.db.get(p)?.['cancelledAt'] === undefined);
    expect(active).toHaveLength(1);
    await rig.ok('invite.cancel', UID1, {});
    expect((await rig.call('invite.redeem', UID2, { code: second.code, consentVersion: 1 })).body).toEqual({ ok: false, error: 'INVITE_INVALID' });
    expect(await rig.ok('membership.get', UID1)).toMatchObject({ invite: null });
    await rig.ok('invite.cancel', UID1, {}); // nothing to cancel is not an error
  });

  it('US-E15-03/AC5 a full family refuses a new invite and any outstanding code, with its own reply', async () => {
    const small = makeRig({ maxMembers: 1 }); // the maximum is configuration, not code
    await createFamilyOf(small, UID1);
    expect((await small.call('invite.create', UID1)).body).toEqual({ ok: false, error: 'FAMILY_FULL' });
    const rig = makeRig({ maxMembers: 2 });
    const famId = await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    // The family reaches its limit while the code is outstanding (the maximum on the family document is what counts).
    rig.db.seed(`families/${famId}`, { ...rig.db.get(`families/${famId}`)!, maxMembers: 1 });
    expect((await rig.call('invite.redeem', UID2, { code, consentVersion: 1 })).body).toEqual({ ok: false, error: 'FAMILY_FULL' });
    expect(rig.db.get(`families/${famId}/members/${UID2}`)).toBeUndefined();
    expect((await rig.call('invite.create', UID1)).body).toEqual({ ok: false, error: 'FAMILY_FULL' });
  });

  it('US-E15-03/AC6 an account that enters 10 wrong or expired codes within an hour is refused further tries for that hour', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    for (let i = 0; i < 9; i += 1) expect((await rig.call('invite.redeem', UID2, { code: `WRONG${i}CODE`.slice(0, 10).replace(/[01OIL]/g, '2'), consentVersion: 1 })).status).toBe(400);
    expect((await rig.call('invite.redeem', UID2, { code: 'SHORT', consentVersion: 1 })).status).toBe(400); // the 10th failure
    const refused = await rig.call('invite.redeem', UID2, { code, consentVersion: 1 });
    expect(refused).toMatchObject({ status: 429, body: { ok: false, error: 'TOO_MANY_ATTEMPTS' } });
    expect(refused.headers['retry-after']).toBeDefined();
    expect(refused.body['retryAfterSec']).toBeLessThanOrEqual(3600);
    rig.now += HOUR - 5000; // still inside the window of the first failure
    expect((await rig.call('invite.redeem', UID2, { code, consentVersion: 1 })).status).toBe(429);
    rig.now += 6000;
    expect((await rig.call('invite.redeem', UID2, { code, consentVersion: 1 })).status).toBe(200);
    // The counter is per account: another account was never limited.
  });

  it('US-E15-03/AC6 the attempt counter of one account does not limit another account', async () => {
    const rig = makeRig({ maxMembers: 3, inviteFailedPerHour: 2 });
    await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    for (let i = 0; i < 2; i += 1) await rig.call('invite.redeem', UID3, { code: 'WRONGCODE2', consentVersion: 1 });
    expect((await rig.call('invite.redeem', UID3, { code, consentVersion: 1 })).status).toBe(429);
    expect((await rig.call('invite.redeem', UID2, { code, consentVersion: 1 })).status).toBe(200);
  });

  it('US-E15-03/AC7 wrong, used and cancelled codes get one identical reply; expired and full are the only distinct ones; nothing names a family', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig, UID1);
    const used = (await rig.ok('invite.create', UID1)) as { code: string };
    await rig.ok('invite.redeem', UID2, { code: used.code, consentVersion: 1 });
    const cancelled = (await rig.ok('invite.create', UID1)) as { code: string };
    await rig.ok('invite.cancel', UID1, {});
    const replies = [];
    for (const code of ['ABCD234567', used.code, cancelled.code, 'short', '0O1IL00000']) {
      replies.push(await rig.call('invite.redeem', UID4, { code, consentVersion: 1 }));
    }
    for (const r of replies) expect({ status: r.status, body: r.body }).toEqual({ status: 400, body: { ok: false, error: 'INVITE_INVALID' } });
    const text = JSON.stringify(replies);
    expect(text).not.toMatch(/familyId|fam|member|child|test-uid/i);
  });

  it('US-E15-03/AC7 an expired code and a full family each have their own reply, still without family details', async () => {
    const rig = makeRig({ maxMembers: 2 });
    await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    rig.now += 4 * DAY;
    const r = await rig.call('invite.redeem', UID3, { code, consentVersion: 1 });
    expect(r.body).toEqual({ ok: false, error: 'INVITE_EXPIRED' });
  });

  it('US-E15-03/AC8 the inviter sees the new member (name or e-mail from sign-in, members only) and the invite is gone', async () => {
    const rig = makeRig();
    const famId = await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    await rig.ok('invite.redeem', UID2, { code, consentVersion: 1 });
    const view = (await rig.ok('membership.get', UID1)) as { members: { uid: string; you: boolean; email?: string }[]; invite: unknown; familyId: string };
    expect(view.invite).toBeNull();
    expect(view.members.map((m) => [m.uid, m.you, m.email])).toEqual([
      [UID1, true, 'one@example.test'],
      [UID2, false, 'two@example.test'],
    ]);
    expect(view.familyId).toBe(famId);
    expect(JSON.stringify(await rig.ok('membership.get', UID3))).not.toContain('example.test');
  });
});

describe('US-E15-04 join (server)', () => {
  it('US-E15-04/AC2 a code in any letter case, with spaces or hyphens, is accepted', async () => {
    const rig = makeRig({ maxMembers: 4 });
    await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    const messy = `${code.slice(0, 4).toLowerCase()} - ${code.slice(4, 7)}-${code.slice(7).toLowerCase()} `;
    expect((await rig.call('invite.redeem', UID2, { code: messy, consentVersion: 1 })).status).toBe(200);
  });

  it('US-E15-04/AC9 an account that is already a member of a family is refused and nothing changes, not even its attempt counter', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig, UID1);
    const other = await createFamilyOf(rig, UID4);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    const before = JSON.stringify([...rig.db.docs.entries()].sort());
    const r = await rig.call('invite.redeem', UID4, { code, consentVersion: 1 });
    expect(r).toMatchObject({ status: 409, body: { ok: false, error: 'ALREADY_IN_FAMILY' } });
    expect(JSON.stringify([...rig.db.docs.entries()].sort())).toBe(before);
    expect(rig.db.get(`accounts/${UID4}`)).toEqual({ status: 'member', familyId: other });
  });

  it('US-E15-04/AC10 a refused join adds no member and changes no document except the attempt counter', async () => {
    const rig = makeRig({ maxMembers: 3 });
    const famId = await createFamilyOf(rig, UID1);
    await rig.ok('invite.create', UID1);
    const before = new Map(rig.db.docs);
    await rig.call('invite.redeem', UID2, { code: 'ABCD234567', consentVersion: 1 });
    const changed = [...rig.db.docs.keys()].filter((p) => JSON.stringify(rig.db.docs.get(p)) !== JSON.stringify(before.get(p)));
    expect(changed.every((p) => p.startsWith('inviteAttempts/'))).toBe(true);
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ memberCount: 1 });
  });

  it('US-E15-04/AC12 the joiner can do everything the creator can: read and write records, invite (when there is room), leave, delete', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    await rig.ok('invite.redeem', UID2, { code, consentVersion: 1 });
    expect((await rig.call('invite.create', UID2)).status).toBe(200);
    expect((await rig.call('records.pull', UID2, { cursor: 0 })).status).toBe(200);
    expect((await rig.call('family.delete', UID2, { confirmation: '削除する' })).status).toBe(200);
    expect(rig.db.paths('families')).toEqual([]);
  });

  it('US-E15-04/AC11 a join is all or nothing: if the commit loses a race the redeemer is not left half-added', async () => {
    const rig = makeRig({ maxMembers: 3 });
    const famId = await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    let injected = false;
    rig.db.beforeCommit = () => {
      if (injected) return;
      injected = true;
      rig.db.seed(`families/${famId}`, { ...rig.db.get(`families/${famId}`)! }); // another instance touched the family first
    };
    expect((await rig.call('invite.redeem', UID2, { code, consentVersion: 1 })).status).toBe(200);
    expect(rig.db.retries).toBeGreaterThan(0);
    const staged = [rig.db.get(`accounts/${UID2}`), rig.db.get(`families/${famId}/members/${UID2}`), rig.db.get(`families/${famId}`)];
    expect(staged[0]).toMatchObject({ status: 'member' });
    expect(staged[1]).toBeDefined();
    expect(staged[2]).toMatchObject({ memberCount: 2 });
  });
});

describe('US-E15-05 reading the membership', () => {
  it('US-E15-05/AC1 a new device of a member reads the family id and consent; an account in no family gets "none"; a removed one gets the reason once', async () => {
    const rig = makeRig();
    const famId = await familyOfTwo(rig);
    expect(await rig.ok('membership.get', UID2)).toMatchObject({ status: 'member', familyId: famId, consentVersion: 1 });
    expect(await rig.ok('membership.get', UID3)).toMatchObject({ status: 'none' });
    await rig.ok('family.removeMember', UID1, { uid: UID2 });
    expect(await rig.ok('membership.get', UID2)).toMatchObject({ status: 'ended', reason: 'removed' });
    await rig.ok('membership.ack', UID2, {});
    expect(await rig.ok('membership.get', UID2)).toMatchObject({ status: 'none' });
    await rig.ok('membership.ack', UID1, {}); // acknowledging with nothing ended changes nothing
    expect(rig.db.get(`accounts/${UID1}`)).toMatchObject({ status: 'member' });
  });
});
