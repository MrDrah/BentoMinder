// The sign-in shell (ADR 014, design flow F18, US-E13-01..05): nobody enters the app signed out. It reads the saved
// session first (splash, no login flash), shows the login screen when there is none, and mounts the app for the
// signed-in account only, with that account's own storage and reminders. The address (deep link) is never touched
// here, so the screen it names opens after sign-in (US-E13-01/AC2, AC6).
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { authReducer, initialAuthSession } from '../../domain/auth/session.ts';
import { needsEmailVerification, type AuthPort, type AuthUser, type SignInResult } from '../../domain/auth/types.ts';
import type { Clock } from '../../domain/ports.ts';
import type { Repository } from '../../domain/storage/repository.ts';
import { createTranslator, type Language } from '../../i18n/index.ts';
import { App } from '../App.tsx';
import { AppProvider, type AppServices } from '../app-store.tsx';
import type { SyncController } from '../sync/controller.ts';
import { syncConfigured } from '../../adapters/select-sync.ts';
import { navigate, parseHash } from '../router.ts';
import { AccountContext, type AccountValue } from './account-context.tsx';
import { LoginScreen, RestoringScreen } from './LoginScreen.tsx';
import { VerifyEmailScreen } from './VerifyEmailScreen.tsx';

/** Everything one account's app needs; built after sign-in, before the first load (adoption has run). */
export interface AccountEnv {
  repository: Repository;
  clock: Clock;
  newDeviceId: () => string;
  services: Partial<AppServices>;
  warn?: (message: string) => void;
  /** Development-only extras rendered next to the app (the debug panel). */
  extra?: ReactNode;
  /** US-E13-05/AC5: drop every scheduled reminder of this account. */
  cancelReminders: () => Promise<void>;
  /** ADR 016: this account's sync controller; absent when sync is off (VITE_SYNC_BASE_URL unset or invalid). */
  sync?: SyncController | null;
}

export interface AuthRootProps {
  auth: AuthPort;
  /** The storage account of a user (the uid); undefined = the old unkeyed keys (e2e compat mode only). */
  accountOf: (user: AuthUser) => string | undefined;
  openAccount: (user: AuthUser, accountId: string | undefined) => Promise<AccountEnv>;
  /** Components §15.2: the splash is drawn only after this long... */
  splashDelayMs?: number;
  /** ...and then stays at least this long. */
  splashMinMs?: number;
  /** After this long without a session answer the login screen is shown with the generic error. */
  restoreFallbackMs?: number;
  initialLanguage?: Language;
}

type Gate = 'blank' | 'splash' | 'done';

/** Components §15.2: nothing for 150 ms (no flicker), then the splash, which stays at least 300 ms. */
function useSplashGate(loading: boolean, delayMs: number, minMs: number): Gate {
  const [gate, setGate] = useState<Gate>('blank');
  const shownAt = useRef(0);
  useEffect(() => {
    if (gate === 'done') return;
    if (loading) {
      if (gate !== 'blank') return;
      const id = setTimeout(() => {
        shownAt.current = performance.now();
        setGate('splash');
      }, delayMs);
      return () => clearTimeout(id);
    }
    if (gate === 'blank') {
      setGate('done');
      return;
    }
    const id = setTimeout(() => setGate('done'), Math.max(0, minMs - (performance.now() - shownAt.current)));
    return () => clearTimeout(id);
  }, [loading, gate, delayMs, minMs]);
  return gate;
}

export function AuthRoot({ auth, accountOf, openAccount, splashDelayMs = 150, splashMinMs = 300, restoreFallbackMs = 8000, initialLanguage = 'ja' }: AuthRootProps) {
  const [session, dispatch] = useReducer(authReducer, initialAuthSession);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [fallback, setFallback] = useState(false);
  const [justSignedOut, setJustSignedOut] = useState(false);
  // Which control started the last sign-in: only a Google error shows under the Google button (US-E13-08, components §20.1).
  const [errorFrom, setErrorFrom] = useState<'google' | 'form'>('google');
  const justCreated = useRef(false);
  const t = useMemo(() => createTranslator(language), [language]);
  const envRef = useRef<AccountEnv | null>(null);
  const opening = useRef(new Map<string, Promise<AccountEnv>>());
  const signingIn = useRef(false);

  useEffect(() => {
    let off = false;
    const timer = setTimeout(() => {
      if (off) return;
      setFallback(true);
      dispatch({ type: 'restored', user: null });
    }, restoreFallbackMs);
    auth.restore().then(
      (user) => {
        clearTimeout(timer);
        if (!off) dispatch({ type: 'restored', user });
      },
      () => {
        clearTimeout(timer);
        if (!off) {
          setFallback(true);
          dispatch({ type: 'restored', user: null });
        }
      },
    );
    const unsubscribe = auth.onChange((change) => dispatch({ type: 'changed', change }));
    return () => {
      off = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [auth, restoreFallbackMs]);

  /** One sign-in at a time (US-E13-03/AC3), whichever control started it (Google or the e-mail form, US-E13-08). */
  const runSignIn = useCallback(async (run: () => Promise<SignInResult>, from: 'google' | 'form'): Promise<SignInResult> => {
    if (signingIn.current) return { ok: false, error: 'cancelled' };
    signingIn.current = true;
    setFallback(false);
    setJustSignedOut(false);
    setErrorFrom(from);
    dispatch({ type: 'signInStarted' });
    let result: SignInResult;
    try {
      result = await run();
    } catch (err) {
      console.warn(`Sign-in threw: ${err instanceof Error ? err.name : 'unknown error'}`);
      result = { ok: false, error: 'other' };
    }
    try {
      // US-E13-01/AC2: a valid deep link is kept; an address that names no screen opens the start screen instead of not-found.
      if (result.ok && parseHash(window.location.hash).name === 'not-found') navigate({ name: 'calendar', month: null });
      dispatch({ type: 'signInFinished', result });
    } finally {
      signingIn.current = false;
    }
    return result;
  }, []);

  const signIn = useCallback(async () => {
    justCreated.current = false;
    await runSignIn(() => auth.signInWithGoogle(), 'google');
  }, [auth, runSignIn]);

  const submitForm = useCallback(
    (mode: 'signin' | 'create', email: string, password: string) => {
      justCreated.current = mode === 'create';
      return runSignIn(() => (mode === 'create' ? auth.createAccount(email, password) : auth.signInWithEmail(email, password)), 'form');
    },
    [auth, runSignIn],
  );

  const resetPassword = useCallback((email: string) => auth.sendPasswordReset(email), [auth]);

  /** US-E13-08/AC3: re-read the account (and refresh its token); a confirmed e-mail opens the app, no second sign-in. */
  const checkVerified = useCallback(async (): Promise<SignInResult> => {
    const result = await auth.reloadUser();
    if (result.ok) dispatch({ type: 'changed', change: { user: result.user } });
    return result;
  }, [auth]);

  const signOut = useCallback(async () => {
    try {
      await envRef.current?.cancelReminders(); // before the session ends (US-E13-05/AC5)
      await auth.signOut(); // local only, works offline (US-E13-05/AC6)
    } catch {
      return false;
    }
    setJustSignedOut(true);
    dispatch({ type: 'signedOut' });
    return true;
  }, [auth]);

  // A finished session forgets its opened account, so the next sign-in opens (and adopts) afresh.
  useEffect(() => {
    if (session.status !== 'signedIn') opening.current.clear();
  }, [session.status]);

  // After 「確認しました」 the verify screen unmounts and the app mounts: focus goes to the first heading, not <body> (design §20.2).
  const verifying = session.status === 'signedIn' && session.user !== undefined && needsEmailVerification(session.user);
  const wasVerifying = useRef(false);
  useEffect(() => {
    if (wasVerifying.current && !verifying && session.status === 'signedIn') {
      const id = setTimeout(() => {
        const h = document.querySelector<HTMLElement>('main h1, h1, main h2, h2');
        if (h !== null) {
          if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
          h.focus({ preventScroll: true });
        }
      }, 50);
      wasVerifying.current = false;
      return () => clearTimeout(id);
    }
    wasVerifying.current = verifying;
    return undefined;
  }, [verifying, session.status]);

  const gate = useSplashGate(session.status === 'loading', splashDelayMs, splashMinMs);
  const user = session.user;
  const account = useMemo<AccountValue | null>(() => (user === undefined ? null : { user, signOut }), [user, signOut]);

  if (gate === 'blank') return <div className="screen auth" aria-busy="true" data-testid="screen-blank" />;
  if (gate === 'splash') return <RestoringScreen t={t} />;

  // The hard wall (US-E13-08/AC3, AC9): an unconfirmed password account sees only this screen. Nothing below it
  // (store, sync, hosted AI, family) is mounted or started for it.
  if (session.status === 'signedIn' && user !== undefined && needsEmailVerification(user)) {
    return (
      <VerifyEmailScreen
        key={user.uid}
        t={t}
        language={language}
        onLanguage={setLanguage}
        email={user.email ?? ''}
        justCreated={justCreated.current}
        onResend={() => auth.sendVerification()}
        onCheck={checkVerified}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (session.status === 'signedIn' && account !== null && user !== undefined) {
    const accountId = accountOf(user);
    return <SignedInApp key={user.uid} user={user} accountId={accountId} openAccount={openAccount} opening={opening.current} envRef={envRef} account={account} />;
  }

  const error = session.lastError ?? (fallback ? 'other' : null);
  return (
    <LoginScreen
      t={t}
      language={language}
      onLanguage={setLanguage}
      busy={session.status === 'signingIn'}
      error={error === 'sessionEnded' || (errorFrom === 'form' && session.lastError !== null) ? null : error}
      expired={session.lastError === 'sessionEnded'}
      signedOut={justSignedOut}
      joinHint={syncConfigured() && parseHash(window.location.hash).name === 'join'}
      onSignIn={() => void signIn()}
      onSubmit={submitForm}
      onReset={resetPassword}
    />
  );
}

interface SignedInProps {
  user: AuthUser;
  accountId: string | undefined;
  openAccount: AuthRootProps['openAccount'];
  opening: Map<string, Promise<AccountEnv>>;
  envRef: { current: AccountEnv | null };
  account: AccountValue;
}

function SignedInApp({ user, accountId, openAccount, opening, envRef, account }: SignedInProps) {
  const [env, setEnv] = useState<AccountEnv | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let off = false;
    const id = `${user.uid}|${accountId ?? ''}`;
    let p = opening.get(id);
    if (p === undefined) {
      p = openAccount(user, accountId);
      opening.set(id, p);
    }
    p.then(
      (e) => {
        if (off) return;
        envRef.current = e;
        setEnv(e);
      },
      () => {
        if (!off) setFailed(true);
      },
    );
    return () => {
      off = true;
    };
    // The account is opened once per uid; `user` (display data) may change without reopening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid, accountId]);
  // Leaving the account (sign-out, session end, another account): its reminders are dropped and a later
  // sign-in plans them again from that account's own store (US-E13-05/AC5).
  useEffect(
    () => () => {
      const e = envRef.current;
      envRef.current = null;
      if (e !== null) void e.cancelReminders();
    },
    [envRef],
  );
  if (failed) return <div className="screen" role="alert" data-testid="screen-open-failed" />;
  if (env === null) return <div className="screen" aria-busy="true" data-testid="screen-loading" />;
  return (
    <AccountContext.Provider value={account}>
      <AppProvider repository={env.repository} clock={env.clock} newDeviceId={env.newDeviceId} services={env.services} {...(env.warn ? { warn: env.warn } : {})} sync={env.sync ?? null}>
        <App />
        {env.extra}
      </AppProvider>
    </AccountContext.Provider>
  );
}
