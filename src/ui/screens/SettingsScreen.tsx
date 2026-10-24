// Settings (design/components.md §9), M1 sections: menu (saved URL, import), profile (edit,
// delete), data (export, import, delete all) and about. Reminders and display arrive in M4.
// Profile edit screen (§6.2 edit variant, US-E1-05).
import { useEffect, useRef, useState } from 'react';
import { savedSourceUrl } from '../../domain/menu/store-ops.ts';
import { deleteProfile, formToProfile, profileToForm, saveProfile, type ProfileForm as Form } from '../../domain/profile/profile.ts';
import { useApp, useStore } from '../app-store.tsx';
import { TopBar } from '../components/Bars.tsx';
import { Dialog } from '../components/Controls.tsx';
import { navigate, setLeaveGuard, toHash, type Route } from '../router.ts';
import { ConsentDialog } from './ImportScreen.tsx';
import { ProfileForm } from './ProfileForm.tsx';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

export function SettingsScreen() {
  const { t, state, now, commit, startOver, replaceStore, repository, services, showToast } = useApp();
  const store = useStore();
  const persisted = state.phase === 'ready' && state.persisted;
  const [dialog, setDialog] = useState<'delete-profile' | 'delete-all' | 'import-data' | 'consent' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<Parameters<typeof replaceStore>[0] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = savedSourceUrl(store);

  const exportData = async () => {
    if (!persisted) return;
    await services.fileExport.save(repository.exportFileName(), repository.exportJson(store), 'application/json');
    showToast(t('data.export.done'));
  };

  const readImport = async (file: File) => {
    setImportError(null);
    const result = repository.importJson(await file.text());
    if (result.ok) {
      setIncoming(result.state);
      setDialog('import-data');
    } else setImportError(t(result.error === 'too-new' ? 'data.import.newer' : 'data.import.invalid'));
  };

  return (
    <div className="screen" data-testid="screen-settings">
      <TopBar title={t('settings.title')} />
      <main id="main" className="page settings">
        <section className="card" aria-labelledby="settings-menu">
          <h2 id="settings-menu" className="card__title">
            {t('settings.menu')}
          </h2>
          <p className="field__sublabel">{t('settings.menu.url')}</p>
          <p className="readonly" data-testid="settings-menu-url">
            {url ?? t('settings.menu.urlNone')}
          </p>
          <a className="btn btn--secondary" href={toHash({ name: 'import' })} data-testid="settings-menu-import">
            {t('settings.menu.import')}
          </a>
        </section>

        <section className="card" aria-labelledby="settings-profile">
          <h2 id="settings-profile" className="card__title">
            {t('settings.profile')}
          </h2>
          <div className="stack">
            <a className="btn btn--secondary" href={toHash({ name: 'profile' })} data-testid="settings-profile-edit">
              {t('settings.profile.edit')}
            </a>
            {store.profile !== null && (
              <button type="button" className="btn btn--destructive-text" data-testid="settings-profile-delete" onClick={() => setDialog('delete-profile')}>
                {t('settings.profile.delete')}
              </button>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="settings-data">
          <h2 id="settings-data" className="card__title">
            {t('settings.data')}
          </h2>
          <p className="field__hint">{t('settings.data.where')}</p>
          <div className="stack">
            <button
              type="button"
              className={`btn btn--secondary${persisted ? '' : ' is-disabled'}`}
              data-testid="data-export"
              aria-disabled={!persisted || undefined}
              aria-describedby={persisted ? 'data-export-hint' : 'data-export-empty'}
              onClick={() => void exportData()}
            >
              {t('data.export')}
            </button>
            <p id={persisted ? 'data-export-hint' : 'data-export-empty'} className="field__hint">
              {persisted ? t('data.export.hint') : t('data.export.empty')}
            </p>
            <label className="btn btn--text file-button">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                data-testid="data-import"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file !== undefined) void readImport(file);
                }}
              />
              {t('data.import')}
            </label>
            {importError !== null && (
              <p className="field-error" role="alert" data-testid="data-import-error">
                {importError}
              </p>
            )}
            <button type="button" className="btn btn--destructive-text" data-testid="data-delete-all" onClick={() => setDialog('delete-all')}>
              {t('data.deleteAll')}
            </button>
          </div>
        </section>

        <section className="card" aria-labelledby="settings-about">
          <h2 id="settings-about" className="card__title">
            {t('settings.about')}
          </h2>
          <button type="button" className="btn btn--text" data-testid="settings-about-consent" onClick={() => setDialog('consent')}>
            {t('settings.about.consent')}
          </button>
          <p className="field__hint">{t('settings.about.version', { v: VERSION })}</p>
        </section>
      </main>

      {dialog === 'delete-profile' && (
        <Dialog
          name="delete-profile"
          destructive
          title={t('profileDelete.title')}
          body={<p>{t('profileDelete.body')}</p>}
          confirmLabel={t('profileDelete.confirm')}
          cancelLabel={t('profileDelete.cancel')}
          onConfirm={() => {
            void (async () => {
              if (await commit(deleteProfile(store, now()))) {
                setDialog(null);
                navigate({ name: 'onboarding', step: 1, month: null, manual: false });
              } else showToast(t('toast.saveFailed'));
            })();
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'delete-all' && (
        <Dialog
          name="delete-all"
          destructive
          title={t('data.deleteAll.title')}
          body={<p>{t('data.deleteAll.body')}</p>}
          confirmLabel={t('data.deleteAll.confirm')}
          cancelLabel={t('data.deleteAll.cancel')}
          onConfirm={() => {
            void startOver().then(() => navigate({ name: 'onboarding', step: 1, month: null, manual: false }, { force: true }));
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'import-data' && incoming !== null && (
        <Dialog
          name="import-data"
          destructive
          title={t('data.import.title')}
          body={<p>{t('data.import.body')}</p>}
          confirmLabel={t('data.import.confirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            void replaceStore(incoming).then((ok) => {
              setDialog(null);
              if (ok) navigate({ name: 'calendar', month: null });
              else showToast(t('toast.saveFailed'));
            });
          }}
          onCancel={() => {
            setIncoming(null);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'consent' && <ConsentDialog readOnly onAccept={() => setDialog(null)} onDecline={() => setDialog(null)} />}
    </div>
  );
}

const sameForm = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);

/** US-E1-05: edit the profile; 「キャンセル」 or leaving with changes asks first (AC3). */
export function ProfileEditScreen() {
  const { t, now, commit, showToast } = useApp();
  const store = useStore();
  const initial = store.profile === null ? null : profileToForm(store.profile);
  const current = useRef<Form | null>(initial);
  const [leaveTarget, setLeaveTarget] = useState<Route | null>(null);
  useEffect(() => () => setLeaveGuard(null), []);

  if (initial === null) {
    return (
      <div className="screen" data-testid="screen-profile">
        <TopBar title={t('profileEdit.title')} />
        <main id="main" className="page" />
      </div>
    );
  }
  const dirty = () => current.current !== null && !sameForm(current.current, initial);
  const guard = (next: Form) => {
    current.current = next;
    setLeaveGuard(
      dirty()
        ? (target) => {
            setLeaveTarget(target);
            return false;
          }
        : null,
    );
  };
  const settings: Route = { name: 'settings' };

  return (
    <div className="screen" data-testid="screen-profile">
      <TopBar title={t('profileEdit.title')} />
      <main id="main" className="page">
        <ProfileForm
          initial={initial}
          submitLabel={t('profileEdit.save')}
          submitTestId="profile-save"
          onChange={guard}
          footerNote={<p className="field__hint">{t('profileEdit.keepsPlans')}</p>}
          secondary={
            <button
              type="button"
              className="btn btn--secondary btn--block"
              data-testid="profile-cancel"
              onClick={() => (dirty() ? setLeaveTarget(settings) : navigate(settings))}
            >
              {t('profileEdit.cancel')}
            </button>
          }
          onSubmit={async (form) => {
            const r = formToProfile(form, now(), store.profile);
            if (!r.ok) return;
            if (await commit(saveProfile(store, r.profile, now()))) {
              setLeaveGuard(null);
              showToast(t('profileEdit.saved'));
              navigate(settings, { force: true });
            } else showToast(t('toast.saveFailed'));
          }}
        />
      </main>
      {leaveTarget !== null && (
        <Dialog
          name="discard-profile"
          destructive
          title={t('profileEdit.discard.title')}
          confirmLabel={t('profileEdit.discard.confirm')}
          cancelLabel={t('profileEdit.discard.stay')}
          onConfirm={() => {
            const target = leaveTarget;
            setLeaveTarget(null);
            navigate(target, { force: true });
          }}
          onCancel={() => setLeaveTarget(null)}
        />
      )}
    </div>
  );
}
