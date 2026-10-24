// Calendar shell (M2 adds assessments and decisions) (architecture §11.3): app bar, month navigation, weekday
// header and day numerals for the current Tokyo month (US-E5-01/AC1–AC2, AC5–AC6). Cells
// carry no assessment or decision yet (M2) and a plain table stands in for the M2 grid.
import { useEffect, useRef, useState } from 'react';
import { addMonths, monthGrid, monthOf, weekdayOf, weekdayOrder, type LocalDate, type YearMonth } from '../../domain/time/jst.ts';
import { formatDate, formatMonth } from '../../i18n/format.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useApp } from '../app-store.tsx';
import { AppBar } from '../components/Bars.tsx';
import { Icon } from '../components/Icon.tsx';
import { navigate, toHash } from '../router.ts';
import { hasEverConfirmed, pendingReview } from '../../domain/menu/store-ops.ts';
import { monthLabel } from './ImportScreen.tsx';

export function CalendarScreen({ month: requested }: { month: YearMonth | null }) {
  const { state, t, today } = useApp();
  const currentMonth = monthOf(today);
  const month = requested ?? currentMonth;
  const weekStartsOn = state.phase === 'ready' ? state.store.settings.weekStartsOn : 'monday';
  const lang = state.language;
  const title = formatMonth(t, lang, month);
  const [live, setLive] = useState('');
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLive(t('live.monthChanged', { month: title }));
  }, [month, t, title]);

  const go = (target: YearMonth) => navigate({ name: 'calendar', month: target });
  const store = state.phase === 'ready' ? state.store : null;
  const everConfirmed = store !== null && hasEverConfirmed(store);
  // US-E1-01/AC5, US-E3-06/AC5: the generic wording only while no menu was ever confirmed.
  const missingKey: MessageKey = month === currentMonth && !everConfirmed ? 'menuCard.missing.current' : 'menuCard.missing.month';
  const confirmed = store?.menus[month]?.confirmed ?? null;
  // US-E3-06/AC3: never for past months.
  const showMissing = confirmed === null && month >= currentMonth;
  const pending = store === null ? null : pendingReview(store);

  return (
    <div className="screen" data-testid="screen-calendar">
      <AppBar />
      <main id="main" className="page">
        {pending !== null && (
          <section className="card card--warning" data-testid="card-menu-pending">
            <h2 className="card__title">{t('menuCard.pending')}</h2>
            <a className="btn btn--primary" href={toHash({ name: 'review', month: pending.month as YearMonth, manual: false })} data-testid="card-menu-pending-action">
              {t('menuCard.pending.action')}
            </a>
          </section>
        )}
        {showMissing && (
          <section className="card card--warning" data-testid="menu-card-missing">
            <h2 className="card__title">{t(missingKey, { m: monthLabel(t, lang, month) })}</h2>
            <p className="card__body">{t('menuCard.missing.body')}</p>
            <a className="btn btn--primary" href={toHash({ name: 'import' })} data-testid="card-menu-import">
              {t('menuCard.import')}
            </a>
          </section>
        )}

        <nav className="monthnav" aria-label={t('cal.grid.label', { month: title })}>
          <button type="button" className="iconbtn" data-testid="cal-prev" aria-label={t('cal.prevMonth')} onClick={() => go(addMonths(month, -1))}>
            <Icon name="chevronLeft" />
          </button>
          <h2 className="monthnav__title" data-testid="cal-title">
            {title}
          </h2>
          <button type="button" className="iconbtn" data-testid="cal-next" aria-label={t('cal.nextMonth')} onClick={() => go(addMonths(month, 1))}>
            <Icon name="chevronRight" />
          </button>
          {month !== currentMonth && (
            <button type="button" className="btn btn--small" data-testid="cal-today" onClick={() => go(currentMonth)}>
              {t('cal.today')}
            </button>
          )}
        </nav>
        <p className="visually-hidden" aria-live="polite" data-testid="cal-live">
          {live}
        </p>

        <table className="calgrid" data-testid="cal-grid" data-week-starts-on={weekStartsOn}>
          <caption className="visually-hidden">{t('cal.grid.label', { month: title })}</caption>
          <thead>
            <tr>
              {weekdayOrder(weekStartsOn).map((wd) => (
                <th key={wd} scope="col" className={`calgrid__wd wd-${wd}`} abbr={t(`wd.long.${wd}` as MessageKey)}>
                  {t(`wd.short.${wd}` as MessageKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(month, weekStartsOn).map((row, r) => (
              <tr key={r}>
                {row.map((date, c) =>
                  date === null ? (
                    <td key={c} className="calgrid__cell calgrid__cell--empty" aria-hidden="true" />
                  ) : (
                    <DayCell key={date} date={date} isToday={date === today} />
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}

function DayCell({ date, isToday }: { date: LocalDate; isToday: boolean }) {
  const { state, t } = useApp();
  const wd = weekdayOf(date);
  const label = (isToday ? t('cell.aria.today') : '') + t('cell.aria.noMenu', { date: formatDate(t, state.language, date) });
  return (
    <td
      className={`calgrid__cell wd-${wd}${isToday ? ' is-today' : ''}`}
      data-testid={`cal-cell-${date}`}
      data-today={isToday ? 'true' : undefined}
      aria-current={isToday ? 'date' : undefined}
    >
      <span className="calgrid__num" aria-hidden="true">
        {Number(date.slice(8, 10))}
      </span>
      <span className="visually-hidden">{label}</span>
    </td>
  );
}
