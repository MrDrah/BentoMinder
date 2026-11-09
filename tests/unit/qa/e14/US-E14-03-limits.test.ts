// QA E14: US-E14-03 per-account limits, from the stories and contract 13.3/13.4 only.
import { describe, expect, it } from 'vitest';
import { accountKey, DEFAULT_LIMITS, type AccountCounters } from '../../../../server/core/hosted-policy.ts';
import { createFirestoreStore, LIMITS_COLLECTION, type DbLike, type SnapshotLike, type TransactionLike } from '../../../../functions/src/firestore-limits.ts';
import { parseLimits } from '../../../../functions/src/hosted-deps.ts';
import { A, B, effects, extract, fetchUrl, NO_EFFECTS, NOW, pdfBytes, QUERY, rig, SerialStore, send, bearer, type Rig } from './rig.ts';

const HOUR = 3_600_000;
const JST_MIDNIGHT_AFTER_NOW = Date.parse('2026-11-10T15:00:00Z'); // 2026-11-11 00:00 JST
const tight = (extractHour: number, extractDay: number, fetchHour = 30, fetchDay = 100) => ({ extract: { perHour: extractHour, perDay: extractDay }, fetch: { perHour: fetchHour, perDay: fetchDay } });

describe('US-E14-03/AC1 defaults and independence', () => {
  it('US-E14-03/AC1 contract 13.4 defaults: extract 5/h 20/day, fetch 30/h 100/day', () => {
    expect(DEFAULT_LIMITS).toEqual({ extract: { perHour: 5, perDay: 20 }, fetch: { perHour: 30, perDay: 100 } });
    expect(parseLimits({})).toEqual(DEFAULT_LIMITS);
  });
  it('US-E14-03/AC1 limits come from configuration; junk values fall back to the default', () => {
    expect(parseLimits({ extractPerHour: 2, extractPerDay: 3, fetchPerHour: 4, fetchPerDay: 6 })).toEqual(tight(2, 3, 4, 6));
    for (const junk of [0, -1, 1.5, NaN, '7', null, undefined, {}, Infinity]) {
      expect(parseLimits({ extractPerHour: junk, extractPerDay: junk, fetchPerHour: junk, fetchPerDay: junk })).toEqual(DEFAULT_LIMITS);
    }
  });
  it('US-E14-03/AC1 one account reaching a limit never affects the other', async () => {
    const r = rig();
    for (let i = 0; i < 5; i++) await extract(r, 'tok-a');
    expect((await extract(r, 'tok-a')).res.status).toBe(429);
    expect((await extract(r, 'tok-b')).res.status).toBe(200);
  });
  it('US-E14-03/AC1 extract and fetch have separate counters', async () => {
    const r = rig();
    for (let i = 0; i < 5; i++) await extract(r, 'tok-a');
    expect((await extract(r, 'tok-a')).res.status).toBe(429);
    expect((await fetchUrl(r, 'https://example-kinder.test/m.pdf', 'tok-a')).res.status).toBe(200);
    for (let i = 0; i < 29; i++) await fetchUrl(r, 'https://example-kinder.test/m.pdf', 'tok-a');
    expect((await fetchUrl(r, 'https://example-kinder.test/m.pdf', 'tok-a')).json).toMatchObject({ error: 'ACCOUNT_LIMIT', scope: 'fetch' });
    expect((await extract(r, 'tok-a')).json['error']).toBe('ACCOUNT_LIMIT'); // still limited, unchanged
  });
});

describe('US-E14-03/AC2 hour limit', () => {
  it('US-E14-03/AC2 the 6th extract in an hour: 429 ACCOUNT_LIMIT scope hour, retryAfterSec, providerCalls 0, PDF not forwarded', async () => {
    const r = rig();
    for (let i = 0; i < 5; i++) expect((await extract(r)).res.status).toBe(200);
    const before = r.provider.calls.length;
    const c = await extract(r);
    expect(c.res.status).toBe(429);
    expect(c.json).toEqual({ ok: false, error: 'ACCOUNT_LIMIT', scope: 'hour', retryAfterSec: 3600, providerCalls: 0 });
    expect(r.provider.calls.length).toBe(before);
  });
  it('US-E14-03/AC2 retryAfterSec = seconds until the OLDEST counted request leaves the window (rolling), at least 1', async () => {
    const r = rig();
    const t0 = NOW;
    for (const dt of [0, 10 * 60_000, 20 * 60_000, 30 * 60_000, 40 * 60_000]) {
      r.clock.now = t0 + dt;
      await extract(r);
    }
    r.clock.now = t0 + 45 * 60_000;
    const c = await extract(r);
    expect(c.json['retryAfterSec']).toBe(15 * 60); // oldest (t0) leaves at t0+60m
    expect(c.res.headers['retry-after']).toBe('900');
    r.clock.now = t0 + HOUR - 1; // 1 ms before the oldest leaves: ceil to 1 s, never 0
    expect((await extract(r)).json['retryAfterSec']).toBe(1);
    r.clock.now = t0 + HOUR; // oldest leaves exactly now
    expect((await extract(r)).res.status).toBe(200);
  });
  it('US-E14-03/AC2 refused requests do not extend the window (hammering does not lock the account out longer)', async () => {
    const r = rig();
    for (let i = 0; i < 5; i++) await extract(r);
    for (let i = 0; i < 50; i++) {
      r.clock.now += 1000;
      expect((await extract(r)).res.status).toBe(429);
    }
    r.clock.now = NOW + HOUR; // 50 s of hammering ago the window opened for the first request
    expect((await extract(r)).res.status).toBe(200);
  });
  it('US-E14-03/AC2 the retry field is an integer >= 1 for every reachable refusal', async () => {
    const r = rig({ limits: tight(2, 3) });
    for (let i = 0; i < 7; i++) {
      r.clock.now += 7_777;
      const c = await extract(r);
      if (c.res.status === 429) {
        expect(Number.isInteger(c.json['retryAfterSec'])).toBe(true);
        expect(c.json['retryAfterSec'] as number).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe('US-E14-03/AC3 daily limit (Tokyo day)', () => {
  it('US-E14-03/AC3 day limit reached, hour not: scope day, retryAfterSec until 00:00 JST, 0 provider calls', async () => {
    const r = rig({ limits: tight(100, 3) });
    for (let i = 0; i < 3; i++) await extract(r);
    const before = r.provider.calls.length;
    const c = await extract(r);
    expect(c.res.status).toBe(429);
    expect(c.json).toEqual({ ok: false, error: 'ACCOUNT_LIMIT', scope: 'day', retryAfterSec: Math.ceil((JST_MIDNIGHT_AFTER_NOW - NOW) / 1000), providerCalls: 0 });
    expect(r.provider.calls.length).toBe(before);
  });
  it('US-E14-03/AC3 when both are reached the reply is one of the two scopes and never a success', async () => {
    const r = rig({ limits: tight(2, 2) });
    await extract(r);
    await extract(r);
    expect((await extract(r)).json['scope']).toMatch(/^(hour|day)$/);
  });
  it('US-E14-03/AC3 the day resets at 00:00 JST (15:00 UTC), not at UTC midnight', async () => {
    const r = rig({ limits: tight(100, 2) });
    r.clock.now = Date.parse('2026-11-10T14:59:59Z'); // 23:59:59 JST
    await extract(r);
    await extract(r);
    expect((await extract(r)).json).toMatchObject({ scope: 'day', retryAfterSec: 1 });
    r.clock.now = Date.parse('2026-11-10T15:00:00Z'); // 00:00:00 JST next day
    expect((await extract(r)).res.status).toBe(200);
    // UTC midnight (09:00 JST) must NOT reset the day
    const r2 = rig({ limits: tight(100, 2) });
    r2.clock.now = Date.parse('2026-11-09T23:30:00Z'); // 08:30 JST
    await extract(r2);
    await extract(r2);
    r2.clock.now = Date.parse('2026-11-10T00:30:00Z'); // 09:30 JST, after UTC midnight, same JST day
    expect((await extract(r2)).json['scope']).toBe('day');
  });
  it('US-E14-03/AC3 fetch day limit reports scope "fetch"', async () => {
    const r = rig({ limits: tight(5, 20, 100, 2) });
    for (let i = 0; i < 2; i++) await fetchUrl(r, 'https://example-kinder.test/m.pdf');
    expect((await fetchUrl(r, 'https://example-kinder.test/m.pdf')).json).toMatchObject({ error: 'ACCOUNT_LIMIT', scope: 'fetch', providerCalls: 0 });
  });
  it('US-E14-03/AC3 retryAfterSec on a refusal never reaches past tomorrow midnight (sanity at 00:00:00 JST exactly)', async () => {
    const r = rig({ limits: tight(100, 1) });
    r.clock.now = Date.parse('2026-11-10T15:00:00Z'); // exactly 00:00 JST
    await extract(r);
    expect((await extract(r)).json['retryAfterSec']).toBe(24 * 3600);
  });
});

describe('US-E14-03/AC5 counters are shared (concurrency, several instances, restarts)', () => {
  it('US-E14-03/AC5 12 concurrent extracts of one account: exactly 5 pass, 7 are refused, provider called only for the 5', async () => {
    const store = new SerialStore();
    store.jitter = true;
    const r = rig({ store });
    const replies = await Promise.all(Array.from({ length: 12 }, () => extract(r)));
    const limited = replies.filter((c) => c.res.status === 429);
    expect(limited.length).toBe(7);
    expect(replies.length - limited.length).toBe(5);
    expect(r.provider.calls.length).toBe(5); // 400 from provider = one call each
  });
  it('US-E14-03/AC5 concurrency across two "instances" sharing one store (and a restart in the middle)', async () => {
    const store = new SerialStore();
    store.jitter = true;
    const i1 = rig({ store });
    const i2 = rig({ store });
    const i3 = rig({ store }); // cold start: a brand new instance, same store
    const replies = await Promise.all([...Array.from({ length: 4 }, () => extract(i1)), ...Array.from({ length: 4 }, () => extract(i2)), ...Array.from({ length: 4 }, () => extract(i3))]);
    expect(replies.filter((c) => c.res.status === 429).length).toBe(7);
    expect(i1.provider.calls.length + i2.provider.calls.length + i3.provider.calls.length).toBe(5);
  });
  it('US-E14-03/AC5 5 requests then a fresh instance: the 6th is refused', async () => {
    const store = new SerialStore();
    const first = rig({ store });
    for (let i = 0; i < 5; i++) await extract(first);
    const restarted = rig({ store });
    expect((await extract(restarted)).json['error']).toBe('ACCOUNT_LIMIT');
  });
  it('US-E14-03/AC5 concurrent mix of two accounts never cross-counts', async () => {
    const store = new SerialStore();
    store.jitter = true;
    const r = rig({ store });
    const replies = await Promise.all([...Array.from({ length: 8 }, () => extract(r, 'tok-a')), ...Array.from({ length: 8 }, () => extract(r, 'tok-b'))]);
    expect(replies.filter((c) => c.res.status === 429).length).toBe(6);
    expect(r.provider.calls.length).toBe(10);
  });
});

describe('US-E14-03/AC6 what counts', () => {
  const stateEmpty = (r: Rig) => expect([...r.store.data.values()]).toEqual([]);
  it('US-E14-03/AC6 refused for token / allow-list / validation does not count', async () => {
    const r = rig();
    await extract(r, 'tok-nope');
    await extract(r, 'tok-stranger');
    await extract(r, 'tok-a', { query: 'targetMonth=2026-13&promptVersion=3&schemaVersion=1' });
    await extract(r, 'tok-a', { query: `${QUERY}&extra=1` });
    await extract(r, 'tok-a', { query: 'targetMonth=2026-11' });
    await extract(r, 'tok-a', { body: new TextEncoder().encode('<html>not a pdf</html>') });
    await extract(r, 'tok-a', { body: new Uint8Array() });
    await extract(r, 'tok-a', { body: new TextEncoder().encode('%PDF') }); // 4 bytes: magic incomplete
    await extract(r, 'tok-a', { body: new Uint8Array(10_485_761).fill(0x25) });
    await send(r, '/api/menu/extract', { query: QUERY, body: pdfBytes(), headers: { ...bearer('tok-a'), 'content-length': '10485761' } });
    stateEmpty(r);
    expect(r.provider.calls.length).toBe(0);
  });
  it('US-E14-03/AC6 over-size and not-a-PDF are answered with providerCalls 0', async () => {
    const r = rig();
    const big = await extract(r, 'tok-a', { body: new Uint8Array(10_485_761).fill(0x25) });
    expect(big.json).toMatchObject({ ok: false, error: 'TOO_LARGE', providerCalls: 0 });
    const html = await extract(r, 'tok-a', { body: new TextEncoder().encode('<html/>') });
    expect(html.json).toMatchObject({ ok: false, error: 'NOT_A_PDF', providerCalls: 0 });
  });
  it('US-E14-03/AC6 exactly 10,485,760 bytes of PDF passes validation and counts', async () => {
    const r = rig();
    const body = new Uint8Array(10_485_760).fill(0x41);
    body.set(new TextEncoder().encode('%PDF-'));
    const c = await extract(r, 'tok-a', { body });
    expect(c.json['error']).not.toBe('TOO_LARGE');
    expect(r.store.data.size).toBe(1);
  });
  it('US-E14-03/AC6 a request that passed validation counts whether or not the provider succeeded (failure, malformed, timeout, 429)', async () => {
    const replies = [
      () => ({ kind: 'http' as const, status: 500, retryAfterSec: null }),
      () => ({ kind: 'ok' as const, text: 'not json at all' }),
      () => ({ kind: 'timeout' as const }),
      () => ({ kind: 'http' as const, status: 429, retryAfterSec: 3 }),
    ];
    for (const reply of replies) {
      const r = rig();
      r.provider.reply = reply;
      await extract(r);
      expect((r.store.data.get(accountKey(A.uid))?.extract?.hour ?? []).length).toBe(1);
    }
  });
  it('US-E14-03/AC6 a limit refusal does not count (state stays at the limit)', async () => {
    const r = rig();
    for (let i = 0; i < 5; i++) await extract(r);
    const before = JSON.stringify([...r.store.data.entries()]);
    for (let i = 0; i < 5; i++) await extract(r);
    expect(JSON.stringify([...r.store.data.entries()])).toBe(before);
  });
  it('US-E14-03/AC6 cost ceiling: at default limits one account causes at most 20 x 2 = 40 provider calls per Tokyo day', async () => {
    const r = rig();
    r.provider.reply = () => ({ kind: 'http', status: 500, retryAfterSec: null }); // worst case: both models called
    for (let h = 0; h < 12; h++) {
      r.clock.now = NOW + h * HOUR; // 12:00 JST .. 23:00 JST, same Tokyo day
      for (let i = 0; i < 5; i++) await extract(r);
    }
    expect(r.provider.calls.length).toBeLessThanOrEqual(40);
    expect(r.provider.calls.length).toBeGreaterThan(0);
  });
  it('US-E14-03/AC6 NOT_CONFIGURED (no provider) answers without counting and without calling anything', async () => {
    const r = rig({ noProvider: true });
    const c = await extract(r);
    expect(c.json['error']).toBe('NOT_CONFIGURED');
    expect(effects(r)).toEqual(NO_EFFECTS);
  });
});

describe('US-E14-03/AC7 stored state holds no menu content or personal data', () => {
  it('US-E14-03/AC7 the stored document is key + counts + timestamps only; key is a 32-hex pseudonym', async () => {
    const r = rig();
    await extract(r, 'tok-a', { body: pdfBytes('MARKER_PDF_TEXT') });
    await fetchUrl(r, 'https://marker-url.example.test/MARKER_PATH.pdf', 'tok-a');
    const dump = JSON.stringify([...r.store.data.entries()]);
    for (const secret of [A.uid, A.email as string, 'tok-a', 'MARKER_PDF_TEXT', 'MARKER_PATH', 'marker-url', 'allowed', 'example']) expect(dump).not.toContain(secret);
    const [key] = [...r.store.data.keys()];
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toBe(accountKey(A.uid));
    expect(accountKey(A.uid)).not.toBe(accountKey(B.uid));
    for (const counters of r.store.data.values()) {
      expect(Object.keys(counters).sort()).toEqual(['extract', 'fetch']);
      for (const st of Object.values(counters)) {
        expect(Object.keys(st).sort()).toEqual(['dayCount', 'dayKey', 'hour']);
        expect(st.dayKey).toBe('2026-11-10');
        expect(st.hour.every((n: unknown) => typeof n === 'number')).toBe(true);
      }
    }
  });
});

describe('US-E14-03/AC8 a failed counter does not become unlimited (fail closed)', () => {
  for (const mode of ['reject', 'throw'] as const) {
    for (const ep of ['extract', 'fetch'] as const) {
      it(`US-E14-03/AC8 ${ep}: store ${mode}s -> 503 UNAVAILABLE providerCalls 0, nothing called, no store text in reply`, async () => {
        const r = rig();
        r.store.failing = mode;
        const c = ep === 'extract' ? await extract(r) : await fetchUrl(r, 'https://example-kinder.test/m.pdf');
        expect(c.res.status).toBe(503);
        expect(c.json).toEqual({ ok: false, error: 'UNAVAILABLE', providerCalls: 0 });
        expect(r.provider.calls).toEqual([]);
        expect(r.net.requests).toEqual([]);
        expect(c.text + r.logs.join('\n')).not.toContain('MARKER_STORE');
      });
    }
  }
  it('US-E14-03/AC8 a store that recovers resumes counting from its real state (no reset)', async () => {
    const r = rig();
    for (let i = 0; i < 5; i++) await extract(r);
    r.store.failing = 'reject';
    expect((await extract(r)).res.status).toBe(503);
    r.store.failing = null;
    expect((await extract(r)).json['error']).toBe('ACCOUNT_LIMIT');
  });
});

describe('US-E14-03/AC9 the provider rate limit stays RATE_LIMITED', () => {
  it('US-E14-03/AC9 both models answer 429: RATE_LIMITED (not ACCOUNT_LIMIT), within-limit account', async () => {
    const r = rig();
    r.provider.reply = () => ({ kind: 'http', status: 429, retryAfterSec: 7 });
    const c = await extract(r);
    expect(c.json['error']).toBe('RATE_LIMITED');
    expect(c.json['scope']).toBeUndefined();
    expect(r.provider.calls.length).toBe(2);
  });
});

// ---- Firestore wrapper against a fake transaction (functions/src/firestore-limits.ts), no Firebase ------------------
class FakeDb implements DbLike {
  docs = new Map<string, unknown>();
  txRuns = 0;
  collections: string[] = [];
  contention = 0; // number of times to "retry" a transaction (run twice, only the last run's writes commit)
  failGet = false;
  failSet = false;
  collection(name: string) {
    this.collections.push(name);
    return { doc: (id: string) => ({ id: `${name}/${id}` }) };
  }
  async runTransaction<T>(fn: (tx: TransactionLike) => Promise<T>): Promise<T> {
    let result!: T;
    for (let attempt = 0; attempt <= this.contention; attempt++) {
      this.txRuns += 1;
      const writes = new Map<string, unknown>();
      const tx: TransactionLike = {
        get: (ref) => {
          if (this.failGet) return Promise.reject(new Error('get failed MARKER_FS'));
          const v = this.docs.get(ref.id as string);
          const snap: SnapshotLike = { exists: v !== undefined, data: () => (v === undefined ? undefined : structuredClone(v)) };
          return Promise.resolve(snap);
        },
        set: (ref, data) => {
          if (this.failSet) throw new Error('set failed MARKER_FS');
          writes.set(ref.id as string, structuredClone(data));
        },
      };
      result = await fn(tx);
      if (attempt === this.contention) for (const [k, v] of writes) this.docs.set(k, v);
    }
    return result;
  }
}

describe('US-E14-03/AC5/AC7/AC8 the Firestore counter wrapper (fake transaction)', () => {
  const key = accountKey(A.uid);
  const bump = (c: AccountCounters | undefined) => ({ next: { ...(c ?? {}), extract: { hour: [...(c?.extract?.hour ?? []), 1], dayKey: '2026-11-10', dayCount: (c?.extract?.dayCount ?? 0) + 1 } }, value: (c?.extract?.dayCount ?? 0) + 1 });
  it('US-E14-03/AC7 one document per pseudonymous key in the proxyLimits collection, only counts and timestamps', async () => {
    const db = new FakeDb();
    await createFirestoreStore(db).update(key, bump);
    expect([...db.docs.keys()]).toEqual([`${LIMITS_COLLECTION}/${key}`]);
    expect(LIMITS_COLLECTION).toBe('proxyLimits');
    expect(JSON.stringify([...db.docs.values()])).not.toMatch(/@|test-uid/);
  });
  it('US-E14-03/AC5 a retried transaction (contention) is counted once, not twice', async () => {
    const db = new FakeDb();
    db.contention = 2;
    const v = await createFirestoreStore(db).update(key, bump);
    expect(v).toBe(1);
    expect(db.txRuns).toBe(3);
    expect((db.docs.get(`${LIMITS_COLLECTION}/${key}`) as AccountCounters).extract?.dayCount).toBe(1);
  });
  it('US-E14-03/AC8 read failure, write failure and a malformed stored document all reject (fail closed), none resets a count', async () => {
    const store = (db: FakeDb) => createFirestoreStore(db);
    const g = new FakeDb();
    g.failGet = true;
    await expect(store(g).update(key, bump)).rejects.toThrow();
    const s = new FakeDb();
    s.failSet = true;
    await expect(store(s).update(key, bump)).rejects.toThrow();
    for (const bad of [{ extract: { hour: 'x', dayKey: 'd', dayCount: 1 } }, { extract: { hour: [1], dayKey: 5, dayCount: 1 } }, { extract: { hour: [1], dayKey: 'd', dayCount: 'many' } }, { extract: null }, { fetch: { hour: [NaN], dayKey: 'd', dayCount: 1 } }, null]) {
      const m = new FakeDb();
      m.docs.set(`${LIMITS_COLLECTION}/${key}`, bad);
      await expect(store(m).update(key, bump)).rejects.toThrow();
    }
  });
  it('US-E14-03/AC8 end to end: Firestore fake failing gives 503 through the handler', async () => {
    const db = new FakeDb();
    db.failGet = true;
    const r = rig();
    r.deps.policy!.store = createFirestoreStore(db);
    const c = await extract(r);
    expect(c.json).toEqual({ ok: false, error: 'UNAVAILABLE', providerCalls: 0 });
    expect(r.provider.calls.length).toBe(0);
  });
  it('US-E14-03/AC5 handler + Firestore wrapper: 5 pass then the 6th is refused, state persisted across wrapper instances', async () => {
    const db = new FakeDb();
    const r1 = rig();
    r1.deps.policy!.store = createFirestoreStore(db);
    for (let i = 0; i < 5; i++) expect((await extract(r1)).res.status).toBe(200);
    const r2 = rig();
    r2.deps.policy!.store = createFirestoreStore(db);
    expect((await extract(r2)).json['error']).toBe('ACCOUNT_LIMIT');
  });
});
