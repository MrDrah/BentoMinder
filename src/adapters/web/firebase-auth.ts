// AuthPort on Firebase Authentication (ADR 014, US-E13-07/AC1): Google sign-in through a popup, session kept
// in the browser (browserLocalPersistence). This is the only module that imports the Firebase SDK, and it
// does so lazily (dynamic import) so the SDK is a separate chunk that is fetched only when the app starts.
// Analytics is never loaded: the measurement id is part of the config object and nothing more (US-E13-06/AC4).
import type { ActionResult, AuthChange, AuthPort, AuthUser, SignInErrorKind, SignInResult } from '../../domain/auth/types.ts';

/** The variables the web app reads (document them in .env.example; the values stay in the git-ignored env file). */
export const FIREBASE_ENV_NAMES = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MEASUREMENT_ID',
] as const;

type Env = Readonly<Record<string, unknown>>;

/** Names (never values) of the variables that are empty or missing. */
export function missingFirebaseEnv(env: Env): string[] {
  return FIREBASE_ENV_NAMES.filter((name) => typeof env[name] !== 'string' || (env[name] as string).trim() === '');
}

/** US-E13-03: Firebase error code to the contract's kinds. Closing the window is `cancelled` (no message). */
export function mapFirebaseAuthError(code: unknown, online: boolean = true): SignInErrorKind {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'cancelled';
    case 'auth/popup-blocked':
      return 'popupBlocked';
    case 'auth/network-request-failed':
      return 'offline';
    case 'auth/user-disabled':
      return 'disabled';
    default:
      return online ? 'other' : 'offline';
  }
}

/** US-E13-08/AC7: Firebase error code of an e-mail + password call to the contract's kinds. Never shown; a wrong password, an unknown address and bad credentials are one kind. */
export function mapFirebaseEmailError(code: unknown, online: boolean = true): SignInErrorKind {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'wrong';
    case 'auth/email-already-in-use':
      return 'inUse';
    case 'auth/invalid-email':
      return 'invalidEmail';
    case 'auth/weak-password':
      return 'weakPassword';
    case 'auth/too-many-requests':
      return 'tooMany';
    case 'auth/network-request-failed':
      return 'offline';
    case 'auth/user-disabled':
      return 'disabled';
    default:
      return online ? 'other' : 'offline';
  }
}

interface Sdk {
  auth: import('firebase/auth').Auth;
  mod: typeof import('firebase/auth');
}

const toUser = (u: import('firebase/auth').User): AuthUser => {
  // A Google link makes the e-mail the provider's own; otherwise it is a password account until it is confirmed.
  const provider = u.providerData.some((p) => p.providerId === 'google.com') ? 'google' : u.providerData.some((p) => p.providerId === 'password') ? 'password' : 'google';
  return { uid: u.uid, displayName: u.displayName, email: u.email, photoUrl: u.photoURL, emailVerified: u.emailVerified, provider };
};
const codeOf = (err: unknown): unknown => (typeof err === 'object' && err !== null && 'code' in err ? (err as { code: unknown }).code : undefined);

export interface FirebaseAuthOptions {
  /** Defaults to console.warn. Receives variable NAMES only. */
  warn?: (message: string) => void;
  isOnline?: () => boolean;
}

export function createFirebaseAuth(env: Env, options: FirebaseAuthOptions = {}): AuthPort {
  const warn = options.warn ?? ((m: string) => console.warn(m));
  const isOnline = options.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const missing = missingFirebaseEnv(env);
  if (missing.length > 0) warn(`Sign-in is not configured: missing ${missing.join(', ')}. Add them to your env file (see .env.example).`);

  let sdk: Promise<Sdk | null> | null = null;
  const load = (): Promise<Sdk | null> => {
    if (missing.length > 0) return Promise.resolve(null);
    sdk ??= (async () => {
      try {
        const [{ initializeApp }, mod] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
        const app = initializeApp({
          apiKey: env['VITE_FIREBASE_API_KEY'] as string,
          authDomain: env['VITE_FIREBASE_AUTH_DOMAIN'] as string,
          projectId: env['VITE_FIREBASE_PROJECT_ID'] as string,
          storageBucket: env['VITE_FIREBASE_STORAGE_BUCKET'] as string,
          messagingSenderId: env['VITE_FIREBASE_MESSAGING_SENDER_ID'] as string,
          appId: env['VITE_FIREBASE_APP_ID'] as string,
          measurementId: env['VITE_FIREBASE_MEASUREMENT_ID'] as string,
        });
        // Stay signed in across restarts (US-E13-02/AC1); the popup resolver is only used by the sign-in tap.
        const auth = mod.initializeAuth(app, { persistence: mod.browserLocalPersistence, popupRedirectResolver: mod.browserPopupRedirectResolver });
        return { auth, mod };
      } catch {
        return null;
      }
    })();
    return sdk;
  };

  let signingOut = false;
  let lastUid: string | null | undefined;
  const handlers = new Set<(change: AuthChange) => void>();
  let attached = false;
  const attach = (s: Sdk) => {
    if (attached) return;
    attached = true;
    s.mod.onAuthStateChanged(s.auth, (u) => {
      const uid = u?.uid ?? null;
      if (uid === lastUid) return; // the first callback repeats what `restore` returned
      lastUid = uid;
      const change: AuthChange = u !== null ? { user: toUser(u) } : { user: null, reason: signingOut ? 'signed-out' : 'session-ended' };
      for (const h of [...handlers]) h(change);
    });
  };

  const failed = (err: unknown, what: string): { ok: false; error: SignInErrorKind } => {
    const code = codeOf(err);
    const kind = mapFirebaseEmailError(code, isOnline());
    warn(`${what} failed: ${typeof code === 'string' ? code : 'unknown error'}`); // the code only: no address, no password
    return { ok: false, error: kind };
  };

  return {
    async restore() {
      const s = await load();
      if (s === null) return null;
      await s.auth.authStateReady(); // resolves from the browser's cache, no network (US-E13-02/AC3)
      lastUid = s.auth.currentUser?.uid ?? null;
      attach(s);
      return s.auth.currentUser === null ? null : toUser(s.auth.currentUser);
    },

    async signInWithGoogle(): Promise<SignInResult> {
      const s = await load();
      if (s === null) return { ok: false, error: 'other' };
      try {
        attach(s);
        const provider = new s.mod.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const cred = await s.mod.signInWithPopup(s.auth, provider);
        lastUid = cred.user.uid;
        return { ok: true, user: toUser(cred.user) };
      } catch (err) {
        const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code: unknown }).code : undefined;
        const kind = mapFirebaseAuthError(code, isOnline());
        // Support aid: the provider's error code only (no user data, no config values).
        if (kind !== 'cancelled') warn(`Sign-in failed: ${typeof code === 'string' ? code : 'unknown error'}`);
        return { ok: false, error: kind };
      }
    },

    async createAccount(email, password): Promise<SignInResult> {
      const s = await load();
      if (s === null) return { ok: false, error: 'other' };
      try {
        attach(s);
        const cred = await s.mod.createUserWithEmailAndPassword(s.auth, email.trim(), password);
        lastUid = cred.user.uid;
        try {
          await s.mod.sendEmailVerification(cred.user); // a failure here is not fatal: the parent can resend
        } catch (err) {
          warn(`Confirmation e-mail failed: ${String(codeOf(err) ?? 'unknown error')}`);
        }
        return { ok: true, user: toUser(cred.user) };
      } catch (err) {
        return failed(err, 'Create account');
      }
    },

    async signInWithEmail(email, password): Promise<SignInResult> {
      const s = await load();
      if (s === null) return { ok: false, error: 'other' };
      try {
        attach(s);
        const cred = await s.mod.signInWithEmailAndPassword(s.auth, email.trim(), password);
        lastUid = cred.user.uid;
        return { ok: true, user: toUser(cred.user) };
      } catch (err) {
        return failed(err, 'E-mail sign-in');
      }
    },

    async sendVerification(): Promise<ActionResult> {
      const s = await load();
      const user = s?.auth.currentUser ?? null;
      if (s === null || user === null) return { ok: false, error: 'other' };
      try {
        await s.mod.sendEmailVerification(user);
        return { ok: true };
      } catch (err) {
        return failed(err, 'Resend');
      }
    },

    async reloadUser(): Promise<SignInResult> {
      const s = await load();
      const user = s?.auth.currentUser ?? null;
      if (s === null || user === null) return { ok: false, error: 'other' };
      try {
        await user.reload();
        await user.getIdToken(true); // the confirmed e-mail must show in the token the server sees (AC3, AC9)
        return { ok: true, user: toUser(user) };
      } catch (err) {
        return failed(err, 'Reload');
      }
    },

    async sendPasswordReset(email): Promise<ActionResult> {
      const s = await load();
      if (s === null) return { ok: false, error: 'other' };
      try {
        await s.mod.sendPasswordResetEmail(s.auth, email.trim());
        return { ok: true };
      } catch (err) {
        // An address without an account looks exactly like success (AC6).
        if (codeOf(err) === 'auth/user-not-found') return { ok: true };
        return failed(err, 'Password reset');
      }
    },

    async signOut() {
      const s = await load();
      if (s === null) return;
      signingOut = true;
      try {
        await s.mod.signOut(s.auth);
        lastUid = null;
      } finally {
        signingOut = false;
      }
    },

    async getIdToken(forceRefresh = false) {
      const s = await load();
      const user = s?.auth.currentUser ?? null;
      if (user === null) return null;
      try {
        return await user.getIdToken(forceRefresh);
      } catch {
        return null;
      }
    },

    onChange(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}
