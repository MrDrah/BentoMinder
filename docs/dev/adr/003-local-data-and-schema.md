# ADR-003: Local persistence, versioned schema, export/import, delete-all, and the sync seam

Status: **accepted** · 2026-10-24 · Owner: Developer

Entity and field names: `docs/ba/data-contract.md` v1 (root store `BentoMinderStore`, H1 final). Binding rules: BR-05, BR-13, BR-20, BR-22. Where this ADR and the contract disagree, the contract wins.

## Context
The MVP has no accounts and no backend database (PROJECT_BRIEF §4, §6). Everything the family types stays on the device (brief §5, §13; APPI note in PROJECT_BRIEF §9):
- one child profile (preferences, allergies, themes; no birthdate, gender, height or weight);
- confirmed monthly menus (one per month, replaceable; source URL kept for re-import);
- per-day **assessment overrides** and **family decisions** (incl. selected recipe and the optional "school-lunch reservation done" flag);
- settings (language, week start, reminder times, next-month prompt day) and reminder bookkeeping (which reminder keys were shown or dismissed).

The brief asks for a **versioned schema**, **edit / export / delete**, persistence of overrides "until changed" and of decisions across menu refreshes (§5, §6, §8), and must run on web now and in a Capacitor Android WebView later (§12). v1 may add synced family planning (§13), so the shape must not block that.

Size: one profile (~2 KB) + up to 12 months of menus (~6 KB each) + ~250 decisions/year (~150 B each) → **< 150 KB/year**. Uploaded PDFs are **not** stored (only the URL, file name and SHA-256), so storage never holds megabytes.

## Decision
1. **One `Storage` port** with an async document API; the whole app state is **one versioned JSON document** (the contract's `BentoMinderStore`, `schemaVersion` 1), read once at start-up and written after each committed change (debounced 300 ms, flushed on `visibilitychange: hidden` / Capacitor `pause`).
2. **Web adapter: `localStorage`** (key `bentominder.state`, plus `bentominder.state.prev` = last good copy). **Android adapter: `@capacitor/preferences`** with the same keys (ADR 005 confirms the plugin set). IndexedDB is not used in the MVP.
3. **Schema version** is an integer in the document; **forward-only migrations** are pure functions `migrate_n_to_n+1` in `src/domain/storage/migrations/`, each with a frozen fixture of its input version.
4. **Export** = the store document itself as a downloadable / shareable `bentominder-backup-YYYYMMDD.json` (contract rule `export-roundtrip`: it re-validates as a `BentoMinderStore`); **import** = validate → migrate → replace (after confirmation). **Delete all** = remove all app keys + cancel all reminders → onboarding (BR-22).
5. **Corrupt or unreadable data is never silently wiped**: the app opens a recovery screen (details below).
6. **Sync seam**: the contract's record metadata (`ownerId` = `local` in the MVP, `createdAt`, `updatedAt`) on every ChildProfile, MenuMonth, AssessmentOverride, DayDecision and Settings record, plus a root `deviceId`; conflict policy documented below, not built.

```ts
// src/domain/storage/port.ts  (port; adapters live in src/adapters/{web,android}/storage.ts)
export interface Storage {
  read(key: StorageKey): Promise<string | null>;
  write(key: StorageKey, value: string): Promise<void>;
  remove(key: StorageKey): Promise<void>;
}
export type StorageKey = 'bentominder.state' | 'bentominder.state.prev';   // deviceId lives inside the store

// src/domain/storage/repository.ts  (pure orchestration over the port; tests use an in-memory Storage)
export type LoadResult =
  | { kind: 'empty' }                                   // first launch → onboarding
  | { kind: 'ok'; state: BentoMinderStore; migratedFrom?: number }
  | { kind: 'recovered-from-prev'; state: BentoMinderStore; reason: CorruptReason }
  | { kind: 'corrupt'; raw: string; reason: CorruptReason }
  | { kind: 'too-new'; version: number };              // written by a newer app version
export type CorruptReason = 'json-parse' | 'schema-invalid' | 'migration-failed';

export function createRepository(storage: Storage, clock: Clock): {
  load(): Promise<LoadResult>;
  save(state: BentoMinderStore): Promise<void>;                 // validates before writing; rotates prev
  exportJson(state: BentoMinderStore): string;                  // pretty JSON of the store itself (export-roundtrip)
  importJson(text: string): ImportResult;               // pure: parse → migrate → validate, no write
  deleteAll(): Promise<void>;
};
```

## The document (schema v1)
The shape is the data contract's root store `BentoMinderStore` (§3.1), field for field; the zod schema in `src/domain/schema/store.ts` is written from the contract tables and rejects unknown fields (`additionalProperties: false`). Summary:

| Field | Shape | Notes |
|-------|-------|-------|
| `schemaVersion` | `1` | lower → migrate (with backup); higher → read-only (`too-new`) |
| `deviceId` | UUID v4 | created at first launch, never sent anywhere |
| `createdAt` / `updatedAt` | timestamps | |
| `settings` | `Settings` | language, timezone (const `Asia/Tokyo`), reminders (BR-16), `nextMonthPromptFromDay`, `weekStartsOn` (default `monday`), `theme` (default `auto`); display settings never change domain results (ADR 001) |
| `profile` | `ChildProfile` \| null | one child in the MVP (BR-20 field list only) |
| `menus` | map `YYYY-MM → MenuMonth` | up to 3 extractions per month + the confirmed menu (`version` +1 per refresh) |
| `overrides` | map `YYYY-MM-DD → AssessmentOverride` | BR-05 |
| `decisions` | map `YYYY-MM-DD → DayDecision` | parent-created only (BR-02, ADR 004 §2) |
| `reminderLog` | `ReminderLogEntry[]` | unique `key`; pruned after 60 days (ADR 004 §4, ADR 005 §2) |
| `consent` | object \| null | AI notice version + time (US-E2-08) |
| `aiUsage` | map `YYYY-MM → calls` | provider calls per Tokyo month (ADR 002 `providerCalls`) |

**Record metadata (sync seam):** every ChildProfile, MenuMonth, AssessmentOverride, DayDecision and Settings record carries `ownerId` (`local` in the MVP; v1: the family id), `createdAt` and `updatedAt` (contract rules `meta-owner`, `meta-timestamps`). Maps keyed by date give decisions and overrides a deterministic identity per date. Timestamps come from the `Clock` port.

Everything is validated by that schema on **load, before save, and on import**. Child data never leaves the device except through the parent's explicit export or the share text (which contains no profile data, BR-21).

## Write safety
- `save()` validates first; an invalid state is a bug → throw, keep the old document, log to the dev console and (in dev) the debug panel.
- Before overwriting `bentominder.state`, the current value is copied to `bentominder.state.prev` (only if it is itself valid). Each `setItem` is atomic per key in browsers; Preferences writes are atomic per key on Android.
- Quota errors (`QuotaExceededError`) surface a non-blocking banner: "Couldn't save. Export a backup." The in-memory state stays usable.

## Corrupt data
On start-up, `load()`:
1. `JSON.parse` fails, schema invalid, or a migration throws → try `state.prev`. If prev is valid → open the app with it and a banner: "The last change couldn't be read; we restored the previous copy." (`recovered-from-prev`).
2. Both bad → **recovery screen** (`corrupt`): *Download the damaged data* (raw text, for support), *Import a backup*, *Start over* (double confirmation). Nothing is deleted until the parent chooses.
3. `schemaVersion` greater than the app knows (`too-new`, e.g. a backup from a newer build) → read-only message; no write, no downgrade.

QA cases: truncated JSON, valid JSON with a wrong type, unknown future version, prev valid / prev invalid, quota error.

## Migrations
- `migrations: Record<number, (doc: unknown) => unknown>`; `migrate(doc)` runs `from → current` in order, then validates against the current schema.
- Each migration ships with `tests/fixtures/state/v<n>.json`; a test migrates every historical fixture to current and validates it. Fixtures are frozen once released (never edited, like applied DB migrations).
- Migrations are pure and never call the network or the clock (timestamps for new fields use the record's `updatedAt`).

## Export / import
- Export file: the `BentoMinderStore` document as stored (BR-22, rule `export-roundtrip`); the file name carries the Tokyo date. Web: download via a Blob link; Android: write to cache with Filesystem + open the share sheet (ADR 005 confirms). Contains the child profile, so the UI says so before export.
- Import: parse → recognise a `BentoMinderStore` (`schemaVersion` + `deviceId` present) → migrate → validate → show a summary ("profile, 2 months of menus, 14 plans") → confirm → replace the whole state → reconcile reminders. Merge-import is **not** in the MVP (it is the same problem as sync).

## Delete all
Settings → "Delete all data": confirmation dialog → `NotificationScheduler.cancelAll()` → `storage.remove()` for all keys → in-memory reset → onboarding. Also used by the debug panel's "clear local data". QA asserts no `bentominder.*` keys remain and no reminder fires afterwards.

## v1 sync seam (noted, not built)
- **Ownership**: `ownerId` becomes the family id; v1 adds an `updatedBy` member id and `deletedAt` tombstones (contract change in v1, with a migration). Local data is offered for upload on first sign-in (`backend-integration` §1).
- **Granularity**: the unit of sync is a record (profile, menu month, a date's decision, a date's override, settings), not the whole document. Decisions/overrides already have one record per date with a deterministic id, so two devices editing the same date collide on the same id instead of creating duplicates.
- **Conflict policy (proposal for the v1 ADR)**: last-writer-wins per record by `updatedAt`, **except** decisions: if both devices changed the same date since the last sync and the results differ, keep both and ask the parent ("Mom planned a bento, Dad set school lunch"); a decision never silently reverts to school lunch. Tombstones (v1 `deletedAt`) propagate deletes. Clock skew is handled by the server stamping `updatedAt` on receipt.
- **Out of scope until then**: merge-import, multi-child, multiple devices.

## Alternatives considered
| Option | Why not (now) |
|--------|---------------|
| IndexedDB (raw or via `idb`/Dexie) | Async, transactional and large-capacity, but our data is < 150 KB/year and read whole at start-up; adds 5–25 KB and complexity. Becomes right if we store PDFs or many months of history |
| One key per record in localStorage | Partial writes across keys can leave an inconsistent state; one document with a prev copy is simpler to make safe |
| Plain WebView localStorage on Android | Works, but WebView storage is tied to the WebView origin and can be cleared with "clear cache" on some devices; Capacitor recommends Preferences for durable key-value data |
| Capacitor SQLite | Native dependency and schema tooling for < 150 KB of data |
| Storing uploaded PDFs | MBs per month for little value; the URL + hash is enough to detect "same PDF" and to re-import |

## Consequences
- Start-up reads and validates one small document (< 5 ms); every change rewrites it (~ 50 KB max, debounced) — fine at our sizes.
- The domain is fully testable with an in-memory `Storage`.
- A schema change always needs: new version number, migration, frozen fixture, test. The validator script also checks fixtures in `tests/fixtures/state/`.
- Must test: load/save round trip, every migration path, every corrupt case, export → import round trip equality, delete-all leaves nothing and cancels reminders, overrides and decisions survive a menu replacement (ADR 004).

## Revisit when
- The document passes ~1 MB, or we decide to keep PDFs or page images → IndexedDB (web) / Filesystem (Android) for blobs, keep the document small.
- v1 family sync is approved → a new ADR for the backend and the conflict policy above; `ownerId`, `createdAt`, `updatedAt` and per-date identities are already there.
- Android testing shows Preferences write latency > 50 ms for the document → split into per-area keys.

## Change log
- 2026-10-24 · proposed (kick-off).
- 2026-10-24 · **accepted** at H1. Document shape replaced by the data contract's `BentoMinderStore` (maps keyed by month/date, `reminderLog`, `consent`, `aiUsage`, root `deviceId`); the illustrative `AppStateV1`/`SyncMeta` (with `updatedBy`, `deletedAt`) dropped in favour of the contract's record metadata (`ownerId`, `createdAt`, `updatedAt`). Export is the store itself (`export-roundtrip`). Settings gain `weekStartsOn` (Monday default, Sunday option) and `theme`; recipes gain `shortNameJa/En` (1–8 characters; library data, not stored per device except via `recipeNameSnapshot` and `recipeShortNameSnapshot`).
- 2026-10-24 · H1 fix round (Developer): `DayDecision` gains `plannedAt` (PLAN §7 B10), `recipeShortNameSnapshot { ja, en }` and `acknowledgedMenuVersion` for refresh conflicts (B7), all per data contract §3.6 (ADR 004 §2). They are part of schema v1 (no store has shipped yet), so no migration is needed.
- 2026-10-24 · H1 late ruling (Developer): field names aligned with data contract §3.6 (`recipeShortNameSnapshot { ja, en }`, `plannedAt`, `acknowledgedMenuVersion`).
- 2026-10-24 · M1 (Developer): root `nextMonthCardHiddenOn` (date | null, default `null`; contract §3.1, US-E3-06/AC6) added to schema **v1** without a migration: no store has shipped, so the version stays 1 and the frozen fixture `tests/fixtures/state/v1.json` was updated instead. Had a store shipped, this would be schema 2 with a migration defaulting the field to `null`. The export file name follows the contract: `bentominder-export-<YYYY-MM-DD>.json` (Tokyo date), not the `backup-YYYYMMDD` of decision 4 above. `LoadResult.too-new` now carries the raw text so the newer-data screen can export it as is (US-E10-02/AC3).
- 2026-10-25 · M1 fix round (Developer), **D-M1-06: two tabs must not overwrite each other.** One browser profile can run the app in several tabs, each with its own in-memory copy of the document, and the old `save` wrote that copy whole. Decision, in two parts, both inside the existing port so Android needs no new idea:
  1. **Compare-and-swap on save.** The repository remembers the exact stored text it last read or wrote (`known`; `null` = nothing stored). `save` re-reads the stored text and, if it differs from `known`, throws `StoreConflictError` and writes nothing (not even the `.prev` copy). `load()` refreshes `known`, so "reload, then save" works. The token is the document text itself, not a `revision` counter: a counter would be a new field in the data contract and an export-format change, while the text needs neither and works for any `Storage` adapter (Preferences on Android returns the same string). A deliberate whole-store replacement (import) passes `{ force: true }`; `deleteAll` sets `known = null`. All repository operations run one at a time (a promise queue), so two saves from one tab cannot interleave their read-compare-write. Note: this is atomic across tabs only as far as the adapter is. `localStorage` has no cross-tab transaction, so a write landing between the read and the write inside one tab is still possible but needs sub-millisecond timing and still leaves the loser's write in `.prev`; the `storage` listener below closes that window in practice. The Android WebView has a single process, so the question does not arise there.
  2. **`Storage.onExternalChange(handler)`** (optional port method; the web adapter implements it with the `storage` event, filtered to our key, and lives in `src/adapters/web/storage.ts`, never in `src/domain`). When it fires, the app reloads the store from storage (`reloadFromStorage`) and shows an info banner "Updated in another tab" (dismissible). A save that hits a conflict does the same reload, shows the toast "Not saved: another tab had updated your data" and the banner, and returns `false` to the caller (no "saved" state is ever shown for a refused write).
  Policy: **the stored version wins and the refused edit is shown as not saved**; there is no automatic merge in M1/M2 (the unit of change is a whole form or a confirmed menu, and a silent merge could mix two parents' decisions). Neither tab's *confirmed* data is lost silently: the one that was written first stays, the other is told. Revisit when v1 family sync defines the real conflict policy (the `updatedAt`/`deviceId` seam above), or if M2's decision editing needs per-day merge (then re-apply the edited day on top of the reloaded store instead of dropping it). Tests: `tests/unit/domain/repository.test.ts` (conflict, reload-then-save, serialisation, force, delete-all, forwarding), `tests/e2e/m1-two-tabs.spec.ts` (storage event; conflict with the event suppressed), QA `m1-hostile.spec.ts` D-M1-06.
- 2026-10-25 · D-M1-06 resolved for M2 (Developer): decision, override and settings edits that the repository refuses reload the stored version and show the toast; no per-day re-apply. See ADR 007 decision 8.
