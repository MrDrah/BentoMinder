// Data contract §3.7 Recipe (data/_research/batch-*.json → generated data/library.json).
// Field and intra-record rules live in the schema; rules that need the dictionary or the
// whole library are in `recipeLibraryIssues`.
import { z } from 'zod';
import type { Dictionary } from './dictionary.ts';
import {
  ALLERGEN_SCHEME,
  allergenIdSchema,
  ANIMAL_TAGS,
  boundedList,
  codePoints,
  dateSchema,
  DIET_FORBIDDEN_TAGS,
  DIETS,
  idSchema,
  intRange,
  issue,
  localizedTextSchema,
  obj,
  textSchema,
  themeIdSchema,
  type AnimalTag,
  type Diet,
} from './primitives.ts';

const UNITS = ['g', 'ml', 'piece', 'slice', 'stick', 'tbsp', 'tsp', 'cup', 'sheet', 'to-taste', 'small-amount'] as const;

export const recipeIngredientSchema = obj({
  ingredientId: idSchema('ing'),
  label: localizedTextSchema,
  quantity: z.number().nullable(),
  unit: z.enum(UNITS),
  optional: z.boolean(),
  allergenInfo: z.enum(['known', 'varies-by-product', 'unknown']),
  allergenIds: z.array(allergenIdSchema),
  possibleAllergenIds: z.array(allergenIdSchema),
  animalOrigin: z.array(z.enum(ANIMAL_TAGS)),
  animalOriginKnown: z.boolean(),
}).superRefine((i, ctx) => {
  const vague = i.unit === 'to-taste' || i.unit === 'small-amount';
  const q = i.quantity;
  const quantityOk = q === null ? vague : q > 0 && Math.round(q * 100) === q * 100;
  if (!quantityOk) issue(ctx, 'recipe-quantity', ['quantity']);
  // Only varies-by-product may list possible allergens; it may also list none when the cited label
  // declares none (PLAN §7 2026-10-25: a processed food is never recorded as "known: none").
  if (i.allergenInfo !== 'varies-by-product' && i.possibleAllergenIds.length > 0) {
    issue(ctx, 'recipe-possible-allergens', ['possibleAllergenIds']);
  }
});
export type RecipeIngredient = z.infer<typeof recipeIngredientSchema>;

export const sourceSchema = obj({
  id: idSchema('src'),
  publisher: textSchema.min(1),
  title: textSchema.min(1),
  url: z.string().regex(/^https?:\/\/\S+$/, { error: 'source-url-invalid' }),
  accessed: dateSchema,
  language: z.enum(['ja', 'en']),
  usedFor: z.array(z.enum(['recipe', 'storage', 'allergen'])).min(1),
});

const shortName = textSchema.refine((s) => codePoints(s) >= 1 && codePoints(s) <= 8, { error: 'recipe-short-name' });
const jaLength = (min: number, max: number) =>
  localizedTextSchema.refine((t) => codePoints(t.ja) >= min && codePoints(t.ja) <= max, { error: 'text-length' });

const union = <T>(lists: T[][]): T[] => [...new Set(lists.flat())];
const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && new Set(a).size === new Set([...a, ...b]).size;

/** Diets a recipe satisfies (contract §3.8): none when its origin data is incomplete. */
export function derivedDietOk(animalOrigin: readonly AnimalTag[], dietDataComplete: boolean): Diet[] {
  if (!dietDataComplete) return [];
  return DIETS.filter((d) => !DIET_FORBIDDEN_TAGS[d].some((tag) => animalOrigin.includes(tag)));
}

export const recipeSchema = obj({
  id: idSchema('rcp'),
  name: localizedTextSchema,
  shortNameJa: shortName,
  shortNameEn: shortName,
  nameKana: textSchema.min(1),
  style: z.enum(['japanese', 'western-inspired', 'other']),
  themeId: themeIdSchema.nullable(),
  description: jaLength(20, 120),
  yield: localizedTextSchema,
  minutes: intRange(5, 60),
  makeAhead: localizedTextSchema.nullable(),
  ingredients: boundedList(recipeIngredientSchema, 2, 20),
  steps: boundedList(jaLength(1, 120), 2, 12),
  storage: boundedList(localizedTextSchema, 1),
  allergenIds: z.array(allergenIdSchema),
  mayContainAllergenIds: z.array(allergenIdSchema),
  allergenDataComplete: z.boolean(),
  allergenScheme: z.literal(ALLERGEN_SCHEME),
  animalOrigin: z.array(z.enum(ANIMAL_TAGS)),
  dietDataComplete: z.boolean(),
  dietOk: z.array(z.enum(DIETS)),
  adaptations: z.array(localizedTextSchema),
  sources: boundedList(sourceSchema, 1),
  reviewedBy: z.enum(['ba-research', 'verifier']),
}).superRefine((r, ctx) => {
  const ings = r.ingredients;
  if (!sameSet(r.allergenIds, union(ings.map((i) => i.allergenIds)))) issue(ctx, 'recipe-allergen-union', ['allergenIds']);
  const mayContain = union(ings.filter((i) => i.allergenInfo === 'varies-by-product').map((i) => i.possibleAllergenIds));
  if (!sameSet(r.mayContainAllergenIds, mayContain)) issue(ctx, 'recipe-may-contain-union', ['mayContainAllergenIds']);
  if (r.allergenDataComplete !== !ings.some((i) => i.allergenInfo === 'unknown')) {
    issue(ctx, 'recipe-allergen-complete-derived', ['allergenDataComplete']);
  }
  if (!sameSet(r.animalOrigin, union(ings.map((i) => i.animalOrigin)))) {
    issue(ctx, 'recipe-animal-origin-union', ['animalOrigin']);
  }
  if (r.dietDataComplete !== ings.every((i) => i.animalOriginKnown)) {
    issue(ctx, 'recipe-diet-complete-derived', ['dietDataComplete']);
  }
  if (!sameSet(r.dietOk, derivedDietOk(r.animalOrigin, r.dietDataComplete))) issue(ctx, 'recipe-diet-derived', ['dietOk']);
});
export type Recipe = z.infer<typeof recipeSchema>;

export interface LibraryIssue {
  recipeId: string;
  rule: string;
  path: string;
}

/** Cross-record and dictionary rules for the recipe library (contract §3.7, §4). */
export function recipeLibraryIssues(recipes: Recipe[], dict: Dictionary, approvedHosts: readonly string[]): LibraryIssue[] {
  const out: LibraryIssue[] = [];
  const add = (recipeId: string, rule: string, path: string) => out.push({ recipeId, rule, path });
  const ingredients = new Map(dict.ingredients.map((i) => [i.id, i]));
  const allergens = new Map(dict.allergens.map((a) => [a.id, a]));
  const themes = new Set(dict.themes.map((t) => t.id));
  const seenIds = new Set<string>();
  const seenShort = new Set<string>();
  for (const r of recipes) {
    if (seenIds.has(r.id)) add(r.id, 'recipe-id-unique', 'id');
    seenIds.add(r.id);
    if (seenShort.has(r.shortNameJa)) add(r.id, 'recipe-short-name-unique', 'shortNameJa');
    seenShort.add(r.shortNameJa);
    if (r.themeId !== null && !themes.has(r.themeId)) add(r.id, 'ref-dictionary', 'themeId');
    const allAllergens = [...r.allergenIds, ...r.mayContainAllergenIds];
    for (const a of allAllergens) {
      const entry = allergens.get(a);
      if (entry === undefined) add(r.id, 'allergen-unknown', 'allergenIds');
      else if (entry.retired) add(r.id, 'allergen-retired', 'allergenIds');
    }
    r.ingredients.forEach((ing, n) => {
      const entry = ingredients.get(ing.ingredientId);
      if (entry === undefined) {
        add(r.id, 'recipe-ingredient-resolves', `ingredients.${n}.ingredientId`);
        return;
      }
      if (!entry.inherentAllergenIds.every((a) => ing.allergenIds.includes(a))) {
        add(r.id, 'recipe-ingredient-inherent-allergen', `ingredients.${n}.allergenIds`);
      }
      if (!entry.animalOrigin.every((t) => ing.animalOrigin.includes(t))) {
        add(r.id, 'recipe-ingredient-animal-origin', `ingredients.${n}.animalOrigin`);
      }
      if (entry.animalOriginKnown && !ing.animalOriginKnown) {
        add(r.id, 'recipe-animal-origin-known', `ingredients.${n}.animalOriginKnown`);
      }
      if (!entry.animalOriginKnown && ing.animalOriginKnown) {
        const cited = r.sources.some((s) => s.usedFor.includes('recipe') || s.usedFor.includes('allergen'));
        if (!cited) add(r.id, 'recipe-animal-origin-known', `ingredients.${n}.animalOriginKnown`);
      }
    });
    r.sources.forEach((s, n) => {
      if (!isApprovedHost(s.url, approvedHosts)) add(r.id, 'source-publisher-approved', `sources.${n}.url`);
    });
  }
  return out;
}

export function isApprovedHost(url: string, approvedHosts: readonly string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return approvedHosts.some((h) => host === h || host.endsWith(`.${h}`));
}
