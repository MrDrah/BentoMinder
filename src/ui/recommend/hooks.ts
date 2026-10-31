// Shared state for the recommendation, recipe and library screens: the ranker bound to the shipped
// dictionary and library (tests pass fixtures through the provider), and the one place a recipe is
// confirmed through the decision state machine (BR-02, BR-03, BR-06).
import { useCallback, useMemo, useState } from 'react';
import { createDayViewer } from '../../domain/calendar/day-view.ts';
import { applyDecisionEvent } from '../../domain/decision/apply.ts';
import type { DecisionEvent, RecipeRef } from '../../domain/decision/decision.ts';
import { createRanker, type RankProfile, type RankResult } from '../../domain/recommend/rank.ts';
import type { BentoMinderStore } from '../../domain/schema/index.ts';
import type { Recipe } from '../../domain/schema/recipe.ts';
import type { LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { useApp, useStore } from '../app-store.tsx';
import { navigate } from '../router.ts';

/** Before a profile exists nothing is known, so nothing is filtered (the app opens onboarding first). */
const NO_PROFILE: RankProfile = { likedIds: [], dislikedIds: [], knownAllergenIds: [], excludedIngredientIds: [], diet: [], themeIds: [] };

export const rankProfileOf = (store: BentoMinderStore): RankProfile => store.profile ?? NO_PROFILE;

export function recipeRef(recipe: Recipe): RecipeRef {
  return { id: recipe.id, name: recipe.name, shortNameJa: recipe.shortNameJa, shortNameEn: recipe.shortNameEn };
}

/** The ranking for a date from the stored profile and decisions; `date` only matters for the variety penalty. */
export function useRank(date: LocalDate): RankResult {
  const { services } = useApp();
  const store = useStore();
  const ranker = useMemo(() => createRanker(services.dictionary, services.library), [services.dictionary, services.library]);
  return useMemo(
    () => ranker({ profile: rankProfileOf(store), decisions: Object.values(store.decisions), targetDate: date }),
    [ranker, store, date],
  );
}

/** Which library recipes the child's allergens, exclusions and diet rule out (the same filters as the ranking). */
export function useBlocked(): ReadonlyMap<string, RankResult['excluded'][number]> {
  const { today } = useApp();
  const result = useRank(today);
  return useMemo(() => new Map(result.excluded.map((e) => [e.recipeId, e])), [result]);
}

export function useRecipe(id: string): Recipe | undefined {
  const { services } = useApp();
  return useMemo(() => services.library.find((r) => r.id === id), [services.library, id]);
}

/**
 * US-E5-03/AC2, US-E5-06/AC1, US-E6-05/AC2: CONFIRM_RECIPE for a day with no plan, CHANGE_RECIPE for one
 * already planned. The write is persisted first; only then do the toast and the calendar follow.
 */
export function useConfirmRecipe(): { busyId: string | null; confirm: (date: LocalDate, recipeId: string) => Promise<boolean> } {
  const { services, t, state, today, now, commit, showToast, showSaveFailed } = useApp();
  const store = useStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const viewer = useMemo(() => createDayViewer(services.dictionary), [services.dictionary]);
  const ranker = useMemo(() => createRanker(services.dictionary, services.library), [services.dictionary, services.library]);
  const lang = state.language;

  const confirm = useCallback(
    async (date: LocalDate, recipeId: string): Promise<boolean> => {
      if (busyId !== null) return false;
      const recipe = services.library.find((r) => r.id === recipeId);
      if (recipe === undefined) return false;
      const planned = viewer(store, date, today).displayed.state === 'homemade-bento-planned';
      const event: DecisionEvent = { type: planned ? 'CHANGE_RECIPE' : 'CONFIRM_RECIPE', recipeId };
      const blocked = new Set(ranker({ profile: rankProfileOf(store), decisions: [], targetDate: date }).excluded.map((e) => e.recipeId));
      const result = applyDecisionEvent(store, date, event, {
        today,
        now: now(),
        recipe: (id) => (id === recipe.id ? recipeRef(recipe) : undefined),
        isRecipeAllowed: (id) => !blocked.has(id),
      });
      if (!result.ok) return false;
      setBusyId(recipeId);
      const ok = await commit(result.store);
      setBusyId(null);
      if (ok) {
        showToast(t('day.saved.bento', { date: formatDate(t, lang, date) }));
        navigate({ name: 'day', date });
      } else showSaveFailed();
      return ok;
    },
    [busyId, services.library, viewer, store, today, ranker, now, commit, showToast, showSaveFailed, t, lang],
  );
  return { busyId, confirm };
}
