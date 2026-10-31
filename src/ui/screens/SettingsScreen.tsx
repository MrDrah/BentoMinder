// Settings (design/components.md §9): display (week start), menu (saved URL, import, the days to
// check after a refresh, the next-month prompt day), profile (edit, delete), data (export, import,
// delete all) and about, plus the reminders (US-E7-04) and the theme (US-E8-05). Every change saves
// at once. Profile edit screen (§6.2 edit variant, US-E1-05).
import { useEffect, useRef, useState } from 'react';
import { openReviewMonths } from '../../domain/calendar/day-view.ts';
import { savedSourceUrl } from '../../domain/menu/store-ops.ts';
import { updateReminderSettings, type ReminderSettingsPatch } from '../../domain/reminders/index.ts';
import { deleteProfile, formToProfile, profileToForm, saveProfile, type ProfileForm as Form } from '../../domain/profile/profile.ts';
import type { Settings } from '../../domain/schema/index.ts';
import { toJstTimestamp } from '../../domain/time/jst.ts';
import { useApp, useStore } from '../app-store.tsx';
import { useDayViewer } from '../calendar/use-day-viewer.ts';
import { TopBar } from '../components/Bars.tsx';
import { Dialog } from '../components/Controls.tsx';
import type { MessageKey } from '../../i18n/index.ts';
import { navigate, setLeaveGuard, toHash, type OnboardingStep, type Route } from '../router.ts';
import { ConsentDialog } from './ImportScreen.tsx';
import { ReminderSettings } from './ReminderSettings.tsx';
import { ProfileForm } from './ProfileForm.tsx';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

const STEP_NAME_KEYS = { 1: 'ob.step1.name', 2: 'ob.step2.name', 3: 'ob.step3.name' } as const;

/**
 * `from`: the onboarding step the parent came from (US-E1-01/AC6): back returns to it. The profile
 * and menu sections need a profile, so they are left out until one exists (D-M1-03 ruling).
 */
export function SettingsScreen({ from = null }: { from?: OnboardingStep | null }) {
  const { t, state, today, now, commit, startOver, replaceStore, repository, services, showToast, showSaveFailed } = useApp();
  const store = useStore();
  const viewer = useDayViewer();
  const persisted = state.phase === 'ready' && state.persisted;
  const [dialog, setDialog] = useState<'delete-profile' | 'delete-all' | 'import-data' | 'consent' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<Parameters<typeof replaceStore>[0] | null>(null);
  const [saved, setSaved] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const url = savedSourceUrl(store);
  const hasProfile = store.profile !== null;
  const open = openReviewMonths(store, today, viewer);
  const openCount = open.reduce((sum, m) => sum + m.open, 0);

  /** Every change saves at once and is announced (components §9); a failed write leaves the control as it was. */
  const saveSettings = async (patch: Partial<Settings>) => {
    const ts = toJstTimestamp(now());
    const next = { ...store, updatedAt: ts, settings: { ...store.settings, ...patch, updatedAt: ts } };
    if (await commit(next)) setSaved(t('settings.saved'));
    else showSaveFailed();
  };

  const saveReminders = async (patch: ReminderSettingsPatch) => {
    const next = updateReminderSettings(store, patch, now());
    if (next === null) return;
    if (await commit(next)) setSaved(t('settings.saved'));
    else showSaveFailed();
  };

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
      <TopBar title={t('settings.title')} {...(from === null ? {} : { back: { route: { name: 'onboarding', step: from, month: null, manual: false } as Route, screen: t(STEP_NAME_KEYS[from]) } })} />
      <main id="main" className="page settings">
        <p className="visually-hidden" role="status" aria-live="polite" data-testid="settings-saved">
          {saved}
        </p>
        <ReminderSettings onChange={(patch) => void saveReminders(patch)} />

        <section className="card" aria-labelledby="settings-display">
          <h2 id="settings-display" className="card__title">
            {t('settings.display')}
          </h2>
          <fieldset className="field">
            <legend className="field__label">{t('settings.weekStart')}</legend>
            <div className="radios">
              {(['monday', 'sunday'] as const).map((value) => (
                <label key={value} className={`radio${store.settings.weekStartsOn === value ? ' is-checked' : ''}`}>
                  <input
                    type="radio"
                    name="week-start"
                    checked={store.settings.weekStartsOn === value}
                    onChange={() => void saveSettings({ weekStartsOn: value })}
                    data-testid={`radio-week-start-${value}`}
                  />
                  {t(value === 'monday' ? 'settings.weekStart.monday' : 'settings.weekStart.sunday')}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="field">
            <legend className="field__label">{t('settings.theme')}</legend>
            <div className="radios">
              {(['auto', 'light', 'dark'] as const).map((value) => (
                <label key={value} className={`radio${store.settings.theme === value ? ' is-checked' : ''}`}>
                  <input type="radio" name="theme" checked={store.settings.theme === value} onChange={() => void saveSettings({ theme: value })} data-testid={`radio-theme-${value}`} />
                  <span>
                    {t(`settings.theme.${value}` as MessageKey)}
                    {value === 'auto' && (
                      <span className="field__hint" style={{ display: 'block' }}>
                        {t('settings.theme.autoHint')}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {hasProfile && (
          <section className="card" aria-labelledby="settings-menu">
            <h2 id="settings-menu" className="card__title">
              {t('settings.menu')}
            </h2>
            <p className="field__sublabel">{t('settings.menu.url')}</p>
            <p className="readonly" data-testid="settings-menu-url">
              {url ?? t('settings.menu.urlNone')}
            </p>
            <div className="stack">
              <a className="btn btn--secondary" href={toHash({ name: 'import' })} data-testid="settings-menu-import">
                {t('settings.menu.import')}
              </a>
              {open[0] !== undefined && (
                <a className="btn btn--secondary" href={toHash({ name: 'refresh-review', month: open[0].month, fresh: false })} data-testid="settings-menu-needs-review">
                  {t('settings.menu.needsReview', { n: openCount })}
                </a>
              )}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="select-prompt-day">
                {t('settings.menu.promptDay')}
              </label>
              <select
                id="select-prompt-day"
                className="input"
                value={store.settings.nextMonthPromptFromDay}
                onChange={(e) => void saveSettings({ nextMonthPromptFromDay: Number(e.target.value) })}
                data-testid="select-prompt-day"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {t('settings.menu.promptDay.value', { n })}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {hasProfile && (
          <section className="card" aria-labelledby="settings-profile">
            <h2 id="settings-profile" className="card__title">
              {t('settings.profile')}
            </h2>
            <div className="stack">
              <a className="btn btn--secondary" href={toHash({ name: 'profile' })} data-testid="settings-profile-edit">
                {t('settings.profile.edit')}
              </a>
              <button type="button" className="btn btn--destructive-text" data-testid="settings-profile-delete" onClick={() => setDialog('delete-profile')}>
                {t('settings.profile.delete')}
              </button>
            </div>
          </section>
        )}

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
              } else showSaveFailed();
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
              else showSaveFailed();
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
  const { t, now, commit, showToast, showSaveFailed } = useApp();
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
            } else showSaveFailed();
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
