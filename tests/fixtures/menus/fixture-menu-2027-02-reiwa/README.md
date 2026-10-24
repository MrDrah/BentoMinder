# FX-03 `fixture-menu-2027-02-reiwa` — 令和 header only, 28 days

Synthetic test fixture. School 「テストようちえん（架空）」; every page prints 「テスト用の架空の献立表です。実在の園とは関係ありません。」. Not a real school's menu.

## What it tests
- Reiwa → Gregorian: the header is only 「令和9年2月 こんだてひょう」 (no Gregorian year) → `detectedMonth` 2027-02.
- Dates printed 「1（月）」 without the month; holiday rows printed 「おやすみ」 → `closed` (2-11, 2-23); 2-03 note 「節分」.
- February length (28 days): lunch days = all weekdays 2-01…2-26 except 2-11 and 2-23 (18 days).
- Variants as recorded outputs: FX-03b (2027-02-29 → `date-invalid`, malformed; US-E2-05/AC3), FX-03c (wrong era → `detectedMonth` 2026-02 → `month-mismatch`), FX-03d (parent chose 2027-03 for this PDF → `month-mismatch`).

Stories / rules: US-E2-05/AC3, US-E3-01, US-E5-01.

## Expected outline
- `targetMonth` 2027-02, `detectedMonth` 2027-02
- `days`: 18 (02-01, 02-02, 02-03, 02-04, 02-05, 02-08, 02-09, 02-10, 02-12, 02-15, 02-16, 02-17, 02-18, 02-19, 02-22, 02-24, 02-25, 02-26)
- `noLunchDays`: 02-11 `closed` 「建国記念の日 おやすみ」; 02-23 `closed` 「天皇誕生日 おやすみ」
- `outOfMonthDays`: none
- `warnings`: none
- `hardFields` (must come back `uncertain`): none

## Files
- `answer-key.json`
- `layout.html`
- `menu.pdf (generated)`
- `recorded/hand-1.json`
- `recorded/hand-leap-invalid.json`
- `recorded/hand-wrong-era.json`
- `recorded/hand-target-2027-03.json`
- `README.md`

Recorded stand-ins (`"recordedBy": "hand"`, replaced by live recordings at M5):
- `hand-1` (ok): Stand-in: identical to the answer key.
- `hand-leap-invalid` (impossible-date): FX-03b / RX-leap-invalid: the model adds a lunch day dated 2027-02-29.
- `hand-wrong-era` (month-mismatch): FX-03c: the model converts 令和9年 to 2026 in `detectedMonth` only; dates are correct.
- `hand-target-2027-03` (month-mismatch): FX-03d: the parent chose target month 2027-03 for this February PDF; the model reports February dates.

Conventions: see `tests/plan/fixtures-plan.md` §1 and §7. `answer-key.json` → `menu` is a valid `ExtractedMenu` v1; its `id`, `source` and `extractedAt` are fixed synthetic stand-ins (not the PDF's real hash or size) and are never scored. Recorded files hold the model output (`ExtractedMenu` minus `id`, `source`, `extractedAt`, ADR 002 §3) or the HTTP failure.

## Answer-key review (BA)
- pending — reviewer, date, result (answer key checked against `menu.pdf`: dates, weekdays, dish texts, no-lunch reasons, allergen lines)
