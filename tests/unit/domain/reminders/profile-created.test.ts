// M5-D04: a reminder due before the profile was created is never planned or shown, not even as missed (US-E7-05/AC2, BR-17).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createDayViewer, planReminders, planRemindersForStore, visibleReminders, type Instant, type ReminderDay, type Settings } from '../../../../src/domain/index.ts';
import { day, dict, menu, PS, storeWith } from '../../helpers/menus.ts';

const at = (iso: string) => Date.parse(iso) as Instant;
const view = createDayViewer(dict);
const WEEKLY: Settings['reminders'] = { weekly: { enabled: true, weekday: 0, time: '14:00' }, dayBefore: { enabled: false, time: '17:30' } };
const DAYS: ReminderDay[] = [];

describe('reminders before the profile existed', () => {
  const now = at('2026-10-28T01:00:00Z'); // Wed 10-28 10:00 JST; the Sun 10-25 14:00 weekly is past
  const profileAt = (createdAt: string) => storeWith({ profile: { ...PS, createdAt, updatedAt: createdAt }, menus: [menu([day('2026-10-28', ['ごはん'])])] });

  it('US-E7-05/AC2: a profile created at 10:00 on 10-28 does not see the 10-25 weekly, even as missed', () => {
    const s = profileAt('2026-10-28T10:00:00+09:00');
    const jobs = planRemindersForStore(s, view, now).jobs;
    expect(jobs.map((j) => j.key)).not.toContain('weekly:2026-10-26');
    expect(visibleReminders(jobs, [], now)).toEqual([]);
  });

  it('US-E7-05/AC2 BR-17: an existing profile (created before 10-25 14:00) still gets the missed weekly', () => {
    const s = profileAt('2026-10-20T09:00:00+09:00');
    const jobs = planRemindersForStore(s, view, now).jobs;
    expect(visibleReminders(jobs, [], now).map((v) => v.job.key)).toContain('weekly:2026-10-26');
  });

  it('US-E7-05/AC2: due exactly at creation is kept (boundary)', () => {
    const due = at('2026-10-25T05:00:00Z');
    const jobs = planReminders({ settings: WEEKLY, days: DAYS, now, log: [], notBefore: due }).jobs;
    expect(jobs.map((j) => j.key)).toContain('weekly:2026-10-26');
    expect(planReminders({ settings: WEEKLY, days: DAYS, now, log: [], notBefore: (due + 1) as Instant }).jobs.map((j) => j.key)).not.toContain('weekly:2026-10-26');
  });

  it('US-E7-05/AC2: without notBefore nothing changes', () => {
    expect(planReminders({ settings: WEEKLY, days: DAYS, now, log: [] }).jobs.map((j) => j.key)).toContain('weekly:2026-10-26');
  });

  it('US-E7-05/AC2 property: no planned job is due before notBefore; later notBefore never adds jobs', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 * 24 * 60 }), fc.integer({ min: 0, max: 20 * 24 * 60 }), (a, b) => {
        const base = at('2026-10-15T00:00:00Z');
        const [lo, hi] = [a, b].sort((x, y) => x - y).map((m) => (base + m * 60000) as Instant) as [Instant, Instant];
        const early = planReminders({ settings: WEEKLY, days: DAYS, now, log: [], notBefore: lo }).jobs;
        const late = planReminders({ settings: WEEKLY, days: DAYS, now, log: [], notBefore: hi }).jobs;
        expect(late.every((j) => j.dueAt >= hi)).toBe(true);
        expect(late.every((j) => early.some((e) => e.key === j.key))).toBe(true);
      }),
    );
  });
});
