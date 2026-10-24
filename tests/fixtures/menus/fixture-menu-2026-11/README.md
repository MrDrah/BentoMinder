# FX-01 `fixture-menu-2026-11` — standard month (the journey fixture)

Synthetic test fixture. School 「テストようちえん（架空）」; every page prints 「テスト用の架空の献立表です。実在の園とは関係ありません。」. Not a real school's menu.

## What it tests
- Date mapping from 「4日（水）」-style rows; 文化の日 (11-03) and 勤労感謝の日 (11-23) have no row and must not appear.
- Dish texts and kinds; standalone 「カレー」 (11-06); snack-only Saturday 11-14 (US-E4-01/AC10, OQ-07).
- 三色食品群 ingredient columns on 11-04, 11-05, 11-16 (`listed`, `foodGroup` set); every other day `not-listed` (BR-11), incl. 11-10.
- Allergen line only on 11-05 (`declared` [alg-egg, alg-wheat]); every other day `not-declared`, never `declared-none` (BR-08).
- No-lunch days: 11-20 `bento-day` 「お弁当の日」, 11-27 `no-lunch` 「午前保育（給食なし）」.
- Hard field: 11-05 item 0 is printed smudged (CSS blur) and must come back `uncertain`.
- The sample child's whole month for the assessment oracle: 7 likely, 5 low, 5 mixed, 2 no-lunch (US-E5-04/AC1).

Stories / rules: US-E0-01, US-E2-04/AC1–AC6, US-E3-01/AC2, US-E3-02/AC1, US-E4-01/AC10, US-E5-04/AC1, contract §5.

## Expected outline
- `targetMonth` 2026-11, `detectedMonth` 2026-11
- `days`: 18 (11-02, 11-04, 11-05, 11-06, 11-09, 11-10, 11-11, 11-12, 11-13, 11-14, 11-16, 11-17, 11-18, 11-19, 11-24, 11-25, 11-26, 11-30)
- `noLunchDays`: 11-20 `bento-day` 「お弁当の日」; 11-27 `no-lunch` 「午前保育（給食なし）」
- `outOfMonthDays`: none
- `warnings`: none
- `hardFields` (must come back `uncertain`): `days[2026-11-05].items[0].text`

## Files
- `answer-key.json`
- `layout.html`
- `menu.pdf (generated)`
- `recorded/hand-1.json`
- `recorded/hand-malformed.json`
- `recorded/hand-schema-invalid.json`
- `recorded/hand-out-of-month.json`
- `recorded/hand-duplicate.json`
- `recorded/hand-not-a-menu.json`
- `recorded/hand-rate-limited.json`
- `recorded/hand-rate-limited-no-retry-after.json`
- `README.md`

Recorded stand-ins (`"recordedBy": "hand"`, replaced by live recordings at M5):
- `hand-1` (ok): Journey stand-in (RX-ok): the answer key with 3 uncertain fields; 11-05 item 0 misread as 「さばのみそに」.
- `hand-malformed` (malformed): RX-malformed: call 1 returns text that is not JSON (truncated, wrapped in a code fence).
- `hand-schema-invalid` (schema-invalid): RX-schema-invalid: valid JSON without the required `days` field.
- `hand-out-of-month` (out-of-month): RX-out-of-month: the hand-1 output plus a lunch day 2026-12-01 in `days`.
- `hand-duplicate` (duplicate-date): RX-duplicate: the hand-1 output with a second 2026-11-05 entry (the 牛乳 printed on its own line read as another day).
- `hand-not-a-menu` (not-a-menu): RX-not-a-menu: the model finds no dates at all.
- `hand-rate-limited` (rate-limited): RX-429-retry60: HTTP 429 RESOURCE_EXHAUSTED with Retry-After 60.
- `hand-rate-limited-no-retry-after` (rate-limited): RX-429: HTTP 429 without a Retry-After header.

Conventions: see `tests/plan/fixtures-plan.md` §1 and §7. `answer-key.json` → `menu` is a valid `ExtractedMenu` v1; its `id`, `source` and `extractedAt` are fixed synthetic stand-ins (not the PDF's real hash or size) and are never scored. Recorded files hold the model output (`ExtractedMenu` minus `id`, `source`, `extractedAt`, ADR 002 §3) or the HTTP failure.

## Answer-key review (BA)
- pending — reviewer, date, result (answer key checked against `menu.pdf`: dates, weekdays, dish texts, no-lunch reasons, allergen lines)
