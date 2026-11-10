// design/components.md §1.1 App bar (calendar home) and §1.2 Top bar (every other screen).
import { useApp } from '../app-store.tsx';
import { toHash, type Route } from '../router.ts';
import { SyncStatusButton, useSyncButtonShown } from '../sync/SyncStatusButton.tsx';
import { AboutDisclosure } from './AboutPanel.tsx';
import { Icon } from './Icon.tsx';
import { LangToggle } from './LangToggle.tsx';

export function AppBar() {
  const { t } = useApp();
  const syncShown = useSyncButtonShown();
  return (
    <AboutDisclosure
      bar={(brand) => (
        <header className={`appbar${syncShown ? ' appbar--sync' : ''}`} data-testid="appbar">
          <div className="appbar__inner">
            <span className="appbar__brand">{brand}</span>
            <div className="appbar__controls">
              <div data-testid="appbar-lang">
                <LangToggle />
              </div>
              <a className="iconbtn" href={toHash({ name: 'recipes' })} data-testid="appbar-recipes" aria-label={t('nav.recipes')}>
                <Icon name="book" />
                <span className="iconbtn__label">{t('nav.recipes')}</span>
              </a>
              <SyncStatusButton />
              <a className="iconbtn" href={toHash({ name: 'settings' })} data-testid="appbar-settings" aria-label={t('nav.settings')}>
                <Icon name="gear" />
                <span className="iconbtn__label">{t('nav.settings')}</span>
              </a>
            </div>
          </div>
        </header>
      )}
    />
  );
}

/** `back` overrides the default target (the calendar), e.g. settings opened from an onboarding step. */
export function TopBar({ title, back: target }: { title: string; back?: { route: Route; screen: string } }) {
  const { t } = useApp();
  const back = t('nav.backTo', { screen: target?.screen ?? t('nav.calendar') });
  return (
    <header className="topbar">
      <div className="appbar__inner">
        <a className="iconbtn" href={toHash(target?.route ?? { name: 'calendar', month: null })} data-testid="topbar-back" aria-label={back}>
          <Icon name="chevronLeft" />
        </a>
        <h1 className="topbar__title" data-testid="topbar-title">
          {title}
        </h1>
        <LangToggle />
      </div>
    </header>
  );
}
