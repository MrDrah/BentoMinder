# Accounts and authentication — {{PROJECT_NAME}}

v1 module · Owner: Developer (ADR) + BA (stories) + Designer (screens) · {{DATE}}

## 1. Why accounts?
What a signed-in user gets that an anonymous one doesn't. If the answer is "nothing yet", stop here.

## 2. Decisions (each becomes an ADR)
| Decision | Options | Recommendation | Chosen |
|----------|---------|----------------|--------|
| Provider | Supabase Auth · Clerk · Auth0 · Firebase Auth · Cognito | Supabase Auth if the DB is Supabase Postgres (RLS uses the same identity); otherwise Clerk for speed | |
| Sign-in methods | Passkey · magic link · Google · Apple · GitHub · email+password | Magic link + Google (+ Apple if iOS users) | |
| Session | Provider cookies (http-only) · provider SDK tokens | http-only, secure, SameSite=Lax cookies | |
| Roles | user · admin · editor… | `user`, `admin` only until a story needs more | |
| Anonymous → signed-in | discard · offer import · auto-import | Offer import of local data on first sign-in | |
| Exit plan | export users, re-hash, magic-link re-onboarding | Document before launch | |

## 3. Required stories (`US-E7-*`)
Sign up · verify email · sign in · sign out · reset/change credentials · change email · delete account (removes personal data) · session expired · signed-out access to a protected page · admin-only page refused for `user`.

## 4. Screens (Designer)
Sign-up, sign-in, check-your-email, reset, profile, delete-account confirm, session-expired, account menu. Every state: default, loading, error (wrong code, expired link, rate-limited), success.

## 5. Rules
- Authorisation is enforced on the server or by database row-level security, never only in the UI.
- No hand-rolled password hashing or token signing.
- Tokens never in `localStorage` when the provider supports cookies.
- Rate-limit sign-in and reset endpoints (provider setting or middleware).
- Log sign-in events without logging credentials or full tokens.

## 6. Tests (QA)
- Isolation: user A can't read/list/edit/delete user B's records (API **and** direct DB with A's session).
- Every protected route: signed-out → refused; expired session → refused; wrong role → refused.
- Delete account: personal data gone or anonymised per `PRIVACY.md`.
