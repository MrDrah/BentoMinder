// Placeholders for routes whose screens arrive in later milestones, plus the not-found and
// stored-data recovery screens (design/components.md §12). Every string comes from the catalog.
import { useState } from 'react';
import { formatDate } from '../../i18n/format.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { useApp } from '../app-store.tsx';
import { TopBar } from '../components/Bars.tsx';
import { Dialog } from '../components/Controls.tsx';
import { LangToggle } from '../components/LangToggle.tsx';
import type { Route } from '../router.ts';
import { navigate, toHash } from '../router.ts';

type TitledRoute = Exclude<Route, { name: 'calendar' } | { name: 'not-found' }>;
export type PlaceholderRoute = Extract<Route, { name: 'recipe' | 'recipes' }>;

export function screenTitle(route: TitledRoute, t: Translate, lang: Language): string {
  switch (route.name) {
    case 'day':
      return formatDate(t, lang, route.date);
    case 'recommend':
      return t('rec.title');
    case 'refresh-review':
      return t('refresh.review.title');
    case 'recipe':
    case 'recipes':
      return t('library.title');
    case 'settings':
      return t('settings.title');
    case 'profile':
      return t('profileEdit.title');
    case 'import':
      return t('ob.step2.name');
    case 'review':
      return t('ob.step3.name');
    case 'onboarding':
      return t(`ob.step${route.step}.name` as MessageKey);
  }
}

export function PlaceholderScreen({ route }: { route: PlaceholderRoute }) {
  const { state, t } = useApp();
  const title = screenTitle(route, t, state.language);
  return (
    <div className="screen" data-testid={`screen-${route.name}`}>
      <TopBar title={title} />
      <main id="main" className="page" />
    </div>
  );
}

export function NotFoundScreen() {
  const { t } = useApp();
  return (
    <div className="screen" data-testid="screen-not-found">
      <TopBar title={t('notFound.title')} />
      <main id="main" className="page">
        <a className="btn" href={toHash({ name: 'calendar', month: null })}>
          {t('notFound.back')}
        </a>
      </main>
    </div>
  );
}

/**
 * US-E10-02/AC3, AC4, AC7: newer or unreadable stored data. Nothing is written until the parent
 * chooses: export the stored text as it is, or (unreadable data only) start over after a dialog.
 */
export function RecoveryScreen({ kind, raw }: { kind: 'too-new' | 'corrupt'; raw: string }) {
  const { t, repository, services, startOver } = useApp();
  const [asking, setAsking] = useState(false);
  const [titleKey, bodyKey]: [MessageKey, MessageKey] =
    kind === 'too-new' ? ['storage.newer', 'storage.newer.body'] : ['storage.corrupt.title', 'storage.corrupt.body'];
  const exportRaw = () => void services.fileExport.save(repository.exportFileName(), raw, 'application/json');
  return (
    <div className="screen" data-testid={kind === 'too-new' ? 'screen-newer-data' : 'screen-corrupt-data'}>
      <header className="topbar">
        <div className="appbar__inner">
          <span className="appbar__name">{t('app.name')}</span>
          <LangToggle />
        </div>
      </header>
      <main id="main" className="page">
        <h1 className="card__title">{t(titleKey)}</h1>
        <p>{t(bodyKey)}</p>
        <div className="stack">
          <button type="button" className="btn btn--primary" data-testid="recovery-export" onClick={exportRaw}>
            {t(kind === 'too-new' ? 'data.export' : 'storage.corrupt.export')}
          </button>
          {kind === 'corrupt' && (
            <button type="button" className="btn btn--destructive-text" data-testid="recovery-reset" onClick={() => setAsking(true)}>
              {t('storage.corrupt.reset')}
            </button>
          )}
        </div>
      </main>
      {asking && (
        <Dialog
          name="reset-store"
          destructive
          title={t('storage.corrupt.resetTitle')}
          body={<p>{t('storage.corrupt.resetBody')}</p>}
          confirmLabel={t('storage.corrupt.reset')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            void startOver().then(() => navigate({ name: 'onboarding', step: 1, month: null, manual: false }, { force: true }));
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}

export function LoadingScreen() {
  const { t } = useApp();
  return (
    <div className="screen" aria-busy="true" data-testid="screen-loading">
      <p className="visually-hidden">{t('common.loading')}</p>
    </div>
  );
}
