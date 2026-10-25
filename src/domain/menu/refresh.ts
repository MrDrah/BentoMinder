// Menu refresh review (BR-13; data contract §3.4 "Needs-review list"; US-E3-05/AC9, AC11–AC13).
// Replacing a month's menu keeps 100 % of that month's decisions and overrides: nothing here
// writes. The list is derived from the new ConfirmedMenu and the records every time; it is never
// stored. This module reads records through the schema types only and does not import the
// decision engine (ADR 004 §5).
import type { AssessmentOverride, ConfirmedMenu, DayDecision } from '../schema/index.ts';
import type { LocalDate } from '../time/jst.ts';
import { dayTypeOf } from './day-kind.ts';

export type ReviewReason = 'planned' | 'not-confirmed' | 'override';
export type ReviewDetail = 'removed' | 'now-no-lunch';

export interface ReviewItem {
  date: LocalDate;
  reasons: ReviewReason[];
  /** Why the date changed under the record; null when only the dishes changed. */
  detail: ReviewDetail | null;
}

/**
 * The dates of the latest refresh (`changedDatesSincePrevious`, removed dates included) that carry
 * an override, a stored homemade-bento-planned or a stored not-confirmed decision. A
 * school-lunch-planned record alone never lists a date (S10).
 */
export function refreshReview(menu: ConfirmedMenu, decisions: Readonly<Record<string, DayDecision>>, overrides: Readonly<Record<string, AssessmentOverride>>): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const date of menu.changedDatesSincePrevious as LocalDate[]) {
    const reasons: ReviewReason[] = [];
    const state = decisions[date]?.state;
    if (state === 'homemade-bento-planned') reasons.push('planned');
    if (state === 'not-confirmed') reasons.push('not-confirmed');
    if (overrides[date] !== undefined) reasons.push('override');
    if (reasons.length === 0) continue;
    const type = dayTypeOf(menu, date).type;
    let detail: ReviewDetail | null = null;
    if (type === 'no-lunch' || (type === 'bento-day' && !(reasons.length === 1 && reasons[0] === 'planned'))) detail = 'now-no-lunch';
    else if (type === 'outside' || type === 'snack-only') detail = 'removed';
    items.push({ date, reasons, detail });
  }
  return items;
}
