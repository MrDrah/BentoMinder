// Brand-info disclosure (design/components.md §17.2): the app-bar brand is one button that opens a panel
// explaining what the app is. Same DOM for every width: CSS decides between the inline pull-down (phones)
// and the non-modal popover (from 768 px). Closed on every load, never remembered.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useApp } from '../app-store.tsx';
import { ConsentDialog } from '../screens/ImportScreen.tsx';
import { Icon } from './Icon.tsx';

declare const __APP_VERSION__: string;
const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

/** Renders the app bar through `bar(brand)` and the panel right after it (a sibling of the sticky bar). */
export function AboutDisclosure({ bar }: { bar: (brand: ReactNode) => ReactNode }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();
  const headingId = `${panelId}-h`;

  useEffect(() => {
    if (!open) return;
    const inDialog = (target: EventTarget | null) => target instanceof Element && target.closest('[role="dialog"]') !== null;
    const onKey = (e: globalThis.KeyboardEvent) => {
      // Esc inside a dialog (the consent text) belongs to the dialog.
      if (e.key !== 'Escape' || e.defaultPrevented || inDialog(e.target)) return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      // A tap outside closes the popover; on phones the panel is part of the page and stays.
      if (typeof window.matchMedia !== 'function' || !window.matchMedia('(min-width: 768px)').matches) return;
      const target = e.target as Node | null;
      if (target === null || panel.current?.contains(target) || trigger.current?.contains(target) || inDialog(target)) return;
      setOpen(false);
    };
    const onHash = () => setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('hashchange', onHash);
    };
  }, [open]);

  // The panel sits after the sticky bar in the DOM, so Tab order is managed here (components 17.2, a11y 12):
  // trigger -> consent -> close -> language toggle; Shift+Tab from consent goes back to the trigger.
  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Tab' || e.shiftKey || !open) return;
    e.preventDefault();
    panel.current?.querySelector<HTMLElement>('[data-testid="about-consent"]')?.focus();
  };
  const onPanelKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab' || !(e.target instanceof Element)) return;
    const id = e.target.getAttribute('data-testid');
    if (id === 'about-close' && !e.shiftKey) {
      const next = document.querySelector<HTMLElement>('[data-testid="appbar-lang"] button:not([tabindex="-1"])');
      if (next !== null) {
        e.preventDefault();
        next.focus();
      }
    } else if (id === 'about-consent' && e.shiftKey) {
      e.preventDefault();
      trigger.current?.focus();
    }
  };

  const brand = (
    <button ref={trigger} onKeyDown={onTriggerKey} type="button" className="brand-btn" aria-expanded={open} aria-controls={panelId} aria-label={t('about.open')} data-testid="about-toggle" onClick={() => setOpen((v) => !v)}>
      <span className="appbar__logo" aria-hidden="true" />
      <span className="appbar__name" aria-hidden="true">
        {t('app.name')}
      </span>
      <span className="brand-btn__badge" aria-hidden="true">
        <Icon name="info" />
      </span>
    </button>
  );

  return (
    <>
      {bar(brand)}
      <section ref={panel} id={panelId} className="about" role="region" aria-labelledby={headingId} hidden={!open} data-testid="about-panel" onKeyDown={onPanelKey}>
        <h2 id={headingId} className="about__heading">
          {t('app.tagline')}
        </h2>
        <p className="about__text">{t('about.body.1')}</p>
        <p className="about__text">{t('about.body.2')}</p>
        <button type="button" className="btn btn--text about__link" data-testid="about-consent" onClick={() => setConsent(true)}>
          {t('settings.about.consent')}
        </button>
        <p className="about__version">{t('settings.about.version', { v: VERSION })}</p>
        <button
          type="button"
          className="btn btn--text about__close"
          aria-label={t('about.close')}
          data-testid="about-close"
          onClick={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        >
          {t('common.close')}
        </button>
      </section>
      {consent && <ConsentDialog readOnly onAccept={() => setConsent(false)} onDecline={() => setConsent(false)} />}
    </>
  );
}
