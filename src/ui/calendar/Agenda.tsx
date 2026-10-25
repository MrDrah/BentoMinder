// Agenda layout (design/components.md §2.3, a11y-responsive.md §10): the grid gives way to a list
// when the container is narrower than a cell can hold at the current text size (320 px reflow,
// 200 % text). One row per date; plain weekends collapse into one 「土・日」 line. Same test ids.
import type { DayView } from '../../domain/calendar/day-view.ts';
import { datesOfMonth, weekdayOf, type LocalDate, type YearMonth } from '../../domain/time/jst.ts';
import { formatDate, formatMonth } from '../../i18n/format.ts';
import type { Language, Translate } from '../../i18n/index.ts';
import { AssessMark } from '../components/Marks.tsx';
import { cellLabel } from './cell-label.ts';
import { DECISION_KEYS, recipeName, STATE_KEYS } from './labels.ts';

interface AgendaProps {
  t: Translate;
  lang: Language;
  month: YearMonth;
  views: ReadonlyMap<LocalDate, DayView>;
  onOpen: (date: LocalDate) => void;
}

const plainWeekend = (v: DayView) => {
  const wd = weekdayOf(v.date);
  return (wd === 0 || wd === 6) && (v.type.type === 'outside' || v.type.type === 'no-menu' || v.type.type === 'snack-only') && v.record === undefined;
};

export function Agenda({ t, lang, month, views, onOpen }: AgendaProps) {
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
          <AgendaRow key={item.v.date} t={t} lang={lang} v={item.v} onOpen={onOpen} />
        ),
      )}
    </ul>
  );
}

function AgendaRow({ t, lang, v, onOpen }: { t: Translate; lang: Language; v: DayView; onOpen: (date: LocalDate) => void }) {
  const shown = v.displayed.state;
  const planned = shown === 'homemade-bento-planned' && v.record !== undefined;
  const a = v.type.type === 'school' ? v.assessment : null;
  let text = '';
  if (planned && v.record !== undefined) text = recipeName(v.record, lang);
  else if (v.type.type === 'school') text = t(DECISION_KEYS[shown ?? 'school-lunch-planned']);
  else if (v.type.type === 'no-lunch') text = t('cell.word.noLunch');
  else if (v.type.type === 'bento-day') text = t('cell.word.bentoDay');
  const wd = weekdayOf(v.date);
  return (
    <li
      className={`cal-agenda__row${planned ? ' is-planned' : ''} wd-${wd}`}
      data-testid={`cal-cell-${v.date}`}
      data-assessment={a?.state}
      data-decision={shown ?? 'none'}
      data-today={v.isToday ? 'true' : undefined}
      data-past={v.past ? 'true' : undefined}
      data-flag={v.needsReviewBadge ? 'changed' : undefined}
      data-override={v.assessment?.override?.state}
      aria-current={v.isToday ? 'date' : undefined}
    >
      <button type="button" className="cal-agenda__btn" aria-label={cellLabel(t, lang, v)} data-date={v.date} onClick={() => onOpen(v.date)}>
        <span className="cal-agenda__date" aria-hidden="true">
          {formatDate(t, lang, v.date)}
        </span>
        <span className="cal-agenda__text" aria-hidden="true">
          {a !== null && a.state !== 'no-school-lunch' && (
            <>
              <AssessMark state={a.state} overridden={a.override !== null} />{' '}
              {t(STATE_KEYS[a.state])}
              {' · '}
            </>
          )}
          {text}
        </span>
      </button>
    </li>
  );
}
