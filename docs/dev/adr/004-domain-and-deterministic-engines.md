# ADR-004: Pure domain layer and the four deterministic engines

Status: **accepted** · 2026-10-24 · Owner: Developer

Rules source of truth: `docs/PLAN.md` §3 (BR-01 … BR-27, approved 2026-10-24) and `docs/ba/data-contract.md` v1 (state names, field names, rule ids). Where this ADR and those documents disagree, **they win** and this ADR is corrected.

## Context
The brief draws a hard line (§7): **the AI interprets the menu once a month; everything after that is deterministic, explainable and testable.** Four engines carry the product's rules:

| Engine | Rules | What can go wrong if it isn't pure |
|--------|-------|------------------------------------|
| Preference assessment | BR-01, BR-04, BR-05, BR-25 | Same menu + profile gives different labels on two days; overrides lost on refresh |
| Decision state machine | BR-02, BR-03, BR-13, BR-19, BR-27 | A low-preference label silently becomes a bento plan; a refresh wipes a plan |
| Recipe ranking | BR-06, BR-07, BR-09 | A known allergen slips into the top 3; results change order between taps |
| Reminder planning | BR-15, BR-16, BR-17, BR-18 | Duplicate or stale reminders; wrong time when the device isn't on JST |

The core rule: **assessment and decision are separate; the app never changes a decision on its own** (BR-01, BR-02). The never-rule: **never claim allergy safety or suggest a recipe containing a known allergen / excluded item / diet violation** (BR-06, BR-07). QA builds an independent oracle for the assessment, the state machine and the ranking filters, so the rules below are written to be re-implementable.

## Decision
All four engines live in `src/domain/` as **pure functions over plain data**: no DOM, no network, no `Date.now()`, no randomness. Data they depend on (dictionary, recipe library) is **passed into factories**; `src/domain/index.ts` binds the shipped data; tests pass fixtures. "Now" is always a parameter (`Instant` from the `Clock` port). Outputs carry **explanation keys + params** (rendered by `src/i18n`), never display strings.

The thresholds and weights are **business rules fixed by BR-04 and BR-09**. They are written as named constants in one module (`src/domain/rules.ts`) so the oracle and the engine read the same numbers, but they are not a tunable policy object: changing one is a BR change logged in the plan §7, then a code change with a test update.

## 0. Shared types
Entity shapes are the data contract's (`ChildProfile`, `ExtractedDay`, `ConfirmedMenu`, `AssessmentOverride`, `DayDecision`, `Recipe`, `Settings`, `ReminderLogEntry`); the zod schemas in `src/domain/schema/` are generated from the contract tables, field for field. Only engine-internal types are defined here.

```ts
type LocalDate = string & { __brand: 'LocalDate' };   // 'YYYY-MM-DD', a civil date in Asia/Tokyo
type Instant   = number & { __brand: 'Instant' };     // epoch ms UTC
type ProfileId = string;   // an ing-, cat- or dish- id from the dictionary (likes / dislikes / exclusions)

interface Dictionary {     // BA's domain dictionary (docs/ba/domain-dictionary.md → data/dictionary.json), versioned
  version: string;
  ingredients: Record<string, { ja: string; kana: string; en: string; aliases: string[]; parents: string[] /* cat- ids */;
                                inherentAllergenIds: string[]; info: 'known' | 'varies';
                                seasoning: boolean;                       // dictionary §1 rule 8
                                animalOrigin: AnimalTag[];                 // B14: [] = no animal origin
                                animalOriginKnown: boolean }>;             // false = dictionary '?' (origin of products can't be bounded)
  categories:  Record<string, { ja: string; en: string; parents: string[] }>;
  dishes:      Record<string, { ja: string; en: string; aliases: string[]; parents: string[]; nameIngredientIds: string[];
                                definingIngredientId: string | null }>;   // OQ-16: the one food the dish *is* (コーンスープ → ing-corn)
  ambiguity:   Record<string, { forms: string[]; candidateIds: string[] }>;  // amb- groups (dictionary §7)
  allergens:   Record<string, { ja: string; en: string; tier: 'mandatory' | 'recommended'; retired?: boolean }>;
  allergenScheme: 'caa-2026-04';
}
type AnimalTag = 'meat' | 'pork' | 'beef' | 'chicken' | 'fish-seafood' | 'egg' | 'dairy' | 'gelatin';  // data contract §3.8
```
`animalOrigin` / `animalOriginKnown` are the data contract's names (§3.7–§3.8, dictionary §4). The dish and seasoning field names are still provisional until `data/dictionary.json` exists; the contract wins.

`expand(id)` = the id plus all its dictionary ancestors (ingredient or dish → categories → parent categories). `levels(id)` = the same set split by specificity: level 0 the id itself, level 1 its direct categories, level 2 their parents, and so on. Both are used wherever an id is compared with a profile entry, so "dislikes `cat-fish`" reaches `ing-mackerel`.

## 1. Preference assessment (BR-04, BR-05, BR-25)

```ts
type AssessmentState = 'likely-enjoyable' | 'mixed-uncertain' | 'low-preference' | 'not-assessed' | 'no-school-lunch';
type OverrideState   = 'likely-enjoyable' | 'mixed-uncertain' | 'low-preference';

function createAssessor(dict: Dictionary):
  (input: { date: LocalDate; menu: ConfirmedMenu; profile: ChildProfile | null; override?: AssessmentOverride }) => Assessment | null;
// returns the data contract's Assessment (§3.5); null when the date is neither a school day nor a no-lunch day of `menu`
```

**Matching** (exactly the domain dictionary §1 rules; the dictionary wins on any difference). For a school day, the assessed items are the day's `items` with `kind ≠ 'snack'` (OQ-07). Each item text is normalised (NFKC, katakana → hiragana, spaces, 「・」 and brackets removed, 「ー」 kept), then scanned: dish pass first (longest match; a dish adds its `nameIngredientIds`), then the ingredient/category pass over the remaining text; listed ingredient texts of the day (`ingredientsStatus = 'listed'`) go through the ingredient pass too. A match on an ambiguity-group form is **unresolved** unless a dictionary §7 resolution rule applies or the item has `resolvedIds` from review (used as-is). Kana forms shorter than 2 characters never match.

**Counting (PLAN §7 B1, B2, B5).** Let `F` = the set of **distinct dictionary ids found** in the day's assessed items and listed ingredients (dish ids, name-ingredient ids, ingredient and category ids; unresolved ambiguities contribute no id). "ピーマン in two dishes" is one found id; 「さば」 and 「さけ」 are two.
- **Verdict per found id, most specific entry wins (B2).** Walk `levels(f)` from level 0 upwards; at the first level that contains any `likedIds` or `dislikedIds` entry, that level decides: `dislike` if it contains a disliked entry, else `like`. Deeper levels are ignored. So liked `cat-fish` + disliked `ing-mackerel` → mackerel is disliked only; liked `ing-salmon` + disliked `cat-fish` → salmon is liked only. If one level holds both a like and a dislike (an id with two categories, one liked and one disliked), `dislike` wins (conservative: it can only move a day towards review, never towards `likely-enjoyable`). Seasonings (`seasoning = true`) get a verdict only from an entry naming their exact id (dictionary §1 rule 8).
- **Same food counts once (PLAN §7 "OQ-16 overruled", narrowed by "OQ-16 collapse narrowed (not transitive)").** Before counting, the found ids are grouped into **foods** by exactly these steps, with no chaining:
  1. *Identical ids* are one food across the whole day (`F` is a set).
  2. *Dish + defining ingredient, same item only:* within one lunch item, a dish id joins the food of its `definingIngredientId` if that ingredient id was found **in the same item** (「コーンスープ」 → `dish-corn-soup` + `ing-corn` = 1 food). Its other name ingredients stay separate foods (「豚のしょうが焼き」 → `ing-pork` and `ing-ginger` = 2 foods; the dish joins neither unless one is its defining ingredient). A dish with `definingIngredientId = null`, or whose defining ingredient was not found in that item, is its own food. Dishes never join anything across items.
  3. *Ancestor/descendant:* a found id that is a strict dictionary ancestor of another found id (any item) does not form a food of its own; it is covered by each found descendant (鶏肉 `ing-chicken` + 鶏もも肉 `ing-chicken-thigh` = 1 food). Two descendants of a common ancestor are never grouped with each other through it (鶏肉 + 鶏もも肉 + 鶏むね肉 = 2 foods).
  Each food is represented by its **most specific id** (the remaining ingredient/category id, or the dish when the food is a dish alone). A food's verdict is the verdict (B2) of its first member that has one, in the order ingredient → dish → category; members without a verdict are skipped. The verdict of the representative already sees absorbed ancestors through `levels`.
- `D` = number of foods with verdict `dislike`; `L` = number of foods with verdict `like` (B1). Two different fish with a disliked `cat-fish` give `D = 2`; 鶏肉 and 鶏もも肉 on the same day give one food; 豚のしょうが焼き with disliked `ing-pork` and `ing-ginger` gives `D = 2`.
- `U` = items counted as uncertain ÷ assessed items, where an item is **uncertain** when it produced no id **or** it has at least one unresolved ambiguity, even if it also matched something (B5). The matched ids of such an item still count in `F`.

`Assessment.matched` (contract §3.5) lists the counted foods by their representative id: `dislikedIds` / `likedIds` are representative ids (each with the profile entry that decided it, for the explanation 「苦手：さば（さかな）」), `unmatchedItems` and `ambiguousItems` the uncertain items.

**Rules, evaluated in order, first match wins (`calculatedState`, `explanationKey`)** — exactly BR-04:

| # | Condition | `calculatedState` | `explanationKey` |
|---|-----------|-------------------|------------------|
| 1 | date is in `noLunchDays` | `no-school-lunch` | `assess.noLunch` |
| 2 | profile is null, or `likedIds` and `dislikedIds` both empty | `not-assessed` | `assess.notAssessed` |
| 3 | `D ≥ 2` | `low-preference` | `assess.low` |
| 4 | `D = 1` and `L = 0` | `low-preference` | `assess.low` |
| 5 | `D = 1` and `L ≥ 1` | `mixed-uncertain` | `assess.mixedOne` |
| 6 | `D = 0`, `L ≥ 1`, `U ≤ 0.5` | `likely-enjoyable` | `assess.likely` |
| 7 | `D = 0`, `L ≥ 1`, `U > 0.5` | `mixed-uncertain` | `assess.mixedUnknown` |
| 8 | `D = 0`, `L = 0`, `U > 0.5` | `mixed-uncertain` | `assess.mixedUnknown` |
| 9 | `D = 0`, `L = 0`, `U ≤ 0.5` | `mixed-uncertain` | `assess.mixedNeutral` |

Rows 8–9 are PLAN §7 B4: the state is BR-04's "otherwise → `mixed-uncertain`"; only the explanation differs ("mostly unknown dishes" vs "nothing liked or disliked found"). `U` uses exact rational comparison (`2 * uncertain ≤ assessed`), never floating point. Dates that are neither school days nor no-lunch days (weekends, holidays, unlisted dates, months without a confirmed menu) get **no assessment** (BR-25).

**Overrides (BR-05).** On a school day with an override, `state = override.state`, `explanationKey = 'assess.override'`, and `calculatedState` plus `matched` are still returned so the UI can show "you set: … · app suggestion: …". Overrides are stored per date (`store.overrides`), survive reload, reassessment, profile edits and menu refresh, and are removed only by the parent. If the date is in `changedDatesSincePrevious` of a menu version newer than `override.menuVersionAtSet`, the UI shows 「献立が変わりました」; the override still applies.

**No-lunch wins over an override (PLAN §7 B6).** Row 1 is checked **before** the override: on a date in `noLunchDays` the result is `no-school-lunch` / `assess.noLunch` whatever override exists. The override is kept **dormant** (stored, not shown, not applied) and comes back unchanged if a later refresh makes the date a school day again. The same holds for a date a refresh removed from the menu (no assessment, override dormant). Such dates are listed in the refresh's "needs review" list (§2, `refreshReview`).

**Independence (BR-01).** The assessor's inputs are `menu`, `profile`, `override` and the dictionary; it has no parameter through which it could read or write `decisions` (contract rule `assessment-independent`). Same inputs + same `dictionary.version` → deep-equal output. Tests: property test that shuffling items, ingredients, likes and dislikes doesn't change the output; every row of the table above on fixtures; snack-only days; `U` exactly 50 % (rows 6/7 and 8/9); two different disliked ids through one disliked category → `D = 2` (B1); dish + defining ingredient in one item = 1 food, dish + a non-defining name ingredient = 2 foods, the same dish and ingredient in different items not grouped, ancestor/descendant ids = 1 food, two siblings under a found ancestor = 2 foods (OQ-16 narrowed); most-specific-entry pairs in both directions and the same-level tie (B2); an item with a match plus an unresolved ambiguity counted in `U` and its match still counted in `D`/`L` (B5); an override on a date that becomes a no-lunch day → `no-school-lunch`, override dormant, restored when the date becomes a school day again (B6).

## 2. Decision state machine (BR-02, BR-03, BR-19, BR-27)

States are the data contract's (§3.6). One `DayDecision` record per date, written **only** by `transition`; no record = derived display state.

| State | Meaning | Stored? |
|-------|---------|---------|
| `school-lunch-planned` | School lunch (the derived default for a school day) | only after a parent action (「給食に戻す」, or ticking the reservation flag) |
| `not-confirmed` | 「あとで決める」: the parent will decide later | yes |
| `homemade-bento-planned` | Homemade bento with exactly one confirmed `recipeId` (BR-03) | yes |
| `no-school-lunch` | Derived from `noLunchDays`; display only | never (`decision-no-lunch-not-stored`) |

Orthogonal field `reservationDoneExternally` (the parent's own record, BR-19): only `true` in `school-lunch-planned`; any transition out of `school-lunch-planned` clears it.

```ts
type DecisionState = 'school-lunch-planned' | 'not-confirmed' | 'homemade-bento-planned' | 'no-school-lunch';
type DecisionEvent =                                   // one per parent action in user-stories §E5
  | { type: 'CONFIRM_RECIPE'; recipeId: string }       // 「手作りお弁当にする」 → pick → 「この日に決定」 (one event; opening the
                                                       //  recommendation view is UI navigation and changes nothing, US-E5-03/AC1, AC3)
  | { type: 'CHANGE_RECIPE'; recipeId: string }        // 「レシピを変更」
  | { type: 'DEFER' }                                  // 「あとで決める」
  | { type: 'SET_SCHOOL_LUNCH' }                       // 「給食に戻す」 (confirm dialog is UI, US-E5-06/AC3)
  | { type: 'CLEAR_PLAN' }                             // 「計画を取り消す」: bento-day (note ²) or a plan a refresh put on a no-lunch/removed date (note ³); deletes the record
  | { type: 'KEEP_PLAN' }                              // 「この予定のままにする」: acknowledges a refresh conflict (note ³); state unchanged
  | { type: 'MARK_RESERVATION'; done: boolean };       // 「園で予約済み（自分で記録）」

interface DayContext { date: LocalDate; kind: 'school-day' | 'bento-day' | 'other-no-lunch' | 'not-in-menu';
                       menuVersion: number | null /* confirmed version of the date's month */ }
type DecisionConflict = 'none' | 'plan-on-no-lunch' | 'plan-date-removed' | 'dormant';
function displayedDecision(ctx: DayContext, record: DayDecision | undefined):
  { state: DecisionState | null /* null: no decision shown */; conflict: DecisionConflict; needsAck: boolean };
function transition(ctx: DayContext, record: DayDecision | undefined, event: DecisionEvent,
                    env: { today: LocalDate; now: Instant; recipe: (id: string) => Recipe | undefined }):
  { ok: true; next: DayDecision | null /* null = delete record */ } | { ok: false; error: DecisionError };
type DecisionError = 'INVALID_TRANSITION' | 'DATE_IN_PAST' | 'NOT_PLANNABLE_DAY' | 'UNKNOWN_RECIPE' | 'RECIPE_EXCLUDED';
```
`transition` takes **no `Assessment`**: an assessment cannot change a decision because it is not an input (BR-01, BR-02). A type-level test (`expectTypeOf`) and a property test (random sequences of non-parent operations — import, refresh, assessment, profile edit, clock advance — leave `decisions` deep-equal) guard this.

**Allowed transitions** (user-stories §E5, plus the refresh-conflict row from PLAN §7 B7 / US-E3-05/AC2; anything not listed → `INVALID_TRANSITION`):

| From (displayed) \ Event | CONFIRM_RECIPE | DEFER | SET_SCHOOL_LUNCH | CHANGE_RECIPE | CLEAR_PLAN | KEEP_PLAN | MARK_RESERVATION |
|---|---|---|---|---|---|---|---|
| `school-lunch-planned` | → `homemade-bento-planned` | → `not-confirmed` | — | — | — | — | → `school-lunch-planned` (flag set/cleared, record stored) |
| `not-confirmed` (school day only ²) | → `homemade-bento-planned` | — | → `school-lunch-planned` | — | — | — | — |
| `homemade-bento-planned` (school day or bento-day) | — | school day only → `not-confirmed` ² | school day only → `school-lunch-planned` | → `homemade-bento-planned` (new `recipeId`, new snapshots, `plannedAt` kept) | bento-day only → record deleted ² | — | — |
| `homemade-bento-planned` on `other-no-lunch` or `not-in-menu` (refresh conflict ³) | — | — | — | — | → record deleted | → unchanged, `acknowledgedMenuVersion` set | — |
| `no-school-lunch` | bento-day only → `homemade-bento-planned` (BR-25, OQ-03) | — | — | — | — | — | — |

Guards, checked before the table, in this order:
1. `ctx.kind` is `not-in-menu` or `other-no-lunch` → `NOT_PLANNABLE_DAY` (US-E5-02/AC2, US-E5-08/AC2), **except** `CLEAR_PLAN` and `KEEP_PLAN` when the stored record there is `homemade-bento-planned` (refresh conflict ³, PLAN §7 B7). A dormant `not-confirmed` / `school-lunch-planned` record there accepts no event.
2. `ctx.date < env.today` (Asia/Tokyo) → `DATE_IN_PAST` (BR-27, `decision-no-past-write`). Today is writable (US-E5-03/AC4).
3. `CONFIRM_RECIPE` / `CHANGE_RECIPE`: recipe must resolve (`UNKNOWN_RECIPE`) and must pass the ranking hard filters for the current profile (`RECIPE_EXCLUDED`, BR-06 "never plannable").

Record writes (contract §3.6 and "Record metadata"; field names follow the contract):
- Every successful write sets `updatedAt = now` (and `createdAt`, `ownerId` on a new record). Every **state or recipe change** also sets `decidedAt = now` and appends to `history` (last 5 entries). `KEEP_PLAN` sets only `acknowledgedMenuVersion = ctx.menuVersion` and `updatedAt`.
- **`plannedAt`** (PLAN §7 B10): set to `now` by `CONFIRM_RECIPE` (the transition **into** `homemade-bento-planned`); **unchanged** by `CHANGE_RECIPE` and `KEEP_PLAN`; cleared when the record leaves `homemade-bento-planned` (a later `CONFIRM_RECIPE` sets it anew). It exists only for the day-before suppression rule (§4).
- Bento states write `recipeNameSnapshot` **and `recipeShortNameSnapshot { ja, en }`** (the recipe's `shortNameJa` / `shortNameEn` at decision time; PLAN §7 "H1 non-blocking"), so a calendar cell can still show the curated short name after the recipe leaves the library (US-E6-06); `CHANGE_RECIPE` refreshes both snapshots.

² **Bento days** (data contract rule `decision-bento-day-remove`, US-E5-08/AC3): on a `bento-day` the parent cancels a plan with `CLEAR_PLAN`, which deletes the stored record so the day shows its derived `no-school-lunch` again. `school-lunch-planned` and `not-confirmed` are never stored for a no-lunch date by a parent action, so `DEFER`, `SET_SCHOOL_LUNCH` and `MARK_RESERVATION` are invalid there.

³ **Refresh conflicts** (PLAN §7 B6, B7; US-E3-05/AC2). `displayedDecision` resolves a stored record against the date's current kind:

| Stored record | Date kind after refresh | Shown decision | `conflict` | Allowed events | Reminder (§4) |
|---|---|---|---|---|---|
| any | `school-day` | stored state (normal) | `none` | normal table | normal |
| `homemade-bento-planned` | `bento-day` | `homemade-bento-planned` (normal, BR-25) | `none` | bento-day row | normal |
| `homemade-bento-planned` | `other-no-lunch` | `homemade-bento-planned`, flagged 「献立が変わりました」 (assessment slot shows `no-school-lunch`) | `plan-on-no-lunch` | `KEEP_PLAN`, `CLEAR_PLAN` | kept until cleared |
| `homemade-bento-planned` | `not-in-menu` (date removed from a confirmed month) | `homemade-bento-planned`, flagged 「献立が変わりました」 | `plan-date-removed` | `KEEP_PLAN`, `CLEAR_PLAN` | kept until cleared |
| `not-confirmed` / `school-lunch-planned` | any no-lunch kind | `no-school-lunch` (record dormant) | `dormant` | none | none (never had one) |
| `not-confirmed` / `school-lunch-planned` | `not-in-menu` | none (record dormant) | `dormant` | none | none |

`needsAck` = conflict is `plan-on-no-lunch` or `plan-date-removed` and `acknowledgedMenuVersion` is absent or older than the menu version that last changed this date. While `needsAck`, the date appears in the upcoming summary (today view, weekly reminder content) until the parent clears or keeps it. Dormant records are kept (BR-13), never shown, and come back unchanged if a later refresh makes the date a school day again; with the dormant overrides (§1) they are listed in the refresh's review list.

**Menu refresh never changes decisions (BR-13).** Replacing a month's menu keeps 100 % of that month's `decisions` and `overrides`. `src/domain/menu` exports `refreshReview(previous, next, decisions, overrides)` (read-only on the records): the dates whose kind changed under a stored decision or override, plus overridden dates in `changedDatesSincePrevious` (US-E3-05/AC2, AC3); the confirm screen and the calendar show it. Only a parent event changes a record. `transition` is the **only** writer of `decisions`; `src/domain/menu` does not import `src/domain/decision` (import-boundary test; it reads records through the schema types only).

## 3. Recipe ranking (BR-06, BR-07, BR-09; R-3; OQ-13)

```ts
interface RankedRecipe { recipeId: string; score: number; group: 'clear' | 'allergen-incomplete'; minutes: number;
                         reasons: ExplanationKey[]; checkLabel: boolean /* has a varies-by-product ingredient → 「表示を確認」 */ }
interface RankingResult {
  top: RankedRecipe[];                                       // ≤ 3; fewer only if fewer pass the filters (never padded)
  excluded: { recipeId: string; reason: 'allergen' | 'may-contain' | 'excluded-ingredient' | 'diet' | 'diet-incomplete' | 'allergen-incomplete' }[];
  disclaimer: 'allergy.noGuarantee';                         // always present (BR-07)
  statusUnknownBanner: boolean;                              // profile.allergyStatus = 'unknown' (BR-07)
}
function createRanker(library: Recipe[], dict: Dictionary):
  (input: { date: LocalDate; profile: ChildProfile; planned: { date: LocalDate; recipeId: string }[] }) => RankingResult;
```

**Step 1 — hard filters (BR-06).** A recipe is removed, with the first matching reason, if:
- a. **`allergen`**: `recipe.allergenIds ∩ profile.knownAllergenIds ≠ ∅`;
- b. **`may-contain`**: `recipe.mayContainAllergenIds ∩ profile.knownAllergenIds ≠ ∅` (variable processed foods are excluded on a match, OQ-13);
- c. **`excluded-ingredient`**: some `expand(ingredient.ingredientId)` intersects `profile.excludedIngredientIds`;
- d. **`diet`** (PLAN §7 B14): the recipe violates a selected diet. The check works on **ingredient-level animal-origin tags from the dictionary** (`animalOrigin`), never on allergen ids: each diet forbids a set of tags (data contract §3.8 owns the table; it forbids tags such as `meat`, `pork`, `beef`, `chicken`, `fish-seafood`, `gelatin`), and a recipe violates the diet when its `animalOrigin` (union of its ingredients' tags, which include at least the dictionary's tags for each id) intersects it. Hidden animal sources are tagged on the ingredient itself (だし → `fish-seafood`; コンソメ, カレールウ → meat and dairy tags; ウインナー → `meat`, `pork`), so they are caught without the recipe naming the animal. No fallback through categories or allergen ids.
- e. **`diet-incomplete`** (B14, OQ-18, contract `ranking-diet-incomplete`, same path as R-3): the profile has at least one diet selected and the recipe has `dietDataComplete = false` (some ingredient with `animalOriginKnown = false`; at runtime also an ingredient id that does not resolve) → excluded, whatever the diet. With no diet selected it has no effect.

`recipe.dietOk` stays a derived convenience field: the validator checks it equals the set derived from the dictionary tags (`recipe-diet-derived`), and at runtime the ranker uses the dictionary-derived result, so a stale `dietOk` can only make the filter stricter, never looser.

Filters use the recipe's own data **and** the dictionary: the ranker recomputes each ingredient's inherent allergens and animal-origin tags from the dictionary and treats `allergenIds ∪ inherent` as the recipe's allergens, so a stale recipe file cannot hide an allergen or an animal source the dictionary knows about.

**Step 2 — incomplete allergen data (R-3, contract rule `ranking-incomplete-allergen`).** A recipe has incomplete allergen data when `allergenDataComplete = false` (some ingredient has `allergenInfo = "unknown"`: a processed food whose label allergens no cited source establishes). As a runtime safety net the ranker also treats a recipe as incomplete when its `allergenScheme` differs from the dictionary's current scheme, an ingredient id does not resolve, or an ingredient's `allergenIds` lacks an inherent allergen the dictionary lists (the validator rejects these at build time, so in a correct build they never occur).
- `profile.knownAllergenIds` non-empty → incomplete recipes are **excluded** (`allergen-incomplete`), like a filter match.
- Otherwise → kept in group `allergen-incomplete` (ordered after every `clear` recipe), with reason `rank.allergenIncomplete` (US-E6-02/AC5–AC6).
- A `varies-by-product` ingredient with cited `possibleAllergenIds` is **complete** data: it went through filter 1b, the recipe stays in `clear`, and it shows 「表示を確認」 (`checkLabel = true`).

**Step 3 — score (BR-09, exact).** For each survivor, with `R = ⋃ expand(ingredientId)` over its ingredients plus its `dish-` id if any:
```
score = +2 × |likedIds ∩ R|            (distinct liked ids)
        +1 if recipe.themeId ∈ profile.themeIds
        −3 × |dislikedIds ∩ R|         (distinct disliked ids)
        −2 if the same recipeId is homemade-bento-planned on any other date d with |d − date| ≤ 14 days
        −1 if recipe.minutes > 20
```
`planned` is built by the UI layer from stored `homemade-bento-planned` decisions (read-only use; the ranker never writes). Disliked items are a penalty, not a filter (the parent may still want them).

**Step 4 — order.** `group` (`clear` first) → `score` desc → `minutes` asc → `id` asc (code-point order). Take the first 3. No randomness.

Reasons shown on a card (keys): `rank.liked {labels}`, `rank.theme`, `rank.quick` (≤ 20 min), `rank.recent` (planned within ±14 days), `rank.disliked {labels}`, `rank.allergenIncomplete`, `rank.checkLabel`. The UI always shows `allergy.noGuarantee` and, when the status is unknown, `allergy.statusUnknown` (BR-07).

Tests: property tests on the real library ("no top-3 recipe has an allergen or may-contain allergen of the profile", "no excluded ingredient via any ancestor", "same input → same order", "library order doesn't matter"); fixture tests for each filter, each score term, both tie-breaks, the ±14-day boundary (day 14 penalised, day 15 not), the 20-minute boundary, and both branches of step 2 (known allergens / none) and the `allergyStatus = 'unknown'` banner; each diet against hidden animal sources (だし, コンソメ, カレールウ, ウインナー, gelatin) and an unknown-origin ingredient with and without a selected diet (B14); property test on the real library "no top-3 recipe has an ingredient whose tags a selected diet forbids".

## 4. Reminder planning (BR-15, BR-16, BR-17, BR-18)

```ts
type ReminderType = 'weekly' | 'day-before';
interface ReminderJob {
  key: string;            // data contract ReminderLogEntry.key: 'weekly:<firstCoveredDate>' | 'day-before:<plannedDate>'
  numericId: number;      // stable 31-bit FNV-1a of key (Android notification id, ADR 005); uniqueness asserted
  type: ReminderType;
  dueAt: Instant;         // from a JST wall time; device timezone irrelevant (BR-15)
  expiresAt: Instant;     // after this the job is dropped
  target: { route: string };          // '#/recipe/<id>?date=…' | '#/day/<date>' | '#/calendar/<month>'
  content: { titleKey: string; bodyKey: string; params: Record<string, string | number | string[]> };
  contentHash: string;    // hash(type, dueAt, target, content): a change means "update"
}
function planReminders(input: {
  days: { date: LocalDate; decision: DecisionState | null; assessment: AssessmentState | null; recipeId?: string;
          plannedAt?: Instant; conflict: DecisionConflict; needsAck: boolean; hasMenu: boolean }[];
  settings: Settings['reminders']; now: Instant; horizonDays: number /* web: 8, Android: 35 */;
}): ReminderJob[];                                               // sorted by dueAt, then key
function diffSchedule(current: { key: string; contentHash: string }[], desired: ReminderJob[]):
  { remove: string[]; upsert: ReminderJob[] };                 // pure; the NotificationScheduler adapter applies it
```

**Rules** (all instants from JST wall times via `src/domain/time`, BR-15):
- **Day-before (BR-16):** one job per `homemade-bento-planned` date D with `today ≤ D ≤ today + horizon`, when `dayBefore.enabled`. `dueAt = (D − 1 day) @ dayBefore.time`; `expiresAt = D @ 00:00` (contract §3.9). Target: the recipe for D (the day sheet if the recipe no longer resolves, US-E7-02/AC2). **Suppression (PLAN §7 B10):** if the decision's `plannedAt ≥ dueAt` (the day *first* became `homemade-bento-planned` at or after the reminder's due time), no job (US-E7-02/AC5: the Today view covers it). `decidedAt` is **not** used: `CHANGE_RECIPE` keeps `plannedAt`, so changing the recipe after 17:30 never deletes a pending or due reminder, it only updates its content. A plan in refresh conflict (§2 ³, B7) keeps its day-before job until the parent clears it; the days list therefore includes every stored `homemade-bento-planned` record in the horizon, also on `other-no-lunch` and removed dates. `not-confirmed` and `school-lunch-planned` days never get one (US-E5-05/AC3).
- **Weekly (BR-16, OQ-06):** one job per occurrence of `weekly.weekday` W in the horizon, when `weekly.enabled`. `dueAt = W @ weekly.time`; covers the **7 days W + 1 … W + 7**; key `weekly:<W + 1>`; `expiresAt = (W + 8) @ 00:00` (24:00 of the last covered date, contract §3.9). Content: per covered date, `low-preference` days still `school-lunch-planned` or `not-confirmed`, all `not-confirmed` days, and `homemade-bento-planned` days with recipe name; dates without a confirmed menu are summarised as "no menu yet"; plans with `needsAck` (refresh conflict, §2 ³) are listed as 「献立が変わりました」 (US-E7-01/AC4, AC5; US-E3-05/AC2). It is **always** produced, also when there is nothing to report (US-E7-01/AC3).
- **Missed and expired (BR-17):** a job with `dueAt ≤ now < expiresAt` that is not in `reminderLog` as shown/dismissed is **due** and shown on next open, labelled with its original time; `expiresAt ≤ now` → never returned.
- **One per key (BR-17):** keys derive from `(type, date)` only, so at most one job per key exists by construction; `reminderLog` (contract §3.1) records `shownAt` / `dismissedAt` per key, so a dismissed reminder is never shown again (US-E7-05/AC1), except the debug panel's 「強制表示」.
- **Same action (BR-17):** after **every** committed state change (decision, settings, menu confirm), on start/resume and on the minute tick, the app runs `planReminders` → `diffSchedule` → adapter. Changing the recipe changes `content` → `contentHash` → update under the same key; cancelling or deferring removes the job from `desired` → removed, all within the same reducer action as the decision write. Running the pipeline twice yields an empty diff (unit-tested property).
- **Settings changes (US-E7-04/AC2):** new times apply to future jobs; a key already in `reminderLog` as shown is not shown again.
- **Locale:** content is keys + params; rendering happens at display (web) or schedule time (Android); a locale change changes `contentHash` on Android only.

Tests: key stability; idempotent diff; expired dropped; due-on-open; `plannedAt ≥ dueAt` skip, and a recipe change after `dueAt` on a day planned before it keeps the job with new content (B10); a conflicting plan keeps its job until `CLEAR_PLAN` (B7); month and year boundaries (2027-01-29/2027-02-01 → 2027-01-28 and 2027-01-31 17:30 JST; 2028-02-29/03-01; weekly on 2026-11-29 covering 11-30 … 12-06); device TZ ≠ JST (`TZ=Europe/Paris`, `America/Los_Angeles` test project).

## 5. Module boundaries
```
src/domain/time        jst.ts (LocalDate, Instant, JST conversion, week/month helpers, `weekStartsOn`-aware calendar grid)
src/domain/schema      zod schemas = data contract v1 (store, profile, extracted/confirmed menu, recipe, dictionary)
src/domain/menu        review, confirm, month replace (keeps decisions/overrides), changedDatesSincePrevious, refreshReview, Reiwa cross-check
src/domain/assessment  createAssessor
src/domain/decision    displayedDecision, transition
src/domain/recipes     createRanker
src/domain/reminders   planReminders, diffSchedule
src/domain/share       weekly share text (BR-21: dates, decision labels, recipe names, fixed notes only)
src/domain/storage     repository, migrations, Storage port
src/domain/rules.ts    BR-04 / BR-09 / BR-16 constants
src/domain/ports.ts    Clock, Storage, MenuExtractor, PdfSource, NotificationScheduler, Share (interfaces only)
```
`assessment`, `recipes`, `menu` and `reminders` do not import `decision`; `assessment` does not import `recipes`. An import-boundary test over the import graph enforces this.

## Alternatives considered
| Option | Why not (now) |
|--------|---------------|
| Ask the LLM to assess preferences or pick recipes | Brief §7 forbids runtime AI for this; non-reproducible, unexplainable, sends child data out |
| XState for the decision machine | 4 states, 6 events; a transition table + exhaustive test is clearer and ~15 KB lighter |
| Embedding-/ML-based ingredient matching | Non-deterministic across versions; a curated dictionary with aliases is explainable and testable |
| Count distinct *profile entries* hit for D/L (earlier draft) | PLAN §7 B1: 「苦手な食材が2つ」 must mean two different foods; one disliked `cat-fish` with さば and さけ on the day is two dislikes, not one |
| Diet filter from allergen ids (`alg-pork`, `alg-beef`) | PLAN §7 B14: allergen ids miss hidden animal sources (だし, consommé, roux) and chicken/fish for vegetarians; origin tags on dictionary ingredients cover them |
| Suppress the day-before reminder by `decidedAt` | PLAN §7 B10: a recipe change after 17:30 would silently delete a reminder for a day planned days earlier |
| Tunable weight/threshold policy object | The numbers are approved business rules (BR-04, BR-09); a policy object invites silent drift from the BR table |
| Show incomplete-allergen recipes to allergic children in a lower group (earlier draft) | Contradicts BR-06 / R-3: an allergic child never sees a recipe whose allergen data can't be checked |
| Storing `school-lunch-planned` records for every day | Bloats storage and makes "menu changed" logic harder; the default is derived |
| Random tie-break / shuffle for variety | Breaks reproducibility; variety comes from the ±14-day penalty instead |
| Scheduling reminders directly from UI handlers | Duplicate and orphaned reminders; the plan → diff → apply pipeline is idempotent |

## Consequences
- Every rule is testable with fixtures, and QA can build an oracle from this document, the BR table and the data contract.
- Changing a threshold or weight is a BR change (plan §7) with test updates, visible in review.
- Matching quality depends on the BA's dictionary coverage of school-menu vocabulary; unmatched words push a day towards `mixed-uncertain`, never towards `likely-enjoyable`.
- Stored fields this ADR relies on, as named in the data contract: `DayDecision.plannedAt`, `recipeShortNameSnapshot`, `acknowledgedMenuVersion` (§3.6); ingredient `animalOrigin` + `animalOriginKnown`, recipe `animalOrigin`, `dietDataComplete`, `dietOk` (§3.7–§3.8).
- Must test (story IDs from `docs/ba/user-stories.md`): each assessment row, B1/B2/B5 counting and override precedence incl. no-lunch over override (B6); override persistence and the 「献立が変わりました」 flag across a menu replace; the full transition table incl. guards, past dates and every refresh-conflict row (B6/B7); `plannedAt` set once and kept by `CHANGE_RECIPE`; snapshots incl. short names; refresh never changes decisions; every hard filter incl. may-contain, ancestor exclusion and diet tags incl. hidden sources and unknown origin (B14); the incomplete-data branches; every score term and tie-break; reminder keys, idempotent diff, expiry, JST correctness and calendar boundaries.

## Revisit when
- Parents override more than ~30 % of calculated assessments in real use → BR-04 or the dictionary is wrong; revisit with the BA (BR change).
- The library grows past ~200 recipes → profile the ranker (currently O(n·ingredients)).
- Multiple children (v1+) → assessments and rankings keyed by child; decisions may become per child.
- ADR 005's Android work finds limits (exact alarms, max pending notifications) that the 35-day Android horizon exceeds → shrink it.

## Change log
- 2026-10-24 · proposed (kick-off).
- 2026-10-24 · **accepted** at H1. R-2: states and events renamed to the data contract (`school-lunch-planned`, `homemade-bento-planned`, `not-confirmed`, `no-school-lunch`; `bento_pending` and `CHOOSE_BENTO` removed, `DEFER` added, `CLEAR_PLAN` per contract rule `decision-bento-day-remove`). Assessment replaced by BR-04's exact table and the contract's explanation keys. R-3: hard filters incl. may-contain (OQ-13); recipes with `allergenDataComplete = false` excluded when `knownAllergenIds` is non-empty, else ranked last (contract `ranking-incomplete-allergen`); earlier score terms replaced by BR-09's exact formula and tie-break. Reminders aligned with BR-16/17 and contract keys/expiry (weekly covers the next 7 days, always delivered). Policy object replaced by BR constants.
- 2026-10-24 · H1 fix round (Developer), per PLAN §7 "H1 rulings on QA blockers", B6, B7, B10, B14 and "H1 non-blocking". §1: D/L count distinct dictionary ids found in the day's items (B1, replaces "profile entries hit"); most specific profile entry decides each id, dislike wins a same-level tie (B2); D = 0, L = 0 split into `mixedUnknown` (U > 50 %) / `mixedNeutral` (B4); an item with a match plus an unresolved ambiguity counts toward U (B5); matching restated as the dictionary §1 rules (dish pass, name ingredients, seasonings); no-lunch beats an override, which stays dormant (B6). §2: `KEEP_PLAN` event and refresh-conflict rows (plan on a now-no-lunch or removed date: kept, flagged, only keep / `CLEAR_PLAN`; dormant non-bento records) (B6/B7); `plannedAt` (B10); short-name snapshot; `refreshReview`. §3: diet filter on dictionary animal-origin tags incl. hidden sources, unknown origin with a diet → `diet-incomplete` exclusion (B14). §4: day-before suppression by `plannedAt`, not `decidedAt` (B10); conflicting plans keep their reminder and appear in the weekly content (B7).
- 2026-10-24 · H1 late ruling (Developer), PLAN §7 "OQ-16 overruled": D/L count **foods**, not raw ids: a dish id and an ingredient id from the same menu text, and ancestor/descendant ids on one day, collapse to one food represented by its most specific id. Names aligned with the data contract: `animalOrigin` + `animalOriginKnown` (tag `fish-seafood`), recipe `dietDataComplete` (rule `ranking-diet-incomplete`, OQ-18), `DayDecision.recipeShortNameSnapshot { ja, en }`.
- 2026-10-24 · OQ-16 narrowed (Developer), PLAN §7 "OQ-16 collapse narrowed (not transitive)": a dish collapses only with its `definingIngredientId` (new dictionary field, may be null) found in the same lunch item; other name ingredients are separate foods; ancestor/descendant ids collapse; nothing else groups across items; no transitive closure (siblings under a common ancestor stay separate). Precedence ingredient → dish → category unchanged.
- 2026-10-25 · M2 built (Developer), see ADR 007. No rule change. Implementation notes: the matcher, assessor, override writer, `transition` and `refreshReview` follow sections 1 and 2 as written; `calendar/day-view.ts` is a new pure module (section 5) that derives calendar cells from `displayedDecision` and the assessor output. D-M1-06 for decision edits: a refused save reloads the stored version and shows the toast, with no re-apply (ADR 007 decision 8).
