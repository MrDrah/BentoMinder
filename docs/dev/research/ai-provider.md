# Research: AI provider for menu extraction and secure integration

Date: 2026-10-24 · Author: Developer (research agent) · Feeds: ADR 002 · Brief: `docs/ba/po-brief-2026-10-24.md` §6, §7

Every factual claim below carries a citation key `[Cn]`; the table at the end gives the URL and the date it was read (all 2026-10-24) plus the "last updated" stamp the page showed. Where an official page did not state a fact, it is marked **UNVERIFIED**.

---

## A. Gemini Developer API free tier

### A1. Candidate models, capabilities and limits

The pricing page lists which models have a free tier ("Free of charge" for input and output) [C1]. Filtering to text-output models that take PDF input and support structured outputs, and that are open to **new** projects:

| Model id | Status [C2] | Free tier [C1] | PDF input | Structured outputs | Input / output tokens | Shutdown date [C3] |
|----------|-------------|----------------|-----------|--------------------|-----------------------|--------------------|
| `gemini-3.8-flash` | Stable ("new"), Sept 2026 | Yes | Yes [C4] | Yes [C4] | 1,048,576 / 65,536 [C4] | none announced |
| `gemini-3.5-flash-lite` | Stable, July 2026 | Yes | Yes [C5] | Yes [C5] | 1,048,576 / 65,536 [C5] | none announced |
| `gemini-3.6-flash` | Stable (previous-generation Flash) | Yes | not checked on its card | not checked | — | none announced |
| `gemini-3.1-flash-lite` | Stable | Yes | — | — | — | **2027-05-07**, replacement `gemini-3.5-flash-lite` |
| `gemini-3-flash-preview` | Preview | Yes | — | — | — | Preview: deprecated with ≥ 2 weeks' notice [C2] |
| `gemini-2.5-flash`, `-2.5-pro`, `-2.5-flash-lite` | Legacy; "access limited to users who used it previously" [C2][C3] | Yes | — | — | — | none, but not available to a new project |

Not on the free tier: `gemini-4-argon` (pricing page: not available on the Free tier) and `gemini-3.1-pro-preview` [C1].

The models page recommends **"3.5 Flash-Lite or 3.8 Flash"** for new projects [C2]. The 3.5 Flash-Lite card describes it as built for "document parsing" and "simple data extraction" (two separate phrases on the card) [C5]; 3.8 Flash is "our most intelligent Flash model" [C4].

**Japanese.** The Google Cloud model documentation states "All Gemini models can understand the following languages" and lists Japanese (`ja`) [C6]. The ai.google.dev pages do not carry a language list (checked [C7]); the Cloud statement covers the same Gemini model family. Real-world quality on *our* menu layout is not proven by this and must be measured by the live eval (ADR 002).

**Free-tier rate limits (RPM / TPM / RPD): UNVERIFIED.**
- The official rate-limits page no longer publishes a per-model free-tier table. It says "View your active rate limits in AI Studio" [C8]. The billing page says "The free tier for Gemini API differs based on the model selected" without numbers [C9]. AI Studio needs a signed-in account, which this research did not use (no accounts created).
- Unofficial only: a developer forum post (2026-09-03, no Google reply) reports **20 RPD for `gemini-3.8-flash`** and **500 RPD for Flash-Lite** on the free tier [C10]. Treat as a hint, not a fact.
- Verified rules that do not depend on the numbers [C8]: limits are **per project, not per API key**; exceeding any one of RPM, TPM or RPD triggers a rate-limit error; **RPD resets at midnight Pacific time**; preview/experimental models have stricter limits.
- **What we need.** One import per month, plus a few retries, is 1–5 requests per month in production; development and live evals need maybe 10–30 requests on a busy day. Even the unofficial 20 RPD for 3.8 Flash is enough if the live eval suite runs one PDF per model per day. **Action for the PO/Developer:** read the real numbers in AI Studio → Usage/Rate limits when the key is created, and write them into ADR 002.

**Regional eligibility.**
- Japan is on the list of countries where the Gemini API and AI Studio are available; so are Switzerland, the UK and all 27 EU member states [C11].
- **But the Gemini API Additional Terms say: "You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom."** [C12] An app used by a person in the EEA/CH/UK is an API Client made available to a user there. The billing page's FAQ answers "Yes" to using the free tier in these regions [C9], which conflicts with the Terms. The **Terms are the binding document**; the conservative reading is: **if the PO (or any user) uses BentoMinder's extraction from the EEA, Switzerland or the UK, the free tier is not allowed and a billing-enabled (paid) project is required.** Users in Japan can use the free tier. This needs a PO decision (see ADR 002 "Open decisions").
- Also in the Terms [C12]: users of the API must be **18 or older**, and API Clients must not be "directed towards or … likely to be accessed by individuals under the age of 18". BentoMinder is a tool for parents; children do not use it. Keep it that way (no child-facing screens) and say so in the privacy note.

### A2. PDF handling [C13][C14]

| Topic | Fact |
|-------|------|
| Size / pages | PDFs up to **50 MB or 1000 pages**; the limit applies to inline data and Files API uploads alike [C13] |
| Inline vs Files API | Inline is "best suited for smaller documents or temporary processing"; Files API for larger documents reused across turns [C13]. Always use the Files API when the total request is > 100 MB [C14] |
| Files API | 20 GB per project, 2 GB per file, **files deleted after 48 hours**, free of charge, uploaded files cannot be downloaded back [C14] |
| Tokens | "Each document page is equivalent to **258 tokens**" [C13]. Text embedded in the PDF is extracted and given to the model; those text tokens are not charged, page images are counted as IMAGE tokens [C13] |
| Scanned PDFs | Gemini uses "native vision to understand entire document contexts" [C13]: a scanned page is read as an image. The page gives no specific scanned-PDF accuracy statement (**UNVERIFIED** for our menus). Best practice: correct orientation, no blurry pages [C13] |
| Resolution | Gemini 3 models accept `media_resolution` low/medium/high per media part; pages scale to max 3072×3072 / min 768×768 [C13] |

**For BentoMinder:** a kindergarten monthly menu is 1–4 pages and typically well under 5 MB, so **send it inline** (base64) in a single request. ≈ 258 tokens/page × 4 pages ≈ 1 k input tokens plus the prompt and schema (~2 k) and ~4–8 k output tokens for ~22 school days. At paid prices (for the cost guard only) that is a fraction of a US cent per import: 3.8 Flash $0.75 / $3.75 per 1M input/output tokens until 2026-12-31, then $1.50 / $7.50; 3.5 Flash-Lite $0.30 / $2.50 [C15]. Use `media_resolution: high` if the live eval shows small kanji being misread (dense tables of small text are the main accuracy risk).

### A3. Free-tier data use (plain-language note for the PO)

What the Gemini API Additional Terms say [C12]:
- **Free tier ("Unpaid Services"):** Google uses the content you send and the answers it returns to improve its products and machine-learning technologies. "Human reviewers may read, annotate, and process your API input and output." Google says it disconnects the data from your Google Account, API key and Cloud project before reviewers see it. The Terms tell you: "**Do not submit sensitive, confidential, or personal information to the Unpaid Services.**" No general retention period is stated for the free tier (one 30-day retention statement appears, for Grounding with Google Search, which we do not use).
- **Paid tier ("Paid Services"):** Google does **not** use prompts or responses to improve its products. It logs them "for a limited period of time, solely for detecting and preventing violations" of its policies (no number of days given). Data may be cached in any country where Google has facilities. A project is "paid" only when it is a Cloud project with an active billing account [C12]. Optional request logging for billing-enabled projects is opt-in, kept up to 55 days by default [C16].

**Text for the PO (to show before enabling the integration):**

> BentoMinder sends the school's lunch menu PDF to Google's Gemini service, which turns it into a calendar. We use Gemini's free tier. On the free tier Google may keep what we send and what it returns, use it to improve its products, and let human reviewers read it (Google says it first removes the link to our account). That is why BentoMinder sends **only the public school menu**, which anyone can already download from the school website. It never sends your child's name, age, allergies, likes or dislikes, or your plans; those stay on your device. If you want Google not to use the menu data for product improvement, the project must be switched to the paid tier, which costs a fraction of a cent per month but needs a billing account; we will only do that with your approval. Note: Google's terms say the free tier may not be used to serve people in the EU, EEA, Switzerland or the UK.

### A4. Recommendation

- **Primary: `gemini-3.8-flash`.** Stable, free tier, PDF + structured outputs, Google's recommended model for new projects, the most capable Flash model [C2][C4]. Extraction of a dense Japanese table (dates, dish names, ingredient lists, allergen marks, 「お弁当の日」 no-lunch days) rewards reading accuracy over speed; we make one call per month, so latency and cost do not matter and the stronger model is the right default. Set thinking to `low` or `medium` (it does not accept `minimal` [C4]); extraction needs careful reading, not long reasoning.
- **Fallback: `gemini-3.5-flash-lite`.** Stable, free tier, PDF + structured outputs, described as suited to "document parsing" and "simple data extraction" [C5], and reportedly a much larger free daily quota [C10, unofficial]. Used automatically when the primary returns 429 (quota) or 503 after retries, or by configuration.
- **Not chosen:** 3.6 Flash (superseded by 3.8), 3.1 Flash-Lite (shutdown 2027-05-07 [C3]), previews (stricter limits, 2-week deprecation [C2]), 2.5 family (closed to new users [C2]), `*-latest` aliases (hot-swapped without our control [C2]).
- **Deprecation risk and configurability.** Use a pinned **stable** id, never a `-latest` alias [C2]. The ids live in server config: `GEMINI_MODEL_PRIMARY` and `GEMINI_MODEL_FALLBACK` in `.env` (defaults in code, documented in `.env.example`). Every extraction result records `model` and `extractorVersion` in its source info so a later model change is traceable. Check the deprecations page [C3] when the live eval runs (monthly); a model-not-found (404) error is reported as "model unavailable" with the configured id, not retried.
- **API surface note.** The current structured-output docs show the new `interactions` API with `response_format: { type: "text", mime_type: "application/json", schema }` [C17]. Older `generateContent` with `responseMimeType` / `responseJsonSchema` is what many examples use. The adapter must isolate this behind one function; the developer confirms the exact request shape against the docs at implementation time.
- **Structured output is not a guarantee of correctness** [C17]: output is syntactically valid JSON, but keywords such as `minLength`, `maxLength`, `uniqueItems` are silently ignored, very large or deeply nested schemas can be rejected with 400, and the docs say to validate values in the app (they name Zod) and to handle "schema-compliant but semantically incorrect outputs". Hence: zod validation on the server, domain cross-checks (dates belong to the stated month, weekdays match dates, no duplicate dates), then the parent's review screen.

### A5. Alternatives if Gemini is unsuitable

If the PO is in the EEA/CH/UK and does not want a billing account, or quality on real menus is poor, the options are: (1) **Gemini on a paid project** (same code, a few cents per year at the prices in [C15], no product-improvement use [C12]) — the simplest fallback; (2) **Mistral** offers a free "Experiment"/Free mode on its API with the lowest rate limits, aimed at evaluation and prototyping [C18]; its help centre says Free-mode inputs and outputs may be used for training [C19], so the same privacy caveat applies, and its per-model free limits are only visible in its admin panel (**UNVERIFIED**); (3) **Firebase AI Logic** is not a different model but a different way to call Gemini (see B). Other providers' free tiers (OpenAI, Anthropic, Groq, OpenRouter) were **not researched** in this pass; Anthropic and OpenAI are not assumed to have free API tiers. Recommendation: stay with Gemini; if the free tier is not allowed for the PO's location, ask the PO to approve a paid Gemini project rather than switching provider.

---

## B. Secure integration

### B1. Options for keeping the key off the client

| Option | Key location | Cost / plan | Fits | Trade-offs |
|--------|--------------|-------------|------|------------|
| **(a) Local Node dev proxy** (ADR 001 `server/`) | `.env` on the dev machine, git-ignored | free | MVP: browser on the same machine/LAN, Playwright | Not reachable by an Android phone outside the LAN; the PO must run `npm run dev`. Fine for the MVP's once-a-month import |
| **(b) Serverless function**: Cloudflare Workers | Worker secret | Free plan: 100,000 requests/day, **10 ms CPU** per request (network wait not counted), 128 MB memory, 50 subrequests, 100 MB request body [C20] | Later hosted use, Android app | Workers runtime is not Node: no raw socket/DNS control, so SSRF IP checks rely on DNS-over-HTTPS lookups + Cloudflare's own egress; base64 of a 5 MB PDF may approach the 10 ms CPU budget (measure). Same adapter code can run if written against `fetch` only |
| **(b) Cloud Functions for Firebase** | Secret Manager | Requires the **Blaze** (pay-as-you-go) plan; Spark marks Functions "Not applicable" [C21] | Later | A billing account is needed even if usage stays within no-cost quotas; conflicts with "no paid usage without PO approval" unless approved |
| **(b) Vercel functions** | env var | not researched (**UNVERIFIED**) | Later | — |
| **(c) Firebase AI Logic + App Check** | Firebase proxy keeps the Gemini key on the server ("stays on the server") [C22] | App Check no-cost subject to quotas [C21]; Gemini billed at Gemini API pricing; free tier for the Developer API mentioned [C22]; Spark availability not stated (**UNVERIFIED**) | Later, if we want no server of our own | Client SDKs for web and Android; App Check limits abuse; per-user rate limits on by default [C22]. **But** it calls the model from the client, so it cannot fetch the school PDF server-side (CORS problem remains: the PDF must be uploaded by the user or fetched by something else), and the request shape/validation lives in client code. Adds the Firebase SDK to the bundle |

**Recommendation.** MVP: **(a)**, the local Node proxy already decided in ADR 001, with the provider call behind a `MenuExtractor` port. Later hosted / Android: **(b) Cloudflare Workers free plan** — no billing account needed, the same `fetch`-based adapter code, and it can also do the server-side PDF fetch; add a shared secret or Turnstile/App Attest style check before exposing it publicly. Keep (c) as the alternative if the project later adopts Firebase for sync/auth anyway (brief §13 future family sharing).

### B2. Server-side PDF fetch by URL

Browser `fetch` to a school's site fails unless the site sends CORS headers (brief §6 already says not to assume it works). The proxy fetches instead: `POST /api/menu/fetch-pdf { url }` → bytes, then extraction. Defences, following OWASP's SSRF cheat sheet [C23]:

1. **Scheme**: `https:` only; port 443 only; reject credentials in the URL (`user:pass@`), reject URLs that different parsers read differently.
2. **Resolve and check every IP** (A and AAAA): reject loopback (127.0.0.0/8, ::1), 0.0.0.0/8, RFC 1918 (10/8, 172.16/12, 192.168/16), link-local (169.254/16, fe80::/10, which includes cloud metadata 169.254.169.254), CGNAT 100.64/10, unique-local fc00::/7, multicast, and IPv4-mapped IPv6 forms of all of these. Reject `metadata.google.internal` and similar names.
3. **DNS rebinding**: connect to the validated IP (Node: custom `lookup` in the HTTPS agent that returns only the validated address) while keeping the hostname for SNI/certificate checks [C23].
4. **Redirects**: follow manually, at most 3, re-validating each hop with rules 1–3 [C23].
5. **Content**: require `Content-Type: application/pdf` (or `application/octet-stream` plus `%PDF-` magic bytes); always check the magic bytes. **Size cap 10 MB** (Gemini's own limit is 50 MB [C13]; a menu is far smaller), enforced while streaming, not after. Timeout 15 s.
6. **Scope**: the proxy only ever returns the PDF bytes to the caller and sends them to Gemini; it never echoes arbitrary response bodies. The source URL is stored with the menu (brief §6).
7. Fallback: manual PDF upload (brief §6) uses the same size and magic-byte checks.

### B3. Rate limiting, validation, retries

- **Our own rate limit** (protects the free quota and, later, the hosted endpoint): extraction max **5 calls per hour and 20 per day** per proxy instance (in-memory counter in the MVP; Workers would use a KV/Durable Object counter). Above that the proxy returns 429 with a Japanese/English message. Fetch-pdf: max 30 per hour.
- **Cost guard**: the API gives the proxy no reliable way to tell whether the key's project has billing enabled, so the guard is mainly a process control: the key belongs to a free-tier project and **no billing account is linked without PO approval**. Technically, the proxy enforces the call caps above, logs every call (model, tokens from the response's usage metadata), and refuses models not on an allow-list of free-tier ids. See ADR 002.
- **Schema validation**: the request sends a JSON Schema generated from the zod schema (`z.toJSONSchema()`, ADR 001); the response is parsed and validated with the same zod schema on the server; on failure, one repair retry with the validation errors in the prompt, then return `invalid_output` with the raw text kept server-side for debugging (not shown to the user). Then domain checks (B4 of ADR 002).
- **Retries** [C24]: retry only transient errors (**429, 408, 500, 503, 504**) with exponential backoff and jitter, starting ~1 s (1 s, 2 s, 4 s), max 3 retries; never retry other 4xx (400 bad request, 403 permission/billing, 404 model not found). For 429 that is a daily quota (RPD) rather than per-minute, retrying is pointless: after the retries, switch once to the fallback model, then report "the AI service limit for today is reached; try again tomorrow (resets at midnight Pacific time = 16:00 or 17:00 JST)" [C8].

---

## Citations

All pages read on **2026-10-24**. "Updated" is the page's own last-updated stamp.

| Key | Source | URL | Updated |
|-----|--------|-----|---------|
| C1 | Gemini API pricing | https://ai.google.dev/gemini-api/docs/pricing | 2026-10-22 |
| C2 | Gemini models overview (status, version naming, recommendation) | https://ai.google.dev/gemini-api/docs/models | 2026-10-22 |
| C3 | Gemini deprecations | https://ai.google.dev/gemini-api/docs/deprecations | 2026-10-22 |
| C4 | Model card: Gemini 3.8 Flash | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash | 2026-10-22 |
| C5 | Model card: Gemini 3.5 Flash-Lite | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite | 2026-10-22 |
| C6 | Google Cloud: Google models (language list incl. Japanese) | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/google-models | 2026-10-22 |
| C7 | ai.google.dev regions page (no language list) | https://ai.google.dev/available_regions | 2026-10-22 |
| C8 | Gemini API rate limits | https://ai.google.dev/gemini-api/docs/rate-limits | 2026-10-15 |
| C9 | Gemini API billing (free tier FAQ) | https://ai.google.dev/gemini-api/docs/billing | 2026-09-28 |
| C10 | Developer forum (unofficial): "Gemini 3.8 Flash Free Tier 20 RPD…" (2026-09-03) | https://discuss.ai.google.dev/t/gemini-3-8-flash-free-tier-20-rpd-is-too-limited-for-practical-evaluation/180609 | — |
| C11 | Available regions | https://ai.google.dev/gemini-api/docs/available-regions | 2026-10-22 |
| C12 | Gemini API Additional Terms of Service | https://ai.google.dev/gemini-api/terms | 2026-04-28 (effective 2026-03-23) |
| C13 | Document understanding (PDF) | https://ai.google.dev/gemini-api/docs/document-processing | 2026-10-08 |
| C14 | Files API | https://ai.google.dev/gemini-api/docs/files | 2026-10-14 |
| C15 | Pricing for 3.8 Flash and 3.5 Flash-Lite (paid tier) | https://ai.google.dev/gemini-api/docs/pricing | 2026-10-22 |
| C16 | Logs and datasets policy | https://ai.google.dev/gemini-api/docs/logs-policy | 2026-10-14 |
| C17 | Structured outputs | https://ai.google.dev/gemini-api/docs/structured-output | 2026-10-21 |
| C18 | Mistral: Usage and limits | https://docs.mistral.ai/admin/billing-usage/usage-limits | not read in full (via search summary) |
| C19 | Mistral help: data used for training | https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models | not read in full (via search summary) |
| C20 | Cloudflare Workers limits | https://developers.cloudflare.com/workers/platform/limits/ | 2026-10-12 |
| C21 | Firebase pricing | https://firebase.google.com/pricing | — |
| C22 | Firebase AI Logic overview | https://firebase.google.com/docs/ai-logic | 2026-10-20 |
| C23 | OWASP SSRF Prevention Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html | — |
| C24 | Gemini API troubleshooting (errors, retries) | https://ai.google.dev/gemini-api/docs/troubleshooting | 2026-10-23 |

### Not verified
- Free-tier RPM / TPM / RPD per model (only in AI Studio; forum figures are unofficial).
- Accuracy on scanned Japanese menus (needs our live eval).
- Firebase AI Logic availability on the Spark plan; Vercel free limits; Mistral free-tier limits; other providers' free tiers.
