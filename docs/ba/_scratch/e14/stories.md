
---

## E14 Hosted AI proxy

PO decision (`docs/PLAN.md` §7, 2026-11-09). The two existing proxy endpoints, menu extract (`POST /api/menu/extract`) and menu URL fetch (`POST /api/menu/fetch-pdf`), also run as a hosted service (Firebase Cloud Function, Tokyo `asia-northeast1`, Blaze plan with a budget alert) so the GitHub Pages app can import real menus. The local dev proxy keeps working. This epic states behaviour only; the architecture is the developer's ADR.

**Out of scope / later (no ACs here):** sync or storage of any user data on the server, a self-service request for access, an admin screen for the allow-list, the Capacitor/Android origin (open question Q5), changing the extraction prompt, schema, model chain or the one-call-per-PDF rules (US-E2-04..07 stay as they are), changing the consent flow (US-E2-08 unchanged). The budget alert and other operations steps are the checklist in `docs/ba/data-contract.md` §13.7, not stories.

**Notes (rules for all E14 stories)**
- N1 "Hosted proxy" means the deployed service; "local proxy" means `npm run dev` on 127.0.0.1. Every AC applies to the hosted proxy unless it says "local".
- N2 Hosted error replies are JSON `{ ok: false, error: <code> }` with the codes of data contract §13. No reply contains a stack trace, a provider message, the allow-list or another account's data.
- N3 Tests use a fake ID-token verifier, a fake allow-list, a fake clock, a fake DNS resolver and a mocked provider; no test calls Google, Firebase or Gemini. Only a manual smoke check after deployment uses the real service.
- N4 Items marked DEFAULT are BA proposals the product owner may overturn (`docs/ba/_scratch/e14/open-questions.md`).
- N5 Cost assumption: two accounts, about 1 extraction per account per month plus a handful of URL fetches, so the hosted proxy is expected to stay inside the monthly free quotas of the Blaze plan (the plan needs a billing account, but the free quotas apply). The Gemini key stays an AI Studio free-tier key (US-NF-05/AC2), so Gemini calls stay free. The developer confirms the current quota numbers against Google's pricing pages in the ADR; this epic does not quote them.

### US-E14-01 Every request carries a valid sign-in token · M · M
As the product owner I want the hosted proxy to answer only signed-in users so that strangers cannot spend my AI quota.

```gherkin
Scenario: AC1 No token is refused before any work
  Given a hosted request to either endpoint with no Authorization header
  Then the reply is HTTP 401 with error UNAUTHENTICATED
  And 0 provider calls and 0 outbound fetches are made, and the request body is not read

Scenario Outline: AC2 Invalid tokens are refused the same way
  Given a hosted request whose Authorization header is <header>
  Then the reply is HTTP 401 with error UNAUTHENTICATED, with 0 provider calls and 0 outbound fetches
  Examples:
    | header                                                     |
    | "Bearer " followed by nothing                              |
    | "Basic abc" (not a Bearer scheme)                          |
    | a Bearer token that is not a well-formed ID token          |
    | a Bearer token with a bad signature                        |
    | a Bearer token that has expired                            |
    | a Bearer token issued for a different Firebase project     |

Scenario: AC3 A valid token of an allowed account is accepted
  Given a valid, unexpired ID token of an allowed account (US-E14-02)
  When the request is otherwise valid
  Then it is processed as the local proxy would process it (same request and response shape as the local contract)

Scenario: AC4 The account is the token's uid, never anything the client sends
  Given a valid token for account A and a request that also carries a "uid", "email" or "account" query parameter or header naming account B
  Then the request is handled as account A, and the extra value is ignored (extract still rejects unknown query parameters, as locally)

Scenario: AC5 Preflight needs no token
  Given a browser preflight OPTIONS request from an allowed origin (US-E14-05)
  Then it is answered without a token and does not count toward any limit

Scenario: AC6 The health route exposes nothing
  Given GET /api/health on the hosted proxy
  Then it answers without a token with only { ok: true, version }, and no provider, allow-list or limit information

Scenario: AC7 A refused request costs nothing
  Given any request refused by AC1 or AC2
  Then it does not count toward a limit (US-E14-03) and its body is not stored
```

### US-E14-02 Only allow-listed accounts may use it · M · M
As the product owner I want only me and my spouse to be able to use the hosted proxy so that a valid Google login alone is not enough.

```gherkin
Scenario: AC1 A signed-in account that is not on the list is denied
  Given a valid ID token of an account that is not on the allow-list
  When it calls either endpoint
  Then the reply is HTTP 403 with error NOT_ALLOWED
  And 0 provider calls and 0 outbound fetches are made, and the attempt does not count toward a limit

Scenario: AC2 The allow-list matches the verified account
  Given the allow-list holds the uid or e-mail of the product owner and the spouse
  Then an account is allowed when its uid is listed, or when its e-mail is listed and the token says the e-mail is verified
  And a token with an unverified e-mail that matches only by e-mail is denied (NOT_ALLOWED)
  And e-mail comparison ignores letter case and surrounding spaces

Scenario: AC3 The list is changed without a code change
  Given the allow-list lives in function configuration, not in the repository
  When an operator adds an account and redeploys or reloads the configuration
  Then that account is allowed, and removing it denies it again
  And no real uid or e-mail of an allow-listed person appears in git, in a test fixture (fixtures use clearly fake values), in a log or in a web build

Scenario: AC4 Missing or empty list fails closed
  Given the allow-list is not configured, empty or unreadable
  Then every request that passes the token check is denied with NOT_ALLOWED, and no detail about the configuration is sent to the client

Scenario: AC5 The denial reveals nothing about the list
  When any account is denied
  Then the reply body is identical for every denied account (no hint about who is listed, how many, or why)

Scenario: AC6 Order of checks
  Given a request with an invalid token for an allowed uid, or a valid token for a denied account
  Then the order of outcomes is: an invalid token gives UNAUTHENTICATED (US-E14-01), otherwise a denied account gives NOT_ALLOWED, otherwise limits (US-E14-03) apply
```

### US-E14-03 Per-account limits with clear messages · M · M
As the product owner I want each account limited per hour and per day so that a bug, a loop or a stolen login cannot run up a bill or burn the free AI quota.

```gherkin
Scenario: AC1 Limits are per account and per endpoint (DEFAULT values)
  Then each allowed account has its own counters for extract (DEFAULT 5 per rolling 60 minutes and 20 per Tokyo calendar day, the local proxy's values) and for URL fetch (DEFAULT 30 per rolling 60 minutes and 100 per Tokyo calendar day)
  And the values are set in function configuration, not in code, and one account reaching a limit never affects the other account

Scenario: AC2 Reaching the extract limit answers without calling the provider
  Given an account has used its extract limit for the hour
  When it requests an extraction
  Then the reply is HTTP 429 with error ACCOUNT_LIMIT, scope "hour", retryAfterSec (seconds until the oldest counted request leaves the window, at least 1) and providerCalls 0
  And 0 provider calls are made and the PDF is not forwarded

Scenario: AC3 The daily limit has its own reply
  Given an account has used its extract limit for the Tokyo day but not for the hour
  When it requests an extraction
  Then the reply is HTTP 429 with error ACCOUNT_LIMIT, scope "day", retryAfterSec (seconds until 00:00 JST) and 0 provider calls

Scenario Outline: AC4 The messages shown to the parent
  Given the app receives ACCOUNT_LIMIT with scope <scope>
  Then it shows <ja> / <en> with the upload option and 「手入力する」
  And for scope "hour" the retry button follows the countdown of US-E2-06/AC9 using retryAfterSec; for "day" there is no retry button
  Examples:
    | scope | ja                                                                              | en                                                                                    |
    | hour  | 「読み取りの回数が上限に達しました。1時間ほどしてからもう一度お試しください。」              | "You've reached the reading limit for now. Please try again in about an hour."         |
    | day   | 「今日の読み取り回数の上限に達しました。明日もう一度お試しください。」                     | "You've reached today's reading limit. Please try again tomorrow."                     |
    | fetch | 「URLからの取得回数が上限に達しました。PDFをアップロードするか、しばらくしてからお試しください。」 | "You've reached the limit for fetching from addresses. Upload the PDF, or try again later." |

Scenario: AC5 Counters survive restarts and several instances
  Given an account made 5 extraction requests in the hour, across a cold start or on different instances of the hosted function
  Then the 6th request in that hour is refused with ACCOUNT_LIMIT (the counter is not reset by a restart and is shared by all instances)

Scenario: AC6 What counts, and the cost ceiling
  Then a request counts when it passed token, allow-list and request validation (valid query, size, PDF magic bytes), whether or not the provider then succeeded
  And a request refused for token, allow-list, validation or a limit does not count
  And with the DEFAULT values one account can cause at most 20 extraction requests x 2 provider calls = 40 provider calls per Tokyo day, two accounts 80, which the developer confirms is below the free-tier daily allowance of the configured models (ADR 002)

Scenario: AC7 Limit state holds no menu content or personal data
  Then the stored limit state per account contains only a pseudonymous key (not the e-mail), counts and timestamps

Scenario: AC8 A failed counter does not become unlimited
  Given the counter store cannot be read or written
  Then the request is refused with UNAVAILABLE (HTTP 503) and 0 provider calls are made (fail closed)

Scenario: AC9 The provider's own 429 stays a different message
  Given the account is within its limits but the provider answers rate-limited on both models
  Then the reply is the existing RATE_LIMITED (US-E2-06/AC6), not ACCOUNT_LIMIT
```

### US-E14-04 URL fetch cannot be turned against the cloud (SSRF) · M · L
As the product owner I want the hosted URL fetch to download only public school PDFs so that nobody can use it to reach Google's internal services or my private resources.

```gherkin
Scenario Outline: AC1 Unsafe URLs are refused before any connection
  Given an allowed account requests a fetch of <url>
  Then no connection is made, the reply is the existing "blocked" outcome of US-E2-02/AC3 (the HTTP 403 message), and 0 provider calls are made
  Examples:
    | url                                                                                      |
    | http://example-kinder.test/menu.pdf (not https)                                          |
    | https://example-kinder.test:8443/menu.pdf (port other than 443)                          |
    | https://user:pw@example-kinder.test/menu.pdf (credentials in the URL)                    |
    | https://127.0.0.1/menu.pdf , https://[::1]/menu.pdf , https://localhost/menu.pdf         |
    | https://10.0.0.5/menu.pdf , https://192.168.1.1/menu.pdf , https://172.16.0.1/menu.pdf   |
    | https://169.254.169.254/computeMetadata/v1/ (cloud metadata address)                     |
    | https://metadata.google.internal/ (cloud metadata name)                                  |
    | https://2130706433/ , https://0x7f.1/ , https://0177.0.0.1/ (alternative IPv4 spellings) |
    | https://[::ffff:127.0.0.1]/ , https://[fd00::1]/ , https://[fe80::1]/ (IPv6 forms)       |
    | a URL longer than 2048 characters (BR-14)                                                |

Scenario: AC2 The address actually used is checked, not just the name
  Given the name "kinder-redirect.test" resolves to 10.0.0.5, or to one public and one private address
  Then nothing is downloaded and the reply is the blocked outcome
  And the check applies to the address the connection really uses (a name that is public at check time and private at connect time is still refused)

Scenario: AC3 Every redirect hop is checked again
  Given a public URL that redirects to https://169.254.169.254/ , to a private address, to http:// , or to a non-443 port
  Then the redirect is not followed and the blocked outcome is returned
  And more than 3 redirects ends the same way (US-E2-02/AC3)

Scenario: AC4 Only a PDF of at most 10 MiB comes back
  Given a public URL that serves 10,485,760 bytes of PDF
  Then it is returned
  Given 10,485,761 bytes, a body that does not start with "%PDF-", or an HTML page
  Then it is refused with the existing TOO_LARGE / not-a-PDF outcomes (US-E2-02/AC1, AC3), the download stops at the limit and nothing is passed on

Scenario: AC5 Time is bounded
  Given a server that takes longer than 15 seconds in total
  Then the fetch ends with the existing network/timeout outcome of US-E2-02/AC1 and no further data is read

Scenario: AC6 Nothing of the requester or of the target leaks
  Then the outbound request carries no Authorization header, cookie or Firebase token from the caller
  And on failure the reply never contains the target's status text, headers, body, resolved IP address or internal error text; only the outcome code of the local contract

Scenario: AC7 Failures give the same replies as the local proxy
  Then the 404, 403, timeout and HTML outcomes keep the US-E2-02/AC1 messages and still offer the upload (app code for these is unchanged)
```

### US-E14-05 Browser origins and the secret key · M · M
As the product owner I want only my app's pages to be able to call the hosted proxy from a browser, and the Gemini key to exist only inside the service, so that no copy of the app or the key can be taken from a website.

```gherkin
Scenario: AC1 Allowed origins get CORS headers
  Given the allowed origins are configured (DEFAULT: https://mrdrah.github.io ; the dev origin http://localhost:5173 only when the deployment is configured for it)
  When a request or preflight comes from an allowed origin
  Then the reply names exactly that origin in Access-Control-Allow-Origin (never "*"), allows only the POST and OPTIONS methods and the Authorization and Content-Type headers, and does not allow credentials or cookies

Scenario: AC2 Other origins are not served
  Given a request with Origin "https://evil.example", or any Origin that differs from the configured list in scheme, host, port or trailing text
  Then no Access-Control-Allow-Origin header is sent and the request is refused (HTTP 403, error ORIGIN_NOT_ALLOWED) with 0 provider calls and 0 outbound fetches

Scenario: AC3 A request with no Origin is judged by the token
  Given a request without an Origin header (not from a browser page)
  Then it is neither accepted nor refused because of that; it still needs a valid token and an allow-listed account (US-E14-01, US-E14-02)
  # CORS is a browser rule only; the token and the allow-list are the real protection.

Scenario: AC4 The Gemini key is a function secret only
  Then the hosted function reads the key from its secret store at run time and nowhere else
  And the key is absent from git, from the web build output (validate.mjs secrets passes on dist/), from the variables used by the web build, from function source, from every log line and from every reply body or header

Scenario: AC5 A missing secret is an honest "not configured"
  Given the secret is not set or is empty
  When an allowed account requests an extraction
  Then the reply is the existing NOT_CONFIGURED with 0 provider calls and the app shows the US-E2-06/AC4 message, while the URL-fetch endpoint still works

Scenario: AC6 The web build holds no proxy credential
  Then the web build contains only the proxy's public base URL (US-E14-07) and the Firebase web config of E13; no key, no allow-list entry, no limit value
```

### US-E14-06 Nothing private is logged or stored · M · S
As a parent I want my menu files and account details kept out of the service's logs so that the hosted service keeps nothing about my family.

```gherkin
Scenario: AC1 Logs may contain only operational facts
  Then a hosted log line may contain only: the endpoint name, the outcome code, HTTP status, duration, provider call count, model id, provider status code and a pseudonymous account key
  And it never contains the PDF or any text of it, the extraction result, the entered URL or its host, the Authorization header or token, the uid, e-mail, name or photo, the caller's IP address, or any child profile data

Scenario: AC2 Errors are logged without content
  Given the provider call fails, the token check fails or an unexpected exception is thrown
  Then the log line holds the outcome code and error class only, with no text copied from the request, the provider reply or a fetched page

Scenario: AC3 Nothing is persisted
  Then neither endpoint stores the PDF, the fetched file or the extraction result on the server (no file, bucket, database or cache entry); only the limit counters of US-E14-03 persist
  And the on-disk sha256 extraction cache of the local proxy is not used on the hosted proxy (the app's own reuse of stored extractions, US-E2-07, still prevents repeat calls)

Scenario: AC4 A test can assert it
  Given a run of every outcome in this epic with a recognisable marker in the PDF text, the URL, the token and the e-mail
  Then the captured log output contains none of the markers

Scenario: AC5 Only the public menu PDF reaches Google, consent unchanged
  Then the request forwarded to the provider is built exactly as locally (US-NF-03/AC1 payload allow-list: the PDF, targetMonth, prompt and schema versions), with no uid, e-mail, token or profile field added
  And the notice and consent of US-E2-08 are shown and required exactly as before, and declining sends 0 requests to the hosted proxy
```

### US-E14-07 The app picks the proxy address from a build variable · M · S
As the product owner I want the web build to know where the hosted proxy is, and local development to keep working unchanged, so that the same app runs on Pages and on my PC.

```gherkin
Scenario: AC1 Build variable selects the hosted base URL
  Given the web build is made with VITE_AI_PROXY_BASE_URL set to an https URL such as "https://asia-northeast1-<project>.cloudfunctions.net/<function>"
  When the app calls extract or fetch
  Then the request goes to that base URL plus the endpoint path ("/api/menu/extract", "/api/menu/fetch-pdf"), with or without a trailing slash on the variable

Scenario: AC2 Variable not set keeps today's behaviour
  Given VITE_AI_PROXY_BASE_URL is not set or empty
  Then the app calls the endpoints on its own origin as it does now (the dev proxy through Vite) and the existing tests pass unchanged

Scenario: AC3 A bad value is not used
  Given the variable is neither an https URL nor http://127.0.0.1 / http://localhost, or contains credentials, a query or a fragment
  Then it is ignored as if unset, one warning naming the variable (never its value) is logged, and no request is sent to it

Scenario: AC4 The token is attached to hosted calls only
  Given the user is signed in (E13) and the base URL is a hosted https address
  When the app calls either endpoint
  Then the request carries "Authorization: Bearer <current ID token>" obtained through the AuthPort (no Firebase type crosses it) and refreshed when expired
  And the token is never put in a URL, never stored by the app, never logged and never exported

Scenario: AC5 Local dev stays token-optional
  Given the app calls the local proxy (own origin, or an http://127.0.0.1 / localhost base)
  Then it works with or without a signed-in user, no Authorization header is added, and the local proxy needs no token

Scenario: AC6 The token goes only to the configured proxy
  Then the app never sends the ID token to any address other than the configured hosted proxy base URL

Scenario: AC7 The deploy variable is a repository variable
  Then the Pages build reads VITE_AI_PROXY_BASE_URL like the VITE_FIREBASE_* values (a repository variable; public by nature, not a secret), and a unit test fails if the built assets contain a Gemini-key-shaped string

Scenario: AC8 Test seam
  Then unit, component and e2e tests use a fake extractor and a fake token source (N3); the e2e build never calls the hosted service
```

### US-E14-08 The app handles an unreachable, denied or limited proxy · M · M
As a parent I want to know why an import did not work and what I can do instead, so that I am never stuck and my data is never harmed.

```gherkin
Scenario: AC1 Token problem
  Given the hosted proxy answers UNAUTHENTICATED
  When the app refreshes the ID token and retries the same request once
  Then if the retry succeeds the import continues
  And otherwise 「ログインの有効期限が切れました。もう一度ログインしてください。」 / "Your sign-in has expired. Please sign in again." is shown with 「ログインし直す」 (signs out, US-E13-05), the upload option and 「手入力する」
  And the first request spent no provider call (the proxy refused it)

Scenario: AC2 Account not allowed
  Given the hosted proxy answers NOT_ALLOWED
  Then 「このアカウントでは献立の読み取りを使えません。」 / "This account can't use menu reading." is shown with 「手入力する」 (the PDF upload is not offered either, because it would also call the hosted extraction), and no retry button
  And every other feature works as before (US-NF-04/AC1)

Scenario: AC3 Limit reached
  Given the hosted proxy answers ACCOUNT_LIMIT
  Then the message and retry rule of US-E14-03/AC4 are shown, and nothing is stored

Scenario: AC4 Hosted proxy unreachable or timing out
  Given the hosted address cannot be reached (offline, DNS failure, CORS failure, HTTP 5xx, no answer in 90 s per US-NF-04/AC3)
  Then the US-E2-06/AC2 message is shown with 「もう一度」, the upload option and 「手入力する」
  And no more than one request is sent per tap (AC1's single token retry is the only exception)

Scenario: AC5 Origin refused
  Given the hosted proxy answers ORIGIN_NOT_ALLOWED
  Then the US-E2-06/AC2 message is shown (the parent cannot fix it) and the developer-facing log notes the code

Scenario: AC6 Unknown reply
  Given the reply is not valid JSON, has an unknown error code, or fails the shared response schema (BR-11)
  Then it is handled as unreachable (AC4) and nothing from the reply is shown or stored

Scenario: AC7 No local data changes on any failure (BR-02, BR-13)
  When any of AC1 to AC6 occurs
  Then stored menus, assessments and decisions are byte-for-byte unchanged (as US-E2-06/AC3)

Scenario: AC8 Signed-out users make no hosted request
  Given no signed-in user and a hosted base URL
  Then the import screen cannot be reached (the login wall of US-E13-01 applies) and no hosted request is made

Scenario: AC9 Messages are plain, bilingual and free of codes
  Then the messages above contain no error code, URL, uid or technical text, exist in Japanese and English, and the designer supplies the final copy (quoted wording is a working label)
```
