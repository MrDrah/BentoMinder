# API integration — <Service name>

v1 module · Owner: Developer · {{DATE}} · Adapter: `src/services/<service>/`

## 1. Purpose
Which stories it serves and what the app does without it (fallback).

## 2. Contract
| Item | Value |
|------|-------|
| Base URL per environment | local / preview / staging / production |
| Auth | public key · server-side secret · OAuth on behalf of the user |
| Rate limits | |
| Timeout | default 8 s |
| Retries | exponential backoff, max 3, **idempotent calls only** |
| Caching | what, for how long, allowed by the terms? |
| Terms / attribution | what must be shown, what may not be stored |
| Cost | free tier, price per 1k calls, monthly cap |

### Endpoints used
| Call | Request | Response (typed in `types.ts`) | Errors we handle |
|------|---------|--------------------------------|------------------|
| | | | |

## 3. Failure behaviour (Designer + Developer)
What the user sees on: timeout, 4xx, 5xx, rate-limited, malformed response, offline.

## 4. Implementation rules
- The rest of the app imports the adapter's interface, never the vendor SDK.
- Secrets never reach the browser unless the vendor designs the key to be public; otherwise call through a server function.
- Validate responses at the boundary (schema check) before they reach the domain.

## 5. Tests
- Contract tests against recorded fixtures / a mock server, network disabled (`test:contract`).
- One optional smoke test against the vendor sandbox, not part of the gate.
