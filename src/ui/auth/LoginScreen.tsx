// A1 login screen and A0 restoring splash (design/components.md §15.1, §15.2, §20; US-E13-01, US-E13-03, US-E13-08).
// Rendered outside the app store (there is no account data yet), so it gets its own translator and language.
// Three modes in place (signin / create / forgot). The password lives only in this component's state: it is never
// put in an attribute other than the input's own value, a URL, a title, a live region or storage (US-E13-08/AC7).
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { validateForm, type FieldError, type Mode } from '../../domain/auth/credentials.ts';
import type { ActionResult, AuthErrorKind, SignInErrorKind, SignInResult } from '../../domain/auth/types.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { Banner, BannerIcon, FieldError as FieldErrorLine } from '../components/Controls.tsx';
import { LangToggleView } from '../components/LangToggle.tsx';
import { GoogleMark } from './GoogleMark.tsx';

const ERROR_KEY: Partial<Record<AuthErrorKind, MessageKey>> = {
  popupBlocked: 'auth.error.popupBlocked',
  offline: 'auth.error.offline',
  disabled: 'auth.error.other',
  other: 'auth.error.other',
  // `cancelled` shows nothing (US-E13-03/AC1); `sessionEnded` has its own notice (US-E13-02/AC5).
};

const FIELD_KEY: Record<FieldError, MessageKey> = {
  emailEmpty: 'auth.pw.error.emailEmpty',
  emailInvalid: 'auth.pw.error.emailInvalid',
  pwEmpty: 'auth.pw.error.passwordEmpty',
  pwShort: 'auth.pw.error.passwordShort',
};
/** Request errors of the form (US-E13-08/AC7); `invalidEmail` and `weakPassword` land on their field instead. */
const FORM_ERROR_KEY: Partial<Record<SignInErrorKind, MessageKey>> = {
  wrong: 'auth.pw.error.wrong',
  inUse: 'auth.pw.error.inUse',
  tooMany: 'auth.pw.error.tooMany',
  offline: 'auth.error.offline',
};
const PRIMARY_KEY = { signin: 'auth.pw.signIn', create: 'auth.pw.create', forgot: 'auth.pw.sendReset' } as const;
const BUSY_KEY = { signin: 'auth.pw.busy.signIn', create: 'auth.pw.busy.create', forgot: 'auth.pw.busy.send' } as const;
const MODE_LIVE = { signin: 'auth.pw.mode.signin', create: 'auth.pw.mode.create', forgot: 'auth.pw.mode.forgot' } as const;

export interface LoginScreenProps {
  t: Translate;
  language: Language;
  onLanguage: (language: Language) => void;
  busy: boolean;
  /** The Google error line only; the form keeps its own. */
  error: AuthErrorKind | null;
  /** The session was ended by the provider: show the notice (US-E13-02/AC5). */
  expired: boolean;
  /** The parent just signed out: announce it and move focus to the heading (components §15.4). */
  signedOut: boolean;
  /** A family invite link was opened while signed out (US-E15-04/AC1): say what happens after sign-in. */
  joinHint?: boolean;
  onSignIn: () => void;
  /** US-E13-08/AC2, AC5: create an account or sign in with e-mail + password. The shell owns the session. */
  onSubmit: (mode: 'signin' | 'create', email: string, password: string) => Promise<SignInResult>;
  /** US-E13-08/AC6 */
  onReset: (email: string) => Promise<ActionResult>;
}

export function LoginScreen({ t, language, onLanguage, busy, error, expired, signedOut, joinHint = false, onSignIn, onSubmit, onReset }: LoginScreenProps) {
  const title = useRef<HTMLHeadingElement>(null);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  // The password is read from the input when the form is sent and never copied into React state or an attribute (AC7, AC10).
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: FieldError | undefined; password?: FieldError | undefined }>({});
  const [formError, setFormError] = useState<SignInErrorKind | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [modeLive, setModeLive] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const sentTitle = useRef<HTMLElement>(null);
  const ids = useId();
  const emailId = `${ids}-email`;
  const passwordId = `${ids}-password`;
  const hintId = `${ids}-hint`;
  const emailErrId = `${ids}-email-err`;
  const passwordErrId = `${ids}-password-err`;
  const locked = busy || formBusy;

  useEffect(() => {
    if (signedOut) title.current?.focus();
  }, [signedOut]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('app.docTitle', { screen: t('auth.docTitle') });
  }, [language, t]);
  useEffect(() => {
    if (resetSent) sentTitle.current?.focus();
  }, [resetSent]);

  const changeMode = (next: Mode) => {
    if (locked) return;
    setMode(next);
    if (passwordRef.current !== null) passwordRef.current.value = '';
    setShowPassword(false);
    setFieldErrors({});
    setFormError(null);
    setResetSent(false);
    setModeLive(t(MODE_LIVE[next]));
    title.current?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setShowPassword(false);
    setFormError(null);
    setModeLive('');
    const password = passwordRef.current?.value ?? '';
    const errs = validateForm(mode, email, password);
    setFieldErrors(errs);
    if (errs.email !== undefined) return void emailRef.current?.focus();
    if (errs.password !== undefined) return void passwordRef.current?.focus();
    setFormBusy(true);
    try {
      if (mode === 'forgot') {
        const r = await onReset(email.trim());
        if (r.ok) setResetSent(true);
        else setFormError(r.error);
        return;
      }
      const r = await onSubmit(mode, email.trim(), password);
      if (r.ok) return;
      if (passwordRef.current !== null) passwordRef.current.value = '';
      if (r.error === 'invalidEmail') {
        setFieldErrors({ email: 'emailInvalid' });
        emailRef.current?.focus();
      } else if (r.error === 'weakPassword') {
        setFieldErrors({ password: 'pwShort' });
        passwordRef.current?.focus();
      } else {
        setFormError(r.error);
        if (r.error === 'wrong') passwordRef.current?.focus();
      }
    } finally {
      setFormBusy(false);
    }
  };

  const errorKey = error === null ? undefined : ERROR_KEY[error];
  const formErrorKey = formError === null ? undefined : (FORM_ERROR_KEY[formError] ?? 'auth.error.other');
  const googleBusy = busy && !formBusy;
  // A polite status node that exists from the first render; its text is swapped in (components §15.1, §20.1).
  const live = formBusy ? t('auth.pw.busy.live') : busy ? t('auth.signingIn.live') : modeLive !== '' ? modeLive : signedOut ? t('auth.signedOut.live') : '';

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
        {joinHint && (
          <Banner variant="info" testId="login-join-hint">
            <p className="banner__body">{t('family.join.loginHint')}</p>
          </Banner>
        )}
        {mode === 'signin' && <p className="auth__lead">{t('auth.login.lead')}</p>}
        {mode !== 'forgot' && (
          <button
            type="button"
            className="btn btn--secondary btn--block auth-google"
            data-testid="login-google"
            aria-disabled={locked ? true : undefined}
            aria-busy={googleBusy ? true : undefined}
            onClick={() => {
              if (!locked) onSignIn();
            }}
          >
            {googleBusy ? <span className="auth-spinner" aria-hidden="true" /> : <GoogleMark />}
            <span className="auth-google__label">{googleBusy ? t('auth.google.signingIn') : t('auth.google.button')}</span>
          </button>
        )}
        <div className="auth__error" aria-live="assertive" data-testid="login-error">
          {errorKey !== undefined && (
            <>
              <BannerIcon variant="danger" />
              <span>{t(errorKey)}</span>
            </>
          )}
        </div>
        {mode !== 'forgot' && (
          <div className="auth__divider" aria-hidden="true">
            <span>{t('auth.divider')}</span>
          </div>
        )}
        <form className="auth__form" noValidate data-testid="login-form" onSubmit={(e) => void submit(e)} key={mode}>
          {mode !== 'signin' && <p className="auth__lead">{t(mode === 'create' ? 'auth.pw.createLead' : 'auth.pw.forgotLead')}</p>}
          {resetSent ? (
            <div className="banner banner--info" role="status" data-testid="login-reset-sent">
              <div className="banner__row">
                <BannerIcon variant="info" />
                <div className="banner__content">
                  <strong className="banner__title" tabIndex={-1} ref={sentTitle}>
                    {t('auth.pw.resetSent.title')}
                  </strong>
                  <p className="banner__body">{t('auth.pw.resetSent.body')}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={`field${fieldErrors.email !== undefined ? ' has-error' : ''}`}>
                <label className="field__label" htmlFor={emailId}>
                  {t('auth.pw.email')}
                </label>
                <input
                  ref={emailRef}
                  id={emailId}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="input"
                  data-testid="login-email"
                  value={email}
                  readOnly={locked}
                  aria-invalid={fieldErrors.email !== undefined ? true : undefined}
                  aria-describedby={fieldErrors.email !== undefined ? emailErrId : undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((f) => ({ ...f, email: undefined }));
                    setFormError(null);
                  }}
                  onBlur={() => {
                    if (email.trim() !== '') setFieldErrors((f) => ({ ...f, email: validateForm('forgot', email, '').email }));
                  }}
                />
                {fieldErrors.email !== undefined && <FieldErrorLine id={emailErrId} text={t(FIELD_KEY[fieldErrors.email])} testId="login-email-error" />}
              </div>
              {mode !== 'forgot' && (
                <div className={`field${fieldErrors.password !== undefined ? ' has-error' : ''}`}>
                  <label className="field__label" htmlFor={passwordId}>
                    {t('auth.pw.password')}
                  </label>
                  <div className="auth__pw">
                    <input
                      ref={passwordRef}
                      id={passwordId}
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="input"
                      data-testid="login-password"
                      readOnly={locked}
                      aria-invalid={fieldErrors.password !== undefined ? true : undefined}
                      aria-describedby={[mode === 'create' ? hintId : '', fieldErrors.password !== undefined ? passwordErrId : ''].filter((x) => x !== '').join(' ') || undefined}
                      onChange={() => {
                        setFieldErrors((f) => ({ ...f, password: undefined }));
                        setFormError(null);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--text auth__pw-toggle"
                      data-testid="login-password-toggle"
                      aria-label={t(showPassword ? 'auth.pw.hide.aria' : 'auth.pw.show.aria')}
                      aria-pressed={showPassword}
                      aria-controls={passwordId}
                      aria-disabled={locked ? true : undefined}
                      onClick={() => {
                        if (!locked) setShowPassword((v) => !v);
                      }}
                    >
                      {t(showPassword ? 'auth.pw.hide' : 'auth.pw.show')}
                    </button>
                  </div>
                  {mode === 'create' && (
                    <p id={hintId} className="field__hint">
                      {t('auth.pw.hint')}
                    </p>
                  )}
                  {fieldErrors.password !== undefined && <FieldErrorLine id={passwordErrId} text={t(FIELD_KEY[fieldErrors.password])} testId="login-password-error" />}
                </div>
              )}
              {mode === 'signin' && (
                <button type="button" className="btn btn--text auth__forgot" data-testid="login-forgot" aria-disabled={locked ? true : undefined} onClick={() => changeMode('forgot')}>
                  {t('auth.pw.forgot')}
                </button>
              )}
              <div className="auth__error" aria-live="assertive" data-testid="login-form-error">
                {formErrorKey !== undefined && (
                  <>
                    <BannerIcon variant="danger" />
                    <span>{t(formErrorKey)}</span>
                  </>
                )}
              </div>
              <button type="submit" className="btn btn--primary btn--block auth__submit" data-testid="login-submit" aria-disabled={locked ? true : undefined} aria-busy={formBusy ? true : undefined}>
                {formBusy && <span className="auth-spinner" aria-hidden="true" />}
                <span>{formBusy ? t(BUSY_KEY[mode]) : t(PRIMARY_KEY[mode])}</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn--text auth__mode"
            data-testid="login-mode-toggle"
            aria-disabled={locked ? true : undefined}
            onClick={() => changeMode(mode === 'signin' ? 'create' : 'signin')}
          >
            {t(mode === 'signin' ? 'auth.pw.toCreate' : mode === 'create' ? 'auth.pw.toSignIn' : 'auth.pw.backToSignIn')}
          </button>
        </form>
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
