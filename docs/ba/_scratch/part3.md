
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
