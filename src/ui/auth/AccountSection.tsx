// Settings account card and the sign-out confirm dialog (components §15.3, §15.4; US-E13-05).
import { useState } from 'react';
import { useApp } from '../app-store.tsx';
import { Dialog } from '../components/Controls.tsx';
import { useAccount } from './account-context.tsx';

export function AccountSection() {
  const { t } = useApp();
  const account = useAccount();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [photoBroken, setPhotoBroken] = useState(false);
  if (account === null) return null;
  const { user } = account;

  const name = (user.displayName ?? '').trim();
  const email = (user.email ?? '').trim();
  // US-E13-08/AC11: a password account has no photo; its e-mail is the name line and is not repeated.
  const isPassword = user.provider === 'password';
  const shownName = isPassword && email !== '' ? email : name !== '' ? name : email !== '' ? email : t('auth.account.noName');
  const initial = Array.from(isPassword ? email : name !== '' ? name : email)[0] ?? '';

  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await account.signOut();
    // On success the shell replaces this screen with the login screen; only a failure comes back here.
    if (!ok) {
      setBusy(false);
      setFailed(true);
    }
  };

  return (
    <section className="card account" aria-labelledby="settings-account-title" data-testid="settings-account">
      <h2 id="settings-account-title" className="card__title">
        {t('auth.account.section')}
      </h2>
      <div className="account__row">
        {!isPassword && user.photoUrl !== null && !photoBroken ? (
          // Decorative: the name is next to it (US-E13-05/AC1). Google's own image host, display only.
          <img className="account__avatar" src={user.photoUrl} alt="" referrerPolicy="no-referrer" onError={() => setPhotoBroken(true)} data-testid="account-avatar" />
        ) : (
          <span className="account__avatar account__avatar--initial" aria-hidden="true" data-testid="account-avatar">
            {initial}
          </span>
        )}
        <div className="account__text">
          <p className={`account__name${name === '' && email === '' ? ' account__name--empty' : ''}`} title={shownName} data-testid="account-name">
            {shownName}
          </p>
          {!isPassword && email !== '' && (
            <p className="account__email" title={email} data-testid="account-email">
              {email}
            </p>
          )}
          <p className="account__caption">{t(isPassword ? 'auth.account.password' : 'auth.account.google')}</p>
        </div>
      </div>
      <button type="button" className="btn btn--destructive-text btn--block account__signout" data-testid="account-sign-out" onClick={() => setAsking(true)}>
        {t('auth.signOut')}
      </button>
      {asking && (
        <Dialog
          name="sign-out"
          alert
          lockWhileBusy
          busy={busy}
          title={t('auth.signOut.title')}
          body={<p>{t('auth.signOut.body')}</p>}
          confirmLabel={busy ? t('auth.signOut.busy') : t('auth.signOut.confirm')}
          cancelLabel={t('auth.signOut.cancel')}
          error={failed ? t('auth.signOut.failed') : null}
          errorTestId="dialog-sign-out-error"
          onConfirm={() => void confirm()}
          onCancel={() => {
            setAsking(false);
            setFailed(false);
          }}
        />
      )}
    </section>
  );
}
