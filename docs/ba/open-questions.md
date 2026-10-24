# Open questions and proposed business rules — BentoMinder

Owner: BA · 2026-10-24 · Status: **closed at H1**; H1 fix-round points OQ-16…OQ-20 and M1-prep points OQ-21…OQ-26 have defaults applied (sections at the end) · BR table approved by the PO on 2026-10-24; all 15 open questions decided by the PO on 2026-10-24 (default accepted). Answers are logged in `docs/PLAN.md` §7. No question is open.

## Business rules: Approved 2026-10-24 (PO)
The binding text is `docs/PLAN.md` §3; only the Orchestrator changes it. This is the BA's proposal as approved, kept for history. Where the two differ, PLAN §3 wins, together with the H1 reconciliations noted after the table.

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

H1 reconciliations (PLAN §7, applied in the stories and the data contract):
- **R-1 (BR-10):** at most 2 provider calls per import action: call 1 primary model; call 2 = one repair retry on malformed output **or** the fallback model on rate limit / 5xx / timeout; then stop and offer retry later, upload or manual entry. This supersedes the "0 automatic retries on rate limit" wording in the BR-10 row above (US-E2-05, US-E2-06, US-E2-07).
- **R-2:** decision state names are the data contract's (`school-lunch-planned`, `homemade-bento-planned`, `not-confirmed`, `no-school-lunch`).
- **R-3 (BR-06, OQ-13):** a recipe is excluded on any match of its allergens or may-contain allergens; a recipe with incomplete allergen data is excluded when the child has known allergens, and otherwise shown flagged and ranked last (US-E6-02/AC5–AC6, data contract §4).
- **R-4:** closed by OQ-14 (in-app reminders only on the web).

## Open questions (all decided)
Recommendation first. Only questions that change what gets built. Each decided default is now written into the stories as a definitive AC; the "Alternative" texts are kept for history only.

| # | Question | Proposed default | Impact | Decision |
|---|----------|------------------|--------|----------|
| OQ-01 | What counts as a "school day"? | **A date the confirmed menu lists with ≥ 1 non-snack lunch item** (BR-25). The national holiday calendar never decides it. Alternative: every Mon–Fri except holidays (needs a school calendar we don't have). | Assessment, decisions, reminders, today view. | Decided 2026-10-24 (PO): default accepted |
| OQ-02 | Is 「未定」 (`not-confirmed`) a real state, and who sets it? | **Yes, set only by the parent via 「あとで決める」.** Low-preference days stay `school-lunch-planned` until the parent acts. Alternative: low-preference days start as `not-confirmed` (conflicts with the core rule that the app never changes a decision itself). | State machine, BR-02, weekly reminder content. | Decided 2026-10-24 (PO): default accepted |
| OQ-03 | Does the kindergarten have 「お弁当の日」 (everyone brings a bento), and should those be planned in the app? | **Yes: extracted as no-lunch reason `bento-day`, and the parent can plan a recipe for them** (US-E5-08). Day-before reminders then apply. | Data contract, state machine, US-E5-08. | Decided 2026-10-24 (PO): default accepted |
| OQ-04 | Which fields does the real kindergarten PDF have (dates with 曜日, dishes, 材料 by 赤・黄・緑, allergen line, おやつ, kcal, year/era)? | **Assume the fields in data contract §3.3. The PO shares one real PDF for local calibration only (not committed, not sent to AI without the PO's say-so); test fixtures stay synthetic.** | Extraction prompt and schema, fixtures, US-E2-04 accuracy. | Decided 2026-10-24 (PO): default accepted |
| OQ-05 | Is the 「園で予約済み」 checkbox MVP, and is the reservation reminder v1? | **Checkbox in MVP (Should, US-E5-07/AC3); reminder at the school's cut-off in v1 (US-E7-08).** We need the school's cut-off time for v1. | Scope of E5/E7. | Decided 2026-10-24 (PO): default accepted |
| OQ-06 | How far ahead does the weekly reminder look? | **The 7 days starting the day after the reminder (with the Sunday default: Mon–Sun).** Alternative: 2 weeks (longer message, more planning pressure). | BR-16, US-E7-01. | Decided 2026-10-24 (PO): default accepted |
| OQ-07 | Should おやつ (snacks) on the menu count in the assessment? | **No: shown on the day, not assessed** (lunch is what the bento replaces). | BR-25, assessment fixtures. | Decided 2026-10-24 (PO): default accepted |
| OQ-08 | Are the assessment thresholds right (2 disliked, or 1 disliked with nothing liked → 苦手かも)? | **Yes for the MVP (BR-04)**; the PO can tune them after the first real month. | BR-04, QA oracle. | Decided 2026-10-24 (PO): default accepted |
| OQ-09 | Is a "recipe" one dish or a whole bento box? | **One bento as the source presents it (centrepiece plus the simple sides the source shows)**, so every ingredient is known for the allergen filter. Alternative: single dishes combined by the app (more flexible, needs a composition rule and more recipes). | Recipe contract, research scope, ranking. | Decided 2026-10-24 (PO): default accepted |
| OQ-10 | Show Japanese public holidays on the calendar? | **Could-have (US-E8-04): yes if cheap, from the Cabinet Office (内閣府) holiday list, bundled for 2026–2028.** Holidays never decide school days. | E8, one more sourced data file. | Decided 2026-10-24 (PO): default accepted |
| OQ-11 | Gelatin and diets: exclude gelatin for vegetarian, pescatarian and no-pork? | **Yes, exclude** (its animal origin is rarely stated). | Diet filter (contract §3.8). | Decided 2026-10-24 (PO): default accepted |
| OQ-12 | Does the age range change anything in the MVP? | **No: stored and shown only (seam for portion sizes later).** Age ranges offered: 3歳未満 … 小学校高学年. Alternative: drop the elementary ranges (the brief mentions elementary-school children too). | Profile form, recipes. | Decided 2026-10-24 (PO): default accepted |
| OQ-13 | Recipes with processed foods whose allergens vary (ウインナー, ちくわ, カレールウ): exclude when a possible allergen matches, or only warn? | **Exclude** (BR-06); always show 「表示を確認」 on such recipes. Alternative: warn only (more suggestions for allergic children, higher risk). | BR-06, library coverage for allergic children. | Decided 2026-10-24 (PO): default accepted |
| OQ-14 | Web reminders: in-app only, or also browser notifications while the tab is open? | **In-app only for the MVP** (honest and simple; Android v1 brings real notifications). Alternative: Notification API while the tab is open (permission prompt, still no background). | BR-18, E7. | Decided 2026-10-24 (PO): default accepted |
| OQ-15 | When should the app prompt for next month's menu? | **From the 20th of the month (setting `nextMonthPromptFromDay`, 1–28)**, as menus are usually published before the month starts. Alternative: from the 25th. | US-E3-06/AC2, settings. | Decided 2026-10-24 (PO): default accepted |

## Deferred to v1 (scope approved with the plan, PLAN §1)
- Synced family planning across devices (accounts, roles): MVP shares text only (US-E9).
- Detecting an updated PDF at the saved URL with a change list (US-E3-06/AC4).
- Reservation reminder at the school's cut-off (US-E7-08).
- Android test build with scheduled local notifications (US-E12-02 … 04).

## Still to verify (not questions for the PO; safe defaults apply)
| Item | Default in force | Owner |
|------|------------------|-------|
| Whether the CAA 大豆 item covers 枝豆, and the オレンジ item covers みかん (dictionary §4.2 note) | Conservative: `ing-edamame` carries `alg-soybean` and `ing-mandarin` carries `alg-orange` as inherent allergens, so such recipes are excluded for a child with that allergy | BA, during recipe research |
| Real free-tier rate limits of the two Gemini models (only visible in AI Studio) | 2-call budget per import plus the proxy's own caps (ADR 002) | Developer, when the key is created |
| The school's reservation cut-off time | Needed only for US-E7-08 (v1) | PO, before v1 |

## Raised in the H1 fix round (2026-10-24): proposed defaults for the Orchestrator to confirm or log
The rulings B1, B2, B4–B7, B10, B14 and the "H1 follow-ups confirmed" row (PLAN §7) are applied in the stories, the contract and the dictionary. Applying them literally raised these points. Each has a default already written into the documents; nothing here blocks H1.

| # | Point | Default applied | Impact |
|---|-------|-----------------|--------|
| OQ-16 (**Overruled 2026-10-24 (Orchestrator)**: same food counts once; a dish with its name ingredients and ancestor/descendant ids collapse to the most specific id, see user-stories E4) | B1 counts distinct found ids, so a dish id and an ingredient named in it are two foods when the profile covers both (dislikes `dish-saba-miso` and `ing-mackerel` → D = 2 from 「さばのみそ煮」), and so are a parent and a child id found on one day (鶏肉 and 鶏もも肉 → 2) | Literal B1: both count. Alternative: fold a child id into its parent and a dish into its named ingredients when both are covered (more "one food = one count", more complex) | Assessment oracle, explanation labels |
| OQ-17 (**Accepted** 2026-10-24) | Animal rennet in チーズ: vegetarians who avoid it would need a tag the B14 list doesn't have | `ing-cheese` = `dairy` only (lacto-ovo convention); revisit if the PO wants strict vegetarian | Diet filter, recipes with cheese |
| OQ-18 (**Accepted** 2026-10-24; research brief §4a) | Seven ingredients have unknown animal origin (`?`): パン, パン粉, ソース, カレールウ, シチュールウ, だし, コンソメ. Any recipe using them is excluded for every selected diet until its cited source states the product's ingredients | Keep `?` (B14: unknown → excluded); the recipe research cites product labels where it can | Library coverage for children with a diet |
| OQ-19 (**Accepted** 2026-10-24) | BR-18 phrases ("even when closed", "push notification") are not in `data/banned-phrases.json`, which covers BR-07, BR-19 and judging words only | Keep BR-18 checks in US-E7-06/AC2 (web build only), since Android v1 may legitimately say "notification" | QA string-catalog test |
| OQ-20 (**Accepted** 2026-10-24) | QA N3: a reminder shown but not dismissed: shown again on the next open? | Yes, until it is dismissed or expires (BR-17 "shown on next open until it expires"); to be written as an AC at M4 | US-E7-05, reminder oracle |
| — | QA FX-Q1 (range bands) and FX-Q2 (merged cells): fixture answer-key conventions | Deferred to M1 with QA's proposals (weekdays only; item on each spanned day, `ok` or `uncertain/other` accepted) | Fixtures only |

## Raised in M1 prep (2026-10-24): proposed defaults for the Orchestrator to confirm or log
Each default is already written into the stories, the contract or the dictionary; nothing here blocks M1.

| # | Point | Default applied | Impact |
|---|-------|-----------------|--------|
| OQ-21 | Which months can be imported, and which is preselected? (`import.month.label`; components.md gives only the default) | Exactly the current Tokyo month and the next month; the next month is preselected from `nextMonthPromptFromDay` on, else the current month (US-E2-01/AC5). Alternative: also earlier months (little use: past days are read-only, BR-27) | Import screen, manual entry |
| OQ-22 | When the parent marks a day 「給食なし」 on review, what is preselected and what is the required wording (`originalText`, 1–60)? | Reason 「給食なし（午前保育など）」 preselected; the wording is prefilled with the chosen reason's short label and follows it until the parent types (US-E3-02/AC6) | Review screen |
| OQ-23 | Leaving the review: are edits made so far kept? The design copy promised 「あとで続きから確認できます」, but the contract has no review draft | No draft: 「中断する」 discards edits made since the review opened; the extraction itself stays pending and reopens from 「確認待ちの献立があります」 (US-E3-03/AC5). `review.leave.body` reworded to say so. Alternative: a stored draft (`MenuMonth.reviewDraft`, more contract and migration work) | Review screen, contract |
| OQ-24 | 「今日は表示しない」 on the next-month card: should it survive a reload? | Yes: new root field `nextMonthCardHiddenOn` (data contract §3.1); the card shows again the next Tokyo day (US-E3-06/AC6). Alternative: memory only (simpler, but the card would come back on every reload, contradicting its label) | Store schema (+1 field), calendar |
| OQ-25 | US-E10-03/AC1 wanted `exportedAt` inside the export file, which `unknown-field` rejects | Dropped: the export is the store as is; the date is in the file name (data contract §4 `export-roundtrip`; AC1 retired → AC4). Alternative: an optional envelope field that import ignores (schema change, two shapes to validate) | Export/import |
| OQ-26 | With categories as labels only (dictionary §2), generic menu words that are only a category label no longer match anything: 「くだもの」, 「野菜」, 「きのこ」, 「肉」, 「海そう」 | Leave them unmatched in the MVP (they count towards U like any unknown dish); add generic ingredients (e.g. `ing-fruit` 「くだもの」 with 果物, フルーツ, like `ing-fish` for 「さかな」) only if the PO's real PDF (OQ-04) or the fixtures show such items | Assessment of days with a bare 「くだもの」 item |
