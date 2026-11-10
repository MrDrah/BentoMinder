// Components §16.9 (US-E15-05/AC1-AC3): the boot screen of a member's new device. Shown INSTEAD of onboarding and of an
// empty calendar while the membership and the family data are read (loading, up to 15 s), then the retry screen. Main
// bundle: it is on the boot path. Nothing is drawn for the first 150 ms and, once drawn, it stays at least 300 ms.
import { useCallback, useEffect, useRef, useState } from 'react';
import { startGate, NEW_DEVICE_LOAD_TIMEOUT_MS } from '../../domain/sync/gate.ts';
import { useApp } from '../app-store.tsx';
import { useAccount } from '../auth/account-context.tsx';
import { Dialog } from '../components/Controls.tsx';
import { LangToggle } from '../components/LangToggle.tsx';
import { reopenConsentPrompt } from './consent-prompt.ts';
import { useFamily, useOnline } from './hooks.ts';

export const BOOT_DRAW_DELAY_MS = 150;
export const BOOT_MIN_VISIBLE_MS = 300;

export type BootKind = 'pass' | 'blank' | 'loading' | 'retry';

export interface BootGate {
  kind: BootKind;
  /** The family data is being read after a join that was interrupted (US-E15-04/AC11). */
  resuming: boolean;
  busy: boolean;
  retry: () => void;
}

/**
 * `pass` = the app may draw (a local copy exists, the account is in no family, or the family data has arrived).
 * Only a device with no local copy of a member can be held back; everything else passes at once.
 */
export function useNewDeviceGate(): BootGate {
  const fam = useFamily();
  const { state } = useApp();
  const [attempt, setAttempt] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const drawnAt = useRef(0);

  const view = fam?.state;
  const noCopy = fam !== null && state.phase === 'ready' && !state.persisted;
  const consentWait = view?.view.state === 'paused-no-consent';
  const raw = (() => {
    if (!noCopy || view === undefined) return 'calendar-from-local';
    return startGate({
      hasLocalCopy: false,
      membership: view.membership === 'failed' ? 'unknown' : view.membership,
      familyDataLoaded: view.view.lastSyncedAt !== null,
      readFailed: view.membership === 'failed' || consentWait,
      elapsedMs: timedOut ? NEW_DEVICE_LOAD_TIMEOUT_MS + 1 : 0,
    });
  })();
  const holding = raw === 'loading' || raw === 'retry';

  useEffect(() => {
    if (!holding || raw === 'retry') return undefined;
    setTimedOut(false);
    const id = setTimeout(() => setTimedOut(true), NEW_DEVICE_LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [holding, raw, attempt]);

  useEffect(() => {
    if (!holding) return undefined;
    const id = setTimeout(() => {
      drawnAt.current = performance.now();
      setDrawn(true);
    }, BOOT_DRAW_DELAY_MS);
    return () => clearTimeout(id);
  }, [holding]);

  // Once drawn, keep it up for at least 300 ms even if the answer arrives sooner (decided during render: no flash).
  const stillDue = !holding && drawn && performance.now() - drawnAt.current < BOOT_MIN_VISIBLE_MS;
  useEffect(() => {
    if (holding || !drawn) return undefined;
    const wait = Math.max(0, BOOT_MIN_VISIBLE_MS - (performance.now() - drawnAt.current));
    const id = setTimeout(() => setDrawn(false), wait);
    return () => clearTimeout(id);
  }, [holding, drawn]);

  const retry = useCallback(() => {
    if (fam === null || busy) return;
    if (fam.state.view.state === 'paused-no-consent') {
      reopenConsentPrompt();
      return;
    }
    setBusy(true);
    setTimedOut(false);
    setAttempt((n) => n + 1);
    if (fam.state.membership === 'failed') fam.sync.retryDiscovery();
    else fam.sync.syncNow();
    setTimeout(() => setBusy(false), 600);
  }, [fam, busy]);

  const resuming = view?.adoptionPending === true || (view?.membership === 'member' && view.consent !== null && view.view.lastSyncedAt === null && view.adoptionFromDiscovery);
  if (holding) {
    if (!drawn) return { kind: 'blank', resuming, busy, retry };
    return { kind: raw === 'retry' ? 'retry' : 'loading', resuming, busy, retry };
  }
  if (stillDue) return { kind: 'loading', resuming, busy, retry };
  return { kind: 'pass', resuming: false, busy, retry };
}

export function NewDeviceScreen({ gate }: { gate: BootGate }) {
  const { t } = useApp();
  const account = useAccount();
  const online = useOnline();
  const [asking, setAsking] = useState(false);
  const [busyOut, setBusyOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const retryRef = useRef<HTMLButtonElement>(null);
  const showingRetry = gate.kind === 'retry';
  useEffect(() => {
    if (showingRetry) retryRef.current?.focus();
  }, [showingRetry]);

  if (gate.kind === 'blank') return <div className="screen auth" aria-busy="true" data-testid="screen-family-blank" />;

  const signOut = async () => {
    if (account === null) return;
    setBusyOut(true);
    setFailed(false);
    if (!(await account.signOut())) {
      setBusyOut(false);
      setFailed(true);
    }
  };

  return (
    <div className="screen auth" data-testid={showingRetry ? 'screen-family-load-failed' : 'screen-family-loading'}>
      <div className="auth__top">
        <LangToggle />
      </div>
      <main id="main" className="auth__col auth__col--center">
        <div className="auth__brand">
          <span className="appbar__logo" aria-hidden="true" />
          <span className="auth__wordmark" aria-hidden="true">
            {t('app.name')}
          </span>
        </div>
        {showingRetry ? (
          <>
            <h1 className="auth__title" tabIndex={-1}>
              {t('family.load.failed.title')}
            </h1>
            <p className="auth__lead">{online ? t('family.load.failed.body') : t('family.load.failed.offline')}</p>
            <button
              ref={retryRef}
              type="button"
              className="btn btn--primary btn--block"
              data-testid="family-load-retry"
              aria-disabled={gate.busy ? true : undefined}
              aria-busy={gate.busy ? true : undefined}
              onClick={gate.retry}
            >
              {gate.busy && <span className="auth-spinner" aria-hidden="true" />}
              {gate.busy ? t('family.load.busy') : t('family.load.retry')}
            </button>
            {account !== null && (
              <button type="button" className="btn btn--text" data-testid="family-load-sign-out" onClick={() => setAsking(true)}>
                {t('auth.signOut')}
              </button>
            )}
          </>
        ) : (
          <div role="status" aria-busy="true" className="auth__col--center family-loading">
            <span className="auth-spinner auth-spinner--large" aria-hidden="true" />
            <p className="auth__title">{gate.resuming ? t('family.join.resuming') : t('family.load.title')}</p>
            {!gate.resuming && <p className="auth__lead">{t('family.load.body')}</p>}
          </div>
        )}
      </main>
      {asking && (
        <Dialog
          name="sign-out"
          alert
          lockWhileBusy
          busy={busyOut}
          title={t('auth.signOut.title')}
          body={<p>{t('auth.signOut.body')}</p>}
          confirmLabel={busyOut ? t('auth.signOut.busy') : t('auth.signOut.confirm')}
          cancelLabel={t('auth.signOut.cancel')}
          error={failed ? t('auth.signOut.failed') : null}
          onConfirm={() => void signOut()}
          onCancel={() => {
            setAsking(false);
            setFailed(false);
          }}
        />
      )}
    </div>
  );
}
