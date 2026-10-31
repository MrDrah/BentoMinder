// QA: ranking oracle vs engine (tests/oracle/ranking-oracle.md). Hand-computed orders K1.. are copied from the spec table,
// not from the engine or the developer's tests. Random comparison seed 20261024 (spec section 5).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRanker, type PlannedDecision, type RankProfile } from '../../../../src/domain/recommend/index.ts';
import { localDate } from '../../../../src/domain/time/jst.ts';
import type { Dictionary } from '../../../../src/domain/schema/dictionary.ts';
import type { Recipe } from '../../../../src/domain/schema/recipe.ts';
import { loadRDict, RankOracle, type RDecision, type RProfile, type RRecipe } from '../../../oracle/impl/ranking.ts';
import { Prng } from '../../../oracle/impl/prng.ts';

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../../../../${p}`, import.meta.url), 'utf8')) as T;
const dict = read<Dictionary>('data/dictionary.json');
const real = read<Recipe[]>('data/library.json');
const syn = read<Recipe[]>('tests/fixtures/recipes/synthetic-library.json');
const synDiet = read<Recipe[]>('tests/fixtures/recipes/synthetic-library-diet.json');
const rdict = loadRDict();

const key = (id: string) => id.replace('rcp-syn-', '').split('-')[0]!.toUpperCase();
const base: RProfile = { likedIds: [], dislikedIds: [], knownAllergenIds: [], excludedIngredientIds: [], diet: [], themeIds: [] };
const alg = (...x: string[]) => x.map((a) => `alg-${a}`);
const T = '2026-11-18';

const engineOut = (lib: Recipe[], p: RProfile, dec: RDecision[], t: string) =>
  createRanker(dict, lib)({ profile: p as RankProfile, decisions: dec.map((d) => ({ ...d, date: localDate(d.date) })) as PlannedDecision[], targetDate: localDate(t) });

function compare(lib: Recipe[], p: RProfile, dec: RDecision[], t: string): string[] {
  const e = engineOut(lib, p, dec, t);
  const o = new RankOracle(rdict, lib as unknown as RRecipe[]).run(p, dec, t);
  const diffs: string[] = [];
  const eo = e.all.map((x) => `${x.recipeId}:${x.score}`).join(',');
  const oo = o.order.map((x) => `${x.id}:${x.score}`).join(',');
  if (eo !== oo) diffs.push(`order engine=${eo} oracle=${oo}`);
  if (e.suggestions.map((x) => x.recipeId).join() !== o.order.slice(0, 3).map((x) => x.id).join()) diffs.push('suggestions');
  const ex = [...e.excluded.map((x) => x.recipeId)].sort().join();
  const ox = [...o.excluded.keys()].sort().join();
  if (ex !== ox) diffs.push(`excluded engine=${ex} oracle=${ox}`);
  // reason kinds must agree per recipe
  for (const x of e.excluded) {
    const kinds = new Set(x.reasons.map((r) => r.kind));
    const ok = new Set((o.excluded.get(x.recipeId) ?? []).map((r) => r.split(':')[0]!.replace(/^diet-tag$/, 'diet').replace(/^excluded$/, 'excluded-ingredient')));
    if ([...kinds].sort().join() !== [...ok].sort().join()) diffs.push(`reasons ${x.recipeId} engine=${[...kinds].sort()} oracle=${[...ok].sort()}`);
    const alle = x.reasons.flatMap((r) => (r.kind === 'allergen' ? r.allergenIds : []));
    const allo = (o.excluded.get(x.recipeId) ?? []).filter((r) => r.startsWith('allergen:')).map((r) => r.slice(9));
    if (alle.sort().join() !== allo.sort().join()) diffs.push(`allergen ids ${x.recipeId}`);
    const exe = x.reasons.flatMap((r) => (r.kind === 'excluded-ingredient' ? r.ids : []));
    const exo = (o.excluded.get(x.recipeId) ?? []).filter((r) => r.startsWith('excluded:')).map((r) => r.slice(9));
    if (exe.sort().join() !== exo.sort().join()) diffs.push(`excluded ids ${x.recipeId}`);
    const te = x.reasons.flatMap((r) => (r.kind === 'diet' ? r.tags : []));
    const to = (o.excluded.get(x.recipeId) ?? []).filter((r) => r.startsWith('diet-tag:')).map((r) => r.slice(9));
    if (te.sort().join() !== to.sort().join()) diffs.push(`diet tags ${x.recipeId}`);
  }
  return diffs;
}

describe('QA ranking oracle: the oracle reproduces the spec hand cases (guards the oracle itself)', () => {
  const order = (p: RProfile, dec: RDecision[] = []) =>
    new RankOracle(rdict, syn as unknown as RRecipe[]).run(p, dec, T).order.map((x) => key(x.id)).join('');
  const k1: RProfile = {
    ...base,
    likedIds: ['ing-chicken', 'ing-egg', 'ing-corn'],
    dislikedIds: ['ing-green-pepper', 'ing-eggplant', 'cat-fish'],
    knownAllergenIds: alg('shrimp'),
    themeIds: ['theme-animals'],
  };
  const planned = (k: string, date: string): RDecision => ({ date, state: 'homemade-bento-planned', recipeId: syn.find((r) => key(r.id) === k)!.id });
  const cases: [string, RProfile, RDecision[], string][] = [
    ['K1', k1, [], 'EABFDKLJHCG'],
    ['K2', base, [], 'DEKLAJCGHBFIM'],
    ['K13 variety at 14 days', k1, [planned('E', '2026-11-04')], 'ABFDEKLJHCG'],
    ['K14 15 days', k1, [planned('E', '2026-11-03')], 'EABFDKLJHCG'],
    ['K15 same day', k1, [planned('E', T)], 'EABFDKLJHCG'],
    ['K16 twice', k1, [planned('E', '2026-12-02'), planned('E', '2026-11-11')], 'ABFDEKLJHCG'],
    ['K18 cat-grain', { ...base, likedIds: ['cat-grain'] }, [], 'IBDEKLAJCGHFM'],
    ['K21 incomplete last', { ...base, likedIds: ['ing-corn', 'ing-potato'], themeIds: ['theme-animals'] }, [], 'EDKLAJCGHBFIM'],
    ['K23 B2', { ...base, likedIds: ['cat-grain'], dislikedIds: ['ing-rice'] }, [], 'DJFIBEKLACGHM'],
    ['K9 empty', { ...base, diet: ['vegetarian'], knownAllergenIds: alg('egg', 'soybean'), excludedIngredientIds: ['ing-corn'] }, [], ''],
    ['K12', { ...base, diet: ['vegetarian'], likedIds: ['ing-carrot'], dislikedIds: ['ing-green-pepper'] }, [], 'EA'],
    ['K20', { ...base, diet: ['vegetarian'], excludedIngredientIds: ['ing-carrot'], likedIds: ['ing-corn'] }, [], 'A'],
  ];
  for (const [name, p, dec, want] of cases) {
    it(`US-E6-01/AC1 oracle ${name} = ${want || '(none)'}`, () => {
      expect(order(p, dec)).toBe(want);
    });
  }
});

describe('QA ranking oracle vs engine: fixed inputs', () => {
  it('US-E6-01/AC1 US-E6-02/AC1 synthetic library: every allergen single, every diet single/pair, 0 differences', () => {
    const allergens = dict.allergens.filter((a) => !('retired' in a && a.retired === true)).map((a) => a.id);
    const diets = ['vegetarian', 'pescatarian', 'no-pork', 'no-beef', 'no-seafood'];
    const dietSets: string[][] = [[], ...diets.map((d) => [d])];
    for (let i = 0; i < diets.length; i++) for (let j = i + 1; j < diets.length; j++) dietSets.push([diets[i]!, diets[j]!]);
    let n = 0;
    const bad: string[] = [];
    for (const lib of [syn, synDiet]) {
      for (const ds of dietSets) {
        for (const known of [[], ...allergens.map((a) => [a])]) {
          const diffs = compare(lib, { ...base, knownAllergenIds: known, diet: ds }, [], T);
          n++;
          if (diffs.length) bad.push(`${known} ${ds}: ${diffs[0]}`);
        }
      }
    }
    expect(n).toBeGreaterThan(500);
    expect(bad.slice(0, 3)).toEqual([]);
  });

  it('US-E6-02/AC7 US-E6-02/AC8 diet mini library: every diet set 0 differences', () => {
    const diets = ['vegetarian', 'pescatarian', 'no-pork', 'no-beef', 'no-seafood'];
    for (const d of [[], ...diets.map((x) => [x]), ['no-pork', 'no-beef']]) {
      expect(compare(synDiet, { ...base, diet: d }, [], T)).toEqual([]);
    }
  });

  it('US-E6-02/AC3 property: no known allergen / exclusion / forbidden tag is ever suggested or listed in ほかのレシピ (real library, singles and pairs, 6 diet sets)', () => {
    const allergens = dict.allergens.filter((a) => !('retired' in a && a.retired === true)).map((a) => a.id);
    const sets: string[][] = allergens.map((a) => [a]);
    for (let i = 0; i < allergens.length; i++) for (let j = i + 1; j < allergens.length; j++) sets.push([allergens[i]!, allergens[j]!]);
    const dietSets = [[], ['vegetarian'], ['pescatarian'], ['no-pork'], ['no-beef'], ['no-seafood']];
    const rank = createRanker(dict, real);
    const forbidden: Record<string, string[]> = {
      vegetarian: ['meat', 'pork', 'beef', 'chicken', 'fish-seafood', 'gelatin'],
      pescatarian: ['meat', 'pork', 'beef', 'chicken', 'gelatin'],
      'no-pork': ['pork', 'meat', 'gelatin'],
      'no-beef': ['beef', 'meat'],
      'no-seafood': ['fish-seafood'],
    };
    let violations = 0;
    for (const known of sets) {
      for (const ds of dietSets) {
        const r = rank({ profile: { ...base, knownAllergenIds: known, diet: ds } as RankProfile, decisions: [], targetDate: localDate(T) });
        expect(r.suggestions.map((x) => x.recipeId)).toEqual(r.all.slice(0, 3).map((x) => x.recipeId));
        for (const x of r.all) {
          const rec = real.find((q) => q.id === x.recipeId)!;
          const algs = [...rec.allergenIds, ...rec.mayContainAllergenIds, ...rec.ingredients.flatMap((i) => [...i.allergenIds, ...i.possibleAllergenIds])];
          if (algs.some((a) => known.includes(a))) violations++;
          if (!rec.allergenDataComplete) violations++;
          const origin = rec.ingredients.flatMap((i) => i.animalOrigin);
          if (ds.some((d) => forbidden[d]!.some((t) => origin.includes(t as never)))) violations++;
          if (ds.length > 0 && rec.ingredients.some((i) => !i.animalOriginKnown)) violations++;
        }
        expect(r.all.length + r.excluded.length).toBe(real.length);
      }
    }
    expect(violations).toBe(0);
  });

  it('US-E6-01/AC1 determinism: 100 repeats identical; shuffled library gives the same order', () => {
    const p: RProfile = { ...base, likedIds: ['ing-egg', 'cat-grain'], dislikedIds: ['ing-onion'], themeIds: ['theme-animals'] };
    const a = engineOut(real, p, [], T).all.map((x) => x.recipeId).join();
    for (let i = 0; i < 100; i++) expect(engineOut(real, p, [], T).all.map((x) => x.recipeId).join()).toBe(a);
    const rng = new Prng(7);
    for (let k = 0; k < 10; k++) {
      const sh = [...real];
      for (let i = sh.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [sh[i], sh[j]] = [sh[j]!, sh[i]!];
      }
      expect(engineOut(sh, p, [], T).all.map((x) => x.recipeId).join()).toBe(a);
    }
  });

  it('US-E6-02/AC5 US-E6-02/AC6 incomplete allergen data: last when no known allergens, excluded when any (synthetic M)', () => {
    const m = syn.find((r) => key(r.id) === 'M')!.id;
    const none = engineOut(syn, { ...base, likedIds: ['ing-corn', 'ing-potato'] }, [], T);
    expect(none.all[none.all.length - 1]!.recipeId).toBe(m);
    const some = engineOut(syn, { ...base, knownAllergenIds: alg('shrimp') }, [], T);
    expect(some.all.some((x) => x.recipeId === m)).toBe(false);
    expect(some.excluded.find((x) => x.recipeId === m)!.reasons.some((r) => r.kind === 'allergen-incomplete')).toBe(true);
  });
});

describe('QA ranking oracle vs engine: random profiles, seed 20261024', () => {
  const ingIds = rdict.ingredients.map((i) => i.id);
  const catIds = rdict.categories.map((c) => c.id);
  const allergens = dict.allergens.filter((a) => !('retired' in a && a.retired === true)).map((a) => a.id);
  const themes = dict.themes.map((t) => t.id);
  const diets = ['vegetarian', 'pescatarian', 'no-pork', 'no-beef', 'no-seafood'];
  const pool = [...ingIds, ...catIds];

  const run = (name: string, lib: Recipe[], seed: number, n: number) => {
    const rng = new Prng(seed);
    const some = <T>(xs: T[], lo: number, hi: number): T[] => [...new Set(Array.from({ length: rng.int(lo, hi) }, () => rng.pick(xs)))];
    let diffCount = 0;
    const samples: string[] = [];
    for (let i = 0; i < n; i++) {
      const target = new Date(Date.UTC(2026, 10, 18) + rng.int(-30, 30) * 86400000).toISOString().slice(0, 10);
      const status = rng.pick(['none-known', 'has-known', 'unknown']);
      const p: RProfile = {
        likedIds: some(pool, 0, 5),
        dislikedIds: some(pool, 0, 5),
        knownAllergenIds: status === 'has-known' ? some(allergens, 0, 4) : [],
        excludedIngredientIds: status === 'has-known' ? some(pool, 0, 3) : [],
        diet: some(diets, 0, 2),
        themeIds: some(themes, 0, 3),
      };
      const dec: RDecision[] = Array.from({ length: rng.int(0, 4) }, () => ({
        date: new Date(Date.parse(target) + rng.int(-20, 20) * 86400000).toISOString().slice(0, 10),
        state: rng.chance(0.85) ? 'homemade-bento-planned' : 'school-lunch-planned',
        recipeId: rng.pick(lib).id,
      }));
      const diffs = compare(lib, p, dec, target);
      if (diffs.length) {
        diffCount++;
        if (samples.length < 3) samples.push(`#${i} ${JSON.stringify(p)} :: ${diffs[0]}`);
      }
    }
    return { diffCount, samples, name };
  };

  it('US-E6-01/AC1 US-E6-01/AC3 1000 random profiles x real library: 0 differences (excluded set, reasons, order, scores)', () => {
    const r = run('real', real, 20261024, 1000);
    expect(r.samples).toEqual([]);
    expect(r.diffCount).toBe(0);
  });
  it('US-E6-01/AC1 US-E6-02/AC2 1000 random profiles x synthetic library: 0 differences', () => {
    const r = run('syn', syn, 20261025, 1000);
    expect(r.samples).toEqual([]);
    expect(r.diffCount).toBe(0);
  });
  it('US-E6-02/AC7 US-E6-02/AC8 500 random profiles x synthetic diet library: 0 differences', () => {
    const r = run('synDiet', synDiet, 20261026, 500);
    expect(r.samples).toEqual([]);
    expect(r.diffCount).toBe(0);
  });
});

describe('QA ranking: data checks on the real library (PR6)', () => {
  it('US-E6-02/AC8 recipe animalOrigin = union of ingredient tags; dietDataComplete = no unknown-origin ingredient', () => {
    for (const r of real) {
      const u = [...new Set(r.ingredients.flatMap((i) => i.animalOrigin))].sort();
      expect([...r.animalOrigin].sort(), r.id).toEqual(u);
      expect(r.dietDataComplete, r.id).toBe(r.ingredients.every((i) => i.animalOriginKnown));
    }
  });
});
