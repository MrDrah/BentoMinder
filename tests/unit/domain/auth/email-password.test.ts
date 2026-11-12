// US-E13-08: the pure parts (form validation, resend cooldown, the verification wall, the reducer) and the fake port.
import { describe, expect, it } from 'vitest';
import { FakeAuth, TEST_USER, authReducer, initialAuthSession, needsEmailVerification, resendSecondsLeft, validateForm, type AuthUser } from '../../../../src/domain/auth/index.ts';

const pwUser = (verified: boolean): AuthUser => ({ uid: 'pw-uid-001', displayName: null, email: 'new@example.test', photoUrl: null, emailVerified: verified, provider: 'password' });

describe('US-E13-08/AC7 form validation', () => {
  it('US-E13-08/AC7 order: e-mail empty, e-mail invalid, password empty, password short (create only)', () => {
    expect(validateForm('signin', '', '')).toEqual({ email: 'emailEmpty', password: 'pwEmpty' });
    expect(validateForm('signin', 'not-an-email', 'x')).toEqual({ email: 'emailInvalid' }); // sign-in never judges length
    expect(validateForm('create', 'a@example.test', '1234567')).toEqual({ password: 'pwShort' });
    expect(validateForm('create', 'a@example.test', '12345678')).toEqual({});
    expect(validateForm('create', 'a@example.test', '')).toEqual({ password: 'pwEmpty' });
  });
  it('US-E13-08/AC7 the length counts characters, not code units, and spaces around the e-mail are ignored', () => {
    expect(validateForm('create', ' a@example.test ', '\u{1F600}'.repeat(8))).toEqual({});
    expect(validateForm('create', 'a@example.test', '\u{1F600}'.repeat(7))).toEqual({ password: 'pwShort' });
  });
  it('US-E13-08/AC6 forgot mode checks the e-mail only', () => {
    expect(validateForm('forgot', 'a@b', '')).toEqual({ email: 'emailInvalid' });
    expect(validateForm('forgot', 'a@b.test', '')).toEqual({});
  });
});

describe('US-E13-08/AC4 resend cooldown', () => {
  it('US-E13-08/AC4 at most one e-mail per 60 seconds; the seconds left count down to zero', () => {
    expect(resendSecondsLeft(null, 1000)).toBe(0);
    expect(resendSecondsLeft(0, 0)).toBe(60);
    expect(resendSecondsLeft(0, 1)).toBe(60);
    expect(resendSecondsLeft(0, 1000)).toBe(59);
    expect(resendSecondsLeft(0, 59_001)).toBe(1);
    expect(resendSecondsLeft(0, 60_000)).toBe(0);
    expect(resendSecondsLeft(5000, 4000)).toBe(60); // a clock that went back does not unlock early
  });
});

describe('US-E13-08/AC3 the wall', () => {
  it('US-E13-08/AC3 only an unconfirmed password account needs to confirm; Google and older users never do', () => {
    expect(needsEmailVerification(pwUser(false))).toBe(true);
    expect(needsEmailVerification({ uid: 'pw-uid-001', displayName: null, email: 'a@example.test', photoUrl: null, provider: 'password' })).toBe(true);
    expect(needsEmailVerification(pwUser(true))).toBe(false);
    expect(needsEmailVerification(TEST_USER)).toBe(false);
    expect(needsEmailVerification({ ...TEST_USER, provider: 'google', emailVerified: false })).toBe(false);
  });
  it('US-E13-08/AC3 a reloaded, confirmed user replaces the signed-in one with no second sign-in', () => {
    let s = authReducer(initialAuthSession, { type: 'restored', user: pwUser(false) });
    expect(s.status).toBe('signedIn');
    s = authReducer(s, { type: 'changed', change: { user: pwUser(true) } });
    expect(s.status).toBe('signedIn');
    expect(s.user?.emailVerified).toBe(true);
  });
  it('US-E13-08/AC5 e-mail errors end signed out with the kind kept', () => {
    let s = authReducer(initialAuthSession, { type: 'restored', user: null });
    s = authReducer(s, { type: 'signInStarted' });
    s = authReducer(s, { type: 'signInFinished', result: { ok: false, error: 'wrong' } });
    expect(s).toEqual({ status: 'signedOut', lastError: 'wrong' });
  });
});

describe('US-E13-08/AC12 FakeAuth supports the e-mail methods', () => {
  it('US-E13-08/AC2 create makes an unconfirmed password account, signs it in and sends one confirmation e-mail', async () => {
    const f = new FakeAuth();
    const seen: (AuthUser | null)[] = [];
    f.onChange((c) => seen.push(c.user));
    const r = await f.createAccount('New@Example.test', 'password1');
    expect(r.ok && r.user).toMatchObject({ email: 'new@example.test', emailVerified: false, provider: 'password' });
    expect(f.verificationsSent).toEqual(['new@example.test']);
    expect(seen).toHaveLength(1);
  });
  it('US-E13-08/AC8 an address already used (by Google or by a password) is "in use" and nothing is merged', async () => {
    const f = new FakeAuth().addAccount({ email: 'g@example.test', uid: 'google-uid-1', provider: 'google', verified: true });
    expect(await f.createAccount('g@example.test', 'password1')).toEqual({ ok: false, error: 'inUse' });
    expect(f.currentUser()).toBeNull();
  });
  it('US-E13-08/AC7 wrong password, unknown e-mail and a Google-only account give the same answer', async () => {
    const f = new FakeAuth()
      .addAccount({ email: 'p@example.test', uid: 'pw-uid-9', provider: 'password', password: 'right-pw-1', verified: true })
      .addAccount({ email: 'g@example.test', uid: 'google-uid-1', provider: 'google', verified: true });
    const wrong = { ok: false, error: 'wrong' };
    expect(await f.signInWithEmail('p@example.test', 'nope-nope-1')).toEqual(wrong);
    expect(await f.signInWithEmail('x@example.test', 'right-pw-1')).toEqual(wrong);
    expect(await f.signInWithEmail('g@example.test', 'right-pw-1')).toEqual(wrong);
    const ok = await f.signInWithEmail('p@example.test', 'right-pw-1');
    expect(ok.ok).toBe(true);
  });
  it('US-E13-08/AC3 reloadUser sees the confirmation and force-refreshes the token', async () => {
    const f = new FakeAuth();
    await f.createAccount('new@example.test', 'password1');
    const still = await f.reloadUser();
    expect(still.ok && still.user.emailVerified).toBe(false);
    f.confirmEmail('new@example.test');
    const before = await f.getIdToken();
    const done = await f.reloadUser();
    expect(done.ok && done.user.emailVerified).toBe(true);
    expect(f.tokenRequests.at(-1)).toBe(true);
    expect(await f.getIdToken()).not.toBe(before);
  });
  it('US-E13-08/AC6 the reset answer is the same with or without an account; only a real account gets an e-mail', async () => {
    const f = new FakeAuth().addAccount({ email: 'p@example.test', uid: 'pw-uid-9', provider: 'password', password: 'x', verified: true });
    expect(await f.sendPasswordReset('p@example.test')).toEqual({ ok: true });
    expect(await f.sendPasswordReset('nobody@example.test')).toEqual({ ok: true });
    expect(f.resetsSent).toEqual(['p@example.test']);
  });
  it('US-E13-08/AC7 scripted errors reach every e-mail action (tooMany, offline)', async () => {
    const f = new FakeAuth().queueError('tooMany').queueError('offline').queueError('other');
    expect(await f.signInWithEmail('a@example.test', 'x')).toEqual({ ok: false, error: 'tooMany' });
    expect(await f.sendPasswordReset('a@example.test')).toEqual({ ok: false, error: 'offline' });
    expect(await f.createAccount('a@example.test', 'password1')).toEqual({ ok: false, error: 'other' });
  });
});
