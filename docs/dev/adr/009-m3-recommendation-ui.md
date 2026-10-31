# ADR-009: M3 recommendation, recipe and library UI

Status: **accepted** · 2026-10-31 · Owner: Developer · Builds on ADR-008 (ranking) and ADR-004 §2 (decision state machine)

Rules source: BR-02, BR-03, BR-06, BR-07, BR-09, US-E5-03, US-E6-01 to E6-06; design/components.md §4, §5; design/copy.md §11, §12.

## Decisions
1. **One write path.** `useConfirmRecipe` (src/ui/recommend/hooks.ts) is the only place a recipe is chosen: CONFIRM_RECIPE for a day with no plan, CHANGE_RECIPE for a planned one, through `applyDecisionEvent`, with `isRecipeAllowed` fed by the ranker's own filters (BR-06 "never plannable"). It commits first; the toast and the move to the calendar (`#/day/<date>`, sheet open) follow only after a successful save. Opening, reading and leaving a recommendation or recipe writes nothing.
2. **Library is data, not code.** `src/ui/library.ts` binds `data/library.json` (like the dictionary); `AppServices.library` lets tests pass the synthetic fixture. The ranker is rebuilt from `services.dictionary` and `services.library` only.
3. **Pure lists in the domain.** `src/domain/recommend/views.ts`: `allergenSummary` (US-E6-03/AC3 wording rule), `libraryOrder` (plannable by name, then blocked), `plannableDates` (asks the day viewer which dates accept CONFIRM/CHANGE, so the picker can never offer a date the state machine would refuse: past, no-lunch, outside the menu, open refresh conflict).
4. **Routes.** `#/recommend/<date>`, `#/recipe/<id>[?date=]` (context date), `#/recipes` (library). AC US-E6-04/AC3 writes `/recipes/<id>`; the app keeps its hash-router form `#/recipe/<id>` (ADR-001). Test ids follow components.md; card ids are 0-based (`rec-card-0` is rank 1), rows of 「ほかのレシピ」 are `rec-row-<i>`.
5. **Detail footer by context** (components 5.1): library → `recipe.planPick` (disabled with `library.conflict.cantPlan` when blocked); from a card or a day → `rec.confirm`; planned here → change recipe plus back-to-school or clear-plan with the existing confirm dialogs; past day → none.
6. **Missing recipe (US-E6-06).** The day sheet checks `record.recipeId` against `services.library`; when absent it shows the stored name, `day.recipeMissing`, drops 「レシピを見る」 and relabels change-recipe `day.recipeMissing.action` (primary). The record is never touched.
7. **「ほかのレシピ」** is offered only when the full list is longer than the cards shown (a button revealing the same cards would do nothing).
8. **Unit words.** The copy sheet has no unit rows; `qty.*` catalog keys use the unit words of data contract §3.7 (ja) and plain English equivalents. Flagged to the Orchestrator for the designer to confirm.
9. **Credit link.** `recipe.safety.credit` links to the recipe's own maff.go.jp source when it has one, else to `https://www.maff.go.jp/j/syouan/seisaku/foodpoisoning/lunchbox.html` (the page cited in the shipped library).

## Revisit when
- The library grows large: virtualise the library list and the 「ほかのレシピ」 list.
- Illustrations arrive: `RecipeArt` is a decorative placeholder panel (stripe band) by design.
