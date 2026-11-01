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
const procLib = read<Recipe[]>('tests/fixtures/recipes/synthetic-library-processed.json');
const rankProc = createRanker(dict, procLib);

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
  { name: 'K1 sample child', profile: k1, top: 'MEA', full: 'MEABFDKLJHCG', ac: 'US-E6-01/AC1' },
  { name: 'K2 neutral', profile: base, top: 'DEK', full: 'DEKLAJMCGHBFI', ac: 'US-E6-01/AC1' },
  { name: 'K3 egg known', profile: { ...base, knownAllergenIds: alg('egg'), likedIds: ['ing-chicken'], themeIds: ['theme-animals'] }, top: 'BMD', full: 'BMDEKLJCGH', ac: 'US-E6-02/AC9' },
  { name: 'K4 milk only (may-contain is not read)', profile: { ...base, knownAllergenIds: alg('milk') }, top: 'DEK', full: 'DEKLAMCGHBFI', ac: 'US-E6-02/AC13' },
  { name: 'K5 pork (possibleAllergenIds)', profile: { ...base, knownAllergenIds: alg('pork'), likedIds: ['ing-egg'] }, top: 'AID', full: 'AIDEKLJMCGB', ac: 'US-E6-02/AC13' },
  { name: 'K6 wheat+soybean', profile: { ...base, knownAllergenIds: alg('wheat', 'soybean'), dislikedIds: ['ing-spinach'] }, top: 'DEK', full: 'DEKLMCHFA', ac: 'US-E6-02/AC10' },
  { name: 'K7 all allergens known', profile: { ...base, knownAllergenIds: allKnown }, top: 'DEM', full: 'DEM', ac: 'US-E6-01/AC4' },
  { name: 'K8 exactly two', profile: { ...base, knownAllergenIds: alg('egg', 'wheat', 'salmon') }, top: 'DEK', full: 'DEKMGH', ac: 'US-E6-01/AC4' },
  { name: 'K9 none (empty state)', profile: { ...base, diet: ['vegetarian'], knownAllergenIds: alg('egg', 'soybean'), excludedIngredientIds: ['ing-corn'] }, top: '', full: '', ac: 'US-E6-01/AC5' },
  { name: 'K10 child id exclusion', profile: { ...base, likedIds: ['cat-meat'], excludedIngredientIds: ['ing-tomato'] }, top: 'JHB', full: 'JHBFEKLAMCGI', ac: 'US-E6-02/AC2' },
  { name: 'K11 no-pork + no-beef', profile: { ...base, diet: ['no-pork', 'no-beef'], likedIds: ['ing-salmon'], themeIds: ['theme-sea'] }, top: 'CEL', full: 'CELAB', ac: 'US-E6-02/AC7' },
  { name: 'K12 vegetarian', profile: { ...base, diet: ['vegetarian'], likedIds: ['ing-carrot'], dislikedIds: ['ing-green-pepper'] }, top: 'EA', full: 'EA', ac: 'US-E6-02/AC8' },
  { name: 'K13 variety at 14 days before', profile: k1, decisions: [planned('E', '2026-11-04')], top: 'MAB', full: 'MABFDEKLJHCG', ac: 'US-E6-01/AC3' },
  { name: 'K14 variety outside window (15 days)', profile: k1, decisions: [planned('E', '2026-11-03')], top: 'MEA', full: 'MEABFDKLJHCG', ac: 'US-E6-01/AC3' },
  { name: 'K15 same date is not "other"', profile: k1, decisions: [planned('E', '2026-11-18')], top: 'MEA', full: 'MEABFDKLJHCG', ac: 'US-E6-01/AC3' },
  { name: 'K16 14 days after, not cumulative', profile: k1, decisions: [planned('E', '2026-12-02'), planned('E', '2026-11-11')], top: 'MAB', full: 'MABFDEKLJHCG', ac: 'US-E6-01/AC3' },
  { name: 'K17 unknown allergy, theme', profile: { ...base, themeIds: ['theme-vehicles'] }, top: 'DLE', full: 'DLEKAJMCGHBFI', ac: 'US-E6-02/AC12' },
  { name: 'K18 distinct found ids (B1)', profile: { ...base, likedIds: ['cat-grain'] }, top: 'IBD', full: 'IBDEKLAJMCGHF', ac: 'US-E6-01/AC1' },
  { name: 'K19 category exclusion, dislike keeps listed', profile: { ...base, excludedIngredientIds: ['cat-seafood'], dislikedIds: ['cat-dairy'] }, top: 'DEK', full: 'DEKLAMCGHBFJ', ac: 'US-E6-02/AC2' },
  { name: 'K20 vegetarian, carrot excluded', profile: { ...base, diet: ['vegetarian'], excludedIngredientIds: ['ing-carrot'], likedIds: ['ing-corn'] }, top: 'A', full: 'A', ac: 'US-E6-01/AC4' },
  { name: 'K21 incomplete data no longer ranks last (F4 retired)', profile: { ...base, likedIds: ['ing-corn', 'ing-potato'], themeIds: ['theme-animals'] }, top: 'MED', full: 'MEDKLAJCGHBFI', ac: 'US-E6-02/AC9' },
  { name: 'K22 incomplete data is not excluded with a known allergen (F4 retired)', profile: { ...base, likedIds: ['ing-corn', 'ing-potato'], themeIds: ['theme-animals'], knownAllergenIds: alg('shrimp') }, top: 'MED', full: 'MEDKLAJCGHBF', ac: 'US-E6-02/AC9' },
  { name: 'K23 most specific entry wins (B2)', profile: { ...base, likedIds: ['cat-grain'], dislikedIds: ['ing-rice'] }, top: 'DJF', full: 'DJFIBEKLAMCGH', ac: 'US-E6-01/AC1' },
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
    const expected: Record<string, number> = { M: 3, A: 2, B: 2, C: -3, D: 0, E: 2, F: 1, G: -3, H: 0, J: 0, K: 0, L: 0 };
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
  it('US-E6-02/AC9 allergen reason lists the matching allergenIds only', () => {
    expect(reasonsOf({ ...base, knownAllergenIds: alg('milk') }, 'J')).toEqual([{ kind: 'allergen', allergenIds: alg('milk') }]);
    expect(reasonsOf({ ...base, knownAllergenIds: alg('milk') }, 'D')).toBeUndefined();
  });
  it('US-E6-02/AC2 excluded ingredient reason names the profile entry', () => {
    expect(reasonsOf({ ...base, excludedIngredientIds: ['ing-tomato'] }, 'D')).toEqual([{ kind: 'excluded-ingredient', ids: ['ing-tomato'] }]);
  });
  it('US-E6-02/AC9 incomplete allergen data is never an exclusion reason (F4 retired)', () => {
    expect(reasonsOf({ ...base, knownAllergenIds: alg('shrimp') }, 'M')).toBeUndefined();
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
    expect(run([]).all).toHaveLength(dietLib.length);
  });
});

describe('result shape and cards (US-E6-01, US-E6-02)', () => {
  it('US-E6-01/AC1 repeating the request returns the same list', () => {
    const a = rank({ profile: k1, decisions: [], targetDate: T });
    for (let i = 0; i < 20; i += 1) expect(keys(rank({ profile: k1, decisions: [], targetDate: T }).all)).toBe(keys(a.all));
  });
  it('US-E6-01/AC1 library order does not change the result', () => {
    const rev = createRanker(dict, [...lib].reverse());
    expect(keys(rev({ profile: k1, decisions: [], targetDate: T }).all)).toBe('MEABFDKLJHCG');
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
  it('US-E6-02/AC9 order is score desc, minutes asc, id asc; an incomplete recipe is not ranked last for that', () => {
    const r = rank({ profile: { ...base, likedIds: ['ing-corn', 'ing-potato'] }, decisions: [], targetDate: T });
    expect(keyOf(r.all[0]!.recipeId)).toBe('M');
    for (let i = 1; i < r.all.length; i += 1) {
      const a = r.all[i - 1]!;
      const b = r.all[i]!;
      const order = b.score - a.score || a.recipe.minutes - b.recipe.minutes || (a.recipeId < b.recipeId ? -1 : 1);
      expect(order).toBeLessThanOrEqual(0);
    }
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

describe('processed foods: generic allergen rule and warning (US-E6-02/AC9-AC15, ADR 013)', () => {
  const run = (knownAllergenIds: string[], extra: Partial<RankProfile> = {}) =>
    rankProc({ profile: { ...base, ...extra, knownAllergenIds }, decisions: [], targetDate: T });
  const short = (id: string) => id.replace('rcp-syn-', '').split('-')[0]!;
  const excl = (r: ReturnType<typeof run>) => r.excluded.map((x) => short(x.recipeId)).sort();
  const warn = (r: ReturnType<typeof run>, key: string) => r.all.find((x) => short(x.recipeId) === key)!.processedWarning;

  it('US-E6-02/AC9 an inherent allergen of a processed ingredient excludes (cheese milk, soy sauce soybean and wheat)', () => {
    expect(excl(run(alg('milk')))).toEqual(['p2']);
    expect(excl(run(alg('soybean')))).toEqual(['p5']);
    expect(excl(run(alg('wheat')))).toEqual(['p5']);
    expect(run(alg('milk')).excluded[0]!.reasons).toEqual([{ kind: 'allergen', allergenIds: alg('milk') }]);
  });

  it('US-E6-02/AC15 the fish group excludes for salmon or mackerel and the reason names the child own allergen', () => {
    const m = run(alg('mackerel'));
    expect(excl(m)).toEqual(['p1', 'p6']);
    expect(m.excluded.find((x) => short(x.recipeId) === 'p1')!.reasons).toEqual([{ kind: 'allergen', allergenIds: alg('mackerel') }]);
    const sa = run(alg('salmon'));
    expect(excl(sa)).toEqual(['p1', 'p6']);
    expect(sa.excluded.find((x) => short(x.recipeId) === 'p1')!.reasons).toEqual([{ kind: 'allergen', allergenIds: alg('salmon') }]);
    expect(sa.excluded.find((x) => short(x.recipeId) === 'p6')!.reasons).toEqual([{ kind: 'allergen', allergenIds: alg('salmon') }]);
  });

  it('US-E6-02/AC15 salmon roe alone or shrimp alone does not trigger the group; the warning applies', () => {
    for (const k of [alg('salmon-roe'), alg('shrimp')]) {
      const r = run(k);
      expect(excl(r)).toEqual([]);
      expect(warn(r, 'p1')).toEqual({ allergenIds: k, processedIngredientIds: ['ing-kamaboko'] });
    }
  });

  it('US-E6-02/AC15 the group is never written into the recipe: allergenIds of the fixture stay without fish ids', () => {
    expect(procLib.find((r) => short(r.id) === 'p1')!.allergenIds).toEqual([]);
  });

  it('US-E6-02/AC10 a registered allergen that is not inherent does not exclude and warns', () => {
    const r = run(alg('peanut'));
    expect(excl(r)).toEqual([]);
    expect(warn(r, 'p5')).toEqual({ allergenIds: alg('peanut'), processedIngredientIds: ['ing-soy-sauce'] });
    expect(warn(r, 'p4')).toBeNull(); // nothing processed
  });

  it('US-E6-02/AC11 the warning carries the child FULL list in registered order and each processed ingredient', () => {
    const r = run(['alg-shrimp', 'alg-peanut']);
    expect(warn(r, 'p3')).toEqual({ allergenIds: ['alg-shrimp', 'alg-peanut'], processedIngredientIds: ['ing-ham'] });
    for (const x of r.all) expect(x.processedWarning === null).toBe(short(x.recipeId) === 'p4');
  });

  it('US-E6-02/AC11 the trigger is the dictionary, whatever the recipe allergenInfo or allergenDataComplete says', () => {
    const r = run(alg('peanut'));
    const p1 = r.all.find((x) => short(x.recipeId) === 'p1')!;
    expect(p1.recipe.allergenDataComplete).toBe(false);
    expect(p1.processedWarning).not.toBeNull();
    const known = createRanker(dict, [{ ...p1.recipe, ingredients: p1.recipe.ingredients.map((i) => ({ ...i, allergenInfo: 'known' as const })) }]);
    expect(known({ profile: { ...base, knownAllergenIds: alg('peanut') }, decisions: [], targetDate: T }).all[0]!.processedWarning).not.toBeNull();
  });

  it('US-E6-02/AC12 no registered allergen means no warning (none-known, unknown, exclusions only)', () => {
    for (const p of [{}, { excludedIngredientIds: ['ing-tomato'] }]) {
      for (const x of run([], p).all) expect(x.processedWarning).toBeNull();
    }
    expect(excl(run([]))).toEqual([]);
  });

  it('US-E6-02/AC13 brand-label data warns only: may-contain and possible allergens never exclude', () => {
    const r = run(alg('soybean'));
    expect(r.all.some((x) => short(x.recipeId) === 'p3')).toBe(true);
    expect(warn(r, 'p3')!.processedIngredientIds).toEqual(['ing-ham']);
    expect(procLib.find((x) => short(x.id) === 'p3')!.mayContainAllergenIds).toContain('alg-soybean');
  });

  it('US-E6-02/AC9 retired F4: allergenDataComplete=false is not excluded and not ranked last for allergens', () => {
    const r = run(alg('peanut'));
    expect(r.all.map((x) => short(x.recipeId))).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']); // score 0: minutes asc
  });

  it('US-E6-02/AC9 a planned date still refuses an excluded recipe: the excluded list is what isRecipeAllowed reads', () => {
    const r = run(alg('milk'));
    const blocked = new Set(r.excluded.map((x) => x.recipeId));
    expect(blocked.has(procLib.find((x) => short(x.id) === 'p2')!.id)).toBe(true);
    expect(blocked.size).toBe(1);
  });
});
