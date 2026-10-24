# Data model and database — {{PROJECT_NAME}}

v1 module · Owner: Developer (ADR) + BA (semantics) · {{DATE}}

## 1. Decisions
| Decision | Options | Recommendation | Chosen |
|----------|---------|----------------|--------|
| Engine / host | Managed Postgres (Supabase, Neon, RDS) · SQLite/Turso · Firestore | Managed Postgres | |
| Access path | DB from browser with RLS · server API only | Server API for writes; RLS everywhere as the second wall | |
| Migrations | SQL files + tool (Supabase CLI, dbmate, Prisma, Drizzle) | Plain SQL files, forward-only | |
| Backups | provider PITR · nightly dump | PITR on, restore tested once before launch | |

## 2. Tables
| Table | Purpose | Owner column | RLS policy | Personal data | Retention |
|-------|---------|--------------|------------|---------------|-----------|
| `profiles` | per-user settings | `id = auth.uid()` | owner only | email, name | until account deletion |
| | | | | | |

Static MVP content (e.g. a researched library) can stay a validated JSON file, or be seeded into a read-only table from the same validated source. It never gets hand-edited in the database.

## 3. Migrations
- `db/migrations/NNN_description.sql`, forward-only. Never edit one that has been applied anywhere.
- CI applies all migrations to an empty database and runs the isolation tests (`db:migrate:check`).
- Staging gets migrations before production; production migration is a release step approved by the product owner.

## 4. Seeds and fixtures
- `db/seed/` for local and preview environments, generated from validated sources.
- Test fixtures create their own users; never depend on seeded user ids.
