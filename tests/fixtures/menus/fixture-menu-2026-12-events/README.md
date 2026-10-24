# FX-02 `fixture-menu-2026-12-events` — holidays, お弁当の日 and winter break (calendar grid)

Synthetic test fixture. School 「テストようちえん（架空）」; every page prints 「テスト用の架空の献立表です。実在の園とは関係ありません。」. Not a real school's menu.

## What it tests
- Grid layout (Mon–Fri columns, one row per week; 11-30 cell hatched): date mapping from day numbers + column header.
- Several no-lunch reasons in one month: 12-11 `bento-day`, 12-23 `no-lunch`, winter-break band → `closed` on in-month weekdays 12-24, 12-25, 12-28…12-31 (FX-Q1: weekdays only).
- Band continues into January: 2027-01-01, 01-04, 01-05, 01-06 → `outOfMonthDays` as `no-lunch-day` (US-E2-05/AC4; FX-Q3 resolved by contract H1).
- Event note: 12-18 `notes` = ["クリスマス会"] printed small with ★. Every lunch day has an おやつ item (kind `snack`).
- Next-month prompt (US-E3-06/AC2) and the weekly reminder across 11-30…12-06 (RM24) once confirmed.

Stories / rules: US-E2-05/AC4, US-E3-01/AC1, US-E3-06/AC2, US-E5-08.

## Expected outline
- `targetMonth` 2026-12, `detectedMonth` 2026-12
- `days`: 15 (12-01, 12-02, 12-03, 12-04, 12-07, 12-08, 12-09, 12-10, 12-14, 12-15, 12-16, 12-17, 12-18, 12-21, 12-22)
- `noLunchDays`: 12-11 `bento-day` 「お弁当の日」; 12-23 `no-lunch` 「終業式・午前保育（給食なし）」; 12-24 `closed` 「冬休み（12月24日〜1月6日）」; 12-25 `closed` 「冬休み（12月24日〜1月6日）」; 12-28 `closed` 「冬休み（12月24日〜1月6日）」; 12-29 `closed` 「冬休み（12月24日〜1月6日）」; 12-30 `closed` 「冬休み（12月24日〜1月6日）」; 12-31 `closed` 「冬休み（12月24日〜1月6日）」
- `outOfMonthDays`: 2027-01-01 no-lunch-day, 2027-01-04 no-lunch-day, 2027-01-05 no-lunch-day, 2027-01-06 no-lunch-day
- `warnings`: none
- `hardFields` (must come back `uncertain`): none

## Files
- `answer-key.json`
- `layout.html`
- `menu.pdf (generated)`
- `recorded/hand-1.json`
- `README.md`

Recorded stand-ins (`"recordedBy": "hand"`, replaced by live recordings at M5):
- `hand-1` (ok): Stand-in: identical to the answer key (a perfect read; grid fixtures test mapping, not legibility).

Conventions: see `tests/plan/fixtures-plan.md` §1 and §7. `answer-key.json` → `menu` is a valid `ExtractedMenu` v1; its `id`, `source` and `extractedAt` are fixed synthetic stand-ins (not the PDF's real hash or size) and are never scored. Recorded files hold the model output (`ExtractedMenu` minus `id`, `source`, `extractedAt`, ADR 002 §3) or the HTTP failure.

## Answer-key review (BA)
- pending — reviewer, date, result (answer key checked against `menu.pdf`: dates, weekdays, dish texts, no-lunch reasons, allergen lines)
