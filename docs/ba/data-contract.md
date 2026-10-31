# Data contract — BentoMinder

Semantics: BA · Format, JSON Schema (`data/schema/`) and validator: Developer · 2026-10-24 · Contract version **v1** · Status: **H1 final + M1 prep** (PO answers, R-1…R-3 and the H1 fix-round rulings B1, B2, B4–B7, B10, B14 of 2026-10-24 applied; M1 prep of 2026-10-24: export decision, full rule-id list in §6, approved recipe sources in §3.10; M2 prep of 2026-10-25: decision events, date correction on review, ambiguity choices, M2 readiness fixes; changes listed in §8–§10)

Stories: `docs/ba/user-stories.md` · Terms and ids: `docs/ba/domain-dictionary.md` · Rules: approved BR table in `docs/PLAN.md` §3 (BR-xx). **This contract is the source of entity, field and state names** (R-2): code, ADRs, tests and copy keys use these identifiers.

## 1. Definitions of valid

**Correctly extracted menu.** An extracted menu is correct when, compared with the hand-made answer key of its fixture PDF, every date the PDF lists maps to the same ISO date with the same set of dish texts (after NFKC normalisation and whitespace trimming), every no-lunch day is listed with the right reason, no dish, ingredient or allergen that the PDF does not print is present, and every field the answer key marks as hard to read carries `verification.status = "uncertain"`.

**Authentic recipe.** A recipe is authentic when its dish, every ingredient with its quantity, its steps and its time can be traced to at least one cited source page that was fetched and that belongs to an approved publisher (§3.10, the authoritative host list; how to use each source is in `docs/ba/research-brief.md` §3), every change for a child portion is recorded in `adaptations`, its own-words text passes `validate.mjs overlap`, and every allergen that its ingredients carry according to the dictionary is listed (an ingredient whose product allergens could not be established from a cited source is marked `allergenInfo = "unknown"`, which makes the recipe `allergenDataComplete = false`; it is never presented as allergen-free), and every ingredient carries the animal-origin tags the dictionary gives it (an ingredient whose animal origin is unknown and not established by a cited source makes the recipe `dietDataComplete = false`).

**Valid store.** The local store is valid when it parses as JSON, `schemaVersion` is a version this build knows, every entity below passes its field rules and cross-field rules, and every id reference resolves (dictionary ids, recipe ids, extraction ids).

## 2. Conventions (apply to every entity)
| Topic | Rule | Validator rule id |
|-------|------|-------------------|
| Calendar date | String `YYYY-MM-DD`, a real Gregorian date (2027-02-29 is invalid, 2028-02-29 valid), meaning a calendar day **in Asia/Tokyo**. Never stored as a timestamp. | `date-invalid` |
| Month | String `YYYY-MM`, `MM` 01–12. | `month-invalid` |
| Timestamp | ISO 8601 with offset (`2026-11-03T17:30:00+09:00` or `…Z`). | `timestamp-invalid` |
| Clock time | String `HH:MM`, 00:00–23:45, minutes ∈ {00, 15, 30, 45}. | `time-invalid` |
| Localized text | Object `{ ja: string, en?: string }`; `ja` required and non-empty after trim. | `l10n-ja-missing` |
| Ids | kebab-case ASCII `[a-z0-9]+(-[a-z0-9]+)*`, with the prefix of their kind (see dictionary), stable, never reused. | `id-format` |
| Unknown fields | Rejected in the store and in AI output (`additionalProperties: false`). | `unknown-field` |
| Strings | Stored NFC; leading/trailing whitespace trimmed; matching uses NFKC + katakana→hiragana folding (dictionary §1). | `string-untrimmed` |
| Record metadata | Every stored record of kind ChildProfile, MenuMonth, AssessmentOverride, DayDecision and Settings carries `ownerId` (string, `local` in the MVP; v1: the family id), `createdAt` and `updatedAt` (timestamps, `updatedAt ≥ createdAt`). Seam for v1 sync (PLAN §1, ADR 003). Not repeated in the entity tables below. | `meta-owner`, `meta-timestamps` |
| Allergen scheme | Allergen ids come from the dictionary's allergen list for scheme `caa-2026-04` (9 mandatory + 20 recommended items). Retired ids (e.g. `alg-matsutake`) are accepted when reading old data, never written. | `allergen-unknown`, `allergen-retired` |
| Text length | A bounded string field (e.g. dish text 1–40, `originalText` 1–60, note ≤ 200) is counted in Unicode code points after NFC and trim. | `text-length` |
| List length | An array with a stated size (e.g. `items` 1–12, `themeIds` 0–3, `extractions` ≤ 3) has a length inside that range. | `list-length` |
| List uniqueness | An array stated as "unique" has no two equal elements. | `list-unique` |
| Number range | An integer field with a stated range (e.g. `schemaVersion`, `version` ≥ 1, `byteSize` 1 … 10,485,760, `minutes` 5–60, `consent.aiNoticeVersion` ≥ 1) is an integer inside it. | `number-range` |

## 3. Entities

### 3.1 Root store `BentoMinderStore` (one per device, local storage)
| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `deviceId` | string | ✔ | random UUID v4 created at first launch; never sent anywhere (`device-id-invalid`) | |
| `schemaVersion` | integer | ✔ | `1` for this contract. Lower → migrate (with backup); higher → read-only (US-E10-02). | `1` |
| `createdAt` / `updatedAt` | timestamp | ✔ | `updatedAt ≥ createdAt` | |
| `settings` | `Settings` | ✔ | §3.9 | |
| `profile` | `ChildProfile` \| null | ✔ | `null` before onboarding step 1 or after deletion. MVP: at most one. | |
| `menus` | object map `YYYY-MM → MenuMonth` | ✔ | key equals `MenuMonth.month` (`store-key-mismatch`); may be `{}` | |
| `overrides` | object map `YYYY-MM-DD → AssessmentOverride` | ✔ | key equals `.date` (`store-key-mismatch`) | |
| `decisions` | object map `YYYY-MM-DD → DayDecision` | ✔ | key equals `.date` (`store-key-mismatch`); only parent-created records (BR-02) | |
| `reminderLog` | `ReminderLogEntry[]` | ✔ | unique `key`; entries older than 60 days may be pruned | |
| `consent` | `{ aiNoticeVersion: integer ≥ 1, consentedAt: timestamp }` \| null | ✔ | null until the parent consents (US-E2-08). Notice version **1** = the free-tier facts of US-E2-08/AC4; any change to those facts raises the version and asks again (US-E2-08/AC3) | |
| `nextMonthCardHiddenOn` | date \| null | ✔ | the Tokyo date on which the parent tapped 「今日は表示しない」 on the next-month card; the card stays hidden while today equals this date (US-E3-06/AC6, OQ-24). Default `null` | `"2026-11-20"` |
| `aiUsage` | object map `YYYY-MM → integer ≥ 0` | ✔ | number of provider calls made per Tokyo month (repair retries and fallback calls count 1 each; cache hits count 0) | `{ "2026-11": 1 }` |

`MenuMonth`: `{ month: YYYY-MM, sourceUrl?: string, extractions: ExtractedMenu[] (≤ 3, newest last), confirmed: ConfirmedMenu | null, pendingReviewExtractionId?: string }`. Every extraction's `targetMonth` and `confirmed.month` equal `month` (`menu-month-mismatch`); `confirmed.extractionId` (when not null) and `pendingReviewExtractionId` resolve to an id in `extractions` (`extraction-resolves`). When a new extraction would make 4, the oldest extraction that `confirmed.extractionId` does not name is dropped (M2 prep: states the M1 code's rule); a dropped extraction's `sha256` no longer counts as "already extracted" (US-E2-07), so importing that PDF again costs a provider call.

### 3.2 `ChildProfile`
No birthdate, gender, height, weight, photo, real name, school, class or address: these fields do not exist and unknown fields are rejected (BR-20).

| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `id` | string | ✔ | `child-1` in the MVP (seam for multi-child in v1) | `child-1` |
| `nickname` | string | – | 1–20 characters after trim; absent if blank. Never leaves the device. | `はなちゃん` |
| `ageRange` | enum | ✔ | `age-under-3`, `age-3-4` (年少), `age-4-5` (年中), `age-5-6` (年長), `age-6-9` (小学校低学年), `age-9-12` (小学校高学年) | `age-4-5` |
| `likedIds` | string[] | ✔ | 0–30 unique ids of kind `ing-`, `cat-` or `dish-` that resolve in the dictionary | `["ing-chicken","ing-egg"]` |
| `dislikedIds` | string[] | ✔ | same rules as `likedIds`; disjoint from `likedIds` | `["ing-green-pepper","cat-fish"]` |
| `allergyStatus` | enum | ✔ | `none-known` \| `has-known` \| `unknown` | `has-known` |
| `knownAllergenIds` | string[] | ✔ | unique ids from the current allergen scheme (`alg-…`) | `["alg-shrimp"]` |
| `excludedIngredientIds` | string[] | ✔ | unique `ing-`/`cat-` ids; for allergies or intolerances outside the 29-item scheme | `["ing-tomato"]` |
| `diet` | enum[] | ✔ | unique values from `vegetarian`, `pescatarian`, `no-pork`, `no-beef`, `no-seafood` (§3.8 for their meaning) | `["no-pork"]` |
| `themeIds` | string[] | ✔ | 0–3 unique `theme-` ids | `["theme-animals"]` |
| `note` | string | – | ≤ 200 characters; never used by logic, never sent anywhere (US-E1-02/AC7) | `野菜は細かく切ると食べます` |
| `createdAt` / `updatedAt` | timestamp | ✔ | | |

Cross-field rules:
- `profile-like-dislike-overlap`: `likedIds ∩ dislikedIds = ∅`.
- `profile-allergy-status`: `none-known` ⇒ `knownAllergenIds` and `excludedIngredientIds` empty; `has-known` ⇒ at least one of them non-empty; `unknown` ⇒ both empty.
- `profile-diet-redundant` (warning only): `vegetarian` together with `pescatarian` is reduced to `vegetarian`.

### 3.3 `ExtractedMenu` (AI output, after schema validation; also produced by fixtures and manual entry)
The adapter asks the model for exactly this shape (structured output). Anything that does not validate is malformed (US-E2-05).

| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `id` | string | ✔ | `ext-<YYYY-MM>-<first 8 hex of sha256>`; set by the app, not the model | `ext-2026-11-3fa9c2d1` |
| `contract` | string | ✔ | `extracted-menu/1` | |
| `targetMonth` | month | ✔ | the month the parent chose; the model may report `detectedMonth` separately | `2026-11` |
| `detectedMonth` | month \| null | ✔ | what the PDF title says; mismatch with `targetMonth` → warning `month-mismatch` shown on review | `2026-11` |
| `source` | `MenuSource` | ✔ | below | |
| `days` | `ExtractedDay[]` | ✔ | 0–31 entries, unique `date`, sorted ascending (`days-unique-sorted`); every date inside `targetMonth` after the validator has moved the others to `outOfMonthDays` (`extracted-day-outside-month`) | |
| `noLunchDays` | `NoLunchDay[]` | ✔ | unique `date` (`days-unique-sorted`); disjoint from `days[].date` (`days-disjoint`); inside `targetMonth` (`extracted-day-outside-month`) | |
| `outOfMonthDays` | `OutOfMonthEntry[]` | ✔ | lunch days **and no-lunch days** the model returned outside `targetMonth`, moved here by the validator; never imported, listed on review (US-E2-05/AC4). Unique by `date` + `kind`, sorted by date | `[]` |
| `warnings` | enum[] | ✔ | `month-mismatch`, `pages-unreadable`, `layout-unrecognised`, `partial-extraction` | `[]` |
| `extractedAt` | timestamp | ✔ | | |

`MenuSource`:
| Field | Type | Req. | Rule | Example |
|-------|------|------|------|---------|
| `kind` | enum | ✔ | `url` \| `upload` \| `manual` \| `fixture` | `url` |
| `url` | string | if kind=url | https only (port 443) (`menu-source-url-https`), ≤ 2048 chars (BR-14, tightened at H1). May also be present, under the same rules, with kind=upload when an upload followed a failed URL (US-E2-02/AC2) | `https://example-kinder.test/menu/2026-11.pdf` |
| `filename` | string | if kind=upload | ≤ 255 chars | `11gatsu-kondate.pdf` |
| `sha256` | string | ✔ unless manual | 64 lowercase hex chars of the PDF bytes | |

A field marked "if kind=…" or "✔ unless manual" that is missing for its kind, or a `sha256` that is not 64 lowercase hex characters, fails `menu-source-field-required`.
| `byteSize` | integer | ✔ unless manual | 1 … 10,485,760 (BR-14) | `389120` |
| `fetchedAt` | timestamp | ✔ | when the bytes were obtained | |
| `model` | string | ✔ unless manual | provider model id of the call whose output was used: the primary model, or the fallback model when call 2 went to it (BR-10, US-E2-06/AC5) | (set at runtime) |
| `promptVersion` | integer | ✔ unless manual | version of the fixed extraction prompt | `1` |

`ExtractedDay`:
| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `date` | date | ✔ | inside `targetMonth` (else moved to `outOfMonthDays`) | `2026-11-04` |
| `printedDateText` | string \| null | ✔ | the date as printed, if readable; never changed by a date correction on review, so the printed form stays visible next to the corrected date (US-E2-05/AC7) | `4日（水）` |
| `printedWeekday` | enum \| null | ✔ | `日月火水木金土` single char, as printed; if it disagrees with `date`, `verification` must be `uncertain/weekday-mismatch` until the parent resolves it on review (`parent-edited`, `parent-entered` or `uncertain-accepted` also pass) (`weekday-mismatch`). Model output that breaks this is flagged by the app, never rejected (§6.1). Never changed by a date correction (US-E2-05/AC7) | `水` |
| `items` | `MenuItem[]` | ✔ | 1–12 | |
| `ingredientsStatus` | enum | ✔ | `listed` \| `not-listed` \| `unreadable` | `listed` |
| `ingredients` | `MenuIngredient[]` | if listed | 1–40; present iff `ingredientsStatus = listed` (`ingredients-listed-only`). Never inferred from dish names (BR-11). | |
| `allergenDeclaration` | `AllergenDeclaration` | ✔ | below | |
| `notes` | string[] | ✔ | 0–5 notes as printed (e.g. 「誕生会」「行事食」), ≤ 100 chars each | `["誕生会"]` |
| `verification` | `Verification` | ✔ | day-level status (date/weekday problems) | |

`OutOfMonthEntry` (H1, QA FX-Q3): `{ kind: "lunch-day", day: ExtractedDay } | { kind: "no-lunch-day", noLunchDay: NoLunchDay }` (discriminated by `kind`; the inner record keeps its own `date`, which is outside `targetMonth`). Rule `out-of-month-entry`: the inner date is a valid date not in `targetMonth`.

**Date correction on review** (M2 prep, US-E2-05/AC7–AC10; rule `review-date-correction`). Offered only on a lunch day whose day-level `verification` is `uncertain` with reason `weekday-mismatch`. The new date is any date of `targetMonth` that is *free*: on the review at that moment it shows no dish and is not marked 給食なし (a weekday shown as 「献立に記載なし」 and a date the review doesn't list are free; the day's own current date is not offered as a change). The whole day (items, ingredients, allergen declaration, notes) moves to the new date; its `verification` becomes `{ status: "parent-edited" }` (the weekday-mismatch flag clears), `printedDateText` and `printedWeekday` stay as printed. The old date becomes free. A taken date is never overwritten, merged or swapped. In the stored `ConfirmedMenu` a corrected day is an ordinary `parent-edited` day; `changedDatesSincePrevious` compares by date as usual.

`MenuItem`: `{ text: string 1–40 chars as printed, kind: "staple" | "main" | "side" | "soup" | "drink" | "dessert" | "snack" | "unknown", verification: Verification, resolvedIds?: string[] (set on review for ambiguity choices) }`. Items of kind `snack` (おやつ) are shown but not assessed (OQ-07).

`resolvedIds` (M2 prep, US-E4-01/AC6, AC21): absent = no choice made, so every ambiguity-group form the app's matcher finds in the item (dictionary §1 rule 6, §7) stays unresolved and the item counts towards U. Present = the parent's choice for the item's ambiguous form: the chosen candidate id(s) of that group (rule `resolved-ids-candidates`: every id is a `candidateIds` member of an ambiguity group whose form occurs, unresolved, in the item's text), or `[]` when the parent chose the group's non-food reading (「味」 for amb-aji, 「無し」 for amb-nashi); `[]` adds no id and the form is no longer unresolved. 「わからない」 leaves the field absent. Choosing never changes `text` or `verification`: the chooser is not an uncertain field and does not count in 「確認が必要な項目」 (only a model-set `uncertain/ambiguous-term` does). A refresh starts from the new extraction, so choices are asked again there.

`MenuIngredient`: `{ text: string 1–30 chars as printed, foodGroup: "red" | "yellow" | "green" | null, verification: Verification }`. `foodGroup` is only set when the PDF prints the 三色食品群 grouping (赤・黄・緑); never inferred.

`AllergenDeclaration`:
| Field | Type | Req. | Rule |
|-------|------|------|------|
| `status` | enum | ✔ | `declared` (PDF lists allergens for this day), `declared-none` (PDF explicitly states none for this day), `not-declared` (PDF says nothing: the default), `unreadable` |
| `allergenIds` | string[] | ✔ | `alg-` ids mapped from the printed words; non-empty only when `declared` (`allergen-ids-declared-only`) |
| `rawText` | string \| null | ✔ | the printed words, kept for review |
| `verification` | `Verification` | ✔ | |

Rule `allergen-absence-not-inferred` (BR-08): `declared-none` is only valid when `rawText` is non-null (the PDF said so). The app treats `not-declared` and `unreadable` as "unknown", never as "none".

`NoLunchDay`: `{ date (inside `targetMonth`, else moved to `outOfMonthDays` as kind `no-lunch-day`), reason: "bento-day" | "no-lunch" | "closed" | "unknown", originalText: string 1–60 chars, verification }`. `bento-day` = everyone brings a bento (お弁当の日); `no-lunch` = school open without lunch (午前保育, 短縮保育); `closed` = no school (休園, 行事の振替休日).

`Verification`: `{ status, reason?, note? }`
| `status` | Set by | Meaning |
|----------|--------|---------|
| `ok` | model | read with confidence |
| `uncertain` | model or validator | requires review; `reason` required (`verification-reason-required`): `low-legibility`, `weekday-mismatch`, `duplicate-date`, `ambiguous-term`, `outside-month`, `other` |
| `parent-edited` | review UI | changed by the parent |
| `parent-entered` | review UI | added by the parent / manual entry |
| `uncertain-accepted` | review UI | parent confirmed without fixing (US-E3-03/AC2) |
The model may only emit `ok` or `uncertain` (`verification-status-source`).

### 3.4 `ConfirmedMenu`
| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `month` | month | ✔ | equals the map key | `2026-11` |
| `version` | integer | ✔ | starts at 1, +1 on every refresh (US-E3-05) | `2` |
| `extractionId` | string \| null | ✔ | resolves to `MenuMonth.extractions[].id`; null for manual entry | |
| `confirmedAt` | timestamp | ✔ | | |
| `days` | `ExtractedDay[]` | ✔ | same shape; no `uncertain` left (each is fixed → `parent-edited`, or `uncertain-accepted`) | |
| `noLunchDays` | `NoLunchDay[]` | ✔ | disjoint from `days` | |
| `changedDatesSincePrevious` | date[] | ✔ | dates of the month whose entry differs from version − 1: items changed (the ordered list of item `text` + `kind`), no-lunch reason changed, moved between `days` and `noLunchDays`, added, or removed (no longer listed). Changes only to ingredients, allergen declaration, notes, `originalText`, `resolvedIds` or verification statuses do **not** make a date changed (M2 prep: states the M1 code's rule). Unique, ascending, inside `month` (`days-unique-sorted`, `confirmed-days-in-month`). `[]` for version 1 (`changed-dates-first-version`). Used for the 「献立が変わりました」 flags and the needs-review list | `["2026-11-18"]` |

**Needs-review list** (derived after a refresh is confirmed, US-E3-05/AC9, AC11, AC12): the dates in `changedDatesSincePrevious` (incl. removed dates) that carry an `AssessmentOverride` or a stored `homemade-bento-planned` or `not-confirmed` `DayDecision`; a `school-lunch-planned` record alone never lists a date (S10). Shown once after the confirm and reachable from the flagged days; never stored, never changes a record. (M2 prep: because nothing is stored, any "already opened" marking is for the current screen only, and a link to the list elsewhere, e.g. in settings, is shown while the list computed for the current version is non-empty, not "until every date was opened".)

Cross-field rules: `confirmed-no-uncertain`; `confirmed-days-in-month`; `confirmed-days-disjoint`; `days` unique and sorted, `noLunchDays` unique and sorted, `changedDatesSincePrevious` unique and sorted (`days-unique-sorted`); at least one day or no-lunch day (`confirmed-not-empty`).

**School day** (BR-25): a date that appears in `ConfirmedMenu.days` with ≥ 1 non-snack item. Dates in `noLunchDays` are no-lunch days. All other dates (weekends, holidays, unlisted weekdays) are not school days and get no assessment or decision.

### 3.5 `Assessment` (computed on read; never stored except the override)
| Field | Type | Rule | Example |
|-------|------|------|---------|
| `date` | date | a school day or no-lunch day of a confirmed menu | `2026-11-04` |
| `calculatedState` | enum | `likely-enjoyable` \| `mixed-uncertain` \| `low-preference` \| `not-assessed` \| `no-school-lunch`, by BR-04 | `low-preference` |
| `state` | enum | `override.state` if an override exists, else `calculatedState` | |
| `explanationKey` | string | one of `assess.likely`, `assess.mixedOne`, `assess.mixedUnknown`, `assess.mixedNeutral`, `assess.low`, `assess.notAssessed`, `assess.noLunch`, `assess.override` | `assess.low` |
| `explanationParams` | object | `{ weekday: 0–6, dislikedCount, likedCount, dislikedLabels: string[] ≤ 3, likedLabels ≤ 3, unmatched ≤ 3 }`. Labels and unmatched dish names are in order of first appearance on the day (items in menu order, then the listed ingredients); when a count is larger than its list (D = 4, 3 labels), the explanation shows the 3 and says that there are more (M2 prep; copy by the Designer). The counts are always the full D and L | `{ "weekday": 3, "dislikedCount": 2, "dislikedLabels": ["ピーマン","なす"] }` |
| `matched` | object | `{ likedIds[], dislikedIds[], unmatchedItems[], ambiguousItems[] }` for QA and the explanation. `likedIds` / `dislikedIds` are the found ids with that verdict (D = `dislikedIds.length`, L = `likedIds.length`); `unmatchedItems` + `ambiguousItems` are the non-snack items counted in U (an item in `ambiguousItems` may also have contributed found ids) | |
| `menuVersion` | integer | `ConfirmedMenu.version` used | `1` |
| `override` | `AssessmentOverride` \| null | | |

**Counting D, L, U** (H1 rulings B1, B2, B5, follow-ups and "OQ-16 overruled"; the full rule with a worked example is the E4 paragraph of `user-stories.md`): *found ids* are the distinct dictionary ids found in the day's non-snack items and listed ingredients (plus parent-chosen `resolvedIds`), seasonings left out unless the profile names them. Found ids collapse into **foods** (rule `assessment-food-collapse`, never transitive): within one lunch item a matched dish and its dictionary `definingIngredientId` are one food represented by the dish (an identical id found elsewhere that day counts through that dish); other ingredients named in the dish are separate foods; a found ingredient that is a dictionary ancestor of another found id folds into each found descendant (siblings stay separate); nothing else merges, and two dishes are never merged with each other. Each food gets one verdict, checked level by level (H1 closing rulings): (1) the food's ingredient ids (incl. a folded ancestor), (2) their dictionary parent ingredients, (3) the dish id, (4) categories, then ancestor categories, nearest first; i.e. ingredient → dish → category; at the deciding level a dislike beats a like. A defining-ingredient link never takes part in a cross-item collapse (O-3). D = disliked foods, L = liked foods. `matched.likedIds` / `dislikedIds` hold the representative id of each counted food. U = items without any match or with ≥ 1 unresolved ambiguity ÷ non-snack items.

**Explanation key by case** (rule `assessment-explanation-key`, B4):
| Case | `explanationKey` |
|------|------------------|
| override present | `assess.override` (the calculated state's explanation is shown under it) |
| no-lunch day | `assess.noLunch` |
| no likes and no dislikes in the profile | `assess.notAssessed` |
| `low-preference` (D ≥ 2, or D = 1 and L = 0) | `assess.low` |
| `likely-enjoyable` | `assess.likely` |
| `mixed-uncertain`, D = 1 and L ≥ 1 | `assess.mixedOne` |
| `mixed-uncertain`, D = 0 and U > 50% (whatever L) | `assess.mixedUnknown` |
| `mixed-uncertain`, D = 0, L = 0 and U ≤ 50% | `assess.mixedNeutral` |

`AssessmentOverride` (stored):
| Field | Type | Req. | Rule | Example |
|-------|------|------|------|---------|
| `date` | date | ✔ | must be a school day when set (`override-school-day-only`). If a later refresh makes the date a no-lunch day or removes it, the override is kept but **dormant**: not applied, not shown, the day shows `no-school-lunch` (or nothing when unlisted), and the date is in the needs-review list; it applies again if a later refresh makes the date a school day (`override-dormant`, B6, US-E3-05/AC8) | `2026-11-12` |
| `state` | enum | ✔ | `likely-enjoyable` \| `mixed-uncertain` \| `low-preference` | `low-preference` |
| `setAt` | timestamp | ✔ | | |
| `menuVersionAtSet` | integer | ✔ | the date's `ConfirmedMenu.version` when the parent last set the override. The day shows 「献立が変わりました。評価を見直してください。」 while the date is in the **current** version's `changedDatesSincePrevious` and `menuVersionAtSet` < the current version (US-E3-05/AC3, AC8). Setting the override again (any state, the same one included) sets `menuVersionAtSet` to the current version and ends the message; clearing the override removes it (US-E4-03/AC7) | `1` |

Override writes (M2 prep): only a parent action sets, changes or clears an override; no write for a date before today in Asia/Tokyo (`override-no-past-write`, BR-27, US-E4-03/AC6); the profile deletion of US-E1-06/AC2 removes all overrides as the parent's explicit clearing action.

### 3.6 `DayDecision` (stored only after a parent action, BR-02)
State identifiers (R-2, binding for code, ADR 004, tests and copy keys): `school-lunch-planned`, `homemade-bento-planned`, `not-confirmed`, `no-school-lunch`. The names `school_lunch`, `bento_pending`, `bento_planned`, `no_school_lunch` are retired and must not appear.

Displayed decision for a date = stored `DayDecision.state` if present, else derived: school day → `school-lunch-planned`, no-lunch day → `no-school-lunch`.

**Parent events** (M2 prep: the event ids of ADR 004 §2 adopted as contract names; the only writers of `decisions`, BR-02; which event is allowed from which state is the table in `user-stories.md` §E5):

| Event | Parent action (copy) | Effect on the record |
|-------|----------------------|----------------------|
| `CONFIRM_RECIPE` (recipeId) | 「手作りお弁当にする」 / 「お弁当を計画する」 → choose → 「この日に決定」. Opening and closing the recommendation view is navigation, not an event (US-E5-03/AC1, AC3) | state `homemade-bento-planned`, `recipeId`, both snapshots, new `plannedAt`; replaces a dormant record on an お弁当の日 |
| `CHANGE_RECIPE` (recipeId) | 「レシピを変更」 → choose → 「この日に決定」 | new `recipeId` and snapshots; `plannedAt` kept |
| `DEFER` | 「あとで決める」 | state `not-confirmed`; `plannedAt`, recipe and snapshots removed |
| `SET_SCHOOL_LUNCH` | 「給食に戻す」 (after the confirm dialog when leaving a plan) | state `school-lunch-planned`; `plannedAt`, recipe and snapshots removed |
| `CLEAR_PLAN` | 「計画を取り消す」 (after the confirm dialog) | record deleted (bento day or refresh conflict) |
| `KEEP_PLAN` | 「このまま」 on a refresh conflict | only `acknowledgedMenuVersion` (and `updatedAt`) |
| `MARK_RESERVATION` (done) | 「園で予約済み（自分で記録）」 on or off | state `school-lunch-planned` stored, `reservationDoneExternally` = done |

Dialog steps (cancel, confirm) are UI, not events: a cancelled dialog sends no event. Older shorthand (`CONFIRM`, `CHANGE`, `LATER`, `TO_SCHOOL`, `CLEAR`, `KEEP`) in test oracles means the event of the same row.

| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `date` | date | ✔ | | `2026-11-04` |
| `state` | enum | ✔ | stored: `school-lunch-planned` \| `homemade-bento-planned` \| `not-confirmed`. `no-school-lunch` is display-only and never stored (`decision-no-lunch-not-stored`). | `homemade-bento-planned` |
| `recipeId` | string | iff bento | resolves to a library recipe when written (`decision-bento-requires-recipe`, `decision-recipe-resolves`); may stop resolving after a library change (US-E6-06) | `rcp-kuma-onigiri` |
| `recipeNameSnapshot` | localized text | iff bento | copy of the recipe name at decision time; this field and `recipeShortNameSnapshot` are present iff the state is `homemade-bento-planned` (`decision-bento-snapshot`) | `{ "ja": "くまさんおにぎり弁当" }` |
| `recipeShortNameSnapshot` | `{ ja: string, en: string }` | iff bento | copy of the recipe's `shortNameJa` / `shortNameEn` at decision time (1–8 characters each, `recipe-short-name`), shown in the calendar cell when the recipe no longer resolves (US-E5-01/AC4, US-E6-06) | `{ "ja": "くまおにぎり", "en": "Bear oni" }` |
| `reservationDoneExternally` | boolean | ✔ | may be `true` only when `state = school-lunch-planned` (`decision-reservation-flag`); it is the parent's own record, the app does nothing with the school | `false` |
| `decidedAt` | timestamp | ✔ | time of the last accepted parent event that changed the state, the recipe or `reservationDoneExternally`; **not** changed by KEEP_PLAN, which only acknowledges (M2 prep, as ADR 004 §2; `updatedAt` records every write) | |
| `plannedAt` | timestamp | iff bento | set when the state becomes `homemade-bento-planned` from any other state (first CONFIRM_RECIPE); **unchanged** by CHANGE_RECIPE and KEEP_PLAN; removed when the state leaves `homemade-bento-planned` (`decision-planned-at`, B10). Used only for day-before suppression (§3.9) | `2026-11-01T10:12:00+09:00` |
| `acknowledgedMenuVersion` | integer | – | set by the parent event KEEP_PLAN (「このまま」) on a refresh conflict to the current `ConfirmedMenu.version`. The conflict **needs acknowledgement** (stays in the upcoming summary, today view and weekly reminder content) while `acknowledgedMenuVersion` is absent, or the date is in the current version's `changedDatesSincePrevious` and `acknowledgedMenuVersion` < the current version; so a later refresh that does not change this date does not bring the conflict back, and one that changes it again does (M2 prep, as ADR 004 `needsAck`). State, recipe, `plannedAt` and reminder are unchanged by KEEP_PLAN (US-E3-05/AC7, AC14) | `2` |
| `history` | `{ state, recipeId?, at }[]` | ✔ | at most 5 entries, oldest first; one entry per accepted event that changed the state or the recipe, holding the state and `recipeId` **after** that change and its time (the 6th change drops the oldest). KEEP_PLAN and MARK_RESERVATION add none. For debug and conflict display | |

Cross-field rules:
- `decision-transition`: a change from the previous state must be allowed by the state machine in `user-stories.md` §E5 (events above).
- `decision-no-past-write`: no write with `date` < today (Asia/Tokyo) (US-E5-02/AC3).
- `decision-bento-day-remove`: on a `bento-day` date the parent cancels a plan by removing the stored decision (displayed state returns to `no-school-lunch`); no parent action writes `school-lunch-planned` or `not-confirmed` for a no-lunch date (US-E5-08/AC3); a stored decision that a later menu refresh puts on a no-lunch date is kept and flagged (BR-13).
- `decision-bento-day-only`: `homemade-bento-planned` on a no-lunch day only when its reason is `bento-day`. A conflict that arises from a menu refresh is kept and flagged, not rejected (US-E3-05/AC2).
- `decision-refresh-conflict` (B7): a stored `homemade-bento-planned` decision whose date a refresh turns into a no-lunch day with reason ≠ `bento-day`, or removes from the menu, is kept unchanged (BR-13), flagged 「献立が変わりました」 (the explanation sentence of US-E3-05/AC2 or AC6 may follow), and accepts only KEEP_PLAN or CLEAR_PLAN (remove the stored decision, after a confirm dialog); its day-before reminder stays until it is cleared. A refresh that turns the date into a `bento-day` is not a conflict and is not flagged (BR-25).
- `decision-dormant-replaced` (U5): an explicit CONFIRM_RECIPE on an お弁当の日 that carries a dormant record replaces that record with the new `homemade-bento-planned` decision (the old state stays only in `history`).
- `decision-dormant` (B6 follow-up, S10): a stored `not-confirmed` or `school-lunch-planned` record whose date a refresh turns into a no-lunch day or removes is kept byte-for-byte (dormant): the day displays `no-school-lunch` (or nothing when unlisted), offers no decision action, and (only when `not-confirmed`) is in the needs-review list; the record is displayed unchanged again if a later refresh makes the date a school day (US-E3-05/AC12).

### 3.7 `Recipe` (`data/_research/batch-*.json` → merged `data/library.json`, generated)
| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `id` | string | ✔ | `rcp-` + kebab-case; unique across all batches (`recipe-id-unique`); never reused | `rcp-kuma-onigiri` |
| `name` | localized text | ✔ | `ja` required; `en` required unless the dish is only known by its Japanese name (then `en` = romanised name + short gloss) | `{ "ja": "くまさんおにぎり弁当", "en": "Bear onigiri bento" }` |
| `shortNameJa` | string | ✔ | 1–8 characters (Unicode code points, after NFC and trim), shown in calendar cells (US-E5-01/AC4); a curated short form written by the BA, not a mechanical cut of `name.ja`; no spaces at either end; unique across the library (`recipe-short-name`, `recipe-short-name-unique`) | `くまおにぎり` |
| `shortNameEn` | string | ✔ | 1–8 characters (`recipe-short-name`), curated from `name.en`, shown in cells when the language is en; uniqueness not required | `Bear oni` |
| `nameKana` | string | ✔ | hiragana reading for sorting | `くまさんおにぎりべんとう` |
| `style` | enum | ✔ | `japanese` \| `western-inspired` \| `other` | `japanese` |
| `themeId` | string \| null | ✔ | `theme-` id or null | `theme-animals` |
| `description` | localized text | ✔ | 20–120 characters (ja); own words (overlap-checked) | |
| `yield` | localized text | ✔ | e.g. 「幼児1人分」/"1 child portion"; quantities are for this yield | |
| `minutes` | integer | ✔ | 5–60, active prep + cooking on the morning (make-ahead time goes in `makeAhead`) | `15` |
| `makeAhead` | localized text \| null | ✔ | night-before steps if the source supports them | |
| `ingredients` | `RecipeIngredient[]` | ✔ | 2–20 | |
| `steps` | localized text[] | ✔ | 2–12 steps, each ≤ 120 chars (ja); own words | |
| `storage` | localized text[] | ✔ | ≥ 1; recipe-specific handling from a cited source; the general MAFF notes are added by the app (US-E6-04/AC2) | |
| `allergenIds` | string[] | ✔ | union of `ingredients[].allergenIds` (`recipe-allergen-union`) | `["alg-wheat","alg-soybean"]` |
| `mayContainAllergenIds` | string[] | ✔ | union of `ingredients[].possibleAllergenIds` of varies-by-product ingredients (`recipe-may-contain-union`) | `["alg-egg","alg-milk"]` |
| `allergenDataComplete` | boolean | ✔ | `false` iff any ingredient has `allergenInfo = "unknown"`; derived and checked by the validator (`recipe-allergen-complete-derived`). Drives the R-3 rule in §4 `ranking-incomplete-allergen` | `true` |
| `allergenScheme` | string | ✔ | `caa-2026-04` | |
| `animalOrigin` | string[] | ✔ | union of `ingredients[].animalOrigin` (`recipe-animal-origin-union`) | `["egg","fish-seafood"]` |
| `dietDataComplete` | boolean | ✔ | `false` iff any ingredient has `animalOriginKnown = false`; derived and checked (`recipe-diet-complete-derived`) | `true` |
| `dietOk` | enum[] | ✔ | diets this recipe satisfies: empty when `dietDataComplete = false`, else every diet of §3.8 whose forbidden tags are disjoint from `animalOrigin`; must equal the derived set (`recipe-diet-derived`) | `["no-beef","no-seafood"]` |
| `adaptations` | localized text[] | ✔ | changes made vs the source (e.g. halved for a child portion); `[]` if none | |
| `sources` | `Source[]` | ✔ | ≥ 1; the first is the primary recipe source | |
| `reviewedBy` | string | ✔ | `ba-research` until the verifier passes; then `verifier` | |

`RecipeIngredient`:
| Field | Type | Req. | Rule | Example |
|-------|------|------|------|---------|
| `ingredientId` | string | ✔ | `ing-` id that resolves in the dictionary (`recipe-ingredient-resolves`) | `ing-rice` |
| `label` | localized text | ✔ | as shown to the parent | `{ "ja": "ごはん", "en": "cooked rice" }` |
| `quantity` | number \| null | ✔ | > 0, ≤ 2 decimals; null only with unit `to-taste` or `small-amount` (`recipe-quantity`) | `120` |
| `unit` | enum | ✔ | `g`, `ml`, `piece` (個), `slice` (枚), `stick` (本), `tbsp` (大さじ), `tsp` (小さじ), `cup` (カップ 200 ml), `sheet` (枚・のり), `to-taste` (適量), `small-amount` (少々) | `g` |
| `optional` | boolean | ✔ | | `false` |
| `allergenInfo` | enum | ✔ | `known` (the food itself defines its allergens, e.g. 卵) \| `varies-by-product` (processed food: ウインナー, カレールー, ケチャップ, みそ…; the allergens of the one maker label the recipe cites, in `allergenIds` when the food itself defines them and otherwise in `possibleAllergenIds`; the recipe adds an adaptation telling the parent to 「表示を確認」, check the label of the product they use) \| `unknown` (processed food for which no label could be fetched or the label is ambiguous; never shown as allergen-free) | `known` |
| `allergenIds` | string[] | ✔ | must include the dictionary's `inherentAllergenIds` for that ingredient (`recipe-ingredient-inherent-allergen`) | `["alg-egg"]` |
| `possibleAllergenIds` | string[] | ✔ | only `varies-by-product` may list entries (empty for `known` and `unknown`); it may be empty when the cited label declares no allergen beyond `allergenIds`; entries come from the cited maker label, never from "typical" products (`recipe-possible-allergens`) | `["alg-pork","alg-milk","alg-soybean"]` |
| `animalOrigin` | string[] | ✔ | animal-origin tags (§3.8) of this ingredient; must include every tag the dictionary lists for the `ingredientId` (`recipe-ingredient-animal-origin`); tags may be added from the cited source, never removed | `["fish-seafood"]` |
| `animalOriginKnown` | boolean | ✔ | `true` if the dictionary's `animalOrigin` for the id is fully known; if the dictionary marks it `?` (unknown), `true` only when a cited source (`usedFor` includes `"recipe"` or `"allergen"`) states the product's ingredients, else `false` (`recipe-animal-origin-known`) | `true` |

`Source`: `{ id: "src-…", publisher: string, title: string, url: http(s), accessed: date, language: "ja" | "en", usedFor: ("recipe" | "storage" | "allergen")[] }`. `url` is an absolute `http://` or `https://` URL without spaces (`source-url-invalid`) whose host is, or is a subdomain of, a host in §3.10 (`source-publisher-approved`); `publisher` uses the publisher name given there.

### 3.8 Diet meaning (used by the hard filter, BR-06; H1 ruling B14)
Diets are evaluated **only on ingredient-level animal-origin tags** (`animalOrigin`, dictionary §4): never on allergen ids and never through categories. Tags: `meat` (meat whose species is not stated or varies, incl. sheep casings), `pork`, `beef`, `chicken`, `fish-seafood` (fish, shellfish, other seafood, fish-paste products, fish-based stock), `egg`, `dairy`, `gelatin`. The dictionary lists, per ingredient, every tag the food has or that its common products contain (hidden sources: だし → `fish-seafood` + `?`; かつお節・煮干し → `fish-seafood`; コンソメ/ブイヨン → `beef`, `chicken`, `pork` + `?`; カレールウ/シチュールウ → `meat`, `pork`, `beef`, `chicken`, `dairy` + `?`; ウインナー・ハム → `meat`, `pork`; ベーコン → `pork`; ちくわ・かまぼこ → `fish-seafood`; マヨネーズ → `egg`; バター → `dairy`…), or `?` when the animal origin of the food's products cannot be bounded.

| Diet | Forbidden tags (a recipe with any of them in `animalOrigin` is excluded) |
|------|------|
| `vegetarian` (lacto-ovo) | `meat`, `pork`, `beef`, `chicken`, `fish-seafood`, `gelatin` |
| `pescatarian` | `meat`, `pork`, `beef`, `chicken`, `gelatin` |
| `no-pork` | `pork`, `meat`, `gelatin` |
| `no-beef` | `beef`, `meat` |
| `no-seafood` | `fish-seafood` |

- `meat` is forbidden by every meat-restricting diet because its species is not known. Gelatin is forbidden for vegetarian, pescatarian and no-pork because its animal origin is rarely stated (OQ-11, decided 2026-10-24).
- **Unknown origin** (`ranking-diet-incomplete`): a recipe with `dietDataComplete = false` is excluded for **every** selected diet, with reason `diet-incomplete` (shown in the library, US-E6-02/AC8); with no diet selected it is not affected. There is no fallback through categories or allergens.
- `egg` and `dairy` are recorded for completeness (display, a future vegan diet); no MVP diet forbids them.

### 3.9 `Settings` and `ReminderSettings`
| Field | Type | Req. | Allowed values / rule | Default |
|-------|------|------|------------------------|---------|
| `settings.language` | enum | ✔ | `ja` \| `en` | `ja` (BR-23) |
| `settings.timezone` | const | ✔ | `Asia/Tokyo` (not user-editable in MVP) | `Asia/Tokyo` |
| `settings.reminders.weekly.enabled` | boolean | ✔ | | `true` |
| `settings.reminders.weekly.weekday` | integer | ✔ | 0 (日) … 6 (土) | `0` |
| `settings.reminders.weekly.time` | time | ✔ | 15-minute steps | `14:00` |
| `settings.reminders.dayBefore.enabled` | boolean | ✔ | | `true` |
| `settings.reminders.dayBefore.time` | time | ✔ | 15-minute steps | `17:30` |
| `settings.reminders.reservation` | `{ enabled, time }` | – | v1 only (US-E7-08); must be absent or disabled in MVP builds (`settings-reservation-v1-only`) | absent |
| `settings.nextMonthPromptFromDay` | integer | ✔ | 1–28 (US-E3-06/AC2, OQ-15) | `20` |
| `settings.weekStartsOn` | enum | ✔ | `monday` \| `sunday`; display only, never changes dates, reminders or assessments (US-E5-01/AC2, AC8; PO 2026-10-24) | `monday` |
| `settings.theme` | enum | ✔ | `auto` \| `light` \| `dark` (US-E8-05) | `auto` |

`ReminderLogEntry`: `{ key: "weekly:<date>" | "day-before:<date>", type: "weekly" | "day-before", dueAt: timestamp, expiresAt: timestamp, shownAt?: timestamp, dismissedAt?: timestamp, debug?: boolean }`. Rules: `reminder-key-unique`; `reminder-key-format`: `key` is `<type>:<date>` with the entry's own `type` and a valid date; `reminder-expiry-after-due`: `expiresAt > dueAt`; `reminder-shown-until-dismissed` (N3 = OQ-20): an entry with `shownAt` and no `dismissedAt` is shown again on every open until it is dismissed or expires; `reminder-day-before-suppressed` (B10): no day-before reminder exists for date D when `decisions[D].plannedAt > dueAt` (equality still creates it, US-E7-02/AC5); a CHANGE_RECIPE never removes or suppresses a pending reminder (it only updates its target), and a refresh conflict keeps it until CLEAR_PLAN (US-E7-02/AC5–AC8, US-E3-05/AC2); day-before `expiresAt` = 00:00 JST of the target date; weekly `expiresAt` = 24:00 JST of the last covered date.

### 3.10 Recipe sources (approved hosts; M1 prep)
The authoritative list for `source-publisher-approved` and `scripts/validate-data.mjs → APPROVED_HOSTS`: a source URL passes when its host equals a host below or is a subdomain of it. `Source.publisher` uses the name in the "Publisher" column. *How* each source may be used (scheme only, handling notes only, editorial pages only, brand → generic) stays in `docs/ba/research-brief.md` §3 and §2; the host check cannot tell an editorial page from a user-posted one, so that rule is checked per page by the research agent and the verifier. Every host was checked by the BA on 2026-10-24 by fetching its top page (or the recipe section named) and reading the operator/copyright line.

| Host | Publisher (record in `Source.publisher`) | Use (brief §3) | Checked 2026-10-24 |
|------|------------------------------------------|----------------|--------------------|
| `maff.go.jp` | 農林水産省 (Ministry of Agriculture, Forestry and Fisheries) | General bento food-handling notes (US-E6-04/AC2) | Confirmed: 「農林水産省ホームページ」 |
| `caa.go.jp` | 消費者庁 (Consumer Affairs Agency) | Allergen scheme; choking-risk guidance | Confirmed: 「消費者庁ウェブサイト」, © Consumer Affairs Agency |
| `cfa.go.jp` | こども家庭庁 (Children and Families Agency) | Choking-risk guidance for young children | Confirmed: 「こども家庭庁」 |
| `mhlw.go.jp` | 厚生労働省 (Ministry of Health, Labour and Welfare) | Secondary food-handling source | Confirmed: 「ホーム｜厚生労働省」 |
| `pref.kyoto.jp` | 京都府 (Kyoto Prefecture) | Allergen scheme summary only (dictionary §3) | Confirmed: 「京都府ホームページ」 |
| `city.sendai.jp` | 仙台市 (City of Sendai) | Allergen scheme only: the 2024 macadamia/matsutake change (dictionary §3) | Confirmed: 「仙台市公式ホームページ」. **Flag:** not in research-brief §3; the brief should add it as a scheme-only source (`usedFor: ["allergen"]`), never for recipes |
| `kyounoryouri.jp` | NHKエデュケーショナル（みんなのきょうの料理） | Japanese recipes | Confirmed: © NHKエデュケーショナル |
| `sirogohan.com` | 白ごはん.com（冨田ただすけ） | Japanese home-cooking basics | Confirmed: site states it is run by 料理研究家 冨田ただすけ |
| `orangepage.net` | オレンジページ (The Orangepage Inc.) | Kids' bento features | Confirmed: © The Orangepage Inc. |
| `lettuceclub.net` | レタスクラブ (KADOKAWA LifeDesign) | Kids' bento features | Confirmed: 「レタスクラブ © KADOKAWA LifeDesign」 |
| `ajinomoto.co.jp` | 味の素株式会社（味の素パーク） | Manufacturer recipes (brand → generic) | Confirmed: `park.ajinomoto.co.jp` 「【味の素パーク】…」, © AJINOMOTO CO.,INC |
| `kikkoman.co.jp` | キッコーマン株式会社（ホームクッキング） | Manufacturer recipes (brand → generic) | Confirmed: `kikkoman.co.jp/homecook/` 「ホームクッキング(レシピサイト) \| キッコーマン」, © Kikkoman Corporation |
| `housefoods.jp` | ハウス食品株式会社 | Manufacturer recipes (brand → generic) | Confirmed: 「ハウス食品 ホームページ」, `housefoods.jp/recipe/` 「レシピ \| ハウス食品」, © House Foods Corp. |
| `mizkan.co.jp` | ミツカン（ミツカングループ「おうちレシピ」） | Manufacturer recipes (brand → generic) | Confirmed: recipes at `mizkan.co.jp/ouchirecipe/` 「おうちレシピ ｜ミツカングループ」, © Mizkan Holdings Co. Ltd. |
| `kurashiru.com` | クラシル (Kurashiru, Inc.) | Short kids' bentos, editorial pages only | Confirmed: 「クラシル \| 料理レシピ動画サービス」, © Kurashiru, Inc. |
| `delishkitchen.tv` | デリッシュキッチン (every, Inc.) | Short kids' bentos, editorial pages only | Confirmed: 「デリッシュキッチン \| …」, © every, Inc |
| `justonecookbook.com` | Just One Cookbook (Namiko Chen) | English Japanese-recipe names and bentos | Confirmed by direct HTTP fetch (the fetch tool got HTTP 403): title 「Just One Cookbook · Japanese Food and Recipe Blog」, © Just One Cookbook, author Namiko Chen |
| `bbcgoodfood.com` | Immediate Media Company Ltd (BBC Good Food) | Western-inspired lunchbox recipes | Confirmed by direct HTTP fetch (the fetch tool was blocked). **Flag:** the site is "owned and published by Immediate Media Company Limited", the domain is "used under licence from BBC Studios Distribution Limited", and the page title now reads "Good Food"; record the publisher as in this row, not as "BBC" |

Label round (2026-10-30), maker product pages used only for the ingredient label and allergen list of one named product (`usedFor: ["allergen"]`), never for recipes; fetched with HTTP 200 and page titles checked. The Orchestrator mirrors them in `APPROVED_HOSTS` and runs the source/overlap audit:

| Host | Publisher |
|------|-----------|
| `nipponham.co.jp` | 日本ハム株式会社 |
| `hagoromofoods.co.jp` | はごろもフーズ株式会社 |
| `marukome.co.jp` | マルコメ株式会社 |
| `nissui.co.jp` | 株式会社ニッスイ |
| `meg-snow.com` | 雪印メグミルク株式会社 |

No host in `APPROVED_HOSTS` belongs to a different publisher than the brief intends. Hosts not listed here fail `source-publisher-approved`; adding one is a BA change to this table (and the brief), mirrored in `APPROVED_HOSTS` by the Developer.

## 4. Cross-entity rules
| Rule id | Rule |
|---------|------|
| `ref-dictionary` | Every `ing-`/`cat-`/`dish-`/`alg-`/`theme-` id in the store or the library resolves in the dictionary of the current build. |
| `ref-recipe` | Every `DayDecision.recipeId` resolved when written; unresolved ids on read are reported, not deleted (US-E6-06). |
| `assessment-independent` | Assessment computation reads `profile`, `menus[].confirmed` and `overrides` only; it never reads or writes `decisions` (BR-01). |
| `decision-parent-only` | `decisions` changes only through UI actions listed in the state machine (BR-02); import, refresh, assessment, reminders and time never write it. |
| `ai-payload-allowlist` | The adapter request has exactly: `pdf` (bytes or URL), `targetMonth`, `promptVersion`, `schemaVersion` (BR-10). |
| `ranking-hard-filter` | A recipe is excluded from suggestions, 「ほかのレシピ」 and planning if any `allergenIds` or `mayContainAllergenIds` id is in `knownAllergenIds`, any ingredient (or dictionary parent/category) is in `excludedIngredientIds`, or its `animalOrigin` contains a tag forbidden by a selected diet (§3.8) (BR-06, OQ-13, B14). |
| `ranking-diet-incomplete` | A recipe with `dietDataComplete = false` is excluded like the above when at least one diet is selected, with reason `diet-incomplete` (§3.8, US-E6-02/AC8). |
| `ranking-liked-ids` | BR-09's "per liked id" / "per disliked id" count the recipe's foods (its ingredient ids collapsed by ancestor/descendant) with the same verdict rule as D and L (§3.5 Counting). |
| `ranking-incomplete-allergen` | A recipe with `allergenDataComplete = false` is excluded like the above when `knownAllergenIds` is non-empty; otherwise it stays, flagged, ordered after every recipe with complete data (R-3, US-E6-02/AC5–AC6). |
| `ai-call-budget` | One import action makes at most 2 provider calls: call 1 primary model; call 2 either one repair retry on the primary (malformed output) or one call to the fallback model on **429, 408/timeout, 5xx**, never both; 400/403/404 are never retried; 0 calls when `source.sha256` already has an extraction (BR-10, R-1). |
| `export-roundtrip` | An export file is the stored `BentoMinderStore` written as is (no envelope, no extra top-level field such as `exportedAt`; any extra field fails `unknown-field`) and re-validates as a `BentoMinderStore` of the same `schemaVersion`. The export date is carried only by the file name `bentominder-export-<YYYY-MM-DD>.json` (the Tokyo date of the export) (US-E10-03/AC4; M1 prep decision). |

## 5. Fixtures required (synthetic, never presented as a real school's menu)
`fixture-menu-2026-11` (PDF + hand-made answer key + recorded model output): November 2026, Mon–Fri, with at least: 2026-11-04 「ピーマンとなすのみそ炒め」 (two disliked items for the sample child); 2026-11-05 「さばのみそ煮」 with an allergen line declaring 卵・小麦; 2026-11-06 with no allergen line; 2026-11-10 with no ingredient list; 2026-11-20 「お弁当の日」; 2026-11-27 「午前保育（給食なし）」; no entries for 2026-11-03 and 2026-11-23 (祝日); one deliberately hard-to-read dish; ingredients grouped 赤・黄・緑 on at least 3 days; at least one standalone 「カレー」. Further fixtures: `fixture-menu-2027-02` (28 days), `fixture-menu-2028-02` (29 days), a weekday-mismatch variant, a malformed-JSON response, a rate-limit response. Each fixture is marked `"synthetic": true`.

## 6. Validator
`scripts/validate-data.mjs` (Developer) enforces every rule id above for the library and for exported stores; the app runs the same schema on every store write (US-E10-05) and on AI output (US-E2-05). Each message names its rule id. The BA reviews the rule list before H3. Note for the Orchestrator: `quality-gate.json → overlap.fields` still lists template fields (`shortDescription`, `history`, `tasteProfile`); for this project it should be `description`, `steps`, `storage`, `adaptations`.

### 6.1 Rule ids (complete list, M1 prep 2026-10-24)
This table is the full list of rule ids. Code reports only these ids; a check without a row here is either added here by the BA or removed from the code. Reviewed against `RULES_NOT_IN_CONTRACT` in `src/domain/schema/primitives.ts`: 22 of its 25 ids are adopted unchanged, 2 are renamed (`source-field-required` → `menu-source-field-required`, `source-url-https` → `menu-source-url-https`, so that `source-…` means the recipe `Source` only), and 1 is dropped (`consent-invalid`: no code reports it; consent errors already report `number-range`, `timestamp-invalid` or `unknown-field`). After the Developer's alignment `RULES_NOT_IN_CONTRACT` should be empty. M2 prep (2026-10-25): the last id it held, `weekday-mismatch`, is now a row below, and three ids are new for M2 (`resolved-ids-candidates`, `review-date-correction`, `override-no-past-write`); the Developer empties `RULES_NOT_IN_CONTRACT` and implements the three new ones.

**Where:** S = zod schema (every store write, AI output, `validate-data` on fixtures and exports) · L = library check in `validate-data` (across recipes and batches) · D = dictionary check · E = domain engine / UI behaviour (proved by unit and e2e tests, not by a data file) · P = proxy / adapter.

| Rule id | Where | Checks |
|---------|-------|--------|
| `date-invalid` | S | A calendar date is `YYYY-MM-DD` and a real Gregorian date. |
| `month-invalid` | S | A month is `YYYY-MM` with `MM` 01–12. |
| `timestamp-invalid` | S | A timestamp is ISO 8601 with `Z` or an offset, and a real instant. |
| `time-invalid` | S | A clock time is `HH:MM`, 00:00–23:45, in 15-minute steps. |
| `l10n-ja-missing` | S | A localized text has a non-blank `ja`. |
| `id-format` | S, D | An id is kebab-case ASCII with the prefix of its kind (also used for dictionary ids). |
| `unknown-field` | S | An object has no field the contract doesn't define. |
| `string-untrimmed` | S | A stored string is NFC and has no leading or trailing whitespace. |
| `text-length` | S | A bounded string's length in code points is within its range. Also the rule for `MenuSource.url` > 2,048 characters (the M0 code reports zod's default message there; Developer to align). |
| `list-length` | S | An array's length is within its stated range. |
| `list-unique` | S | An array stated as unique has no duplicates. |
| `number-range` | S | An integer field is an integer within its stated range. |
| `meta-owner` | S | A record carries a non-blank `ownerId`. |
| `meta-timestamps` | S | A record's `updatedAt ≥ createdAt`. |
| `allergen-unknown` | S | An `alg-` id exists in the dictionary's scheme. |
| `allergen-retired` | S | A retired allergen id is never written. |
| `device-id-invalid` | S | `deviceId` is a UUID v4. |
| `store-key-mismatch` | S | Each `menus` / `overrides` / `decisions` map key equals its record's `month` / `date`. |
| `profile-like-dislike-overlap` | S | `likedIds` and `dislikedIds` share no id. |
| `profile-allergy-status` | S | `allergyStatus` agrees with `knownAllergenIds` / `excludedIngredientIds` (§3.2). |
| `profile-diet-redundant` | S (warning) | `vegetarian` + `pescatarian` is reduced to `vegetarian`. |
| `days-unique-sorted` | S | `days` dates are unique and ascending; `noLunchDays` dates are unique. |
| `days-disjoint` | S | An extraction's `noLunchDays` share no date with its `days`. |
| `extracted-day-outside-month` | S | After validation no `days` or `noLunchDays` date of an extraction lies outside `targetMonth`. |
| `out-of-month-entry` | S | An `outOfMonthDays` entry's inner date is valid and outside `targetMonth`; entries unique by date + kind. |
| `menu-source-field-required` | S | `MenuSource` has the fields its `kind` needs (`url`, `filename`, `sha256` as 64 lowercase hex, `byteSize`, `model`, `promptVersion`). **Renamed** from `source-field-required`. |
| `menu-source-url-https` | S | `MenuSource.url` is `https:` on port 443 (BR-14). **Renamed** from `source-url-https`. |
| `ingredients-listed-only` | S | `ingredients` is present iff `ingredientsStatus = listed`. |
| `allergen-ids-declared-only` | S | `allergenDeclaration.allergenIds` is non-empty only when `status = declared`. |
| `allergen-absence-not-inferred` | S | `declared-none` only with a non-null `rawText` (BR-08). |
| `verification-reason-required` | S | `uncertain` carries a `reason`. |
| `weekday-mismatch` | S, E | An `ExtractedDay` whose `printedWeekday` disagrees with its `date` carries `uncertain` / reason `weekday-mismatch` unless the parent resolved it (`parent-edited`, `parent-entered`, `uncertain-accepted`). Model output in that state is **not** a failure: the app sets the flag before the strict parse, so the parent sees a review flag (US-E2-05/AC5); the schema reports the id only for hand-written data (fixtures, store files). The same string is also a `Verification.reason` value. **Added** M2 prep. |
| `resolved-ids-candidates` | S, E | Every id in `MenuItem.resolvedIds` is a candidate of an ambiguity group whose form occurs unresolved in the item's text; `[]` only for a group with a non-food reading (§3.3). **Added** M2 prep. |
| `review-date-correction` | E | A date correction on review moves a `weekday-mismatch` day only to a free date of the target month, never onto a day that shows a dish or is marked 給食なし; the day becomes `parent-edited`; printed date and weekday are kept (§3.3, US-E2-05/AC7–AC10). **Added** M2 prep. |
| `verification-status-source` | S | AI output carries only `ok` or `uncertain`. |
| `menu-month-mismatch` | S | Each extraction's `targetMonth` and `confirmed.month` equal the `MenuMonth.month` (not to be confused with the review warning value `month-mismatch`). |
| `extraction-resolves` | S | `confirmed.extractionId` (when not null) and `pendingReviewExtractionId` name an extraction in the same `MenuMonth`. |
| `confirmed-no-uncertain` | S | A confirmed menu has no `uncertain` field left. |
| `confirmed-days-in-month` | S | Every confirmed date lies in the confirmed month. |
| `confirmed-days-disjoint` | S | Confirmed `days` and `noLunchDays` share no date. |
| `confirmed-not-empty` | S | A confirmed menu has at least one day or no-lunch day. |
| `changed-dates-first-version` | S | `changedDatesSincePrevious` is empty for version 1. |
| `assessment-food-collapse` | E | Found ids collapse into foods as in §3.5 (never transitive). |
| `assessment-explanation-key` | E | The explanation key follows the table in §3.5. |
| `assessment-independent` | E | Assessment reads only profile, confirmed menus and overrides (BR-01). |
| `override-school-day-only` | S, E | An override is set only on a school day. |
| `override-dormant` | E | An override on a date a refresh made no-lunch or removed is kept, not applied, and listed for review. |
| `override-no-past-write` | E | No override is set, changed or cleared for a date before today (Tokyo) by a parent action (BR-27, US-E4-03/AC6); profile deletion is the one bulk removal. **Added** M2 prep. |
| `decision-no-lunch-not-stored` | S | `no-school-lunch` is never a stored decision state. |
| `decision-bento-requires-recipe` | S | `homemade-bento-planned` has a `recipeId`, and only that state has one. |
| `decision-recipe-resolves` | S (on write) | A written `recipeId` resolves in the library. |
| `decision-bento-snapshot` | S | `recipeNameSnapshot` and `recipeShortNameSnapshot` are present iff the state is `homemade-bento-planned`. |
| `decision-reservation-flag` | S | `reservationDoneExternally = true` only with `school-lunch-planned`. |
| `decision-planned-at` | S, E | `plannedAt` is present iff `homemade-bento-planned`, set on the first confirm and kept by CHANGE_RECIPE / KEEP_PLAN. |
| `decision-transition` | E | A state change is allowed by the E5 state machine. |
| `decision-no-past-write` | E | No decision write for a date before today (Tokyo). |
| `decision-bento-day-remove` | E | On a `bento-day` date a plan is cancelled by removing the record. |
| `decision-bento-day-only` | E | `homemade-bento-planned` on a no-lunch day only for reason `bento-day` (refresh conflicts excepted). |
| `decision-refresh-conflict` | E | A plan on a date a refresh made non-bento no-lunch or removed is kept, flagged, and accepts only KEEP_PLAN / CLEAR_PLAN. |
| `decision-dormant-replaced` | E | CONFIRM_RECIPE on an お弁当の日 with a dormant record replaces it. |
| `decision-dormant` | E | `not-confirmed` / `school-lunch-planned` records on a no-lunch or removed date are kept unchanged and not shown. |
| `decision-parent-only` | E | Only parent actions change `decisions` (BR-02). |
| `recipe-id-unique` | L | Recipe ids are unique across the library and all batches. |
| `recipe-short-name` | S | `shortNameJa` / `shortNameEn` (and the decision snapshot) are 1–8 code points. |
| `recipe-short-name-unique` | L | `shortNameJa` is unique across the library. |
| `recipe-ingredient-resolves` | L | Every `ingredientId` resolves in the dictionary. |
| `recipe-quantity` | S | `quantity` > 0 with ≤ 2 decimals, or null only with `to-taste` / `small-amount`. |
| `recipe-ingredient-inherent-allergen` | L | An ingredient's `allergenIds` include the dictionary's inherent allergens. |
| `recipe-possible-allergens` | S | `possibleAllergenIds` is non-empty only when `allergenInfo = varies-by-product` (it may be empty there when the cited label declares none). |
| `recipe-allergen-union` | L | `Recipe.allergenIds` = union of its ingredients' `allergenIds`. |
| `recipe-may-contain-union` | L | `mayContainAllergenIds` = union of the varies-by-product ingredients' `possibleAllergenIds`. |
| `recipe-allergen-complete-derived` | L | `allergenDataComplete` is false iff an ingredient has `allergenInfo = unknown`. |
| `recipe-ingredient-animal-origin` | L | An ingredient's `animalOrigin` includes every dictionary tag for its id. |
| `recipe-animal-origin-known` | L | `animalOriginKnown` follows the dictionary's `?` and the cited-source rule. |
| `recipe-animal-origin-union` | L | `Recipe.animalOrigin` = union of its ingredients' tags. |
| `recipe-diet-complete-derived` | L | `dietDataComplete` is false iff an ingredient has `animalOriginKnown = false`. |
| `recipe-diet-derived` | L | `dietOk` equals the set derived from §3.8. |
| `source-url-invalid` | S | A recipe `Source.url` is an absolute http(s) URL without spaces. |
| `source-publisher-approved` | L | A recipe `Source.url` host is in §3.10 (or a subdomain of one). |
| `settings-reservation-v1-only` | S | The v1 reservation reminder is absent or disabled in MVP builds. |
| `reminder-key-unique` | S | No two reminder-log entries share a `key`. |
| `reminder-key-format` | S | `key` is `<type>:<date>` matching the entry's `type` and a valid date. |
| `reminder-expiry-after-due` | S | `expiresAt` is after `dueAt`. |
| `reminder-shown-until-dismissed` | E | A shown, undismissed reminder shows again on each open until dismissed or expired. |
| `reminder-day-before-suppressed` | E | No day-before reminder for a date planned after its due time (`plannedAt > dueAt`; equal still creates it, US-E7-02/AC5). |
| `ref-dictionary` | S, L | Every dictionary id in the store or library resolves. |
| `ref-recipe` | E | An unresolved `recipeId` on read is reported, never deleted. |
| `ai-payload-allowlist` | P | The adapter request has exactly `pdf`, `targetMonth`, `promptVersion`, `schemaVersion`. |
| `ai-call-budget` | P | At most 2 provider calls per import action as in BR-10. |
| `ranking-hard-filter` | E | Allergen, exclusion and diet filters (BR-06). |
| `ranking-diet-incomplete` | E | `dietDataComplete = false` excluded when any diet is selected. |
| `ranking-liked-ids` | E | BR-09 per-id scores count foods with the D/L verdict rule. |
| `ranking-incomplete-allergen` | E | Incomplete allergen data: excluded with known allergens, else flagged and ranked last. |
| `export-roundtrip` | S | An export file is the store as is and re-validates as the same `schemaVersion` (§4). |
| `dict-id-unique` | D | No two dictionary records share an id. |
| `dict-synonym-unique` | D | One normalised surface form belongs to one ingredient, dish or ambiguity group (categories have no surface forms). |
| `dict-parent-resolves` | D | Category parents, ingredient parents and dish name ingredients resolve. |
| `dict-category-resolves` | D | Ingredient and dish categories resolve. |
| `dict-allergen-resolves` | D | Inherent allergen ids resolve. |
| `dict-ambiguity-candidates-resolve` | D | Ambiguity candidates resolve. |
| `dict-animal-origin-valid` | D | `animalOrigin` uses only the 8 tags, without duplicates, plus a boolean `animalOriginKnown`. |
| `dict-defining-ingredient` | D | `definingIngredientId` is null or an `ing-` id among the dish's name ingredients. |

**File-level outcomes** (reported by `validate-data` or the storage repository, not field rules): `json-parse` (not parseable JSON), `file-missing`, `batch-shape` (a research batch is not an array or `{ recipes: [...] }`), `generated-stale` (`data/library.json` differs from the merged batches), `banned-phrases-schema`, and on loading a store `not-a-store`, `too-new` (US-E10-02/AC3), `migration-failed`, `schema-invalid` (US-E10-02/AC4).

## 7. v1: ownership and persistence
Record metadata (`ownerId`, `createdAt`, `updatedAt`, §2) exists from v1 of the contract so that sync needs no migration of meaning; tombstones (`deletedAt`) and `updatedBy` are added with the v1 sync contract, not in the MVP.

| Entity | Owned by a user? | Moves to a server in v1? | Personal data? | Retention |
|--------|------------------|--------------------------|----------------|-----------|
| ChildProfile | v1: family (owner + members) | Only with synced family planning; needs auth and a privacy notice | Yes (child preferences, allergies = health-related, APPI 要配慮個人情報 risk) | until deleted by parent |
| ConfirmedMenu / ExtractedMenu | family | could be shared per school URL in v1 (not personal) | No (public document) | 13 months |
| DayDecision, AssessmentOverride | family | yes with sync | Low (plans) | 13 months |
| ReminderSettings, ReminderLog | device | settings yes, log no | No | log 60 days |
| Recipe library | app | static, shipped with the app | No | versioned with releases |
| Consent | device / user | yes | Yes (consent record) | while the account exists |

## 8. H1 changes (2026-10-24)
| Change | Why |
|--------|-----|
| Status final; this contract named the source of all entity, field and state names | R-2 |
| `§2 Record metadata` (`ownerId`, `createdAt`, `updatedAt`) and root `deviceId` | PLAN §1 identity seam, ADR 003 |
| `DayDecision`: retired ADR 004 state names listed; rule `decision-bento-day-remove` | R-2; US-E5-08/AC3 |
| `Recipe.shortNameJa` / `shortNameEn` (1–8 chars, curated; `shortNameJa` unique), rules `recipe-short-name`, `recipe-short-name-unique` | Designer gap (direction.md §11 item 5) |
| `RecipeIngredient.allergenInfo` gains `unknown`; `Recipe.allergenDataComplete` (derived) | R-3 |
| `settings.weekStartsOn` (default `monday`), `settings.theme` (default `auto`) | PO 2026-10-24; Designer gap |
| `consent.aiNoticeVersion` 1 defined as the facts in US-E2-08/AC4; `aiUsage` and `source.model` follow the 2-call budget | PO 2026-10-24 (free tier, Japan); R-1 |
| §4 rules `ranking-hard-filter`, `ranking-incomplete-allergen`, `ai-call-budget` | BR-06, BR-10, R-1, R-3 |
| §3.8 gelatin note: OQ-11 decided | PO 2026-10-24 |
| H1 fix round: §3.5 counting of D, L, U (found ids, most specific entry wins, same-level tie → dislike, ambiguous item counts in U) and the explanation-key table (`assessment-explanation-key`) | B1, B2, B4, B5, follow-up |
| H1 fix round: `override-dormant`; `changedDatesSincePrevious` covers added/removed/moved dates; derived needs-review list | B6 |
| H1 fix round: `DayDecision.plannedAt`, `acknowledgedMenuVersion` (KEEP_PLAN), `recipeShortNameSnapshot`; rules `decision-planned-at`, `decision-refresh-conflict`, `decision-dormant`, `reminder-day-before-suppressed` | B7, B10, developer items, follow-ups |
| H1 fix round: §3.8 rewritten on ingredient-level animal-origin tags; `RecipeIngredient.animalOrigin`, `animalOriginKnown`; `Recipe.animalOrigin`, `dietDataComplete`; `dietOk` re-derived; rules `ranking-diet-incomplete`, `recipe-animal-origin-*` | B14 |
| H1 fix round: `outOfMonthDays` holds `OutOfMonthEntry` (lunch and no-lunch days) | QA FX-Q3 |
| H1 fix round: `ai-call-budget` lists 429, 408/timeout, 5xx like BR-10; `MenuSource.url` https only | BR-10, BR-14 |
| H1 fix round: `ranking-liked-ids` | B1 (ranking K18) |
| §3.5 food collapse (`assessment-food-collapse`): dish + its `definingIngredientId` within one item; ancestor folds into each descendant; never transitive | OQ-16 overruled, narrowed; collapse detail (PLAN §7) |
| H1 closing rulings: verdict levels ingredient → dish → category; O-3 no cross-item defining-ingredient collapse; needs-review list (overrides, homemade-bento-planned, not-confirmed; removed dates included); `decision-dormant-replaced`; `reminder-shown-until-dismissed` | PLAN §7 "H1 closing rulings" (A57, A61, S10, O-3, U5, N3) |

## 9. M1 prep changes (2026-10-24)
| Change | Why |
|--------|-----|
| `export-roundtrip`: the export file is the store as is, no `exportedAt` envelope; the date lives in the file name. US-E10-03/AC1 retired, replaced by AC4 | Orchestrator item (PLAN §7 "M0 done"): AC1 wanted `exportedAt`, which `unknown-field` rejects. The simpler of the two options: no schema change, the file still re-imports unchanged (US-E10-03/AC3) |
| §6.1: complete rule-id table (one line each, with where it is checked); §2 adds `text-length`, `list-length`, `list-unique`, `number-range`; rule ids written next to their fields in §3.1, §3.3, §3.4, §3.6, §3.7, §3.9 | Review of `RULES_NOT_IN_CONTRACT`: 22 adopted, 2 renamed (`menu-source-field-required`, `menu-source-url-https`), 1 dropped (`consent-invalid`) |
| §3.10 Recipe sources: authoritative approved-host list with the publisher name per host, each checked against its top page on 2026-10-24; `Source.publisher` uses those names | Review of `APPROVED_HOSTS`; flags: `city.sendai.jp` (scheme-only, missing from the research brief), `bbcgoodfood.com` (publisher is Immediate Media, BBC licence) |
| `MenuSource.url` may also be present with kind `upload` (US-E2-02/AC2), under the same rules | Consistency with US-E2-02/AC2 |
| `dict-synonym-unique` now states that categories carry no surface forms (dictionary §1, §2) | Developer item (PLAN §7 "M0 done") |
| Root store field `nextMonthCardHiddenOn` (date \| null, default null) | US-E3-06/AC6 (OQ-24): 「今日は表示しない」 must survive a reload. New required field in `schemaVersion` 1 (no store has shipped yet); the Developer adds it to the schema, the defaults and the state fixtures |

## 10. M2 prep changes (2026-10-25)
Items from PLAN §7 "M1 merged locally" and "M1 QA" (`tests/reports/m1-qa-report.md`), plus a readiness pass of E3-05/06, E4 and E5 against `src/domain/schema/` and ADR 004. No field was added, removed or renamed: the store shape of `schemaVersion` 1 is unchanged.

| Change | Why |
|--------|-----|
| §6.1 row `weekday-mismatch` (schema id for hand-written data; for model output a review flag, never a failure) | M1 code and QA fixtures use it; it was the last id in `RULES_NOT_IN_CONTRACT` |
| §3.3 date correction on review (free dates of the target month only, `parent-edited`, printed date kept); rule `review-date-correction` | US-E2-05/AC5 "confirm or correct the date": only 「このままにする」 was built in M1 |
| §3.3 `resolvedIds` semantics (absent / candidate ids / `[]` for a non-food reading; not an uncertain field); rule `resolved-ids-candidates` | M2 builds the ambiguity chooser (US-E4-01/AC6); amb-aji and amb-nashi have non-food readings with no id |
| §3.6 parent-event table (`CONFIRM_RECIPE`, `CHANGE_RECIPE`, `DEFER`, `SET_SCHOOL_LUNCH`, `CLEAR_PLAN`, `KEEP_PLAN`, `MARK_RESERVATION`), adopted from ADR 004 | The contract named only 4 of the 7 events; the QA oracle uses shorthand |
| §3.6 `decidedAt` not changed by KEEP_PLAN; `history` holds the state after each state/recipe change | Contract said "last write", ADR 004 said "state or recipe change", the oracle said "every accepted event" |
| §3.6 `acknowledgedMenuVersion`: when a conflict needs acknowledgement, as ADR 004 `needsAck` | The contract's "while it equals the current version" would re-raise a kept conflict after any later refresh, even one that didn't touch the date |
| §3.5 `menuVersionAtSet`: when the 「献立が変わりました。評価を見直してください。」 line shows and how it ends; override writes: `override-no-past-write` (BR-27) | No rule ended the line; BR-27 was stated for decisions only |
| §3.5 explanation labels: order of first appearance, at most 3, "and more" when the count is larger | The E4 worked example named 4 labels while `dislikedLabels` holds ≤ 3 |
| §3.4 `changedDatesSincePrevious`: "changed" = item text + kind, reason, moved, added, removed; unique, sorted, in month; `noLunchDays` unique and sorted | States the M1 code's comparison; the schema did not check these lists |
| §3.1 extraction eviction rule (oldest not confirmed dropped at 4) | States the M1 code's rule (`recordExtraction`) |
| §3.4 needs-review list: nothing "opened" is stored | `design/components.md` §6.8 (refresh review list) says the list stays reachable "until every listed date was opened once", which needs stored state |
