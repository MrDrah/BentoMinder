// 「確認が必要な日」 (design/components.md §7; US-E3-05/AC9, AC11–AC13): the dates a menu refresh
// changed under an override, a bento plan or a "decide later" mark. Computed from the stored
// records each time it opens (nothing remembers "opened"); nothing here changes a record.
import { useEffect, useMemo } from 'react';
import { refreshReviewRows } from '../../domain/calendar/day-view.ts';
import type { ReviewReason } from '../../domain/menu/refresh.ts';
import type { YearMonth } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useApp, useStore } from '../app-store.tsx';
import { TopBar } from '../components/Bars.tsx';
import { useDayViewer } from '../calendar/use-day-viewer.ts';
import { navigate } from '../router.ts';

const REASON_KEYS: Record<ReviewReason, MessageKey> = {
  planned: 'refresh.review.item.planned',
  'not-confirmed': 'refresh.review.item.notConfirmed',
  override: 'refresh.review.item.override',
};

export function RefreshReviewScreen({ month, fresh }: { month: YearMonth; fresh: boolean }) {
  const { t, state, today } = useApp();
  const store = useStore();
  const viewer = useDayViewer();
  const lang = state.language;
  const rows = useMemo(() => refreshReviewRows(store, month, today, viewer), [store, month, today, viewer]);
  const anyOpen = rows.some((r) => r.open);
  const toCalendar = () => navigate({ name: 'calendar', month }, { force: true });

  // Reached again later (not right after the confirm) with nothing open: back to the calendar.
  useEffect(() => {
    if (!fresh && !anyOpen) navigate({ name: 'calendar', month }, { force: true });
  }, [fresh, anyOpen, month]);

  return (
    <div className="screen" data-testid="screen-refresh-review">
      <TopBar title={t('refresh.review.title')} />
      <main id="main" className="page">
        {rows.length === 0 ? (
          <p data-testid="refresh-review-empty">{t('refresh.review.empty')}</p>
        ) : (
          <>
            <p>{t('refresh.review.lead')}</p>
            <ul className="review-list" data-testid="refresh-review">
              {rows.map((row) => {
                const date = formatDate(t, lang, row.date);
                return (
                  <li key={row.date} className="review-list__row" data-testid={`refresh-review-row-${row.date}`} data-open={row.open ? 'true' : 'false'}>
                    <div className="review-list__text">
                      <span className="review-list__date">{date}</span>
                      {row.reasons.map((reason) => (
                        <span key={reason} className="review-list__reason">
                          {t(REASON_KEYS[reason])}
                        </span>
                      ))}
                      {row.detail !== null && <span className="review-list__sub">{t(row.detail === 'removed' ? 'refresh.review.item.removed' : 'refresh.review.item.nowNoLunch')}</span>}
                    </div>
                    {!row.open && (
                      <span aria-hidden="true">
                        <svg className="icon" viewBox="0 0 24 24" focusable="false">
                          <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                    {!row.open && <span className="visually-hidden">{t('refresh.review.visited')}</span>}
                    <button type="button" className="btn btn--secondary btn--small" aria-label={t('refresh.review.openDay', { date })} data-testid={`refresh-review-open-${row.date}`} onClick={() => navigate({ name: 'day', date: row.date })}>
                      {t('refresh.review.open')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <button type="button" className="btn btn--primary" data-testid="refresh-review-done" onClick={toCalendar}>
          {t('refresh.review.done')}
        </button>
      </main>
    </div>
  );
}
