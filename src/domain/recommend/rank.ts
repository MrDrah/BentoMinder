// Recipe ranking (BR-06, BR-07, BR-09, R-3; ADR 004 §3, ADR 008; data contract §4 `ranking-*`).
// A pure function of the dictionary, the recipe library, the child profile, the planned decisions
// and the target date. No clock, no randomness, no network: same input, same output.
import { BR09 } from '../rules.ts';
import { dictIndex, type DictIndex } from '../assessment/dictionary-index.ts';
import { DIET_FORBIDDEN_TAGS, type AnimalTag, type Diet } from '../schema/primitives.ts';
import type { ChildProfile } from '../schema/profile.ts';
import type { DayDecision } from '../schema/decision.ts';
import type { Dictionary } from '../schema/dictionary.ts';
import type { Recipe } from '../schema/recipe.ts';
import { diffDays, localDate, type LocalDate } from '../time/jst.ts';

export type RankProfile = Pick<
  ChildProfile,
  'likedIds' | 'dislikedIds' | 'knownAllergenIds' | 'excludedIngredientIds' | 'diet' | 'themeIds'
>;
export type PlannedDecision = Pick<DayDecision, 'date' | 'state' | 'recipeId'>;

export interface RankInput {
  profile: RankProfile;
  /** Stored decisions; only `homemade-bento-planned` ones with a recipe count for the variety penalty. */
  decisions: readonly PlannedDecision[];
  targetDate: LocalDate;
}

export type ExclusionReason =
  | { kind: 'allergen'; allergenIds: string[] } // F1
  | { kind: 'excluded-ingredient'; ids: string[] } // F2 (ids = the profile entries that matched)
  | { kind: 'diet'; diets: Diet[]; tags: AnimalTag[] } // F3
  | { kind: 'diet-incomplete' } // F3, unknown animal origin while a diet is selected
  | { kind: 'allergen-incomplete' }; // F4 (R-3)

/** Explanation keys with params; src/i18n renders them (US-E6-01/AC2: a card shows at most 2). */
export type RankReason =
  | { key: 'rank.liked'; params: { id: string } }
  | { key: 'rank.theme'; params: { themeId: string } }
  | { key: 'rank.quick'; params: { minutes: number } };

export interface RankedRecipe {
  recipeId: string;
  recipe: Recipe;
  score: number;
  /** R-3: false when allergen data is incomplete (ranked after every complete recipe). */
  complete: boolean;
  /** US-E6-02/AC4: the recipe has a varies-by-product ingredient. */
  checkLabel: boolean;
  reasons: RankReason[];
  parts: { liked: number; disliked: number; theme: boolean; recentlyPlanned: boolean; slow: boolean };
}

export interface ExcludedRecipe {
  recipeId: string;
  recipe: Recipe;
  reasons: ExclusionReason[];
}

export interface RankResult {
  /** The first 3 of `all`. */
  suggestions: RankedRecipe[];
  /** The whole filtered, ordered list (「ほかのレシピ」). */
  all: RankedRecipe[];
  excluded: ExcludedRecipe[];
}

export type Ranker = (input: RankInput) => RankResult;

interface Food {
  rep: string;
  members: string[];
}

const MAX_REASONS = 2;

/** Foods of a recipe: ingredient ids, distinct; an ancestor folds into each found descendant (never transitive). */
function foodsOf(recipe: Recipe, idx: DictIndex): Food[] {
  const ids = [...new Set(recipe.ingredients.map((i) => i.ingredientId))];
  const present = new Set(ids);
  const folded = new Set<string>();
  const foldedInto = new Map<string, string[]>();
  for (const x of ids) {
    for (const a of idx.ingredientAncestors(x)) {
      if (present.has(a)) {
        folded.add(a);
        foldedInto.set(x, [...(foldedInto.get(x) ?? []), a]);
      }
    }
  }
  return ids.filter((id) => !folded.has(id)).map((id) => ({ rep: id, members: [id, ...(foldedInto.get(id) ?? [])] }));
}

/** Verdict by the most specific profile entry (ingredient, parents, categories); a dislike beats a like at one level. */
function verdictOf(food: Food, idx: DictIndex, likes: ReadonlySet<string>, dislikes: ReadonlySet<string>): 'like' | 'dislike' | null {
  const levels: string[][] = [food.members];
  // a seasoning hits only when named exactly
  if (!(food.members.length === 1 && idx.isSeasoning(food.rep))) {
    const ancestors = food.members.map((m) => idx.ingredientAncestors(m));
    const depth = Math.max(0, ...ancestors.map((a) => a.length));
    for (let d = 0; d < depth; d += 1) levels.push(ancestors.flatMap((a) => (a[d] === undefined ? [] : [a[d] as string])));
    const catLevels = food.members.map((m) => idx.categoryLevels(m));
    const catDepth = Math.max(0, ...catLevels.map((l) => l.length));
    for (let d = 0; d < catDepth; d += 1) levels.push(catLevels.flatMap((l) => l[d] ?? []));
  }
  for (const level of levels) {
    if (level.some((id) => dislikes.has(id))) return 'dislike';
    if (level.some((id) => likes.has(id))) return 'like';
  }
  return null;
}

export function createRanker(dict: Dictionary, library: readonly Recipe[]): Ranker {
  const idx = dictIndex(dict);
  const foods = new Map<string, Food[]>();
  const foodsFor = (r: Recipe): Food[] => {
    let f = foods.get(r.id);
    if (f === undefined) {
      f = foodsOf(r, idx);
      foods.set(r.id, f);
    }
    return f;
  };

  /** F2: the profile entries matching an ingredient of the recipe, its parents, categories or their parents. */
  const exclusionHits = (r: Recipe, excluded: ReadonlySet<string>): string[] => {
    const hit = new Set<string>();
    for (const ing of r.ingredients) {
      const self = [ing.ingredientId, ...idx.ingredientAncestors(ing.ingredientId)];
      const related = [...self, ...self.flatMap((x) => idx.categoryLevels(x).flat())];
      for (const x of related) if (excluded.has(x)) hit.add(x);
    }
    return [...hit].sort();
  };

  return function rank({ profile, decisions, targetDate }) {
    const known = new Set(profile.knownAllergenIds);
    const excludedIds = new Set(profile.excludedIngredientIds);
    const likes = new Set(profile.likedIds);
    const dislikes = new Set(profile.dislikedIds);
    const themes = new Set(profile.themeIds);
    const diets = [...new Set(profile.diet)];

    const plannedNear = new Set<string>();
    for (const d of decisions) {
      if (d.state !== 'homemade-bento-planned' || d.recipeId === undefined || d.date === targetDate) continue;
      if (Math.abs(diffDays(localDate(d.date), targetDate)) <= BR09.recentWindowDays) plannedNear.add(d.recipeId);
    }

    const excluded: ExcludedRecipe[] = [];
    const ranked: RankedRecipe[] = [];
    for (const recipe of library) {
      const reasons: ExclusionReason[] = [];
      const allergenHits = [...new Set([...recipe.allergenIds, ...recipe.mayContainAllergenIds])].filter((a) => known.has(a)).sort();
      if (allergenHits.length > 0) reasons.push({ kind: 'allergen', allergenIds: allergenHits });
      const exHits = excludedIds.size === 0 ? [] : exclusionHits(recipe, excludedIds);
      if (exHits.length > 0) reasons.push({ kind: 'excluded-ingredient', ids: exHits });
      if (diets.length > 0) {
        const forbidden = new Set(diets.flatMap((d) => DIET_FORBIDDEN_TAGS[d]));
        const tags = recipe.animalOrigin.filter((t) => forbidden.has(t));
        if (tags.length > 0) {
          reasons.push({ kind: 'diet', diets: diets.filter((d) => DIET_FORBIDDEN_TAGS[d].some((t) => tags.includes(t))), tags });
        }
        if (!recipe.dietDataComplete) reasons.push({ kind: 'diet-incomplete' });
      }
      if (!recipe.allergenDataComplete && known.size > 0) reasons.push({ kind: 'allergen-incomplete' });
      if (reasons.length > 0) {
        excluded.push({ recipeId: recipe.id, recipe, reasons });
        continue;
      }

      const liked: string[] = [];
      let dislikedCount = 0;
      for (const food of foodsFor(recipe)) {
        const verdict = verdictOf(food, idx, likes, dislikes);
        if (verdict === 'like') liked.push(food.rep);
        else if (verdict === 'dislike') dislikedCount += 1;
      }
      const theme = recipe.themeId !== null && themes.has(recipe.themeId);
      const recentlyPlanned = plannedNear.has(recipe.id);
      const slow = recipe.minutes > BR09.slowRecipeAboveMinutes;
      const score =
        liked.length * BR09.perLikedId +
        (theme ? BR09.themeMatch : 0) +
        dislikedCount * BR09.perDislikedId +
        (recentlyPlanned ? BR09.recentlyPlanned : 0) +
        (slow ? BR09.slowRecipe : 0);
      const why: RankReason[] = [
        ...liked.map((id): RankReason => ({ key: 'rank.liked', params: { id } })),
        ...(theme && recipe.themeId !== null ? [{ key: 'rank.theme', params: { themeId: recipe.themeId } } as RankReason] : []),
        ...(!slow ? [{ key: 'rank.quick', params: { minutes: recipe.minutes } } as RankReason] : []),
      ].slice(0, MAX_REASONS);
      ranked.push({
        recipeId: recipe.id,
        recipe,
        score,
        complete: recipe.allergenDataComplete,
        checkLabel: recipe.ingredients.some((i) => i.allergenInfo === 'varies-by-product'),
        reasons: why,
        parts: { liked: liked.length, disliked: dislikedCount, theme, recentlyPlanned, slow },
      });
    }
    ranked.sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        b.score - a.score ||
        a.recipe.minutes - b.recipe.minutes ||
        (a.recipeId < b.recipeId ? -1 : a.recipeId > b.recipeId ? 1 : 0),
    );
    return { suggestions: ranked.slice(0, BR09.topCount), all: ranked, excluded };
  };
}
