// E13 (slice A): the auth state machine and the scripted fake. No Firebase, no network.
import { describe, expect, it } from 'vitest';
import { authReducer, initialAuthSession, RESTORE_TIMEOUT_MS, type AuthEvent, type AuthSession } from '../../../../src/domain/auth/session.ts';
import { FakeAuth, TEST_USER, TEST_USER_2 } from '../../../../src/domain/auth/fake-auth.ts';
import type { AuthPort } from '../../../../src/domain/auth/types.ts';

const run = (events: AuthEvent[], from: AuthSession = initialAuthSession) => events.reduce(authReducer, from);
const signedInState = run([{ type: 'restored', user: TEST_USER }]);

/** What the app's glue will do with a port; kept here so the tests exercise port plus reducer together. */
async function tap(port: AuthPort, state: AuthSession): Promise<AuthSession> {
  const started = authReducer(state, { type: 'signInStarted' });
  if (started === state) return state;
  return authReducer(started, { type: 'signInFinished', result: await port.signInWithGoogle() });
}

describe('US-E13-02 session persists and works offline (state machine)', () => {
  it('US-E13-02/AC1 a persisted session opens straight into the signed-in app', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const state = authReducer(initialAuthSession, { type: 'restored', user: await auth.restore() });
    expect(state).toEqual({ status: 'signedIn', user: TEST_USER, lastError: null });
  });

  it('US-E13-02/AC2 while the session is being read the state is loading, never signedOut', async () => {
    const auth = new FakeAuth({ user: TEST_USER, holdRestore: true });
    const pending = auth.restore();
    expect(initialAuthSession.status).toBe('loading');
    expect(authReducer(initialAuthSession, { type: 'signedOut' }).status).toBe('loading');
    auth.releaseRestore();
    expect(await pending).toEqual(TEST_USER);
    expect(RESTORE_TIMEOUT_MS).toBe(3000);
  });

  it('US-E13-02/AC3 the cached session is used offline and nothing blocks use', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const state = authReducer(initialAuthSession, { type: 'restored', user: await auth.restore() });
    expect(state.status).toBe('signedIn');
    expect(state.lastError).toBeNull();
  });

  it('US-E13-02/AC4 first sign-in offline stays signed out with the offline message kind', async () => {
    const auth = new FakeAuth().queueError('offline');
    const out = await tap(auth, run([{ type: 'restored', user: null }]));
    expect(out).toEqual({ status: 'signedOut', lastError: 'offline' });
    expect(auth.currentUser()).toBeNull();
  });

  it('US-E13-02/AC5 a session ended by the provider shows signedOut with sessionEnded', () => {
    const out = authReducer(signedInState, { type: 'changed', change: { user: null, reason: 'session-ended' } });
    expect(out).toEqual({ status: 'signedOut', lastError: 'sessionEnded' });
  });

  it('US-E13-02/AC5 the fake can revoke the session and the listener gets session-ended', () => {
    const auth = new FakeAuth({ user: TEST_USER });
    let state = signedInState;
    auth.onChange((change) => (state = authReducer(state, { type: 'changed', change })));
    auth.revokeSession();
    expect(state.lastError).toBe('sessionEnded');
  });

  it('US-E13-02/AC6 offline never forces sign-out: the state only leaves signedIn through an explicit end', () => {
    // There is no event for "network lost" at all; a failed refresh is not reported by the port.
    const auth = new FakeAuth({ user: TEST_USER });
    expect(auth.currentUser()).toEqual(TEST_USER);
    expect(authReducer(signedInState, { type: 'signInFinished', result: { ok: false, error: 'offline' } })).toBe(signedInState);
  });
});

describe('US-E13-03 sign-in errors (state part)', () => {
  const signedOutState = run([{ type: 'restored', user: null }]);

  it.each([
    ['AC1', 'cancelled', null],
    ['AC2', 'popupBlocked', 'popupBlocked'],
    ['AC4', 'offline', 'offline'],
    ['AC5', 'disabled', 'disabled'],
    ['AC5', 'other', 'other'],
  ] as const)('US-E13-03/%s %s stays signed out with lastError %s and no user', async (_ac, kind, expected) => {
    const out = await tap(new FakeAuth().queueError(kind), signedOutState);
    expect(out).toEqual({ status: 'signedOut', lastError: expected });
    expect(out.user).toBeUndefined();
  });

  it('US-E13-03/AC3 a second tap while sign-in runs starts nothing; the first still ends it', async () => {
    const auth = new FakeAuth({ holdSignIn: true });
    const first = tap(auth, signedOutState);
    const busy = authReducer(signedOutState, { type: 'signInStarted' });
    expect(busy.status).toBe('signingIn');
    expect(await tap(auth, busy)).toBe(busy);
    expect(auth.calls.signIn).toBe(1);
    auth.releaseSignIn();
    expect((await first).status).toBe('signedIn');
  });

  it('US-E13-03/AC6 a failure never enters the app; a later success clears the error', async () => {
    const auth = new FakeAuth().queueError('other');
    const failed = await tap(auth, signedOutState);
    expect(failed.status).toBe('signedOut');
    const ok = await tap(auth, failed);
    expect(ok).toEqual({ status: 'signedIn', user: TEST_USER, lastError: null });
  });

  it('US-E13-03/AC6 a user whose uid cannot be used in a storage key is a failure, not a sign-in', async () => {
    for (const uid of ['', 'a.b', 'a b', 'x'.repeat(129)]) {
      const out = await tap(new FakeAuth().queueSignIn({ ok: true, user: { ...TEST_USER, uid } }), signedOutState);
      expect(out).toEqual({ status: 'signedOut', lastError: 'other' });
    }
  });
});

describe('US-E13-05 sign-out (state and session rules)', () => {
  it('US-E13-05/AC3 signing out ends the session and shows no error', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    let state = signedInState;
    auth.onChange((change) => (state = authReducer(state, { type: 'changed', change })));
    await auth.signOut();
    expect(state).toEqual({ status: 'signedOut', lastError: null });
    expect(auth.currentUser()).toBeNull();
  });

  it('US-E13-05/AC6 sign-out works with the network off: the fake needs nothing but local state', async () => {
    const auth = new FakeAuth({ user: TEST_USER }).queueError('offline');
    await expect(auth.signOut()).resolves.toBeUndefined();
    expect(authReducer(signedInState, { type: 'signedOut' }).status).toBe('signedOut');
  });

  it('US-E13-05/AC3 another account can sign in right after, and the first one is not kept in the state', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    await auth.signOut();
    auth.signInUser = TEST_USER_2;
    const out = await tap(auth, run([{ type: 'restored', user: null }]));
    expect(out.user?.uid).toBe('test-uid-002');
  });
});

describe('US-E13-07 testability of sign-in', () => {
  it('US-E13-07/AC2 the fake produces every state: signed out, signed in, each error, revoked, delayed read', async () => {
    expect(await new FakeAuth().restore()).toBeNull();
    expect(await new FakeAuth({ user: TEST_USER }).restore()).toEqual(TEST_USER);
    for (const kind of ['cancelled', 'popupBlocked', 'offline', 'disabled', 'other'] as const) {
      expect(await new FakeAuth().queueError(kind).signInWithGoogle()).toEqual({ ok: false, error: kind });
    }
    const auth = new FakeAuth({ user: TEST_USER, holdRestore: true });
    let settled = false;
    void auth.restore().then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    auth.releaseRestore();
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it('US-E13-07/AC2 sign-in with scripted user name and e-mail', async () => {
    const user = { uid: 'u-9', displayName: 'Hana', email: 'hana@example.test', photoUrl: null };
    expect(await new FakeAuth().queueSignIn({ ok: true, user }).signInWithGoogle()).toEqual({ ok: true, user });
  });

  it('US-E13-07/AC1 nothing outside src/adapters imports a Firebase package', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
      });
    const src = fileURLToPath(new URL('../../../../src', import.meta.url));
    const offenders = walk(src)
      .filter((p) => !/[\\/]adapters[\\/]/.test(p))
      .filter((p) => /from\s+'(firebase|@firebase)[^']*'/.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('US-E13-06 privacy of the account data (port part)', () => {
  it('US-E13-06/AC3 no child data can reach the provider: the sign-in call takes no arguments', () => {
    expect(new FakeAuth().signInWithGoogle.length).toBe(0);
  });

  it('US-E13-06/AC1 the session state holds only the display fields and the uid, and is not part of the store type', () => {
    expect(Object.keys(signedInState.user ?? {}).sort()).toEqual(['displayName', 'email', 'photoUrl', 'uid']);
  });
});
