// App shell: skip link, storage banner, toast, and the screen for the current hash route. On
// first load it opens onboarding when needed (US-E1-01/AC1–AC3, US-E1-06/AC3).
import { useEffect, useRef, useState } from 'react';
import { startScreen } from '../domain/menu/store-ops.ts';
import { formatMonth } from '../i18n/format.ts';
import { monthOf } from '../domain/time/jst.ts';
import { useApp } from './app-store.tsx';
import { Toast } from './components/Controls.tsx';
import { navigate, toHash, useRoute, type Route } from './router.ts';
import { CalendarScreen } from './screens/CalendarScreen.tsx';
import { ImportScreen } from './screens/ImportScreen.tsx';
import { OnboardingScreen } from './screens/OnboardingScreen.tsx';
import { LoadingScreen, NotFoundScreen, PlaceholderScreen, RecoveryScreen, screenTitle } from './screens/OtherScreens.tsx';
import { ReviewScreen } from './screens/ReviewScreen.tsx';
import { ProfileEditScreen, SettingsScreen } from './screens/SettingsScreen.tsx';
import { TopBar } from './components/Bars.tsx';

export function App() {
  const { state, t, today } = useApp();
  const route = useRoute();
  const gated = useRef(false);

  const docScreen = (r: Route): string => {
    if (r.name === 'calendar') return formatMonth(t, state.language, r.month ?? monthOf(today));
    if (r.name === 'not-found') return t('notFound.title');
    return screenTitle(r, t, state.language);
  };
  const docTitle = t('app.docTitle', { screen: docScreen(route) });
  useEffect(() => {
    document.title = docTitle;
  }, [docTitle]);

  // Decided once, on the first ready render, and shown at once (no flash of the calendar).
  const [redirect, setRedirect] = useState<Route | null>(null);
  if (state.phase === 'ready' && !gated.current) {
    gated.current = true;
    const start = startScreen(state.store);
    let target: Route | null = null;
    if (start === 'onboarding-1' && !(route.name === 'onboarding' && route.step === 1)) target = { name: 'onboarding', step: 1, month: null, manual: false };
    else if (start === 'onboarding-2' && route.name !== 'onboarding') target = { name: 'onboarding', step: 2, month: null, manual: false };
    if (target !== null) setRedirect(target);
  }
  useEffect(() => {
    if (redirect === null) return;
    if (toHash(route) === toHash(redirect)) setRedirect(null);
    else navigate(redirect);
  }, [redirect, route]);
  const shown = redirect ?? route;

  if (state.phase === 'loading') return <LoadingScreen />;
  if (state.phase === 'too-new' || state.phase === 'corrupt') return <RecoveryScreen kind={state.phase} raw={state.raw} />;

  return (
    <>
      <a className="skip-link" href="#main">
        {t('nav.skip')}
      </a>
      {state.saveFailed && (
        <div className="banner banner--danger" role="alert" data-testid="banner-storage">
          <strong>{t('storage.unavailable')}</strong>
          <span>{t('storage.unavailable.body')}</span>
        </div>
      )}
      <Screen route={shown} />
      <Toast />
    </>
  );
}

function Screen({ route }: { route: Route }) {
  const { t } = useApp();
  switch (route.name) {
    case 'calendar':
      return <CalendarScreen month={route.month} />;
    case 'onboarding':
      return <OnboardingScreen step={route.step} month={route.month} manual={route.manual} />;
    case 'import':
      return (
        <div className="screen" data-testid="screen-import-page">
          <TopBar title={t('ob.step2.name')} />
          <main id="main" className="page">
            <ImportScreen onboarding={false} />
          </main>
        </div>
      );
    case 'review':
      return (
        <div className="screen">
          <TopBar title={t('ob.step3.name')} />
          <main id="main" className="page">
            <ReviewScreen key={`${route.month}-${route.manual}`} month={route.month} manual={route.manual} onboarding={false} />
          </main>
        </div>
      );
    case 'settings':
      return <SettingsScreen />;
    case 'profile':
      return <ProfileEditScreen />;
    case 'not-found':
      return <NotFoundScreen />;
    default:
      return <PlaceholderScreen route={route} />;
  }
}
