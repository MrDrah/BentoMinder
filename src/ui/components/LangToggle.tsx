// design/components.md §1.7: segmented control 日本語 / EN (US-E8-01/AC2–AC3).
import { useRef, type KeyboardEvent } from 'react';
import type { Language, Translate } from '../../i18n/index.ts';
import { useApp } from '../app-store.tsx';

const OPTIONS: readonly Language[] = ['ja', 'en'];

export function LangToggle() {
  const { state, t, setLanguage } = useApp();
  return <LangToggleView language={state.language} t={t} onChange={setLanguage} />;
}

/** The same control without the app context (the login screen has no store yet). */
export function LangToggleView({ language, t, onChange: setLanguage, testId = 'lang-toggle' }: { language: Language; t: Translate; onChange: (language: Language) => void; testId?: string }) {
  const refs = useRef<Record<Language, HTMLButtonElement | null>>({ ja: null, en: null });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next: Language = language === 'ja' ? 'en' : 'ja';
    setLanguage(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      className="seg"
      role="radiogroup"
      aria-label={t('lang.toggle.aria')}
      data-testid={testId}
      onKeyDown={onKeyDown}
    >
      {OPTIONS.map((lang) => {
        const checked = language === lang;
        return (
          <button
            key={lang}
            ref={(el) => {
              refs.current[lang] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            lang={lang}
            className="seg__option"
            data-testid={`lang-toggle-${lang}`}
            onClick={() => setLanguage(lang)}
          >
            {t(lang === 'ja' ? 'lang.toggle.ja' : 'lang.toggle.en')}
          </button>
        );
      })}
    </div>
  );
}
