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
| H2 | Final tokens, 64 component specs, flows, a11y spec, ja/en copy (561 rows), preview v1.0 | `design/` |
| H1 | 73 stories / 287 ACs, data contract v1, dictionary, ADR 001–005, QA strategy + 4 oracles; ~30 rulings in PLAN §7 | `docs/ba/`, `docs/dev/`, `tests/plan/`, `tests/oracle/` |

### In progress 🔄
Nothing running. H1 and H2 are closed (2026-10-24) but **not committed**: ask the PO.

### Next 📋
1. Commit H1 + H2 locally (PO approval).
2. **M0** skeleton (developer, own worktree) from `docs/dev/architecture.md` §11; apply the agreed `quality-gate.json` changes.
3. M1 (BA side): amend US-E1-01/AC5, US-E3-02/AC3, US-E9-01/AC3 to the designer's accepted readings; curate recipe short names; define the ~60 strings listed at the end of `design/copy.md`.
4. Recipe research (BA) alongside M2/M3; verify the 農林水産省 sentences in US-E6-04/AC2.

## 4. Key decisions (summary; the full log is in docs/PLAN.md §7)
- Local git only; no push, deploy or paid services without PO approval.
- Architecture approved: React/TS web app, all family data on the device, rules engine without AI, local proxy holds the Gemini key; Android later via Capacitor adapters.
- AI: Gemini free tier, `gemini-3.8-flash` + `gemini-3.5-flash-lite` fallback; import used from Japan only; only the public PDF is sent.
- Design: white page background (`surface-1` #FFFFFF), navy type, soft-red accents, Monday week start, no tab bar.
- All 15 open-question defaults accepted.

## 5. How to work in this repo
```bash
npm install            # (after M0)
npm run dev
node .claude/skills/quality-gate/scripts/validate.mjs gate --stage dev
npm run e2e
```
- Generated files (see `quality-gate.json` → `generated`) are never hand-edited.
- Commits: small and descriptive. No remote yet.

## 6. Lessons learned
- Open Claude Code **in this folder** for BentoMinder work (the kick-off started from another project's session; see `docs/framework-lessons.md` FL-01).
