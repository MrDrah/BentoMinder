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
  it('US-E6-02/AC3 US-E6-02/AC1 no recipe with a known allergen (incl. may-contain) is suggested or listed', () => {
    fc.assert(
      fc.property(profileArb, (profile) => {
        const r = rank({ profile, decisions: [], targetDate: T });
        const known = new Set(profile.knownAllergenIds);
        for (const x of r.all) {
          for (const a of [...x.recipe.allergenIds, ...x.recipe.mayContainAllergenIds]) expect(known.has(a)).toBe(false);
        }
        for (const x of r.suggestions) expect(r.all).toContain(x);
      }),
      { numRuns: 300 },
    );
  });

  it('US-E6-02/AC3 every single allergen and every pair: nothing violating survives', () => {
    const sets = [...allergenIds.map((a) => [a]), ...allergenIds.flatMap((a, i) => allergenIds.slice(i + 1).map((b) => [a, b]))];
    for (const knownAllergenIds of sets) {
      const r = rank({ profile: { likedIds: [], dislikedIds: [], knownAllergenIds, excludedIngredientIds: [], diet: [], themeIds: [] }, decisions: [], targetDate: T });
      for (const x of r.all) {
        expect(x.recipe.allergenDataComplete).toBe(true);
        expect([...x.recipe.allergenIds, ...x.recipe.mayContainAllergenIds].some((a) => knownAllergenIds.includes(a))).toBe(false);
      }
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
        const complete = a.all.map((x) => x.complete);
        expect(complete).toEqual([...complete].sort((x, y) => Number(y) - Number(x)));
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
