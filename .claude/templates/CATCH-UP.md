# CATCH-UP — read this first

> **To an AI assistant opening this repo:** you are the Orchestrator. Read this file, then `CLAUDE.md` and `docs/PLAN.md`. Run `node .claude/skills/quality-gate/scripts/validate.mjs preflight`, confirm the state against the repo (`git log`, the gate), then tell the product owner in a short summary where things stand and what you propose next. Don't redo work marked done.
>
> **To the product owner:** on a new device, **clone** the repo (a downloaded zip has no history and can't push), open it in Claude Code and say: *"Read CATCH-UP.md and catch up."*

Last updated: {{DATE}} · Repo: <url> · Live: <url> · Framework: app-boilerplate v{{FRAMEWORK_VERSION}}

---

## 1. What we're building
<!-- Three lines from docs/PLAN.md §1. Link the BR table and the decision log. -->

## 2. How the work is organised
Roles and briefs: `CLAUDE.md` §1 and `.claude/agents/`. Rules and decisions: `docs/PLAN.md`.

## 3. Status

### Done ✅
| Area | What exists | Key files |
|------|-------------|-----------|
| | | |

### In progress 🔄
<!-- What is running, who/what is doing it, and what to do if it didn't finish (how to re-dispatch). -->

### Next 📋
1.

## 4. Key decisions (summary; the full log is in docs/PLAN.md §7)
-

## 5. How to work in this repo
```bash
npm install
npm run dev
node .claude/skills/quality-gate/scripts/validate.mjs gate
npm run e2e
```
- Generated files (see `quality-gate.json` → `generated`) are never hand-edited.
- Commits: small and descriptive. Pushing to main runs CI; green CI deploys.

## 6. Lessons learned
<!-- Anything that went wrong and how to avoid it next time. Promote general lessons to the framework. -->
