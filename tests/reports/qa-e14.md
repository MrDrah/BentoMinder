# QA report: E14 Hosted AI proxy (independent pass)

Base: worktree fast-forwarded to 6f9e66f. Derived from `docs/ba/user-stories.md` E14, `docs/ba/data-contract.md` 13 and ADR 015 only. Emulator-free: no firebase CLI, no deploy, no credentials, no network.

## Command and counts
`npx vitest run -c tests/unit/qa/e14/vitest.e14.config.ts` (run 4 times, stable): 11 files, 419 passed + 1 expected-fail (it.fails, defect E14-D01) = 420. Lint on `tests/unit/qa/e14`: clean. The config is separate because the default vitest projects do not include `tests/unit/qa/e14` (recommend adding the path to the "domain"/"ui" include lists).
Regression: `npx vitest run` (default): 81 files pass, 2 fail (`tests/unit/functions/bundle.test.ts`, `tests/unit/server/qa/m5-secrets.test.ts`). Both fail only because they call `node_modules/vite/bin/vite.js` inside the worktree, which has no node_modules (environment, not product). Their checks are repeated by my `US-E14-05-bundle.test.ts` (resolves vite from the parent install) and pass. Not run in the main checkout.
Ports 5173/8787/4173 were free. No e2e was run (see below).

## Files (tests/unit/qa/e14/)
rig.ts (own fakes), US-E14-01-02-gate (63), US-E14-01-adapter-verifier (11), US-E14-03-limits (36), US-E14-03-rules (2), US-E14-04-ssrf (141 incl. 1 expected fail), US-E14-04-oracle (7), US-E14-05-origin-key (38), US-E14-05-bundle (11), US-E14-06-privacy (39), US-E14-07-08-web (60), US-E14-08-import-panels (13, jsdom).

## ACs verified (emulator-free)
- E14-01: AC1, AC2 (all 6 rows plus 8 hostile headers, verifier throw, byte-identical refusals), AC3, AC4, AC5, AC6, AC7.
- E14-02: AC1, AC2, AC3 (config-level), AC4, AC5 (byte-compare status, headers, body across accounts, list states, endpoints), AC6.
- E14-03: AC1, AC2, AC3 (JST midnight edges, UTC midnight does not reset), AC4 (ja text via UI, en/ja strings equal to AC), AC5 (12 concurrent, 3 instances, restart; against a serialised store and a fake Firestore transaction incl. retry), AC6 (what counts; 40-call ceiling), AC7, AC8, AC9.
- E14-04: AC1 (about 80 unsafe forms plus 5 safe look-alikes), AC2 (mixed addresses, rebinding with one lookup, IPv4 first), AC3 (12 redirect targets, hop limit, loop), AC4, AC5, AC6, AC7. Oracle: 0 misses on IPv4 (edges plus 5,000 random), 3,000 random forbidden addresses in 7 IPv6 embeddings, 1,500 random fe80/fc00/ff00 addresses; engine over-blocks only documented special-use prefixes.
- E14-05: AC1, AC2 (21 look-alike/null/empty origins, on POST, preflight, health, array of two Origin headers), AC3, AC4 (sentinel key in function bundle and web build, key only in `x-goog-api-key` of the provider call, absent from every reply and log incl. exceptions quoting it), AC5, AC6.
- E14-06: AC1, AC2, AC3 (bundle has no fs write or file cache; no cache between identical requests), AC4 (32 scenarios x markers: PDF text, URL, token, e-mail, uid, IP, display name, origin; every log line matches a strict shape), AC5.
- E14-07: AC1, AC2, AC3 (19 bad values), AC4, AC5, AC6 (token only to hosted base, never with the fetch target, none when signed out and then 0 requests), AC7 (key-shape scan of dist).
- E14-08: AC1 (one refresh and one retry, no third), AC2, AC3, AC4 (one request per tap), AC5; wording equal to the ACs in ja and en (dictionary) and rendered in ja.

## Not verifiable without the emulator or a real deploy
1. Real Firestore transaction atomicity and contention (AC5 of E14-03); only the pure algorithm and a fake transaction were exercised.
2. Real Admin SDK `verifyIdToken` (signature, expiry, wrong project); only the port with a fake. See E14-D02.
3. `rawBody` arrival for `Content-Type: application/pdf` in the Functions framework, and "body not read" on 401 (ADR 015 section 5 already flags it).
4. The real socket goes to the vetted IP with the right SNI (`nodeRequester`, port 443 hard-coded, needs TLS); checked by code reading and by the fake requester only.
5. The path the deployed function sees under `https://asia-northeast1-<project>.cloudfunctions.net/<function>` plus `/api/menu/...` (could arrive with a function-name prefix and give 404).
6. `firestore.rules` semantics in the rules emulator (static text check only: every allow is `if false`).
7. Platform request log recording the caller IP (outside our code, PLAN section 7), real browser CORS, secret binding, budget alert, Gemini free-tier allowance (ADR 015 section 9 marks it unverified).
8. e2e in a browser: hosted mode requires an https base, so a local fake hosted proxy cannot be used without TLS; the token routing, retry and panels are covered at unit and jsdom level instead. Not reported as clean e2e.

## Defects
| id | sev | AC | summary | repro |
|----|-----|----|---------|-------|
| E14-D01 | P4 | US-E14-04/AC1, contract 13.6 | IPv4-translated IPv6 (RFC 2765, `::ffff:0:a.b.c.d`) is not classed as forbidden, unlike IPv4-mapped `::ffff:a.b.c.d`. `https://[::ffff:0:7f00:1]/` and `https://[::ffff:0:a9fe:a9fe]/` (metadata) reach the requester. Only reachable if the egress path has a SIIT translator, so exploitability is very low. | `fetchUrl(rig(), 'https://[::ffff:0:7f00:1]/')` expects BLOCKED and no connection; actual: requester called. Pinned by `it.fails` in `US-E14-04-ssrf.test.ts`; flip to `it` when fixed. Fix idea: block `::ffff:0:0:0/96` (and judge by embedded IPv4) in `server/net/ip.ts`. |
| E14-D02 | P3 (unverified assumption) | US-E14-01/AC2-AC3 | The verifier gets the project id only from `process.env.GCLOUD_PROJECT`; if the 2nd gen Node runtime does not set it, every token is refused (fail closed, but a total outage with no message). Cannot be proven either way without a deploy. | Code: `functions/src/index.ts` getDeps. Suggest fallback to `GOOGLE_CLOUD_PROJECT` / `FIREBASE_CONFIG.projectId` and confirm in the PO smoke test (first allowed login must pass). |

No P1/P2 found. Open P1/P2: 0. P3: 1 (E14-D02, owner developer). P4: 1 (E14-D01, owner developer).

## Observations (not defects, for the Orchestrator/BA)
- US-E14-04/AC1 says the unsafe-URL reply is "the HTTP 403 message". The proxy answers HTTP 422 with `BLOCKED` or `URL_NOT_ALLOWED` (same as the local proxy); the app maps both to the blocked message (`pdf-source.ts`). Consistent with local; AC wording could say "blocked outcome" only.
- A syntactically valid https URL refused by the SSRF rules (e.g. `https://10.0.0.5/`) still counts against the fetch limit; an `http://` URL does not. This is the ADR 015 "needs a decision" item, now pinned by a test.
- NOT_CONFIGURED (no key) is answered before counting; AC6 does not say either way.
- A verifier exception is answered 401 (not 503). A bad `Origin` also refuses `/api/health` (403), though AC6 of E14-01 talks about tokens only.
- The default e2e/unit gate does not pick up `tests/unit/qa/e14`; until the include lists change the new tests only run with the separate config.
