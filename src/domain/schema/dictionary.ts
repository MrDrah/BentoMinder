// Domain dictionary JSON (data/dictionary.json), generated from docs/ba/domain-dictionary.md by
// scripts/build-dictionary.mjs. One record per row of the BA's tables, same ids. The shape is
// the Developer's (contract §3.7–§3.8 own the animal-origin names; ADR 004 §0 the engine view).
import { z } from 'zod';
import { normalizeForMatch } from '../text/normalize.ts';
import { ALLERGEN_SCHEME, ANIMAL_TAGS, idSchema, obj } from './primitives.ts';

const label = z.string().min(1);

export const dictionarySchema = obj({
  version: z.string().min(1),
  source: z.string(),
  allergenScheme: z.literal(ALLERGEN_SCHEME),
  categories: z.array(obj({ id: idSchema('cat'), ja: label, kana: label, en: label, parentId: z.string().nullable() })),
  allergens: z.array(
    obj({
      id: idSchema('alg'),
      ja: label,
      kana: label,
      en: label,
      tier: z.enum(['mandatory', 'recommended']),
      synonyms: z.array(label),
      retired: z.boolean(),
    }),
  ),
  ingredients: z.array(
    obj({
      id: idSchema('ing'),
      ja: label,
      kana: label,
      en: label,
      categoryIds: z.array(z.string()).min(1),
      parentIngredientId: z.string().nullable(),
      forms: z.array(label),
      inherentAllergenIds: z.array(z.string()),
      info: z.enum(['known', 'varies']),
      /** Allergen groups the product carries (dictionary §11.5, F1''); never an `alg-*` id. */
      allergenGroupIds: z.array(z.string()).default([]),
      animalOrigin: z.array(z.enum(ANIMAL_TAGS)),
      animalOriginKnown: z.boolean(),
      seasoning: z.boolean(),
      note: z.string().nullable(),
    }),
  ),
  dishes: z.array(
    obj({
      id: idSchema('dish'),
      ja: label,
      kana: label,
      en: label,
      categoryId: z.string().nullable(),
      role: z.enum(['main', 'side']).nullable(),
      forms: z.array(label),
      nameIngredientIds: z.array(z.string()),
      conditionalNameIds: z.array(z.string()),
      nameIngredientsNote: z.string().nullable(),
      definingIngredientId: z.string().nullable(),
    }),
  ),
  themes: z.array(obj({ id: idSchema('theme'), ja: label, en: label })),
  /** Allergen groups (dictionary §11.5): a group id is not an allergen id. */
  allergenGroups: z.array(obj({ id: idSchema('grp'), memberAllergenIds: z.array(z.string()).min(1), basis: z.string() })).default([]),
  ambiguity: z.array(
    obj({
      id: idSchema('amb'),
      forms: z.array(label).min(1),
      candidateIds: z.array(z.string()).min(1),
      candidatesNote: z.string(),
      resolution: z.string(),
    }),
  ),
});
export type Dictionary = z.infer<typeof dictionarySchema>;

export interface DictIssue {
  rule: string;
  id: string;
  detail?: string;
}

/** Dictionary §8 validator rules over a schema-valid dictionary. */
export function dictionaryIssues(dict: Dictionary): DictIssue[] {
  const out: DictIssue[] = [];
  const ids = new Map<string, string>();
  const all = [
    ...dict.categories,
    ...dict.allergens,
    ...dict.ingredients,
    ...dict.dishes,
    ...dict.themes,
    ...dict.ambiguity,
    ...dict.allergenGroups,
  ];
  for (const rec of all) {
    if (ids.has(rec.id)) out.push({ rule: 'dict-id-unique', id: rec.id });
    ids.set(rec.id, rec.id);
  }
  const cats = new Set(dict.categories.map((c) => c.id));
  const ings = new Set(dict.ingredients.map((i) => i.id));
  const algs = new Set(dict.allergens.map((a) => a.id));
  const groupIds = new Set(dict.allergenGroups.map((g) => g.id));
  const liveAlgs = new Set(dict.allergens.filter((a) => !a.retired).map((a) => a.id));
  const foods = new Set([...ings, ...dict.dishes.map((d) => d.id), ...cats]);

  for (const g of dict.allergenGroups) {
    if (g.memberAllergenIds.some((m) => !liveAlgs.has(m))) out.push({ rule: 'dictionary-group-member-unknown', id: g.id });
  }
  for (const c of dict.categories) {
    if (c.parentId !== null && !cats.has(c.parentId)) out.push({ rule: 'dict-parent-resolves', id: c.id });
  }
  for (const i of dict.ingredients) {
    if (i.categoryIds.some((c) => !cats.has(c))) out.push({ rule: 'dict-category-resolves', id: i.id });
    if (i.parentIngredientId !== null && !ings.has(i.parentIngredientId)) {
      out.push({ rule: 'dict-parent-resolves', id: i.id });
    }
    if (i.inherentAllergenIds.some((a) => !algs.has(a))) out.push({ rule: 'dict-allergen-resolves', id: i.id });
    if (i.allergenGroupIds.some((g) => !groupIds.has(g))) out.push({ rule: 'dictionary-ingredient-group-unknown', id: i.id });
    if (i.allergenGroupIds.length > 0 && i.info !== 'varies') out.push({ rule: 'dictionary-group-ingredient-not-processed', id: i.id });
    if (new Set(i.animalOrigin).size !== i.animalOrigin.length) out.push({ rule: 'dict-animal-origin-valid', id: i.id });
  }
  for (const d of dict.dishes) {
    if (d.categoryId !== null && !cats.has(d.categoryId)) out.push({ rule: 'dict-category-resolves', id: d.id });
    const named = [...d.nameIngredientIds, ...d.conditionalNameIds];
    if (named.some((n) => !foods.has(n))) out.push({ rule: 'dict-parent-resolves', id: d.id, detail: 'name ingredient' });
    if (d.definingIngredientId !== null) {
      const ok = d.definingIngredientId.startsWith('ing-') && named.includes(d.definingIngredientId);
      if (!ok) out.push({ rule: 'dict-defining-ingredient', id: d.id });
    }
  }
  for (const a of dict.ambiguity) {
    if (a.candidateIds.some((c) => !foods.has(c))) out.push({ rule: 'dict-ambiguity-candidates-resolve', id: a.id });
  }

  // Rule 2: one normalised surface form → one entry or one ambiguity group.
  const owner = new Map<string, string>();
  const claim = (form: string, id: string) => {
    const key = normalizeForMatch(form);
    const prev = owner.get(key);
    if (prev !== undefined && prev !== id) out.push({ rule: 'dict-synonym-unique', id, detail: `${form} (also ${prev})` });
    else owner.set(key, id);
  };
  for (const a of dict.ambiguity) a.forms.forEach((f) => claim(f, a.id));
  for (const i of dict.ingredients) i.forms.forEach((f) => claim(f, i.id));
  for (const d of dict.dishes) d.forms.forEach((f) => claim(f, d.id));
  return out;
}
