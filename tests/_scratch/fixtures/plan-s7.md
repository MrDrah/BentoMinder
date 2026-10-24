
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
