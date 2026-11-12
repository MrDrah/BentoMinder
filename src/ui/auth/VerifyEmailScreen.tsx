// A3 check-your-email screen (design/components.md §20.2; US-E13-08/AC2, AC3, AC4). The hard wall: while a password
// account's e-mail is not confirmed, this is the only thing the shell shows, so no store, sync, hosted AI call or
// family screen starts for it.
import { useEffect, useRef, useState } from 'react';
import { resendSecondsLeft } from '../../domain/auth/credentials.ts';
import type { ActionResult, SignInErrorKind, SignInResult } from '../../domain/auth/types.ts';
import { needsEmailVerification } from '../../domain/auth/types.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { LangToggleView } from '../components/LangToggle.tsx';
import { BannerIcon } from '../components/Controls.tsx';

const ERROR_KEY: Partial<Record<SignInErrorKind, MessageKey>> = {
  offline: 'auth.error.offline',
  tooMany: 'auth.pw.error.tooMany',
};

export interface VerifyEmailScreenProps {
  t: Translate;
  language: Language;
  onLanguage: (language: Language) => void;
  email: string;
  /** Arriving from "create": the first e-mail was just sent, so the cooldown starts at once. */
  justCreated: boolean;
  onResend: () => Promise<ActionResult>;
  /** Reloads the account; the shell opens the app itself when it is confirmed. */
  onCheck: () => Promise<SignInResult>;
  onSignOut: () => void;
}

export function VerifyEmailScreen({ t, language, onLanguage, email, justCreated, onResend, onCheck, onSignOut }: VerifyEmailScreenProps) {
  const title = useRef<HTMLHeadingElement>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(() => (justCreated ? performance.now() : null));
  const [now, setNow] = useState(() => performance.now());
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [live, setLive] = useState(() => (justCreated ? t('auth.verify.sent') : ''));
  const alive = useRef(true);
  const secondsLeft = resendSecondsLeft(lastSentAt, now);
  const wasCounting = useRef(secondsLeft > 0);

  useEffect(() => {
    alive.current = true;
    title.current?.focus();
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('app.docTitle', { screen: t('auth.docTitle.verify') });
  }, [language, t]);
  // One tick per second while the cooldown runs; the number changes visually, only the start and the end are spoken.
  useEffect(() => {
    if (resendSecondsLeft(lastSentAt, performance.now()) === 0) return;
    const id = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(id);
  }, [lastSentAt]);
  useEffect(() => {
    if (wasCounting.current && secondsLeft === 0) setLive(t('auth.verify.canResend'));
    wasCounting.current = secondsLeft > 0;
  }, [secondsLeft, t]);

  const resend = async () => {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setError(null);
    const r = await onResend();
    if (!alive.current) return;
    setResending(false);
    if (r.ok) {
      const at = performance.now();
      setNow(at);
      setLastSentAt(at);
      setLive(t('auth.verify.sent'));
    } else {
      setError(ERROR_KEY[r.error] ?? 'auth.error.other');
    }
  };

  const check = async () => {
    if (checking) return;
    setChecking(true);
    setError(null);
    setLive('');
    const r = await onCheck();
    if (!alive.current) return;
    setChecking(false);
    if (!r.ok) setError(ERROR_KEY[r.error] ?? 'auth.error.other');
    else if (needsEmailVerification(r.user)) setError('auth.verify.notYet');
  };

  const bodyParts = t('auth.verify.body', { email: '\u0000' }).split('\u0000');
  return (
    <div className="screen auth" data-testid="screen-verify-email">
      <div className="auth__top">
        <LangToggleView language={language} t={t} onChange={onLanguage} testId="verify-lang" />
      </div>
      <main id="main" className="auth__col">
        <div className="auth__brand">
          <span className="appbar__logo" aria-hidden="true" />
          <span className="auth__wordmark" aria-hidden="true">
            {t('app.name')}
          </span>
        </div>
        <h1 ref={title} tabIndex={-1} className="auth__title" data-testid="verify-title">
          {t('auth.verify.title')}
        </h1>
        <p className="auth__lead auth__verify-body" data-testid="verify-body">
          {bodyParts[0]}
          <strong className="auth__address" data-testid="verify-address">
            {email}
          </strong>
          {bodyParts.slice(1).join('\u0000')}
        </p>
        <p className="auth__hint">{t('auth.verify.spam')}</p>
        <div className="auth__error" aria-live="assertive" data-testid="verify-error">
          {error !== null && (
            <>
              <BannerIcon variant="danger" />
              <span>{t(error)}</span>
            </>
          )}
        </div>
        <button type="button" className="btn btn--primary btn--block auth__submit" data-testid="verify-done" aria-disabled={checking ? true : undefined} aria-busy={checking ? true : undefined} onClick={() => void check()}>
          {checking && <span className="auth-spinner" aria-hidden="true" />}
          <span>{checking ? t('auth.verify.checking') : t('auth.verify.done')}</span>
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--block auth__submit"
          data-testid="verify-resend"
          aria-disabled={resending || secondsLeft > 0 ? true : undefined}
          aria-busy={resending ? true : undefined}
          onClick={() => void resend()}
        >
          {resending && <span className="auth-spinner" aria-hidden="true" />}
          <span>{resending ? t('auth.verify.resending') : secondsLeft > 0 ? t('auth.verify.resendIn', { seconds: secondsLeft }) : t('auth.verify.resend')}</span>
        </button>
        <button type="button" className="btn btn--text auth__mode" data-testid="verify-sign-out" onClick={onSignOut}>
          {t('auth.signOut')}
        </button>
        <p className="visually-hidden" role="status" data-testid="verify-live">
          {live}
        </p>
      </main>
    </div>
  );
}
