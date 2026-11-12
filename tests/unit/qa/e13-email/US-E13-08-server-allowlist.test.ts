// QA E13-email (e): US-E13-08/AC9 + US-E14-02 allow-list, through the real pure core (handleSync, isAllowed). Own verifier,
// own allow-lists; nothing taken from the developers' tests. Derived from AC9: an unconfirmed password e-mail never passes the
// allow-list and is never stored in the membership.
import { describe, expect, it } from 'vitest';
import { isAllowed, parseAllowList } from '../../../../server/core/hosted-policy.ts';
import { makeRig } from '../../functions/sync/harness.ts';
import { snapshot } from '../e15/qa-rig.ts';

type Acct = { uid: string; email?: string; emailVerified: boolean };
const ACCTS: Record<string, Acct> = {
  'pw-unverified': { uid: 'pw-unverified', email: 'mama@example.test', emailVerified: false },
  'pw-verified': { uid: 'pw-verified', email: 'mama@example.test', emailVerified: true },
  'pw-caps': { uid: 'pw-caps', email: ' Mama@Example.TEST ', emailVerified: true },
  'pw-noemail': { uid: 'pw-noemail', emailVerified: true },
  'g-owner': { uid: 'g-owner', email: 'owner@example.test', emailVerified: true },
  'pw-uidlisted-unverified': { uid: 'pw-uidlisted-unverified', email: 'x@example.test', emailVerified: false },
};

/** A rig whose verifier is the QA table above and whose allow-list is what ALLOWED_ACCOUNTS holds in production. */
function rig(allow: string) {
  const r = makeRig({});
  const base = r.deps();
  const deps = { ...base, allowList: parseAllowList(allow), verifier: async (t: string) => ACCTS[t.replace(/^tok-/, '')] ?? null };
  return { r, call: (uid: string, op: string, body: unknown = {}) => r.call(op, uid, body, {}, deps) };
}
type X = ReturnType<typeof rig>;
const as = (x: X, uid: string, op: string, body?: unknown) => x.call(uid, op, body);

describe('US-E13-08/AC9 allow-list needs a confirmed e-mail (pure policy)', () => {
  const list = parseAllowList('mama@example.test, uid-listed');
  it('unconfirmed e-mail on the list is refused; confirmed is allowed; case and spaces are normalised', () => {
    expect(isAllowed(list, { uid: 'u', email: 'mama@example.test', emailVerified: false })).toBe(false);
    expect(isAllowed(list, { uid: 'u', email: 'mama@example.test', emailVerified: true })).toBe(true);
    expect(isAllowed(list, { uid: 'u', email: '  MAMA@Example.test ', emailVerified: true })).toBe(true);
  });
  it('missing/null/"true"-string/number verified flag never passes', () => {
    for (const v of [undefined, null, 'true', 1, 0, '']) {
      expect(isAllowed(list, { uid: 'u', email: 'mama@example.test', emailVerified: v as unknown as boolean })).toBe(false);
    }
  });
  it('an e-mail-less account, an empty list and near-miss addresses are refused', () => {
    expect(isAllowed(list, { uid: 'u', emailVerified: true })).toBe(false);
    expect(isAllowed(parseAllowList(''), { uid: 'u', email: 'mama@example.test', emailVerified: true })).toBe(false);
    expect(isAllowed(parseAllowList(undefined), { uid: 'u', email: 'mama@example.test', emailVerified: true })).toBe(false);
    for (const e of ['mama@example.test.evil', 'xmama@example.test', 'mama+1@example.test', 'mama@example.test.']) {
      expect(isAllowed(list, { uid: 'u', email: e, emailVerified: true }), e).toBe(false);
    }
  });
});

describe('US-E13-08/AC9 sync refuses and never stores an unconfirmed e-mail', () => {
  it('family.create by an unconfirmed password account (e-mail on the list) is 403 NOT_ALLOWED and writes nothing', async () => {
    const x = rig('mama@example.test');
    const before = snapshot(x.r);
    const res = await as(x, 'pw-unverified', 'family.create', { consentVersion: 1 });
    expect(res.status).toBe(403);
    expect(res.body['error']).toBe('NOT_ALLOWED');
    expect(snapshot(x.r)).toBe(before);
  });
  it('every data operation of an unconfirmed account in no family is refused (not 200) and writes nothing', async () => {
    const x = rig('mama@example.test');
    const before = snapshot(x.r);
    for (const op of ['records.push', 'records.pull', 'invite.create', 'consent.set', 'family.leave', 'family.delete', 'family.removeMember']) {
      const res = await as(x, 'pw-unverified', op, { records: [], cursor: 0, consentVersion: 1, confirmation: '削除する', uid: 'g-owner' });
      expect(res.status, op).toBeGreaterThanOrEqual(400);
    }
    expect(snapshot(x.r)).toBe(before);
  });
  it('once confirmed (same address) the account is allowed and its e-mail IS stored in its member document', async () => {
    const x = rig('mama@example.test');
    expect((await as(x, 'pw-verified', 'family.create', { consentVersion: 1 })).status).toBe(200);
    expect(snapshot(x.r)).toContain('mama@example.test');
  });
  it('a confirmed account whose token e-mail has capitals and spaces passes the e-mail allow-list', async () => {
    const x = rig('mama@example.test');
    expect((await as(x, 'pw-caps', 'family.create', { consentVersion: 1 })).status).toBe(200);
  });
  it('an account allowed by uid with an unconfirmed e-mail: e-mail NOT stored and NOT shown to the other member', async () => {
    const x = rig('owner@example.test, pw-uidlisted-unverified');
    await as(x, 'g-owner', 'family.create', { consentVersion: 1 });
    const inv = (await as(x, 'g-owner', 'invite.create')).body;
    const joined = await as(x, 'pw-uidlisted-unverified', 'invite.redeem', { code: inv['code'], consentVersion: 1 });
    expect(joined.status).toBe(200);
    expect(snapshot(x.r)).not.toContain('x@example.test');
    const view = JSON.stringify((await as(x, 'g-owner', 'membership.get')).body);
    expect(view).not.toContain('x@example.test');
    expect(view).toContain('owner@example.test');
  });
  it('an unconfirmed, unlisted account redeeming an invite: whatever the outcome, its address is never stored or returned', async () => {
    const x = rig('owner@example.test');
    await as(x, 'g-owner', 'family.create', { consentVersion: 1 });
    const inv = (await as(x, 'g-owner', 'invite.create')).body;
    const res = await as(x, 'pw-unverified', 'invite.redeem', { code: inv['code'], consentVersion: 1 });
    expect(snapshot(x.r)).not.toContain('mama@example.test');
    expect(JSON.stringify((await as(x, 'g-owner', 'membership.get')).body)).not.toContain('mama@example.test');
    console.info(`QA-INFO redeem by unlisted unconfirmed account -> ${res.status}`);
  });
  it('the refusal is identical for a listed and an unlisted unconfirmed address (no allow-list oracle)', async () => {
    const x = rig('mama@example.test');
    const a = await as(x, 'pw-unverified', 'family.create', { consentVersion: 1 });
    const b = await as(x, 'pw-uidlisted-unverified', 'family.create', { consentVersion: 1 });
    expect(JSON.stringify(a.body)).toBe(JSON.stringify(b.body));
    expect(a.status).toBe(b.status);
  });
});
