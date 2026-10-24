# Environments and secrets — {{PROJECT_NAME}}

v1 module · Owner: Developer · {{DATE}}

| Environment | URL | Deploys from | Database | Keys | Who can change |
|-------------|-----|--------------|----------|------|----------------|
| local | localhost | working tree | local / branch DB | `.env` (git-ignored) | developer |
| preview | per PR | PR branch | preview DB, seeded | CI secrets (preview) | CI |
| staging | | `main` after CI | staging DB | CI environment `staging` | CI |
| production | | release approval | production DB | CI environment `production` | **product owner only** |

## Rules
- Every variable is listed in `.env.example` with a comment and no value.
- Server-only variables never get a `VITE_`/`NEXT_PUBLIC_` prefix.
- Agents never read `.env*` (denied in `.claude/settings.json`) and never set production secrets.
- Rotating a key: list here who rotates it, where, and which services restart.

| Variable | Used by | Public? | Rotation |
|----------|---------|---------|----------|
| | | | |
