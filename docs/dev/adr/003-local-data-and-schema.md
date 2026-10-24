# ADR-003: Local persistence, versioned schema, export/import, delete-all, and the sync seam

Status: proposed · 2026-10-24 · Owner: Developer

## Context
The MVP has no accounts and no backend database (PROJECT_BRIEF §4, §6). Everything the family types stays on the device (brief §5, §13; APPI note in PROJECT_BRIEF §9):
- one child profile (preferences, allergies, themes; no birthdate, gender, height or weight);
- confirmed monthly menus (one per month, replaceable; source URL kept for re-import);
- per-day **assessment overrides** and **family decisions** (incl. selected recipe and the optional "school-lunch reservation done" flag);
- settings (language, reminder times, effort preference) and reminder bookkeeping (what is scheduled, what was acknowledged).

The brief asks for a **versioned schema**, **edit / export / delete**, persistence of overrides "until changed" and of decisions across menu refreshes (§5, §6, §8), and must run on web now and in a Capacitor Android WebView later (§12). v1 may add synced family planning (§13), so the shape must not block that.

Size: one profile (~2 KB) + up to 12 months of menus (~6 KB each) + ~250 decisions/year (~150 B each) → **< 150 KB/year**. Uploaded PDFs are **not** stored (only the URL, file name and SHA-256), so storage never holds megabytes.

## Decision
1. **One `Storage` port** with an async document API; the whole app state is **one versioned JSON document** (`AppStateV<n>`), read once at start-up and written after each committed change (debounced 300 ms, flushed on `visibilitychange: hidden` / Capacitor `pause`).
2. **Web adapter: `localStorage`** (key `bentominder.state`, plus `bentominder.state.prev` = last good copy). **Android adapter: `@capacitor/preferences`** with the same keys (ADR 005 confirms the plugin set). IndexedDB is not used in the MVP.
3. **Schema version** is an integer in the document; **forward-only migrations** are pure functions `migrate_n_to_n+1` in `src/domain/storage/migrations/`, each with a frozen fixture of its input version.
4. **Export** = the same document as a downloadable / shareable `bentominder-backup-YYYYMMDD.json`; **import** = validate → migrate → replace (after confirmation). **Delete all** = remove both keys + cancel all scheduled reminders → onboarding.
5. **Corrupt or unreadable data is never silently wiped**: the app opens a recovery screen (details below).
6. **Sync seam**: every record carries `id`, `ownerId`, `createdAt`, `updatedAt`, `deletedAt?` from day one; conflict policy documented below, not built.

```ts
// src/domain/storage/port.ts  (port; adapters live in src/adapters/{web,android}/storage.ts)
export interface Storage {
  read(key: StorageKey): Promise<string | null>;
  write(key: StorageKey, value: string): Promise<void>;
  remove(key: StorageKey): Promise<void>;
}
export type StorageKey = 'bentominder.state' | 'bentominder.state.prev' | 'bentominder.device';

// src/domain/storage/repository.ts  (pure orchestration over the port; tests use an in-memory Storage)
export type LoadResult =
  | { kind: 'empty' }                                   // first launch → onboarding
  | { kind: 'ok'; state: AppState; migratedFrom?: number }
  | { kind: 'recovered-from-prev'; state: AppState; reason: CorruptReason }
  | { kind: 'corrupt'; raw: string; reason: CorruptReason }
  | { kind: 'too-new'; version: number };              // written by a newer app version
export type CorruptReason = 'json-parse' | 'schema-invalid' | 'migration-failed';

export function createRepository(storage: Storage, clock: Clock): {
  load(): Promise<LoadResult>;
  save(state: AppState): Promise<void>;                 // validates before writing; rotates prev
  exportJson(state: AppState): string;                  // pretty JSON, includes schemaVersion + exportedAt
  importJson(text: string): ImportResult;               // pure: parse → migrate → validate, no write
  deleteAll(): Promise<void>;
};
```

## The document (schema v1, illustrative)
```ts
type AppStateV1 = {
  schemaVersion: 1;
  deviceId: string;                 // random UUID, generated at first launch
  profile: ChildProfile | null;     // one child in MVP
  menus: MenuMonth[];               // ≤ 1 active per 'YYYY-MM'; replaced menus kept with deletedAt (for undo/sync)
  overrides: AssessmentOverride[];  // keyed by date; ADR 004
  decisions: DayDecision[];         // keyed by date; ADR 004
  settings: Settings;               // locale, reminder times (JST 'HH:mm'), effort preference, horizon
  reminders: { scheduled: ScheduledJobRef[]; acknowledged: string[] }; // ADR 004 §4
};

type SyncMeta = {                   // on every record (profile, menu, override, decision, settings)
  id: string;                       // UUID (decisions/overrides: `${kind}:${date}` so one per date)
  ownerId: 'local';                 // v1: the family id
  createdAt: number;                // Instant (epoch ms UTC) from the Clock port
  updatedAt: number;
  updatedBy: string;                // deviceId; v1: memberId
  deletedAt?: number;               // tombstone instead of hard delete (except delete-all)
};
```
Everything is validated by the zod schema in `src/domain/schema/app-state.ts` on **load, before save, and on import**. Child data never leaves the device except through the parent's explicit export or the share text (which contains no profile data, brief §13).

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
- Export file: `{ app: 'BentoMinder', schemaVersion, exportedAt, state }`. Web: download via a Blob link; Android: write to cache with Filesystem + open the share sheet (ADR 005 confirms). Contains the child profile, so the UI says so before export.
- Import: parse → check `app` → migrate → validate → show a summary ("profile, 2 months of menus, 14 plans") → confirm → replace the whole state → reconcile reminders. Merge-import is **not** in the MVP (it is the same problem as sync).

## Delete all
Settings → "Delete all data": confirmation dialog → `NotificationScheduler.cancelAll()` → `storage.remove()` for all keys → in-memory reset → onboarding. Also used by the debug panel's "clear local data". QA asserts no `bentominder.*` keys remain and no reminder fires afterwards.

## v1 sync seam (noted, not built)
- **Ownership**: `ownerId` becomes the family id; `updatedBy` the member id. Local data is offered for upload on first sign-in (`backend-integration` §1).
- **Granularity**: the unit of sync is a record (profile, menu month, a date's decision, a date's override, settings), not the whole document. Decisions/overrides already have one record per date with a deterministic id, so two devices editing the same date collide on the same id instead of creating duplicates.
- **Conflict policy (proposal for the v1 ADR)**: last-writer-wins per record by `updatedAt`, **except** decisions: if both devices changed the same date since the last sync and the results differ, keep both and ask the parent ("Mom planned a bento, Dad set school lunch"); a decision never silently reverts to school lunch. Tombstones (`deletedAt`) propagate deletes. Clock skew is handled by the server stamping `updatedAt` on receipt.
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
- v1 family sync is approved → a new ADR for the backend and the conflict policy above; the `SyncMeta` fields are already there.
- Android testing shows Preferences write latency > 50 ms for the document → split into per-area keys.
