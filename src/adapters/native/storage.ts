// Storage native adapter (ADR 003, ADR 005 §3): the same read/write/remove contract as the web adapter, backed by
// Capacitor Preferences (Android SharedPreferences), which the system does not clear the way it may clear WebView
// storage. Data written by an earlier run into the WebView's localStorage is adopted without loss:
// a read that finds nothing in Preferences reads localStorage, copies the value into Preferences, checks the copy,
// and only then removes the localStorage entry. If the copy fails the localStorage value is still returned and kept.
// `remove` clears both places so a removed key can never come back through the fallback.
import type { Storage, StorageKey } from '../../domain/ports.ts';
import type { PreferencesPlugin } from './plugins.ts';

export function createNativeStorage(preferences: PreferencesPlugin, legacy: Pick<globalThis.Storage, 'getItem' | 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): Storage {
  const legacyGet = (key: string): string | null => {
    try {
      return legacy?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const legacyRemove = (key: string) => {
    try {
      legacy?.removeItem(key);
    } catch {
      // nothing to do: it is only a leftover
    }
  };
  return {
    async read(key: StorageKey) {
      const { value } = await preferences.get({ key });
      if (value !== null) return value;
      const old = legacyGet(key);
      if (old === null) return null;
      try {
        await preferences.set({ key, value: old });
        if ((await preferences.get({ key })).value === old) legacyRemove(key);
      } catch {
        // keep the legacy copy; the next read tries again
      }
      return old;
    },
    async write(key: StorageKey, value: string) {
      try {
        await preferences.set({ key, value });
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    async remove(key: StorageKey) {
      await preferences.remove({ key });
      legacyRemove(key);
    },
  };
}
