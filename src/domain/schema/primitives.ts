// Shared building blocks for the data contract v1 schemas (docs/ba/data-contract.md §2).
// Every issue message is the contract's rule id, so the validator, the store and the review
// screen all report the same names. Rule ids the contract doesn't name are listed in
// RULES_NOT_IN_CONTRACT for the BA's review (contract §6).
import { z } from 'zod';
import { isLocalDate, isYearMonth } from '../time/jst.ts';

// Contract §6.1 is the complete rule list (M2 prep: `weekday-mismatch` and the three M2 rules
// `resolved-ids-candidates`, `review-date-correction`, `override-no-past-write` are rows there
// now), so every id this code reports has a contract row and this list is empty. A rule id with
// no contract row is added there by the BA first; a unit test keeps this list empty.
export const RULES_NOT_IN_CONTRACT: readonly string[] = [];

export const codePoints = (s: string): number => [...s].length;

const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const CLOCK_TIME_RE = /^([01]\d|2[0-3]):(00|15|30|45)$/;

export function isTimestamp(value: string): boolean {
  const m = TIMESTAMP_RE.exec(value);
  if (!m) return false;
  const [, date, hh, mm, ss] = m;
  if (!isLocalDate(date ?? '')) return false;
  if (Number(hh) > 23 || Number(mm) > 59 || Number(ss ?? '0') > 59) return false;
  return !Number.isNaN(Date.parse(value));
}

/** Rejects unknown fields with the contract's `unknown-field` rule id. */
export function obj<T extends z.ZodRawShape>(shape: T) {
  return z.strictObject(shape, {
    error: (issue) => (issue.code === 'unrecognized_keys' ? 'unknown-field' : undefined),
  });
}

export const dateSchema = z.string().refine((s): boolean => isLocalDate(s), { error: 'date-invalid' });
export const monthSchema = z.string().refine((s): boolean => isYearMonth(s), { error: 'month-invalid' });
export const timestampSchema = z.string().refine(isTimestamp, { error: 'timestamp-invalid' });
export const clockTimeSchema = z.string().regex(CLOCK_TIME_RE, { error: 'time-invalid' });

/** Stored strings are NFC and trimmed (`string-untrimmed`). */
export const textSchema = z
  .string()
  .refine((s) => s === s.trim() && s === s.normalize('NFC'), { error: 'string-untrimmed' });

export function boundedText(min: number, max: number) {
  return textSchema.refine((s) => codePoints(s) >= min && codePoints(s) <= max, { error: 'text-length' });
}

export const localizedTextSchema = obj({
  ja: z.string().refine((s) => s.trim().length > 0, { error: 'l10n-ja-missing' }),
  en: z.string().optional(),
});

const ID_BODY = '[a-z0-9]+(?:-[a-z0-9]+)*';

/** Kebab-case id with one of the given kind prefixes (`id-format`). */
export function idSchema(...prefixes: string[]) {
  const re = new RegExp(`^(?:${prefixes.join('|')})-${ID_BODY}$`);
  return z.string().regex(re, { error: 'id-format' });
}

export function uniqueList<T extends z.ZodType>(item: T, min = 0, max = Number.POSITIVE_INFINITY) {
  return z
    .array(item)
    .refine((xs) => xs.length >= min && xs.length <= max, { error: 'list-length' })
    .refine((xs) => new Set(xs.map((x) => JSON.stringify(x))).size === xs.length, { error: 'list-unique' });
}

export function boundedList<T extends z.ZodType>(item: T, min = 0, max = Number.POSITIVE_INFINITY) {
  return z.array(item).refine((xs) => xs.length >= min && xs.length <= max, { error: 'list-length' });
}

export function intRange(min: number, max = Number.MAX_SAFE_INTEGER) {
  return z
    .number()
    .refine((n) => Number.isInteger(n) && n >= min && n <= max, { error: 'number-range' });
}

/** Record metadata of the sync seam (contract §2): ownerId, createdAt, updatedAt. */
export const metaShape = {
  ownerId: z.string().refine((s) => s.trim().length > 0, { error: 'meta-owner' }),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
};

export function metaTimestampsOk(record: { createdAt: string; updatedAt: string }): boolean {
  return Date.parse(record.updatedAt) >= Date.parse(record.createdAt);
}

export const allergenIdSchema = idSchema('alg');
export const themeIdSchema = idSchema('theme');

export const DIETS = ['vegetarian', 'pescatarian', 'no-pork', 'no-beef', 'no-seafood'] as const;
export type Diet = (typeof DIETS)[number];

export const ANIMAL_TAGS = ['meat', 'pork', 'beef', 'chicken', 'fish-seafood', 'egg', 'dairy', 'gelatin'] as const;
export type AnimalTag = (typeof ANIMAL_TAGS)[number];

/** Data contract §3.8: tags each diet forbids. */
export const DIET_FORBIDDEN_TAGS: Readonly<Record<Diet, readonly AnimalTag[]>> = {
  vegetarian: ['meat', 'pork', 'beef', 'chicken', 'fish-seafood', 'gelatin'],
  pescatarian: ['meat', 'pork', 'beef', 'chicken', 'gelatin'],
  'no-pork': ['pork', 'meat', 'gelatin'],
  'no-beef': ['beef', 'meat'],
  'no-seafood': ['fish-seafood'],
};

export const ALLERGEN_SCHEME = 'caa-2026-04';

/** Adds a custom issue whose message is the rule id. */
export function issue(ctx: z.RefinementCtx, rule: string, path: (string | number)[] = []): void {
  ctx.addIssue({ code: 'custom', message: rule, path });
}
