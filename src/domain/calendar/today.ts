// The today card's content (US-E7-03, design components §2.6): today's displayed decision, or, when
// today has none (weekend, outside the menu), the next school day. Pure: `today` is passed in (BR-15).
import type { DecisionState } from '../decision/decision.ts';
import type { BentoMinderStore } from '../schema/index.ts';
import { addDays, daysInMonth, firstOfMonth, type LocalDate, type YearMonth } from '../time/jst.ts';
import type { DayView, DayViewer } from './day-view.ts';

export type NextDayState = 'school-lunch-planned' | 'not-confirmed' | 'homemade-bento-planned';

export type TodayOverview =
  | { kind: 'today'; view: DayView; state: DecisionState; bentoDayNotPlanned: boolean }
  | { kind: 'next'; view: DayView; state: NextDayState }
  | { kind: 'unknown' };

const isNextState = (s: DecisionState | null): s is NextDayState => s === 'school-lunch-planned' || s === 'not-confirmed' || s === 'homemade-bento-planned';

/** The last date of the newest confirmed menu's month, or null when no menu is confirmed. */
function lastMenuDate(store: BentoMinderStore): LocalDate | null {
  const months = Object.keys(store.menus)
    .filter((m) => store.menus[m]?.confirmed != null)
    .sort();
  const last = months.at(-1) as YearMonth | undefined;
  return last === undefined ? null : addDays(firstOfMonth(last), daysInMonth(last) - 1);
}

export function todayOverview(store: BentoMinderStore, today: LocalDate, view: DayViewer): TodayOverview {
  const v = view(store, today, today);
  const state = v.displayed.state;
  if (state !== null) return { kind: 'today', view: v, state, bentoDayNotPlanned: v.type.type === 'bento-day' && state === 'no-school-lunch' };
  const end = lastMenuDate(store);
  if (end === null) return { kind: 'unknown' };
  for (let date = addDays(today, 1); date <= end; date = addDays(date, 1)) {
    const next = view(store, date, today);
    if (isNextState(next.displayed.state)) return { kind: 'next', view: next, state: next.displayed.state };
  }
  return { kind: 'unknown' };
}
