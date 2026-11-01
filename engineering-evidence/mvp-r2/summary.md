# BentoMinder — MVP engineering evidence (revision 2)

Source commit `6e63c79544a10d61409b82d08bc31cd4e7daebbd` · collected 2026-11-01T02:20:31.451Z by app-boilerplate/evidence.mjs 0.5.0 · framework app-boilerplate 0.5.0

Overall: **UNVERIFIED**

<!-- Generated from metrics.json. Do not edit the numbers here; metrics.json is the record. -->

| Category | Status | Figures |
|---|---|---|
| Functional | UNVERIFIED | 286 of 326 criteria passing (acceptance-criteria), 0 failing, 28 unverified, 12 deferred; completion 87.7% |
| Human intervention | PASS | 58 interventions, 25 corrective; 24 of 48 agent tasks without correction |
| QA | PASS | 1317 passed / 0 failed / 0 skipped; defects 23 found, 4 open; requirement coverage 87.7%, code coverage 99.5% |
| Development cost | UNVERIFIED | billing subscription; tokens 3968600; API cost n/a (unavailable); infrastructure n/a (unavailable) |
| Recovery | PASS | 6 interruptions, 6 resumed, 0 failed; recovery tests 1 passed |
| Delivery | PASS | CI success, deploy success, smoke pass; 0 blockers |

## Blockers
- none recorded

## Missing or unverifiable
- `cost.apiCostUsd`: no list price configured for claude-opus-5-5, claude-sonnet-5-5 (quality-gate.json → evidence.pricing); the subscription itself is billed separately and this is not zero-cost execution
- `cost.infrastructureCostUsd`: the usage log covers model tokens only; supply infrastructure costs with --usage
- `delivery.releaseRef`: no tag points at the measured commit
- `delivery.milestoneComplete`: functional, QA or delivery evidence is unverified

## Limitations
- 3 acceptance criteria have tests that name only their story, not the AC ID; they stay unverified until a test names the AC.
- Intervention, defect and recovery counts come from the project event log and are only as complete as that log.
- Code coverage shows which lines ran during tests; it is not evidence that the code has no defects.
- Token usage comes from Claude Code session logs snapshotted on the machines that ran this project (hour buckets; the boundary hour belongs to the earlier milestone). Sessions on other machines or in the cloud are missing unless they were snapshotted there.
- Development cost is incomplete: no list price configured for claude-opus-5-5, claude-sonnet-5-5 (quality-gate.json → evidence.pricing); the subscription itself is billed separately and this is not zero-cost execution.
- Revision 2 supersedes mvp: Late-logged the corrections, defects, interruptions, resumes, decisions and approvals of 2026-10-26 to 2026-11-01 that were missing from the event log (marked logged late)

## Findings (Metrics agent)

<!-- The metrics agent writes its interpretation here before freeze: what the figures show, what they do not, and what evidence to collect next. No new numbers. -->

- **Why r2 differs from r1.** The measured commit moved from `2b98064` to `6e63c79`, and the only substantive change is the event log: 61 events marked "(logged late 2026-11-01)" were appended. Test results, stories, coverage and CI are the same kind of evidence as in r1. Criteria counts (286 of 326 passing, 28 unverified, 12 deferred) and test totals (1317 passed, 0 failed) are as the collector computed them. I did not re-run any suite.
- **The late-logged events are reconstructed, not contemporaneous.** They come from the Orchestrator's own record, written on 2026-11-01. Their `at` timestamps are the logging time, not the time the event happened, so the log cannot show when any of them occurred or how they were spread across milestones. The "(logged late)" prefix is the only marker. Treat them as the Orchestrator's account, not independent evidence.
- **Intervention figures changed a lot, and still depend on the log.** Interventions went from 34 to 58 and corrective ones from 11 to 25. The corrective types are technical corrections 6 to 18, agent failures 1 to 3, and manual implementations unchanged at 4. Product decisions went from 16 to 23 and approvals from 7 to 10. Agent tasks without correction went from 26 of 47 to 24 of 48, so r1's higher share was an artefact of missing corrections. Counts are still only as complete as the log, and nothing here proves no further corrections went unrecorded. Per the rules they were not reconstructed from git history.
- **QA and defects.** Defects found went from 9 to 23 (P1 0, P2 4, P3 7, P4 12), with 15 fixed, 4 deferred and 4 open. The 4 open defects are P4. QA status is PASS because the open defects are low severity, no regressions are recorded and no test failed. The defect history is also largely late-logged, so it describes the Orchestrator's and QA's account, not defect tracker data.
- **Recovery changed from no evidence to one self-reported pass.** Interruptions went from 4 to 6 and resumes from 3 to 6, with 0 failed. Rework time of 720 minutes is now recorded where r1 had none. There is one recovery-test event (a fresh session restored state from `CATCH-UP.md` on 2026-10-30), which moves the category to PASS. It is a late-logged account of a test done at the time, not a collector-observed run, so the PASS rests on the Orchestrator's record. A fresh, logged controlled test would be stronger.
- **Plausibility check against git (not used for counts).** The CI-fix corrections the log describes have matching commits: test:e2e script, fetching cited sources, Chromium install with job timeouts, and building before the e2e job. The verifier-driven yield fixes also have matching commits. This shows the items are plausible. It does not show the list is complete, and I did not compare counts.
- **Delivery.** CI and Deploy runs for `6e63c79` are completed successes in `ci-runs.json`, and the smoke check passes. The live site is mock-only, as set in the PO brief, so the smoke marker proves the deployed build serves, not live-data behaviour. No release tag points at the measured commit.
- **Still UNVERIFIED, and why.** Overall is UNVERIFIED because Functional is UNVERIFIED: 28 criteria have no executed test naming them (3 have tests naming only the story), and 12 are deferred, so completion of 87.7% counts them as not complete. Cost is UNVERIFIED because the PO chose subscription billing and no list prices are configured for claude-opus-5-5 and claude-sonnet-5-5. Tokens (3968600 input and output) are measured and barely differ from r1 (3951063), as expected for a log-only revision. Infrastructure cost is unavailable. Usage from other machines or the cloud is counted only if snapshotted.
- **Known limitations to carry forward.** Deferred stories, mock-only live site, 4 open P4 defects, no release tag, no API cost figure, and no seeded-defect data for detection effectiveness.
- **Next evidence worth collecting.** Add test names with AC IDs for the 28 unverified criteria and re-run only the JUnit test command. Set `evidence.pricing` from the provider price list if a dollar figure is wanted. Run and log a fresh controlled recovery test at the time. Create a release tag with `gh release create` or `git tag` if the PO wants a tagged release. From now on, log corrections and defects as they happen.
