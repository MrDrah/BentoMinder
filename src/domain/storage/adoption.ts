// ADR 014 / US-E13-04/AC1-AC2: the one-time adoption of the legacy unkeyed store by the FIRST account
// that signs in. After it the legacy keys are gone, so any later account finds nothing to adopt.
import type { Clock, Storage } from '../ports.ts';
import { createRepository, validateStore } from './repository.ts';
import { isValidUid, LEGACY_KEYS, storeKeysFor } from './keys.ts';
import { rewriteOwnerId } from './owner.ts';

export type AdoptionResult =
  | { kind: 'adopted' }
  /** No legacy data (a new device, or already adopted by an earlier account): this account starts as stored. */
  | { kind: 'none' }
  /** This account already has data; the legacy keys, if still there, are not touched (unless a leftover of this very adoption). */
  | { kind: 'account-has-data'; cleanedLeftover: boolean }
  /** The legacy document cannot be read (corrupt, too new): nothing is moved or deleted. */
  | { kind: 'legacy-unreadable' };

const parse = (raw: string | null): unknown => {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/**
 * Moves the legacy store to `uid`'s keys: ownerId `local` becomes the uid, nothing else changes, and the
 * legacy keys are removed only after the new keys are written and read back equal. Throws on a storage
 * failure with the legacy keys still in place (the caller may retry; a half-written copy is removed first).
 */
export async function adoptLegacyStore(storage: Storage, clock: Clock, uid: string): Promise<AdoptionResult> {
  if (!isValidUid(uid)) throw new Error('invalid-uid');
  const keys = storeKeysFor(uid);
  const legacyRaw = await storage.read(LEGACY_KEYS.state);
  const legacyPrevRaw = await storage.read(LEGACY_KEYS.prev);
  const existing = await storage.read(keys.state);

  if (existing !== null) {
    // A crash between "new keys written" and "legacy keys removed" leaves a copy with the same deviceId:
    // finish the clean-up so another account cannot adopt it later.
    const legacyDoc = parse(legacyRaw) as { deviceId?: unknown } | undefined;
    const mine = parse(existing) as { deviceId?: unknown } | undefined;
    if (legacyDoc?.deviceId !== undefined && legacyDoc.deviceId === mine?.deviceId) {
      await storage.remove(LEGACY_KEYS.state);
      await storage.remove(LEGACY_KEYS.prev);
      return { kind: 'account-has-data', cleanedLeftover: true };
    }
    return { kind: 'account-has-data', cleanedLeftover: false };
  }
  if (legacyRaw === null) return { kind: 'none' };

  // Decode with the repository (migrations, repairs, validation) over the legacy keys, then rewrite owners.
  const legacyDoc = parse(legacyRaw);
  if (legacyDoc === undefined) return { kind: 'legacy-unreadable' };
  const loaded = await createRepository(storage, clock).load();
  if (loaded.kind !== 'ok' && loaded.kind !== 'recovered-from-prev') return { kind: 'legacy-unreadable' };
  const adopted = rewriteOwnerId(loaded.state, uid);
  const checked = validateStore(adopted, uid);
  if (!checked.ok) return { kind: 'legacy-unreadable' };

  const stateText = JSON.stringify(checked.state);
  let prevText: string | null = null;
  if (legacyPrevRaw !== null && loaded.kind === 'ok') {
    const prevDoc = parse(legacyPrevRaw);
    if (prevDoc !== undefined) {
      const prev = validateStore(rewriteOwnerId(prevDoc, uid), uid);
      if (prev.ok) prevText = JSON.stringify(prev.state);
    }
  }

  try {
    await storage.write(keys.state, stateText);
    if (prevText !== null) await storage.write(keys.prev, prevText);
    const back = await storage.read(keys.state);
    const backPrev = prevText === null ? null : await storage.read(keys.prev);
    if (back !== stateText || backPrev !== prevText) throw new Error('adoption-readback-mismatch');
  } catch (err) {
    await storage.remove(keys.state);
    await storage.remove(keys.prev);
    throw err;
  }
  await storage.remove(LEGACY_KEYS.state);
  await storage.remove(LEGACY_KEYS.prev);
  return { kind: 'adopted' };
}
