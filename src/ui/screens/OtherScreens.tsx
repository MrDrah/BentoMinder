// M0 placeholders for routes whose screens arrive in later milestones, plus the not-found and
// stored-data recovery screens (design/components.md §12). Every string comes from the catalog.
import { formatDate } from '../../i18n/format.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { useApp } from '../app-store.tsx';
import { TopBar } from '../components/Bars.tsx';
import { LangToggle } from '../components/LangToggle.tsx';
import type { Route } from '../router.ts';
import { toHash } from '../router.ts';

type PlaceholderRoute = Exclude<Route, { name: 'calendar' } | { name: 'not-found' }>;

export function screenTitle(route: PlaceholderRoute, t: Translate, lang: Language): string {
  switch (route.name) {
    case 'day':
      return formatDate(t, lang, route.date);
    case 'recipe':
    case 'recipes':
      return t('library.title');
    case 'settings':
      return t('settings.title');
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

export function RecoveryScreen({ kind }: { kind: 'too-new' | 'corrupt' }) {
  const { t } = useApp();
  const [titleKey, bodyKey]: [MessageKey, MessageKey] =
    kind === 'too-new' ? ['storage.newer', 'storage.newer.body'] : ['storage.corrupt.title', 'storage.corrupt.body'];
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
      </main>
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
