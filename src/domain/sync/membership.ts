// Contract 14.7: what the local copy and the sync metadata become when membership starts or ends. Pure.
import { toJstTimestamp, type Instant } from '../time/jst.ts';
import type { BentoMinderStore } from '../schema/store.ts';
import { emptySyncMeta, type SyncMeta } from './meta.ts';
import { withAccountOwner, withFamilyOwner } from './owner.ts';

/** Create or join: `ownerId` of every record becomes the family id; the metadata records the family and the consent. */
export function startMembership(input: {
  store: BentoMinderStore;
  meta: SyncMeta;
  familyId: string;
  consentVersion: number;
  nowMs: number;
}): { store: BentoMinderStore; meta: SyncMeta } {
  return {
    store: withFamilyOwner(input.store, input.familyId),
    meta: {
      ...input.meta,
      familyId: input.familyId,
      consent: { version: input.consentVersion, at: toJstTimestamp(input.nowMs as Instant) },
      cursor: 0,
      baselines: {},
      pending: {},
    },
  };
}

/**
 * Leave, removal or family deleted (US-E15-08, US-E15-11/AC3): the local copy stays as stand-alone with `ownerId` = the
 * uid, the family id, cursor, baselines and queue are dropped, the safety copy keeps its own expiry. The caller
 * never creates a family again because of this (contract 14.7).
 */
export function endMembership(store: BentoMinderStore, meta: SyncMeta, uid: string): { store: BentoMinderStore; meta: SyncMeta } {
  return {
    store: withAccountOwner(store, uid),
    meta: { ...emptySyncMeta(), safety: meta.safety },
  };
}
