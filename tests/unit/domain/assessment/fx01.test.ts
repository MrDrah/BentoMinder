// The sample child on the synthetic November menu FX-01 (tests/fixtures/menus/fixture-menu-2026-11/README.md):
// "7 likely, 5 low, 5 mixed, 2 no-lunch" (US-E5-04/AC1). An end-to-end check of the matcher,
// the counting and the rule table on a whole month rather than single hand-made days.
import { describe, expect, it } from 'vitest';
import { createAssessor } from '../../../../src/domain/assessment/assess.ts';
import { createDayViewer } from '../../../../src/domain/calendar/day-view.ts';
import { datesOfMonth, type LocalDate, type YearMonth } from '../../../../src/domain/time/jst.ts';
import { loadFixture } from '../../helpers/fixtures.ts';
import { dict, menu, PS, storeWith } from '../../helpers/menus.ts';
import type { ExtractedMenu } from '../../../../src/domain/schema/index.ts';

const key = loadFixture<{ menu: ExtractedMenu }>('menus/fixture-menu-2026-11/answer-key.json').menu;
const confirmed = menu(key.days, key.noLunchDays);
const assess = createAssessor(dict);
const dates = datesOfMonth('2026-11' as YearMonth);

describe('FX-01 with the sample child', () => {
  const states = dates.map((date) => ({ date, a: assess({ date, menu: confirmed, profile: PS }) })).filter((x) => x.a !== null);

  it('US-E5-04/AC1 the month has 7 likely-enjoyable, 5 low-preference, 5 mixed-uncertain and 2 no-school-lunch days; the snack-only Saturday has none', () => {
    const count = (s: string) => states.filter((x) => x.a?.state === s).length;
    expect([count('likely-enjoyable'), count('low-preference'), count('mixed-uncertain'), count('no-school-lunch')]).toEqual([7, 5, 5, 2]);
    expect(states.find((x) => x.date === '2026-11-14')).toBeUndefined();
  });

  it('US-E4-01/AC1 2026-11-04 (ピーマンとなすのみそ炒め) is low-preference with D = 2', () => {
    expect(states.find((x) => x.date === '2026-11-04')?.a).toMatchObject({ state: 'low-preference', explanationParams: { dislikedCount: 2 } });
  });

  it('US-E5-04/AC1 US-E5-04/AC2 immediately after confirming, every school day displays school-lunch-planned and no decision exists', () => {
    const view = createDayViewer(dict);
    const store = storeWith({ profile: PS, menus: [confirmed] });
    const school = dates.map((date) => view(store, date as LocalDate, '2026-11-02' as LocalDate)).filter((v) => v.type.type === 'school');
    expect(school).toHaveLength(17);
    expect(school.every((v) => v.displayed.state === 'school-lunch-planned')).toBe(true);
    expect(Object.keys(store.decisions)).toHaveLength(0);
  });

  it('US-E4-01/AC8 with no likes and no dislikes every school day is not-assessed and the no-lunch days stay no-school-lunch', () => {
    const none = { ...PS, likedIds: [], dislikedIds: [] };
    const all = dates.map((date) => assess({ date, menu: confirmed, profile: none })).filter((a) => a !== null);
    expect(all.filter((a) => a.state === 'not-assessed')).toHaveLength(17);
    expect(all.filter((a) => a.state === 'no-school-lunch')).toHaveLength(2);
  });
});
