// Web Storage adapter (ADR 003): localStorage, the only module allowed to touch it.
// Errors (private mode, quota) propagate so the app can show 「この端末に保存できません」.
import type { Storage, StorageKey } from '../../domain/ports.ts';

export function createWebStorage(backend: globalThis.Storage = window.localStorage): Storage {
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
    remove(key: StorageKey) {
      backend.removeItem(key);
      return Promise.resolve();
    },
  };
}
