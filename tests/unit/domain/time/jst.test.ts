// Runs twice: in the "domain" project (machine timezone) and in the "tz" project with
// TZ=America/Los_Angeles, so every assertion also holds on a device that isn't on JST (BR-15).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  compareDates,
  datesOfMonth,
  daysInMonth,
  diffDays,
  firstOfMonth,
  isLeapYear,
  isLocalDate,
  isWallTime,
  isYearMonth,
  jstWallToInstant,
  localDate,
  monthGrid,
  monthOf,
  reiwaToGregorian,
  todayJst,
  toJstTimestamp,
  wallTime,
  wallTimeJst,
  weekdayOf,
  weekdayOrder,
  yearMonth,
  type Instant,
} from '../../../../src/domain/time/jst.ts';

const at = (iso: string) => Date.parse(iso) as Instant;
const d = localDate;
const m = yearMonth;

describe('US-E8-03/AC3 all date math uses Asia/Tokyo calendar dates (BR-15)', () => {
  it('runs in the device timezone the project sets (tz project: America/Los_Angeles)', () => {
    const tz = process.env['TZ'];
    if (tz !== undefined && tz !== '') {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz);
      expect(new Date(Date.UTC(2026, 10, 15)).getTimezoneOffset()).toBe(480);
    }
  });

  it('US-E8-03/AC3 today is the Tokyo date, not the device date: 2026-11-15 00:30 JST is 2026-11-15', () => {
    // 2026-11-14 16:30 in Paris, 07:30 in Los Angeles
    expect(todayJst(at('2026-11-14T15:30:00Z'))).toBe('2026-11-15');
    expect(wallTimeJst(at('2026-11-14T15:30:00Z'))).toBe('00:30');
  });

  it('US-E8-03/AC3 one minute before Tokyo midnight is still the previous Tokyo date', () => {
    expect(todayJst(at('2026-11-14T14:59:00Z'))).toBe('2026-11-14');
    expect(todayJst(at('2026-11-14T15:00:00Z'))).toBe('2026-11-15');
  });

  it('US-E8-03/AC3 a JST wall time maps to the same instant whatever the device timezone', () => {
    expect(jstWallToInstant(d('2026-11-04'), '17:30')).toBe(Date.UTC(2026, 10, 4, 8, 30));
    expect(jstWallToInstant(d('2027-01-01'), '00:00')).toBe(Date.UTC(2026, 11, 31, 15, 0));
  });

  it('US-E8-03/AC3 contract timestamps carry the +09:00 offset', () => {
    expect(toJstTimestamp(at('2026-11-03T08:30:05Z'))).toBe('2026-11-03T17:30:05+09:00');
    expect(Date.parse(toJstTimestamp(at('2026-11-03T08:30:05Z')))).toBe(at('2026-11-03T08:30:05Z'));
  });

  it('US-E8-03/AC3 property: the Tokyo date and wall time of an instant convert back to that minute', () => {
    fc.assert(
      fc.property(fc.integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2100, 0, 1) }), (ms) => {
        const now = ms as Instant;
        const back = jstWallToInstant(todayJst(now), wallTimeJst(now));
        return back <= now && now - back < 60_000;
      }),
    );
  });
});

describe('calendar arithmetic across month, year and leap boundaries (BR-15)', () => {
  it('validates real Gregorian dates only', () => {
    expect(isLocalDate('2027-02-29')).toBe(false);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-11-31')).toBe(false);
    expect(isLocalDate('2026-1-01')).toBe(false);
    expect(isLocalDate('0000-01-01')).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2100)).toBe(false);
  });

  it('validates months and wall times', () => {
    expect(isYearMonth('2026-11')).toBe(true);
    expect(isYearMonth('2026-00')).toBe(false);
    expect(isYearMonth('2026-11-01')).toBe(false);
    expect(isWallTime('23:59')).toBe(true);
    expect(isWallTime('24:00')).toBe(false);
    expect(isWallTime('7:30')).toBe(false);
    expect(() => localDate('2027-02-29')).toThrow(RangeError);
    expect(() => yearMonth('2026-13')).toThrow(RangeError);
    expect(() => wallTime('17:60')).toThrow(RangeError);
    expect(() => jstWallToInstant(d('2026-11-04'), '25:00')).toThrow(RangeError);
  });

  it('counts 28 days in February 2027 and 29 in February 2028; 2028-02-29 is a Tuesday', () => {
    expect(daysInMonth(m('2027-02'))).toBe(28);
    expect(daysInMonth(m('2028-02'))).toBe(29);
    expect(daysInMonth(m('2026-11'))).toBe(30);
    expect(weekdayOf(d('2028-02-29'))).toBe(2);
    expect(datesOfMonth(m('2028-02'))).toHaveLength(29);
  });

  it('checks the weekdays the stories rely on', () => {
    expect(weekdayOf(d('2026-11-03'))).toBe(2); // Tue 文化の日
    expect(weekdayOf(d('2026-11-23'))).toBe(1); // Mon 勤労感謝の日
    expect(weekdayOf(d('2026-11-30'))).toBe(1);
    expect(weekdayOf(d('2027-01-29'))).toBe(5);
    expect(weekdayOf(d('2027-02-01'))).toBe(1);
  });

  it('adds days and months across year ends', () => {
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2027-02-01'), -1)).toBe('2027-01-31');
    expect(addDays(d('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(d('2028-02-29'), 1)).toBe('2028-03-01');
    expect(addMonths(m('2026-11'), 2)).toBe('2027-01');
    expect(addMonths(m('2027-01'), -1)).toBe('2026-12');
    expect(addMonths(m('2026-11'), -23)).toBe('2024-12');
    expect(diffDays(d('2026-11-29'), d('2026-12-06'))).toBe(7);
    expect(diffDays(d('2028-03-01'), d('2028-02-28'))).toBe(-2);
    expect(monthOf(d('2026-11-04'))).toBe('2026-11');
    expect(firstOfMonth(m('2026-11'))).toBe('2026-11-01');
    expect(compareDates(d('2026-11-04'), d('2026-11-05'))).toBe(-1);
    expect(compareDates(d('2026-11-05'), d('2026-11-04'))).toBe(1);
    expect(compareDates(d('2026-11-05'), d('2026-11-05'))).toBe(0);
  });

  it('property: addDays and diffDays are inverse', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40_000 }), fc.integer({ min: -800, max: 800 }), (offset, n) => {
        const base = addDays(d('2000-01-01'), offset);
        return diffDays(base, addDays(base, n)) === n;
      }),
    );
  });

  it('lays out November 2026 with Monday first: Sunday 2026-11-01 ends row 1', () => {
    const grid = monthGrid(m('2026-11'), 'monday');
    expect(weekdayOrder('monday')).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(grid[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(grid.flat().filter((x) => x !== null)).toHaveLength(30);
    expect(grid.at(-1)?.[0]).toBe('2026-11-30');
  });

  it('lays out November 2026 with Sunday first: Sunday 2026-11-01 starts row 1', () => {
    const grid = monthGrid(m('2026-11'), 'sunday');
    expect(weekdayOrder('sunday')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(grid[0]?.[0]).toBe('2026-11-01');
    expect(grid.flat().filter((x) => x !== null)).toHaveLength(30);
  });

  it('converts 令和 years for the extractor cross-check (Reiwa 1 = 2019)', () => {
    expect(reiwaToGregorian(1)).toBe(2019);
    expect(reiwaToGregorian(8)).toBe(2026);
    expect(() => reiwaToGregorian(0)).toThrow(RangeError);
    expect(() => reiwaToGregorian(1.5)).toThrow(RangeError);
  });
});
