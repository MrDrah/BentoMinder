// Review / manual entry of a month's menu (US-E3-01…E3-04): a draft built from an extraction
// (or empty for manual entry), pure edit operations, uncertain-field bookkeeping, validation and
// the ConfirmedMenu it produces (BR-11, BR-12, BR-25). The draft lives in memory only: leaving
// the review discards it (OQ-23); nothing here touches storage.
import {
  confirmedMenuSchema,
  toRuleIssues,
  type ConfirmedMenu,
  type ExtractedDay,
  type ExtractedMenu,
  type NoLunchDay,
  type OutOfMonthEntry,
  type Verification,
} from '../schema/index.ts';
import { codePoints } from '../schema/primitives.ts';
import { datesOfMonth, weekdayOf, type LocalDate, type YearMonth } from '../time/jst.ts';

export type NoLunchReason = NoLunchDay['reason'];
export type MenuWarning = ExtractedMenu['warnings'][number];
export type ItemKind = ExtractedDay['items'][number]['kind'];

export const NO_LUNCH_REASONS: readonly NoLunchReason[] = ['bento-day', 'no-lunch', 'closed', 'unknown'];
/** US-E3-02/AC6: 「給食なし（午前保育など）」 is preselected. */
export const DEFAULT_NO_LUNCH_REASON: NoLunchReason = 'no-lunch';
export const MAX_ITEMS_PER_DAY = 12; // US-E3-02/AC5, contract §3.3
export const DISH_TEXT_MAX = 40; // US-E3-02/AC4
export const NO_LUNCH_TEXT_MAX = 60; // US-E3-02/AC6

export type DraftItem = ExtractedDay['items'][number];

export interface DraftNoLunch {
  reason: NoLunchReason;
  text: string;
  /** The wording follows the reason's label until the parent types in it (US-E3-02/AC6). */
  textEdited: boolean;
  verification: Verification;
  fromExtraction: boolean;
  changed: boolean;
}

export interface DraftDay {
  date: LocalDate;
  printedDateText: string | null;
  printedWeekday: ExtractedDay['printedWeekday'];
  items: DraftItem[];
  ingredientsStatus: ExtractedDay['ingredientsStatus'];
  ingredients?: ExtractedDay['ingredients'];
  allergenDeclaration: ExtractedDay['allergenDeclaration'];
  notes: string[];
  verification: Verification;
  /** Non-null: the day is a no-lunch day; its items stay hidden and restorable (US-E3-02/AC3). */
  noLunch: DraftNoLunch | null;
}

export interface ReviewDraft {
  month: YearMonth;
  mode: 'extraction' | 'manual';
  extractionId: string | null;
  days: DraftDay[];
  outOfMonth: OutOfMonthEntry[];
  warnings: MenuWarning[];
}

const ENTERED: Verification = { status: 'parent-entered' };

function blankDay(date: LocalDate): DraftDay {
  return {
    date,
    printedDateText: null,
    printedWeekday: null,
    items: [],
    ingredientsStatus: 'not-listed',
    allergenDeclaration: { status: 'not-declared', allergenIds: [], rawText: null, verification: ENTERED },
    notes: [],
    verification: ENTERED,
    noLunch: null,
  };
}

function fromExtractedDay(day: ExtractedDay): DraftDay {
  const { ingredients, ...rest } = structuredClone(day);
  return { ...rest, date: rest.date as LocalDate, ...(ingredients === undefined ? {} : { ingredients }), items: rest.items.map((i) => ({ ...i })), noLunch: null };
}

export function draftFromExtraction(menu: ExtractedMenu): ReviewDraft {
  const days = menu.days.map(fromExtractedDay);
  for (const n of menu.noLunchDays) {
    days.push({
      ...blankDay(n.date as LocalDate),
      verification: { status: 'ok' },
      noLunch: { reason: n.reason, text: n.originalText, textEdited: true, verification: { ...n.verification }, fromExtraction: true, changed: false },
    });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return {
    month: menu.targetMonth as YearMonth,
    mode: 'extraction',
    extractionId: menu.id,
    days,
    outOfMonth: structuredClone(menu.outOfMonthDays),
    warnings: [...menu.warnings],
  };
}

/** US-E3-04/AC1: manual entry starts empty; rows are every Mon–Fri of the month. */
export function emptyDraft(month: YearMonth): ReviewDraft {
  return { month, mode: 'manual', extractionId: null, days: [], outOfMonth: [], warnings: [] };
}

export interface ReviewRow {
  date: LocalDate;
  day: DraftDay | null;
}

/** US-E3-01/AC1: every Mon–Fri of the month in order, plus weekend dates only if listed. */
export function reviewRows(draft: ReviewDraft): ReviewRow[] {
  const byDate = new Map(draft.days.map((d) => [d.date, d]));
  return datesOfMonth(draft.month)
    .filter((date) => byDate.has(date) || (weekdayOf(date) !== 0 && weekdayOf(date) !== 6))
    .map((date) => ({ date, day: byDate.get(date) ?? null }));
}

// Field ids: stable within one render, used for focus order, test ids and accept actions.
export const fieldIds = {
  day: (date: string) => `${date}-day`,
  item: (date: string, i: number) => `${date}-item-${i}`,
  ingredient: (date: string, i: number) => `${date}-ing-${i}`,
  allergen: (date: string) => `${date}-alg`,
  noLunch: (date: string) => `${date}-nolunch`,
};

export interface UncertainField {
  id: string;
  date: LocalDate;
  reason: Verification['reason'];
  /** The printed weekday, for the weekday-mismatch reason line. */
  printed?: string;
}

/** Every visible field still `uncertain`, in row order (US-E3-01/AC2). */
export function uncertainFields(draft: ReviewDraft): UncertainField[] {
  const out: UncertainField[] = [];
  for (const { day } of reviewRows(draft)) {
    if (day === null) continue;
    const date = day.date;
    if (day.noLunch !== null) {
      if (day.noLunch.verification.status === 'uncertain') out.push({ id: fieldIds.noLunch(date), date, reason: day.noLunch.verification.reason });
      continue;
    }
    if (day.verification.status === 'uncertain') {
      out.push({ id: fieldIds.day(date), date, reason: day.verification.reason, ...(day.printedWeekday === null ? {} : { printed: day.printedWeekday }) });
    }
    day.items.forEach((item, i) => {
      if (item.verification.status === 'uncertain') out.push({ id: fieldIds.item(date, i), date, reason: item.verification.reason });
    });
    (day.ingredients ?? []).forEach((ing, i) => {
      if (day.ingredientsStatus === 'listed' && ing.verification.status === 'uncertain') {
        out.push({ id: fieldIds.ingredient(date, i), date, reason: ing.verification.reason });
      }
    });
    if (day.allergenDeclaration.verification.status === 'uncertain') {
      out.push({ id: fieldIds.allergen(date), date, reason: day.allergenDeclaration.verification.reason });
    }
  }
  return out;
}

function withDay(draft: ReviewDraft, date: LocalDate, change: (day: DraftDay) => DraftDay): ReviewDraft {
  const existing = draft.days.find((d) => d.date === date);
  const next = change(existing === undefined ? blankDay(date) : structuredClone(existing));
  const days = existing === undefined ? [...draft.days, next] : draft.days.map((d) => (d.date === date ? next : d));
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { ...draft, days };
}

const accepted = (v: Verification): Verification => (v.status === 'uncertain' ? { ...v, status: 'uncertain-accepted' } : v);

/** US-E3-02/AC1, US-E3-03/AC4: an edited field becomes `parent-edited` (added ones stay `parent-entered`). */
export function editItemText(draft: ReviewDraft, date: LocalDate, index: number, text: string): ReviewDraft {
  return withDay(draft, date, (day) => {
    const item = day.items[index];
    if (item === undefined) return day;
    const verification: Verification = item.verification.status === 'parent-entered' ? ENTERED : { status: 'parent-edited' };
    day.items[index] = { ...item, text, verification };
    return day;
  });
}

export function canAddItem(day: DraftDay | null): boolean {
  return day === null || day.items.length < MAX_ITEMS_PER_DAY;
}

/** US-E3-02/AC2: adds an empty dish (kind unknown, parent-entered); refused at 12 (AC5). */
export function addItem(draft: ReviewDraft, date: LocalDate): ReviewDraft {
  return withDay(draft, date, (day) => {
    if (!canAddItem(day)) return day;
    day.items.push({ text: '', kind: 'unknown', verification: ENTERED });
    return day;
  });
}

export function removeItem(draft: ReviewDraft, date: LocalDate, index: number): ReviewDraft {
  return withDay(draft, date, (day) => {
    day.items.splice(index, 1);
    return day;
  });
}

/** US-E3-03/AC4: 「このままにする」 keeps the text and counts the field as `uncertain-accepted`. */
export function acceptField(draft: ReviewDraft, fieldId: string): ReviewDraft {
  const field = uncertainFields(draft).find((f) => f.id === fieldId);
  if (field === undefined) return draft;
  return withDay(draft, field.date, (day) => {
    if (fieldId === fieldIds.day(day.date)) day.verification = accepted(day.verification);
    else if (fieldId === fieldIds.allergen(day.date)) {
      day.allergenDeclaration = { ...day.allergenDeclaration, verification: accepted(day.allergenDeclaration.verification) };
    } else if (fieldId === fieldIds.noLunch(day.date) && day.noLunch !== null) {
      day.noLunch = { ...day.noLunch, verification: accepted(day.noLunch.verification) };
    } else {
      const m = /-(item|ing)-(\d+)$/.exec(fieldId);
      const i = Number(m?.[2]);
      if (m?.[1] === 'item' && day.items[i] !== undefined) day.items[i] = { ...day.items[i], verification: accepted(day.items[i].verification) };
      const ing = day.ingredients?.[i];
      if (m?.[1] === 'ing' && day.ingredients !== undefined && ing !== undefined) {
        day.ingredients[i] = { ...ing, verification: accepted(ing.verification) };
      }
    }
    return day;
  });
}

/** US-E3-02/AC3, AC6: the day becomes a no-lunch day; its dishes stay hidden and restorable. */
export function markNoLunch(draft: ReviewDraft, date: LocalDate, defaultText: string, reason: NoLunchReason = DEFAULT_NO_LUNCH_REASON): ReviewDraft {
  return withDay(draft, date, (day) => {
    day.noLunch = { reason, text: defaultText, textEdited: false, verification: ENTERED, fromExtraction: false, changed: true };
    return day;
  });
}

/** US-E3-02/AC6: the wording follows the reason's label until the parent has typed in it. */
export function setNoLunchReason(draft: ReviewDraft, date: LocalDate, reason: NoLunchReason, defaultText: string): ReviewDraft {
  return withDay(draft, date, (day) => {
    if (day.noLunch === null) return day;
    day.noLunch = { ...day.noLunch, reason, text: day.noLunch.textEdited ? day.noLunch.text : defaultText, changed: true };
    return day;
  });
}

export function setNoLunchText(draft: ReviewDraft, date: LocalDate, text: string): ReviewDraft {
  return withDay(draft, date, (day) => {
    if (day.noLunch === null) return day;
    day.noLunch = { ...day.noLunch, text, textEdited: true, changed: true };
    return day;
  });
}

/** US-E3-02/AC3: 「給食ありに戻す」 before confirming brings the dishes back. */
export function restoreLunch(draft: ReviewDraft, date: LocalDate): ReviewDraft {
  return withDay(draft, date, (day) => ({ ...day, noLunch: null }));
}

const clean = (s: string): string => s.normalize('NFC').trim();

export type FieldError = 'dish-length' | 'no-lunch-text';

/** US-E3-02/AC4, AC6: dish names 1–40 and no-lunch wording 1–60 code points after trimming. */
export function fieldErrors(draft: ReviewDraft): Map<string, FieldError> {
  const errors = new Map<string, FieldError>();
  for (const day of draft.days) {
    if (day.noLunch !== null) {
      const n = codePoints(clean(day.noLunch.text));
      if (n < 1 || n > NO_LUNCH_TEXT_MAX) errors.set(fieldIds.noLunch(day.date), 'no-lunch-text');
      continue;
    }
    day.items.forEach((item, i) => {
      const n = codePoints(clean(item.text));
      if (n < 1 || n > DISH_TEXT_MAX) errors.set(fieldIds.item(day.date, i), 'dish-length');
    });
  }
  return errors;
}

/** US-E3-04/AC2: nothing to confirm when no day has a dish and no day is a no-lunch day. */
export function isDraftEmpty(draft: ReviewDraft): boolean {
  return !draft.days.some((d) => d.noLunch !== null || d.items.length > 0);
}

export type ConfirmBlock = 'errors' | 'empty' | null;

export function confirmBlock(draft: ReviewDraft): ConfirmBlock {
  if (fieldErrors(draft).size > 0) return 'errors';
  if (isDraftEmpty(draft)) return 'empty';
  return null;
}

function toNoLunchDay(day: DraftDay, n: DraftNoLunch): NoLunchDay {
  let verification: Verification;
  if (!n.fromExtraction) verification = ENTERED;
  else if (n.changed) verification = { status: 'parent-edited' };
  else verification = accepted(n.verification);
  return { date: day.date, reason: n.reason, originalText: clean(n.text), verification };
}

function toExtractedDay(day: DraftDay): ExtractedDay {
  return {
    date: day.date,
    printedDateText: day.printedDateText,
    printedWeekday: day.printedWeekday,
    items: day.items.map((i) => ({ ...i, text: clean(i.text), verification: accepted(i.verification) })),
    ingredientsStatus: day.ingredientsStatus,
    ...(day.ingredients === undefined ? {} : { ingredients: day.ingredients.map((i) => ({ ...i, verification: accepted(i.verification) })) }),
    allergenDeclaration: { ...day.allergenDeclaration, verification: accepted(day.allergenDeclaration.verification) },
    notes: day.notes,
    verification: accepted(day.verification),
  };
}

export interface ConfirmOptions {
  confirmedAt: string;
  /** The month's current confirmed menu: a refresh gets version + 1 and its changed dates. */
  previous: ConfirmedMenu | null;
}

export type ConfirmResult = { ok: true; menu: ConfirmedMenu } | { ok: false; issues: string[] };

/**
 * US-E3-03/AC1–AC2: the ConfirmedMenu. Fields still `uncertain` are stored `uncertain-accepted`
 * (the parent confirmed the dialog or accepted them one by one); lunch days without dishes are
 * left out (they are no longer on the menu).
 */
export function toConfirmedMenu(draft: ReviewDraft, options: ConfirmOptions): ConfirmResult {
  const days: ExtractedDay[] = [];
  const noLunchDays: NoLunchDay[] = [];
  for (const day of draft.days) {
    if (day.noLunch !== null) noLunchDays.push(toNoLunchDay(day, day.noLunch));
    else if (day.items.length > 0) days.push(toExtractedDay(day));
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  noLunchDays.sort((a, b) => a.date.localeCompare(b.date));
  const { previous } = options;
  const candidate = {
    month: draft.month,
    version: previous === null ? 1 : previous.version + 1,
    extractionId: draft.extractionId,
    confirmedAt: options.confirmedAt,
    days,
    noLunchDays,
    changedDatesSincePrevious: previous === null ? [] : changedDates(previous, { days, noLunchDays }),
  };
  const parsed = confirmedMenuSchema.safeParse(candidate);
  return parsed.success ? { ok: true, menu: parsed.data } : { ok: false, issues: toRuleIssues(parsed.error).map((i) => `${i.rule} ${i.path}`.trim()) };
}

function signature(menu: Pick<ConfirmedMenu, 'days' | 'noLunchDays'>): Map<string, string> {
  const sig = new Map<string, string>();
  for (const d of menu.days) sig.set(d.date, `L:${JSON.stringify(d.items.map((i) => [i.text, i.kind]))}`);
  for (const n of menu.noLunchDays) sig.set(n.date, `N:${n.reason}`);
  return sig;
}

/**
 * Contract §3.4 `changedDatesSincePrevious`: dates whose items changed, whose no-lunch reason
 * changed, that moved between days and no-lunch days, were added or were removed.
 */
export function changedDates(previous: Pick<ConfirmedMenu, 'days' | 'noLunchDays'>, next: Pick<ConfirmedMenu, 'days' | 'noLunchDays'>): string[] {
  const a = signature(previous);
  const b = signature(next);
  return [...new Set([...a.keys(), ...b.keys()])].filter((d) => a.get(d) !== b.get(d)).sort();
}
