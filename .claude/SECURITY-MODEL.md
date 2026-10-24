# Security model

The framework's hooks and deny-rules stop **mistakes**. They are not a sandbox. An agent with shell access can always find a route the patterns don't recognise (a script file, an alias, another language, a compiled binary). So every rule that matters is backed by a control the agent cannot bypass from its own machine.

## Layers

| Layer | What it gives | Can the agent bypass it? | Where |
|-------|---------------|--------------------------|-------|
| 1. Guard hook + `permissions.deny` | Blocks the obvious wrong move: editing a generated file, writing or reading `.env`, force-push, `--no-verify`, global git config | **Yes**, with effort. It's a guardrail. | `.claude/hooks/guard.mjs`, `.claude/settings.json` |
| 2. Quality gate in CI | Data, types, tests, coverage, traceability, budgets, secrets scan, copied-text scan, all re-run on GitHub | No: it runs on GitHub, not on the agent's machine | `.github/workflows/ci.yml` |
| 3. Branch protection on `main` | Only reviewed PRs with a green CI check reach main; no force-push or deletion | No (unless the token has admin rights, which it shouldn't) | GitHub repo settings |
| 4. Protected deploy environment | Deploys only a main commit with green CI; production needs the product owner's approval | No | `deploy.yml` + environment settings |
| 5. Secrets outside the workspace | Production keys exist only in the CI/hosting secret store; the agent's machine has none, or test-mode keys only | No: there's nothing to steal | CI/host settings, `templates/v1/ENVIRONMENTS.md` |
| 6. Restricted execution | Run agents in Claude Code's sandbox, a devcontainer, or a cloud session with a scoped token | No | Claude Code settings / devcontainer |
| 7. Isolation per task | Code-writing agents work in their own git worktree; `task-start` + `diff-guard --task` check what changed since the recorded baseline | Mostly no: the baseline is recorded before the agent starts | `validate.mjs`, Agent `isolation: "worktree"` |

## Repository settings to apply (once per project, by the product owner)

1. **Branch protection / ruleset for `main`:**
   - Require a pull request before merging, with at least 1 approval (the product owner).
   - Require status checks: `Release gate …` and `Playwright e2e …` from `ci.yml`, up to date with main.
   - Block force pushes and deletions. Include administrators.
2. **Environments:** `github-pages` (or `production`) with:
   - Required reviewer: the product owner.
   - Deployment branches: `main` only.
   - Secrets for production stored here, not in repository secrets.
3. **Actions permissions:** default `GITHUB_TOKEN` permission is read-only; workflows request what they need.
4. **Agent token:** if an agent pushes, give it a fine-grained token limited to this repository with `contents: write` and `pull-requests: write`, and no admin or secrets scope. It can open PRs; it can't bypass protection.

## Working agreements that follow from this

- Agents push to branches and open PRs. Merging to main is the product owner's step (or an explicitly approved release step).
- A PR from an agent is reviewed like any contributor's: the gate proves the evidence, the reviewer checks intent.
- "The hook allowed it" is never a reason. If a rule matters and the hook can't express it, add it to CI.

## What this does not cover

- A malicious dependency (use `npm ci` with a lockfile, review new dependencies, enable Dependabot alerts).
- Compromise of the product owner's own GitHub account (use 2FA and passkeys).
- Data handled in v1 by third parties: see `templates/v1/THREAT_MODEL.md` and `PRIVACY.md`.
