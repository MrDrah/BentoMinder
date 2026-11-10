// US-E15-11/AC6: an imported file replaces the family's data. The file's records are re-labelled for the family and stamped
// "now", so on every other device they win over what the family holds; records the file lacks are tombstoned by the normal
// change detection (their baselines are absent from the new store). Pure.
import type { BentoMinderStore } from '../schema/store.ts';
import { withFamilyOwner } from './owner.ts';

/**
 * `ownerId` becomes the family id, `updatedAt` of every synced record and of the store becomes `nowIso`, and the device id
 * stays this device's own (it is the tie-breaker and `updatedBy` inside the family, so two devices must never share one,
 * contract 14.2). Device-only settings (language, theme), the reminder log and the rest of the file are kept as imported.
 */
export function prepareFamilyImport(input: { imported: BentoMinderStore; deviceId: string; familyId: string; nowIso: string }): BentoMinderStore {
  const { nowIso } = input;
  const owned = withFamilyOwner(input.imported, input.familyId);
  const stamp = <T extends { createdAt: string; updatedAt: string }>(r: T): T => ({
    ...r,
    createdAt: Date.parse(r.createdAt) > Date.parse(nowIso) ? nowIso : r.createdAt,
    updatedAt: nowIso,
  });
  const each = <T extends { createdAt: string; updatedAt: string }>(o: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, stamp(v)]));
  return {
    ...owned,
    deviceId: input.deviceId,
    updatedAt: nowIso,
    profile: owned.profile === null ? null : stamp(owned.profile),
    settings: stamp(owned.settings),
    menus: each(owned.menus),
    overrides: each(owned.overrides),
    decisions: each(owned.decisions),
  };
}
