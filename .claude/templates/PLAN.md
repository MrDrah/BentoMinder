# Plan — {{PROJECT_NAME}}

Owner: Orchestrator · Status: draft · {{DATE}} · framework v{{FRAMEWORK_VERSION}}

## 1. Product summary
<!-- From docs/PROJECT_BRIEF.md §1 and §3. State the core rule and the "never" rule. -->

| MVP | v1 | Later |
|-----|----|-------|
| | | |

**Seams the MVP leaves for v1** (see the `requirements` skill §7):
- Identity:
- Persistence:
- Integrations:
- Privacy:

## 2. Roles
| Role | Agent | Primary output |
|------|-------|----------------|
| Business Analyst | `ba` | Stories + ACs, data contract, dictionary, sourced content |
| UX/UI Designer | `designer` | Tokens, component specs, flows, a11y, copy |
| Developer/Architect | `developer` | ADRs, domain logic, UI, CI/CD, (v1) API/DB/auth |
| QA Engineer | `qa` | Test strategy, oracle, e2e, verification, report |

## 3. Business rules
Only the Orchestrator changes these; every change is logged in §7.

| ID | Rule |
|----|------|
| **BR-01** | |

## 4. Data contracts
Semantics owned by the BA (`docs/ba/data-contract.md`), format and validator by the Developer.

## 5. Phases and handoff gates
```
Phase 0  Kick-off (Orchestrator): brief → this plan → BR table approved
Phase 1  BA: stories, data contract, seed content ───────┐
Phase 2  UX: tokens, components, flows   Dev: ADRs, domain, validator
Phase 3  Dev: UI build ◄─────────────────────────────────┘   QA: strategy, oracle
Phase 4  QA: e2e, verification ─► defects ─► Dev fixes ─► regression
Phase 5  Orchestrator: release gate → live
```

| Gate | From → To | Must be true |
|------|-----------|--------------|
| H1 | BA → UX, Dev, QA | Every story has GWT ACs and an ID. Data contract v1 published and enforced by the validator. Open questions resolved or deferred in §7. Seed content (if any) validates. |
| H2 | UX → Dev | Tokens JSON + CSS (light/dark). Every component state at mobile + desktop. Flows map to story IDs. Contrast audit passes. Copy sheet complete. |
| H3 | Dev → QA | `validate.mjs gate --stage dev` green. Domain coverage ≥ 90%. Preview deploy works on mobile + desktop. Budgets met. Known-issues list handed over. |
| H4 | QA → Orchestrator | `validate.mjs gate --stage release` green (trace, docs, 0 UNVERIFIED sources). Oracle diff 0. 0 open P1/P2. a11y + performance thresholds met. Test report published with go/no-go. |
| H5 | Orchestrator → live | PR merged to main with the required CI checks. Deploy job confirmed green CI for that commit. Live site verified. `CATCH-UP.md` updated. |

## 6. Definition of Done (MVP)
- [ ] All MVP stories meet their ACs (verified by QA).
- [ ] Data validates; every reference resolves; content is sourced and passes the overlap check (if applicable).
- [ ] The core rule holds: oracle vs engine 0 differences.
- [ ] WCAG 2.1 AA (axe 0 serious/critical), keyboard-only journey, 360 px and desktop.
- [ ] Performance budget met.
- [ ] Deployed from CI; live site verified.

## 7. Decision & change log
| Date | Decision | By |
|------|----------|----|
| {{DATE}} | Plan created from the project brief. | Orchestrator |
