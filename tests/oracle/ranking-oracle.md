# Ranking oracle (BR-06, BR-07, BR-09, OQ-13, processed-food rule 2026-11-01) — specification

> **Amended 2026-11-01 (QA, processed-food allergen rule, PLAN section 7).** Sections 1a and 7 are the current rule. Where section 1 below still names F1 (may-contain), F4 or the "complete first" order, read 1a: those items were replaced. The hand cases K1-K23 keep their original text for history; the cells that changed are listed with recomputed values in 7.3.

Owner: QA · 2026-10-24 · Status: **H1 oracle-ready** (rulings B1, B2, B14 of `docs/PLAN.md` §7, 2026-10-24, applied) · Stories: US-E6-01, US-E6-02, US-E1-03/AC2, AC5, US-E1-04, US-E1-05/AC2, US-E6-05/AC1

Sources: `docs/PLAN.md` §3 BR-06/BR-09 and §7 R-3, the E6 ranking and hard-filter paragraphs in `docs/ba/user-stories.md` (H1 final), `docs/ba/data-contract.md` §3.7, §3.8 and §4 (`ranking-hard-filter`, `ranking-incomplete-allergen`), dictionary H1 final.

## 1. The rule, restated independently
For a child profile, a target date `t` and the planned decisions:

1. **Hard filters (any one excludes):**
   - F1 any id in `allergenIds ∪ mayContainAllergenIds` is in `knownAllergenIds`;
   - F2 any ingredient id, or one of its dictionary ancestors (parent ingredient, category, parent category), is in `excludedIngredientIds`;
   - F3 a selected diet is violated (ruling B14, PLAN §7; contract §3.8 H1 final): the recipe's `animalOrigin` (union of its ingredients' `animalOrigin` tags) contains a tag the diet forbids — vegetarian {meat, pork, beef, chicken, fish-seafood, gelatin}; pescatarian {meat, pork, beef, chicken, gelatin}; no-pork {pork, meat, gelatin}; no-beef {beef, meat}; no-seafood {fish-seafood} — **or** `dietDataComplete = false` (an ingredient with `animalOriginKnown = false`) while ≥ 1 diet is selected (reason `diet-incomplete`). Tags are explicit (no tag implies another; `meat` = species not stated). Allergen ids and categories are **not** used by F3; when both F3 reasons apply the oracle reports both and the comparison checks the set of reasons;
   - F4 `allergenDataComplete = false` **and** `knownAllergenIds` is non-empty (R-3).
2. **Score** (survivors only): `+2` per distinct liked id found in the recipe, `+1` if `themeId` ∈ child's themes, `−3` per distinct disliked id found, `−2` once if the same recipe is `homemade-bento-planned` on any **other** date `d` with `|d − t| ≤ 14` days, `−1` if `minutes > 20`. "Found ids" and hits follow the assessment oracle §1 step 2 (same B1/B2 caveat); seasonings hit only when named exactly.
3. **Order**: complete recipes before incomplete ones (R-3), then score descending, then `minutes` ascending, then `id` ascending (code-point order). Suggestions = first 3; 「ほかのレシピ」 = the whole ordered list; excluded recipes never appear in either.
4. **Always**: the disclaimer on every recommendation view (BR-07); the unknown-allergy banner when `allergyStatus = unknown` (US-E1-03/AC5); the "check the label" note on recipes with a varies-by-product ingredient (US-E6-02/AC4); the incomplete-data note on incomplete recipes (US-E6-02/AC5).

## 1a. The rule as of 2026-11-01 (replaces F1, F4 and the order of section 1; everything else in section 1 stands)
Sources: E6 preamble, US-E6-02/AC9-AC16, US-E6-03/AC4-AC5, US-E6-04/AC4-AC6, US-E1-03/AC7, data contract 3.7a and rules `ranking-hard-filter`, `ranking-processed-warning`, dictionary section 11.

1. **F1'' (allergen exclusion)**: a recipe is excluded when a registered allergen (`knownAllergenIds`) is in the recipe's `allergenIds` (valid data already holds the inherent ids of every ingredient, rule `recipe-ingredient-inherent-allergen`; checked as an oracle precondition on the real library) **or** the recipe has an ingredient whose dictionary `allergenGroupIds` names a group (`grp-fish` = {alg-salmon, alg-mackerel}) and a member of that group is registered. The reason names the child's own allergen, never the group. `alg-salmon-roe` is not a member. **`mayContainAllergenIds`, `possibleAllergenIds` (brand-label data) and `allergenDataComplete` are never read.**
2. **F4 is retired**: no exclusion and no demotion for incomplete allergen data. The "complete first" ordering tier is retired.
3. **Order**: score descending, `minutes` ascending, `id` ascending. Scores, F2 (excluded ingredients) and F3 (diets) are unchanged.
4. **Processed-food warning** (`processedWarning`): `null` when `knownAllergenIds` is empty (none-known, unknown, or has-known with only excluded ingredients) or the recipe has no processed ingredient; otherwise the child's FULL list in registered order plus the recipe's distinct ingredient ids whose dictionary `info` is `varies`, in recipe order. The trigger is the dictionary, never the recipe's `allergenInfo`. Excluded recipes carry no warning (they are not in the list).
5. Always: the disclaimer on every view (BR-07); the unknown-allergy banner when `allergyStatus = unknown` (neither replaced nor suppressed by the warning).

## 2. Synthetic fixture library (`tests/fixtures/recipes/synthetic-library.json`, built in M3)
**SYNTHETIC — made-up recipes for testing the ranking only. Never shipped, never shown as real recipes, no sources.** Every record carries `"synthetic": true`. Allergen fields are derived from the H1 dictionary (e.g. みかん → `alg-orange`, contract rule `recipe-allergen-union`).

| Key | id | Ingredients (dictionary ids; `v:` = varies-by-product with its `possibleAllergenIds`; `u:` = allergenInfo unknown) | allergenIds | mayContainAllergenIds | complete | min | theme |
|-----|----|------------------------------------|-------------|-----------------------|----------|-----|-------|
| A | rcp-syn-a-tamago | ing-rice, ing-egg, ing-sugar, ing-spinach | egg | – | ✔ | 15 | – |
| B | rcp-syn-b-karaage | ing-rice, ing-chicken-thigh, ing-wheat-flour, ing-ginger, v:ing-soy-sauce [wheat, soybean] | chicken, wheat | wheat, soybean | ✔ | 25 | animals |
| C | rcp-syn-c-salmon | ing-rice, ing-salmon, ing-broccoli, ing-sesame | salmon, sesame | – | ✔ | 20 | sea |
| D | rcp-syn-d-sausage | v:ing-bread [wheat, milk, egg, soybean], v:ing-sausage [pork, milk, soybean], ing-cherry-tomato, ing-lettuce | – | wheat, milk, egg, soybean, pork | ✔ | 10 | vehicles |
| E | rcp-syn-e-veggie | ing-rice, ing-corn, ing-carrot, ing-nori, ing-salt | – | – | ✔ | 10 | flowers |
| F | rcp-syn-f-hamburg | ing-ground-mixed, ing-onion, v:ing-bread-crumbs [wheat], ing-egg, v:ing-ketchup [apple] | beef, pork, egg | wheat, apple | ✔ | 30 | stars |
| G | rcp-syn-g-tofu | ing-rice, ing-tofu, ing-carrot, ing-green-pepper, v:ing-dashi [soybean, wheat] | soybean | soybean, wheat | ✔ | 20 | – |
| H | rcp-syn-h-pork | ing-pork, ing-ginger, ing-cabbage, ing-rice, v:ing-soy-sauce [wheat, soybean] | pork | wheat, soybean | ✔ | 20 | – |
| I | rcp-syn-i-shrimp | ing-shrimp, ing-wheat-flour, ing-egg, v:ing-bread-crumbs [wheat, milk], ing-rice | shrimp, wheat, egg | wheat, milk | ✔ | 35 | sea |
| J | rcp-syn-j-macaroni | v:ing-macaroni (inherent wheat) [egg], v:ing-cheese (inherent milk) [milk], v:ing-ham [pork, milk, soybean], ing-broccoli | wheat, milk | egg, milk, pork, soybean | ✔ | 15 | rainbow |
| K | rcp-syn-k-jelly | ing-rice, ing-nori, ing-gelatin, ing-mandarin, ing-sugar | gelatin, orange | – | ✔ | 10 | seasonal |
| L | rcp-syn-l-chikuwa | v:ing-chikuwa [wheat, egg], ing-cucumber, ing-rice, ing-nori | – | wheat, egg | ✔ | 10 | vehicles |
| M | rcp-syn-m-corn-curry | ing-rice, ing-corn, ing-potato, u:ing-curry-roux | – | – | ✘ | 15 | animals |

(Allergen ids written without the `alg-` prefix; themes without `theme-`.)

**Origin tags used by the synthetic cases** = the dictionary's H1-final `animalOrigin` values (`docs/ba/domain-dictionary.md`, 2026-10-24), pinned in the fixture overlay `tests/fixtures/dictionary/diet-tags-pinned.json` so these hand-computed cases do not move if the BA later refines a tag (a transcription test reports any drift from the real dictionary). `?` = `animalOriginKnown: false`; `–` = no animal origin.

| Ingredient | animalOrigin | Ingredient | animalOrigin |
|------------|--------------|------------|--------------|
| ing-egg | egg | ing-chicken-thigh | chicken |
| ing-salmon | fish-seafood | ing-shrimp | fish-seafood |
| ing-bread | dairy, egg, **?** | ing-bread-crumbs | dairy, egg, **?** |
| ing-sausage (ウインナー) | meat, pork | ing-ham | meat, pork |
| ing-ground-mixed | beef, pork | ing-pork | pork |
| ing-macaroni | – | ing-cheese | dairy |
| ing-gelatin | gelatin | ing-chikuwa | fish-seafood |
| ing-dashi (だし) | fish-seafood, **?** | ing-curry-roux (カレールウ) | meat, pork, beef, chicken, dairy, **?** |
| ing-consomme (コンソメ) | beef, chicken, pork, **?** | every other ingredient in §2 and §3b (rice, sugar, spinach, wheat-flour, ginger, soy-sauce, broccoli, sesame, cherry-tomato, lettuce, corn, carrot, nori, salt, onion, ketchup, tofu, green-pepper, cabbage, mandarin, cucumber, potato, kombu) | – |

Per recipe: A {egg}; B {chicken}; C {fish-seafood}; **D incomplete** (bread ?) {dairy, egg, meat, pork}; E {}; **F incomplete** (bread crumbs ?) {beef, pork, dairy, egg}; **G incomplete** (dashi ?) {fish-seafood}; H {pork}; **I incomplete** (bread crumbs ?) {fish-seafood, egg, dairy}; J {dairy, meat, pork}; K {gelatin}; L {fish-seafood}; **M incomplete** (curry roux ?) {meat, pork, beef, chicken, dairy}.

Diet exclusions derived once (F3): vegetarian excludes B, C, D, F, G, H, I, J, K, L, M → survivors A, E; pescatarian excludes B, D, F, G, H, I, J, K, M → survivors A, C, E, L; no-pork excludes D, F, G, H, I, J, K, M → survivors A, B, C, E, L; no-beef excludes D, F, G, I, J (meat), M → survivors A, B, C, E, H, K, L; no-seafood excludes C, D, F, G, I, L, M → survivors A, B, E, H, J, K. (`diet-incomplete` applies to D, F, G, I, M for every diet.)

## 3. Hand-computed cases
Target date 2026-11-18 (Wed) and no planned decisions unless the case says otherwise. "Score" lists survivors as key:score. Expected top 3 in order; "Full" is the 「ほかのレシピ」 order.

| # | Profile | Excluded (why) | Scores | Expected top 3 | Full order / notes | Covers |
|---|---------|----------------|--------|----------------|--------------------|--------|
| K1 | **Sample child**: likes ing-chicken, ing-egg, ing-corn; dislikes ing-green-pepper, ing-eggplant, cat-fish; known [shrimp]; theme animals | I (F1 shrimp), M (F4) | A2 B2 C−3 D0 E2 F1 G−3 H0 J0 K0 L0 | **E, A, B** | E A B F D K L J H C G. Ties at 2 broken by minutes (10, 15, 25) | US-E0-01/AC1, US-E6-01/AC1, tie-break |
| K2 | Neutral: no likes/dislikes, none-known, no themes, no diet | – | B−1 F−1 I−1, all others 0 (M 0, incomplete) | **D, E, K** | D E K L A J C G H B F I **M** (M last: incomplete) | id tie-break among 10-minute recipes; R-3 ordering |
| K3 | known [egg]; likes ing-chicken; theme animals | A, D, F, I, J, L (F1 egg incl. may-contain), M (F4) | B2 C0 E0 G0 H0 K0 | **B, E, K** | B E K C G H | US-E6-02/AC1, may-contain excludes |
| K4 | known [milk] only | D, I, J (may-contain milk), M (F4) | B−1 F−1, others 0 | **E, K, L** | E K L A C G H B F | may-contain only (OQ-13) |
| K5 | known [pork] (variable processed food); likes ing-egg | D, J (possible pork), F, H, M | A2 I1 B−1 C0 E0 G0 K0 L0 | **A, I, E** | A I E K L C G B | US-E6-02/AC4 (possibleAllergenIds) |
| K6 | known [wheat, soybean]; dislikes ing-spinach | B, D, F, G, H, I, J, L, M | A−3 C0 E0 K0 | **E, K, C** | E K C A | allergen pair; dislike is a penalty, not a filter |
| K7 | known = all 29 ids of `caa-2026-04` | everything except E | E0 | **E** (1 result, 「条件に合うレシピは1件です」) | E | fewer than 3 (US-E6-01/AC4 generalised) |
| K8 | known [egg, wheat, salmon] | A, B, C, D, F, G, H, I, J, L, M | E0 K0 | **E, K** (「条件に合うレシピは2件です」) | E K | US-E6-01/AC4 exactly 2 |
| K9 | diet vegetarian; known [egg, soybean]; excluded [ing-corn] | all (A egg, E corn, G soybean, M F4, rest diet) | – | **none** → empty state with 「プロフィールを見直す」「レシピ一覧を見る」; decision unchanged | – | US-E6-01/AC5 |
| K10 | likes cat-meat; excluded [ing-tomato] (allergy `has-known` via exclusion only, knownAllergenIds empty) | D (ing-cherry-tomato is a child of ing-tomato) | A0 B1 C0 E0 F1 G0 H2 I−1 J2 K0 L0 M0 | **J, H, B** | J H B F E K L A C G I **M** | US-E6-02/AC2 (child id), category like incl. processed meat; M kept (no known allergens) |
| K11 | diet [no-pork, no-beef]; likes ing-salmon; theme sea; none-known | D, F, G, I, M (`diet-incomplete`; D, F, M also forbidden tags), H (pork), J (meat, pork), K (gelatin) | A0 B−1 C3 E0 L0 | **C, E, L** | C E L A B | US-E1-04/AC1, AC2. C = +2 salmon +1 sea = 3 (20 min, no penalty); B = −1 (25 min); zeros by minutes E10, L10, A15. Recomputed for B14 (G and I now excluded as `diet-incomplete`) |
| K12 | diet vegetarian; likes ing-carrot; dislikes ing-green-pepper; none-known | B, C, D, F, H, I, J, K, L, **G (dashi: fish-seafood + `diet-incomplete`)**, **M (curry roux: `diet-incomplete` + meat)** | A0 E2 | **E, A** (「条件に合うレシピは2件です」) | E A | US-E1-04/AC4. **Resolved by B14**: E = +2 carrot (10 min); A = 0 (15 min); G, which held the disliked pepper, is excluded through its dashi |
| K13 | K1 + E planned on 2026-11-04 (14 days before) | as K1 | as K1 but E0 | **A, B, F** | A B F D E K L J H C G | variety −2 at the 14-day boundary (US-E6-01/AC3) |
| K14 | K1 + E planned on 2026-11-03 (15 days before) | as K1 | as K1 | **E, A, B** | as K1 | outside the window |
| K15 | K1 + E planned on 2026-11-18 itself (parent is changing that day's recipe) | as K1 | as K1 | **E, A, B** | as K1 | "any **other** date" |
| K16 | K1 + E planned on 2026-12-02 (14 days after) **and** 2026-11-11 | as K1 | E 2−2 = 0 (penalty applied once) | **A, B, F** | A B F D E K L J H C G | window after `t`; penalty not cumulative |
| K17 | allergy `unknown`; theme vehicles; no likes | – (no known allergens) | D1 L1 B−1 F−1 I−1 others 0 | **D, L, E** | D L E K A J C G H B F I **M** | unknown-allergy banner + disclaimer (US-E1-03/AC5); theme term |
| K18 | likes cat-grain; none-known | – | A2 B3 C2 D2 E2 F1 G2 H2 I5 J2 K2 L2 M2 | **I, B, D** | I B D E K L A J C G H F **M** | **Resolved by B1** (distinct found ids): I = rice + wheat-flour + bread-crumbs = 3 × 2 − 1 (35 min) = 5; B = rice + wheat-flour = 4 − 1 (25 min) = 3; F = bread-crumbs 2 − 1 (30 min) = 1; the 2s by minutes D10, E10, K10, L10, A15, J15, C20, G20, H20 |
| K19 | excluded [cat-seafood]; dislikes cat-dairy; none-known | I | B−1 F−1 J−3 others 0 | **D, E, K** | D E K L A C G H B F J **M** | category exclusion; dislike penalty keeps J listed |
| K20 | diet vegetarian; excluded [ing-carrot]; likes ing-corn; none-known | B, C, D, F, G, H, I, J, K, L, M (diet; G via dashi, M via curry roux), E (carrot) | A0 | **A** (「条件に合うレシピは1件です」) | A | Recomputed for B14: M (corn +2, incomplete) was the second result before the ruling and is now excluded (`diet-incomplete`, curry roux). R-3 "flagged and last" stays covered by K2, K10, K17, K21 |
| K21 | likes ing-corn, ing-potato; theme animals; none-known | – | M = 2+2+1 = 5 (highest); E2; B 1−1 = 0; F−1 I−1; others 0 | **E, D, K** | E D K L A J C G H B F I **M** | US-E6-02/AC5 headline: highest score but incomplete → after every complete recipe |
| K22 | same likes as K21; known [shrimp] | I, M (F4) | as K21 without I, M | **E, D, K** | E D K L A J C G H B F | US-E6-02/AC6: M absent from suggestions and 「ほかのレシピ」, listed last and greyed in 「レシピ一覧」 with 「この日に決定」 disabled |
| K23 | likes cat-grain; dislikes ing-rice; none-known | – | A−3 B−2 C−3 D2 E−3 F1 G−3 H−3 I0 J2 K−3 L−3 M−3 | **D, J, F** | D J F I B E K L A C G H **M** | **B2**: rice hits dislike `ing-rice` (itself) and like `cat-grain` (its category) → disliked only, −3 instead of +2. I = flour 2 + crumbs 2 − rice 3 − 1 (35 min) = 0; B = flour 2 − rice 3 − 1 (25 min) = −2; F = crumbs 2 − 1 = 1; D, J = 2 (10 vs 15 min); the −3s by minutes E10, K10, L10, A15, C20, G20, H20; M last (incomplete) |

**23 cases** (K23 added for B2; K11, K12, K18, K20 resolved or recomputed at the H1 rulings), 19 distinct child profiles (K1, K13–K16 share one), covering: every filter F1–F4, may-contain, variable processed food, child-id exclusion, category exclusion, every diet value, incomplete data both ways, every score term, both variety boundaries, ties on score and on minutes, 0/1/2/3 results.

### 3b. Hidden animal sources (ruling B14) — mini library `tests/fixtures/recipes/synthetic-library-diet.json`
**SYNTHETIC**, `"synthetic": true`, never shipped. Kept apart from §2 so K1–K23 keep their orders. All seven recipes have `allergenDataComplete = true` and no theme; the profiles have no likes, dislikes, themes or known allergens, so every score is 0 and the order is minutes, then id. Tags as in §2. n2 and n3 model a recipe whose cited source states the product's ingredients, so the recipe ingredient has `animalOriginKnown = true` (tags copied from the dictionary, none removed: contract `recipe-ingredient-animal-origin`).

| Key | id | Ingredients | Hidden source → recipe `animalOrigin` | complete for diets | min |
|-----|----|-------------|------------------------------------------|--------------------|-----|
| n1 | rcp-syn-n1-dashi | ing-rice, ing-tofu, ing-spinach, ing-dashi (unknown product) | だし → {fish-seafood} | ✘ (`?`) | 10 |
| n2 | rcp-syn-n2-katsuodashi | ing-rice, ing-tofu, ing-spinach, ing-dashi (source: かつおだし, `animalOriginKnown` true) | だし → {fish-seafood} | ✔ | 10 |
| n3 | rcp-syn-n3-consomme | ing-rice, ing-cabbage, ing-carrot, ing-consomme (source states the product, known) | コンソメ → {beef, chicken, pork} | ✔ | 15 |
| n4 | rcp-syn-n4-curry | ing-rice, ing-potato, ing-carrot, ing-curry-roux (unknown product) | カレールウ → {meat, pork, beef, chicken, dairy} | ✘ (`?`) | 15 |
| n5 | rcp-syn-n5-wiener | ing-rice, ing-sausage, ing-broccoli | ウインナー → {meat, pork} | ✔ | 10 |
| n6 | rcp-syn-n6-kombu | ing-rice, ing-kombu, ing-carrot | none (こんぶ is seaweed, `–`) | ✔ | 15 |
| n7 | rcp-syn-n7-plain | ing-rice, ing-corn, ing-nori | none | ✔ | 10 |

| # | Diet | Excluded (why) | Expected order (= 「ほかのレシピ」) | Top 3 | Covers |
|---|------|----------------|-------------------------------------|-------|--------|
| H1 | vegetarian | n1, n4 (`diet-incomplete`); n2 (fish-seafood); n3 (beef, chicken, pork); n5 (meat, pork) | n7 (10), n6 (15) | **n7, n6** (2件) | all four hidden sources; kombu allowed |
| H2 | pescatarian | n1, n4 (`diet-incomplete`); n3; n5 (meat) | n2, n7 (10, by id), n6 (15) | **n2, n7, n6** | stated かつおだし allowed; same dashi with unknown product excluded |
| H3 | no-pork | n1, n4 (`diet-incomplete`); n3 (pork); n5 (pork, meat) | n2, n7, n6 | **n2, n7, n6** | コンソメ and ウインナー as hidden pork |
| H4 | no-beef | n1, n4 (`diet-incomplete`); n3 (beef); n5 (**meat**) | n2, n7, n6 | **n2, n7, n6** | ウインナー excluded for no-beef because `meat` (species not stated) is forbidden |
| H5 | no-seafood | n1 (`diet-incomplete` + fish-seafood), n4 (`diet-incomplete`); n2 (fish-seafood) | n5, n7 (10), n3, n6 (15) | **n5, n7, n3** | dashi as hidden fish; meat recipes allowed |
| H6 | no-pork + no-beef | n1, n3, n4, n5 | n2, n7, n6 | **n2, n7, n6** | two diets: union of forbidden tags |
| H7 | none | – | n1, n2, n5, n7 (10), n3, n4, n6 (15) | **n1, n2, n5** | `diet-incomplete` applies only when a diet is selected; n1 and n4 are not flagged or demoted (their allergen data is complete) |

7 cases; with K11, K12 and K20 on the main library, 10 cases exercise B14.

## 4. Properties on the real library (M3, in the gate; no specific outputs, BR-26 library grows)
- PR1 For every single allergen id of `caa-2026-04`, every pair of them, and every diet and pair of diets: no suggestion and no 「ほかのレシピ」 entry violates F1–F4 (US-E6-02/AC3). 29 + 406 allergen sets × 6 diet sets.
- PR2 Same input → same ordered list, 100 repetitions; shuffling the library order changes nothing.
- PR3 Suggestions are a prefix of the full list; length = min(3, survivors).
- PR4 No recipe that F1–F4 excludes can be confirmed through any path (recommendations, library, deep link `/recipes/<id>` → plan), see decision oracle T37/T39.
- PR5 Every recommendation and recipe screen carries the disclaimer key; no catalog string matches a phrase in `data/banned-phrases.json` (BA-owned, BR-07).
- PR6 (B14) Every ingredient of the real dictionary has an `animalOrigin` value (`–` allowed) and `animalOriginKnown`; for every real recipe, `animalOrigin` = the union of its ingredients' tags, `dietDataComplete` = false iff an ingredient has `animalOriginKnown = false`, and `dietOk` equals the set derived from §1 F3.
- PR7 (B14) For every diet and pair of diets, no suggestion or 「ほかのレシピ」 entry on the real library has a forbidden tag or `dietDataComplete = false`; every excluded recipe shows reason `diet-incomplete` or the diet reason in 「レシピ一覧」 (US-E6-02/AC8).

## 5. Random comparison (M3, in the gate)
Seeded (`20261024`): 1,000 profiles (0–5 likes/dislikes over all dictionary ids, 0–4 known allergens, 0–3 exclusions, 0–2 diets, 0–3 themes, all three allergy statuses) × the synthetic library and the real library, with 0–4 random planned decisions within ±20 days of a random target date. Diets are judged with the real dictionary tags on the real library and the pinned tags on the synthetic libraries. Compared: excluded set with reason, full ordered list, scores. Any difference is P1.

## 6. Rulings applied (PLAN §7, 2026-10-24)
- **B1** distinct found dictionary ids: K18 asserted as **I, B, D**.
- **B2** most specific entry wins (tie → dislike): K23.
- **B14** + BA final (`animalOrigin`, `animalOriginKnown`, `diet-incomplete`; 7 unknown-origin ingredients): F3 rewritten (§1), tags = dictionary H1 final (§2), K11, K12, K20 recomputed, H1–H7 (§3b), PR6/PR7 (§4).

- **OQ-16 collapse** (`ranking-liked-ids`): a recipe's ingredient ids collapse by ancestor/descendant before counting. No §2 recipe holds an ancestor/descendant pair (D's cherry tomato has no tomato beside it), so no K score changes; the random comparison covers it.

No ranking case depends on an undecided rule.

## 7. Processed-food rule: worked cases and properties (2026-11-01)
### 7.1 Mini library `tests/fixtures/recipes/synthetic-library-processed.json` (SYNTHETIC, never shipped)
Six recipes, each `rice` plus one other ingredient; `*` = dictionary `info = varies`. No likes, dislikes, themes or diets in these cases, so every score is 0 (all recipes take 20 minutes or less) and the order is minutes ascending: p1 (10) < p2 (12) < p3 (14) < p4 (16) < p5 (18) < p6 (20).

| Key | Recipe | Processed ingredient | recipe allergenIds | dictionary notes | min |
|-----|--------|----------------------|--------------------|------------------|-----|
| p1 | surimi | kamaboko* | – | carries grp-fish, no inherent id | 10 |
| p2 | cheese | cheese* | milk | inherent milk | 12 |
| p3 | ham | ham* | pork | brand-label ids exist, never read | 14 |
| p4 | plain | none (carrot) | – | – | 16 |
| p5 | soy | soy-sauce* | soybean, wheat | inherent soybean + wheat | 18 |
| p6 | canned-mackerel | canned-mackerel* | mackerel | carries grp-fish | 20 |

### 7.2 Hand-computed cases W1-W9 (engine and oracle must both give these; asserted in `tests/unit/domain/qa/ranking.oracle.test.ts`)
| # | knownAllergenIds | Excluded (why) | Order | Warning on | Story |
|---|------------------|----------------|-------|------------|-------|
| W1 | [salmon] | p1 (kamaboko, fish group), p6 (canned mackerel, fish group) | p2 p3 p4 p5 | p2 p3 p5 (not p4: no processed ingredient) | US-E6-02/AC15, AC9 |
| W1b | [mackerel] | p1, p6 | p2 p3 p4 p5 | p2 p3 p5 | AC15 |
| W1c | [salmon-roe] | none (roe is not a group member) | p1 p2 p3 p4 p5 p6 | p1 p2 p3 p5 p6 | AC15 |
| W2 | [milk] | p2 (cheese, milk in allergenIds) | p1 p3 p4 p5 p6 | p1 p3 p5 p6 | AC9 |
| W3 | [pork] | p3 (ham, pork in allergenIds); the ham's brand-label ids are not read | p1 p2 p4 p5 p6 | p1 p2 p5 p6 | AC9, AC13 |
| W5 | [wheat] | p5 (soy sauce, wheat in allergenIds) | p1 p2 p3 p4 p6 | p1 p2 p3 p6 | AC9 |
| W7 | [peanut] | none (nothing carries peanut) | p1 p2 p3 p4 p5 p6 | p1 p2 p3 p5 p6 | AC10, AC11 |
| W8 | [peanut, shrimp] | none | as W7 | p1: allergenIds [peanut, shrimp] in registered order, processedIngredientIds [kamaboko] | AC11 (full list once) |
| W9 | [] (none-known, unknown, or only excluded ingredients) | none | p1 p2 p3 p4 p5 p6 | none (warning null everywhere) | AC12 |

Bread + wheat, ham + warn-only, cheese + milk and surimi + fish group are also covered on the real library by the properties of 7.4.

### 7.3 Changes to the K table (synthetic library of section 2) after the 2026-11-01 rules
F4 is retired and the tier removed: recipe M (incomplete) is ranked by score and minutes like every other recipe. Hand-recomputed orders: K1 MEABFDKLJHCG (M = corn 2 + animals 1 = 3, first; was EABFDKLJHCG), K2 DEKLAJMCGHBFI (M 0 at 15 minutes, after A and J by id), K13 and K16 MABFDEKLJHCG, K14 and K15 as K1, K18 IBDEKLAJMCGHF, K21 MEDKLAJCGHBFI (M = 5, first), K23 DJFIBEKLAMCGH. K22 (M excluded by F4) and the `allergen-incomplete` reason no longer exist. K3-K8 depend on may-contain ids and on F4: their text above is historical, and the engine-oracle comparison (not hand values) covers them under the new rule.

### 7.4 Properties on the real library (no specific outputs)
- PR8 For every single allergen and every pair (29 + 406 sets, retired item excluded): no suggested recipe has an id of the set in `allergenIds`, in the inherent ids of its processed ingredients or in the members of a group carried by one of its ingredients.
- PR9 The warning is present exactly when the set is non-empty, the recipe has a dictionary-processed ingredient and it is not excluded; its list equals the set in registered order.
- PR10 Order is score desc, minutes asc, id asc whatever `allergenDataComplete` says.
- PR11 Oracle precondition: each real recipe's `allergenIds` contains the dictionary inherent ids of its ingredients, and no `grp-` id appears in recipe allergen fields.
- Random comparison: seeds 20261024, 1, 7, 42 on the real library (600 profiles each: 0-5 known allergens in registered order, exclusions, diets) and 2,000 on the processed mini library. Compared: excluded set with reasons, full order with scores, `processedWarning`. Any difference is P1. Result 2026-11-01: 0 differences.

### 7.5 Open observation (not a defect)
The engine decides exclusion from the recipe's `allergenIds` plus groups; it does not re-derive inherent ids from the dictionary. The older synthetic fixtures (sections 2 and 3b) predate the 2026-11-01 dictionary and omit some inherent ids (for example bread without wheat), so the oracle follows the same literal rule (1a.1). With validated data the two readings are identical (PR11).
