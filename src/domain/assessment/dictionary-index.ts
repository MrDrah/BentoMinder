// Lookup tables over the dictionary (domain dictionary §1, §2, §4, §5; ADR 004 §0 `expand`).
// Built once per dictionary object and cached, so the engines stay pure functions of their input.
import type { Dictionary } from '../schema/dictionary.ts';

type Ingredient = Dictionary['ingredients'][number];
type Dish = Dictionary['dishes'][number];
type Category = Dictionary['categories'][number];

export interface DictIndex {
  dict: Dictionary;
  ingredients: ReadonlyMap<string, Ingredient>;
  dishes: ReadonlyMap<string, Dish>;
  categories: ReadonlyMap<string, Category>;
  groups: ReadonlyMap<string, Dictionary['ambiguity'][number]>;
  /** Parent ingredients, nearest first (`ing-chicken-thigh` → [`ing-chicken`]). */
  ingredientAncestors(id: string): string[];
  /** Categories of an ingredient, dish or category id by distance: [direct categories, their parents, …]. */
  categoryLevels(id: string): string[][];
  /** True when the id is an ingredient flagged as a seasoning (dictionary §1 rule 8). */
  isSeasoning(id: string): boolean;
  label(id: string, lang: 'ja' | 'en'): string;
}

const cache = new WeakMap<Dictionary, DictIndex>();

export function dictIndex(dict: Dictionary): DictIndex {
  const hit = cache.get(dict);
  if (hit !== undefined) return hit;
  const ingredients = new Map(dict.ingredients.map((i) => [i.id, i] as const));
  const dishes = new Map(dict.dishes.map((d) => [d.id, d] as const));
  const categories = new Map(dict.categories.map((c) => [c.id, c] as const));
  const groups = new Map(dict.ambiguity.map((g) => [g.id, g] as const));

  const ingredientAncestors = (id: string): string[] => {
    const out: string[] = [];
    let current = ingredients.get(id)?.parentIngredientId ?? null;
    while (current !== null && !out.includes(current)) {
      out.push(current);
      current = ingredients.get(current)?.parentIngredientId ?? null;
    }
    return out;
  };

  const categoryLevels = (id: string): string[][] => {
    const dishCategory = dishes.get(id)?.categoryId;
    const direct = ingredients.get(id)?.categoryIds ?? (dishCategory === undefined || dishCategory === null ? [] : [dishCategory]);
    const levels: string[][] = [];
    let current = [...new Set(direct)];
    const seen = new Set<string>();
    while (current.length > 0) {
      levels.push(current);
      current.forEach((c) => seen.add(c));
      const next: string[] = [];
      for (const c of current) {
        const parent = categories.get(c)?.parentId ?? null;
        if (parent !== null && !seen.has(parent) && !next.includes(parent)) next.push(parent);
      }
      current = next;
    }
    return levels;
  };

  const labelOf = (id: string, lang: 'ja' | 'en'): string => {
    const rec: { ja: string; en: string } | undefined = ingredients.get(id) ?? dishes.get(id) ?? categories.get(id);
    return rec === undefined ? id : rec[lang];
  };

  const index: DictIndex = {
    dict,
    ingredients,
    dishes,
    categories,
    groups,
    ingredientAncestors,
    categoryLevels,
    isSeasoning: (id) => ingredients.get(id)?.seasoning === true,
    label: labelOf,
  };
  cache.set(dict, index);
  return index;
}
