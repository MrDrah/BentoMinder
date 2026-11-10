
---

## E15 Cloud sync and shared family space

PO decisions (`docs/PLAN.md` §7, 2026-11-10; Orchestrator defaults authoritative): the family data (children and allergies, menus, plans and decisions, settings) is stored online so any signed-in device shows the same data. The PO and the spouse, each with their own Google account, share **one family dataset** (a "family"). Firestore in Tokyo (`asia-northeast1`); the app stays offline-first; per-record last-edit-wins; invite-based joining; both members are equal; data readable and writable only by members; a one-time consent notice before the first upload; the first device uploads its existing local data; reminders are scheduled on each device from the synced settings; leave-family and delete-family-data exist in the app. The data model, rules and limits are in `docs/ba/data-contract.md` §14. This epic states behaviour only; the collection layout, listeners and function design are the developer's ADR.

**Out of scope / later (no ACs here):** deleting the Google/Firebase account itself (E13 "later"), more than two members, roles or read-only members, several children or several families per account, Sign in with Apple and email sign-in, sharing a recipe or menu with people outside the family (E9 stays as is), push notifications from the server, a server-side admin screen, syncing the debug panel (E11), real-time cursors or presence, backup history or "restore an older version" of the cloud data, Android-native sync specifics (same behaviour, adapter later).

**Notes (rules for all E15 stories)**
- N1 "Family" is the shared dataset and its member list; "member" is a signed-in Google account in that family; "local copy" is the account's on-device store (`bentominder.<uid>.state`, E13); "the cloud" is the family's stored data. Every AC applies to a signed-in account (E13 login wall unchanged).
- N2 Testability: the app reaches the cloud only through a `SyncPort` (data contract §14.12) with a fake adapter for unit, component and e2e tests, plus a fake clock and a fake network switch; no test calls Google or Firebase. Security-rule ACs (US-E15-09) run against the Firestore rules emulator, never the live project. Only a manual smoke check uses the real service.
- N3 Never blocked by sync: no sync state prevents reading, editing or exporting local data (BR-22, US-E10-01/AC3). Sync problems are shown calmly, in plain words, never with codes, uids or technical text.
- N4 No new product question is silently decided here: items marked DEFAULT are BA proposals the product owner may overturn (`docs/ba/_scratch/e15/open-questions.md`).
- N5 Fake identities for tests: `test-uid-001`, `test-uid-002` (data contract §12.5), a third `test-uid-003` for "not a member", family id `fam-test-001`, invite code `ABCD234567`. Devices: `device-A`, `device-B`.
- N6 Visible text is a working Japanese label; the designer supplies final ja/en copy. Tests assert on keys, roles or labels, except where an AC says "exact".

### US-E15-01 Create the family and upload this device's data · M · L
As a parent I want to turn on family sharing so that my data is kept online and my spouse can use the same calendar.

```gherkin
Scenario: AC1 Sharing is offered, never forced
  Given a signed-in account that is in no family
  Then the app works exactly as before (local only), and settings shows 「家族でデータを共有する」 with the choices 「家族をつくる」 and 「招待コードで参加する」
  And nothing is uploaded and no cloud request containing family data is made

Scenario: AC2 Creating needs the consent first (US-E15-02)
  When the parent taps 「家族をつくる」
  Then the consent notice of US-E15-02 is shown before anything is uploaded, and cancelling it leaves the app local only with no cloud change

Scenario: AC3 The first device uploads its existing data
  Given the consent was given and the local copy holds a profile, 2 confirmed menu months, 5 decisions and 1 override
  When the family is created
  Then a family with exactly this account as its only member exists, every local record is uploaded once, and the calendar shows the same data as before (nothing lost, nothing duplicated)
  And every uploaded record's ownerId is the new family id (data contract §14.2) and its timestamps are unchanged

Scenario: AC4 An empty local copy creates an empty family
  Given the local copy is empty (onboarding not started)
  When the family is created
  Then the family exists with no records and onboarding continues normally; the profile created later is uploaded by the normal sync (US-E15-06)

Scenario: AC5 Creation is all-or-visible
  Given the upload fails halfway (network lost)
  Then the local copy is untouched, the sync status shows the pending state (US-E15-06/AC2), the upload resumes when the network returns, and no record is uploaded twice
  And the invite action of US-E15-03 stays disabled until the first upload has finished

Scenario: AC6 One family per account
  Given the account is already in a family
  Then 「家族をつくる」 and 「招待コードで参加する」 are not offered; the screen shows the family instead (US-E15-03)

Scenario: AC7 Offline at creation
  Given no network
  When the parent taps 「家族をつくる」
  Then 「インターネットに接続してからお試しください」 is shown, no family exists, and the local copy is unchanged

Scenario: AC8 A second tap does not create a second family
  When the parent taps the confirm button twice quickly
  Then exactly one family is created and the button shows a busy state until it ends
```

### US-E15-02 Consent notice before any upload · M · M
As a parent I want to be told plainly what is stored online and who can see it so that I decide knowingly (APPI; allergy data of children is sensitive).

```gherkin
Scenario: AC1 Shown before the first upload or download of family data
  Given the account has not consented to the current notice version
  When the parent starts to create a family (US-E15-01) or to join one (US-E15-04)
  Then the notice is shown first, in the app language, and no family data leaves or enters the device until 「同意して進む」 is tapped

Scenario: AC2 Required content (exact items, wording is the designer's)
  Then the notice states: (a) what is stored: the child's profile and preferences, allergies and diet (health-related), the school menus read from the school's PDF, the family's plans and decisions, and settings; (b) why: so signed-in devices and the other family member show the same data; (c) where: Google Firebase (Firestore) in Tokyo, Japan; (d) who can see it: only the members of this family, and nothing is shown to other users or sold or used for advertising; (e) that the service operator can technically reach stored data through the hosting console (DEFAULT wording, Q3) and does not use it; (f) the AI menu reading is a separate consent (US-E2-08) and does not send family data; (g) how to stop: leave the family or delete the family's data in settings (US-E15-08); (h) who to ask: a contact line (DEFAULT: the product owner's contact, Q4); (i) that the person consenting is a parent or guardian of the child
  And the notice carries a version number (data contract §14.5)

Scenario: AC3 Both languages
  Then the notice exists in Japanese and English with the same items (BR-23), uses no legal claim such as "complies with APPI", and contains no code, uid or technical text

Scenario: AC4 Not pre-ticked, not bundled
  Then consent is an explicit tap on a button that is not the default focus target; declining is equally easy (「やめる」) and has no penalty: the app continues local only

Scenario: AC5 Consent is recorded per member
  Given the parent consents
  Then the member record stores the notice version and the time (data contract §14.5) and the local copy remembers it; the other member's consent is separate and is asked on their own device

Scenario: AC6 A new notice version asks again
  Given a member consented to version 1 and the app now carries version 2
  Then on the next open the notice is shown, sync is paused for that member with the status 「確認が必要です」 until they accept (local use continues), and declining leaves the member in the family with sync paused (leaving is their choice, US-E15-08)

Scenario: AC7 Consent is readable later
  Then settings shows the notice again at any time, the date the parent consented, and the way to leave

Scenario: AC8 No upload before consent, provable
  Given no consent
  Then a test with a fake SyncPort records 0 writes and 0 reads of family data
```

### US-E15-03 Invite the spouse · M · M
As a parent in a family I want to invite my spouse with a code or link so that only the person I choose can join.

```gherkin
Scenario: AC1 Create an invite
  Given the account is a member and the first upload has finished
  When the parent taps 「招待する」
  Then an invite code of 10 characters (data contract §14.3) and a link that contains it are shown with 「コピー」, and the screen says when it expires

Scenario: AC2 Expiry
  Given an invite created at 2026-11-10T10:00+09:00 (expiry 72 hours, DEFAULT)
  When someone redeems it at 2026-11-13T10:00:01+09:00
  Then it is refused as expired and no member is added; at 2026-11-13T09:59:59+09:00 it still works

Scenario: AC3 Single use
  Given an invite that was redeemed successfully
  When a second account tries the same code
  Then it is refused as already used and no member is added

Scenario: AC4 One active invite
  Given an active invite
  When the member creates a new one, or taps 「招待を取り消す」
  Then the earlier code stops working at once and the screen shows at most one active invite

Scenario: AC5 Family is full
  Given the family already has the maximum number of members (2, DEFAULT)
  Then 「招待する」 is disabled with 「メンバーは上限です」 and any outstanding code is refused

Scenario: AC6 Guessing is not practical
  Then the code uses only characters that cannot be confused (no 0/O, 1/I/L), is generated unpredictably, and an account that enters 10 wrong or expired codes within an hour is refused further tries for that hour with 「しばらくしてからお試しください」 (data contract §14.3)

Scenario: AC7 Invites never reveal the family
  Given a code that is wrong, expired, used or cancelled
  Then the refusal text is the same generic text for every cause except "expired" and "family is full", and it shows no family, member or child information

Scenario: AC8 The inviter sees the outcome
  Given an invite was redeemed
  Then the inviting member's screen lists the new member (display name or e-mail as sent by sign-in, shown only to members) and the invite is gone

Scenario: AC9 Invite offline
  Given no network
  Then 「招待する」 is disabled with 「インターネットに接続してください」 and no code is shown
```

### US-E15-04 Join a family with a code · M · L
As the spouse I want to join with the code so that I see the same data with my own Google account.

```gherkin
Scenario: AC1 Link needs sign-in first
  Given the joiner opens the invite link while signed out
  Then the login screen is shown (US-E13-01), and after sign-in the join screen opens with the code filled in (deep link kept, US-E13-01/AC2)

Scenario: AC2 Code entry
  When the joiner types a valid code in any letter case, with or without spaces or hyphens
  Then it is accepted after the consent notice (US-E15-02) and 「参加する」 is confirmed

Scenario: AC3 Joining with an empty local copy
  Given the joiner's local copy is empty
  When the join completes
  Then the device downloads the family data and opens the calendar (not onboarding) showing the same profile, menus, decisions, overrides and settings as the other member

Scenario: AC4 Joining with local data asks first (DEFAULT keep-family)
  Given the joiner's local copy has data and the family also has data
  When the join is confirmed
  Then the app asks 「この端末のデータをどうしますか」 with the choices 「家族のデータを使う」 (preselected) and 「この端末のデータを足す」, before anything is changed

Scenario: AC5 Keep the family's data
  When the joiner chooses 「家族のデータを使う」
  Then the local copy is replaced by the family's data, the previous local copy is kept on the device as a safety copy (data contract §14.4) and can be exported, and nothing from it is uploaded

Scenario: AC6 Add this device's data
  Given the family has a profile and the joiner's local copy has menus for 2026-12 and a decision for 2026-12-03 that the family does not have, and a different profile
  When the joiner chooses 「この端末のデータを足す」
  Then the family's profile and settings stay; menu months, decisions and overrides whose keys the family lacks are added to the family; for a key both have, the family's record stays (no overwrite); the safety copy is also kept (AC5)

Scenario: AC7 Joiner's local copy is non-empty, family is empty
  Given the family has no records (created empty, US-E15-01/AC4)
  Then no question is asked: the joiner's local data is uploaded as in US-E15-01/AC3 after consent

Scenario: AC8 Cancel changes nothing
  When the joiner cancels at the consent, the join confirmation or the question of AC4
  Then no member is added, nothing is uploaded or replaced, and the local copy is unchanged

Scenario: AC9 Already in a family
  Given the joiner's account is a member of another family
  Then the join is refused with 「すでに別の家族に参加しています。先に家族を抜けてください」 and nothing changes (one family per account, data contract §14.3)

Scenario: AC10 Refused codes
  Given an expired, used, cancelled, wrong or full-family code
  Then the generic refusals of US-E15-03/AC5 and AC7 are shown and nothing changes

Scenario: AC11 Interrupted join
  Given the app is closed or the network is lost between "member added" and "download finished"
  Then at the next open the join continues (download, then the question of AC4 if it was not yet answered) and never leaves the account a member with no way to finish

Scenario: AC12 Equal members
  Then after joining the new member can do everything the creator can: edit any data, invite (when room), leave, and delete the family data (US-E15-08), and nothing in the UI marks one member as the owner
```

### US-E15-05 Same data on every device; first sign-in on a new device · M · M
As a parent I want to sign in on a new phone or browser and see the family calendar so that nothing is set up twice.

```gherkin
Scenario: AC1 New device, member account
  Given the account is a family member and the device has no local copy for it
  When the parent signs in
  Then a loading state is shown while the membership and data are read, and then the calendar is shown with the family data (never onboarding, never an empty calendar flash)

Scenario: AC2 Consent on the new device
  Given the member consented on another device (version current)
  Then no second consent is asked for the same version; a new device of the same member only shows the notice if its version is not recorded (US-E15-02/AC6)

Scenario: AC3 Membership cannot be read yet
  Given a device with no local copy and the membership or data read fails or takes more than 15 seconds
  Then onboarding is not shown; a screen with 「家族のデータを読み込めませんでした」 and 「もう一度試す」 is shown, and the device never creates a local-only profile that could clash

Scenario: AC4 Device with a local copy proceeds
  Given a device with a local copy and no network or a failed read
  Then the app opens from the local copy at once (offline-first) and the membership check and sync run in the background (US-E15-06)

Scenario: AC5 A second device of an account that is not yet in a family
  Given the account is in no family and the device has its own old local data
  Then nothing changes: the app is local only until the parent chooses to create or join (US-E15-01/AC1)

Scenario: AC6 A second device of a member with different local data
  Given the account is a member and this device has its own local data from before (for example the unkeyed legacy store was adopted by another account, E13)
  Then the question of US-E15-04/AC4 (keep family / add this device's data) is asked once on first sync of this device, with the same outcomes as US-E15-04/AC5 and AC6

Scenario: AC7 Changes appear on the other device
  Given devices A and B signed in to the same family and online
  When A confirms a menu month, plans a bento on 2026-11-18 and changes the weekly reminder time
  Then B shows those changes without a manual reload within 60 seconds of both being online (DEFAULT, Q12), and B's reminder schedule is re-planned from the new setting (US-E7)

Scenario: AC8 A remote change to the allergy profile re-assesses plans
  Given B receives a changed profile (a new allergy)
  Then every assessment on B is recomputed on read from the new profile (BR-06, BR-10), dates whose result changed show as needing review as for a local profile change (E4), and nothing keeps an old "safe" result

Scenario: AC9 Sign out on one device does not touch the family
  When the parent signs out on device A (E13)
  Then the family data and the other devices are unchanged, and device A keeps its local copy under the account's keys as in E13
```

### US-E15-06 Offline-first sync and visible status · M · L
As a parent I want the app to keep working without a connection and to catch up by itself so that I never wait for the network.

```gherkin
Scenario: AC1 Edits are local first
  Given the account is a family member
  When the parent saves any change (profile, decision, override, menu confirmation, setting)
  Then it is saved to the local copy immediately and the screen never waits for the cloud

Scenario: AC2 Offline queue
  Given no network and the parent makes 3 edits to 2 different records and 2 edits to the same record
  Then the status shows 「オフライン・未送信の変更があります」, the queue holds the latest version of each changed record (3 records, not 5 edits), and the queue survives closing and reopening the app

Scenario: AC3 Catch-up when online
  Given a queue of pending records
  When the network returns
  Then they are sent without parent action, the status shows 「同期中」 and then 「同期済み」 with the time, and records changed remotely meanwhile are applied by the rules of US-E15-07

Scenario: AC4 Status states
  Then the sync status is exactly one of: local-only (not in a family), synced, syncing, pending-offline, retrying, paused-no-consent, paused-limit, paused-app-too-old, membership-ended (data contract §14.9), each with its own plain-language text and icon-plus-text (never colour alone), reachable from settings and as a small indicator in the app bar

Scenario: AC5 Errors retry calmly
  Given a send fails with a temporary error
  Then the status is retrying, retries back off (data contract §14.10), no error dialog interrupts the parent, and after 5 minutes of failure the indicator also offers 「今すぐ再試行」

Scenario: AC6 Last synced time
  Then the status screen shows the time of the last successful sync in the app language and the number of pending changes; with pending changes older than 24 hours the indicator is highlighted so that a stale phone is noticed

Scenario: AC7 Nothing blocks use
  Given any status other than synced
  Then every screen, export and delete-all of E10 still works on the local copy (N3)

Scenario: AC8 A cloud copy from a newer app
  Given the cloud data's schemaVersion is greater than the app's
  Then sync pauses with paused-app-too-old and 「アプリを更新してください」, the local copy is neither changed nor uploaded, and local use continues (BR-22, US-E10-02/AC3)

Scenario: AC9 Cloud data that fails validation
  Given a downloaded record fails the data contract validation (data contract §6)
  Then that record is ignored (not stored, not forwarded), the local copy keeps its own version, a single non-blocking note 「一部のデータを読み込めませんでした」 is shown once, and no other record is affected (BR-03)

Scenario: AC10 Sync follows the account
  Given the account signs out (E13)
  Then listening and sending stop, the queue stays in the account's local keys, and nothing is sent under another account when a different account signs in

Scenario: AC11 Reminders stay on the device
  Given the family settings change on device B
  Then device A re-plans its own reminders from the synced weekly/day-before settings; the reminder log, shown/dismissed state and scheduled notifications are never synced (data contract §14.2)
```

### US-E15-07 Conflicts: last edit wins, deletes are tombstones · M · L
As two parents editing the same plans I want the later edit to win and deletions to stay deleted so that the family sees one consistent calendar.

```gherkin
Scenario: AC1 The later updatedAt wins, per record
  Given record "decision 2026-11-18" was changed by A at 10:00:00 and by B at 10:00:05 while both were offline
  When both sync
  Then both devices end with B's version of that record, and records they changed that differ are each decided on their own

Scenario: AC2 Tie-break is deterministic
  Given two versions of a record with the same updatedAt
  Then the one with the greater deviceId (plain string order) wins on every device (data contract §14.6)

Scenario: AC3 Different records never overwrite each other
  Given A edits the weekly reminder time and B edits the decision of 2026-11-18 while offline
  Then after sync both changes exist everywhere

Scenario: AC4 Deleting is a tombstone
  When a parent clears a plan (CLEAR_PLAN, E5), removes an override, or removes the profile
  Then the record is replaced by a tombstone (deletedAt, updatedAt, deviceId) that syncs, and the other device removes the record on sync; a record created by another device before the delete is not deleted by it

Scenario: AC5 A newer edit beats an older tombstone and the reverse
  Given a tombstone with updatedAt 10:00:00 and an edit of the same record made later (10:00:30) on a device that was offline
  Then the edit wins and the record exists again everywhere; with the times swapped the delete wins

Scenario: AC6 Tombstone retention and the long-offline device
  Given tombstones are kept 90 days (DEFAULT) and then purged
  When a device offline for more than 90 days reconnects
  Then records on it that were unchanged since its last sync and are missing from the cloud are removed locally (not resurrected), and records it changed after its last sync are sent; a fake-clock test covers the boundary day (day 90 and day 91)

Scenario: AC7 Clock skew
  Given a device clock more than 5 minutes ahead of the cloud's time
  Then its records are accepted with updatedAt clamped to the cloud's receive time, so one wrong clock cannot win every future conflict (data contract §14.6)

Scenario: AC8 The overwritten parent is told once
  Given a local pending edit lost to a newer remote edit (AC1)
  Then a single non-blocking note names the kind and date (for example 「11月18日の予定が、家族の変更で更新されました」), and a Show action opens that date

Scenario: AC9 Whole-record granularity is documented
  Given A adds an extraction to menu month 2026-12 and B confirms a different extraction of the same month at a later time
  Then the whole month record follows AC1 (B's), which can drop A's extra extraction; this is the accepted limit of per-record last-edit-wins (Q6) and the stored month still passes the contract (extraction-resolves)

Scenario: AC10 The merged result is always valid
  Given any sequence of A and B edits and syncs
  Then each device's local copy passes the data contract validation (BR-03) after every apply, and decisions never reference a recipe or extraction that no longer resolves; a dangling reference is repaired by treating the dependent record as dormant/cleared as the contract already defines (data contract §3.6) and never crashes

Scenario: AC11 Convergence
  Given a fixed set of edits delivered in any order and any number of times
  Then every device ends in the same state (idempotent, order-independent merge), covered by a property-style unit test over shuffled orders

Scenario: AC12 Retention pruning is a delete
  Given the 13-month retention (data contract §7) removes a month on one device
  Then it follows AC4, and a device never resurrects a record the retention rule removed
```

### US-E15-08 Leave the family, remove a member, delete the family's data · M · L
As a parent I want to stop sharing, remove someone, or erase the family's online data so that I stay in control of my children's data.

```gherkin
Scenario: AC1 Leave with confirmation
  Given a member of a family with two members
  When the parent taps 「家族を抜ける」 and confirms 「抜ける」
  Then the account is no longer a member, the other member and the family data stay, and the confirmation text says that the other member keeps the data

Scenario: AC2 What the leaver keeps
  When the leave completes
  Then the leaver's device keeps its local copy as a stand-alone local-only store (ownerId rewritten to the uid, data contract §14.7), sync stops, nothing is deleted from the device, and the status becomes local-only

Scenario: AC3 Remove the other member
  When a member taps 「メンバーを外す」 next to the other member and confirms
  Then the other account loses access at once; on its next open or sync its device shows 「家族から外されました」, keeps its local copy as stand-alone local-only (as AC2) and cannot read or write family data any more (US-E15-09)

Scenario: AC4 The last member leaving deletes the family
  Given a family with one member
  When that member taps 「家族を抜ける」
  Then the dialog says the family's online data will be deleted and requires the confirmation of AC5; confirming deletes it (AC6) and keeps the local copy (AC2)

Scenario: AC5 Delete the family's data
  Given a member of a family
  When the parent taps 「家族のオンラインデータを削除」 and types the confirmation 「削除する」
  Then every family record, tombstone, invite and membership is deleted from the cloud, no other trace of the family's content remains there, and the confirmation says every member loses sharing and every device keeps its own local copy

Scenario: AC6 Deletion reaches every device
  Given the family's data was deleted by member A
  When member B's device syncs or opens
  Then B is told 「家族のデータが削除されました」, B's local copy is kept as stand-alone local-only, and nothing is re-uploaded to a family that no longer exists

Scenario: AC7 Deleting online data does not delete the account or the local copy
  Then Google sign-in and every local copy stay; 「すべてのデータを削除」 of E10-04 remains a separate action that only removes local keys (and while in a family it first says that the online data stays until 「家族のオンラインデータを削除」 is used)

Scenario: AC8 Cancel changes nothing
  When the parent cancels any dialog of this story
  Then membership, cloud data and local data are unchanged

Scenario: AC9 Offline
  Given no network
  Then leave, remove and delete are disabled with 「インターネットに接続してください」 and nothing is queued (these actions are never applied later by surprise)

Scenario: AC10 After leaving, the account can create or join again
  Then the choices of US-E15-01/AC1 are offered again, and a previously used invite code is still refused (US-E15-03/AC3)

Scenario: AC11 Deletion completeness is testable
  Given the fake SyncPort (and, for the rules, the emulator)
  When AC5 completes
  Then a listing of everything stored for that family id returns nothing, and a member who was removed cannot read the former family's data
```

### US-E15-09 Security rules: members only · M · L
As the product owner I want the online data readable and writable only by the family's members so that no other user, and no tampering client, can see or change a child's data.

```gherkin
Scenario: AC1 Not signed in
  Given a request with no sign-in
  Then every read and write of family data is denied

Scenario: AC2 Not a member
  Given a signed-in account `test-uid-003` that is not a member of family `fam-test-001`
  Then it can neither read nor write any record, tombstone, member list or invite of that family, and listing families returns nothing for it

Scenario: AC3 No cross-family access
  Given members of family fam-test-001 and of another family
  Then each can read and write only their own family's data

Scenario: AC4 Members have equal access
  Given `test-uid-001` and `test-uid-002` are members of fam-test-001
  Then both can read all records and create, update and delete (tombstone) records, and neither has a right the other lacks

Scenario: AC5 Membership cannot be escalated by a client
  Given any signed-in client
  Then it cannot add itself or any account to a family by writing the member list directly, cannot change another account's membership record, cannot raise the member maximum, and a member can only change their own consent fields (version, time) in the member list; adding a member is possible only by redeeming a valid invite (US-E15-03, US-E15-04)

Scenario: AC6 Invites cannot be read or enumerated
  Then a non-member cannot read, list or guess-check invites by any path other than the redemption of one code, and the rate limit of US-E15-03/AC6 applies to redemption

Scenario: AC7 Writes must be well formed
  Given a member writes a record
  Then it is denied unless: the record's family id equals the family it is written to, `updatedBy` equals the signed-in uid, the kind and key are of an allowed kind, required metadata is present and of the right type, unknown fields are absent, and the size is within the limits of data contract §14.10

Scenario: AC8 Removed means no access
  Given a member was removed or left
  Then within the next request they are denied everything of that family, including reads from an open listener

Scenario: AC9 Existing deny-all data stays deny-all
  Then the proxy's counters stay unreachable from any client (E14), and the new rules do not open any other path ("deny by default")

Scenario: AC10 Rules are tested
  Then the rules are covered by emulator tests (one per AC above), run in the default or an opt-in test command documented in the ADR, and a rules file that fails them blocks the release gate
```

### US-E15-10 Limits, cost guardrails and the hosted AI proxy · S · M
As the product owner I want sync to stay inside the free usage for two users and not to disturb the AI proxy so that it costs nothing and nothing else breaks.

```gherkin
Scenario: AC1 Size limits
  Then a single synced record is at most 256 KiB of JSON and a family's total stored records at most 5 MiB (data contract §14.10); a write that would exceed a limit is refused locally with 「データが大きすぎます」 on the status screen, the local copy keeps working, and the status is paused-limit

Scenario: AC2 Write coalescing
  Given the parent edits the same record 30 times within 10 seconds
  Then at most one write of that record is sent in that period (data contract §14.10)

Scenario: AC3 Runaway guard
  Given a device attempts more than 200 cloud writes within an hour (DEFAULT)
  Then it stops sending, shows paused-limit, keeps queueing locally, and resumes in the next hour without data loss

Scenario: AC4 No needless reads
  Then an idle, online app on an unchanged family does not re-download the full dataset (only changed records after the first sync), and a reopened app reads only what changed since its last sync

Scenario: AC5 Expected usage is stated
  Then the ADR records the expected daily reads, writes and stored size for two users against the current free quotas (checked against Google's pricing page by the developer) and the existing budget alert of data contract §13.7 covers the project; the BA does not quote quota numbers here

Scenario: AC6 The AI proxy does not need a family
  Given a signed-in account that is in no family and is on the proxy allow-list
  Then menu extraction through the hosted proxy works as in E14, and a family member who is not on the allow-list is still denied (NOT_ALLOWED); family membership never grants proxy access

Scenario: AC7 The proxy receives no family data
  Then no sync request is sent to the proxy and no proxy request contains family data beyond the menu PDF or URL the parent chose (E14, US-E14-06)

Scenario: AC8 An already extracted PDF is not extracted twice
  Given member A imported a PDF and the extraction synced
  When member B imports the same file
  Then B's app finds the same sha256 in the family's synced extractions and makes 0 provider calls (US-E2-07)
```

### US-E15-11 Migration from the local store and backward-compatible export · M · M
As a parent with data on my phone today I want sharing to switch on without losing anything, and my export files to keep working.

```gherkin
Scenario: AC1 No change until sharing is turned on
  Given an account with a local copy (`bentominder.<uid>.state`, E13)
  When the updated app first runs
  Then the local copy is read as before, schemaVersion stays 1 and no migration, upload or key rename happens (data contract §14.11)

Scenario: AC2 The local key stays the offline copy
  Given the account is a family member
  Then the local copy is still stored under `bentominder.<uid>.state` and its backup `.state.prev`, sync metadata is kept separately (data contract §14.2), and a device with the previous app version (which does not know about sync) still reads the local copy

Scenario: AC3 ownerId follows membership
  When the family is created or joined, every record's ownerId becomes the family id; when the account leaves or is removed it becomes the uid again; the rule `meta-owner-matches-account` accepts the account's uid or its current family id and no other value (data contract §14.7)

Scenario: AC4 Export is unchanged
  Given a member exports (E10-03)
  Then the file is the BentoMinderStore as in US-E10-03/AC4, with no tombstones, no sync metadata, no member list and no invite, and it validates as today (export-roundtrip)

Scenario: AC5 Old exports still import
  Given an export file made before sync existed (ownerId `local` or a uid, schemaVersion 1)
  When it is imported by an account that is in no family
  Then it behaves as US-E10-03/AC3 and AC7 do today

Scenario: AC6 Import into a family replaces the family's data, after a clear warning
  Given the account is a family member
  When the parent chooses 「データを読み込む」 and the file is valid
  Then the dialog says in plain words that the data of all family members will be replaced; on confirmation the records are written with ownerId = the family id and updatedAt = now, records not in the file become tombstones, and both devices show the imported data after syncing; cancelling changes nothing, and an invalid or too-new file changes nothing (US-E10-03/AC5, AC6)

Scenario: AC7 Local "delete all" while in a family
  Given a member taps 「すべてのデータを削除」 (US-E10-04)
  Then the local keys are removed as today, the dialog first says the online data stays, and on the next sign-in the device downloads the family data again (US-E15-05/AC1) rather than sending an empty store as deletions

Scenario: AC8 The device id stays private to the family
  Then `deviceId` is used only as the tie-breaker and `updatedBy` of synced records inside the family; it is never exported, never sent to the proxy, and is not shown outside the family (data contract §3.1, §14.2)

Scenario: AC9 The store shape does not change
  Then no field is added to BentoMinderStore, schemaVersion stays 1, and the existing unit tests of E10 pass unchanged
```
