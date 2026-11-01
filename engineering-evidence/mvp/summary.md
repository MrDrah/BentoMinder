# BentoMinder — MVP engineering evidence

Source commit `2b98064d8a22b71cdce63ddca40fea185ad375f3` · collected 2026-11-01T01:41:54.477Z by app-boilerplate/evidence.mjs 0.5.0 · framework app-boilerplate 0.5.0

Overall: **UNVERIFIED**

<!-- Generated from metrics.json. Do not edit the numbers here; metrics.json is the record. -->

| Category | Status | Figures |
|---|---|---|
| Functional | UNVERIFIED | 286 of 326 criteria passing (acceptance-criteria), 0 failing, 28 unverified, 12 deferred; completion 87.7% |
| Human intervention | PASS | 34 interventions, 11 corrective; 26 of 47 agent tasks without correction |
| QA | PASS | 1317 passed / 0 failed / 0 skipped; defects 9 found, 4 open; requirement coverage 87.7%, code coverage 99.5% |
| Development cost | UNVERIFIED | billing subscription; tokens 3951063; API cost n/a (unavailable); infrastructure n/a (unavailable) |
| Recovery | UNVERIFIED | 4 interruptions, 3 resumed, 0 failed; recovery tests 0 passed |
| Delivery | PASS | CI success, deploy success, smoke pass; 0 blockers |

## Blockers
- none recorded

## Missing or unverifiable
- `cost.apiCostUsd`: no list price configured for claude-opus-5-5, claude-sonnet-5-5 (quality-gate.json → evidence.pricing); the subscription itself is billed separately and this is not zero-cost execution
- `cost.infrastructureCostUsd`: the usage log covers model tokens only; supply infrastructure costs with --usage
- `recovery.reworkMinutes`: interruptions were logged without minutes of rework
- `delivery.releaseRef`: no tag points at the measured commit
- `delivery.milestoneComplete`: functional, QA or delivery evidence is unverified

## Limitations
- 3 acceptance criteria have tests that name only their story, not the AC ID; they stay unverified until a test names the AC.
- Intervention, defect and recovery counts come from the project event log and are only as complete as that log.
- Code coverage shows which lines ran during tests; it is not evidence that the code has no defects.
- Token usage comes from Claude Code session logs snapshotted on the machines that ran this project (hour buckets; the boundary hour belongs to the earlier milestone). Sessions on other machines or in the cloud are missing unless they were snapshotted there.
- Development cost is incomplete: no list price configured for claude-opus-5-5, claude-sonnet-5-5 (quality-gate.json → evidence.pricing); the subscription itself is billed separately and this is not zero-cost execution.
- No controlled recovery test in this window: the absence of recorded failures is not evidence that work can be resumed reliably.

## Findings (Metrics agent)

<!-- The metrics agent writes its interpretation here before freeze: what the figures show, what they do not, and what evidence to collect next. No new numbers. -->

- **Overall is UNVERIFIED, and that is the correct verdict.** Functional, cost and recovery are UNVERIFIED; intervention, QA and delivery are PASS. Nothing is FAIL: 0 criteria failing, 0 tests failed, no blockers recorded. `delivery.milestoneComplete` is `null`, not true.
- **Functional (UNVERIFIED).** 286 of 326 acceptance criteria have an executed passing test naming their ID (87.7%). The other 40 are not complete: 12 are deferred (US-E7-08, US-E8-04, US-E12-01 to US-E12-04) and 28 have no test that names the AC ID (US-E0-01, US-E1-04, US-E2-04, US-E2-06, US-E2-08, US-E3-05, US-E3-06, US-E4-01, US-E6-05, US-E10-01 to US-E10-03, US-NF-01 to US-NF-05). The files do not show which of the 28 are untestable by design (for example build budgets or manual review) and which are plain gaps, and the package credits an AC only through a JUnit test that names it. The collector also notes 3 criteria whose tests name only the story. Requirement coverage equals completion (same numerator); code coverage is 99.5% of lines. Neither shows that the tests assert the right behaviour, and many criteria are named by a single test.
- **QA (PASS) has a narrow meaning.** 1317 tests ran (120 end-to-end in `junit-1.xml`, 1197 unit in `junit-2.xml`), 0 failed, 0 skipped. JUnit timestamps (01:34:58Z) are one minute after the commit time (01:33:58Z), so results are fresh for this commit. 9 defects were recorded: 5 fixed (2 P2, 3 P3) and 4 open, all P4 (D-M1-01, -03, -04, -07). PASS only requires no open P1/P2, so the 4 open P4 defects are tolerated by the verdict, not absent. All 14 defect events are dated 24-25 Oct; none are logged for the later work, so the defect count describes the early milestones, not necessarily the whole MVP. Regression and detection effectiveness are not applicable (no earlier package, no seeded defects): the package cannot say how many real defects the tests catch. 6 verifications succeeded and 1 failed (a verifier spot-check on recipes, 25 Oct).
- **Intervention (PASS means only that the log exists).** 34 interventions, 11 corrective (6 technical corrections, 1 agent failure, 4 manual implementations); 26 of 47 agent tasks had no correction. All 34 are dated 24-25 Oct except one approval on 1 Nov. Between 30 Oct and 1 Nov the log holds only task events (23 task-start, 19 task-end in `evidence/events.jsonl`) and that approval. Either no product decision or correction happened in that period or it was not logged; the files cannot tell which. The counts are therefore a lower bound and "tasks without correction" is likely flattering. Four task-start events after 25 Oct have no matching task-end.
- **Cost (UNVERIFIED), by the product owner's choice.** `billingModel` is `subscription`: the PO treats measured token use as sufficient, no list prices are configured, so `apiCostUsd` is intentionally `null` and the "cost UNVERIFIED" status reflects the absent price list, not a collection fault. I did not estimate dollars, and no figure here should be read as zero cost. Infrastructure cost is `null` too (the log covers model tokens only). Tokens are measured: 3951063 input plus output tokens and 572706238 cache tokens in total. Per model, summed from the `cost.items` rows: claude-opus-5-5 has 1599 requests, 3278 input, 2332118 output, 7942354 cache-write and 280870240 cache-read tokens; claude-sonnet-5-5 has 1577 requests, 3272 input, 1612395 output, 7964408 cache-write and 275929236 cache-read tokens. Rows are split by agent (ba, designer, developer, general-purpose, main, qa, verifier for Opus; ba, developer, general-purpose, main, metrics, qa, verifier for Sonnet). The package does not split by date, so it cannot show how much Opus use predates the Sonnet-default rule (2026-10-25) or whether Opus use after it was PO-approved. Sessions on other machines or in the cloud are counted only if snapshotted there. Tokens measure usage, not value or efficiency, and the lean-orchestration saving is not claimed here.
- **Recovery (UNVERIFIED).** 4 interruptions, 3 resumptions (all success), 0 failed, rework minutes `null` (logged without minutes). The fourth interruption (25 Oct, 13:50Z) has no resume event; the package does not show what happened to it. 0 controlled recovery tests were run, so there is no evidence that a fresh session can restore state from `CATCH-UP.md`; absence of recorded failures is not proof.
- **Delivery (PASS), with limits.** CI run 41261610957 (push) and Deploy run 41262075641 both succeeded for the measured commit. `gh run list --commit` today returns exactly these two runs, so there is no failed Deploy to explain for this commit (the earlier draft's failed Deploy belonged to its previous commit). The smoke check confirmed HTTP 200 and the marker text only. Per the PO brief the live site is the mock-only build (no real AI or backend), so PASS shows the page is served, not that any live service works. No tag points at the measured commit (`delivery.releaseRef` is `null`). The package-adding commit comes after the measured commit by design.
- **Scope limits to carry into any claim.** 12 criteria are deferred (not built or not tested yet), so "MVP complete" is not supported; the figure is 87.7% of 326 by this package's definition. The evidence is automated-test and CI based; nothing in it covers usability or product acceptance beyond the approval event on 1 Nov.
- **Nothing blocks freezing on integrity grounds.** `validate` passes and I found no contradiction in the spot-check. The Orchestrator and PO should decide whether to freeze with the intervention-log gap, the 28 unnamed ACs and the missing recovery test disclosed (they are listed above and in the generated sections), or to close some first.
- **Next evidence worth collecting (Orchestrator to decide):** log any unrecorded 30 Oct to 1 Nov corrections or decisions with `evidence.mjs event` before freezing; add tests naming the 28 ACs, or record per AC why it is not testable automatically; run one controlled recovery test and log it with `evidence.mjs event recovery-test --outcome ...`; log the outcome of the fourth interruption; tag the release commit; run `gh run list --commit 2b98064d8a22b71cdce63ddca40fea185ad375f3` again after any later deploy; if a dollar figure is ever wanted, configure `evidence.pricing` with a source URL and use `collect --revise --reason`.

### Spot-check (about 10% of the measurements)

| Measurement | Evidence file | Agrees? |
|---|---|---|
| Tests executed 1317, 0 failed, 0 skipped | `evidence/junit-1.xml` (120) and `evidence/junit-2.xml` (1197), suite headers show 0 failures, 0 errors, 0 skipped | yes |
| Results fresh | JUnit timestamp 01:34:58Z vs commit time 01:33:58Z in `evidence/git.json` | yes |
| Criteria 286 PASS / 28 UNVERIFIED / 12 DEFERRED of 326 | per-criterion list in `metrics.json` (re-tallied), `evidence/stories.md` | yes |
| Deferred stories | `quality-gate.json` allowUntested vs the 6 deferred stories in `metrics.json` | partly checked (list present; story IDs match the criteria list) |
| Intervention counts by type (16, 7, 6, 1, 4) and 4 interruptions, 3 resumes | `evidence/events.jsonl` (re-tallied by type) | yes |
| Defects 9 found, 5 fixed, 4 open P4 | latest state per defect ID in `evidence/events.jsonl` | yes |
| CI and Deploy success, run IDs | `evidence/ci-runs.json` and live `gh run list --commit` | yes |
| Smoke pass | `evidence/smoke.json` (HTTP 200, marker found) | yes |
| Tokens per model | `cost.items` rows re-summed per model; totals equal 3951063 + 572706238 | yes |
| Code coverage 99.5% | `evidence/coverage-summary.json` | yes (lines pct 99.49) |
