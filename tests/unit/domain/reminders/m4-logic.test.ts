// M4 slice B pure logic: the reminder log writes (US-E7-05), reminder settings validation and the stored-time
// repair (US-E7-04/AC3), and the today overview (US-E7-03).
import { describe, expect, it } from 'vitest';
import { todayOverview } from '../../../../src/domain/calendar/today.ts';
import { createDayViewer } from '../../../../src/domain/calendar/day-view.ts';
import type { ReminderJob } from '../../../../src/domain/ports.ts';
import { pruneLog, recordDismissed, recordShown } from '../../../../src/domain/reminders/log.ts';
import { HOURS, isReminderTime, MINUTES, updateReminderSettings } from '../../../../src/domain/reminders/settings.ts';
import type { BentoMinderStore, ReminderLogEntry } from '../../../../src/domain/schema/index.ts';
import { bentoMinderStoreSchema } from '../../../../src/domain/schema/index.ts';
import { createRepository } from '../../../../src/domain/storage/repository.ts';
import { repairReminderTimes } from '../../../../src/domain/storage/repair.ts';
import { jstWallToInstant, type Instant, type LocalDate } from '../../../../src/domain/time/jst.ts';
import { loadFixture } from '../../helpers/fixtures.ts';
import { day, decisionRecord, dict, menu, noLunch, PS, storeWith } from '../../helpers/menus.ts';
import { fixedClock, memoryStorage } from '../../helpers/memory-storage.ts';

const d = (s: string) => s as LocalDate;
const job = (key: string, due: string, time: string, expires: string): ReminderJob => ({
  key,
  numericId: 1,
  type: key.startsWith('weekly') ? 'weekly' : 'day-before',
  dueAt: jstWallToInstant(d(due), time),
  expiresAt: jstWallToInstant(d(expires), '00:00'),
  target: { route: '#/calendar' },
  content: { titleKey: 't', bodyKey: 'b', params: {} },
  contentHash: 'h',
});
const J = job('day-before:2026-11-04', '2026-11-03', '17:30', '2026-11-04');
const at = jstWallToInstant(d('2026-11-03'), '17:31');

describe('reminder log writes (US-E7-05/AC1, AC4, contract 3.1)', () => {
  it('US-E7-05/AC4 recordShown creates the entry once with Tokyo timestamps and never overwrites shownAt', () => {
    const first = recordShown([], [J], at);
    expect(first).toEqual([{ key: J.key, type: 'day-before', dueAt: '2026-11-03T17:30:00+09:00', expiresAt: '2026-11-04T00:00:00+09:00', shownAt: '2026-11-03T17:31:00+09:00' }]);
    const again = recordShown(first, [J], (at + 3_600_000) as Instant);
    expect(again).toBe(first); // same array: the caller skips the write
  });

  it('US-E7-05/AC1 recordDismissed sets dismissedAt once, keeps shownAt, and is idempotent', () => {
    const shown = recordShown([], [J], at);
    const done = recordDismissed(shown, J, (at + 60_000) as Instant);
    expect(done[0]).toMatchObject({ shownAt: '2026-11-03T17:31:00+09:00', dismissedAt: '2026-11-03T17:32:00+09:00' });
    expect(recordDismissed(done, J, (at + 120_000) as Instant)).toBe(done);
    expect(recordDismissed([], J, at)[0]).toMatchObject({ shownAt: '2026-11-03T17:31:00+09:00', dismissedAt: '2026-11-03T17:31:00+09:00' });
  });

  it('US-E7-05/AC4 recordShown fills a missing shownAt on an existing entry', () => {
    const e: ReminderLogEntry = { key: J.key, type: 'day-before', dueAt: '2026-11-03T17:30:00+09:00', expiresAt: '2026-11-04T00:00:00+09:00' };
    expect(recordShown([e], [J], at)[0]?.shownAt).toBe('2026-11-03T17:31:00+09:00');
  });

  it('US-E7-05/AC1 log entries whose expiry is more than 60 days old are pruned; younger ones stay (same array when none)', () => {
    const old: ReminderLogEntry = { key: 'day-before:2026-08-01', type: 'day-before', dueAt: '2026-07-31T17:30:00+09:00', expiresAt: '2026-08-01T00:00:00+09:00' };
    const recent: ReminderLogEntry = { key: 'day-before:2026-10-20', type: 'day-before', dueAt: '2026-10-19T17:30:00+09:00', expiresAt: '2026-10-20T00:00:00+09:00' };
    expect(pruneLog([old, recent], at)).toEqual([recent]);
    const keep = [recent];
    expect(pruneLog(keep, at)).toBe(keep);
  });
});

describe('reminder settings (US-E7-04/AC3, BR-16)', () => {
  const store = loadFixture<BentoMinderStore>('state/m2-november.json');

  it('US-E7-04/AC3 the allowed times are 00:00 … 23:45 in 15-minute steps; 24:00 and 17:31 are not', () => {
    expect(HOURS).toHaveLength(24);
    expect(MINUTES).toEqual(['00', '15', '30', '45']);
    expect(['00:00', '17:30', '23:45'].every(isReminderTime)).toBe(true);
    expect(['24:00', '17:31', '7:30', '17:3', ''].some(isReminderTime)).toBe(false);
  });

  it('US-E7-04/AC2 updateReminderSettings applies a valid patch and stamps updatedAt', () => {
    const next = updateReminderSettings(store, { weekly: { weekday: 6, time: '20:00' }, dayBefore: { time: '19:15' } }, at);
    expect(next?.settings.reminders).toEqual({ weekly: { enabled: true, weekday: 6, time: '20:00' }, dayBefore: { enabled: true, time: '19:15' } });
    expect(next?.settings.updatedAt).toBe('2026-11-03T17:31:00+09:00');
    expect(bentoMinderStoreSchema.safeParse(next).success).toBe(true);
  });

  it('US-E7-04/AC3 an invalid value changes nothing (null)', () => {
    expect(updateReminderSettings(store, { dayBefore: { time: '17:31' } }, at)).toBeNull();
    expect(updateReminderSettings(store, { weekly: { weekday: 7 } }, at)).toBeNull();
    expect(updateReminderSettings(store, { weekly: { time: '24:00' } }, at)).toBeNull();
  });

  it('US-E7-04/AC3 a stored 24:00 / 17:31 is replaced by the default (14:00 / 17:30) on load; valid values stay as they are', async () => {
    const doc = JSON.parse(JSON.stringify(store)) as { settings: { reminders: { weekly: { time: string }; dayBefore: { time: string } } } };
    doc.settings.reminders.weekly.time = '24:00';
    doc.settings.reminders.dayBefore.time = '17:31';
    const repaired = repairReminderTimes(doc as unknown as Record<string, unknown>) as typeof doc;
    expect(repaired.settings.reminders).toMatchObject({ weekly: { time: '14:00' }, dayBefore: { time: '17:30' } });
    const storage = memoryStorage({ 'bentominder.state': JSON.stringify(doc) });
    const loaded = await createRepository(storage, fixedClock('2026-11-02T01:00:00Z')).load();
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') expect(loaded.state.settings.reminders.dayBefore.time).toBe('17:30');
    const valid = JSON.parse(JSON.stringify(store)) as Record<string, unknown>;
    expect(repairReminderTimes(valid)).toBe(valid);
  });
});

describe('today overview (US-E7-03)', () => {
  const view = createDayViewer(dict);
  const lunch = (date: string) => day(date, ['ごはん', 'さけのしおやき']);
  const store = (extra: { decisions?: ReturnType<typeof decisionRecord>[]; noLunchDays?: ReturnType<typeof noLunch>[]; dates?: string[] } = {}) =>
    storeWith({
      profile: PS,
      menus: [menu((extra.dates ?? ['2026-11-04', '2026-11-05', '2026-11-09', '2026-11-27']).map(lunch), extra.noLunchDays ?? [noLunch('2026-11-20', 'bento-day', 'お弁当の日')])],
      decisions: extra.decisions ?? [],
    });

  it('US-E7-03/AC1 today school day: its displayed decision (school lunch by default, bento when planned, not-confirmed when deferred)', () => {
    expect(todayOverview(store(), d('2026-11-05'), view)).toMatchObject({ kind: 'today', state: 'school-lunch-planned' });
    const planned = store({ decisions: [decisionRecord('2026-11-05', 'homemade-bento-planned', { plannedAt: '2026-11-01T10:00:00+09:00' })] });
    expect(todayOverview(planned, d('2026-11-05'), view)).toMatchObject({ kind: 'today', state: 'homemade-bento-planned' });
    const deferred = store({ decisions: [decisionRecord('2026-11-05', 'not-confirmed')] });
    expect(todayOverview(deferred, d('2026-11-05'), view)).toMatchObject({ kind: 'today', state: 'not-confirmed' });
  });

  it('US-E7-03/AC1 a no-lunch day shows no-school-lunch; a bento day not planned is flagged for the plan action', () => {
    const s = store({ noLunchDays: [noLunch('2026-11-20', 'bento-day', 'お弁当の日'), noLunch('2026-11-13', 'no-lunch', '休み')] });
    expect(todayOverview(s, d('2026-11-13'), view)).toMatchObject({ kind: 'today', state: 'no-school-lunch', bentoDayNotPlanned: false });
    expect(todayOverview(s, d('2026-11-20'), view)).toMatchObject({ kind: 'today', state: 'no-school-lunch', bentoDayNotPlanned: true });
  });

  it('US-E7-03/AC2 a weekend shows the next school day with its decision', () => {
    const o = todayOverview(store(), d('2026-11-07'), view);
    expect(o).toMatchObject({ kind: 'next', state: 'school-lunch-planned' });
    expect(o.kind === 'next' && o.view.date).toBe('2026-11-09');
  });

  it('US-E7-03/AC2 the next school day is skipped over a no-lunch day and may itself be a bento plan', () => {
    const s = store({
      dates: ['2026-11-09'],
      noLunchDays: [noLunch('2026-11-06', 'no-lunch', '休み'), noLunch('2026-11-20', 'bento-day', 'お弁当の日')],
      decisions: [decisionRecord('2026-11-09', 'homemade-bento-planned', { plannedAt: '2026-11-01T10:00:00+09:00' })],
    });
    const o = todayOverview(s, d('2026-11-05'), view);
    expect(o.kind).toBe('next');
    expect(o.kind === 'next' && [o.view.date, o.state]).toEqual(['2026-11-09', 'homemade-bento-planned']);
  });

  it('US-E7-03/AC4 no school day after today in any confirmed menu, or no menu at all: unknown', () => {
    expect(todayOverview(store({ dates: ['2026-11-04'] }), d('2026-11-28'), view)).toEqual({ kind: 'unknown' });
    expect(todayOverview(storeWith({ profile: PS, menus: [], decisions: [] }), d('2026-11-07'), view)).toEqual({ kind: 'unknown' });
  });

  it('US-E7-03/AC3 the overview is a pure function of the date: the next day gives the next answer', () => {
    const s = store();
    expect(todayOverview(s, d('2026-11-04'), view)).toMatchObject({ kind: 'today' });
    expect(todayOverview(s, d('2026-11-03'), view)).toMatchObject({ kind: 'next' });
  });
});
