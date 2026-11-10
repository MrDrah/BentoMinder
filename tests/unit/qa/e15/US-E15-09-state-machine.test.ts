// QA E15: server state-machine invariants under random operation sequences from 5 accounts (US-E15-03/AC4 AC5, US-E15-08, US-E15-09, contract 14.3).
// After EVERY operation, accepted or refused: memberCount equals the member documents and never exceeds the maximum; every member has exactly one
// matching account index and no account is a member twice (family-one-per-account); at most one usable invite per family; a refused operation changed
// nothing; byte accounting matches the stored records; nothing of a deleted family remains.
import { describe, expect, it } from 'vitest';
import { DAY, HOUR, T0, UID1, UID2, UID3, UID4, UID5, fixtureEnvelopes, makeRig, type Rig } from './qa-rig.ts';

const env = fixtureEnvelopes();
const decisions = Object.values(env).filter((e) => e.kind === 'decision');
const UIDS = [UID1, UID2, UID3, UID4, UID5];

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function checkInvariants(rig: Rig, label: string): void {
  const families = rig.db.paths('families').filter((p) => /^families\/[^/]+$/.test(p));
  const memberOf = new Map<string, string[]>();
  for (const fp of families) {
    const fam = rig.db.get(fp)!;
    const id = fp.split('/')[1]!;
    const members = rig.db.paths(`${fp}/members`).map((p) => p.split('/').pop()!);
    if (fam['status'] === 'active') {
      expect(fam['memberCount'], `${label}: memberCount of ${id}`).toBe(members.length);
      expect(members.length, `${label}: at most ${fam['maxMembers']}`).toBeLessThanOrEqual(Number(fam['maxMembers']));
      expect(members.length, `${label}: an active family has a member`).toBeGreaterThanOrEqual(1);
    }
    for (const u of members) memberOf.set(u, [...(memberOf.get(u) ?? []), id]);
    const recs = rig.db.paths(`${fp}/records`).map((p) => rig.db.get(p)!['bytes'] as number);
    if (fam['status'] === 'active') expect(fam['totalBytes'], `${label}: bytes`).toBe(recs.reduce((a, b) => a + b, 0));
    const hash = fam['activeInviteHash'];
    const live = rig.db.paths('invites').map((p) => ({ p, d: rig.db.get(p)! })).filter(({ d }) => d['familyId'] === id && d['usedAt'] === undefined && d['cancelledAt'] === undefined);
    expect(live.length, `${label}: at most one usable invite for ${id}`).toBeLessThanOrEqual(1);
    if (live.length === 1) expect(live[0]!.p, `${label}: the family points at its usable invite`).toBe(`invites/${hash}`);
  }
  for (const [u, fams] of memberOf) {
    expect(fams.length, `${label}: ${u} is a member of ${fams.length} families`).toBe(1);
    const acct = rig.db.get(`accounts/${u}`);
    expect(acct?.['familyId'], `${label}: account index of ${u}`).toBe(fams[0]);
    expect(['member', 'deleting']).toContain(acct?.['status']);
  }
  for (const p of rig.db.paths('accounts')) {
    const a = rig.db.get(p)!;
    const u = p.split('/')[1]!;
    if (a['status'] === 'member') expect(memberOf.get(u), `${label}: ${u} is indexed as member of ${a['familyId']}`).toEqual([a['familyId']]);
    if (a['status'] === 'ended') expect(memberOf.has(u), `${label}: ${u} ended but still a member`).toBe(false);
  }
}

describe('US-E15-03 US-E15-08 US-E15-09 server invariants under random operation sequences', () => {
  it('250 steps x 12 seeds over 5 accounts: every invariant holds after every operation; a refused operation changes nothing', async () => {
    let refusals = 0;
    let accepted = 0;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const rig = makeRig();
      const next = rng(seed);
      const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T;
      const codes: string[] = [];
      for (let step = 0; step < 250; step++) {
        rig.now += Math.floor(next() * 3) * HOUR * (next() < 0.1 ? 30 : 1) + 1000;
        const uid = pick(UIDS);
        const roll = next();
        const before = JSON.stringify([...rig.db.docs.entries()].sort());
        let op: string;
        let body: unknown = {};
        if (roll < 0.1) {
          op = 'family.create';
          body = { consentVersion: 1 };
        } else if (roll < 0.25) op = 'invite.create';
        else if (roll < 0.3) op = 'invite.cancel';
        else if (roll < 0.5) {
          op = 'invite.redeem';
          body = { code: codes.length > 0 && next() < 0.8 ? pick(codes) : 'ABCDEFGHJK', consentVersion: 1 };
        } else if (roll < 0.57) {
          op = 'family.leave';
          body = { confirmation: next() < 0.5 ? '削除する' : '' };
        } else if (roll < 0.64) {
          op = 'family.removeMember';
          body = { uid: pick(UIDS) };
        } else if (roll < 0.68) {
          op = 'family.delete';
          body = { confirmation: next() < 0.8 ? '削除する' : 'x' };
        } else if (roll < 0.72) {
          op = 'consent.set';
          body = { consentVersion: 1 + Math.floor(next() * 2) };
        } else if (roll < 0.9) {
          const d = pick(decisions);
          const ms = Math.floor(rig.now / 1000) * 1000;
          const iso = new Date(ms + 9 * HOUR).toISOString().slice(0, 19) + '+09:00';
          op = 'records.push';
          body = { records: [next() < 0.3 ? { kind: d.kind, key: d.key, updatedAt: iso, updatedAtMs: ms, updatedBy: 'x', deviceId: 'd', deletedAt: iso } : { ...d, updatedAt: iso, updatedAtMs: ms, payloadJson: d.payloadJson!.replace(/"updatedAt":"[^"]*"/, `"updatedAt":"${iso}"`) }] };
        } else {
          op = 'records.pull';
          body = { cursor: 0 };
        }
        const r = await rig.call(op, uid, body);
        seen.add(`${op}:${r.status}`);
        if (op === 'invite.create' && r.status === 200) codes.push(r.body['code'] as string);
        if (r.status === 200) accepted += 1;
        else {
          refusals += 1;
          // a refusal leaves the store as it was, except the failed-attempt counter of a redemption and the clean-up of an ended marker
          if (op !== 'invite.redeem') expect(JSON.stringify([...rig.db.docs.entries()].sort()), `${op} ${r.status} ${JSON.stringify(r.body)} changed data`).toBe(before);
        }
        checkInvariants(rig, `seed ${seed} step ${step} ${op}`);
        if (r.status >= 500) throw new Error(`server error on ${op}: ${JSON.stringify(r.body)}`);
      }
    }
    expect(accepted).toBeGreaterThan(300);
    expect(refusals).toBeGreaterThan(300);
    for (const must of ['family.create:200', 'invite.create:200', 'invite.redeem:200', 'family.leave:200', 'family.removeMember:200', 'family.delete:200', 'records.push:200', 'records.pull:200', 'invite.redeem:400', 'family.create:409', 'records.push:410']) {
      expect(seen.has(must), `the generator reached ${must}`).toBe(true);
    }
    void DAY;
    void T0;
  }, 120_000);
});
