// US-E13-08/AC9: the server never trusts an e-mail the provider has not confirmed (a password account before it clicks the link).
import { describe, expect, it } from 'vitest';
import { isAllowed, parseAllowList } from '../../../../server/core/hosted-policy.ts';
import { makeRig, UID1, UID_STRANGER } from './harness.ts';

describe('US-E13-08 unconfirmed e-mail on the server', () => {
  it('US-E13-08/AC9 an allow-list match by e-mail alone needs email_verified; a uid entry does not', () => {
    const list = parseAllowList('listed@example.test');
    expect(isAllowed(list, { uid: 'u1', email: 'listed@example.test', emailVerified: false })).toBe(false);
    expect(isAllowed(list, { uid: 'u1', email: 'listed@example.test', emailVerified: true })).toBe(true);
  });

  it('US-E13-08/AC9 sync and family operations refuse a caller who is on the list only by an unconfirmed e-mail', async () => {
    const rig = makeRig({}, ['listed@example.test']);
    const deps = { ...rig.deps(), verifier: () => Promise.resolve({ uid: UID_STRANGER, email: 'listed@example.test', emailVerified: false }) };
    const r = await rig.call('family.create', UID_STRANGER, { consentVersion: 1 }, {}, deps);
    expect(r.status).toBe(403);
    expect(rig.db.paths('families').length).toBe(0);
  });

  it('US-E13-08/AC9 an unconfirmed e-mail is not stored in the membership record; a confirmed one is', async () => {
    const rig = makeRig();
    const unconfirmed = { ...rig.deps(), verifier: () => Promise.resolve({ uid: UID1, email: 'one@example.test', emailVerified: false }) };
    const created = await rig.call('family.create', UID1, { consentVersion: 1 }, {}, unconfirmed);
    expect(created.status).toBe(200);
    const famId = created.body['familyId'] as string;
    expect(rig.db.get(`families/${famId}/members/${UID1}`)).not.toHaveProperty('email');
    const confirmed = await rig.call('consent.set', UID1, { consentVersion: 1 });
    expect(confirmed.status).toBe(200);
  });
});
