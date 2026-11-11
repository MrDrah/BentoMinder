// The month grid (design/components.md §2.3, §18; a11y-responsive.md §5): role="grid", one button per
// date, roving tabindex, ARIA APG date-picker keys. A tile shows the day number and one state icon
// (BR-01, BR-03); the assessment and the recipe name are in the day sheet (BA US-E5-01/AC3).
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { DayView } from '../../domain/calendar/day-view.ts';
import { addDays, addMonths, dateParts, daysInMonth, monthGrid, monthOf, weekdayOf, weekdayOrder, type LocalDate, type WeekStartsOn, type YearMonth } from '../../domain/time/jst.ts';
import { formatMonth } from '../../i18n/format.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { AllergenMark, TileIcon } from '../components/Marks.tsx';
import { CellName } from './CellName.tsx';
import { tileOf, TILE_ICON_NAMES } from './tile.ts';

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


function columns(): string {
  const day = 'minmax(0, 1fr)';
  return [day, day, day, day, day, day, day].join(' '); // all seven equal (PO 2026-11-11): weekend columns are no longer narrower
}

const clampDay = (month: YearMonth, day: number): LocalDate => `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}` as LocalDate;

export function CalendarGrid({ t, lang, month, today, weekStartsOn, views, selected, onOpen, onMonth }: CalendarGridProps) {
  const rows = monthGrid(month, weekStartsOn);
  // The header of today's column gets a decorative underline (UI refresh 2026-11, components §17.4).
  const todayWd = monthOf(today) === month ? weekdayOf(today) : null;
  const title = formatMonth(t, lang, month);
  const initial = monthOf(today) === month ? today : (`${month}-01` as LocalDate);
  const [focusDate, setFocusDate] = useState<LocalDate>(initial);
  const pending = useRef<LocalDate | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Month change fade (motion §4): the grid root is keyed by month, so it remounts and plays a 120 ms fade; not on first paint.
  const [seenMonth, setSeenMonth] = useState(month);
  const [fade, setFade] = useState(false);
  if (seenMonth !== month) {
    setSeenMonth(month);
    setFade(true);
  }

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
    <div key={month} ref={rootRef} className={`cal-grid${fade ? ' is-fade' : ''}`} role="grid" aria-label={t('cal.grid.label', { month: title })} data-testid="cal-grid" data-week-starts-on={weekStartsOn} onKeyDown={onKeyDown} style={{ ['--cal-cols' as string]: columns() }}>
      <div role="row" className="cal-head">
        {weekdayOrder(weekStartsOn).map((wd) => (
          <div key={wd} role="columnheader" className={`cal-wd wd-${wd}${todayWd === wd ? ' is-today-col' : ''}`} aria-label={t(`wd.long.${wd}` as MessageKey)}>
            {t(`wd.short.${wd}` as MessageKey)}
          </div>
        ))}
      </div>
      {rows.map((row, r) => {
        // A row with no iconed tile and no today or tomorrow tile stays compact (components §18.4).
        const compact = !row.some((date) => {
          const v = date === null ? undefined : views.get(date);
          return v !== undefined && (tileOf(v, today).icon !== 'none' || v.isToday || v.date === addDays(today, 1));
        });
        return (
          <div key={r} role="row" className={`cal-row${compact ? ' is-compact' : ''}`}>
            {row.map((date, c) => {
              const v = date === null ? undefined : views.get(date);
              if (date === null || v === undefined) return <div key={c} role="gridcell" className="cell cell--pad" aria-hidden="true" />;
              return <DayCell key={date} t={t} lang={lang} v={v} today={today} tabbable={date === focusDate} selected={selected === date} onOpen={onOpen} onFocus={setFocusDate} />;
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
  today: LocalDate;
  tabbable: boolean;
  selected: boolean;
  onOpen: (date: LocalDate) => void;
  onFocus: (date: LocalDate) => void;
}

// A tile is the day number, one state icon, at most one allergen mark and the edge markers (components §18.2).
// The assessment, the recipe name and the review flags are in the day sheet, not here (BA US-E5-01/AC3, AC16).
function DayCell({ t, lang, v, today, tabbable, selected, onOpen, onFocus }: CellProps) {
  const tile = tileOf(v, today);
  const wd = weekdayOf(v.date);
  const classes = [
    'cell',
    `wd-${wd}`,
    tile.icon !== 'none' ? 'has-icon' : '',
    v.isToday ? 'is-today' : '',
    tile.tomorrow ? 'is-tomorrow' : '',
    v.past ? 'is-past' : '',
    tile.changed ? 'is-changed' : '',
    tile.dash ? 'has-dash' : '',
    tile.allergen ? 'has-allergen' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      role="gridcell"
      className={classes}
      data-testid={`cal-cell-${v.date}`}
      data-icon={tile.icon}
      data-assessment={v.type.type === 'school' ? v.assessment?.state : undefined}
      data-decision={v.displayed.state ?? 'none'}
      data-today={v.isToday ? 'true' : undefined}
      data-past={v.past ? 'true' : undefined}
      data-tomorrow={tile.tomorrow ? 'true' : undefined}
      data-changed={tile.changed ? 'true' : undefined}
      data-dash={tile.dash ? 'true' : undefined}
      data-allergen={tile.allergen ? 'true' : undefined}
      data-override={v.assessment?.override?.state}
      aria-current={v.isToday ? 'date' : undefined}
      aria-selected={selected ? true : undefined}
    >
      <button type="button" className="cell__btn" data-date={v.date} tabIndex={tabbable ? 0 : -1} onClick={() => onOpen(v.date)} onFocus={() => onFocus(v.date)}>
        {/* The name comes from this sentence, not from an aria-label: the visible number is part of it (WCAG 2.5.3) */}
        <CellName t={t} lang={lang} v={v} today={today} />
        <span className="cell__top">
          <span className="cell__num" aria-hidden="true">
            {dateParts(v.date).day}
          </span>
        </span>
        {tile.icon !== 'none' && <TileIcon name={TILE_ICON_NAMES[tile.icon]} className="cell__icon" />}
        {tile.dash && <span className="cell__dash" aria-hidden="true" />}
        {tile.allergen && <AllergenMark />}
      </button>
    </div>
  );
}

