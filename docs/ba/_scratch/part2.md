
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
