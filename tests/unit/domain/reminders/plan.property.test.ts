// Reminder planner properties (oracle RP1-RP4, BR-15, BR-17): synthetic days only, no live data.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  jstWallToInstant,
  planReminders,
  todayJst,
  visibleReminders,
  type Instant,
  type LocalDate,
  type ReminderDay,
  type ReminderLogEntry,
  type Settings,
} from '../../../../src/domain/index.ts';

const FROM = Date.parse('2026-10-01T00:00:00Z');
const TO = Date.parse('2028-03-31T00:00:00Z');
const STATES = ['school-lunch-planned', 'not-confirmed', 'homemade-bento-planned', 'no-school-lunch', null] as const;
const times = fc.integer({ min: 0, max: 95 }).map((n) => `${String(Math.floor(n / 4)).padStart(2, '0')}:${String((n % 4) * 15).padStart(2, '0')}`);
const settingsArb: fc.Arbitrary<Settings['reminders']> = fc.record({
  weekly: fc.record({ enabled: fc.boolean(), weekday: fc.integer({ min: 0, max: 6 }), time: times }),
  dayBefore: fc.record({ enabled: fc.boolean(), time: times }),
});
const nowArb = fc.integer({ min: FROM, max: TO }).map((n) => n as Instant);

type Scenario = {
  now: Instant;
  settings: Settings['reminders'];
  offsets: number[];
  states: (typeof STATES)[number][];
  plannedShift: number[];
  logPick: string[];
};
const scenario: fc.Arbitrary<Scenario> = fc.record({
  now: nowArb,
  settings: settingsArb,
  offsets: fc.uniqueArray(fc.integer({ min: -3, max: 30 }), { maxLength: 10 }),
  states: fc.array(fc.constantFrom(...STATES), { minLength: 10, maxLength: 10 }),
  plannedShift: fc.array(fc.integer({ min: -3 * 24 * 60, max: 3 * 24 * 60 }), { minLength: 10, maxLength: 10 }), // minutes around the due instant
  logPick: fc.array(fc.constantFrom('none', 'shown', 'dismissed'), { minLength: 4, maxLength: 4 }),
});

function build(s: Scenario) {
  const today = todayJst(s.now);
  const days: ReminderDay[] = s.offsets.map((off, i) => {
    const date = addDays(today, off) as LocalDate;
    const state = s.states[i] ?? null;
    const due = jstWallToInstant(addDays(date, -1), s.settings.dayBefore.time);
    return {
      date,
      state,
      plannedAt: state === 'homemade-bento-planned' ? ((due + (s.plannedShift[i] ?? 0) * 60_000) as Instant) : undefined,
      recipe: state === 'homemade-bento-planned' ? { id: 'rcp-x', nameJa: 'x', shortJa: 'x', shortEn: 'x', resolves: true } : undefined,
      conflict: false,
      needsAck: false,
      lowPreference: i % 2 === 0,
      hasMenu: i % 3 !== 0,
    };
  });
  const first = planReminders({ settings: s.settings, days, now: s.now, log: [] }).jobs;
  const log: ReminderLogEntry[] = first.slice(0, 4).flatMap((j, i) => {
    const pick = s.logPick[i];
    if (pick === 'none') return [];
    const e: ReminderLogEntry = { key: j.key, type: j.type, dueAt: new Date(j.dueAt).toISOString(), expiresAt: new Date(j.expiresAt).toISOString(), shownAt: new Date(j.dueAt).toISOString() };
    return [pick === 'dismissed' ? { ...e, dismissedAt: new Date(j.dueAt + 60_000).toISOString() } : e];
  });
  return { days, log };
}

describe('reminder planner properties', () => {
  it('US-E7-05/AC1 RP1: planning twice from the same state gives an empty diff and the same jobs', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { days, log } = build(s);
        const a = planReminders({ settings: s.settings, days, now: s.now, log });
        const b = planReminders({ settings: s.settings, days, now: s.now, log, previous: a.jobs });
        expect(b.diff).toEqual({ remove: [], upsert: [] });
        expect(b.jobs).toEqual(a.jobs);
      }),
      { seed: 20261024, numRuns: 1000 },
    );
  });

  it('US-E7-05/AC2 US-E7-05/AC4 RP2 RP3: unique keys and ids, expires after due, never expired, never dismissed', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { days, log } = build(s);
        const { jobs } = planReminders({ settings: s.settings, days, now: s.now, log });
        expect(new Set(jobs.map((j) => j.key)).size).toBe(jobs.length);
        expect(new Set(jobs.map((j) => j.numericId)).size).toBe(jobs.length);
        const dismissed = new Set(log.filter((e) => e.dismissedAt !== undefined).map((e) => e.key));
        for (const j of jobs) {
          expect(j.expiresAt).toBeGreaterThan(j.dueAt);
          expect(j.expiresAt).toBeGreaterThan(s.now);
          expect(dismissed.has(j.key)).toBe(false);
          expect(j.key.startsWith(`${j.type}:`)).toBe(true);
        }
        expect(jobs.filter((j) => j.type === 'weekly').length).toBeLessThanOrEqual(3);
        const visible = visibleReminders(jobs, log, s.now);
        expect(visible.filter((v) => v.job.type === 'weekly').length).toBeLessThanOrEqual(1);
        for (const v of visible) expect(v.job.expiresAt).toBeGreaterThan(s.now);
      }),
      { seed: 20261024, numRuns: 1000 },
    );
  });

  it('US-E7-07/AC1 RP4: keys and instants do not depend on the device timezone', () => {
    const saved = process.env['TZ'];
    try {
      fc.assert(
        fc.property(scenario, fc.constantFrom('Asia/Tokyo', 'Europe/Paris', 'America/Los_Angeles'), (s, tz) => {
          const { days, log } = build(s);
          process.env['TZ'] = 'Asia/Tokyo';
          const ref = JSON.stringify(planReminders({ settings: s.settings, days, now: s.now, log }));
          process.env['TZ'] = tz;
          expect(JSON.stringify(planReminders({ settings: s.settings, days, now: s.now, log }))).toBe(ref);
        }),
        { seed: 20261024, numRuns: 300 },
      );
    } finally {
      if (saved === undefined) delete process.env['TZ'];
      else process.env['TZ'] = saved;
    }
  });

  it('US-E7-02/AC5: a day-before job exists only for planned days not planned after the due instant', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const { days } = build(s);
        const { jobs } = planReminders({ settings: s.settings, days, now: s.now, log: [] });
        for (const j of jobs.filter((x) => x.type === 'day-before')) {
          const day = days.find((x) => `day-before:${x.date}` === j.key);
          expect(day?.state).toBe('homemade-bento-planned');
          expect((day?.plannedAt ?? 0) <= j.dueAt).toBe(true);
        }
        if (!s.settings.dayBefore.enabled) expect(jobs.some((x) => x.type === 'day-before')).toBe(false);
        if (!s.settings.weekly.enabled) expect(jobs.some((x) => x.type === 'weekly')).toBe(false);
      }),
      { seed: 20261024, numRuns: 500 },
    );
  });
});
