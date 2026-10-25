// Date-correction picker (design/components.md §6.9; US-E2-05/AC7–AC10; contract rule
// review-date-correction). Works on the review draft only: nothing is stored until 「この内容で確定」.
// Only free dates of the target month can be chosen; a taken date is shown with its reason and
// never overwritten, merged or swapped.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { dateFixCells, type DateFixCell, type ReviewDraft } from '../../domain/menu/review.ts';
import { addDays, dateParts, diffDays, monthGrid, monthOf, weekdayOf, weekdayOrder, type LocalDate, type WeekStartsOn } from '../../domain/time/jst.ts';
import { formatDate, formatMonth } from '../../i18n/format.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { useFocusTrap } from '../hooks.ts';

export interface DateFixSheetProps {
  t: Translate;
  lang: Language;
  draft: ReviewDraft;
  /** The day being corrected: its current date. */
  date: LocalDate;
  weekStartsOn: WeekStartsOn;
  onApply: (to: LocalDate) => void;
  onClose: () => void;
}

/** The nearest free date with the printed weekday, else the nearest free date, else null. */
function initialFocus(cells: DateFixCell[], from: LocalDate): LocalDate | null {
  const nearest = (list: DateFixCell[]) => [...list].sort((a, b) => Math.abs(diffDays(from, a.date as LocalDate)) - Math.abs(diffDays(from, b.date as LocalDate)) || a.date.localeCompare(b.date))[0];
  const free = cells.filter((c) => c.free);
  return ((nearest(free.filter((c) => c.weekdayMatch)) ?? nearest(free))?.date ?? null) as LocalDate | null;
}

export function DateFixSheet({ t, lang, draft, date, weekStartsOn, onApply, onClose }: DateFixSheetProps) {
  const cells = useMemo(() => dateFixCells(draft, date), [draft, date]);
  const day = draft.days.find((d) => d.date === date);
  const month = draft.month;
  const byDate = useMemo(() => new Map(cells.map((c) => [c.date as LocalDate, c] as const)), [cells]);
  const start = useMemo(() => initialFocus(cells, date), [cells, date]);
  const noFree = start === null;
  const [focusDate, setFocusDate] = useState<LocalDate>(start ?? date);
  const [selected, setSelected] = useState<LocalDate | null>(null);
  const [status, setStatus] = useState(noFree ? t('review.dateFix.noFree') : '');
  const titleId = useId();
  const contextId = useId();
  const hintId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  useFocusTrap(boxRef, true, onClose);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (start === null) statusRef.current?.focus();
    else boxRef.current?.querySelector<HTMLButtonElement>(`[data-date="${start}"]`)?.focus();
    return () => previous?.focus?.();
  }, [start]);

  if (day === undefined) return null;
  const printedWeekday = day.printedWeekday ?? '';
  const sep = lang === 'ja' ? '、' : ', ';
  const dateText = (d: LocalDate) => formatDate(t, lang, d);

  const nameOf = (c: DateFixCell): string => {
    const parts = [dateText(c.date as LocalDate)];
    if (c.weekdayMatch) parts.push(t('review.dateFix.cell.match'));
    if (c.taken) parts.push(t('review.dateFix.cell.taken'));
    if (c.current) parts.push(t('review.dateFix.cell.current'));
    return parts.join(sep);
  };

  const activate = (c: DateFixCell) => {
    setFocusDate(c.date as LocalDate);
    if (c.free) {
      setSelected(c.date as LocalDate);
      const base = t('review.dateFix.selected', { date: dateText(c.date as LocalDate) });
      setStatus(c.weekdayMatch || printedWeekday === '' ? base : `${base} ${t('review.dateFix.otherWeekday', { printed: printedWeekday })}`);
    } else {
      setStatus(t('review.dateFix.cantChoose', { date: dateText(c.date as LocalDate), reason: t(c.current ? 'review.dateFix.cell.current' : 'review.dateFix.cell.taken') }));
    }
  };

  const move = (to: LocalDate) => {
    if (monthOf(to) !== month) return; // arrows stop at the first and last date of the month
    setFocusDate(to);
    boxRef.current?.querySelector<HTMLButtonElement>(`[data-date="${to}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-date]');
    if (cell === null) return;
    const current = cell.dataset['date'] as LocalDate;
    let next: LocalDate | null = null;
    if (event.key === 'ArrowLeft') next = addDays(current, -1);
    else if (event.key === 'ArrowRight') next = addDays(current, 1);
    else if (event.key === 'ArrowUp') next = addDays(current, -7);
    else if (event.key === 'ArrowDown') next = addDays(current, 7);
    else if (event.key === 'Home' || event.key === 'End') {
      const row = monthGrid(month, weekStartsOn).find((r) => r.includes(current)) ?? [];
      const dates = row.filter((d): d is LocalDate => d !== null);
      next = (event.key === 'Home' ? dates[0] : dates.at(-1)) ?? current;
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault(); // one month only: nothing to page to
      return;
    } else return;
    event.preventDefault();
    move(next);
  };

  const canApply = selected !== null;
  return (
    <>
      <div className="datefix__scrim" onClick={onClose} aria-hidden="true" data-testid="datefix-scrim" />
      <div ref={boxRef} className="datefix" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={contextId} data-testid="datefix-sheet">
        <div className="datefix__head">
          <h2 id={titleId} className="datefix__title">
            {t('review.dateFix.title')}
          </h2>
          <button type="button" className="iconbtn" data-testid="datefix-close" aria-label={t('common.close')} onClick={onClose}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p id={contextId} className="datefix__context">
          {day.printedDateText !== null
            ? splitAround(t('review.dateFix.context', { printedDate: '\u0000', date: dateText(date) }), day.printedDateText)
            : splitAround(t('review.dateFix.contextWeekday', { printed: '\u0000', date: dateText(date) }), printedWeekday)}
        </p>
        <p className="datefix__month" aria-hidden="true">
          {formatMonth(t, lang, month)}
        </p>
        <div role="grid" className="datefix__grid" aria-label={t('review.dateFix.gridLabel', { month: formatMonth(t, lang, month) })} data-testid="datefix-grid" onKeyDown={onKeyDown}>
          <div role="row" className="datefix__row">
            {weekdayOrder(weekStartsOn).map((wd) => (
              <div key={wd} role="columnheader" className={`cal-wd wd-${wd}`} aria-label={t(`wd.long.${wd}` as MessageKey)}>
                {t(`wd.short.${wd}` as MessageKey)}
              </div>
            ))}
          </div>
          {monthGrid(month, weekStartsOn).map((row, r) => (
            <div key={r} role="row" className="datefix__row">
              {row.map((d, c) => {
                const cell = d === null ? undefined : byDate.get(d);
                if (d === null || cell === undefined) return <div key={c} role="gridcell" aria-hidden="true" />;
                const isSelected = selected === d;
                return (
                  <div key={d} role="gridcell" aria-selected={isSelected ? true : undefined}>
                    <button
                      type="button"
                      className={`datefix__cell wd-${weekdayOf(d)}${cell.weekdayMatch ? ' is-match' : ''}${cell.taken ? ' is-taken' : ''}${cell.current ? ' is-current' : ''}${isSelected ? ' is-selected' : ''}`}
                      data-testid={`datefix-cell-${d}`}
                      data-date={d}
                      tabIndex={d === focusDate ? 0 : -1}
                      aria-disabled={cell.free ? undefined : true}
                      aria-label={nameOf(cell)}
                      onClick={() => activate(cell)}
                      onFocus={() => setFocusDate(d)}
                    >
                      {dateParts(d).day}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <ul className="datefix__legend">
          <li>{t('review.dateFix.cell.match')}</li>
          <li>{t('review.dateFix.cell.taken')}</li>
          <li>{t('review.dateFix.cell.current')}</li>
        </ul>
        <p ref={statusRef} tabIndex={-1} className="datefix__status" role="status" data-testid={noFree ? 'datefix-nofree' : 'datefix-status'}>
          {status}
        </p>
        <div className="datefix__footer">
          {!noFree && (
            <button
              type="button"
              className={`btn btn--primary${canApply ? '' : ' is-disabled'}`}
              data-testid="datefix-apply"
              aria-disabled={canApply ? undefined : true}
              aria-describedby={canApply ? undefined : hintId}
              onClick={() => selected !== null && onApply(selected)}
            >
              {t('review.dateFix.apply')}
            </button>
          )}
          <button type="button" className="btn btn--secondary" data-testid="datefix-cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
        {!canApply && !noFree && (
          <p id={hintId} className="field__hint">
            {t('review.dateFix.applyHint')}
          </p>
        )}
      </div>
    </>
  );
}

/** Puts `value` (the sheet's own printed text, always Japanese) in a lang="ja" span inside `message`. */
function splitAround(message: string, value: string) {
  const [before = '', after = ''] = message.split('\u0000');
  return (
    <>
      {before}
      <span lang="ja">{value}</span>
      {after}
    </>
  );
}
