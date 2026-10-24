---
name: milestone-evidence
description: Produce a standard, verifiable Engineering Evidence Package at an approved milestone (MVP, beta, 1.0, later releases) — functional success, human intervention, QA effectiveness, development cost, recovery and delivery — from existing test, CI, git and event-log evidence, validated against a versioned schema and frozen so it is never silently overwritten. Also covers the lightweight event log kept during development. Use at milestones and when recording interventions, defects or interruptions; not for routine coding tasks.
---

# Milestone evidence

`scripts/evidence.mjs` (Node ≥ 20, no dependencies) does the measuring. The `metrics` agent interprets. The package format is a public contract (`.claude/templates/evidence/*.schema.json`; consumer guide in the framework's `docs/EVIDENCE-CONTRACT.md`), so a portfolio site or any other tool can read it without Claude Code.

```bash
E=".claude/skills/milestone-evidence/scripts/evidence.mjs"
node $E init                                   # once: "evidence" block in quality-gate.json, event log, usage log
node $E event <type> --summary "…" [options]   # during development, a few times a week
node $E usage                                  # token-usage snapshot; automatic at every session start
node $E collect --milestone mvp                # at the milestone: draft package
node $E validate                               # every package; also part of "validate.mjs gate --stage release"
node $E freeze --package mvp                   # publish: hashes recorded in engineering-evidence/index.json
node $E collect --milestone mvp --revise --reason "…"   # correction: new package mvp-r2, mvp stays as it was
```

## 1. During development: the event log (cheap, as it happens)

`docs/evidence/events.jsonl` is append-only. One line per event, a summary of at most 200 characters, public-safe (no secrets, emails, private prompts or local paths: `event` refuses them).

| When | Type | Who records it |
|------|------|----------------|
| Product owner decides scope or behaviour (also a §7 decision-log row) | `product-decision` | Orchestrator |
| Product owner approves a gate, plan or release | `approval` | Orchestrator |
| A human or the Orchestrator corrects an agent's technical output | `technical-correction --task <t>` | Orchestrator |
| An agent run fails, loops, or produces unusable work | `agent-failure --task <t>` | Orchestrator |
| A human writes code or content the agents should have produced | `manual-implementation` | Orchestrator |
| Agent dispatched / integrated | `task-start`, `task-end` | **automatic**: `validate.mjs task-start` and `diff-guard --task` |
| Session cut off (usage limit, crash, lost context) | `interruption [--minutes n]` | Orchestrator, at the next session start |
| Work resumed from `CATCH-UP.md` | `resume --outcome success\|failure [--minutes n]` | Orchestrator |
| Controlled recovery test: a fresh session restores state from `CATCH-UP.md` alone | `recovery-test --outcome …` | Orchestrator |
| Defect found, fixed or deferred | `defect --defect D-12 --severity P2 --state found\|fixed\|deferred [--regression]` | QA |
| Independent check of another agent's output | `verification --outcome success\|failure --task <t>` | Orchestrator (verifier result) |

Product decisions and approvals are normal work; only `technical-correction`, `agent-failure` and `manual-implementation` count as corrective. Intervention counts are never reconstructed from git history.

### Token usage (automatic, every session)

Claude Code records the token usage of every response in its session logs on the machine that ran the session. It deletes old logs after a while. `evidence.mjs usage` copies the numbers into `docs/evidence/usage.jsonl`: one record per session, UTC hour, model and agent (main session or sub-agent type), with requests and input, output, cache-write and cache-read tokens. No prompts, paths or raw session ids are copied. The session-start hook runs it at the start of **every** session, and `collect` runs it again. Commit `usage.jsonl` with your normal work. `evidence.mjs validate` warns when the last snapshot is more than 7 days older than the latest commit.

- A record is a running total and is only appended when the bucket grew. A cleaned-up session log never lowers what was recorded.
- Sessions count for the project whose folder they ran in, including its worktrees. Sessions on another machine or in the cloud are only counted if `evidence.mjs usage` ran there, and the package says so.
- Cost: set `billingModel` (`api`, `subscription`, `mixed`) and, to get a dollar figure, `pricing` per model in `quality-gate.json` (USD per million tokens for input, output, cache write and cache read, with the `source` URL of the price list). Copy the prices from the provider's price list; never guess them. Tokens are `measured`. Cost is tokens × price, so it is `estimated`. For a subscription it is the API-equivalent figure; the subscription itself is billed separately. Without prices, cost stays unavailable with the reason.
- Infrastructure costs (CI minutes, hosting) aren't in the session logs. Supply them with `collect --usage <file>`, which replaces the log for that package.

## 2. At a milestone

Milestones are configured per project in `quality-gate.json` → `evidence.milestones` (default `mvp`, `beta-0.5`, `release-1.0`; rename freely). Collect only after the milestone is approved and its checks have run:

1. The milestone's release is merged and CI has finished for that commit. Check out that commit's branch with a clean working tree (collect refuses uncommitted changes unless `--allow-dirty`, which is recorded as a limitation).
2. Make sure trustworthy test results exist for that commit: JUnit XML at `evidence.testResults` (Vitest `--reporter=junit`, Playwright `junit` reporter, Jest `jest-junit`, pytest `--junitxml`). Results older than the commit count as stale and make the functional figures unverified. Don't rerun suites if fresh results exist; if not, run only the test command (`--run-tests` uses `evidence.testCommand`).
3. Record the milestone approval: `event approval --milestone mvp --summary "MVP approved"`.
4. `collect --milestone <id>`. It reads stories, JUnit, coverage totals, the event log, GitHub Actions runs for the commit (`gh` or the public API) and the live URL, and writes a **draft** in `engineering-evidence/<id>/`. Offline or not pushed yet → delivery is UNVERIFIED, never assumed.
5. Dispatch the `metrics` agent (`task-start metrics-<id> --allow "engineering-evidence/<id>/summary.md"`) to spot-check and write the findings. `diff-guard` afterwards.
6. Show the product owner the summary. On their yes: `freeze --package <id>`, commit the package with `index.json` and the event log, and open a PR (the release skill).

The package names the measured commit (`source.commit`). The commit that adds the package comes after it; `validate` checks the measured commit is an ancestor.

## 3. What each figure means

Every measurement is `{ value, unit, basis, method, sources[], reason? }`:
- `measured`: computed by the script from an evidence file in the package (`sources` names it).
- `recorded`: counted from the event log: as complete as the log, and labelled so.
- `estimated`: from a supplied usage file whose entries say they are estimates.
- `unavailable` / `not_applicable`: `value: null` and a `reason`. Listed in `missing[]` and the summary.

Category status (`PASS`, `FAIL`, `UNVERIFIED`, `NOT_APPLICABLE`) is a verdict on the evidence, not a score:

| Category | PASS | FAIL | UNVERIFIED |
|----------|------|------|------------|
| Functional | every criterion has ≥1 executed passing test naming its ID and none failing | a criterion's test failed | no fresh JUnit results, or a criterion has no executed test |
| Intervention | the event log exists and is valid (no target) | — | no event log |
| QA | tests ran, none failed, no open P1/P2, no regressions | failing tests, open P1/P2, regression | no fresh JUnit results or no event log |
| Cost | tokens and API cost are known (no target) | — | no usage data (subscription use is never shown as 0) |
| Recovery | a controlled recovery test passed | a controlled recovery test failed | no recovery test (no observed failures is not proof) |
| Delivery | CI, deploy (if any) and live smoke check succeeded for the commit | any of them failed | not found, not finished, offline, or no CI workflow |

Overall = FAIL if any category fails, PASS only when functional, QA and delivery pass; otherwise UNVERIFIED. Limitations are always listed.

- **Completion %** = criteria passing / all criteria (deferred and unverified count as not complete). The denominator is `acceptance-criteria`, `stories` or `mixed`, and is stated.
- **Requirement coverage** (criteria with an executed test) is not **code coverage** (lines run). Neither proves the absence of defects.
- **Detection effectiveness** is `not_applicable` unless `evidence.seededDefects` points at seeded-defect results (`[{ "id": "...", "detected": true }]`).
- **Cost**: by default from the token-usage log (§1): tokens per model and agent are measured, and cost is estimated from `pricing`. To supply other figures, including infrastructure, pass `--usage usage.json` (`{ "billingModel": "api|subscription|mixed", "source": "…", "entries": [{ "category": "model|infrastructure", "name": "anthropic/claude-…", "phase": "dev", "inputTokens": 0, "outputTokens": 0, "costUsd": 0.0, "basis": "measured|estimated" }] }`), which replaces the log for that package. Without either, cost is unavailable with the reason.

## 4. Privacy

Packages are public. The collector strips logs, stack traces, host names and local paths from JUnit, keeps only coverage totals, removes credentials from the repository URL, and `validate` fails on secrets, email addresses and absolute paths in any package file. Anything private stays out of the repo.

## 5. Never

- Edit a frozen package or `index.json` (guard hook; `validate` compares every file's hash). Correct with `--revise`.
- Fill a missing value by hand or from an agent's report.
- Run `collect` after every commit. It is a milestone step; the event log is the everyday step.
