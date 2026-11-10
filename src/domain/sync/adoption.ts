// Contract 14.4: first sync and adoption of the local data (US-E15-01/AC3, US-E15-04/AC3-AC7, US-E15-05/AC6).
// Pure: the decision matrix, the two ways to combine a device's data with the family's, and the safety copy's life.
import { toJstTimestamp, type Instant } from '../time/jst.ts';
import type { BentoMinderStore } from '../schema/store.ts';
import { SYNC_LIMITS, DAY_MS } from './config.ts';
import { hashString } from './hash.ts';
import type { Baseline, SyncMeta } from './meta.ts';
import { withFamilyOwner } from './owner.ts';
import { applyEnvelopes, extractRecords } from './records.ts';
import type { RecordKey, StoredEnvelope } from './types.ts';

/** "Has data" (14.4): a profile, or at least one menu month, decision or override. Defaults-only settings do not count. */
export function hasData(store: BentoMinderStore): boolean {
  return (
    store.profile !== null ||
    Object.keys(store.menus).length > 0 ||
    Object.keys(store.decisions).length > 0 ||
    Object.keys(store.overrides).length > 0
  );
}

export type FirstSyncPlan = 'upload' | 'download' | 'ask';

/**
 * The matrix of contract 14.4 for a join or a further device. Both empty: nothing to do (`download` is a no-op).
 * Local data and an empty family: upload without a question. Local empty: download without a question.
 * Both have data: ask once (default keep family).
 */
export function planFirstSync(localHasData: boolean, familyHasData: boolean): FirstSyncPlan {
  if (!localHasData) return 'download';
  return familyHasData ? 'ask' : 'upload';
}

/** The family "has data" when any live profile, menu, decision or override record exists (tombstones and settings do not count). */
export function familyHasData(records: readonly StoredEnvelope[]): boolean {
  return records.some((r) => r.deletedAt === undefined && r.kind !== 'settings' && r.kind !== 'aiUsage');
}

export type AdoptionChoice = 'use-family' | 'add-device';

export interface AdoptionOutcome {
  store: BentoMinderStore;
  /** Baselines for everything that is in sync with the family after the adoption (nothing here is re-uploaded). */
  baselines: Record<RecordKey, Baseline>;
  /** Device records the family lacked: they have no baseline, so the next push uploads exactly these (AC6). */
  added: RecordKey[];
}

/**
 * Combines the device's store with the family's records (`family` = everything the family holds, tombstones included).
 * - use-family (a): the device's records are replaced by the family's; device-only fields stay; nothing is uploaded.
 * - add-device (b): the family's records win for every key it has (also a tombstone, and profile and settings, never
 *   merged field by field); menu months, overrides and decisions (and a profile or settings the family lacks) are added;
 *   an aiUsage count is the larger of the two.
 * The caller writes the safety copy of the previous store first (`safetyCopyDue`).
 */
export function adoptFamilyData(input: {
  local: BentoMinderStore;
  family: readonly StoredEnvelope[];
  choice: AdoptionChoice;
  familyId: string;
  nowMs: number;
}): AdoptionOutcome {
  const { family, choice, familyId, nowMs } = input;
  let local = withFamilyOwner(input.local, familyId);
  const familyByKey = new Map<RecordKey, StoredEnvelope>(family.map((e) => [`${e.kind}_${e.key}`, e]));

  if (choice === 'use-family') {
    local = { ...local, profile: null, menus: {}, overrides: {}, decisions: {}, aiUsage: {} };
  }
  const toApply = family.filter((e) => {
    if (choice === 'use-family' || e.kind !== 'aiUsage' || e.payloadJson === undefined) return true;
    const mine = local.aiUsage[e.key];
    const theirs = (JSON.parse(e.payloadJson) as { count: number }).count;
    return mine === undefined || theirs >= mine;
  });
  const applied = applyEnvelopes(local, toApply, { ownerId: familyId });
  const store = applied.store;

  const baselines: Record<RecordKey, Baseline> = {};
  const added: RecordKey[] = [];
  const nowStamp = toJstTimestamp(nowMs as Instant);
  for (const [key, rec] of extractRecords(store)) {
    const fam = familyByKey.get(key);
    const quarantined = applied.quarantined.some((q) => q.key === key);
    const familyDecided = fam !== undefined && !quarantined && !(fam.kind === 'aiUsage' && !toApply.includes(fam));
    if (!familyDecided && choice === 'add-device') {
      added.push(key);
      continue;
    }
    baselines[key] = { hash: hashString(rec.payloadJson), updatedAt: familyDecided ? fam.updatedAt : (rec.ownUpdatedAt ?? nowStamp) };
  }
  // A tombstone the family holds for a key the device lacks is already in sync: remember it.
  for (const [key, fam] of familyByKey) {
    if (fam.deletedAt !== undefined && !(key in baselines)) baselines[key] = { hash: '', updatedAt: fam.updatedAt, deleted: true };
  }
  return { store, baselines, added: added.sort() };
}

/** The question of US-E15-04/AC4 is asked once per device and family; an interrupted adoption resumes without asking again (AC11). */
export function adoptionQuestionNeeded(meta: Pick<SyncMeta, 'adoption'>, familyId: string): boolean {
  return meta.adoption === null || meta.adoption.familyId !== familyId;
}

/** A join that was started but not finished (US-E15-04/AC11): the app continues it at the next open. */
export function adoptionInterrupted(meta: Pick<SyncMeta, 'adoption'>, familyId: string): boolean {
  return meta.adoption !== null && meta.adoption.familyId === familyId && !meta.adoption.done;
}

/** Contract 14.4: the safety copy lives until the parent deletes it or 30 days, whichever is first. */
export function safetyCopyExpired(createdAtIso: string, nowMs: number): boolean {
  return nowMs - Date.parse(createdAtIso) >= SYNC_LIMITS.safetyCopyDays * DAY_MS;
}
