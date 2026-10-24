# ADR-002: AI menu extraction — provider, model, server-side adapter and contract

Status: **accepted** · 2026-10-24 · Owner: Developer

Binding rules: BR-10, BR-11, BR-14 (`docs/PLAN.md` §3); entity shapes: `ExtractedMenu` v1 in `docs/ba/data-contract.md` §3.3. Where this ADR and those disagree, they win.

Research and all citations: `docs/dev/research/ai-provider.md` (sources read 2026-10-24; keys `[Cn]` below refer to its table).

## Context
Once a month the parent imports the kindergarten's public lunch-menu PDF (Japanese). An AI model turns it into structured JSON (date, dishes, ingredients, allergens, notes, no-lunch days, source, uncertainty); the parent reviews and confirms; after that everything is deterministic (brief §6, §7; ADR 004). Constraints from the brief §7: real model in the MVP, Gemini Developer API free tier preferred, key never in web/Android client code, never committed, no paid usage without PO approval, schema-validated output, handle malformed output / outages / rate limits, fixtures so development needs no live AI, only the public PDF goes to the model, explain free-tier privacy before enabling. ADR 001 already fixes a dependency-free Node proxy in `server/` and zod schemas shared with the client; `docs/dev/architecture.md` §3 defines the `MenuExtractor` / `PdfSource` ports.

## Decision
Use the **Gemini Developer API** through a **server-side adapter** in the local Node proxy (MVP), with **`gemini-3.8-flash`** as primary and **`gemini-3.5-flash-lite`** as fallback (both stable, free tier, PDF input, structured outputs [C1][C4][C5]), model ids configurable. Send **only the PDF bytes and a fixed prompt + JSON Schema**; validate the reply with zod and domain checks; the parent confirms on the review screen. Later hosted use moves the same adapter to a **Cloudflare Worker** (free plan), subject to PO approval (open decision, M6).

**Region and tier (PO, 2026-10-24):** the import is used **from Japan only**, on the **free tier**, with a Google AI Studio project **without billing**. BentoMinder is a parents-only tool (Gemini API terms: users 18+); there is no child-facing mode.

### 1. Provider and model
| Setting | Value |
|---------|-------|
| Primary | `gemini-3.8-flash` (stable, Sept 2026; recommended for new projects [C2][C4]) — thinking level `low` (it rejects `minimal` [C4]) |
| Fallback | `gemini-3.5-flash-lite` (stable, July 2026; "document parsing" and "simple data extraction" [C5]) |
| Config | `GEMINI_API_KEY`, `GEMINI_MODEL_PRIMARY`, `GEMINI_MODEL_FALLBACK` in git-ignored `.env`; documented in `.env.example` without values. Code defaults to the two ids above |
| Allow-list | The proxy only accepts model ids on `FREE_TIER_MODELS = ['gemini-3.8-flash','gemini-3.5-flash-lite']` unless `AI_ALLOW_PAID_MODELS=true` (set only after a PO decision) |
| Pinning | Stable ids only, never `*-latest` aliases (hot-swapped [C2]); no previews (2-week deprecation, stricter limits [C2]) |
| Free-tier limits | **UNVERIFIED**: only visible in AI Studio [C8]. Unofficial report: 20 RPD for 3.8 Flash, 500 RPD for Flash-Lite [C10]. Our need: ~1–5 calls/month in use; live evals ≤ ~10/day. Record the real numbers here when the key is created |
| PDF | Inline base64, single request; menus are 1–4 pages, far below 50 MB / 1000 pages [C13]; ≈ 258 tokens/page [C13]. `media_resolution: high` if the live eval shows small-kanji errors |

### 2. Server-side adapter (MVP: local proxy)
Endpoints (ADR 001): `POST /api/menu/fetch-pdf { url }` and `POST /api/menu/extract` (body: PDF bytes, `Content-Type: application/pdf`, required `?targetMonth=YYYY-MM`). The client's `PdfSource` and `MenuExtractor` web adapters call these; no other `/api` route exists.

- **PDF by URL** (CORS-free, brief §6): https only, port 443, no userinfo; resolve DNS and reject loopback/private/link-local/CGNAT/ULA/multicast/metadata ranges incl. IPv4-mapped IPv6; connect to the validated IP (custom `lookup`); ≤ 3 redirects, each re-validated; `%PDF-` magic bytes required (content type `application/pdf` or `octet-stream`); **10 MB cap enforced while streaming**; 15 s timeout; never echo non-PDF bodies [C23]. Upload fallback applies the same size/magic checks.
- **Rate limits (our own)**: extract ≤ 5/hour and ≤ 20/day per proxy; fetch-pdf ≤ 30/hour. In-memory counters (MVP).
- **Cache (BR-10: 0 calls for a known PDF)**: two layers, both keyed by the PDF's SHA-256 only. (1) The client checks `store.menus[*].extractions[].source.sha256` before calling the proxy and reuses that extraction. (2) The proxy caches validated results on disk under a git-ignored `server/.cache/`, keyed by SHA-256 (model and `promptVersion` stored as metadata, not part of the key). A forced re-extraction after a prompt change is a developer action (debug panel / `eval:extraction`), never automatic.
- **Binding**: the proxy listens on `127.0.0.1` only in the MVP.

### 3. Request/response contract
**To the model, only** (contract rule `ai-payload-allowlist`, BR-10): the PDF bytes, `targetMonth`, the fixed prompt identified by `promptVersion` (Japanese + English instructions: transcribe, don't infer; absent fields `null`; flag doubtful readings as `uncertain`), and the JSON Schema identified by `schemaVersion`, generated by `z.toJSONSchema()` from `src/domain/schema/extracted-menu.ts`. **Never** a child-profile field, preference, allergy, decision, device id or the parent's identity. A unit test asserts the outgoing provider request contains only these four inputs, and a Playwright test asserts no `/api` request carries a profile field (architecture M1).

**From the proxy to the client** (`ExtractResult`, architecture §3):
```ts
{ ok: true, menu: ExtractedMenu, meta: { model, cached, promptVersion, schemaVersion, providerCalls: 0 | 1 | 2, usage?: { inputTokens, outputTokens } } }
| { ok: false, error: 'RATE_LIMITED'|'UNAVAILABLE'|'MALFORMED_OUTPUT'|'NOT_A_MENU'|'TOO_LARGE'|'NETWORK', retryAfterSec?, providerCalls: 0 | 1 | 2 }
```
`providerCalls` lets the client add to `store.aiUsage[<Tokyo month>]` (contract §3.1) for every outcome, including failures.

**Model output** = `ExtractedMenu` v1 exactly as in the data contract §3.3 (`contract: "extracted-menu/1"`), minus the fields the app sets itself (`id`, `source`, `extractedAt`). The model may only emit `verification.status` `ok` or `uncertain` (rule `verification-status-source`). Reiwa headings (`令和8年11月`) become `detectedMonth`, cross-checked by `reiwaToGregorian()` (ADR 001). Missing allergen information is `not-declared`, never `declared-none` (BR-08, rule `allergen-absence-not-inferred`).

### 4. Validation (three layers)
1. **Structured output** request (JSON Schema). It guarantees syntactically valid JSON only; keywords like `minLength`, `uniqueItems` are ignored, and semantically wrong output is possible [C17].
2. **zod parse** on the server (same schema as the client). On failure: at most one **repair retry** that includes the zod error paths, only if the call budget in §5 allows it; otherwise `MALFORMED_OUTPUT`. Raw text is kept in the server log for debugging, never shown in the UI.
3. **Domain checks** (pure, `src/domain/menu`, BR-11): dates outside `targetMonth` moved to `outOfMonthDays`; duplicate dates → `uncertain/duplicate-date`; printed weekday ≠ date → `uncertain/weekday-mismatch`; `detectedMonth ≠ targetMonth` → warning `month-mismatch`; allergen words mapped to dictionary `alg-` ids, unmapped words → `uncertain/ambiguous-term`. Violations become `verification` flags for the **review screen**, never silent fixes, and nothing the PDF doesn't print is added. Only a parent-confirmed menu is used (BR-12).

### 5. Failure handling and the call budget (BR-10, reconciliation R-1)
**At most 2 provider calls per import action.** A PDF whose SHA-256 was already extracted costs **0** calls (§2 cache). No backoff ladder and no automatic retry beyond call 2.

| Call 1 (primary model) result | Call 2 | Final result |
|-------------------------------|--------|--------------|
| Valid output | none | `ok` (1 call) |
| Malformed output (JSON or zod failure) | **one repair retry** on the primary model, with the zod error paths | valid → `ok`; else `MALFORMED_OUTPUT` (2 calls) |
| 429, 408, 500, 502, 503, 504, or provider timeout (60 s) | **the fallback model**, same request (waits `min(Retry-After, 5 s)` if given) | valid → `ok`; 429 → `RATE_LIMITED` (+ `retryAfterSec` if known); 408/5xx/timeout → `UNAVAILABLE`; malformed → `MALFORMED_OUTPUT` (no repair: budget used) (2 calls) |
| 400, 403, 404 | **never retried** | `UNAVAILABLE` (1 call). 404 logs "model unavailable: <id>" (deprecation check [C3]); 403 logs a key/project problem for the developer; the parent sees the generic message |
| Model says "not a menu", or no dates at all | none | `NOT_A_MENU` (1 call) |

Rejected **before any call** (0 calls): PDF > 10 MB or not starting with `%PDF-` → `TOO_LARGE` / invalid file (BR-14); URL not `https:` on port 443 (http, other schemes, explicit other ports, userinfo) or > 2,048 characters (BR-14); proxy unreachable → `NETWORK`; our own proxy rate cap (§2) → `RATE_LIMITED`.

**After any failure the UI stops and offers three choices** (copy from `design/`): try again later, upload the PDF instead, or enter the menu by hand. "Try again" is a new parent action with its own budget of 2 calls; it is never triggered automatically. For `RATE_LIMITED` the message says the free daily limit was reached and resets the next day (RPD resets at midnight Pacific [C8]).

### 6. Fixtures and evals
- **Fixtures (in the gate):** synthetic menu PDFs (own-made, no real school content) under `tests/fixtures/menus/` with expected JSON; recorded Gemini responses (good, malformed, malformed-then-good, 429, 429-then-good on fallback, 503, 400, not-a-menu) replayed by a fake transport in contract tests. The `MenuExtractor` fake returns fixture JSON for UI/e2e (Playwright `page.route`). No live calls in `npm test` or CI.
- **Live eval (opt-in, never in the gate):** `npm run eval:extraction` runs the real adapter on the fixture PDFs (plus the PO's real school PDF locally, not committed), reports date mapping, dish recall, "no invented allergens", and writes `reports/eval-*.json`. Run when the key is created, when the model id changes, and monthly; the deprecations page [C3] is checked at the same time.

### 7. Cost guard
- The key belongs to a Google AI Studio project **without** a billing account (free tier), used from Japan only (PO, 2026-10-24). Linking billing, or setting `AI_ALLOW_PAID_MODELS=true`, requires a new dated PO decision in the plan's decision log.
- The proxy logs every call (time, model, token usage from the response) to `server/.cache/usage.log` (git-ignored) and enforces the rate caps in §2.
- Paid prices for reference only (if ever approved): 3.8 Flash $0.75 / $3.75 per 1M in/out tokens until 2026-12-31, then $1.50 / $7.50; 3.5 Flash-Lite $0.30 / $2.50 [C15]. One import ≈ 3 k in / 8 k out tokens ⇒ well under US$0.05.

### 8. Privacy notice (shown before the first import)
The plain-language text in `ai-provider.md` §A3 goes to the designer's copy sheet. Key fact: on the free tier Google uses inputs/outputs to improve products and human reviewers may read them; Google's terms say not to submit sensitive or personal information; the paid tier does not use them for product improvement [C12].

## Why
- 3.8 Flash is the strongest free-tier model with PDF + structured output, and at one call per month accuracy matters more than speed or quota; Flash-Lite is designed for document parsing and reportedly has a much larger free quota, so it is a good second chance on 429 [C4][C5][C10].
- Server-side adapter: the only way to keep the key off the client in a static web app and in a Capacitor app (brief §7), and it also solves CORS for PDF-by-URL (brief §6).
- Three-layer validation because structured output does not guarantee correct values [C17] and the brief forbids inventing items or inferring absent allergens.

## Alternatives considered
| Option | Why not (now) |
|--------|---------------|
| `gemini-3.5-flash-lite` as primary | Weaker reading of dense tables expected; kept as fallback. Swap if the live eval shows equal accuracy (bigger free quota) |
| `gemini-3.6-flash`, `gemini-3.1-flash-lite` | Superseded; 3.1 Flash-Lite shuts down 2027-05-07 [C3] |
| `gemini-2.5-*` | Legacy; not open to new users [C2] |
| `gemini-4-argon`, `gemini-3.1-pro-preview` | No free tier [C1] |
| `*-latest` aliases | Hot-swapped without our control [C2] |
| Files API upload | Not needed below 50 MB; adds a 48 h stored copy at Google [C14] |
| Firebase AI Logic + App Check from the client | No server-side PDF fetch (CORS remains), prompt/schema live in client code, adds Firebase SDK; reconsider if v1 adopts Firebase for sync/auth [C22] |
| Cloud Functions for Firebase | Needs the Blaze billing plan [C21] — conflicts with the cost guard without PO approval |
| Key in the Android app | Forbidden by brief §7 |
| Mistral free tier | Same "may train on free data" caveat [C19], unverified limits; no advantage |
| Client-side OCR / no AI | Brief §7 requires a real AI model in the MVP |

## Consequences
- The parent (or PO) must run the proxy (`npm run dev`) to import; the Android app cannot reach it (architecture R2) until the hosted adapter exists or the menu is transferred by export/import.
- We own SSRF protection code; it gets unit tests for every blocked range, redirect re-validation and the size cap.
- Must test: the provider request contains only the four allowed inputs; zod rejects each malformed fixture; every row of the §5 table, asserting the number of provider calls (never > 2); 400/403/404 never retried; a cache hit makes 0 calls; domain checks produce `verification` flags.
- The PO must see the privacy text before the key is created.

## Decisions for the PO
1. ~~**Region.**~~ **Closed 2026-10-24:** the import is used from Japan only; free tier, AI Studio project without billing (plan §7). Google's terms require Paid Services for users in the EEA, Switzerland or the UK [C12]; if use from there is ever wanted, this decision reopens (recommended then: a billing-enabled project).
2. **Hosted adapter for Android/v1** (open, decided at M6): Cloudflare Workers free plan (100k requests/day, 10 ms CPU/request [C20]); needs an account and deploy approval.
3. ~~**Age clause.**~~ **Closed 2026-10-24:** BentoMinder is a parents-only tool (API users 18+, no clients likely to be accessed by under-18s [C12]); no child-facing mode.

## Revisit when
- AI Studio shows free-tier limits that make 1 import/month + evals impossible, or a model on this ADR gets a shutdown date [C3].
- The live eval shows < 95 % date mapping or any invented allergen on the fixtures → try `media_resolution: high`, then the other model, then a paid model (with approval).
- The PO approves paid usage or a hosted deployment; Google changes the free-tier data terms; the app is to be used outside Japan (decision 1 reopens).
- The 2-call budget proves too tight in the live eval (e.g. frequent malformed output on both calls) → BR-10 change via the plan §7, not a silent retry.
- v1 introduces accounts/sync (Firebase AI Logic becomes cheaper to adopt).

## Change log
- 2026-10-24 · proposed (research agent, kick-off).
- 2026-10-24 · **accepted** at H1 (Developer). R-1: the §5 backoff ladder (3 retries, then fallback) replaced by BR-10's 2-call budget (repair retry *or* fallback model, then stop with `RATE_LIMITED` / `UNAVAILABLE` / `MALFORMED_OUTPUT`; 400/403/404 never retried). Cache keyed by SHA-256 only (0 calls for a known PDF). §3 aligned with the data contract's `ExtractedMenu` v1 and payload allow-list; `providerCalls` added for `aiUsage`. Region closed (Japan only, free tier, no billing); age clause closed (parents only); hosted adapter stays open for M6.
- 2026-10-24 · H1 fix round (Developer): §5 pre-call rejection aligned with BR-14 as tightened at H1 (https only, port 443); §2 already enforced it.
