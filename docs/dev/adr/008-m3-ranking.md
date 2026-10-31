# ADR-008: M3 ranking engine

Status: **accepted** · 2026-10-31 · Owner: Developer · Extends ADR-004 §3

Rules source: BR-06, BR-07, BR-09, R-3, PLAN §7 rulings B1, B2, B14; `tests/oracle/ranking-oracle.md`; contract §4 `ranking-*`.

## Decisions
1. **Shape.** `createRanker(dict, library)` returns `rank({ profile, decisions, targetDate })` in `src/domain/recommend/rank.ts`. Dictionary, library, profile, decisions and date are all arguments; no clock, no randomness. Result: `{ suggestions (first 3), all (ordered), excluded[{ reasons }] }`.
2. **Filters F1-F4** run on the recipe's derived fields (`allergenIds`, `mayContainAllergenIds`, `animalOrigin`, `dietDataComplete`, `allergenDataComplete`), not on the dictionary, so the shipped recipe data is the single source. F2 uses the dictionary only for ancestors (parent ingredients, categories, parent categories). Every failing filter adds a reason, so both diet reasons can appear together. F4 triggers on `knownAllergenIds` only (an exclusion alone does not).
3. **Foods for scoring** reuse the assessment rule: distinct ingredient ids, an ancestor folds into each found descendant (never transitive), most specific profile entry wins (ingredient, parents, categories), a dislike beats a like at the same level, a seasoning hits only when named exactly. The verdict function is a small local copy, not an export of `assess.ts`, to keep the assessment module untouched; if the two ever diverge the random comparison (oracle §5) will catch it. Revisit: extract one shared function when the next rule touches both.
4. **Score** terms come from `BR09` in `rules.ts`. The variety penalty counts only `homemade-bento-planned` decisions on another date within 14 days either side, once per recipe.
5. **Order**: complete first, score desc, minutes asc, id asc (plain string compare; ids are ASCII). Input order never matters.
6. **Explanations** are keys with params (`rank.liked`, `rank.theme`, `rank.quick`), at most 2 per card, liked foods first, then theme, then quick (minutes <= 20). Strings are rendered by the UI copy module later. `checkLabel` and `complete` flags carry the AC4/AC5 notes.
7. **Excluded list** keeps library order and carries `recipe` and `reasons`; the library screen decides how to grey and sort it.
8. **Test data.** `tests/fixtures/recipes/synthetic-library*.json` are generated from `docs/dev/_scratch/gen-synthetic.mjs`, all records `"synthetic": true`, tags pinned in `diet-tags-pinned.json`. They are imported only by tests; `src/` never references them and the build bundle is checked for `rcp-syn-`.

## Revisit when
- A rule needs recipe-level scoring beyond BR-09 (e.g. seasonal bonus): add a term in `rules.ts`, not a policy object.
- The library grows past a few hundred recipes: precompute foods at load (already cached per recipe id).
