# CATCH-UP — read this first

> **To an AI assistant opening this repo:** you are the Orchestrator. Read this file, then `CLAUDE.md` and `docs/PLAN.md`. Run `node .claude/skills/quality-gate/scripts/validate.mjs preflight`, confirm the state against the repo (`git log`, the gate), then tell the product owner in a short summary where things stand and what you propose next. Don't redo work marked done.
>
> **To the product owner:** on a new device, **clone** the repo (a downloaded zip has no history and can't push), open it in Claude Code and say: *"Read CATCH-UP.md and catch up."*

Last updated: 2026-10-31 (H4: trace closed, 60 s timeout fixed, 8 recipes verified; pushed) · Repo: origin = github.com/MrDrah/BentoMinder (public; PO authorized pushing 2026-10-31; first push done) · Live: none · Framework: app-boilerplate v0.5.0

---

## 1. What we're building
**BentoMinder — おべんとう、忘れない。** A Japanese-first family app: import the kindergarten's monthly lunch PDF (one AI extraction, then parent review), flag school lunches the child probably won't enjoy, plan homemade bento days with one of three suitable recipes, and get reminded the day before. Web-first (React/TS), Android later via Capacitor.
Source brief: `docs/ba/po-brief-2026-10-24.md` · Summary: `docs/PROJECT_BRIEF.md` · Rules and decisions: `docs/PLAN.md` §3 and §7.

## 2. How the work is organised
Roles and briefs: `CLAUDE.md` §1 and `.claude/agents/`. Rules and decisions: `docs/PLAN.md`. Framework weaknesses found along the way: `docs/framework-lessons.md` (kept separate from app issues).

## 3. Status

### Done ✅
| Area | What exists | Key files |
|------|-------------|-----------|
| Scaffold | Project created with `new-project.mjs --content-app`, local git, first commit | `.claude/`, `quality-gate.json` |
| Brief | PO brief saved verbatim; structured brief with proposed defaults | `docs/ba/po-brief-2026-10-24.md`, `docs/PROJECT_BRIEF.md` |
| Kick-off | Approved by the PO: architecture, BR-01…27, design direction, OQ-01…15 | `docs/PLAN.md` |
| M0 | App skeleton: Vite/React/TS, i18n + toggle, JST module, contract v1 schemas, storage, proxy health, data scripts; dev gate green | `src/`, `server/`, `scripts/`, `tests/` |
| H2 | Final tokens, 64 component specs, flows, a11y spec, ja/en copy (561 rows), preview v1.0 | `design/` |
| H1 | 73 stories / 287 ACs, data contract v1, dictionary, ADR 001–005, QA strategy + 4 oracles; ~30 rulings in PLAN §7 | `docs/ba/`, `docs/dev/`, `tests/plan/`, `tests/oracle/` |

### In progress 🔄 — PAUSED 2026-10-25 by the PO (resume next weekend)
Two tasks were stopped at a safe point; each wrote pause notes:
- **M2 build**: DONE and merged to main (5ded922); dev gate green (644 unit, 50 e2e). ADR 007 written. Still open by design: holidays, amb-soba flag, recommendations (M3), popover picker, Today/reminders (M4). Open questions for PO/BA: AC13 empty list after refresh, "next 7 days" = today..+6, lower-cased English food labels, `{wdLongEn}`→`{wdLong}`. **M2 QA done (0 oracle diffs; defects M2-D01 P3 focus after day-sheet action, M2-D02 P4 flaky shell test). D01+D02 fixed (bf17074). Label round slice 1 done (ketchup/curry-powder, verifier fixes 2a-2e, ham+sausage labels; overlap 20 PASS; nipponham.co.jp approved). Label slice 2 done (tuna, salmon flakes, miso, processed cheese labelled; dictionary notes; contract §3.7/§6.1/§3.10; brief §5). Still unknown (no fetchable label): tarako, sakura-denbu, bread crumbs, rolls/bread, tortilla, stick+cheddar cheese. Lesson: a leftover dev server on :8787 makes e2e reuse it and fail (stop it before the gate). M3 DONE (engine 6d79900, UI 0113df0, QA GO; defects M3-D01 P3 content reword of 8 en notes, M3-D03 P4 empty allergen box; D02 ruled in PLAN §7). M4: A reminder engine (8e5b9f9), B in-app reminders/Today/settings/theme + M3-D03 fix (54e5eff, ADR-011); M3-D01 fixed. One unit test failed once in 1 of 7 gate-style runs (not identified; QA to catch it by capturing output). M4-C share + debug panel done (c7b0421, ADR-012). M4-D QA GO (oracle 0 diffs, full journey green; flaky shell title test fixed with waitFor, contract line 319 aligned). H4 status: release gate green locally; D-H4-01 fixed (1245f2b); US-E6-07/AC4 partial (8 of 20 verifier-reviewed, 12 left ba-research). Next: confirm GitHub CI green, PO review of M4, then M5 (real Gemini; key already added by the PO); verifier over the remaining 12 recipes before any live release; also fix M3-D03 and designer to confirm qty.* copy.1/§3.10; brief §3) per pause-notes.md.**
- **Recipe label round** (BA, Sonnet from now on): **not started on any record** (batches untouched). Order to resume: 2b ketchup/curry-powder → `varies-by-product` (8 rows, 7 recipes, no fetching), then 2a curry-chahan, 2c quesadilla, 2d storage note, 2e pistachio, then maker labels (ham + sausage first: 7 recipes), dictionary sources + matsutake, contract §3.7/§6.1/§3.10 + brief §3. Notes: `docs/ba/_scratch/research-labels/pause-notes.md`.

**Main is committed** (bea84df, dev gate green): recipe research, dictionary ids, schema change, copy fix, docs. Only the M2 worktree branch is unmerged.

### How to resume (new session in this folder; everything on Sonnet, Opus only with PO approval, per CLAUDE.md §6 "Lean orchestration")
0. **Lean orchestration (merged to main, 7a70e23)** holds the orchestration changes (CLAUDE.md §6, six agent files `model: sonnet`, `.claude/settings.json`, PLAN §7 row, `docs/dev/lean-orchestration-baseline.md`). Rollback point: tag `checkpoint/pre-lean-orchestration-2026-10-25` (main 456f7df)..
1. Read this file, PLAN §7 (latest rows), and both pause notes. Run preflight; log `evidence.mjs event resume`. Consider logging it as `recovery-test` (a fresh session restoring from CATCH-UP alone is the evidence package's recovery check).
2. **Label round:** re-dispatch a `ba` agent with "continue the label round from pause-notes.md" (baseline `research-labels`). Then: add the new maker hosts to `APPROVED_HOSTS` in `scripts/validate-data.mjs`, `npm run merge:research`, `validate.mjs overlap --fetch` (must be 0 FAIL, 0 UNVERIFIED), quick verifier re-check of the 2 failed records.
3. **M2:** re-dispatch the `developer` (Sonnet) in the same worktree with "continue M2 from m2-pause-notes.md". Then merge locally, `diff-guard --task m2-build`, **gate + QA suite on main before any commit** (FL-15).
4. M2 QA (Sonnet): oracles as executable tests (0 diffs); clean up `tests/e2e/qa/**` lint and restore the two rules.
5. Then M3 (recipe suggestions), M4 (reminders, today, share, debug, full e2e), M5 (real Gemini: PO creates the key and writes `.env` + the env example file), M6 (Android report, can wait), H4, MVP evidence package.

### Next 📋
See "How to resume".

## 4. Key decisions (summary; the full log is in docs/PLAN.md §7)
- Local git only; no push, deploy or paid services without PO approval.
- Architecture approved: React/TS web app, all family data on the device, rules engine without AI, local proxy holds the Gemini key; Android later via Capacitor adapters.
- AI: Gemini free tier, `gemini-3.8-flash` + `gemini-3.5-flash-lite` fallback; import used from Japan only; only the public PDF is sent.
- Design: white page background (`surface-1` #FFFFFF), navy type, soft-red accents, Monday week start, no tab bar.
- All 15 open-question defaults accepted.
- **Lean orchestration (PO, 2026-10-25; replaces the 2026-10-24 model rule):** Sonnet for the Orchestrator and all agents, Opus only with explicit PO approval; BA only for initial requirements, unresolved decisions, research and milestone acceptance; developer gets bounded tasks with a stopping point; Developer/QA fix loops stop after two cycles; QA stays independent. Baseline and measurements: `docs/dev/lean-orchestration-baseline.md`.

## 5. How to work in this repo
```bash
npm ci
npm run dev            # proxy (127.0.0.1:8787) + Vite
node .claude/skills/quality-gate/scripts/validate.mjs gate --stage dev
npm run test:e2e
```
- Generated files (see `quality-gate.json` → `generated`) are never hand-edited.
- Commits: small and descriptive. No remote yet.

## 6. Lessons learned
- Open Claude Code **in this folder** for BentoMinder work (the kick-off started from another project's session; see `docs/framework-lessons.md` FL-01).
