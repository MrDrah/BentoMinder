# FX-04 `fixture-menu-2028-02-leap` — leap February

Synthetic test fixture. School 「テストようちえん（架空）」; every page prints 「テスト用の架空の献立表です。実在の園とは関係ありません。」. Not a real school's menu.

## What it tests
- 29-day February: 2028-02-29 (火) has a lunch row with a listed ingredient block; 2-11 (金, 建国記念の日) and 2-23 (水, 天皇誕生日) have no rows.
- 2-29 mapping (US-E5-01/AC6); day-before reminders on 2-28 and 2-29 (US-E7-02/AC4, RM10).

Stories / rules: US-E5-01/AC6, US-E7-02/AC4.

## Expected outline
- `targetMonth` 2028-02, `detectedMonth` 2028-02
- `days`: 19 (02-01, 02-02, 02-03, 02-04, 02-07, 02-08, 02-09, 02-10, 02-14, 02-15, 02-16, 02-17, 02-18, 02-21, 02-22, 02-24, 02-25, 02-28, 02-29)
- `noLunchDays`: none
- `outOfMonthDays`: none
- `warnings`: none
- `hardFields` (must come back `uncertain`): none

## Files
- `answer-key.json`
- `layout.html`
- `menu.pdf (generated)`
- `recorded/hand-1.json`
- `README.md`

Recorded stand-ins (`"recordedBy": "hand"`, replaced by live recordings at M5):
- `hand-1` (ok): Stand-in: identical to the answer key.

Conventions: see `tests/plan/fixtures-plan.md` §1 and §7. `answer-key.json` → `menu` is a valid `ExtractedMenu` v1; its `id`, `source` and `extractedAt` are fixed synthetic stand-ins (not the PDF's real hash or size) and are never scored. Recorded files hold the model output (`ExtractedMenu` minus `id`, `source`, `extractedAt`, ADR 002 §3) or the HTTP failure.

## Answer-key review (BA)
- pending — reviewer, date, result (answer key checked against `menu.pdf`: dates, weekdays, dish texts, no-lunch reasons, allergen lines)
