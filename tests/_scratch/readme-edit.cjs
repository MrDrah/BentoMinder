// One-off editor for tests/oracle/README.md and tests/plan/fixtures-plan.md (H1 rulings). Run from the repo root.
const fs = require("fs");
function edit(p, pairs) {
  let s = fs.readFileSync(p, "utf8");
  for (const [a, b] of pairs) {
    if (s.split(a).length !== 2) throw new Error(p + " not unique: " + a);
    s = s.replace(a, b);
  }
  fs.writeFileSync(p, s);
}

edit("tests/oracle/README.md", [
  ["Status: H1 (specifications only; no oracle code exists yet, there is no app)",
   "Status: **H1 oracle-ready** (specifications only; no oracle code exists yet, there is no app). Rulings of `docs/PLAN.md` §7 (2026-10-24) applied."],
  ["| 49 decision-table cases + 15 matcher cases |", "| 57 decision-table cases + 15 matcher cases |"],
  ["| 41 transitions + 19 system events (+ 3 unspecified rows) |", "| 54 transitions + 22 system events |"],
  ["| 22 cases over a 13-recipe synthetic library, 18 profiles |", "| 23 cases over a 13-recipe synthetic library (19 profiles) + 7 hidden-source cases over a 6-recipe diet library |"],
  ["| 33 cases |", "| 40 cases |"],
  ["Test titles name the ACs they cover, e.g. `US-E4-01/AC2 US-E4-01/AC7 oracle: 49 fixed + 1000 seeded days, 0 differences`.",
   "Test titles name the ACs they cover, e.g. `US-E4-01/AC2 US-E4-01/AC7 oracle: 57 fixed + 1000 seeded days, 0 differences`."],
]);

let r = fs.readFileSync("tests/oracle/README.md", "utf8");
const i = r.indexOf("## Open findings");
r = r.slice(0, i) + `## Rulings and what is still open
The H1 blockers B1, B2, B4, B5, B6, B7, B10 and B14 were ruled by the Orchestrator on 2026-10-24 (\`docs/PLAN.md\` §7 "H1 rulings on QA blockers", "B6", "B10", "B14" and the H1 follow-ups). Every case that depended on them now has a hand-computed expected result; the computation is in the case row. Summary in \`tests/plan/test-strategy.md\` §15.

Still open, each with a QA proposal; **no fixed case depends on them** except one assertion each in A57 and S10, which run as \`todo\` with the reason in the title; the random generators avoid the situations:
| Id | Oracle | Situation |
|----|--------|-----------|
| O-2 | assessment A57 | override on a date a refresh **removes**: is the date listed in "needs review"? |
| U4 | decision S10 | stored NC/SL record on a date a refresh **removes**: displayed state and allowed actions |
| U5 | decision (generator only) | parent plans an お弁当の日 that carries a dormant NC/SL record |
| RU1 | reminder (generator only) | \`plannedAt\` when a day leaves HB and is confirmed again after the due time |
| N3 (B13) | reminder (generator only) | a reminder shown but not dismissed: shown again on next open? |
`;
fs.writeFileSync("tests/oracle/README.md", r);

edit("tests/plan/fixtures-plan.md", [
  ["| RX-5xx / RX-timeout | HTTP 500/503/504, 60 s timeout | US-E2-06/AC2, US-NF-04/AC3 |",
   "| RX-5xx / RX-timeout | HTTP 500/503/504, 60 s timeout | US-E2-06/AC2, US-NF-04/AC3 |\n| RX-408 | HTTP 408 from the provider: call 2 = fallback model, then stop (BR-10 as restated at H1) | US-E2-07/AC4 |"],
  ["· URL strings of 2,048 and 2,049 characters ·",
   "· URL strings of 2,048 and 2,049 characters (both `https://`) · BR-14 https-only cases (PLAN §7, 2026-10-24), see the table below ·"],
]);

let f = fs.readFileSync("tests/plan/fixtures-plan.md", "utf8");
const j = f.indexOf("## 5. Store fixtures");
f = f.slice(0, j) + `### URL input cases (BR-14: https only, port 443, ≤ 2,048 characters)
| Id | Input | Expected | Story |
|----|-------|----------|-------|
| UR-01 | \`http://example-kinder.test/menu/2026-11.pdf\` | rejected before any request: import not started, 0 calls to \`/api/menu/fetch-pdf\`, 「PDFのURL（https://…）を入力してください」 shown | US-E2-01/AC2 |
| UR-02 | \`https://example-kinder.test:8443/menu/2026-11.pdf\` | rejected the same way (port other than 443) | US-E2-01/AC2 |
| UR-03 | \`https://example-kinder.test:443/menu/2026-11.pdf\` | accepted (explicit default port) | US-E2-01/AC1 |
| UR-04 | \`HTTPS://EXAMPLE-KINDER.TEST/menu/2026-11.pdf\` | accepted (scheme and host are case-insensitive) | US-E2-01/AC1 |
The proxy repeats the check server-side (ADR 002 SSRF guard): a contract test posts UR-01 and UR-02 straight to \`/api/menu/fetch-pdf\` and expects a refusal with 0 outbound fetches.

` + f.slice(j);
fs.writeFileSync("tests/plan/fixtures-plan.md", f);
console.log("ok");
