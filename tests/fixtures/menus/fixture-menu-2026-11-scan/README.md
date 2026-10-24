# FX-06 `fixture-menu-2026-11-scan` — scanned-image style (no text layer)

Synthetic test fixture. School 「テストようちえん（架空）」; every page prints 「テスト用の架空の献立表です。実在の園とは関係ありません。」. Not a real school's menu.

## What it tests
- The FX-01 page rasterised at 150 dpi, rotated 1.5°, light seeded noise, the みどり (green) ingredient column at reduced contrast, embedded as the only content (no text layer).
- Live eval only (accuracy reported, not gated). In the gate only the recorded output is used; the answer key is FX-01 plus `hardFields` for every green-column ingredient.

Stories / rules: US-E2-04 (live eval).

## Expected outline
- `targetMonth` 2026-11, `detectedMonth` 2026-11
- `days`: 18 (11-02, 11-04, 11-05, 11-06, 11-09, 11-10, 11-11, 11-12, 11-13, 11-14, 11-16, 11-17, 11-18, 11-19, 11-24, 11-25, 11-26, 11-30)
- `noLunchDays`: 11-20 `bento-day` 「お弁当の日」; 11-27 `no-lunch` 「午前保育（給食なし）」
- `outOfMonthDays`: none
- `warnings`: none
- `hardFields` (must come back `uncertain`): `days[2026-11-05].items[0].text`, `days[2026-11-04].ingredients[4].text`, `days[2026-11-04].ingredients[5].text`, `days[2026-11-04].ingredients[6].text`, `days[2026-11-05].ingredients[5].text`, `days[2026-11-05].ingredients[6].text`, `days[2026-11-16].ingredients[4].text`, `days[2026-11-16].ingredients[5].text`

## Files
- `answer-key.json`
- `layout.html`
- `menu.pdf (generated)`
- `recorded/hand-1.json`
- `README.md`

Recorded stand-ins (`"recordedBy": "hand"`, replaced by live recordings at M5):
- `hand-1` (ok): Stand-in: FX-01 hand-1 plus every green-column ingredient flagged low-legibility.

Conventions: see `tests/plan/fixtures-plan.md` §1 and §7. `answer-key.json` → `menu` is a valid `ExtractedMenu` v1; its `id`, `source` and `extractedAt` are fixed synthetic stand-ins (not the PDF's real hash or size) and are never scored. Recorded files hold the model output (`ExtractedMenu` minus `id`, `source`, `extractedAt`, ADR 002 §3) or the HTTP failure.

## Answer-key review (BA)
- pending — reviewer, date, result (answer key checked against `menu.pdf`: dates, weekdays, dish texts, no-lunch reasons, allergen lines)
