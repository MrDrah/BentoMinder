// Data contract §3.3 ExtractedMenu: the AI output after validation (also produced by fixtures
// and manual entry). The JSON Schema sent to the model's structured-output mode is derived
// from the same zod definition (ADR 001, ADR 002).
import { z } from 'zod';
import { monthOf, weekdayOf, type LocalDate } from '../time/jst.ts';
import {
  allergenIdSchema,
  boundedList,
  boundedText,
  dateSchema,
  idSchema,
  intRange,
  issue,
  monthSchema,
  obj,
  timestampSchema,
} from './primitives.ts';

export const VERIFICATION_STATUSES = ['ok', 'uncertain', 'parent-edited', 'parent-entered', 'uncertain-accepted'] as const;
export const VERIFICATION_REASONS = [
  'low-legibility',
  'weekday-mismatch',
  'duplicate-date',
  'ambiguous-term',
  'outside-month',
  'other',
] as const;

export const verificationSchema = obj({
  status: z.enum(VERIFICATION_STATUSES),
  reason: z.enum(VERIFICATION_REASONS).optional(),
  note: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.status === 'uncertain' && v.reason === undefined) issue(ctx, 'verification-reason-required', ['reason']);
});
export type Verification = z.infer<typeof verificationSchema>;

export const menuItemSchema = obj({
  text: boundedText(1, 40),
  kind: z.enum(['staple', 'main', 'side', 'soup', 'drink', 'dessert', 'snack', 'unknown']),
  verification: verificationSchema,
  resolvedIds: z.array(idSchema('ing', 'cat', 'dish')).optional(),
});

export const menuIngredientSchema = obj({
  text: boundedText(1, 30),
  foodGroup: z.enum(['red', 'yellow', 'green']).nullable(),
  verification: verificationSchema,
});

export const allergenDeclarationSchema = obj({
  status: z.enum(['declared', 'declared-none', 'not-declared', 'unreadable']),
  allergenIds: z.array(allergenIdSchema),
  rawText: z.string().nullable(),
  verification: verificationSchema,
}).superRefine((a, ctx) => {
  if (a.allergenIds.length > 0 && a.status !== 'declared') issue(ctx, 'allergen-ids-declared-only', ['allergenIds']);
  // BR-08: "none" only when the PDF says so.
  if (a.status === 'declared-none' && a.rawText === null) issue(ctx, 'allergen-absence-not-inferred', ['rawText']);
});

export const WEEKDAY_CHARS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export const extractedDaySchema = obj({
  date: dateSchema,
  printedDateText: z.string().nullable(),
  printedWeekday: z.enum(WEEKDAY_CHARS).nullable(),
  items: boundedList(menuItemSchema, 1, 12),
  ingredientsStatus: z.enum(['listed', 'not-listed', 'unreadable']),
  ingredients: boundedList(menuIngredientSchema, 1, 40).optional(),
  allergenDeclaration: allergenDeclarationSchema,
  notes: boundedList(boundedText(1, 100), 0, 5),
  verification: verificationSchema,
}).superRefine((d, ctx) => {
  // BR-11: ingredients exist only when the PDF lists them; never inferred from dish names.
  if ((d.ingredientsStatus === 'listed') !== (d.ingredients !== undefined)) {
    issue(ctx, 'ingredients-listed-only', ['ingredients']);
  }
  if (d.printedWeekday !== null) {
    const actual = WEEKDAY_CHARS[weekdayOf(d.date as LocalDate)];
    const flagged = d.verification.status === 'uncertain' && d.verification.reason === 'weekday-mismatch';
    const resolved = d.verification.status !== 'ok' && d.verification.status !== 'uncertain';
    if (actual !== d.printedWeekday && !flagged && !resolved) issue(ctx, 'weekday-mismatch', ['verification']);
  }
});
export type ExtractedDay = z.infer<typeof extractedDaySchema>;

export const noLunchDaySchema = obj({
  date: dateSchema,
  reason: z.enum(['bento-day', 'no-lunch', 'closed', 'unknown']),
  originalText: boundedText(1, 60),
  verification: verificationSchema,
});
export type NoLunchDay = z.infer<typeof noLunchDaySchema>;

export const outOfMonthEntrySchema = z.discriminatedUnion('kind', [
  obj({ kind: z.literal('lunch-day'), day: extractedDaySchema }),
  obj({ kind: z.literal('no-lunch-day'), noLunchDay: noLunchDaySchema }),
]);
export type OutOfMonthEntry = z.infer<typeof outOfMonthEntrySchema>;

const SHA256_RE = /^[0-9a-f]{64}$/;
export const MAX_PDF_BYTES = 10_485_760; // BR-14

export const menuSourceSchema = obj({
  kind: z.enum(['url', 'upload', 'manual', 'fixture']),
  url: z.string().max(2048).optional(),
  filename: boundedText(1, 255).optional(),
  sha256: z.string().regex(SHA256_RE, { error: 'source-field-required' }).optional(),
  byteSize: intRange(1, MAX_PDF_BYTES).optional(),
  fetchedAt: timestampSchema,
  model: z.string().min(1).optional(),
  promptVersion: intRange(1).optional(),
}).superRefine((s, ctx) => {
  if (s.kind === 'url') {
    if (s.url === undefined) issue(ctx, 'source-field-required', ['url']);
    else if (!isHttpsUrl(s.url)) issue(ctx, 'source-url-https', ['url']);
  }
  if (s.kind === 'upload' && s.filename === undefined) issue(ctx, 'source-field-required', ['filename']);
  if (s.kind !== 'manual') {
    for (const field of ['sha256', 'byteSize', 'model', 'promptVersion'] as const) {
      if (s[field] === undefined) issue(ctx, 'source-field-required', [field]);
    }
  }
});

/** https only, default port 443 (BR-14). */
export function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (u.port === '' || u.port === '443');
  } catch {
    return false;
  }
}

export const MENU_WARNINGS = ['month-mismatch', 'pages-unreadable', 'layout-unrecognised', 'partial-extraction'] as const;

const MODEL_STATUSES = new Set(['ok', 'uncertain']);

function verificationsOf(day: ExtractedDay): Verification[] {
  return [
    day.verification,
    day.allergenDeclaration.verification,
    ...day.items.map((i) => i.verification),
    ...(day.ingredients ?? []).map((i) => i.verification),
  ];
}

export function isSortedUnique(dates: string[]): boolean {
  return dates.every((d, i) => i === 0 || (dates[i - 1] as string) < d);
}

export const extractedMenuSchema = obj({
  id: z.string().regex(/^ext-\d{4}-\d{2}-[0-9a-f]{8}$/, { error: 'id-format' }),
  contract: z.literal('extracted-menu/1'),
  targetMonth: monthSchema,
  detectedMonth: monthSchema.nullable(),
  source: menuSourceSchema,
  days: boundedList(extractedDaySchema, 0, 31),
  noLunchDays: z.array(noLunchDaySchema),
  outOfMonthDays: z.array(outOfMonthEntrySchema),
  warnings: z.array(z.enum(MENU_WARNINGS)),
  extractedAt: timestampSchema,
}).superRefine((m, ctx) => {
  const dayDates = m.days.map((d) => d.date);
  if (!isSortedUnique(dayDates)) issue(ctx, 'days-unique-sorted', ['days']);
  const noLunchDates = m.noLunchDays.map((d) => d.date);
  if (new Set(noLunchDates).size !== noLunchDates.length) issue(ctx, 'days-unique-sorted', ['noLunchDays']);
  const daySet = new Set(dayDates);
  if (noLunchDates.some((d) => daySet.has(d))) issue(ctx, 'days-disjoint', ['noLunchDays']);
  [...dayDates, ...noLunchDates].forEach((d) => {
    if (monthOf(d as LocalDate) !== m.targetMonth) issue(ctx, 'extracted-day-outside-month', ['days']);
  });
  const seen = new Set<string>();
  let previous = '';
  m.outOfMonthDays.forEach((entry, i) => {
    const date = entry.kind === 'lunch-day' ? entry.day.date : entry.noLunchDay.date;
    if (monthOf(date as LocalDate) === m.targetMonth) issue(ctx, 'out-of-month-entry', ['outOfMonthDays', i]);
    const key = `${date}|${entry.kind}`;
    if (seen.has(key) || date < previous) issue(ctx, 'out-of-month-entry', ['outOfMonthDays', i]);
    seen.add(key);
    previous = date;
  });
  if (m.source.kind !== 'manual') {
    const all = [...m.days.flatMap(verificationsOf), ...m.noLunchDays.map((d) => d.verification)];
    if (all.some((v) => !MODEL_STATUSES.has(v.status))) issue(ctx, 'verification-status-source', ['days']);
  }
});
export type ExtractedMenu = z.infer<typeof extractedMenuSchema>;

/**
 * JSON Schema for the model's structured output (ADR 002). Refinements (rule ids) are not
 * representable in JSON Schema; the proxy re-validates every response with the zod schema.
 */
export function extractedMenuJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(extractedMenuSchema, { unrepresentable: 'any' }) as Record<string, unknown>;
}
