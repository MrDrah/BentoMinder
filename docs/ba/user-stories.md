# User stories — BentoMinder

Owner: BA · 2026-10-24 · Status: **H1 final** (PO answers of 2026-10-24 applied; reconciliations R-1, R-2, R-3 applied; H1 fix round of 2026-10-24 applied: rulings B1, B2, B4–B7, B10, B14 and follow-ups; M1 prep of 2026-10-24 applied, see "M1 prep" below; M2 prep of 2026-10-25 applied, see "M2 prep" below) · Rules: approved BR table in `docs/PLAN.md` §3 · Decisions: `docs/PLAN.md` §7 · Data: `docs/ba/data-contract.md` (source of all state and field names) · Terms: `docs/ba/domain-dictionary.md` · QA traces tests to these IDs (`validate.mjs trace`).

## H1 changes (since the kick-off draft of 2026-10-24: 72 stories / 245 ACs → 73 / 264 at the first H1 pass → 73 / 287 after the H1 fix round and closing rulings)
No AC was renumbered. Added ACs take the next free number; a retired AC stays in its story as a comment.

| Why | Changed | Added | Retired |
|-----|---------|-------|---------|
| PO: week starts Monday, Sunday as a setting | US-E5-01/AC2 | US-E5-01/AC8 | |
| PO: free-tier AI used from Japan only, parents-only app | US-E2-08/AC1 (notice content moved to AC4; Developer hedge removed), US-NF-05/AC2 | US-E2-08/AC4 | |
| R-1 / BR-10: at most 2 provider calls, call 2 = repair retry or fallback model | US-E2-05/AC1, US-E2-05/AC2, US-E2-06/AC2, US-E2-07/AC2, US-E2-07/AC3, US-E11-03/AC2 (failure-mode table) | US-E2-06/AC5, AC6, AC7, AC8; US-E2-07/AC4 | US-E2-06/AC1 (replaced by AC5 + AC6) |
| R-2: data-contract state names everywhere | Conventions; E5 state-machine table | | |
| R-3 / BR-06 / OQ-13: incomplete allergen data | E6 ranking and hard-filter notes | US-E6-02/AC5, US-E6-02/AC6 | |
| Designer gap: short names in calendar cells | US-E5-01/AC4 | US-E6-07/AC5 | |
| Designer gap: English for the fetch errors (and the Japanese completed) | US-E2-02/AC1 | | |
| Designer gap: display theme setting ([no story]) | | US-E8-05/AC1–AC3 (new story, Should) | |
| OQ answers made definitive | US-E1-04/AC1 (gelatin, possible pork, OQ-11), US-E3-06/AC2 (setting note, OQ-15), US-E5-07/AC3 (Should, OQ-05), US-E7-08 (v1 note) | US-E1-04/AC4 (OQ-11), US-E4-01/AC9, AC10 (snacks, OQ-07 / BR-25), US-E5-08/AC3, AC4 (お弁当の日, OQ-03) | |
| Consistency with BRs | US-E3-03/AC2 (removed "at most mixed-uncertain" rule that BR-04 doesn't have), US-E1-05/AC2, US-E1-06/AC1, AC2, US-E2-04/AC7 (payload = BR-10 allow-list) | US-E2-02/AC3 (BR-14 on the server fetch), US-E6-07/AC4 (BR-26 hand check) | |
| Traceability | 176 scenario titles now end with the BR they enforce `(BR-xx)` | | |
| H1 fix round, B1/B2/B5 (PLAN §7 "H1 rulings on QA blockers", "H1 follow-ups confirmed"): D/L = distinct found dictionary ids, most specific profile entry wins, same-level tie → dislike, item with match + unresolved ambiguity counts in U | E4 rule paragraph (one counting paragraph + worked example), E6 ranking paragraph ("per liked id") | US-E4-01/AC11, AC12, AC13, AC14 | |
| H1 fix round, B4: explanation key per mixed case | | US-E4-02/AC4 | |
| H1 fix round, B6/B7 + follow-ups: refresh conflicts (planned day turned no-lunch or removed: kept, flagged 「献立が変わりました」, only KEEP_PLAN or clear, reminder stays; お弁当の日 not flagged; dormant overrides and not-confirmed / school-lunch records; needs-review list) | US-E3-05/AC2, E5 state-machine table (2 rows + timestamp note) | US-E3-05/AC6, AC7, AC8, AC9, AC10 | |
| H1 fix round, B10: `plannedAt` drives day-before suppression; a recipe change never deletes a pending reminder | US-E7-02/AC5, AC6, US-E5-03/AC2 | US-E7-02/AC7, AC8 | |
| H1 fix round, B14: diets on ingredient-level animal-origin tags, unknown origin → `diet-incomplete` | US-E1-04/AC1, AC4, E6 hard-filter note 2 | US-E6-02/AC7, AC8 | |
| H1 fix round, developer item: short-name snapshot on DayDecision | US-E5-01/AC4, US-E6-06/AC1 | | |
| H1 fix round, developer item: call-2 triggers listed as in BR-10 (429, 408/timeout, 5xx; 400/403/404 never retried) | Conventions | | |
| H1 fix round, non-blocking: onboarding = 3 input steps then the calendar (QA N1); banned phrases in `data/banned-phrases.json` (QA N4); out-of-month no-lunch entries (QA N5, FX-Q3); reload month confirmed (QA N7) | US-E1-01/AC1, US-E4-04/AC1, US-E5-07/AC2, US-E6-03/AC2, US-E2-05/AC4, US-E0-01/AC2 (comment only) | | |
| BR-14 tightened to https only (PLAN §7, H1) | US-E2-01/AC2 | | |
| OQ-16 overruled (PLAN §7): a dish and its name ingredients, and dictionary ancestor/descendant ids, collapse to one food (most specific id); D and L count foods | E4 counting paragraph and worked example | US-E4-01/AC15, AC16 | |
| OQ-16 collapse narrowed (not transitive) and collapse detail (PLAN §7): a dish collapses only with its `definingIngredientId` within one item; other named ingredients stay separate; a found ancestor folds into each found descendant, siblings separate; never chained | E4 counting paragraph and worked example (incl. しょうが焼き and 鶏肉/もも/むね), US-E4-01/AC15 (title: "defining ingredient"; outcome unchanged), US-E4-01/AC16 (example items without a dish; outcome unchanged) | US-E4-01/AC17, AC18 | |
| H1 closing rulings (PLAN §7): verdict precedence ingredient → dish → category (A61); O-3 defining-ingredient links never cross items; A57 removed date with override listed for review; S10 dormant not-confirmed / school-lunch records on removed dates, only not-confirmed listed; U5 CONFIRM_RECIPE on お弁当の日 replaces a dormant record; RU1 plannedAt cleared on leaving homemade-bento-planned; N3 = OQ-20 | E4 counting paragraph (verdict levels, O-3, worked example wording), US-E3-05/AC9 (Given made explicit; listing rule narrowed to overrides and homemade-bento-planned / not-confirmed records; outcome unchanged) | US-E4-01/AC19, AC20; US-E3-05/AC11, AC12; US-E5-06/AC4; US-E5-08/AC5; US-E7-05/AC4 | US-E4-01/AC15 (→ AC19), US-E3-05/AC10 (→ AC12) |

### M1 prep (2026-10-24: 73 / 287 → 73 / 310)
Items from PLAN §7 "H2 gate closed." and "M0 done.". No AC was renumbered; no test named a changed or retired AC at the time of the change.

| Why | Changed | Added | Retired |
|-----|---------|-------|---------|
| H2 design readings accepted: 「今月の献立がまだありません」 only while no menu was ever confirmed; 「行事」 is `originalText`, not a reason; an empty week drops 「ほかの日は…」 | US-E1-01/AC5 (Given made explicit + note), US-E3-06/AC1 (note only), US-E3-02/AC3 (example data: reason no-lunch + wording 「行事」; restore step written out), US-E9-01/AC3 (exact text) | US-E3-06/AC5 (which "no menu" wording) | |
| US-E10-03/AC1 vs `export-roundtrip`: `exportedAt` dropped, the date stays in the file name (data contract §4) | | US-E10-03/AC4 | US-E10-03/AC1 (→ AC4) |
| Strings in `design/copy.md` that carry a rule but had no AC | | US-E2-01/AC5 (target month, OQ-21); US-E2-04/AC8 (stop an import); US-E2-06/AC9 (retry countdown); US-E3-01/AC4 (warnings); US-E3-02/AC6 (no-lunch reason and wording, OQ-22); US-E3-03/AC4 (accept one field), AC5 (leave review, OQ-23); US-E3-05/AC13 (nothing to review); US-E3-06/AC6 (hide the next-month card, OQ-24), AC7 (prompt-day setting); US-E5-02/AC4 (month without a menu); US-E6-01/AC7 (quick reason); US-E6-05/AC3, AC4 (date picker); US-E7-03/AC4, AC5 (today card); US-E7-05/AC5 (several reminders); US-E9-01/AC4 (copy fails); US-E10-02/AC6 (save failure), AC7 (start over); US-E10-03/AC5, AC6 (Could: import errors) | |

### M2 prep (2026-10-25: 73 / 310 → 73 / 320)
Items from PLAN §7 "M1 merged locally" and "M1 QA" (`tests/reports/m1-qa-report.md`, D-M1-03, D-M1-04), and a readiness pass of E3-05/06, E4 and E5 against the data contract, ADR 004 and `src/domain/schema/`. No AC was renumbered. Changed ACs keep their outcome unless the row says otherwise; tests that name a retired AC move to its replacement.

| Why | Changed | Added | Retired |
|-----|---------|-------|---------|
| US-E2-05/AC5 "confirm or correct the date": only 「このままにする」 existed; date correction rules (free dates of the month only, a taken date is never overwritten, merged or swapped, the flag clears, the printed date stays visible) | US-E2-05/AC5 (Then names the two ways; outcome unchanged) | US-E2-05/AC7, AC8, AC9, AC10 | |
| Food-picker kind labels 食材 / 種類 / 料理 (identical labels such as 鶏肉 exist as an ingredient and a category) | | US-E1-02/AC8 | |
| D-M1-03: settings (export, delete all) unreachable before onboarding step 2. Ruling: settings reachable from every onboarding step | US-E10-03/AC2 (Given made explicit, the way to reach it named; outcome unchanged) | US-E1-01/AC6 | |
| D-M1-04: no v0 shape exists, so a v0 → v1 migration can't be exercised. Ruling: prove the path with the frozen v1 fixture and synthetic versions | | US-E10-02/AC8 | US-E10-02/AC2 (→ AC8) |
| Readiness: amb-curry has 3 candidates, not 2; non-food readings (amb-aji, amb-nashi) need a stored choice (data contract §3.3 `resolvedIds`) | US-E4-01/AC6 (all candidates + 「わからない」; outcome unchanged) | US-E4-01/AC21 | |
| Readiness: explanation labels hold ≤ 3 (contract §3.5) but the worked example named 4 | E4 worked example (explanation wording) | | |
| Readiness: an assessment is never stored (contract §3.5), only the override | US-E4-03/AC1 (Then reworded; outcome unchanged) | | |
| Readiness: BR-27 had no AC for overrides; the 「献立が変わりました。評価を見直してください。」 line had no end | | US-E4-03/AC6, AC7 | |
| Readiness: a kept refresh conflict must not come back after a later refresh that doesn't touch the date (contract §3.6, ADR 004 `needsAck`) | | US-E3-05/AC14 | |
| Readiness: event ids (contract §3.6) in the state-machine table; `decidedAt` and `history` as in the contract | E5 state-machine table (header with event ids; new paragraph for KEEP_PLAN and MARK_RESERVATION), E5 timestamp note | | |

Acceptance criteria are numbered per story: `Scenario: AC1 …` has the full ID `US-E1-01/AC1`. Tests name the full AC ID; milestone evidence counts an AC as verified only when an executed test that names it passed. Never renumber an AC once a test names it; retire it and add a new number.

Priority: **M**ust / **S**hould / **C**ould / **W**on't (MoSCoW) · Size: S / M / L · `(v1)` in a title means the story is out of the MVP and must not be built before the PO approves v1.

### Processed-food allergen rule (2026-11-01: 73 / 320 → 73 / 332 incl. 3 superseded; PO decision in PLAN §7, last row)
The PO's brand-label ruling above is implemented as AC9-AC14 etc.; 12 ACs added; the three superseded ACs stay numbered but are not counted as testable.

| Why | Changed | Added | Retired |
|-----|---------|-------|---------|
| PO: no brand-label research; generic rule for processed foods (exclude when an inherent allergen is registered, otherwise warn per processed ingredient, no warning without registered allergens, label data warn-only) | E6 preamble (ordering, F1', filter 3), US-E6-03/AC3, US-E6-05/AC1 | US-E6-02/AC9-AC14, US-E6-03/AC4-AC5, US-E6-04/AC4-AC6, US-E1-03/AC7 | US-E6-02/AC4, AC5, AC6 (kept in place, marked SUPERSEDED, not to be tested); E6 ordering tier "complete data first"; filter 3 (F4) |

## Conventions used in the ACs
- "Today" is the simulated or real date **in Asia/Tokyo** (BR-15). Dates are written `YYYY-MM-DD`; weekdays were checked against a calendar (2026-11-03 Tue 文化の日, 2026-11-23 Mon 勤労感謝の日, 2026-11-30 Mon, 2027-01-29 Fri, 2027-02-01 Mon, 2028-02-29 Tue).
- "The fixture menu" is the synthetic test menu `fixture-menu-2026-11` (November 2026, kindergarten style, see `docs/ba/data-contract.md` §5). Fixtures are synthetic and never presented as a real school's menu.
- "Sample child" is the debug profile: likes 鶏肉, たまご, とうもろこし, theme どうぶつ; dislikes ピーマン, なす, さかな (category); allergy status `has-known` with `alg-shrimp`; no diet restriction.
- Visible text in the ACs is the proposed Japanese copy; the Designer owns final copy, and tests should assert on the translation key or the role/label, not the literal string, unless the AC says "exact".
- Assessment states: `likely-enjoyable`, `mixed-uncertain`, `low-preference`, `not-assessed`, `no-school-lunch`. Decision states: `school-lunch-planned` (default), `homemade-bento-planned`, `not-confirmed`, `no-school-lunch`. These exact identifiers are used in code, tests and the store (data contract §3.5–§3.6; R-2: ADR 004's `school_lunch / bento_pending / bento_planned / no_school_lunch` are retired).
- A scenario title ending in `(BR-xx)` enforces that business rule; a test for the AC is also evidence for the BR.
- AI provider calls: "call 1" is the primary model; "call 2" is either one repair retry on the same model (malformed output) or one call to the fallback model (HTTP 429 rate limit, HTTP 408 or timeout, HTTP 5xx), never both; HTTP 400, 403 and 404 are never retried (BR-10, R-1). A parent tapping 「もう一度」 starts a new import action with a new budget of 2.

## Story index
Counts are active ACs (retired ACs are kept as comments and not counted). `(v1)` ACs are out of the MVP.

| Epic | Stories | # stories | # ACs (of which v1) | Scope |
|------|---------|-----------|---------------------|-------|
| E0 End-to-end journey | US-E0-01 | 1 | 3 | MVP |
| E1 Onboarding & profile | US-E1-01 … 06 | 6 | 30 | MVP |
| E2 Menu import & AI extraction | US-E2-01 … 08 | 8 | 46 | MVP |
| E3 Menu review, confirm & refresh | US-E3-01 … 06 | 6 | 37 (1) | MVP; US-E3-06/AC4 is v1 |
| E4 Preference assessment & overrides | US-E4-01 … 05 | 5 | 36 | MVP |
| E5 Calendar & family decisions | US-E5-01 … 08 | 8 | 33 | MVP |
| E6 Bento recommendations & recipes | US-E6-01 … 07 | 7 | 31 | MVP |
| E7 Reminders & today view | US-E7-01 … 08 | 8 | 33 (1) | MVP; US-E7-08 is v1 |
| E8 Localization & display | US-E8-01 … 05 | 5 | 15 | MVP |
| E9 Sharing | US-E9-01 … 02 | 2 | 6 | MVP |
| E10 Data | US-E10-01 … 05 | 5 | 18 | MVP |
| E11 Debug panel | US-E11-01 … 03 | 3 | 8 | MVP (development builds only) |
| E12 Android | US-E12-01 … 04 | 4 | 9 (8) | MVP: US-E12-01 only; US-E12-02 … 04 are v1 |
| E13 Accounts and sign-in | US-E13-01 … 07 | 7 | 39 (39 v1) | v1 slice 1 (web, Google only) |
| NF Non-functional | US-NF-01 … 05 | 5 | 15 | MVP |
| **Total** | | **80** | **359 (49 v1)** | |

---

## E0 End-to-end journey

### US-E0-01 Plan a homemade bento day from the school's PDF · M · L
As the planning parent I want to go from the kindergarten's monthly PDF to a confirmed bento day with a recipe and a reminder so that nobody in the family forgets it.

```gherkin
Scenario: AC1 Main journey (mocked AI, Playwright) (BR-02, BR-03, BR-06, BR-16)
  Given a fresh device with no stored data, language ja, today 2026-10-28 10:00 JST
  And the AI adapter is mocked to return the fixture extraction for "fixture-menu-2026-11.pdf"
  When the parent creates the sample child profile
  And uploads "fixture-menu-2026-11.pdf"
  And confirms the extracted menu on the review screen without edits
  Then the calendar shows November 2026
  And 2026-11-04 is highlighted as low-preference with an explanation that mentions 2 disliked ingredients
  And 2026-11-04 still shows the decision 「給食」 (school-lunch-planned)
  When the parent opens 2026-11-04 and chooses 「手作りお弁当にする」
  Then exactly 3 recipe suggestions are shown and none contains alg-shrimp
  When the parent selects the first suggestion and confirms 「この日に決定」
  Then the calendar cell for 2026-11-04 shows the confirmed-bento marker and the recipe's Japanese name
  And the upcoming-bento summary lists 「11月4日（水）」 with that recipe
  When the debug clock is set to 2026-11-03 17:30 JST and the day-before reminder is triggered
  Then an in-app reminder 「明日は手作りお弁当の日！レシピを確認しましょう。」 is shown
  When the parent taps the reminder
  Then the recipe detail of the selected recipe opens, with ingredients, steps and the allergy disclaimer

Scenario: AC2 The journey survives a reload (BR-22)
  Given the journey in AC1 has been completed
  When the page is reloaded
  Then the calendar opens directly (no onboarding)
  And 2026-11-04 still shows the confirmed recipe
  And the stored profile, confirmed menu and decision are unchanged
  # After the reload the calendar opens on the current Tokyo month (US-E1-01/AC2: October 2026 in this journey); the test navigates to November to check 2026-11-04. Confirmed at H1 (QA N7).

Scenario: AC3 The journey is completed within the time budget
  Given a first-time parent using the fixture menu with the mocked AI adapter
  When the journey in AC1 is scripted end to end
  Then the number of user actions (taps, typed fields, file picks) from first launch to the confirmed bento day is at most 25
  And no step requires navigating more than 2 levels away from the calendar
```

---

## E1 Onboarding & profile

### US-E1-01 First launch starts onboarding · M · S
As a new parent I want a short guided setup so that I reach a usable calendar quickly.

```gherkin
Scenario: AC1 No profile and no menu opens onboarding
  Given there is no stored profile and no stored menu
  When the app opens
  Then onboarding input step 1 of 3 「お子さまのこと」 is shown
  And a step indicator shows 3 input steps: profile, menu source, review
  And after the review step is confirmed (or the menu is skipped, AC5) the calendar opens; the calendar is not a numbered step

Scenario: AC2 Existing data skips onboarding
  Given a stored profile and at least one confirmed menu exist
  When the app opens
  Then the calendar for the current Tokyo month is shown
  And onboarding is not shown

Scenario: AC3 Profile exists but no menu resumes at the menu step
  Given a stored profile exists and no menu has been confirmed
  When the app opens
  Then onboarding resumes at step 2 「献立の取り込み」
  And the profile is not asked for again

Scenario: AC4 Onboarding can be left and resumed
  Given the parent has completed step 1 and is on step 2
  When the page is reloaded
  Then step 2 is shown and the step-1 answers are preserved

Scenario: AC5 Skipping the menu shows an empty calendar with a clear next step
  Given the parent is on step 2 and no menu has ever been confirmed on this device
  When the parent chooses 「あとで取り込む」
  Then the calendar is shown with no assessments
  And an empty-state card 「今月の献立がまだありません」 offers 「献立を取り込む」
  # M1 prep (H2 design reading accepted): the generic 「今月の…」 wording is used only while no menu has ever been confirmed; in every other case a month without a menu uses the month-named wording of US-E3-06/AC1 (rule: US-E3-06/AC5).

Scenario: AC6 Settings can be opened from every onboarding step (BR-22)
  Given onboarding is shown at input step 1, 2 or 3 (also on a fresh device with nothing stored)
  Then the top bar offers 「設定」 (the same entry as the calendar's app bar) next to the language toggle
  When the parent opens it
  Then the settings screen opens; its プロフィール and 献立 sections are shown only once a profile exists, every other section is shown
  And 「データを書き出す」 (US-E10-03) and 「すべてのデータを削除」 (US-E10-04) work as they do after onboarding
  When the parent goes back
  Then the same onboarding step is shown, and step-1 answers typed so far are still filled in (they are stored only by 「次へ」, as before)
  # M2 prep (D-M1-03 ruling): makes US-E10-03/AC2 reachable, and lets a parent whose profile was deleted (US-E1-06/AC3: menus and plans remain, onboarding step 1 opens) export or delete everything without creating a new profile first.
```

### US-E1-02 Create the child profile · M · M
As a parent I want to describe my child's tastes with simple controls so that the app can flag meals and suggest bentos.

```gherkin
Scenario: AC1 Minimal valid profile (BR-20)
  Given onboarding step 1 is shown
  When the parent selects age range 「年中（4〜5歳）」 and allergy status 「特になし」 and taps 「次へ」
  Then a profile is stored with nickname absent, ageRange "age-4-5", allergyStatus "none-known"
  And empty likes, dislikes, diet and theme lists

Scenario: AC2 Structured preferences use dictionary ids (BR-20)
  Given step 1 is shown
  When the parent picks likes 「鶏肉」「たまご」 and dislikes 「ピーマン」 and the category 「さかな」
  Then the stored profile has likedIds ["ing-chicken","ing-egg"] and dislikedIds ["ing-green-pepper","cat-fish"]

Scenario: AC3 The same id cannot be both liked and disliked (BR-20)
  Given 「ピーマン」 is in dislikes
  When the parent adds 「ピーマン」 to likes
  Then it is moved from dislikes to likes and a short notice says it was moved
  And the stored profile never contains the same id in both lists

Scenario: AC4 Age range is required (BR-20)
  Given no age range is selected
  When the parent taps 「次へ」
  Then the profile is not stored
  And the age-range control shows 「年齢を選んでください」 and receives focus

Scenario: AC5 Nickname length boundary (BR-20)
  Given the nickname field
  When the parent enters 20 characters
  Then it is accepted
  When the parent enters 21 characters
  Then input stops at 20 characters
  And a nickname of only spaces is stored as absent

Scenario: AC6 No unnecessary personal data is asked (BR-20)
  Given step 1 is shown
  Then there is no field for birthdate, gender, height, weight, photo, full name or school name

Scenario: AC7 Free-text note is optional and never used for filtering (BR-10, BR-20)
  Given the parent writes 「野菜は細かく切ると食べます」 in the note (max 200 characters)
  When the profile is stored
  Then the note is saved
  And the note is not used by assessment, ranking or filtering
  And the note is never sent to the AI adapter

Scenario: AC8 Each search result says what kind of food it is (BR-20)
  Given the likes, dislikes or 「その他の食材」 food picker
  When the parent searches 「とりにく」
  Then the results include 「鶏肉」 marked 「食材」 (ing-chicken) and 「鶏肉」 marked 「種類」 (cat-chicken), and a dish result such as 「鶏のから揚げ」 would be marked 「料理」
  And every result shows exactly one kind label: ingredient 「食材」, category 「種類」, dish 「料理」 (en: "Ingredient", "Food group", "Dish"), as text in the option row or as the heading of a group of results, never by colour or icon alone
  And the kind is part of each result's accessible name (ja 「鶏肉（種類）」, en "Chicken (Food group)")
  And a chosen chip carries its kind in its accessible name, and shows it as text whenever another chosen chip has the same label
  # M2 prep: the strings are fixed here; the Designer chooses between row labels and group headings (design/components.md §6.3 currently shows the kind on each row). Group order, if grouped: 食材, 料理, 種類.
```

### US-E1-03 Record allergies, or explicitly record that they are unknown · M · M
As a parent I want to state known allergies, or say I don't know yet, so that unsafe recipes are never suggested and the app is honest about what it can't check.

```gherkin
Scenario: AC1 Known allergies from the Japanese labelling list (BR-20)
  Given allergy status 「アレルギーあり」 is selected
  When the parent picks 「えび」 and 「卵」
  Then the profile stores allergyStatus "has-known" and knownAllergenIds ["alg-shrimp","alg-egg"]

Scenario: AC2 Allergy outside the labelling list (BR-06)
  Given allergy status 「アレルギーあり」
  When the parent searches 「トマト」 and adds it under 「その他の食材」
  Then the profile stores excludedIngredientIds ["ing-tomato"]
  And recipes containing ing-tomato are filtered exactly like allergens (BR-06)

Scenario: AC3 Status is required and has three explicit options (BR-20)
  Given step 1 is shown
  Then the allergy status offers exactly 「特になし」「アレルギーあり」「わからない・未確認」
  And no option is preselected
  When the parent taps 「次へ」 without choosing
  Then the profile is not stored and the control shows an error

Scenario: AC4 "Has known" with nothing selected is invalid (BR-20)
  Given allergy status 「アレルギーあり」 with no allergen and no other ingredient selected
  When the parent taps 「次へ」
  Then the profile is not stored
  And the message 「アレルギーの食材を1つ以上選んでください」 is shown

Scenario: AC5 Unknown status is shown wherever recipes are shown (BR-07)
  Given allergyStatus "unknown"
  When the parent opens recommendations or a recipe detail
  Then a banner 「アレルギー情報が未登録です。材料の表示を必ずご確認ください。」 is shown above the recipes

Scenario: AC6 Allergy screen never promises safety (BR-07)
  Given any allergy status
  When step 1 is shown
  Then the helper text states the app filters recipes by the registered information only
  And no text on the screen contains a safety guarantee (e.g. 「安全です」「アレルギー対応済み」)

Scenario: AC7 The registered list also drives the processed-food warning (BR-07, PO 2026-11-01)
  Given the parent registered knownAllergenIds ["alg-peanut"]
  Then recipes with processed ingredients show the packaging warning naming 落花生 (US-E6-02/AC11), and a child registered as 「特になし」 or 「わからない・未確認」 sees none; no new onboarding field or screen is needed
```

### US-E1-04 Diet preferences and themes · S · S
As a parent I want to set diet preferences and favourite themes so that suggestions fit our family.

```gherkin
Scenario: AC1 Diet preference is a hard filter (BR-06)
  Given the parent selects diet 「豚肉なし」 (no-pork)
  When recommendations are generated for any day
  Then no suggested recipe contains an ingredient whose animalOrigin includes "pork", "meat" (species not stated) or "gelatin", or an ingredient of unknown animal origin (data contract §3.8, OQ-11, B14)

Scenario: AC2 Several diet preferences combine (BR-06)
  Given diets ["no-pork","no-beef"]
  Then recipes containing pork or beef are both excluded

Scenario: AC3 Themes are optional and limited (BR-20)
  Given the theme picker 「すきなテーマ」 with 8 options
  When the parent selects 3 themes
  Then they are stored as themeIds
  When the parent tries to select a 4th theme
  Then the selection is refused with 「テーマは3つまで選べます」

Scenario: AC4 Vegetarian excludes gelatin and every meat and fish category (BR-06)
  Given diet ["vegetarian"]
  Then no suggested recipe contains an ingredient whose animalOrigin includes "meat", "pork", "beef", "chicken", "fish-seafood" or "gelatin" (hidden sources included: e.g. だし, コンソメ, ちくわ), or an ingredient of unknown animal origin (data contract §3.8, OQ-11, B14)
```

### US-E1-05 Edit the profile · M · S
As a parent I want to change my child's preferences later so that assessments follow their changing tastes.

```gherkin
Scenario: AC1 Editing re-runs the assessment but keeps decisions (BR-01, BR-02)
  Given the November menu is confirmed and 2026-11-04 is low-preference because of ピーマン and なす
  And 2026-11-04 has decision homemade-bento-planned
  When the parent removes なす and ピーマン from dislikes and saves
  Then the assessment of 2026-11-04 is recalculated (no longer low-preference)
  And the decision of 2026-11-04 is still homemade-bento-planned with the same recipe

Scenario: AC2 Adding an allergy invalidates a conflicting planned recipe without deleting it (BR-02, BR-06)
  Given 2026-11-04 is planned with a recipe that contains alg-egg
  When the parent adds 「卵」 to known allergies and saves
  Then 2026-11-04 keeps its decision and recipe (a profile edit changes 0 decisions)
  And the recipe is no longer offered in suggestions for any other day
  And the day shows a warning 「選んだレシピに登録したアレルゲン（卵）が含まれています」 with 「レシピを変更」
  And the day-before reminder for that day includes the same warning

Scenario: AC3 Cancel discards unsaved edits
  Given the parent changed likes on the edit screen
  When the parent taps 「キャンセル」
  Then the stored profile is unchanged
```

### US-E1-06 Delete the profile · M · S
As a parent I want to delete my child's profile so that no personal data stays on the device when I stop using it.

```gherkin
Scenario: AC1 Delete requires confirmation
  Given a stored profile
  When the parent taps 「プロフィールを削除」
  Then a confirmation dialog explains that menus and plans are kept and that manual assessment changes are removed, and offers 「削除する」 and 「キャンセル」

Scenario: AC2 Deleting the profile keeps menus and decisions but clears assessments (BR-02, BR-05)
  Given a profile, a confirmed menu and 2 homemade-bento decisions
  When the parent confirms deletion
  Then the profile is removed from storage
  And every assessment becomes not-assessed (manual overrides are removed with the profile: confirming the deletion is the parent's explicit clearing action)
  And the confirmed menu and both decisions remain

Scenario: AC3 After deletion the next launch asks for a profile
  Given the profile was deleted
  When the app opens
  Then onboarding step 1 is shown and the existing menu is not re-imported
```

---

## E2 Menu import & AI extraction

### US-E2-01 Import the menu from the school's public URL · M · M
As a parent I want to paste the kindergarten's PDF link so that I don't have to download and upload a file every month.

```gherkin
Scenario: AC1 Valid URL is fetched by the server adapter and extracted
  Given the adapter can retrieve "https://example-kinder.test/menu/2026-11.pdf" (mocked) as a valid PDF
  When the parent enters that URL and taps 「取り込む」
  Then a progress state 「献立を読み取っています…」 is shown
  And the review screen opens with the extracted November 2026 menu
  And the URL is stored as the menu source for reuse

Scenario: AC2 Only https URLs are accepted (BR-14)
  When the parent enters "http://example-kinder.test/menu/2026-11.pdf", "https://example-kinder.test:8443/menu.pdf", "ftp://example.test/menu.pdf", "javascript:alert(1)" or "menu.pdf"
  Then the import is not started
  And 「PDFのURL（https://…）を入力してください」 is shown

Scenario: AC3 URL length boundary (BR-14)
  When the parent enters a URL of 2048 characters
  Then it is accepted for import
  When the parent enters a URL of 2049 characters
  Then it is rejected with the URL error message

Scenario: AC4 Saved URL is offered for the next month
  Given a source URL was stored from the November import
  When the parent opens 「献立を取り込む」 again
  Then the URL field is prefilled with the stored URL and can be edited

Scenario: AC5 Target month: this month or next, preselected by date (OQ-21)
  Given today is 2026-11-19 JST and nextMonthPromptFromDay is 20
  When the import screen opens
  Then 「取り込む月」 offers exactly 2026年11月 and 2026年12月, with 2026年11月 selected
  Given today is 2026-11-20 JST
  When the import screen opens
  Then 2026年12月 is selected
  And the month the parent leaves selected is the import's targetMonth (also for upload and for 「手入力する」, US-E3-04/AC1)
```

### US-E2-02 Fall back to upload when the URL can't be retrieved · M · M
As a parent I want a clear way to upload the PDF myself when the link doesn't work so that I'm never stuck.

```gherkin
Scenario Outline: AC1 Retrieval failures offer upload and keep the URL
  Given the adapter returns <failure> for the entered URL
  When the import runs
  Then no AI extraction is requested
  And the message <message> (ja) / <message_en> (en) is shown with a 「PDFファイルを選ぶ」 button
  And the entered URL is kept in the field
  Examples:
    | failure                         | message                                                                          | message_en                                                                       |
    | network error / timeout (15 s)  | 「URLから取得できませんでした。PDFをアップロードしてください。」                     | "We couldn't get the file from this address. Please upload the PDF."             |
    | HTTP 404                        | 「ファイルが見つかりませんでした。URLを確かめるか、PDFをアップロードしてください。」     | "No file was found at this address. Check the address or upload the PDF."        |
    | HTTP 403 / blocked (CORS-type)  | 「このサイトからは自動で取得できません。PDFを保存してから、アップロードしてください。」   | "This site doesn't allow automatic downloads. Save the PDF, then upload it."     |
    | response is HTML, not a PDF     | 「PDFではないようです。献立表PDFのURLを入力するか、PDFをアップロードしてください。」    | "This doesn't look like a PDF. Enter the menu PDF's address or upload the PDF."  |

Scenario: AC2 Upload after a failed URL keeps the URL as source reference
  Given a URL import failed
  When the parent uploads the PDF file
  Then the extraction runs on the uploaded file
  And the stored source records both the filename and the URL the parent entered

Scenario: AC3 Oversized or disallowed targets are refused by the server fetch (BR-14)
  Given the entered URL serves a PDF larger than 10,485,760 bytes
  When the import runs
  Then the download is stopped at the limit, no AI extraction is requested, and 「ファイルが大きすぎます（10MBまで）」 is shown with the upload option
  Given the entered URL resolves to a loopback, private or link-local address, or needs more than 3 redirects
  When the import runs
  Then nothing is fetched from that address, no AI extraction is requested, and the HTTP 403 message of AC1 is shown
```

### US-E2-03 Upload a PDF file · M · S
As a parent I want to upload the PDF from my phone so that I can import a menu I received another way.

```gherkin
Scenario: AC1 Valid PDF upload (BR-14)
  When the parent selects "fixture-menu-2026-11.pdf" (application/pdf, starts with "%PDF-", 380 KB)
  Then the extraction runs and the review screen opens

Scenario: AC2 Non-PDF file is rejected before any AI call (BR-14)
  When the parent selects "menu.jpg" or a file renamed to ".pdf" whose first bytes are not "%PDF-"
  Then no AI extraction is requested
  And 「PDFファイルを選んでください」 is shown

Scenario: AC3 Size boundary (BR-14)
  When the parent selects a valid PDF of exactly 10 MB (10,485,760 bytes)
  Then it is accepted
  When the parent selects a valid PDF of 10,485,761 bytes
  Then it is rejected with 「ファイルが大きすぎます（10MBまで）」 and no AI call is made

Scenario: AC4 Empty or encrypted PDF (BR-14)
  When the parent selects a 0-byte file or a password-protected PDF
  Then no AI extraction is requested (0-byte) or the adapter returns "unreadable-pdf"
  And 「このPDFは読み取れませんでした」 is shown with the upload option
```

### US-E2-04 Extract the menu with AI into validated JSON · M · L
As a parent I want the app to read the Japanese menu for me so that I only have to check it, not type it.

```gherkin
Scenario: AC1 Fixture extraction maps every dish to the right date (BR-11)
  Given the mocked adapter returns the recorded extraction for fixture-menu-2026-11
  When the extraction is validated
  Then it passes the ExtractedMenu schema
  And every dish in the fixture's answer key appears under the same date, with no extra dishes

Scenario: AC2 Missing fields stay missing (no invention) (BR-11)
  Given the source PDF lists no ingredients for 2026-11-10
  Then the extracted day for 2026-11-10 has ingredients absent and ingredientsStatus "not-listed"
  And it does not contain ingredients guessed from the dish name

Scenario: AC3 Unlisted allergens are "not declared", never "none" (BR-08)
  Given the PDF declares allergens only for some days
  Then days without a declaration have allergenDeclaration.status "not-declared"
  And no day has an empty allergen list marked as "declared" unless the PDF explicitly says 「アレルゲンなし」 or equivalent

Scenario: AC4 Uncertain readings are flagged per field (BR-11)
  Given a dish name the model could only partly read
  Then that field carries verification "uncertain" with a reason
  And the review screen highlights it

Scenario: AC5 Days without school lunch are extracted (BR-11, BR-25)
  Given the PDF marks 2026-11-20 as 「お弁当の日」 and 2026-11-27 as 「午前保育（給食なし）」
  Then both dates are listed in noLunchDays with their reason ("bento-day", "no-lunch") and original text

Scenario: AC6 Source metadata is recorded (BR-10)
  Then the extraction has source.sha256 (64 hex chars) of the PDF bytes, source.fetchedAt (ISO 8601 with +09:00 or Z), source.model, and source.url or source.filename

Scenario: AC7 The AI request contains no child data (BR-10)
  Given a profile with nickname 「はなちゃん」 and known allergens
  When an extraction is requested
  Then the app's request to the adapter contains exactly: pdf (bytes or URL), targetMonth, promptVersion, schemaVersion
  And the adapter's request to the provider contains only the PDF bytes, the fixed extraction prompt for that promptVersion, the target month and the response schema
  And neither contains any of: the nickname, age range, likes, dislikes, allergy status, allergens, excluded ingredients, diet, themes, note, decisions or overrides

Scenario: AC8 Stopping a running import (BR-10, BR-12)
  Given an import for 2026-12 is in progress (「献立を読み取っています…」)
  When the parent taps 「中止する」
  Then the import screen is shown again with the entered URL or the chosen file kept
  And no extraction from this action is stored, also if the provider's answer arrives later, and no other stored data changes except aiUsage, which counts the provider calls already made
  And no further provider call is made for this action
```

### US-E2-05 Reject malformed or impossible AI output · M · M
As a parent I want broken extractions caught before they reach my calendar so that I never plan from wrong dates.

```gherkin
Scenario: AC1 Non-JSON or schema-invalid output gets one repair retry on the same model (BR-10, BR-11)
  Given the primary model returns text that is not valid JSON on call 1 and valid JSON on call 2
  When the extraction runs
  Then exactly 2 provider calls are made, both to the primary model, and call 2 includes the validation errors of call 1 (repair retry)
  And the review screen shows the result of call 2
  And the fallback model is not called

Scenario: AC2 Second failure stops without saving (BR-10, BR-11)
  Given the primary model returns schema-invalid JSON on call 1 and on the repair retry (call 2)
  When the extraction runs
  Then exactly 2 provider calls are made and no third call (no fallback model) follows
  And nothing is stored
  And 「献立を読み取れませんでした。時間をおいて再度お試しください。」 / "We couldn't read the menu. Please try again later." is shown with 「もう一度」, the upload option and 「手入力する」 (US-E3-04)

Scenario: AC3 Impossible dates are rejected (BR-11)
  Given the extraction for "2027-02" contains the date 2027-02-29
  Then validation fails with the rule "date-invalid" and the result is treated as malformed

Scenario: AC4 Dates outside the target month are rejected (BR-11)
  Given the target month is 2026-11 and the extraction contains 2026-12-01
  Then that day is removed, and the review screen lists it under 「対象月以外の日付（取り込みません）」
  And an out-of-month no-lunch entry (e.g. the January part of a printed 「冬休み 12月24日〜1月7日」 band in a December menu) is listed there in the same way and is not imported (outOfMonthDays holds both kinds, data contract §3.3)

Scenario: AC5 Weekday mismatch is flagged, not silently fixed (BR-11)
  Given the PDF printed 「4日（木）」 and the extraction says date 2026-11-04 with printedWeekday "木"
  Then the day is flagged verification "uncertain" with reason "weekday-mismatch" (2026-11-04 is a Wednesday)
  And on review the parent either keeps the date with 「このままにする」 (US-E3-03/AC4) or corrects it with 「日付を直す」 (AC7–AC10); the flag counts as unresolved until one of the two is done
  # The model's output is never rejected for this: the app sets the flag (data contract §6.1 `weekday-mismatch`).

Scenario: AC6 Duplicate dates are merged for review, not dropped (BR-11)
  Given the extraction lists 2026-11-05 twice
  Then the review screen shows one 2026-11-05 entry containing all items from both, flagged "uncertain" with reason "duplicate-date"

Scenario: AC7 Correct a flagged date by picking a date of the month (BR-11)
  Given the review for 2026-11 shows 2026-11-04 flagged "weekday-mismatch" (printed 「4日（木）」, printedWeekday "木")
  And on this review 2026-11-05 (Thu) shows 「献立に記載なし」
  When the parent taps 「日付を直す」 on 2026-11-04
  Then a choice of every date of November 2026 (2026-11-01 … 2026-11-30) opens, each shown with its weekday (「11月5日（木）」)
  And 2026-11-04 is marked as the current date and cannot be chosen
  And the dates whose weekday is the printed one, 木 (2026-11-05, 11-12, 11-19, 11-26), are marked 「曜日が一致」 in text; they are not preselected and other free dates can be chosen too
  When the parent chooses 2026-11-05
  Then the whole day (dishes, ingredients, allergen line, notes) is listed under 2026-11-05 and the rows stay in date order
  And 2026-11-04 shows 「献立に記載なし」
  And the moved day has verification "parent-edited" and no 「要確認」 tag, and 「確認が必要な項目」 is 1 lower
  And days without a weekday-mismatch flag, and no-lunch days, offer no 「日付を直す」
  # M2 prep. Past dates of the month are offered too: the review records what the PDF printed; BR-27 governs plans (OQ-28).

Scenario: AC8 A date that already has a menu cannot be chosen (BR-11, BR-13)
  Given 2026-11-04 is flagged "weekday-mismatch"
  And on this review 2026-11-12 (Thu) shows dishes and 2026-11-19 (Thu) is marked 給食なし
  When the parent opens 「日付を直す」 on 2026-11-04
  Then 2026-11-12 and 2026-11-19 are listed but cannot be chosen, each with the text 「ほかの献立があります」
  And no correction ever overwrites, merges or swaps two days: a forced attempt (e.g. a crafted event) leaves the review unchanged
  When the parent removes every dish of 2026-11-12 (or 2026-11-12 shows 「献立に記載なし」 for another reason)
  Then 2026-11-12 can be chosen
  Given every date of the month other than 2026-11-04 shows dishes or is marked 給食なし
  Then the choice says 「移せる日がありません」 and 「このままにする」 stays available on 2026-11-04

Scenario: AC9 The printed date stays visible and is kept on confirm (BR-11, BR-12)
  Given 2026-11-04 was corrected to 2026-11-05 (AC7)
  Then the 2026-11-05 row shows 「献立表の表記：4日（木）」 (the printed date text, unchanged)
  When the parent confirms the menu (US-E3-03/AC1)
  Then the ConfirmedMenu has a day 2026-11-05 with printedDateText 「4日（木）」, printedWeekday "木" and verification "parent-edited", and no entry for 2026-11-04
  And the calendar, the assessment and decisions use 2026-11-05

Scenario: AC10 A correction can be changed or abandoned (BR-11, BR-12)
  Given 2026-11-04 was corrected to 2026-11-05
  When the parent opens 「日付を直す」 on 2026-11-05 and chooses 2026-11-04
  Then the day is listed under 2026-11-04 again, still "parent-edited" (the flag does not come back)
  When the parent opens the choice and closes it without choosing
  Then nothing changes
  When the parent leaves the review with 「中断する」 (US-E3-03/AC5)
  Then the corrections are discarded with the other edits and the pending extraction still shows 2026-11-04 flagged
  And on a flagged day 「このままにする」 instead keeps the date and stores the day as "uncertain-accepted" (US-E3-03/AC4)
```

### US-E2-06 Rate limits and service outages · M · M
As a parent I want an honest message when the AI service is busy so that I know what to do.

```gherkin
  # AC1 retired at H1 (R-1): "rate limit is not retried, exactly 1 call". Replaced by AC5 and AC6: a rate limit on the primary model now switches once to the fallback model (BR-10).

Scenario: AC2 Service unavailable on both models (BR-10)
  Given the primary model fails with "unavailable" (timeout 60 s, HTTP 500, 503 or 504) on call 1
  And the fallback model fails with "unavailable" on call 2
  When the extraction runs
  Then exactly 2 provider calls are made: call 1 to the primary model, call 2 to the fallback model, and no third call
  And 「読み取りサービスに接続できませんでした。時間をおいて再度お試しください。登録済みの献立と予定はそのままです。」 / "We couldn't reach the reading service. Please try again later. Your saved menus and plans are unchanged." is shown with 「もう一度」, the upload option and 「手入力する」

Scenario: AC3 Existing data is untouched by any failure (BR-02, BR-13)
  Given a confirmed November menu and plans exist
  When a December import fails for any reason
  Then the November menu, assessments and decisions are byte-for-byte unchanged in storage

Scenario: AC4 Adapter not configured (BR-10)
  Given the server adapter has no API key configured
  When an extraction is requested
  Then the adapter responds "not-configured" without calling the provider
  And the app shows 「読み取り機能が設定されていません」 (in dev, with a hint to use the debug sample menu)

Scenario: AC5 Rate limit on the primary model switches once to the fallback model (BR-10)
  Given the primary model responds "rate-limited" (HTTP 429) on call 1
  And the fallback model returns valid JSON on call 2
  When the extraction runs
  Then exactly 2 provider calls are made: call 1 to the primary model, call 2 to the fallback model
  And the review screen shows the result, and its source.model is the fallback model's id

Scenario: AC6 Rate limit on both models stops and offers the other paths (BR-10)
  Given the primary model responds "rate-limited" on call 1 and the fallback model responds "rate-limited" with retryAfterSeconds 60 on call 2
  When the extraction runs
  Then exactly 2 provider calls are made and no third call
  And 「混み合っています。1分ほどしてからもう一度お試しください。」 / "The service is busy. Please try again in about a minute." is shown with 「もう一度」, the upload option and 「手入力する」
  And the 「もう一度」 button is disabled for 60 seconds (for retryAfterSeconds when given; enabled at once when it is absent)

Scenario: AC7 Non-transient provider errors are not retried (BR-10)
  Given the primary model responds with HTTP 400, 403 or 404 (e.g. model not found) on call 1
  When the extraction runs
  Then exactly 1 provider call is made (no repair retry, no fallback model)
  And the message of AC2 is shown, and the adapter logs the configured model id and the status code (server-side only)

Scenario: AC8 The proxy's own call cap answers without calling the provider (BR-10)
  Given the proxy's own extraction cap is reached (ADR 002: calls per hour / per day)
  When an extraction is requested
  Then 0 provider calls are made
  And the message of AC6 is shown

Scenario: AC9 The disabled retry shows a countdown (BR-10)
  Given the 「もう一度」 button is disabled for 60 seconds (AC6)
  Then its label reads 「もう一度（あと60秒）」 and counts down once per second to 「もう一度（あと1秒）」
  And after 60 seconds it reads 「もう一度」 and is enabled
  And the upload option and 「手入力する」 stay enabled during the countdown
  # The countdown is held in memory only; after a reload the import screen starts fresh, and the proxy's own cap (AC8) still protects the provider.
```

### US-E2-07 One AI extraction per month · M · S
As the product owner I want at most one AI call per monthly PDF so that the free tier is enough.

```gherkin
Scenario: AC1 Same PDF is not extracted twice (BR-10)
  Given an extraction for sha256 H was stored (confirmed or not)
  When the parent imports a PDF with the same sha256 H
  Then no AI call is made
  And the stored extraction is reopened on the review screen with 「同じファイルです」

Scenario: AC2 Retry budget per import (BR-10)
  Then a single import action makes at most 2 provider calls in total, whatever the failure: call 1 to the primary model, and at most one call 2 that is either a repair retry (malformed output) or the fallback model (rate limit, 5xx, timeout), never both
  And tapping 「もう一度」 starts a new import action with its own budget of 2

Scenario: AC3 Call counter is visible in the debug panel
  Given 3 provider calls were made this Tokyo month
  Then the debug panel shows "AI calls this month: 3" (store field aiUsage)

Scenario Outline: AC4 Every failure sequence stops after at most 2 calls (BR-10)
  Given call 1 (primary model) returns <first>
  And call 2, if made, returns <second>
  When the extraction runs
  Then <calls> provider calls are made, call 2 goes to <call2>
  And the outcome is <outcome>
  Examples:
    | first        | second       | calls | call2                         | outcome                                   |
    | valid        | —            | 1     | (none)                        | review screen                             |
    | malformed    | valid        | 2     | primary (repair retry)        | review screen                             |
    | malformed    | malformed    | 2     | primary (repair retry)        | US-E2-05/AC2 message                      |
    | malformed    | rate-limited | 2     | primary (repair retry)        | US-E2-06/AC6 message, no fallback call    |
    | malformed    | unavailable  | 2     | primary (repair retry)        | US-E2-06/AC2 message, no fallback call    |
    | rate-limited | valid        | 2     | fallback model                | review screen                             |
    | rate-limited | malformed    | 2     | fallback model                | US-E2-05/AC2 message, no repair retry     |
    | rate-limited | rate-limited | 2     | fallback model                | US-E2-06/AC6 message                      |
    | unavailable  | valid        | 2     | fallback model                | review screen                             |
    | unavailable  | unavailable  | 2     | fallback model                | US-E2-06/AC2 message                      |
    | HTTP 400/403/404 | —        | 1     | (none)                        | US-E2-06/AC7                              |
```

### US-E2-08 Privacy notice before the first extraction · M · S
As a parent I want to know what is sent to the AI provider before it happens so that I can decide.

```gherkin
Scenario: AC1 First extraction asks for consent (BR-10)
  Given no consent is stored
  When the parent starts the first import
  Then the consent notice (version 1, content in AC4) is shown before any provider call
  And the extraction starts only after 「同意して読み取る」

Scenario: AC2 Declining keeps manual paths open
  When the parent taps 「同意しない」
  Then no AI call is made
  And the parent can still load the sample menu (dev) or enter the menu manually on the review screen (US-E3-04)

Scenario: AC3 Consent is stored with its notice version
  Given the parent consented to notice version 1
  Then later imports don't ask again
  When the notice version changes to 2
  Then the notice is shown again before the next extraction

Scenario: AC4 The notice states the free-tier facts as decided (BR-10)
  # Facts: Gemini API Additional Terms, https://ai.google.dev/gemini-api/terms (effective 2026-03-23), summarised in docs/dev/research/ai-provider.md §A3, verified 2026-10-24. PO decision 2026-10-24: free tier, import used from Japan only, parents-only app.
  Given the consent notice is shown
  Then it states each of these facts, in ja and en:
    | # | fact |
    | 1 | Only the school's public lunch-menu PDF is sent, to Google's Gemini AI service, to turn it into a calendar |
    | 2 | Nothing about the child (name, age, allergies, likes, dislikes) and none of the family's plans is sent; they stay on this device |
    | 3 | BentoMinder uses Gemini's free tier: on the free tier Google may use the submitted content and the result to improve its products |
    | 4 | On the free tier human reviewers may read the submitted content and the result |
    | 5 | BentoMinder is for parents and guardians (the provider's terms require users to be 18 or older); children do not use it |
    | 6 | The menu import is for use in Japan |
  And it links to the provider's terms (https://ai.google.dev/gemini-api/terms)
  And it contains no claim that the data is not stored, not used, deleted or private
  # Proposed ja copy for the Designer (final wording in design/copy.md must keep facts 1–6):
  # 「献立表のPDFは、GoogleのAIサービス（Gemini）に送られ、カレンダー用のデータに変換されます。送るのは園が公開している献立表PDFだけです。お子さまの名前・年齢・アレルギー・好みや、ご家族の予定は送りません（この端末だけに保存されます）。BentoMinderはGeminiの無料枠を使っています。無料枠では、送った内容と結果がGoogleのサービス改善に使われ、担当者が内容を読む場合があります。このアプリは保護者向けです（Geminiの利用規約により18歳以上）。読み取り機能は日本国内でご利用ください。」
  # en: "The menu PDF is sent to Google's AI service (Gemini), which turns it into calendar data. We send only the public menu PDF from your school. Nothing about your child (name, age, allergies, likes) and none of your family's plans is sent; they stay on this device. BentoMinder uses Gemini's free tier. On the free tier, Google may use what is sent and the result to improve its products, and human reviewers may read it. This app is for parents (Gemini's terms require users to be 18 or older). Please use the menu import in Japan."
```

---

## E3 Menu review, confirm & refresh

### US-E3-01 Review the extracted menu · M · M
As a parent I want to see the extracted month next to its flags so that I can quickly check it.

```gherkin
Scenario: AC1 Review lists every date in the target month with its status (BR-11)
  Given the fixture extraction for 2026-11
  When the review screen opens
  Then every weekday (Mon–Fri) of November 2026 is listed in date order with weekday labels
  And each day shows its dishes, or 「給食なし」 with the reason, or 「献立に記載なし」 when the PDF has no entry for that weekday
  And weekend dates appear only if the PDF lists them

Scenario: AC2 Uncertain fields are highlighted and counted (BR-11)
  Given 3 fields have verification "uncertain"
  Then a summary 「確認が必要な項目：3件」 is shown at the top
  And each uncertain field is marked with an icon and a text label (not color only)
  And 「次の要確認へ」 moves focus to the next uncertain field

Scenario: AC3 The source PDF can be opened for comparison
  When the parent taps 「元のPDFを見る」
  Then the uploaded file (or the source URL) opens in a new view

Scenario Outline: AC4 Extraction warnings are shown on review and don't block confirming (BR-11)
  Given the extraction's warnings contain <warning>
  When the review screen opens
  Then the banner <text> is shown once above the days
  And 「この内容で確定」 stays available (subject only to US-E3-03/AC2 and US-E3-04/AC2)
  Examples:
    | warning             | text                                                                   |
    | month-mismatch      | 「献立表の月が、選んだ月（11月）と違うようです。」 (target month 2026-11) |
    | pages-unreadable    | 「読み取れないページがありました。抜けている日がないか確かめてください。」   |
    | layout-unrecognised | 「献立表の形式をうまく読み取れなかった可能性があります。」                 |
    | partial-extraction  | 「一部の日だけ読み取れました。足りない日は入力してください。」             |
```

### US-E3-02 Edit extracted items · M · M
As a parent I want to fix mistakes in the extraction so that the calendar is right.

```gherkin
Scenario: AC1 Edit a dish name
  When the parent changes 「さばのみそに」 to 「さばのみそ煮」 on 2026-11-05
  Then the field's verification becomes "parent-edited"

Scenario: AC2 Add and remove items
  When the parent adds the dish 「ポテトサラダ」 to 2026-11-12 and removes 「ゼリー」 from 2026-11-13
  Then the confirmed menu reflects both changes

Scenario: AC3 Mark a day as no school lunch, or restore it (BR-25)
  When the parent taps 「給食なしの日にする」 on 2026-11-27, chooses the reason 「給食なし（午前保育など）」 and enters the wording 「行事」
  Then 2026-11-27 moves to noLunchDays with reason "no-lunch" and originalText 「行事」, and its dishes are kept hidden but restorable until confirmation
  When the parent taps 「給食ありに戻す」 before confirming
  Then 2026-11-27 is a lunch day again with its dishes
  # M1 prep (H2 design reading accepted): 「行事」 is the printed wording (originalText), not a reason; the reasons are bento-day, no-lunch, closed and unknown (data contract §3.3). Same rule as before, example data corrected.

Scenario: AC4 Dish name boundary
  When the parent enters a dish name of 40 characters
  Then it is accepted
  When the parent enters 41 characters or only whitespace
  Then 「料理名は1〜40文字で入力してください」 is shown and confirm is disabled

Scenario: AC5 Item count boundary per day
  Given a day with 12 dishes
  Then 「料理を追加」 is disabled for that day with the hint 「1日12品まで」

Scenario: AC6 No-lunch reason and wording (BR-25, OQ-22)
  When the parent taps 「給食なしの日にする」 on a day
  Then exactly one reason is selected from 「お弁当の日（みんなお弁当）」 (bento-day), 「給食なし（午前保育など）」 (no-lunch), 「お休み（休園など）」 (closed) and 「その他」 (unknown), with 「給食なし（午前保育など）」 preselected
  And the wording field 「献立表での書き方」 is prefilled with the selected reason's label without its bracketed part (「お弁当の日」, 「給食なし」, 「お休み」 or 「その他」), follows the reason until the parent types in it, and can be edited
  When the wording has 60 characters
  Then it is accepted
  When the wording has 61 characters or only whitespace
  Then the field is marked as an error and 「この内容で確定」 is disabled with 「入力の誤りを直すと確定できます」
```

### US-E3-03 Confirm the menu · M · S
As a parent I want to confirm the menu in one tap so that the calendar uses it.

```gherkin
Scenario: AC1 Confirm stores a ConfirmedMenu and opens the calendar (BR-12)
  When the parent taps 「この内容で確定」
  Then a ConfirmedMenu for 2026-11 is stored with confirmedAt and a link to its extraction
  And assessments for November are calculated
  And the calendar shows November 2026

Scenario: AC2 Unresolved uncertain fields need an explicit acknowledgement (BR-04, BR-11)
  Given 2 fields are still "uncertain"
  When the parent taps 「この内容で確定」
  Then a dialog asks 「確認が必要な項目が2件あります。このまま確定しますか？」
  And on 「確定する」 those fields are stored as "uncertain-accepted"
  And items stored as "uncertain-accepted" are matched and assessed exactly like other items (BR-04 has no special case for them)
  And 「戻る」 in the dialog returns to the review with nothing stored

Scenario: AC3 Unconfirmed extractions are never used (BR-12)
  Given an extraction was reviewed but not confirmed and the app was closed
  When the app opens
  Then the calendar shows no assessments for that month
  And a card 「確認待ちの献立があります」 reopens the review

Scenario: AC4 Accept one uncertain field as it is (BR-11)
  Given 3 fields are "uncertain"
  When the parent taps 「このままにする」 on one of them
  Then that field's text is unchanged and it is counted as "uncertain-accepted" (stored so on confirm)
  And the summary reads 「確認が必要な項目：2件」
  When the parent then edits that field
  Then it becomes "parent-edited"

Scenario: AC5 Leaving the review asks first (BR-12, OQ-23)
  Given the review screen for 2026-11 is open and not confirmed
  When the parent leaves it (back, or another screen)
  Then a dialog asks 「確認を中断しますか？」 with 「中断する」 and 「確認を続ける」
  When the parent taps 「確認を続ける」
  Then the review stays open with every edit made so far
  When the parent taps 「中断する」
  Then nothing from this review is stored or used by the calendar (edits made since the review opened are discarded), and the card 「確認待ちの献立があります」 reopens the same extraction (AC3)
```

### US-E3-04 Enter or complete a menu manually · S · M
As a parent I want to type a menu myself when the PDF can't be read so that the app still works.

```gherkin
Scenario: AC1 Manual entry uses the same review screen
  Given extraction failed or consent was declined
  When the parent chooses 「手入力する」 and the month 2026-11
  Then an empty review screen with every Mon–Fri date of November 2026 is shown
  And entered dishes are stored with verification "parent-entered" and source.kind "manual"

Scenario: AC2 Empty manual menu cannot be confirmed
  Given no day has a dish and no day is marked no-lunch
  Then 「この内容で確定」 is disabled with 「少なくとも1日分を入力してください」
```

### US-E3-05 Replace (refresh) a month's menu and keep decisions · M · M
As a parent I want to re-import a corrected menu without losing my plans so that a school update doesn't cost me work.

```gherkin
Scenario: AC1 Refresh keeps every decision and override (BR-05, BR-13)
  Given November is confirmed with 2026-11-04 homemade-bento-planned (recipe R), 2026-11-11 not-confirmed and an override on 2026-11-18
  When the parent imports and confirms a new November extraction
  Then 2026-11-04 is still homemade-bento-planned with recipe R
  And 2026-11-11 is still not-confirmed
  And the override on 2026-11-18 is still applied
  And all other assessments are recalculated from the new menu

Scenario: AC2 A planned day that becomes a no-lunch day keeps its plan, flagged (BR-02, BR-13, BR-17)
  Given today is 2026-11-01 and 2026-11-04 (a school day) is homemade-bento-planned with recipe R and its day-before reminder is scheduled for 2026-11-03 17:30 JST
  When the refreshed menu marks 2026-11-04 as 「午前保育（給食なし）」 (no-lunch day, reason "no-lunch")
  Then 2026-11-04 keeps the stored decision homemade-bento-planned with recipe R
  And the day is flagged 「献立が変わりました」 and its sheet says 「献立の更新で、この日は給食なしになりました。予定を確認してください。」
  And the sheet offers only 「このまま」 (keep) and 「計画を取り消す」 (CLEAR_PLAN); 「レシピを変更」, 「給食に戻す」 and 「あとで決める」 are not offered
  And the day-before reminder for 2026-11-04 still exists until the parent clears the plan
  And the conflict appears in the upcoming summary until the parent taps 「このまま」 or clears the plan
  # A refresh that turns a planned school day into a "bento-day" no-lunch day (お弁当の日) is not a conflict: the plan is valid there (BR-25, US-E5-08) and the day is NOT flagged.

Scenario: AC3 Changed dishes on an overridden day are flagged (BR-05, BR-13)
  Given 2026-11-18 has a manual override
  When the refreshed menu changes the dishes of 2026-11-18
  Then the override is kept
  And the day shows 「献立が変わりました。評価を見直してください。」

Scenario: AC4 Replacing asks for confirmation and states that plans are kept (BR-13)
  Given a confirmed menu exists for 2026-11
  When the parent starts an import for 2026-11
  Then a dialog says the current menu will be replaced and that 「お弁当の予定は変更されません」

Scenario: AC5 Refresh is atomic (BR-12)
  Given a refresh is in progress
  When the new extraction fails validation or the parent cancels review
  Then the previous confirmed menu remains the active one

Scenario: AC6 A planned day whose date disappears from the menu keeps its plan, flagged (BR-02, BR-13, BR-17)
  Given 2026-11-25 is homemade-bento-planned with recipe R and its day-before reminder is scheduled
  When the refreshed November menu no longer lists 2026-11-25 at all (neither as a lunch day nor as a no-lunch day)
  Then 2026-11-25 keeps the stored decision homemade-bento-planned with recipe R
  And it is flagged 「献立が変わりました」 with 「献立の更新で、この日は献立表に載っていません。予定を確認してください。」
  And the sheet offers only 「このまま」 and 「計画を取り消す」, and the day-before reminder still exists until the plan is cleared
  # Stored not-confirmed or school-lunch-planned records on such a date are handled by AC12 (dormant), not by this conflict flow.

Scenario: AC7 Keep or clear a refresh conflict (BR-02, BR-17)
  Given 2026-11-04 is in the refresh conflict of AC2
  When the parent taps 「このまま」
  Then the parent event KEEP_PLAN is recorded: the stored state, its recipe, plannedAt and its day-before reminder are unchanged, acknowledgedMenuVersion is set to the current ConfirmedMenu.version, and the conflict leaves the upcoming summary
  And the day still carries the 「献立が変わりました」 marker and still offers only 「このまま」 and 「計画を取り消す」
  When the parent instead taps 「計画を取り消す」 and confirms the dialog
  Then no stored decision exists for 2026-11-04, the day displays no-school-lunch, and its day-before reminder is removed in the same action

Scenario: AC8 An override on a date that becomes a no-lunch day stays dormant (BR-05, BR-13)
  Given 2026-11-18 is a school day with an override low-preference
  When the refreshed menu marks 2026-11-18 as a no-lunch day (or no longer lists it)
  Then 2026-11-18 shows the assessment no-school-lunch (or, when unlisted, no assessment), without the 「手動で変更」 label
  And the override is still stored, unchanged (dormant)
  And 2026-11-18 is listed in the refresh's 「確認が必要な日」 list
  When a later refresh lists 2026-11-18 as a school day again
  Then the override is applied again and the day shows 「献立が変わりました。評価を見直してください。」

Scenario: AC9 The refresh lists the dates that need review (BR-13)
  Given November has 2026-11-04 homemade-bento-planned, 2026-11-11 not-confirmed, an override on 2026-11-18 and 2026-11-25 school-lunch-planned
  When the parent confirms a refresh whose changedDatesSincePrevious is ["2026-11-04","2026-11-18","2026-11-19"]
  Then a 「確認が必要な日」 list shows exactly 2026-11-04 and 2026-11-18 (changed dates that carry an override or a stored homemade-bento-planned or not-confirmed decision; school-lunch-planned records are never listed), each with a link to its day sheet
  And 2026-11-11, 2026-11-19 and 2026-11-25 are not listed
  And no stored decision or override is changed by the refresh

  # AC10 retired at the H1 closing rulings: it listed the dormant school-lunch-planned record in 「確認が必要な日」; ruling S10 lists only not-confirmed records (replaced by AC12).

Scenario: AC11 An override on a date that the refresh removes is listed for review (BR-05, BR-13)
  Given 2026-11-11 is a school day with an override likely-enjoyable
  When the refreshed November menu no longer lists 2026-11-11 at all
  Then 2026-11-11 shows no assessment, and the override is still stored, byte-for-byte unchanged (dormant)
  And 2026-11-11 is listed in the refresh's 「確認が必要な日」 list
  When a later refresh lists 2026-11-11 as a school day again
  Then the override is applied again

Scenario: AC12 Not-confirmed and school-lunch records on a no-lunch or removed date stay dormant (BR-02, BR-13)
  Given 2026-11-11 has the stored decision not-confirmed and 2026-11-12 has the stored decision school-lunch-planned with reservationDoneExternally true
  When the refreshed menu no longer lists 2026-11-11 and marks 2026-11-12 as a no-lunch day with reason "closed"
  Then both records are still stored, byte-for-byte unchanged (dormant)
  And neither day shows its stored decision (2026-11-11 shows nothing, 2026-11-12 shows no-school-lunch) and neither offers a decision action
  And 2026-11-11 (not-confirmed) is listed in the refresh's 「確認が必要な日」 list and 2026-11-12 (school-lunch-planned) is not
  When a later refresh lists both dates as school days again
  Then they display not-confirmed and school-lunch-planned (with the reservation record) again, unchanged

Scenario: AC13 A refresh with nothing to review says so (BR-13)
  Given November is confirmed and no date in the refresh's changedDatesSincePrevious carries an override or a stored homemade-bento-planned or not-confirmed decision
  When the parent confirms the refresh
  Then the 「確認が必要な日」 screen says 「確認が必要な日はありません」 and offers 「カレンダーへ」
  And no stored decision or override is changed

Scenario: AC14 A kept conflict stays kept until the menu changes that date again (BR-02, BR-13)
  Given 2026-11-04 is in the refresh conflict of AC2 (menu version 2) and the parent tapped 「このまま」 (acknowledgedMenuVersion 2)
  When the parent confirms a version 3 whose changedDatesSincePrevious does not contain 2026-11-04 (it is still a no-lunch day)
  Then 2026-11-04 is not in the upcoming summary, and still carries 「献立が変わりました」 with only 「このまま」 and 「計画を取り消す」
  When the parent confirms a version 4 whose changedDatesSincePrevious contains 2026-11-04 and the date is still a no-lunch day or unlisted
  Then the conflict is in the upcoming summary again until the parent taps 「このまま」 (acknowledgedMenuVersion 4) or clears the plan
  And no refresh changed the stored decision, its recipe, plannedAt or its day-before reminder
  # M2 prep: data contract §3.6 acknowledgedMenuVersion (as ADR 004 needsAck).
```

### US-E3-06 Detect that the menu is outdated or missing · M · S
As a parent I want to be told when the menu I'm looking at is out of date so that I don't plan on old information.

```gherkin
Scenario: AC1 Current month without a confirmed menu (BR-12)
  Given today is 2026-12-01 JST and only November is confirmed
  When the calendar opens on December 2026
  Then a card 「12月の献立がまだありません」 with 「献立を取り込む」 is shown
  And no December day shows an assessment
  # M1 prep: the month-named wording applies whenever the generic wording of US-E1-01/AC5 does not (rule: AC5).

Scenario: AC2 Next month reminder from the 20th
  Given today is 2026-11-20 JST and December is not confirmed
  Then the calendar shows 「来月（12月）の献立を取り込みましょう」 once per day until December is confirmed
  Given today is 2026-11-19
  Then that card is not shown
  # The start day is the setting nextMonthPromptFromDay (default 20, allowed 1–28; OQ-15). With the setting at 25, the card first shows on 2026-11-25.

Scenario: AC3 Viewing a past month is not "outdated"
  Given the parent navigates to October 2026 which has a confirmed menu
  Then no outdated warning is shown for October

Scenario: AC4 (v1) Changed source PDF is detected (BR-10)
  Given the stored source URL for November and a stored sha256 H1
  When the parent taps 「更新を確認」 and the adapter returns a PDF with sha256 H2 ≠ H1
  Then 「園の献立が更新されています」 is shown with 「取り込み直す」
  And no AI call is made until the parent taps it

Scenario: AC5 Which "no menu" wording is shown (BR-12)
  Given no menu has ever been confirmed on this device and today is 2026-11-10 JST
  When the calendar opens on November 2026
  Then the card reads 「今月の献立がまだありません」
  When the parent navigates to December 2026
  Then the card reads 「12月の献立がまだありません」
  Given only October 2026 has ever been confirmed and today is 2026-11-10 JST
  When the calendar opens on November 2026
  Then the card reads 「11月の献立がまだありません」
  And in every case the card offers 「献立を取り込む」 and no day of the shown month has an assessment

Scenario: AC6 The next-month card can be hidden for the rest of the day (OQ-24)
  Given today is 2026-11-20 JST, December is not confirmed and the card 「来月（12月）の献立を取り込みましょう」 is shown
  When the parent taps 「今日は表示しない」
  Then the card is not shown again on 2026-11-20, also after a reload
  And it is shown again on 2026-11-21 (Tokyo date), and on each later day until December is confirmed
  And hiding it changes no menu, assessment, decision or reminder

Scenario: AC7 The prompt day is a setting from 1 to 28 (OQ-15)
  Then the setting 「来月の献立のお知らせ」 offers 「毎月1日から」 … 「毎月28日から」, default 「毎月20日から」
  Given the parent chose 「毎月25日から」 and December is not confirmed
  Then the card is not shown on 2026-11-24 and is shown on 2026-11-25
```

---

## E4 Preference assessment & overrides

Assessment rule (BR-04, applied per school day of a confirmed menu, deterministic, no AI; snack items are never counted, OQ-07):
**Counting (H1 rulings B1, B2, B5, follow-ups and "OQ-16 overruled"; binding for the engine, ADR 004 and the QA oracle).**
1. *Found ids.* Collect every distinct dictionary id (`dish-` or `ing-`) that the matching rules of `domain-dictionary.md` §1 find in the day's non-snack items (dish names) and in its listed ingredients, plus the ids the parent chose for an ambiguous item on review (`resolvedIds`). An id found several times (in a dish name and again in the ingredient list, or in two dishes) is one found id. Seasonings (`cat-seasoning`) are left out unless the profile names their exact id (dictionary §1 rule 8).
2. *Foods* (OQ-16 overruled, narrowed; never transitive). Each found id is one food, except: (a) **dish + defining ingredient:** within one lunch item, a matched dish and its `definingIngredientId` (dictionary §5, e.g. 「さばのみそ煮」 → `dish-saba-miso` + `ing-mackerel`; 「コーンスープ」 → `dish-corn-soup` + `ing-corn`) are one food, represented by the dish; an id identical to that defining ingredient found elsewhere on the day (another item or the ingredient list) is counted through that dish, not as a food of its own. Other ingredients named in the dish stay separate foods (「豚のしょうが焼き」 = `dish-ginger-pork` with `ing-pork` + `ing-ginger` = 2 foods). A dish whose `definingIngredientId` is null is a food on its own, and its named ingredients are separate foods. (b) **ancestor/descendant:** a found ingredient id that is a dictionary ancestor of another found id (`ing-chicken` of `ing-chicken-thigh`) folds into **each** found descendant and is not a food of its own; siblings stay separate (鶏肉 + 鶏もも肉 + 鶏むね肉 = 2 foods). A defining-ingredient link never takes part in a cross-item collapse: an ingredient id that is collapsed with a dish in its item stays with that dish and does not fold into a descendant found in another item (「鶏のから揚げ」 in item 1 + 「鶏もも肉のてりやき」 in item 2 = 2 foods). Nothing else collapses: two different items never merge except through identical or ancestor/descendant ids, and grouping is never chained (two dishes with the same defining ingredient in different items stay 2 foods).
3. *Verdict per food* (precedence ruling, PLAN §7 "H1 closing rulings"). Check the profile level by level; the first level with a like or a dislike decides, and if that level has both, the dislike wins: level 1 the food's ingredient ids themselves (for a dish food: its defining ingredient; for a descendant food: the descendant and the ancestor folded into it); level 2 their dictionary parent ingredients, nearest first; level 3 the dish id (dish foods only); level 4 the categories of those ids, then the categories' ancestors, nearest first. So for a dish and its defining ingredient the order is ingredient → dish → category: a like on `ing-mackerel` with a dislike on `dish-saba-miso` makes 「さばのみそ煮」 liked. A food gets at most one verdict.
4. **`D` = number of disliked foods; `L` = number of liked foods.** So D counts different foods a parent would recognise, not profile entries and not ids: 「さけのしおやき」 and 「さばのみそ煮」 give D = 2 for a child who only dislikes `cat-fish`; 鶏肉 and 鶏もも肉 on one day are one food. The explanation names each counted food by the label of the id whose profile entry decided (さば, not さばのみそ煮, when the dislike is `cat-fish`).
5. **`U`** = (number of the day's non-snack items that have no dictionary match at all, or that contain at least one unresolved ambiguity) ÷ (number of the day's non-snack items). An item with a match *and* an unresolved ambiguity (「カレーうどん」: `ing-udon` found, 「カレー」 unresolved) counts towards U, and its foods still count towards D and L.

*Worked example* (sample child: dislikes `ing-green-pepper`, `ing-eggplant`, `cat-fish`; likes `ing-chicken`, `ing-egg`, `ing-corn`; plus, for this example only, likes `ing-salmon` and dislikes `ing-ginger`). A day lists the items 「ピーマンとなすのみそ炒め」「さけのしおやき」「さばのみそ煮」「豚のしょうが焼き」「とりももの照り焼き風」「鶏むね肉のソテー」「カレーうどん」「ごはん」 and the ingredients ピーマン, なす, 鮭, さば, 豚肉, しょうが, 鶏肉, みそ, うどん (kanji 鮭 resolves to `ing-salmon`; kana 「さけ」 in an ingredient list could trigger amb-sake). Found ids, seasonings (`ing-miso`, `ing-salt`) left out: `ing-green-pepper`, `ing-eggplant`, `dish-salted-salmon`, `ing-salmon`, `dish-saba-miso`, `ing-mackerel`, `dish-ginger-pork`, `ing-pork`, `ing-ginger`, `ing-chicken-thigh` (「とりもも」, amb-momo rule), `ing-chicken-breast`, `ing-chicken`, `ing-udon`, `ing-rice`. Foods (10): ピーマン; なす (each once although found in a dish name and in the ingredient list); {`dish-salted-salmon` + defining `ing-salmon`} (鮭 in the ingredient list counts through it); {`dish-saba-miso` + defining `ing-mackerel`}; {`dish-ginger-pork` + defining `ing-pork`}; しょうが (named in the dish but not its defining ingredient: a separate food); `ing-chicken-thigh` and `ing-chicken-breast` (siblings: 2 foods; the found ancestor 鶏肉 folds into each and is not a food of its own); うどん; ごはん. Verdicts: ピーマン, なす disliked (level 1); the salmon food liked (level 1 like on `ing-salmon` beats the level-3 dislike of `cat-fish`: B2); the mackerel food disliked (level 3, `cat-fish`); the ginger-pork food no verdict; しょうが disliked (level 1); もも and むね liked (level 1, the folded ancestor `ing-chicken` is a member of each); うどん, ごはん no verdict. So D = 4, L = 3. Items: 8 non-snack; only 「カレーうどん」 has an unresolved 「カレー」 (amb-curry) → U = 1/8 = 12.5%. Rule 3 applies: `low-preference`, explanation 「苦手な食材が4つ」 naming the first 3 in order of appearance (ピーマン, なす, さば) and saying there is one more (しょうが is counted, not named; data contract §3.5 `explanationParams`, M2 prep).

1. Day is a no-lunch day → `no-school-lunch`. 2. No profile, or profile with 0 likes and 0 dislikes → `not-assessed`. 3. `D ≥ 2` → `low-preference`. 4. `D = 1` and `L = 0` → `low-preference`. 5. `D = 1` and `L ≥ 1` → `mixed-uncertain`. 6. `D = 0`, `L ≥ 1` and `U ≤ 50%` → `likely-enjoyable`. 7. Otherwise → `mixed-uncertain`.

### US-E4-01 Assess each school day deterministically · M · M
As a parent I want the app to flag days my child probably won't enjoy so that I know where to look.

```gherkin
Scenario: AC1 Two disliked ingredients make a low-preference day (BR-04)
  Given the sample child (dislikes ing-green-pepper, ing-eggplant, cat-fish)
  And 2026-11-04 lists 「ピーマンとなすのみそ炒め」「ごはん」「すまし汁」
  When November is assessed
  Then 2026-11-04 is low-preference with D = 2

Scenario Outline: AC2 Rule table (BR-04)
  Given a profile with at least 1 like or dislike
  And a day whose items give D = <D>, L = <L>, U = <U>
  Then the assessment is <state>
  Examples:
    | D | L | U    | state             |
    | 2 | 3 | 0%   | low-preference    |
    | 1 | 0 | 0%   | low-preference    |
    | 1 | 1 | 0%   | mixed-uncertain   |
    | 0 | 1 | 50%  | likely-enjoyable  |
    | 0 | 1 | 51%  | mixed-uncertain   |
    | 0 | 0 | 0%   | mixed-uncertain   |

Scenario: AC3 Category dislikes match every ingredient in the category (BR-04)
  Given the child dislikes cat-fish
  When a day lists 「さけのしおやき」
  Then ing-salmon counts towards D through cat-fish

Scenario: AC4 Synonyms and scripts map to one id (BR-04)
  Given the child dislikes ing-carrot
  When days list 「にんじん」「人参」「ニンジン」 respectively
  Then each counts as ing-carrot, and each id is counted once per day however often it appears

Scenario: AC5 Longest match wins inside a dish name (BR-04)
  Given the child likes ing-corn
  When a day lists 「コーンスープ」
  Then dish-corn-soup and ing-corn are both matched (dish first, then the ingredient words in its name)
  And 「とうもろこし」 inside a longer unknown word still matches ing-corn

Scenario: AC6 Ambiguous words never decide the state (BR-04)
  Given a day lists only 「カレー」 with no other context
  Then 「カレー」 is treated as unresolved (amb-curry) and counts towards U
  And the review screen lets the parent choose 「カレーライス（料理）」, 「カレー粉（調味料）」, 「カレールウ（調味料）」 or 「わからない」, and a choice other than 「わからない」 is stored for that item (resolvedIds, data contract §3.3)
  # M2 prep: amb-curry has three candidates (dictionary §7); 「わからない」 leaves the item unresolved (AC13).

Scenario: AC7 Reproducible (BR-04, BR-15)
  Given the same profile and the same confirmed menu
  When the assessment runs 100 times, in ja and in en, with the device timezone set to Asia/Tokyo and to America/Los_Angeles
  Then all results are identical

Scenario: AC8 No lunch and not assessed (BR-04, BR-25)
  Given 2026-11-27 is a no-lunch day and the profile has no likes and no dislikes
  Then 2026-11-27 is no-school-lunch and every other November school day is not-assessed

Scenario: AC9 Snack items are shown but not assessed (BR-04, BR-25)
  Given the child dislikes ing-sweet-potato
  And a school day lists 「ごはん」「とりのからあげ」 and the snack (kind "snack") 「さつまいもスティック」
  Then ing-sweet-potato does not count towards D, and the snack does not count towards U
  And the day sheet still shows the snack under おやつ

Scenario: AC10 A date with only snack items is not a school day (BR-25)
  Given the confirmed menu lists 2026-11-14 (Sat) with only the snack 「せんべい」
  Then 2026-11-14 has no assessment and no decision, and its day sheet offers no decision actions

Scenario: AC11 D counts different foods found, not profile entries (BR-04)
  Given a profile whose only entry is the dislike cat-fish
  And a school day lists 「さけのしおやき」「さばのみそ煮」「ごはん」
  Then the found disliked ids are ing-salmon and ing-mackerel, so D = 2, L = 0
  And the day is low-preference with the explanation naming さけ and さば
  And the same profile on a day listing 「さけのしおやき」 twice and さけ in the ingredient list gives D = 1

Scenario: AC12 The most specific profile entry wins (BR-04)
  Given a profile that likes cat-fish and dislikes ing-mackerel
  And a school day lists 「さばのみそ煮」「さけのしおやき」「ごはん」
  Then ing-mackerel counts as disliked only (the id-level dislike beats the category-level like)
  And ing-salmon counts as liked (through cat-fish)
  And D = 1, L = 1, so the day is mixed-uncertain
  Given instead a profile that dislikes ing-chicken and likes cat-chicken
  Then 「鶏もも肉」 (ing-chicken-thigh) counts as disliked only (its dictionary parent ing-chicken is more specific than its category)

Scenario: AC13 An item with a match and an unresolved ambiguity counts towards U (BR-04)
  Given a profile that likes ing-udon
  And a school day lists only 「カレーうどん」 and 「ごはん」, with 「カレー」 left unresolved on review
  Then ing-udon counts towards L (L = 1) and 「カレーうどん」 counts towards U
  And U = 1/2 = 50%, so the day is likely-enjoyable
  Given the same day also lists a third item 「なぞのスープ」 that has no dictionary match
  Then U = 2/3 (67%) and the day is mixed-uncertain

Scenario: AC14 A like and a dislike at the same level: the dislike wins (BR-04)
  Given a profile that likes cat-beef and dislikes cat-pork
  And a school day lists 「ハンバーグ」 with the ingredient 合いびき肉 (ing-ground-mixed, categories cat-beef and cat-pork)
  Then ing-ground-mixed counts as disliked only, so it adds 1 to D and 0 to L

  # AC15 retired at the H1 closing rulings: its second case gave the dislike on dish-saba-miso and the like/dislike on ing-mackerel as a same-level tie; the precedence ingredient → dish → category now decides (replaced by AC19).

Scenario: AC16 An ingredient and its dictionary descendant are one food (BR-04)
  Given a profile whose only entry is the dislike ing-chicken
  And a school day lists 「鶏肉と野菜のスープ」 and 「鶏もも肉のソテー」 with the ingredients 鶏肉, 鶏もも肉
  Then ing-chicken and ing-chicken-thigh collapse to one food, represented by ing-chicken-thigh
  And D = 1, so the day is low-preference with 「苦手な食材が1つ」
  Given the same day also lists 「さけのしおやき」 and the profile also dislikes cat-fish
  Then D = 2 (the chicken food and the salmon food)

Scenario: AC17 Other ingredients named in a dish stay separate foods (BR-04)
  Given a profile that dislikes ing-pork and ing-ginger
  And a school day lists only 「豚のしょうが焼き」 and 「ごはん」
  Then dish-ginger-pork collapses with its defining ingredient ing-pork into one food, and ing-ginger is a second food
  And D = 2, so the day is low-preference with 「苦手な食材が2つ」

Scenario: AC18 Collapse is never chained across items; siblings stay separate (BR-04)
  Given a profile whose only entry is the dislike ing-chicken
  And a school day lists 「鶏の照り焼き」 and 「鶏のから揚げ」 (dish-teriyaki-chicken and dish-karaage, both with definingIngredientId ing-chicken)
  Then the two dishes are 2 foods (D = 2): different items are never merged through a shared defining ingredient
  Given instead a day lists 「鶏もも肉のソテー」「鶏むね肉のサラダ」 with the ingredients 鶏肉, 鶏もも肉, 鶏むね肉
  Then ing-chicken folds into each of ing-chicken-thigh and ing-chicken-breast, which stay 2 foods (D = 2)

Scenario: AC19 A dish and its defining ingredient are one food; ingredient → dish → category decides (BR-04)
  Given a profile that dislikes dish-saba-miso and ing-mackerel
  And a school day lists 「さばのみそ煮」「ごはん」 with the ingredients さば, みそ
  Then dish-saba-miso and ing-mackerel collapse to one food, represented by dish-saba-miso, and D = 1, L = 0 (low-preference, 1 food in the explanation)
  Given instead a profile that likes ing-mackerel and dislikes dish-saba-miso
  Then the food is liked (level 1 ingredient beats level 3 dish): D = 0, L = 1, U = 0%, so the day is likely-enjoyable
  Given instead a profile that likes dish-saba-miso and dislikes cat-fish
  Then the food is liked (level 3 dish beats level 4 category): D = 0, L = 1, likely-enjoyable

Scenario: AC20 A defining-ingredient link never crosses items (BR-04)
  Given a profile whose only entry is the dislike ing-chicken
  And a school day lists 「鶏のから揚げ」 and 「鶏もも肉のてりやき」 (no ingredient list)
  Then {dish-karaage + ing-chicken} is one food and ing-chicken-thigh is a second food: ing-chicken does not fold into the thigh across items
  And D = 2, so the day is low-preference

Scenario: AC21 An ambiguity choice on review is stored and used; a non-food reading adds nothing (BR-04)
  Given a profile that likes ing-peach and dislikes ing-horse-mackerel
  And the review of 2026-11 lists on 2026-11-16 the items 「もも」 and 「あじ」 (standalone forms the dictionary asks about: amb-momo, amb-aji)
  Then each item offers its group's candidates plus 「わからない」; amb-aji also offers its non-food reading 「味（食べものではない）」
  And neither chooser counts in 「確認が必要な項目」 and neither blocks 「この内容で確定」
  When the parent chooses 「もも（果物）」 (ing-peach) for 「もも」, leaves 「あじ」 unanswered and confirms
  Then the 「もも」 item is stored with resolvedIds ["ing-peach"], its text and verification unchanged, and ing-peach counts towards L
  And 「あじ」 has no resolvedIds and counts towards U, so D = 0, L = 1, U = 1/2 and the day is likely-enjoyable
  Given instead the parent chose the non-food reading for 「あじ」
  Then the 「あじ」 item is stored with resolvedIds [], adds no food and does not count towards U (U = 0/2)
  # M2 prep: data contract §3.3 resolvedIds and rule resolved-ids-candidates; option wording by the Designer (copy amb.*).
```

### US-E4-02 Explain every assessment · M · S
As a parent I want a short reason for each assessment so that I can judge it myself.

```gherkin
Scenario: AC1 Low-preference explanation names the count and the items
  Given 2026-11-04 is low-preference with disliked ピーマン and なす
  Then the explanation (ja) reads 「水曜日の給食には、苦手な食材が2つ含まれています（ピーマン、なす）。」
  And (en) "Wednesday's lunch includes 2 foods your child dislikes (green pepper, eggplant)."

Scenario: AC2 Every state has an explanation key
  Then each of the 5 states, and the override case, renders a non-empty explanation from an explanationKey plus params, in both languages

Scenario: AC3 Uncertain explanation says what is unknown
  Given a day is mixed-uncertain because U > 50%
  Then the explanation says 「わからない料理が多いため、判断できませんでした」 and lists up to 3 unmatched dish names

Scenario Outline: AC4 Each mixed-uncertain case has exactly one explanation key (BR-04)
  Given a school day with D = <D>, L = <L>, U = <U> and no override
  Then the state is mixed-uncertain and the explanationKey is <key>
  Examples:
    | D | L | U   | key                |
    | 1 | 1 | 0%  | assess.mixedOne     |
    | 1 | 2 | 80% | assess.mixedOne     |
    | 0 | 1 | 51% | assess.mixedUnknown |
    | 0 | 0 | 51% | assess.mixedUnknown |
    | 0 | 0 | 50% | assess.mixedNeutral |
    | 0 | 0 | 0%  | assess.mixedNeutral |
  # assess.mixedNeutral (ja proposal): 「好きな食材も苦手な食材も見つかりませんでした」; final copy by the Designer.
```

### US-E4-03 Override an assessment · M · S
As a parent I want to correct an assessment so that the calendar reflects what I know about my child.

```gherkin
Scenario: AC1 Set an override (BR-05)
  Given 2026-11-12 is likely-enjoyable
  When the parent sets 「苦手かも」 (low-preference) on 2026-11-12
  Then the day shows low-preference with the label 「手動で変更」
  And an AssessmentOverride { date 2026-11-12, state low-preference, menuVersionAtSet = the current menu version } is stored, and the day still shows the calculated state (likely-enjoyable) as the app's assessment under the label
  # M2 prep: an Assessment is computed, never stored; only the override is (data contract §3.5). Outcome unchanged.

Scenario: AC2 Override persists across reload, profile edits, reassessment and menu refresh (BR-05)
  Given an override on 2026-11-12
  When the page is reloaded, the profile is edited, and the November menu is refreshed
  Then the override is still applied after each step

Scenario: AC3 Clear the override (BR-05)
  When the parent chooses 「自動判定に戻す」
  Then the calculated state is shown again and the 「手動で変更」 label disappears

Scenario: AC4 Overrides are limited to school days (BR-05)
  Given 2026-11-27 is a no-lunch day
  Then no override control is offered for 2026-11-27

Scenario: AC5 An override never changes the decision (BR-01)
  Given 2026-11-12 has decision school-lunch-planned
  When the parent overrides it to low-preference
  Then the decision is still school-lunch-planned

Scenario: AC6 Past days offer no override change (BR-27)
  Given today is 2026-11-10 JST, 2026-11-09 has an override low-preference and 2026-11-06 has none
  When the parent opens 2026-11-09 and 2026-11-06
  Then both show their assessment (2026-11-09 with 「手動で変更」) but offer neither 「判定を変更」 nor 「自動判定に戻す」
  And a forced override write for either date is refused and storage is unchanged (override-no-past-write)
  And today 2026-11-10 can still be overridden

Scenario: AC7 Setting the override again after a menu change ends the "menu changed" line (BR-05)
  Given 2026-11-18 has an override set at menu version 1 and version 2 changed the dishes of 2026-11-18, so the day shows 「献立が変わりました。評価を見直してください。」 (US-E3-05/AC3)
  When the parent sets the override again, to the same or another state
  Then menuVersionAtSet is 2 and the line is no longer shown
  When instead the parent taps 「自動判定に戻す」
  Then the override is removed and the line is no longer shown
  And a later version 3 that does not change 2026-11-18 does not show the line either
  # M2 prep: data contract §3.5 menuVersionAtSet.
```

### US-E4-04 Neutral, non-judgmental wording · M · S
As a parent I want the app to describe preferences, not judge the school's food, so that it stays respectful.

```gherkin
Scenario: AC1 No judgmental words in assessment copy (BR-07)
  Then no assessment string in ja or en matches a phrase of `data/banned-phrases.json` (matching as in US-E6-03/AC2)
  And, for assessment strings only, none contains 「よくない」, "unsuitable" or "avoid" either (these words are allowed elsewhere, e.g. in food-handling notes)
  # QA: assert on the full string catalog, not only rendered screens

Scenario: AC2 State labels are about the child
  Then the state labels are 「たのしめそう」「どちらとも」「苦手かも」「未判定」「給食なし」 (Designer may refine wording, keeping the child-preference framing)
```

### US-E4-05 Show declared school-lunch allergens against known allergies · S · S
As a parent with an allergic child I want to see when the school menu declares one of my child's allergens so that I can check with the school.

```gherkin
Scenario: AC1 Declared allergen matches a known allergy (BR-08)
  Given the child has alg-egg and 2026-11-05 declares 卵 in its allergen declaration
  Then 2026-11-05 shows 「献立表に卵の表示があります。園にご確認ください。」

Scenario: AC2 No declaration is not "safe" (BR-07, BR-08)
  Given 2026-11-06 has allergenDeclaration.status "not-declared"
  Then the day shows 「アレルゲンの記載がありません」 for a child with known allergies
  And never 「アレルゲンなし」 or any safe/OK icon

Scenario: AC3 The allergen notice never changes the assessment or the decision (BR-01)
  Then the assessment state and decision of 2026-11-05 are the same as without the notice
```

---

## E5 Calendar & family decisions

Decision state machine (BR-02, BR-03, BR-25, BR-27; state names from data contract §3.6, R-2). A stored decision exists only after a parent action; without one, the displayed decision is derived: school day → `school-lunch-planned`, no-lunch day → `no-school-lunch`. Only dates from today (Asia/Tokyo) onward can change (BR-27).

| From \ parent action (event, data contract §3.6) | 「手作りお弁当にする」 + confirm recipe (`CONFIRM_RECIPE`) | 「あとで決める」 (`DEFER`) | 「給食に戻す」 (`SET_SCHOOL_LUNCH`) | change recipe (`CHANGE_RECIPE`) | 「計画を取り消す」 (`CLEAR_PLAN`) |
|---|---|---|---|---|---|
| school-lunch-planned | homemade-bento-planned | not-confirmed | — | — | — |
| not-confirmed | homemade-bento-planned | — | school-lunch-planned | — | — |
| homemade-bento-planned (school day) | — | not-confirmed | school-lunch-planned (after confirm dialog) | homemade-bento-planned (new recipeId) | — |
| no-school-lunch, reason `bento-day` | homemade-bento-planned (OQ-03) | — | — | — | — |
| homemade-bento-planned (`bento-day`) | — | — | — | homemade-bento-planned (new recipeId) | stored decision removed → displays no-school-lunch (after confirm dialog) |
| no-school-lunch, any other reason | — | — | — | — | — |
| homemade-bento-planned on a date that a refresh made a no-lunch day (reason ≠ `bento-day`) or removed from the menu (refresh conflict, BR-13) | — | — | — | — | stored decision removed (after confirm dialog); 「このまま」 = KEEP_PLAN sets `acknowledgedMenuVersion`, state unchanged (US-E3-05/AC2, AC6, AC7) |
| stored not-confirmed / school-lunch-planned on such a date | dormant: kept unchanged, displays no-school-lunch (or nothing when unlisted), no actions; shown again unchanged if the date becomes a school day (US-E3-05/AC12) | | | | |

Two more events: 「このまま」 on a refresh conflict is `KEEP_PLAN` (last rows); 「園で予約済み（自分で記録）」 is `MARK_RESERVATION`, allowed only where the displayed decision is school-lunch-planned on a school day from today on (it stores a school-lunch-planned record with the flag; any change to another state clears the flag, US-E5-07/AC3). Opening or closing the recommendation view and cancelling a dialog are not events and write nothing.

Timestamps: `decidedAt` is set by every accepted event that changes the state, the recipe or the reservation flag (not by `KEEP_PLAN`); `history` gets one entry, the state and recipe after the change, per state or recipe change (at most 5; data contract §3.6, M2 prep); `plannedAt` is set when the state becomes homemade-bento-planned from any other state (first confirm), kept unchanged by 「レシピを変更」 and by KEEP_PLAN, and removed when the state leaves homemade-bento-planned (data contract §3.6).

### US-E5-01 Calendar is the home screen · M · M
As a parent I want the month at a glance so that I see school lunch and bento days in seconds.

```gherkin
Scenario: AC1 Opens on the current Tokyo month (BR-15)
  Given it is 2026-11-15 00:30 JST and the device timezone is Europe/Paris (local date still 2026-11-14)
  When the app opens
  Then November 2026 is shown with 2026-11-15 marked as today

Scenario: AC2 Japanese calendar conventions, week starting Monday by default
  Given a fresh install (setting weekStartsOn absent, default "monday")
  Then the week starts on Monday and the weekday header is 月 火 水 木 金 土 日 (en: Mon … Sun)
  And the header shows 「2026年11月」
  And Saturday date numerals are blue and Sunday date numerals are red, on numerals and weekday headers only (when holidays are shown, US-E8-04, their numerals are red and carry the text 「祝」, not colour alone)
  And November 2026 starts with Sunday 2026-11-01 in the last column of the first row

Scenario: AC3 Each school day shows assessment and decision separately (BR-01, BR-03)
  Then every school day cell shows two distinct indicators: one for the assessment state and one for the decision
  And neither indicator relies on color alone (icon or text label)

Scenario: AC4 Suggested vs confirmed is unmistakable (BR-03)
  Given 2026-11-04 is low-preference with decision school-lunch-planned and 2026-11-11 is homemade-bento-planned
  Then 2026-11-04 shows the low-preference marker and 「給食」
  And 2026-11-11 shows the filled bento marker and the recipe's short name (shortNameJa in ja, shortNameEn in en; ≤ 8 characters each, data contract §3.7) in the cell, never a mechanically cut name, and the full name in the day sheet and in the cell's accessible name
  And if the planned recipe is missing from the library (US-E6-06), the cell shows the stored recipeShortNameSnapshot (ja or en by language) and the day sheet the stored recipeNameSnapshot
  And the two cells differ in icon shape and text, not only color

Scenario: AC5 Month navigation, including year boundaries
  Given November 2026 is shown
  When the parent taps 「次の月」 twice
  Then January 2027 is shown with header 「2027年1月」
  And 「今日」 returns to the current month

Scenario: AC6 Leap-year February
  When the parent navigates to February 2028
  Then 29 days are shown and 2028-02-29 is a Tuesday
  And February 2027 shows 28 days

Scenario: AC7 Upcoming summary
  Given today is 2026-11-02 JST
  Then above the calendar a summary lists up to the next 3 homemade-bento-planned days from today onward with weekday and recipe name, plus the count of low-preference days in the next 7 days that are still school-lunch-planned or not-confirmed
  And with none planned it says 「予定している手作りお弁当はありません」

Scenario: AC8 Week start can be set to Sunday
  Given the calendar starts weeks on Monday
  When the parent sets 設定 → 表示 → 「週のはじまり」 to 「日曜日」
  Then the weekday header is 日 月 火 水 木 金 土 and Sunday 2026-11-01 is in the first column
  And settings.weekStartsOn "sunday" is stored and still applied after a reload
  And assessments, decisions, the weekly reminder's covered days and the share text are unchanged by the setting
```

### US-E5-02 Day detail sheet · M · S
As a parent I want to tap a day and see everything about it so that I can decide.

```gherkin
Scenario: AC1 Day sheet content (BR-02)
  When the parent taps 2026-11-04
  Then a sheet shows 「11月4日（水）」, the menu items, the assessment with its explanation, the current decision, and only the actions allowed by the state machine

Scenario: AC2 Days outside the menu (BR-25)
  When the parent taps Saturday 2026-11-07 (not in the menu)
  Then the sheet says 「この日は献立に記載がありません」 and offers no decision actions

Scenario: AC3 Past days are read-only (BR-27)
  Given today is 2026-11-10 JST
  When the parent opens 2026-11-09
  Then the decision and recipe are shown but no action changes them

Scenario: AC4 A weekday in a month without a confirmed menu (BR-12)
  Given December 2026 has no confirmed menu
  When the parent taps Wednesday 2026-12-02
  Then the sheet says 「この月の献立はまだ取り込まれていません」
  And it shows no assessment and offers no decision action
```

### US-E5-03 Choose homemade bento and confirm a recipe · M · M
As a parent I want to mark a day as homemade bento by choosing a recipe so that the plan is concrete.

```gherkin
Scenario: AC1 Choosing bento opens recommendations without changing the decision yet (BR-02)
  Given 2026-11-04 is school-lunch-planned
  When the parent taps 「手作りお弁当にする」
  Then the recommendation view for 2026-11-04 opens
  And the stored decision is still school-lunch-planned

Scenario: AC2 Confirming a recipe plans the day (BR-03)
  When the parent selects a recipe and taps 「この日に決定」
  Then the stored decision for 2026-11-04 is homemade-bento-planned with that recipeId, decidedAt, plannedAt (= decidedAt of this first confirm), recipeNameSnapshot and recipeShortNameSnapshot (the recipe's shortNameJa / shortNameEn)
  And the calendar cell shows the recipe name

Scenario: AC3 Leaving without confirming changes nothing (BR-02)
  Given the recommendation view for 2026-11-04 is open
  When the parent closes it or presses back
  Then the decision is unchanged

Scenario: AC4 Today can still be planned, past days cannot (BR-15, BR-27)
  Given today is 2026-11-04 08:00 JST
  Then 2026-11-04 can be planned and 2026-11-03 cannot
```

### US-E5-04 Low preference never creates a plan · M · S
As a parent I want the app to only suggest, never decide, so that the plan is always ours.

```gherkin
Scenario: AC1 Import, assessment and time never change a decision (BR-02)
  Given November is confirmed with 5 low-preference days and no stored decisions
  When assessments are calculated, the profile is edited, the menu is refreshed, reminders fire and the clock advances 30 days
  Then no stored decision exists for any day
  And all 5 days display school-lunch-planned

Scenario: AC2 Decision counts after import (BR-02)
  Then immediately after confirming a menu, the number of homemade-bento-planned days is 0
```

### US-E5-05 Mark a day "not confirmed" · M · S
As a parent I want to mark a day as "to decide later" so that it stays on my mind without being a plan.

```gherkin
Scenario: AC1 Set and display not-confirmed (BR-02)
  When the parent taps 「あとで決める」 on 2026-11-11
  Then the decision is not-confirmed and the cell shows 「未定」 with an outline (not filled) bento marker

Scenario: AC2 Not-confirmed days are surfaced (BR-16)
  Then not-confirmed days within the next 7 days appear in the upcoming summary and in the weekly reminder with 「計画する」

Scenario: AC3 Not-confirmed is never treated as planned (BR-16)
  Then no day-before reminder is scheduled for a not-confirmed day
```

### US-E5-06 Change or cancel a bento plan · M · S
As a parent I want to change the recipe or go back to school lunch so that plans can follow real life.

```gherkin
Scenario: AC1 Change recipe (BR-17)
  Given 2026-11-04 is planned with recipe R1
  When the parent taps 「レシピを変更」 and confirms R2
  Then the decision is homemade-bento-planned with R2, and the day-before reminder text refers to R2

Scenario: AC2 Cancel the plan (BR-17)
  When the parent taps 「給食に戻す」 and confirms
  Then the decision is school-lunch-planned, the recipe link is removed, and the day-before reminder for 2026-11-04 is cancelled

Scenario: AC3 Cancel asks first (BR-02)
  When the parent taps 「給食に戻す」
  Then a dialog asks 「11月4日の手作りお弁当の予定を取り消しますか？」 and nothing changes on 「キャンセル」

Scenario: AC4 plannedAt is cleared when the day leaves homemade-bento-planned (BR-17)
  Given 2026-11-04 was planned at 2026-11-01T10:00+09:00 (plannedAt 2026-11-01T10:00+09:00)
  When at 2026-11-02T09:00+09:00 the parent sets it to 「あとで決める」 (or 「給食に戻す」 and confirms)
  Then the stored decision has no plannedAt
  When at 2026-11-02T20:00+09:00 the parent confirms a recipe for 2026-11-04 again
  Then plannedAt is 2026-11-02T20:00+09:00 (a new first confirm), and a later 「レシピを変更」 keeps that value
```

### US-E5-07 Never claim a school reservation · M · S
As a parent I want the app to be clear that school lunch is reserved outside it so that I don't miss the real reservation.

```gherkin
Scenario: AC1 School lunch says reservation is external (BR-19)
  Then wherever school-lunch-planned is shown in a day sheet or the today view, a note says 「給食の予約は園の方法で行ってください（このアプリでは予約されません）」

Scenario: AC2 No copy claims a booking (BR-19)
  Then no catalog string in ja or en matches a reservation phrase of `data/banned-phrases.json` (e.g. 「予約しました」「予約完了」, "reserved", "booked"; matching as in US-E6-03/AC2)
  # Exception: the catalog key of the parent's own checkbox label in AC3 (「園で予約済み（自分で記録）」 / its en label) is exempt from the en phrase "reserved"; the exemption is listed by key in the test, not in the data file.

Scenario: AC3 (Should, OQ-05) Optional "reserved externally" record (BR-19)
  Given today 2026-11-12 is school-lunch-planned
  When the parent ticks 「園で予約済み（自分で記録）」
  Then reservationDoneExternally = true is stored for 2026-11-12 and shown as the parent's own record
  And changing the decision to homemade-bento-planned clears the flag
```

### US-E5-08 Plan a bento on the school's 「お弁当の日」 · S · S
As a parent I want to pick a recipe for the days everyone must bring a bento so that the app helps on those days too.

```gherkin
Scenario: AC1 Bento day allows a plan (BR-03, BR-25)
  Given 2026-11-20 is a no-lunch day with reason "bento-day"
  Then the sheet offers 「お弁当を計画する」 and confirming a recipe sets homemade-bento-planned

Scenario: AC2 Other no-lunch days allow no plan (BR-25)
  Given 2026-11-27 is a no-lunch day with reason "no-lunch" (e.g. 午前保育)
  Then the sheet shows 「給食なし」 with the original text and no planning action

Scenario: AC3 Cancelling a bento-day plan removes the stored decision (BR-02, BR-17)
  Given 2026-11-20 (reason "bento-day") is homemade-bento-planned
  When the parent taps 「計画を取り消す」 and confirms the dialog
  Then no stored decision exists for 2026-11-20 and it displays no-school-lunch with 「お弁当の日」
  And its day-before reminder is removed in the same action
  And 「給食に戻す」 and 「あとで決める」 are never offered on a bento day

Scenario: AC4 Bento days get the day-before reminder when planned (BR-16)
  Given 2026-11-20 (reason "bento-day") is homemade-bento-planned
  Then a day-before reminder for 2026-11-20 is due at 2026-11-19 17:30 JST
  Given 2026-11-20 is not planned
  Then no day-before reminder exists for 2026-11-20

Scenario: AC5 Planning an お弁当の日 replaces a dormant record (BR-02, BR-13)
  Given 2026-11-13 had the stored decision not-confirmed and a refresh made it a no-lunch day with reason "bento-day", so that record is dormant (US-E3-05/AC12)
  When the parent opens 2026-11-13, taps 「お弁当を計画する」 and confirms recipe R (CONFIRM_RECIPE)
  Then the stored decision for 2026-11-13 is homemade-bento-planned with R and a new plannedAt, the dormant not-confirmed record is replaced (its state is kept only as an entry in history)
  And if a later refresh makes 2026-11-13 a school day again, it displays homemade-bento-planned with R, not not-confirmed
```

---

## E6 Bento recommendations & recipes

Ranking (BR-09): candidates = library recipes passing every hard filter (BR-06, incl. OQ-13 and R-3 below). Score = `+2` per distinct liked id in the recipe (the recipe's distinct ingredient ids, each given one verdict by the most-specific-entry rule of E4, dislike winning a same-level tie: the same counting as D and L, H1 rulings B1/B2), `+1` if a recipe theme is one of the child's themes, `−3` per distinct disliked id, `−2` if the same recipe is planned on any other date within 14 days before or after the target date, `−1` if `minutes > 20`. Order: score desc, then minutes asc, then id asc (the earlier "complete allergen data first" tier of R-3 is retired by the 2026-11-01 processed-food ruling, below). Show the top 3.

Hard filters (BR-06, OQ-13; R-3 retired for allergens 2026-11-01), applied before scoring:
1. Exclude a recipe if any id in `allergenIds` is in the child's `knownAllergenIds`. **(F1'', 2026-11-01: also exclude when an ingredient carries an allergen group, dictionary §11.5, and the child has any member of it; US-E6-02/AC15.)** **(F1', 2026-11-01)** For a processed ingredient (dictionary `info = varies`) only its dictionary `inherentAllergenIds` count: `allergenIds` is the union of the ingredients' ids and the validator makes each ingredient's ids include the inherent ones (`recipe-ingredient-inherent-allergen`); the library has no label-derived extras in a processed ingredient's `allergenIds` (checked 2026-11-01). `mayContainAllergenIds` / `possibleAllergenIds` (brand-label data) no longer exclude: they are reference data (US-E6-02/AC13).
2. Exclude a recipe if any ingredient, or its dictionary parent or category, is in `excludedIngredientIds`, or if it violates a selected diet. Diets work on ingredient-level animal-origin tags (`animalOrigin`, dictionary §4, incl. hidden sources such as だし, コンソメ, カレールウ, ウインナー): a recipe violates a diet when any ingredient carries a tag the diet forbids, and a recipe with an ingredient of unknown animal origin is excluded for every selected diet with reason `diet-incomplete` (data contract §3.8, H1 ruling B14).
3. ~~Recipes with incomplete allergen data (`allergenDataComplete = false`): excluded when `knownAllergenIds` is non-empty, else flagged and ranked last.~~ **Retired 2026-11-01** (PO: processed foods follow the generic rule; F4 no longer exists). No recipe is excluded or ranked down because `allergenDataComplete` is false; the field stays as derived data only.

### US-E6-01 Three ranked suggestions · M · M
As a parent I want three good options so that choosing is quick.

```gherkin
Scenario: AC1 Exactly three suggestions, deterministic (BR-09)
  Given the fixture recipe library (20 recipes) and the sample child
  When recommendations are requested for 2026-11-04
  Then exactly 3 recipes are shown in the order given by the QA oracle for BR-09
  And repeating the request returns the same 3 in the same order

Scenario: AC2 Each card says why
  Then each card shows the Japanese name, minutes, up to 2 reasons (e.g. 「好きな鶏肉入り」「どうぶつテーマ」) and allergen badges

Scenario: AC3 Variety penalty (BR-09)
  Given recipe R is planned on 2026-11-11
  When recommendations are requested for 2026-11-18 (7 days later)
  Then R's score includes −2 and R ranks below an otherwise equal recipe

Scenario: AC4 Fewer than three pass the filters (BR-09)
  Given the filters leave exactly 2 recipes
  Then 2 are shown with 「条件に合うレシピは2件です」

Scenario: AC5 None pass the filters (empty state) (BR-02, BR-06)
  Given the filters leave 0 recipes
  Then 「条件に合うレシピがありません」 is shown with links to 「プロフィールを見直す」 and 「レシピ一覧を見る」
  And the decision is unchanged

Scenario: AC6 See more (BR-06, BR-09)
  When the parent taps 「ほかのレシピ」
  Then the full filtered, ranked list is shown, still without any filtered-out recipe

Scenario: AC7 The "quick" reason follows the 20-minute rule (BR-09)
  Given recipe A takes 20 minutes and recipe B takes 21 minutes
  Then A qualifies for the reason 「20分以内でできます」
  And B's card never shows it
```

### US-E6-02 Hard filters for allergens and diet · M · M
As a parent of a child with allergies I want recipes with known allergens never to be suggested so that I can't pick one by mistake.

```gherkin
Scenario: AC1 Known allergen excludes a recipe from suggestions (BR-06)
  Given the child has alg-egg
  Then no recipe whose allergenIds or mayContainAllergenIds include alg-egg appears in suggestions or 「ほかのレシピ」
  And in 「レシピ一覧」 such a recipe shows 「卵を含む」 and its 「この日に決定」 is disabled

Scenario: AC2 Excluded ingredient behaves like an allergen, including child ids (BR-06)
  Given excludedIngredientIds ["ing-tomato"]
  Then no suggested recipe has an ingredient ing-tomato or a dictionary child of it (ミニトマト → ing-cherry-tomato, parent ing-tomato)

Scenario: AC3 Property over the whole library (BR-06)
  For every single allergen id of the current scheme, every pair of them, and every diet preference
  Then no suggested recipe violates the filter (property test over the real library)

Scenario: AC4 [SUPERSEDED 2026-11-01 by AC9-AC13; do not test] Recipe with product-dependent allergen information (BR-06, BR-07)
  Given a recipe has an ingredient with allergenInfo "varies-by-product" (e.g. ウインナー)
  Then its card and detail show 「市販品は製品によりアレルゲンが異なります。表示を確認してください。」
  And if any of that ingredient's possibleAllergenIds is a known allergen of the child, the recipe is excluded

Scenario: AC5 [SUPERSEDED 2026-11-01 by AC12 and the ordering line of the E6 preamble; do not test] Incomplete allergen data, child without known allergens: shown, flagged, ranked last (BR-07, BR-09)
  Given the fixture library contains recipe X with allergenDataComplete false and the highest BR-09 score
  And the child's knownAllergenIds is empty (allergy status "none-known" or "unknown")
  When recommendations are requested
  Then X is not excluded, and it is ranked after every recipe with complete allergen data, whatever its score
  And wherever X is shown (card, 「ほかのレシピ」, recipe detail, library) it carries 「一部の材料のアレルゲン情報がわかりません。食品の表示を確認してください。」 / "Allergen information is missing for some ingredients. Check the food labels."
  And X is shown among the 3 suggestions only when fewer than 3 recipes with complete data pass the filters
  And X can be planned

Scenario: AC6 [SUPERSEDED 2026-11-01 by AC9 and AC10; do not test] Incomplete allergen data, child with known allergens: excluded (BR-06)
  Given recipe X has allergenDataComplete false and none of its known allergenIds or mayContainAllergenIds matches the child
  And the child has knownAllergenIds ["alg-shrimp"]
  When recommendations are requested
  Then X appears neither in the 3 suggestions nor in 「ほかのレシピ」
  And in 「レシピ一覧」 X is listed last, greyed, with 「アレルゲン情報が不完全なため、登録したアレルギーと照合できません」 / "Allergen information is incomplete, so it can't be checked against the registered allergies", and its 「この日に決定」 is disabled

Scenario: AC7 Hidden animal-origin ingredients count for diets (BR-06)
  Given the fixture library has recipe Y whose only animal-origin ingredient is だし (ing-dashi, animalOrigin ["fish-seafood"] confirmed by its cited source) and recipe Z whose only animal-origin ingredient is コンソメ (ing-consomme, animalOrigin ["beef","chicken","pork"] confirmed by its cited source)
  When the child's diet is ["vegetarian"]
  Then neither Y nor Z is suggested or plannable
  When the child's diet is ["no-seafood"]
  Then Y is excluded and Z is not excluded for diet reasons
  When the child's diet is ["no-pork"]
  Then Z is excluded and Y is not excluded for diet reasons

Scenario: AC8 Unknown animal origin excludes a recipe for any selected diet (BR-06)
  Given recipe W has an ingredient whose animal origin is unknown (dictionary animalOrigin "?" not resolved by a cited source, so the recipe has dietDataComplete false) and no other diet conflict
  When the child has any diet selected (e.g. ["no-beef"])
  Then W appears neither in the 3 suggestions nor in 「ほかのレシピ」, and in 「レシピ一覧」 it is greyed with reason diet-incomplete 「原材料の由来がわからないため、食事の制限と照合できません」 / "The origin of some ingredients is unknown, so it can't be checked against the diet", and its 「この日に決定」 is disabled
  When the child has no diet selected
  Then W is not excluded for diet reasons

Scenario: AC9 A registered allergen inherent to a processed ingredient excludes the recipe (BR-06, F1', PO 2026-11-01)
  # Processed ingredient = dictionary info "varies" (data contract §3.7a); inherent allergens = dictionary inherentAllergenIds of that ingredient (dictionary §11).
  Given recipe R has ing-mayonnaise (inherentAllergenIds ["alg-egg"]) and no other egg source
  And the child's knownAllergenIds is ["alg-egg"]
  Then R appears neither in the 3 suggestions nor in 「ほかのレシピ」
  And in 「レシピ一覧」 R is listed last, greyed, with the reason 「卵を含む」 and its 「この日に決定」 is disabled
  # Same for ing-soy-sauce with alg-wheat or alg-soybean, ing-bread with alg-wheat, ing-cheese with alg-milk, ing-miso with alg-soybean.
  # Fish example (F1'', AC15): recipe R has ing-kamaboko (allergenGroupIds ["grp-fish"], inherentAllergenIds []) and the child's knownAllergenIds is ["alg-salmon"] or ["alg-mackerel"]: R is excluded as above, the reason names the child's own allergen (e.g. 「さけを含む」).

Scenario: AC15 Allergen group fish (BR-06, F1'', PO ruling P5 2026-11-01)
  # Groups: dictionary §11.5; grp-fish = {alg-salmon, alg-mackerel}; carried by ing-chikuwa, kamaboko, hanpen, satsuma-age, crab-stick, sakura-denbu, tarako, canned-tuna, canned-mackerel, salmon-flakes, fish-sauce.
  Given recipe R has ing-chikuwa (allergenGroupIds ["grp-fish"]) and no ingredient with alg-salmon or alg-mackerel in allergenIds
  And the child's knownAllergenIds is ["alg-mackerel"]
  Then R appears neither in the 3 suggestions nor in 「ほかのレシピ」, and in 「レシピ一覧」 it is listed last, greyed, reason 「さばを含む」, 「この日に決定」 disabled
  And R's data does not contain alg-salmon or alg-mackerel because of the chikuwa (the group is never written to allergenIds)
  And for knownAllergenIds ["alg-salmon"] the result is the same (reason 「さけを含む」)
  And for knownAllergenIds ["alg-salmon-roe"] only, or ["alg-shrimp"] only, R is not excluded and the AC11 warning applies
  And for a child with neither salmon nor mackerel registered, R is not excluded

Scenario: AC16 Allergen group data validation (data contract §3.7a, dictionary §11.5)
  Given a dictionary where grp-fish lists a member that is not a non-retired scheme allergen, or an ingredient lists an undefined group, or a group sits on an ingredient whose info is "known"
  Then the data validator reports dictionary-group-member-unknown, dictionary-ingredient-group-unknown or dictionary-group-ingredient-not-processed respectively
  And a recipe whose allergenIds, possibleAllergenIds or mayContainAllergenIds contains "grp-fish" fails allergen-unknown

Scenario: AC10 A registered allergen that is not inherent does not exclude; it triggers the packaging warning (BR-06, BR-07)
  Given recipe R has ing-soy-sauce (inherent alg-soybean, alg-wheat) and no ingredient carrying alg-peanut
  And the child's knownAllergenIds is ["alg-peanut"]
  Then R is not excluded and ranks by BR-09 like any other recipe
  And the processed-food warning of AC11 is shown for ing-soy-sauce

Scenario: AC11 Processed-food warning (BR-07, PO 2026-11-01)
  Given the child's knownAllergenIds is non-empty (e.g. ["alg-peanut","alg-shrimp"]) and the recipe passes the filters
  When a recipe is shown on its detail screen
  Then every ingredient row whose dictionary info is "varies" carries a marker with the text key warn.processed.item (intent ja: 「市販品。表示を確認」 / en: "Store-bought product: check the label")
  And the recipe detail shows once, above the ingredient list, the notice warn.processed.recipe naming the child's FULL registered allergen list (dictionary labels, in the order of knownAllergenIds), intent ja: 「市販品には、登録したアレルゲン（落花生、えび）が含まれる場合があります。パッケージの表示を確認してください」 / en: "Store-bought products may contain the registered allergens (peanut, shrimp). Check the package label."
  And the recipe card shows the compact notice warn.processed.card (intent ja: 「市販品の表示を確認」 / en: "Check labels of store-bought items") when the recipe has at least one processed ingredient
  And no text says or implies that a product is free of those allergens (BR-07, banned-phrase check)
  And the warning is shown whether allergenDataComplete is true or false and whatever the recipe's allergenInfo (known, varies-by-product, unknown) of that ingredient: the trigger is the dictionary, not the recipe record
  # Granularity (recommendation, open point P1): marker per ingredient, allergen list once per recipe, so a recipe with 6 processed ingredients does not repeat the list 6 times.

Scenario: AC12 No registered allergen, no allergen warning (BR-07, PO 2026-11-01)
  Given allergyStatus "none-known", or "unknown", or "has-known" with knownAllergenIds [] (only excludedIngredientIds)
  Then no card, detail or list row shows warn.processed.item, warn.processed.recipe or warn.processed.card
  And allergyStatus "unknown" still shows the banner of US-E1-03/AC5 (BR-07); the warning neither replaces nor suppresses the banner

Scenario: AC13 Brand-label data warns only (PO 2026-11-01)
  Given ing-sausage in recipe R has allergenInfo "varies-by-product" and possibleAllergenIds ["alg-pork","alg-soybean"] from a cited maker label
  And the child's knownAllergenIds is ["alg-soybean"]
  Then R is not excluded (mayContainAllergenIds is not read by the hard filter)
  And ing-sausage shows the processed-food warning of AC11 like every other processed ingredient
  And possibleAllergenIds stay in the data and are never shown as a statement about the product the parent buys

Scenario: AC14 Property over the whole library (BR-06, F1')
  For every single allergen id of the current scheme and every pair of them
  Then no suggested recipe has an id of them in allergenIds, and no suggested recipe has a processed ingredient whose dictionary inherentAllergenIds contain any of them, and no suggested recipe has an ingredient whose dictionary allergenGroupIds group has any of them as member (AC15)
  And every suggested recipe with a processed ingredient shows the AC11 warning when the child has at least one registered allergen, and none when the child has none
```

### US-E6-03 Never guarantee allergy safety · M · S
As the product owner I want the app to be honest that it can't guarantee safety so that families stay careful.

```gherkin
Scenario: AC1 Disclaimer on every recommendation and recipe screen (BR-07)
  Then the recommendation view and every recipe detail show 「アレルギーの安全を保証するものではありません。使用する食品の表示を必ずご確認ください。」

Scenario: AC2 No safety claims anywhere (BR-07)
  Then no catalog string in ja or en matches any phrase of `data/banned-phrases.json` (BA-owned; e.g. 「アレルギー対応済み」「安全です」, "allergy-safe", "safe for")
  # Matching: both sides NFKC-normalised and case-folded; ja phrases match as substrings; en phrases match as whole words or word sequences (so "bad" does not match "badge"). Recipe text in data/library.json is checked against the same file.

Scenario: AC3 Empty allergen list is worded carefully (BR-07)
  Given a recipe with allergenIds [] and no processed ingredient (dictionary info "varies"; changed 2026-11-01 from "varies-by-product ingredient")
  Then its badge reads 「表示対象のアレルゲン：使用していません（食品の表示をご確認ください）」, never 「アレルゲンなし」 alone

Scenario: AC4 The processed-food warning never claims safety (BR-07, PO 2026-11-01)
  Given any recipe with a processed ingredient and a child with at least one registered allergen
  Then the warning copy (warn.processed.*) lists the child's registered allergens as something to check and never states or implies that the product, the recipe or the ingredient is free of them
  And 0 warn.processed.* strings (ja, en) match data/banned-phrases.json
  And the disclaimer of AC1 is still shown on the same screen

Scenario: AC5 Disclaimer stays, warning absent without registered allergens (BR-07)
  Given a child with allergyStatus "none-known"
  Then the disclaimer of AC1 is shown and no warn.processed.* string is shown
```

### US-E6-04 Recipe detail · M · S
As a parent I want a clear recipe page so that I can prepare it in the morning.

```gherkin
Scenario: AC1 Content
  When the parent opens a recipe
  Then it shows the ja name (en name when the language is en), minutes, servings, ingredients with quantities, numbered steps, storage and food-handling notes, allergen and diet badges, the theme if any, and source credits with links

Scenario: AC2 Food-handling guidance is always present
  Then every recipe detail shows the general bento food-handling notes (cool food before closing the lid, keep it cool while carrying) credited to 農林水産省

Scenario: AC3 Deep link
  When /recipes/<recipeId> is opened directly
  Then the recipe detail opens; an unknown id shows 「レシピが見つかりません」 and a link to the calendar

Scenario: AC4 Processed ingredients are marked on the detail (BR-07, PO 2026-11-01)
  Given the child has at least one registered allergen and the recipe has processed ingredients (dictionary info "varies")
  Then each such ingredient row carries warn.processed.item and the notice warn.processed.recipe is shown once above the list (US-E6-02/AC11)
  And rows of non-processed foods carry no such marker

Scenario: AC5 No registered allergen: no processed-food markers (PO 2026-11-01)
  Given knownAllergenIds is []
  Then the detail shows no warn.processed.* text; the general disclaimer (US-E6-03/AC1) and the unknown-status banner (when applicable) behave as before

Scenario: AC6 Retired incomplete-data notice (PO 2026-11-01)
  Given a recipe whose allergenDataComplete is false
  Then the detail does not show 「一部の材料のアレルゲン情報がわかりません…」 on that account (string retired from the catalog)
```

### US-E6-05 Browse the recipe library · S · S
As a parent I want to browse all bentos so that I can plan ahead without starting from a day.

```gherkin
Scenario: AC1 List with conflicts last (BR-06)
  Then the list shows every library recipe; recipes conflicting with the child's allergens (including the inherent allergens of processed ingredients, US-E6-02/AC9), exclusions or diet are listed last, greyed, with the reason, and cannot be planned

Scenario: AC2 Plan from the library (BR-03)
  When the parent opens a recipe, taps 「日付を選んで計画」 and picks 2026-11-18
  Then the same confirm step as US-E5-03/AC2 applies

Scenario: AC3 Which dates can be picked (BR-03, BR-25, BR-27)
  Given today is 2026-11-10 JST, November is confirmed and the recipe passes the child's filters
  When the parent taps 「日付を選んで計画」
  Then the sheet 「どの日に作りますか？」 lists, in date order, every school day and every お弁当の日 of any confirmed menu from 2026-11-10 on, each with its current decision
  And it lists no past date, no date outside a confirmed menu, no no-lunch day other than お弁当の日, and no day in an open refresh conflict (US-E3-05/AC2, AC6)
  And picking a day that is already homemade-bento-planned leads to a recipe change (CHANGE_RECIPE) through the confirm step of US-E5-03/AC2

Scenario: AC4 No day can be planned
  Given no confirmed menu has a school day or お弁当の日 from today on
  When the parent taps 「日付を選んで計画」
  Then the sheet says 「計画できる日がありません。献立を取り込むと選べるようになります。」 and offers no date
```

### US-E6-06 Planned recipe missing after a library change · S · S
As a parent I want my plan to survive app updates so that a removed recipe doesn't break the calendar.

```gherkin
Scenario: AC1 Missing recipe id (BR-02)
  Given 2026-11-04 is planned with recipeId "retired-recipe" that is no longer in the library
  Then the cell shows the stored recipeShortNameSnapshot, the sheet shows the stored recipeNameSnapshot and says 「このレシピは見つかりません。別のレシピを選んでください。」
  And the decision is not changed
```

### US-E6-07 Curated recipe library content · M · L
As the product owner I want 15–120 real, sourced bento recipes so that suggestions are trustworthy.

```gherkin
Scenario: AC1 Library size and validity (BR-26)
  Then the shipped library has between 15 and 120 recipes and the validator reports 0 errors for it

Scenario: AC2 Mix
  Then at least 6 recipes have style "japanese", at least 4 have style "western-inspired", and at least 5 have minutes ≤ 20

Scenario: AC3 Sources (BR-26)
  Then every recipe has at least 1 source with a fetched URL, and the overlap audit reports 0 FAIL and 0 UNVERIFIED for the library

Scenario: AC4 Japanese text checked by hand before release (BR-26)
  Then every reviewed recipe has reviewedBy "verifier" (its Japanese text and facts were checked against its sources by the verifier, FL-07); the 20 original recipes stay "verifier", the others are "ba-research" and tracked as unreviewed

Scenario: AC5 Every recipe has calendar short names
  Then every shipped recipe has shortNameJa of 1–8 characters and shortNameEn of 1–8 characters, and the validator rejects a recipe without them (rule recipe-short-name)
```

---

## E7 Reminders & today view

Reminder rules (BR-15 … BR-18, OQ-06, OQ-14): all times are Asia/Tokyo. Weekly: default Sunday 14:00, covers the 7 days starting the next day. Day-before: default 17:30 on the day before each homemade-bento-planned day. One reminder per key (`weekly:<firstCoveredDate>`, `day-before:<date>`). Web: in-app only (shown while the app is open or when it is next opened; never claimed while closed).

### US-E7-01 Weekly reminder · M · M
As a parent I want a Sunday summary so that I plan the week in one go.

```gherkin
Scenario: AC1 Content (BR-15, BR-16)
  Given it is 2026-11-01 (Sun) 14:00 JST and the app is open
  And 2026-11-04 is low-preference (school-lunch-planned) and 2026-11-06 is homemade-bento-planned
  Then a weekly reminder for 2026-11-02 … 2026-11-08 lists 「11月4日（水）苦手かも・未計画」 with 「計画する」 and 「11月6日（金）手作りお弁当：<recipe>」

Scenario: AC2 Quick planning
  When the parent taps 「計画する」 next to 2026-11-04
  Then the day sheet of 2026-11-04 opens

Scenario: AC3 Nothing to report (BR-16)
  Given the next week has no low-preference, not-confirmed or planned days
  Then the weekly reminder says 「来週は手作りお弁当の予定はありません」 (still delivered, so the parent knows the check ran)

Scenario: AC4 Week spans a month boundary (BR-16)
  Given it is 2026-11-29 (Sun) 14:00 JST, November is confirmed and December is not
  Then the reminder covers 2026-11-30 … 2026-12-06, lists the November days normally, and says 「12月の献立がまだありません」 for the December days

Scenario: AC5 Week without any menu (BR-16)
  Given no confirmed menu covers any day of the next week
  Then the reminder says 「来週の献立がまだありません」 with 「献立を取り込む」
```

### US-E7-02 Day-before reminder · M · M
As the parent who forgets I want a reminder the evening before so that I shop and prepare in time.

```gherkin
Scenario: AC1 Fires for planned days only (BR-16)
  Given 2026-11-04 is homemade-bento-planned and 2026-11-05 is not-confirmed
  When the clock reaches 2026-11-03 17:30 JST
  Then a reminder 「明日は手作りお弁当の日！レシピを確認しましょう。」 with the recipe name is shown for 2026-11-04
  And no reminder is shown for 2026-11-05

Scenario: AC2 Tap opens the recipe
  When the parent taps the reminder
  Then the planned recipe's detail opens; if the recipe is missing, the day sheet opens

Scenario: AC3 Month boundary, last school day of January then first of February (BR-15, BR-16)
  Given 2027-01-29 (Fri) and 2027-02-01 (Mon) are both homemade-bento-planned
  Then reminders fire on 2027-01-28 17:30 JST and 2027-01-31 (Sun) 17:30 JST respectively

Scenario: AC4 Leap day (BR-15, BR-16)
  Given 2028-02-29 (Tue) and 2028-03-01 (Wed) are planned
  Then reminders fire on 2028-02-28 17:30 JST and 2028-02-29 17:30 JST

Scenario: AC5 First planned after the reminder time (BR-17)
  Given it is 2026-11-03 19:00 JST and 2026-11-04 is not homemade-bento-planned
  When the parent plans 2026-11-04 (its plannedAt is 2026-11-03T19:00+09:00, after the due time 2026-11-03 17:30 JST)
  Then no day-before reminder is shown for 2026-11-04 and the today view on 2026-11-04 covers it
  # Suppression compares plannedAt (first CONFIRM_RECIPE), never decidedAt (H1 ruling B10).

Scenario: AC6 Rescheduled or cancelled with the decision (BR-17)
  Given the day-before reminder for 2026-11-04 is scheduled (plannedAt before its due time)
  When the plan's recipe changes, at any time before the reminder expires, the reminder is kept and refers to the new recipe; a recipe change never deletes a pending reminder
  And when the plan is cancelled or set to not-confirmed, the reminder is removed

Scenario: AC7 Changing the recipe after the due time keeps the reminder (BR-17)
  Given 2026-11-04 was planned on 2026-11-01 with recipe R1 and the app was closed at 2026-11-03 17:30 JST
  When the parent opens the app at 2026-11-03 20:00 JST and changes the recipe to R2 before dismissing the reminder
  Then plannedAt keeps its 2026-11-01 value, and the 2026-11-04 day-before reminder is shown (missed reminder, US-E7-05/AC2) and refers to R2

Scenario: AC8 Cancelled and planned again after the due time (BR-17)
  Given 2026-11-04 was planned on 2026-11-01 and its reminder was shown and dismissed at 2026-11-03 17:30 JST
  When at 2026-11-03 19:00 JST the parent taps 「給食に戻す」, confirms, and then plans 2026-11-04 again
  Then plannedAt is 2026-11-03T19:00+09:00 (a new first confirm), no new day-before reminder is shown for 2026-11-04, and the today view on 2026-11-04 covers it
```

### US-E7-03 Same-day overview (today view) · M · S
As a busy parent I want to see this morning's plan instantly so that I act on it.

```gherkin
Scenario Outline: AC1 Today card
  Given today's decision is <decision>
  Then the top of the calendar screen shows <text>
  Examples:
    | decision                | text                                                          |
    | homemade-bento-planned  | 「今日は手作りお弁当：<recipe>」 with 「レシピを見る」            |
    | school-lunch-planned    | 「今日は給食」 and the external-reservation note (US-E5-07/AC1) |
    | not-confirmed           | 「今日の予定は未定です」                                        |
    | no-school-lunch         | 「今日は給食がありません」                                      |

Scenario: AC2 Weekend or day outside the menu
  Given today is Saturday 2026-11-07
  Then the today card shows the next school day instead: 「次の登園日：11月9日（月）給食」

Scenario: AC3 Day rollover at Tokyo midnight (BR-15)
  Given the app stays open from 2026-11-03 23:59 JST to 2026-11-04 00:01 JST
  Then the today card switches to 2026-11-04 without a reload (the clock is checked at least once per minute)

Scenario: AC4 No upcoming school day is known
  Given today is Saturday 2026-11-28 JST, the November menu lists no school day after 2026-11-27, and December has no confirmed menu
  Then the today card shows 「次の登園日は、献立を取り込むと表示されます」

Scenario: AC5 An undecided today offers to decide (BR-02)
  Given today's decision is not-confirmed
  When the parent taps 「予定を決める」 on the today card
  Then today's day sheet opens and no decision has changed
```

### US-E7-04 Configure reminder times · M · S
As a parent I want to choose when reminders come so that they fit our routine.

```gherkin
Scenario: AC1 Defaults (BR-16)
  Given a new install
  Then settings show 週のまとめ 「日曜日 14:00」 and 前日のお知らせ 「17:30」, both on

Scenario: AC2 Change times (BR-16)
  When the parent sets the weekly reminder to Saturday 20:00 and the day-before to 19:15
  Then future reminders use these times and reminders already shown are not shown again

Scenario: AC3 Allowed values (BR-16)
  Then times are selectable in 15-minute steps from 00:00 to 23:45 and the weekly day is any of 日〜土
  And a stored value of "24:00" or "17:31" is rejected by validation and replaced by the default

Scenario: AC4 Turn off (BR-16)
  When the parent switches off 前日のお知らせ
  Then no day-before reminders are shown, and the today view still works
```

### US-E7-05 No duplicate or expired reminders · M · S
As a parent I want each reminder once so that the app isn't noisy.

```gherkin
Scenario: AC1 Shown once per key (BR-17)
  Given the day-before reminder for 2026-11-04 was shown and dismissed
  When the app is reopened or reloaded, or the debug clock is set to 17:30 again
  Then it is not shown again (except via the debug 「強制表示」 action)

Scenario: AC2 Missed reminders are shown on next open until they expire (BR-17)
  Given the app was closed at 2026-11-03 17:30 JST
  When the app opens at 2026-11-03 21:00 JST
  Then the 2026-11-04 day-before reminder is shown, labelled with its original time
  When the app instead opens first at 2026-11-04 07:00 JST
  Then that reminder is not shown (expired at 2026-11-04 00:00 JST) and the today view shows the plan

Scenario: AC3 Weekly reminder expiry (BR-17)
  Then a weekly reminder expires at the end of the last day it covers, and only the most recent unexpired weekly reminder is shown

Scenario: AC4 A shown but undismissed reminder shows again until dismissed or expired (BR-17)
  Given the 2026-11-04 day-before reminder was shown at 2026-11-03 17:30 JST (shownAt set) and not dismissed, and the app was closed
  When the app opens again at 2026-11-03 21:00 JST
  Then the reminder is shown again, labelled with its original time, and still has no dismissedAt
  When the parent dismisses it and reopens the app at 2026-11-03 22:00 JST
  Then it is not shown again
  And if it is never dismissed, it is not shown on an open at or after 2026-11-04 00:00 JST (expired)

Scenario: AC5 Several due reminders are all reachable (BR-17)
  Given 3 reminders are due, unexpired and not dismissed when the app opens
  Then one reminder banner is shown with 「ほかに2件のお知らせ」
  When the parent opens 「ほかに2件のお知らせ」
  Then the other 2 reminders are shown
  And none of the 3 gets a dismissedAt until the parent dismisses that reminder
```

### US-E7-06 Honest notification promises on the web · M · S
As a parent I want to know exactly when I'll be reminded so that I don't rely on something that won't happen.

```gherkin
Scenario: AC1 Web settings explain the limitation (BR-18)
  Then the reminder settings in the browser build say 「ブラウザ版では、アプリを開いているとき・次に開いたときにお知らせします。閉じている間は通知できません。」

Scenario: AC2 No background promise (BR-18)
  Then no string in the web build claims reminders arrive while the app or browser is closed (e.g. 「閉じていても通知」, "even when closed", "push notification")
```

### US-E7-07 Device timezone differs from Tokyo · M · S
As a parent travelling abroad I want reminders and dates to stay on Japan time so that the plan doesn't shift.

```gherkin
Scenario: AC1 Reminder fires at Tokyo time (BR-15)
  Given the device timezone is Europe/Paris and 2026-11-04 is planned
  Then the day-before reminder becomes due at 2026-11-03T08:30:00Z (17:30 JST, 09:30 in Paris)
  And the weekly reminder of 2026-11-01 becomes due at 2026-11-01T05:00:00Z (14:00 JST, 06:00 in Paris)

Scenario: AC2 Times are labelled when the device is not in Tokyo (BR-15)
  Given the device timezone is not Asia/Tokyo
  Then reminder times in settings and reminders show 「（日本時間）」 / "(Japan time)"

Scenario: AC3 Timezone change while open (BR-15)
  Given the device timezone changes from Asia/Tokyo to America/Los_Angeles while the app is open
  Then "today", the calendar dates and the due reminders are unchanged
```

### US-E7-08 (v1) Reservation reminder on school-lunch days · C · S
As a parent who reserves school lunch in the morning I want a nudge before the school's cut-off so that I don't forget to reserve.

```gherkin
  # v1 only: not built before the PO approves v1; needs the school's reservation cut-off time (OQ-05).
Scenario: AC1 (v1) Morning nudge
  Given 「給食予約のリマインド」 is on at 08:00 and today is school-lunch-planned with reservationDoneExternally false
  When the clock reaches 08:00 JST
  Then 「今日は給食の日です。園での予約をお忘れなく。」 is shown, and it is not shown when the flag is true
```

---

## E8 Localization & display

### US-E8-01 Japanese by default, one-tap English · M · S
As a Japanese parent I want the app in natural Japanese from the start, and my partner may want English, so that everyone can use it.

```gherkin
Scenario: AC1 Japanese is the default whatever the browser language (BR-23)
  Given a fresh install on a browser whose language is en-US
  When the app opens
  Then all UI text is Japanese and <html lang="ja">

Scenario: AC2 Toggle is reachable everywhere (BR-23)
  Then a 「日本語 / EN」 toggle is reachable from the calendar header and from settings in at most 1 tap from the calendar
  When the parent switches to EN
  Then all visible text switches without reload and <html lang="en">

Scenario: AC3 Choice persists
  Given the parent switched to EN
  When the page is reloaded
  Then the app is still in English

Scenario: AC4 Content language
  Given language EN
  Then recipes show their English name when one exists, otherwise the Japanese name, and menu dish names stay as imported (Japanese)
```

### US-E8-02 Every visible string is localized · M · S
As the product owner I want no hard-coded text so that both languages are complete.

```gherkin
Scenario: AC1 Catalog parity (BR-23)
  Then the ja and en catalogs have exactly the same keys, and no value is empty

Scenario: AC2 No hard-coded strings (BR-23)
  Then rendering every screen in EN shows no Japanese characters except menu dish names, recipe Japanese names and the 「日本語」 toggle label
  And rendering in JA shows no untranslated English UI text (allowed: "EN", units like "g", "ml")

Scenario: AC3 Missing key fallback (BR-23)
  Given a key is missing in en at runtime
  Then the ja text is shown and a dev-only console warning names the key
```

### US-E8-03 Japanese dates and times · M · S
As a Japanese parent I want familiar date formats so that I read them without thinking.

```gherkin
Scenario Outline: AC1 Formats
  Given the language <lang>
  Then <value> is shown as <shown>
  Examples:
    | lang | value                 | shown              |
    | ja   | month 2026-11         | 2026年11月          |
    | ja   | date 2026-11-04       | 11月4日（水）        |
    | ja   | time 17:30            | 17:30              |
    | en   | month 2026-11         | November 2026      |
    | en   | date 2026-11-04       | Wed, Nov 4         |
    | en   | time 17:30            | 17:30              |

Scenario: AC2 Japanese era is not used in the UI
  Then no UI date uses 令和 (the era may appear only inside imported menu text)

Scenario: AC3 All date math uses Asia/Tokyo calendar dates (BR-15)
  Then dates are stored as "YYYY-MM-DD" strings without time or offset, and "today" is computed with the Asia/Tokyo zone (BR-15)
```

### US-E8-04 Japanese public holidays on the calendar · C · S
As a parent I want holidays marked like on any Japanese calendar so that I recognize the month.

```gherkin
Scenario: AC1 Holidays shown from a sourced list
  Given the bundled holiday list from the Cabinet Office (内閣府) for 2026–2028
  Then 2026-11-03 and 2026-11-23 are shown red with the names 「文化の日」「勤労感謝の日」 available to screen readers

Scenario: AC2 Holidays never decide school days (BR-25)
  Given the confirmed menu lists a lunch on a holiday
  Then that day is treated as a school day (the menu wins)
```

### US-E8-05 Light, dark or automatic display theme · S · S
As a parent who plans in the evening I want the app to follow my phone's dark mode, or to choose it myself, so that it is comfortable to read.

```gherkin
Scenario: AC1 Follows the device by default
  Given a fresh install (setting theme absent, default "auto")
  When the device prefers a dark colour scheme
  Then the app uses the dark tokens; when the device prefers light, the light tokens

Scenario: AC2 Manual choice persists
  When the parent sets 設定 → 表示 → 「テーマ」 to 「ダーク」
  Then the dark tokens are used whatever the device setting, and settings.theme "dark" is still applied after a reload
  And 「自動」 returns to following the device

Scenario: AC3 Both themes keep the meaning of the calendar
  Then in light and in dark, homemade-bento-planned is the only solid-filled cell, and the axe and contrast checks of US-NF-02 pass in both themes
```

---

## E9 Sharing

### US-E9-01 Share the coming week's plan · M · S
As the planning parent I want to send this week's bento plan to my partner so that they know without installing anything.

```gherkin
Scenario: AC1 Share text content (exact format, ja) (BR-21)
  Given today is 2026-11-01 and 2026-11-04 is planned with 「くまさんおにぎり弁当」 and 2026-11-06 is not-confirmed
  When the parent taps 「今週の予定を共有」
  Then the share text is:
    """
    【BentoMinder】11月2日（月）〜11月8日（日）のお弁当予定
    11月4日（水）手作りお弁当：くまさんおにぎり弁当
    11月6日（金）未定
    ほかの日は給食（または給食なし）です。
    ※給食の予約は園の方法で行ってください。
    """

Scenario: AC2 OS share sheet with copy fallback
  Given navigator.share is available
  Then the OS share sheet opens with the text
  Given navigator.share is unavailable or rejected
  Then the text is copied to the clipboard and 「コピーしました」 is shown

Scenario: AC3 Empty week (exact format, ja) (BR-21)
  Given today is 2026-11-01 and no day from 2026-11-02 to 2026-11-08 is homemade-bento-planned or not-confirmed
  When the parent taps 「今週の予定を共有」
  Then the share text is:
    """
    【BentoMinder】11月2日（月）〜11月8日（日）のお弁当予定
    今週は手作りお弁当の予定はありません。
    ※給食の予約は園の方法で行ってください。
    """
  # M1 prep (H2 design reading accepted): the line 「ほかの日は給食（または給食なし）です。」 is left out when the week has no planned or not-confirmed day. Same rule as before, exact text added.

Scenario: AC4 Copying fails too
  Given navigator.share is unavailable or rejected, and writing to the clipboard fails
  When the parent taps 「今週の予定を共有」
  Then 「コピーできませんでした。下の文章を選んでコピーしてください。」 is shown
  And the share text in 「送る内容」 is selected so the parent can copy it by hand
  And 「コピーしました」 is not shown
```

### US-E9-02 Shared text exposes no unnecessary child data · M · S
As a parent I want shared messages to contain only the plan so that my child's details stay private.

```gherkin
Scenario: AC1 No profile data in the share text (BR-21)
  Given a profile with nickname 「はなちゃん」, age range, likes, dislikes, allergens, diet, themes and a note
  Then the share text contains none of them (it contains only dates, decision labels, recipe names and the fixed notes)

Scenario: AC2 No sync claim (BR-22)
  Then the share UI says 「共有した時点の予定です。自動では同期されません。」 and no string claims automatic sync between devices
```

---

## E10 Data

### US-E10-01 Data stays on the device and survives reload · M · S
As a parent I want my data kept on this device so that it works offline and stays private.

```gherkin
Scenario: AC1 Persistence across reload and restart (BR-22)
  Given a profile, a confirmed menu, 3 decisions, 1 override and custom reminder times
  When the browser is closed and reopened
  Then all of them are restored exactly

Scenario: AC2 No network calls with personal data (BR-10, BR-22)
  Then in a full journey the only network requests are: static app assets, and the menu adapter (URL or PDF bytes, prompt, schema); no request body contains profile, decision or override data

Scenario: AC3 Works offline after load
  Given the app was loaded once and the network is then disabled
  Then the calendar, decisions, recipes and reminders work; only menu import shows 「オフラインのため取り込めません」
```

### US-E10-02 Versioned schema and migrations · M · M
As the developer I want a versioned store so that updates never lose a family's plans.

```gherkin
Scenario: AC1 Store carries a schema version (BR-22)
  Then the root store has schemaVersion 1 and validates against the v1 contract

  # AC2 retired at M2 prep (D-M1-04): it needed a real schemaVersion 0 store, and no v0 shape ever existed (v1 is the first shipped shape). Replaced by AC8, which proves the same path with the frozen v1 fixture and synthetic versions.

Scenario: AC3 Newer version is not overwritten (BR-22)
  Given a store with schemaVersion 99
  Then the app shows 「新しいバージョンのデータです。アプリを更新してください。」, offers export, and writes nothing

Scenario: AC4 Corrupt store
  Given the stored JSON is not parseable or fails validation
  Then the app shows a recovery screen offering 「データを書き出す（そのまま）」 and 「初期化する」, and writes nothing until the parent chooses

Scenario: AC5 Storage unavailable or full
  Given storage writes throw (private mode or quota exceeded)
  Then the app shows 「この端末に保存できません」 and does not claim that a decision was saved

Scenario: AC6 A failed write never shows a "saved" message (BR-22)
  Given storage writes throw
  When the parent confirms a recipe for 2026-11-04 with 「この日に決定」
  Then 「保存できませんでした。もう一度お試しください。」 is shown and 「11月4日（水）を手作りお弁当にしました」 is not shown
  And the calendar and the day sheet still show the previous decision for 2026-11-04
  When writes succeed again and the parent repeats the action
  Then the decision is stored and 「11月4日（水）を手作りお弁当にしました」 is shown

Scenario: AC7 Starting over from the recovery screen asks first (BR-22)
  Given the recovery screen of AC4 is shown
  When the parent taps 「初期化する」
  Then a dialog asks 「データを初期化しますか？」
  When the parent cancels the dialog
  Then storage is unchanged and the recovery screen is still shown
  When the parent taps 「初期化する」 again and confirms
  Then the unreadable store is removed, and onboarding opens in Japanese at step 1 with no profile, menu or decision

Scenario: AC8 The migration path is proven with the frozen v1 fixture and synthetic versions (BR-22)
  Given the frozen fixture tests/fixtures/state/v1.json
  When the shipped build loads it
  Then it opens without any migration and every record equals the fixture (so a change to the v1 shape without a new schemaVersion fails this test)
  Given a synthetic predecessor made from that fixture (schemaVersion 0, one field renamed or removed) and a test-only migration 0 → 1 given to the repository
  When the store is loaded
  Then the original text is written as the backup copy before the migrated store, the migrated store validates as v1, its profile, menus, overrides and decisions equal the fixture's, and a second load runs no migration
  Given test-only migrations 0 → 1 and 1 → 2 (a synthetic v2 shape)
  When the migration chain runs from 0 to 2
  Then each step runs once, in order, and schemaVersion is stamped after each step
  And a missing or throwing step stops the load with migration-failed: no migrated document is written, the stored text stays byte-for-byte, and the app handles it as in AC4
  Given the shipped build (no migration steps) and a stored schemaVersion 0
  Then the load reports migration-failed, writes nothing and is handled as in AC4
  # M2 prep (D-M1-04 ruling), replaces AC2. Unit level (repository and migrate() with injected steps). When a real v2 ships, its migration ships with this fixture and a frozen v2 fixture, and the synthetic steps give way to the real one (ADR 003).
```

### US-E10-03 Export my data · M · S
As a parent I want to download my data so that I have a copy or can move it.

```gherkin
  # AC1 retired at M1 prep: it required an exportedAt field in the file, which the root store contract rejects (unknown-field). Replaced by AC4: the export date is in the file name only (data contract §4 export-roundtrip).

Scenario: AC2 Export with no data
  Given no BentoMinder store has been saved on this device (a fresh device, or right after 「すべてのデータを削除」)
  When the parent opens 設定 from onboarding step 1 (US-E1-01/AC6)
  Then 「データを書き出す」 is disabled with 「書き出すデータがありません」
  # M2 prep (D-M1-03): Given made explicit and the way to reach it named; outcome unchanged. Once a store is saved (e.g. by 「次へ」 on step 1) export is enabled.

Scenario: AC3 (Could) Import an export
  Given a valid export file with schemaVersion ≤ the app's version
  When the parent chooses 「データを読み込む」 and confirms replacing current data
  Then the store is replaced and the calendar shows the imported plans

Scenario: AC4 Export file is the store as is (BR-22)
  Given today is 2026-11-01 JST
  When the parent taps 「データを書き出す」
  Then a file "bentominder-export-2026-11-01.json" downloads
  And its content is the full stored BentoMinderStore with its schemaVersion and no other top-level field
  And it validates against the root store contract (export-roundtrip)

Scenario: AC5 (Could) A file that isn't a valid export changes nothing
  Given a file that is not JSON, or fails the root store contract
  When the parent chooses it with 「データを読み込む」
  Then 「このファイルは読み込めません。BentoMinderから書き出したファイルを選んでください。」 is shown, no replace dialog opens, and storage is unchanged

Scenario: AC6 (Could) An export from a newer app version changes nothing (BR-22)
  Given an export file whose schemaVersion is greater than the app's
  When the parent chooses it with 「データを読み込む」
  Then 「このファイルは新しいバージョンのアプリで作られています。アプリを更新してください。」 is shown, no replace dialog opens, and storage is unchanged

Scenario: AC7 (Could) Import while signed in rewrites ownership (data contract §12)
  Given the parent is signed in with uid "test-uid-001" and a valid export whose records carry another ownerId (for example `local` or "test-uid-002")
  When the parent chooses it with 「データを読み込む」 and confirms replacing current data
  Then every imported record's ownerId is rewritten to "test-uid-001", and the data is saved under that account's keys (`bentominder.test-uid-001.state`)
```

### US-E10-04 Delete all data · M · S
As a parent I want to erase everything so that nothing stays on a shared or old device.

```gherkin
Scenario: AC1 Delete everything with confirmation (BR-22)
  When the parent taps 「すべてのデータを削除」 and types or taps the explicit confirmation 「削除する」
  Then every BentoMinder key of the signed-in account (`bentominder.<uid>.state`, its backup `.prev`, reminder log, consent, language; see data contract §12) is removed
  And the app returns to onboarding in Japanese

Scenario: AC2 Cancel keeps everything (BR-22)
  When the parent cancels the dialog
  Then storage is unchanged
```

### US-E10-05 Stored data matches the data contract · M · S
As QA I want every write validated so that bad data never reaches storage.

```gherkin
Scenario: AC1 Invalid writes are refused (BR-03)
  When the app tries to store a DayDecision homemade-bento-planned without recipeId
  Then the write is refused with the validator rule "decision-bento-requires-recipe" and the previous state remains
```

---

## E11 Debug panel (development only)

### US-E11-01 Debug panel only in development · M · S
As the developer I want debug controls that never reach parents so that production stays simple.

```gherkin
Scenario: AC1 Available in dev
  Given the app runs in development mode
  Then a small 「Debug」 button is visible in a corner and opens the panel

Scenario: AC2 Absent in production (BR-24)
  Given the production build
  Then no debug UI renders, the route /debug shows the not-found page, and the built JS contains none of the panel's marker strings (e.g. "BM_DEBUG_PANEL")
```

### US-E11-02 Simulate time and trigger reminders · M · S
As QA I want to control the clock so that reminders and boundaries can be tested quickly.

```gherkin
Scenario: AC1 Simulated clock
  When the debug clock is set to 2026-11-03 17:29 JST and advanced by 1 minute
  Then the 2026-11-04 day-before reminder becomes due, and "today" everywhere uses the simulated time

Scenario: AC2 Trigger now
  Then 「週のまとめを表示」 and 「前日のお知らせを表示」 trigger the reminders for the simulated time, marked as debug-triggered and not written to the shown-reminders log

Scenario: AC3 Reset clock
  When 「実時間に戻す」 is tapped
  Then the real time is used again
```

### US-E11-03 Samples, AI failure simulation and storage tools · M · S
As the developer I want sample data and failure switches so that I can work without live AI.

```gherkin
Scenario: AC1 Load samples
  Then 「サンプルのプロフィール」 loads the sample child and 「サンプルの献立（2026年11月）」 loads the fixture extraction into the review screen without any AI call

Scenario Outline: AC2 Simulate AI failures
  When the parent selects the failure mode <mode> and starts an import
  Then the app behaves as in <story>
  Examples:
    | mode                  | story          |
    | malformed-json        | US-E2-05/AC2   |
    | malformed-then-valid  | US-E2-05/AC1   |
    | rate-limited-primary  | US-E2-06/AC5   |
    | rate-limited          | US-E2-06/AC6   |
    | unavailable           | US-E2-06/AC2   |
    | url-unreachable       | US-E2-02/AC1   |

Scenario: AC3 Inspect and clear
  Then the panel lists the stored decisions (date, state, recipeId, decidedAt) and overrides as a table
  And 「テストデータを消去」 clears the store after a confirmation
```

---

## E12 Android

### US-E12-01 Android feasibility assessment · M · M
As the product owner I want a short feasibility document so that I can decide on the Android build with the facts.

```gherkin
Scenario: AC1 Document exists with required sections
  Then docs/dev/android-feasibility.md exists and covers: Capacitor version and setup, Local Notifications plugin capabilities (scheduling, exact alarms, permission on Android 13+), how the web reminder adapter maps to native, the AI adapter call from the app (no key in the APK), build steps for a debug APK, risks, effort estimate, and options with a recommendation
  And every claim about a platform or plugin capability cites its documentation URL
```

### US-E12-02 (v1) Android test build · S · M
As the product owner I want an installable test build so that we can try BentoMinder on a real phone.

```gherkin
Scenario: AC1 (v1) Debug APK from the same code
  Then a debug APK is built from the same web code base with Capacitor (no Kotlin rewrite), installs on Android 13+, and runs the E0 journey with the mocked AI adapter

Scenario: AC2 (v1) No secrets in the APK
  Then scanning the APK contents finds no AI provider key
```

### US-E12-03 (v1) Scheduled local notifications · S · M
As a parent on Android I want real notifications while the app is closed so that I'm reminded reliably.

```gherkin
Scenario: AC1 (v1) Day-before notification while closed
  Given 2026-11-04 is planned and notification permission is granted
  When the app is closed and the device clock reaches 2026-11-03 17:30 JST
  Then a system notification 「明日は手作りお弁当の日！」 appears and tapping it opens the recipe

Scenario: AC2 (v1) Rescheduled and cancelled with decisions
  When the plan for 2026-11-04 is cancelled
  Then the pending native notification for 2026-11-04 is cancelled (verified via the plugin's pending list)

Scenario: AC3 (v1) No duplicates
  Then the pending list never holds two notifications for the same key
```

### US-E12-04 (v1) Permissions and device changes · S · S
As a parent I want clear behaviour when I deny notifications or travel so that I know what to expect.

```gherkin
Scenario: AC1 (v1) Permission denied
  Given the parent denies notification permission
  Then settings show 「通知が許可されていません」 with a link to system settings, and in-app reminders still work

Scenario: AC2 (v1) Timezone change
  Given the device timezone changes to Europe/Paris
  Then pending notifications are rescheduled to the same Asia/Tokyo times

Scenario: AC3 (v1) Expired reminders
  Given a notification's target date has passed while the device was off
  Then it is not delivered late (removed on next app start)
```

---

## E13 Accounts and sign-in

First slice of v1 accounts (PO decision, `docs/PLAN.md` §7, 2026-11-09). Firebase Authentication, **Google sign-in only**, web first. Data stays on the device; no sync, no backup, no server copy of anything.

**Out of scope / later (no ACs here):** Sign in with Apple (iPhone), email + password, account deletion in the app, APPI consent for allergy data, cloud sync and backup, family members and sharing, the hosted AI proxy token check, Android-native Google sign-in (Capacitor plugin).

**Notes (rules for all E13 stories)**
- N1 Testability: the app talks to sign-in only through an `AuthPort` (current user, `onAuthStateChanged`, `signInWithGoogle`, `signOut`). Unit, component and e2e tests use a fake adapter and never call Google or Firebase; only a manual smoke check uses the real adapter.
- N2 User-facing messages are plain Japanese, no error codes or technical text. The designer writes final copy; quoted labels below are working labels.
- N3 Items marked DEFAULT are Business Analyst proposals the product owner may overturn.

### US-E13-01 Login screen is shown first (hard wall) · M · M
As a parent I want to sign in once before using the app so that my data belongs to my account.

```gherkin
Scenario: AC1 Signed out shows only the login screen
  Given no signed-in user
  When the app opens at any address (including a deep link to a calendar day or recipe)
  Then only the login screen is shown, with the app name and one button 「Googleでログイン」, and no calendar, profile, menu or settings content is rendered

Scenario: AC2 Deep link is not lost
  Given no signed-in user and a deep link to 2026-11-13
  When the parent signs in
  Then the app opens that deep link (or the normal start screen if the link is invalid)

Scenario: AC3 Sign-in starts only on the parent's tap
  When the login screen is shown
  Then no Google window opens until the parent taps 「Googleでログイン」

Scenario: AC4 Successful sign-in enters the app
  Given sign-in succeeds
  Then the login screen is replaced by onboarding when the account's local store has no profile, otherwise by the calendar

Scenario: AC5 Login screen is accessible
  Then the button is reachable by keyboard with a visible focus ring, has an accessible name, the screen has one h1 and the axe check of US-NF-02 passes in light and dark

Scenario: AC6 Notification tap while signed out
  Given a reminder notification is tapped while signed out
  Then the login screen is shown first and, after sign-in, the app opens the screen the notification targets
```

### US-E13-02 Session persists and works offline · M · M
As a parent I want to stay signed in so that I am not asked again every time.

```gherkin
Scenario: AC1 Reopen does not ask again
  Given the parent signed in earlier
  When the browser or app is closed and reopened
  Then the app opens straight into the signed-in app with no login screen

Scenario: AC2 No login flash on start
  Given a persisted session
  When the app starts and the session is still being read
  Then a neutral loading screen is shown (never the login screen), for at most 8 seconds before the cached session is used (fallback to the login screen after 8 s)

Scenario: AC3 Offline reopen works
  Given the parent signed in earlier and the network is off
  When the app is reopened
  Then the cached session is used, the app opens normally, and no message blocks use (BR-22, US-E10-01/AC3)

Scenario: AC4 First sign-in needs the network
  Given no session and the network is off
  When the parent taps 「Googleでログイン」
  Then the outcome of US-E13-03/AC4 is shown and the app is not entered

Scenario: AC5 Session ended by the account provider
  Given the network is on and the provider reports the session as ended (revoked, account disabled or deleted)
  Then the login screen is shown with 「再度ログインしてください」, local data is not deleted, and signing in again with the same account restores it

Scenario: AC6 Offline never forces sign-out
  Given a cached session and no network
  Then the app does not sign the parent out and does not require a token refresh to run any feature that works offline
```

### US-E13-03 Sign-in errors · M · S
As a parent I want clear, calm messages when sign-in does not work so that I know what to do.

```gherkin
Scenario: AC1 Parent cancels (closes the Google window)
  Then the login screen stays, no error banner is shown, and the button is usable again

Scenario: AC2 Popup blocked
  Given the browser blocks the sign-in window
  Then the login screen shows 「ログイン画面を開けませんでした。ポップアップを許可してもう一度お試しください。」 and the button is usable again

Scenario: AC3 Another sign-in already running
  When the parent taps the button twice quickly
  Then only one sign-in starts and the button is disabled with a busy state until it ends

Scenario: AC4 Offline at first sign-in
  Given no network
  Then the login screen shows 「インターネットに接続してからログインしてください」 and the button stays usable

Scenario: AC5 Account disabled or any other failure
  Then the login screen shows 「ログインできませんでした。しばらくしてからもう一度お試しください。」, no code or technical text is shown, and nothing is stored

Scenario: AC6 Errors never enter the app or touch data
  Given any failure of AC1 to AC5
  Then the auth state stays signed out and the local data of every account is unchanged
```

### US-E13-04 Local data is keyed to the account · M · M
As a parent I want my data to stay with my account on this device so that someone else signing in here does not see it.

```gherkin
Scenario: AC1 Existing data is adopted by the first account (DEFAULT)
  Given the device has data in the old unkeyed store (`bentominder.state`, records with ownerId `local`) and no account store exists
  When a parent signs in for the first time
  Then the data is moved to that account's keys, every record's ownerId changes from `local` to the Firebase uid, nothing else changes, and the old unkeyed keys are removed only after the new keys are written and read back equal

Scenario: AC2 Adoption happens once
  Given the unkeyed store was already adopted by account A
  When account B signs in on the same device
  Then B gets an empty store (onboarding) and never receives A's data

Scenario: AC3 Same account returns to its data
  Given account A signed out earlier
  When A signs in again on the same device
  Then A's profile, menus, decisions, overrides, reminder times and consent are restored exactly (BR-22)

Scenario: AC4 A different account does not see another's data
  Given account A's data is on the device
  When account B signs in
  Then no screen, export, notification or search result shows any of A's data, and A's keys are not read

Scenario: AC5 ownerId is the uid
  Then every record created or updated while account A is signed in has ownerId equal to A's uid (ADR 003), never the e-mail address

Scenario: AC6 Export and delete act on the current account only
  Then export and 「すべて削除」 of E10 read and delete only the signed-in account's keys; deleting never touches another account's keys
```

### US-E13-05 Sign-out in the app · M · S
As a parent I want to sign out from settings so that I can hand over or share the device safely.

```gherkin
Scenario: AC1 Settings shows the account
  Given a signed-in parent
  When they open settings
  Then an account section shows the display name (or e-mail when the name is missing), the e-mail, a photo if present (decorative, empty alt text) and a button 「ログアウト」

Scenario: AC2 Confirm explains that data stays
  When the parent taps 「ログアウト」
  Then a confirm dialog says that the data stays on this device and returns on the next login with the same Google account, and that reminders stop until then; buttons 「ログアウト」 and 「キャンセル」, focus on 「キャンセル」

Scenario: AC3 Confirm signs out
  When the parent confirms
  Then the session ends, the login screen is shown, and no local data of the account is deleted

Scenario: AC4 Cancel changes nothing
  When the parent cancels (button or Escape)
  Then the dialog closes and the parent stays signed in

Scenario: AC5 Reminders on sign-out and sign-in (DEFAULT)
  Given reminders are scheduled
  When the parent signs out
  Then all scheduled local notifications of the app are cancelled
  And when any account signs in, reminders are rescheduled from that account's own settings and decisions only

Scenario: AC6 Sign-out works offline
  Given no network
  When the parent confirms 「ログアウト」
  Then the local session ends and the login screen is shown
```

### US-E13-06 Privacy of the account data · M · S
As a parent I want to know what the app learns about me from Google so that I can trust it.

```gherkin
Scenario: AC1 What is received and what is kept
  Then the app receives uid, display name, e-mail and photo URL from Google; only the uid is stored by the app (as ownerId and in storage key names); name, e-mail and photo are read from the session only to display them and are never written into the BentoMinderStore or exported

Scenario: AC2 Short notice at first sign-in (DEFAULT)
  Given a first sign-in on this device
  Then the login screen shows, above the button, one short notice (at most 3 lines): sign-in is with Google, the app uses your name and e-mail only to show them, and the child's information stays on this device; no extra consent tick box is required in this slice

Scenario: AC3 No child data leaves the device
  Then no request to Google or Firebase contains profile, allergy, decision, override or menu data (BR-10, BR-22, US-NF-03)

Scenario: AC4 No tracking added
  Then sign-in adds no analytics, advertising SDK or third-party cookie beyond what Firebase Authentication needs for the session

Scenario: AC5 Requirement carried to the sync slice
  Then the sync slice must add APPI consent for allergy and health data, in-app account deletion and a privacy notice before any profile data is sent to a server (recorded; not tested in E13)
```

### US-E13-07 Testability of sign-in · M · S
As the team I want sign-in testable without Google so that tests are fast and stable.

```gherkin
Scenario: AC1 Auth behind a port
  Then all UI and domain code reach sign-in only through `AuthPort`; no component imports the Firebase SDK directly

Scenario: AC2 Fake adapter covers every state
  Then the fake adapter can produce: signed out, signed in (given uid, name, e-mail), cancelled, popup blocked, offline, disabled, other failure, session revoked, and a delayed session read

Scenario: AC3 Tests make no external calls
  Then unit, component and e2e runs make zero requests to Google or Firebase hosts (asserted by network interception in e2e)

Scenario: AC4 Existing suites run signed in
  Then the existing e2e and component suites start with the fake signed in as a fixed test account, so they need no login steps, and a separate suite covers the signed-out wall
```

---

## NF Non-functional

### US-NF-01 Performance · M · S
```gherkin
Scenario: AC1 Load
  Then the production build on Lighthouse mobile emulation (Moto G Power, slow 4G) has LCP ≤ 2.5 s and TBT ≤ 200 ms on the calendar screen with the November fixture loaded

Scenario: AC2 Interaction
  Then switching months, opening a day sheet and showing 3 recommendations each render in ≤ 100 ms on the same profile

Scenario: AC3 Budgets
  Then the JS bundle is ≤ 400 KB gzip and CSS ≤ 50 KB gzip (quality-gate.json budgets)
```

### US-NF-02 Accessibility (WCAG 2.1 AA) · M · M
```gherkin
Scenario: AC1 Automated audit
  Then axe reports 0 serious or critical issues on onboarding, review, calendar, day sheet, recommendations, recipe detail, settings and debug-free production screens, in ja and en

Scenario: AC2 Keyboard-only journey
  Then the E0 journey can be completed with keyboard only, with visible focus

Scenario: AC3 Not color alone, touch size (BR-03)
  Then assessment and decision states are distinguishable without color, and every touch target is at least 44 × 44 CSS px at 360 px width

Scenario: AC4 Screen reader labels for calendar cells
  Then each school-day cell has an accessible name like 「11月4日（水）、苦手かも、給食」
```

### US-NF-03 Privacy: no child data to AI or third parties · M · S
```gherkin
Scenario: AC1 Adapter payload allow-list (BR-10)
  Then a contract test asserts the adapter request contains only: pdf (bytes or URL), targetMonth, prompt version, schema version

Scenario: AC2 Data minimization in the contract (BR-20)
  Then the ChildProfile contract has no field for birthdate, gender, height, weight, photo, real name, school or address, and the validator rejects unknown fields

Scenario: AC3 No analytics or third-party scripts
  Then the production build loads no third-party analytics, ads or tracking scripts
```

### US-NF-04 AI failure and rate-limit resilience · M · S
```gherkin
Scenario: AC1 Everything except import works without AI
  Given the adapter is down
  Then calendar, assessment, decisions, recommendations, reminders, sharing and export all work

Scenario: AC2 Tests never need live AI
  Then the unit and e2e suites run with the AI adapter mocked from fixtures, and live AI evaluations run only in a separate opt-in command

Scenario: AC3 Timeouts
  Then an extraction request is abandoned after 90 s and treated as "unavailable"
```

### US-NF-05 No secrets in the client · M · S
```gherkin
Scenario: AC1 Key stays server-side
  Then the built web assets contain no AI provider key or key-shaped string (validate.mjs secrets passes) and the key is read only by the server adapter from its environment

Scenario: AC2 No paid usage by default
  Then the adapter configuration has no billing-enabled setting turned on by default, the configured models are free-tier model ids (Google AI Studio project without billing, PO decision 2026-10-24), and the README states that paid usage requires PO approval
```

---

## E14 Hosted AI proxy

PO decision (`docs/PLAN.md` §7, 2026-11-09). The two existing proxy endpoints, menu extract (`POST /api/menu/extract`) and menu URL fetch (`POST /api/menu/fetch-pdf`), also run as a hosted service (Firebase Cloud Function, Tokyo `asia-northeast1`, Blaze plan with a budget alert) so the GitHub Pages app can import real menus. The local dev proxy keeps working. This epic states behaviour only; the architecture is the developer's ADR.

**Out of scope / later (no ACs here):** sync or storage of any user data on the server, a self-service request for access, an admin screen for the allow-list, the Capacitor/Android origin (open question Q5), changing the extraction prompt, schema, model chain or the one-call-per-PDF rules (US-E2-04..07 stay as they are), changing the consent flow (US-E2-08 unchanged). The budget alert and other operations steps are the checklist in `docs/ba/data-contract.md` §13.7, not stories.

**Notes (rules for all E14 stories)**
- N1 "Hosted proxy" means the deployed service; "local proxy" means `npm run dev` on 127.0.0.1. Every AC applies to the hosted proxy unless it says "local".
- N2 Hosted error replies are JSON `{ ok: false, error: <code> }` with the codes of data contract §13. No reply contains a stack trace, a provider message, the allow-list or another account's data.
- N3 Tests use a fake ID-token verifier, a fake allow-list, a fake clock, a fake DNS resolver and a mocked provider; no test calls Google, Firebase or Gemini. Only a manual smoke check after deployment uses the real service.
- N4 Items marked DEFAULT are BA proposals the product owner may overturn (`docs/ba/_scratch/e14/open-questions.md`).
- N5 Cost assumption: two accounts, about 1 extraction per account per month plus a handful of URL fetches, so the hosted proxy is expected to stay inside the monthly free quotas of the Blaze plan (the plan needs a billing account, but the free quotas apply). The Gemini key stays an AI Studio free-tier key (US-NF-05/AC2), so Gemini calls stay free. The developer confirms the current quota numbers against Google's pricing pages in the ADR; this epic does not quote them.

### US-E14-01 Every request carries a valid sign-in token · M · M
As the product owner I want the hosted proxy to answer only signed-in users so that strangers cannot spend my AI quota.

```gherkin
Scenario: AC1 No token is refused before any work
  Given a hosted request to either endpoint with no Authorization header
  Then the reply is HTTP 401 with error UNAUTHENTICATED
  And 0 provider calls and 0 outbound fetches are made, and the request body is not read

Scenario Outline: AC2 Invalid tokens are refused the same way
  Given a hosted request whose Authorization header is <header>
  Then the reply is HTTP 401 with error UNAUTHENTICATED, with 0 provider calls and 0 outbound fetches
  Examples:
    | header                                                     |
    | "Bearer " followed by nothing                              |
    | "Basic abc" (not a Bearer scheme)                          |
    | a Bearer token that is not a well-formed ID token          |
    | a Bearer token with a bad signature                        |
    | a Bearer token that has expired                            |
    | a Bearer token issued for a different Firebase project     |

Scenario: AC3 A valid token of an allowed account is accepted
  Given a valid, unexpired ID token of an allowed account (US-E14-02)
  When the request is otherwise valid
  Then it is processed as the local proxy would process it (same request and response shape as the local contract)

Scenario: AC4 The account is the token's uid, never anything the client sends
  Given a valid token for account A and a request that also carries a "uid", "email" or "account" query parameter or header naming account B
  Then the request is handled as account A, and the extra value is ignored (extract still rejects unknown query parameters, as locally)

Scenario: AC5 Preflight needs no token
  Given a browser preflight OPTIONS request from an allowed origin (US-E14-05)
  Then it is answered without a token and does not count toward any limit

Scenario: AC6 The health route exposes nothing
  Given GET /api/health on the hosted proxy
  Then it answers without a token with only { ok: true, version }, and no provider, allow-list or limit information

Scenario: AC7 A refused request costs nothing
  Given any request refused by AC1 or AC2
  Then it does not count toward a limit (US-E14-03) and its body is not stored
```

### US-E14-02 Only allow-listed accounts may use it · M · M
As the product owner I want only me and my spouse to be able to use the hosted proxy so that a valid Google login alone is not enough.

```gherkin
Scenario: AC1 A signed-in account that is not on the list is denied
  Given a valid ID token of an account that is not on the allow-list
  When it calls either endpoint
  Then the reply is HTTP 403 with error NOT_ALLOWED
  And 0 provider calls and 0 outbound fetches are made, and the attempt does not count toward a limit

Scenario: AC2 The allow-list matches the verified account
  Given the allow-list holds the uid or e-mail of the product owner and the spouse
  Then an account is allowed when its uid is listed, or when its e-mail is listed and the token says the e-mail is verified
  And a token with an unverified e-mail that matches only by e-mail is denied (NOT_ALLOWED)
  And e-mail comparison ignores letter case and surrounding spaces

Scenario: AC3 The list is changed without a code change
  Given the allow-list lives in function configuration, not in the repository
  When an operator adds an account and redeploys or reloads the configuration
  Then that account is allowed, and removing it denies it again
  And no real uid or e-mail of an allow-listed person appears in git, in a test fixture (fixtures use clearly fake values), in a log or in a web build

Scenario: AC4 Missing or empty list fails closed
  Given the allow-list is not configured, empty or unreadable
  Then every request that passes the token check is denied with NOT_ALLOWED, and no detail about the configuration is sent to the client

Scenario: AC5 The denial reveals nothing about the list
  When any account is denied
  Then the reply body is identical for every denied account (no hint about who is listed, how many, or why)

Scenario: AC6 Order of checks
  Given a request with an invalid token for an allowed uid, or a valid token for a denied account
  Then the order of outcomes is: an invalid token gives UNAUTHENTICATED (US-E14-01), otherwise a denied account gives NOT_ALLOWED, otherwise limits (US-E14-03) apply
```

### US-E14-03 Per-account limits with clear messages · M · M
As the product owner I want each account limited per hour and per day so that a bug, a loop or a stolen login cannot run up a bill or burn the free AI quota.

```gherkin
Scenario: AC1 Limits are per account and per endpoint (DEFAULT values)
  Then each allowed account has its own counters for extract (DEFAULT 5 per rolling 60 minutes and 20 per Tokyo calendar day, the local proxy's values) and for URL fetch (DEFAULT 30 per rolling 60 minutes and 100 per Tokyo calendar day)
  And the values are set in function configuration, not in code, and one account reaching a limit never affects the other account

Scenario: AC2 Reaching the extract limit answers without calling the provider
  Given an account has used its extract limit for the hour
  When it requests an extraction
  Then the reply is HTTP 429 with error ACCOUNT_LIMIT, scope "hour", retryAfterSec (seconds until the oldest counted request leaves the window, at least 1) and providerCalls 0
  And 0 provider calls are made and the PDF is not forwarded

Scenario: AC3 The daily limit has its own reply
  Given an account has used its extract limit for the Tokyo day but not for the hour
  When it requests an extraction
  Then the reply is HTTP 429 with error ACCOUNT_LIMIT, scope "day", retryAfterSec (seconds until 00:00 JST) and 0 provider calls

Scenario Outline: AC4 The messages shown to the parent
  Given the app receives ACCOUNT_LIMIT with scope <scope>
  Then it shows <ja> / <en> with the upload option and 「手入力する」
  And for scope "hour" the retry button follows the countdown of US-E2-06/AC9 using retryAfterSec; for "day" there is no retry button
  Examples:
    | scope | ja                                                                              | en                                                                                    |
    | hour  | 「読み取りの回数が上限に達しました。1時間ほどしてからもう一度お試しください。」              | "You've reached the reading limit for now. Please try again in about an hour."         |
    | day   | 「今日の読み取り回数の上限に達しました。明日もう一度お試しください。」                     | "You've reached today's reading limit. Please try again tomorrow."                     |
    | fetch | 「URLからの取得回数が上限に達しました。PDFをアップロードするか、しばらくしてからお試しください。」 | "You've reached the limit for fetching from addresses. Upload the PDF, or try again later." |

Scenario: AC5 Counters survive restarts and several instances
  Given an account made 5 extraction requests in the hour, across a cold start or on different instances of the hosted function
  Then the 6th request in that hour is refused with ACCOUNT_LIMIT (the counter is not reset by a restart and is shared by all instances)

Scenario: AC6 What counts, and the cost ceiling
  Then a request counts when it passed token, allow-list and request validation (valid query, size, PDF magic bytes), whether or not the provider then succeeded
  And a request refused for token, allow-list, validation or a limit does not count
  And with the DEFAULT values one account can cause at most 20 extraction requests x 2 provider calls = 40 provider calls per Tokyo day, two accounts 80, which the developer confirms is below the free-tier daily allowance of the configured models (ADR 002)

Scenario: AC7 Limit state holds no menu content or personal data
  Then the stored limit state per account contains only a pseudonymous key (not the e-mail), counts and timestamps

Scenario: AC8 A failed counter does not become unlimited
  Given the counter store cannot be read or written
  Then the request is refused with UNAVAILABLE (HTTP 503) and 0 provider calls are made (fail closed)

Scenario: AC9 The provider's own 429 stays a different message
  Given the account is within its limits but the provider answers rate-limited on both models
  Then the reply is the existing RATE_LIMITED (US-E2-06/AC6), not ACCOUNT_LIMIT
```

### US-E14-04 URL fetch cannot be turned against the cloud (SSRF) · M · L
As the product owner I want the hosted URL fetch to download only public school PDFs so that nobody can use it to reach Google's internal services or my private resources.

```gherkin
Scenario Outline: AC1 Unsafe URLs are refused before any connection
  Given an allowed account requests a fetch of <url>
  Then no connection is made, the reply is the existing "blocked" outcome of US-E2-02/AC3 (the HTTP 403 message), and 0 provider calls are made
  Examples:
    | url                                                                                      |
    | http://example-kinder.test/menu.pdf (not https)                                          |
    | https://example-kinder.test:8443/menu.pdf (port other than 443)                          |
    | https://user:pw@example-kinder.test/menu.pdf (credentials in the URL)                    |
    | https://127.0.0.1/menu.pdf , https://[::1]/menu.pdf , https://localhost/menu.pdf         |
    | https://10.0.0.5/menu.pdf , https://192.168.1.1/menu.pdf , https://172.16.0.1/menu.pdf   |
    | https://169.254.169.254/computeMetadata/v1/ (cloud metadata address)                     |
    | https://metadata.google.internal/ (cloud metadata name)                                  |
    | https://2130706433/ , https://0x7f.1/ , https://0177.0.0.1/ (alternative IPv4 spellings) |
    | https://[::ffff:127.0.0.1]/ , https://[fd00::1]/ , https://[fe80::1]/ (IPv6 forms)       |
    | a URL longer than 2048 characters (BR-14)                                                |

Scenario: AC2 The address actually used is checked, not just the name
  Given the name "kinder-redirect.test" resolves to 10.0.0.5, or to one public and one private address
  Then nothing is downloaded and the reply is the blocked outcome
  And the check applies to the address the connection really uses (a name that is public at check time and private at connect time is still refused)

Scenario: AC3 Every redirect hop is checked again
  Given a public URL that redirects to https://169.254.169.254/ , to a private address, to http:// , or to a non-443 port
  Then the redirect is not followed and the blocked outcome is returned
  And more than 3 redirects ends the same way (US-E2-02/AC3)

Scenario: AC4 Only a PDF of at most 10 MiB comes back
  Given a public URL that serves 10,485,760 bytes of PDF
  Then it is returned
  Given 10,485,761 bytes, a body that does not start with "%PDF-", or an HTML page
  Then it is refused with the existing TOO_LARGE / not-a-PDF outcomes (US-E2-02/AC1, AC3), the download stops at the limit and nothing is passed on

Scenario: AC5 Time is bounded
  Given a server that takes longer than 15 seconds in total
  Then the fetch ends with the existing network/timeout outcome of US-E2-02/AC1 and no further data is read

Scenario: AC6 Nothing of the requester or of the target leaks
  Then the outbound request carries no Authorization header, cookie or Firebase token from the caller
  And on failure the reply never contains the target's status text, headers, body, resolved IP address or internal error text; only the outcome code of the local contract

Scenario: AC7 Failures give the same replies as the local proxy
  Then the 404, 403, timeout and HTML outcomes keep the US-E2-02/AC1 messages and still offer the upload (app code for these is unchanged)
```

### US-E14-05 Browser origins and the secret key · M · M
As the product owner I want only my app's pages to be able to call the hosted proxy from a browser, and the Gemini key to exist only inside the service, so that no copy of the app or the key can be taken from a website.

```gherkin
Scenario: AC1 Allowed origins get CORS headers
  Given the allowed origins are configured (DEFAULT: https://mrdrah.github.io ; the dev origin http://localhost:5173 only when the deployment is configured for it)
  When a request or preflight comes from an allowed origin
  Then the reply names exactly that origin in Access-Control-Allow-Origin (never "*"), allows only the POST and OPTIONS methods and the Authorization and Content-Type headers, and does not allow credentials or cookies

Scenario: AC2 Other origins are not served
  Given a request with Origin "https://evil.example", or any Origin that differs from the configured list in scheme, host, port or trailing text
  Then no Access-Control-Allow-Origin header is sent and the request is refused (HTTP 403, error ORIGIN_NOT_ALLOWED) with 0 provider calls and 0 outbound fetches

Scenario: AC3 A request with no Origin is judged by the token
  Given a request without an Origin header (not from a browser page)
  Then it is neither accepted nor refused because of that; it still needs a valid token and an allow-listed account (US-E14-01, US-E14-02)
  # CORS is a browser rule only; the token and the allow-list are the real protection.

Scenario: AC4 The Gemini key is a function secret only
  Then the hosted function reads the key from its secret store at run time and nowhere else
  And the key is absent from git, from the web build output (validate.mjs secrets passes on dist/), from the variables used by the web build, from function source, from every log line and from every reply body or header

Scenario: AC5 A missing secret is an honest "not configured"
  Given the secret is not set or is empty
  When an allowed account requests an extraction
  Then the reply is the existing NOT_CONFIGURED with 0 provider calls and the app shows the US-E2-06/AC4 message, while the URL-fetch endpoint still works

Scenario: AC6 The web build holds no proxy credential
  Then the web build contains only the proxy's public base URL (US-E14-07) and the Firebase web config of E13; no key, no allow-list entry, no limit value
```

### US-E14-06 Nothing private is logged or stored · M · S
As a parent I want my menu files and account details kept out of the service's logs so that the hosted service keeps nothing about my family.

```gherkin
Scenario: AC1 Logs may contain only operational facts
  Then a log line written by our own code (the platform's own request log, which records the caller's IP address, is outside our code and is not covered; PLAN §7 2026-11-09) may contain only: the endpoint name, the outcome code, HTTP status, duration, provider call count, model id, provider status code and a pseudonymous account key
  And it never contains the PDF or any text of it, the extraction result, the entered URL or its host, the Authorization header or token, the uid, e-mail, name or photo, the caller's IP address, or any child profile data

Scenario: AC2 Errors are logged without content
  Given the provider call fails, the token check fails or an unexpected exception is thrown
  Then the log line holds the outcome code and error class only, with no text copied from the request, the provider reply or a fetched page

Scenario: AC3 Nothing is persisted
  Then neither endpoint stores the PDF, the fetched file or the extraction result on the server (no file, bucket, database or cache entry); only the limit counters of US-E14-03 persist
  And the on-disk sha256 extraction cache of the local proxy is not used on the hosted proxy (the app's own reuse of stored extractions, US-E2-07, still prevents repeat calls)

Scenario: AC4 A test can assert it
  Given a run of every outcome in this epic with a recognisable marker in the PDF text, the URL, the token and the e-mail
  Then the captured log output contains none of the markers

Scenario: AC5 Only the public menu PDF reaches Google, consent unchanged
  Then the request forwarded to the provider is built exactly as locally (US-NF-03/AC1 payload allow-list: the PDF, targetMonth, prompt and schema versions), with no uid, e-mail, token or profile field added
  And the notice and consent of US-E2-08 are shown and required exactly as before, and declining sends 0 requests to the hosted proxy
```

### US-E14-07 The app picks the proxy address from a build variable · M · S
As the product owner I want the web build to know where the hosted proxy is, and local development to keep working unchanged, so that the same app runs on Pages and on my PC.

```gherkin
Scenario: AC1 Build variable selects the hosted base URL
  Given the web build is made with VITE_AI_PROXY_BASE_URL set to an https URL such as "https://asia-northeast1-<project>.cloudfunctions.net/<function>"
  When the app calls extract or fetch
  Then the request goes to that base URL plus the endpoint path ("/api/menu/extract", "/api/menu/fetch-pdf"), with or without a trailing slash on the variable

Scenario: AC2 Variable not set keeps today's behaviour
  Given VITE_AI_PROXY_BASE_URL is not set or empty
  Then the app calls the endpoints on its own origin as it does now (the dev proxy through Vite) and the existing tests pass unchanged

Scenario: AC3 A bad value is not used
  Given the variable is neither an https URL nor http://127.0.0.1 / http://localhost, or contains credentials, a query or a fragment
  Then it is ignored as if unset, one warning naming the variable (never its value) is logged, and no request is sent to it

Scenario: AC4 The token is attached to hosted calls only
  Given the user is signed in (E13) and the base URL is a hosted https address
  When the app calls either endpoint
  Then the request carries "Authorization: Bearer <current ID token>" obtained through the AuthPort (no Firebase type crosses it) and refreshed when expired
  And the token is never put in a URL, never stored by the app, never logged and never exported

Scenario: AC5 Local dev stays token-optional
  Given the app calls the local proxy (own origin, or an http://127.0.0.1 / localhost base)
  Then it works with or without a signed-in user, no Authorization header is added, and the local proxy needs no token

Scenario: AC6 The token goes only to the configured proxy
  Then the app never sends the ID token to any address other than the configured hosted proxy base URL

Scenario: AC7 The deploy variable is a repository variable
  Then the Pages build reads VITE_AI_PROXY_BASE_URL like the VITE_FIREBASE_* values (a repository variable; public by nature, not a secret), and a unit test fails if the built assets contain a Gemini-key-shaped string

Scenario: AC8 Test seam
  Then unit, component and e2e tests use a fake extractor and a fake token source (N3); the e2e build never calls the hosted service
```

### US-E14-08 The app handles an unreachable, denied or limited proxy · M · M
As a parent I want to know why an import did not work and what I can do instead, so that I am never stuck and my data is never harmed.

```gherkin
Scenario: AC1 Token problem
  Given the hosted proxy answers UNAUTHENTICATED
  When the app refreshes the ID token and retries the same request once
  Then if the retry succeeds the import continues
  And otherwise 「ログインの有効期限が切れました。もう一度ログインしてください。」 / "Your sign-in has expired. Please sign in again." is shown with 「ログインし直す」 (signs out, US-E13-05), the upload option and 「手入力する」
  And the first request spent no provider call (the proxy refused it)

Scenario: AC2 Account not allowed
  Given the hosted proxy answers NOT_ALLOWED
  Then 「このアカウントでは献立の読み取りを使えません。」 / "This account can't use menu reading." is shown with 「手入力する」 (the PDF upload is not offered either, because it would also call the hosted extraction), and no retry button
  And every other feature works as before (US-NF-04/AC1)

Scenario: AC3 Limit reached
  Given the hosted proxy answers ACCOUNT_LIMIT
  Then the message and retry rule of US-E14-03/AC4 are shown, and nothing is stored

Scenario: AC4 Hosted proxy unreachable or timing out
  Given the hosted address cannot be reached (offline, DNS failure, CORS failure, HTTP 5xx, no answer in 90 s per US-NF-04/AC3)
  Then the US-E2-06/AC2 message is shown with 「もう一度」, the upload option and 「手入力する」
  And no more than one request is sent per tap (AC1's single token retry is the only exception)

Scenario: AC5 Origin refused
  Given the hosted proxy answers ORIGIN_NOT_ALLOWED
  Then the US-E2-06/AC2 message is shown (the parent cannot fix it) and the developer-facing log notes the code

Scenario: AC6 Unknown reply
  Given the reply is not valid JSON, has an unknown error code, or fails the shared response schema (BR-11)
  Then it is handled as unreachable (AC4) and nothing from the reply is shown or stored

Scenario: AC7 No local data changes on any failure (BR-02, BR-13)
  When any of AC1 to AC6 occurs
  Then stored menus, assessments and decisions are byte-for-byte unchanged (as US-E2-06/AC3)

Scenario: AC8 Signed-out users make no hosted request
  Given no signed-in user and a hosted base URL
  Then the import screen cannot be reached (the login wall of US-E13-01 applies) and no hosted request is made

Scenario: AC9 Messages are plain, bilingual and free of codes
  Then the messages above contain no error code, URL, uid or technical text, exist in Japanese and English, and the designer supplies the final copy (quoted wording is a working label)
```
