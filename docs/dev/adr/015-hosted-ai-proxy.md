# ADR 015: Hosted AI proxy (E14)

Status: proposed (design only, no code yet) · 2026-11-09 · Owner: developer

## Context
PLAN §7 (2026-11-09 and the Orchestrator defaults of the same day) fixes: Firebase Cloud Functions in Tokyo (`asia-northeast1`), Blaze plan with a budget alert, Gemini key as a function secret, Firebase ID token required, allow-list (PO + spouse), per-account limits, Pages origin `https://mrdrah.github.io`, local dev proxy stays. Stories US-E14-01..08, data contract §13. The existing local proxy (`server/`, ADR 001/002) already holds the extraction budget (`runExtraction`), the Gemini transport, `fetchPdf` and `isBlockedAddress`. This ADR decides how to host it without forking that logic.

Facts read from the code that shape the design: provider call timeout 45 s, at most two calls per import (so at most about 90 s); the app's client cap is 90 s (`EXTRACT_TIMEOUT_MS`); fetch cap 15 s; `server/index.ts` mixes the routing/validation with Node `http` objects; `server/menu/*` and `server/net/ip.ts` are already free of `http` and injected (resolver, requester, transport, cache, cap, clock).

## 1. Runtime: a 2nd gen HTTPS function, one Express-free handler
**Decision.** One 2nd gen function `api` (`onRequest` from `firebase-functions/v2/https`, region `asia-northeast1`, `invoker: 'public'` because the app authenticates, `maxInstances: 3`, 512 MiB, `timeoutSeconds: 120`, `secrets: [GEMINI_API_KEY, ALLOWED_ACCOUNTS]`). Not raw Cloud Run, not Express.
- A 2nd gen function is a Cloud Run service built by Firebase; the PO already has the Firebase CLI and project, and `firebase deploy` handles builds, IAM and secret binding. Raw Cloud Run adds a Dockerfile, Artifact Registry and `gcloud` for no benefit at two users. Revisit if we need streaming request bodies (see §5) or non-Node code.
- No Express: we have two routes and our own CORS and error shapes. A framework-neutral core keeps the local proxy and the function identical.
- **Sharing.** Split `server/index.ts` into:
  - `server/core/handle.ts`: `handle(req: CoreRequest, deps): Promise<CoreResponse>` where `CoreRequest = { method, path, query: URLSearchParams, headers, readBody(limit): Promise<Uint8Array>, signal }`, `CoreResponse = { status, headers, body }`. It holds routing, query validation, `EXTRACT_QUERY`, body limits, `fetchPdf`, `runExtraction`, error mapping. No `node:http` types.
  - `server/core/hosted-policy.ts` (new, pure): origin check, token gate, allow-list, limit reservation, order of outcomes (US-E14-02/AC6), log whitelist. Local passes `policy: null` and behaves as today (token-optional, no origin check).
  - Adapters at the edge only: `server/index.ts` (Node `http`, local, behaviour unchanged, existing tests keep passing) and `functions/src/index.ts` (Functions `onRequest`, firebase-admin, Firestore). Everything that names a Google SDK lives in `functions/src/`.
- The hosted entry never imports `file-cache.ts`, `mock-transport.ts` or `fs`. Hosted deps: `cache` = a `nullCache` (no stored entry, US-E14-06/AC3; `memoryCache` is not used), `extractCap` = allow-all (per-account limits replace the process-local cap), `allowScenarios: false` (hard-coded, not read from config).

## 2. Token check and allow-list
- **Token.** `firebase-admin` `getAuth().verifyIdToken(token, false)` behind a port `TokenVerifier = (token) => Promise<{uid, email?, emailVerified}|null>`. The Admin app is initialised with `projectId` taken from the runtime (`process.env.GCLOUD_PROJECT`); no credentials file is used (verification needs only Google's public certificates), and if the project id is missing the verifier returns null (fail closed). The audience/issuer check is therefore against our project (US-E14-01/AC2 last row). Revocation is not checked (open question Q7 default). The header is parsed by pure code first (`Bearer <non-empty>` only) so a missing or malformed header costs no verifier call.
- **Allow-list** is a function secret `ALLOWED_ACCOUNTS` (comma separated uids and/or e-mails), bound through `defineSecret`. Reasons: it holds personal e-mails, so it should not sit in plain environment variables that any project viewer reads, it is not in git, and it is read once per instance start (no per-request secret access cost). Change it with `firebase functions:secrets:set ALLOWED_ACCOUNTS` plus a redeploy (US-E14-02/AC3; Secret Manager versions are what the function uses at deploy). Parsed by pure `parseAllowList` (trim, lower-case e-mails, drop blanks); empty/unset/unparsable means deny all (AC4). Match rule: uid listed, or e-mail listed and `email_verified === true` (AC2). One constant body for every denial (AC5).
- **Non-secret config** (allowed origins, limits, optional dev origin): `defineString`/`defineInt` params, set in `functions/.env.<projectId>` (git-ignored, created by the PO or developer; `functions/.env.example` documents every name, committed with no real values). Defaults in code are the contract defaults, so an absent file still works.
- Order of outcomes: origin (403 ORIGIN_NOT_ALLOWED) then preflight/health (no token) then token (401) then allow-list (403) then request validation then limit reservation (429) then work.

## 3. Per-account counters: Firestore, one document per account
**Decision.** Firestore (native mode, region `asia-northeast1`), collection `proxyLimits`, document id `sha256("bm-proxy-v1:" + uid)` truncated to 32 hex (pseudonymous, no e-mail; the same short prefix is the only account key in logs). Document: per endpoint `{ hour: number[] (epoch ms within last 60 min), dayKey: 'YYYY-MM-DD' (Tokyo), dayCount }`, at most about 40 numbers. Nothing else (US-E14-03/AC7).
- `reserve(key, endpoint, nowMs, limits)` runs in one Firestore transaction: read, prune, check hour then day, append, write. The pure algorithm `applyReservation(state, now, limits)` is separate from the transaction wrapper so it is tested with a fake clock and no Firestore. Result is either `ok` or `{scope: 'hour'|'day'|'fetch', retryAfterSec >= 1}`; Tokyo day rollover uses the existing `src/domain/time/jst.ts` helpers (no second JST implementation). Scope `fetch` is returned when the fetch limits trip (contract §13.3).
- It counts before the provider call (a request that passed token, allow-list and validation counts even when the provider then fails, AC6). Any read/write/transaction error returns 503 `UNAVAILABLE`, `providerCalls: 0`, before the provider or outbound fetch (fail closed, AC8). Transactions retry on contention, so concurrent instances cannot over-issue (AC5).
- **Security rules:** `firestore.rules` is `allow read, write: if false;` for everything. The Admin SDK in the function bypasses rules, no client ever reads or writes, and nothing in the web build can. The web build must not initialise Firestore (a test already forbids stray SDK use; add one for `firebase/firestore`).
- **Alternatives rejected.** In-memory counters (reset by cold start and not shared, violates AC5); Realtime Database (second service, same job); Memorystore/Redis (monthly fee, VPC); Cloud Storage objects (no atomic multi-field update); signed cookies/tokens (the client controls them). Firestore's free tier and ID-by-account document make it the cheapest correct choice.
- **Cost.** One read and one write per counted request. Free quota (verified below): 50,000 reads and 20,000 writes per day and 1 GiB stored; our use is tens per month. Firestore allows one free database per project; use the default database.

## 4. SSRF-safe fetch
The design in `server/menu/fetch-pdf.ts` plus `node-net.ts` is already the right shape and is reused unchanged as the shared core: `checkUrl` (https, port 443, no userinfo, 2,048 characters), DNS resolution to every address with `isBlockedAddress` over all of them, connection to the vetted IP with the host name only for SNI/certificate and `Host` (no second lookup, so rebinding cannot help), manual redirects up to 3 with the whole check repeated per hop, 10 MiB streaming cap, `%PDF-` check, 15 s overall abort, no caller headers (the requester builds its own fixed header set). Slice B adds only:
- tests against the full list of US-E14-04/AC1 and §13.6 (CGNAT 100.64/10, multicast, reserved, IPv4-mapped IPv6, `metadata.google.internal`, 169.254.169.254, decimal/hex/octal spellings through WHATWG URL normalisation) using a fake resolver; `ip.ts` is extended only if a listed range is not covered;
- IPv4 addresses are tried first (Functions egress may not route IPv6; a failure then gives `NETWORK`, never a leak);
- hosted replies carry only the outcome code (reuse the existing mapping; the hosted adapter strips anything else); the `x-bm-sha256` response header is kept (a hash, no leak of the target);
- an `Agent` with `keepAlive: false` and `autoSelectFamily` off, so the connection really is the vetted one.
A redirect hop to a name is resolved and vetted again, which is the "address actually used" rule (AC2).

## 5. Request size, PDF upload and timeouts
- **Upload shape unchanged.** The app POSTs the PDF bytes as the body (`Content-Type: application/pdf`) with the three query parameters, exactly as locally; no multipart, no signed URLs, no bucket (nothing is stored, AC3 of E14-06). The browser sends the PDF base64-free.
- **Limit.** Platform ceiling (checked 2026-11-09): HTTP request size 32 MB for 2nd gen (10 MB for 1st gen), so 2nd gen is required because 10 MiB (10,485,760) plus nothing else fits. The function still enforces 10 MiB itself: first by `Content-Length` (413-like `TOO_LARGE`, `providerCalls: 0`, kept as the existing reply shape), then on the buffer length.
- **Known limit of the framework.** `onRequest` receives the body already buffered by the functions framework (`req.rawBody`), before our handler runs. So "the request body is not read" on a 401 (US-E14-01/AC1) can only mean "not parsed, inspected or kept"; the platform has already received at most 32 MB. The cost is none beyond bandwidth. A true streaming refusal would need raw Cloud Run (revisit trigger). I will confirm in the emulator that a `application/pdf` body arrives intact as `rawBody`; if not, the adapter reads the raw stream.
- **Timeouts.** The function's `timeoutSeconds` is 120: above the app's 90 s client cap and above the worst case of two 45 s provider calls plus the repair/fallback pause. The client cap stays the user-visible limit. `res.on('close')` aborts the provider calls when the client gives up (as locally, US-E2-04/AC8). The fetch endpoint keeps its own 15 s. Cold start (a few seconds) is inside the 90 s.

## 6. Repository layout, build, gate, bundle
```
functions/
  package.json         own deps: firebase-admin, firebase-functions only; engines node 22; main: lib/index.js
  package-lock.json
  src/index.ts         the hosted entry (the only file naming Google SDKs besides adapters/)
  src/firestore-limits.ts, src/admin-verifier.ts, src/config.ts
  .env.example         names only
  (lib/ is generated, git-ignored)
server/core/           shared pure code (see §1); server/menu, server/net as today
firebase.json          { functions: { source: "functions", predeploy: "npm --prefix functions run build" }, firestore: { rules: "firestore.rules" } }
.firebaserc            { projects: { default: "<firebase project id>" } }   (the id is public, not a secret)
firestore.rules
```
- **Bundling.** `functions/` builds with esbuild (already in the tree through Vite; add as an explicit devDependency at the root) into one `functions/lib/index.js` that inlines `../server/core`, `../server/menu`, `../server/net` and `../src/domain` (zod included). Deploy then needs only `firebase-admin` and `firebase-functions` installed in the cloud build. A relative import out of `functions/` therefore never reaches the deployed source. Version comes from an esbuild `define` instead of reading `package.json`.
- **Commands.** Root `npm run build:functions` (esbuild), `npm run typecheck` gains `functions/src` through `tsconfig.server.json` (`include` adds `functions/src`), `npm run lint` already covers it (`eslint .`; ignore `functions/lib`). Unit tests live in `tests/unit/hosted/` and run in the existing vitest run, so coverage and the gate need no new command; the gate's `commands` list gains one entry `build functions` (esbuild bundle plus a test that the bundle contains no `GEMINI`-key-shaped string and no `file-cache`). Deploy is not a CI job: the PO runs it locally, so no Google credential enters GitHub.
- **Web budget.** The only web change is the base-URL/token logic of slice C (about 1 KiB gzip). Current total is about 403 KiB against the 420 KiB budget; no new dependency. `firebase-admin` and the functions SDK never enter the web build (a test greps `dist/` for them).
- Existing import-boundary test: add "only `functions/src` and `src/adapters` name `firebase*` SDKs".

## 7. Deployment checklist for the PO (nothing is run by an agent)
1. `npm i -g firebase-tools`, then `firebase login` (browser; no key file).
2. In the Firebase console, upgrade the project to Blaze (billing account required).
3. Create a budget alert in Google Cloud Billing > Budgets (DEFAULT 500 JPY per month, thresholds 50/90/100 %), and read the note that it only emails.
4. Create the Firestore database (native mode, `asia-northeast1`).
5. `firebase functions:secrets:set GEMINI_API_KEY` (paste at the prompt; AI Studio free-tier key, no billing on that key) and `firebase functions:secrets:set ALLOWED_ACCOUNTS` (comma-separated: your and your spouse's e-mails or uids).
6. Create `functions/.env.<projectId>` from `.env.example` (origins `https://mrdrah.github.io`; limits optional).
7. `firebase deploy --only functions,firestore:rules`. Note the printed function URL.
8. `firebase functions:artifacts:setpolicy` (keep only the latest container images, so Artifact Registry stays inside its free storage).
9. Check Firebase Auth > Settings > Authorized domains includes `mrdrah.github.io`.
10. Add repository variable `VITE_AI_PROXY_BASE_URL` (repository level, not environment) = the function URL without the path, redeploy Pages.
11. Smoke test per contract §13.7 (allowed account, a third account denied, no token, metadata URL blocked, log check). Optional: a Cloud Logging exclusion for request logs if caller IP in platform logs matters (see risks).
12. Turn-off: delete the repository variable, `firebase functions:delete api --region asia-northeast1`.

## 8. Tests (no test calls Google, Firebase or Gemini; N3)
All under `tests/unit/hosted/` with fakes: `FakeVerifier`, fake allow-list string, fake clock, `FakeLimitStore` (in-memory implementing the same port), fake resolver/requester, mock transport, captured logger.
| AC group | Test |
|---|---|
| E14-01 (token) | handler with fake verifier: every header variant, wrong project, expired, `uid` query/header ignored, OPTIONS and health without token, refused request costs no counter and no provider call |
| E14-02 (allow-list) | `parseAllowList`/`isAllowed` cases (case, spaces, unverified e-mail, empty, garbage), identical denial body, order of outcomes |
| E14-03 (limits) | `applyReservation` table tests (hour, rolling window, JST midnight, retryAfterSec); handler: 6th request 429, other account unaffected, provider 429 stays `RATE_LIMITED`, store throwing gives 503; Firestore wrapper against a minimal fake `Transaction` (read-prune-write, retry) |
| E14-04 (SSRF) | the AC1 URL table, rebinding fake resolver (public then private), per-hop redirects, size/timeout, no header forwarding, no leak in reply |
| E14-05 (origin, key) | exact origin match (scheme/host/port/trailing text), no `*`, no origin passes to token check, NOT_CONFIGURED with empty secret while fetch still works; bundle/dist scan for key shapes (extends the existing `validate.mjs secrets` check) |
| E14-06 (privacy) | run every outcome with markers in the PDF text, URL, token, e-mail and assert captured logs contain none; no storage call except the limit store |
| E14-07/08 (web) | slice C: base-URL parsing table, token attached only to the configured hosted base, same one-retry rule, reply-schema fixtures per error code |
**Emulator (manual, not in the gate):** `firebase emulators:start --only functions,firestore,auth` (Firestore emulator needs Java) with a test PDF fixture proves the real wiring: `rawBody` arrival, Firestore transaction, token from the Auth emulator. The real service is checked only by the PO's smoke test.

## 9. Quotas and pricing (checked 2026-11-09 from vendor pages with `curl`; not from memory except where stated)
- **Cloud Functions 2nd gen = Cloud Run pricing.** https://cloud.google.com/run/pricing: free tier per month (stated for us-central1 active pricing) 180,000 vCPU-seconds, 360,000 GiB-seconds, 2 million requests. An extraction is at most about 90 s on a fraction of a vCPU; 100 a month is about 10,000 vCPU-s, so about 5 % of the free vCPU time. Tokyo is a higher price tier and whether the free amounts apply identically in Tokyo is not stated on the page I could read.
- **Request size.** https://cloud.google.com/functions/quotas: HTTP request 10 MB (1st gen) and 32 MB (2nd gen); HTTP function timeout page text truncated, but the app needs only 120 s; 2nd gen default max instances 100 (we set 3).
- **Firestore.** https://firebase.google.com/docs/firestore/quotas: one free database per project; 1 GiB stored, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, 10 GiB/month outbound.
- **Firebase plan.** https://firebase.google.com/pricing loaded and shows Blaze as pay-as-you-go with per-product no-cost amounts; I could not extract a clean Cloud Functions row from it, so the Run page above is the figure used.
- **Gemini free tier.** https://ai.google.dev/gemini-api/docs/rate-limits says free-tier limits are per model (RPM, TPM, RPD, RPD reset at midnight Pacific) and are shown in AI Studio; the page text I fetched does not give the RPD for `gemini-3.5-flash-lite` or `gemini-3.8-flash`. US-E14-03/AC6's claim (80 calls a day for two accounts is under the free allowance) is therefore NOT verified; ADR 002 §2 records the earlier assumption. The limits are per project, so the PO should read the numbers in AI Studio once. Free-tier prompts may be used by Google to improve its products (vendor terms, stated from memory, not re-verified); the inputs are public school menu PDFs.
- **Not verified:** Secret Manager free amounts (I recall 6 active versions and 10,000 access operations per month free, from memory; the pricing page was not readable by script), Artifact Registry free storage (recalled 0.5 GB), Cloud Build free minutes, and egress from Tokyo (Run's free 1 GiB is for North America; Asia egress is billed, but a few 10 MiB PDFs a month is cents). Cloud Logging has 50 GiB/month free (from memory). Expected bill: near zero, but small Artifact Registry/Build charges can appear even when invocations are free (N5 of E14).

## 10. Slices (each ends in green targeted tests and a short report)
- **A. Shared core and policy, no Google SDK.** Extract `server/core/handle.ts` from `server/index.ts` (local behaviour unchanged, existing proxy tests green); `hosted-policy.ts`: header parse, origin check, token gate with `TokenVerifier` port, `parseAllowList`/`isAllowed`, `applyReservation` and `LimitStore` port, error replies, log whitelist, `nullCache`. Tests `tests/unit/hosted/*` for E14-01/02/03/05/06 with fakes. Done when: `vitest run tests/unit/hosted tests/unit/server` and `tsc -p tsconfig.server.json` are green and the local proxy e2e specs still pass.
- **B. Hosted entry, Firestore, SSRF hardening.** `functions/` folder, `firebase.json`, `.firebaserc`, `firestore.rules`, esbuild build, Admin verifier, Firestore store behind the port, config/secret binding, `onRequest` adapter (body, abort on close), IPv4-first/keepAlive-off requester, SSRF tests (E14-04 full table), bundle test, import-boundary test, `.env.example`, `.gitignore` entries. Done when: hosted tests, `npm run build:functions`, typecheck and lint are green; emulator run documented in the report (manual).
- **C. Web app.** `VITE_AI_PROXY_BASE_URL` parsing and validation (E14-07 AC1-3), token supplier through `AuthPort` (AC4-6, only for the hosted base), hosted reply schema (§13.8), denied/limited/unreachable UX with the copy rows (E14-08, copy module from the designer), no-hosted-call when signed out (AC8), deploy workflow reads the repository variable (AC7), key-shape scan of `dist/`. Done when: unit, component and e2e (fake extractor and token source) are green and the JS budget is met.

## Risks
1. **Platform request logs record the caller IP** (Cloud Run/Functions request log) and cannot be switched off from our code; US-E14-06/AC1 says logs never contain it. Mitigation: our own log lines carry none; the PO may add a log exclusion. Needs a BA/PO ruling on AC wording (scope: "our log lines").
2. **Body buffering before our check** (§5): "body not read" means not inspected.
3. **Gemini free allowance unverified** for the two models (§9).
4. **Public invoker**: anyone on the internet can call the function and pay the (tiny) request cost; token check refuses them cheaply, `maxInstances: 3` caps concurrency, the budget alert only emails.
5. **Firestore adds a service** (a database exists although "nothing is stored"); only counters, rules deny all clients.
6. **E-mail in a secret** needs a redeploy to change; the allow-list by uid avoids personal data once known.
7. **Org policies** (domain-restricted sharing) can block `invoker: public`; unlikely on a personal project.

## Needs a decision
- PO/BA: wording of E14-06/AC1 (caller IP in platform logs) and E14-01/AC1 ("body not read"); recommend the "our own log lines" and "not inspected" readings.
- PO: read the Gemini free-tier requests per day in AI Studio for the two models (confirm >= 80/day).
- Orchestrator: the fetch request counts only after its URL passes `checkUrl` (syntactically valid https URL); a URL refused by SSRF rules after that still counts, as the validation list of AC6 does not name it. Recommend as is.

## Revisit if
We need streaming/oversized bodies or a non-Node runtime (move to Cloud Run), more than a handful of users (add App Check, a sync-capable store), a third origin (Android, Q5), or the budget alert proves too weak (add a kill switch).
