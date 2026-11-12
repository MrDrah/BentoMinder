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
// E-mail + password (US-E13-08/AC12):
//   bentominder.fake-auth-accounts  JSON array of {email, uid, provider: 'password'|'google', verified}: accounts the
//                                 provider already has. Every seeded password account accepts E2E_PASSWORD (the password
//                                 itself is never stored); any other password is "wrong". An address that is listed
//                                 (either provider) is "already in use" for create. Accounts created in the page live
//                                 in memory only.
//   bentominder.fake-auth-verified  JSON array of e-mail addresses whose link was "opened"; the next reload of the user
//                                 sees them confirmed (what a spec sets to simulate the parent confirming).
//   bentominder.fake-auth-script  also feeds the e-mail taps (create, sign in, resend, reload, reset) with error kinds
//                                 ('wrong' | 'inUse' | 'tooMany' | 'offline' | 'other' ...) or 'ok'.
//   bentominder.fake-auth-log     written by the seam: JSON array of "verification:<email>" / "reset:<email>" entries,
//                                 i.e. the e-mails the provider would have sent. Never holds a password.
import { FakeAuth, TEST_USER } from '../../domain/auth/fake-auth.ts';
import type { AuthPort, SignInErrorKind, AuthUser } from '../../domain/auth/types.ts';
import type { AuthSetup } from '../select-auth.ts';

const KEY = 'bentominder.fake-auth';
const NEXT = 'bentominder.fake-auth-next';
const SCRIPT = 'bentominder.fake-auth-script';
const DELAY = 'bentominder.fake-auth-delay';
const ACCOUNTS = 'bentominder.fake-auth-accounts';
const VERIFIED = 'bentominder.fake-auth-verified';
const LOG = 'bentominder.fake-auth-log';

/** The password every seeded e-mail account accepts in the e2e build. */
export const E2E_PASSWORD = 'correct-horse-1';

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
  const seeded = readJson(ACCOUNTS);
  if (Array.isArray(seeded)) for (const a of seeded as { email: string; uid: string; provider: 'google' | 'password'; verified: boolean }[]) fake.addAccount({ ...a, ...(a.provider === 'password' ? { password: E2E_PASSWORD } : {}) });
  const next = readJson(NEXT);
  if (next !== null) fake.signInUser = next as AuthUser;
  fake.onChange((c) => window.localStorage.setItem(KEY, c.user === null ? 'signed-out' : JSON.stringify(c.user)));

  const delay = Number(window.localStorage.getItem(DELAY) ?? '0');
  const script = readJson(SCRIPT);
  const outcomes = Array.isArray(script) ? (script as string[]) : [];

  /** Applies the spec's "the parent opened the link" flags before the user is re-read. */
  const applyVerified = () => {
    const list = readJson(VERIFIED);
    if (!Array.isArray(list)) return;
    const current = fake.currentUser();
    for (const email of list as string[]) {
      if (current !== null && current.email?.toLowerCase() === email.toLowerCase()) fake.addAccount({ email, uid: current.uid, provider: 'password', password: E2E_PASSWORD, verified: true });
      else fake.confirmEmail(email);
    }
  };
  const feed = () => {
    const outcome = outcomes.shift();
    if (outcome !== undefined && outcome !== 'ok') fake.queueError(outcome as SignInErrorKind);
  };
  /** Records which e-mails the fake provider sent (address only) so a spec can count them. */
  const logSent = <T,>(run: () => Promise<T>): Promise<T> => {
    const v = fake.verificationsSent.length;
    const r = fake.resetsSent.length;
    return run().then((out) => {
      const entries = [...fake.verificationsSent.slice(v).map((e) => `verification:${e}`), ...fake.resetsSent.slice(r).map((e) => `reset:${e}`)];
      if (entries.length > 0) window.localStorage.setItem(LOG, JSON.stringify([...((readJson(LOG) as string[] | null) ?? []), ...entries]));
      return out;
    });
  };

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
    createAccount: (email, password) => {
      feed();
      return logSent(() => fake.createAccount(email, password));
    },
    signInWithEmail: (email, password) => {
      feed();
      return fake.signInWithEmail(email, password);
    },
    sendVerification: () => {
      feed();
      return logSent(() => fake.sendVerification());
    },
    reloadUser: async () => {
      feed();
      applyVerified();
      const r = await fake.reloadUser();
      if (r.ok) window.localStorage.setItem(KEY, JSON.stringify(r.user));
      return r;
    },
    sendPasswordReset: (email) => {
      feed();
      return logSent(() => fake.sendPasswordReset(email));
    },
    signOut: () => fake.signOut(),
    getIdToken: (force) => fake.getIdToken(force),
    onChange: (h) => fake.onChange(h),
  };
  return { auth, accountOf: (u) => (compat && u.uid === TEST_USER.uid ? undefined : u.uid) };
}
