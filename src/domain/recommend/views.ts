// What the recommendation, library and plan-date screens list (US-E6-01, US-E6-03/AC3, US-E6-05).
// Pure: the ranker's result, the store and a day viewer go in; ordered lists come out.
import type { DayViewer } from '../calendar/day-view.ts';
import type { DecisionState } from '../decision/decision.ts';
import type { BentoMinderStore } from '../schema/index.ts';
import type { Recipe } from '../schema/recipe.ts';
import type { LocalDate } from '../time/jst.ts';
import type { ExcludedRecipe, RankResult } from './rank.ts';

export interface AllergenSummary {
  /** Allergens the recipe contains (labelled list). */
  allergenIds: string[];
  /** A varies-by-product ingredient exists (no allergen line is claimed for it; the processed warning is separate, ADR 013). */
  varies: boolean;
  /** US-E6-03/AC3: no allergen and nothing varies, so the careful 「使用していません」 wording applies. */
  none: boolean;
}

export function allergenSummary(recipe: Recipe): AllergenSummary {
  const varies = recipe.ingredients.some((i) => i.allergenInfo === 'varies-by-product');
  return {
    allergenIds: recipe.allergenIds,
    varies,
    none: recipe.allergenIds.length === 0 && !varies,
  };
}

/**
 * US-E6-05/AC1, design components 5.2: plannable recipes first in name order (not rank order),
 * then the ones the child's allergens, exclusions or diet rule out, in library order.
 */
export function libraryOrder(result: RankResult): { plannable: Recipe[]; blocked: ExcludedRecipe[] } {
  const plannable = result.all.map((r) => r.recipe).sort((a, b) => (a.nameKana < b.nameKana ? -1 : a.nameKana > b.nameKana ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { plannable, blocked: result.excluded };
}

export interface PlannableDate {
  date: LocalDate;
  /** The decision shown for the date now (null never happens for a listed date). */
  state: DecisionState | null;
}

/**
 * US-E6-05/AC3: every school day and お弁当の日 of any confirmed menu from `today` on that the state
 * machine accepts a recipe for (a new plan or a change). Past dates, dates outside a menu, other
 * no-lunch days and days in an open refresh conflict are not offered because their actions are absent.
 */
export function plannableDates(store: BentoMinderStore, today: LocalDate, view: DayViewer): PlannableDate[] {
  const dates = new Set<LocalDate>();
  for (const entry of Object.values(store.menus)) {
    const menu = entry.confirmed;
    if (menu === null) continue;
    for (const d of menu.days) dates.add(d.date as LocalDate);
    for (const n of menu.noLunchDays) if (n.reason === 'bento-day') dates.add(n.date as LocalDate);
  }
  return [...dates]
    .filter((d) => d >= today)
    .sort()
    .flatMap((date) => {
      const v = view(store, date, today);
      const open = v.actions.includes('bento') || v.actions.includes('plan-bento-day') || v.actions.includes('change-recipe');
      return open ? [{ date, state: v.displayed.state }] : [];
    });
}
