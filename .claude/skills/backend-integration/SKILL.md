---
name: backend-integration
description: v1 module for adding user accounts, a database and third-party API integrations to an app that started as a static MVP — auth provider choice, sessions, data ownership and isolation, migrations, API contracts, secrets and environments, privacy, and the tests and gates that go with them. Use when the plan moves past a static MVP.
---

# Backend integration (v1 module)

Status: **framework v0.1 — guidance + templates + gate checks.** Code scaffolds are on the roadmap (`docs/ROADMAP.md`).

Start every v1 feature by filling the matching template and getting an ADR approved:

| Feature | Template | ADR must decide |
|---------|----------|-----------------|
| Accounts | `templates/v1/AUTH_AND_ACCOUNTS.md` | Provider, sign-in methods, session model, roles |
| Database | `templates/v1/DATA_MODEL.md` | Engine/host, ownership model, migrations tool, backups |
| External APIs | `templates/v1/API_CONTRACT.md` | Contract, auth, rate limits, failure behaviour, caching |
| All of them | `templates/v1/THREAT_MODEL.md`, `templates/v1/ENVIRONMENTS.md`, `templates/v1/PRIVACY.md` | Who can do what, where secrets live, what personal data is kept and for how long |

## 1. Accounts
- **Use a managed provider** (e.g. Supabase Auth, Auth0, Clerk, Firebase Auth, Cognito). Do not hand-roll password storage. The ADR names the provider and the exit plan.
- Sign-in methods in order of preference: passkeys / magic link / OAuth (Google, Apple, GitHub); email+password only if required.
- Sessions: http-only, secure, same-site cookies, or the provider's SDK. Never put tokens in `localStorage` if the provider offers cookies.
- Roles: start with `user` and `admin`. Authorisation is checked **on the server or in the database (row-level security)**, never only in the UI.
- Required flows (stories `US-E7-*`): sign up, verify email, sign in, sign out, reset password, change email, delete account (removes personal data), session expired.
- Migrating MVP users: anything kept in the URL or `localStorage` is offered for import on first sign-in.

## 2. Database
- Default: managed Postgres (Supabase, Neon, RDS). Every user-owned table has `owner_id` and row-level security policies `owner_id = auth.uid()`.
- Migrations in `db/migrations/NNN_name.sql`, forward-only, applied by CI to staging before production. Never edit an applied migration.
- Seed data in `db/seed/` is generated from the same validated sources as the static MVP data, so content rules (sources, overlap) still apply.
- Backups and point-in-time recovery are enabled before real users arrive; restore is tested once.

## 3. External APIs
- One adapter per API in `src/services/<api>/`. The rest of the app depends on a typed interface, not the vendor SDK.
- Each adapter documents: base URL per environment, auth method, rate limits, timeouts, retry policy (exponential backoff, idempotent calls only), and what the UI shows when it fails.
- Keys never reach the browser unless the vendor designs them to be public. Otherwise call through a server function.
- Contract tests run against a recorded fixture/mocked server in CI; one optional smoke test hits the real sandbox.
- Cache responses where the vendor allows it; respect their terms and attribution rules.

## 4. Environments and secrets
- `local`, `preview` (per PR), `staging`, `production`. Each has its own database and keys.
- `.env` is git-ignored; `.env.example` lists every variable with a comment and no value. CI secrets live in the CI provider's secret store.
- `validate.mjs secrets` runs in the gate; `permissions.deny` stops agents reading `.env*`.

## 5. Tests and gates added in v1
- **Isolation:** user A can never read, list, change or delete user B's data (API and database level).
- **Auth:** every protected route refuses signed-out and expired sessions.
- **Deletion:** deleting an account removes or anonymises personal data, per `PRIVACY.md`.
- **Migrations:** apply cleanly on an empty database and on a copy of the previous schema.
- **Contracts:** adapters pass their contract tests with the network disabled.
- Add these commands to `quality-gate.json` (`db:migrate:check`, `test:contract`, `test:auth`).

## 6. Handoff additions
- H1: account and data-ownership stories, privacy decisions logged.
- H2: all auth screens and states designed.
- H3: threat model reviewed; isolation tests green; secrets scan clean.
- H5: production keys set by the product owner (never by an agent); backups verified.
