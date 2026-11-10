// Cross-instance concurrency (ADR 016 section 1): several function instances share one database. The fake runs transactions
// with optimistic retry, so interleaved callbacks that touch the same documents must serialise, never lose an update.
import { describe, expect, it } from 'vitest';
import type { Envelope, PushResult } from '../../../../src/domain/sync/types.ts';
import { createFamilyOf, DEVICE_A, DEVICE_B, familyOfTwo, fixtureEnvelopes, makeRig, T0, ts, UID1, UID2, UID3 } from './harness.ts';

const env = fixtureEnvelopes();
const profile = env['profile_profile']!;
const menu = env['menu_2026-11']!;
const at = (e: Envelope, ms: number, deviceId = DEVICE_A): Envelope => ({ ...e, updatedAt: ts(ms), updatedAtMs: ms, deviceId });

describe('two function instances on one database', () => {
  it('US-E15-06/AC1 two simultaneous pushes of different records both land: distinct seq values, no lost update, totalBytes is the sum', async () => {
    const rig = makeRig();
    const famId = await familyOfTwo(rig);
    const [a, b] = await Promise.all([rig.call('records.push', UID1, { records: [profile] }, {}, rig.deps()), rig.call('records.push', UID2, { records: [menu] }, {}, rig.deps())]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(rig.db.retries).toBeGreaterThan(0); // they really did collide on the family document
    const family = rig.db.get(`families/${famId}`)!;
    expect(family['seq']).toBe(2);
    expect(family['totalBytes']).toBe(new TextEncoder().encode(profile.payloadJson!).length + new TextEncoder().encode(menu.payloadJson!).length);
    const seqs = [profile, menu].map((e) => rig.db.get(`families/${famId}/records/${e.kind}_${e.key}`)!['seq']).sort();
    expect(seqs).toEqual([1, 2]);
    // A device that pulled between the two commits and one that pulls now converge: cursor 1 returns exactly the second record.
    const rest = (await rig.ok('records.pull', UID1, { cursor: 1 })) as { envelopes: unknown[] };
    expect(rest.envelopes).toHaveLength(1);
  });

  it('US-E15-07/AC1 two simultaneous pushes of the same record end with the same winner whichever commits first', async () => {
    for (const order of [0, 1]) {
      const rig = makeRig();
      const famId = await familyOfTwo(rig);
      const early = rig.call('records.push', UID1, { records: [at(menu, T0 + 1000, DEVICE_A)] }, {}, rig.deps());
      const late = rig.call('records.push', UID2, { records: [at(menu, T0 + 2000, DEVICE_B)] }, {}, rig.deps());
      const pair = order === 0 ? await Promise.all([early, late]) : (await Promise.all([late, early])).reverse();
      const statuses = pair.map((r) => ((r.body['results'] as PushResult[])[0] as PushResult).status);
      expect(statuses[1]).toBe('accepted'); // the later stamp always wins
      expect(rig.db.get(`families/${famId}/records/menu_2026-11`)).toMatchObject({ updatedBy: UID2, deviceId: DEVICE_B });
    }
  });

  it('US-E15-04/AC10 two simultaneous joins with one code: exactly one is added, the other gets the generic refusal', async () => {
    const rig = makeRig({ maxMembers: 3 });
    const famId = await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    const [x, y] = await Promise.all([rig.call('invite.redeem', UID2, { code, consentVersion: 1 }, {}, rig.deps()), rig.call('invite.redeem', UID3, { code, consentVersion: 1 }, {}, rig.deps())]);
    expect([x.status, y.status].sort()).toEqual([200, 400]);
    const loser = x.status === 400 ? x : y;
    expect(loser.body).toEqual({ ok: false, error: 'INVITE_INVALID' });
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ memberCount: 2 });
    expect(rig.db.paths(`families/${famId}/members`)).toHaveLength(2);
    const winner = x.status === 200 ? UID2 : UID3;
    expect(rig.db.get(`accounts/${winner}`)).toMatchObject({ status: 'member', familyId: famId });
    expect(rig.db.get(`accounts/${winner === UID2 ? UID3 : UID2}`)).toBeUndefined();
  });

  it('US-E15-03/AC5 two different invites racing for the last place: the family never exceeds its maximum', async () => {
    const rig = makeRig({ maxMembers: 2 });
    const famId = await createFamilyOf(rig, UID1);
    const { code } = (await rig.ok('invite.create', UID1)) as { code: string };
    const results = await Promise.all([UID2, UID3].map((u) => rig.call('invite.redeem', u, { code, consentVersion: 1 }, {}, rig.deps())));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rig.db.paths(`families/${famId}/members`)).toHaveLength(2);
  });

  it('US-E15-01/AC8 a double tap on "create family" from two instances makes exactly one family', async () => {
    const rig = makeRig();
    const results = await Promise.all([rig.call('family.create', UID1, { consentVersion: 1 }, {}, rig.deps()), rig.call('family.create', UID1, { consentVersion: 1 }, {}, rig.deps())]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(rig.db.paths('families').filter((p) => p.split('/').length === 2)).toHaveLength(1);
    const winner = results.find((r) => r.status === 200)!;
    expect(rig.db.get(`accounts/${UID1}`)).toEqual({ status: 'member', familyId: winner.body['familyId'] });
  });

  it('US-E15-03/AC4 two simultaneous "new invite" calls leave exactly one active invite', async () => {
    const rig = makeRig({ maxMembers: 3 });
    await createFamilyOf(rig, UID1);
    await rig.ok('invite.create', UID1);
    const results = await Promise.all([rig.call('invite.create', UID1, {}, {}, rig.deps()), rig.call('invite.create', UID1, {}, {}, rig.deps())]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    const active = rig.db.paths('invites').filter((p) => rig.db.get(p)!['cancelledAt'] === undefined);
    expect(active).toHaveLength(1);
    const view = (await rig.ok('membership.get', UID1)) as { invite: { code: string } | null };
    expect(rig.db.paths('invites').find((p) => rig.db.get(p)!['code'] === view.invite?.code)).toBe(active[0]);
  });

  it('US-E15-08/AC4 both members leaving at once: one leaves, the other is the last member and must confirm; the family never ends up memberless by accident', async () => {
    const rig = makeRig();
    const famId = await familyOfTwo(rig);
    const results = await Promise.all([rig.call('family.leave', UID1, {}, {}, rig.deps()), rig.call('family.leave', UID2, {}, {}, rig.deps())]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body).toMatchObject({ error: 'CONFIRMATION_REQUIRED', why: 'last-member' });
    expect(rig.db.get(`families/${famId}`)).toMatchObject({ memberCount: 1, status: 'active' });
    expect(rig.db.paths(`families/${famId}/members`)).toHaveLength(1);
  });

  it('US-E15-09/AC8 a removal that commits between a push\'s authorisation and its commit denies that push (no write by a removed member)', async () => {
    const rig = makeRig();
    const famId = await familyOfTwo(rig);
    const other = rig.deps();
    let removed = false;
    rig.db.beforeCommit = async () => {
      if (removed) return;
      removed = true;
      await rig.ok('family.removeMember', UID1, { uid: UID2 }, other); // commits while uid2's push is about to
    };
    const r = await rig.call('records.push', UID2, { records: [profile] });
    expect(r.body).toEqual({ ok: false, error: 'MEMBERSHIP_ENDED', reason: 'removed' });
    expect(rig.db.paths(`families/${famId}/records`)).toEqual([]);
    expect(rig.db.retries).toBeGreaterThan(0);
  });

  it('US-E15-10/AC3 the per-account write guard holds under concurrent pushes: two instances cannot both spend the last of the budget', async () => {
    const rig = makeRig({ writesPerHour: 1 });
    await familyOfTwo(rig);
    const [a, b] = await Promise.all([rig.call('records.push', UID1, { records: [profile] }, {}, rig.deps()), rig.call('records.push', UID1, { records: [menu] }, {}, rig.deps())]);
    expect([a.status, b.status].sort()).toEqual([200, 429]);
  });
});
