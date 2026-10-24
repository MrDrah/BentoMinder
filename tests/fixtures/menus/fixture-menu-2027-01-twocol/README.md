# FX-05 `fixture-menu-2027-01-twocol` — tricky layout: two week-blocks per column, merged cells

Synthetic test fixture. School 「テストようちえん（架空）」; every page prints 「テスト用の架空の献立表です。実在の園とは関係ありません。」. Not a real school's menu.

## What it tests
- Landscape page, two blocks side by side; the right block ends with the first week (reading order ≠ date order). Dates are bare day numbers (`printedWeekday` null).
- Merged cell 「今週のデザート：りんご」 spans 1-18…1-22 → item 「りんご」 (`dessert`) on each of those days (FX-Q2: `ok` or `uncertain/other` both accepted by the scorer).
- 1-11 (成人の日) is a blank shaded band → absent. 1-07 `no-lunch` 「始業式・午前保育（給食なし）」; 1-08 first lunch.
- US-E7-02/AC3 (1-29 金 planned). Recorded variants: partial extraction, unrecognised layout, and FX-05b (week mapping swapped; scorer must report < 100%).

Stories / rules: US-E2-04, US-E7-02/AC3.

## Expected outline
- `targetMonth` 2027-01, `detectedMonth` 2027-01
- `days`: 15 (01-08, 01-12, 01-13, 01-14, 01-15, 01-18, 01-19, 01-20, 01-21, 01-22, 01-25, 01-26, 01-27, 01-28, 01-29)
- `noLunchDays`: 01-07 `no-lunch` 「始業式・午前保育（給食なし）」
- `outOfMonthDays`: none
- `warnings`: none
- `hardFields` (must come back `uncertain`): none

## Files
- `answer-key.json`
- `layout.html`
- `menu.pdf (generated)`
- `recorded/hand-1.json`
- `recorded/hand-partial.json`
- `recorded/hand-layout-unrecognised.json`
- `recorded/hand-shifted.json`
- `README.md`

Recorded stand-ins (`"recordedBy": "hand"`, replaced by live recordings at M5):
- `hand-1` (ok): Stand-in: identical to the answer key.
- `hand-partial` (partial-extraction): The model reads only the left block (weeks 2 and 3) and says so.
- `hand-layout-unrecognised` (layout-unrecognised): The model reads only the first week and reports the layout as unrecognised.
- `hand-shifted` (wrong-date-mapping): FX-05b: the weeks of 1-18 and 1-25 are swapped (a realistic misreading of the side-by-side blocks). Schema-valid but wrong; for the live-eval scorer only.

Conventions: see `tests/plan/fixtures-plan.md` §1 and §7. `answer-key.json` → `menu` is a valid `ExtractedMenu` v1; its `id`, `source` and `extractedAt` are fixed synthetic stand-ins (not the PDF's real hash or size) and are never scored. Recorded files hold the model output (`ExtractedMenu` minus `id`, `source`, `extractedAt`, ADR 002 §3) or the HTTP failure.

## Answer-key review (BA)
- pending — reviewer, date, result (answer key checked against `menu.pdf`: dates, weekdays, dish texts, no-lunch reasons, allergen lines)
