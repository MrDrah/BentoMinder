// One-off editor for tests/plan/test-strategy.md (H1 rulings). Run from the repo root.
const fs = require("fs");
const p = "tests/plan/test-strategy.md";
let s = fs.readFileSync(p, "utf8");
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error("not unique: " + a); s = s.replace(a, b); };

rep("Status: **H1** (written before any code exists)", "Status: **H1, oracle-ready** (written before any code exists; QA blockers ruled in `docs/PLAN.md` §7 on 2026-10-24 and applied)");
rep("catalog scan against the banned-phrase list,", "catalog scan against `data/banned-phrases.json` (BA-owned),");
rep("Assessment oracle (49 cases + 1,000 se", "Assessment oracle (64 cases + 1,000 se");
rep("Decision oracle: 41 transitions + 19 system e", "Decision oracle: 54 transitions + 22 system e");
rep("Reminder oracle (33 cases + 1,00", "Reminder oracle (40 cases + 1,00");
rep("checks every string against the banned-phrase lists of BR-07, BR-18, BR-19 and US-E4-04 (catalog-level, not only rendered screens).",
  "checks every string against every phrase in `data/banned-phrases.json` (BA-owned; covers BR-07, BR-18, BR-19 and US-E4-04; catalog-level, not only rendered screens). The test fails if the file is missing or empty.");
rep("Fixed cases: assessment 49 (+15 matcher), decisions 41 transitions + 19 system events, ranking 22, reminders 33.",
  "Fixed cases: assessment 64 (+15 matcher), decisions 54 transitions + 22 system events, ranking 23 + 7 hidden-source diet cases, reminders 40.");
rep("findings B1, B2, B4, B5, B6, B7, B10, B14 ruled by BA/Orchestrator |", "findings B1, B2, B4, B5, B6, B7, B10, B14 ruled by BA/Orchestrator — **done 2026-10-24** (PLAN §7); oracle specs updated (\"H1 oracle-ready\") |");

const a = s.indexOf("## 15. Findings at H1");
const b = s.indexOf("## 16. Deferred");
s = s.slice(0, a) + `## 15. Findings at H1
**Blocking for an exact oracle** — all ruled by the Orchestrator and applied to the oracle specs:
| Id | Finding | Status | Cases |
|----|---------|--------|-------|
| B1 | What D/L (and BR-09's "per liked id") count | **Resolved 2026-10-24 (PLAN §7)**: distinct found dictionary ids, then narrowed by "OQ-16 overruled" / "collapse narrowed" / collapse detail: D and L count *foods* (dish + defining ingredient within one item; identical or ancestor/descendant ids across the day, the ancestor folding into each descendant; never chained) | A11, A12, A26, A52, A58–A64; K18 |
| B2 | An id hitting a like and a dislike | **Resolved 2026-10-24 (PLAN §7)**: most specific entry wins; same-level tie → dislike; for a collapsed food: ingredient → dish → category | A27, A50–A54, A61, A62; K23 |
| B4 | Mixed key for D = 0, L = 0 | **Resolved 2026-10-24 (PLAN §7)**: U > 50% → \`assess.mixedUnknown\`, else \`assess.mixedNeutral\` | A39, A55 |
| B5 | Item with an id and an unresolved ambiguity in U | **Resolved 2026-10-24 (PLAN §7)**: counts (story wins) | A48 |
| B6 | Override (and NC/SL record) on a date a refresh makes no-lunch | **Resolved 2026-10-24 (PLAN §7)**: day shows \`no-school-lunch\`; override/record dormant, listed in "needs review", returns unchanged if the date becomes a school day again | A47, A56; T53, T54, S20, S21 |
| B7 | HB day a refresh made no-lunch or removed | **Resolved 2026-10-24 (PLAN §7)**: decision kept, flagged 「献立が変わりました」, only \`KEEP_PLAN\` (sets \`acknowledgedMenuVersion\`) or \`CLEAR_PLAN\`; reminder kept until cleared; お弁当の日 conversion is not a conflict | T42–T52, S09, S22; RM32, RM38–RM40 |
| B10 | Which instant "planned after the reminder time" compares | **Resolved 2026-10-24 (PLAN §7)**: \`plannedAt\` (first CONFIRM into HB, unchanged by CHANGE), strictly after due; a change never deletes a pending reminder | RM16, RM20, RM28, RM34–RM37 |
| B14 | Diet filter blind to non-allergen animal content | **Resolved 2026-10-24 (PLAN §7)**: ingredient-level \`animalOrigin\` tags + \`animalOriginKnown\`; unknown origin → excluded for any selected diet (\`diet-incomplete\`) | K11, K12, K20, H1–H7, PR6, PR7 |

**Still open after the rulings** (no fixed case depends on them except one \`todo\` assertion each in A57 and S10; the generators avoid the rest; QA proposals are in the specs): O-2 needs-review listing for an override on a removed date; O-3 a dish whose defining ingredient is the ancestor of an id in another item; O-4 \`definingIngredientId\` values assumed until the BA publishes them; U4 NC/SL record on a removed date; U5 planning an お弁当の日 that carries a dormant record; RU1 \`plannedAt\` after a day leaves HB and is confirmed again after the due time. Note for the BA: US-E4-01/AC15 (dislike wins for dish vs ingredient) conflicts with the later precedence ingredient → dish → category (A61).

**Not blocking H1:**
| Id | Finding | Resolution |
|----|---------|-----------|
| N1 | Onboarding "step 1 of 3" vs 4 design screens | **Resolved 2026-10-24 (PLAN §7)**: 3 input steps (profile, menu source, review), then the calendar; e2e asserts 1/3…3/3 then the calendar |
| N2 | Share text: AC vs design sample | **Resolved 2026-10-24 (PLAN §7)**: the AC's wording wins; the design sample follows; the test asserts the AC text |
| N3 | Shown-but-not-dismissed reminders | **Open** (not in the H1 rows); owner BA, by M4. No fixed case depends on it; the reminder generator writes dismissed entries only |
| N4 | Banned-phrase lists only as AC examples | **Resolved 2026-10-24 (PLAN §7)**: one BA-owned file \`data/banned-phrases.json\`; the never-strings test and PR5 read it |
| N5 | Answer-key conventions FX-Q1, FX-Q2; contract gap FX-Q3 | **Partly resolved 2026-10-24 (PLAN §7)**: FX-Q3 (\`outOfMonthDays\`) fixed by the BA; FX-Q1, FX-Q2 still open, owner BA, by M1 |
| N6 | \`quality-gate.json\` (allowUntested, commands, overlap fields, requireRemote) | **Resolved 2026-10-24 (PLAN §7)**: applied by the Orchestrator at M0 |
| N7 | After reload the calendar opens on the current Tokyo month | **Open** (not in the H1 rows); the journey test follows the current AC; BA to confirm |

Also applied: BR-14 is https only (port 443): URL cases UR-01…UR-04 in \`fixtures-plan.md\` §4 (UR-01: an \`http://\` URL is rejected before any request). BR-10 restated: RX-408 added (fallback model on 408).

No AC was found untestable. Three are verified partly by review rather than automation, with an automated existence check: US-E12-01/AC1 (document content), US-E2-08/AC4 (legal facts in the notice copy), US-E6-07/AC4 (verifier sign-off recorded in data).

` + s.slice(b);
fs.writeFileSync(p, s);
console.log("ok");
