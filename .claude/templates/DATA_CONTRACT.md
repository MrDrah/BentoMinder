# Data contract — {{PROJECT_NAME}}

Semantics: BA · Format and validator: Developer · {{DATE}}

## 1. Definition of valid
<!-- One testable sentence, e.g. "A record is valid when it appears in at least one cited reputable source and every reference resolves." -->

## 2. Entities

### <Entity> (`data/<file>.json`)
| Field | Type | Req. | Allowed values / rule | Example |
|-------|------|------|------------------------|---------|
| `id` | string | ✔ | kebab-case ASCII, unique across **all** source files, never reused | `daiquiri` |
| `name` | string | ✔ | Display name as the source gives it; never shortened | `Daiquiri` |
| `sources` | object[] | ✔ | ≥ 1, each `{ type, publisher, title, url, accessed }` | |
| | | | | |

### Cross-field rules
- Every reference (`…Id`) resolves.
- <length rules, date/era agreement, units…>

## 3. Validator
`scripts/validate-data.mjs` (no dependencies) enforces every rule above and runs in `quality-gate.json` → `commands`. Each rule in this file names the validator message that enforces it.

## 4. v1: ownership and persistence
| Entity | Owned by a user? | Moves to the database in v1? | Personal data? | Retention |
|--------|------------------|------------------------------|----------------|-----------|
| | | | | |
