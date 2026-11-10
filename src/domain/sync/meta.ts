// ADR 016 section 4 / contract 14.2: the device-side sync metadata, kept apart from the store under
// `bentominder.<uid>.sync` (never exported, never part of `BentoMinderStore`). Type and (de)serialisation only;
// the engine and the UI wiring that read and write it arrive in slice C.
import { z } from 'zod';
import type { StorageKey } from '../ports.ts';
import { isValidUid } from '../storage/keys.ts';
import type { RecordKey } from './types.ts';

export const SYNC_META_VERSION = 1;

export function syncMetaKey(uid: string): StorageKey {
  if (!isValidUid(uid)) throw new Error('invalid-uid');
  return `bentominder.${uid}.sync`;
}

/** The pre-join safety copy: the raw previous store text (ADR 016 section 4); listed so delete-all can remove it. */
export function safetyCopyKey(uid: string): StorageKey {
  if (!isValidUid(uid)) throw new Error('invalid-uid');
  return `bentominder.${uid}.safety`;
}

export interface Baseline {
  /** Hash of the record's canonical payload as last synced; '' for a tombstone. */
  hash: string;
  /** `updatedAt` of the last synced version. */
  updatedAt: string;
  deleted?: true;
}

export interface SyncMeta {
  version: typeof SYNC_META_VERSION;
  /** Null while the account is not in a family. */
  familyId: string | null;
  /** Cached cloud-sharing consent (14.5). */
  consent: { version: number; at: string } | null;
  /** Server sequence number up to which this device has pulled. */
  cursor: number;
  lastSyncedAt: string | null;
  baselines: Record<RecordKey, Baseline>;
  /** When a tombstone was first noticed (ms): its stamp stays fixed while the push is deferred. */
  pending: Record<RecordKey, number>;
  /** US-E15-04/AC11: asked once per device and family; `done` false = interrupted. */
  adoption: { familyId: string; choice: 'use-family' | 'add-device' | 'upload' | 'download'; done: boolean } | null;
  safety: { createdAt: string } | null;
}

/**
 * US-E15-04/AC4, AC11: a member device whose first download has not been decided yet. Written the moment the member is added,
 * before any download; `choice: 'download'` with `done: false` is the marker. The engine never pushes while `done` is false.
 */
export const joinUnsettled = (m: SyncMeta): boolean => m.familyId !== null && m.adoption !== null && !m.adoption.done && m.adoption.choice === 'download';

/** The adoption question (default keep family) is owed and still open. */
export const questionOpen = (m: SyncMeta): boolean => m.familyId !== null && m.adoption !== null && !m.adoption.done && m.adoption.choice !== 'download';

export function emptySyncMeta(): SyncMeta {
  return {
    version: SYNC_META_VERSION,
    familyId: null,
    consent: null,
    cursor: 0,
    lastSyncedAt: null,
    baselines: {},
    pending: {},
    adoption: null,
    safety: null,
  };
}

const syncMetaSchema = z.strictObject({
  version: z.literal(SYNC_META_VERSION),
  familyId: z.string().min(1).nullable(),
  consent: z.strictObject({ version: z.number().int().min(1), at: z.string() }).nullable(),
  cursor: z.number().int().min(0),
  lastSyncedAt: z.string().nullable(),
  baselines: z.record(
    z.string(),
    z.strictObject({ hash: z.string(), updatedAt: z.string(), deleted: z.literal(true).optional() }),
  ),
  pending: z.record(z.string(), z.number()),
  adoption: z
    .strictObject({ familyId: z.string(), choice: z.enum(['use-family', 'add-device', 'upload', 'download']), done: z.boolean() })
    .nullable(),
  safety: z.strictObject({ createdAt: z.string() }).nullable(),
});

export type ParsedSyncMeta =
  | { kind: 'empty' }
  | { kind: 'ok'; meta: SyncMeta }
  /** An unreadable document: the caller treats the device as having no baselines (a first sync is safe, see adoption). */
  | { kind: 'corrupt' }
  /** A newer app wrote it: sync is paused with `paused-app-too-old` and the document is left untouched. */
  | { kind: 'too-new'; version: number };

export function serializeSyncMeta(meta: SyncMeta): string {
  return JSON.stringify(meta);
}

export function parseSyncMeta(raw: string | null): ParsedSyncMeta {
  if (raw === null) return { kind: 'empty' };
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return { kind: 'corrupt' };
  }
  if (typeof doc === 'object' && doc !== null && 'version' in doc) {
    const v = (doc as { version: unknown }).version;
    if (typeof v === 'number' && v > SYNC_META_VERSION) return { kind: 'too-new', version: v };
  }
  const parsed = syncMetaSchema.safeParse(doc);
  return parsed.success ? { kind: 'ok', meta: parsed.data as SyncMeta } : { kind: 'corrupt' };
}
