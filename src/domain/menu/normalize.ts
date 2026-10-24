// Finding F-1 (PLAN §7 "M1 prep done"): raw model output is normalised *before* the strict
// ExtractedMenu parse, so the BR-11 conditions that need the parent's review become review
// flags instead of MALFORMED_OUTPUT (ADR 002 §4 layer 3, US-E2-05/AC4–AC6):
//   - dates outside the target month (lunch and no-lunch days) move to `outOfMonthDays`;
//   - duplicate dates are merged into one entry flagged `uncertain / duplicate-date`;
//   - a printed weekday that disagrees with the date is flagged `uncertain / weekday-mismatch`;
//   - `detectedMonth` ≠ `targetMonth` adds the warning `month-mismatch`.
// Nothing is invented or silently fixed: every move or merge is visible on review. Anything
// else that is wrong (impossible dates, missing fields, bad enums…) is left for the strict
// schema to reject, which triggers the repair retry (BR-10). Pure: no clock, no I/O.
import { WEEKDAY_CHARS } from '../schema/extracted-menu.ts';
import { isLocalDate, monthOf, weekdayOf, type YearMonth } from '../time/jst.ts';

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const dateOf = (v: unknown): string | null => (isObject(v) && typeof v['date'] === 'string' ? v['date'] : null);
const MAX_NOTES = 5;

function isUncertain(v: unknown, reason: string): boolean {
  return isObject(v) && v['status'] === 'uncertain' && v['reason'] === reason;
}

/** Flags a day whose printed weekday disagrees with its (valid) date. */
function flagWeekday(day: Json): void {
  const date = dateOf(day);
  const printed = day['printedWeekday'];
  if (date === null || !isLocalDate(date) || typeof printed !== 'string') return;
  if (WEEKDAY_CHARS[weekdayOf(date)] === printed) return;
  if (isUncertain(day['verification'], 'weekday-mismatch')) return;
  const previous = day['verification'];
  const note = isObject(previous) && previous['status'] === 'uncertain' && typeof previous['reason'] === 'string' ? previous['reason'] : undefined;
  day['verification'] = note === undefined ? { status: 'uncertain', reason: 'weekday-mismatch' } : { status: 'uncertain', reason: 'weekday-mismatch', note };
}

function mergeDeclarations(a: unknown, b: unknown): unknown {
  if (!isObject(a) || !isObject(b)) return a;
  if (b['status'] !== 'declared') return a;
  if (a['status'] !== 'declared') return b;
  const ids = [...new Set([...(Array.isArray(a['allergenIds']) ? a['allergenIds'] : []), ...(Array.isArray(b['allergenIds']) ? b['allergenIds'] : [])])];
  const raw = [a['rawText'], b['rawText']].filter((t): t is string => typeof t === 'string' && t !== '');
  return { ...a, allergenIds: ids, rawText: raw.length > 0 ? raw.join('／') : null };
}

/** Merges every entry of one date into the first, keeping all items (US-E2-05/AC6). */
function mergeDuplicateDays(entries: Json[]): Json {
  const merged = clone(entries[0] as Json);
  for (const other of entries.slice(1)) {
    const items = Array.isArray(merged['items']) ? merged['items'] : [];
    merged['items'] = [...items, ...(Array.isArray(other['items']) ? other['items'] : [])];
    if (other['ingredientsStatus'] === 'listed' && Array.isArray(other['ingredients'])) {
      const mine = merged['ingredientsStatus'] === 'listed' && Array.isArray(merged['ingredients']) ? merged['ingredients'] : [];
      merged['ingredients'] = [...mine, ...other['ingredients']];
      merged['ingredientsStatus'] = 'listed';
    }
    merged['allergenDeclaration'] = mergeDeclarations(merged['allergenDeclaration'], other['allergenDeclaration']);
    const notes = [...(Array.isArray(merged['notes']) ? merged['notes'] : []), ...(Array.isArray(other['notes']) ? other['notes'] : [])];
    merged['notes'] = [...new Set(notes)].slice(0, MAX_NOTES);
  }
  merged['verification'] = { status: 'uncertain', reason: 'duplicate-date' };
  return merged;
}

/** Groups entries by date, preserving first-seen order; entries without a string date stay apart. */
function groupByDate(list: unknown[]): { date: string | null; entries: Json[] }[] {
  const groups: { date: string | null; entries: Json[] }[] = [];
  const index = new Map<string, number>();
  for (const entry of list) {
    if (!isObject(entry)) {
      groups.push({ date: null, entries: [entry as Json] });
      continue;
    }
    const date = dateOf(entry);
    if (date === null) {
      groups.push({ date: null, entries: [entry] });
      continue;
    }
    const at = index.get(date);
    if (at === undefined) {
      index.set(date, groups.length);
      groups.push({ date, entries: [entry] });
    } else groups[at]?.entries.push(entry);
  }
  return groups;
}

const isOutside = (date: string | null, month: YearMonth): boolean =>
  date !== null && isLocalDate(date) && monthOf(date) !== month;

/**
 * Normalises a parsed model reply for `targetMonth`. Returns a new value; the input is not
 * changed. Values that are not objects are returned as they are (the strict parse rejects them).
 */
export function normalizeModelOutput(raw: unknown, targetMonth: YearMonth): unknown {
  if (!isObject(raw)) return raw;
  const out = clone(raw);
  // The target month is the parent's choice (contract §3.3), not the model's reading of it.
  out['targetMonth'] = targetMonth;
  const outOfMonth: unknown[] = Array.isArray(out['outOfMonthDays']) ? [...out['outOfMonthDays']] : [];
  let moved = false;

  if (Array.isArray(out['days'])) {
    const days: unknown[] = [];
    for (const group of groupByDate(out['days'])) {
      const day = group.entries.length > 1 ? mergeDuplicateDays(group.entries) : group.entries[0];
      if (isObject(day)) flagWeekday(day);
      if (isOutside(group.date, targetMonth)) {
        outOfMonth.push({ kind: 'lunch-day', day });
        moved = true;
      } else days.push(day);
    }
    days.sort((a, b) => (dateOf(a) ?? '').localeCompare(dateOf(b) ?? ''));
    out['days'] = days;
  }

  if (Array.isArray(out['noLunchDays'])) {
    const noLunch: unknown[] = [];
    for (const group of groupByDate(out['noLunchDays'])) {
      const first = group.entries[0];
      const entry = group.entries.length > 1 && isObject(first) ? { ...first, verification: { status: 'uncertain', reason: 'duplicate-date' } } : first;
      if (isOutside(group.date, targetMonth)) {
        outOfMonth.push({ kind: 'no-lunch-day', noLunchDay: entry });
        moved = true;
      } else noLunch.push(entry);
    }
    out['noLunchDays'] = noLunch;
  }

  if (moved || Array.isArray(out['outOfMonthDays'])) {
    const seen = new Set<string>();
    const innerDate = (e: unknown): string =>
      isObject(e) ? (dateOf(e['day']) ?? dateOf(e['noLunchDay']) ?? '') : '';
    out['outOfMonthDays'] = outOfMonth
      .filter((e) => {
        const key = `${innerDate(e)}|${isObject(e) ? String(e['kind']) : ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => innerDate(a).localeCompare(innerDate(b)));
  }

  const detected = out['detectedMonth'];
  if (typeof detected === 'string' && detected !== targetMonth && Array.isArray(out['warnings']) && !out['warnings'].includes('month-mismatch')) {
    out['warnings'] = [...out['warnings'], 'month-mismatch'];
  }
  return out;
}

/** ADR 002 §5: a reply with no dates at all (in or outside the month) is "not a menu". */
export function isNotAMenu(output: { days: unknown[]; noLunchDays: unknown[]; outOfMonthDays: unknown[] }): boolean {
  return output.days.length === 0 && output.noLunchDays.length === 0 && output.outOfMonthDays.length === 0;
}
