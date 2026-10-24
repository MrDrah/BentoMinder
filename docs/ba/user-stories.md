# User stories — BentoMinder

Owner: BA · 2026-10-24 · Status: **draft for PO review (H1)** · Rules: proposed BR table in `docs/ba/open-questions.md` (to be copied into `docs/PLAN.md` §3) · Data: `docs/ba/data-contract.md` · Terms: `docs/ba/domain-dictionary.md` · QA traces tests to these IDs (`validate.mjs trace`).

Acceptance criteria are numbered per story: `Scenario: AC1 …` has the full ID `US-E1-01/AC1`. Tests name the full AC ID; milestone evidence counts an AC as verified only when an executed test that names it passed. Never renumber an AC once a test names it; retire it and add a new number.

Priority: **M**ust / **S**hould / **C**ould / **W**on't (MoSCoW) · Size: S / M / L · `(v1)` in a title means the story is out of the MVP and must not be built before the PO approves v1.

## Conventions used in the ACs
- "Today" is the simulated or real date **in Asia/Tokyo** (BR-15). Dates are written `YYYY-MM-DD`; weekdays were checked against a calendar (2026-11-03 Tue 文化の日, 2026-11-23 Mon 勤労感謝の日, 2026-11-30 Mon, 2027-01-29 Fri, 2027-02-01 Mon, 2028-02-29 Tue).
- "The fixture menu" is the synthetic test menu `fixture-menu-2026-11` (November 2026, kindergarten style, see `docs/ba/data-contract.md` §5). Fixtures are synthetic and never presented as a real school's menu.
- "Sample child" is the debug profile: likes 鶏肉, たまご, とうもろこし, theme どうぶつ; dislikes ピーマン, なす, さかな (category); allergy status `has-known` with `alg-shrimp`; no diet restriction.
- Visible text in the ACs is the proposed Japanese copy; the Designer owns final copy, and tests should assert on the translation key or the role/label, not the literal string, unless the AC says "exact".
- Assessment states: `likely-enjoyable`, `mixed-uncertain`, `low-preference`, `not-assessed`, `no-school-lunch`. Decision states: `school-lunch-planned` (default), `homemade-bento-planned`, `not-confirmed`, `no-school-lunch`.

## Story index
| Epic | Stories | Scope |
|------|---------|-------|
| E0 End-to-end journey | US-E0-01 | MVP |
| E1 Onboarding & profile | US-E1-01 … 06 | MVP |
| E2 Menu import & AI extraction | US-E2-01 … 08 | MVP |
| E3 Menu review, confirm & refresh | US-E3-01 … 06 | MVP (US-E3-06/AC4 is v1) |
| E4 Preference assessment & overrides | US-E4-01 … 05 | MVP |
| E5 Calendar & family decisions | US-E5-01 … 08 | MVP |
| E6 Bento recommendations & recipes | US-E6-01 … 07 | MVP |
| E7 Reminders & today view | US-E7-01 … 08 | MVP (E7-08 v1) |
| E8 Localization | US-E8-01 … 04 | MVP |
| E9 Sharing | US-E9-01 … 02 | MVP |
| E10 Data | US-E10-01 … 05 | MVP |
| E11 Debug panel | US-E11-01 … 03 | MVP |
| E12 Android | US-E12-01 … 04 | MVP (E12-01) / v1 (E12-02 … 04) |
| NF Non-functional | US-NF-01 … 05 | MVP |

---

## E0 End-to-end journey

### US-E0-01 Plan a homemade bento day from the school's PDF · M · L
As the planning parent I want to go from the kindergarten's monthly PDF to a confirmed bento day with a recipe and a reminder so that nobody in the family forgets it.

```gherkin
Scenario: AC1 Main journey (mocked AI, Playwright)
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

Scenario: AC2 The journey survives a reload
  Given the journey in AC1 has been completed
  When the page is reloaded
  Then the calendar opens directly (no onboarding)
  And 2026-11-04 still shows the confirmed recipe
  And the stored profile, confirmed menu and decision are unchanged

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
  Then onboarding step 1 of 3 「お子さまのこと」 is shown
  And a step indicator shows 3 steps: profile, menu, review

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
  Given the parent is on step 2
  When the parent chooses 「あとで取り込む」
  Then the calendar is shown with no assessments
  And an empty-state card 「今月の献立がまだありません」 offers 「献立を取り込む」
```

### US-E1-02 Create the child profile · M · M
As a parent I want to describe my child's tastes with simple controls so that the app can flag meals and suggest bentos.

```gherkin
Scenario: AC1 Minimal valid profile
  Given onboarding step 1 is shown
  When the parent selects age range 「年中（4〜5歳）」 and allergy status 「特になし」 and taps 「次へ」
  Then a profile is stored with nickname absent, ageRange "age-4-5", allergyStatus "none-known"
  And empty likes, dislikes, diet and theme lists

Scenario: AC2 Structured preferences use dictionary ids
  Given step 1 is shown
  When the parent picks likes 「鶏肉」「たまご」 and dislikes 「ピーマン」 and the category 「さかな」
  Then the stored profile has likedIds ["ing-chicken","ing-egg"] and dislikedIds ["ing-green-pepper","cat-fish"]

Scenario: AC3 The same id cannot be both liked and disliked
  Given 「ピーマン」 is in dislikes
  When the parent adds 「ピーマン」 to likes
  Then it is moved from dislikes to likes and a short notice says it was moved
  And the stored profile never contains the same id in both lists

Scenario: AC4 Age range is required
  Given no age range is selected
  When the parent taps 「次へ」
  Then the profile is not stored
  And the age-range control shows 「年齢を選んでください」 and receives focus

Scenario: AC5 Nickname length boundary
  Given the nickname field
  When the parent enters 20 characters
  Then it is accepted
  When the parent enters 21 characters
  Then input stops at 20 characters
  And a nickname of only spaces is stored as absent

Scenario: AC6 No unnecessary personal data is asked
  Given step 1 is shown
  Then there is no field for birthdate, gender, height, weight, photo, full name or school name

Scenario: AC7 Free-text note is optional and never used for filtering
  Given the parent writes 「野菜は細かく切ると食べます」 in the note (max 200 characters)
  When the profile is stored
  Then the note is saved
  And the note is not used by assessment, ranking or filtering
  And the note is never sent to the AI adapter
```

### US-E1-03 Record allergies, or explicitly record that they are unknown · M · M
As a parent I want to state known allergies, or say I don't know yet, so that unsafe recipes are never suggested and the app is honest about what it can't check.

```gherkin
Scenario: AC1 Known allergies from the Japanese labelling list
  Given allergy status 「アレルギーあり」 is selected
  When the parent picks 「えび」 and 「卵」
  Then the profile stores allergyStatus "has-known" and knownAllergenIds ["alg-shrimp","alg-egg"]

Scenario: AC2 Allergy outside the labelling list
  Given allergy status 「アレルギーあり」
  When the parent searches 「トマト」 and adds it under 「その他の食材」
  Then the profile stores excludedIngredientIds ["ing-tomato"]
  And recipes containing ing-tomato are filtered exactly like allergens (BR-06)

Scenario: AC3 Status is required and has three explicit options
  Given step 1 is shown
  Then the allergy status offers exactly 「特になし」「アレルギーあり」「わからない・未確認」
  And no option is preselected
  When the parent taps 「次へ」 without choosing
  Then the profile is not stored and the control shows an error

Scenario: AC4 "Has known" with nothing selected is invalid
  Given allergy status 「アレルギーあり」 with no allergen and no other ingredient selected
  When the parent taps 「次へ」
  Then the profile is not stored
  And the message 「アレルギーの食材を1つ以上選んでください」 is shown

Scenario: AC5 Unknown status is shown wherever recipes are shown
  Given allergyStatus "unknown"
  When the parent opens recommendations or a recipe detail
  Then a banner 「アレルギー情報が未登録です。材料の表示を必ずご確認ください。」 is shown above the recipes

Scenario: AC6 Allergy screen never promises safety
  Given any allergy status
  When step 1 is shown
  Then the helper text states the app filters recipes by the registered information only
  And no text on the screen contains a safety guarantee (e.g. 「安全です」「アレルギー対応済み」)
```

### US-E1-04 Diet preferences and themes · S · S
As a parent I want to set diet preferences and favourite themes so that suggestions fit our family.

```gherkin
Scenario: AC1 Diet preference is a hard filter
  Given the parent selects diet 「豚肉なし」 (no-pork)
  When recommendations are generated for any day
  Then no suggested recipe contains an ingredient of category cat-pork or with allergen alg-pork

Scenario: AC2 Several diet preferences combine
  Given diets ["no-pork","no-beef"]
  Then recipes containing pork or beef are both excluded

Scenario: AC3 Themes are optional and limited
  Given the theme picker 「すきなテーマ」 with 8 options
  When the parent selects 3 themes
  Then they are stored as themeIds
  When the parent tries to select a 4th theme
  Then the selection is refused with 「テーマは3つまで選べます」
```

### US-E1-05 Edit the profile · M · S
As a parent I want to change my child's preferences later so that assessments follow their changing tastes.

```gherkin
Scenario: AC1 Editing re-runs the assessment but keeps decisions
  Given the November menu is confirmed and 2026-11-04 is low-preference because of ピーマン and なす
  And 2026-11-04 has decision homemade-bento-planned
  When the parent removes なす and ピーマン from dislikes and saves
  Then the assessment of 2026-11-04 is recalculated (no longer low-preference)
  And the decision of 2026-11-04 is still homemade-bento-planned with the same recipe

Scenario: AC2 Adding an allergy invalidates a conflicting planned recipe without deleting it
  Given 2026-11-04 is planned with a recipe that contains alg-egg
  When the parent adds 「卵」 to known allergies and saves
  Then 2026-11-04 keeps its decision and recipe
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
  Then a confirmation dialog explains that menus and plans are kept, and offers 「削除する」 and 「キャンセル」

Scenario: AC2 Deleting the profile keeps menus and decisions but clears assessments
  Given a profile, a confirmed menu and 2 homemade-bento decisions
  When the parent confirms deletion
  Then the profile is removed from storage
  And every assessment becomes not-assessed (manual overrides are removed with the profile)
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

Scenario: AC2 Only http and https URLs are accepted
  When the parent enters "ftp://example.test/menu.pdf", "javascript:alert(1)" or "menu.pdf"
  Then the import is not started
  And 「PDFのURL（https://…）を入力してください」 is shown

Scenario: AC3 URL length boundary
  When the parent enters a URL of 2048 characters
  Then it is accepted for import
  When the parent enters a URL of 2049 characters
  Then it is rejected with the URL error message

Scenario: AC4 Saved URL is offered for the next month
  Given a source URL was stored from the November import
  When the parent opens 「献立を取り込む」 again
  Then the URL field is prefilled with the stored URL and can be edited
```

### US-E2-02 Fall back to upload when the URL can't be retrieved · M · M
As a parent I want a clear way to upload the PDF myself when the link doesn't work so that I'm never stuck.

```gherkin
Scenario Outline: AC1 Retrieval failures offer upload and keep the URL
  Given the adapter returns <failure> for the entered URL
  When the import runs
  Then no AI extraction is requested
  And the message <message> is shown with a 「PDFファイルを選ぶ」 button
  And the entered URL is kept in the field
  Examples:
    | failure                         | message                                                      |
    | network error / timeout (15 s)  | 「URLから取得できませんでした。PDFをアップロードしてください。」 |
    | HTTP 404                        | 「ファイルが見つかりませんでした。…」                           |
    | HTTP 403 / blocked (CORS-type)  | 「このサイトからは自動で取得できません。…」                      |
    | response is HTML, not a PDF     | 「PDFではないようです。…」                                    |

Scenario: AC2 Upload after a failed URL keeps the URL as source reference
  Given a URL import failed
  When the parent uploads the PDF file
  Then the extraction runs on the uploaded file
  And the stored source records both the filename and the URL the parent entered
```

### US-E2-03 Upload a PDF file · M · S
As a parent I want to upload the PDF from my phone so that I can import a menu I received another way.

```gherkin
Scenario: AC1 Valid PDF upload
  When the parent selects "fixture-menu-2026-11.pdf" (application/pdf, starts with "%PDF-", 380 KB)
  Then the extraction runs and the review screen opens

Scenario: AC2 Non-PDF file is rejected before any AI call
  When the parent selects "menu.jpg" or a file renamed to ".pdf" whose first bytes are not "%PDF-"
  Then no AI extraction is requested
  And 「PDFファイルを選んでください」 is shown

Scenario: AC3 Size boundary
  When the parent selects a valid PDF of exactly 10 MB (10,485,760 bytes)
  Then it is accepted
  When the parent selects a valid PDF of 10,485,761 bytes
  Then it is rejected with 「ファイルが大きすぎます（10MBまで）」 and no AI call is made

Scenario: AC4 Empty or encrypted PDF
  When the parent selects a 0-byte file or a password-protected PDF
  Then no AI extraction is requested (0-byte) or the adapter returns "unreadable-pdf"
  And 「このPDFは読み取れませんでした」 is shown with the upload option
```

### US-E2-04 Extract the menu with AI into validated JSON · M · L
As a parent I want the app to read the Japanese menu for me so that I only have to check it, not type it.

```gherkin
Scenario: AC1 Fixture extraction maps every dish to the right date
  Given the mocked adapter returns the recorded extraction for fixture-menu-2026-11
  When the extraction is validated
  Then it passes the ExtractedMenu schema
  And every dish in the fixture's answer key appears under the same date, with no extra dishes

Scenario: AC2 Missing fields stay missing (no invention)
  Given the source PDF lists no ingredients for 2026-11-10
  Then the extracted day for 2026-11-10 has ingredients absent and ingredientsStatus "not-listed"
  And it does not contain ingredients guessed from the dish name

Scenario: AC3 Unlisted allergens are "not declared", never "none"
  Given the PDF declares allergens only for some days
  Then days without a declaration have allergenDeclaration.status "not-declared"
  And no day has an empty allergen list marked as "declared" unless the PDF explicitly says 「アレルゲンなし」 or equivalent

Scenario: AC4 Uncertain readings are flagged per field
  Given a dish name the model could only partly read
  Then that field carries verification "uncertain" with a reason
  And the review screen highlights it

Scenario: AC5 Days without school lunch are extracted
  Given the PDF marks 2026-11-20 as 「お弁当の日」 and 2026-11-27 as 「午前保育（給食なし）」
  Then both dates are listed in noLunchDays with their reason ("bento-day", "no-lunch") and original text

Scenario: AC6 Source metadata is recorded
  Then the extraction has source.sha256 (64 hex chars) of the PDF bytes, source.fetchedAt (ISO 8601 with +09:00 or Z), source.model, and source.url or source.filename

Scenario: AC7 The AI request contains no child data
  Given a profile with nickname 「はなちゃん」 and known allergens
  When an extraction is requested
  Then the adapter request body contains only the PDF bytes, the fixed extraction prompt, the target month and the response schema
  And it contains none of: the nickname, age range, likes, dislikes, allergens, diet, themes, note
```

### US-E2-05 Reject malformed or impossible AI output · M · M
As a parent I want broken extractions caught before they reach my calendar so that I never plan from wrong dates.

```gherkin
Scenario: AC1 Non-JSON or schema-invalid output is retried once
  Given the adapter returns text that is not valid JSON on the first call and valid JSON on the second
  When the extraction runs
  Then exactly 2 calls are made and the review screen shows the second result

Scenario: AC2 Second failure stops without saving
  Given the adapter returns schema-invalid JSON twice
  When the extraction runs
  Then exactly 2 calls are made
  And nothing is stored
  And 「献立を読み取れませんでした。時間をおいて再度お試しください。」 is shown with 「もう一度」 and the upload option

Scenario: AC3 Impossible dates are rejected
  Given the extraction for "2027-02" contains the date 2027-02-29
  Then validation fails with the rule "date-invalid" and the result is treated as malformed

Scenario: AC4 Dates outside the target month are rejected
  Given the target month is 2026-11 and the extraction contains 2026-12-01
  Then that day is removed, and the review screen lists it under 「対象月以外の日付（取り込みません）」

Scenario: AC5 Weekday mismatch is flagged, not silently fixed
  Given the PDF printed 「4日（木）」 and the extraction says date 2026-11-04 with printedWeekday "木"
  Then the day is flagged verification "uncertain" with reason "weekday-mismatch" (2026-11-04 is a Wednesday)
  And the parent must confirm or correct the date on review

Scenario: AC6 Duplicate dates are merged for review, not dropped
  Given the extraction lists 2026-11-05 twice
  Then the review screen shows one 2026-11-05 entry containing all items from both, flagged "uncertain" with reason "duplicate-date"
```

### US-E2-06 Rate limits and service outages · M · M
As a parent I want an honest message when the AI service is busy so that I know what to do.

```gherkin
Scenario: AC1 Rate limit is not retried automatically
  Given the adapter responds with status "rate-limited" and retryAfterSeconds 60
  When the extraction runs
  Then exactly 1 call is made
  And 「混み合っています。1分ほどしてからもう一度お試しください。」 is shown
  And the 「もう一度」 button is disabled for 60 seconds

Scenario: AC2 Service unavailable
  Given the adapter responds "unavailable" (timeout 60 s or HTTP 5xx) twice
  Then at most 2 calls are made
  And the message offers retry later, and states that existing menus and plans are unaffected

Scenario: AC3 Existing data is untouched by any failure
  Given a confirmed November menu and plans exist
  When a December import fails for any reason
  Then the November menu, assessments and decisions are byte-for-byte unchanged in storage

Scenario: AC4 Adapter not configured
  Given the server adapter has no API key configured
  When an extraction is requested
  Then the adapter responds "not-configured" without calling the provider
  And the app shows 「読み取り機能が設定されていません」 (in dev, with a hint to use the debug sample menu)
```

### US-E2-07 One AI extraction per month · M · S
As the product owner I want at most one AI call per monthly PDF so that the free tier is enough.

```gherkin
Scenario: AC1 Same PDF is not extracted twice
  Given an extraction for sha256 H was stored (confirmed or not)
  When the parent imports a PDF with the same sha256 H
  Then no AI call is made
  And the stored extraction is reopened on the review screen with 「同じファイルです」

Scenario: AC2 Retry budget per import
  Then a single import action makes at most 2 AI calls in total (1 attempt + 1 automatic retry), whatever the failure

Scenario: AC3 Call counter is visible in the debug panel
  Given 3 extraction calls were made this month
  Then the debug panel shows "AI calls this month: 3"
```

### US-E2-08 Privacy notice before the first extraction · M · S
As a parent I want to know what is sent to the AI provider before it happens so that I can decide.

```gherkin
Scenario: AC1 First extraction asks for consent
  Given no consent is stored
  When the parent starts the first import
  Then a notice explains that only the menu PDF is sent to the AI provider, that no child information is sent, and summarises the provider's data-use terms for the tier in use with a link to them
  # The terms text comes from the Developer's provider review (verified against the provider's current terms), not from this story
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
```

---

## E3 Menu review, confirm & refresh

### US-E3-01 Review the extracted menu · M · M
As a parent I want to see the extracted month next to its flags so that I can quickly check it.

```gherkin
Scenario: AC1 Review lists every date in the target month with its status
  Given the fixture extraction for 2026-11
  When the review screen opens
  Then every weekday (Mon–Fri) of November 2026 is listed in date order with weekday labels
  And each day shows its dishes, or 「給食なし」 with the reason, or 「献立に記載なし」 when the PDF has no entry for that weekday
  And weekend dates appear only if the PDF lists them

Scenario: AC2 Uncertain fields are highlighted and counted
  Given 3 fields have verification "uncertain"
  Then a summary 「確認が必要な項目：3件」 is shown at the top
  And each uncertain field is marked with an icon and a text label (not color only)
  And 「次の要確認へ」 moves focus to the next uncertain field

Scenario: AC3 The source PDF can be opened for comparison
  When the parent taps 「元のPDFを見る」
  Then the uploaded file (or the source URL) opens in a new view
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

Scenario: AC3 Mark a day as no school lunch, or restore it
  When the parent marks 2026-11-27 as 「給食なし」 with reason 「行事」
  Then 2026-11-27 moves to noLunchDays and its dishes are kept hidden but restorable until confirmation

Scenario: AC4 Dish name boundary
  When the parent enters a dish name of 40 characters
  Then it is accepted
  When the parent enters 41 characters or only whitespace
  Then 「料理名は1〜40文字で入力してください」 is shown and confirm is disabled

Scenario: AC5 Item count boundary per day
  Given a day with 12 dishes
  Then 「料理を追加」 is disabled for that day with the hint 「1日12品まで」
```

### US-E3-03 Confirm the menu · M · S
As a parent I want to confirm the menu in one tap so that the calendar uses it.

```gherkin
Scenario: AC1 Confirm stores a ConfirmedMenu and opens the calendar
  When the parent taps 「この内容で確定」
  Then a ConfirmedMenu for 2026-11 is stored with confirmedAt and a link to its extraction
  And assessments for November are calculated
  And the calendar shows November 2026

Scenario: AC2 Unresolved uncertain fields need an explicit acknowledgement
  Given 2 fields are still "uncertain"
  When the parent taps 「この内容で確定」
  Then a dialog asks 「確認が必要な項目が2件あります。このまま確定しますか？」
  And on 「確定する」 those fields are stored as "uncertain-accepted"
  And days with uncertain-accepted dish fields are assessed at most mixed-uncertain unless a disliked item is certain

Scenario: AC3 Unconfirmed extractions are never used
  Given an extraction was reviewed but not confirmed and the app was closed
  When the app opens
  Then the calendar shows no assessments for that month
  And a card 「確認待ちの献立があります」 reopens the review
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
Scenario: AC1 Refresh keeps every decision and override
  Given November is confirmed with 2026-11-04 homemade-bento-planned (recipe R), 2026-11-11 not-confirmed and an override on 2026-11-18
  When the parent imports and confirms a new November extraction
  Then 2026-11-04 is still homemade-bento-planned with recipe R
  And 2026-11-11 is still not-confirmed
  And the override on 2026-11-18 is still applied
  And all other assessments are recalculated from the new menu

Scenario: AC2 Conflicts are flagged, never auto-resolved
  Given 2026-11-04 is homemade-bento-planned
  When the refreshed menu marks 2026-11-04 as 「給食なし」 (no-lunch)
  Then 2026-11-04 keeps decision homemade-bento-planned and its recipe
  And the day shows 「献立の更新で、この日は給食なしになりました。予定を確認してください。」
  And the conflict appears in the upcoming summary until the parent changes or acknowledges it

Scenario: AC3 Changed dishes on an overridden day are flagged
  Given 2026-11-18 has a manual override
  When the refreshed menu changes the dishes of 2026-11-18
  Then the override is kept
  And the day shows 「献立が変わりました。評価を見直してください。」

Scenario: AC4 Replacing asks for confirmation and states that plans are kept
  Given a confirmed menu exists for 2026-11
  When the parent starts an import for 2026-11
  Then a dialog says the current menu will be replaced and that 「お弁当の予定は変更されません」

Scenario: AC5 Refresh is atomic
  Given a refresh is in progress
  When the new extraction fails validation or the parent cancels review
  Then the previous confirmed menu remains the active one
```

### US-E3-06 Detect that the menu is outdated or missing · M · S
As a parent I want to be told when the menu I'm looking at is out of date so that I don't plan on old information.

```gherkin
Scenario: AC1 Current month without a confirmed menu
  Given today is 2026-12-01 JST and only November is confirmed
  When the calendar opens on December 2026
  Then a card 「12月の献立がまだありません」 with 「献立を取り込む」 is shown
  And no December day shows an assessment

Scenario: AC2 Next month reminder from the 20th
  Given today is 2026-11-20 JST and December is not confirmed
  Then the calendar shows 「来月（12月）の献立を取り込みましょう」 once per day until December is confirmed
  Given today is 2026-11-19
  Then that card is not shown

Scenario: AC3 Viewing a past month is not "outdated"
  Given the parent navigates to October 2026 which has a confirmed menu
  Then no outdated warning is shown for October

Scenario: AC4 (v1) Changed source PDF is detected
  Given the stored source URL for November and a stored sha256 H1
  When the parent taps 「更新を確認」 and the adapter returns a PDF with sha256 H2 ≠ H1
  Then 「園の献立が更新されています」 is shown with 「取り込み直す」
  And no AI call is made until the parent taps it
```

---

## E4 Preference assessment & overrides

Assessment rule (proposed BR-04, applied per school day of a confirmed menu, deterministic, no AI):
`D` = number of distinct dictionary ids found in the day's items (dish names and listed ingredients) that the child dislikes directly or through their category; `L` = same for likes; `U` = share of the day's dishes with no dictionary match or with an unresolved ambiguity.
1. Day is a no-lunch day → `no-school-lunch`. 2. No profile, or profile with 0 likes and 0 dislikes → `not-assessed`. 3. `D ≥ 2` → `low-preference`. 4. `D = 1` and `L = 0` → `low-preference`. 5. `D = 1` and `L ≥ 1` → `mixed-uncertain`. 6. `D = 0`, `L ≥ 1` and `U ≤ 50%` → `likely-enjoyable`. 7. Otherwise → `mixed-uncertain`.

### US-E4-01 Assess each school day deterministically · M · M
As a parent I want the app to flag days my child probably won't enjoy so that I know where to look.

```gherkin
Scenario: AC1 Two disliked ingredients make a low-preference day
  Given the sample child (dislikes ing-green-pepper, ing-eggplant, cat-fish)
  And 2026-11-04 lists 「ピーマンとなすのみそ炒め」「ごはん」「すまし汁」
  When November is assessed
  Then 2026-11-04 is low-preference with D = 2

Scenario Outline: AC2 Rule table
  Given a day whose items give D = <D>, L = <L>, U = <U>
  Then the assessment is <state>
  Examples:
    | D | L | U    | state             |
    | 2 | 3 | 0%   | low-preference    |
    | 1 | 0 | 0%   | low-preference    |
    | 1 | 1 | 0%   | mixed-uncertain   |
    | 0 | 1 | 50%  | likely-enjoyable  |
    | 0 | 1 | 51%  | mixed-uncertain   |
    | 0 | 0 | 0%   | mixed-uncertain   |

Scenario: AC3 Category dislikes match every ingredient in the category
  Given the child dislikes cat-fish
  When a day lists 「さけのしおやき」
  Then ing-salmon counts towards D through cat-fish

Scenario: AC4 Synonyms and scripts map to one id
  Given the child dislikes ing-carrot
  When days list 「にんじん」「人参」「ニンジン」 respectively
  Then each counts as ing-carrot, and each id is counted once per day however often it appears

Scenario: AC5 Longest match wins inside a dish name
  Given the child likes ing-corn
  When a day lists 「コーンスープ」
  Then dish-corn-soup and ing-corn are both matched (dish first, then the ingredient words in its name)
  And 「とうもろこし」 inside a longer unknown word still matches ing-corn

Scenario: AC6 Ambiguous words never decide the state
  Given a day lists only 「カレー」 with no other context
  Then 「カレー」 is treated as unresolved (amb-curry) and counts towards U
  And the review screen lets the parent choose 「カレーライス（料理）」 or 「カレー粉（調味料）」, and the choice is stored for that item

Scenario: AC7 Reproducible
  Given the same profile and the same confirmed menu
  When the assessment runs 100 times, in ja and in en, with the device timezone set to Asia/Tokyo and to America/Los_Angeles
  Then all results are identical

Scenario: AC8 No lunch and not assessed
  Given 2026-11-27 is a no-lunch day and the profile has no likes and no dislikes
  Then 2026-11-27 is no-school-lunch and every other November school day is not-assessed
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
```

### US-E4-03 Override an assessment · M · S
As a parent I want to correct an assessment so that the calendar reflects what I know about my child.

```gherkin
Scenario: AC1 Set an override
  Given 2026-11-12 is likely-enjoyable
  When the parent sets 「苦手かも」 (low-preference) on 2026-11-12
  Then the day shows low-preference with the label 「手動で変更」
  And the stored assessment keeps both the calculated state and the override

Scenario: AC2 Override persists across reload, profile edits, reassessment and menu refresh
  Given an override on 2026-11-12
  When the page is reloaded, the profile is edited, and the November menu is refreshed
  Then the override is still applied after each step

Scenario: AC3 Clear the override
  When the parent chooses 「自動判定に戻す」
  Then the calculated state is shown again and the 「手動で変更」 label disappears

Scenario: AC4 Overrides are limited to school days
  Given 2026-11-27 is a no-lunch day
  Then no override control is offered for 2026-11-27

Scenario: AC5 An override never changes the decision
  Given 2026-11-12 has decision school-lunch-planned
  When the parent overrides it to low-preference
  Then the decision is still school-lunch-planned
```

### US-E4-04 Neutral, non-judgmental wording · M · S
As a parent I want the app to describe preferences, not judge the school's food, so that it stays respectful.

```gherkin
Scenario: AC1 No judgmental words in assessment copy
  Then no assessment string in ja or en contains: 「まずい」「体に悪い」「不健康」「よくない」「おすすめしません」, "bad", "unhealthy", "unsuitable", "avoid"
  # QA: assert on the full string catalog, not only rendered screens

Scenario: AC2 State labels are about the child
  Then the state labels are 「たのしめそう」「どちらとも」「苦手かも」「未判定」「給食なし」 (Designer may refine wording, keeping the child-preference framing)
```

### US-E4-05 Show declared school-lunch allergens against known allergies · S · S
As a parent with an allergic child I want to see when the school menu declares one of my child's allergens so that I can check with the school.

```gherkin
Scenario: AC1 Declared allergen matches a known allergy
  Given the child has alg-egg and 2026-11-05 declares 卵 in its allergen declaration
  Then 2026-11-05 shows 「献立表に卵の表示があります。園にご確認ください。」

Scenario: AC2 No declaration is not "safe"
  Given 2026-11-06 has allergenDeclaration.status "not-declared"
  Then the day shows 「アレルゲンの記載がありません」 for a child with known allergies
  And never 「アレルゲンなし」 or any safe/OK icon

Scenario: AC3 The allergen notice never changes the assessment or the decision
  Then the assessment state and decision of 2026-11-05 are the same as without the notice
```

---

## E5 Calendar & family decisions

Decision state machine (proposed BR-02, BR-03). A stored decision exists only after a parent action; without one, the displayed decision is derived: school day → `school-lunch-planned`, no-lunch day → `no-school-lunch`.

| From \ parent action | 「手作りお弁当にする」 + confirm recipe | 「あとで決める」 | 「給食に戻す」 | change recipe |
|---|---|---|---|---|
| school-lunch-planned | homemade-bento-planned | not-confirmed | — | — |
| not-confirmed | homemade-bento-planned | — | school-lunch-planned | — |
| homemade-bento-planned | — | not-confirmed | school-lunch-planned (after confirm dialog) | homemade-bento-planned (new recipeId) |
| no-school-lunch | homemade-bento-planned only if the no-lunch reason is `bento-day` (OQ-03) | — | — | — |

### US-E5-01 Calendar is the home screen · M · M
As a parent I want the month at a glance so that I see school lunch and bento days in seconds.

```gherkin
Scenario: AC1 Opens on the current Tokyo month
  Given it is 2026-11-15 00:30 JST and the device timezone is Europe/Paris (local date still 2026-11-14)
  When the app opens
  Then November 2026 is shown with 2026-11-15 marked as today

Scenario: AC2 Japanese calendar conventions
  Then the week starts on Sunday, the header shows 「2026年11月」, Sunday dates are red, Saturday dates blue, and the weekday header is 日 月 火 水 木 金 土

Scenario: AC3 Each school day shows assessment and decision separately
  Then every school day cell shows two distinct indicators: one for the assessment state and one for the decision
  And neither indicator relies on color alone (icon or text label)

Scenario: AC4 Suggested vs confirmed is unmistakable
  Given 2026-11-04 is low-preference with decision school-lunch-planned and 2026-11-11 is homemade-bento-planned
  Then 2026-11-04 shows the low-preference marker and 「給食」
  And 2026-11-11 shows the filled bento marker and the recipe name (truncated to 8 characters in the cell, full name in the day sheet)
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
```

### US-E5-02 Day detail sheet · M · S
As a parent I want to tap a day and see everything about it so that I can decide.

```gherkin
Scenario: AC1 Day sheet content
  When the parent taps 2026-11-04
  Then a sheet shows 「11月4日（水）」, the menu items, the assessment with its explanation, the current decision, and only the actions allowed by the state machine

Scenario: AC2 Days outside the menu
  When the parent taps Saturday 2026-11-07 (not in the menu)
  Then the sheet says 「この日は献立に記載がありません」 and offers no decision actions

Scenario: AC3 Past days are read-only
  Given today is 2026-11-10 JST
  When the parent opens 2026-11-09
  Then the decision and recipe are shown but no action changes them
```

### US-E5-03 Choose homemade bento and confirm a recipe · M · M
As a parent I want to mark a day as homemade bento by choosing a recipe so that the plan is concrete.

```gherkin
Scenario: AC1 Choosing bento opens recommendations without changing the decision yet
  Given 2026-11-04 is school-lunch-planned
  When the parent taps 「手作りお弁当にする」
  Then the recommendation view for 2026-11-04 opens
  And the stored decision is still school-lunch-planned

Scenario: AC2 Confirming a recipe plans the day
  When the parent selects a recipe and taps 「この日に決定」
  Then the stored decision for 2026-11-04 is homemade-bento-planned with that recipeId and decidedAt
  And the calendar cell shows the recipe name

Scenario: AC3 Leaving without confirming changes nothing
  Given the recommendation view for 2026-11-04 is open
  When the parent closes it or presses back
  Then the decision is unchanged

Scenario: AC4 Today can still be planned, past days cannot
  Given today is 2026-11-04 08:00 JST
  Then 2026-11-04 can be planned and 2026-11-03 cannot
```

### US-E5-04 Low preference never creates a plan · M · S
As a parent I want the app to only suggest, never decide, so that the plan is always ours.

```gherkin
Scenario: AC1 Import, assessment and time never change a decision
  Given November is confirmed with 5 low-preference days and no stored decisions
  When assessments are calculated, the profile is edited, the menu is refreshed, reminders fire and the clock advances 30 days
  Then no stored decision exists for any day
  And all 5 days display school-lunch-planned

Scenario: AC2 Decision counts after import
  Then immediately after confirming a menu, the number of homemade-bento-planned days is 0
```

### US-E5-05 Mark a day "not confirmed" · M · S
As a parent I want to mark a day as "to decide later" so that it stays on my mind without being a plan.

```gherkin
Scenario: AC1 Set and display not-confirmed
  When the parent taps 「あとで決める」 on 2026-11-11
  Then the decision is not-confirmed and the cell shows 「未定」 with an outline (not filled) bento marker

Scenario: AC2 Not-confirmed days are surfaced
  Then not-confirmed days within the next 7 days appear in the upcoming summary and in the weekly reminder with 「計画する」

Scenario: AC3 Not-confirmed is never treated as planned
  Then no day-before reminder is scheduled for a not-confirmed day
```

### US-E5-06 Change or cancel a bento plan · M · S
As a parent I want to change the recipe or go back to school lunch so that plans can follow real life.

```gherkin
Scenario: AC1 Change recipe
  Given 2026-11-04 is planned with recipe R1
  When the parent taps 「レシピを変更」 and confirms R2
  Then the decision is homemade-bento-planned with R2, and the day-before reminder text refers to R2

Scenario: AC2 Cancel the plan
  When the parent taps 「給食に戻す」 and confirms
  Then the decision is school-lunch-planned, the recipe link is removed, and the day-before reminder for 2026-11-04 is cancelled

Scenario: AC3 Cancel asks first
  When the parent taps 「給食に戻す」
  Then a dialog asks 「11月4日の手作りお弁当の予定を取り消しますか？」 and nothing changes on 「キャンセル」
```

### US-E5-07 Never claim a school reservation · M · S
As a parent I want the app to be clear that school lunch is reserved outside it so that I don't miss the real reservation.

```gherkin
Scenario: AC1 School lunch says reservation is external
  Then wherever school-lunch-planned is shown in a day sheet or the today view, a note says 「給食の予約は園の方法で行ってください（このアプリでは予約されません）」

Scenario: AC2 No copy claims a booking
  Then no string in ja or en states or implies that the app reserved, booked, ordered or cancelled a school lunch (e.g. 「予約しました」「予約完了」「キャンセルしました」 as app actions, "booked", "reserved for you")
  # Exception: the parent's own checkbox label in AC3

Scenario: AC3 Optional "reserved externally" record
  Given today 2026-11-12 is school-lunch-planned
  When the parent ticks 「園で予約済み（自分で記録）」
  Then reservationDoneExternally = true is stored for 2026-11-12 and shown as the parent's own record
  And changing the decision to homemade-bento-planned clears the flag
```

### US-E5-08 Plan a bento on the school's 「お弁当の日」 · S · S
As a parent I want to pick a recipe for the days everyone must bring a bento so that the app helps on those days too.

```gherkin
Scenario: AC1 Bento day allows a plan
  Given 2026-11-20 is a no-lunch day with reason "bento-day"
  Then the sheet offers 「お弁当を計画する」 and confirming a recipe sets homemade-bento-planned

Scenario: AC2 Other no-lunch days allow no plan
  Given 2026-11-27 is a no-lunch day with reason "no-lunch" (e.g. 午前保育)
  Then the sheet shows 「給食なし」 with the original text and no planning action
```

---

## E6 Bento recommendations & recipes

Ranking (proposed BR-09): candidates = library recipes passing every hard filter (BR-06). Score = `+2` per distinct liked id in the recipe, `+1` if a recipe theme is one of the child's themes, `−3` per distinct disliked id, `−2` if the same recipe is planned on any other date within 14 days before or after the target date, `−1` if `minutes > 20`. Order by score desc, then minutes asc, then id asc. Show the top 3.

### US-E6-01 Three ranked suggestions · M · M
As a parent I want three good options so that choosing is quick.

```gherkin
Scenario: AC1 Exactly three suggestions, deterministic
  Given the fixture recipe library (20 recipes) and the sample child
  When recommendations are requested for 2026-11-04
  Then exactly 3 recipes are shown in the order given by the QA oracle for BR-09
  And repeating the request returns the same 3 in the same order

Scenario: AC2 Each card says why
  Then each card shows the Japanese name, minutes, up to 2 reasons (e.g. 「好きな鶏肉入り」「どうぶつテーマ」) and allergen badges

Scenario: AC3 Variety penalty
  Given recipe R is planned on 2026-11-11
  When recommendations are requested for 2026-11-18 (7 days later)
  Then R's score includes −2 and R ranks below an otherwise equal recipe

Scenario: AC4 Fewer than three pass the filters
  Given the filters leave exactly 2 recipes
  Then 2 are shown with 「条件に合うレシピは2件です」

Scenario: AC5 None pass the filters (empty state)
  Given the filters leave 0 recipes
  Then 「条件に合うレシピがありません」 is shown with links to 「プロフィールを見直す」 and 「レシピ一覧を見る」
  And the decision is unchanged

Scenario: AC6 See more
  When the parent taps 「ほかのレシピ」
  Then the full filtered, ranked list is shown, still without any filtered-out recipe
```

### US-E6-02 Hard filters for allergens and diet · M · M
As a parent of a child with allergies I want recipes with known allergens never to be suggested so that I can't pick one by mistake.

```gherkin
Scenario: AC1 Known allergen excludes a recipe from suggestions
  Given the child has alg-egg
  Then no recipe whose allergenIds or mayContainAllergenIds include alg-egg appears in suggestions or 「ほかのレシピ」
  And in 「レシピ一覧」 such a recipe shows 「卵を含む」 and its 「この日に決定」 is disabled

Scenario: AC2 Excluded ingredient behaves like an allergen, including child ids
  Given excludedIngredientIds ["ing-tomato"]
  Then no suggested recipe has an ingredient ing-tomato or a dictionary child of it (ミニトマト → ing-cherry-tomato, parent ing-tomato)

Scenario: AC3 Property over the whole library
  For every single allergen id of the current scheme, every pair of them, and every diet preference
  Then no suggested recipe violates the filter (property test over the real library)

Scenario: AC4 Recipe with product-dependent allergen information
  Given a recipe has an ingredient with allergenInfo "varies-by-product" (e.g. ウインナー)
  Then its card and detail show 「市販品は製品によりアレルゲンが異なります。表示を確認してください。」
  And if any of that ingredient's possibleAllergenIds is a known allergen of the child, the recipe is excluded
```

### US-E6-03 Never guarantee allergy safety · M · S
As the product owner I want the app to be honest that it can't guarantee safety so that families stay careful.

```gherkin
Scenario: AC1 Disclaimer on every recommendation and recipe screen
  Then the recommendation view and every recipe detail show 「アレルギーの安全を保証するものではありません。使用する食品の表示を必ずご確認ください。」

Scenario: AC2 No safety claims anywhere
  Then no string in ja or en contains 「アレルギー対応」「安全です」「アレルゲンフリー」「除去済み」, "allergy-safe", "allergen-free", "safe for"

Scenario: AC3 Empty allergen list is worded carefully
  Given a recipe with allergenIds [] and no varies-by-product ingredient
  Then its badge reads 「表示対象のアレルゲン：使用していません（食品の表示をご確認ください）」, never 「アレルゲンなし」 alone
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
```

### US-E6-05 Browse the recipe library · S · S
As a parent I want to browse all bentos so that I can plan ahead without starting from a day.

```gherkin
Scenario: AC1 List with conflicts last
  Then the list shows every library recipe; recipes conflicting with the child's allergens, exclusions or diet are listed last, greyed, with the reason, and cannot be planned

Scenario: AC2 Plan from the library
  When the parent opens a recipe, taps 「日付を選んで計画」 and picks 2026-11-18
  Then the same confirm step as US-E5-03/AC2 applies
```

### US-E6-06 Planned recipe missing after a library change · S · S
As a parent I want my plan to survive app updates so that a removed recipe doesn't break the calendar.

```gherkin
Scenario: AC1 Missing recipe id
  Given 2026-11-04 is planned with recipeId "retired-recipe" that is no longer in the library
  Then the cell shows the stored recipe name snapshot and the sheet says 「このレシピは見つかりません。別のレシピを選んでください。」
  And the decision is not changed
```

### US-E6-07 Curated recipe library content · M · L
As the product owner I want 15–20 real, sourced bento recipes so that suggestions are trustworthy.

```gherkin
Scenario: AC1 Library size and validity
  Then the shipped library has between 15 and 20 recipes and the validator reports 0 errors for it

Scenario: AC2 Mix
  Then at least 6 recipes have style "japanese", at least 4 have style "western-inspired", and at least 5 have minutes ≤ 20

Scenario: AC3 Sources
  Then every recipe has at least 1 source with a fetched URL, and the overlap audit reports 0 FAIL and 0 UNVERIFIED for the library
```

---

## E7 Reminders & today view

Reminder rules (proposed BR-15 … BR-18): all times are Asia/Tokyo. Weekly: default Sunday 14:00, covers the 7 days starting the next day. Day-before: default 17:30 on the day before each homemade-bento-planned day. One reminder per key (`weekly:<firstCoveredDate>`, `day-before:<date>`). Web: in-app only (shown while the app is open or when it is next opened; never claimed while closed).

### US-E7-01 Weekly reminder · M · M
As a parent I want a Sunday summary so that I plan the week in one go.

```gherkin
Scenario: AC1 Content
  Given it is 2026-11-01 (Sun) 14:00 JST and the app is open
  And 2026-11-04 is low-preference (school-lunch-planned) and 2026-11-06 is homemade-bento-planned
  Then a weekly reminder for 2026-11-02 … 2026-11-08 lists 「11月4日（水）苦手かも・未計画」 with 「計画する」 and 「11月6日（金）手作りお弁当：<recipe>」

Scenario: AC2 Quick planning
  When the parent taps 「計画する」 next to 2026-11-04
  Then the day sheet of 2026-11-04 opens

Scenario: AC3 Nothing to report
  Given the next week has no low-preference, not-confirmed or planned days
  Then the weekly reminder says 「来週は手作りお弁当の予定はありません」 (still delivered, so the parent knows the check ran)

Scenario: AC4 Week spans a month boundary
  Given it is 2026-11-29 (Sun) 14:00 JST, November is confirmed and December is not
  Then the reminder covers 2026-11-30 … 2026-12-06, lists the November days normally, and says 「12月の献立がまだありません」 for the December days

Scenario: AC5 Week without any menu
  Given no confirmed menu covers any day of the next week
  Then the reminder says 「来週の献立がまだありません」 with 「献立を取り込む」
```

### US-E7-02 Day-before reminder · M · M
As the parent who forgets I want a reminder the evening before so that I shop and prepare in time.

```gherkin
Scenario: AC1 Fires for planned days only
  Given 2026-11-04 is homemade-bento-planned and 2026-11-05 is not-confirmed
  When the clock reaches 2026-11-03 17:30 JST
  Then a reminder 「明日は手作りお弁当の日！レシピを確認しましょう。」 with the recipe name is shown for 2026-11-04
  And no reminder is shown for 2026-11-05

Scenario: AC2 Tap opens the recipe
  When the parent taps the reminder
  Then the planned recipe's detail opens; if the recipe is missing, the day sheet opens

Scenario: AC3 Month boundary, last school day of January then first of February
  Given 2027-01-29 (Fri) and 2027-02-01 (Mon) are both homemade-bento-planned
  Then reminders fire on 2027-01-28 17:30 JST and 2027-01-31 (Sun) 17:30 JST respectively

Scenario: AC4 Leap day
  Given 2028-02-29 (Tue) and 2028-03-01 (Wed) are planned
  Then reminders fire on 2028-02-28 17:30 JST and 2028-02-29 17:30 JST

Scenario: AC5 Planned after the reminder time
  Given it is 2026-11-03 19:00 JST
  When the parent plans 2026-11-04
  Then no day-before reminder is shown for 2026-11-04 and the today view on 2026-11-04 covers it

Scenario: AC6 Rescheduled or cancelled with the decision
  Given the day-before reminder for 2026-11-04 is scheduled
  When the plan's recipe changes, the reminder refers to the new recipe
  And when the plan is cancelled or set to not-confirmed, the reminder is removed
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

Scenario: AC3 Day rollover at Tokyo midnight
  Given the app stays open from 2026-11-03 23:59 JST to 2026-11-04 00:01 JST
  Then the today card switches to 2026-11-04 without a reload (the clock is checked at least once per minute)
```

### US-E7-04 Configure reminder times · M · S
As a parent I want to choose when reminders come so that they fit our routine.

```gherkin
Scenario: AC1 Defaults
  Given a new install
  Then settings show 週のまとめ 「日曜日 14:00」 and 前日のお知らせ 「17:30」, both on

Scenario: AC2 Change times
  When the parent sets the weekly reminder to Saturday 20:00 and the day-before to 19:15
  Then future reminders use these times and reminders already shown are not shown again

Scenario: AC3 Allowed values
  Then times are selectable in 15-minute steps from 00:00 to 23:45 and the weekly day is any of 日〜土
  And a stored value of "24:00" or "17:31" is rejected by validation and replaced by the default

Scenario: AC4 Turn off
  When the parent switches off 前日のお知らせ
  Then no day-before reminders are shown, and the today view still works
```

### US-E7-05 No duplicate or expired reminders · M · S
As a parent I want each reminder once so that the app isn't noisy.

```gherkin
Scenario: AC1 Shown once per key
  Given the day-before reminder for 2026-11-04 was shown and dismissed
  When the app is reopened or reloaded, or the debug clock is set to 17:30 again
  Then it is not shown again (except via the debug 「強制表示」 action)

Scenario: AC2 Missed reminders are shown on next open until they expire
  Given the app was closed at 2026-11-03 17:30 JST
  When the app opens at 2026-11-03 21:00 JST
  Then the 2026-11-04 day-before reminder is shown, labelled with its original time
  When the app instead opens first at 2026-11-04 07:00 JST
  Then that reminder is not shown (expired at 2026-11-04 00:00 JST) and the today view shows the plan

Scenario: AC3 Weekly reminder expiry
  Then a weekly reminder expires at the end of the last day it covers, and only the most recent unexpired weekly reminder is shown
```

### US-E7-06 Honest notification promises on the web · M · S
As a parent I want to know exactly when I'll be reminded so that I don't rely on something that won't happen.

```gherkin
Scenario: AC1 Web settings explain the limitation
  Then the reminder settings in the browser build say 「ブラウザ版では、アプリを開いているとき・次に開いたときにお知らせします。閉じている間は通知できません。」

Scenario: AC2 No background promise
  Then no string in the web build claims reminders arrive while the app or browser is closed (e.g. 「閉じていても通知」, "even when closed", "push notification")
```

### US-E7-07 Device timezone differs from Tokyo · M · S
As a parent travelling abroad I want reminders and dates to stay on Japan time so that the plan doesn't shift.

```gherkin
Scenario: AC1 Reminder fires at Tokyo time
  Given the device timezone is Europe/Paris and 2026-11-04 is planned
  Then the day-before reminder becomes due at 2026-11-03T08:30:00Z (17:30 JST, 09:30 in Paris)
  And the weekly reminder of 2026-11-01 becomes due at 2026-11-01T05:00:00Z (14:00 JST, 06:00 in Paris)

Scenario: AC2 Times are labelled when the device is not in Tokyo
  Given the device timezone is not Asia/Tokyo
  Then reminder times in settings and reminders show 「（日本時間）」 / "(Japan time)"

Scenario: AC3 Timezone change while open
  Given the device timezone changes from Asia/Tokyo to America/Los_Angeles while the app is open
  Then "today", the calendar dates and the due reminders are unchanged
```

### US-E7-08 (v1) Reservation reminder on school-lunch days · C · S
As a parent who reserves school lunch in the morning I want a nudge before the school's cut-off so that I don't forget to reserve.

```gherkin
Scenario: AC1 (v1) Morning nudge
  Given 「給食予約のリマインド」 is on at 08:00 and today is school-lunch-planned with reservationDoneExternally false
  When the clock reaches 08:00 JST
  Then 「今日は給食の日です。園での予約をお忘れなく。」 is shown, and it is not shown when the flag is true
```

---

## E8 Localization

### US-E8-01 Japanese by default, one-tap English · M · S
As a Japanese parent I want the app in natural Japanese from the start, and my partner may want English, so that everyone can use it.

```gherkin
Scenario: AC1 Japanese is the default whatever the browser language
  Given a fresh install on a browser whose language is en-US
  When the app opens
  Then all UI text is Japanese and <html lang="ja">

Scenario: AC2 Toggle is reachable everywhere
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
Scenario: AC1 Catalog parity
  Then the ja and en catalogs have exactly the same keys, and no value is empty

Scenario: AC2 No hard-coded strings
  Then rendering every screen in EN shows no Japanese characters except menu dish names, recipe Japanese names and the 「日本語」 toggle label
  And rendering in JA shows no untranslated English UI text (allowed: "EN", units like "g", "ml")

Scenario: AC3 Missing key fallback
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

Scenario: AC3 All date math uses Asia/Tokyo calendar dates
  Then dates are stored as "YYYY-MM-DD" strings without time or offset, and "today" is computed with the Asia/Tokyo zone (BR-15)
```

### US-E8-04 Japanese public holidays on the calendar · C · S
As a parent I want holidays marked like on any Japanese calendar so that I recognize the month.

```gherkin
Scenario: AC1 Holidays shown from a sourced list
  Given the bundled holiday list from the Cabinet Office (内閣府) for 2026–2028
  Then 2026-11-03 and 2026-11-23 are shown red with the names 「文化の日」「勤労感謝の日」 available to screen readers

Scenario: AC2 Holidays never decide school days
  Given the confirmed menu lists a lunch on a holiday
  Then that day is treated as a school day (the menu wins)
```

---

## E9 Sharing

### US-E9-01 Share the coming week's plan · M · S
As the planning parent I want to send this week's bento plan to my partner so that they know without installing anything.

```gherkin
Scenario: AC1 Share text content (exact format, ja)
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

Scenario: AC3 Empty week
  Given no planned or not-confirmed days in the next 7 days
  Then the text says 「今週は手作りお弁当の予定はありません。」
```

### US-E9-02 Shared text exposes no unnecessary child data · M · S
As a parent I want shared messages to contain only the plan so that my child's details stay private.

```gherkin
Scenario: AC1 No profile data in the share text
  Given a profile with nickname 「はなちゃん」, age range, likes, dislikes, allergens, diet, themes and a note
  Then the share text contains none of them (it contains only dates, decision labels, recipe names and the fixed notes)

Scenario: AC2 No sync claim
  Then the share UI says 「共有した時点の予定です。自動では同期されません。」 and no string claims automatic sync between devices
```

---

## E10 Data

### US-E10-01 Data stays on the device and survives reload · M · S
As a parent I want my data kept on this device so that it works offline and stays private.

```gherkin
Scenario: AC1 Persistence across reload and restart
  Given a profile, a confirmed menu, 3 decisions, 1 override and custom reminder times
  When the browser is closed and reopened
  Then all of them are restored exactly

Scenario: AC2 No network calls with personal data
  Then in a full journey the only network requests are: static app assets, and the menu adapter (URL or PDF bytes, prompt, schema); no request body contains profile, decision or override data

Scenario: AC3 Works offline after load
  Given the app was loaded once and the network is then disabled
  Then the calendar, decisions, recipes and reminders work; only menu import shows 「オフラインのため取り込めません」
```

### US-E10-02 Versioned schema and migrations · M · M
As the developer I want a versioned store so that updates never lose a family's plans.

```gherkin
Scenario: AC1 Store carries a schema version
  Then the root store has schemaVersion 1 and validates against the v1 contract

Scenario: AC2 Older version is migrated once, with a backup
  Given a store with schemaVersion 0 (fixture)
  When the app opens
  Then a backup copy is kept, the store is migrated to 1, and all decisions are preserved

Scenario: AC3 Newer version is not overwritten
  Given a store with schemaVersion 99
  Then the app shows 「新しいバージョンのデータです。アプリを更新してください。」, offers export, and writes nothing

Scenario: AC4 Corrupt store
  Given the stored JSON is not parseable or fails validation
  Then the app shows a recovery screen offering 「データを書き出す（そのまま）」 and 「初期化する」, and writes nothing until the parent chooses

Scenario: AC5 Storage unavailable or full
  Given storage writes throw (private mode or quota exceeded)
  Then the app shows 「この端末に保存できません」 and does not claim that a decision was saved
```

### US-E10-03 Export my data · M · S
As a parent I want to download my data so that I have a copy or can move it.

```gherkin
Scenario: AC1 Export file
  When the parent taps 「データを書き出す」
  Then a file "bentominder-export-2026-11-01.json" downloads containing the full store with schemaVersion and exportedAt
  And it validates against the root store contract

Scenario: AC2 Export with no data
  Given nothing is stored
  Then the export button is disabled with 「書き出すデータがありません」

Scenario: AC3 (Could) Import an export
  Given a valid export file with schemaVersion ≤ the app's version
  When the parent chooses 「データを読み込む」 and confirms replacing current data
  Then the store is replaced and the calendar shows the imported plans
```

### US-E10-04 Delete all data · M · S
As a parent I want to erase everything so that nothing stays on a shared or old device.

```gherkin
Scenario: AC1 Delete everything with confirmation
  When the parent taps 「すべてのデータを削除」 and types or taps the explicit confirmation 「削除する」
  Then every BentoMinder key (store, backups, reminder log, consent, language) is removed
  And the app returns to onboarding in Japanese

Scenario: AC2 Cancel keeps everything
  When the parent cancels the dialog
  Then storage is unchanged
```

### US-E10-05 Stored data matches the data contract · M · S
As QA I want every write validated so that bad data never reaches storage.

```gherkin
Scenario: AC1 Invalid writes are refused
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

Scenario: AC2 Absent in production
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
    | rate-limited          | US-E2-06/AC1   |
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

Scenario: AC3 Not color alone, touch size
  Then assessment and decision states are distinguishable without color, and every touch target is at least 44 × 44 CSS px at 360 px width

Scenario: AC4 Screen reader labels for calendar cells
  Then each school-day cell has an accessible name like 「11月4日（水）、苦手かも、給食」
```

### US-NF-03 Privacy: no child data to AI or third parties · M · S
```gherkin
Scenario: AC1 Adapter payload allow-list
  Then a contract test asserts the adapter request contains only: pdf (bytes or URL), targetMonth, prompt version, schema version

Scenario: AC2 Data minimization in the contract
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
  Then an extraction request is abandoned after 60 s and treated as "unavailable"
```

### US-NF-05 No secrets in the client · M · S
```gherkin
Scenario: AC1 Key stays server-side
  Then the built web assets contain no AI provider key or key-shaped string (validate.mjs secrets passes) and the key is read only by the server adapter from its environment

Scenario: AC2 No paid usage by default
  Then the adapter configuration has no billing-enabled setting turned on by default, and the README states that paid usage requires PO approval
```
