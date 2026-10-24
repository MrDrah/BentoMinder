// App shell: skip link, storage banner, and the screen for the current hash route.
import { useEffect } from 'react';
import { formatMonth } from '../i18n/format.ts';
import { monthOf } from '../domain/time/jst.ts';
import { useApp } from './app-store.tsx';
import { useRoute, type Route } from './router.ts';
import { CalendarScreen } from './screens/CalendarScreen.tsx';
import { LoadingScreen, NotFoundScreen, PlaceholderScreen, RecoveryScreen, screenTitle } from './screens/OtherScreens.tsx';

export function App() {
  const { state, t, today } = useApp();
  const route = useRoute();

  const docScreen = (r: Route): string => {
    if (r.name === 'calendar') return formatMonth(t, state.language, r.month ?? monthOf(today));
    if (r.name === 'not-found') return t('notFound.title');
    return screenTitle(r, t, state.language);
  };
  const docTitle = t('app.docTitle', { screen: docScreen(route) });
  useEffect(() => {
    document.title = docTitle;
  }, [docTitle]);

  if (state.phase === 'loading') return <LoadingScreen />;
  if (state.phase === 'too-new' || state.phase === 'corrupt') return <RecoveryScreen kind={state.phase} />;

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
      {route.name === 'calendar' ? (
        <CalendarScreen month={route.month} />
      ) : route.name === 'not-found' ? (
        <NotFoundScreen />
      ) : (
        <PlaceholderScreen route={route} />
      )}
    </>
  );
}
