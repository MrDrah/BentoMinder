// The month grid (design/components.md §2.3–§2.4; a11y-responsive.md §5): role="grid", one
// button per date, roving tabindex, ARIA APG date-picker keys. Each school-day cell shows the
// assessment (top right) and the decision (word, frame or fill) separately (BR-01, BR-03).
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { DayView } from '../../domain/calendar/day-view.ts';
import { addDays, addMonths, dateParts, daysInMonth, monthGrid, monthOf, weekdayOf, weekdayOrder, type LocalDate, type WeekStartsOn, type YearMonth } from '../../domain/time/jst.ts';
import { formatMonth } from '../../i18n/format.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { AssessMark, BentoIcon, FlagBadge } from '../components/Marks.tsx';
import { CellName } from './CellName.tsx';
import { recipeShortName, splitShortName } from './labels.ts';

export interface CalendarGridProps {
  t: Translate;
  lang: Language;
  month: YearMonth;
  today: LocalDate;
  weekStartsOn: WeekStartsOn;
  views: ReadonlyMap<LocalDate, DayView>;
  selected: LocalDate | null;
  onOpen: (date: LocalDate) => void;
  /** Moving past a month edge or PageUp/PageDown: show that month and put the focus on `focus`. */
  onMonth: (month: YearMonth, focus: LocalDate) => void;
}

const BOXED = new Set(['school', 'no-lunch', 'bento-day']);

function columns(weekStartsOn: WeekStartsOn): string {
  const weekend = 'minmax(44px, 0.62fr)';
  const day = 'minmax(0, 1fr)';
  return (weekStartsOn === 'monday' ? [day, day, day, day, day, weekend, weekend] : [weekend, day, day, day, day, day, weekend]).join(' ');
}

const clampDay = (month: YearMonth, day: number): LocalDate => `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}` as LocalDate;

export function CalendarGrid({ t, lang, month, today, weekStartsOn, views, selected, onOpen, onMonth }: CalendarGridProps) {
  const rows = monthGrid(month, weekStartsOn);
  const title = formatMonth(t, lang, month);
  const initial = monthOf(today) === month ? today : (`${month}-01` as LocalDate);
  const [focusDate, setFocusDate] = useState<LocalDate>(initial);
  const pending = useRef<LocalDate | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // A new month: land on the requested date (keyboard move), else today or the 1st (roving stop).
  useEffect(() => {
    const target = pending.current;
    pending.current = null;
    setFocusDate(target ?? (monthOf(today) === month ? today : (`${month}-01` as LocalDate)));
    if (target !== null) rootRef.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus();
  }, [month, today]);

  const focusOn = (date: LocalDate) => {
    if (monthOf(date) !== month) {
      pending.current = date;
      onMonth(monthOf(date), date);
      return;
    }
    setFocusDate(date);
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-date]');
    if (cell === null) return;
    const date = cell.dataset['date'] as LocalDate;
    let next: LocalDate | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        next = addDays(date, -1);
        break;
      case 'ArrowRight':
        next = addDays(date, 1);
        break;
      case 'ArrowUp':
        next = addDays(date, -7);
        break;
      case 'ArrowDown':
        next = addDays(date, 7);
        break;
      case 'Home':
      case 'End': {
        const row = rows.find((r) => r.includes(date)) ?? [];
        const dates = row.filter((d): d is LocalDate => d !== null);
        next = (event.key === 'Home' ? dates[0] : dates.at(-1)) ?? date;
        break;
      }
      case 'PageUp':
      case 'PageDown': {
        const target = addMonths(monthOf(date), event.key === 'PageUp' ? -1 : 1);
        next = clampDay(target, dateParts(date).day);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
    focusOn(next);
  };

  return (
    <div ref={rootRef} className="cal-grid" role="grid" aria-label={t('cal.grid.label', { month: title })} data-testid="cal-grid" data-week-starts-on={weekStartsOn} onKeyDown={onKeyDown} style={{ ['--cal-cols' as string]: columns(weekStartsOn) }}>
      <div role="row" className="cal-head">
        {weekdayOrder(weekStartsOn).map((wd) => (
          <div key={wd} role="columnheader" className={`cal-wd wd-${wd}`} aria-label={t(`wd.long.${wd}` as MessageKey)}>
            {t(`wd.short.${wd}` as MessageKey)}
          </div>
        ))}
      </div>
      {rows.map((row, r) => {
        const compact = !row.some((date) => date !== null && BOXED.has(views.get(date)?.type.type ?? '') );
        const planned = row.some((date) => date !== null && views.get(date)?.displayed.state === 'homemade-bento-planned');
        return (
          <div key={r} role="row" className={`cal-row${compact && !planned ? ' is-compact' : ''}`}>
            {row.map((date, c) => {
              const v = date === null ? undefined : views.get(date);
              if (date === null || v === undefined) return <div key={c} role="gridcell" className="cell cell--pad" aria-hidden="true" />;
              return <DayCell key={date} t={t} lang={lang} v={v} tabbable={date === focusDate} selected={selected === date} onOpen={onOpen} onFocus={setFocusDate} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

interface CellProps {
  t: Translate;
  lang: Language;
  v: DayView;
  tabbable: boolean;
  selected: boolean;
  onOpen: (date: LocalDate) => void;
  onFocus: (date: LocalDate) => void;
}

function ShortName({ text, lang }: { text: string; lang: Language }) {
  if (lang === 'en') return <span className="cell__word cell__word--en">{text}</span>;
  return (
    <>
      {splitShortName(text).map((line, i) => (
        <span key={i} className="cell__word">
          {line}
        </span>
      ))}
    </>
  );
}

function DayCell({ t, lang, v, tabbable, selected, onOpen, onFocus }: CellProps) {
  const type = v.type.type;
  const shown = v.displayed.state;
  const planned = shown === 'homemade-bento-planned' && v.record !== undefined;
  const notConfirmed = shown === 'not-confirmed' && v.displayed.conflict === 'none';
  const school = type === 'school';
  const suggest = school && !planned && !notConfirmed && v.assessment?.state === 'low-preference';
  const boxed = BOXED.has(type) || planned;
  const wd = weekdayOf(v.date);
  const classes = [
    'cell',
    `wd-${wd}`,
    boxed ? 'is-boxed' : '',
    type === 'no-lunch' ? 'is-noLunch' : '',
    type === 'bento-day' ? 'is-bentoDay' : '',
    planned ? 'is-planned' : '',
    suggest ? 'is-suggest' : '',
    notConfirmed ? 'is-notConfirmed' : '',
    v.isToday ? 'is-today' : '',
    v.past ? 'is-past' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const assessment = school ? v.assessment : null;

  let body;
  if (planned && v.record !== undefined) {
    body = (
      <>
        <BentoIcon filled />
        <ShortName text={recipeShortName(v.record, lang)} lang={lang} />
      </>
    );
  } else if (notConfirmed) {
    body = (
      <>
        <BentoIcon filled={false} />
        <span className="cell__word">{t('cell.word.notConfirmed')}</span>
      </>
    );
  } else if (school) {
    body = <span className="cell__word">{t('cell.word.school')}</span>;
  } else if (type === 'no-lunch') {
    body = <span className="cell__word cell__pill">{t('cell.word.noLunch')}</span>;
  } else if (type === 'bento-day') {
    const words = lang === 'ja' ? ['お弁当', 'の日'] : [t('cell.word.bentoDay')];
    body = (
      <>
        <BentoIcon filled={false} />
        {words.map((w) => (
          <span key={w} className="cell__word">
            {w}
          </span>
        ))}
      </>
    );
  } else body = null;

  return (
    <div
      role="gridcell"
      className={classes}
      data-testid={`cal-cell-${v.date}`}
      data-assessment={assessment?.state}
      data-decision={shown ?? 'none'}
      data-today={v.isToday ? 'true' : undefined}
      data-past={v.past ? 'true' : undefined}
      data-flag={v.needsReviewBadge ? 'changed' : undefined}
      data-override={v.assessment?.override?.state}
      aria-current={v.isToday ? 'date' : undefined}
      aria-selected={selected ? true : undefined}
    >
      <button type="button" className="cell__btn" data-date={v.date} tabIndex={tabbable ? 0 : -1} onClick={() => onOpen(v.date)} onFocus={() => onFocus(v.date)}>
        {/* The name comes from this sentence, not from an aria-label: the visible words are a short form of it (WCAG 2.5.3 stays satisfied: no label overrides the content) */}
        <CellName t={t} lang={lang} v={v} />
        <span className="cell__top">
          <span className="cell__num" aria-hidden="true">
            {dateParts(v.date).day}
          </span>
          {assessment !== null && assessment.state !== 'no-school-lunch' && (
            <span className="cell__mark">
              <AssessMark state={assessment.state} overridden={assessment.override !== null} />
            </span>
          )}
        </span>
        <span className="cell__body" aria-hidden="true">
          {body}
        </span>
        {v.needsReviewBadge && <FlagBadge />}
      </button>
    </div>
  );
}

