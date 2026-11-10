// Upcoming summary (design/components.md §2.5, §18.8) and legend (§18.7).
import { useState, type ReactNode } from 'react';
import type { UpcomingSummary } from '../../domain/calendar/day-view.ts';
import { diffDays, type LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { useApp } from '../app-store.tsx';
import { AllergenMark, AssessMark, FlagBadge, TileIcon } from '../components/Marks.tsx';
import { navigate } from '../router.ts';
import { recipeName } from './labels.ts';
import { TILE_ICON_NAMES, type TileIconKind } from './tile.ts';

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
                <TileIcon name="home-bento" size={20} />
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
                <TileIcon name="bento-unsure" size={20} />
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

interface SampleProps {
  icon: TileIconKind;
  dash?: boolean;
  changed?: boolean;
  allergen?: boolean;
  today?: boolean;
  tomorrow?: boolean;
  past?: boolean;
  weekend?: boolean;
}

/** One legend row: a 40 x 44 sample drawn with the real tile styles (aria-hidden) and one text line (components §18.7). */
function LegendRow({ text, icon, dash, changed, allergen, today, tomorrow, past, weekend }: SampleProps & { text: string }) {
  const classes = ['cell', 'legend__sample', weekend ? 'wd-6' : 'wd-3', icon !== 'none' ? 'has-icon' : '', today ? 'is-today' : '', tomorrow ? 'is-tomorrow' : '', past ? 'is-past' : '', changed ? 'is-changed' : '', allergen ? 'legend__sample--tall' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <li className="legend__item" data-testid="legend-row">
      <span className={classes} aria-hidden="true">
        <span className="cell__btn">
          <span className="cell__top">
            <span className="cell__num">{weekend ? 7 : 12}</span>
          </span>
          {icon !== 'none' && <TileIcon name={TILE_ICON_NAMES[icon]} className="cell__icon" />}
          {dash && <span className="cell__dash" />}
          {allergen && <AllergenMark />}
        </span>
      </span>
      <span>{text}</span>
    </li>
  );
}

/**
 * Tools row (components.md §17.5): the share button `share` and the legend toggle on one row, the legend body
 * below as a card. Always closed on load (UI refresh 2026-11); the open state lasts for the session only.
 */
export function Legend({ share }: { share: ReactNode }) {
  const { t } = useApp();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="legend" data-testid="legend">
      <div className="cal-tools">
        {share}
        <button type="button" className="legend__toggle" aria-expanded={expanded} aria-controls="legend-body" data-testid="legend-toggle" onClick={() => setExpanded(!expanded)}>
          {t('legend.title')}
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ transform: expanded ? 'rotate(90deg)' : undefined }}>
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div id="legend-body" className="card" hidden={!expanded}>
        <p className="card__body">{t('legend.intro')}</p>
        <ul className="legend__list">
          <LegendRow text={t('legend.school')} icon="school" />
          <LegendRow text={t('legend.home')} icon="home" />
          <LegendRow text={t('legend.unsure')} icon="unsure" />
          <LegendRow text={t('legend.dash')} icon="home" dash />
          <LegendRow text={t('legend.allergen')} icon="school" allergen />
          <LegendRow text={t('legend.changedEdge')} icon="school" changed />
          <LegendRow text={t('legend.today')} icon="school" today />
          <LegendRow text={t('legend.tomorrow')} icon="school" tomorrow />
          <LegendRow text={t('legend.past')} icon="school" past />
          <LegendRow text={t('legend.weekend')} icon="none" weekend />
        </ul>
      </div>
    </div>
  );
}
