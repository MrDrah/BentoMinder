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
| `recipeShortNameSnapshot` | `{ ja: string, en: string }` | iff bento | copy of the recipe's `shortNameJa` / `shortNameEn` at decision time (1–8 characters each, `recipe-short-name`), kept as data; since the 2026-11-10 tile redesign it is no longer shown on the calendar tile (no recipe name on the tile, US-E5-01/AC4, US-E6-06) [CHANGED 2026-11-10 tile redesign] | `{ "ja": "くまおにぎり", "en": "Bear oni" }` |
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
| `shortNameJa` | string | ✔ | 1–8 characters (Unicode code points, after NFC and trim), kept as data; not shown on the calendar tile since the 2026-11-10 tile redesign (US-E5-01/AC4) [CHANGED 2026-11-10 tile redesign]; a curated short form written by the BA, not a mechanical cut of `name.ja`; no spaces at either end; unique across the library (`recipe-short-name`, `recipe-short-name-unique`) | `くまおにぎり` |
| `shortNameEn` | string | ✔ | 1–8 characters (`recipe-short-name`), curated from `name.en`, kept as data, not shown on the calendar tile since 2026-11-10 [CHANGED 2026-11-10 tile redesign]; uniqueness not required | `Bear oni` |
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
| `mayContainAllergenIds` | string[] | ✔ | union of `ingredients[].possibleAllergenIds` of varies-by-product ingredients (`recipe-may-contain-union`). **Reference data since 2026-11-01** (brand-label records): displayed nowhere as a statement about a product and **not read by the hard filter** (`ranking-hard-filter`) | `["alg-egg","alg-milk"]` |
| `allergenDataComplete` | boolean | ✔ | `false` iff any ingredient has `allergenInfo = "unknown"`; derived and checked by the validator (`recipe-allergen-complete-derived`). **Deprecated as a filter input 2026-11-01**: derivation and the validator rule stay, but no ranking, filter, badge or notice reads it (the old `ranking-incomplete-allergen` rule is retired, §4) | `true` |
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
| `allergenIds` | string[] | ✔ | must include the dictionary's `inherentAllergenIds` for that ingredient (`recipe-ingredient-inherent-allergen`). For a processed ingredient (§3.7a) this is exactly the set that excludes a recipe for a child with that allergen (F1'); the 2026-11-01 library audit found no label-derived extras here | `["alg-egg"]` |
| `possibleAllergenIds` | string[] | ✔ | only `varies-by-product` may list entries (empty for `known` and `unknown`); it may be empty when the cited label declares no allergen beyond `allergenIds`; entries come from the cited maker label, never from "typical" products (`recipe-possible-allergens`). Reference data since 2026-11-01: warn-only, never excludes; new records need not carry it (leave `[]`) | `["alg-pork","alg-milk","alg-soybean"]` |
| `animalOrigin` | string[] | ✔ | animal-origin tags (§3.8) of this ingredient; must include every tag the dictionary lists for the `ingredientId` (`recipe-ingredient-animal-origin`); tags may be added from the cited source, never removed | `["fish-seafood"]` |
| `animalOriginKnown` | boolean | ✔ | `true` if the dictionary's `animalOrigin` for the id is fully known; if the dictionary marks it `?` (unknown), `true` only when a cited source (`usedFor` includes `"recipe"` or `"allergen"`) states the product's ingredients, else `false` (`recipe-animal-origin-known`) | `true` |

`Source`: `{ id: "src-…", publisher: string, title: string, url: http(s), accessed: date, language: "ja" | "en", usedFor: ("recipe" | "storage" | "allergen")[] }`. `url` is an absolute `http://` or `https://` URL without spaces (`source-url-invalid`) whose host is, or is a subdomain of, a host in §3.10 (`source-publisher-approved`); `publisher` uses the publisher name given there.

### 3.7a Processed ingredients and the generic allergen rule (PO decision 2026-11-01)
Supersedes the 2025-10-25 ruling "processed food is always varies-by-product with a cited label" for new work; no new maker-label research is done for processed foods.
- **Processed ingredient** = a dictionary ingredient with `info = varies` (65 in the dictionary of 2026-11-01). The test is on the dictionary record of `ingredientId`, never on the recipe's `allergenInfo`, so it holds for old and new records alike.
- **Inherent allergens of a processed ingredient** = its dictionary `inherentAllergenIds`: the allergens that belong to the definition of that kind of food (bread → wheat, mayonnaise → egg, soy sauce → soybean + wheat). "May contain" and "common in some products" are never inherent. Basis per row: dictionary §11.
- **F1' (exclusion)**: a recipe is excluded when `allergenIds` (which contains each ingredient's inherent ids, `recipe-ingredient-inherent-allergen`) intersects the child's `knownAllergenIds`. This is the same set test as before; what changed is that `mayContainAllergenIds` is no longer part of it and that the dictionary now defines inherent allergens for processed foods.
- **Allergen groups, F1'' (PO ruling P5, 2026-11-01)**: dictionary §11.5 defines groups (`grp-fish` = {alg-salmon, alg-mackerel}) and the processed ingredients carrying one (`allergenGroupIds` in `data/dictionary.json`: fish-paste products, canned tuna and mackerel, salmon flakes, fish sauce). A group id is NOT an allergen id: never written to `allergenIds`, `possibleAllergenIds`, `mayContainAllergenIds` or a profile, so recipe data never claims "contains salmon". F1'' = F1' plus: a recipe is also excluded when any of its ingredients carries a group (dictionary lookup by `ingredientId`) and the child's `knownAllergenIds` contains any member of that group. `alg-salmon-roe` alone does not trigger `grp-fish`. The exclusion reason in 「レシピ一覧」 names the child's registered member (e.g. 「さけを含む」), never the group. The processed-food warning (US-E6-04 notice) is unchanged and independent of groups. Validator rules: dictionary §11.5.
- **Processed-food warning** (`ranking-processed-warning`): when `knownAllergenIds` is non-empty and the recipe is not excluded, every processed ingredient shows a marker and the recipe shows one notice with the child's FULL `knownAllergenIds` list (not an intersection with anything: the product's content is unknown). When `knownAllergenIds` is empty (allergyStatus none-known, unknown, or has-known with only `excludedIngredientIds`) nothing is shown. It never says or implies safety (BR-07).
- Copy keys (designer specifies the final strings; intent only): `warn.processed.item` (per processed ingredient row: "store-bought, check the label"), `warn.processed.recipe` (once on the detail: "store-bought products may contain the registered allergens {list}; check the package label"), `warn.processed.card` (compact line on cards and list rows: "check labels of store-bought items"). Retired strings: 「市販品は製品によりアレルゲンが異なります。表示を確認してください。」 (US-E6-02/AC4) and 「一部の材料のアレルゲン情報がわかりません。…」 (US-E6-02/AC5).
- **Existing brand-label data** (`allergenInfo: varies-by-product` with `possibleAllergenIds` from a cited maker label, about 26 records): stays in the files for reference, warn-only.
- Not changed: diet filters (`animalOrigin`, §3.8, `ranking-diet-incomplete`), `excludedIngredientIds`, the disclaimer and the unknown-status banner (BR-07).
- Open points (no blocker): see "Open points" at the end of §11.

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
| `ranking-hard-filter` | A recipe is excluded from suggestions, 「ほかのレシピ」 and planning if any `allergenIds` id is in `knownAllergenIds` (F1'; `mayContainAllergenIds` is no longer read, 2026-11-01, §3.7a), any ingredient (or dictionary parent/category) is in `excludedIngredientIds`, or its `animalOrigin` contains a tag forbidden by a selected diet (§3.8) (BR-06, OQ-13, B14). |
| `ranking-diet-incomplete` | A recipe with `dietDataComplete = false` is excluded like the above when at least one diet is selected, with reason `diet-incomplete` (§3.8, US-E6-02/AC8). |
| `ranking-liked-ids` | BR-09's "per liked id" / "per disliked id" count the recipe's foods (its ingredient ids collapsed by ancestor/descendant) with the same verdict rule as D and L (§3.5 Counting). |
| `ranking-incomplete-allergen` | **RETIRED 2026-11-01** (PO: generic processed-food rule; F4). Was: a recipe with `allergenDataComplete = false` is excluded when `knownAllergenIds` is non-empty, else flagged and ordered last. Now no filter, order tier or badge reads `allergenDataComplete`. |
| `ranking-processed-warning` | When `knownAllergenIds` is non-empty, a recipe that passes the filters shows `warn.processed.item` on each ingredient whose dictionary `info = varies`, and `warn.processed.recipe` once with the child's full `knownAllergenIds` list; with an empty `knownAllergenIds` nothing is shown. Trigger = dictionary, not `allergenInfo` (§3.7a, US-E6-02/AC11–AC13). |
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
| `recipe-allergen-complete-derived` | L | `allergenDataComplete` is false iff an ingredient has `allergenInfo = unknown` (derived field kept; no ranking effect since 2026-11-01). |
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
| `ranking-hard-filter` | E | Allergen (`allergenIds` only; inherent allergens of processed foods included, F'), exclusion and diet filters (BR-06). |
| `ranking-diet-incomplete` | E | `dietDataComplete = false` excluded when any diet is selected. |
| `ranking-liked-ids` | E | BR-09 per-id scores count foods with the D/L verdict rule. |
| `ranking-incomplete-allergen` | E | **Retired 2026-11-01** (kept as a name so old tests and evidence resolve; asserts nothing). |
| `ranking-processed-warning` | E | Processed-food warning shown only with registered allergens, per processed ingredient, never claiming safety (US-E6-02/AC11–AC13). |
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

## 11. Processed-food rule changes (2026-11-01)
PO decision in `docs/PLAN.md` §7 (last row of 2026-11-01). No field added, removed or renamed; no schema version change.

| Change | Why |
|--------|-----|
| §3.7a new (definitions: processed ingredient, inherent allergens, F1', warning rule, copy keys) | PO: generic rule for processed foods |
| §3.7 `mayContainAllergenIds`, `possibleAllergenIds` reference-only; `allergenDataComplete` no longer a filter input; `allergenInfo` unchanged | PO: label data warn-only; F4 retired |
| §4 `ranking-hard-filter` reads `allergenIds` only; `ranking-incomplete-allergen` retired; `ranking-processed-warning` added; §6.1 mirrors | same |
| Validator rules kept unchanged: `recipe-allergen-union`, `recipe-may-contain-union`, `recipe-possible-allergens`, `recipe-allergen-complete-derived`, `recipe-ingredient-inherent-allergen` (now bites on 17 more dictionary rows; 71 recipes were fixed minimally, 183 ingredient entries) | minimal change |
| Dictionary: `inherentAllergenIds` set for 17 processed rows (dictionary §11) | F1' needs them |

## 12. Accounts and sign-in (v1 slice 1, 2026-11-09; stories E13)
PO decision in `docs/PLAN.md` §7 (2026-11-09). Google sign-in through Firebase Authentication. Data stays on the device. Items marked PROPOSAL are BA defaults awaiting the product owner.

**12.1 `ownerId` source.** While an account is signed in, `ownerId` (§2) is that account's Firebase `uid`. Legacy records carry `local` (MVP) and are rewritten to the uid when the first account adopts the device data (US-E13-04/AC1). The `meta-owner` rule is unchanged (non-blank string). New rule `meta-owner-matches-account` (S, store level): every record in an account's store has `ownerId` equal to the uid in that store's key name. Never an e-mail address or display name.

**12.2 Account-keyed storage key naming (PROPOSAL).** Keys become `bentominder.<uid>.state` and `bentominder.<uid>.state.prev` (the existing two-key backup scheme, one pair per account). `<uid>` is the Firebase uid used verbatim (alphanumeric, at most 128 characters; reject and treat as sign-in failure if it contains `.` or whitespace). The old keys `bentominder.state` and `bentominder.state.prev` are the legacy unkeyed store: read only by the one-time adoption (US-E13-04/AC1), never written afterwards. Other per-device settings that are not account data (for example theme, language) may stay unkeyed; the developer lists them in the ADR. `deviceId` stays per store as in §3.1. `schemaVersion` stays `1` (no field is added to the store); the key rename is a storage-layout change, not a schema change.

**12.3 Auth session state (runtime only, never stored in `BentoMinderStore`, never exported).**
| Field | Type | Req. | Rule |
|-------|------|------|------|
| `status` | `'loading'` \| `'signedOut'` \| `'signedIn'` | ✔ | `loading` only while the cached session is being read (US-E13-02/AC2) |
| `user.uid` | string | ✔ when `signedIn` | non-blank; see 12.2 for allowed characters |
| `user.displayName` | string \| null | ✔ when `signedIn` | display only |
| `user.email` | string \| null | ✔ when `signedIn` | display only |
| `user.photoUrl` | string \| null | ✔ when `signedIn` | display only; shown as decorative image |
| `lastError` | `'cancelled'` \| `'popupBlocked'` \| `'offline'` \| `'disabled'` \| `'other'` \| `'sessionEnded'` \| null | ✔ | maps to the copy of US-E13-03 and US-E13-02/AC5; `cancelled` shows no message; no technical text is stored or shown |

`user` is absent unless `status` is `signedIn`. The session itself (tokens) is held by the Firebase SDK's own persistence (`browserLocalPersistence`), not by the app.

**12.4 What is stored.** In the app's own storage: the uid (as key-name part and `ownerId`) only. Display name, e-mail and photo URL are never written to the store or the export file. Firebase's SDK keeps its own session data in the browser as part of Authentication.

**12.5 Validator.** `meta-owner-matches-account` (above) is added to §6.1 when implemented; the existing store validator is otherwise unchanged. Fixtures for tests use a fixed fake uid (for example `test-uid-001`) and a second one (`test-uid-002`) for the different-account cases.

**12.6 Carried to the sync slice (not in this slice).** APPI consent record for allergy and health data (adds to `consent`), in-app account deletion, tombstones and `updatedBy` (§7), and a decision on whether `ownerId` becomes a family id for shared records.

### Open points (each with a recommendation; none blocks work)
- **P1 Warning granularity.** Options: (a) per ingredient with the full list each time; (b) marker per ingredient + the full list once per recipe; (c) once per recipe only. **Recommend (b)**: 90 of 92 recipes have a processed ingredient, so (a) would repeat the list many times and bury it; (c) loses the "which product" hint. AC11 is written for (b).
- **P2 Ordering.** Options: keep BR-09 unchanged except retiring the incomplete-last tier, or rank recipes without processed ingredients first. **Recommend no change**: the PO asked for a warning, not a penalty, and almost every recipe carries one.
- **P3 Dead fields.** Options: keep `allergenInfo: unknown`/`allergenDataComplete` as derived data, or delete them in a schema change. **Recommend keep** (no migration; a later cleanup can drop them). 57 library recipes still have `allergenDataComplete = false`; nothing reads it.
- **P4 Stale data.** `ing-kombu` (a plain seaweed, `info = known`) has `allergenInfo = unknown` in two records; recommend setting it `known` with no allergens in a data fix (outside this BA task).
- **P5 Fish.** The scheme has no "fish" allergen item (only salmon, mackerel, salmon roe), so the PO examples surimi/kamaboko/chikuwa → fish cannot be an inherent id. See dictionary §11 "needs PO decision".

---

## 13. Hosted AI proxy contract (v1, 2026-11-09; stories E14)
PO decision in `docs/PLAN.md` §7 (2026-11-09). The hosted service exposes the same two endpoints as the local proxy; this section lists only what is new or different. Request and response bodies of a successful call are unchanged (§3.3 `ExtractedMenu`, ADR 002). Items marked DEFAULT are BA proposals.

**13.1 Endpoints.** `POST /api/menu/extract?targetMonth&promptVersion&schemaVersion` (body: PDF bytes, at most 10,485,760 bytes) and `POST /api/menu/fetch-pdf` (body `{ url }`), both under the configured base URL; `GET /api/health` (no token); `OPTIONS` on all (no token). Any other path or method: 404 / 405 as locally.

**13.2 Request headers (hosted).**
| Header | Rule |
|--------|------|
| `Authorization` | `Bearer <Firebase ID token>`, required on both POST endpoints; the token must be well formed, correctly signed, unexpired and issued for this app's Firebase project. The local proxy ignores it. |
| `Origin` | Browser calls only; must exactly equal an allowed origin (13.5) or be absent. |
| `Content-Type` | As locally (PDF bytes for extract, JSON for fetch-pdf). |

The account identity is taken only from the verified token (`uid`; `email` and `email_verified` for the allow-list). No client-supplied identity field exists.

**13.3 Error replies added by the hosted proxy.** JSON `{ ok: false, error, ... }`. Existing codes (`RATE_LIMITED`, `UNAVAILABLE`, `MALFORMED_OUTPUT`, `NOT_A_MENU`, `TOO_LARGE`, `NOT_A_PDF`, `NOT_CONFIGURED`, `NETWORK`, `BAD_REQUEST`, `INTERNAL`) keep their meaning.
| error | HTTP | Extra fields | When | App message (US-E14-08) |
|-------|------|--------------|------|------------------------|
| `UNAUTHENTICATED` | 401 | none | token missing/invalid/expired/wrong project | sign-in expired; one token refresh and retry |
| `NOT_ALLOWED` | 403 | none (body identical for every denied account) | valid token, account not on allow-list, or allow-list missing/empty | account can't use menu reading |
| `ORIGIN_NOT_ALLOWED` | 403 | none | `Origin` present and not allowed | service-unreachable message |
| `ACCOUNT_LIMIT` | 429 | `scope`: `hour` \| `day` \| `fetch`, `retryAfterSec` (integer, at least 1), `providerCalls: 0` | per-account limit reached | limit messages (US-E14-03/AC4) |
| `UNAVAILABLE` | 503 | `providerCalls: 0` | limit counter store failed (fail closed) | service-unreachable message |

`RATE_LIMITED` stays reserved for the provider's own rate limit. The app treats an unknown `error` value as unreachable.

**13.4 Per-account limits (configuration, not code).** Key: pseudonymous account key derived from the uid (never the e-mail). Windows: rolling 60 minutes and Tokyo (JST) calendar day.
| Setting | DEFAULT |
|---------|---------|
| `extractPerHour` | 5 |
| `extractPerDay` | 20 |
| `fetchPerHour` | 30 |
| `fetchPerDay` | 100 |
Stored per account: key, counts and timestamps only. Counts are shared by all instances and survive restarts. What counts: US-E14-03/AC6.

**13.5 Configuration inventory (names are indicative; the developer's ADR fixes them).** None of these values is in git or in the web build except the first.
| Item | Where | Content | Required |
|------|-------|---------|----------|
| Proxy base URL | web build variable `VITE_AI_PROXY_BASE_URL` (repository variable, public) | https URL, or empty for same-origin (local dev) | no |
| Gemini key | function secret | the AI Studio key | yes for extract; absent gives `NOT_CONFIGURED` |
| Allow-list | function configuration | list of uids and/or e-mails (PO, spouse) | yes; absent or empty denies everyone |
| Allowed origins | function configuration | exact origins, DEFAULT `https://mrdrah.github.io` | yes |
| Limits | function configuration | 13.4 | defaults apply when absent |

**13.6 URL rules for fetch-pdf (hosted).** The local rules (BR-14: https only, no port other than 443, at most 2048 characters, at most 3 redirects, at most 10,485,760 bytes, 15 s, body starts with `%PDF-`) plus: no credentials in the URL; refuse any destination that is loopback, private (10/8, 172.16/12, 192.168/16), link-local (169.254/16, fe80::/10), unique-local (fc00::/7), CGNAT (100.64/10), unspecified, multicast or reserved, including IPv4-mapped IPv6 and alternative IPv4 spellings (decimal, hex, octal); refuse the cloud metadata address and name; check every resolved address and every redirect hop, and the address actually connected to; forward no caller headers or cookies. Refusals use the existing "blocked" outcome (US-E2-02/AC3).

**13.7 Operations checklist (not stories; the PO or developer ticks each before first use of the live service).**
- [ ] Firebase project on the Blaze plan, with a **budget alert** (DEFAULT: alert at 500 JPY per month, thresholds 50 / 90 / 100 %; PO confirms the amount). A budget alert only notifies, it does not stop spending; note this to the PO.
- [ ] Function region `asia-northeast1` (Tokyo); a maximum number of instances set low (DEFAULT 3) to cap runaway concurrency.
- [ ] Gemini key stored as a function secret by the PO (never pasted into chat, git, CI or the web build); the key is an AI Studio free-tier key without billing.
- [ ] Allow-list (PO and spouse) entered in function configuration; checked that a third account is denied.
- [ ] Allowed origins configured (Pages origin; dev origin only if wanted).
- [ ] Repository variable `VITE_AI_PROXY_BASE_URL` added at repository level (not in an environment, as with the Firebase variables on 2026-11-09), then the Pages build redeployed.
- [ ] Authorized domain for sign-in includes the Pages host.
- [ ] Manual smoke test with the real service: allowed account extracts a synthetic fixture PDF; a denied account and a missing token get the refusals; a metadata-address URL is blocked; logs checked for no content.
- [ ] Cost check after the first month: usage within the free quotas for two accounts (N5 of the E14 notes).
- [ ] How to turn it off: remove the repository variable (app returns to same-origin) and disable or delete the function.

**13.8 Validator and tests.** No stored entity changes (`schemaVersion` stays 1). The hosted reply schema (13.3) is added to the shared response validation used by the web adapter (BR-11); a fixture exists for each `error` code, using the fake identities `test-uid-001` and `test-uid-002` of §12.5 and the fake address `allowed@example.test`.

---

## 14. Cloud sync and shared family space (v1, 2026-11-10; stories E15)
PO decisions in `docs/PLAN.md` §7 (2026-11-10). Describes what is stored online, who may see it and how copies are reconciled. It does not fix the collection layout, listeners or function design (developer's ADR). Items marked DEFAULT are BA proposals the product owner may overturn (`docs/ba/_scratch/e15/open-questions.md`). This section closes §12.6 and §7 ("tombstones and `updatedBy` are added with the v1 sync contract").

**14.1 Definitions.** *Family*: one shared dataset plus its member list. *Member*: a Firebase `uid` listed in one family. *Local copy*: the account's `BentoMinderStore` under `bentominder.<uid>.state` (§12.2), still the offline copy and the source for the UI. *Cloud*: Firestore, region `asia-northeast1` (Tokyo). *Sync record*: the cloud form of one synced record (14.2). An account is in **at most one** family at a time (rule `family-one-per-account`).

**14.2 What is synced and what is not.**
| Data | Synced? | Sync record granularity | Notes |
|------|---------|-------------------------|-------|
| `profile` (ChildProfile, incl. allergies, diet, likes) | yes | one record (`profile`); removal = tombstone | MVP: at most one child, unchanged |
| `menus` (MenuMonth incl. extractions and confirmed menu) | yes | one record per `YYYY-MM` | whole-month last-edit-wins (US-E15-07/AC9) |
| `overrides` (AssessmentOverride) | yes | one record per `YYYY-MM-DD` | |
| `decisions` (DayDecision incl. history) | yes | one record per `YYYY-MM-DD` | |
| `settings` (§3.9) except the two device fields below | yes | one record (`settings`) | reminder weekday/times/enabled, `nextMonthPromptFromDay`, `weekStartsOn` are synced |
| `settings.language`, `settings.theme` | **no** (per person) DEFAULT, Q2 | stay in the local copy | each parent keeps their own language and theme |
| `aiUsage` | yes | one record per `YYYY-MM`; merged by the larger count | family-wide AI use count; the proxy's own limits (§13) are unaffected |
| `reminderLog` | no | | per device; scheduled notifications and shown/dismissed state never leave the device (US-E15-06/AC11) |
| `consent` (AI notice, §3.1) | no | | per person (US-E2-08 stays per local copy); the cloud-sharing consent is separate (14.5) |
| `nextMonthCardHiddenOn` | no | | per device UI state |
| `deviceId` | tie-break and `updatedBy` metadata only (14.6) | | never exported, never sent to the proxy |
| `schemaVersion` | family-level field, equal to the writer's store version | | |

**Sync record envelope** (cloud only; never in the local store, never in an export): `kind` (`profile` \| `menu` \| `override` \| `decision` \| `settings` \| `aiUsage`), `key` (`YYYY-MM`, `YYYY-MM-DD` or the kind name), `payload` (the record exactly as in §3, validated by the same rules; absent for a tombstone), `updatedAt` (timestamp, §2), `updatedBy` (uid of the member who made the edit), `deviceId`, `deletedAt` (timestamp or absent: present = tombstone). Rules: `sync-envelope-shape` (known fields only, kinds and keys as listed); `sync-payload-valid` (payload passes the §3 rule for its kind); `sync-key-matches-payload` (key equals `payload.month`/`.date`); `sync-tombstone-no-payload`.

**Device-side sync metadata** (kept apart from the store; not exported): the family id and membership status for the account, the pending queue (latest version per record), the time of last successful sync, per-record last-synced `updatedAt`, the pre-join safety copy (14.4), cached consent version. Removed with the account's local copy by US-E10-04 only for the queue and safety copy; a family id is dropped on leave (14.7).

**14.3 Membership and invites.**
| Item | Rule |
|------|------|
| Family id | opaque, unguessable (at least 128 bits of randomness), generated at creation; the only value that goes into `ownerId` (§2, 14.7); never derived from the uid, never shown in the UI |
| Members | list of `{ uid, joinedAt, consentVersion, consentedAt }`; at most **2** (DEFAULT, Q1; a configuration value, not code); both equal: either may edit every record, invite, remove the other and delete the family |
| Display of a member | name or e-mail as sent by sign-in, shown only to members of the family, never stored in the store or in an export (§12.4); whether the member list in the cloud holds it is the developer's decision; Q5 |
| Creating | the account becomes the first member; allowed only when it is in no family (`family-one-per-account`) |
| Invite | one active invite per family: `{ code, createdBy, createdAt, expiresAt, usedBy?, usedAt?, cancelledAt? }` |
| Code | 10 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 symbols, about 50 bits), unpredictable, case-insensitive on entry, spaces and hyphens ignored; the link carries the code (`…/#/join/<code>`) |
| Expiry | 72 hours after `createdAt` (DEFAULT, Q7); expired exactly at `expiresAt` (inclusive of the last second before) |
| Single use | redeemed once; the first redemption wins; later attempts are refused |
| Redeeming | requires sign-in, consent (14.5), account in no family, a free place; on success the redeemer is added and the invite is marked used, as one all-or-nothing step |
| Failure replies | generic for wrong / used / cancelled; distinct only for `expired` and `family-full`; `already-in-family` is shown to the redeemer only; none reveals a family, member or child |
| Attempt limit | 10 failed redemptions per account per rolling hour (DEFAULT); then refused for the rest of the hour |
| Re-invite | a new invite or a cancel invalidates the previous code at once |

**14.4 First sync and adoption of local data.**
| Situation | Outcome |
|-----------|---------|
| Create family, local copy has data | after consent, every synced record is uploaded once (timestamps unchanged, `ownerId` := family id); local copy remains the working copy |
| Create family, local copy empty | empty family; later edits sync normally |
| Join, local copy empty | download family data, no question, no onboarding |
| Join (or first sync of a further device of a member), local copy has data, family empty | upload as for creation, no question |
| Join (or further device), local copy has data, family has data | ask once, default **keep family**: (a) *use family's data*: local copy replaced by the family's data; (b) *add this device's data*: family profile and settings win; menu months, overrides and decisions whose key the family lacks are added; keys both have keep the family's record; `profile` and `settings` from the device are never merged field by field |
| Safety copy | in both (a) and (b) the previous local copy is kept on the device as a safety copy until the parent deletes it or for 30 days (DEFAULT), whichever is first; it can be exported (E10 format) and is never uploaded |
| Interrupted adoption | resumes at next open; the question is asked only once per device and family |

"Has data" means: a profile exists, or at least one menu month, decision or override exists. Defaults-only settings do not count.

**14.5 Cloud-sharing consent.** Separate from `consent.aiNoticeVersion`. Record: `cloudNoticeVersion` (integer ≥ 1, version **1** = the content of US-E15-02/AC2 items a to i) and `consentedAt` (timestamp), kept in the member's entry in the cloud and cached on the device. Per member; recorded before the first sync request that carries family data; a content change raises the version and asks again (sync paused for that member until accepted; US-E15-02/AC6). Withdrawing consent = leaving the family (US-E15-08); there is no "stay but stop" except pausing by declining a new version. Text requirements (ja and en, same items): (a) what, (b) why, (c) where (Firebase/Firestore, Tokyo, Japan), (d) who sees it (members only; no sale, no advertising), (e) the operator can technically reach stored data via the hosting console and does not use it (DEFAULT wording pending Q3), (f) AI reading is separate and sends no family data, (g) how to stop and delete, (h) a contact (Q4), (i) the consenting person is a parent or guardian. The text makes no claim of legal compliance, contains no codes, and is readable again in settings with the date consented. Legal review of the wording is outside this contract (Q3).

**14.6 Conflict and tombstone rules.**
- **Winner per sync record**: greater `updatedAt` wins; equal `updatedAt`: greater `deviceId` (string comparison) wins; still equal (same device): the pure order of ADR 016 (a tombstone beats a live record, then payload text, then updatedBy); a same-device same-millisecond rewrite is decided by the server arrival order (PLAN §7 2026-11-10). Rule `sync-winner-deterministic`.
- **Merge** is per record, idempotent, commutative and associative (`sync-merge-convergent`): any order and any repetition of the same set of records gives the same result.
- **Delete** = tombstone with `deletedAt` = `updatedAt`. A tombstone competes by the same winner rule: a later edit resurrects the record, a later delete removes it.
- **Tombstone retention**: 90 days (DEFAULT, Q8), then purged by the cloud. A device whose last successful sync is older than 90 days reconciles on reconnect: a local record whose `updatedAt` equals its last-synced `updatedAt` and which is absent from the cloud is dropped locally; a record changed locally since is sent.
- **Clock skew**: a record received with `updatedAt` more than 5 minutes after the cloud's receive time is stored with `updatedAt` := the receive time. A record older than 13 months is not written to the cloud (retention, §7).
- **Retention pruning** (§7, 13 months) is a delete and produces tombstones.
- **After every apply** the local copy passes the whole store validation (§6); a dangling reference (for example a decision whose menu or recipe no longer resolves) is handled by the existing dormant/cleared rules of §3.6 (`decision-dormant`), never by a crash.
- **Lost edits**: when a pending local edit loses, the app notes it once (US-E15-07/AC8). Nothing else is merged.
- **Limit of the model** (accepted, Q6): last-edit-wins per whole record can drop the loser's extra content inside one record (for example a second extraction of the same month).
- **Import into a family** (US-E15-11/AC6): imported records get `updatedAt` = now; records absent from the file become tombstones.

**14.7 `ownerId`, leaving, removal, deletion.**
- While the account is in a family, `ownerId` of every synced record is the family id. In the local copy of a non-member it is the uid. `meta-owner-matches-account` (§12.1) becomes: `ownerId` equals the account's uid **or** the family id of the account's current membership; any other value fails.
- Leave or removal: the local copy stays on the device, every `ownerId` rewritten to the uid, sync metadata for that family dropped, status `local-only`. The cloud keeps the family's data for the remaining member.
- Delete family data: removes every sync record, tombstone, invite, member list and the family document; nothing of the content remains in the cloud. Each other member's device learns at next sync/open (`membership-ended`, reason `family-deleted`), keeps its local copy as stand-alone, and never re-creates the family.
- Last member leaving: same as delete family data (confirmation of US-E15-08/AC4).
- Account deletion (Firebase user) is not part of this section; leaving or deleting the family removes the family-related cloud content; deleting the Firebase user itself is a later story (Q9).
- No cloud copy of the device's local-only items (14.2) ever exists.

**14.8 First sign-in on a new device.** After sign-in, the app reads the account's membership. A member with no local copy waits for the family data (loading state, 15 seconds, then a retry screen) and never shows onboarding first (`new-device-no-onboarding-before-family-known`). A device with a local copy opens at once and syncs in the background. An account in no family is local only (14.4 first row does not apply until the parent chooses).

**14.9 Sync status (runtime state, not stored in the store, not exported).**
| `syncStatus` | Meaning | User text key (designer) |
|--------------|---------|-------------------------|
| `local-only` | not in a family | sync.localOnly |
| `synced` | nothing pending, last sync time known | sync.synced |
| `syncing` | sending or receiving | sync.syncing |
| `pending-offline` | no network and ≥ 1 pending record | sync.pendingOffline |
| `retrying` | a temporary error; backing off | sync.retrying |
| `paused-no-consent` | new notice version not yet accepted | sync.needsConsent |
| `paused-limit` | a size or write limit (14.10) was reached | sync.limit |
| `paused-app-too-old` | cloud `schemaVersion` > the app's | sync.appTooOld |
| `membership-ended` | left, removed or family deleted (shown once, then `local-only`) | sync.membershipEnded |
Fields shown with it: last successful sync time, pending count, oldest pending age (highlight at 24 h). Exactly one state at a time; no technical text.

**14.10 Limits and cost guardrails (configuration, not code; DEFAULT).**
| Setting | Value |
|---------|-------|
| `maxMembers` | 2 |
| `maxRecordBytes` | 262,144 (256 KiB JSON) |
| `maxFamilyBytes` | 5,242,880 (5 MiB total of record JSON) |
| `writeCoalesceSeconds` | 10 (at most one write per record in that window; the latest content is sent) |
| `maxWritesPerDevicePerHour` | 200 (then `paused-limit` until the next hour; queue keeps filling) |
| Retry back-off | start 5 s, double each time, at most 5 minutes, with jitter; a manual 「今すぐ再試行」 resets it |
| `inviteTtlHours` | 72 |
| `inviteFailedAttemptsPerHour` | 10 per account |
| `tombstoneRetentionDays` | 90 |
| `safetyCopyDays` | 30 |
| `liveUpdateSeconds` | 60 (online devices show another device's change within this time; Q12) |
Reads: only changed records after the first full download. The ADR states expected daily reads, writes and storage for two users against the current free quotas, which the developer checks on Google's pricing page; this contract quotes no quota numbers. The budget alert of §13.7 covers the project.

**14.11 Migration from the current local scheme.** No change to the store: key scheme (§12.2), `schemaVersion` 1 and every §3 rule stay. No migration runs until the parent creates or joins a family. The only data change on joining is `ownerId` (14.7). A device with an older app version can still read its local copy but does not sync; it never writes cloud data (nothing to upgrade). Export (E10-03) is the store as is: no sync records, tombstones, members or invites, no new top-level field (`export-roundtrip`). Old export files import as before; while in a family, import replaces the family's data after a warning (14.6). Local "delete all" (US-E10-04) removes local keys only and does not delete the cloud data or queue deletions.

**14.12 Sync port (test seam).** The app reaches the cloud only through a `SyncPort` (create family, read membership, create/cancel/redeem invite, leave, remove member, delete family, push records, pull changes, subscribe to changes) with a fake adapter that can simulate offline, slow, failing and conflicting responses, plus a fake clock. No Firebase type crosses it (ADR 014 pattern). Fixtures: `test-uid-001`, `test-uid-002`, `test-uid-003` (a non-member), family id `fam-test-001`, code `ABCD234567`, `device-A`, `device-B`.

**14.13 Security-rule requirements (what must hold; the rules file is the developer's).**
| Id | Requirement |
|----|-------------|
| `rules-auth-required` | no read or write of family data without sign-in |
| `rules-member-only` | read and write of a family's data only by a uid listed in that family's members |
| `rules-no-cross-family` | no read, list or query across families; a non-member cannot learn whether a family id exists |
| `rules-members-equal` | both members have the same read/write/delete rights on records |
| `rules-no-self-add` | membership changes only through the invite redemption path, never by a direct client write; a member can change only their own consent fields; member maximum cannot be changed by a client |
| `rules-invites-closed` | invites are not readable or listable by non-members; redemption is rate-limited |
| `rules-write-shape` | envelope shape (14.2), `updatedBy` = the signed-in uid, family id matches, no unknown fields, size within 14.10 |
| `rules-removed-no-access` | a removed or departed uid is denied immediately, including open listeners |
| `rules-default-deny` | everything not listed is denied; the proxy's counters stay deny-all (§13) |
Each is tested with the rules emulator (US-E15-09). The rules are in git; deploying them is a PO/developer step listed with §13.7-style operations.

**14.14 Hosted AI proxy.** Unchanged (§13). Family membership is neither required nor sufficient; the allow-list stays by account. The proxy neither reads nor writes family data. Extraction results shared through the family's `menus` records make an already-extracted PDF (same `sha256`) cost 0 provider calls for the other member (US-E2-07, US-E15-10/AC8).

**14.15 Validator and fixtures.** New rule ids (added to §6.1 when implemented): `family-one-per-account`, `sync-envelope-shape`, `sync-payload-valid`, `sync-key-matches-payload`, `sync-tombstone-no-payload`, `sync-winner-deterministic`, `sync-merge-convergent`, `new-device-no-onboarding-before-family-known`, and the changed `meta-owner-matches-account` (14.7). Fixtures: a store with data for create/join; a family with a different profile and with overlapping and non-overlapping dates for the "add this device's data" cases; tombstone and resurrection pairs; a 90-day boundary pair; a skewed-clock record.

### Open points
See `docs/ba/_scratch/e15/open-questions.md` (Q1 to Q12). None blocks the developer's ADR; each has a DEFAULT used above.

**14.12 Rulings after E15 QA (Orchestrator, 2026-11-10; PO may overturn).**
- *Old-app compatibility (14.11, E15-D06):* a family-owned local copy is read by the E13-scheme repository as corrupt. Accepted as a documented limitation: no previous build is in use, and the PO's devices run the current app. The app never downgrades a store silently.
- *deviceId in exports (14.2, E15-D05):* the export keeps the store-root `deviceId` as before E15 (a random id, not personal data, never sent to the proxy). The "never exported" wording applies to sync records and the cloud only.
- *Invite code at rest (E15-D01):* the invite document id is the hash of the code; the plain code is kept inside the active invite document so the inviter can see it again, and is removed when the invite is used, cancelled or expired. Accepted (72 h life, readable only through the Function).
- *Invite code alphabet (E15-D02):* codes never contain 1, I, L, 0 or O; the length stays 10 (the generator may use rejection sampling).
- *Read estimate (E15-D08):* an idle poll costs 4 reads; a typical two-device day measured 2,262 reads (4.5% of the free 50,000) and 165 writes; the ADR's 1,500 is superseded.
