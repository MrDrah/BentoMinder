// Reminder planner (BR-15..BR-18; US-E7-01, E7-02, E7-04, E7-05, E7-07; ADR 004 §4, ADR 010).
// Fixtures only: days are written by hand, never read from live data.
import { describe, expect, it } from 'vitest';
import {
  diffSchedule,
  planReminders,
  visibleReminders,
  type Instant,
  type LocalDate,
  type ReminderDay,
  type ReminderLogEntry,
  type Settings,
} from '../../../../src/domain/index.ts';

const at = (iso: string) => Date.parse(iso) as Instant;
const jst = (date: string, time: string) => at(`${date}T${time}:00+09:00`);
const d = (s: string) => s as LocalDate;
const Z = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');

const DEFAULTS: Settings['reminders'] = { weekly: { enabled: true, weekday: 0, time: '14:00' }, dayBefore: { enabled: true, time: '17:30' } };
type Recipe = NonNullable<ReminderDay['recipe']>;
const R1: Recipe = { id: 'rcp-kuma-onigiri', nameJa: 'くまさんおにぎり弁当', nameEn: 'Bear onigiri bento', shortJa: 'くまおにぎり', shortEn: 'Bear oni', resolves: true };
const R2: Recipe = { id: 'rcp-hoshi-omelette', nameJa: '星のオムレツ弁当', shortJa: 'ほしオムレツ', shortEn: 'Star egg', resolves: true };

const base = (date: string, extra: Partial<ReminderDay> = {}): ReminderDay => ({
  date: d(date),
  state: 'school-lunch-planned',
  conflict: false,
  needsAck: false,
  lowPreference: false,
  hasMenu: true,
  ...extra,
});
const planned = (date: string, plannedAt = '2026-10-28T10:00', recipe = R1, extra: Partial<ReminderDay> = {}) =>
  base(date, { state: 'homemade-bento-planned', plannedAt: at(`${plannedAt}:00+09:00`), recipe, ...extra });

/** A fortnight of menu days around `from` so weekly content has a menu unless a test says otherwise. */
const NOW = jst('2026-10-28', '10:00');
const plan = (days: ReminderDay[], now = NOW, settings = DEFAULTS, log: ReminderLogEntry[] = []) => planReminders({ settings, days, now, log });
const find = (days: ReminderDay[], key: string, now = NOW, settings = DEFAULTS, log: ReminderLogEntry[] = []) => plan(days, now, settings, log).jobs.find((j) => j.key === key);
const keys = (days: ReminderDay[], now = NOW, settings = DEFAULTS, log: ReminderLogEntry[] = []) => plan(days, now, settings, log).jobs.map((j) => j.key);
const visible = (days: ReminderDay[], now: Instant, settings = DEFAULTS, log: ReminderLogEntry[] = []) =>
  visibleReminders(plan(days, now, settings, log).jobs, log, now).map((v) => v.job.key);
const logEntry = (key: string, dueIso: string, expIso: string, extra: Partial<ReminderLogEntry> = {}): ReminderLogEntry => ({
  key,
  type: key.startsWith('weekly') ? 'weekly' : 'day-before',
  dueAt: dueIso,
  expiresAt: expIso,
  ...extra,
});

describe('day-before reminder: due, expiry and JST (US-E7-02, US-E7-07)', () => {
  it('US-E7-02/AC1: due 17:30 JST the day before, expires 00:00 JST of the day (RM01)', () => {
    const job = find([planned('2026-11-04')], 'day-before:2026-11-04');
    expect(job && Z(job.dueAt)).toBe('2026-11-03T08:30:00Z');
    expect(job && Z(job.expiresAt)).toBe('2026-11-03T15:00:00Z');
    expect(job?.target.route).toBe('#/recipe/rcp-kuma-onigiri?date=2026-11-04');
  });

  it('US-E7-07/AC1: instants are absolute, so the device zone never moves them (RM02, RM04)', () => {
    // The planner takes only an instant; the same instant gives the same plan whatever the device shows.
    const once = JSON.stringify(plan([planned('2026-11-04')], jst('2026-11-03', '17:30')));
    const saved = process.env['TZ'];
    try {
      for (const tz of ['Asia/Tokyo', 'Europe/Paris', 'America/Los_Angeles']) {
        process.env['TZ'] = tz;
        expect(JSON.stringify(plan([planned('2026-11-04')], jst('2026-11-03', '17:30')))).toBe(once);
      }
    } finally {
      if (saved === undefined) delete process.env['TZ'];
      else process.env['TZ'] = saved;
    }
  });

  it('US-E7-07/AC1: the weekly reminder of 2026-11-01 is due 2026-11-01T05:00:00Z (RM03, RM04)', () => {
    const job = find([], 'weekly:2026-11-02', at('2026-11-01T05:00:00Z'));
    expect(job && Z(job.dueAt)).toBe('2026-11-01T05:00:00Z');
    expect(job && Z(job.expiresAt)).toBe('2026-11-08T15:00:00Z');
  });

  it('US-E7-07/AC1: no one-hour shift on the morning the device DST ends (RM05)', () => {
    const job = find([], 'weekly:2026-10-26', at('2026-10-25T05:00:00Z'));
    expect(job && Z(job.dueAt)).toBe('2026-10-25T05:00:00Z');
    expect(job && Z(job.expiresAt)).toBe('2026-11-01T15:00:00Z');
  });

  it('US-E7-07/AC3: today, the dates and due instants stay put when the zone changes while open (RM31)', () => {
    const days = [planned('2026-11-04')];
    const before = plan(days, jst('2026-11-03', '12:00'));
    const after = plan(days, jst('2026-11-03', '12:05'));
    expect(after.jobs.map((j) => [j.key, j.dueAt, j.expiresAt])).toEqual(before.jobs.map((j) => [j.key, j.dueAt, j.expiresAt]));
    expect(planReminders({ settings: DEFAULTS, days, now: jst('2026-11-03', '12:05'), log: [], previous: before.jobs }).diff).toEqual({ remove: [], upsert: [] });
  });

  it('US-E7-02/AC3: month boundary, Friday 2027-01-29 and Monday 2027-02-01 (RM07)', () => {
    const days = [planned('2027-01-29', '2027-01-20T10:00'), planned('2027-02-01', '2027-01-20T10:00')];
    const now = jst('2027-01-28', '17:30');
    expect(Z(find(days, 'day-before:2027-01-29', now)?.dueAt ?? 0)).toBe('2027-01-28T08:30:00Z');
    expect(Z(find(days, 'day-before:2027-02-01', now)?.dueAt ?? 0)).toBe('2027-01-31T08:30:00Z');
    expect(Z(find(days, 'day-before:2027-02-01', now)?.expiresAt ?? 0)).toBe('2027-01-31T15:00:00Z');
  });

  it('US-E7-02/AC4: leap day (RM10)', () => {
    const days = [planned('2028-02-29', '2028-02-20T10:00'), planned('2028-03-01', '2028-02-20T10:00')];
    const now = jst('2028-02-28', '10:00');
    expect(Z(find(days, 'day-before:2028-02-29', now)?.dueAt ?? 0)).toBe('2028-02-28T08:30:00Z');
    expect(Z(find(days, 'day-before:2028-03-01', now)?.dueAt ?? 0)).toBe('2028-02-29T08:30:00Z');
  });

  it('US-E7-02/AC3: year boundary keeps a Friday 2027-01-01 reminder on 2026-12-31 (RM08)', () => {
    const settings: Settings['reminders'] = { ...DEFAULTS, weekly: { enabled: true, weekday: 4, time: '20:00' } };
    const now = jst('2026-12-31', '20:00');
    const days = [planned('2027-01-01', '2026-12-20T10:00')];
    expect(Z(find(days, 'day-before:2027-01-01', now, settings)?.dueAt ?? 0)).toBe('2026-12-31T08:30:00Z');
    const w = find(days, 'weekly:2027-01-01', now, settings);
    expect(w && Z(w.dueAt)).toBe('2026-12-31T11:00:00Z');
    expect(w && Z(w.expiresAt)).toBe('2027-01-07T15:00:00Z');
    expect(visible(days, now, settings)).toEqual(['day-before:2027-01-01', 'weekly:2027-01-01']);
  });

  it('US-E7-01/AC1: weekly across the year boundary (RM09)', () => {
    const w = find([], 'weekly:2026-12-28', jst('2026-12-27', '14:00'));
    expect(w && Z(w.dueAt)).toBe('2026-12-27T05:00:00Z');
    expect(w && Z(w.expiresAt)).toBe('2027-01-03T15:00:00Z');
  });
});

describe('which days get a day-before reminder (US-E7-02/AC1, AC5, AC6, US-E5-05/AC3, US-E5-08/AC4)', () => {
  const NC = base('2026-11-05', { state: 'not-confirmed' });

  it('US-E7-02/AC1: planned days only, never not-confirmed or school-lunch days (RM06)', () => {
    const k = keys([planned('2026-11-04'), NC, base('2026-11-06'), base('2026-11-09', { state: 'no-school-lunch' })]);
    expect(k.filter((x) => x.startsWith('day-before'))).toEqual(['day-before:2026-11-04']);
  });

  it('US-E5-08/AC4: a planned bento day gets one, an unplanned one does not (RM26, RM27)', () => {
    expect(keys([planned('2026-11-20', '2026-11-02T10:00')], jst('2026-11-19', '17:30'))).toContain('day-before:2026-11-20');
    expect(keys([base('2026-11-20', { state: 'no-school-lunch' })], jst('2026-11-19', '17:30')).filter((x) => x.startsWith('day-before'))).toEqual([]);
  });

  it('US-E7-02/AC5: first planned after the due time gets none (RM16, RM28)', () => {
    expect(keys([planned('2026-11-04', '2026-11-03T19:00')], jst('2026-11-03', '19:00'))).not.toContain('day-before:2026-11-04');
    expect(keys([planned('2026-11-04', '2026-11-04T08:00')], jst('2026-11-04', '08:00'))).not.toContain('day-before:2026-11-04');
  });

  it('US-E7-02/AC5: planned exactly at the due instant still creates it (B10 equality, RM36)', () => {
    const days = [planned('2026-11-04', '2026-11-03T17:30')];
    expect(keys(days, jst('2026-11-03', '17:30'))).toContain('day-before:2026-11-04');
    expect(visible(days, jst('2026-11-03', '17:30'))).toContain('day-before:2026-11-04');
  });

  it('US-E7-02/AC6: a recipe change keeps the key and the instants and only changes the content (RM20, RM34)', () => {
    const before = find([planned('2026-11-04', '2026-11-02T12:00', R1)], 'day-before:2026-11-04', jst('2026-11-03', '18:00'));
    const after = find([planned('2026-11-04', '2026-11-02T12:00', R2)], 'day-before:2026-11-04', jst('2026-11-03', '18:00'));
    expect(after?.dueAt).toBe(before?.dueAt);
    expect(after?.expiresAt).toBe(before?.expiresAt);
    expect(after?.numericId).toBe(before?.numericId);
    expect(after?.contentHash).not.toBe(before?.contentHash);
    expect(after?.content.params['recipeNameJa']).toBe('星のオムレツ弁当');
  });

  it('US-E7-02/AC7: a recipe change after the due time still shows the reminder, naming R2 (RM34)', () => {
    const now = jst('2026-11-03', '18:00');
    const days = [planned('2026-11-04', '2026-11-02T12:00', R2)];
    const v = visibleReminders(plan(days, now).jobs, [], now).filter((x) => x.job.type === 'day-before');
    expect(v.map((x) => [x.job.key, x.job.content.params['recipeNameJa']])).toEqual([['day-before:2026-11-04', '星のオムレツ弁当']]);
    expect(Z(v[0]?.labelAt ?? 0)).toBe('2026-11-03T08:30:00Z');
  });

  it('US-E7-02/AC8: planned again after the due time creates none, and neither does a change (RM37, RM41)', () => {
    expect(keys([planned('2026-11-04', '2026-11-03T18:00', R2)], jst('2026-11-03', '19:00'))).not.toContain('day-before:2026-11-04');
  });

  it('US-E7-02/AC6: cancelled or set to school lunch, deferred, removes it in the same plan (RM14, RM15)', () => {
    const now = jst('2026-11-03', '17:30');
    const first = plan([planned('2026-11-04', '2026-11-02T12:00')], now);
    const gone = planReminders({ settings: DEFAULTS, days: [base('2026-11-04')], now, log: [], previous: first.jobs });
    expect(gone.diff.remove).toContain('day-before:2026-11-04');
    const later = planReminders({ settings: DEFAULTS, days: [base('2026-11-04', { state: 'not-confirmed' })], now, log: [], previous: first.jobs });
    expect(later.diff.remove).toContain('day-before:2026-11-04');
  });

  it('US-E7-02/AC6: a refresh-conflict plan keeps its reminder and carries a conflict flag (RM32, RM39, RM40)', () => {
    const days = [planned('2026-11-04', '2026-11-02T12:00', R1, { conflict: true, needsAck: true })];
    const job = find(days, 'day-before:2026-11-04', jst('2026-11-03', '17:30'));
    expect(job?.content.params['conflict']).toBe(1);
  });

  it('US-E1-05/AC2: allergen ids of the child are carried as ids, never names of the child (RM33)', () => {
    const job = find([planned('2026-11-04', '2026-11-02T12:00', R1, { allergenIds: ['alg-egg'] })], 'day-before:2026-11-04');
    expect(job?.content.params['allergenIds']).toEqual(['alg-egg']);
    expect(JSON.stringify(job)).not.toMatch(/childName|name:/);
  });

  it('US-E7-02/AC2: a recipe that no longer resolves opens the day sheet', () => {
    const job = find([planned('2026-11-04', '2026-11-02T12:00', { ...R1, resolves: false })], 'day-before:2026-11-04');
    expect(job?.target.route).toBe('#/day/2026-11-04');
  });
});

describe('settings (US-E7-04)', () => {
  const days = [planned('2026-11-04', '2026-10-28T10:00')];
  it('US-E7-04/AC4: day-before off gives weekly only (RM11)', () => {
    const k = keys(days, jst('2026-11-03', '17:30'), { ...DEFAULTS, dayBefore: { enabled: false, time: '17:30' } });
    expect(k.some((x) => x.startsWith('day-before'))).toBe(false);
    expect(k.some((x) => x.startsWith('weekly'))).toBe(true);
  });
  it('US-E7-04/AC4: weekly off gives day-before only (RM12)', () => {
    const k = keys(days, jst('2026-11-01', '14:00'), { ...DEFAULTS, weekly: { enabled: false, weekday: 0, time: '14:00' } });
    expect(k).toEqual(['day-before:2026-11-04']);
  });
  it('US-E7-04/AC4: both off gives nothing (RM13)', () => {
    expect(keys(days, jst('2026-11-03', '17:30'), { weekly: { enabled: false, weekday: 0, time: '14:00' }, dayBefore: { enabled: false, time: '17:30' } })).toEqual([]);
  });
  it('US-E7-04/AC2: Saturday 20:00 weekly and 19:15 day-before (RM21)', () => {
    const settings: Settings['reminders'] = { weekly: { enabled: true, weekday: 6, time: '20:00' }, dayBefore: { enabled: true, time: '19:15' } };
    const now = jst('2026-11-07', '20:00');
    const w = find([planned('2026-11-11', '2026-10-28T10:00')], 'weekly:2026-11-08', now, settings);
    expect(w && Z(w.dueAt)).toBe('2026-11-07T11:00:00Z');
    expect(w && Z(w.expiresAt)).toBe('2026-11-14T15:00:00Z');
    const db = find([planned('2026-11-11', '2026-10-28T10:00')], 'day-before:2026-11-11', now, settings);
    expect(db && Z(db.dueAt)).toBe('2026-11-10T10:15:00Z');
  });
  it('US-E7-04/AC2: a dismissed reminder is not shown again after a time change (RM22)', () => {
    const settings: Settings['reminders'] = { ...DEFAULTS, dayBefore: { enabled: true, time: '19:15' } };
    const log = [logEntry('day-before:2026-11-04', '2026-11-03T17:30:00+09:00', '2026-11-04T00:00:00+09:00', { shownAt: '2026-11-03T17:30:00+09:00', dismissedAt: '2026-11-03T17:31:00+09:00' })];
    expect(visible(days, jst('2026-11-03', '19:15'), settings, log)).not.toContain('day-before:2026-11-04');
    expect(keys(days, jst('2026-11-03', '19:15'), settings, log)).not.toContain('day-before:2026-11-04');
  });
});

describe('weekly reminder content (US-E7-01)', () => {
  const now = jst('2026-11-01', '14:00');
  const week = (extra: Record<string, Partial<ReminderDay>> = {}) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = `2026-11-0${2 + i}`;
      return base(date.length === 10 ? date : date, extra[date] ?? {});
    });

  it('US-E7-01/AC1: lists the low-preference and the planned days of the week (RM03)', () => {
    const days = week({
      '2026-11-04': { lowPreference: true },
      '2026-11-06': { state: 'homemade-bento-planned', plannedAt: jst('2026-10-30', '10:00'), recipe: R1 },
    });
    const w = find(days, 'weekly:2026-11-02', now);
    expect(w?.content.bodyKey).toBe('reminders.weekly.summary');
    expect(w?.content.params['low']).toEqual(['2026-11-04']);
    expect(w?.content.params['bento']).toEqual(['2026-11-06|くまおにぎり|Bear oni']);
    expect(w?.content.params['from']).toBe('2026-11-02');
    expect(w?.content.params['to']).toBe('2026-11-08');
  });

  it('US-E7-01/AC3: nothing to report is still delivered (RM03)', () => {
    const w = find(week(), 'weekly:2026-11-02', now);
    expect(w?.content.bodyKey).toBe('reminders.weekly.empty');
  });

  it('US-E7-01/AC4: week across a month boundary names the month without a menu (RM24)', () => {
    const n = jst('2026-11-29', '14:00');
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = i === 0 ? '2026-11-30' : `2026-12-0${i}`;
      return base(date, { hasMenu: i === 0, state: i === 0 ? 'school-lunch-planned' : null });
    });
    const w = find(days, 'weekly:2026-11-30', n);
    expect(w?.content.bodyKey).toBe('reminders.weekly.summary');
    expect(w?.content.params['noMenuMonths']).toEqual(['2026-12']);
    expect(Z(w?.dueAt ?? 0)).toBe('2026-11-29T05:00:00Z');
    expect(Z(w?.expiresAt ?? 0)).toBe('2026-12-06T15:00:00Z');
  });

  it('US-E7-01/AC5: a week without any menu is always delivered, with the import prompt (RM25)', () => {
    const w = find([], 'weekly:2026-12-07', jst('2026-12-06', '14:00'));
    expect(w?.content.bodyKey).toBe('reminders.weekly.noMenu');
    expect(visible([], jst('2026-12-06', '14:00'))).toContain('weekly:2026-12-07');
  });

  it('US-E7-01/AC1: an unacknowledged refresh conflict is listed (B7)', () => {
    const days = week({ '2026-11-04': { state: 'homemade-bento-planned', plannedAt: jst('2026-10-30', '10:00'), recipe: R1, conflict: true, needsAck: true } });
    expect(find(days, 'weekly:2026-11-02', now)?.content.params['conflict']).toEqual(['2026-11-04']);
  });
});

describe('no duplicate or expired reminders (US-E7-05)', () => {
  const days = [planned('2026-11-04', '2026-10-28T10:00')];

  it('US-E7-05/AC1: a dismissed key is never visible again, reloaded or with the clock back (RM19)', () => {
    const log = [logEntry('day-before:2026-11-04', '2026-11-03T17:30:00+09:00', '2026-11-04T00:00:00+09:00', { shownAt: '2026-11-03T17:30:00+09:00', dismissedAt: '2026-11-03T17:31:00+09:00' })];
    expect(visible(days, jst('2026-11-03', '17:45'), DEFAULTS, log)).not.toContain('day-before:2026-11-04');
    expect(visible(days, jst('2026-11-03', '17:30'), DEFAULTS, log)).not.toContain('day-before:2026-11-04');
  });

  it('US-E7-05/AC2: missed reminders show on next open until expiry; none after (RM17, RM18)', () => {
    expect(visible(days, jst('2026-11-03', '21:00'))).toContain('day-before:2026-11-04');
    expect(visible(days, jst('2026-11-04', '07:00'))).not.toContain('day-before:2026-11-04');
    expect(keys(days, jst('2026-11-04', '07:00'))).not.toContain('day-before:2026-11-04');
  });

  it('US-E7-05/AC2: due and expiry boundaries are due <= now < expires (RM29, RM30)', () => {
    expect(visible(days, jst('2026-11-03', '17:29'))).not.toContain('day-before:2026-11-04');
    expect(visible(days, jst('2026-11-03', '17:30'))).toContain('day-before:2026-11-04');
    expect(visible(days, at('2026-11-03T14:59:59.999Z'))).toContain('day-before:2026-11-04');
    expect(visible(days, at('2026-11-03T15:00:00.000Z'))).not.toContain('day-before:2026-11-04');
  });

  it('US-E7-05/AC3: of two unexpired weekly reminders only the latest shows (RM23)', () => {
    const now = jst('2026-11-08', '15:00');
    expect(keys([], now).filter((k) => k.startsWith('weekly')).slice(0, 2)).toEqual(['weekly:2026-11-02', 'weekly:2026-11-09']);
    expect(visible([], now)).toEqual(['weekly:2026-11-09']);
  });

  it('US-E7-05/AC4: shown but not dismissed shows again, also after a time change (RM42, RM43)', () => {
    const log = [logEntry('day-before:2026-11-04', '2026-11-03T17:30:00+09:00', '2026-11-04T00:00:00+09:00', { shownAt: '2026-11-03T17:30:00+09:00' })];
    expect(visible(days, jst('2026-11-03', '19:00'), DEFAULTS, log)).toContain('day-before:2026-11-04');
    expect(visible(days, jst('2026-11-04', '07:00'), DEFAULTS, log)).not.toContain('day-before:2026-11-04');
    const later: Settings['reminders'] = { ...DEFAULTS, dayBefore: { enabled: true, time: '19:15' } };
    const v = visibleReminders(plan(days, jst('2026-11-03', '18:30'), later, log).jobs, log, jst('2026-11-03', '18:30'));
    expect(v.map((x) => x.job.key)).toContain('day-before:2026-11-04');
    expect(Z(v.find((x) => x.job.type === 'day-before')?.labelAt ?? 0)).toBe('2026-11-03T08:30:00Z');
  });

  it('US-E7-05/AC5: several due reminders are all returned and planning dismisses none', () => {
    const many = [planned('2026-11-05', '2026-10-28T10:00'), planned('2026-11-06', '2026-10-28T10:00')];
    const log: ReminderLogEntry[] = [];
    const v = visible(many, jst('2026-11-05', '17:45'), DEFAULTS, log);
    expect(v).toEqual(['weekly:2026-11-02', 'day-before:2026-11-06']);
    expect(log).toEqual([]);
  });

  it('US-E7-05/AC1: planning twice gives an empty diff (BR-17)', () => {
    const first = plan(days);
    const second = planReminders({ settings: DEFAULTS, days, now: NOW, log: [], previous: first.jobs });
    expect(second.diff).toEqual({ remove: [], upsert: [] });
    expect(second.jobs).toEqual(first.jobs);
  });

  it('US-E7-05/AC1: diffSchedule removes stale keys and upserts new or changed ones', () => {
    const a = plan([planned('2026-11-04')]).jobs;
    const b = plan([planned('2026-11-05')]).jobs;
    const diff = diffSchedule(a, b);
    expect(diff.remove).toEqual(['day-before:2026-11-04']);
    expect(diff.upsert.map((j) => j.key)).toContain('day-before:2026-11-05');
    expect(diff.upsert.map((j) => j.key)).not.toContain('day-before:2026-11-04');
  });

  it('US-E7-05/AC1: keys are unique and ids are stable 31-bit integers', () => {
    const jobs = plan([planned('2026-11-04'), planned('2026-11-05')], NOW, DEFAULTS).jobs;
    expect(new Set(jobs.map((j) => j.key)).size).toBe(jobs.length);
    expect(new Set(jobs.map((j) => j.numericId)).size).toBe(jobs.length);
    for (const j of jobs) {
      expect(Number.isInteger(j.numericId) && j.numericId > 0 && j.numericId < 2 ** 31).toBe(true);
    }
    expect(plan([planned('2026-11-04')]).jobs.find((j) => j.key === 'day-before:2026-11-04')?.numericId).toBe(jobs.find((j) => j.key === 'day-before:2026-11-04')?.numericId);
  });
});
