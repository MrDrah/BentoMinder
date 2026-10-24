# FX-08 `fixture-review-hostile` — hostile review data (JSON only, no PDF)

Synthetic test fixture for e2e input tests on the review screen (US-E3-02). Not a real school's menu.

## What it tests
- `review-data.json` → `menu` is a valid `ExtractedMenu` v1 (November 2026) whose texts are hostile but within the contract: `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, 🍙🍱, a 40-character dish name, a zero-width space inside a name, a right-to-left override, half-width katakana 「ｶﾚｰﾗｲｽ」, template-injection strings, an HTML-escaped string, a 30-character ingredient, an HTML note and an `<iframe>` as a no-lunch text.
- 2026-11-06 has exactly 12 items (US-E3-02/AC5: 「料理を追加」 disabled, hint 「1日12品まで」).
- Expected on review (`expectOnReview`): every string renders literally; no script runs, nothing is injected, no request leaves the page.
- `typedInputCases` (TI-01…TI-09): values the parent types on review that the contract cannot hold (41 characters, only spaces, only ideographic spaces, surrounding spaces, 40 vs 41 emoji code points) with the expected outcome (US-E3-02/AC4).

Stories: US-E3-02/AC4, AC5; hostile-input part of the test strategy.

## Files
- `review-data.json` (`synthetic: true`, `hardFields: []`, `menu`, `expectOnReview`, `typedInputCases`)
- `README.md`

Note: the 40 vs 41 boundary is counted in Unicode code points (contract `codePoints`); TI-07/TI-08 make the emoji case explicit for the BA/Designer to confirm.

## Answer-key review (BA)
- pending — reviewer, date, result (typed-input expectations checked against US-E3-02/AC4–AC5 and the copy sheet)
