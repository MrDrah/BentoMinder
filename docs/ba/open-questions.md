# Open questions and proposed business rules — BentoMinder

Owner: BA · 2026-10-24 · Status: for PO review (H1). The Orchestrator copies the BR table into `docs/PLAN.md` §3 once the PO agrees, and logs every answer below in §7.

## Proposed business rules
One testable rule per row. Stories cite these ids; the Orchestrator owns the final numbering.

| ID | Rule |
|----|------|
| **BR-01** | Assessment and decision are separate: computing an assessment never reads or writes a decision, and changing a decision never changes an assessment. |
| **BR-02** | A stored decision is created, changed or removed only by an explicit parent action allowed by the decision state machine (`user-stories.md` §E5). Menu import or refresh, assessment, profile edits, reminders and the passage of time change 0 decisions; a low-preference assessment creates 0 plans. |
| **BR-03** | A day is `homemade-bento-planned` only with exactly 1 confirmed `recipeId`. Suggested (low-preference) days and planned days differ in icon and text, never in color alone. |
| **BR-04** | Assessment per school day, with D = distinct disliked ids, L = distinct liked ids, U = share of unmatched/ambiguous dishes: no-lunch day → `no-school-lunch`; no profile or 0 likes and 0 dislikes → `not-assessed`; D ≥ 2 → `low-preference`; D = 1 and L = 0 → `low-preference`; D = 1 and L ≥ 1 → `mixed-uncertain`; D = 0, L ≥ 1 and U ≤ 50% → `likely-enjoyable`; otherwise `mixed-uncertain`. Same inputs always give the same output. |
| **BR-05** | A manual override is stored per date and stays applied across reload, reassessment, profile edits and menu refresh until the parent clears it. |
| **BR-06** | A recipe is never suggested or plannable if any of its `allergenIds` or `mayContainAllergenIds` is a known allergen of the child, any ingredient (or its dictionary parent) is an excluded ingredient, or it violates a selected diet (data contract §3.8). |
| **BR-07** | The app never states or implies allergy safety: every recommendation and recipe screen shows the disclaimer, `allergyStatus = unknown` adds a banner, and 0 catalog strings match the banned-phrase list (US-E6-03/AC2). |
| **BR-08** | Missing allergen information is "unknown", never "none": a menu day without a printed allergen declaration is `not-declared`; `declared-none` requires the PDF's own words. |
| **BR-09** | Suggestions: the top 3 recipes (fewer only if fewer pass BR-06) by score = +2 per liked id, +1 theme match, −3 per disliked id, −2 if the same recipe is planned within ±14 days, −1 if minutes > 20; ties by minutes ascending, then id ascending. |
| **BR-10** | The AI adapter receives only the PDF (bytes or URL), target month, prompt version and schema version (0 child-profile fields). At most 2 provider calls per import action (1 + 1 automatic retry on malformed output or 5xx), 0 automatic retries on rate limit, 0 calls for a PDF whose sha256 was already extracted. |
| **BR-11** | AI output is used only if it validates against `ExtractedMenu` v1: dates are real dates inside the target month; weekday mismatches, duplicate dates and illegible fields are flagged `uncertain`; nothing the PDF does not print is added. |
| **BR-12** | Only a parent-confirmed menu feeds the calendar, assessments and reminders. |
| **BR-13** | Replacing a month's menu keeps 100% of that month's stored decisions and overrides; conflicts it creates are flagged and never resolved automatically. |
| **BR-14** | Import input: URL scheme http or https, ≤ 2,048 characters; file must start with `%PDF-` and be 1 byte – 10 MB (10,485,760 bytes). |
| **BR-15** | All dates are Asia/Tokyo calendar dates and all reminder times are Asia/Tokyo times, whatever the device timezone. |
| **BR-16** | Weekly reminder: default Sunday 14:00, covering the 7 days that start the next day. Day-before reminder: default 17:30 on the day before each `homemade-bento-planned` day, and for no other state. Both configurable in 15-minute steps, and each can be switched off. |
| **BR-17** | One reminder per key (`weekly:<date>`, `day-before:<date>`). A reminder missed while the app was closed is shown on next open until it expires (day-before: 00:00 of the target date; weekly: end of its last covered day). Changing or cancelling a decision updates or removes its reminder in the same action. |
| **BR-18** | The web version shows reminders in-app only, and 0 strings claim notifications while the app or browser is closed. (Android v1: scheduled local notifications.) |
| **BR-19** | The app never reserves, cancels or claims to have reserved a school lunch; `reservationDoneExternally` is set only by the parent and labelled as the parent's own record. |
| **BR-20** | The child profile holds only: optional nickname (≤ 20 chars), age range, likes and dislikes (≤ 30 each, disjoint), allergy status with allergens/excluded ingredients, diet, ≤ 3 themes, note (≤ 200 chars). No birthdate, gender, height, weight, photo, real name or school. |
| **BR-21** | A shared summary contains only dates, decision labels, recipe names and fixed notes: 0 child-profile fields. |
| **BR-22** | Data is stored only on the device in a store with `schemaVersion`; export produces one valid JSON file of the whole store; "delete all" removes 100% of app storage keys after 1 confirmation. |
| **BR-23** | Japanese is the language on first launch whatever the browser language; the ja/EN toggle is within 1 tap of the calendar; 100% of visible UI strings come from the ja/en catalogs. |
| **BR-24** | The debug panel exists only in development builds: the production build contains 0 debug UI and 0 debug marker strings. |
| **BR-25** | A school day is a date in the confirmed menu with ≥ 1 non-snack lunch item. Only school days get assessments and decisions; no-lunch days with reason `bento-day` may also be planned (OQ-03). |
| **BR-26** | The recipe library ships 15–20 recipes, each with ≥ 1 fetched source from the approved list, valid against the Recipe contract and passing the overlap check. |
| **BR-27** | Dates before today (Asia/Tokyo) are read-only: their decisions and overrides cannot change. |

## Open questions
Recommendation first. Only questions that change what gets built.

| # | Question | Proposed default | Impact |
|---|----------|------------------|--------|
| OQ-01 | What counts as a "school day"? | **A date the confirmed menu lists with ≥ 1 non-snack lunch item** (BR-25). The national holiday calendar never decides it. Alternative: every Mon–Fri except holidays (needs a school calendar we don't have). | Assessment, decisions, reminders, today view. |
| OQ-02 | Is 「未定」 (`not-confirmed`) a real state, and who sets it? | **Yes, set only by the parent via 「あとで決める」.** Low-preference days stay `school-lunch-planned` until the parent acts. Alternative: low-preference days start as `not-confirmed` (conflicts with the core rule that the app never changes a decision itself). | State machine, BR-02, weekly reminder content. |
| OQ-03 | Does the kindergarten have 「お弁当の日」 (everyone brings a bento), and should those be planned in the app? | **Yes: extracted as no-lunch reason `bento-day`, and the parent can plan a recipe for them** (US-E5-08). Day-before reminders then apply. | Data contract, state machine, US-E5-08. |
| OQ-04 | Which fields does the real kindergarten PDF have (dates with 曜日, dishes, 材料 by 赤・黄・緑, allergen line, おやつ, kcal, year/era)? | **Assume the fields in data contract §3.3. The PO shares one real PDF for local calibration only (not committed, not sent to AI without the PO's say-so); test fixtures stay synthetic.** | Extraction prompt and schema, fixtures, US-E2-04 accuracy. |
| OQ-05 | Is the 「園で予約済み」 checkbox MVP, and is the reservation reminder v1? | **Checkbox in MVP (Should, US-E5-07/AC3); reminder at the school's cut-off in v1 (US-E7-08).** We need the school's cut-off time for v1. | Scope of E5/E7. |
| OQ-06 | How far ahead does the weekly reminder look? | **The 7 days starting the day after the reminder (with the Sunday default: Mon–Sun).** Alternative: 2 weeks (longer message, more planning pressure). | BR-16, US-E7-01. |
| OQ-07 | Should おやつ (snacks) on the menu count in the assessment? | **No: shown on the day, not assessed** (lunch is what the bento replaces). | BR-25, assessment fixtures. |
| OQ-08 | Are the assessment thresholds right (2 disliked, or 1 disliked with nothing liked → 苦手かも)? | **Yes for the MVP (BR-04)**; the PO can tune them after the first real month. | BR-04, QA oracle. |
| OQ-09 | Is a "recipe" one dish or a whole bento box? | **One bento as the source presents it (centrepiece plus the simple sides the source shows)**, so every ingredient is known for the allergen filter. Alternative: single dishes combined by the app (more flexible, needs a composition rule and more recipes). | Recipe contract, research scope, ranking. |
| OQ-10 | Show Japanese public holidays on the calendar? | **Could-have (US-E8-04): yes if cheap, from the Cabinet Office (内閣府) holiday list, bundled for 2026–2028.** Holidays never decide school days. | E8, one more sourced data file. |
| OQ-11 | Gelatin and diets: exclude gelatin for vegetarian, pescatarian and no-pork? | **Yes, exclude** (its animal origin is rarely stated). | Diet filter (contract §3.8). |
| OQ-12 | Does the age range change anything in the MVP? | **No: stored and shown only (seam for portion sizes later).** Age ranges offered: 3歳未満 … 小学校高学年. Alternative: drop the elementary ranges (the brief mentions elementary-school children too). | Profile form, recipes. |
| OQ-13 | Recipes with processed foods whose allergens vary (ウインナー, ちくわ, カレールウ): exclude when a possible allergen matches, or only warn? | **Exclude** (BR-06); always show 「表示を確認」 on such recipes. Alternative: warn only (more suggestions for allergic children, higher risk). | BR-06, library coverage for allergic children. |
| OQ-14 | Web reminders: in-app only, or also browser notifications while the tab is open? | **In-app only for the MVP** (honest and simple; Android v1 brings real notifications). Alternative: Notification API while the tab is open (permission prompt, still no background). | BR-18, E7. |
| OQ-15 | When should the app prompt for next month's menu? | **From the 20th of the month (setting `nextMonthPromptFromDay`, 1–28)**, as menus are usually published before the month starts. Alternative: from the 25th. | US-E3-06/AC2, settings. |

## Deferred (proposed for §7 as "deferred to v1")
- Synced family planning across devices (accounts, roles): MVP shares text only (US-E9).
- Detecting an updated PDF at the saved URL with a change list (US-E3-06/AC4).
- Reservation reminder at the school's cut-off (US-E7-08).
- Android test build with scheduled local notifications (US-E12-02 … 04).
