// In-memory Storage port fake (ADR 003) with optional write failure (quota / private mode).
import type { Clock, Storage, StorageKey } from '../../../src/domain/ports.ts';
import type { Instant } from '../../../src/domain/time/jst.ts';

export interface MemoryStorage extends Storage {
  data: Map<StorageKey, string>;
  writes: number;
  failWrites: boolean;
}

export function memoryStorage(initial: Partial<Record<StorageKey, string>> = {}): MemoryStorage {
  const data = new Map<StorageKey, string>(Object.entries(initial) as [StorageKey, string][]);
  const store: MemoryStorage = {
    data,
    writes: 0,
    failWrites: false,
    read: (key) => Promise.resolve(data.get(key) ?? null),
    write: (key, value) => {
      if (store.failWrites) return Promise.reject(new Error('QuotaExceededError'));
      store.writes += 1;
      data.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
  return store;
}

export function fixedClock(iso: string): Clock {
  const t = Date.parse(iso) as Instant;
  return { now: () => t };
}
