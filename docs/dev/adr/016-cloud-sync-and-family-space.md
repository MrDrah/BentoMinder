# ADR 016: Cloud sync and shared family space (E15)

Status: proposed (design only, no code yet) · 2026-11-10 · Owner: developer

## Context
PLAN §7 (2026-11-10): the PO and spouse share one family dataset online; Firestore in Tokyo; offline-first; per-record last-edit-wins; invite joining; members equal; consent before any upload. Stories US-E15-01..11 (107 ACs), data contract §14 (and §12 for keys and `ownerId`, §13 for the proxy). Starting point: the local store `bentominder.<uid>.state` (ADR 003/014) with per-record `ownerId/createdAt/updatedAt`; Firestore is `allow read, write: if false` and used only by the E14 function (ADR 015). Facts measured or fetched on 2026-11-10 are marked (M) or (F); everything else is stated as unverified.

## Decisions in brief
1. **Data model**: one Firestore document per sync record under `families/{familyId}/records/`, plus a family document, member documents, an account-to-family index, and invite documents keyed by the hash of the code. A family-level `seq` counter gives a reliable change cursor. Tombstones are documents with `deletedAt`.
2. **Access path (recommendation, needs PO confirmation)**: **everything through one new Cloud Function (`sync`), Admin SDK; `firestore.rules` stay deny-all; the web app gets no Firestore SDK.** The alternative (direct client access under rules, Function only for membership) is specified in section 2.4 and is the fallback if the PO insists on literal "security rules".
3. **Sync engine**: pure domain code in `src/domain/sync/` behind `SyncPort`; polling every 60 s while visible and online (plus on focus, online and after each push); the local store stays the only thing the UI reads.
4. **Budget**: with the recommendation the web bundle grows by about 6 KiB gzip (an HTTP adapter and the engine), no budget ruling. The direct-client alternative needs a ruling (section 3.4).
5. **Tests need no Java**: engine and function logic are tested with fakes in the default vitest. The rules emulator is optional (CI only) under the recommendation.

## 1. Firestore data model
All paths are touched only by the Function (Admin SDK) under the recommendation. Region `asia-northeast1`, default database (the one free database; ADR 015 §3).

| Path | Fields | Purpose |
|------|--------|---------|
| `accounts/{uid}` | `status` (`member` \| `ended` \| `deleting`), `familyId?`, `endedReason?` (`left` \| `removed` \| `family-deleted`), `endedAt?` | Finds an account's family in one read; enforces one family per account (`family-one-per-account`); carries the reason a device must show once after removal or deletion. Holds no content. |
| `families/{familyId}` | `schemaVersion`, `createdAt`, `seq` (int, bumped per accepted push), `totalBytes`, `maxMembers` (copied from config at creation), `status` (`active` \| `deleting`), `activeInviteHash?` | One read gives the cursor and the quota state. |
| `families/{familyId}/members/{uid}` | `joinedAt`, `consentVersion`, `consentedAt`, `displayName?`, `email?` | Members and consent (section 6). Name and e-mail come only from the verified token on each membership call, are returned only to members, never stored locally (answers Q5; uid-only is the fallback). |
| `families/{familyId}/records/{kind}_{key}` | `kind`, `key`, `payloadJson` (string, absent on tombstone), `updatedAt` (ISO), `updatedAtMs` (int), `updatedBy`, `deviceId`, `deletedAt?`, `seq`, `bytes` | The sync record (contract 14.2). `{kind}_{key}` examples: `profile_profile`, `menu_2026-11`, `decision_2026-11-03`, `aiUsage_2026-11`. |
| `invites/{sha256(code)}` | `familyId`, `code`, `createdBy`, `createdAt`, `expiresAt`, `usedBy?`, `usedAt?`, `cancelledAt?` | Redemption is one document read, no query, no enumeration. The code is stored so a member can see an active invite again; the document is never returned to non-members. |
| `inviteAttempts/{sha256(uid)}` and `syncLimits/{sha256(uid)}` | window start, count | Same counter pattern and store as E14 (`firestore-limits.ts`): failed redemptions (10 per rolling hour) and a server-side write cap per account (DEFAULT 600 record writes per hour, 3 times the client guard, so a buggy client cannot run up cost). |

**Per record, not per area.** Contract 14.6 resolves conflicts per record; one document per record makes the winner rule a per-document compare, lets two devices editing different days never collide, and means a push writes only what changed. One document per area (all decisions in one) would turn every decision edit into a rewrite of up to 13 months of data and widen conflicts. Cost of the choice: more documents; at about 1 profile, 1 settings, 13 menus, 13 aiUsage and at most about 400 decisions/overrides for 13 months the family has well under 500 documents.

**Sizes.** A record is the JSON of one §3 record in `payloadJson` (a string field, so the Firestore value encoding is trivial and the payload is validated by the same zod schemas as the local store, not by rules). `maxRecordBytes` 256 KiB sits far below Firestore's 1 MiB document limit (F, quotas page). A month with 3 extractions is the largest record; I expect tens of KiB (unmeasured; slice A measures the largest fixture and reports it). `bytes` is stored so `totalBytes` on the family document is kept by delta inside the push transaction (limit 5 MiB, `paused-limit`).

**Change cursor.** A push is one transaction on the family document: read it, bump `seq` by 1, write every accepted record with that `seq`, update `totalBytes`. `pull(cursor)` returns records with `seq > cursor` (single-field index, automatic) and the new `seq`. Using a transaction-assigned counter, not timestamps, avoids missing a record committed out of timestamp order. Two parents pushing at the same instant serialise on one document; for two users that is irrelevant against Firestore's sustained single-document write rate (about 1 per second, from memory, unverified).

**Tombstones** are ordinary record documents with `deletedAt = updatedAt` and no `payloadJson`. They compete by the same winner rule. Purge after 90 days is **lazy**: each push also deletes up to 20 tombstones with `deletedAt` older than the retention (query on `deletedAt`, single-field index). No scheduler job (avoids a Cloud Scheduler dependency and cost that I cannot verify). A long-offline device is handled by the contract's reconcile rule on the client.

**Atomic membership steps** are Firestore transactions over `accounts`, `families`, `members` and `invites`: create family, redeem (checks: invite exists, not expired, not used, not cancelled, family not full, account has no `member` status, consent version; then adds the member, marks the invite used, writes the account index: all or nothing, first redemption wins). Failure replies are the generic/expired/full/already-in-family set of contract 14.3; wrong, used and cancelled return the same body and status.

**Delete family data**: transaction 1 sets `families/{id}.status = deleting`, deletes every member's `accounts` doc in favour of `ended/family-deleted` markers (the caller's stays `deleting` until done so a failed run can be retried), and deletes the active invite; so access is cut before the bulk work. Then `recursiveDelete` removes members and records, then the family document. The reply is `deleted` only after the recursive delete finished. Expected cost: a few hundred deletes, against 20,000 per day free (F).

**Leave / remove**: transaction removes the member document and flips that account's index to `ended/left` or `ended/removed`; the last member leaving takes the delete path. A device acknowledges the ended marker (`membership.ack`) after showing the message; creating or joining again also clears it.

**Size and write cost for two users (estimate, unverified against real use).** Writes: at most one per record per 10 s and at most 200 per device per hour; realistic use is a few dozen record writes per day, plus one family-document write per push; Firestore bills one write per document write, so far below 20,000 per day (F). Reads: a poll is 1 `accounts` read + 1 `families` read + the changed records, about 2 to 3 per idle poll; polling only while the app is visible (assume 4 hours a day per person: 240 polls each) is about 1,500 reads a day for both, against 50,000 (F). Storage: under 5 MiB per family against 1 GiB (F). Function requests: about 500 to 1,500 a day, about 15,000 to 45,000 a month against the Cloud Run request free tier of 2 million a month (F, ADR 015 §9; billing by request-based CPU is a few seconds a day).

## 2. Client access: Function versus rules

### 2.1 Recommendation: everything through the `sync` Function
- One new 2nd gen HTTPS function `sync` in the same codebase (not folded into `api`, which has the Gemini secret, a 120 s timeout and different scaling): Tokyo, memory 256 MiB, timeout 30 s, `maxInstances` 3, same allowed-origins parameter and the same `TokenVerifier` and origin policy as E14, no Gemini secret. Operations (JSON `POST /sync/v1/<op>`, `Authorization: Bearer <ID token>`): `membership.get`, `family.create`, `invite.create`, `invite.cancel`, `invite.redeem`, `consent.set`, `family.leave`, `family.removeMember`, `family.delete`, `membership.ack`, `records.push` (at most 50 records), `records.pull` (cursor, paged at 500). Every reply carries `serverNowMs` and the family `seq`.
- **Authorisation is one function** `authorize(uid, familyId)`: reads `accounts/{uid}` and requires `status=member` with that family (a removed member is denied on the next request, with no cache and no custom claim, which would stay valid for up to an hour). It runs first in every data operation. All identity comes from the verified token; no client field names a uid except `removeMember`, which checks the target belongs to the caller's own family.
- **Why not direct client access.**
  1. The ACs of US-E15-09 are about outcomes (members only, no escalation, shape, removal); each is met with the same strength by a server check, and the checks are plain TypeScript that the default vitest runs against a fake Firestore.
  2. The Firebase JS Firestore SDK (even the lite build) breaks the web budget (section 3.4) and adds a second connection path next to our own queue; offline persistence of the SDK would duplicate our local store.
  3. Rules language cannot validate JSON content, count rate limits, or do the multi-document atomic redemption; the Function would exist anyway for membership. Putting data access there too leaves one security layer to reason about and one place to test.
  4. The Firestore rules emulator needs Java, which is not on this machine (section 7).
  5. The existing deny-all rules, already deployed for E14, stay unchanged; no new rules deploy and no way for a rules typo to open data.
- **Costs accepted.** (a) A bug in `authorize` is a full leak because the Admin SDK bypasses rules; rules would be a second independent layer. Mitigation: one authorise gate, one test per operation that every data operation rejects a non-member and a removed member, and a static test that `firestore.rules` is deny-all. (b) Polling, not listeners; fine for the 60 s target (Q12). (c) A Function cold start of a second or two on a background sync; the UI never waits on it. (d) The wording of PLAN §7 "(security rules)" and US-E15-09/AC10 "emulator tests" is met in intent, not in mechanism: **needs a PO/BA decision** (section 10).

### 2.2 What `rules-*` of contract 14.13 become
| Id | Under the recommendation |
|----|---------------------------|
| `rules-auth-required` | Function returns 401 without a valid token; deny-all rules block any direct access |
| `rules-member-only`, `rules-no-cross-family`, `rules-members-equal`, `rules-removed-no-access` | `authorize` tests with `test-uid-001/002/003`, two families, removal between two requests |
| `rules-no-self-add` | No operation but `invite.redeem` adds a member; `consent.set` touches only the caller's own fields; `maxMembers` is read from config at creation and never from a request |
| `rules-invites-closed` | Invites are not returned by any operation to non-members; redemption is rate limited |
| `rules-write-shape` | `validateEnvelope` (pure, shared with the client): known kinds and keys, `updatedBy` set by the server from the token (a client value is ignored), family id from the account index (never from the request), no unknown fields, size limits |
| `rules-default-deny` | `firestore.rules` untouched; test asserts the file is exactly the deny-all and that the web build imports no Firestore |

### 2.3 Invite redemption
`invite.redeem {code, consentVersion}`: normalise (upper case, drop spaces and hyphens), count a failed attempt first against `inviteAttempts` (fail closed when the counter store errors), look up `invites/{sha256(code)}`, run the transaction of section 1. 10 characters from a 32-symbol alphabet (about 50 bits) plus 10 failed attempts per account per hour makes guessing impractical; the document id is a hash so no query can enumerate codes.

### 2.4 Fallback: direct client access under rules
If the PO wants it: members read and write `families/{f}/records/{r}` directly; membership documents are written only by the Function. Rules structure (deny by default, last block unchanged):
```
function isMember(f) { return request.auth != null && exists(/databases/$(database)/documents/families/$(f)/members/$(request.auth.uid)); }
match /families/{f} {
  allow read: if isMember(f);                 // no list across families: a collection query on /families is denied because the rule needs the id
  allow write: if false;                      // Function only
  match /members/{u} { allow read: if isMember(f);
    allow update: if request.auth.uid == u && isMember(f) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['consentVersion','consentedAt']);
    allow create, delete: if false; }
  match /records/{r} {
    allow read: if isMember(f);
    allow create, update: if isMember(f) && validShape(f);   // keys hasOnly(...), updatedBy == auth.uid, payloadJson.size() <= 262144, kind in [...]
    allow delete: if false; }                // deletion is a tombstone
}
match /accounts/{u}, /invites/{c}, /inviteAttempts/{x}, /syncLimits/{x} { allow read, write: if false; }
match /{document=**} { allow read, write: if false; }
```
Each `isMember` is a billed read per request. Consequences: Firestore SDK in the web build (section 3.4, budget ruling), seq cannot be assigned atomically without a transaction on the family document (which clients cannot write, so the cursor would have to be `updatedAt`-based with an overlap window), the server cannot clamp skew or enforce the family total, and the rules tests need Java. I do not recommend it.

## 3. Sync engine (pure domain, `src/domain/sync/`)
No DOM, no network, no clock, no timers (all injected). Modules, each unit-testable alone:

- `types.ts`: `RecordId = {kind, key}`, `Envelope`, `Membership`, `SyncStatus` (the nine values of contract 14.9), and `SyncPort`:
  `readMembership`, `createFamily(consent)`, `createInvite`, `cancelInvite`, `redeemInvite(code, consent)`, `setConsent`, `leave`, `removeMember(uid)`, `deleteFamily`, `ackMembershipEnd`, `push(envelopes) -> per-record {accepted | superseded(winner)}`, `pull(cursor) -> {envelopes, seq, serverNowMs}`, and optional `onHint(cb)` (a way for an adapter to say "pull now"; unused by the HTTP adapter, used by a listener adapter). Typed errors: `offline`, `temporary`, `unauthenticated`, `consent-required`, `limit`, `app-too-old`, `membership-ended(reason)`, `refused(kind)`. No Firebase type, no HTTP detail crosses it (ADR 014 pattern).
- `records.ts`: `extractRecords(store) -> Map<recordKey, {payload, ownUpdatedAt}>` (profile, settings without `language`/`theme`, menus, overrides, decisions, aiUsage per month; the device-only fields of contract 14.2 are never extracted), and `applyWinners(store, winners) -> store` (sets `ownerId` to the owner given, rebuilds maps, keeps device-only fields, language and theme, `deviceId`, `reminderLog`, `consent`). The result goes through the existing store validation (`validateStore`) before it is saved; dangling references follow the dormant/cleared rules of §3.6.
- `merge.ts`: `winner(a, b)` = greater `updatedAtMs`, then greater `deviceId` string, then the later received (`b` if received later); tombstones are ordinary. `clampUpdatedAt(updatedAt, receivedAt)` = receive time if more than 5 minutes ahead. `mergeAiUsage(a, b)` = larger count (client-side, convergent as shown: a merged value equal to the received winner is never re-pushed). Property tests: commutative, associative, idempotent over random permutations (`sync-merge-convergent`).
- `dirty.ts`: change detection without touching the store shape. The metadata keeps a **baseline** per record `{hash, updatedAt}` of what was last synced. After every local commit the engine hashes each extracted record (stable key order): a differing hash is dirty; its envelope `updatedAt` is the record's own `updatedAt` (or `now` for `aiUsage` and tombstones). A baseline key that is absent from the store is a deletion (tombstone, `updatedAt` = now). The queue is derived (baseline versus store) and survives restarts for free; `pendingCount` and `oldestPendingAt` come from it. Baselines are updated when a push is accepted or a remote record is applied, so applying a remote change never re-uploads it.
- `schedule.ts`: coalescing (a record is sent at most once per `writeCoalesceSeconds`, latest content), the hourly write guard (sliding 60-minute window of 200; at the cap the state is `paused-limit` and the queue keeps filling), and `nextDelay(attempt, random)` = min(5 s * 2^attempt, 300 s) with up to 20% jitter; manual retry resets it.
- `status.ts`: a pure reducer from facts (`membership`, `online`, `pending`, `consentOk`, `lastError`, `schemaOk`, `limitHit`) to exactly one of the nine states, with this precedence: `membership-ended`, `local-only`, `paused-no-consent`, `paused-app-too-old`, `paused-limit`, `pending-offline`, `retrying`, `syncing`, `synced`.
- `adoption.ts`: `hasData(store)`; `planFirstSync(localHasData, familyHasData)` -> `upload | download | ask`; `addDeviceData(local, familyRecords)` (family `profile` and `settings` win, missing month/date keys are added, keys both have keep the family's); `safetyCopy(store, now)` and its 30-day expiry.
- `engine.ts`: `createSyncEngine({ port, clock, timers, meta, store, random })` where `meta` is a small persistence port (section 4), `store` gives `current()` and `apply(fn)` (the UI wiring commits through the existing compare-and-swap path), `timers` is `setTimeout`-like and fakeable. It owns the loop: gate by consent, push dirty envelopes, pull, merge, apply, set baselines, note lost edits (AC8 once per loss), then schedule the next poll (60 s while visible and online, none while hidden, immediate on focus/online) or the back-off. `membership-ended` is handled by one function that rewrites `ownerId` to the uid, drops the family metadata and reports once.

**Clock skew.** The server clamps future stamps (5 minutes, contract 14.6) and returns the stored `updatedAt`; the client adopts a clamped value into the local record. A device clock that runs behind loses conflicts it should win; accepted for two people and recorded (revisit if it bites; an offset correction from `serverNowMs` is possible later without a contract change).

### 3.4 Budget (honest numbers)
Current JS total 414,107 bytes = about 404.4 KiB gzip against 420 KiB (the budget sums every file in `dist/assets`, lazy chunks included; ADR 014). I bundled the Firebase web Firestore entries with esbuild, minified, as a stand-alone chunk (M, `docs/dev/_scratch/e15/size.mjs`): **full `firebase/firestore` about 167 KiB gzip; `firebase/firestore/lite` about 44 KiB gzip** (the lite figure includes a share of app/component code that already sits in the existing chunks, so the real increment is lower, perhaps 30 to 40 KiB, unmeasured). Either exceeds the 15.6 KiB headroom.
- **Under the recommendation**: the HTTP adapter, the engine and the sync UI are about 6 to 10 KiB gzip (estimate; the engine is plain code, no dependency). 404.4 + about 8 stays under 420. No ruling needed; I will measure at the end of slice C and report.
- **Under the fallback**: needs a ruling. Options: split the budget into "entry chunk" (now about 357 KiB, keep at most 380) and "lazy chunks" (new ceiling 250), because the Firestore chunk loads only for a family member; or raise the total to 470. I would recommend the split.

## 4. Offline persistence and the local store
- The local store stays the only source the UI reads; the repository stays the cache and the offline copy unchanged (two-key backup, CAS on save). The cloud is never read by a screen.
- Sync **metadata** lives under a separate key `bentominder.<uid>.sync` (not the store, not exported, contract 14.2): `{familyId, membership, consent {version, at}, cursor, lastSyncedAt, baselines, adoption {familyId, choice, done}, safety {createdAt}}`. Written through the existing `Storage` port with its own small validator (`syncMetaSchema`, version field, unknown version = sync paused with `paused-app-too-old`, never destroyed). The safety copy is `bentominder.<uid>.safety` (raw store text), listed with the other keys so US-E10-04 delete-all removes meta, queue baselines and safety copy but not the cloud.
- **Remote apply path**: the engine calls `store.apply(fn)`; the UI implementation takes the latest store from `stateRef`, computes `applyWinners`, validates, `commit()`s through `repository.save` (so another tab's change is a `StoreConflictError`, reload, and the engine re-applies; merge is idempotent so repeating is harmless) and dispatches `store-changed`. Reassessment on a changed profile (US-E15-05/AC8) is already derived on read.
- **Repository change**: `RepositoryOptions` gets `allowedOwnerIds?: () => readonly string[]` (uid, plus the family id while a member). `ownerMismatches` is called with that list (contract 14.7). `meta-owner-matches-account` stays for the unbound call.
- **Listeners versus polling**: polling. Reasons: the 60 s target (Q12); no SDK; works the same on web and later Android; battery-friendly (no polling while hidden, immediate pull on focus). An idle poll is about 3 reads. A listener adapter is possible behind `onHint` if a seconds-level target is ever asked for.

## 5. Migration, ownerId, safety copy, export
- **No migration at rest.** Schema stays 1; nothing changes for non-members (US-E15-11/AC1, AC9).
- **Create.** After consent: `family.create`; save meta `{familyId, adoption: adopting}` first; rewrite `ownerId` uid -> family id in one `repository.save` (force, idempotent; the `.prev` backup of the repository covers the rewrite); push every extracted record with its existing `updatedAt` (envelope per record, batches of 50, `ownerId` is not part of the payload sent: the payload keeps `ownerId` = family id, which is not secret to members); mark adoption done. A crash at any step resumes at next open, and re-pushing the same envelope is a no-op by the winner rule (equal stamp and device, "later received" has no effect on identical content).
- **Join.** Redeem (with consent), pull all, `planFirstSync`: empty local -> `applyWinners` into a fresh store (keeps this device's `deviceId`, language, theme, `consent`, `reminderLog`); data on both sides -> ask once (default keep family); (a) and (b) write the safety copy first, then replace or add, then push only the added keys. The question is asked once per device and family (`adoption` in meta).
- **Leave, remove, delete.** `rewriteOwnerId(doc, uid)` (already exists) over the store, save, drop `familyId`, baselines and cursor, keep the safety copy until its own expiry, show the ended message once (`membership.ack`), status `local-only`. Never re-create a family on `membership-ended`.
- **Export/import.** Export is the store as is (it carries the family id as `ownerId` while a member: an opaque 128-bit value that grants nothing, because every request is authorised by membership; stated here so nobody is surprised). `importJson` rewrites `ownerId` to `ownerIds()[0]` (uid, or the family id while a member). While a member, import goes through the engine: stamp every imported record `updatedAt = now`, compute tombstones for baseline keys absent from the file (US-E15-11/AC6), warn first.
- **Old app versions** never write cloud data (they have no sync code); a cloud `schemaVersion` above the app's gives `paused-app-too-old`.

## 6. Consent
- **Record**: `members/{uid}.consentVersion/consentedAt` in the cloud (server time), cached in the device meta. `CLOUD_NOTICE_VERSION = 1` is a constant in the domain next to the notice keys.
- **Gate (defence in depth)**: (1) the engine cannot run `push` or `pull` of family data unless the cached consent is at least the app constant; the UI shows the notice before `family.create` and before `invite.redeem`, and both calls carry the accepted version; (2) the Function refuses `records.push/pull` with `consent-required` when the member's stored version is below `CLOUD_NOTICE_MIN_VERSION` (function parameter, default 1); (3) a test with a recording fake port proves zero data calls before consent, including a crash-and-resume between consent and first push (AC8 of US-E15-02). `family.create` and `invite.redeem` themselves carry no family data. Raising the notice version in the app sets `paused-no-consent` for that member until `consent.set`.
- The notice wording, contact address and legal review stay open product items (Q3, Q4); this ADR gives them a place (copy module keys by the designer) and nothing more.

## 7. Tests
**Java**: `java -version` on this machine: command not found (checked 2026-11-10); `firebase-tools` is also not installed (the repo has the web `firebase` SDK and `firebase-admin`/`firebase-functions` only). The Emulator Suite page (F, 2026-11-10) says Node 16+ and **Java JDK 11 or higher**; I recall newer `firebase-tools` versions requiring JDK 21, unverified: check at install time. Under the recommendation none of the required tests need it.

- **Engine tests (default vitest, `tests/unit/domain/sync/`)**: `FakeSyncPort` (in-memory family, scripted offline, slow, failing, conflicting and `membership-ended` replies, call log), fake clock, fake timers, fake `meta`. Fixtures from contract 14.12/14.15.
- **Function tests (`tests/unit/server/sync/`)**: an in-memory `FakeFirestore` implementing the narrow `DbLike` used (get, set, delete, transactions, `where seq >`, `recursiveDelete`, list-all-paths). Its fidelity is a stated risk, so it enforces the real rules that bite: reads before writes in a transaction, at most 500 writes, transaction re-run on contention (injected), document size limit. A listing of everything under a family id after delete returns empty (US-E15-08/AC11).
- **Optional emulator contract test (CI only)**: the same function suite re-run against the Firestore emulator when `FIRESTORE_EMULATOR_HOST` is set; skipped locally. GitHub's Linux runners ship a JDK (unverified; `actions/setup-java` otherwise). Nothing gates on it until it has run green once. This is also where a real-Firestore doubt (transaction semantics, index behaviour) would be caught before the first deploy; the manual smoke check of section 8 remains the final one.
- **Fallback if the PO chooses direct client access**: rules tests with `@firebase/rules-unit-testing` need the emulator and therefore Java on the developer machine (or CI only). If Java cannot be installed, rules would be reviewed by hand and tested only in CI; I would not accept that for allergy data, which is one more reason for the recommendation.

**AC to test table** (file, one test per AC, names carry the story and `AC` id as the trace gate needs):

| Story | ACs | Test file(s) | Notes |
|-------|-----|--------------|-------|
| US-E15-01 | AC3 AC4 AC5 AC6 AC8 | `domain/sync/create-family.test.ts` | with fake port: upload once, empty family, atomic, one per account, double tap |
| | AC1 AC2 AC7 | `ui/sync/family-setup.test.tsx` | sharing offered, consent first, offline |
| US-E15-02 | AC1 AC5 AC6 AC8 | `domain/sync/consent-gate.test.ts` | recording port: no data call before consent, per member, version bump pauses |
| | AC2 AC3 AC4 AC7 | `ui/sync/consent-notice.test.tsx`, copy test | items a to i in ja and en, unticked, readable later |
| US-E15-03 | AC2 AC3 AC4 AC5 AC6 AC7 | `server/sync/invites.test.ts` | expiry boundary, single use, one active, full, attempt limit, uniform failures |
| | AC1 AC8 AC9 | `ui/sync/invite.test.tsx` | |
| US-E15-04 | AC3 AC5 AC6 AC7 AC11 AC12 | `domain/sync/adoption.test.ts` | matrix of contract 14.4, interrupted join |
| | AC1 AC2 AC4 AC8 AC9 AC10 | `ui/sync/join.test.tsx`, `server/sync/invites.test.ts` | |
| US-E15-05 | AC1 AC3 AC4 AC5 AC6 | `domain/sync/new-device.test.ts` | `new-device-no-onboarding-before-family-known` |
| | AC2 AC7 AC8 AC9 | `domain/sync/engine.test.ts`, `ui/sync/status.test.tsx` | |
| US-E15-06 | AC1 AC2 AC3 AC5 AC10 | `domain/sync/engine.test.ts` | queue, offline, catch-up, back-off, account switch |
| | AC4 AC6 AC7 AC8 AC9 AC11 | `domain/sync/status.test.ts`, `ui/sync/status.test.tsx` | cloud data failing validation is quarantined, not applied |
| US-E15-07 | AC1 to AC7 AC10 to AC12 | `domain/sync/merge.test.ts` (+ property tests) | winner, tie-break, tombstones, 90-day boundary, skew, convergence, pruning |
| | AC8 AC9 | `domain/sync/lost-edit.test.ts`, docs check | |
| US-E15-08 | AC1 to AC6 AC10 AC11 | `server/sync/leave-remove-delete.test.ts`, `domain/sync/membership-ended.test.ts` | |
| | AC7 AC8 AC9 | `ui/sync/leave.test.tsx` | |
| US-E15-09 | AC1 to AC8 | `server/sync/authorize.test.ts` | one per AC against the fake Firestore with `test-uid-001/002/003` and two families |
| | AC9 AC10 | `server/sync/rules-static.test.ts` | `firestore.rules` is exactly deny-all; web build has no Firestore import. **AC10 wording needs a ruling** |
| US-E15-10 | AC1 AC2 AC3 AC4 | `domain/sync/schedule.test.ts`, `server/sync/limits.test.ts` | 30 edits in 10 s, 201st write, no full re-download |
| | AC5 AC6 AC7 AC8 | this ADR section 1, `server/sync/no-family-data-to-proxy.test.ts`, existing E14 tests | |
| US-E15-11 | AC1 to AC5 AC8 AC9 | `domain/sync/ownerid.test.ts`, `domain/storage/export-compat.test.ts` | |
| | AC6 AC7 | `ui/sync/import-in-family.test.tsx` | |
Slice A to E each own the files named for them; QA derives its own tests independently.

## 8. Deploy and operations for the PO (nothing is run by an agent)
1. Firebase project is already on Blaze with a budget alert (E14, section 13.7 of the contract); confirm the alert covers sync.
2. Deploy: `firebase deploy --only functions` (the new `sync` function; the `api` function is redeployed unchanged). `firestore.rules` do not change, so no rules deploy. **Indexes**: only single-field automatic indexes are needed (`seq`, `deletedAt`); `firestore.indexes.json` is referenced by `firebase.json` and must exist (empty indexes list) if it does not yet.
3. Function configuration: reuse `ALLOWED_ORIGINS`; new parameters with defaults in `functions/.env.example`: `MAX_MEMBERS` (2), `INVITE_TTL_HOURS` (72), `INVITE_FAILED_PER_HOUR` (10), `SYNC_WRITES_PER_HOUR` (600), `CLOUD_NOTICE_MIN_VERSION` (1). One secret reuse: the existing allow-list (section 10, item 2).
4. Repository variable for the web build: the existing `AI_PROXY_BASE_URL` is for the `api` function; add `SYNC_BASE_URL` (same pattern; empty = sync section hidden, the app stays local-only). Redeploy Pages.
5. Manual smoke on the real service with fixture data only: create family, invite, join from the second account, edit on one device and see it on the other within 60 s, remove, leave, delete; confirm in the console that nothing remains under the family path; confirm a third account is refused; check logs hold no record content (the function never logs payloads, to be tested).
6. Quotas (fetched 2026-11-10): Firestore free per day per project, one free database: 1 GiB stored, 50,000 reads, 20,000 writes, 20,000 deletes (cloud.google.com/firestore/pricing, quotas page: 1 MiB maximum document size). Cloud Run request-based billing free tier per month (based on us-central1 pricing): 180,000 vCPU-seconds, 360,000 GiB-seconds (cloud.google.com/run/pricing); 2 million requests a month is from ADR 015's earlier fetch and from memory, not re-read today. Unverified: the Tokyo region rate versus the quoted us-central1 free tier, the exact Firestore single-document write rate, Secret Manager and Artifact Registry free amounts (ADR 015 §9). Estimated use for two people sits one to two orders of magnitude under each figure.
7. Turn off: remove `SYNC_BASE_URL` (app returns to local only; data in the cloud stays) and delete the function; delete family data through the app first if the data should go.

## 9. Slices (each ends in green targeted tests and a short report)
- **A. Pure sync core + fakes** (no I/O). `src/domain/sync/` (types, records, merge, dirty, schedule, status, adoption), `FakeSyncPort`, fake clock/timers; `validateEnvelope` and the rules of contract 14.15 added to the validator. Done when: merge property tests (commutative, associative, idempotent), AC tests for US-E15-06/07/10 (domain parts) and 04/05 adoption matrix are green. Largest slice; measures the biggest record size.
- **B. Function: membership, invites, records** (`functions/src/sync/*`, `server/sync/` pure core on a `DbLike` port, `FakeFirestore`). Done when: `authorize` tests for US-E15-09 AC1 to AC9, invites AC (US-E15-03/04 server parts), leave/remove/delete including the completeness listing, push/pull with seq and clamping, and the static rules test are green. Depends only on the contract and the shared `validateEnvelope` from A (can start once that file exists, about the first day of A).
- **C. HTTP adapter + engine wiring.** `src/adapters/web/http-sync.ts` (same token supplier as the proxy, one refresh-retry, `SYNC_BASE_URL`), `SyncEngine` (`engine.ts`), `bentominder.<uid>.sync` meta, `useSync` in `AppProvider`, repository `allowedOwnerIds`. Done when: engine tests against `FakeSyncPort` and adapter tests against a fake `fetch` (every error kind) are green, an e2e with the in-process fake family converges two simulated devices, and the bundle total is measured. Needs A; needs B only for the shared contract types (can run on a recorded request/response schema).
- **D. UI.** Consent notice, family create/invite/join screens, join choice dialog, status line, lost-edit note, `membership-ended` message; strings from the designer's copy module (ja/en), `data-testid`s. Done when: component tests for US-E15-01/02/03/04/05/06 UI ACs and one Playwright journey (two simulated devices through the fake) are green. Needs C; the designer's specs are a prerequisite (flag to the Orchestrator).
- **E. Leave/remove/delete, migration and export/import compatibility.** UI and engine paths for US-E15-08 and US-E15-11, `ownerId` rewrite on leave, import into a family, safety-copy expiry and delete-all interplay. Done when: those AC tests plus the existing export/import regression suite are green. Needs C; UI part needs D's dialogs.
- **Order**: A first; B in parallel with A once `validateEnvelope` and the envelope types exist; C after A (B can still be finishing); D after C; E after C, with its UI half after D. Then one integration session: full `gate --stage dev`, manual smoke steps for the PO. QA after E (the whole feature), with a short scoped pass after B if the Orchestrator wants the security layer checked early (the highest-stakes part).

## Risks
- **Fake Firestore fidelity** (transactions, index and query semantics) is the largest technical risk under the recommendation. Mitigation: a fake that enforces real constraints, the optional emulator run in CI, and the manual smoke test before real data.
- **A bug in `authorize` bypasses rules.** One gate, one test per operation, review by QA/security before first real upload.
- **Data privacy**: allergy data of a child; consent wording and legal review (Q3) are unresolved; the operator can read stored data through the console. Do not upload real data before the wording is reviewed (the PLAN already says so).
- **Who may create a family** is not specified (section 10).
- **Whole-record last-edit-wins** loses the loser's extra content in one record; accepted (Q6). A device clock that runs behind loses more often.
- **Cold start and polling** delay a change by up to 60 s plus a second or two; matches Q12.
- **Hash-of-code is not salted**; a leaked database makes live invite codes guessable offline, but the same attacker already holds the data. Invites expire in 72 hours.
- **Estimates unmeasured**: record sizes, bundle increment, daily reads and writes; each is measured in the slice that builds it and reported against the guardrails in contract 14.10.

## 10. Needs a decision
1. **Access path (PO)**. Options: (A) all through the Function, rules stay deny-all (recommended: no Java, no SDK in the bundle, one security layer, tests in the normal run); (B) direct client access under rules (matches the wording of PLAN §7 and US-E15-09/AC10 literally; needs a bundle budget ruling, Java for rules tests, and the Function anyway for membership). If A: BA to reword US-E15-09/AC10 to "authorisation tests per AC against the fake store plus a static deny-all rules check; optional emulator run in CI". Recommendation: A.
2. **Who may create a family (PO)**. The contract is silent. Options: (A) only accounts on the existing AI allow-list (recommended: strangers cannot use free storage; the spouse joins by invite, so is covered; reuses the secret); (B) any signed-in account (simplest, relies on the login wall). Joining by a valid invite stays open to any signed-in account either way.
3. **Budget (only if option B of item 1)**: split the JS budget (entry about 380, lazy about 250) or raise the total to 470; recommend the split.
4. Carried from the BA list, unchanged defaults used: Q3 (consent wording review) and Q4 (contact address) before the first real upload; Q5 (name/e-mail kept in the member document) is implemented as described in section 1 and is easy to drop to uid-only.

## Revisit if
Two members stop being enough (rules of equality and the `maxMembers` field already allow more); a seconds-level freshness target is asked for (add a listener adapter behind `onHint`); the fake-Firestore suite disagrees with the emulator or the real service; real record sizes or daily operations approach the free quotas; Java becomes easy to install everywhere (then direct client access under rules deserves a second look); Android native sync needs a different adapter (the port holds).

## Addendum 2026-11-10 (slice B built; Orchestrator)
- Wire contract of the `sync` function: `docs/dev/_scratch/e15/slice-b-wire.md` (POST `/v1/<op>`; ops family.create, invite.create/cancel/redeem, consent.set, membership.get/ack, family.leave/removeMember/delete, records.push/pull).
- Server write guard default is 600 writes per account per hour (`SYNC_WRITES_PER_HOUR`, three times the client's 200), so a normal two-device account never trips it.
- A push batch is refused as a whole on one invalid record (`INVALID_RECORD` with its index); the client filters or retries per record. Live records beyond the 13-month retention are refused, their tombstones accepted.
- After `family.delete` the deleter's own account marker is removed (`membership.get` returns `none`); the other member sees `membership-ended(family-deleted)`; an unfinished delete reports `deleting` so the client can retry.
- Creating a family needs the allow-list; joining by invite is open to any signed-in account (the code is the secret).
- Extra stored fields: `memberCount` on the family, numeric `deletedAtMs` on tombstones, used invites keep a code-less document, member documents store the verified e-mail (Q5, easy to drop).
