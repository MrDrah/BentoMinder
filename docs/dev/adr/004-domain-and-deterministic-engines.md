# ADR-004: Pure domain layer and the four deterministic engines

Status: proposed · 2026-10-24 · Owner: Developer

## Context
The brief draws a hard line (§7): **the AI interprets the menu once a month; everything after that is deterministic, explainable and testable.** Four engines carry the product's rules:

| Engine | Brief | What can go wrong if it isn't pure |
|--------|-------|------------------------------------|
| Preference assessment | §8 | Same menu + profile gives different labels on two days; overrides lost on refresh |
| Decision state machine | §9 | A low-preference label silently becomes a bento plan; a refresh wipes a plan |
| Recipe ranking | §10 | A known allergen slips into the top 3; results change order between taps |
| Reminder planning | §11 | Duplicate or stale notifications; wrong time when the phone isn't on JST |

The core rule (PROJECT_BRIEF §3): **assessment and decision are separate; the app never changes a decision on its own.** The never-rule: **never claim allergy safety or suggest a recipe containing a known allergen / excluded diet item.** QA builds an independent oracle for the assessment and the state machine, so the rules below must be precise enough to re-implement.

## Decision
All four engines live in `src/domain/` as **pure functions over plain data**: no DOM, no network, no `Date.now()`, no randomness. Data they depend on (ingredient dictionary, allergen list, recipe library, policies) is **passed into factories**; `src/domain/index.ts` binds the shipped data; tests pass fixtures. "Now" is always a parameter (`Instant` from the `Clock` port). Outputs carry **explanation keys + params** (rendered by `src/i18n`), never display strings.

Thresholds and weights are a versioned `Policy` object, so the BA can tune them without code changes to the algorithm and QA's oracle can read the same numbers. The defaults below are the Developer's proposal; **the BA confirms them at H1** (they are business rules).

## 0. Shared types
```ts
type LocalDate = string & { __brand: 'LocalDate' };   // 'YYYY-MM-DD', a civil date in Japan
type Instant   = number & { __brand: 'Instant' };     // epoch ms UTC
type IngredientId = string;  type CategoryId = string;  type AllergenId = string;  type RecipeId = string;

interface Dictionary {          // BA's domain dictionary (data/dictionary.json), versioned
  version: string;
  ingredients: Record<IngredientId, { ja: string; en: string; aliases: string[]; categories: CategoryId[]; allergens: AllergenId[] }>;
  categories: Record<CategoryId, { ja: string; en: string }>;
  allergens: Record<AllergenId, { ja: string; en: string; tier: 'mandatory' | 'recommended' }>; // 特定原材料 8 + 準ずるもの 20
}

interface ChildProfile {
  likes:    { ingredients: IngredientId[]; categories: CategoryId[] };
  dislikes: { ingredients: IngredientId[]; categories: CategoryId[] };
  diet: DietRule[];                                   // e.g. 'no-pork', 'vegetarian', 'no-raw-egg'
  allergies: { status: 'none-known' | 'known' | 'unknown'; allergens: AllergenId[] };
  themes: string[]; ageRange: string; nickname?: string; note?: string; // note never sent anywhere
}

interface MenuDay {                                   // from a confirmed MenuMonth (ADR 002 defines extraction)
  date: LocalDate;
  lunch: 'served' | 'none' | 'unknown';
  items: { name: string; ingredients: string[] | null; uncertain: boolean }[];
  declaredAllergens: AllergenId[] | null;             // null = the menu didn't declare; never read as "none"
  contentHash: string;                                // hash of normalised items; detects changes on refresh
}
```

## 1. Preference assessment

```ts
type AssessmentState = 'likely_enjoyable' | 'mixed_or_uncertain' | 'low_preference' | 'not_assessed' | 'no_school_lunch';

interface AssessmentPolicy { version: 1; dislikeWeight: 2; likeWeight: 1; lowAtDislikes: 2; lowAtNet: -2; uncertainAtUnmatchedRatio: 0.5 }

interface Assessment {
  date: LocalDate;
  state: AssessmentState;
  source: 'rules' | 'override';
  computed: AssessmentState;           // what the rules say, even when overridden (shown as "app suggestion")
  explanation: ExplanationKey[];       // e.g. { key: 'assess.dislikes', params: { count: 2, names: ['pepper','eggplant'] } }
  matched: { liked: IngredientId[]; disliked: IngredientId[]; unmatched: string[] };
  overrideStale?: boolean;             // override set on an older menu version of this day
  inputs: { policyVersion: number; dictionaryVersion: string; menuContentHash: string };
}

function createAssessor(dict: Dictionary, policy: AssessmentPolicy):
  (day: MenuDay | undefined, profile: ChildProfile, override?: AssessmentOverride) => Assessment;
```

**Rules, evaluated in order (first match wins for `computed`):**
1. No menu day for the date, or the month isn't confirmed → `not_assessed` (`assess.noMenu`).
2. `lunch === 'none'` → `no_school_lunch` (`assess.noLunch`). `lunch === 'unknown'` → `not_assessed` (`assess.unknownDay`).
3. **Matching.** Each item name and each listed ingredient is normalised (NFKC, kana width, katakana→hiragana for matching, trim) and matched against dictionary `ja`/`en`/`aliases` by longest-match. The result is a set of ingredient ids; each id expands to its categories. A dislike/like **hit** is a distinct profile entry that matched (an ingredient id, or a category id matched through any ingredient). Counting distinct profile entries — not occurrences — keeps "ピーマン in two dishes" at one hit.
4. `D` = dislike hits, `L` = like hits, `net = L·likeWeight − D·dislikeWeight`, `u` = unmatched items ÷ items.
5. `D ≥ lowAtDislikes` **or** `net ≤ lowAtNet` → `low_preference`. (Defaults: two disliked things, or one disliked and nothing liked.)
6. `D ≥ 1` → `mixed_or_uncertain` (`assess.mixed`: one disliked, offset by liked things).
7. `u > uncertainAtUnmatchedRatio` or any item `uncertain` → `mixed_or_uncertain` (`assess.uncertain`).
8. Otherwise → `likely_enjoyable` (`assess.liked` if `L ≥ 1`, else `assess.neutral`).

**Overrides take precedence.** If an override exists for the date, `state = override.state`, `source = 'override'`; `computed` and its explanation are still returned so the UI can show "you set: low preference · app suggestion: likely enjoyable". Overrides are stored per date (ADR 003), persist across menu refreshes and app restarts, and are removed only by the parent ("reset to app suggestion"). If the day's `contentHash` differs from the hash stored with the override, `overrideStale = true` and the calendar shows a small "menu changed" mark; the override still applies.

**Explanations** are keys with params, e.g. `assess.dislikes {weekday:'水曜日', count:2, names:[…]}` → 「水曜日の給食には、苦手な食材が2つ含まれています。」 Copy rules (designer + BA): never "unhealthy", "bad" or "unsuitable"; describe what was matched, not a judgement.

**Reproducibility.** Same `(day, profile, override, dictionary.version, policy.version)` → deep-equal `Assessment`. Tests: property test that shuffling items, ingredients, likes and dislikes doesn't change the output; snapshot of `inputs` so a dictionary or policy change is visible in review. The assessor never reads or writes decisions.

## 2. Decision state machine

States per school day (one `DayDecision` record per date; **no record = derived default**):

| State | Meaning | Stored? |
|-------|---------|---------|
| `school_lunch` | School lunch planned (default for a day with `lunch: 'served'` or `'unknown'`) | only when the parent set it explicitly or set the reservation flag |
| `bento_pending` | Parent chose "homemade bento", no recipe confirmed yet ("not yet confirmed") | yes |
| `bento_planned` | Homemade bento with a confirmed `recipeId` | yes |
| `no_school_lunch` | Menu says no lunch that day (derived from the menu) | never stored |

Orthogonal flag: `reservationDoneExternally: boolean` (parent ticked "I reserved school lunch outside the app"), only meaningful in `school_lunch`. The app never books or cancels anything; the copy says so.

```ts
type DecisionState = 'school_lunch' | 'bento_pending' | 'bento_planned' | 'no_school_lunch';
type DecisionEvent =
  | { type: 'CHOOSE_BENTO' }
  | { type: 'CONFIRM_RECIPE'; recipeId: RecipeId }
  | { type: 'CHANGE_RECIPE'; recipeId: RecipeId }
  | { type: 'CANCEL_BENTO' }
  | { type: 'SET_SCHOOL_LUNCH' }
  | { type: 'MARK_RESERVATION'; done: boolean };

function currentDecision(date: LocalDate, record: DayDecision | undefined, day: MenuDay | undefined): DecisionView;
function transition(view: DecisionView, event: DecisionEvent, ctx: { today: LocalDate; recipeExists: (id: RecipeId) => boolean }):
  { ok: true; next: DayDecision | null /* null = delete record, back to derived default */ } | { ok: false; error: DecisionError };
type DecisionError = 'INVALID_TRANSITION' | 'DATE_IN_PAST' | 'UNKNOWN_RECIPE';
```
Note the signature: **`transition` takes no `Assessment`**. The assessment cannot change a decision because it is not an input. A type-level test (`expectTypeOf`) and a property test (random event sequences never produce `bento_*` without a `CHOOSE_BENTO`) guard this.

**Allowed transitions** (anything not listed → `INVALID_TRANSITION`; any event for a date before `today` JST → `DATE_IN_PAST`):

| From \ Event | CHOOSE_BENTO | CONFIRM_RECIPE | CHANGE_RECIPE | CANCEL_BENTO | SET_SCHOOL_LUNCH | MARK_RESERVATION |
|---|---|---|---|---|---|---|
| `school_lunch` | → `bento_pending` | → `bento_planned` (one-step "pick and confirm") | — | — | (no-op) | → `school_lunch` (flag set/cleared) |
| `bento_pending` | (no-op) | → `bento_planned` | — | → default | → `school_lunch` | — |
| `bento_planned` | — | — | → `bento_planned` (new recipeId) | → default | → `school_lunch` | — |
| `no_school_lunch` | → `bento_pending` ¹ | → `bento_planned` ¹ | — | — | — | — |

"→ default" = record deleted, the day shows its derived default (`school_lunch` or `no_school_lunch`). ¹ Open question for the BA: some kindergartens have お弁当持参日 marked as "no school lunch"; the proposal allows planning a bento on those days. If the BA rules otherwise, these two cells become `—`.

**Menu refresh never changes decisions.** Replacing a month's menu keeps every `DayDecision`. If a `bento_*` day becomes `lunch: 'none'` or disappears, the decision stays and the day is flagged `needsReview` ("the new menu has no school lunch on this day — keep the bento plan?"); only the parent's event changes it. `transition` is the **only** writer of decisions; the import flow has no access to it (enforced by module boundaries, `src/domain/menu` does not import `src/domain/decision`).

## 3. Recipe ranking

```ts
interface RankingPolicy { version: 1; varietyWindowPlannedDays: 10; likeIngredient: 3; likeCategory: 2; dislikeIngredient: -6; dislikeCategory: -4;
                          repeatPenalty: -8; samePrimaryAsPrevious: -3; themeMatch: 1; effortPerMinuteOver: -0.25 }

interface RankedRecipe {
  recipeId: RecipeId;
  score: number;
  group: 'clear' | 'allergen_unknown';   // see rule 1c
  reasons: ExplanationKey[];             // 'rank.liked', 'rank.quick', 'rank.recent', 'rank.theme', 'rank.allergenUnknown', …
}
interface RankingResult {
  top: RankedRecipe[];                   // ≤ 3; fewer only if fewer survive the hard filters (never padded)
  excluded: { recipeId: RecipeId; reason: 'allergen' | 'diet' }[];   // for QA and the "why not X?" debug view; never shown as options
  disclaimer: 'allergy.noGuarantee';     // always present; the UI always shows it
}

function createRanker(library: Recipe[], dict: Dictionary, policy: RankingPolicy):
  (input: { date: LocalDate; profile: ChildProfile; plannedHistory: { date: LocalDate; recipeId: RecipeId }[]; effort: 'quick' | 'any' }) => RankingResult;
```

**Rule order (strict; later steps never re-admit what an earlier step removed):**
1. **Hard filters**
   - a. **Allergens.** If `profile.allergies.status === 'known'`: exclude every recipe where any ingredient's allergens (from the dictionary, plus any recipe-level `contains` list) intersect the child's allergens. Matching is on allergen ids, also through categories (e.g. `shrimp` → `crustacean`).
   - b. **Diet.** Exclude every recipe violating any `DietRule` (rules are data: `{ id, excludesIngredients, excludesCategories }`).
   - c. **Unknown data is flagged, never hidden as safe.** A recipe with any ingredient whose allergen data is `unknown` in the dictionary, or whose `allergenDataComplete !== true`, stays **only if it passes a–b on what is known**, and goes to group `allergen_unknown` with reason `rank.allergenUnknown` ("allergen information for 〇〇 is incomplete — check the label"). If the child's allergy status is `'unknown'`, every card shows `allergy.statusUnknown` in addition.
2. **Score** (only survivors): `Σ likes − Σ dislikes` (distinct profile entries, as in §1) + `repeatPenalty` if the recipe is among the last `varietyWindowPlannedDays` planned bentos before `date` + `samePrimaryAsPrevious` if its primary protein equals the previous planned bento's + `themeMatch` per matching theme + `effortPerMinuteOver × max(0, prepMinutes − target)` where target = 20 min for `quick`, 40 min for `any`.
3. **Sort**: `group` (`clear` before `allergen_unknown`) → `score` descending → `recipeId` ascending (deterministic tie-break). Take the first 3.

Disliked ingredients are a penalty, not a filter (the parent may still want it); allergens and diet are filters. The UI always shows `allergy.noGuarantee` ("BentoMinder can't guarantee allergy safety. Always check ingredients."). Tests: property tests on the real library ("no top-3 recipe contains a known allergen of the profile", "same input → same order", "order of library doesn't matter"); unit tests on fixtures for each rule and tie-break.

## 4. Reminder planning

```ts
type ReminderKind = 'weekly' | 'day_before';
interface ReminderJob {
  id: string;            // stable semantic id: 'weekly:2026-11-08' (the Sunday) | 'day_before:2026-11-05' (the bento day)
  numericId: number;     // stable 31-bit FNV-1a hash of id (Android needs an int); collisions checked in planReminders
  kind: ReminderKind;
  fireAt: Instant;       // computed from JST wall time, device timezone irrelevant
  validUntil: Instant;   // after this the job is expired and dropped
  target: { route: string };                  // deep link, e.g. '#/recipe/onigiri-bear?date=2026-11-05' or '#/calendar/2026-11?week=2026-11-09'
  content: { titleKey: string; bodyKey: string; params: Record<string, string | number> };
  contentHash: string;   // hash(kind, fireAt, target, content) — a change means "reschedule"
}

function planReminders(input: {
  decisions: DecisionView[];            // for the horizon
  assessments: Assessment[];            // for the weekly summary of low-preference days (read-only use)
  recipes: Record<RecipeId, { nameJa: string; nameEn: string }>;
  settings: { weekly: { enabled: boolean; weekday: 0; time: 'HH:mm' }; dayBefore: { enabled: boolean; time: 'HH:mm' }; locale: 'ja' | 'en'; horizonDays: 35 };
  now: Instant;
}): ReminderJob[];   // sorted by fireAt, then id

function diffSchedule(scheduled: ScheduledJobRef[] /* {id, numericId, contentHash} */, desired: ReminderJob[]):
  { cancel: number[]; schedule: ReminderJob[] };   // pure; the NotificationScheduler adapter applies it
```

**Rules**
- **Day-before:** one job per `bento_planned` date D in `[today, today + horizon]`; `fireAt = (D − 1 day) @ settings.dayBefore.time JST`; `validUntil = D @ 12:00 JST`; tap → recipe for D. `bento_pending` days do not get a day-before reminder (nothing to prepare yet) — they appear in the weekly summary as "not decided".
- **Weekly:** one job per Sunday S (`weekday` setting) in the horizon; `fireAt = S @ settings.weekly.time JST`; content = the following Mon–Sun's `low_preference` days without a bento plan, `bento_pending` days, and `bento_planned` days (counts + dates); `validUntil = S + 1 day @ 09:00 JST`; skipped if that week has no school days in any confirmed menu.
- **Expired:** jobs with `validUntil ≤ now` are never returned; a job with `fireAt ≤ now < validUntil` is returned as **due** (the web adapter shows it in-app on open; the Android adapter shows it immediately or not at all — ADR 005).
- **Idempotency / no duplicates:** ids are derived from `(kind, date)` only, so at most one job per kind per date exists by construction; `planReminders` asserts unique `id` and `numericId`. The adapter never schedules from UI events directly: after **every** committed state change, on app start/resume, and on settings change, the app runs `planReminders` → `diffSchedule(scheduledRefs, desired)` → adapter cancels `cancel` and (re)schedules `schedule` (same `numericId` replaces on Android) → stores the new `scheduledRefs`. Running the pipeline twice yields an empty diff the second time (unit-tested property). Changing a reminder time changes `fireAt` → `contentHash` → reschedule under the same id. Cancelling a bento removes the job from `desired` → cancel.
- **Timezone changes:** `fireAt` is an absolute instant derived from JST, so the device moving to another timezone does not move the reminder (17:30 JST stays 17:30 JST). The app re-runs the pipeline on resume anyway.
- **Permissions:** planning is independent of permissions; if the adapter reports `denied`, the UI shows the in-app fallback and a settings hint (ADR 005).
- **Locale:** content stores keys + params; rendering into text happens in the adapter at schedule time with the current locale; a locale change changes `contentHash` → reschedule.

## 5. Module boundaries
```
src/domain/time        jst.ts (LocalDate, Instant, JST conversion, week/month helpers)
src/domain/schema      zod schemas: menu extraction, app state, recipe, dictionary
src/domain/menu        import review, month replace/merge, contentHash, Reiwa cross-check
src/domain/assessment  createAssessor
src/domain/decision    currentDecision, transition
src/domain/recipes     createRanker
src/domain/reminders   planReminders, diffSchedule, share text builder
src/domain/storage     repository, migrations, Storage port
src/domain/ports.ts    Clock, Storage, MenuExtractor, PdfSource, NotificationScheduler, Share (interfaces only)
```
`assessment` and `recipes` do not import `decision`; `menu` does not import `decision`. An import-boundary test (a small script over the import graph) enforces this.

## Alternatives considered
| Option | Why not (now) |
|--------|---------------|
| Ask the LLM to assess preferences or pick recipes | Brief §7 forbids runtime AI for this; non-reproducible, unexplainable, sends child data out |
| XState for the decision machine | 4 states, 6 events; a transition table + exhaustive test is clearer and ~15 KB lighter |
| Embedding-/ML-based ingredient matching | Non-deterministic across versions; a curated dictionary with aliases is explainable and testable |
| Storing `school_lunch` records for every day | Bloats storage and makes "menu changed" logic harder; default is derived |
| Random tie-break / shuffle for variety | Breaks reproducibility; variety comes from the history penalty instead |
| Scheduling notifications directly from UI handlers | Duplicate and orphaned notifications; the plan → diff → apply pipeline is idempotent |

## Consequences
- Every rule is testable with fixtures, and QA can build an oracle from this document + the policy objects.
- Tuning (thresholds, weights) is a data change with a version bump, visible in test snapshots.
- Matching quality depends on the BA's dictionary coverage of school-menu vocabulary; unmatched words surface as `mixed_or_uncertain`, never as "enjoyable" by default when most items are unknown.
- Must test (story IDs assigned at H1): each assessment rule and precedence; override persistence + stale flag across a menu replace; the full transition table incl. past dates; refresh never changes decisions; allergen/diet exclusion incl. via categories; unknown allergen flagging; tie-break; reminder ids stable, diff idempotent, expired dropped, JST correctness with device TZ ≠ JST, month and year boundaries (e.g. bento on 2026-12-01 → reminder 2026-11-30 17:30 JST; Sunday 2026-12-27 weekly covering 12-28 … 2027-01-03).

## Revisit when
- Parents override more than ~30 % of computed assessments in real use → the policy or dictionary is wrong; revisit thresholds with the BA.
- The library grows past ~200 recipes → profile the ranker (currently O(n·ingredients), trivially fast).
- Multiple children (v1+) → assessments and rankings keyed by child; decisions may become per child.
- ADR 005 finds Android limits (exact alarms, max pending notifications) that the 35-day horizon exceeds → shrink the horizon.
