# Assessment oracle (BR-04, BR-05, BR-25) — specification

Owner: QA · 2026-10-24 · Status: **H1 oracle-ready** (rulings B1, B2, B4, B5, B6 and the H1 follow-ups of `docs/PLAN.md` §7, 2026-10-24, applied) · Stories: US-E4-01 … US-E4-03, US-E3-03/AC2, US-E1-06/AC2

This oracle is written from the **approved rule text only**: `docs/PLAN.md` §3 BR-04/BR-05/BR-25, the E4 rule paragraph and ACs in `docs/ba/user-stories.md`, the matching rules in `docs/ba/domain-dictionary.md` §1/§7, and the `Assessment` entity in `docs/ba/data-contract.md` §3.5. It was **not** derived from ADR 004; where ADR 004 reads differently, the difference is listed in §6 as a finding, not adopted.

## 1. The rule, restated independently

Input: a date `d`, the confirmed menu of `d`'s month (or none), the child profile (or none), the override for `d` (or none), the dictionary.

**Step 0: is there an assessment at all?**
- No confirmed menu for the month (only a pending extraction, or nothing) → **no assessment** (BR-12).
- `d` is in `noLunchDays` → assessed (rule 1 below).
- `d` is in `days` with at least one item whose `kind ≠ "snack"` → a **school day** (BR-25) → assessed.
- Anything else (weekend or weekday not listed, holiday not listed, a date whose items are all snacks) → **no assessment** (`null`), and no decision either (BR-25, US-E4-01/AC10).

**Step 1: matching (dictionary §1, done by the oracle's own naive matcher).**
- Assessed items = the day's items with `kind ≠ "snack"` (OQ-07). Snack items count towards nothing.
- For each assessed item: normalise (NFKC, katakana → hiragana, drop spaces, 「・」 and brackets, keep 「ー」); dish pass (longest dish form, left to right; a dish adds its *name ingredients*); ingredient pass on the remaining text (longest ingredient/category form). A form that belongs to an ambiguity group stays **unresolved** unless a resolution rule of dictionary §7 applies. `resolvedIds` set by the parent on review replace the ambiguity.
- When `ingredientsStatus = "listed"`, the day's listed ingredient texts are matched by the ingredient pass too. Listed ingredients add ids to `D`/`L` but are **not** dishes, so they never change `U`.
- Kana forms shorter than 2 characters never match. Typos are never corrected.
- The **found ids** of the day = every id produced by the dish names, their name ingredients, the remaining text, and the listed ingredients.

**Step 2: counts.**
- A found id *hits* a profile entry `p` when the id equals `p`, or `p` is one of the id's dictionary ancestors (its category, the category's parents, and for child ingredients such as `ing-chicken-thigh` their parent ingredient `ing-chicken`).
- Seasonings (`cat-seasoning`) never hit, unless the profile names that exact seasoning id (dictionary §1 rule 8).
- **Foods (PLAN §7 "OQ-16 overruled", "OQ-16 collapse narrowed (not transitive)" and the collapse detail).** Found ids are grouped into *foods* before counting:
  - (a) **within one lunch item**, a dish id and its **defining ingredient** (dictionary `definingIngredientId`, e.g. コーンスープ → `ing-corn`) are one food; the dish's other name ingredients stay separate foods (豚のしょうが焼き = pork food + ginger food);
  - (b) **across the whole day**, an identical id is one food, and a found ancestor ingredient **folds into each found descendant** (鶏肉 + 鶏もも肉 = 1 food; 鶏肉 + 鶏もも肉 + 鶏むね肉 = 2 foods: thigh and breast, each carrying 鶏肉); siblings stay separate;
  - (c) nothing else collapses and grouping is never chained: defining-ingredient links never take part in cross-item collapse, so two dishes in different items are always 2 foods, even with the same defining ingredient (US-E4-01/AC18) and a dish's food never joins a descendant found in another item (から揚げ + 鶏もも肉 = 2 foods, closing ruling O-3). An id identical to a dish's defining ingredient found elsewhere on the day is counted through that dish, not as a food of its own.
  - Representative id (for `matched.likedIds` / `dislikedIds`): the descendant over its ancestor; the dish over its defining ingredient.
- **Verdict per food, most specific entry wins (rulings B2, follow-up, collapse precedence).** Profile entries are checked in this order, and the first level with a hit decides: (1) the food's ingredient ids themselves, descendant first; (2) their dictionary parent ingredients, nearest first; (3) the dish id; (4) the ingredient's category, then that category's ancestors, nearest first. A like and a dislike at the same level → the dislike wins. A food is liked, disliked or neither, never both.
- `D` = number of **disliked foods**; `L` = number of **liked foods** (ruling B1 as narrowed by OQ-16: different foods under one category entry count separately; the same food counts once).
- **`definingIngredientId` values used by the cases** (dictionary §5, H1 final: 24 of 55 dishes set, 31 null; reconciled 2026-10-24): dish-corn-soup → ing-corn, dish-saba-miso → ing-mackerel, dish-salted-salmon → ing-salmon, dish-tamagoyaki → ing-egg, dish-karaage → ing-chicken, dish-potato-salad → ing-potato, dish-white-fish-fry → ing-white-fish, dish-ginger-pork → ing-pork, dish-tonjiru → ing-pork; **dish-miso-soup → null** and **dish-curry-rice → null** (QA had assumed ing-miso for みそ汁: A24 and A33 keep their results because ing-miso then is a food of its own with the same verdict). A transcription test reads the values from the dictionary JSON and fails on drift.
- `U` = (assessed items with no dictionary match at all, or with at least one unresolved ambiguity, even when the same item also produced an id: ruling B5) ÷ (assessed items). Compare exactly: `U ≤ 50%` ⇔ `2 × unmatched ≤ assessed`.
- An item matched only to a seasoning (e.g. 「みそ」) is matched for `U`.

**Step 3: state, first rule that applies (BR-04).**

| # | Condition | `calculatedState` | `explanationKey` |
|---|-----------|-------------------|------------------|
| 1 | `d` is a no-lunch day | `no-school-lunch` | `assess.noLunch` |
| 2 | no profile, or 0 likes and 0 dislikes | `not-assessed` | `assess.notAssessed` |
| 3 | `D ≥ 2` | `low-preference` | `assess.low` |
| 4 | `D = 1`, `L = 0` | `low-preference` | `assess.low` |
| 5 | `D = 1`, `L ≥ 1` | `mixed-uncertain` | `assess.mixedOne` |
| 6 | `D = 0`, `L ≥ 1`, `U ≤ 50%` | `likely-enjoyable` | `assess.likely` |
| 7a | `D = 0`, `L ≥ 1`, `U > 50%` | `mixed-uncertain` | `assess.mixedUnknown` |
| 7b | `D = 0`, `L = 0`, `U > 50%` | `mixed-uncertain` | `assess.mixedUnknown` |
| 7c | `D = 0`, `L = 0`, `U ≤ 50%` | `mixed-uncertain` | `assess.mixedNeutral` |

Keys of rule 7 per ruling B4 (PLAN §7): `D = 0`, `L = 0`: `U > 50%` → `assess.mixedUnknown`, otherwise `assess.mixedNeutral`.

**Step 4: override (BR-05).** If an override exists for `d`: `state = override.state`, `explanationKey = assess.override`; `calculatedState`, `matched` and the counts are still the computed ones. Without an override, `state = calculatedState`. Overrides are removed only by the parent (「自動判定に戻す」) or by deleting the profile (US-E1-06/AC2).
- **Dormant override (ruling B6).** If a refresh turns `d` into a no-lunch day, rule 1 applies (`state = calculatedState = no-school-lunch`, key `assess.noLunch`); the override record is kept byte-identical but not shown, and `d` is listed in that refresh's "needs review" list. If a later refresh makes `d` a school day again, the kept override applies again unchanged (B6 follow-up: dormant records "return unchanged"; BR-05).

**Invariants the oracle also checks on every case.**
- I1 The result is identical for the same inputs whatever the language, the device timezone (`Asia/Tokyo`, `Europe/Paris`, `America/Los_Angeles`), the order of items, the order of listed ingredients and the order of likes/dislikes (US-E4-01/AC7).
- I2 The computation never reads or writes `decisions` (BR-01): running it with any `decisions` map gives the same output, and the store's `decisions` is byte-identical afterwards.
- I3 `explanationParams.dislikedCount = D`, `likedCount = L`, label lists hold at most 3 entries.
- I4 Allergen declarations of the menu never change the state (US-E4-05/AC3).

## 2. Profiles used in the decision table
Ids are dictionary ids (`docs/ba/domain-dictionary.md`, H1 final). "Allergy" has no effect on the assessment and is listed only where it makes the profile valid.

| Profile | likedIds | dislikedIds | Other |
|---------|----------|-------------|-------|
| P0 | — (no profile stored) | — | |
| P1 | [] | [] | allergy `has-known` [alg-shrimp] |
| PS (sample child) | ing-chicken, ing-egg, ing-corn | ing-green-pepper, ing-eggplant, cat-fish | allergy `has-known` [alg-shrimp], theme-animals |
| PA | ing-corn | ing-carrot | none-known |
| PB | cat-fish | ing-mackerel | none-known (valid: ids are disjoint) |
| PC | ing-potato | ing-chicken | none-known |
| PD | ing-egg | dish-curry-rice | none-known |
| PE | ing-rice | ing-miso | none-known |
| PF | ing-rice | cat-vegetable | none-known |
| PG | [] | ing-carrot | none-known |
| PH | ing-apple | [] | none-known |
| PI | dish-corn-soup, ing-corn | ing-carrot | none-known |
| PJ | ing-chicken | ing-chicken-thigh | none-known (valid: ids are disjoint) |
| PK | ing-mackerel | cat-fish | none-known (valid: ids are disjoint) |
| PL | ing-egg | dish-saba-miso, ing-mackerel | none-known |
| PM | ing-mackerel | dish-saba-miso | none-known |
| PN | ing-ginger | ing-pork | none-known |
| PO | dish-saba-miso | cat-fish | none-known |

## 3. Decision table (hand-computed)
Items are written `text` with kind abbreviations: **st** staple, **mn** main, **sd** side, **sp** soup, **dk** drink, **ds** dessert, **sn** snack. "Found ids" lists only what matters for D/L (seasonings shown in brackets when they matter). `U` is unmatched/assessed. All dates are school days of a confirmed menu unless the case says otherwise.

| # | Profile | Day | Found ids (relevant) | D | L | U | Expected `state` | Expected key | Covers |
|---|---------|-----|----------------------|---|---|---|------------------|--------------|--------|
| A01 | PS | 2026-11-20 in `noLunchDays`, reason `bento-day` 「お弁当の日」 | — | – | – | – | `no-school-lunch` | `assess.noLunch` | rule 1, US-E4-01/AC8 |
| A02 | PS | 2026-11-27 in `noLunchDays`, reason `no-lunch` 「午前保育（給食なし）」 | — | – | – | – | `no-school-lunch` | `assess.noLunch` | rule 1 |
| A03 | P0 | 2026-11-27 no-lunch day | — | – | – | – | `no-school-lunch` | `assess.noLunch` | rule 1 before rule 2 (US-E4-01/AC8) |
| A04 | P0 | 「ピーマンとなすのみそ炒め」mn 「ごはん」st | (not computed) | – | – | – | `not-assessed` | `assess.notAssessed` | rule 2, no profile |
| A05 | P1 | same as A04 | (not computed) | – | – | – | `not-assessed` | `assess.notAssessed` | rule 2, empty likes/dislikes even with allergies |
| A06 | PS | 2026-11-14 (Sat) listed with only 「せんべい」sn | — | – | – | – | **no assessment** (`null`) | — | BR-25 snack-only day (US-E4-01/AC10) |
| A07 | PS | 2026-11-07 (Sat), not listed in the menu | — | – | – | – | **no assessment** | — | not a school day (US-E5-02/AC2) |
| A08 | PS | 2026-12-02, December extraction reviewed but **not confirmed** | — | – | – | – | **no assessment** | — | BR-12 (US-E3-03/AC3) |
| A09 | PS | 2026-11-04: 「ピーマンとなすのみそ炒め」mn 「ごはん」st 「すまし汁」sp | ing-green-pepper ✗, ing-eggplant ✗ ([ing-miso] ignored) | 2 | 0 | 0/3 | `low-preference` | `assess.low`; params dislikedCount 2, dislikedLabels [ピーマン, なす], weekday 3 | rule 3 (US-E4-01/AC1, US-E4-02/AC1) |
| A10 | PS | 「ピーマンとなすのみそ炒め」mn 「鶏のから揚げ」mn 「ごはん」st | green-pepper ✗, eggplant ✗; dish-karaage → ing-chicken ✓ | 2 | 1 | 0/3 | `low-preference` | `assess.low` | rule 3 wins over likes (AC2 row "2/3/0%") |
| A11 | PS | 「さばのみそ煮」mn 「白身魚のフライ」mn 「卵焼き」sd | ing-mackerel ✗ (cat-fish), ing-white-fish ✗ (cat-fish), ing-egg ✓ | 2 | 1 | 0/3 | `low-preference` | `assess.low` | rule 3 via one category entry. **Resolved by B1**: D = \|{ing-mackerel, ing-white-fish}\| = 2 (not 1 profile entry), L = \|{ing-egg}\| = 1, D ≥ 2 → rule 3 |
| A12 | PF | 「ほうれん草のおひたし」sd 「にんじんサラダ」sd 「ごはん」st | ing-spinach ✗ (cat-leafy-vegetable ⊂ cat-vegetable), ing-carrot ✗ (cat-green-vegetable ⊂ cat-vegetable), ing-rice ✓ | 2 | 1 | 0/3 | `low-preference` | `assess.low` | category descendants. **Resolved by B1**: D = \|{ing-spinach, ing-carrot}\| = 2, L = \|{ing-rice}\| = 1, U 0/3 → rule 3 |
| A13 | PS | 「なすのにびたし」sd 「ごはん」st 「すまし汁」sp | eggplant ✗ | 1 | 0 | 0/3 | `low-preference` | `assess.low` | rule 4 (AC2 row "1/0/0%") |
| A14 | PS | 「さけのしおやき」mn 「ごはん」st 「みそ汁」sp | dish-salted-salmon → ing-salmon ✗ (cat-fish); [ing-salt, ing-miso] ignored | 1 | 0 | 0/3 | `low-preference` | `assess.low` | category dislike (US-E4-01/AC3); 「さけ」 in a dish name = salmon (amb-sake rule) |
| A15 | PS | 「八宝菜」mn 「ごはん」st 「牛乳」dk; `ingredientsStatus listed`: 「はくさい」「にんじん」「ピーマン」「ぶた肉」 | green-pepper ✗ (from the listed ingredients only) | 1 | 0 | 0/3 | `low-preference` | `assess.low` | listed ingredients count towards D |
| A16 | PA | 「にんじんのグラッセ」sd 「ニンジンしりしり」sd 「人参スープ」sp | ing-carrot ✗ ×3 → 1 distinct | 1 | 0 | 0/3 | `low-preference` | `assess.low`; dislikedCount 1 | synonyms/scripts, counted once (US-E4-01/AC4) |
| A17 | PS | 「なすのにびたし」sd 「ふりかけ」st 「ビビンバ」mn | eggplant ✗ | 1 | 0 | 2/3 | `low-preference` | `assess.low` | rule 4 precedes rule 7 even with U > 50% |
| A18 | PS | 「鯵フライ」mn 「ごはん」st | 鯵 → ing-horse-mackerel ✗ (cat-fish) | 1 | 0 | 0/2 | `low-preference` | `assess.low` | kanji resolves amb-aji (dictionary §7) |
| A19 | PD | 「カレー」mn with `resolvedIds [dish-curry-rice]` set on review, 「りんご」ds | dish-curry-rice ✗ | 1 | 0 | 0/2 | `low-preference` | `assess.low` | parent's ambiguity choice is used (US-E4-01/AC6) |
| A20 | PS | 「なすのにびたし」sd 「卵焼き」sd 「ごはん」st | eggplant ✗; dish-tamagoyaki → ing-egg ✓ | 1 | 1 | 0/3 | `mixed-uncertain` | `assess.mixedOne` | rule 5 (AC2 row "1/1/0%") |
| A21 | PS | 「ブロッコリーのおかかあえ」sd 「鶏のから揚げ」mn 「ごはん」st | おかか → ing-bonito-flakes ✗ (cat-fish); ing-chicken ✓ | 1 | 1 | 0/3 | `mixed-uncertain` | `assess.mixedOne` | hidden category member inside a dish name |
| A22 | PA | 「コーンスープ」sp 「にんじんのグラッセ」sd | ing-corn ✓ (name ingredient of dish-corn-soup); ing-carrot ✗ | 1 | 1 | 0/2 | `mixed-uncertain` | `assess.mixedOne` | rule 5; dish + ingredient (US-E4-01/AC5) |
| A23 | PC | 「鶏もも肉のてりやき」mn 「ポテトサラダ」sd | ing-chicken-thigh ✗ (child of ing-chicken); dish-potato-salad → ing-potato ✓ | 1 | 1 | 0/2 | `mixed-uncertain` | `assess.mixedOne` | parent-ingredient dislike; 「鶏もも」 resolves amb-momo |
| A24 | PE | 「みそ汁」sp 「ごはん」st | ing-miso ✗ (seasoning, but named exactly); ing-rice ✓ | 1 | 1 | 0/2 | `mixed-uncertain` | `assess.mixedOne` | seasoning counts only when named exactly (dictionary rule 8) |
| A25 | PD | 「カレーライス」mn 「卵焼き」sd | dish-curry-rice ✗; ing-egg ✓ | 1 | 1 | 0/2 | `mixed-uncertain` | `assess.mixedOne` | dish id disliked; longest match beats amb-curry |
| A26 | PI | 「コーンスープ」sp 「にんじんのグラッセ」sd | {dish-corn-soup + ing-corn} is **one food** (defining ingredient), liked (level 1, ing-corn); ing-carrot ✗ | 1 | 1 | 0/2 | `mixed-uncertain` | `assess.mixedOne`; likedCount **1** | OQ-16 collapse: a dish and its defining ingredient count once (was L 2 under literal B1); rule 5 |
| A27 | PB | 「さばのみそ煮」mn 「ごはん」st | ing-mackerel hits dislike `ing-mackerel` (the id itself) and like `cat-fish` (its category): closest = the id → disliked only; ing-rice hits nothing | 1 | 0 | 0/2 | `low-preference` | `assess.low` | **Resolved by B2**: D 1, L 0 → rule 4 |
| A28 | PS | 「コーンスープ」sp 「ごはん」st 「ふりかけ」st | ing-corn ✓; ふりかけ unmatched | 0 | 1 | 1/3 | `likely-enjoyable` | `assess.likely` | rule 6 |
| A29 | PS | 「コーンスープ」sp 「ふりかけ」st | ing-corn ✓ | 0 | 1 | 1/2 | `likely-enjoyable` | `assess.likely` | **U = 50% boundary** (AC2 row "0/1/50%") |
| A30 | PS | 「ちくわの磯辺揚げ」sd 「ごはん」st 「卵焼き」sd | ing-chikuwa is cat-fish-processed, **not** under cat-fish; ing-egg ✓ | 0 | 1 | 0/3 | `likely-enjoyable` | `assess.likely` | category boundary (dictionary §2 note) |
| A31 | PA | 「もちもちとうもろこしパン」st 「ふりかけ」st | ing-corn ✓ inside a longer unknown word; パン → ing-bread | 0 | 1 | 1/2 | `likely-enjoyable` | `assess.likely` | US-E4-01/AC5 second clause |
| A32 | PS | 「カレー」mn 「卵焼き」sd | カレー unresolved (amb-curry) → U; ing-egg ✓ | 0 | 1 | 1/2 | `likely-enjoyable` | `assess.likely` | ambiguity counts only in U (US-E4-01/AC6) |
| A33 | PS | 「みそ汁」sp 「ごはん」st 「コーンスープ」sp | [ing-miso] ignored (PS doesn't name it); ing-corn ✓ | 0 | 1 | 0/3 | `likely-enjoyable` | `assess.likely` | seasoning-only match is still "matched" for U |
| A34 | PS | 「コーンスープ」sp 「ビビンバ」mn 「せんべい」sn | ing-corn ✓; ビビンバ unmatched; snack ignored | 0 | 1 | 1/2 | `likely-enjoyable` | `assess.likely` | snack not in U (would be 2/3 → mixed if counted) (US-E4-01/AC9) |
| A35 | PH | 「りんご」ds 「ごはん」st | ing-apple ✓ | 0 | 1 | 0/2 | `likely-enjoyable` | `assess.likely` | likes-only profile |
| A36 | PS | 「親子丼」mn 「すまし汁」sp 「バナナ」ds; listed 赤「鶏肉」「卵」 黄「米」 緑「たまねぎ」「みつば」 | ing-chicken ✓, ing-egg ✓ (from listed ingredients; dish-oyakodon has no name ingredients) | 0 | 2 | 0/3 | `likely-enjoyable` | `assess.likely`; likedCount 2 | listed ingredients count towards L; an unmatched ingredient (みつば) is not a dish |
| A37 | PS | 「タンドリーチキン」mn 「ナン」st 「ミネストローネ」sp | チキン → ing-chicken ✓; 2 unmatched | 0 | 1 | 2/3 | `mixed-uncertain` | `assess.mixedUnknown`; unmatched [ナン, ミネストローネ] | rule 7a (US-E4-02/AC3) |
| A38 | PS | 「ごはん」st 「すまし汁」sp 「りんご」ds | nothing liked or disliked | 0 | 0 | 0/3 | `mixed-uncertain` | `assess.mixedNeutral` | rule 7b (AC2 row "0/0/0%") |
| A39 | PS | 「ふりかけ」st 「ビビンバ」mn 「ナン」st | — | 0 | 0 | 3/3 | `mixed-uncertain` | `assess.mixedUnknown` | **Resolved by B4**: D 0, L 0, 2 × 3 = 6 > 3 → U > 50% → rule 7b |
| A40 | PS | 「アジフライ」mn 「ごはん」st | アジ unresolved (amb-aji, no resolution rule applies); fish dislike is **not** counted | 0 | 0 | 1/2 | `mixed-uncertain` | `assess.mixedNeutral` | ambiguity never decides, even when a candidate is disliked |
| A41 | PD | 「カレー」mn 「りんご」ds (no `resolvedIds`) | カレー unresolved | 0 | 0 | 1/2 | `mixed-uncertain` | `assess.mixedNeutral` | contrast with A19 |
| A42 | PG | 「ごはん」st 「すまし汁」sp | — | 0 | 0 | 0/2 | `mixed-uncertain` | `assess.mixedNeutral` | dislike-only profile never reaches `likely-enjoyable` |
| A43 | PS | 「親子丼」mn 「すまし汁」sp 「バナナ」ds; `ingredientsStatus not-listed` | — | 0 | 0 | 0/3 | `mixed-uncertain` | `assess.mixedNeutral` | contrast with A36: nothing is inferred from a dish name (BR-11) |
| A44 | PS + override `likely-enjoyable` on the A09 day | A09 items | as A09 | 2 | 0 | 0/3 | `state` **likely-enjoyable**, `calculatedState` low-preference | `assess.override` | BR-05 precedence (US-E4-03/AC1) |
| A45 | P1 + override `low-preference` | A04 items | — | – | – | – | `state` **low-preference**, `calculatedState` not-assessed | `assess.override` | override on a not-assessed day is still applied |
| A46 | PS | 「コーンスープ」sp 「ごはん」st 「〓〓のソテー」mn stored `uncertain-accepted` | ing-corn ✓; the accepted item is unmatched | 0 | 1 | 1/3 | `likely-enjoyable` | `assess.likely` | US-E3-03/AC2: uncertain-accepted items are assessed like any other (no cap) |
| A47 | PS + override `low-preference` set on 2026-11-18 (menu v1); refresh v2 turns 2026-11-18 into a no-lunch day | v2: 2026-11-18 in `noLunchDays` | — | – | – | – | `state` = `calculatedState` = `no-school-lunch`; override record byte-identical in the store but not shown; the refresh's "needs review" list contains 2026-11-18 | `assess.noLunch` | **Resolved by B6**: rule 1 applies first; the override is dormant |
| A48 | PS | 「カレーうどん」mn 「ふりかけ」st 「卵焼き」sd | カレー unresolved (no §7 rule covers 「カレー」+「うどん」), うどん → ing-udon; ing-egg ✓ | 0 | 1 | 2/3 | `mixed-uncertain` | `assess.mixedUnknown` | **Resolved by B5**: 「カレーうどん」 counts in U although it produced ing-udon; 「ふりかけ」 unmatched → U 2/3 (2 × 2 = 4 > 3); D 0, L 1 → rule 7a |
| A49 | PS, profile deleted after A44 (US-E1-06/AC2) | A09 items | — | – | – | – | `not-assessed`, override gone | `assess.notAssessed` | profile deletion removes overrides |
| A50 | PB | 「さばのみそ煮」mn 「さけのしおやき」mn 「ごはん」st | ing-mackerel: closest entry = the id itself → ✗; dish-salted-salmon → ing-salmon: only `cat-fish` hits → ✓; ing-rice hits nothing | 1 | 1 | 0/3 | `mixed-uncertain` | `assess.mixedOne` | B2: the specific dislike takes only mackerel out of the category like; rule 5 |
| A51 | PJ | 「鶏もも肉のてりやき」mn 「ごはん」st | 鶏もも肉 → ing-chicken-thigh (longest match): hits dislike `ing-chicken-thigh` (itself) and like `ing-chicken` (parent) → closest = itself → ✗ | 1 | 0 | 0/2 | `low-preference` | `assess.low` | B2 at the parent-ingredient level; rule 4 |
| A52 | PJ | 「鶏肉のソテー」mn 「鶏もも肉のてりやき」mn 「ごはん」st | ing-chicken folds into ing-chicken-thigh → **one food**; level 1 has like `ing-chicken` and dislike `ing-chicken-thigh` → dislike wins; dislikedIds [ing-chicken-thigh] | 1 | 0 | 0/3 | `low-preference` | `assess.low` | OQ-16 ancestor/descendant collapse + same-level tie → dislike; rule 4 (was D 1, L 1 → mixed under literal B1) |
| A53 | PK | 「さばのみそ煮」mn 「ごはん」st | ing-mackerel: like on itself beats dislike `cat-fish` → ✓ | 0 | 1 | 0/2 | `likely-enjoyable` | `assess.likely` | B2 with reversed polarity; 2 × 0 ≤ 2 → rule 6 |
| A54 | PK | 「さばのみそ煮」mn 「白身魚のフライ」mn 「ごはん」st | ing-mackerel ✓ (as A53); ing-white-fish: only `cat-fish` hits → ✗ | 1 | 1 | 0/3 | `mixed-uncertain` | `assess.mixedOne` | B2: the category dislike still applies to the other fish; rule 5 |
| A55 | PS | 「ふりかけ」st 「ビビンバ」mn 「ごはん」st | ing-rice hits nothing in PS; 2 unmatched | 0 | 0 | 2/3 | `mixed-uncertain` | `assess.mixedUnknown` | B4 boundary partner of A40 (1/2 → neutral): 2 × 2 = 4 > 3 → rule 7b |
| A56 | A47 state, then refresh v3 makes 2026-11-18 a school day again with the A09 items | v3: A09 items on 2026-11-18 | as A09 | 2 | 0 | 0/3 | `state` **low-preference** (the kept override), `calculatedState` low-preference | `assess.override` | B6 + follow-up: a dormant override returns unchanged once the date is a school day again |
| A57 | PS + override `likely-enjoyable` on 2026-11-11; refresh FX-01c removes 2026-11-11 from the menu | 2026-11-11 absent | — | – | – | – | **no assessment** (`null`, step 0); override record byte-identical in the store, not shown | — | BR-05, BR-13: override kept. closing ruling A57: the refresh's "needs review" list contains 2026-11-11 (asserted) |
| A58 | PL | 「さばのみそ煮」mn 「卵焼き」sd 「ごはん」st | {dish-saba-miso + ing-mackerel} one food, disliked (level 1); {dish-tamagoyaki + ing-egg} one food, liked | 1 | 1 | 0/3 | `mixed-uncertain` | `assess.mixedOne`; dislikedIds [dish-saba-miso] | collapse: disliking both the dish and its fish counts 1 food (literal B1 gave D 2 → low); rule 5 |
| A59 | PN | 「豚のしょうが焼き」mn 「ごはん」st | {dish-ginger-pork + ing-pork} disliked (level 1, ing-pork); ing-ginger is **not** the defining ingredient → separate food, liked | 1 | 1 | 0/2 | `mixed-uncertain` | `assess.mixedOne` | collapse narrowed: しょうが焼き = 2 foods (if every name ingredient collapsed, the tie rule would give D 1, L 0 → low); rule 5 |
| A60 | PN | 「豚のしょうが焼き」mn 「豚汁」sp 「ごはん」st | item 1: {dish-ginger-pork + ing-pork} disliked, ing-ginger liked; item 2: {dish-tonjiru + ing-pork} disliked. Two dishes in different items never merge, even through the same defining ingredient → **2** disliked foods | 2 | 1 | 0/3 | `low-preference` | `assess.low`; dislikedIds [dish-ginger-pork, dish-tonjiru] | two dishes sharing an ingredient (US-E4-01/AC18); rule 3 |
| A61 | PM | 「さばのみそ煮」mn 「ごはん」st | {dish-saba-miso + ing-mackerel}: level 1 (ingredient) like `ing-mackerel` decides before level 3 (dish) dislike `dish-saba-miso` | 0 | 1 | 0/2 | `likely-enjoyable` | `assess.likely` | precedence ingredient → dish; 2 × 0 ≤ 2 → rule 6 |
| A62 | PO | 「さばのみそ煮」mn 「ごはん」st | {dish-saba-miso + ing-mackerel}: no entry at levels 1–2; level 3 like `dish-saba-miso` decides before level 4 dislike `cat-fish` | 0 | 1 | 0/2 | `likely-enjoyable` | `assess.likely` | precedence dish → category; rule 6 |
| A63 | PC | 「鶏肉のソテー」mn 「鶏もも肉のてりやき」mn 「ポテトサラダ」sd | ing-chicken folds into ing-chicken-thigh → one food, disliked at level 1 (member ing-chicken itself); {dish-potato-salad + ing-potato} liked | 1 | 1 | 0/3 | `mixed-uncertain` | `assess.mixedOne` | collapse: 鶏肉 + 鶏もも肉 count 1 (literal B1 gave D 2 → low); rule 5 |
| A64 | PC | 「鶏肉のソテー」mn 「鶏もも肉のてりやき」mn 「鶏むね肉のサラダ」sd | ing-chicken folds into **each** descendant → 2 foods {thigh + chicken}, {breast + chicken}; both disliked at level 1 (ing-chicken itself) | 2 | 0 | 0/3 | `low-preference` | `assess.low`; dislikedIds [ing-chicken-thigh, ing-chicken-breast] | siblings stay separate (collapse detail); rule 3 |
| A65 | PC | 「鶏のから揚げ」mn 「鶏もも肉のてりやき」mn 「ポテトサラダ」sd | {dish-karaage + ing-chicken} (item 1) disliked at level 1; ing-chicken-thigh (item 2) is a separate food (closing ruling O-3), disliked at level 2 (parent ing-chicken); {dish-potato-salad + ing-potato} liked | 2 | 1 | 0/3 | `low-preference` | `assess.low`; dislikedIds [dish-karaage, ing-chicken-thigh] | O-3: a defining-ingredient link never joins a descendant in another item; rule 3 |

Totals: **65 cases** (49 from the H1 draft, 6 of them resolved and A26, A52 recomputed for OQ-16, + 16 added: A50–A65). All are asserted; none runs as `todo`. Branch coverage: rule 1 (3 + A47), rule 2 (2 + A45, A49), no-assessment (3 + A57), rule 3 (4), rule 4 (7 + A27, A51), rule 5 (8 + A50, A52, A54), rule 6 (9 + A46, A53), rule 7a (2), rule 7b (A39, A55), rule 7c (5), override (3 + A56), dormant override (A47). Boundaries: `U = 50%` (A29, A32, A40, A41), `U > 50%` (A17, A37, A39, A48, A55), `D = 1 / L = 0` (A13–A19, A27, A51), snack-only (A06), お弁当の日 (A01), no profile (A03, A04). Rulings: OQ-16 collapse (A26, A52, A58–A65), B1 (A11, A12, A64), B2 (A27, A50–A54), B4 (A39, A55), B5 (A48), B6 (A47, A56, A57).

## 4. Text-level matcher checks (feed both the engine and the oracle's matcher)
These pin the matching rules that the decision table relies on. Expected = the set of found ids (seasonings included) or "unresolved".

| # | Text | Expected | Rule |
|---|------|----------|------|
| M01 | 「ピーマンとなすのみそ炒め」 | ing-green-pepper, ing-eggplant, ing-miso | ingredient pass, kana ≥ 2 |
| M02 | 「コーンスープ」 | dish-corn-soup, ing-corn | dish pass first, name ingredients |
| M03 | 「切り干し大根の煮物」 | dish-kiriboshi-nimono, ing-dried-daikon (not ing-daikon) | longest match |
| M04 | 「ごま油」 in listed ingredients | ing-sesame-oil (not ing-sesame) | longest match |
| M05 | 「カニカマ」 | ing-crab-stick (not ing-crab) | longest match |
| M06 | 「さけのしおやき」 / 「さけ」 alone in a list of seasonings | dish-salted-salmon + ing-salmon / unresolved amb-sake | dictionary §7 amb-sake |
| M07 | 「しおあじ」 | (taste suffix, no food id) | amb-aji rule |
| M08 | 「たこさんウインナー」 | dish-octopus-sausage, ing-sausage (no ing-octopus) | amb-tako |
| M09 | 「フライパン」 | nothing | amb-pan rule |
| M10 | 「給食なし」 | no food id (「なし」 = none) | amb-nashi |
| M11 | 「焼きそば」 / 「そば」 | dish-yakisoba + ing-chinese-noodles / ing-soba, flagged for review | amb-soba |
| M12 | 「ｺｰﾝｽｰﾌﾟ」 (half-width) | dish-corn-soup, ing-corn | NFKC |
| M13 | 「と」 alone | nothing | kana < 2 never matches |
| M14 | 「にんじ ん」 (space) | ing-carrot | spaces removed |
| M15 | 「ピーマソ」 (typo) | nothing (unmatched) | typos never corrected |

## 5. Random comparison (built in M2, runs in the gate)
- Generator, seeded (fixed gate seed `20261024`, override with `ORACLE_SEED`): 1,000 days per run. Profile: 0–6 likes and 0–6 dislikes drawn from all dictionary `ing-`/`cat-`/`dish-` ids, kept disjoint (5% chance of no profile). Day: 10% no-lunch, 5% snack-only, else 1–6 items drawn from a pool of ≈ 150 item texts (every text in §3 and §4, every dictionary 表記 and synonym, 20 unmatched words, every ambiguity form, plus snack items), 50% with 1–8 listed ingredients. 10% of days carry an override.
- Compared fields: `calculatedState`, `state`, `explanationKey`, `explanationParams.{dislikedCount, likedCount}`, `matched.likedIds`, `matched.dislikedIds` (as sets), unmatched item count.
- Plus invariants I1–I4 on every generated case (shuffle, locale ja/en, `TZ` Asia/Tokyo / Europe/Paris / America/Los_Angeles).
- Any difference is a **P1** until triaged; triage decides "engine bug" (stays P1) or "oracle bug" (fixed in the oracle with a note in the report). The failing seed and case are printed and added to the fixed table.

## 6. Rulings applied (PLAN §7, 2026-10-24) and what is still open
| Finding | Ruling | Cases |
|---------|--------|-------|
| B1 what D and L count | Distinct dictionary ids found in the day's lunch items that match a dislike/like, directly or via category. ADR 004 aligns. | A11, A12, A52; ranking K18 |
| B2 an id hitting a like and a dislike | The most specific profile entry wins; a tie at the same level → the dislike wins (follow-up). | A27, A50–A54; ranking K23 |
| OQ-16 same food counts once (narrowed, not transitive; ancestor folds into each descendant) | Dish + defining ingredient within one item; identical or ancestor/descendant ids across the day; nothing else; precedence ingredient → dish → category. | A26, A52, A58–A64 |
| B4 key for `D = 0, L = 0` | `U > 50%` → `assess.mixedUnknown`, otherwise `assess.mixedNeutral`. | A39, A55 (A38, A40–A43 unchanged) |
| B5 item with an id and an unresolved ambiguity | Counts toward U (story wins). | A48 |
| B6 override on a date a refresh makes a no-lunch day | Day shows `no-school-lunch`; override kept dormant (not shown); date in the refresh's "needs review" list; returns unchanged if the date becomes a school day again (follow-up). | A47, A56 |

**Closing rulings (PLAN §7 "H1 closing rulings") — nothing is open:**
- **O-2 → A57** a removed date carrying an override is listed in "needs review" (asserted).
- **O-3 → A65** defining-ingredient links never take part in cross-item collapse.
- **O-4** `definingIngredientId` is published (24 set, 31 null); §1 reconciled (only みそ汁 differed, no result changed).
- **AC15** precedence ingredient → dish → category wins over the earlier wording (A61); same-level tie → dislike unchanged.

Random comparison (§5): the generator draws profiles whose likes and dislikes sit on one chain (like a category, dislike a member, or the reverse), profiles that name dish ids next to their defining ingredients, and days that repeat a defining ingredient across items or mix an ancestor with several descendants. Refresh events that remove a date carrying an override compare the "needs review" list too. No constraint is left for undecided rules.
