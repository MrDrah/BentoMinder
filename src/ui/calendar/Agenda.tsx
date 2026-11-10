// Agenda layout (design/components.md §2.3, a11y-responsive.md §10): the grid gives way to a list
// when the container is narrower than a cell can hold at the current text size (320 px reflow,
// 200 % text). One row per date; plain weekends collapse into one 「土・日」 line. Same test ids.
import type { DayView } from '../../domain/calendar/day-view.ts';
import { datesOfMonth, weekdayOf, type LocalDate, type YearMonth } from '../../domain/time/jst.ts';
import { formatDate, formatMonth } from '../../i18n/format.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { AllergenMark, TileIcon } from '../components/Marks.tsx';
import { CellName } from './CellName.tsx';
import { tileOf, TILE_ICON_NAMES } from './tile.ts';

interface AgendaProps {
  t: Translate;
  lang: Language;
  month: YearMonth;
  views: ReadonlyMap<LocalDate, DayView>;
  today: LocalDate;
  onOpen: (date: LocalDate) => void;
}

const plainWeekend = (v: DayView) => {
  const wd = weekdayOf(v.date);
  return (wd === 0 || wd === 6) && (v.type.type === 'outside' || v.type.type === 'no-menu' || v.type.type === 'snack-only') && v.record === undefined;
};

export function Agenda({ t, lang, month, views, today, onOpen }: AgendaProps) {
  const items: ({ kind: 'day'; v: DayView } | { kind: 'weekend'; key: string })[] = [];
  for (const date of datesOfMonth(month)) {
    const v = views.get(date);
    if (v === undefined) continue;
    if (plainWeekend(v)) {
      if (items.at(-1)?.kind !== 'weekend') items.push({ kind: 'weekend', key: date });
    } else items.push({ kind: 'day', v });
  }
  return (
    <ul className="cal-agenda" data-testid="cal-agenda" aria-label={t('cal.agenda.label', { month: formatMonth(t, lang, month) })}>
      {items.map((item) =>
        item.kind === 'weekend' ? (
          <li key={item.key} className="cal-agenda__weekend">
            {t('wd.short.6')}{'・'}{t('wd.short.0')}
          </li>
        ) : (
          <AgendaRow key={item.v.date} t={t} lang={lang} v={item.v} today={today} onOpen={onOpen} />
        ),
      )}
    </ul>
  );
}

// "、手動で変更" / ", changed by you" without its leading separator: the agenda shows the markers as words (components §18.9).
const word = (suffix: string) => suffix.replace(/^(、|, )/, '');

function AgendaRow({ t, lang, v, today, onOpen }: { t: Translate; lang: Language; v: DayView; today: LocalDate; onOpen: (date: LocalDate) => void }) {
  const tile = tileOf(v, today);
  const wd = weekdayOf(v.date);
  const state = tile.state !== null ? t(`cell.state.${tile.state}` as MessageKey) : v.type.type === 'no-lunch' ? t('state.noLunch') : '';
  return (
    <li
      className={`cal-agenda__row${v.isToday ? ' is-today' : ''}${tile.tomorrow ? ' is-tomorrow' : ''}${v.past ? ' is-past' : ''} wd-${wd}`}
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
    >
      <button type="button" className="cal-agenda__btn" data-date={v.date} onClick={() => onOpen(v.date)}>
        <CellName t={t} lang={lang} v={v} today={today} />
        <span className="cal-agenda__date" aria-hidden="true">
          {formatDate(t, lang, v.date)}
        </span>
        {tile.icon !== 'none' && <TileIcon name={TILE_ICON_NAMES[tile.icon]} className="cal-agenda__icon" />}
        <span className="cal-agenda__text" aria-hidden="true">
          {state !== '' && <span>{state}</span>}
          {tile.allergen && (
            <span className="cal-agenda__marker">
              <AllergenMark className="cell__allergen cal-agenda__mark" />
              {word(t('cell.aria.allergen'))}
            </span>
          )}
          {tile.changed && <span className="cal-agenda__marker cal-agenda__marker--changed">{word(t('cell.aria.override'))}</span>}
          {tile.dash && <span className="cal-agenda__marker cal-agenda__marker--dash">{word(t('cell.aria.dash'))}</span>}
        </span>
      </button>
    </li>
  );
}
