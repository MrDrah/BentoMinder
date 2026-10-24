// Data contract §3.1 MenuMonth, §3.4 ConfirmedMenu, §3.5 AssessmentOverride.
import { z } from 'zod';
import { monthOf, type LocalDate } from '../time/jst.ts';
import {
  extractedDaySchema,
  extractedMenuSchema,
  isSortedUnique,
  noLunchDaySchema,
  type ExtractedDay,
} from './extracted-menu.ts';
import {
  boundedList,
  dateSchema,
  intRange,
  issue,
  metaShape,
  metaTimestampsOk,
  monthSchema,
  obj,
  timestampSchema,
} from './primitives.ts';

function hasUncertain(day: ExtractedDay): boolean {
  const all = [
    day.verification,
    day.allergenDeclaration.verification,
    ...day.items.map((i) => i.verification),
    ...(day.ingredients ?? []).map((i) => i.verification),
  ];
  return all.some((v) => v.status === 'uncertain');
}

export const confirmedMenuSchema = obj({
  month: monthSchema,
  version: intRange(1),
  extractionId: z.string().nullable(),
  confirmedAt: timestampSchema,
  days: z.array(extractedDaySchema),
  noLunchDays: z.array(noLunchDaySchema),
  changedDatesSincePrevious: z.array(dateSchema),
}).superRefine((c, ctx) => {
  if (c.days.some(hasUncertain) || c.noLunchDays.some((d) => d.verification.status === 'uncertain')) {
    issue(ctx, 'confirmed-no-uncertain', ['days']);
  }
  const dates = [...c.days.map((d) => d.date), ...c.noLunchDays.map((d) => d.date)];
  if (dates.some((d) => monthOf(d as LocalDate) !== c.month)) issue(ctx, 'confirmed-days-in-month', ['days']);
  if (!isSortedUnique(c.days.map((d) => d.date))) issue(ctx, 'days-unique-sorted', ['days']);
  const daySet = new Set(c.days.map((d) => d.date));
  if (c.noLunchDays.some((d) => daySet.has(d.date))) issue(ctx, 'confirmed-days-disjoint', ['noLunchDays']);
  if (dates.length === 0) issue(ctx, 'confirmed-not-empty', ['days']);
  if (c.version === 1 && c.changedDatesSincePrevious.length > 0) {
    issue(ctx, 'changed-dates-first-version', ['changedDatesSincePrevious']);
  }
});
export type ConfirmedMenu = z.infer<typeof confirmedMenuSchema>;

export const menuMonthSchema = obj({
  month: monthSchema,
  sourceUrl: z.string().optional(),
  extractions: boundedList(extractedMenuSchema, 0, 3),
  confirmed: confirmedMenuSchema.nullable(),
  pendingReviewExtractionId: z.string().optional(),
  ...metaShape,
}).superRefine((m, ctx) => {
  const ids = new Set(m.extractions.map((e) => e.id));
  if (m.extractions.some((e) => e.targetMonth !== m.month)) issue(ctx, 'menu-month-mismatch', ['extractions']);
  if (m.confirmed !== null) {
    if (m.confirmed.month !== m.month) issue(ctx, 'menu-month-mismatch', ['confirmed', 'month']);
    if (m.confirmed.extractionId !== null && !ids.has(m.confirmed.extractionId)) {
      issue(ctx, 'extraction-resolves', ['confirmed', 'extractionId']);
    }
  }
  if (m.pendingReviewExtractionId !== undefined && !ids.has(m.pendingReviewExtractionId)) {
    issue(ctx, 'extraction-resolves', ['pendingReviewExtractionId']);
  }
  if (!metaTimestampsOk(m)) issue(ctx, 'meta-timestamps', ['updatedAt']);
});
export type MenuMonth = z.infer<typeof menuMonthSchema>;

export const OVERRIDE_STATES = ['likely-enjoyable', 'mixed-uncertain', 'low-preference'] as const;

export const assessmentOverrideSchema = obj({
  date: dateSchema,
  state: z.enum(OVERRIDE_STATES),
  setAt: timestampSchema,
  menuVersionAtSet: intRange(1),
  ...metaShape,
}).superRefine((o, ctx) => {
  if (!metaTimestampsOk(o)) issue(ctx, 'meta-timestamps', ['updatedAt']);
});
export type AssessmentOverride = z.infer<typeof assessmentOverrideSchema>;
