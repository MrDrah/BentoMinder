// What the calendar and the day sheet show for a date: the day type, the assessment (computed on
// read, never stored), the displayed decision, the flags and the actions the state machine allows.
// This composes the assessment and the decision engine; the two engines themselves do not know
// each other (BR-01): the assessment never receives a decision.
import { createAssessor, type Assessment } from '../assessment/assess.ts';
import { allowedEvents, displayedDecision, type DayContext, type DisplayedDecision } from '../decision/decision.ts';
import { dayContextOf } from '../decision/apply.ts';
import { dayTypeOf, type DayType } from '../menu/day-kind.ts';
import { refreshReview, type ReviewItem } from '../menu/refresh.ts';
import type { AssessmentOverride, BentoMinderStore, DayDecision } from '../schema/index.ts';
import type { Dictionary } from '../schema/dictionary.ts';
import { addDays, monthOf, type LocalDate, type YearMonth } from '../time/jst.ts';

/** Actions of the plan section (components §3.3); everything not listed is absent, not disabled. */
export type DayAction = 'bento' | 'plan-bento-day' | 'later' | 'back-to-school' | 'view-recipe' | 'change-recipe' | 'clear-plan' | 'keep';

export interface DayView {
  date: LocalDate;
  month: YearMonth;
  type: DayType;
  isToday: boolean;
  /** Before today in Asia/Tokyo (BR-27): read-only. */
  past: boolean;
  menuVersion: number | null;
  assessment: Assessment | null;
  displayed: DisplayedDecision;
  /** The stored record, whether or not it is shown (a dormant record stays stored). */
  record: DayDecision | undefined;
  /** The stored override, whether or not it is applied. */
  override: AssessmentOverride | undefined;
  /** A refresh conflict (B7): a plan on a date that is now a no-lunch day or off the menu. */
  conflict: boolean;
  /** An applied override on a date the latest refresh changed since the parent set it (US-E3-05/AC3, AC8). */
  overrideChanged: boolean;
  /** The needs-review marker of the calendar cell (components §2.4 layer 4). */
  needsReviewBadge: boolean;
  /** The tick 「園で予約済み（自分で記録）」 is offered (school lunch, today or later). */
  reservationOffered: boolean;
  reservationDone: boolean;
  /** The override control is offered (a school day from today on, US-E4-03/AC4, AC6). */
  canOverride: boolean;
  actions: DayAction[];
}

export type DayViewer = (store: BentoMinderStore, date: LocalDate, today: LocalDate) => DayView;

export function createDayViewer(dict: Dictionary): DayViewer {
  const assess = createAssessor(dict);
  return (store, date, today) => {
    const month = monthOf(date);
    const menu = store.menus[month]?.confirmed ?? null;
    const type = dayTypeOf(menu, date);
    const ctx: DayContext = dayContextOf(store, date);
    const record = store.decisions[date];
    const override = store.overrides[date];
    const displayed = displayedDecision(ctx, record);
    const past = date < today;
    const assessment = assess({ date, menu, profile: store.profile, override: override ?? null });
    const conflict = displayed.conflict === 'plan-on-no-lunch' || displayed.conflict === 'plan-date-removed';
    const overrideChanged =
      assessment !== null &&
      assessment.override !== null &&
      menu !== null &&
      menu.changedDatesSincePrevious.includes(date) &&
      assessment.override.menuVersionAtSet < menu.version;
    const events = new Set(allowedEvents(ctx, record, today));
    const planned = displayed.state === 'homemade-bento-planned';
    const actions: DayAction[] = [];
    if (events.has('CONFIRM_RECIPE')) actions.push(ctx.kind === 'bento-day' ? 'plan-bento-day' : 'bento');
    if (planned && !conflict && events.has('CHANGE_RECIPE')) actions.push('view-recipe', 'change-recipe');
    if (events.has('DEFER')) actions.push('later');
    if (events.has('SET_SCHOOL_LUNCH')) actions.push('back-to-school');
    if (events.has('KEEP_PLAN')) actions.push('keep');
    if (events.has('CLEAR_PLAN')) actions.push('clear-plan');
    return {
      date,
      month,
      type,
      isToday: date === today,
      past,
      menuVersion: menu?.version ?? null,
      assessment,
      displayed,
      record,
      override,
      conflict,
      overrideChanged,
      needsReviewBadge: conflict || overrideChanged,
      reservationOffered: events.has('MARK_RESERVATION'),
      reservationDone: record?.state === 'school-lunch-planned' && record.reservationDoneExternally,
      canOverride: type.type === 'school' && !past,
      actions,
    };
  };
}

export interface UpcomingSummary {
  /** Up to the next 3 homemade-bento-planned days from today onward, soonest first (US-E5-01/AC7). */
  planned: { date: LocalDate; record: DayDecision }[];
  /** Refresh conflicts the parent has not acknowledged (US-E3-05/AC2, AC7, AC14). */
  conflicts: LocalDate[];
  /** not-confirmed days in the next 7 days (US-E5-05/AC2). */
  notConfirmed: LocalDate[];
  /** low-preference days in the next 7 days that are still school-lunch-planned or not-confirmed. */
  lowCount: number;
  firstLow: LocalDate | null;
}

export const UPCOMING_DAYS = 7;
export const UPCOMING_PLANNED = 3;

/** "The next 7 days" = today and the 6 days after it (today can still be planned, US-E5-03/AC4). */
export function upcomingSummary(store: BentoMinderStore, today: LocalDate, view: DayViewer): UpcomingSummary {
  const planned: UpcomingSummary['planned'] = [];
  const conflicts: LocalDate[] = [];
  const dates = Object.keys(store.decisions)
    .filter((d) => d >= today)
    .sort() as LocalDate[];
  for (const date of dates) {
    const v = view(store, date, today);
    if (v.displayed.state !== 'homemade-bento-planned' || v.record === undefined) continue;
    if (v.conflict && v.displayed.needsAck) conflicts.push(date);
    else if (planned.length < UPCOMING_PLANNED) planned.push({ date, record: v.record });
  }
  const notConfirmed: LocalDate[] = [];
  let lowCount = 0;
  let firstLow: LocalDate | null = null;
  for (let i = 0; i < UPCOMING_DAYS; i += 1) {
    const date = addDays(today, i);
    const v = view(store, date, today);
    if (v.displayed.state === 'not-confirmed' && v.displayed.conflict === 'none') notConfirmed.push(date);
    const shown = v.displayed.state;
    if (v.assessment?.state === 'low-preference' && (shown === 'school-lunch-planned' || shown === 'not-confirmed')) {
      lowCount += 1;
      firstLow ??= date;
    }
  }
  return { planned, conflicts, notConfirmed, lowCount, firstLow };
}

export interface RefreshReviewRow extends ReviewItem {
  /** The date's cell still shows the needs-review marker (Orchestrator ruling, M2 prep). */
  open: boolean;
}

/** The rows of a month's review list, computed from the stored menu, decisions and overrides each time. */
export function refreshReviewRows(store: BentoMinderStore, month: YearMonth, today: LocalDate, view: DayViewer): RefreshReviewRow[] {
  const menu = store.menus[month]?.confirmed;
  if (menu === undefined || menu === null) return [];
  return refreshReview(menu, store.decisions, store.overrides).map((item) => ({ ...item, open: view(store, item.date, today).needsReviewBadge }));
}

/** Months whose list still has a date with an open flag, with the number of open dates. */
export function openReviewMonths(store: BentoMinderStore, today: LocalDate, view: DayViewer): { month: YearMonth; open: number }[] {
  const out: { month: YearMonth; open: number }[] = [];
  for (const month of Object.keys(store.menus).sort() as YearMonth[]) {
    const open = refreshReviewRows(store, month, today, view).filter((r) => r.open).length;
    if (open > 0) out.push({ month, open });
  }
  return out;
}
