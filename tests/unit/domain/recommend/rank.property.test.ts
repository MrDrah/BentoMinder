// Property tests on the REAL library (US-E6-02/AC3, US-E6-01/AC1, AC6): properties only, no specific outputs (BR-26).
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRanker, type RankProfile } from '../../../../src/domain/recommend/rank.ts';
import { DIETS, DIET_FORBIDDEN_TAGS } from '../../../../src/domain/schema/primitives.ts';
import type { Dictionary } from '../../../../src/domain/schema/dictionary.ts';
import type { Recipe } from '../../../../src/domain/schema/recipe.ts';
import { localDate } from '../../../../src/domain/time/jst.ts';

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../../../../${p}`, import.meta.url), 'utf8')) as T;
const dict = read<Dictionary>('data/dictionary.json');
const library = read<Recipe[]>('data/library.json');
const rank = createRanker(dict, library);
const T = localDate('2026-11-18');

const allergenIds = dict.allergens.map((a) => a.id);
const foodIds = [...dict.ingredients.map((i) => i.id), ...dict.categories.map((c) => c.id)];
const themeIds = dict.themes.map((t) => t.id);

const profileArb: fc.Arbitrary<RankProfile> = fc.record({
  likedIds: fc.uniqueArray(fc.constantFrom(...foodIds), { maxLength: 5 }),
  dislikedIds: fc.uniqueArray(fc.constantFrom(...foodIds), { maxLength: 5 }),
  knownAllergenIds: fc.uniqueArray(fc.constantFrom(...allergenIds), { maxLength: 6 }),
  excludedIngredientIds: fc.uniqueArray(fc.constantFrom(...foodIds), { maxLength: 3 }),
  diet: fc.uniqueArray(fc.constantFrom(...DIETS), { maxLength: 2 }),
  themeIds: fc.uniqueArray(fc.constantFrom(...themeIds), { maxLength: 3 }),
});

describe('ranking properties on data/library.json', () => {
  const ingOf = new Map(dict.ingredients.map((i) => [i.id, i] as const));
  const groupMembers = new Map(dict.allergenGroups.map((g) => [g.id, g.memberAllergenIds] as const));
  /** Independent restatement of F1'' from the dictionary (not from the recipe's derived fields only). */
  const violates = (r: Recipe, known: ReadonlySet<string>): boolean =>
    r.allergenIds.some((a) => known.has(a)) ||
    r.ingredients.some((i) => {
      const d = ingOf.get(i.ingredientId)!;
      return (
        (d.info === 'varies' && d.inherentAllergenIds.some((a) => known.has(a))) ||
        d.allergenGroupIds.some((g) => (groupMembers.get(g) ?? []).some((m) => known.has(m)))
      );
    });
  const processedIds = (r: Recipe): string[] => [...new Set(r.ingredients.map((i) => i.ingredientId).filter((id) => ingOf.get(id)!.info === 'varies'))];
  const checkAllergens = (knownAllergenIds: string[]) => {
    const profile: RankProfile = { likedIds: [], dislikedIds: [], knownAllergenIds, excludedIngredientIds: [], diet: [], themeIds: [] };
    const r = rank({ profile, decisions: [], targetDate: T });
    const known = new Set(knownAllergenIds);
    for (const x of r.all) {
      expect(violates(x.recipe, known), x.recipeId).toBe(false);
      const processed = processedIds(x.recipe);
      if (knownAllergenIds.length === 0 || processed.length === 0) expect(x.processedWarning).toBeNull();
      else expect(x.processedWarning).toEqual({ allergenIds: knownAllergenIds, processedIngredientIds: processed });
    }
    for (const x of r.excluded) if (x.reasons.every((q) => q.kind === 'allergen')) expect(violates(x.recipe, known), x.recipeId).toBe(true);
    for (const x of r.suggestions) expect(r.all).toContain(x);
  };

  it('US-E6-02/AC14 no suggested or listed recipe has a registered allergen (allergenIds, inherent of processed, group); warning exactly when allergens registered and a processed ingredient exists', () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        const r = rank({ profile, decisions: [], targetDate: T });
        const known = new Set(profile.knownAllergenIds);
        for (const x of r.all) {
          expect(violates(x.recipe, known)).toBe(false);
          const processed = processedIds(x.recipe);
          if (known.size === 0 || processed.length === 0) expect(x.processedWarning).toBeNull();
          else expect(x.processedWarning).toEqual({ allergenIds: profile.knownAllergenIds, processedIngredientIds: processed });
        }
        for (const x of r.suggestions) expect(r.all).toContain(x);
      }),
      { numRuns: 300 },
    );
  });

  it('US-E6-02/AC14 every single allergen and every pair: nothing violating survives; the warning rule holds', () => {
    const sets = [[], ...allergenIds.map((a) => [a]), ...allergenIds.flatMap((a, i) => allergenIds.slice(i + 1).map((b) => [a, b]))];
    for (const knownAllergenIds of sets) checkAllergens(knownAllergenIds);
  });

  it('US-E6-02/AC9 US-E6-02/AC15 survivors of 6 sample profiles stay above zero (library has choices for each)', () => {
    for (const k of [[], ['alg-milk'], ['alg-egg'], ['alg-wheat'], ['alg-salmon'], ['alg-peanut']]) {
      const r = rank({ profile: { likedIds: [], dislikedIds: [], knownAllergenIds: k, excludedIngredientIds: [], diet: [], themeIds: [] }, decisions: [], targetDate: T });
      expect(r.all.length, k.join()).toBeGreaterThan(0);
    }
  });

  it('US-E6-02/AC3 US-E6-02/AC8 no survivor violates a diet or has unknown animal origin', () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        const forbidden = new Set(profile.diet.flatMap((d) => DIET_FORBIDDEN_TAGS[d]));
        for (const x of rank({ profile, decisions: [], targetDate: T }).all) {
          if (profile.diet.length > 0) expect(x.recipe.dietDataComplete).toBe(true);
          expect(x.recipe.animalOrigin.some((t) => forbidden.has(t))).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('US-E6-01/AC1 AC6 deterministic; suggestions are the first min(3, n) of the full list; excluded + listed = library', () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        const a = rank({ profile, decisions: [], targetDate: T });
        const b = rank({ profile, decisions: [], targetDate: T });
        expect(b.all.map((x) => x.recipeId)).toEqual(a.all.map((x) => x.recipeId));
        expect(a.suggestions.map((x) => x.recipeId)).toEqual(a.all.slice(0, 3).map((x) => x.recipeId));
        expect(a.all.length + a.excluded.length).toBe(library.length);
        for (let i = 1; i < a.all.length; i += 1) {
          const p = a.all[i - 1]!;
          const q = a.all[i]!;
          expect(q.score - p.score || p.recipe.minutes - q.recipe.minutes || (p.recipeId < q.recipeId ? -1 : 1)).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('US-E6-01/AC1 shuffling the library changes nothing', () => {
    fc.assert(
      fc.property(profileArb, fc.shuffledSubarray(library, { minLength: library.length }), (profile, shuffled) => {
        const a = rank({ profile, decisions: [], targetDate: T });
        const b = createRanker(dict, shuffled)({ profile, decisions: [], targetDate: T });
        expect(b.all.map((x) => x.recipeId)).toEqual(a.all.map((x) => x.recipeId));
      }),
      { numRuns: 100 },
    );
  });
});
