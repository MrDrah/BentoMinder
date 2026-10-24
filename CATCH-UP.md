# CATCH-UP — read this first

> **To an AI assistant opening this repo:** you are the Orchestrator. Read this file, then `CLAUDE.md` and `docs/PLAN.md`. Run `node .claude/skills/quality-gate/scripts/validate.mjs preflight`, confirm the state against the repo (`git log`, the gate), then tell the product owner in a short summary where things stand and what you propose next. Don't redo work marked done.
>
> **To the product owner:** on a new device, **clone** the repo (a downloaded zip has no history and can't push), open it in Claude Code and say: *"Read CATCH-UP.md and catch up."*

Last updated: 2026-10-24 · Repo: local only (no remote yet, by PO instruction) · Live: none · Framework: app-boilerplate v0.5.0

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

### In progress 🔄
Nothing running. **M1 merged locally (25eb8bc), dev gate green on main, independent QA: GO with conditions** (`tests/reports/m1-qa-report.md`). Not yet committed on main: QA suite + report, Orchestrator edits (agent models, gate command, Playwright testIgnore, docs). Ask the PO before committing.

### Next 📋
1. **M1 fix round** (developer, Sonnet, worktree): D-M1-06 (cross-tab store safety, before any M2 decision write), D-M1-08, D-M1-02, D-M1-09, D-M1-05; mock-scenario header off by default outside tests. Remove the matching `test.fixme` and re-run the QA suite (`npx playwright test -c tests/e2e/qa/playwright.qa.config.ts`).
2. **M2 prep** (BA + designer, Opus): `weekday-mismatch` into contract §6.1; date correction in review (US-E2-05/AC5) design + copy; food-picker kind labels; rule on D-M1-03 and D-M1-04.
3. **M2** (developer, Sonnet): assessment + overrides, calendar grid, decision state machine, menu refresh (E3-05/06); QA oracles become executable tests.
4. Recipe research (BA) alongside M2.

## 4. Key decisions (summary; the full log is in docs/PLAN.md §7)
- Local git only; no push, deploy or paid services without PO approval.
- Architecture approved: React/TS web app, all family data on the device, rules engine without AI, local proxy holds the Gemini key; Android later via Capacitor adapters.
- AI: Gemini free tier, `gemini-3.8-flash` + `gemini-3.5-flash-lite` fallback; import used from Japan only; only the public PDF is sent.
- Design: white page background (`surface-1` #FFFFFF), navy type, soft-red accents, Monday week start, no tab bar.
- All 15 open-question defaults accepted.
- **Agent models (PO, 2026-10-24):** dispatch `developer` and `qa` agents with `model: "sonnet"`; Orchestrator, `ba` and `verifier` stay on Opus.

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
