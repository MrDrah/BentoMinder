# FX-07 `fixture-menu-2027-03-allergens` — allergen line on every day vs none

Synthetic test fixture. School 「テストようちえん（架空）」; every page prints 「テスト用の架空の献立表です。実在の園とは関係ありません。」. Not a real school's menu.

## What it tests
- Every `AllergenDeclaration` status (BR-08, US-E2-04/AC3, US-E4-05): 3-01 declared [egg, milk, wheat]; 3-02 「特定原材料：えび・かに」; 3-03 「アレルゲン：なし」 → `declared-none` with rawText; 3-04 synonym 乳成分 → alg-milk; 3-05 line printed but unreadable → `unreadable` + `uncertain/low-legibility`; 3-08 no line → `not-declared` (never "none"); other days 「アレルゲン：小麦」.
- kcal column printed and ignored (no field for it). No national-holiday dates; 3-18 `no-lunch` 「修了式・午前保育（給食なし）」.
- Contrast with FX-01, which declares only on 11-05.

Stories / rules: US-E2-04/AC3, US-E4-05, BR-08.

## Expected outline
- `targetMonth` 2027-03, `detectedMonth` 2027-03
- `days`: 13 (03-01, 03-02, 03-03, 03-04, 03-05, 03-08, 03-09, 03-10, 03-11, 03-12, 03-15, 03-16, 03-17)
- `noLunchDays`: 03-18 `no-lunch` 「修了式・午前保育（給食なし）」
- `outOfMonthDays`: none
- `warnings`: none
- `hardFields` (must come back `uncertain`): `days[2027-03-05].allergenDeclaration`

## Files
- `answer-key.json`
- `layout.html`
- `menu.pdf (generated)`
- `recorded/hand-1.json`
- `README.md`

Recorded stand-ins (`"recordedBy": "hand"`, replaced by live recordings at M5):
- `hand-1` (ok): Stand-in: identical to the answer key (3-05 already unreadable / uncertain).

Conventions: see `tests/plan/fixtures-plan.md` §1 and §7. `answer-key.json` → `menu` is a valid `ExtractedMenu` v1; its `id`, `source` and `extractedAt` are fixed synthetic stand-ins (not the PDF's real hash or size) and are never scored. Recorded files hold the model output (`ExtractedMenu` minus `id`, `source`, `extractedAt`, ADR 002 §3) or the HTTP failure.

## Answer-key review (BA)
- pending — reviewer, date, result (answer key checked against `menu.pdf`: dates, weekdays, dish texts, no-lunch reasons, allergen lines)
