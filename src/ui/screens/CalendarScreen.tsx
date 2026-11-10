// Calendar home (design/components.md §2, flows F5): menu cards, the upcoming summary, month
// navigation, the month grid with the assessment and the decision of every school day shown
// separately, the legend and the day sheet (bottom sheet, dialog or side panel).
import { useEffect, useMemo, useRef, useState } from 'react';
import { upcomingSummary } from '../../domain/calendar/day-view.ts';
import { hasEverConfirmed, pendingReview } from '../../domain/menu/store-ops.ts';
import { toJstTimestamp, addMonths, datesOfMonth, monthOf, type LocalDate, type YearMonth } from '../../domain/time/jst.ts';
import { formatMonth } from '../../i18n/format.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useApp, useStore } from '../app-store.tsx';
import { AppBar } from '../components/Bars.tsx';
import { Icon } from '../components/Icon.tsx';
import { Agenda } from '../calendar/Agenda.tsx';
import { CalendarGrid } from '../calendar/CalendarGrid.tsx';
import { DaySheet } from '../calendar/DaySheet.tsx';
import { ShareSheet } from '../calendar/ShareSheet.tsx';
import { TodayCard } from '../calendar/TodayCard.tsx';
import { Legend, UpcomingSummaryCard } from '../calendar/Upcoming.tsx';
import { useDayViewer } from '../calendar/use-day-viewer.ts';
import { useElementWidth, useSheetMode } from '../hooks.ts';
import { ReminderList } from '../reminders/ReminderList.tsx';
import { navigate, toHash } from '../router.ts';
import { monthLabel } from './ImportScreen.tsx';

/** The grid needs about 4 em per weekday cell: below that (320 px reflow, 200 % text) the agenda list is shown. */
const AGENDA_BELOW_PX = 340;

export function CalendarScreen({ month: requested, openDate }: { month: YearMonth | null; openDate: LocalDate | null }) {
  const { state, t, today, now, commit, showSaveFailed } = useApp();
  const store = useStore();
  const viewer = useDayViewer();
  const mode = useSheetMode();
  const currentMonth = monthOf(today);
  const month = openDate !== null ? monthOf(openDate) : (requested ?? currentMonth);
  const lang = state.language;
  const weekStartsOn = store.settings.weekStartsOn;
  const title = formatMonth(t, lang, month);
  const [live, setLive] = useState('');
  const first = useRef(true);
  const calRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(calRef);
  const rootPx = typeof document === 'undefined' ? 16 : Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const agenda = width > 0 && width < AGENDA_BELOW_PX * (rootPx / 16);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLive(t('live.monthChanged', { month: title }));
  }, [month, t, title]);

  const views = useMemo(() => new Map(datesOfMonth(month).map((date) => [date, viewer(store, date, today)] as const)), [store, month, today, viewer]);
  const summary = useMemo(() => upcomingSummary(store, today, viewer), [store, today, viewer]);

  // Focus goes back to the cell when the sheet closes (a11y §4).
  const lastOpened = useRef<LocalDate | null>(null);
  useEffect(() => {
    if (openDate !== null) {
      lastOpened.current = openDate;
      return;
    }
    const date = lastOpened.current;
    lastOpened.current = null;
    if (date !== null) document.querySelector<HTMLElement>(`[data-testid="cal-cell-${date}"] button`)?.focus();
  }, [openDate]);

  const go = (target: YearMonth) => navigate({ name: 'calendar', month: target });
  const everConfirmed = hasEverConfirmed(store);
  // US-E1-01/AC5, US-E3-06/AC5: the generic wording only while no menu was ever confirmed.
  const missingKey: MessageKey = month === currentMonth && !everConfirmed ? 'menuCard.missing.current' : 'menuCard.missing.month';
  const confirmed = store.menus[month]?.confirmed ?? null;
  // US-E3-06/AC3: never for past months.
  const showMissing = confirmed === null && month >= currentMonth;
  const pending = pendingReview(store);
  // US-E3-06/AC2, AC6, AC7: from the prompt day, once per day, until the next month is confirmed.
  const nextMonth = addMonths(currentMonth, 1);
  const showNext = Number(today.slice(8, 10)) >= store.settings.nextMonthPromptFromDay && store.menus[nextMonth]?.confirmed == null && store.nextMonthCardHiddenOn !== today;
  const hideNext = async () => {
    if (!(await commit({ ...store, nextMonthCardHiddenOn: today, updatedAt: toJstTimestamp(now()) }))) showSaveFailed();
  };

  const open = (date: LocalDate) => navigate({ name: 'day', date });
  const close = () => navigate({ name: 'calendar', month });

  return (
    <div className="screen" data-testid="screen-calendar">
      <AppBar />
      <div className="cal-layout">
        <main id="main" className="page">
          <div className="cal-block">
            <div className="cal-alerts">
              <ReminderList />
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
            </div>

            <nav className="monthnav" aria-label={t('cal.nav.label')}>
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
                <button type="button" className="btn btn--secondary btn--small" data-testid="cal-today" onClick={() => go(currentMonth)}>
                  {t('cal.today')}
                </button>
              )}
            </nav>
            <p className="visually-hidden" aria-live="polite" data-testid="cal-live">
              {live}
            </p>

            <div ref={calRef} className="cal">
              {agenda ? (
                <Agenda t={t} lang={lang} month={month} views={views} today={today} onOpen={open} />
              ) : (
                <CalendarGrid t={t} lang={lang} month={month} today={today} weekStartsOn={weekStartsOn} views={views} selected={mode === 'panel' ? openDate : null} onOpen={open} onMonth={(m) => go(m)} />
              )}
            </div>
          </div>

          <div className="cal-below">
            <TodayCard />
            <UpcomingSummaryCard summary={summary} today={today} />
            {showNext && (
              <section className="card card--warning" data-testid="card-menu-next">
                <h2 className="card__title">{t('menuCard.nextMonth', { m: monthLabel(t, lang, nextMonth) })}</h2>
                <div className="review-day__actions-row">
                  <a className="btn btn--primary" href={toHash({ name: 'import' })} data-testid="card-menu-next-import">
                    {t('menuCard.import')}
                  </a>
                  <button type="button" className="btn btn--text" data-testid="card-menu-next-dismiss" onClick={() => void hideNext()}>
                    {t('menuCard.dismiss')}
                  </button>
                </div>
              </section>
            )}
            <Legend share={<ShareSheet />} />
          </div>
        </main>
        {mode === 'panel' && openDate === null && <aside className="sheet-empty">{t('day.panel.empty')}</aside>}
        {mode === 'panel' && openDate !== null && <DaySheet date={openDate} mode={mode} onClose={close} />}
      </div>
      {mode !== 'panel' && openDate !== null && <DaySheet date={openDate} mode={mode} onClose={close} />}
    </div>
  );
}
