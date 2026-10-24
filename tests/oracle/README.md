# Oracles — BentoMinder

Owner: QA · 2026-10-24 · Status: **H1 oracle-ready** (specifications only; no oracle code exists yet, there is no app). Rulings of `docs/PLAN.md` §7 (2026-10-24) applied.

An oracle is a deliberately naive, independent re-implementation of one core rule. The real engine and the oracle are run on the same fixed and seeded-random inputs; **any difference is a P1 defect** until triaged (engine bug: stays P1; oracle bug: fixed in the oracle, noted in the test report).

## Specifications
| Oracle | Rules | Fixed cases | Random | Built in |
|--------|-------|-------------|--------|----------|
| [assessment-oracle.md](assessment-oracle.md) | BR-04, BR-05, BR-25 | 65 decision-table cases + 15 matcher cases | 1,000 days per run | M2 |
| [decision-state-oracle.md](decision-state-oracle.md) | BR-02, BR-03, BR-13, BR-19, BR-25, BR-27 | 56 transitions + 23 system events | 1,000 event sequences | M2 |
| [ranking-oracle.md](ranking-oracle.md) | BR-06, BR-07, BR-09, R-3 | 23 cases over a 13-recipe synthetic library (19 profiles) + 7 hidden-source cases over a 7-recipe diet library | 1,000 profiles × synthetic and real library | M3 |
| [reminder-oracle.md](reminder-oracle.md) | BR-15 … BR-18 | 43 cases | 1,000 states | M4 |

## Independence rules (enforced from M2 by a test)
1. Oracle code lives in `tests/oracle/impl/` and **imports nothing from `src/`** and no third-party package (Node built-ins only). A test (`tests/oracle/independence.test.ts`) scans `tests/oracle/impl/**` and fails on any `src/` or package import.
2. Only the comparison tests (`tests/oracle/*.oracle.test.ts`) import both the engine (through its public `src/domain` entry) and the oracle.
3. Oracles may read the same **data** as the engine (`data/dictionary.json`, `data/library.json`, fixtures), never its code. Matching, date arithmetic and JST conversion are re-implemented naively (e.g. O(n²) substring scan; JST = UTC + 9 h with integer arithmetic, no `Intl`, no date library).
4. The specs here were written from `docs/PLAN.md` §3, the stories and the data contract, not from ADR 004. When the engine and the spec disagree, the spec is checked against the BR text first; the ADR is never the tie-breaker.

## Planned layout (M2–M4)
```
tests/oracle/
  impl/assessment.ts  impl/decision.ts  impl/ranking.ts  impl/reminders.ts  impl/prng.ts (mulberry32)
  cases/assessment.json  cases/decisions.json  cases/ranking.json  cases/reminders.json   ← transcribed from the tables in these specs
  assessment.oracle.test.ts  decision.oracle.test.ts  ranking.oracle.test.ts  reminders.oracle.test.ts
  independence.test.ts
```
Test titles name the ACs they cover, e.g. `US-E4-01/AC2 US-E4-01/AC7 oracle: 65 fixed + 1000 seeded days, 0 differences`. The seed is fixed in the gate (`20261024`) and printed on failure; `ORACLE_SEED=<n>` runs other seeds locally. The diff count per oracle is written to `reports/oracle-diff.json` for the test report.

## Rulings and what is still open
The H1 blockers B1, B2, B4, B5, B6, B7, B10 and B14 were ruled by the Orchestrator on 2026-10-24 (`docs/PLAN.md` §7 "H1 rulings on QA blockers", "B6", "B10", "B14", the H1 follow-ups, "OQ-16 overruled", "OQ-16 collapse narrowed" and the collapse detail). Every case that depended on them now has a hand-computed expected result; the computation is in the case row. Summary in `tests/plan/test-strategy.md` §15.

The last open items (O-2, O-3, O-4, U4, U5, RU1, N3) were closed by PLAN §7 "H1 closing rulings" and the BA's `definingIngredientId` (24 of 55 dishes set). **Nothing is open: every fixed case is asserted, no `todo`, and the random generators exclude no situation.**
