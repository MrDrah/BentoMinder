// The Firestore counter store (functions/src/firestore-limits.ts) against a minimal fake database with real
// transaction semantics (optimistic retry), shared by several "instances". No emulator, no Google.
import { describe, expect, it } from 'vitest';
import { createFirestoreStore, LIMITS_COLLECTION, type DbLike, type DocRefLike, type SnapshotLike, type TransactionLike } from '../../../functions/src/firestore-limits.ts';
import { accountKey, DEFAULT_LIMITS, reserve, type AccountCounters } from '../../../server/core/hosted-policy.ts';
import { auth, EXTRACT_QUERY, NOW, PDF, rig, send } from '../server/hosted/harness.ts';

/** A tiny optimistic-concurrency database: a transaction re-runs when another commit touched its document first. */
class FakeDb implements DbLike {
  docs = new Map<string, unknown>();
  versions = new Map<string, number>();
  paths: string[] = [];
  reads = 0;
  writes = 0;
  failRead = false;
  failWrite = false;
  /** Run before each commit, to simulate a concurrent instance. */
  beforeCommit: (() => void) | null = null;
  retries = 0;
  collection(name: string) {
    return { doc: (id: string): DocRefLike => ({ id: `${name}/${id}` }) };
  }
  async runTransaction<T>(fn: (tx: TransactionLike) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const seen = new Map<string, number>();
      const staged = new Map<string, unknown>();
      const tx: TransactionLike = {
        get: (ref): Promise<SnapshotLike> => {
          this.reads += 1;
          if (this.failRead) return Promise.reject(new Error('UNAVAILABLE'));
          const id = ref.id!;
          seen.set(id, this.versions.get(id) ?? 0);
          const data = this.docs.get(id);
          return Promise.resolve({ exists: data !== undefined, data: () => (data === undefined ? undefined : structuredClone(data)) });
        },
        set: (ref, data) => {
          staged.set(ref.id!, structuredClone(data));
        },
      };
      const value = await fn(tx);
      this.beforeCommit?.();
      if ([...seen].some(([id, v]) => (this.versions.get(id) ?? 0) !== v)) {
        this.retries += 1;
        continue;
      }
      if (this.failWrite) throw new Error('PERMISSION_DENIED');
      for (const [id, data] of staged) {
        this.docs.set(id, data);
        this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
        this.paths.push(id);
        this.writes += 1;
      }
      return value;
    }
    throw new Error('ABORTED');
  }
}

const key = accountKey('test-uid-001');

describe('US-E14-03/AC5 counters survive restarts and are shared by all instances', () => {
  it('US-E14-03/AC5 5 extractions through one instance, then the 6th through a fresh instance (cold start) is refused', async () => {
    const db = new FakeDb();
    for (let i = 0; i < 5; i += 1) expect((await reserve(createFirestoreStore(db), key, 'extract', NOW + i, DEFAULT_LIMITS)).ok).toBe(true);
    const fresh = createFirestoreStore(db); // another instance: no memory of the first, same database
    expect(await reserve(fresh, key, 'extract', NOW + 10, DEFAULT_LIMITS)).toMatchObject({ ok: false, scope: 'hour' });
  });

  it('US-E14-03/AC5 two instances racing for the last slot: the transaction retries and exactly one wins', async () => {
    const db = new FakeDb();
    const a = createFirestoreStore(db);
    const b = createFirestoreStore(db);
    for (let i = 0; i < 4; i += 1) await reserve(a, key, 'extract', NOW + i, DEFAULT_LIMITS);
    let injected = false;
    db.beforeCommit = () => {
      if (injected) return;
      injected = true; // instance B commits between A's read and A's commit
      db.beforeCommit = null;
      void reserve(b, key, 'extract', NOW + 5, DEFAULT_LIMITS);
    };
    const results = await Promise.all([reserve(a, key, 'extract', NOW + 6, DEFAULT_LIMITS)]);
    await new Promise((r) => setTimeout(r, 0));
    const final = db.docs.get(`${LIMITS_COLLECTION}/${key}`) as AccountCounters;
    expect(final.extract?.hour).toHaveLength(5); // never 6: no over-issue
    expect(results).toHaveLength(1);
    expect(db.retries).toBeGreaterThanOrEqual(1);
  });

  it('US-E14-03/AC1 counters are per account and per endpoint: another account and the other endpoint are unaffected', async () => {
    const db = new FakeDb();
    const s = createFirestoreStore(db);
    for (let i = 0; i < 5; i += 1) await reserve(s, key, 'extract', NOW + i, DEFAULT_LIMITS);
    expect((await reserve(s, key, 'extract', NOW + 9, DEFAULT_LIMITS)).ok).toBe(false);
    expect((await reserve(s, accountKey('test-uid-002'), 'extract', NOW + 9, DEFAULT_LIMITS)).ok).toBe(true);
    expect((await reserve(s, key, 'fetch', NOW + 9, DEFAULT_LIMITS)).ok).toBe(true);
  });
});

describe('US-E14-03/AC7 limit state holds no menu content or personal data', () => {
  it('US-E14-03/AC7 the document id is the pseudonymous key and the document holds only counts and timestamps', async () => {
    const db = new FakeDb();
    const s = createFirestoreStore(db);
    await reserve(s, key, 'extract', NOW, DEFAULT_LIMITS);
    await reserve(s, key, 'fetch', NOW, DEFAULT_LIMITS);
    expect([...db.docs.keys()]).toEqual([`${LIMITS_COLLECTION}/${key}`]);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain('test-uid-001');
    const doc = db.docs.get(`${LIMITS_COLLECTION}/${key}`) as AccountCounters;
    expect(Object.keys(doc).sort()).toEqual(['extract', 'fetch']);
    for (const state of [doc.extract!, doc.fetch!]) {
      expect(Object.keys(state).sort()).toEqual(['dayCount', 'dayKey', 'hour']);
      expect(state.hour.every((n) => typeof n === 'number')).toBe(true);
      expect(state.dayKey).toBe('2026-11-10');
    }
    expect(JSON.stringify(doc)).not.toMatch(/example\.test|test-uid|%PDF/);
  });

  it('US-E14-03/AC7 the stored hour list stays small (at most the hourly limit)', async () => {
    const db = new FakeDb();
    const s = createFirestoreStore(db);
    for (let i = 0; i < 30; i += 1) await reserve(s, key, 'fetch', NOW + i * 1000, DEFAULT_LIMITS);
    const doc = db.docs.get(`${LIMITS_COLLECTION}/${key}`) as AccountCounters;
    expect(doc.fetch!.hour.length).toBeLessThanOrEqual(DEFAULT_LIMITS.fetch.perHour);
  });
});

describe('US-E14-03/AC8 a failed counter does not become unlimited', () => {
  it.each([
    ['a read failure', (db: FakeDb) => (db.failRead = true)],
    ['a write failure', (db: FakeDb) => (db.failWrite = true)],
  ])('US-E14-03/AC8 %s refuses the request with 503 UNAVAILABLE, 0 provider calls and 0 outbound fetches', async (_l, break_) => {
    const db = new FakeDb();
    const r = rig();
    r.deps.policy!.store = createFirestoreStore(db);
    break_(db);
    const e = await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF, headers: auth('tok-alice') });
    expect(e.res.status).toBe(503);
    expect(e.json()).toEqual({ ok: false, error: 'UNAVAILABLE', providerCalls: 0 });
    const f = await send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url: 'https://example-kinder.test/a.pdf' }), headers: auth('tok-alice') });
    expect(f.res.status).toBe(503);
    expect(r.providerCalls).toHaveLength(0);
    expect(r.fetches).toHaveLength(0);
  });

  it('US-E14-03/AC8 a malformed stored document fails closed instead of resetting the count', async () => {
    const db = new FakeDb();
    db.docs.set(`${LIMITS_COLLECTION}/${key}`, { extract: { hour: 'x', dayKey: 3 } });
    await expect(reserve(createFirestoreStore(db), key, 'extract', NOW, DEFAULT_LIMITS)).rejects.toThrow();
    db.docs.set(`${LIMITS_COLLECTION}/${key}`, 'not an object');
    await expect(reserve(createFirestoreStore(db), key, 'extract', NOW, DEFAULT_LIMITS)).rejects.toThrow();
  });
});

describe('US-E14-03/AC2 the real store behind the core: the 6th request is refused before the provider', () => {
  it('US-E14-03/AC2 five extractions pass, the sixth is 429 ACCOUNT_LIMIT hour with providerCalls 0', async () => {
    const db = new FakeDb();
    const r = rig();
    r.deps.policy!.store = createFirestoreStore(db);
    for (let i = 0; i < 5; i += 1) {
      const c = await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF, headers: auth('tok-alice') });
      expect(c.res.status).toBe(200);
    }
    const before = r.providerCalls.length;
    const c = await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF, headers: auth('tok-alice') });
    expect(c.res.status).toBe(429);
    expect(c.json()).toMatchObject({ error: 'ACCOUNT_LIMIT', scope: 'hour', providerCalls: 0 });
    expect(r.providerCalls).toHaveLength(before);
    expect((db.docs.values().next().value as AccountCounters).extract?.hour).toHaveLength(5); // the refused request was not counted
  });
});
