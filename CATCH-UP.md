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
Nothing running. **M0 done** and merged locally (merge commit e1ad2fc); `gate --stage dev` green on main. Uncommitted: `.gitattributes`, plan/catch-up/lessons/event-log updates (ask the PO).
**Open for the PO:** the env example file (variables listed in `docs/dev/architecture.md` §11.3) is blocked for agents by the secrets deny rule (FL-12).

### Next 📋
1. Commit the M0 integration fixes (PO).
2. **M1 prep (BA + QA, docs/data):** amend US-E1-01/AC5, US-E3-02/AC3, US-E9-01/AC3 and US-E10-03/AC1 (exportedAt); define the ~60 strings listed at the end of `design/copy.md`; dictionary category forms; review `RULES_NOT_IN_CONTRACT` and `APPROVED_HOSTS`. QA builds the synthetic menu fixtures (`tests/plan/fixtures-plan.md`).
3. **M1 (developer, worktree):** onboarding, import with mocked AI, review/confirm, export/delete, recovery-screen actions.
4. Recipe research (BA) alongside M2/M3.

## 4. Key decisions (summary; the full log is in docs/PLAN.md §7)
- Local git only; no push, deploy or paid services without PO approval.
- Architecture approved: React/TS web app, all family data on the device, rules engine without AI, local proxy holds the Gemini key; Android later via Capacitor adapters.
- AI: Gemini free tier, `gemini-3.8-flash` + `gemini-3.5-flash-lite` fallback; import used from Japan only; only the public PDF is sent.
- Design: white page background (`surface-1` #FFFFFF), navy type, soft-red accents, Monday week start, no tab bar.
- All 15 open-question defaults accepted.

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
