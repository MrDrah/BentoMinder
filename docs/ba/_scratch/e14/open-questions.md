# E14 open questions (each with a proposed default; none blocks the ADR)

Stories: `docs/ba/user-stories.md` E14. Contract: `docs/ba/data-contract.md` §13.

- **Q1 Limit values.** Default: extract 5/hour and 20/day, URL fetch 30/hour and 100/day, per account (the local proxy's values; two users need about 1 extraction a month). PO may lower them (for example 3/hour, 10/day). Worst case at default is 40 Gemini calls per account per day.
- **Q2 Day window.** Default: hour is a rolling 60 minutes, day is the Tokyo calendar day (resets 00:00 JST). Alternative: rolling 24 hours (simpler to build, less clear to a parent).
- **Q3 Allow-list key.** Default: uid or verified e-mail, both accepted. The PO's and spouse's uids are only known after their first sign-in; e-mail lets the PO configure it before that. Alternative: uid only (stricter, needs a first sign-in to learn it).
- **Q4 Budget amount.** Default alert at 500 JPY per month (50 / 90 / 100 %). A budget alert only emails; it does not stop spending. Alternative: add a kill switch (function disables itself on a budget notification), which adds work; the per-account limits and max-instances already cap spending, so default is no kill switch.
- **Q5 Other origins.** Default: only the Pages origin (plus the dev origin if configured). The Android app (Capacitor) will have its own origin (`https://localhost` or `capacitor://localhost`); decide when the Android slice starts. Also confirm the exact Pages origin `https://mrdrah.github.io` (the app lives under `/BentoMinder/`; the origin has no path).
- **Q6 Hosted PDF upload and denied accounts.** Default: a denied account gets only 「手入力する」 because both the upload and the URL import go to the same hosted extraction (US-E14-08/AC2). Alternative: let denied accounts use the debug sample menu in dev only.
- **Q7 Token revocation.** Default: verify signature, expiry and project only; do not check revocation on every call (extra cost and latency). Removing someone is done by the allow-list, which is checked on every call.
- **Q8 Pages preview before the hosted proxy is set up.** The 2026-11-01 ruling made Pages a mock-only demo. Default: with no `VITE_AI_PROXY_BASE_URL` it stays that way; with it set, real import works on Pages for allowed, signed-in accounts. No change to the debug sample menu.
- **Q9 Request-size and instance limits.** Default: 10 MiB body limit is enforced by the function itself (not only by the platform) so oversized bodies are refused cheaply (`TOO_LARGE`, 0 provider calls). Developer to confirm the platform's own request-size ceiling in the ADR.
- **Q10 Cost figures.** The BA did not quote Firebase or Gemini free-quota numbers (not verified here). The developer confirms current numbers for Cloud Functions, Secret Manager, the counter store and Artifact Registry/build storage in the ADR; small storage charges may occur even when invocations stay free.

Note for the Orchestrator (not a question): the repo's real fetch path is `/api/menu/fetch-pdf`; the dispatch called it "menu URL fetch". The stories use `/api/menu/fetch-pdf`.
