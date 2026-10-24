# ADR-006: M1 import pipeline — normalise before the strict parse, replay recorded replies, fetch safely

Status: **accepted** · 2026-10-24 · Owner: Developer

Builds on ADR 002 (provider, budget, contract) and ADR 003 (store). Binding rules: BR-10, BR-11, BR-12, BR-14; findings F-1 and F-2 (PLAN §7 "M1 prep done").

## Context
M1 ships the import end to end without a Gemini key: the proxy's real `POST /api/menu/fetch-pdf`, a **mocked** `POST /api/menu/extract`, review, confirm. Three questions had to be settled in code:
1. **F-1.** The strict `ExtractedMenu` schema rejects out-of-month dates, duplicate dates and unflagged weekday mismatches. Treating those as `MALFORMED_OUTPUT` would spend the repair retry and then fail an import the parent could easily fix on review (US-E2-05/AC4–AC6).
2. **The mock.** It must exercise exactly the code M5 will run (budget, cache, cap, validation), with QA's recorded stand-ins, and be steerable by tests without a debug panel (that is M4).
3. **F-2.** `validate:data` read only top-level files in `tests/fixtures/menus/`, which are all in sub-folders.

## Decision
1. **Normalise, then validate.** `src/domain/menu/normalize.ts` runs on the parsed model reply before the strict parse: out-of-month lunch and no-lunch days move to `outOfMonthDays`; duplicate dates merge into one entry flagged `uncertain / duplicate-date` (all items kept); a printed weekday that disagrees with the date is flagged `uncertain / weekday-mismatch` (a second reason is kept in `verification.note`); `detectedMonth ≠ targetMonth` adds the `month-mismatch` warning; `targetMonth` is set to the parent's choice. Everything else (impossible dates, missing fields, bad enums, > 12 items after a merge) is left for the strict schema, so it still triggers the repair retry. `parseModelReply` (JSON → normalise → app-set fields → strict parse → "not a menu") is shared by the proxy, `validate-data` and the tests.
2. **The budget lives in the server adapter, around a transport port.** `server/menu/extract.ts → runExtraction` implements BR-10 (call 1 primary; call 2 = repair retry *or* fallback on 429/408/5xx/timeout; 400/403/404 never retried; `min(Retry-After, 5 s)` wait), the sha256 cache (successes only) and the proxy cap (5/hour, 20/day by default). M1's transport (`server/menu/mock-transport.ts`) replays `tests/fixtures/menus/*/recorded/*.json`: the committed fixture PDFs are hashed at start-up and map to their `hand-1.json`; the dev/test header `x-bm-mock-scenario` plays a comma list of stand-ins (`<fixture>/<name>`, `status:<code>`, `timeout`), one per call, and bypasses the cache. An unknown PDF without a scenario answers `NOT_CONFIGURED` (US-E2-06/AC4). M5 adds a Gemini transport and nothing else changes. The proxy does not know the parent's URL or file name (BR-10), so it validates with a provisional `upload` source; the client stamps the real origin (`stampOrigin`) and validates again.
3. **Fetch safely, with injected network.** `server/menu/fetch-pdf.ts` takes a resolver and a requester: https/443/no userinfo/≤ 2,048 characters; every resolved address checked (`server/net/ip.ts`: private, loopback, link-local/metadata, CGNAT, ULA, multicast, documentation and reserved ranges, and IPv4 embedded in IPv6 — mapped, compatible, NAT64, 6to4); a name with *any* internal address is refused; the connection goes to the validated address with the host name only for TLS/SNI; ≤ 3 redirects, each re-validated; `%PDF-` required and HTML stopped after the first chunk; 10 MB cap while streaming; 15 s for the whole action. The magic bytes decide, not the content type (schools serve PDFs with odd types); `text/html` is refused even with PDF bytes.
4. **F-2: validate-data runs the app pipeline over QA's folders.** For each `tests/fixtures/menus/<id>/`, `answer-key.json` / `review-data.json` → `.menu` must be a valid `ExtractedMenu`, and every recorded 200 reply goes through `parseModelReply`: stand-ins expected `ok` must pass, the others must not; stand-ins declared strictly valid must also pass the strict schema as recorded. QA's `check-fixtures.mjs` (now `npm run check:fixtures`) stays the check of the fixtures' own conventions (answer-key diffs, hard fields, PDFs), so the two don't duplicate each other.

## Why
- F-1 by normalising keeps the strict schema strict (stored data and exports are still checked by it) while the model's foreseeable slips reach the parent as flags, as BR-11 says. It costs no extra provider call.
- A transport port is the smallest seam that lets M1 test every BR-10 row (34 unit cases, no network) and lets e2e drive failures through the real proxy with one header.
- Injected resolver/requester make every SSRF rule unit-testable (51 cases) without DNS or sockets.

## Alternatives considered
| Option | Why not (now) |
|--------|---------------|
| Loosen the strict schema (accept out-of-month / duplicates) | Stored menus and exports would lose the guarantees `confirmed-*` and `days-unique-sorted` give; the review would still need the moves |
| Mock the extractor in the browser (Playwright `page.route` fulfilling JSON) | Skips the proxy's budget, cache and validation, i.e. the code M5 keeps |
| Call QA's `check-fixtures.mjs` from `validate:data` | Runs the same checks twice once `check:fixtures` is a gate command, and still wouldn't prove the *app* reads the fixtures |
| Resolve DNS inside `https.request` (`lookup` option) | Works, but the check and the connect then share one callback that is hard to test; resolving first and connecting to the address is explicit |

## Consequences
- Rule id `weekday-mismatch` is still reported by the strict day schema (QA's fixtures expect it) but is not in contract §6.1; raised with the BA (`RULES_NOT_IN_CONTRACT`).
- The scenario header is honoured unless `PROXY_MOCK_SCENARIOS=0`; a hosted proxy (v1) must turn it off. The e2e run raises the caps with `PROXY_EXTRACT_PER_HOUR/PER_DAY`, `PROXY_FETCH_PER_HOUR` (to document in the env example file).
- 「中止する」 (US-E2-04/AC8) counts 1 provider call: the client can't know whether the proxy had reached call 2, and the proxy stops at the next step once the client leaves.

## Revisit when
- M5: the Gemini transport arrives (only `transport` changes); live evals show other systematic slips worth normalising (e.g. full-width digits in dates).
- A school serves its PDF from a host whose DNS answer mixes public and private addresses (the "any internal address" rule would refuse it).
- The proxy is hosted (v1): scenarios off, caps per user/IP.
