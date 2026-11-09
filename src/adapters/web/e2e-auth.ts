// TEST SEAM (US-E13-07/AC4). Reachable only when the build was made with VITE_AUTH_FAKE=1 (the e2e preview
// build, tests/e2e/preview-e2e.mjs); in a normal build the branch in select-auth.ts is folded away and this
// module is not part of the bundle (tests/unit/ui/auth-bundle.test.ts builds the app and proves it).
//
// How a spec drives it (all through localStorage, set with page.addInitScript before the app starts):
//   bentominder.fake-auth         absent -> the default test account is already signed in AND its data stays in the
//                                 old unkeyed keys ("compat mode", so the earlier specs need no change);
//                                 'signed-out' -> the login screen; a JSON AuthUser -> that account, signed in.
//                                 The adapter keeps this key up to date, so a reload keeps the session.
//   bentominder.fake-auth-next    JSON AuthUser: who signs in at the next tap (default: the default test account).
//   bentominder.fake-auth-script  JSON array of outcomes for the next taps: 'cancelled' | 'popupBlocked' | 'offline'
//                                 | 'disabled' | 'other' | 'ok'. Each tap consumes the first one.
//   bentominder.fake-auth-delay   milliseconds the session read takes (to see the restoring splash).
import { FakeAuth, TEST_USER } from '../../domain/auth/fake-auth.ts';
import type { AuthPort, SignInErrorKind, AuthUser } from '../../domain/auth/types.ts';
import type { AuthSetup } from '../select-auth.ts';

const KEY = 'bentominder.fake-auth';
const NEXT = 'bentominder.fake-auth-next';
const SCRIPT = 'bentominder.fake-auth-script';
const DELAY = 'bentominder.fake-auth-delay';

const readJson = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

export function createE2eAuth(): AuthSetup {
  const stored = window.localStorage.getItem(KEY);
  const compat = stored === null;
  let user: AuthUser | null = TEST_USER;
  if (stored === 'signed-out') user = null;
  else if (stored !== null) user = readJson(KEY) as AuthUser | null;

  const fake = new FakeAuth({ user });
  const next = readJson(NEXT);
  if (next !== null) fake.signInUser = next as AuthUser;
  fake.onChange((c) => window.localStorage.setItem(KEY, c.user === null ? 'signed-out' : JSON.stringify(c.user)));

  const delay = Number(window.localStorage.getItem(DELAY) ?? '0');
  const script = readJson(SCRIPT);
  const outcomes = Array.isArray(script) ? (script as string[]) : [];

  const auth: AuthPort = {
    restore: async () => {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      return fake.restore();
    },
    signInWithGoogle: () => {
      const outcome = outcomes.shift();
      if (outcome !== undefined && outcome !== 'ok') fake.queueError(outcome as SignInErrorKind);
      return fake.signInWithGoogle();
    },
    signOut: () => fake.signOut(),
    getIdToken: (force) => fake.getIdToken(force),
    onChange: (h) => fake.onChange(h),
  };
  return { auth, accountOf: (u) => (compat && u.uid === TEST_USER.uid ? undefined : u.uid) };
}
