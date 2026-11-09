# ADR 014: Accounts and sign-in (E13)

Status: accepted (slice A built; slice B pending) · 2026-11-09 · Owner: developer

## Context
The product owner decided (PLAN §7, 2026-11-09) on Google sign-in through Firebase Authentication, web first. Data stays on the device; no sync, backup or server copy. Stories US-E13-01..07, data contract §12.

## Decision
- **Port and adapter.** The app reaches sign-in only through `AuthPort` (`restore`, `signInWithGoogle`, `signOut`, `onChange`) in `src/domain/auth/`. No Firebase type crosses it; `AuthUser = {uid, displayName, email, photoUrl}`. The Firebase adapter lives in `src/adapters/` (slice B); a test asserts nothing else imports Firebase. `FakeAuth` gives scripted outcomes (every error kind, revoked session, delayed read) for unit, component and e2e tests.
- **Runtime state.** `AuthSession` is a pure reducer: `loading | signedOut | signingIn | signedIn` plus `lastError` (`cancelled` shows nothing). `signingIn` is the busy state of US-E13-03/AC3; contract §12.3 lists three statuses, this adds the fourth as UI-only. Never stored, never exported. A uid that cannot be a key part (blank, over 128 characters, contains `.` or whitespace) is a failed sign-in.
- **Key scheme.** `bentominder.<uid>.state` and `.state.prev`, one pair per account. Name, e-mail and photo are never stored. The repository takes `accountId`; without it the legacy unkeyed pair is used, so the not-signed-in paths and all earlier tests are unchanged until slice B. Unkeyed device settings: none exist today (theme and language live inside the store), so nothing stays unkeyed.
- **Owner rule.** `meta-owner-matches-account` (`ownerMismatches`, schema/store.ts): applied on load and save when the repository is bound to an account; a mismatch on load reads as `corrupt/schema-invalid` (the last-good copy is tried first), on save throws `StoreValidationError`. `schemaVersion` stays 1.
- **Adoption.** `adoptLegacyStore` runs after sign-in, before the first load: if the account has no store and the legacy keys hold a readable store, rewrite every `ownerId` to the uid, write the new keys, read them back equal, then remove the legacy keys. Because the legacy keys are gone afterwards, the next account finds nothing (no marker needed). Unreadable legacy data is left untouched. A crash between write and remove is finished at the next sign-in of the same account (same `deviceId`), never by another account.
- **Import** while signed in rewrites `ownerId` to the uid (the file becomes this account's data). Export and delete-all use only the bound account's keys.

## Slice B (not built)
Firebase adapter with `browserLocalPersistence`; restoring (3 s cap, `RESTORE_TIMEOUT_MS`) and login screens; deep link and notification target kept across login; settings account section with the confirm dialog; notification gating (cancel all on sign-out, reschedule from the account's own store on sign-in); `selectAdapters(uid)` and `createRepository(..., {accountId})` wired in `main.tsx`; existing suites start with `FakeAuth` signed in.

## Later (sync slice)
Server copy, APPI consent for allergy and health data, in-app account deletion, tombstones and `updatedBy`; decide whether `ownerId` becomes a family id.

## Revisit if
Firebase uids ever contain `.` or exceed 128 characters, a second provider is added (the port stays; the uid rule may not), or a store needs to be shared between accounts on one device.
