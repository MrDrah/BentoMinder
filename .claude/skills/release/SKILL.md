---
name: release
description: Ship a verified change — commit with a descriptive message, push to the main branch, confirm CI and the deploy succeeded, and confirm the live site actually serves the change. Use only after the product owner has asked to ship (or an approved plan's release step), and after the quality gate is green.
---

# Release

## Preconditions
- The product owner asked to ship, or the approved plan says so. Pushing to main deploys.
- `node .claude/skills/quality-gate/scripts/validate.mjs gate --stage release` is green locally.
- The repository settings in `.claude/SECURITY-MODEL.md` are in place (branch protection, protected deploy environment). If they aren't, say so to the product owner before the first release.
- `git status` shows only intended files. No `.env*`, no build output, no scratch files.

## 1. Commit
- Small, descriptive commits: a subject line in the imperative, then why and what changed (counts, decisions).
- End with the attribution trailer the session requires (for example `Co-Authored-By: …`).
- **No git identity on this machine?** Do not change global config. Reuse the identity the repo already uses for this commit only:
  ```bash
  git log -1 --format='%an <%ae>'
  git -c user.name="<name>" -c user.email="<email>" commit -F msg.txt
  ```
- Never `--no-verify`, never amend a pushed commit, never force-push.

## 2. Push
- **Protected main (recommended):** push a branch and open a PR (`gh pr create`, or give the product owner the compare URL). CI runs the release gate on the PR; the product owner merges. Deploy then runs only for a main commit whose CI succeeded, and waits for the environment approval if one is configured.
- **Unprotected main** (only if the product owner chose this, logged in `docs/PLAN.md` §7): `git push origin main`.
- If a push is rejected, fetch and rebase/merge; do not force.

## 3. Confirm CI and deploy
With `gh`: `gh run list --limit 4`. Without it, the public API works for public repos:
```bash
curl -s "https://api.github.com/repos/<owner>/<repo>/actions/runs?per_page=4"
```
Check one run per workflow for the pushed SHA: `status: completed`, `conclusion: success`. Check once; if it's still running, say so rather than polling in a loop.

## 4. Confirm the live site
Fetch the deployed page, find the current asset bundle, and grep it for a string that only exists in the new version. Report the URL and what you found.

## 5. Hand over
Update `CATCH-UP.md` (Done / In progress / Next) in the same release or immediately after, and tell the product owner: commit SHA, CI result, live check, anything not verified.
