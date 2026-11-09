// Per-account counters in Firestore (ADR 015 §3): one document per pseudonymous account key, updated in a
// transaction (the SDK retries on contention). The SDK object is passed in as `DbLike`; this file names no
// Google SDK. Any read/write/transaction failure rejects, which the core turns into 503 UNAVAILABLE.
import type { AccountCounters, CounterStore, EndpointState } from '../../server/core/hosted-policy.ts';

export const LIMITS_COLLECTION = 'proxyLimits';

export interface SnapshotLike {
  exists: boolean;
  data(): unknown;
}
export interface DocRefLike {
  readonly id?: string;
}
export interface TransactionLike {
  get(ref: DocRefLike): Promise<SnapshotLike>;
  set(ref: DocRefLike, data: AccountCounters): unknown;
}
export interface DbLike {
  collection(name: string): { doc(id: string): DocRefLike };
  runTransaction<T>(fn: (tx: TransactionLike) => Promise<T>): Promise<T>;
}

const isNumbers = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n));

function readState(v: unknown): EndpointState | undefined {
  if (v === undefined) return undefined;
  const s = v as Partial<EndpointState> | null;
  if (s === null || typeof s !== 'object' || !isNumbers(s.hour) || typeof s.dayKey !== 'string' || typeof s.dayCount !== 'number' || !Number.isFinite(s.dayCount)) {
    throw new TypeError('malformed counter state'); // fail closed rather than reset a count
  }
  return { hour: s.hour, dayKey: s.dayKey, dayCount: s.dayCount };
}

function readCounters(snap: SnapshotLike): AccountCounters | undefined {
  if (!snap.exists) return undefined;
  const d = snap.data() as { extract?: unknown; fetch?: unknown } | undefined;
  if (d === undefined || d === null || typeof d !== 'object') throw new TypeError('malformed counter document');
  const out: AccountCounters = {};
  const extract = readState(d.extract);
  const fetch = readState(d.fetch);
  if (extract !== undefined) out.extract = extract;
  if (fetch !== undefined) out.fetch = fetch;
  return out;
}

export function createFirestoreStore(db: DbLike): CounterStore {
  return {
    update: (accountKey, fn) =>
      db.runTransaction(async (tx) => {
        const ref = db.collection(LIMITS_COLLECTION).doc(accountKey);
        const { next, value } = fn(readCounters(await tx.get(ref))); // may run again if the transaction retries: `fn` is pure
        tx.set(ref, next); // counts and timestamps only (US-E14-03/AC7)
        return value;
      }),
  };
}
