// US-NF-04/AC3: the web extractor abandons a hanging request after 60 s and reports it as unavailable.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebExtractor } from '../../../src/adapters/web/extractor.ts';

const hang: typeof fetch = (_u, init) =>
  new Promise((_res, rej) => {
    init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
  });
const req = { pdf: new ArrayBuffer(4), targetMonth: '2026-11' } as never;

afterEach(() => vi.useRealTimers());

describe('web extractor timeout', () => {
  it('US-NF-04/AC3 abandons after 60 s by default and counts 0 provider calls', async () => {
    vi.useFakeTimers();
    const p = createWebExtractor(hang).extract(req);
    await vi.advanceTimersByTimeAsync(59_999);
    let done = false;
    void p.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ ok: false, error: 'NETWORK', providerCalls: 0 });
  });
  it('US-NF-04/AC3 the timeout is injectable', async () => {
    vi.useFakeTimers();
    const p = createWebExtractor(hang, 50).extract(req);
    await vi.advanceTimersByTimeAsync(50);
    expect((await p).ok).toBe(false);
  });
  it('US-NF-04/AC3 a caller signal still aborts early, and a fast reply is unaffected', async () => {
    vi.useFakeTimers();
    const c = new AbortController();
    const p = createWebExtractor(hang).extract(req, c.signal);
    c.abort();
    expect((await p).ok).toBe(false);
    const ok = createWebExtractor(async () => new Response(JSON.stringify({ ok: false, error: 'RATE_LIMITED', providerCalls: 1 })));
    expect(await ok.extract(req)).toMatchObject({ error: 'RATE_LIMITED', providerCalls: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });
});
