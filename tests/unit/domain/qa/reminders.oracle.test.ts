// QA: reminder oracle vs engine (tests/oracle/reminder-oracle.md). Expected instants in the RM table are the spec's UTC
// conversions, written literally; the random comparison uses tests/oracle/impl/reminders.ts (no code shared with src/).
import { describe, expect, it } from 'vitest';
import { diffSchedule, planReminders, visibleReminders } from '../../../../src/domain/index.ts';
import { planRemindersForStore } from '../../../../src/domain/calendar/reminder-days.ts';
import { createDayViewer } from '../../../../src/domain/calendar/day-view.ts';
import type { Instant, ReminderDay } from '../../../../src/domain/index.ts';
import { oPlan, oVisible, oAdd, oToday, type ODay, type OLog, type OSettings } from '../../../oracle/impl/reminders.ts';
import { Prng } from '../../../oracle/impl/prng.ts';
import { d, day, decisionRecord, dict, menu, storeWith } from '../../helpers/menus.ts';

const at = (iso: string) => Date.parse(iso) as Instant;
const DEF: OSettings = { weekly: { enabled: true, weekday: 0, time: '14:00' }, dayBefore: { enabled: true, time: '17:30' } };
const mk = (date: string, state: ODay['state'] = 'homemade-bento-planned', plannedAt?: string): ReminderDay =>
  ({ date: d(date), state, plannedAt: plannedAt === undefined ? at('2026-10-28T01:00:00Z') : at(plannedAt), conflict: false, needsAck: false, lowPreference: false, hasMenu: true }) as ReminderDay;
const planE = (s: OSettings, days: ReminderDay[], now: string, log: OLog[] = []) =>
  planReminders({ settings: s as never, days, now: at(now), log: log as never });
type J = { key: string; dueAt: number; expiresAt: number };
const sig = (jobs: readonly J[]) => jobs.map((j) => `${j.key}|${new Date(j.dueAt).toISOString()}|${new Date(j.expiresAt).toISOString()}`);
const find = (jobs: readonly J[], key: string) => sig(jobs).find((s) => s.startsWith(`${key}|`));
const shownKeys = (s: OSettings, days: ReminderDay[], now: string, log: OLog[] = []) => {
  const { jobs } = planE(s, days, now, log);
  return visibleReminders(jobs, log as never, at(now)).map((v) => v.job.key);
};
const noWeekly: OSettings = { ...DEF, weekly: { ...DEF.weekly, enabled: false } };

describe('QA RM table: planned keys and instants (literal expectations)', () => {
  it('US-E7-02/AC1 RM01 day-before due 17:30 JST the day before, expires 00:00 JST of the day', () => {
    const { jobs } = planE(DEF, [mk('2026-11-04')], '2026-11-03T08:30:00Z');
    expect(find(jobs, 'day-before:2026-11-04')).toBe('day-before:2026-11-04|2026-11-03T08:30:00.000Z|2026-11-03T15:00:00.000Z');
    expect(shownKeys(DEF, [mk('2026-11-04')], '2026-11-03T08:30:00Z')).toContain('day-before:2026-11-04');
  });
  it('US-E7-01/AC1 RM03 weekly Sunday 14:00 JST covers Mon..Sun, key is the Monday', () => {
    const { jobs } = planE(DEF, [], '2026-11-01T05:00:00Z');
    expect(find(jobs, 'weekly:2026-11-02')).toBe('weekly:2026-11-02|2026-11-01T05:00:00.000Z|2026-11-08T15:00:00.000Z');
    expect(shownKeys(DEF, [], '2026-11-01T05:00:00Z')).toEqual(['weekly:2026-11-02']);
  });
  it('US-E7-07/AC1 RM04 RM05 the device date and DST never change key or instants', () => {
    const { jobs } = planE(DEF, [], '2026-10-25T05:00:00Z');
    expect(find(jobs, 'weekly:2026-10-26')).toBe('weekly:2026-10-26|2026-10-25T05:00:00.000Z|2026-11-01T15:00:00.000Z');
  });
  it('US-E7-02/AC1 US-E5-05/AC3 RM06 no key for a no-lunch neighbour, and 11-04 is gone after 11-04 00:00 JST', () => {
    const days = [mk('2026-11-04'), mk('2026-11-05', 'no-school-lunch')];
    expect(planE(DEF, days, '2026-11-04T08:30:00Z').jobs.map((j) => j.key).filter((k) => k.startsWith('day-before'))).toEqual([]);
    expect(planE(DEF, days, '2026-11-02T01:00:00Z').jobs.map((j) => j.key)).not.toContain('day-before:2026-11-05');
  });
  it('US-E7-02/AC3 RM07 month boundary, Friday plan reminds on Thursday and Monday plan on Sunday', () => {
    const { jobs } = planE(DEF, [mk('2027-01-29'), mk('2027-02-01')], '2027-01-28T08:30:00Z');
    expect(find(jobs, 'day-before:2027-01-29')).toBe('day-before:2027-01-29|2027-01-28T08:30:00.000Z|2027-01-28T15:00:00.000Z');
    expect(find(jobs, 'day-before:2027-02-01')).toBe('day-before:2027-02-01|2027-01-31T08:30:00.000Z|2027-01-31T15:00:00.000Z');
  });
  it('US-E7-02/AC3 RM08 year boundary, weekly Thursday 20:00 and day-before 2027-01-01', () => {
    const s: OSettings = { ...DEF, weekly: { enabled: true, weekday: 4, time: '20:00' } };
    const { jobs } = planE(s, [mk('2027-01-01')], '2026-12-31T11:00:00Z');
    expect(find(jobs, 'day-before:2027-01-01')).toBe('day-before:2027-01-01|2026-12-31T08:30:00.000Z|2026-12-31T15:00:00.000Z');
    expect(find(jobs, 'weekly:2027-01-01')).toBe('weekly:2027-01-01|2026-12-31T11:00:00.000Z|2027-01-07T15:00:00.000Z');
    expect(shownKeys(s, [mk('2027-01-01')], '2026-12-31T11:00:00Z').sort()).toEqual(['day-before:2027-01-01', 'weekly:2027-01-01']);
  });
  it('US-E7-01/AC1 RM09 weekly across the year boundary', () => {
    const { jobs } = planE(DEF, [], '2026-12-27T05:00:00Z');
    expect(find(jobs, 'weekly:2026-12-28')).toBe('weekly:2026-12-28|2026-12-27T05:00:00.000Z|2027-01-03T15:00:00.000Z');
  });
  it('US-E7-02/AC4 RM10 leap day 2028-02-29 and 2028-03-01', () => {
    const { jobs } = planE(DEF, [mk('2028-02-29'), mk('2028-03-01')], '2028-02-28T08:30:00Z');
    expect(find(jobs, 'day-before:2028-02-29')).toBe('day-before:2028-02-29|2028-02-28T08:30:00.000Z|2028-02-28T15:00:00.000Z');
    expect(find(jobs, 'day-before:2028-03-01')).toBe('day-before:2028-03-01|2028-02-29T08:30:00.000Z|2028-02-29T15:00:00.000Z');
  });
  it('US-E7-04/AC4 RM11 RM12 RM13 switches off remove only their own type', () => {
    const days = [mk('2026-11-04')];
    const noDb = planE({ ...DEF, dayBefore: { enabled: false, time: '17:30' } }, days, '2026-11-01T01:00:00Z').jobs.map((j) => j.type);
    expect(noDb.length).toBeGreaterThan(0);
    expect(noDb.every((t) => t === 'weekly')).toBe(true);
    expect(planE(noWeekly, days, '2026-11-01T01:00:00Z').jobs.map((j) => j.key)).toEqual(['day-before:2026-11-04']);
    expect(planE({ weekly: { ...DEF.weekly, enabled: false }, dayBefore: { enabled: false, time: '17:30' } }, days, '2026-11-01T01:00:00Z').jobs).toEqual([]);
  });
  it('US-E7-02/AC6 RM14 RM15 a day that is not homemade-bento-planned has no day-before', () => {
    for (const st of ['school-lunch-planned', 'not-confirmed', 'no-school-lunch', null] as const) {
      expect(planE(DEF, [mk('2026-11-04', st)], '2026-11-02T03:00:00Z').jobs.map((j) => j.key), String(st)).not.toContain('day-before:2026-11-04');
    }
  });
  it('US-E7-02/AC5 RM16 RM28 RM37 planned after the due instant: no reminder', () => {
    expect(planE(DEF, [mk('2026-11-04', undefined, '2026-11-03T10:00:00Z')], '2026-11-03T10:00:00Z').jobs.map((j) => j.key)).not.toContain('day-before:2026-11-04');
    expect(planE(DEF, [mk('2026-11-04', undefined, '2026-11-03T09:00:00Z')], '2026-11-03T10:00:00Z').jobs.map((j) => j.key)).not.toContain('day-before:2026-11-04');
  });
  it('US-E7-02/AC5 RM36 planned at exactly the due instant: created (ruling 2026-10-31); one ms later: suppressed', () => {
    const { jobs } = planE(DEF, [mk('2026-11-04', undefined, '2026-11-03T08:30:00Z')], '2026-11-03T08:30:00Z');
    expect(find(jobs, 'day-before:2026-11-04')).toBe('day-before:2026-11-04|2026-11-03T08:30:00.000Z|2026-11-03T15:00:00.000Z');
    expect(planE(DEF, [mk('2026-11-04', undefined, '2026-11-03T08:30:00.001Z')], '2026-11-03T08:30:01Z').jobs.map((j) => j.key)).not.toContain('day-before:2026-11-04');
  });
  it('US-E7-02/AC6 RM20 RM34 plannedAt before due keeps the reminder', () => {
    expect(find(planE(DEF, [mk('2026-11-04', undefined, '2026-11-02T03:00:00Z')], '2026-11-03T09:00:00Z').jobs, 'day-before:2026-11-04')).toBeDefined();
  });
  it('US-E7-04/AC2 RM21 custom times: weekly Saturday 20:00 and day-before 19:15', () => {
    const s: OSettings = { weekly: { enabled: true, weekday: 6, time: '20:00' }, dayBefore: { enabled: true, time: '19:15' } };
    const { jobs } = planE(s, [mk('2026-11-11')], '2026-11-07T11:00:00Z');
    expect(find(jobs, 'weekly:2026-11-08')).toBe('weekly:2026-11-08|2026-11-07T11:00:00.000Z|2026-11-14T15:00:00.000Z');
    expect(find(jobs, 'day-before:2026-11-11')).toBe('day-before:2026-11-11|2026-11-10T10:15:00.000Z|2026-11-10T15:00:00.000Z');
  });
  it('US-E7-04/AC2 US-E7-05/AC1 RM22 a dismissed key is not shown again after a time change', () => {
    const log: OLog[] = [{ key: 'day-before:2026-11-04', dueAt: '2026-11-03T08:30:00.000Z', shownAt: '2026-11-03T08:30:00.000Z', dismissedAt: '2026-11-03T08:31:00.000Z' }];
    const s: OSettings = { ...DEF, dayBefore: { enabled: true, time: '19:15' } };
    expect(shownKeys(s, [mk('2026-11-04')], '2026-11-03T10:15:00Z', log)).not.toContain('day-before:2026-11-04');
  });
  it('US-E7-05/AC3 RM23 only the latest unexpired weekly shows', () => {
    expect(shownKeys(DEF, [], '2026-11-08T06:00:00Z')).toEqual(['weekly:2026-11-09']);
    expect(planE(DEF, [], '2026-11-08T06:00:00Z').jobs.map((j) => j.key)).toContain('weekly:2026-11-02');
  });
  it('US-E7-01/AC5 RM25 weekly is delivered with no confirmed menu, with a no-menu body', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({ ...mk(oAdd('2026-12-07', i), 'not-confirmed'), hasMenu: false }) as ReminderDay);
    const { jobs } = planE(DEF, days, '2026-12-06T05:00:00Z');
    expect(find(jobs, 'weekly:2026-12-07')).toBe('weekly:2026-12-07|2026-12-06T05:00:00.000Z|2026-12-13T15:00:00.000Z');
    expect(jobs.find((j) => j.key === 'weekly:2026-12-07')!.content.bodyKey.toLowerCase()).toContain('nomenu');
  });
  it('US-E5-08/AC4 RM26 RM27 a planned day reminds, an unplanned no-lunch day does not', () => {
    expect(planE(DEF, [mk('2026-11-20')], '2026-11-19T08:30:00Z').jobs.map((j) => j.key)).toContain('day-before:2026-11-20');
    expect(planE(DEF, [mk('2026-11-20', 'no-school-lunch')], '2026-11-19T08:30:00Z').jobs.map((j) => j.key)).not.toContain('day-before:2026-11-20');
  });
  it('US-E11-02/AC1 RM29 due boundary: not visible one minute before, visible at due', () => {
    expect(shownKeys(noWeekly, [mk('2026-11-04')], '2026-11-03T08:29:00Z')).toEqual([]);
    expect(shownKeys(noWeekly, [mk('2026-11-04')], '2026-11-03T08:30:00Z')).toEqual(['day-before:2026-11-04']);
  });
  it('US-E7-05/AC2 RM30 expiry boundary: visible at 14:59:59.999Z, gone at 15:00:00.000Z', () => {
    expect(shownKeys(noWeekly, [mk('2026-11-04')], '2026-11-03T14:59:59.999Z')).toEqual(['day-before:2026-11-04']);
    expect(shownKeys(noWeekly, [mk('2026-11-04')], '2026-11-03T15:00:00.000Z')).toEqual([]);
  });
  it('US-E7-05/AC2 RM17 RM18 a missed reminder shows on open with its original time, an expired one never', () => {
    const { jobs } = planE(noWeekly, [mk('2026-11-04')], '2026-11-03T12:00:00Z');
    const v = visibleReminders(jobs, [], at('2026-11-03T12:00:00Z'));
    expect(v.map((x) => [x.job.key, new Date(x.labelAt).toISOString()])).toEqual([['day-before:2026-11-04', '2026-11-03T08:30:00.000Z']]);
    expect(shownKeys(noWeekly, [mk('2026-11-04')], '2026-11-03T22:00:00Z')).toEqual([]);
  });
  it('US-E7-05/AC1 RM19 RM35 dismissed stays hidden at any instant, also with the clock moved back', () => {
    const log: OLog[] = [{ key: 'day-before:2026-11-04', dueAt: '2026-11-03T08:30:00.000Z', shownAt: '2026-11-03T08:30:00.000Z', dismissedAt: '2026-11-03T08:31:00.000Z' }];
    for (const now of ['2026-11-03T08:45:00Z', '2026-11-03T08:30:00Z', '2026-11-03T10:00:00Z']) {
      expect(shownKeys(noWeekly, [mk('2026-11-04')], now, log), now).toEqual([]);
    }
  });
  it('US-E7-05/AC1 RM42 RM43 shown but undismissed shows again until expiry, also after a time change', () => {
    const log: OLog[] = [{ key: 'day-before:2026-11-04', dueAt: '2026-11-03T08:30:00.000Z', shownAt: '2026-11-03T08:30:00.000Z' }];
    const { jobs } = planE(noWeekly, [mk('2026-11-04')], '2026-11-03T10:00:00Z', log);
    expect(visibleReminders(jobs, log as never, at('2026-11-03T10:00:00Z')).map((v) => [v.job.key, new Date(v.labelAt).toISOString()])).toEqual([['day-before:2026-11-04', '2026-11-03T08:30:00.000Z']]);
    expect(shownKeys(noWeekly, [mk('2026-11-04')], '2026-11-03T22:00:00Z', log)).toEqual([]);
    const moved: OSettings = { ...noWeekly, dayBefore: { enabled: true, time: '19:15' } };
    expect(shownKeys(moved, [mk('2026-11-04')], '2026-11-03T09:30:00Z', log)).toEqual(['day-before:2026-11-04']);
  });
  it('US-E7-07/AC3 RM31 the planner result is identical under four device timezones', () => {
    const run = () => sig(planE(DEF, [mk('2026-11-04'), mk('2026-11-12')], '2026-11-03T03:00:00Z').jobs);
    const orig = process.env.TZ;
    const outs: string[][] = [];
    const offsets: number[] = [];
    try {
      for (const tz of ['Asia/Tokyo', 'Europe/Paris', 'America/Los_Angeles', 'Pacific/Auckland']) {
        process.env.TZ = tz;
        offsets.push(new Date('2026-11-03T03:00:00Z').getTimezoneOffset());
        outs.push(run());
      }
    } finally {
      if (orig === undefined) delete process.env.TZ;
      else process.env.TZ = orig;
    }
    expect(new Set(offsets).size, 'TZ switching must take effect for the test to mean anything').toBeGreaterThan(1);
    for (const o of outs) expect(o).toEqual(outs[0]);
  });
});

describe('QA RM store-level: planRemindersForStore through the real day viewer', () => {
  const view = createDayViewer(dict);
  const store = (plannedAt: string, state: 'homemade-bento-planned' | 'school-lunch-planned' = 'homemade-bento-planned') =>
    storeWith({ menus: [menu([day('2026-11-04', ['ご飯', '鶏の照り焼き']), day('2026-11-05', ['パン'])])], decisions: [decisionRecord('2026-11-04', state, { plannedAt })] });
  it('US-E7-02/AC1 RM01 a planned school day gets day-before:2026-11-04 at the contract instants', () => {
    const { jobs } = planRemindersForStore(store('2026-11-01T10:12:00+09:00'), view, at('2026-11-03T08:30:00Z'));
    expect(find(jobs, 'day-before:2026-11-04')).toBe('day-before:2026-11-04|2026-11-03T08:30:00.000Z|2026-11-03T15:00:00.000Z');
    expect(jobs.map((j) => j.key)).not.toContain('day-before:2026-11-05');
  });
  it('US-E7-02/AC5 RM36 equality creates, one millisecond later suppresses (through the store)', () => {
    const eq = planRemindersForStore(store('2026-11-03T17:30:00+09:00'), view, at('2026-11-03T08:30:00Z')).jobs.map((j) => j.key);
    const late = planRemindersForStore(store('2026-11-03T17:30:00.001+09:00'), view, at('2026-11-03T08:30:01Z')).jobs.map((j) => j.key);
    expect(eq).toContain('day-before:2026-11-04');
    expect(late).not.toContain('day-before:2026-11-04');
  });
  it('US-E7-02/AC6 RM14 a day back at school lunch has no day-before', () => {
    const { jobs } = planRemindersForStore(store('2026-11-01T10:12:00+09:00', 'school-lunch-planned'), view, at('2026-11-03T08:30:00Z'));
    expect(jobs.map((j) => j.key)).not.toContain('day-before:2026-11-04');
  });
});

describe('QA RP properties and random oracle comparison', () => {
  function gen(seed: number, n: number) {
    const rnd = new Prng(seed);
    const cases: { s: OSettings; days: ODay[]; now: number; log: OLog[] }[] = [];
    const hm = () => `${String(rnd.int(0, 23)).padStart(2, '0')}:${['00', '15', '30', '45'][rnd.int(0, 3)]}`;
    for (let i = 0; i < n; i += 1) {
      const lo = Date.parse('2026-10-01T00:00:00Z');
      const hi = Date.parse('2028-03-31T00:00:00Z');
      let now = lo + Math.floor(rnd.next() * (hi - lo));
      const s: OSettings = { weekly: { enabled: rnd.chance(0.85), weekday: rnd.int(0, 6), time: hm() }, dayBefore: { enabled: rnd.chance(0.85), time: hm() } };
      const today = oToday(now);
      const days: ODay[] = [];
      const count = rnd.int(0, 10);
      for (let k = 0; k < count; k += 1) {
        const date = oAdd(today, rnd.int(-3, 14));
        if (days.some((x) => x.date === date)) continue;
        const state = rnd.pick(['homemade-bento-planned', 'homemade-bento-planned', 'school-lunch-planned', 'not-confirmed', 'no-school-lunch', null] as const);
        const dueGuess = Date.parse(`${oAdd(date, -1)}T08:30:00Z`);
        const plannedAt = rnd.chance(0.5) ? undefined : dueGuess + rnd.pick([-86_400_000, -1, 0, 1, 3_600_000, 86_400_000]) + (rnd.chance(0.3) ? rnd.int(-1_800_000, 1_800_000) : 0);
        days.push({ date, state, plannedAt });
      }
      const log: OLog[] = [];
      for (const j of oPlan(s, days, now, [])) {
        if (!rnd.chance(0.3)) continue;
        const e: OLog = { key: j.key, dueAt: new Date(j.due + rnd.pick([0, 0, 900_000])).toISOString() };
        if (rnd.chance(0.8)) e.shownAt = new Date(j.due).toISOString();
        if (rnd.chance(0.4)) e.dismissedAt = new Date(j.due + 60_000).toISOString();
        log.push(e);
      }
      const jobs = oPlan(s, days, now, log);
      if (jobs.length > 0 && rnd.chance(0.3)) {
        const j = rnd.pick(jobs);
        now = rnd.pick([j.due - 1, j.due, j.due + 1, j.expires - 1, j.expires]);
      }
      cases.push({ s, days, now, log });
    }
    return cases;
  }
  const toEngineDays = (days: ODay[]): ReminderDay[] =>
    days.map((x) => ({ date: d(x.date), state: x.state, plannedAt: x.plannedAt as Instant | undefined, conflict: false, needsAck: false, lowPreference: false, hasMenu: true }) as ReminderDay);
  for (const seed of [20261024, 1, 2027, 424242, 99]) {
    it(`US-E7-01/AC1 US-E7-02/AC1 US-E7-05/AC3 RP5 seed ${seed}: 1000 random states, plan, visible and diff equal the oracle`, () => {
      let diffs = 0;
      for (const c of gen(seed, 1000)) {
        const engine = planReminders({ settings: c.s as never, days: toEngineDays(c.days), now: c.now as Instant, log: c.log as never });
        const oracle = oPlan(c.s, c.days, c.now, c.log);
        const a = engine.jobs.map((j) => `${j.key}|${j.type}|${j.dueAt}|${j.expiresAt}`);
        const b = oracle.map((j) => `${j.key}|${j.type}|${j.due}|${j.expires}`);
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          diffs += 1;
          if (diffs === 1) expect(a, `plan, seed ${seed}, case ${JSON.stringify(c)}`).toEqual(b);
        }
        const vis = visibleReminders(engine.jobs, c.log as never, c.now as Instant).map((v) => `${v.job.key}|${v.labelAt}`);
        const ovis = oVisible(oracle, c.log, c.now).map((v) => `${v.key}|${v.label}`);
        if (JSON.stringify(vis) !== JSON.stringify(ovis)) {
          diffs += 1;
          if (diffs === 1) expect(vis, `visible, seed ${seed}, case ${JSON.stringify(c)}`).toEqual(ovis);
        }
        expect(new Set(engine.jobs.map((j) => j.key)).size).toBe(engine.jobs.length);
        for (const j of engine.jobs) {
          expect(j.expiresAt).toBeGreaterThan(j.dueAt);
          expect(j.expiresAt).toBeGreaterThan(c.now);
        }
        const again = planReminders({ settings: c.s as never, days: toEngineDays(c.days), now: c.now as Instant, log: c.log as never, previous: engine.jobs.map((j) => ({ key: j.key, contentHash: j.contentHash })) });
        expect(again.diff).toEqual({ remove: [], upsert: [] });
        expect(again.jobs.map((j) => j.key)).toEqual(engine.jobs.map((j) => j.key));
      }
      expect(diffs).toBe(0);
    });
  }
  it('US-E7-07/AC1 RP4 random states under four device timezones give identical plans', () => {
    const cases = gen(777, 150);
    const run = () => cases.map((c) => JSON.stringify(planReminders({ settings: c.s as never, days: toEngineDays(c.days), now: c.now as Instant, log: c.log as never }).jobs.map((j) => [j.key, j.dueAt, j.expiresAt])));
    const orig = process.env.TZ;
    try {
      process.env.TZ = 'Asia/Tokyo';
      const base = run();
      for (const tz of ['Europe/Paris', 'America/Los_Angeles', 'Pacific/Auckland']) {
        process.env.TZ = tz;
        expect(run(), tz).toEqual(base);
      }
    } finally {
      if (orig === undefined) delete process.env.TZ;
      else process.env.TZ = orig;
    }
  });
  it('US-E7-04/AC2 diffSchedule: unchanged hash skipped, changed hash upserted, missing key removed', () => {
    const { jobs } = planE(DEF, [mk('2026-11-04')], '2026-11-02T01:00:00Z');
    expect(jobs.length).toBeGreaterThan(1);
    const a = jobs[0]!;
    const b = jobs[1]!;
    const diff = diffSchedule([{ key: a.key, contentHash: a.contentHash }, { key: b.key, contentHash: 'stale' }, { key: 'weekly:2000-01-03', contentHash: 'x' }], jobs);
    expect(diff.remove).toEqual(['weekly:2000-01-03']);
    expect(diff.upsert.map((j) => j.key)).not.toContain(a.key);
    expect(diff.upsert.map((j) => j.key)).toContain(b.key);
    expect(diff.upsert.length).toBe(jobs.length - 1);
    expect(diffSchedule([], jobs).upsert.length).toBe(jobs.length);
  });
  it('US-E7-04/AC2 a settings change re-plans the due instant of the same key', () => {
    const a = planE(DEF, [mk('2026-11-04')], '2026-11-02T01:00:00Z').jobs.find((j) => j.key === 'day-before:2026-11-04')!;
    const b = planE({ ...DEF, dayBefore: { enabled: true, time: '19:15' } }, [mk('2026-11-04')], '2026-11-02T01:00:00Z').jobs.find((j) => j.key === 'day-before:2026-11-04')!;
    expect(new Date(b.dueAt).toISOString()).toBe('2026-11-03T10:15:00.000Z');
    expect(b.expiresAt).toBe(a.expiresAt);
    expect(b.contentHash).not.toBe(a.contentHash);
  });
});
