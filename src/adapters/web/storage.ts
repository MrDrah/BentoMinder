// Web Storage adapter (ADR 003): localStorage, the only module allowed to touch it.
// Errors (private mode, quota) propagate so the app can show 「この端末に保存できません」.
import type { Storage, StorageKey } from '../../domain/ports.ts';
import { storeKeysFor } from '../../domain/storage/keys.ts';

/**
 * ADR 014: the key to watch for other tabs comes from the account (`bentominder.<uid>.state`), not from a
 * global constant. Without `accountId` it is the legacy unkeyed key (not-signed-in code paths).
 */
export function createWebStorage(backend: globalThis.Storage = window.localStorage, accountId?: string): Storage {
  const watched = storeKeysFor(accountId).state;
  return {
    read(key: StorageKey) {
      return Promise.resolve(backend.getItem(key));
    },
    write(key: StorageKey, value: string) {
      try {
        backend.setItem(key, value);
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    },
    onExternalChange(handler: () => void) {
      // The `storage` event fires only in the other documents sharing the origin, never in the writer.
      const listener = (event: StorageEvent) => {
        // key === null means clear(); a storage area filter keeps unrelated windows out.
        if (event.storageArea !== null && event.storageArea !== backend) return;
        if (event.key === null || event.key === watched) handler();
      };
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    },
    remove(key: StorageKey) {
      backend.removeItem(key);
      return Promise.resolve();
    },
  };
}
