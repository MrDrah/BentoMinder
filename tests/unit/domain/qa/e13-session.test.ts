// QA E13 pure-logic checks, written from data contract §12 and the stories (not from the developers' tests).
// A deliberately naive model of the session rules is compared with the real reducer on random event sequences.
import { describe, expect, it } from 'vitest';
import { authReducer, initialAuthSession, type AuthEvent, type AuthSession } from '../../../../src/domain/auth/session.ts';
import { isValidUid, storeKeysFor } from '../../../../src/domain/storage/keys.ts';
import type { AuthUser, SignInErrorKind } from '../../../../src/domain/auth/types.ts';

const U = (uid: string): AuthUser => ({ uid, displayName: 'n', email: 'e@x.test', photoUrl: null });

// naive uid rule, contract 12.2: non-blank, <= 128 chars, no '.', no whitespace
function naiveValid(uid: unknown): boolean {
  if (typeof uid !== 'string' || uid.length === 0 || uid.length > 128) return false;
  for (const ch of uid) if (ch === '.' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ' ' || ch === '　') return false;
  return true;
}

describe('US-E13-04/AC5 contract 12.2 uid validity and key names', () => {
  const samples = ['a', 'test-uid-001', 'x'.repeat(128), 'x'.repeat(129), '', ' ', 'a b', 'a.b', '.', 'a　b', 'a b', '../x', '日本語', '😀', '__proto__', 'A_b-C9'];
  for (const s of samples) {
    it(`uid ${JSON.stringify(s.length > 12 ? s.slice(0, 6) + '..' + s.length : s)} agrees with the naive rule`, () => {
      expect(isValidUid(s)).toBe(naiveValid(s));
    });
  }
  it('random uids agree with the naive rule (2000 cases, seeded)', () => {
    let seed = 20261109;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const alphabet = ['a', 'Z', '0', '-', '_', '.', ' ', '\t', '　', 'あ', '😀', '/', ':'];
    for (let i = 0; i < 2000; i++) {
      const n = Math.floor(rnd() * 8);
      let s = '';
      for (let j = 0; j < n; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
      expect(isValidUid(s), JSON.stringify(s)).toBe(naiveValid(s));
    }
  });
  it('store keys are exactly bentominder.<uid>.state / .state.prev; a bad uid throws, no uid = legacy pair', () => {
    expect(storeKeysFor('test-uid-001')).toEqual({ state: 'bentominder.test-uid-001.state', prev: 'bentominder.test-uid-001.state.prev' });
    expect(storeKeysFor()).toEqual({ state: 'bentominder.state', prev: 'bentominder.state.prev' });
    expect(() => storeKeysFor('a.b')).toThrow();
    expect(() => storeKeysFor('')).toThrow();
  });
  it('two different uids never share a key (no prefix collision between "x" and "x-y")', () => {
    const a = storeKeysFor('x');
    const b = storeKeysFor('x-y');
    expect(new Set([a.state, a.prev, b.state, b.prev]).size).toBe(4);
  });
});

// Naive model of the contract: states loading / signedOut / signingIn / signedIn and lastError.
type M = { status: 'loading' | 'signedOut' | 'signingIn' | 'signedIn'; uid: string | null; err: string | null };
function model(m: M, e: AuthEvent): M {
  if (e.type === 'restored') {
    if (m.status !== 'loading') return m;
    if (e.user === null) return { status: 'signedOut', uid: null, err: null };
    return naiveValid(e.user.uid) ? { status: 'signedIn', uid: e.user.uid, err: null } : { status: 'signedOut', uid: null, err: 'other' };
  }
  if (e.type === 'signInStarted') return m.status === 'signedOut' ? { status: 'signingIn', uid: null, err: null } : m;
  if (e.type === 'signInFinished') {
    if (m.status !== 'signingIn') return m;
    const r = e.result;
    if (!r.ok) return { status: 'signedOut', uid: null, err: r.error === 'cancelled' ? null : r.error };
    return naiveValid(r.user.uid) ? { status: 'signedIn', uid: r.user.uid, err: null } : { status: 'signedOut', uid: null, err: 'other' };
  }
  if (e.type === 'changed') {
    const c = e.change;
    if (c.user !== null) {
      if (m.status === 'signingIn' || m.status === 'loading') return m;
      return naiveValid(c.user.uid) ? { status: 'signedIn', uid: c.user.uid, err: null } : m;
    }
    if (m.status !== 'signedIn') return m;
    return { status: 'signedOut', uid: null, err: c.reason === 'session-ended' ? 'sessionEnded' : null };
  }
  return m.status === 'signedIn' ? { status: 'signedOut', uid: null, err: null } : m;
}
const view = (s: AuthSession): M => ({ status: s.status, uid: s.user?.uid ?? null, err: s.lastError });

describe('US-E13-01/AC1 US-E13-02/AC2 AC5 US-E13-03/AC1 AC3 AC6 reducer against the naive model', () => {
  it('signed out can never reach signedIn without a successful sign-in or a valid restored session (3000 random sequences)', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const errs: SignInErrorKind[] = ['cancelled', 'popupBlocked', 'offline', 'disabled', 'other'];
    const uids = ['test-uid-001', 'test-uid-002', 'bad.uid', ''];
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)] as T;
    const ev = (): AuthEvent => {
      switch (Math.floor(rnd() * 7)) {
        case 0: return { type: 'restored', user: rnd() < 0.4 ? null : U(pick(uids)) };
        case 1: return { type: 'signInStarted' };
        case 2: return { type: 'signInFinished', result: { ok: false, error: pick(errs) } };
        case 3: return { type: 'signInFinished', result: { ok: true, user: U(pick(uids)) } };
        case 4: return { type: 'changed', change: { user: U(pick(uids)) } };
        case 5: return { type: 'changed', change: { user: null, reason: rnd() < 0.5 ? 'session-ended' : 'signed-out' } };
        default: return { type: 'signedOut' };
      }
    };
    for (let run = 0; run < 3000; run++) {
      let s = initialAuthSession;
      let m: M = { status: 'loading', uid: null, err: null };
      for (let i = 0; i < 12; i++) {
        const e = ev();
        s = authReducer(s, e);
        m = model(m, e);
        expect(view(s), JSON.stringify(e)).toEqual(m);
        if (s.status === 'signedIn') expect(isValidUid(s.user?.uid)).toBe(true); // never a bad uid in a signed-in state
        if (s.status !== 'signedIn') expect(s.user).toBeUndefined();
      }
    }
  });

  it('US-E13-02/AC5 a session ended by the provider while signed in gives sessionEnded; a plain sign-out does not', () => {
    const inState = authReducer(initialAuthSession, { type: 'restored', user: U('test-uid-001') });
    expect(authReducer(inState, { type: 'changed', change: { user: null, reason: 'session-ended' } })).toMatchObject({ status: 'signedOut', lastError: 'sessionEnded' });
    expect(authReducer(inState, { type: 'changed', change: { user: null, reason: 'signed-out' } })).toMatchObject({ status: 'signedOut', lastError: null });
  });

  it('US-E13-03/AC3 a second signInStarted while signing in changes nothing', () => {
    const out = authReducer(initialAuthSession, { type: 'restored', user: null });
    const once = authReducer(out, { type: 'signInStarted' });
    expect(authReducer(once, { type: 'signInStarted' })).toBe(once);
  });

  it('US-E13-02/AC2 while loading, a "signed out" change must not show the login screen (stays loading)', () => {
    expect(authReducer(initialAuthSession, { type: 'changed', change: { user: null, reason: 'signed-out' } }).status).toBe('loading');
  });
});
