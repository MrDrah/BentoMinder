// A1 login screen and A0 restoring splash (design/components.md §15.1, §15.2; US-E13-01, US-E13-03).
// Rendered outside the app store (there is no account data yet), so it gets its own translator and language.
import { useEffect, useRef } from 'react';
import type { AuthErrorKind } from '../../domain/auth/types.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { Banner, BannerIcon } from '../components/Controls.tsx';
import { LangToggleView } from '../components/LangToggle.tsx';
import { GoogleMark } from './GoogleMark.tsx';

const ERROR_KEY: Partial<Record<AuthErrorKind, MessageKey>> = {
  popupBlocked: 'auth.error.popupBlocked',
  offline: 'auth.error.offline',
  disabled: 'auth.error.other',
  other: 'auth.error.other',
  // `cancelled` shows nothing (US-E13-03/AC1); `sessionEnded` has its own notice (US-E13-02/AC5).
};

export interface LoginScreenProps {
  t: Translate;
  language: Language;
  onLanguage: (language: Language) => void;
  busy: boolean;
  error: AuthErrorKind | null;
  /** The session was ended by the provider: show the notice (US-E13-02/AC5). */
  expired: boolean;
  /** The parent just signed out: announce it and move focus to the heading (components §15.4). */
  signedOut: boolean;
  onSignIn: () => void;
}

export function LoginScreen({ t, language, onLanguage, busy, error, expired, signedOut, onSignIn }: LoginScreenProps) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (signedOut) title.current?.focus();
  }, [signedOut]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('app.docTitle', { screen: t('auth.docTitle') });
  }, [language, t]);

  const errorKey = error === null ? undefined : ERROR_KEY[error];
  // A polite status node that exists from the first render; its text is swapped in (components §15.1).
  const live = busy ? t('auth.signingIn.live') : signedOut ? t('auth.signedOut.live') : '';

  return (
    <div className="screen auth" data-testid="screen-login">
      <div className="auth__top">
        <LangToggleView language={language} t={t} onChange={onLanguage} testId="login-lang" />
      </div>
      <main id="main" className="auth__col">
        <div className="auth__brand">
          <span className="appbar__logo" aria-hidden="true" />
          <span className="auth__wordmark" aria-hidden="true">
            {t('app.name')}
          </span>
        </div>
        <p className="auth__tagline">{t('auth.login.tagline')}</p>
        <h1 ref={title} tabIndex={-1} className="auth__title" data-testid="login-title">
          {t('auth.login.title')}
        </h1>
        {expired && (
          <Banner variant="info" testId="login-expired" title={t('auth.expired.title')}>
            <p className="banner__body">{t('auth.expired.body')}</p>
          </Banner>
        )}
        <p className="auth__lead">{t('auth.login.lead')}</p>
        <button
          type="button"
          className="btn btn--secondary btn--block auth-google"
          data-testid="login-google"
          aria-disabled={busy ? true : undefined}
          aria-busy={busy ? true : undefined}
          onClick={() => {
            if (!busy) onSignIn();
          }}
        >
          {busy ? <span className="auth-spinner" aria-hidden="true" /> : <GoogleMark />}
          <span className="auth-google__label">{busy ? t('auth.google.signingIn') : t('auth.google.button')}</span>
        </button>
        <div className="auth__error" aria-live="assertive" data-testid="login-error">
          {errorKey !== undefined && (
            <>
              <BannerIcon variant="danger" />
              <span>{t(errorKey)}</span>
            </>
          )}
        </div>
        <p className="auth__privacy" data-testid="login-privacy">
          {t('auth.privacy')}
        </p>
        <p className="visually-hidden" role="status" data-testid="login-live">
          {live}
        </p>
      </main>
    </div>
  );
}

/** A0: shown while the saved session is read, instead of the login screen and the app (components §15.2). */
export function RestoringScreen({ t }: { t: Translate }) {
  return (
    <div className="screen auth auth--splash" role="status" aria-busy="true" data-testid="screen-restoring">
      <div className="auth__col auth__col--center">
        <div className="auth__brand">
          <span className="appbar__logo" aria-hidden="true" />
          <span className="auth__wordmark">{t('app.name')}</span>
        </div>
        <span className="auth-spinner auth-spinner--large" aria-hidden="true" />
        <p className="auth__restoring">{t('auth.restoring')}</p>
      </div>
    </div>
  );
}
