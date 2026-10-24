---
name: implementation
description: Build the product from the requirements and design specs — architecture decisions as ADRs, a pure domain layer with injected data, a data validator, UI built to the design tokens and copy, tests traced to story IDs, and CI/CD with a quality gate. Use for any code change.
---

# Implementation

## 1. Decide, then write it down
One ADR per significant decision in `docs/dev/adr/NNN-title.md` (`templates/ADR.md`): context, decision, why, alternatives, what would make us revisit. Default stack for a static web app (deviate with an ADR):

| Concern | Default (MVP, static) | v1 option (needs an ADR) |
|---------|------------------------|---------------------------|
| Build | Vite + TypeScript (strict) | same |
| UI | React | same |
| Tests | Vitest + Testing Library; Playwright + axe | + API contract tests |
| Data | Static JSON in `data/`, validated by a script | Postgres via a managed service; migrations in `db/migrations/` |
| Hosting | GitHub Pages / Netlify / Vercel static | Same host + serverless functions, or a small API service |
| Auth | none | Managed auth provider (see `backend-integration`) |

## 2. Layout
```
src/domain/     pure logic: no DOM, no fetch, no Date.now(); data passed into factories
src/ui/         components; strings only from src/ui/copy.ts; styles only from token CSS variables
src/services/   (v1) adapters for API, auth, storage — the only place that talks to the network
data/           static data + schema docs
scripts/        validators and generators (list outputs under "generated" in quality-gate.json)
tests/unit/     fixtures-based tests, named after story IDs
tests/e2e/      Playwright against the production build
```

## 3. Domain rules
- Factories take their data: `createMatcher(library, dict)`. `src/domain/index.ts` binds the shipped data. Tests pass fixtures.
- Every function that encodes a business rule has a test whose name starts with the story ID (`US-E3-02 …`).
- Coverage threshold ≥ 90% on `src/domain` enforced in the test config, not in a prompt.
- Performance budgets get a micro-benchmark test with a fixed-size input built from fixtures (never "the whole library", which grows).

## 4. Tests that survive data growth
- Unit tests: fixtures only.
- Tests on live data: assert **properties** (every result is makeable; no duplicate ids; every reference resolves), not "the third result is X".
- If an e2e test must use live data, pick inputs whose expected result is structural (a known classic that will always exist) and keep them in one helper file so a data change is a one-line fix.

## 5. UI rules
- Build exactly to `design/components.md`; use `design/copy.md` strings verbatim via `copy.ts`.
- State that should survive reload/share lives in the URL.
- Every interactive element has an accessible name and a `data-testid`.

## 6. Data pipeline
- A validator script with no dependencies runs in CI and fails on: schema violations, unresolved references, duplicate ids **across all source files**, missing sources, length rules.
- If content is produced in batches, a merge script builds the shipped file. The merged file is `generated`: the hook refuses hand edits.

## 7. CI/CD
Copy `templates/project/.github/workflows/` and fill `quality-gate.json`. CI runs on every push/PR: validate data → typecheck → unit + coverage → build → budgets → e2e + axe. Deploy runs only after CI passes on main.

## 8. Definition of done for a change
`validate.mjs gate` green locally · new/changed ACs have tests · ADR for any new decision · `CATCH-UP.md` updated if the state changed.
