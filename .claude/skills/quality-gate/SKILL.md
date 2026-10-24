---
name: quality-gate
description: Run and extend the project's executable quality controls — environment preflight, the configured test/build commands, story-to-test traceability, docs freshness, bundle budgets, secret scan, the source/copied-wording audit, and task baselines with diff-guard for checking a sub-agent touched only allowed files. Use before integrating any agent's work, at each handoff gate, and before anything reaches main.
---

# Quality gate

Everything here is enforced by `scripts/validate.mjs` (Node ≥ 20, no dependencies) and configured by `quality-gate.json` at the project root. Prompts describe intent; this script decides. A check that has no evidence to look at **fails**; it never passes by default.

```bash
node .claude/skills/quality-gate/scripts/validate.mjs <command> [options]
```

| Command | What it checks | Fails when |
|---------|----------------|------------|
| `preflight` | git repo, `origin` remote, git identity, `gh`, Node version, Playwright browsers | not a git clone, no remote (if required), Node too old |
| `docs` | required docs exist; `CATCH-UP.md` "Last updated" is recent; decision log has dated rows | a file is missing, CATCH-UP is stale or undated, no log rows |
| `trace` | every `US-…` ID in the stories file is in the **title of an active test** (`it`/`test`/`describe`, not `.skip`/`.todo`/`xit`, not comments) in a **test file** (`*.test.*`, `*.spec.*`) | a story has no active test; the stories file has no IDs; no test files match |
| `commands` | runs every command in `quality-gate.json` → `commands`, in order | any command exits non-zero; **no commands configured** |
| `budget` | gzip size of files matching each budget glob | over budget; **no files match** (missing build output), unless the budget says `"optional": true` |
| `secrets` | regex scan of tracked + untracked files; `.env` files present in git | a likely secret or a non-example `.env` file |
| `overlap` | each record vs the cached text of its cited sources: **PASS / FAIL / UNVERIFIED** | a copied run ≥ `failAt` words without a documented exception (FAIL); a record with no source URL or no cached source text (UNVERIFIED); an exception without reason/reviewer |
| `overlap --accept …` | records **one** reviewed exception | the run isn't currently flagged; reason or reviewer missing |
| `task-start <task> --allow <glob>…` | records the baseline commit and allowed files before an agent starts; logs a `task-start` event if the project keeps an event log | — |
| `diff-guard --task <task>` | every file changed since the baseline (committed **or** uncommitted, plus untracked) matches the allow-list; logs a `task-end` event | a file outside the allow-list changed; no baseline given |
| `evidence` | every package in `engineering-evidence/` (`milestone-evidence` skill): schema, arithmetic, references, privacy, frozen hashes | a package is invalid, or a frozen package changed |
| `gate --stage dev` | preflight + secrets + commands + budget | any of them fails |
| `gate --stage release` (default) | dev + docs + trace + overlap (if configured) + evidence (whenever `engineering-evidence/` exists, even if `stages` doesn't list it) | any of them fails |

Exit code 0 = pass, 1 = fail or unverified, 2 = misconfiguration. CI runs `gate --stage release`.

## Stages
- **dev** is the Dev → QA handoff (H3). It doesn't include `trace`, because QA writes some of the story tests after H3.
- **release** is H4 sign-off and everything that reaches main. Nothing is skipped.
- Stages are configurable in `quality-gate.json` → `stages`, but removing a check from `release` needs an ADR and a decision-log row.

## Copied-wording exceptions
Credit lines and titles can legitimately share long runs with a source ("created in 2005 by Michael McIlroy at Milk & Honey"). Each one is reviewed and recorded individually:
```bash
node .claude/skills/quality-gate/scripts/validate.mjs overlap --report overlap.json
node .claude/skills/quality-gate/scripts/validate.mjs overlap --accept --id fitzgerald --field history \
  --run "created in the early 1990s by dale degroff at the rainbow room in manhattan new york city" \
  --reason "creator, venue and city credit; no descriptive wording" --reviewer qa
```
There is no bulk accept. Exceptions that no longer match flagged text are reported as stale.

## When integrating a sub-agent's work
```bash
node .claude/skills/quality-gate/scripts/validate.mjs task-start research-c --allow "data/_research/batch-c.json"   # before dispatch
# … agent runs (and may commit) …
node .claude/skills/quality-gate/scripts/validate.mjs diff-guard --task research-c
node .claude/skills/quality-gate/scripts/validate.mjs overlap          # if it wrote content
node .claude/skills/quality-gate/scripts/validate.mjs gate --stage dev   # or release
```
Then spot-check ~10% yourself or with the `verifier` agent. Code-writing agents get their own worktree, so their changes can't mix with anyone else's.

## QA process this gate supports
1. **Strategy** (`templates/TEST_STRATEGY.md`): state the one thing the product must never do. Severity P1–P4.
2. **Oracle**: a naive reference implementation of the core rule in `tests/oracle/`, sharing no code with `src/`. Compare on fixed + 1,000 seeded random inputs. Any difference is P1.
3. **Traceability**: test titles start with story IDs; `trace` enforces it. `trace` proves a test exists; `commands` proves it passed. Both are in the release stage.
4. **Content verification**: stratified 10% sample, checks agreed with the BA, matrix written by a test (`WRITE_MATRIX=1`), never by hand. A `verifier` agent does the source comparison.
5. **E2E**: boundaries, hostile input, empty/fallback, URL state, keyboard-only, axe 0 serious/critical in both themes and two viewports.
6. **Report** (`templates/TEST_REPORT.md`): counts, matrix, oracle diff, defects, go/no-go.

## Extending
Add a project check as a command in `quality-gate.json` (`{ "name": "...", "run": "npm run ..." }`) rather than editing this script. Change the script only for checks every project needs, and bump the framework version.
