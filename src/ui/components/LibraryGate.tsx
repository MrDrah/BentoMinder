// The recipe library loads as its own chunk (ADR 001 budgets). Screens that need recipes render through this gate:
// a calm skeleton while it loads (never "no recipes"), and a plain retry state if the request failed.
import { useEffect, type ReactNode } from 'react';
import { useApp } from '../app-store.tsx';
import { TopBar } from './Bars.tsx';

export function LibraryGate({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  const { t, libraryStatus, requestLibrary, retryLibrary } = useApp();
  useEffect(() => {
    if (libraryStatus === 'loading') requestLibrary();
  }, [libraryStatus, requestLibrary]);
  if (libraryStatus === 'ready') return <>{children}</>;
  return (
    <div className="screen" data-testid={`${testId}-wait`}>
      <TopBar title={title} />
      <main id="main" className="page page--wide">
        {libraryStatus === 'loading' ? (
          <div className="family-skeleton" role="status" aria-busy="true" data-testid="library-skeleton">
            <span className="visually-hidden">{t('common.loading')}</span>
            <span className="family-skeleton__line" />
            <span className="family-skeleton__block" />
            <span className="family-skeleton__block" />
            <span className="family-skeleton__block" />
            <span className="family-skeleton__line family-skeleton__line--short" />
          </div>
        ) : (
          <section className="card" data-testid="library-error">
            <p className="card__body">{t('common.error.generic')}</p>
            <button type="button" className="btn btn--secondary" onClick={retryLibrary} data-testid="library-retry">
              {t('common.retry')}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
