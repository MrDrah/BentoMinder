// ADR 014 / data contract 12.2: account-keyed storage keys. Pure.
import type { StorageKey } from '../ports.ts';

export const LEGACY_STATE_KEY: StorageKey = 'bentominder.state';
export const LEGACY_PREV_KEY: StorageKey = 'bentominder.state.prev';

export interface StoreKeys {
  state: StorageKey;
  prev: StorageKey;
}

/** A Firebase uid is used verbatim in key names: non-blank, at most 128 characters, no `.` and no whitespace. */
export function isValidUid(uid: unknown): uid is string {
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !/[.\s]/.test(uid);
}

export const LEGACY_KEYS: StoreKeys = { state: LEGACY_STATE_KEY, prev: LEGACY_PREV_KEY };

/** `undefined` = the legacy unkeyed pair (not-signed-in code paths until the app is wired to accounts). */
export function storeKeysFor(uid?: string): StoreKeys {
  if (uid === undefined) return LEGACY_KEYS;
  if (!isValidUid(uid)) throw new Error('invalid-uid');
  return { state: `bentominder.${uid}.state`, prev: `bentominder.${uid}.state.prev` };
}
