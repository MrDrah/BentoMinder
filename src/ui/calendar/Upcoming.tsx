// Upcoming summary (design/components.md §2.5) and legend (§2.8).
import { useState } from 'react';
import type { UpcomingSummary } from '../../domain/calendar/day-view.ts';
import { diffDays, type LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { useApp } from '../app-store.tsx';
import { AssessMark, BentoIcon, FlagBadge } from '../components/Marks.tsx';
import { navigate } from '../router.ts';
import { recipeName } from './labels.ts';

export function UpcomingSummaryCard({ summary, today }: { summary: UpcomingSummary; today: LocalDate }) {
  const { t, state } = useApp();
  const lang = state.language;
  const open = (date: LocalDate) => navigate({ name: 'day', date });
  const when = (date: LocalDate) => {
    const n = diffDays(today, date);
    return n === 0 ? t('upcoming.today') : n === 1 ? t('upcoming.tomorrow') : t('upcoming.inDays', { n });
  };
  return (
    <section className="upcoming" data-testid="upcoming" aria-labelledby="upcoming-title">
      <h2 id="upcoming-title" className="upcoming__title">
        {t('upcoming.title')}
      </h2>
      {summary.planned.length === 0 && (
        <p className="upcoming__empty" data-testid="upcoming-empty">
          {t('upcoming.empty')}
        </p>
      )}
      <ul className="upcoming__list">
        {summary.planned.map(({ date, record }) => (
          <li key={date}>
            <button type="button" className="upcoming__row" data-testid={`upcoming-row-${date}`} onClick={() => open(date)}>
              <span className="upcoming__swatch upcoming__swatch--planned">
                <BentoIcon filled />
              </span>
              <span className="upcoming__text">
                <span>{formatDate(t, lang, date)}</span> <span lang={lang === 'en' && record.recipeNameSnapshot?.en !== undefined ? 'en' : 'ja'}>{recipeName(record, lang)}</span>
                <span className="upcoming__sub">{when(date)}</span>
              </span>
            </button>
          </li>
        ))}
        {summary.conflicts.map((date) => (
          <li key={`c-${date}`}>
            <button type="button" className="upcoming__row" data-testid={`upcoming-conflict-${date}`} onClick={() => open(date)}>
              <span className="upcoming__swatch" style={{ position: 'relative' }}>
                <FlagBadge />
              </span>
              <span className="upcoming__text">{t('upcoming.conflict', { date: formatDate(t, lang, date) })}</span>
            </button>
          </li>
        ))}
        {summary.notConfirmed.map((date) => (
          <li key={`n-${date}`}>
            <button type="button" className="upcoming__row" data-testid={`upcoming-nc-${date}`} onClick={() => open(date)}>
              <span className="upcoming__swatch">
                <BentoIcon filled={false} />
              </span>
              <span className="upcoming__text">{t('upcoming.notConfirmed', { date: formatDate(t, lang, date) })}</span>
            </button>
          </li>
        ))}
        {summary.lowCount > 0 && summary.firstLow !== null && (
          <li>
            <button type="button" className="upcoming__row upcoming__row--attention" data-testid="upcoming-low" onClick={() => open(summary.firstLow as LocalDate)}>
              <span className="upcoming__swatch">
                <AssessMark state="low-preference" size={20} />
              </span>
              <span className="upcoming__text">
                {t('upcoming.lowCount', { n: summary.lowCount })}
                <span className="upcoming__sub">{t('upcoming.lowCount.sub')}</span>
              </span>
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Expanded until the first bento is planned, then collapsed; the parent can toggle it. */
export function Legend({ anyPlanned }: { anyPlanned: boolean }) {
  const { t } = useApp();
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? !anyPlanned;
  return (
    <section className="legend" data-testid="legend">
      <button type="button" className="legend__toggle" aria-expanded={expanded} aria-controls="legend-body" data-testid="legend-toggle" onClick={() => setOpen(!expanded)}>
        {t('legend.title')}
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ transform: expanded ? 'rotate(90deg)' : undefined }}>
          <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id="legend-body" hidden={!expanded}>
        <p className="card__body">{t('legend.rule')}</p>
        <ul className="legend__list">
          <li className="legend__item">
            <span className="legend__swatch" style={{ background: 'var(--navy-fill)', color: 'var(--ink-inverse)' }}>
              <BentoIcon filled />
            </span>
            {t('legend.planned')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch" style={{ borderColor: 'var(--ink-1)', borderWidth: 2 }}>
              <BentoIcon filled={false} />
            </span>
            {t('legend.notConfirmed')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch" style={{ borderColor: 'var(--accent)', borderStyle: 'dashed', borderWidth: 2 }}>
              <AssessMark state="low-preference" />
            </span>
            {t('legend.suggest')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch">
              <AssessMark state="likely-enjoyable" />
            </span>
            {t('state.likely')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch">
              <AssessMark state="mixed-uncertain" />
            </span>
            {t('state.mixed')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch">
              <AssessMark state="not-assessed" />
            </span>
            {t('state.notAssessed')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch" style={{ background: 'var(--surface-2) var(--hatch)' }} />
            {t('legend.noLunch')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch" style={{ background: 'var(--surface-2) var(--hatch)' }}>
              <BentoIcon filled={false} />
            </span>
            {t('legend.bentoDay')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch" style={{ position: 'relative' }}>
              <FlagBadge />
            </span>
            {t('legend.changed')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch">
              <AssessMark state="low-preference" overridden />
            </span>
            {t('legend.override')}
          </li>
          <li className="legend__item">
            <span className="legend__swatch" style={{ color: 'var(--saturday)' }}>
              {t('wd.short.6')}
            </span>
            {t('legend.weekend')}
          </li>
        </ul>
      </div>
    </section>
  );
}
