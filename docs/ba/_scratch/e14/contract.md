
---

## 13. Hosted AI proxy contract (v1, 2026-11-09; stories E14)
PO decision in `docs/PLAN.md` §7 (2026-11-09). The hosted service exposes the same two endpoints as the local proxy; this section lists only what is new or different. Request and response bodies of a successful call are unchanged (§3.3 `ExtractedMenu`, ADR 002). Items marked DEFAULT are BA proposals.

**13.1 Endpoints.** `POST /api/menu/extract?targetMonth&promptVersion&schemaVersion` (body: PDF bytes, at most 10,485,760 bytes) and `POST /api/menu/fetch-pdf` (body `{ url }`), both under the configured base URL; `GET /api/health` (no token); `OPTIONS` on all (no token). Any other path or method: 404 / 405 as locally.

**13.2 Request headers (hosted).**
| Header | Rule |
|--------|------|
| `Authorization` | `Bearer <Firebase ID token>`, required on both POST endpoints; the token must be well formed, correctly signed, unexpired and issued for this app's Firebase project. The local proxy ignores it. |
| `Origin` | Browser calls only; must exactly equal an allowed origin (13.5) or be absent. |
| `Content-Type` | As locally (PDF bytes for extract, JSON for fetch-pdf). |

The account identity is taken only from the verified token (`uid`; `email` and `email_verified` for the allow-list). No client-supplied identity field exists.

**13.3 Error replies added by the hosted proxy.** JSON `{ ok: false, error, ... }`. Existing codes (`RATE_LIMITED`, `UNAVAILABLE`, `MALFORMED_OUTPUT`, `NOT_A_MENU`, `TOO_LARGE`, `NOT_A_PDF`, `NOT_CONFIGURED`, `NETWORK`, `BAD_REQUEST`, `INTERNAL`) keep their meaning.
| error | HTTP | Extra fields | When | App message (US-E14-08) |
|-------|------|--------------|------|------------------------|
| `UNAUTHENTICATED` | 401 | none | token missing/invalid/expired/wrong project | sign-in expired; one token refresh and retry |
| `NOT_ALLOWED` | 403 | none (body identical for every denied account) | valid token, account not on allow-list, or allow-list missing/empty | account can't use menu reading |
| `ORIGIN_NOT_ALLOWED` | 403 | none | `Origin` present and not allowed | service-unreachable message |
| `ACCOUNT_LIMIT` | 429 | `scope`: `hour` \| `day` \| `fetch`, `retryAfterSec` (integer, at least 1), `providerCalls: 0` | per-account limit reached | limit messages (US-E14-03/AC4) |
| `UNAVAILABLE` | 503 | `providerCalls: 0` | limit counter store failed (fail closed) | service-unreachable message |

`RATE_LIMITED` stays reserved for the provider's own rate limit. The app treats an unknown `error` value as unreachable.

**13.4 Per-account limits (configuration, not code).** Key: pseudonymous account key derived from the uid (never the e-mail). Windows: rolling 60 minutes and Tokyo (JST) calendar day.
| Setting | DEFAULT |
|---------|---------|
| `extractPerHour` | 5 |
| `extractPerDay` | 20 |
| `fetchPerHour` | 30 |
| `fetchPerDay` | 100 |
Stored per account: key, counts and timestamps only. Counts are shared by all instances and survive restarts. What counts: US-E14-03/AC6.

**13.5 Configuration inventory (names are indicative; the developer's ADR fixes them).** None of these values is in git or in the web build except the first.
| Item | Where | Content | Required |
|------|-------|---------|----------|
| Proxy base URL | web build variable `VITE_AI_PROXY_BASE_URL` (repository variable, public) | https URL, or empty for same-origin (local dev) | no |
| Gemini key | function secret | the AI Studio key | yes for extract; absent gives `NOT_CONFIGURED` |
| Allow-list | function configuration | list of uids and/or e-mails (PO, spouse) | yes; absent or empty denies everyone |
| Allowed origins | function configuration | exact origins, DEFAULT `https://mrdrah.github.io` | yes |
| Limits | function configuration | 13.4 | defaults apply when absent |

**13.6 URL rules for fetch-pdf (hosted).** The local rules (BR-14: https only, no port other than 443, at most 2048 characters, at most 3 redirects, at most 10,485,760 bytes, 15 s, body starts with `%PDF-`) plus: no credentials in the URL; refuse any destination that is loopback, private (10/8, 172.16/12, 192.168/16), link-local (169.254/16, fe80::/10), unique-local (fc00::/7), CGNAT (100.64/10), unspecified, multicast or reserved, including IPv4-mapped IPv6 and alternative IPv4 spellings (decimal, hex, octal); refuse the cloud metadata address and name; check every resolved address and every redirect hop, and the address actually connected to; forward no caller headers or cookies. Refusals use the existing "blocked" outcome (US-E2-02/AC3).

**13.7 Operations checklist (not stories; the PO or developer ticks each before first use of the live service).**
- [ ] Firebase project on the Blaze plan, with a **budget alert** (DEFAULT: alert at 500 JPY per month, thresholds 50 / 90 / 100 %; PO confirms the amount). A budget alert only notifies, it does not stop spending; note this to the PO.
- [ ] Function region `asia-northeast1` (Tokyo); a maximum number of instances set low (DEFAULT 3) to cap runaway concurrency.
- [ ] Gemini key stored as a function secret by the PO (never pasted into chat, git, CI or the web build); the key is an AI Studio free-tier key without billing.
- [ ] Allow-list (PO and spouse) entered in function configuration; checked that a third account is denied.
- [ ] Allowed origins configured (Pages origin; dev origin only if wanted).
- [ ] Repository variable `VITE_AI_PROXY_BASE_URL` added at repository level (not in an environment, as with the Firebase variables on 2026-11-09), then the Pages build redeployed.
- [ ] Authorized domain for sign-in includes the Pages host.
- [ ] Manual smoke test with the real service: allowed account extracts a synthetic fixture PDF; a denied account and a missing token get the refusals; a metadata-address URL is blocked; logs checked for no content.
- [ ] Cost check after the first month: usage within the free quotas for two accounts (N5 of the E14 notes).
- [ ] How to turn it off: remove the repository variable (app returns to same-origin) and disable or delete the function.

**13.8 Validator and tests.** No stored entity changes (`schemaVersion` stays 1). The hosted reply schema (13.3) is added to the shared response validation used by the web adapter (BR-11); a fixture exists for each `error` code, using the fake identities `test-uid-001` and `test-uid-002` of §12.5 and the fake address `allowed@example.test`.
