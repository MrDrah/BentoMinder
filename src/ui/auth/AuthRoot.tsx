// The sign-in shell (ADR 014, design flow F18, US-E13-01..05): nobody enters the app signed out. It reads the saved
// session first (splash, no login flash), shows the login screen when there is none, and mounts the app for the
// signed-in account only, with that account's own storage and reminders. The address (deep link) is never touched
// here, so the screen it names opens after sign-in (US-E13-01/AC2, AC6).
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { authReducer, initialAuthSession } from '../../domain/auth/session.ts';
import type { AuthPort, AuthUser } from '../../domain/auth/types.ts';
import type { Clock } from '../../domain/ports.ts';
import type { Repository } from '../../domain/storage/repository.ts';
import { createTranslator, type Language } from '../../i18n/index.ts';
import { App } from '../App.tsx';
import { AppProvider, type AppServices } from '../app-store.tsx';
import type { SyncController } from '../sync/controller.ts';
import { navigate, parseHash } from '../router.ts';
import { AccountContext, type AccountValue } from './account-context.tsx';
import { LoginScreen, RestoringScreen } from './LoginScreen.tsx';

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

  const signIn = useCallback(async () => {
    if (signingIn.current) return; // US-E13-03/AC3: one sign-in at a time
    signingIn.current = true;
    setFallback(false);
    setJustSignedOut(false);
    dispatch({ type: 'signInStarted' });
    try {
      const result = await auth.signInWithGoogle();
      // US-E13-01/AC2: a valid deep link is kept; an address that names no screen opens the start screen instead of not-found.
      if (result.ok && parseHash(window.location.hash).name === 'not-found') navigate({ name: 'calendar', month: null });
      dispatch({ type: 'signInFinished', result });
    } catch (err) {
      console.warn(`Sign-in threw: ${err instanceof Error ? err.name : 'unknown error'}`);
      dispatch({ type: 'signInFinished', result: { ok: false, error: 'other' } });
    } finally {
      signingIn.current = false;
    }
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

  const gate = useSplashGate(session.status === 'loading', splashDelayMs, splashMinMs);
  const user = session.user;
  const account = useMemo<AccountValue | null>(() => (user === undefined ? null : { user, signOut }), [user, signOut]);

  if (gate === 'blank') return <div className="screen auth" aria-busy="true" data-testid="screen-blank" />;
  if (gate === 'splash') return <RestoringScreen t={t} />;

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
      error={error === 'sessionEnded' ? null : error}
      expired={session.lastError === 'sessionEnded'}
      signedOut={justSignedOut}
      onSignIn={() => void signIn()}
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
