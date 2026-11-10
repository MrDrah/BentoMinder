# QA report: epic E15 Cloud sync and shared family space

Date 2026-11-10. Base commit 894c6e1 (E15 slice E integration). Independent pass: tests derived from `docs/ba/user-stories.md` (US-E15-01..11), `docs/ba/data-contract.md` section 14, `design/components.md` section 16 and `design/copy.md` section 22. ADR 016 was read only for the quota assumptions and the documented design decisions. Developers' reports were not used as an oracle; only the test infrastructure (fake Firestore, request rig, store fixtures) was reused.

## Verdict

**NO-GO for H4 as it stands: 1 open P2 (E15-D03), 4 open P3, 3 open P4.** Security and convergence are clean (0 findings). The P2 is a data-affecting gap in the join flow that a flaky mobile network triggers. Fix cycle 1 of 2 applies.

## Defects

| Id | Sev | AC | Title | Owner (proposal) |
|----|-----|----|-------|------------------|
| E15-D03 | **P2** | US-E15-04/AC4, AC11 (AC5, AC6 safety copy) | A join whose first download fails (or whose local copy is unreadable at join time) skips the adoption question, makes no safety copy and syncs silently; the device's records overwrite the family's by last-edit-wins | developer |
| E15-D04 | P3 | US-E15-08/AC3, AC6 (US-E15-04/AC8) | If the membership ends (removed, family deleted) while the adoption question is open, both "continue" and "cancel" fail forever and the device never learns it was removed | developer |
| E15-D06 | P3 | US-E15-11/AC2 (contract 14.11) | A device on the previous app version (owner rule: uid only) classifies a family-owned local copy as `corrupt`, not readable as the contract promises | developer / orchestrator (accept as known) |
| E15-D07 | P3 | US-E15-06/AC4, AC6 | The status sheet is a lazy chunk that is not prefetched: a phone that goes offline before ever opening it shows only a generic error when the indicator is tapped | developer |
| E15-D02 | P3 | US-E15-03/AC6 vs contract 14.3 | The code alphabet of contract 14.3 contains `L`; the AC says no 1/I/L. Generated codes contain `L` (seen: `GJ5SLUARS3`). Implementation follows the contract; the two documents disagree | BA / orchestrator ruling |
| E15-D01 | P4 | brief ("codes hashed at rest") | An active invite's code is stored in plain text in `invites/<hash>` (removed once used or cancelled). ADR 016 section 1 documents it ("so a member can see an active invite again"); the document id is the hash | developer (accept or hash) |
| E15-D05 | P4 | US-E15-11/AC8 | The export file carries the store root `deviceId` (as before E15); AC8 and contract 14.2 say "never exported" | BA (wording) |
| E15-D08 | P4 | US-E15-10/AC5 (ADR 016 section 10) | ADR estimate is low: measured idle poll = 4 Firestore reads (ADR: 2 to 3); typical day 2,262 reads vs ADR about 1,500. Still 4.5 % of the 50,000 free reads | developer (doc) |

### Reproductions

**E15-D03** (tests: `tests/unit/qa/e15/US-E15-04-join-interrupted.test.ts`, two `it.fails` cases).
1. Family exists with a profile (note X, older stamp) and an active invite. Device B has local data with a later-dated profile (note "B-WOULD-OVERWRITE", `updatedAt` 2026-11-12) and is in no family.
2. B redeems the code. The member is added on the server; the first `records.pull` is lost (network cut), or B's local copy is unreadable at that moment.
3. `join()` swallows the failure, writes meta `{familyId, consent}` with `adoption: null`, returns `done`.
4. B is reopened (reliable network). Expected (AC4, AC11): the question 「この端末のデータをどうしますか」 is asked, nothing is changed before the answer, a safety copy exists. Actual: `adoptionPending` is false, no safety copy, the cycle runs normally and B's profile overwrites the family's profile in the cloud (verified by reading the stored `payloadJson`).
Cause (read only to locate): `family-ops.ts` `join()` catch path and `controller.execute()` treat `adoption === null` as "no question owed". Also reachable with a corrupt local copy (E10-02 recovery pending) at join time.
Impact: silent loss of the family's profile or any record the device holds a newer version of; no safety copy. Likelihood: any network drop in the one second between "member added" and "download finished".

**E15-D04** (two `it.fails` cases in the same file). B joins with data on both sides and is asked the question (the screen is open). A removes B, or deletes the family. B: the cycle is halted at `adoption-pending` so it never calls the server and never learns; tapping continue runs `pullAll` which throws `membership-ended` (screen: generic error); tapping cancel runs `leave()` which also throws (410). Expected: B is told 「家族から外されました」 / 「家族のデータが削除されました」 and ends local-only with its data. Actual: both buttons fail; `meta.familyId` stays set. Local data stays safe and usable.

**E15-D06** (`it.fails` in `US-E15-11-migration-export.test.ts`). A repository built with the E13 options (`accountId` only) loads a store whose `ownerId` is a family id: result `{"kind":"corrupt"}`. The older app then offers its local recovery, not the data.

**E15-D07** (Playwright, `test.fail`, both viewports). Member device, calendar open, `context.setOffline(true)`, tap the app-bar indicator: `sheet-sync` never appears; `chunk-error` ("generic error") shows. Works when the sheet was opened once before going offline.

**E15-D02** `tests/unit/qa/e15/US-E15-09-authz-matrix.test.ts`, "DEFECT PROBE (E15-D02)" (static) plus the code-format test (asserts no `0 O 1 I`, tolerates `L`).

**E15-D01** same file, "DEFECT PROBE (E15-D01)" (pins the plain-text active code).

**E15-D05** `it.fails` "DEFECT E15-D05" in the migration file: `exportJson(store)` contains the device id.

**E15-D08** `tests/unit/qa/e15/US-E15-10-cost.test.ts` (prints the counters; run with `--silent=false`).

Pinned tests: the six `it.fails` cases pass while the defect exists and go red when it is fixed (then remove the marker). They are counted as "expected fail" in the totals. E15-D07 uses Playwright `test.fail`.

## Results (exact commands and counts)

| Suite | Command | Result |
|-------|---------|--------|
| New unit/model/integration tests | `npx vitest run --project domain tests/unit/qa/e15` | 11 files, 105 tests: 99 pass + 6 expected-fail (pinned defects D03 x2, D04 x2, D05, D06); about 40 s |
| Full default suite (regression) | `npx vitest run` | 141 files, 2641 passed, 6 expected fail, 2 skipped (both skips pre-existing, none added by QA); about 45 s |
| New e2e (real sync pipeline in the test process) | `npx playwright test -c tests/e2e/qa/playwright.e15.config.ts --workers=2` | 16 results: 14 pass + 2 expected-fail (E15-D07 on mobile-ja and desktop-en); 2.2 min first run, 47 s warm. Ports 5173/8787/4173 were checked free before the run (`netstat`); the config starts only `npm run preview` on 4173 |
| Types / lint | `npm run typecheck`, `npx eslint tests/unit/qa/e15 tests/e2e/qa` | clean |
| Traceability | `node .claude/skills/quality-gate/scripts/validate.mjs trace` | PASS, all 93 stories named by an active test |

`vitest.config.ts`: added `tests/unit/qa/e15/**/*.test.ts` (domain project) and `tests/unit/qa/e15/**/*.test.tsx` (ui project) to the default includes. No product code, docs/ba or PLAN was changed.

## What was tested, by area

**1 Security (no findings except D01/D02 notes).** `US-E15-09-authz-matrix.test.ts` (37 tests), `US-E15-09-logs-privacy.test.ts` (5), `US-E15-09-state-machine.test.ts` (1, 12 seeds x 250 operations).
- Every operation x {no header, wrong scheme, empty bearer, unknown/other-project token, verifier that throws, unsafe uid}: one identical 401 body, 0 writes.
- Non-member, never-member, ended-and-acknowledged, dangling account index, unknown family id: one identical NOT_MEMBER body from all eight member operations even when the request names a family id, record key, seq, role.
- Removed or departed member: 410 on the very next request for all eight operations, reason `removed`/`left`; a pull returns no data; nothing is written. Family deleted: other member refused, cloud lists nothing for the family id, the marker string and the family id appear in no document.
- Cross-family: a member of family B with forged `familyId`, record keys, seq, uid in every operation leaves family A byte-identical; `removeMember` of an A member, of an unknown uid and of oneself give the same answer. Path injection through kind/key/seq/bytes/familyId/role is refused (400, 0 writes).
- Escalation: client-set role, member list, maxMembers, memberCount, joinedAt are ignored in create/invite/redeem/consent; member documents hold only their own fields; one member's consent change does not touch the other's; `updatedBy` is always the token uid.
- Invites: wrong, used, cancelled (by cancel and by replacement) and a spaced/lower-case wrong code give the identical body, content-length, transaction count, write count and read count (no timing-visible difference at the store level); expired differs only as the AC says, exact boundary tested (one second before works, at `expiresAt` refused, no member added); concurrent redemption: exactly one winner; full family; 10 failures per hour then 429 for any code including the right one, window boundary, other accounts unaffected; 200 generated codes distinct, 10 symbols from the contract alphabet; invite id is a 64-hex hash.
- Consent version: data operations and invite creation need the minimum version; leave, cancel, delete stay available; invalid or missing versions refused (create writes nothing).
- Create allow-list: stranger refused, unreadable list refuses everyone, joiners need not be on the list.
- Limits: record over 256 KiB, family over 5 MiB (checked before any write), 600 writes per hour per account with retry-after and window reset, batch of 51, duplicate key, array/non-JSON/10 MiB bodies, device-only settings fields, aiUsage tombstone, tombstone with payload, `deletedAt` mismatch, 5 minute clock skew clamp (6 minutes clamped, 5 kept), 13-month retention (live refused, tombstone accepted), `totalBytes` equals the sum of record bytes after 60 random pushes.
- Logs: after create/invite/join/push/pull/remove/delete/hostile-origin calls no line contains e-mail, uid, name, allergy text, PDF text, code or the confirmation word; every line matches the fixed shape; internal failures log the class name only (a hostile class name cannot inject text or line breaks).
- Rules: `firestore.rules` is a single deny-all match (static), proxy counters and sync collections disjoint.
- State machine: after every operation, accepted or refused, memberCount equals member documents and respects the maximum, one family per account, indexes agree, at most one usable invite, byte accounting, refused operations change nothing (except the committed failed-attempt counter).

**2 Engine and convergence.** `US-E15-07-model-convergence.test.ts` (9 tests). The real `syncCycle` runs through the real HTTP adapter and the real Function (not the developers' FakeBackend). My oracle (`Oracle` class in the test, no import of `merge.ts`): per record keep every version ever made, greater `updatedAt` then greater `deviceId` wins, a delete is a version, `aiUsage` is the largest count. Three devices (two phones of one account, one spouse), random edit / delete / re-create / offline / lossy network (request lost, or reply lost after the server committed) / import into family / leave + rejoin (use-family). 80 seeds x 70 steps plus a 400-step run in the suite; 700 seeds x 70 steps once locally (`QA_SEEDS=700`): 0 differences between oracle and every device. After every apply on every device: BR-03 whole-store validation and the owner rule (uid or family id). Also: deterministic ties (both sync orders), newer edit beats older tombstone and the reverse, 90 days / 90 days + 1 s / 91 days offline (unchanged record deleted elsewhere not resurrected, changed record kept and sent), purge only after day 90, clock skew 6 minutes, lost-edit note exactly once, retention pruning never uploaded.
Two modelling facts learnt (not defects, they follow AC4 and contract 14.4): a delete of a record this device never synced creates no tombstone and does not delete a record another device created; never-edited default settings are not uploaded at creation (6 of 7 records).

**3 Data never lost on a crash.** `US-E15-04-crash-sweep.test.ts` (5 tests, about 40 s). The device storage "dies" at write 1, 2, 3 ... of: join + use-family, join + add-device, create (with local data), leave; then the device restarts on what was on disk and does what the app does. Invariants at every crash point: local copy valid, original data survives (store, safety copy or cloud), a member in the cloud knows its family on the device, ownerId consistent (uid or family id, never mixed), the cloud lost no record. Also the network cut at each of the first 10 requests, both "request lost" and "reply lost after commit". Result: all invariants hold. The only violations found are E15-D03/D04, reached when the network is cut during join (join-finished is therefore not asserted in the network sweep; pinned separately).

**4 Controller / flows through the real stack.** `US-E15-01-04-controller.test.ts` (19 tests): nothing but `membership.get` before consent; notice version 2 on a v1 member: `paused-no-consent`, 0 records requests, local edits saved, acceptance records the version and resumes; new device of a consented member asks nothing; create uploads every record once under the family id with unchanged timestamps; double tap = one family; upload cut halfway resumes without duplicates; empty family; join empty / ask / cancel undoes the join / use-family (safety copy, nothing uploaded, exportable) / add-device (family wins existing keys, new keys uploaded once) / family empty / refusals / equal members; leave, last member leaving deletes, delete leaves nothing and the other device is told once and never re-creates; offline disables leave/remove/delete/invite and queues nothing; 5 edits of 3 records queue as 3 across a restart; after sign-out nothing is sent.

**5 Migration and export.** `US-E15-11-migration-export.test.ts` (10 tests): an E13 copy is left byte-identical at start (0 writes, only `membership.get`); no new top-level field; keys stay `bentominder.<uid>.state` + `.prev` + `.sync` + `.safety`; ownerId family id while a member, uid after leave (no family id left in the file), family id again after rejoin; member export has no tombstone/metadata/invite; old exports (`local` or foreign uid) import as before; import into a family: file records stamped now, absent records tombstoned, the other device converges, foreign ownerId/deviceId never carried in; delete-all keeps the cloud, downloads again, sends no deletions.

**6 Cost guardrails** (`US-E15-10-cost.test.ts`, 5 tests). One typical day, two devices, 4 visible hours each (480 polls), 55 edits (the two devices together), measured by counters on the Firestore port: **2,262 reads (4.5 % of 50,000), 165 writes (0.8 % of 20,000), 0 deletes, 535 function requests (about 16,000 a month vs 2 million), 7,147 bytes stored.** Idle poll 4 reads, no writes; a reopened app pulls only records after its cursor; 30 edits of one record in 10 seconds send at most one write; the 200-writes-an-hour client guard stops, keeps queueing and delivers everything the next hour; no request ever goes to the proxy and the sync function touches no proxy collection.

**7 UI / copy / a11y.** `US-E15-02-copy-conformance.test.ts` (7): the copy table of section 22 is parsed from `design/copy.md` (206 rows) and compared to `src/i18n/ja.ts` and `en.ts` row by row: 0 differences, same placeholders in both languages, no technical or legal wording, notice items (a) to (i) present in both languages, AC-fixed phrases present. Playwright `e15-family-qa.spec.ts` (8 tests x 2 projects: 390 px ja, 1280 px en): consent gating (0 family-data requests before accept, none after decline, default focus is not the accept button, notice axe-clean light and dark), family card and invite and join screen and status sheet and ended notice axe 0 serious/critical, keyboard-only create-family journey, deep link while signed out keeps the code after sign-in, hostile input in the code field (script, emoji, 5,000 characters, SQL text, look-alike letters) disables the button and sends nothing, a well-formed wrong code, an expired or a used code show one generic text, removal and deletion notices on the other device, offline disables destructive actions with the AC text and queues nothing.

## Acceptance criteria

**Verified (fake store / jsdom-free controller / browser against the real request pipeline):**
US-E15-01/AC1-AC8; US-E15-02/AC1, AC3, AC4, AC5 (server records version and time per member), AC6, AC8 (AC2 and AC3 wording by the copy conformance test); US-E15-03/AC1 (code shape and expiry), AC2, AC3, AC4, AC5, AC6, AC7, AC9 (offline disables); US-E15-04/AC1-AC3, AC5-AC10, AC12 (AC4 and AC11 only partly: see D03, D04); US-E15-05/AC1-AC4, AC6 (asks once), AC7, AC8, AC9 (sign-out keeps family and local copy); US-E15-06/AC1-AC3, AC5 (back-off numbers, retry offer), AC7, AC10, AC11 (AC4 states by copy and axe; AC6 sheet reachable once loaded; AC8, AC9 not re-tested, covered by the developers' unit tests I only read); US-E15-07/AC1-AC12; US-E15-08/AC1-AC11 (AC3 and AC6 fail in the open-question state, D04); US-E15-09/AC1-AC10 (AC10 as the fake-store authorisation matrix plus the static deny-all test); US-E15-10/AC1-AC8 (AC1 limits at the Function; the client-side `paused-limit` text was not exercised in the browser; AC8 not exercised end to end: needs the extraction cache, see below); US-E15-11/AC1-AC9 (AC2 fails for an old app, D06; AC8 wording D05).

**Not verifiable without a real deploy, the emulator or devices:**
- Firestore rules emulator contract run (US-E15-09/AC10 "optional, CI only"): the rules file is deny-all and all access goes through the Function; fidelity of `FakeFirestore` (transaction retry, index requirements for `seq >`, `deletedAtMs <`, `familyId ==` queries, 1 MiB limit, billing of reads) is a stated risk and was not checked against the real service.
- Real Google sign-in and ID-token verification, real CORS preflight from the deployed origin, cold-start latency, Cloud Run quotas and the Tokyo free tier (numbers above are Firestore operation counts, not a bill).
- US-E15-05/AC7 "within 60 s" with real timers and a real background tab (the poll interval function is asserted: 60 s visible and online, none otherwise; the controller loop was driven with a manual clock).
- Android/iOS devices, PWA install, real service-worker behaviour, push (out of scope).
- US-E15-10/AC8 (second member imports the same PDF: 0 provider calls) needs the proxy plus the PDF cache; not exercised.
- Legal wording of the notice (Q3) and the contact line; the shipped contact line was seen, not evaluated.
- Real-time timing differences between "wrong" and "used" codes over HTTP (only store-level work counts compared: identical).

## Open defects by severity

P1 0, P2 1 (E15-D03), P3 4 (E15-D02, D04, D06, D07), P4 3 (E15-D01, D05, D08). Triage proposal: D03 must be fixed before H4; D04, D07 should; D06 and D02 need a ruling (accept as documented limitation, or change); D01, D05, D08 are documentation or accepted decisions.

## Files

- `tests/unit/qa/e15/` (11 test files plus `qa-rig.ts`, `bridge.ts`, `ctl.ts` support)
- `tests/e2e/qa/e15-family-qa.spec.ts`, `tests/e2e/qa/playwright.e15.config.ts`
- `vitest.config.ts` (include of the new path)
- this report (force-added: `tests/reports/` is git-ignored)
