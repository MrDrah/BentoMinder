# E15 design notes (designer to developer, 2026-11-10)

Specs: `design/components.md` §16, `design/flows.md` §22 (F19), `design/copy.md` §22 (206 rows: `consent.cloud.*` 31, `family.*` 138, `sync.*` 37). No new tokens.

## What the UI needs from the engine (state shape)
- Status: `StatusView` as in `src/domain/sync/status.ts` (state, lastSyncedAt, pendingCount, stale, showRetryNow). One extra optional field is wanted: `limitScope: 'record' | 'family' | 'writes'` (CycleOutcome already has it) so the UI can pick `sync.limit` or `sync.limit.writes`; without it the UI shows `sync.limit` for both.
- Notes: `lostEdits: {kind, key}[]` mapped to `family.lost.one.<kind>` (kinds: plan = decision, override, menu, profile, settings; key gives the date or month); `quarantined` count to `family.ignored.*`; `endedReason` (`left` | `removed` | `family-deleted`) to `family.ended.*` (`left` shows only a toast). Each note is cleared by the engine once shown (the ended note stays until acknowledged).
- Adoption: needs a "join committed, adoption unanswered" flag (to hide Cancel, see report) and local counts (profile yes/no, months, decisions) for `family.adopt.localSummary`.
- Safety copy: needs its expiry date for `family.safety.until` (30 days DEFAULT, contract 14.4).
- Invite: code, link, `expiresAt`, and outcome events (redeemed, expired).
- Member list: display name or e-mail per member, own row flagged.

## Behaviour details that are easy to miss
- No cloud request before the consent button is tapped, and none from the card until a button is tapped.
- Typed confirmation: NFKC + trim; en case-insensitive; evaluate on `input` and `compositionend`, not during composition. Initial focus is Cancel.
- Invite code display: two groups of five, spoken character by character; the input accepts any case, spaces and hyphens.
- App bar: status button is 44 px; brand text shows from 480 px while it exists.
- Live regions: `sync-live` persistent, polite, announces only attention states, max once per 10 s.
- Lazy chunks: `family` (consent, create, invite, join, adopt, dialogs, safety row) and `sync-status` (sheet, lost list). Main bundle: status button, card shell, new-device loading/retry.
- Changed strings elsewhere: `settings.data.where` is replaced by `family.data.where` while in a family; `data.deleteAll.body` gets `family.deleteAll.note` above it; `data.import.*` is replaced by `family.import.*` while in a family; login screen gets the `family.join.loginHint` banner when a join link was opened.
- 30 days (safety copy) and 72 h (invite) are text in copy; if the config changes, copy changes with it (the strings contain the numbers `30日`, `30 days`; the 72 h is shown as a date, not a number).
