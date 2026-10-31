// Recipe ranking engine (US-E6-01, US-E6-02) against the SYNTHETIC fixture library (tests/oracle/ranking-oracle.md §2, §3).
// Fixtures are hand-computed by the oracle; nothing here reads live data except where it asserts properties.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRanker, type PlannedDecision, type RankProfile } from '../../../../src/domain/recommend/rank.ts';
import type { Recipe } from '../../../../src/domain/schema/recipe.ts';
import type { Dictionary } from '../../../../src/domain/schema/dictionary.ts';
import { localDate } from '../../../../src/domain/time/jst.ts';

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../../../../${p}`, import.meta.url), 'utf8')) as T;
const dict = read<Dictionary>('data/dictionary.json');
const lib = read<Recipe[]>('tests/fixtures/recipes/synthetic-library.json');
const dietLib = read<Recipe[]>('tests/fixtures/recipes/synthetic-library-diet.json');
const rank = createRanker(dict, lib);
const rankDiet = createRanker(dict, dietLib);

const keyOf = (id: string): string => id.replace('rcp-syn-', '').split('-')[0]!.toUpperCase();
const keys = (xs: { recipeId: string }[]): string => xs.map((x) => keyOf(x.recipeId)).join('');
const alg = (...xs: string[]) => xs.map((x) => `alg-${x}`);
const base: RankProfile = { likedIds: [], dislikedIds: [], knownAllergenIds: [], excludedIngredientIds: [], diet: [], themeIds: [] };
const T = localDate('2026-11-18');
const planned = (recipeKey: string, date: string): PlannedDecision => ({
  date: localDate(date),
  state: 'homemade-bento-planned',
  recipeId: lib.find((r) => keyOf(r.id) === recipeKey)!.id,
});

const k1: RankProfile = {
  ...base,
  likedIds: ['ing-chicken', 'ing-egg', 'ing-corn'],
  dislikedIds: ['ing-green-pepper', 'ing-eggplant', 'cat-fish'],
  knownAllergenIds: alg('shrimp'),
  themeIds: ['theme-animals'],
};
const allKnown = dict.allergens.filter((a) => !('retired' in a && a.retired === true)).map((a) => a.id);

interface Case {
  name: string;
  profile: RankProfile;
  decisions?: PlannedDecision[];
  top: string;
  full: string;
  ac: string;
}
const cases: Case[] = [
  { name: 'K1 sample child', profile: k1, top: 'EAB', full: 'EABFDKLJHCG', ac: 'US-E6-01/AC1' },
  { name: 'K2 neutral', profile: base, top: 'DEK', full: 'DEKLAJCGHBFIM', ac: 'US-E6-01/AC1' },
  { name: 'K3 egg known', profile: { ...base, knownAllergenIds: alg('egg'), likedIds: ['ing-chicken'], themeIds: ['theme-animals'] }, top: 'BEK', full: 'BEKCGH', ac: 'US-E6-02/AC1' },
  { name: 'K4 milk only (may-contain)', profile: { ...base, knownAllergenIds: alg('milk') }, top: 'EKL', full: 'EKLACGHBF', ac: 'US-E6-02/AC1' },
  { name: 'K5 pork (possibleAllergenIds)', profile: { ...base, knownAllergenIds: alg('pork'), likedIds: ['ing-egg'] }, top: 'AIE', full: 'AIEKLCGB', ac: 'US-E6-02/AC4' },
  { name: 'K6 wheat+soybean', profile: { ...base, knownAllergenIds: alg('wheat', 'soybean'), dislikedIds: ['ing-spinach'] }, top: 'EKC', full: 'EKCA', ac: 'US-E6-02/AC4' },
  { name: 'K7 all allergens known', profile: { ...base, knownAllergenIds: allKnown }, top: 'E', full: 'E', ac: 'US-E6-01/AC4' },
  { name: 'K8 exactly two', profile: { ...base, knownAllergenIds: alg('egg', 'wheat', 'salmon') }, top: 'EK', full: 'EK', ac: 'US-E6-01/AC4' },
  { name: 'K9 none (empty state)', profile: { ...base, diet: ['vegetarian'], knownAllergenIds: alg('egg', 'soybean'), excludedIngredientIds: ['ing-corn'] }, top: '', full: '', ac: 'US-E6-01/AC5' },
  { name: 'K10 child id exclusion', profile: { ...base, likedIds: ['cat-meat'], excludedIngredientIds: ['ing-tomato'] }, top: 'JHB', full: 'JHBFEKLACGIM', ac: 'US-E6-02/AC2' },
  { name: 'K11 no-pork + no-beef', profile: { ...base, diet: ['no-pork', 'no-beef'], likedIds: ['ing-salmon'], themeIds: ['theme-sea'] }, top: 'CEL', full: 'CELAB', ac: 'US-E6-02/AC7' },
  { name: 'K12 vegetarian', profile: { ...base, diet: ['vegetarian'], likedIds: ['ing-carrot'], dislikedIds: ['ing-green-pepper'] }, top: 'EA', full: 'EA', ac: 'US-E6-02/AC8' },
  { name: 'K13 variety at 14 days before', profile: k1, decisions: [planned('E', '2026-11-04')], top: 'ABF', full: 'ABFDEKLJHCG', ac: 'US-E6-01/AC3' },
  { name: 'K14 variety outside window (15 days)', profile: k1, decisions: [planned('E', '2026-11-03')], top: 'EAB', full: 'EABFDKLJHCG', ac: 'US-E6-01/AC3' },
  { name: 'K15 same date is not "other"', profile: k1, decisions: [planned('E', '2026-11-18')], top: 'EAB', full: 'EABFDKLJHCG', ac: 'US-E6-01/AC3' },
  { name: 'K16 14 days after, not cumulative', profile: k1, decisions: [planned('E', '2026-12-02'), planned('E', '2026-11-11')], top: 'ABF', full: 'ABFDEKLJHCG', ac: 'US-E6-01/AC3' },
  { name: 'K17 unknown allergy, theme', profile: { ...base, themeIds: ['theme-vehicles'] }, top: 'DLE', full: 'DLEKAJCGHBFIM', ac: 'US-E6-02/AC5' },
  { name: 'K18 distinct found ids (B1)', profile: { ...base, likedIds: ['cat-grain'] }, top: 'IBD', full: 'IBDEKLAJCGHFM', ac: 'US-E6-01/AC1' },
  { name: 'K19 category exclusion, dislike keeps listed', profile: { ...base, excludedIngredientIds: ['cat-seafood'], dislikedIds: ['cat-dairy'] }, top: 'DEK', full: 'DEKLACGHBFJM', ac: 'US-E6-02/AC2' },
  { name: 'K20 vegetarian, carrot excluded', profile: { ...base, diet: ['vegetarian'], excludedIngredientIds: ['ing-carrot'], likedIds: ['ing-corn'] }, top: 'A', full: 'A', ac: 'US-E6-01/AC4' },
  { name: 'K21 incomplete ranks last despite top score', profile: { ...base, likedIds: ['ing-corn', 'ing-potato'], themeIds: ['theme-animals'] }, top: 'EDK', full: 'EDKLAJCGHBFIM', ac: 'US-E6-02/AC5' },
  { name: 'K22 incomplete excluded with known allergen', profile: { ...base, likedIds: ['ing-corn', 'ing-potato'], themeIds: ['theme-animals'], knownAllergenIds: alg('shrimp') }, top: 'EDK', full: 'EDKLAJCGHBF', ac: 'US-E6-02/AC6' },
  { name: 'K23 most specific entry wins (B2)', profile: { ...base, likedIds: ['cat-grain'], dislikedIds: ['ing-rice'] }, top: 'DJF', full: 'DJFIBEKLACGHM', ac: 'US-E6-01/AC1' },
];

describe('ranking oracle cases K1-K23 on the synthetic library', () => {
  for (const c of cases) {
    it(`${c.name} (${c.ac})`, () => {
      const r = rank({ profile: c.profile, decisions: c.decisions ?? [], targetDate: T });
      expect(keys(r.suggestions)).toBe(c.top);
      expect(keys(r.all)).toBe(c.full);
      expect(r.excluded.length + r.all.length).toBe(lib.length);
    });
  }
});

describe('scores (US-E6-01/AC1, AC3)', () => {
  const scoreOf = (profile: RankProfile, key: string, decisions: PlannedDecision[] = []) =>
    rank({ profile, decisions, targetDate: T }).all.find((x) => keyOf(x.recipeId) === key)!.score;
  it('US-E6-01/AC1 K1 scores', () => {
    const expected: Record<string, number> = { A: 2, B: 2, C: -3, D: 0, E: 2, F: 1, G: -3, H: 0, J: 0, K: 0, L: 0 };
    for (const [k, v] of Object.entries(expected)) expect(scoreOf(k1, k), k).toBe(v);
  });
  it('US-E6-01/AC3 a recipe planned 7 days later loses 2 and ranks below an otherwise equal one', () => {
    const r = rank({ profile: base, decisions: [planned('E', '2026-11-11')], targetDate: T });
    const e = r.all.find((x) => keyOf(x.recipeId) === 'E')!;
    const k = r.all.find((x) => keyOf(x.recipeId) === 'K')!;
    expect(e.score).toBe(-2);
    expect(r.all.indexOf(e)).toBeGreaterThan(r.all.indexOf(k));
  });
  it('US-E6-01/AC3 only homemade-bento-planned decisions count', () => {
    const r = rank({ profile: base, decisions: [{ ...planned('E', '2026-11-11'), state: 'school-lunch-planned' }], targetDate: T });
    expect(r.all.find((x) => keyOf(x.recipeId) === 'E')!.score).toBe(0);
  });
});

describe('exclusion reasons (US-E6-02)', () => {
  const reasonsOf = (profile: RankProfile, key: string, r = rank) =>
    r({ profile, decisions: [], targetDate: T }).excluded.find((x) => keyOf(x.recipeId) === key)?.reasons;
  it('US-E6-02/AC1 allergen reason lists the matching ids, including may-contain', () => {
    expect(reasonsOf({ ...base, knownAllergenIds: alg('milk') }, 'D')).toEqual([{ kind: 'allergen', allergenIds: alg('milk') }]);
  });
  it('US-E6-02/AC2 excluded ingredient reason names the profile entry', () => {
    expect(reasonsOf({ ...base, excludedIngredientIds: ['ing-tomato'] }, 'D')).toEqual([{ kind: 'excluded-ingredient', ids: ['ing-tomato'] }]);
  });
  it('US-E6-02/AC6 incomplete allergen data is excluded with a known allergen', () => {
    expect(reasonsOf({ ...base, knownAllergenIds: alg('shrimp') }, 'M')).toEqual([{ kind: 'allergen-incomplete' }]);
  });
  it('US-E6-02/AC5 incomplete allergen data is not excluded by exclusions alone', () => {
    expect(reasonsOf({ ...base, excludedIngredientIds: ['ing-tomato'] }, 'M')).toBeUndefined();
  });
  it('US-E6-02/AC8 both diet reasons are reported together (vegetarian, curry)', () => {
    const r = reasonsOf({ ...base, diet: ['vegetarian'] }, 'M')!;
    expect(r.map((x) => x.kind).sort()).toEqual(['diet', 'diet-incomplete']);
  });
  it('US-E6-02/AC8 no diet selected: unknown origin does not exclude', () => {
    expect(reasonsOf(base, 'D')).toBeUndefined();
  });
});

describe('hidden animal sources H1-H7 (US-E6-02/AC7, AC8)', () => {
  const run = (diet: RankProfile['diet']) => rankDiet({ profile: { ...base, diet }, decisions: [], targetDate: T });
  const cases2: [string, RankProfile['diet'], string][] = [
    ['H1', ['vegetarian'], 'N7N6'],
    ['H2', ['pescatarian'], 'N2N7N6'],
    ['H3', ['no-pork'], 'N2N7N6'],
    ['H4', ['no-beef'], 'N2N7N6'],
    ['H5', ['no-seafood'], 'N5N7N3N6'],
    ['H6', ['no-pork', 'no-beef'], 'N2N7N6'],
    ['H7', [], 'N1N2N5N7N3N4N6'],
  ];
  for (const [name, diet, order] of cases2) {
    it(`US-E6-02/AC7 ${name} order`, () => {
      expect(
        run(diet)
          .all.map((x) => keyOf(x.recipeId))
          .join(''),
      ).toBe(order);
    });
  }
  it('US-E6-02/AC8 unknown-origin recipes are excluded for any diet, not flagged without one', () => {
    for (const d of ['vegetarian', 'pescatarian', 'no-pork', 'no-beef', 'no-seafood'] as const) {
      const ex = run([d]).excluded.filter((x) => x.reasons.some((r) => r.kind === 'diet-incomplete')).map((x) => keyOf(x.recipeId));
      expect(ex.sort()).toEqual(['N1', 'N4']);
    }
    expect(run([]).all.every((x) => x.complete)).toBe(true);
  });
});

describe('result shape and cards (US-E6-01, US-E6-02)', () => {
  it('US-E6-01/AC1 repeating the request returns the same list', () => {
    const a = rank({ profile: k1, decisions: [], targetDate: T });
    for (let i = 0; i < 20; i += 1) expect(keys(rank({ profile: k1, decisions: [], targetDate: T }).all)).toBe(keys(a.all));
  });
  it('US-E6-01/AC1 library order does not change the result', () => {
    const rev = createRanker(dict, [...lib].reverse());
    expect(keys(rev({ profile: k1, decisions: [], targetDate: T }).all)).toBe('EABFDKLJHCG');
  });
  it('US-E6-01/AC2 at most 2 reasons per card, liked foods first', () => {
    const r = rank({ profile: k1, decisions: [], targetDate: T });
    for (const s of r.all) expect(s.reasons.length).toBeLessThanOrEqual(2);
    const e = r.all.find((x) => keyOf(x.recipeId) === 'E')!;
    expect(e.reasons[0]).toEqual({ key: 'rank.liked', params: { id: 'ing-corn' } });
  });
  it('US-E6-01/AC7 the quick reason follows the 20-minute rule', () => {
    const r = rank({ profile: base, decisions: [], targetDate: T });
    const quick = (k: string) => r.all.find((x) => keyOf(x.recipeId) === k)!.reasons.some((x) => x.key === 'rank.quick');
    expect(quick('C')).toBe(true); // 20 min
    expect(quick('B')).toBe(false); // 25 min
    expect(quick('I')).toBe(false);
  });
  it('US-E6-02/AC4 varies-by-product recipes carry the check-label flag', () => {
    const r = rank({ profile: base, decisions: [], targetDate: T });
    expect(r.all.find((x) => keyOf(x.recipeId) === 'B')!.checkLabel).toBe(true);
    expect(r.all.find((x) => keyOf(x.recipeId) === 'E')!.checkLabel).toBe(false);
  });
  it('US-E6-02/AC5 incomplete recipes are flagged complete=false and last', () => {
    const r = rank({ profile: { ...base, likedIds: ['ing-corn', 'ing-potato'] }, decisions: [], targetDate: T });
    expect(r.all.at(-1)!.complete).toBe(false);
    expect(r.all.at(-1)!.score).toBeGreaterThan(r.all[0]!.score - 1);
  });
});

describe('synthetic fixtures are test-only', () => {
  it('every record is marked synthetic', () => {
    for (const r of [...lib, ...dietLib]) expect((r as Recipe & { synthetic?: boolean }).synthetic).toBe(true);
  });
  it('the tags in the fixtures match the pinned table', () => {
    const pin = read<{ animalOrigin: Record<string, string[]> }>('tests/fixtures/recipes/diet-tags-pinned.json').animalOrigin;
    for (const r of [...lib, ...dietLib]) for (const i of r.ingredients) expect(i.animalOrigin).toEqual(pin[i.ingredientId] ?? []);
  });
});
