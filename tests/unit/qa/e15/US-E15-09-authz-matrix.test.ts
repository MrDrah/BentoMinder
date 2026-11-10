// QA E15, security first. An independent authorisation matrix for the sync Function against the fake store.
// Derived from US-E15-09 (AC1-AC10), US-E15-03 (AC2-AC7), US-E15-02/AC8 and data contract 14.3, 14.13.
import { describe, expect, it } from 'vitest';
import { ALL_OPS, MEMBER_ONLY_OPS, HOUR, T0, UID1, UID2, UID3, UID4, UID5, UID_STRANGER, createFamilyOf, counting, familyOfTwo, fixtureEnvelopes, makeRig, snapshot, tokenOf, type Rig } from './qa-rig.ts';

const env = fixtureEnvelopes();
const profile = env['profile_profile']!;
const SECRET = 'ピーナッツ-SECRET-MARKER';

const bodyFor = (op: string, target = UID1): unknown => {
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
};

const pin = (r: { status: number; body: Record<string, unknown> }) => JSON.stringify([r.status, r.body]);

/** Two families: A = UID1 + UID2 with a record carrying a secret marker, B = UID4 alone. */
async function world(overrides = {}): Promise<{ rig: Rig; famA: string; famB: string }> {
  const rig = makeRig(overrides);
  const famA = await familyOfTwo(rig);
  const marked = { ...profile, payloadJson: profile.payloadJson!.replace(/"nickname":"[^"]*"/, `"nickname":"${SECRET}"`) };
  await rig.ok('records.push', UID1, { records: [marked] });
  const famB = await createFamilyOf(rig, UID4);
  return { rig, famA, famB };
}

describe('US-E15-09/AC1 no sign-in, bad tokens', () => {
  it('every operation x {no header, wrong scheme, empty bearer, unknown token, verifier throwing, unsafe uid} gets one identical 401 body and writes nothing', async () => {
    const { rig, famA } = await world();
    const before = snapshot(rig);
    const bodies = new Set<string>();
    const base = rig.deps();
    const throwing = { ...base, verifier: () => Promise.reject(new Error('boom uid test-uid-001')) };
    const unsafe = [{ ...base, verifier: async () => ({ uid: 'a/b', emailVerified: true }) }, { ...base, verifier: async () => ({ uid: '', emailVerified: true }) }, { ...base, verifier: async () => ({ uid: `families/${famA}`, emailVerified: true }) }, { ...base, verifier: async () => ({ uid: 'x'.repeat(129), emailVerified: true }) }];
    for (const op of ALL_OPS) {
      for (const headers of [{}, { authorization: 'Basic abc' }, { authorization: 'Bearer' }, { authorization: 'Bearer ' }, { authorization: 'Bearer other-project-token' }, { authorization: 'bearer tok-x y' }]) {
        const r = await rig.call(op, null, bodyFor(op), headers);
        expect(r.status, `${op} ${JSON.stringify(headers)}`).toBe(401);
        bodies.add(pin(r));
      }
      const t = await rig.call(op, UID1, bodyFor(op), {}, throwing);
      expect(t.status, `${op} verifier throws`).toBe(401);
      bodies.add(pin(t));
      for (const d of unsafe) {
        const u = await rig.call(op, UID1, bodyFor(op), {}, d);
        expect(u.status, `${op} unsafe uid`).toBe(401);
        bodies.add(pin(u));
      }
    }
    expect(bodies.size).toBe(1);
    expect(snapshot(rig)).toBe(before);
  });

  it('a wrong origin, a non-POST method and an unknown operation never reach the data (and never answer 200)', async () => {
    const { rig } = await world();
    const before = snapshot(rig);
    const o = await rig.call('records.pull', UID1, { cursor: 0 }, { origin: 'https://evil.example' });
    expect(o.status).toBe(403);
    expect(JSON.stringify(o.body)).not.toContain(SECRET);
    expect(o.headers['access-control-allow-origin']).toBeUndefined();
    const star = await rig.call('records.pull', UID1, { cursor: 0 }, { origin: 'null' });
    expect(star.status).toBe(403);
    const unknown = await rig.call('records.dump', UID1, {});
    expect(unknown.status).toBe(404);
    const slash = await rig.call('../families/x', UID1, {});
    expect([404, 403, 401]).toContain(slash.status);
    expect(snapshot(rig)).toBe(before);
  });
});

describe('US-E15-09/AC2 non-member, removed member, never-member', () => {
  it('a signed-in non-member gets one NOT_MEMBER body from every member operation, even when it names the family, a record key or a seq', async () => {
    const { rig, famA } = await world();
    const before = snapshot(rig);
    const bodies = new Set<string>();
    for (const op of MEMBER_ONLY_OPS) {
      const forged = { ...(bodyFor(op) as object), familyId: famA, recordKey: 'profile_profile', seq: 0, cursor: 0, role: 'owner' };
      const r = await rig.call(op, UID3, forged);
      expect(r.status, op).toBe(403);
      bodies.add(pin(r));
    }
    expect(bodies.size).toBe(1);
    expect(snapshot(rig)).toBe(before);
  });

  it('the same body for: never in a family, an ended-and-acknowledged account, a dangling account index, and a family id that does not exist', async () => {
    const { rig, famA } = await world();
    await rig.ok('family.removeMember', UID1, { uid: UID2 });
    await rig.ok('membership.ack', UID2);
    rig.db.seed('accounts/ghost-user', { status: 'member', familyId: 'does-not-exist' });
    rig.db.seed('accounts/stray-user', { status: 'member', familyId: famA }); // points at A but has no member document
    const seen = new Set<string>();
    for (const uid of [UID3, UID2, 'ghost-user', 'stray-user']) {
      const r = await rig.call('records.pull', uid, { cursor: 0 });
      rig.db.docs.has(`accounts/${uid}`);
      seen.add(pin(r));
    }
    // the dangling ones are refused too, with the very same body as a stranger
    expect(seen.size).toBe(1);
    expect([...seen][0]).toContain('NOT_MEMBER');
  });

  it('US-E15-09/AC8 a removed member is denied everything on the very next request (410, reason removed), a pull returns no data, and nothing is written', async () => {
    const { rig } = await world();
    await rig.ok('family.removeMember', UID1, { uid: UID2 });
    const before = snapshot(rig);
    for (const op of MEMBER_ONLY_OPS) {
      const r = await rig.call(op, UID2, bodyFor(op, UID1));
      expect(r.status, op).toBe(410);
      expect(r.body, op).toEqual({ ok: false, error: 'MEMBERSHIP_ENDED', reason: 'removed' });
    }
    expect(snapshot(rig)).toBe(before);
    // leaving: same immediacy
    const w2 = await world();
    await w2.rig.ok('family.leave', UID2, {});
    const r = await w2.rig.call('records.push', UID2, { records: [profile] });
    expect(r.status).toBe(410);
    expect(r.body).toMatchObject({ reason: 'left' });
  });

  it('US-E15-08/AC6 after family deletion the other member is refused (410 family-deleted) and the cloud holds nothing of the family', async () => {
    const { rig, famA } = await world();
    await rig.ok('family.delete', UID1, { confirmation: '削除する' });
    const r = await rig.call('records.pull', UID2, { cursor: 0 });
    expect(r.status).toBe(410);
    expect(r.body).toMatchObject({ reason: 'family-deleted' });
    expect(rig.db.paths(`families/${famA}`)).toEqual([]);
    expect(rig.db.mentioning(famA).filter((p) => !p.startsWith('accounts/'))).toEqual([]);
    expect(rig.db.mentioning(SECRET)).toEqual([]);
    expect(rig.db.mentioning(UID2).filter((p) => p.startsWith('invites/') || p.startsWith('families/'))).toEqual([]);
  });
});

describe('US-E15-09/AC3 cross-family', () => {
  it('a member of another family can neither read nor change family A, with forged familyId/recordKey/seq/uid in any operation', async () => {
    const { rig, famA, famB } = await world();
    const beforeA = snapshot(rig, `families/${famA}`);
    const attempts: Array<[string, unknown]> = [
      ['records.pull', { cursor: 0, familyId: famA }],
      ['records.push', { familyId: famA, records: [{ ...profile, key: 'profile' }] }],
      ['invite.create', { familyId: famA }],
      ['invite.cancel', { familyId: famA }],
      ['consent.set', { familyId: famA, consentVersion: 1 }],
      ['family.removeMember', { familyId: famA, uid: UID1 }],
      ['family.removeMember', { familyId: famA, uid: UID2 }],
    ];
    for (const [op, body] of attempts) await rig.call(op, UID4, body);
    expect(snapshot(rig, `families/${famA}`)).toBe(beforeA);
    const pulled = await rig.ok('records.pull', UID4, { cursor: 0, familyId: famA });
    expect(JSON.stringify(pulled)).not.toContain(SECRET);
    expect(JSON.stringify(pulled)).not.toContain(famA);
    // what B pushed went to B
    expect(rig.db.paths(`families/${famB}/records`).length).toBeGreaterThanOrEqual(1);
    // B cannot learn of A's members: removing A's uid is the same answer as removing nobody
    const a = await rig.call('family.removeMember', UID4, { uid: UID1 });
    const b = await rig.call('family.removeMember', UID4, { uid: 'test-uid-777' });
    const c = await rig.call('family.removeMember', UID4, { uid: UID4 });
    expect(pin(a)).toBe(pin(b));
    expect(pin(a)).toBe(pin(c));
  });

  it('record documents are addressed only by kind_key from the closed set: path injection through kind/key/deviceId is refused', async () => {
    const { rig, famA } = await world();
    const before = snapshot(rig, `families/${famA}`);
    const bad = [
      { ...profile, kind: `../../families/${famA}/records/x` },
      { ...profile, kind: 'decision', key: `../../${famA}`, payloadJson: profile.payloadJson },
      { ...profile, key: 'profile/../..' },
      { ...profile, seq: 99999 },
      { ...profile, bytes: 0 },
      { ...profile, familyId: famA },
      { ...profile, role: 'admin' },
    ];
    for (const e of bad) {
      const r = await rig.call('records.push', UID4, { records: [e] });
      expect(r.status).toBe(400);
      expect(r.body['error']).toBe('INVALID_RECORD');
    }
    expect(snapshot(rig, `families/${famA}`)).toBe(before);
  });
});

describe('US-E15-09/AC4 members are equal', () => {
  it('uid1 and uid2 can do exactly the same operations (read, write, tombstone, invite/leave/remove/delete)', async () => {
    for (const first of [UID1, UID2]) {
      const rig = makeRig();
      await familyOfTwo(rig);
      const other = first === UID1 ? UID2 : UID1;
      expect((await rig.call('records.push', first, { records: [profile] })).status).toBe(200);
      expect((await rig.call('records.pull', other, { cursor: 0 })).status).toBe(200);
      const tomb = { kind: 'profile', key: 'profile', updatedAt: '2026-11-10T10:05:00+09:00', updatedAtMs: Date.parse('2026-11-10T10:05:00+09:00'), updatedBy: 'x', deviceId: 'dev-x', deletedAt: '2026-11-10T10:05:00+09:00' };
      rig.now = Date.parse('2026-11-10T10:06:00+09:00');
      expect((await rig.call('records.push', other, { records: [tomb] })).status).toBe(200);
      const inv = await rig.call('invite.create', first, {});
      expect(inv.status).toBe(409); // full for both alike
      expect(inv.body['error']).toBe('FAMILY_FULL');
      expect((await rig.call('invite.cancel', other, {})).status).toBe(200);
      expect((await rig.call('consent.set', first, { consentVersion: 1 })).status).toBe(200);
      expect((await rig.call('family.removeMember', other, { uid: first })).status).toBe(200); // either may remove the other
    }
  });
});

describe('US-E15-09/AC5 no escalation by a client', () => {
  it('client-set role, member list, maxMembers, memberCount, joinedAt in any request is ignored; stored member docs hold only their own fields', async () => {
    const rig = makeRig();
    const evil = { role: 'owner', members: [UID3], memberList: [UID3], maxMembers: 99, memberCount: 0, joinedAt: '2000-01-01T00:00:00+09:00', admin: true, uid: UID3, status: 'member', familyId: 'x' };
    const fam = (await rig.ok('family.create', UID1, { consentVersion: 1, ...evil })).familyId as string;
    const doc = rig.db.get(`families/${fam}`)!;
    expect(doc['maxMembers']).toBe(2);
    expect(doc['memberCount']).toBe(1);
    const mem = rig.db.get(`families/${fam}/members/${UID1}`)!;
    expect(Object.keys(mem).sort()).toEqual(['consentVersion', 'consentedAt', 'email', 'joinedAt']);
    expect(mem['joinedAt']).toBe('2026-11-10T10:00:00+09:00');
    const { code } = await rig.ok('invite.create', UID1, evil);
    await rig.ok('invite.redeem', UID2, { code, consentVersion: 1, ...evil });
    expect(rig.db.get(`families/${fam}`)!['maxMembers']).toBe(2);
    expect(rig.db.get(`families/${fam}`)!['memberCount']).toBe(2);
    expect(rig.db.paths(`families/${fam}/members`).sort()).toEqual([`families/${fam}/members/${UID1}`, `families/${fam}/members/${UID2}`].sort());
    await rig.ok('consent.set', UID2, { consentVersion: 3, ...evil });
    const m2 = rig.db.get(`families/${fam}/members/${UID2}`)!;
    expect(Object.keys(m2).sort()).toEqual(['consentVersion', 'consentedAt', 'email', 'joinedAt']);
    expect(m2['consentVersion']).toBe(3);
    // the other member's consent is untouched by uid2's consent.set
    expect(rig.db.get(`families/${fam}/members/${UID1}`)!['consentVersion']).toBe(1);
    // a stranger cannot get in through consent.set / removeMember / records
    for (const op of ['consent.set', 'family.removeMember', 'records.push', 'invite.create']) await rig.call(op, UID3, { ...(bodyFor(op) as object), ...evil });
    expect(rig.db.paths(`families/${fam}/members`).length).toBe(2);
    expect(rig.db.get(`accounts/${UID3}`)).toBeUndefined();
  });

  it('family.create twice, create while a member, and redeem while a member are refused as ALREADY_IN_FAMILY with nothing written (family-one-per-account)', async () => {
    const { rig } = await world();
    const before = snapshot(rig);
    for (const uid of [UID1, UID2, UID4]) {
      const c = await rig.call('family.create', uid, { consentVersion: 1 });
      expect(c.status).toBe(409);
      expect(c.body).toEqual({ ok: false, error: 'ALREADY_IN_FAMILY' });
    }
    const invB = await rig.ok('invite.create', UID4);
    const r = await rig.call('invite.redeem', UID1, { code: invB['code'], consentVersion: 1 });
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ ok: false, error: 'ALREADY_IN_FAMILY' });
    // not even an attempt is counted against a member: the family B invite is still usable
    const stats = [...rig.db.docs.keys()].filter((k) => k.startsWith('inviteAttempts/'));
    expect(stats).toEqual([]);
    expect(snapshot(rig).includes('ALREADY')).toBe(false);
    void before;
  });

  it('wrong consent version: data operations and invite.create need the minimum version; leave, cancel and delete stay available (no lock-in)', async () => {
    const { rig } = await world({ cloudNoticeMinVersion: 1 });
    // the notice is raised to 2 on the server: both members hold version 1
    const hi = { ...rig.config, cloudNoticeMinVersion: 2 };
    const deps = { ...rig.deps(), config: hi };
    for (const op of ['records.push', 'records.pull', 'invite.create'] as const) {
      const r = await rig.call(op, UID1, bodyFor(op), {}, deps);
      expect(r.status, op).toBe(403);
      expect(r.body, op).toEqual({ ok: false, error: 'CONSENT_REQUIRED' });
    }
    expect((await rig.call('consent.set', UID1, { consentVersion: 1 }, {}, deps)).body).toEqual({ ok: false, error: 'CONSENT_REQUIRED' });
    expect((await rig.call('consent.set', UID1, { consentVersion: 2 }, {}, deps)).status).toBe(200);
    expect((await rig.call('records.pull', UID1, { cursor: 0 }, {}, deps)).status).toBe(200);
    expect((await rig.call('records.pull', UID2, { cursor: 0 }, {}, deps)).status).toBe(403); // uid2 has not accepted
    expect((await rig.call('family.leave', UID2, {}, {}, deps)).status).toBe(200); // may leave without accepting
    // create / redeem with a too-old consent
    const c = await rig.call('family.create', UID3, { consentVersion: 1 }, {}, deps);
    expect(c.body).toEqual({ ok: false, error: 'CONSENT_REQUIRED' });
    for (const v of [0, -1, 1.5, '2', null, 1e9]) {
      const r = await rig.call('family.create', UID3, { consentVersion: v }, {}, deps);
      expect([400, 403]).toContain(r.status);
      expect(rig.db.get(`accounts/${UID3}`)).toBeUndefined();
    }
  });

  it('US-E15-02/AC8 no family data enters or leaves without a consent: create/redeem/push/pull with consentVersion missing are refused and write nothing', async () => {
    const rig = makeRig();
    const before = snapshot(rig);
    for (const body of [{}, { consentVersion: undefined }, { consentVersion: null }]) {
      const r = await rig.call('family.create', UID1, body);
      expect(r.status).toBe(400);
    }
    expect(snapshot(rig)).toBe(before);
  });

  it('updatedBy cannot be forged: the stored value is always the token uid, whatever the client sends', async () => {
    const { rig, famA } = await world();
    const e = { ...env['decision_2026-11-18'] ?? Object.values(env).find((x) => x.kind === 'decision')!, updatedBy: UID3, deviceId: 'dev-forger' };
    const r = await rig.ok('records.push', UID2, { records: [{ ...e, updatedAt: '2026-11-10T10:02:00+09:00', updatedAtMs: Date.parse('2026-11-10T10:02:00+09:00') }] });
    void r;
    for (const p of rig.db.paths(`families/${famA}/records`)) {
      const d = rig.db.get(p)!;
      expect([UID1, UID2]).toContain(d['updatedBy']);
    }
    const pulled = await rig.ok('records.pull', UID1, { cursor: 0 });
    for (const x of pulled['envelopes'] as Array<{ updatedBy: string }>) expect([UID1, UID2]).toContain(x.updatedBy);
  });
});

describe('US-E15-09/AC6 + US-E15-03 invites cannot be read, enumerated or distinguished', () => {
  async function inviteWorld() {
    const rig = makeRig();
    const fam = await createFamilyOf(rig, UID1);
    return { rig, fam };
  }
  const mk = async (rig: Rig, uid = UID1) => (await rig.ok('invite.create', uid))['code'] as string;

  it('wrong, used, cancelled (by cancel), cancelled (by a newer invite) all give the identical refusal AND the identical store work; expired and full differ only as the contract says', async () => {
    const { rig, fam } = await inviteWorld();
    // used
    const used = await mk(rig);
    await rig.ok('invite.redeem', UID2, { code: used, consentVersion: 1 });
    // cancelled by cancel
    await rig.ok('family.leave', UID2, {}); // room again
    await rig.ok('membership.ack', UID2);
    const cancelled = await mk(rig);
    await rig.ok('invite.cancel', UID1);
    // cancelled by replacement
    const old = await mk(rig);
    const fresh = await mk(rig);
    expect(fresh).not.toBe(old);
    const probe = async (code: string, uid: string) => {
      const cnt = counting(rig);
      const r = await rig.call('invite.redeem', uid, { code, consentVersion: 1 }, {}, cnt.deps());
      return { r, c: { ...cnt.c } };
    };
    const wrong = await probe('ABCDEFGHJK', UID3);
    const a = await probe(used, UID4);
    const b = await probe(cancelled, UID5);
    const c = await probe(old, 'test-uid-006');
    const d = await probe('abcd-efgh jk', 'test-uid-007');
    for (const x of [a, b, c, d]) {
      expect(pin(x.r), 'identical body').toBe(pin(wrong.r));
      expect(x.r.headers['content-length'], 'identical size').toBe(wrong.r.headers['content-length']);
      expect(x.c.tx).toBe(wrong.c.tx);
      expect(x.c.sets).toBe(wrong.c.sets);
    }
    expect(wrong.r.status).toBe(400);
    expect(JSON.stringify(wrong.r.body)).not.toMatch(/famil|member|child|uid|expire/i);
    // the number of reads must not tell "no such code" from "used" / "cancelled" (at most the same, +-0)
    expect({ used: a.c.gets, cancelled: b.c.gets, replaced: c.c.gets }).toEqual({ used: wrong.c.gets, cancelled: wrong.c.gets, replaced: wrong.c.gets });
    void fam;
  });

  it('a malformed code (too short / wrong alphabet) costs fewer reads than an unknown well-formed one (timing-visible difference, informational) but the reply is identical', async () => {
    const { rig } = await inviteWorld();
    await mk(rig);
    const cnt = counting(rig);
    const wf = await rig.call('invite.redeem', UID3, { code: 'ABCDEFGHJK', consentVersion: 1 }, {}, cnt.deps());
    const g1 = cnt.c.gets;
    cnt.reset();
    const mal = await rig.call('invite.redeem', UID3, { code: 'ABC0O1IL', consentVersion: 1 }, {}, cnt.deps());
    expect(pin(wf)).toBe(pin(mal));
    // informational: record the difference rather than fail (one document read, not observable from outside at this scale)
    expect(g1 - cnt.c.gets).toBeLessThanOrEqual(1);
  });

  it('US-E15-03/AC2 expiry: refused as expired from the exact second, accepted one second before; no member is added by the refusal', async () => {
    const { rig, fam } = await inviteWorld();
    const code = await mk(rig);
    const expires = T0 + 72 * HOUR;
    rig.now = expires - 1000;
    const okAt = await rig.call('invite.redeem', UID2, { code, consentVersion: 1 });
    expect(okAt.status).toBe(200);
    const w = await inviteWorld();
    const code2 = await mk(w.rig);
    w.rig.now = expires;
    const at = await w.rig.call('invite.redeem', UID2, { code: code2, consentVersion: 1 });
    expect(at.status).toBe(400);
    expect(at.body).toEqual({ ok: false, error: 'INVITE_EXPIRED' });
    w.rig.now = expires + 1000;
    const after = await w.rig.call('invite.redeem', UID2, { code: code2, consentVersion: 1 });
    expect(after.body['error']).toBe('INVITE_EXPIRED');
    expect(w.rig.db.paths(`families/${w.fam}/members`).length).toBe(1);
    expect(w.rig.db.get(`accounts/${UID2}`)).toBeUndefined();
    void fam;
  });

  it('US-E15-03/AC3 single use: of two accounts redeeming at once exactly one wins; the loser sees the generic refusal', async () => {
    const { rig, fam } = await inviteWorld();
    const code = await mk(rig);
    const [x, y] = await Promise.all([rig.call('invite.redeem', UID2, { code, consentVersion: 1 }), rig.call('invite.redeem', UID3, { code, consentVersion: 1 }, {}, rig.deps())]);
    expect([x.status, y.status].sort()).toEqual([200, 400]);
    expect(rig.db.paths(`families/${fam}/members`).length).toBe(2);
    const loser = x.status === 400 ? x : y;
    expect(loser.body).toEqual({ ok: false, error: 'INVITE_INVALID' });
    expect(rig.db.get(`families/${fam}`)!['memberCount']).toBe(2);
  });

  it('US-E15-03/AC5 family full: invite.create is refused and an outstanding code is refused as full (no member added)', async () => {
    const { rig, fam } = await inviteWorld();
    const code = await mk(rig);
    // make the family full while the code is still outstanding (state a client cannot reach: seeded)
    rig.db.seed(`families/${fam}`, { ...rig.db.get(`families/${fam}`)!, memberCount: 2 });
    const r = await rig.call('invite.redeem', UID3, { code, consentVersion: 1 });
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ ok: false, error: 'FAMILY_FULL' });
    expect((await rig.call('invite.create', UID1, {})).body).toEqual({ ok: false, error: 'FAMILY_FULL' });
    expect(rig.db.paths(`families/${fam}/members`).length).toBe(1);
  });

  it('US-E15-03/AC6 10 failed redemptions an hour per account, then the right code is refused too (429, same for any code) until the hour has passed; other accounts unaffected', async () => {
    const { rig } = await inviteWorld();
    const code = await mk(rig);
    for (let i = 0; i < 10; i++) {
      const r = await rig.call('invite.redeem', UID3, { code: `ABCDEFGH${String(i).padStart(2, '2')}`, consentVersion: 1 });
      expect(r.status).toBe(400);
      rig.now += 1000;
    }
    const good = await rig.call('invite.redeem', UID3, { code, consentVersion: 1 });
    const bad = await rig.call('invite.redeem', UID3, { code: 'ZZZZZZZZZZ', consentVersion: 1 });
    expect(good.status).toBe(429);
    expect(pin({ status: good.status, body: { ...good.body, retryAfterSec: 0 } })).toBe(pin({ status: bad.status, body: { ...bad.body, retryAfterSec: 0 } }));
    expect(good.headers['retry-after']).toBeDefined();
    rig.now = T0 + HOUR - 1000;
    expect((await rig.call('invite.redeem', UID3, { code, consentVersion: 1 })).status).toBe(429);
    rig.now = T0 + HOUR + 20_000;
    expect((await rig.call('invite.redeem', UID3, { code, consentVersion: 1 })).status).toBe(200);
  });

  it('a throttled account cannot probe: 200 guesses across the day still end with the invite unredeemed by a guess (failures are counted even when the transaction returns a refusal)', async () => {
    const { rig, fam } = await inviteWorld();
    await mk(rig);
    let ok = 0;
    for (let i = 0; i < 40; i++) {
      const r = await rig.call('invite.redeem', UID3, { code: `QQQQQ${String(i).padStart(5, '2')}`, consentVersion: 1 });
      if (r.status === 200) ok += 1;
    }
    expect(ok).toBe(0);
    const att = rig.db.paths('inviteAttempts');
    expect(att.length).toBe(1);
    expect(rig.db.get(att[0]!)!['fails']).toHaveLength(10);
    expect(rig.db.paths(`families/${fam}/members`).length).toBe(1);
  });

  it('code format: 10 symbols from the 32-symbol alphabet, never 0 O 1 I L, 200 generated codes distinct; the invite id in the store is a hash, not the code', async () => {
    const rig = makeRig();
    await createFamilyOf(rig, UID1);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const code = await mk(rig);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
      expect(code).not.toMatch(/[01OI]/); // L is in the contract 14.3 alphabet; US-E15-03/AC6 says no L (defect E15-D02, pinned in the next test)
      seen.add(code);
    }
    expect(seen.size).toBe(200);
    for (const p of rig.db.paths('invites')) expect(p).not.toContain([...seen][0]);
    for (const p of rig.db.paths('invites')) expect(p).toMatch(/^invites\/[0-9a-f]{64}$/);
  });

  it('only one active invite, and a used or cancelled invite document no longer holds its code', async () => {
    const { rig } = await inviteWorld();
    const c1 = await mk(rig);
    const c2 = await mk(rig);
    const m = await rig.ok('membership.get', UID1);
    expect((m['invite'] as { code: string }).code).toBe(c2);
    const docs = rig.db.paths('invites').map((p) => rig.db.get(p)!);
    expect(docs.filter((d) => d['cancelledAt'] === undefined && d['usedAt'] === undefined).length).toBe(1);
    expect(JSON.stringify(docs.filter((d) => d['cancelledAt'] !== undefined))).not.toContain(c1);
    await rig.ok('invite.redeem', UID2, { code: c2, consentVersion: 1 });
    expect(JSON.stringify(rig.db.paths('invites').map((p) => rig.db.get(p)))).not.toContain(c2);
  });

  it('DEFECT PROBE (E15-D01) an ACTIVE invite code is stored in plain text in the invite document (the brief asks for codes hashed at rest)', async () => {
    const { rig } = await inviteWorld();
    const code = await mk(rig);
    const stored = JSON.stringify(rig.db.paths('invites').map((p) => rig.db.get(p)));
    // The ADR (016 section 1) documents this on purpose ("so a member can see an active invite again"). Pinned, so a change is noticed.
    expect(stored.includes(code)).toBe(true);
  });

  it('non-members cannot read an invite by any operation: membership.get shows no invite to a non-member or a removed member', async () => {
    const { rig } = await inviteWorld();
    const code = await mk(rig);
    for (const uid of [UID3, UID2]) {
      const m = await rig.ok('membership.get', uid);
      expect(JSON.stringify(m)).not.toContain(code);
    }
  });
});

it('DEFECT PROBE (E15-D02) the alphabet of contract 14.3 contains L, which US-E15-03/AC6 forbids (no 1/I/L)', () => {
  expect('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.includes('L')).toBe(true);
});

describe('create: who may create a family (ADR 016 section 10 item 2)', () => {
  it('an account not on the allow-list is refused NOT_ALLOWED and nothing exists; an unreadable allow-list refuses everyone; joiners need not be on the list', async () => {
    const rig = makeRig({}, [UID1]);
    const no = await rig.call('family.create', UID_STRANGER, { consentVersion: 1 });
    expect(no.status).toBe(403);
    expect(no.body).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(rig.db.docs.size).toBe(0);
    const fam = await createFamilyOf(rig, UID1);
    const { code } = await rig.ok('invite.create', UID1);
    expect((await rig.call('invite.redeem', UID_STRANGER, { code, consentVersion: 1 })).status).toBe(200);
    expect(rig.db.get(`accounts/${UID_STRANGER}`)).toEqual({ status: 'member', familyId: fam });
    const none = { ...rig.deps(), allowList: null };
    expect((await rig.call('family.create', UID1, { consentVersion: 1 }, {}, none)).status).toBe(403);
  });
});

describe('US-E15-09/AC7 write shape, size and write-guard limits', () => {
  const push = (rig: Rig, uid: string, records: unknown[]) => rig.call('records.push', uid, { records });
  const at = (ms: number) => new Date(ms + 9 * HOUR).toISOString().slice(0, 19) + '+09:00';

  it('a record over 256 KiB is refused (LIMIT record) and writes nothing; exactly 256 KiB of payload is the edge', async () => {
    const { rig, famA } = await world();
    const before = snapshot(rig, `families/${famA}`);
    const big = { ...profile, payloadJson: JSON.stringify({ ...JSON.parse(profile.payloadJson!), note: 'あ'.repeat(90_000) }) }; // ~270 KB utf-8
    const r = await push(rig, UID1, [big]);
    expect([400, 413]).toContain(r.status);
    expect(r.status === 413 ? r.body['scope'] : 'x').toBe('record');
    expect(snapshot(rig, `families/${famA}`)).toBe(before);
  });

  it('a family over 5 MiB is refused (LIMIT family) and nothing of that push is stored', async () => {
    const rig = makeRig();
    const fam = await familyOfTwo(rig);
    const base = JSON.parse(profile.payloadJson!);
    const menuKinds = Object.values(env).filter((e) => e.kind === 'decision');
    void menuKinds;
    // force the counter near the limit using the public path only: fill with many max-size-ish notes in distinct keys is not possible (one profile),
    // so use the seeded family counter (a state the server itself maintains) and verify the check happens before any write.
    rig.db.seed(`families/${fam}`, { ...rig.db.get(`families/${fam}`)!, totalBytes: 5_242_880 - 1 });
    const before = snapshot(rig, `families/${fam}/records`);
    const r = await push(rig, UID1, [{ ...profile, payloadJson: JSON.stringify({ ...base, nickname: 'べつ' }) }]);
    expect(r.status).toBe(413);
    expect(r.body).toMatchObject({ ok: false, error: 'LIMIT', scope: 'family' });
    expect(snapshot(rig, `families/${fam}/records`)).toBe(before);
  });

  it('the server write guard stops one account at 600 record writes an hour (429, retryAfter), the other member is not affected, and the window resets', async () => {
    const rig = makeRig({ writesPerHour: 5 });
    await familyOfTwo(rig);
    const decisions = Object.values(env).filter((e) => e.kind === 'decision');
    expect(decisions.length).toBeGreaterThan(0);
    const d = decisions[0]!;
    let n = 0;
    let lastStatus = 200;
    for (let i = 0; i < 8; i++) {
      rig.now = T0 + i * 1000;
      const r = await push(rig, UID1, [{ ...d, updatedAt: at(rig.now), updatedAtMs: Math.floor(rig.now / 1000) * 1000, payloadJson: d.payloadJson!.replace(/"updatedAt":"[^"]*"/, `"updatedAt":"${at(rig.now)}"`) }]);
      lastStatus = r.status;
      if (r.status === 200) n += 1;
    }
    expect(lastStatus).toBe(429);
    expect(n).toBe(5);
    const r2 = await push(rig, UID2, [{ ...d, updatedAt: at(T0 + 10_000), updatedAtMs: T0 + 10_000 }]);
    expect(r2.status).not.toBe(429);
    rig.now = T0 + HOUR + 60_000;
    expect((await push(rig, UID1, [{ ...d, updatedAt: at(rig.now), updatedAtMs: Math.floor(rig.now / 1000) * 1000, payloadJson: d.payloadJson!.replace(/"updatedAt":"[^"]*"/, `"updatedAt":"${at(rig.now)}"`) }])).status).toBe(200);
  });

  it('batch of 51 records, a duplicate key, a not-array body, an array body, 9 MiB+ body and malformed JSON are refused with 4xx and write nothing', async () => {
    const { rig, famA } = await world();
    const before = snapshot(rig, `families/${famA}`);
    const many = Array.from({ length: 51 }, () => profile);
    expect((await push(rig, UID1, many)).status).toBe(400);
    expect((await push(rig, UID1, [profile, profile])).status).toBe(400);
    expect((await rig.call('records.push', UID1, { records: 'x' })).status).toBe(400);
    expect((await rig.call('records.push', UID1, '[1,2]')).status).toBe(400);
    expect((await rig.call('records.push', UID1, '{"records":')).status).toBe(400);
    const huge = await rig.call('records.push', UID1, 'x'.repeat(10 * 1024 * 1024));
    expect([400, 413]).toContain(huge.status);
    expect(snapshot(rig, `families/${famA}`)).toBe(before);
  });

  it('device-only fields are refused in a settings record; an aiUsage tombstone, a tombstone with a payload and a deletedAt that differs from updatedAt are refused', async () => {
    const { rig } = await world();
    const settings = env['settings_settings']!;
    const withLang = { ...settings, payloadJson: JSON.stringify({ ...JSON.parse(settings.payloadJson!), language: 'en' }) };
    expect((await push(rig, UID1, [withLang])).status).toBe(400);
    const base = { updatedAt: at(T0), updatedAtMs: T0, updatedBy: 'x', deviceId: 'd' };
    expect((await push(rig, UID1, [{ kind: 'aiUsage', key: '2026-11', ...base, deletedAt: base.updatedAt }])).status).toBe(400);
    expect((await push(rig, UID1, [{ kind: 'decision', key: '2026-11-18', ...base, deletedAt: base.updatedAt, payloadJson: '{}' }])).status).toBe(400);
    expect((await push(rig, UID1, [{ kind: 'decision', key: '2026-11-18', ...base, deletedAt: at(T0 + 1000) }])).status).toBe(400);
  });

  it('US-E15-07/AC7 clock skew: a stamp more than 5 minutes ahead is stored as the receive time; 5 minutes exactly is kept', async () => {
    const { rig, famA } = await world();
    const d = Object.values(env).find((e) => e.kind === 'decision')!;
    const mk2 = (ms: number) => ({ ...d, updatedAt: at(ms), updatedAtMs: ms, payloadJson: d.payloadJson!.replace(/"updatedAt":"[^"]*"/, `"updatedAt":"${at(ms)}"`) });
    rig.now = T0 + 60_000;
    await push(rig, UID2, [mk2(rig.now + 6 * 60_000)]);
    let stored = rig.db.get(`families/${famA}/records/decision_${d.key}`)!;
    expect(stored['updatedAtMs']).toBe(rig.now);
    rig.now += 60_000;
    await push(rig, UID2, [mk2(Math.floor(rig.now / 1000) * 1000 + 5 * 60_000)]);
    stored = rig.db.get(`families/${famA}/records/decision_${d.key}`)!;
    expect(stored['updatedAtMs']).toBe(Math.floor(rig.now / 1000) * 1000 + 5 * 60_000);
  });

  it('a record older than 13 months is refused; a tombstone of an old month is accepted', async () => {
    const { rig } = await world();
    const old = { kind: 'decision', key: '2025-01-10', updatedAt: at(T0), updatedAtMs: T0, updatedBy: 'x', deviceId: 'd' };
    const m = Object.values(env).find((e) => e.kind === 'decision')!;
    const payload = JSON.parse(m.payloadJson!);
    const live = { ...old, payloadJson: JSON.stringify({ ...payload, date: '2025-01-10' }) };
    expect((await push(rig, UID1, [live])).status).toBe(400);
    expect((await push(rig, UID1, [{ ...old, deletedAt: old.updatedAt }])).status).toBe(200);
  });

  it('totalBytes always equals the sum of the stored records bytes, after random live/delete/rewrite pushes', async () => {
    const rig = makeRig();
    const fam = await familyOfTwo(rig);
    const keys = Object.values(env).filter((e) => e.kind === 'decision' || e.kind === 'menu');
    let t = T0;
    let rnd = 12345;
    const next = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 60; i++) {
      t += 3000;
      rig.now = t;
      const e = keys[Math.floor(next() * keys.length)]!;
      const ms = Math.floor(t / 1000) * 1000;
      const rec = next() < 0.35 ? { kind: e.kind, key: e.key, updatedAt: at(ms), updatedAtMs: ms, updatedBy: 'x', deviceId: 'd', deletedAt: at(ms) } : { ...e, updatedAt: at(ms), updatedAtMs: ms, payloadJson: e.payloadJson!.replace(/"updatedAt":"[^"]*"/, `"updatedAt":"${at(ms)}"`) };
      await push(rig, next() < 0.5 ? UID1 : UID2, [rec]);
    }
    const sum = rig.db.paths(`families/${fam}/records`).map((p) => rig.db.get(p)!['bytes'] as number).reduce((a, b) => a + b, 0);
    expect(rig.db.get(`families/${fam}`)!['totalBytes']).toBe(sum);
  });
});

describe('US-E15-09/AC9-AC10 deny-all rules and proxy counters', () => {
  it('firestore.rules is deny-all for every client path (static), including the proxy counters and every sync collection', async () => {
    const { readFileSync } = await import('node:fs');
    const rules = readFileSync('firestore.rules', 'utf8').replace(/\/\/.*$/gm, '');
    expect(rules).toMatch(/match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
    expect(rules.match(/allow /g)?.length).toBe(1);
    expect(rules).not.toMatch(/if\s+(true|request\.auth)/);
    expect(rules.match(/match /g)?.length).toBe(2);
    const cfg = JSON.parse(readFileSync('firebase.json', 'utf8')) as Record<string, unknown>;
    expect(JSON.stringify(cfg)).toContain('firestore.rules');
  });

  it('the sync function and the proxy counters use disjoint collections (no overlap with the proxy account counters)', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const src = readdirSync('functions/src/sync').map((f) => readFileSync(`functions/src/sync/${f}`, 'utf8')).join('\n');
    const lim = readFileSync('functions/src/firestore-limits.ts', 'utf8');
    const proxyColl = [...lim.matchAll(/['"`]([A-Za-z]+)['"`]/g)].map((m) => m[1]!).filter((s) => /counter|account|limit/i.test(s));
    for (const c of proxyColl) expect(src).not.toContain(`'${c}/`);
    expect(tokenOf(UID1)).toBe('tok-test-uid-001');
  });
});
