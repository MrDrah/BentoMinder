# Test strategy — {{PROJECT_NAME}}

Owner: QA · {{DATE}}

## 1. What must never happen
<!-- From the brief §3. This is the oracle's job. -->

## 2. Levels
| Level | Tool | Scope | Owner |
|-------|------|-------|-------|
| Unit | Vitest | `src/domain`, fixtures only, ≥ 90% coverage | Dev (QA reviews) |
| Integration | Testing Library | UI flows against the domain | Dev + QA |
| Oracle | Vitest + seeded random inputs | naive reference vs engine, 0 differences | QA |
| Data / content | Vitest + `validate.mjs overlap` | validator rules, verification matrix, copied wording | QA + BA |
| E2E | Playwright (desktop + mobile) + axe | every story's ACs on the production build | QA |
| (v1) Contract | mocked server | each API adapter | Dev |
| (v1) Auth & isolation | API/DB tests | user A ≠ user B, protected routes, deletion | QA |
| Manual | — | Safari, Firefox, iOS, Android, screen readers, Lighthouse | QA |

## 3. Traceability
Test names start with the story ID (`US-E3-02 …`). `validate.mjs trace` fails the gate for any untested story. Deferred stories are listed in `quality-gate.json` → `trace.allowUntested` with a reason in §7 here.

## 4. Entry / exit
- Entry: ACs frozen (H1), preview build available (H3).
- Exit (H4): trace passes, oracle 0 diff, 0 open P1/P2, a11y + performance thresholds met.

## 5. Severity
| P1 | Core rule broken, data loss, security/privacy breach, crash on the main journey |
|----|---|
| P2 | A Must story's AC fails; accessibility blocker |
| P3 | Should/Could story fails; visual defect with a workaround |
| P4 | Cosmetic |

## 6. Content verification (if the app ships content)
Stratified sample (≥ 10%): which strata and why. Checks C1…Cn agreed with the BA. Matrix written by a test (`WRITE_MATRIX=1`).

## 7. Deferred / not covered
