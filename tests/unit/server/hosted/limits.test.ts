// US-E14-03: per-account limits. applyReservation is tested as a pure table with a fake clock;
// the handler tests use an in-memory CounterStore. No Firestore.
import { describe, expect, it } from 'vitest';
import { accountKey, applyReservation, DEFAULT_LIMITS, reserve, type EndpointState } from '../../../../server/core/hosted-policy.ts';
import { ALICE, BOB, EXTRACT_QUERY, extract, fetchPdfReq, MemoryStore, NOW, PDF, rig, send } from './harness.ts';

const MIN = 60_000;
const lim = { perHour: 5, perDay: 20 };
const state = (hour: number[], dayCount = hour.length, dayKey = '2026-11-10'): EndpointState => ({ hour, dayKey, dayCount });

describe('US-E14-03 applyReservation (pure)', () => {
  it('US-E14-03/AC1 defaults match contract 13.4', () => {
    expect(DEFAULT_LIMITS).toEqual({ extract: { perHour: 5, perDay: 20 }, fetch: { perHour: 30, perDay: 100 } });
  });

  it('US-E14-03/AC1 an empty state accepts and counts the request', () => {
    expect(applyReservation(undefined, NOW, lim, 'extract')).toEqual({ result: { ok: true }, state: { hour: [NOW], dayKey: '2026-11-10', dayCount: 1 } });
  });

  it('US-E14-03/AC2 at the hourly limit: scope hour, retryAfterSec until the oldest request leaves the window', () => {
    const hour = [NOW - 50 * MIN, NOW - 40 * MIN, NOW - 30 * MIN, NOW - 20 * MIN, NOW - 10 * MIN];
    const { result } = applyReservation(state(hour), NOW, lim, 'extract');
    expect(result).toEqual({ ok: false, scope: 'hour', retryAfterSec: 600 });
  });

  it('US-E14-03/AC2 the window is rolling: requests older than 60 minutes no longer count (boundary pruned)', () => {
    const hour = [NOW - 61 * MIN, NOW - 60 * MIN, NOW - 59 * MIN, NOW - 20 * MIN, NOW - 10 * MIN];
    const r = applyReservation(state(hour, 5), NOW, lim, 'extract');
    expect(r.result).toEqual({ ok: true });
    expect(r.state.hour).toEqual([NOW - 59 * MIN, NOW - 20 * MIN, NOW - 10 * MIN, NOW]);
  });

  it('US-E14-03/AC2 retryAfterSec is at least 1 and rounds up', () => {
    const hour = [NOW - 60 * MIN + 200, NOW - 50 * MIN, NOW - 40 * MIN, NOW - 30 * MIN, NOW - 20 * MIN];
    expect(applyReservation(state(hour), NOW, lim, 'extract').result).toMatchObject({ retryAfterSec: 1 });
    const hour2 = [NOW - 60 * MIN + 1500, ...hour.slice(1)];
    expect(applyReservation(state(hour2), NOW, lim, 'extract').result).toMatchObject({ retryAfterSec: 2 });
  });

  it('US-E14-03/AC2 a lowered limit waits for enough entries to leave, not only the oldest', () => {
    const hour = [NOW - 50 * MIN, NOW - 40 * MIN, NOW - 30 * MIN, NOW - 20 * MIN, NOW - 10 * MIN];
    expect(applyReservation(state(hour), NOW, { perHour: 3, perDay: 20 }, 'extract').result).toEqual({ ok: false, scope: 'hour', retryAfterSec: 30 * MIN / 1000 });
  });

  it('US-E14-03/AC3 the day limit has its own scope and counts down to 00:00 JST', () => {
    const at = Date.parse('2026-11-10T14:59:30Z'); // 23:59:30 JST
    const r = applyReservation(state([], 20), at, lim, 'extract');
    expect(r.result).toEqual({ ok: false, scope: 'day', retryAfterSec: 30 });
    const noon = applyReservation(state([], 20), NOW, lim, 'extract');
    expect(noon.result).toEqual({ ok: false, scope: 'day', retryAfterSec: 12 * 3600 });
  });

  it('US-E14-03/AC3 the day count resets at Tokyo midnight, not UTC midnight', () => {
    const before = Date.parse('2026-11-10T14:59:59Z'); // 23:59:59 JST, still the 10th
    expect(applyReservation(state([], 20), before, lim, 'extract').result.ok).toBe(false);
    const after = Date.parse('2026-11-10T15:00:00Z'); // 00:00 JST on the 11th
    const r = applyReservation(state([], 20), after, lim, 'extract');
    expect(r.result).toEqual({ ok: true });
    expect(r.state).toEqual({ hour: [after], dayKey: '2026-11-11', dayCount: 1 });
  });

  it('US-E14-03/AC3 the hour is checked before the day when both are exceeded', () => {
    const hour = [NOW - 10 * MIN, NOW - 9 * MIN, NOW - 8 * MIN, NOW - 7 * MIN, NOW - 6 * MIN];
    expect(applyReservation(state(hour, 20), NOW, lim, 'extract').result).toMatchObject({ scope: 'hour' });
  });

  it('US-E14-03/AC4 fetch limits report scope "fetch" for both windows', () => {
    const l = { perHour: 2, perDay: 3 };
    expect(applyReservation(state([NOW - MIN, NOW - 2 * MIN]), NOW, l, 'fetch').result).toMatchObject({ ok: false, scope: 'fetch' });
    expect(applyReservation(state([], 3), NOW, l, 'fetch').result).toMatchObject({ ok: false, scope: 'fetch' });
  });

  it('US-E14-03/AC7 stored state holds counts and timestamps only; the key is pseudonymous', async () => {
    const store = new MemoryStore();
    await reserve(store, accountKey(ALICE.uid), 'extract', NOW, DEFAULT_LIMITS);
    const dump = JSON.stringify([...store.data.entries()]);
    expect(dump).not.toContain(ALICE.uid);
    expect(dump).not.toContain('example.test');
    expect(accountKey(ALICE.uid)).toMatch(/^[0-9a-f]{32}$/);
    expect(accountKey(ALICE.uid)).not.toBe(accountKey(BOB.uid));
    const entry = [...store.data.values()][0]!;
    expect(Object.keys(entry)).toEqual(['extract']);
    expect(Object.keys(entry.extract!).sort()).toEqual(['dayCount', 'dayKey', 'hour']);
  });
});

describe('US-E14-03 limits in the handler', () => {
  it('US-E14-03/AC2 the 6th extract in the hour is ACCOUNT_LIMIT scope hour; no provider call, PDF not forwarded', async () => {
    const r = rig();
    for (let i = 0; i < 5; i++) {
      expect((await extract(r)).res.status).toBe(200);
      r.clock.now += MIN;
    }
    const calls = r.providerCalls.length;
    const c = await extract(r);
    expect(c.res.status).toBe(429);
    expect(c.json()).toEqual({ ok: false, error: 'ACCOUNT_LIMIT', scope: 'hour', retryAfterSec: 55 * 60, providerCalls: 0 });
    expect(c.res.headers['retry-after']).toBe(String(55 * 60));
    expect(r.providerCalls).toHaveLength(calls);
  });

  it('US-E14-03/AC3 the day limit answers scope "day" when the hour is free', async () => {
    const r = rig({ limits: { extract: { perHour: 100, perDay: 3 }, fetch: DEFAULT_LIMITS.fetch } });
    for (let i = 0; i < 3; i++) await extract(r);
    const c = await extract(r);
    expect(c.res.status).toBe(429);
    expect(c.json()).toMatchObject({ error: 'ACCOUNT_LIMIT', scope: 'day', retryAfterSec: 12 * 3600, providerCalls: 0 });
  });

  it('US-E14-03/AC1 limits are per account and per endpoint, and come from configuration', async () => {
    const r = rig({ limits: { extract: { perHour: 2, perDay: 20 }, fetch: { perHour: 1, perDay: 5 } } });
    await extract(r);
    await extract(r);
    expect((await extract(r)).res.status).toBe(429); // alice extract exhausted
    expect((await extract(r, 'tok-bob')).res.status).toBe(200); // bob unaffected
    expect((await fetchPdfReq(r)).res.status).toBe(200); // alice fetch has its own counter
    const f = await fetchPdfReq(r);
    expect(f.res.status).toBe(429);
    expect(f.json()).toMatchObject({ error: 'ACCOUNT_LIMIT', scope: 'fetch', providerCalls: 0 });
    expect(r.fetches).toHaveLength(1); // the refused fetch made no outbound lookup
  });

  it('US-E14-03/AC5 counters are shared by instances and survive restarts (same store, new handler state)', async () => {
    const store = new MemoryStore();
    for (let i = 0; i < 5; i++) expect((await extract(rig({ store }))).res.status).toBe(200); // a fresh rig per request = a cold instance each time
    expect((await extract(rig({ store }))).res.status).toBe(429);
  });

  it('US-E14-03/AC5 concurrent requests cannot over-issue', async () => {
    const r = rig();
    const results = await Promise.all(Array.from({ length: 12 }, () => extract(r)));
    expect(results.filter((c) => c.res.status === 200)).toHaveLength(5);
    expect(results.filter((c) => c.res.status === 429)).toHaveLength(7);
  });

  it('US-E14-03/AC6 a request counts once it passed token, allow-list and validation, even when the provider fails', async () => {
    const r = rig();
    r.providerReply.override = { kind: 'http', status: 500, retryAfterSec: null };
    const c = await extract(r);
    expect(c.json()['ok']).toBe(false);
    expect(r.store.data.get(accountKey(ALICE.uid))?.extract?.dayCount).toBe(1);
  });

  it('US-E14-03/AC6 refusals for token, allow-list, validation and limit do not count', async () => {
    const r = rig({ limits: { extract: { perHour: 1, perDay: 20 }, fetch: DEFAULT_LIMITS.fetch } });
    await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF }); // no token
    await extract(r, 'tok-stranger'); // denied
    await send(r, '/api/menu/extract', { query: 'targetMonth=2026-13', body: PDF, headers: { authorization: 'Bearer tok-alice' } }); // bad query
    await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: new TextEncoder().encode('not a pdf'), headers: { authorization: 'Bearer tok-alice' } }); // magic bytes
    const big = new Uint8Array(10_485_761);
    big.set(PDF.subarray(0, 5));
    const tooBig = await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: big, headers: { authorization: 'Bearer tok-alice' } });
    expect(tooBig.json()).toEqual({ ok: false, error: 'TOO_LARGE', providerCalls: 0 });
    await send(r, '/api/menu/fetch-pdf', { body: 'not json', headers: { authorization: 'Bearer tok-alice' } });
    await send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url: 'http://insecure.test/m.pdf' }), headers: { authorization: 'Bearer tok-alice' } });
    expect(r.store.calls).toBe(0);
    expect((await extract(r)).res.status).toBe(200); // the single allowed request is still available
    const over = await extract(r);
    expect(over.res.status).toBe(429);
    expect(r.store.data.get(accountKey(ALICE.uid))?.extract?.dayCount).toBe(1); // the limited one did not count
  });

  it('US-E14-03/AC6 a declared Content-Length over the limit is refused before the body is read', async () => {
    const r = rig();
    const c = await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF, headers: { authorization: 'Bearer tok-alice', 'content-length': '10485761' } });
    expect(c.json()).toEqual({ ok: false, error: 'TOO_LARGE', providerCalls: 0 });
    expect(c.bodyReads).toBe(0);
    expect(r.store.calls).toBe(0);
  });

  it('US-E14-03/AC8 a failing counter store refuses with 503 UNAVAILABLE: no provider call, no outbound fetch', async () => {
    const r = rig();
    r.store.failing = true;
    const e = await extract(r);
    expect(e.res.status).toBe(503);
    expect(e.json()).toEqual({ ok: false, error: 'UNAVAILABLE', providerCalls: 0 });
    const f = await fetchPdfReq(r);
    expect(f.res.status).toBe(503);
    expect(r.providerCalls).toHaveLength(0);
    expect(r.fetches).toHaveLength(0);
  });

  it('US-E14-03/AC9 the provider rate limit stays RATE_LIMITED, not ACCOUNT_LIMIT', async () => {
    const r = rig();
    r.providerReply.override = { kind: 'http', status: 429, retryAfterSec: null };
    const c = await extract(r);
    expect(c.json()).toMatchObject({ ok: false, error: 'RATE_LIMITED' });
    expect(c.json()['error']).not.toBe('ACCOUNT_LIMIT');
    expect(c.res.status).toBe(200);
  });

  it('US-E14-01/AC3 a client abort is passed through to the extraction (same as the local proxy)', async () => {
    const r = rig();
    const ac = new AbortController();
    ac.abort();
    const c = await extract(r, 'tok-alice', { signal: ac.signal });
    expect(c.json()['ok']).toBe(false);
  });
});
