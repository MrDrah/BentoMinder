# Threat model — {{PROJECT_NAME}}

v1 module · Owner: Developer, reviewed by QA · {{DATE}} · Revisit at every new data type, integration or role.

## 1. Assets
What would hurt if leaked, changed or lost (user data, credentials, API keys, content, availability).

## 2. Actors and trust boundaries
Visitor · signed-in user · admin · external API · CI · the AI agents working on the repo.

## 3. Threats (STRIDE)
| # | Threat | Where | Mitigation | Test |
|---|--------|-------|------------|------|
| T1 | User reads another user's data (Information disclosure) | API, DB | RLS + server checks | isolation tests |
| T2 | Stolen session (Spoofing) | browser | http-only cookies, short expiry | session tests |
| T3 | Secret committed to git | repo | `.gitignore`, `validate.mjs secrets`, deny rules | gate |
| T4 | XSS via user or API content (Tampering) | UI | render as text, CSP, no `dangerouslySetInnerHTML` | e2e `<script>` input |
| T5 | API key abuse / cost blow-up (DoS) | integrations | server-side keys, rate limits, spend caps | config review |
| T6 | Agent runs a destructive command | dev workflow | hooks + `permissions.deny` | hook tests |
| | | | | |

## 4. Residual risks accepted
| Risk | Why accepted | Owner | Review date |
|------|--------------|-------|-------------|
