// Create a family, the re-consent notice, the join screen, the adoption choice and the import warning (components §16.2,
// §16.3, §16.5, §16.6, §16.10; US-E15-01, -02, -04, -05, -11/AC6). Lazy chunk `family`. Every action goes through the
// sync controller (`fam.sync.family`); nothing here talks to the cloud directly.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../app-store.tsx';
import { BannerIcon, Dialog } from '../../components/Controls.tsx';
import { LangToggle } from '../../components/LangToggle.tsx';
import { TopBar } from '../../components/Bars.tsx';
import { navigate } from '../../router.ts';
import { dismissConsentPrompt } from '../consent-prompt.ts';
import { useFamily, useOnline } from '../hooks.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { ConsentNotice } from './ConsentNotice.tsx';
import { clearFreshJoin, isFreshJoin, markFreshJoin } from './join-session.ts';
import { codeIsValid, consentCurrent, groupCode, normaliseCode } from './text.ts';
import type { JoinError, LocalSummary } from '../family-ops.ts';
import type { AdoptionChoice } from '../../../domain/sync/adoption.ts';
import type { MessageKey } from '../../../i18n/index.ts';

export { FamilyMembers, SafetyRow } from './Members.tsx';

/** §16.3: consent (if the current version is not accepted yet), then the create progress. */
export function CreateFamilyFlow({ onDone }: { onDone: (result: 'created' | 'declined' | 'error') => void }) {
  const fam = useFamily();
  const { t, showToast } = useApp();
  const online = useOnline();
  const needsConsent = fam === null || !consentCurrent(fam.state.consent);
  const [step, setStep] = useState<'consent' | 'running'>(needsConsent ? 'consent' : 'running');
  const [error, setError] = useState(false);
  const running = useRef(false);

  const run = async () => {
    if (fam === null || running.current) return; // a second tap is ignored (US-E15-01/AC8)
    running.current = true;
    setStep('running');
    setError(false);
    try {
      await fam.sync.family.create();
      showToast(t('family.toast.created'));
      onDone('created');
    } catch {
      running.current = false;
      if (needsConsent) {
        setStep('consent');
        setError(true); // nothing was stored (US-E15-02/AC8)
      } else onDone('error');
    }
  };
  useEffect(() => {
    if (!needsConsent) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (fam === null) return null;
  if (step === 'consent') {
    return (
      <ConsentNotice
        mode="first"
        online={online}
        error={error}
        onAccept={() => void run()}
        onDecline={() => {
          showToast(t('consent.cloud.declined.toast'));
          onDone('declined');
        }}
      />
    );
  }
  return <CreateProgress />;
}

function CreateProgress() {
  const { t } = useApp();
  const titleId = useId();
  return (
    <div className="scrim">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy="true" data-testid="dialog-create-family">
        <h2 id={titleId} className="dialog__title family-progress">
          <span className="auth-spinner" aria-hidden="true" />
          <span role="status">{t('family.create.busy')}</span>
        </h2>
        <p className="field__hint">{t('family.create.keepOpen')}</p>
      </div>
    </div>
  );
}

/** US-E15-02/AC6: the notice again, in the upgrade state (or the first state on a new device that has not recorded it). */
export function UpgradeConsent() {
  const fam = useFamily();
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (fam === null) return null;
  return (
    <ConsentNotice
      mode={fam.state.consent === null ? 'first' : 'upgrade'}
      online={online}
      busy={busy}
      error={error}
      onAccept={() => {
        if (busy) return;
        setBusy(true);
        setError(false);
        fam.sync.family.acceptConsent().then(
          () => setBusy(false),
          () => {
            setBusy(false);
            setError(true);
          },
        );
      }}
      onDecline={dismissConsentPrompt}
    />
  );
}

const JOIN_ERROR_KEY: Record<JoinError, MessageKey> = {
  generic: 'family.join.err.generic',
  expired: 'family.join.err.expired',
  full: 'family.join.err.full',
  rate: 'family.join.err.rate',
  already: 'family.join.err.already',
  offline: 'family.join.err.offline',
  other: 'common.error.generic',
};

/** §16.5: the screen of `#/join/<code>` and 「招待コードで参加する」. */
export function JoinScreen({ code }: { code: string | null }) {
  const fam = useFamily();
  const { t, showToast } = useApp();
  const online = useOnline();
  const [typed, setTyped] = useState(code ?? '');
  const [error, setError] = useState<MessageKey | null>(null);
  const [step, setStep] = useState<'code' | 'consent' | 'confirm'>('code');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const hintId = useId();
  const valid = codeIsValid(typed);
  const blockedRate = error === 'family.join.err.rate';

  const next = () => {
    if (busy) return;
    if (!valid) {
      setError('family.join.err.format');
      inputRef.current?.focus();
      return;
    }
    if (!online) {
      setError('family.join.err.offline');
      inputRef.current?.focus();
      return;
    }
    if (blockedRate) return;
    setError(null);
    setStep('consent'); // the notice comes before anything is sent (US-E15-02/AC1)
  };

  const join = async () => {
    if (fam === null || busy) return;
    setBusy(true);
    const result = await fam.sync.family.join(normaliseCode(typed));
    setBusy(false);
    setStep('code');
    if (result.kind === 'error') {
      setError(JOIN_ERROR_KEY[result.error]);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    if (result.kind === 'ask') {
      markFreshJoin(); // the question follows; cancelling it can still undo this join
      return;
    }
    showToast(t('family.toast.joinedSelf'));
    navigate({ name: 'calendar', month: null });
  };

  if (fam === null) return null;
  const back = { route: { name: 'settings' } as const, screen: t('nav.settings') };
  return (
    <div className="screen" data-testid="screen-join">
      <TopBar title={t('family.join.title')} back={back} />
      <main id="main" className="page family-page">
        <p>{t('family.join.lead')}</p>
        <div className="field">
          <label className="field__label" htmlFor="join-code">
            {t('family.join.codeLabel')}
          </label>
          <input
            id="join-code"
            ref={inputRef}
            className="input family-code-input"
            type="text"
            inputMode="text"
            maxLength={24}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            disabled={busy}
            aria-invalid={error !== null ? true : undefined}
            aria-describedby={error !== null ? `${hintId} ${errorId}` : hintId}
            data-testid="input-join-code"
            onChange={(e) => {
              setTyped(e.target.value);
              if (error !== null && !blockedRate) setError(null);
            }}
            onBlur={() => setTyped((v) => (codeIsValid(v) ? groupCode(v) : v))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                next();
              }
            }}
          />
          <p id={hintId} className="field__hint">
            {t('family.join.codeHint')}
          </p>
          <p id={errorId} className="field-error" role="alert" aria-live="assertive" data-testid="input-join-code-error">
            {error !== null && (
              <>
                <BannerIcon variant="danger" />
                {t(error)}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className={`btn btn--primary btn--block${!valid || blockedRate ? ' is-disabled' : ''}`}
          data-testid="join-next"
          aria-disabled={!valid || blockedRate || busy ? true : undefined}
          onClick={next}
        >
          {t('common.next')}
        </button>
        <button type="button" className="btn btn--text btn--block" data-testid="join-cancel" onClick={() => navigate({ name: 'settings' })}>
          {t('common.cancel')}
        </button>
        <p className="visually-hidden" role="status" aria-live="polite">
          {busy ? t('family.join.busy.live') : ''}
        </p>
      </main>
      {step === 'consent' && (
        <ConsentNotice
          mode="first"
          online={online}
          onAccept={() => setStep('confirm')}
          onDecline={() => {
            setStep('code');
            showToast(t('consent.cloud.declined.toast'));
          }}
        />
      )}
      {step === 'confirm' && (
        <Dialog
          name="join-confirm"
          testId="dialog-join-confirm"
          confirmTestId="dialog-join-confirm-ok"
          cancelTestId="dialog-join-confirm-cancel"
          title={t('family.join.confirm.title')}
          body={<p>{t('family.join.confirm.body')}</p>}
          confirmLabel={busy ? t('family.join.busy') : t('family.join.confirm.ok')}
          cancelLabel={t('common.cancel')}
          busy={busy}
          lockWhileBusy
          onConfirm={() => void join()}
          onCancel={() => setStep('code')}
        />
      )}
    </div>
  );
}

/** §16.6: the question "what happens to this device's data" (US-E15-04/AC4-AC8, AC11, US-E15-05/AC6). */
export function AdoptionGate() {
  const fam = useFamily();
  const { t, showToast } = useApp();
  const [choice, setChoice] = useState<AdoptionChoice>('use-family');
  const [summary, setSummary] = useState<LocalSummary | null>(null);
  const [busy, setBusy] = useState<'continue' | 'cancel' | null>(null);
  const [failed, setFailed] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const legendId = useId();
  const freshJoin = isFreshJoin();
  const sync = fam?.sync;
  useEffect(() => {
    titleRef.current?.focus();
    let off = false;
    void sync?.family.localSummary().then((s) => {
      if (!off) setSummary(s);
    });
    return () => {
      off = true;
    };
  }, [sync]);
  if (fam === null) return null;
  const lead: MessageKey = freshJoin ? 'family.adopt.lead' : fam.state.adoptionFromDiscovery ? 'family.adopt.lead.device' : 'family.adopt.lead.resumed';
  const busyAny = busy !== null;

  const cards: { value: AdoptionChoice; label: MessageKey; desc: MessageKey; testId: string }[] = [
    { value: 'use-family', label: 'family.adopt.useFamily', desc: 'family.adopt.useFamily.desc', testId: 'radio-adopt-family' },
    { value: 'add-device', label: 'family.adopt.addLocal', desc: 'family.adopt.addLocal.desc', testId: 'radio-adopt-local' },
  ];

  return (
    <AdoptionFrame>
      <h1 ref={titleRef} tabIndex={-1} className="auth__title" data-testid="adopt-title">
        {t('family.adopt.title')}
      </h1>
      <p>{t(lead)}</p>
      <p className="family-summary" data-testid="adopt-summary">
        {summary === null ? '' : t('family.adopt.localSummary', { profile: summary.profile ? 'yes' : 'no', months: summary.months, decisions: summary.decisions })}
      </p>
      <fieldset className="field" aria-disabled={busyAny ? true : undefined}>
        <legend id={legendId} className="field__label">
          {t('family.adopt.legend')}
        </legend>
        <div className="radios" role="radiogroup" aria-labelledby={legendId}>
          {cards.map((c) => (
            <label key={c.value} className={`radio family-choice${choice === c.value ? ' is-checked' : ''}`}>
              <input type="radio" name="adopt" value={c.value} checked={choice === c.value} disabled={busyAny} onChange={() => setChoice(c.value)} data-testid={c.testId} />
              <span>
                <strong>
                  {choice === c.value && (
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" className="family-choice__check">
                      <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {t(c.label)}
                </strong>
                <span className="field__hint" style={{ display: 'block' }}>
                  {t(c.desc)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {failed && (
        <p className="field-error" role="alert" data-testid="adopt-error">
          <BannerIcon variant="danger" />
          {t('common.error.generic')}
        </p>
      )}
      <AdoptionActions
        freshJoin={freshJoin}
        busy={busy}
        onContinue={() => {
          if (busyAny) return;
          setBusy('continue');
          setFailed(false);
          fam.sync.family.completeAdoption(choice).then(
            () => {
              clearFreshJoin();
              showToast(t('family.toast.joinedSelf'));
              navigate({ name: 'calendar', month: null });
            },
            () => {
              setBusy(null);
              setFailed(true);
            },
          );
        }}
        onCancel={() => {
          if (busyAny) return;
          setBusy('cancel');
          setFailed(false);
          fam.sync.family.cancelJoin().then(
            () => {
              clearFreshJoin();
              navigate({ name: 'join', code: null });
            },
            () => {
              setBusy(null);
              setFailed(true);
            },
          );
        }}
      />
      <p className="field__hint">{t('family.adopt.safety')}</p>
    </AdoptionFrame>
  );
}

function AdoptionFrame({ children }: { children: ReactNode }) {
  return (
    <div className="screen auth" data-testid="screen-adopt">
      <div className="auth__top">
        <LangToggle />
      </div>
      <main id="main" className="auth__col family-col">
        {children}
      </main>
    </div>
  );
}

function AdoptionActions({ freshJoin, busy, onContinue, onCancel }: { freshJoin: boolean; busy: 'continue' | 'cancel' | null; onContinue: () => void; onCancel: () => void }) {
  const { t } = useApp();
  return (
    <>
      <div className="family-actions">
        <button type="button" className="btn btn--primary" data-testid="adopt-continue" aria-disabled={busy !== null ? true : undefined} aria-busy={busy === 'continue' ? true : undefined} onClick={onContinue}>
          {busy === 'continue' && <span className="auth-spinner" aria-hidden="true" />}
          {busy === 'continue' ? t('family.adopt.busy') : t('family.adopt.continue')}
        </button>
        {freshJoin && (
          <button type="button" className="btn btn--secondary" data-testid="adopt-cancel" aria-disabled={busy !== null ? true : undefined} onClick={onCancel}>
            {t('common.cancel')}
          </button>
        )}
      </div>
      {!freshJoin && <p className="field__hint" data-testid="adopt-later">{t('family.adopt.later')}</p>}
      <p className="visually-hidden" role="status" aria-live="polite">
        {busy === 'continue' ? t('family.adopt.busy.live') : ''}
      </p>
    </>
  );
}

/** US-E15-11/AC6: an imported file replaces everyone's data while in a family. */
export function ImportFamilyDialog({ onConfirm, onCancel }: { onConfirm: () => Promise<void>; onCancel: () => void }) {
  const { t } = useApp();
  const online = useOnline();
  return (
    <ConfirmDialog
      name="import-family"
      title={t('family.import.title')}
      body={
        <>
          <p>{t('family.import.body')}</p>
          <p className="field__hint">{t('family.import.hint')}</p>
        </>
      }
      confirmLabel={t('family.import.confirm')}
      online={online}
      onConfirm={onConfirm}
      onClose={onCancel}
    />
  );
}

