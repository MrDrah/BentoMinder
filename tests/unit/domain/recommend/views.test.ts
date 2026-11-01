// The lists behind the recommendation, library and plan-date screens (US-E6-03/AC3, US-E6-05/AC1, AC3, AC4).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDayViewer } from '../../../../src/domain/calendar/day-view.ts';
import { createRanker } from '../../../../src/domain/recommend/rank.ts';
import { allergenSummary, libraryOrder, plannableDates } from '../../../../src/domain/recommend/views.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/index.ts';
import type { Dictionary } from '../../../../src/domain/schema/dictionary.ts';
import type { Recipe } from '../../../../src/domain/schema/recipe.ts';
import { localDate } from '../../../../src/domain/time/jst.ts';

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../../../../${p}`, import.meta.url), 'utf8')) as T;
const dict = read<Dictionary>('data/dictionary.json');
const library = read<Recipe[]>('tests/fixtures/recipes/synthetic-library.json');
const store = read<BentoMinderStore>('tests/fixtures/state/m2-november.json');
const view = createDayViewer(dict);
const recipe = (id: string) => library.find((r) => r.id === id) as Recipe;

describe('US-E6-03/AC3 allergen summary', () => {
  it('US-E6-03/AC3 no allergen and nothing varies by product: the careful "none used" wording applies', () => {
    expect(allergenSummary(recipe('rcp-syn-e-veggie'))).toEqual({ allergenIds: [], varies: false, none: true });
  });

  it('US-E6-03/AC3 a varies-by-product ingredient is never "none"', () => {
    const s = allergenSummary(recipe('rcp-syn-b-karaage'));
    expect(s.varies).toBe(true);
    expect(s.none).toBe(false);
  });
});

describe('US-E6-05/AC1 library order', () => {
  const rank = createRanker(dict, library);
  const result = rank({ profile: store.profile as NonNullable<typeof store.profile>, decisions: [], targetDate: localDate('2026-11-12') });
  const { plannable, blocked } = libraryOrder(result);

  it('US-E6-05/AC1 every library recipe appears exactly once: plannable first by name, blocked after with reasons', () => {
    expect([...plannable.map((r) => r.id), ...blocked.map((b) => b.recipeId)].sort()).toEqual(library.map((r) => r.id).sort());
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((b) => b.reasons.length > 0)).toBe(true);
    const kana = plannable.map((r) => r.nameKana);
    expect(kana).toEqual([...kana].sort());
  });

  it('US-E6-05/AC1 the order does not depend on the input order of the library', () => {
    const reversed = createRanker(dict, [...library].reverse())({ profile: store.profile as NonNullable<typeof store.profile>, decisions: [], targetDate: localDate('2026-11-12') });
    expect(libraryOrder(reversed).plannable.map((r) => r.id)).toEqual(plannable.map((r) => r.id));
  });
});

describe('US-E6-05/AC3 plannable dates', () => {
  it('US-E6-05/AC3 school days and お弁当の日 from today on, in date order; no past, no no-lunch day, no day outside the menu', () => {
    const dates = plannableDates(store, localDate('2026-11-10'), view).map((d) => d.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates[0]).toBe('2026-11-10');
    expect(dates).toContain('2026-11-20');
    expect(dates).not.toContain('2026-11-27');
    expect(dates).not.toContain('2026-11-07');
    expect(dates.every((d) => d >= '2026-11-10')).toBe(true);
  });

  it('US-E6-05/AC3 each date carries its current decision; a planned day is offered for a recipe change', () => {
    const list = plannableDates(store, localDate('2026-11-02'), view);
    expect(list.find((d) => d.date === '2026-11-04')?.state).toBe('homemade-bento-planned');
    expect(list.find((d) => d.date === '2026-11-12')?.state).toBe('school-lunch-planned');
  });

  it('US-E6-05/AC3 a day in an open refresh conflict is not offered (the planned day is now a no-lunch day)', () => {
    const s = structuredClone(store);
    const menu = s.menus['2026-11']?.confirmed;
    if (menu === undefined || menu === null) throw new Error('fixture');
    const day = menu.days.find((d) => d.date === '2026-11-04');
    menu.days = menu.days.filter((d) => d.date !== '2026-11-04');
    menu.noLunchDays = [...menu.noLunchDays, { date: '2026-11-04', reason: 'no-lunch', originalText: '休園', verification: { status: 'verified' } } as never];
    menu.noLunchDays.sort((a, b) => (a.date < b.date ? -1 : 1));
    expect(day).toBeDefined();
    expect(plannableDates(s, localDate('2026-11-02'), view).map((d) => d.date)).not.toContain('2026-11-04');
  });

  it('US-E6-05/AC4 no confirmed menu from today on: nothing is offered', () => {
    expect(plannableDates(store, localDate('2026-12-20'), view)).toEqual([]);
    expect(plannableDates({ ...store, menus: {} }, localDate('2026-11-02'), view)).toEqual([]);
  });
});
