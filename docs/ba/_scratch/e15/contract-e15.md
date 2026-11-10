
---

## 14. Cloud sync and shared family space (v1, 2026-11-10; stories E15)
PO decisions in `docs/PLAN.md` §7 (2026-11-10). Describes what is stored online, who may see it and how copies are reconciled. It does not fix the collection layout, listeners or function design (developer's ADR). Items marked DEFAULT are BA proposals the product owner may overturn (`docs/ba/_scratch/e15/open-questions.md`). This section closes §12.6 and §7 ("tombstones and `updatedBy` are added with the v1 sync contract").

**14.1 Definitions.** *Family*: one shared dataset plus its member list. *Member*: a Firebase `uid` listed in one family. *Local copy*: the account's `BentoMinderStore` under `bentominder.<uid>.state` (§12.2), still the offline copy and the source for the UI. *Cloud*: Firestore, region `asia-northeast1` (Tokyo). *Sync record*: the cloud form of one synced record (14.2). An account is in **at most one** family at a time (rule `family-one-per-account`).

**14.2 What is synced and what is not.**
| Data | Synced? | Sync record granularity | Notes |
|------|---------|-------------------------|-------|
| `profile` (ChildProfile, incl. allergies, diet, likes) | yes | one record (`profile`); removal = tombstone | MVP: at most one child, unchanged |
| `menus` (MenuMonth incl. extractions and confirmed menu) | yes | one record per `YYYY-MM` | whole-month last-edit-wins (US-E15-07/AC9) |
| `overrides` (AssessmentOverride) | yes | one record per `YYYY-MM-DD` | |
| `decisions` (DayDecision incl. history) | yes | one record per `YYYY-MM-DD` | |
| `settings` (§3.9) except the two device fields below | yes | one record (`settings`) | reminder weekday/times/enabled, `nextMonthPromptFromDay`, `weekStartsOn` are synced |
| `settings.language`, `settings.theme` | **no** (per person) DEFAULT, Q2 | stay in the local copy | each parent keeps their own language and theme |
| `aiUsage` | yes | one record per `YYYY-MM`; merged by the larger count | family-wide AI use count; the proxy's own limits (§13) are unaffected |
| `reminderLog` | no | | per device; scheduled notifications and shown/dismissed state never leave the device (US-E15-06/AC11) |
| `consent` (AI notice, §3.1) | no | | per person (US-E2-08 stays per local copy); the cloud-sharing consent is separate (14.5) |
| `nextMonthCardHiddenOn` | no | | per device UI state |
| `deviceId` | tie-break and `updatedBy` metadata only (14.6) | | never exported, never sent to the proxy |
| `schemaVersion` | family-level field, equal to the writer's store version | | |

**Sync record envelope** (cloud only; never in the local store, never in an export): `kind` (`profile` \| `menu` \| `override` \| `decision` \| `settings` \| `aiUsage`), `key` (`YYYY-MM`, `YYYY-MM-DD` or the kind name), `payload` (the record exactly as in §3, validated by the same rules; absent for a tombstone), `updatedAt` (timestamp, §2), `updatedBy` (uid of the member who made the edit), `deviceId`, `deletedAt` (timestamp or absent: present = tombstone). Rules: `sync-envelope-shape` (known fields only, kinds and keys as listed); `sync-payload-valid` (payload passes the §3 rule for its kind); `sync-key-matches-payload` (key equals `payload.month`/`.date`); `sync-tombstone-no-payload`.

**Device-side sync metadata** (kept apart from the store; not exported): the family id and membership status for the account, the pending queue (latest version per record), the time of last successful sync, per-record last-synced `updatedAt`, the pre-join safety copy (14.4), cached consent version. Removed with the account's local copy by US-E10-04 only for the queue and safety copy; a family id is dropped on leave (14.7).

**14.3 Membership and invites.**
| Item | Rule |
|------|------|
| Family id | opaque, unguessable (at least 128 bits of randomness), generated at creation; the only value that goes into `ownerId` (§2, 14.7); never derived from the uid, never shown in the UI |
| Members | list of `{ uid, joinedAt, consentVersion, consentedAt }`; at most **2** (DEFAULT, Q1; a configuration value, not code); both equal: either may edit every record, invite, remove the other and delete the family |
| Display of a member | name or e-mail as sent by sign-in, shown only to members of the family, never stored in the store or in an export (§12.4); whether the member list in the cloud holds it is the developer's decision; Q5 |
| Creating | the account becomes the first member; allowed only when it is in no family (`family-one-per-account`) |
| Invite | one active invite per family: `{ code, createdBy, createdAt, expiresAt, usedBy?, usedAt?, cancelledAt? }` |
| Code | 10 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 symbols, about 50 bits), unpredictable, case-insensitive on entry, spaces and hyphens ignored; the link carries the code (`…/#/join/<code>`) |
| Expiry | 72 hours after `createdAt` (DEFAULT, Q7); expired exactly at `expiresAt` (inclusive of the last second before) |
| Single use | redeemed once; the first redemption wins; later attempts are refused |
| Redeeming | requires sign-in, consent (14.5), account in no family, a free place; on success the redeemer is added and the invite is marked used, as one all-or-nothing step |
| Failure replies | generic for wrong / used / cancelled; distinct only for `expired` and `family-full`; `already-in-family` is shown to the redeemer only; none reveals a family, member or child |
| Attempt limit | 10 failed redemptions per account per rolling hour (DEFAULT); then refused for the rest of the hour |
| Re-invite | a new invite or a cancel invalidates the previous code at once |

**14.4 First sync and adoption of local data.**
| Situation | Outcome |
|-----------|---------|
| Create family, local copy has data | after consent, every synced record is uploaded once (timestamps unchanged, `ownerId` := family id); local copy remains the working copy |
| Create family, local copy empty | empty family; later edits sync normally |
| Join, local copy empty | download family data, no question, no onboarding |
| Join (or first sync of a further device of a member), local copy has data, family empty | upload as for creation, no question |
| Join (or further device), local copy has data, family has data | ask once, default **keep family**: (a) *use family's data*: local copy replaced by the family's data; (b) *add this device's data*: family profile and settings win; menu months, overrides and decisions whose key the family lacks are added; keys both have keep the family's record; `profile` and `settings` from the device are never merged field by field |
| Safety copy | in both (a) and (b) the previous local copy is kept on the device as a safety copy until the parent deletes it or for 30 days (DEFAULT), whichever is first; it can be exported (E10 format) and is never uploaded |
| Interrupted adoption | resumes at next open; the question is asked only once per device and family |

"Has data" means: a profile exists, or at least one menu month, decision or override exists. Defaults-only settings do not count.

**14.5 Cloud-sharing consent.** Separate from `consent.aiNoticeVersion`. Record: `cloudNoticeVersion` (integer ≥ 1, version **1** = the content of US-E15-02/AC2 items a to i) and `consentedAt` (timestamp), kept in the member's entry in the cloud and cached on the device. Per member; recorded before the first sync request that carries family data; a content change raises the version and asks again (sync paused for that member until accepted; US-E15-02/AC6). Withdrawing consent = leaving the family (US-E15-08); there is no "stay but stop" except pausing by declining a new version. Text requirements (ja and en, same items): (a) what, (b) why, (c) where (Firebase/Firestore, Tokyo, Japan), (d) who sees it (members only; no sale, no advertising), (e) the operator can technically reach stored data via the hosting console and does not use it (DEFAULT wording pending Q3), (f) AI reading is separate and sends no family data, (g) how to stop and delete, (h) a contact (Q4), (i) the consenting person is a parent or guardian. The text makes no claim of legal compliance, contains no codes, and is readable again in settings with the date consented. Legal review of the wording is outside this contract (Q3).

**14.6 Conflict and tombstone rules.**
- **Winner per sync record**: greater `updatedAt` wins; equal `updatedAt`: greater `deviceId` (string comparison) wins; still equal (same device): the later received write. Rule `sync-winner-deterministic`.
- **Merge** is per record, idempotent, commutative and associative (`sync-merge-convergent`): any order and any repetition of the same set of records gives the same result.
- **Delete** = tombstone with `deletedAt` = `updatedAt`. A tombstone competes by the same winner rule: a later edit resurrects the record, a later delete removes it.
- **Tombstone retention**: 90 days (DEFAULT, Q8), then purged by the cloud. A device whose last successful sync is older than 90 days reconciles on reconnect: a local record whose `updatedAt` equals its last-synced `updatedAt` and which is absent from the cloud is dropped locally; a record changed locally since is sent.
- **Clock skew**: a record received with `updatedAt` more than 5 minutes after the cloud's receive time is stored with `updatedAt` := the receive time. A record older than 13 months is not written to the cloud (retention, §7).
- **Retention pruning** (§7, 13 months) is a delete and produces tombstones.
- **After every apply** the local copy passes the whole store validation (§6); a dangling reference (for example a decision whose menu or recipe no longer resolves) is handled by the existing dormant/cleared rules of §3.6 (`decision-dormant`), never by a crash.
- **Lost edits**: when a pending local edit loses, the app notes it once (US-E15-07/AC8). Nothing else is merged.
- **Limit of the model** (accepted, Q6): last-edit-wins per whole record can drop the loser's extra content inside one record (for example a second extraction of the same month).
- **Import into a family** (US-E15-11/AC6): imported records get `updatedAt` = now; records absent from the file become tombstones.

**14.7 `ownerId`, leaving, removal, deletion.**
- While the account is in a family, `ownerId` of every synced record is the family id. In the local copy of a non-member it is the uid. `meta-owner-matches-account` (§12.1) becomes: `ownerId` equals the account's uid **or** the family id of the account's current membership; any other value fails.
- Leave or removal: the local copy stays on the device, every `ownerId` rewritten to the uid, sync metadata for that family dropped, status `local-only`. The cloud keeps the family's data for the remaining member.
- Delete family data: removes every sync record, tombstone, invite, member list and the family document; nothing of the content remains in the cloud. Each other member's device learns at next sync/open (`membership-ended`, reason `family-deleted`), keeps its local copy as stand-alone, and never re-creates the family.
- Last member leaving: same as delete family data (confirmation of US-E15-08/AC4).
- Account deletion (Firebase user) is not part of this section; leaving or deleting the family removes the family-related cloud content; deleting the Firebase user itself is a later story (Q9).
- No cloud copy of the device's local-only items (14.2) ever exists.

**14.8 First sign-in on a new device.** After sign-in, the app reads the account's membership. A member with no local copy waits for the family data (loading state, 15 seconds, then a retry screen) and never shows onboarding first (`new-device-no-onboarding-before-family-known`). A device with a local copy opens at once and syncs in the background. An account in no family is local only (14.4 first row does not apply until the parent chooses).

**14.9 Sync status (runtime state, not stored in the store, not exported).**
| `syncStatus` | Meaning | User text key (designer) |
|--------------|---------|-------------------------|
| `local-only` | not in a family | sync.localOnly |
| `synced` | nothing pending, last sync time known | sync.synced |
| `syncing` | sending or receiving | sync.syncing |
| `pending-offline` | no network and ≥ 1 pending record | sync.pendingOffline |
| `retrying` | a temporary error; backing off | sync.retrying |
| `paused-no-consent` | new notice version not yet accepted | sync.needsConsent |
| `paused-limit` | a size or write limit (14.10) was reached | sync.limit |
| `paused-app-too-old` | cloud `schemaVersion` > the app's | sync.appTooOld |
| `membership-ended` | left, removed or family deleted (shown once, then `local-only`) | sync.membershipEnded |
Fields shown with it: last successful sync time, pending count, oldest pending age (highlight at 24 h). Exactly one state at a time; no technical text.

**14.10 Limits and cost guardrails (configuration, not code; DEFAULT).**
| Setting | Value |
|---------|-------|
| `maxMembers` | 2 |
| `maxRecordBytes` | 262,144 (256 KiB JSON) |
| `maxFamilyBytes` | 5,242,880 (5 MiB total of record JSON) |
| `writeCoalesceSeconds` | 10 (at most one write per record in that window; the latest content is sent) |
| `maxWritesPerDevicePerHour` | 200 (then `paused-limit` until the next hour; queue keeps filling) |
| Retry back-off | start 5 s, double each time, at most 5 minutes, with jitter; a manual 「今すぐ再試行」 resets it |
| `inviteTtlHours` | 72 |
| `inviteFailedAttemptsPerHour` | 10 per account |
| `tombstoneRetentionDays` | 90 |
| `safetyCopyDays` | 30 |
| `liveUpdateSeconds` | 60 (online devices show another device's change within this time; Q12) |
Reads: only changed records after the first full download. The ADR states expected daily reads, writes and storage for two users against the current free quotas, which the developer checks on Google's pricing page; this contract quotes no quota numbers. The budget alert of §13.7 covers the project.

**14.11 Migration from the current local scheme.** No change to the store: key scheme (§12.2), `schemaVersion` 1 and every §3 rule stay. No migration runs until the parent creates or joins a family. The only data change on joining is `ownerId` (14.7). A device with an older app version can still read its local copy but does not sync; it never writes cloud data (nothing to upgrade). Export (E10-03) is the store as is: no sync records, tombstones, members or invites, no new top-level field (`export-roundtrip`). Old export files import as before; while in a family, import replaces the family's data after a warning (14.6). Local "delete all" (US-E10-04) removes local keys only and does not delete the cloud data or queue deletions.

**14.12 Sync port (test seam).** The app reaches the cloud only through a `SyncPort` (create family, read membership, create/cancel/redeem invite, leave, remove member, delete family, push records, pull changes, subscribe to changes) with a fake adapter that can simulate offline, slow, failing and conflicting responses, plus a fake clock. No Firebase type crosses it (ADR 014 pattern). Fixtures: `test-uid-001`, `test-uid-002`, `test-uid-003` (a non-member), family id `fam-test-001`, code `ABCD234567`, `device-A`, `device-B`.

**14.13 Security-rule requirements (what must hold; the rules file is the developer's).**
| Id | Requirement |
|----|-------------|
| `rules-auth-required` | no read or write of family data without sign-in |
| `rules-member-only` | read and write of a family's data only by a uid listed in that family's members |
| `rules-no-cross-family` | no read, list or query across families; a non-member cannot learn whether a family id exists |
| `rules-members-equal` | both members have the same read/write/delete rights on records |
| `rules-no-self-add` | membership changes only through the invite redemption path, never by a direct client write; a member can change only their own consent fields; member maximum cannot be changed by a client |
| `rules-invites-closed` | invites are not readable or listable by non-members; redemption is rate-limited |
| `rules-write-shape` | envelope shape (14.2), `updatedBy` = the signed-in uid, family id matches, no unknown fields, size within 14.10 |
| `rules-removed-no-access` | a removed or departed uid is denied immediately, including open listeners |
| `rules-default-deny` | everything not listed is denied; the proxy's counters stay deny-all (§13) |
Each is tested with the rules emulator (US-E15-09). The rules are in git; deploying them is a PO/developer step listed with §13.7-style operations.

**14.14 Hosted AI proxy.** Unchanged (§13). Family membership is neither required nor sufficient; the allow-list stays by account. The proxy neither reads nor writes family data. Extraction results shared through the family's `menus` records make an already-extracted PDF (same `sha256`) cost 0 provider calls for the other member (US-E2-07, US-E15-10/AC8).

**14.15 Validator and fixtures.** New rule ids (added to §6.1 when implemented): `family-one-per-account`, `sync-envelope-shape`, `sync-payload-valid`, `sync-key-matches-payload`, `sync-tombstone-no-payload`, `sync-winner-deterministic`, `sync-merge-convergent`, `new-device-no-onboarding-before-family-known`, and the changed `meta-owner-matches-account` (14.7). Fixtures: a store with data for create/join; a family with a different profile and with overlapping and non-overlapping dates for the "add this device's data" cases; tombstone and resurrection pairs; a 90-day boundary pair; a skewed-clock record.

### Open points
See `docs/ba/_scratch/e15/open-questions.md` (Q1 to Q12). None blocks the developer's ADR; each has a DEFAULT used above.
