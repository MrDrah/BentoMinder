// Planner fed from the store through the day viewer (US-E7-02, US-E5-05/AC3, B7, BR-17, BR-13).
import { describe, expect, it } from 'vitest';
import { applyDecisionEvent } from '../../../../src/domain/decision/apply.ts';
import { createDayViewer, planRemindersForStore, todayJst, type Instant } from '../../../../src/domain/index.ts';
import type { RecipeRef } from '../../../../src/domain/decision/decision.ts';
import type { BentoMinderStore, DayDecision } from '../../../../src/domain/schema/index.ts';
import { day, decisionRecord, dict, menu, noLunch, PS, storeWith } from '../../helpers/menus.ts';

const view = createDayViewer(dict);
const at = (iso: string) => Date.parse(iso) as Instant;
const R1: RecipeRef = { id: 'rcp-kuma-onigiri', name: { ja: 'くまさんおにぎり弁当', en: 'Bear onigiri bento' }, shortNameJa: 'くまおにぎり', shortNameEn: 'Bear oni' };
const lunch = (date: string) => day(date, ['ごはん', 'ピーマンとなすのみそ炒め']);
const BENTO = (date: string, extra: Partial<DayDecision> = {}) => decisionRecord(date, 'homemade-bento-planned', { plannedAt: '2026-11-02T12:00:00+09:00', ...extra });

function store(decisions: DayDecision[], menuNoLunch = [noLunch('2026-11-20', 'bento-day', 'お弁当の日')]): BentoMinderStore {
  return storeWith({ profile: PS, menus: [menu(['2026-11-04', '2026-11-05', '2026-11-11'].map(lunch), menuNoLunch)], decisions });
}
const keys = (s: BentoMinderStore, now: Instant) => planRemindersForStore(s, view, now).jobs.map((j) => j.key);

describe('reminders from the store', () => {
  const now = at('2026-11-03T08:30:00Z'); // 2026-11-03 17:30 JST

  it('US-E7-02/AC1: a planned day gets a reminder, a not-confirmed day does not (RM06)', () => {
    const s = store([BENTO('2026-11-04'), decisionRecord('2026-11-05', 'not-confirmed')]);
    const k = keys(s, now);
    expect(k).toContain('day-before:2026-11-04');
    expect(k).not.toContain('day-before:2026-11-05');
  });

  it('US-E5-08/AC4: a planned お弁当の日 gets one, an unplanned one does not (RM26, RM27)', () => {
    const n = at('2026-11-19T08:30:00Z');
    expect(keys(store([BENTO('2026-11-20')]), n)).toContain('day-before:2026-11-20');
    expect(keys(store([]), n)).not.toContain('day-before:2026-11-20');
  });

  it('US-E7-02/AC6: confirming then clearing in the same action cancels it, via the decision engine (RM38)', () => {
    const late = at('2026-11-19T08:30:00Z');
    const env = { today: todayJst(late), now: late, recipe: (id: string) => (id === R1.id ? R1 : undefined) };
    const planned = applyDecisionEvent(store([]), '2026-11-20' as never, { type: 'CONFIRM_RECIPE', recipeId: R1.id }, { ...env, now: at('2026-11-02T03:00:00Z') });
    if (!planned.ok) throw new Error(planned.error);
    const first = planRemindersForStore(planned.store, view, late);
    expect(first.jobs.map((j) => j.key)).toContain('day-before:2026-11-20');
    const cleared = applyDecisionEvent(planned.store, '2026-11-20' as never, { type: 'CLEAR_PLAN' }, env);
    if (!cleared.ok) throw new Error(cleared.error);
    expect(planRemindersForStore(cleared.store, view, late, first.jobs).diff.remove).toContain('day-before:2026-11-20');
  });

  it('US-E7-02/AC6: a plan on a date a refresh turned into a no-lunch day keeps its reminder, flagged (RM32, B7)', () => {
    const s = store([BENTO('2026-11-04')], [noLunch('2026-11-04', 'no-lunch')]);
    const job = planRemindersForStore(s, view, now).jobs.find((j) => j.key === 'day-before:2026-11-04');
    expect(job?.content.params['conflict']).toBe(1);
  });

  it('US-E7-01/AC1: the weekly content reflects the displayed decisions and a missing menu month', () => {
    const s = store([BENTO('2026-11-04')]);
    const w = planRemindersForStore(s, view, at('2026-11-01T05:00:00Z')).jobs.find((j) => j.key === 'weekly:2026-11-02');
    expect(w?.content.params['bento']).toEqual(['2026-11-04|くまおにぎり|Bear oni']);
  });

  it('US-E7-05/AC1: planning twice from the store gives an empty diff', () => {
    const s = store([BENTO('2026-11-04'), BENTO('2026-11-11')]);
    const a = planRemindersForStore(s, view, now);
    expect(planRemindersForStore(s, view, now, a.jobs).diff).toEqual({ remove: [], upsert: [] });
  });

  it('BR-21: no child profile data appears in any job', () => {
    const s = store([BENTO('2026-11-04')]);
    const text = JSON.stringify(planRemindersForStore(s, view, now).jobs);
    expect(text).not.toContain(PS.id);
    expect(text).not.toMatch(/dislike|ing-green-pepper|ing-eggplant/);
  });
});
