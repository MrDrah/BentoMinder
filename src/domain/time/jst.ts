// Asia/Tokyo civil dates and wall times without a date library (ADR 001, BR-15).
// Japan has used a fixed UTC+09:00 offset with no DST since 1951, so every conversion is
// exact arithmetic on UTC fields. Nothing here reads the device clock or timezone:
// "now" is always passed in (from the Clock port).

export type LocalDate = string & { readonly __brand: 'LocalDate' }; // 'YYYY-MM-DD' in Asia/Tokyo
export type YearMonth = string & { readonly __brand: 'YearMonth' }; // 'YYYY-MM'
export type Instant = number & { readonly __brand: 'Instant' }; // epoch milliseconds (UTC)
export type WallTime = string & { readonly __brand: 'WallTime' }; // 'HH:MM'
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday (日) … 6 = Saturday (土)
export type WeekStartsOn = 'monday' | 'sunday';

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

const pad2 = (n: number): string => String(n).padStart(2, '0');
const pad4 = (n: number): string => String(n).padStart(4, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysIn(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] ?? 0;
}

/** True for a real Gregorian date written 'YYYY-MM-DD' (2027-02-29 is false, 2028-02-29 true). */
export function isLocalDate(value: string): value is LocalDate {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
}

export function isYearMonth(value: string): value is YearMonth {
  const m = MONTH_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return year >= 1 && month >= 1 && month <= 12;
}

/** Any 'HH:MM' between 00:00 and 23:59. Settings further restrict to 15-minute steps. */
export function isWallTime(value: string): value is WallTime {
  const m = TIME_RE.exec(value);
  if (!m) return false;
  return Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

export function localDate(value: string): LocalDate {
  if (!isLocalDate(value)) throw new RangeError(`not a calendar date: ${value}`);
  return value;
}

export function yearMonth(value: string): YearMonth {
  if (!isYearMonth(value)) throw new RangeError(`not a month: ${value}`);
  return value;
}

export function wallTime(value: string): WallTime {
  if (!isWallTime(value)) throw new RangeError(`not a time: ${value}`);
  return value;
}

export function dateParts(date: LocalDate): { year: number; month: number; day: number } {
  const [y, m, d] = date.split('-');
  return { year: Number(y), month: Number(m), day: Number(d) };
}

export function monthParts(month: YearMonth): { year: number; month: number } {
  const [y, m] = month.split('-');
  return { year: Number(y), month: Number(m) };
}

function fromUtcMs(ms: number): LocalDate {
  const d = new Date(ms);
  return `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` as LocalDate;
}

function toUtcMs(date: LocalDate): number {
  const { year, month, day } = dateParts(date);
  return Date.UTC(year, month - 1, day);
}

/** The Asia/Tokyo calendar date at this instant, whatever the device timezone. */
export function todayJst(now: Instant): LocalDate {
  return fromUtcMs(now + JST_OFFSET_MS);
}

/** The Asia/Tokyo wall-clock time 'HH:MM' at this instant. */
export function wallTimeJst(now: Instant): WallTime {
  const d = new Date(now + JST_OFFSET_MS);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}` as WallTime;
}

/** The instant of a JST wall time on a JST date: 2026-11-04 17:30 JST → 2026-11-04T08:30Z. */
export function jstWallToInstant(date: LocalDate, time: WallTime | string): Instant {
  const t = wallTime(time);
  const { year, month, day } = dateParts(date);
  const [hh, mm] = t.split(':');
  return (Date.UTC(year, month - 1, day, Number(hh), Number(mm)) - JST_OFFSET_MS) as Instant;
}

/** Contract timestamp with the JST offset: '2026-11-03T17:30:00+09:00'. */
export function toJstTimestamp(now: Instant): string {
  const d = new Date(now + JST_OFFSET_MS);
  return (
    `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+09:00`
  );
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function weekdayOf(date: LocalDate): Weekday {
  return new Date(toUtcMs(date)).getUTCDay() as Weekday;
}

export function monthOf(date: LocalDate): YearMonth {
  return date.slice(0, 7) as YearMonth;
}

export function daysInMonth(month: YearMonth): number {
  const { year, month: m } = monthParts(month);
  return daysIn(year, m);
}

export function firstOfMonth(month: YearMonth): LocalDate {
  return `${month}-01` as LocalDate;
}

export function addMonths(month: YearMonth, delta: number): YearMonth {
  const { year, month: m } = monthParts(month);
  const index = year * 12 + (m - 1) + delta;
  const y = Math.floor(index / 12);
  const mm = index - y * 12 + 1;
  return `${pad4(y)}-${pad2(mm)}` as YearMonth;
}

export function datesOfMonth(month: YearMonth): LocalDate[] {
  const first = firstOfMonth(month);
  return Array.from({ length: daysInMonth(month) }, (_, i) => addDays(first, i));
}

/** Column order of the weekday header for a week start (display only, ADR 001). */
export function weekdayOrder(weekStartsOn: WeekStartsOn): Weekday[] {
  return weekStartsOn === 'monday' ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}

/**
 * Calendar grid: rows of 7 cells, `null` for leading/trailing days of other months.
 * November 2026 with a Monday start puts Sunday 2026-11-01 in the last column of row 1.
 */
export function monthGrid(month: YearMonth, weekStartsOn: WeekStartsOn): (LocalDate | null)[][] {
  const dates = datesOfMonth(month);
  const order = weekdayOrder(weekStartsOn);
  const firstDate = dates[0] as LocalDate;
  const lead = order.indexOf(weekdayOf(firstDate));
  const cells: (LocalDate | null)[] = [...Array<null>(lead).fill(null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (LocalDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** 令和 year → Gregorian year (Reiwa 1 = 2019). Used only to cross-check extracted menus. */
export function reiwaToGregorian(reiwaYear: number): number {
  if (!Number.isInteger(reiwaYear) || reiwaYear < 1) throw new RangeError(`not a Reiwa year: ${reiwaYear}`);
  return 2018 + reiwaYear;
}
