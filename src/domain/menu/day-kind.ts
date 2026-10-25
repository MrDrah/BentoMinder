// What a date is in a month's confirmed menu (BR-25, BR-12, data contract §3.4 "School day").
// Shared by the assessment, the decision state machine and the calendar; no store access.
import type { ConfirmedMenu, ExtractedDay, NoLunchDay } from '../schema/index.ts';
import type { LocalDate } from '../time/jst.ts';

export type DayType =
  /** In the menu with at least one non-snack item (BR-25). */
  | { type: 'school'; day: ExtractedDay }
  /** A no-lunch day with reason `bento-day` (お弁当の日): may be planned (OQ-03, BR-25). */
  | { type: 'bento-day'; noLunch: NoLunchDay }
  /** A no-lunch day with reason `no-lunch`, `closed` or `unknown`. */
  | { type: 'no-lunch'; noLunch: NoLunchDay }
  /** Listed with only snack items: no assessment, no decision (US-E4-01/AC10). */
  | { type: 'snack-only'; day: ExtractedDay }
  /** The month has a confirmed menu that doesn't list this date (weekend, holiday, removed date). */
  | { type: 'outside' }
  /** The month has no confirmed menu (BR-12). */
  | { type: 'no-menu' };

/** The decision engine's view of a date (ADR 004 §2 `DayContext.kind`). */
export type DecisionKind = 'school-day' | 'bento-day' | 'other-no-lunch' | 'not-in-menu';

export function dayTypeOf(menu: ConfirmedMenu | null, date: LocalDate): DayType {
  if (menu === null) return { type: 'no-menu' };
  const noLunch = menu.noLunchDays.find((n) => n.date === date);
  if (noLunch !== undefined) return noLunch.reason === 'bento-day' ? { type: 'bento-day', noLunch } : { type: 'no-lunch', noLunch };
  const day = menu.days.find((d) => d.date === date);
  if (day === undefined) return { type: 'outside' };
  return day.items.some((i) => i.kind !== 'snack') ? { type: 'school', day } : { type: 'snack-only', day };
}

export function decisionKindOf(type: DayType): DecisionKind {
  switch (type.type) {
    case 'school':
      return 'school-day';
    case 'bento-day':
      return 'bento-day';
    case 'no-lunch':
      return 'other-no-lunch';
    default:
      return 'not-in-menu';
  }
}
