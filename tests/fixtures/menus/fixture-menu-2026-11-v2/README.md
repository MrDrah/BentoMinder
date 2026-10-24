# FX-01b `fixture-menu-2026-11-v2` — refresh of FX-01 with two changed dates

Synthetic test fixture. School 「テストようちえん（架空）」; every page prints 「テスト用の架空の献立表です。実在の園とは関係ありません。」. Not a real school's menu.

## What it tests
- Refresh (US-E3-05): 11-18 タンドリーチキン → 鶏のから揚げ; 11-13 ゼリー removed; everything else equal to FX-01.
- Expected after confirm: `changedDatesSincePrevious` = [2026-11-13, 2026-11-18].

Stories / rules: US-E3-05.

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
- `README.md`

Recorded stand-ins (`"recordedBy": "hand"`, replaced by live recordings at M5):
- `hand-1` (ok): Stand-in: the answer key with the same smudged 11-05 item 0 flagged as in FX-01.

Conventions: see `tests/plan/fixtures-plan.md` §1 and §7. `answer-key.json` → `menu` is a valid `ExtractedMenu` v1; its `id`, `source` and `extractedAt` are fixed synthetic stand-ins (not the PDF's real hash or size) and are never scored. Recorded files hold the model output (`ExtractedMenu` minus `id`, `source`, `extractedAt`, ADR 002 §3) or the HTTP failure.

## Answer-key review (BA)
- pending — reviewer, date, result (answer key checked against `menu.pdf`: dates, weekdays, dish texts, no-lunch reasons, allergen lines)
