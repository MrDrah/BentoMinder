# Data contract — BentoMinder

Semantics: BA · Format, JSON Schema (`data/schema/`) and validator: Developer · 2026-10-24 · Contract version **v1** · Status: draft for PO review (H1)

Stories: `docs/ba/user-stories.md` · Terms and ids: `docs/ba/domain-dictionary.md` · Proposed rules: `docs/ba/open-questions.md` (BR-xx)

## 1. Definitions of valid

**Correctly extracted menu.** An extracted menu is correct when, compared with the hand-made answer key of its fixture PDF, every date the PDF lists maps to the same ISO date with the same set of dish texts (after NFKC normalisation and whitespace trimming), every no-lunch day is listed with the right reason, no dish, ingredient or allergen that the PDF does not print is present, and every field the answer key marks as hard to read carries `verification.status = "uncertain"`.

**Authentic recipe.** A recipe is authentic when its dish, every ingredient with its quantity, its steps and its time can be traced to at least one cited source page that was fetched and that belongs to an approved publisher in `docs/ba/research-brief.md`, every change for a child portion is recorded in `adaptations`, its own-words text passes `validate.mjs overlap`, and every allergen that its ingredients carry according to the dictionary is listed.

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
| Allergen scheme | Allergen ids come from the dictionary's allergen list for scheme `caa-2026-04` (9 mandatory + 20 recommended items). Retired ids (e.g. `alg-matsutake`) are accepted when reading old data, never written. | `allergen-unknown`, `allergen-retired` |

## 3. Entities

### 3.1 Root store `BentoMinderStore` (one per device, local storage)
| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `schemaVersion` | integer | ✔ | `1` for this contract. Lower → migrate (with backup); higher → read-only (US-E10-02). | `1` |
| `createdAt` / `updatedAt` | timestamp | ✔ | `updatedAt ≥ createdAt` | |
| `settings` | `Settings` | ✔ | §3.9 | |
| `profile` | `ChildProfile` \| null | ✔ | `null` before onboarding step 1 or after deletion. MVP: at most one. | |
| `menus` | object map `YYYY-MM → MenuMonth` | ✔ | key equals `MenuMonth.month`; may be `{}` | |
| `overrides` | object map `YYYY-MM-DD → AssessmentOverride` | ✔ | key equals `.date` | |
| `decisions` | object map `YYYY-MM-DD → DayDecision` | ✔ | key equals `.date`; only parent-created records (BR-02) | |
| `reminderLog` | `ReminderLogEntry[]` | ✔ | unique `key`; entries older than 60 days may be pruned | |
| `consent` | `{ aiNoticeVersion: integer ≥ 1, consentedAt: timestamp }` \| null | ✔ | null until the parent consents (US-E2-08) | |
| `aiUsage` | object map `YYYY-MM → integer ≥ 0` | ✔ | number of provider calls made per Tokyo month | `{ "2026-11": 1 }` |

`MenuMonth`: `{ month: YYYY-MM, sourceUrl?: string, extractions: ExtractedMenu[] (≤ 3, newest last), confirmed: ConfirmedMenu | null, pendingReviewExtractionId?: string }`.

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
| `days` | `ExtractedDay[]` | ✔ | 0–31 entries, unique `date`, sorted ascending | |
| `noLunchDays` | `NoLunchDay[]` | ✔ | unique `date`; disjoint from `days[].date` | |
| `outOfMonthDays` | `ExtractedDay[]` | ✔ | days the model returned outside `targetMonth`; never imported (US-E2-05/AC4) | `[]` |
| `warnings` | enum[] | ✔ | `month-mismatch`, `pages-unreadable`, `layout-unrecognised`, `partial-extraction` | `[]` |
| `extractedAt` | timestamp | ✔ | | |

`MenuSource`:
| Field | Type | Req. | Rule | Example |
|-------|------|------|------|---------|
| `kind` | enum | ✔ | `url` \| `upload` \| `manual` \| `fixture` | `url` |
| `url` | string | if kind=url | http/https, ≤ 2048 chars (BR-14) | `https://example-kinder.test/menu/2026-11.pdf` |
| `filename` | string | if kind=upload | ≤ 255 chars | `11gatsu-kondate.pdf` |
| `sha256` | string | ✔ unless manual | 64 lowercase hex chars of the PDF bytes | |
| `byteSize` | integer | ✔ unless manual | 1 … 10,485,760 (BR-14) | `389120` |
| `fetchedAt` | timestamp | ✔ | when the bytes were obtained | |
| `model` | string | ✔ unless manual | provider model id as reported by the adapter | (set at runtime) |
| `promptVersion` | integer | ✔ unless manual | version of the fixed extraction prompt | `1` |

`ExtractedDay`:
| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `date` | date | ✔ | inside `targetMonth` (else moved to `outOfMonthDays`) | `2026-11-04` |
| `printedDateText` | string \| null | ✔ | the date as printed, if readable | `4日（水）` |
| `printedWeekday` | enum \| null | ✔ | `日月火水木金土` single char, as printed; if it disagrees with `date`, `verification` must be `uncertain/weekday-mismatch` | `水` |
| `items` | `MenuItem[]` | ✔ | 1–12 | |
| `ingredientsStatus` | enum | ✔ | `listed` \| `not-listed` \| `unreadable` | `listed` |
| `ingredients` | `MenuIngredient[]` | if listed | 1–40; absent otherwise. Never inferred from dish names (BR-11). | |
| `allergenDeclaration` | `AllergenDeclaration` | ✔ | below | |
| `notes` | string[] | ✔ | 0–5 notes as printed (e.g. 「誕生会」「行事食」), ≤ 100 chars each | `["誕生会"]` |
| `verification` | `Verification` | ✔ | day-level status (date/weekday problems) | |

`MenuItem`: `{ text: string 1–40 chars as printed, kind: "staple" | "main" | "side" | "soup" | "drink" | "dessert" | "snack" | "unknown", verification: Verification, resolvedIds?: string[] (set on review for ambiguity choices) }`. Items of kind `snack` (おやつ) are shown but not assessed (OQ-07).

`MenuIngredient`: `{ text: string 1–30 chars as printed, foodGroup: "red" | "yellow" | "green" | null, verification: Verification }`. `foodGroup` is only set when the PDF prints the 三色食品群 grouping (赤・黄・緑); never inferred.

`AllergenDeclaration`:
| Field | Type | Req. | Rule |
|-------|------|------|------|
| `status` | enum | ✔ | `declared` (PDF lists allergens for this day), `declared-none` (PDF explicitly states none for this day), `not-declared` (PDF says nothing: the default), `unreadable` |
| `allergenIds` | string[] | ✔ | `alg-` ids mapped from the printed words; non-empty only when `declared` |
| `rawText` | string \| null | ✔ | the printed words, kept for review |
| `verification` | `Verification` | ✔ | |

Rule `allergen-absence-not-inferred` (BR-08): `declared-none` is only valid when `rawText` is non-null (the PDF said so). The app treats `not-declared` and `unreadable` as "unknown", never as "none".

`NoLunchDay`: `{ date, reason: "bento-day" | "no-lunch" | "closed" | "unknown", originalText: string 1–60 chars, verification }`. `bento-day` = everyone brings a bento (お弁当の日); `no-lunch` = school open without lunch (午前保育, 短縮保育); `closed` = no school (休園, 行事の振替休日).

`Verification`: `{ status, reason?, note? }`
| `status` | Set by | Meaning |
|----------|--------|---------|
| `ok` | model | read with confidence |
| `uncertain` | model or validator | requires review; `reason` required: `low-legibility`, `weekday-mismatch`, `duplicate-date`, `ambiguous-term`, `outside-month`, `other` |
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
| `changedDatesSincePrevious` | date[] | ✔ | dates whose items differ from version − 1 (used for override/decision conflict notices) | `["2026-11-18"]` |

Cross-field rules: `confirmed-no-uncertain`; `confirmed-days-in-month`; `confirmed-days-disjoint`; at least one day or no-lunch day (`confirmed-not-empty`).

**School day** (BR-25): a date that appears in `ConfirmedMenu.days` with ≥ 1 non-snack item. Dates in `noLunchDays` are no-lunch days. All other dates (weekends, holidays, unlisted weekdays) are not school days and get no assessment or decision.

### 3.5 `Assessment` (computed on read; never stored except the override)
| Field | Type | Rule | Example |
|-------|------|------|---------|
| `date` | date | a school day or no-lunch day of a confirmed menu | `2026-11-04` |
| `calculatedState` | enum | `likely-enjoyable` \| `mixed-uncertain` \| `low-preference` \| `not-assessed` \| `no-school-lunch`, by BR-04 | `low-preference` |
| `state` | enum | `override.state` if an override exists, else `calculatedState` | |
| `explanationKey` | string | one of `assess.likely`, `assess.mixedOne`, `assess.mixedUnknown`, `assess.mixedNeutral`, `assess.low`, `assess.notAssessed`, `assess.noLunch`, `assess.override` | `assess.low` |
| `explanationParams` | object | `{ weekday: 0–6, dislikedCount, likedCount, dislikedLabels: string[] ≤ 3, likedLabels ≤ 3, unmatched ≤ 3 }` | `{ "weekday": 3, "dislikedCount": 2, "dislikedLabels": ["ピーマン","なす"] }` |
| `matched` | object | `{ likedIds[], dislikedIds[], unmatchedItems[], ambiguousItems[] }` for QA and the explanation | |
| `menuVersion` | integer | `ConfirmedMenu.version` used | `1` |
| `override` | `AssessmentOverride` \| null | | |

`AssessmentOverride` (stored):
| Field | Type | Req. | Rule | Example |
|-------|------|------|------|---------|
| `date` | date | ✔ | must be a school day when set (`override-school-day-only`); kept even if a later refresh changes that (shown with a notice) | `2026-11-12` |
| `state` | enum | ✔ | `likely-enjoyable` \| `mixed-uncertain` \| `low-preference` | `low-preference` |
| `setAt` | timestamp | ✔ | | |
| `menuVersionAtSet` | integer | ✔ | if the date is in `changedDatesSincePrevious` of a newer version, show 「献立が変わりました」 (US-E3-05/AC3) | `1` |

### 3.6 `DayDecision` (stored only after a parent action, BR-02)
Displayed decision for a date = stored `DayDecision.state` if present, else derived: school day → `school-lunch-planned`, no-lunch day → `no-school-lunch`.

| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `date` | date | ✔ | | `2026-11-04` |
| `state` | enum | ✔ | stored: `school-lunch-planned` \| `homemade-bento-planned` \| `not-confirmed`. `no-school-lunch` is display-only and never stored (`decision-no-lunch-not-stored`). | `homemade-bento-planned` |
| `recipeId` | string | iff bento | resolves to a library recipe when written (`decision-bento-requires-recipe`, `decision-recipe-resolves`); may stop resolving after a library change (US-E6-06) | `rcp-kuma-onigiri` |
| `recipeNameSnapshot` | localized text | iff bento | copy of the recipe name at decision time | `{ "ja": "くまさんおにぎり弁当" }` |
| `reservationDoneExternally` | boolean | ✔ | may be `true` only when `state = school-lunch-planned` (`decision-reservation-flag`); it is the parent's own record, the app does nothing with the school | `false` |
| `decidedAt` | timestamp | ✔ | | |
| `history` | `{ state, recipeId?, at }[]` | ✔ | last 5 changes, for debug and conflict display | |

Cross-field rules:
- `decision-transition`: a change from the previous state must be allowed by the state machine in `user-stories.md` §E5.
- `decision-no-past-write`: no write with `date` < today (Asia/Tokyo) (US-E5-02/AC3).
- `decision-bento-day-only`: `homemade-bento-planned` on a no-lunch day only when its reason is `bento-day`. A conflict that arises from a menu refresh is kept and flagged, not rejected (US-E3-05/AC2).

### 3.7 `Recipe` (`data/_research/batch-*.json` → merged `data/library.json`, generated)
| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `id` | string | ✔ | `rcp-` + kebab-case; unique across all batches; never reused | `rcp-kuma-onigiri` |
| `name` | localized text | ✔ | `ja` required; `en` required unless the dish is only known by its Japanese name (then `en` = romanised name + short gloss) | `{ "ja": "くまさんおにぎり弁当", "en": "Bear onigiri bento" }` |
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
| `mayContainAllergenIds` | string[] | ✔ | union of `ingredients[].possibleAllergenIds` of varies-by-product ingredients | `["alg-egg","alg-milk"]` |
| `allergenScheme` | string | ✔ | `caa-2026-04` | |
| `dietOk` | enum[] | ✔ | diets this recipe satisfies; must equal the set the validator derives from ingredient categories (`recipe-diet-derived`) | `["no-beef","no-seafood"]` |
| `adaptations` | localized text[] | ✔ | changes made vs the source (e.g. halved for a child portion); `[]` if none | |
| `sources` | `Source[]` | ✔ | ≥ 1; the first is the primary recipe source | |
| `reviewedBy` | string | ✔ | `ba-research` until the verifier passes; then `verifier` | |

`RecipeIngredient`:
| Field | Type | Req. | Rule | Example |
|-------|------|------|------|---------|
| `ingredientId` | string | ✔ | `ing-` id that resolves in the dictionary (`recipe-ingredient-resolves`) | `ing-rice` |
| `label` | localized text | ✔ | as shown to the parent | `{ "ja": "ごはん", "en": "cooked rice" }` |
| `quantity` | number \| null | ✔ | > 0, ≤ 2 decimals; null only with unit `to-taste` or `small-amount` | `120` |
| `unit` | enum | ✔ | `g`, `ml`, `piece` (個), `slice` (枚), `stick` (本), `tbsp` (大さじ), `tsp` (小さじ), `cup` (カップ 200 ml), `sheet` (枚・のり), `to-taste` (適量), `small-amount` (少々) | `g` |
| `optional` | boolean | ✔ | | `false` |
| `allergenInfo` | enum | ✔ | `known` (the food itself defines its allergens, e.g. 卵) \| `varies-by-product` (processed food: ウインナー, カレールー, パン…) | `known` |
| `allergenIds` | string[] | ✔ | must include the dictionary's `inherentAllergenIds` for that ingredient (`recipe-ingredient-inherent-allergen`) | `["alg-egg"]` |
| `possibleAllergenIds` | string[] | ✔ | non-empty iff `varies-by-product`; from the source or typical product labels, cited | `["alg-pork","alg-milk","alg-soybean"]` |

`Source`: `{ id: "src-…", publisher: string, title: string, url: http(s), accessed: date, language: "ja" | "en", usedFor: ("recipe" | "storage" | "allergen")[] }`. `url` must be on the approved list (`source-publisher-approved`).

### 3.8 Diet meaning (used by the hard filter, BR-06)
| Diet | Recipe is excluded if any ingredient (or a varies-by-product ingredient's possible content) belongs to |
|------|------|
| `vegetarian` | `cat-meat` (all meat), `cat-fish`, `cat-seafood`, `ing-gelatin`, `cat-meat-processed`, `cat-fish-processed` |
| `pescatarian` | `cat-meat`, `cat-meat-processed`, `ing-gelatin` |
| `no-pork` | `cat-pork` or allergen `alg-pork` (including `possibleAllergenIds`), `ing-gelatin` |
| `no-beef` | `cat-beef` or allergen `alg-beef` (including `possibleAllergenIds`) |
| `no-seafood` | `cat-fish`, `cat-seafood`, `cat-fish-processed` |
Gelatin is excluded for vegetarian, pescatarian and no-pork because its animal origin is not stated on most products (flag for PO in OQ-11).

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
| `settings.reminders.reservation` | `{ enabled, time }` | – | v1 only (US-E7-08); must be absent or disabled in MVP builds | absent |
| `settings.nextMonthPromptFromDay` | integer | ✔ | 1–28 (US-E3-06/AC2) | `20` |

`ReminderLogEntry`: `{ key: "weekly:<date>" | "day-before:<date>", type: "weekly" | "day-before", dueAt: timestamp, expiresAt: timestamp, shownAt?: timestamp, dismissedAt?: timestamp, debug?: boolean }`. Rules: `reminder-key-unique`; `expiresAt > dueAt`; day-before `expiresAt` = 00:00 JST of the target date; weekly `expiresAt` = 24:00 JST of the last covered date.

## 4. Cross-entity rules
| Rule id | Rule |
|---------|------|
| `ref-dictionary` | Every `ing-`/`cat-`/`dish-`/`alg-`/`theme-` id in the store or the library resolves in the dictionary of the current build. |
| `ref-recipe` | Every `DayDecision.recipeId` resolved when written; unresolved ids on read are reported, not deleted (US-E6-06). |
| `assessment-independent` | Assessment computation reads `profile`, `menus[].confirmed` and `overrides` only; it never reads or writes `decisions` (BR-01). |
| `decision-parent-only` | `decisions` changes only through UI actions listed in the state machine (BR-02); import, refresh, assessment, reminders and time never write it. |
| `ai-payload-allowlist` | The adapter request has exactly: `pdf` (bytes or URL), `targetMonth`, `promptVersion`, `schemaVersion` (BR-10). |
| `export-roundtrip` | An export file re-validates as a `BentoMinderStore` of the same `schemaVersion` (US-E10-03). |

## 5. Fixtures required (synthetic, never presented as a real school's menu)
`fixture-menu-2026-11` (PDF + hand-made answer key + recorded model output): November 2026, Mon–Fri, with at least: 2026-11-04 「ピーマンとなすのみそ炒め」 (two disliked items for the sample child); 2026-11-05 「さばのみそ煮」 with an allergen line declaring 卵・小麦; 2026-11-06 with no allergen line; 2026-11-10 with no ingredient list; 2026-11-20 「お弁当の日」; 2026-11-27 「午前保育（給食なし）」; no entries for 2026-11-03 and 2026-11-23 (祝日); one deliberately hard-to-read dish; ingredients grouped 赤・黄・緑 on at least 3 days; at least one standalone 「カレー」. Further fixtures: `fixture-menu-2027-02` (28 days), `fixture-menu-2028-02` (29 days), a weekday-mismatch variant, a malformed-JSON response, a rate-limit response. Each fixture is marked `"synthetic": true`.

## 6. Validator
`scripts/validate-data.mjs` (Developer) enforces every rule id above for the library and for exported stores; the app runs the same schema on every store write (US-E10-05) and on AI output (US-E2-05). Each message names its rule id. The BA reviews the rule list before H3. Note for the Orchestrator: `quality-gate.json → overlap.fields` still lists template fields (`shortDescription`, `history`, `tasteProfile`); for this project it should be `description`, `steps`, `storage`, `adaptations`.

## 7. v1: ownership and persistence
| Entity | Owned by a user? | Moves to a server in v1? | Personal data? | Retention |
|--------|------------------|--------------------------|----------------|-----------|
| ChildProfile | v1: family (owner + members) | Only with synced family planning; needs auth and a privacy notice | Yes (child preferences, allergies = health-related, APPI 要配慮個人情報 risk) | until deleted by parent |
| ConfirmedMenu / ExtractedMenu | family | could be shared per school URL in v1 (not personal) | No (public document) | 13 months |
| DayDecision, AssessmentOverride | family | yes with sync | Low (plans) | 13 months |
| ReminderSettings, ReminderLog | device | settings yes, log no | No | log 60 days |
| Recipe library | app | static, shipped with the app | No | versioned with releases |
| Consent | device / user | yes | Yes (consent record) | while the account exists |
