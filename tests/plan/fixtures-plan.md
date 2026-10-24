# Fixtures plan — synthetic Japanese kindergarten menus (built in M1)

Owner: QA (with BA for answer keys) · 2026-10-24 · Status: menu fixtures FX-01…FX-08 **built** (M1 prep, §7); BA answer-key review pending; §3–§5 partly built · Contract: `docs/ba/data-contract.md` §3.3–§3.4 and §5

## 1. Rules for every fixture
- **Synthetic.** Every fixture is invented for testing. No real school's menu, name, logo, address or layout is copied. The PDF footer prints 「テスト用の架空の献立表です。実在の園とは関係ありません。」 and the school name is 「テストようちえん（架空）」. Every JSON file carries `"synthetic": true`. The PO's real menu PDF (OQ-04) is used only locally for the live eval and is never committed.
- **One source, generated outputs.** Each fixture has a hand-written answer key `tests/fixtures/menus/<id>/answer-key.json` (an `ExtractedMenu` as a perfect reader would produce it, plus `hardFields[]` listing paths that must be `uncertain`). The PDF is **generated** from a layout template (`layout.html`) by a script (`node tests/fixtures/pdf/generate-menus.mjs`, alias `npm run fixtures:menus` requested; Playwright Chromium `page.pdf()`, A4, using only Japanese fonts installed with Windows: "Yu Gothic", "Meiryo", "BIZ UDGothic"; nothing downloaded; see §7). PDFs are listed as `generated` in `quality-gate.json` and never edited by hand.
- **Recorded model output.** `recorded/<model>-<n>.json` holds what the extractor returned when run live (M5) or, before M5, a hand-written stand-in marked `"recordedBy": "hand"`. Gate tests (unit, contract, e2e) use only these files; the live eval (opt-in) compares new live output with the answer key.
- **Answer-key review.** The BA reviews each answer key against its PDF (dates, weekdays, dish texts, reasons) before the fixture is used; the review is one line in the fixture's `README.md` (who, date).
- **Calendar facts** used below were checked by weekday arithmetic: 2026-11-01 Sun; 2026-12-01 Tue; 2027-01-01 Fri, 2027-01-11 Mon (成人の日); 2027-02-01 Mon, 02-11 Thu (建国記念の日), 02-23 Tue (天皇誕生日); 2027-03-01 Mon; 2028-02-01 Tue, 02-11 Fri, 02-23 Wed, 02-29 Tue. Reiwa: 2026 = 令和8年, 2027 = 令和9年, 2028 = 令和10年.

## 2. Menu fixtures

### FX-01 `fixture-menu-2026-11` — standard month (the journey fixture)
Layout: one A4 page, 令和8年11月 header with Gregorian 「2026年11月」 too, one row per school day (date 「4日（水）」, dishes, 赤・黄・緑 ingredient columns where printed, おやつ column), allergen line only where stated.
Tests: date mapping, dish texts, no-lunch days, missing ingredient list, allergen declared vs not, one hard-to-read field, snack-only Saturday, standalone 「カレー」 — every requirement of contract §5 — and the sample child's whole month (assessment oracle).

| Date | Printed dishes (kind) | Ingredients | Allergen line | Sample-child state |
|------|-----------------------|-------------|---------------|--------------------|
| 11-02 月 | 鶏のから揚げ (mn), ごはん (st), わかめスープ (sp), みかん (ds) | not-listed | none → `not-declared` | likely-enjoyable |
| 11-03 火 | (no row: 文化の日) | | | no assessment |
| 11-04 水 | ピーマンとなすのみそ炒め (mn), ごはん (st), すまし汁 (sp) | 赤 豚肉・みそ / 黄 米・油 / 緑 ピーマン・なす・たまねぎ | none | **low-preference** (D 2) |
| 11-05 木 | **さばのみそ煮** (mn, printed smudged → `hardFields`), ごはん, ほうれん草のおひたし (sd), 牛乳 (dk) | 赤 さば・みそ・牛乳 / 黄 米・砂糖 / 緑 ほうれん草・しょうが | 「アレルゲン：卵・小麦」 → `declared` [alg-egg, alg-wheat] | low-preference |
| 11-06 金 | **カレー** (mn, standalone), コールスロー (sd), ヨーグルト (ds) | not-listed | **no line** → `not-declared` | mixed-uncertain (`mixedNeutral`) |
| 11-09 月 | 卵焼き (sd), おにぎり (st), 豚汁 (sp); おやつ せんべい (sn) | not-listed | none | likely-enjoyable |
| 11-10 火 | 八宝菜 (mn), ごはん, 中華スープ (sp) | **none printed** → `not-listed` | none | mixed-uncertain (`mixedNeutral`) |
| 11-11 水 | ハンバーグ (mn), ポテトサラダ (sd), コーンスープ (sp), ごはん | not-listed | none | likely-enjoyable |
| 11-12 木 | 白身魚のフライ (mn), ごはん, みそ汁 (sp), りんご (ds) | not-listed | none | low-preference |
| 11-13 金 | ナポリタン (mn), ブロッコリーのサラダ (sd), ゼリー (ds) | not-listed | none | mixed-uncertain (`mixedNeutral`) |
| 11-14 土 | おやつ せんべい (sn) only | – | – | **no assessment** (snack-only, US-E4-01/AC10) |
| 11-16 月 | 親子丼 (mn), すまし汁 (sp), バナナ (ds) | 赤 鶏肉・卵 / 黄 米・砂糖 / 緑 たまねぎ・みつば | none | likely-enjoyable (L 2 from ingredients) |
| 11-17 火 | さけのしおやき (mn), 切り干し大根の煮物 (sd), みそ汁 (sp) | not-listed | none | low-preference |
| 11-18 水 | タンドリーチキン (mn), ナン (st), ミネストローネ (sp) | not-listed | none | mixed-uncertain (`mixedUnknown`) |
| 11-19 木 | かぼちゃの煮物 (sd), 鶏の照り焼き (mn), ごはん | not-listed | none | likely-enjoyable |
| 11-20 金 | 「お弁当の日」 | – | – | `noLunchDays` reason `bento-day` |
| 11-23 月 | (no row: 勤労感謝の日) | | | no assessment |
| 11-24 火 | 焼きそば (mn), なすの揚げびたし (sd), オレンジ (ds) | not-listed | none | low-preference |
| 11-25 水 | アジフライ (mn), ごはん, 野菜スープ (sp) | not-listed | none | mixed-uncertain (`mixedNeutral`, アジ unresolved) |
| 11-26 木 | マカロニグラタン (mn), コーンスープ (sp), りんご (ds) | not-listed | none | likely-enjoyable |
| 11-27 金 | 「午前保育（給食なし）」 | – | – | `noLunchDays` reason `no-lunch` |
| 11-30 月 | カレーライス (mn), たまごサラダ (sd), 牛乳 (dk) | not-listed | none | likely-enjoyable |

Expected JSON outline: `targetMonth 2026-11`, `detectedMonth 2026-11`, `days` = 18 dates (17 lunch days + 11-14 snack-only), `noLunchDays` = [11-20 bento-day 「お弁当の日」, 11-27 no-lunch 「午前保育（給食なし）」], `outOfMonthDays []`, `warnings []`, `hardFields` = [days[11-05].items[0].text]. Sample child: 7 likely, 5 low, 5 mixed, 2 no-lunch (matches US-E5-04/AC1's "5 low-preference days").
Recorded stand-in output: identical to the answer key except 11-05 item 0 reads 「さばのみそに」 with `uncertain / low-legibility` (US-E3-02/AC1 edits it), and 11-18 item 2 「ミネストローネ」 and 11-25 item 0 「アジフライ」 flagged `uncertain / low-legibility` (3 uncertain fields for US-E3-01/AC2).
Variants:
- **FX-01b `fixture-menu-2026-11-v2`** (refresh, US-E3-05): 11-18 dishes changed (タンドリーチキン → 鶏のから揚げ); 11-13 ゼリー removed; everything else equal. `changedDatesSincePrevious` = [11-13, 11-18].
- **FX-01c `fixture-menu-2026-11-v3`** (refresh conflict, US-E3-05/AC2): 11-04 becomes 「給食なし（行事のため）」 reason `no-lunch`; 11-11 row removed (decision oracle S10).
- **FX-01d `fixture-menu-2026-11-wdmismatch`** (US-E2-05/AC5): 11-04 printed as 「4日（木）」 → `uncertain / weekday-mismatch`.

### FX-02 `fixture-menu-2026-12-events` — holidays, お弁当の日 and winter break
Layout: calendar-grid style (Mon–Fri columns, one row per week), event notes in small print, winter break as one band.
Tests: grid layout date mapping, several no-lunch reasons in one month, event notes, a range band, the next-month prompt (US-E3-06/AC2), the weekly reminder across 11-30…12-06 (RM24) once confirmed.

| Dates | Printed | Expected |
|-------|---------|----------|
| 12-01 … 12-10, 12-14 … 12-17, 12-21, 12-22 (weekdays) | lunch rows, each with おやつ | `days` with items; snack items kind `snack` |
| 12-11 金 | 「お弁当の日」 | `noLunchDays` `bento-day` |
| 12-18 金 | lunch + note 「クリスマス会」 | `days[].notes = ["クリスマス会"]` |
| 12-23 水 | 「終業式・午前保育（給食なし）」 | `noLunchDays` `no-lunch` |
| 12-24 … 1-6 | band 「冬休み（12月24日〜1月6日）」 (built with 1月6日 so it agrees with FX-05's 1-07 始業式) | `noLunchDays` `closed` for 12-24, 12-25, 12-28, 12-29, 12-30, 12-31 (in-month weekdays; see FX-Q1); January part → `outOfMonthDays` `no-lunch-day` `closed` for 2027-01-01, 01-04, 01-05, 01-06 (contract H1, FX-Q3, US-E2-05/AC4) |

### FX-03 `fixture-menu-2027-02-reiwa` — 令和 header, 28 days
Layout: header only 「令和9年2月 こんだてひょう」 (no Gregorian year), dates printed as 「1（月）」 without month; holidays printed as rows with 「おやすみ」.
Tests: Reiwa → 2027 conversion, `detectedMonth 2027-02`, holiday rows as `closed`, February length, 節分 note.
Expected outline: lunch days = all weekdays 2-01 … 2-26 except 2-11 and 2-23; `noLunchDays` = [2-11 `closed` 「建国記念の日 おやすみ」, 2-23 `closed` 「天皇誕生日 おやすみ」]; 2-03 note 「節分」.
Variants: **FX-03b** recorded output containing `2027-02-29` → validator `date-invalid`, treated as malformed (US-E2-05/AC3). **FX-03c** recorded output with `detectedMonth 2026-02` (wrong era conversion) while the parent chose 2027-02 → warning `month-mismatch` on review. **FX-03d** parent chooses target 2027-03 for this PDF → `month-mismatch`.

### FX-04 `fixture-menu-2028-02-leap` — leap February
Layout: as FX-01, header 「令和10年2月」. 29 days; 2-29 火 has a lunch row; 2-11 金 and 2-23 水 no rows.
Tests: 2-29 mapping (US-E5-01/AC6), day-before reminders on 2-28 and 2-29 (US-E7-02/AC4, RM10).

### FX-05 `fixture-menu-2027-01-twocol` — tricky layout: two weeks per column, merged cells
Layout: landscape page, two week-blocks side by side (left: weeks of 1-12 and 1-18; right: weeks of 1-25 and the start week), dates printed only as day numbers in a narrow left column, a merged cell 「今週のデザート：りんご」 spanning the five rows of the week of 1-18, a merged blank band across 1-11 (成人の日), 1-07 「始業式・午前保育（給食なし）」, 1-08 金 first lunch.
Tests: date mapping when reading order is not row order, merged-cell handling, `layout-unrecognised` / `partial-extraction` warnings in recorded failure variants, US-E7-02/AC3 (1-29 金 planned).
Expected outline: lunch days 1-08, 1-12…1-15, 1-18…1-22, 1-25…1-29; `noLunchDays` = [1-07 `no-lunch`]; 1-11 absent; the merged dessert appears as an item 「りんご」 (kind `dessert`) on each of 1-18…1-22 (see FX-Q2 for its verification status).
Variant: **FX-05b** recorded output that misreads the side-by-side blocks (built as: the weeks of 1-18 and 1-25 swapped, 10 of 15 lunch days wrong; schema-valid) → used only by the live-eval scorer to prove it detects wrong date mapping (score < 100%).

### FX-06 `fixture-menu-2026-11-scan` — scanned-image style
The FX-01 layout rendered to an image (≈150 dpi), rotated 1.5°, with light noise and one column at reduced contrast, embedded as the only content of the PDF (no text layer).
Tests: the live eval's OCR-like path (accuracy reported, not gated); in the gate only its recorded output is used, with the same answer key as FX-01 plus `hardFields` for the low-contrast column.

### FX-07 `fixture-menu-2027-03-allergens` — allergen line on every day vs none
Layout: as FX-01 plus an allergen line under every day and a kcal column. March 2027 lunch days 3-01 … 3-17 (weekdays); 3-18 木 「修了式・午前保育（給食なし）」. No national-holiday dates are used in this fixture.
Tests: BR-08 and US-E2-04/AC3, US-E4-05: every `AllergenDeclaration` status, allergen synonyms, no invented absence, kcal ignored.

| Date | Printed allergen line | Expected `allergenDeclaration` |
|------|----------------------|--------------------------------|
| 3-01 | 「アレルゲン：卵・乳・小麦」 | `declared` [alg-egg, alg-milk, alg-wheat] |
| 3-02 | 「特定原材料：えび・かに」 | `declared` [alg-shrimp, alg-crab] |
| 3-03 | 「アレルゲン：なし」 | `declared-none`, `rawText` 「アレルゲン：なし」 |
| 3-04 | 「アレルゲン：乳成分・大豆」 | `declared` [alg-milk, alg-soybean] (synonym 乳成分) |
| 3-05 | line printed but smudged | `unreadable`, `uncertain / low-legibility` |
| 3-08 | no line | `not-declared` (never "none") |
| other days | 「アレルゲン：小麦」 | `declared` [alg-wheat] |
Contrast: FX-01 declares only on 11-05; every other FX-01 day must be `not-declared`.

### FX-08 Hostile review data `fixture-review-hostile.json` (ExtractedMenu JSON, no PDF)
For e2e input tests on the review screen (US-E3-02): dish names `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, 🍙🍱, a 40-character and a 41-character name, a name of only spaces, zero-width and right-to-left marks, half-width katakana, a day with exactly 12 items, a 30-character ingredient. Expected: text rendered literally (no script runs, no HTML injected), boundaries as in US-E3-02/AC4–AC5.

## 3. Extractor and provider response fixtures (contract tests, `tests/fixtures/extractor/`)
| Id | Content | Used by |
|----|---------|---------|
| RX-ok | FX-01 recorded output | US-E2-04/AC1, e2e journey |
| RX-malformed | non-JSON text | US-E2-05/AC1, AC2 |
| RX-schema-invalid | JSON missing `days` | US-E2-05/AC2 |
| RX-out-of-month | FX-01 + 2026-12-01 | US-E2-05/AC4 |
| RX-duplicate | FX-01 with 11-05 twice | US-E2-05/AC6 |
| RX-leap-invalid | FX-03b | US-E2-05/AC3 |
| RX-429 / RX-429-retry60 | rate-limited, with and without `retryAfterSeconds` | US-E2-06/AC5, AC6 |
| RX-5xx / RX-timeout | HTTP 500/503/504, 60 s timeout | US-E2-06/AC2, US-NF-04/AC3 |
| RX-408 | HTTP 408 from the provider: call 2 = fallback model, then stop (BR-10 as restated at H1) | US-E2-07/AC4 |
| RX-400 / RX-403 / RX-404 | non-transient | US-E2-06/AC7 |
| RX-not-a-menu | model says no dates | ADR 002 `NOT_A_MENU` |
| RX-not-configured | adapter without key | US-E2-06/AC4 |
| RX-cap | proxy's own cap reached | US-E2-06/AC8 |
Each recorded provider response is replayed by a fake transport; the full call sequences of US-E2-07/AC4 are built from these.

## 4. File and URL fixtures (`tests/fixtures/files/`, generated)
`empty.pdf` (0 bytes) · `encrypted.pdf` (password-protected) · `page.html` saved as `.pdf` · `menu.jpg` · `renamed.pdf` (JPEG bytes) · `exact-10mb.pdf` (valid PDF padded to 10,485,760 bytes) · `over-10mb.pdf` (10,485,761 bytes) · URL strings of 2,048 and 2,049 characters (both `https://`) · BR-14 https-only cases (PLAN §7, 2026-10-24), see the table below · `ftp://…`, `javascript:alert(1)`, `menu.pdf` · server-fetch targets for US-E2-02/AC3 (loopback, private range, 4-redirect chain) served by the test server only.

### URL input cases (BR-14: https only, port 443, ≤ 2,048 characters)
| Id | Input | Expected | Story |
|----|-------|----------|-------|
| UR-01 | `http://example-kinder.test/menu/2026-11.pdf` | rejected before any request: import not started, 0 calls to `/api/menu/fetch-pdf`, 「PDFのURL（https://…）を入力してください」 shown | US-E2-01/AC2 |
| UR-02 | `https://example-kinder.test:8443/menu/2026-11.pdf` | rejected the same way (port other than 443) | US-E2-01/AC2 |
| UR-03 | `https://example-kinder.test:443/menu/2026-11.pdf` | accepted (explicit default port) | US-E2-01/AC1 |
| UR-04 | `HTTPS://EXAMPLE-KINDER.TEST/menu/2026-11.pdf` | accepted (scheme and host are case-insensitive) | US-E2-01/AC1 |
The proxy repeats the check server-side (ADR 002 SSRF guard): a contract test posts UR-01 and UR-02 straight to `/api/menu/fetch-pdf` and expects a refusal with 0 outbound fetches.

## 5. Store fixtures (`tests/fixtures/store/`)
`store-v0.json` (schemaVersion 0, migration), `store-v99.json` (newer), `store-corrupt.txt` (not JSON), `store-invalid-decision.json` (bento without recipe), `store-journey-end.json` (state after US-E0-01/AC1, for reload and export tests), `store-retired-recipe.json` (US-E6-06).

## 6. Answer-key conventions to confirm with the BA (not blocking H1)
- **FX-Q1** A printed range band (「冬休み 12月24日〜1月7日」) → which in-month dates become `noLunchDays` (weekdays only, or every date)? Proposed: weekdays only; weekends listed only if printed as their own rows (US-E3-01/AC1).
- **FX-Q2** A merged cell spanning several days → the item on each spanned day, with `ok` or `uncertain/other`? Proposed: on each day; both statuses accepted by the scorer.
- **FX-Q4** (new, M1 prep) Grid layout (FX-02): the weekday is printed only as the column header, not next to the day number. Built as `printedDateText` "1" and `printedWeekday` = the column header. Alternative: `printedWeekday` null.
- **FX-Q3** (resolved at H1: contract `OutOfMonthEntry` holds both kinds) Contract gap: `outOfMonthDays` is `ExtractedDay[]` (items 1–12), so an out-of-month **no-lunch** entry (e.g. the January part of the band) cannot be represented. Proposed: such entries are dropped and counted in a `warnings` entry; or add `outOfMonthNoLunchDays`.

## 7. Built (M1 prep, 2026-10-24)

### 7.1 Status per fixture
| Fixture | Folder (`tests/fixtures/menus/…`) | days / no-lunch / out-of-month | Recorded stand-ins | menu.pdf | BA review |
|---------|------------------------------------|-------------------------------|--------------------|----------|-----------|
| FX-01 | `fixture-menu-2026-11/` | 18 / 2 / 0; hardFields 1 | `hand-1` (RX-ok), `hand-malformed`, `hand-schema-invalid`, `hand-out-of-month`, `hand-duplicate`, `hand-not-a-menu`, `hand-rate-limited` (Retry-After 60), `hand-rate-limited-no-retry-after` | 87 KB, 1 page | pending |
| FX-01b | `fixture-menu-2026-11-v2/` | 18 / 2 / 0 | `hand-1` | 87 KB | pending |
| FX-01c | `fixture-menu-2026-11-v3/` | 16 / 3 / 0 | `hand-1` | 88 KB | pending |
| FX-01d | `fixture-menu-2026-11-wdmismatch/` | 18 / 2 / 0; hardFields 2 | `hand-1` (model flags it), `hand-unflagged` (domain must flag) | 87 KB | pending |
| FX-02 | `fixture-menu-2026-12-events/` | 15 / 8 / 4 | `hand-1` | 86 KB | pending |
| FX-03 | `fixture-menu-2027-02-reiwa/` | 18 / 2 / 0 | `hand-1`, `hand-leap-invalid` (FX-03b), `hand-wrong-era` (FX-03c), `hand-target-2027-03` (FX-03d) | 66 KB | pending |
| FX-04 | `fixture-menu-2028-02-leap/` | 19 / 0 / 0 | `hand-1` | 71 KB | pending |
| FX-05 | `fixture-menu-2027-01-twocol/` (landscape) | 15 / 1 / 0 | `hand-1`, `hand-partial`, `hand-layout-unrecognised`, `hand-shifted` (FX-05b) | 65 KB | pending |
| FX-06 | `fixture-menu-2026-11-scan/` | 18 / 2 / 0; hardFields 8 (11-05 dish + 7 green-column ingredients) | `hand-1` | 207 KB, image only (1241×1755 JPEG, no text layer) | pending |
| FX-07 | `fixture-menu-2027-03-allergens/` | 13 / 1 / 0; hardFields 1 | `hand-1` | 92 KB | pending |
| FX-08 | `fixture-review-hostile/` (`review-data.json`, no PDF) | 5 / 1 / 0; 9 typed-input cases | – | – | pending |
| File | `tests/fixtures/pdf/not-a-pdf.pdf` | text bytes with a .pdf name | – | – | – |

Not built yet (owner QA, before the M1 tests that need them): §3 provider responses for 5xx/503/504, timeout, 408, 400/403/404, not-configured, proxy cap and the multi-call sequences of US-E2-07/AC4 (to live in `tests/fixtures/extractor/`, reusing the FX-01 recorded files above); §4 file fixtures other than `not-a-pdf.pdf` (`empty.pdf`, `encrypted.pdf`, `menu.jpg`, `renamed.pdf`, `exact-10mb.pdf`); §5 store fixtures. **`over-10mb.pdf` (too large) is generated at test time** (a valid PDF padded to 10,485,761 bytes in a temp dir) and never committed.

### 7.2 Files in each fixture folder
- `answer-key.json` (hand-written, BA-reviewed): `{ "synthetic": true, "fixtureId", "fixture": "FX-0n", "hardFields": [path…], "menu": ExtractedMenu v1 }`. The wrapper exists because `extractedMenuSchema` is strict (`unknown-field`), so `synthetic` and `hardFields` cannot sit inside the menu. `menu.id`, `menu.source` and `menu.extractedAt` are fixed synthetic stand-ins (`source.kind` `fixture`, `sha256` = SHA-256 of `synthetic:<fixtureId>`, `byteSize` 1): **not** the PDF's real hash or size, and never scored; the import pipeline sets them from the bytes. Paths in `hardFields` read `days[2026-11-05].items[0].text` (array element by date or by index).
- `layout.html` (hand-written source of the PDF): self-contained HTML/CSS, no URLs, school 「テストようちえん（架空）」 and footer 「テスト用の架空の献立表です。実在の園とは関係ありません。」. FX-06's layout is the scan composer (`data-scan-of`); its printed content comes from FX-01's layout.
- `menu.pdf` (**generated**, never hand-edited).
- `recorded/hand-*.json`: `{ "synthetic": true, "recordedBy": "hand", "fixtureId", "scenario", "description", "model", "promptVersion", "response": { "httpStatus", … }, "expect": { … } }`. `response` holds either `modelOutput` (what the model returns: `ExtractedMenu` minus `id`, `source`, `extractedAt`, ADR 002 §3), or `rawText` (non-JSON), or an HTTP failure (`httpStatus`, `retryAfterSeconds`, `body`). `expect` states `strictSchemaValid` and `strictSchemaRules` (the result of `extractedMenuSchema` after adding the app-set fields), `extractResult`, `differsFromAnswerKeyAt` (the only allowed differences from the answer key), `flagsHardFields`, and `afterValidation` (what the domain layer must turn it into). Live recordings (M5) use `"recordedBy": "live"` and `<model>-<n>.json`.
- `README.md`: what it tests, expected outline, file list, and the BA review line ("pending").

### 7.3 Regenerate and check
```bash
node tests/fixtures/pdf/generate-menus.mjs            # all PDFs + not-a-pdf.pdf  (or: … <fixture-id>)
node tests/fixtures/pdf/check-fixtures.mjs            # schemas, weekdays, recorded expectations, PDF header and size
```
- Regenerate **on Windows**: the fonts are the installed Yu Gothic / Meiryo / BIZ UDGothic; elsewhere Chromium substitutes fonts. Output is byte-stable for the same Chromium build (PDF dates fixed to 2026-10-24; two runs gave identical SHA-256 for all 10 PDFs). A Playwright upgrade may change bytes, which is expected for generated files. CI should only run the check, never regenerate.
- The generator fails if a layout overflows its single page (body is fixed to the page size).
- `check-fixtures.mjs` at build time: OK, 11 fixtures, 2,686 checks; every PDF starts with `%PDF-` and is < 1 MB (largest 207 KB). A mutation run (one wrong weekday, one missing `synthetic`) produced the expected failures.
- The first version of the answer keys, layouts and stand-ins was written from compact specs by a one-off QA authoring aid (`tests/_scratch/fixtures/author-fixtures.mjs`, `author-hostile.mjs`); from now on the fixture files themselves are the source and are edited by hand.

### 7.4 Findings for the Developer (from building the stand-ins)
- **F-1 (P2 if not handled in M1): strict schema vs domain checks.** `extractedMenuSchema` rejects raw model output that ADR 002 §4 layer 3 says the domain should *flag or move*: a day outside the target month (`extracted-day-outside-month`), a duplicated date (`days-unique-sorted`), an unflagged weekday mismatch (`weekday-mismatch`). If the proxy runs the strict schema on raw output first, US-E2-05/AC4, AC5, AC6 and FX-03d end as `MALFORMED_OUTPUT` instead of review flags. Pinned by `hand-out-of-month`, `hand-duplicate`, `hand-unflagged`, `hand-target-2027-03` (see their `expect.afterValidation`). Needs a normalise step (or a lenient model-output schema) before the strict parse.
- **F-2:** `npm run validate:data` reads only `tests/fixtures/menus/*.json` (top level) as bare `ExtractedMenu`s, so the nested fixture folders are not covered (it passes but checks none of them). Use `check-fixtures.mjs`, or extend the script to `menus/*/answer-key.json` and `review-data.json` → `.menu`.
