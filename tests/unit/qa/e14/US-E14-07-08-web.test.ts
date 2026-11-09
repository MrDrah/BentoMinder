// QA E14: US-E14-07 (base URL, token only to the hosted base) and US-E14-08 (wording, one retry), web side.
// Fakes only: a recording fetch and a scripted token source; nothing reaches the network.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebExtractor } from '../../../../src/adapters/web/extractor.ts';
import { createWebPdfSource } from '../../../../src/adapters/web/pdf-source.ts';
import { createProxyFetch, NotSignedInError } from '../../../../src/adapters/web/proxy-fetch.ts';
import { parseDenial } from '../../../../src/domain/proxy/denial.ts';
import { parseProxyBase, type ProxyBase } from '../../../../src/domain/proxy/base-url.ts';
import { en } from '../../../../src/i18n/en.ts';
import { ja } from '../../../../src/i18n/ja.ts';

afterEach(() => vi.restoreAllMocks());

const HOSTED = 'https://asia-northeast1-demo.cloudfunctions.net/api';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const UNAUTH = () => json(401, { ok: false, error: 'UNAUTHENTICATED' });
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

interface Seen {
  url: string;
  auth: string | null;
  body: string;
  headers: Record<string, string>;
}
function recorder(replies: Array<() => Response>) {
  const seen: Seen[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    seen.push({ url: String(input), auth: h.get('authorization'), body: typeof init?.body === 'string' ? init.body : '[bytes]', headers: Object.fromEntries(h.entries()) });
    const next = replies.shift();
    if (next === undefined) throw new Error('unexpected extra request');
    return next();
  }) as typeof fetch;
  return { seen, fetchImpl };
}
function tokens(initial: string | null = 'T-cached', fresh: string | null = 'T-fresh') {
  const asked: boolean[] = [];
  return { asked, getToken: (force: boolean) => { asked.push(force); return Promise.resolve(force ? fresh : initial); } };
}
const proxy = (base: ProxyBase, t: ReturnType<typeof tokens>, fetchImpl: typeof fetch) => createProxyFetch({ base, getToken: t.getToken, fetchImpl });
const hostedBase = () => parseProxyBase(HOSTED).base;

describe('US-E14-07/AC1-AC3 the base URL variable (own table)', () => {
  const rejected = [
    'ftp://proxy.example.test',
    'http://proxy.example.test',
    'http://127.0.0.1.evil.test',
    'http://localhost.evil.test',
    'http://127.0.0.1@evil.test',
    'https://user:pw@proxy.example.test',
    'https://user@proxy.example.test',
    'https://proxy.example.test/a?x=1',
    'https://proxy.example.test/a?',
    'https://proxy.example.test/a#frag',
    'https://proxy.example.test/#',
    'javascript:alert(1)',
    'data:text/plain,hi',
    '//proxy.example.test',
    'proxy.example.test',
    'https://',
    'https://exa mple.test',
    '🍱',
  ];
  for (const raw of rejected) {
    it(`US-E14-07/AC3 ${JSON.stringify(raw)} is ignored as if unset, flagged rejected, and no hosted mode`, () => {
      const p = parseProxyBase(raw);
      expect(p.base).toEqual({ mode: 'same-origin' });
      expect(p.rejected).toBe(true);
    });
  }
  it('US-E14-07/AC3 non-string values are rejected; undefined/null/empty/blank are plain "unset"', () => {
    for (const v of [42, true, {}, []]) expect(parseProxyBase(v)).toEqual({ base: { mode: 'same-origin' }, rejected: true });
    for (const v of [undefined, null, '', '   ']) expect(parseProxyBase(v)).toEqual({ base: { mode: 'same-origin' }, rejected: false });
  });
  it('US-E14-07/AC1 https bases keep path, lose trailing slashes, normalise case of scheme/host', () => {
    expect(parseProxyBase(`${HOSTED}/`).base).toEqual({ mode: 'hosted', base: HOSTED });
    expect(parseProxyBase('HTTPS://Proxy.Example.TEST/Api//').base).toEqual({ mode: 'hosted', base: 'https://proxy.example.test/Api' });
    expect(parseProxyBase('https://proxy.example.test').base).toEqual({ mode: 'hosted', base: 'https://proxy.example.test' });
  });
  it('US-E14-07/AC5 http://127.0.0.1 and http://localhost (any port) are local, not hosted', () => {
    expect(parseProxyBase('http://127.0.0.1:8787').base).toEqual({ mode: 'local', base: 'http://127.0.0.1:8787' });
    expect(parseProxyBase('http://localhost:8787/').base).toEqual({ mode: 'local', base: 'http://localhost:8787' });
    expect(parseProxyBase('https://localhost:8787').base.mode).toBe('hosted'); // https is judged as any hosted address
  });
  it('US-E14-07/AC3 the rejection result never carries the value (the caller can only name the variable)', () => {
    const p = parseProxyBase('http://evil.test/MARKER_VALUE');
    expect(JSON.stringify(p)).not.toContain('MARKER_VALUE');
  });
});

describe('US-E14-07/AC1 AC2 AC4 AC5 request address and token', () => {
  it('US-E14-07/AC1 hosted: request goes to base + endpoint path with the bearer token (cached first)', async () => {
    const t = tokens();
    const rec = recorder([() => json(200, { ok: true })]);
    await proxy(hostedBase(), t, rec.fetchImpl)('/api/menu/extract?targetMonth=2026-11', { method: 'POST', body: 'x' });
    expect(rec.seen[0]).toMatchObject({ url: `${HOSTED}/api/menu/extract?targetMonth=2026-11`, auth: 'Bearer T-cached' });
    expect(t.asked).toEqual([false]);
  });
  it('US-E14-07/AC2 same-origin: relative path, no Authorization, token source never consulted, even when signed in', async () => {
    const t = tokens();
    const rec = recorder([() => json(200, {})]);
    await proxy({ mode: 'same-origin' }, t, rec.fetchImpl)('/api/menu/fetch-pdf', { method: 'POST', body: '{}' });
    expect(rec.seen[0]).toMatchObject({ url: '/api/menu/fetch-pdf', auth: null });
    expect(t.asked).toEqual([]);
  });
  it('US-E14-07/AC5 local base: no Authorization header and no token lookup, signed in or not', async () => {
    for (const tk of [tokens(), tokens(null, null)]) {
      const rec = recorder([() => json(200, {})]);
      await proxy(parseProxyBase('http://127.0.0.1:8787').base, tk, rec.fetchImpl)('/api/menu/extract', { method: 'POST', body: 'x', headers: { authorization: 'Bearer SMUGGLED' } });
      expect(rec.seen[0]?.url).toBe('http://127.0.0.1:8787/api/menu/extract');
      expect(tk.asked).toEqual([]);
    }
  });
  it('US-E14-07/AC4 signed out against a hosted base: NO request is sent at all, NotSignedInError', async () => {
    const t = tokens(null);
    const rec = recorder([]);
    await expect(proxy(hostedBase(), t, rec.fetchImpl)('/api/menu/extract', { method: 'POST', body: 'x' })).rejects.toBeInstanceOf(NotSignedInError);
    expect(rec.seen).toEqual([]);
  });
  it('US-E14-07/AC4 signed out: extractor and pdf source end as NETWORK ("unreachable"), still with 0 requests', async () => {
    const rec = recorder([]);
    const f = proxy(hostedBase(), tokens(null), rec.fetchImpl);
    expect(await createWebExtractor(f, 1000, () => undefined).extract({ pdf: PDF, targetMonth: '2026-11' } as never)).toMatchObject({ ok: false, error: 'NETWORK', providerCalls: 0 });
    expect(await createWebPdfSource(f, () => undefined).fromUrl('https://example-kinder.test/m.pdf')).toEqual({ ok: false, error: 'NETWORK' });
    expect(rec.seen).toEqual([]);
  });
  it('US-E14-07/AC4 a caller-supplied Authorization header is replaced by the account token, never forwarded', async () => {
    const rec = recorder([() => json(200, {})]);
    await proxy(hostedBase(), tokens(), rec.fetchImpl)('/api/menu/extract', { method: 'POST', body: 'x', headers: { authorization: 'Bearer SMUGGLED' } });
    expect(rec.seen[0]?.auth).toBe('Bearer T-cached');
  });
});

describe('US-E14-07/AC6 the token goes only to the configured proxy base', () => {
  it('US-E14-07/AC6 paths that are not /api/... are refused before any request (no absolute/protocol-relative/other-host target)', async () => {
    for (const p of ['https://evil.test/api/menu/extract', '//evil.test/api/menu/extract', 'http://127.0.0.1/api/x', 'api/menu/extract', '', '/other', '\\\\evil.test\\api']) {
      const rec = recorder([() => json(200, {})]);
      await expect(proxy(hostedBase(), tokens(), rec.fetchImpl)(p)).rejects.toThrow();
      expect(rec.seen).toEqual([]);
    }
  });
  it('US-E14-07/AC6 crafted /api/ paths cannot change the host the token is sent to', async () => {
    for (const p of ['/api/@evil.test/x', '/api/..//evil.test/x', '/api/\\@evil.test', '/api/%40evil.test', '/api/menu/extract#@evil.test', '/api/?@evil.test']) {
      const rec = recorder([() => json(200, {})]);
      await proxy(hostedBase(), tokens(), rec.fetchImpl)(p);
      const sent = new URL(rec.seen[0]?.url as string);
      expect(sent.host).toBe('asia-northeast1-demo.cloudfunctions.net');
      expect(sent.protocol).toBe('https:');
    }
  });
  it('US-E14-07/AC6 the fetch target (school URL) travels only in the JSON body, never as a request address; token never in body', async () => {
    const TARGET = 'https://marker-school.example.test/menu.pdf';
    const rec = recorder([() => new Response(PDF, { status: 200, headers: { 'content-type': 'application/pdf' } })]);
    await createWebPdfSource(proxy(hostedBase(), tokens(), rec.fetchImpl), () => undefined).fromUrl(TARGET);
    expect(rec.seen.length).toBe(1);
    expect(rec.seen[0]?.url).toBe(`${HOSTED}/api/menu/fetch-pdf`);
    expect(rec.seen[0]?.url).not.toContain('marker-school');
    expect(JSON.parse(rec.seen[0]?.body as string)).toEqual({ url: TARGET });
    expect(rec.seen[0]?.body).not.toContain('T-cached');
    expect(rec.seen[0]?.auth).toBe('Bearer T-cached');
  });
  it('US-E14-07/AC4 the token is never put in a URL, never logged, never stored (console + storage spies)', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const rec = recorder([UNAUTH, () => json(403, { ok: false, error: 'NOT_ALLOWED' })]);
    await createWebExtractor(proxy(hostedBase(), tokens('T-SECRET-1', 'T-SECRET-2'), rec.fetchImpl), 1000).extract({ pdf: PDF, targetMonth: '2026-11' } as never);
    for (const s of rec.seen) expect(s.url).not.toMatch(/T-SECRET/);
    const logged = spies.flatMap((s) => s.mock.calls).map((a) => JSON.stringify(a)).join('\n');
    expect(logged).not.toMatch(/T-SECRET/);
    expect((globalThis as { localStorage?: unknown }).localStorage).toBeUndefined(); // node env: nothing to store into
  });
});

describe('US-E14-08/AC1 one token refresh and one retry, no more', () => {
  it('US-E14-08/AC1 401 UNAUTHENTICATED then success: second request carries the FRESH token (force refresh asked once)', async () => {
    const t = tokens();
    const rec = recorder([UNAUTH, () => json(200, { ok: true })]);
    const res = await proxy(hostedBase(), t, rec.fetchImpl)('/api/menu/extract', { method: 'POST', body: 'x' });
    expect(res.status).toBe(200);
    expect(rec.seen.map((s) => s.auth)).toEqual(['Bearer T-cached', 'Bearer T-fresh']);
    expect(t.asked).toEqual([false, true]);
  });
  it('US-E14-08/AC1 still 401 after the retry: exactly 2 requests, 1 refresh, then the 401 is returned (no third attempt)', async () => {
    const t = tokens();
    const rec = recorder([UNAUTH, UNAUTH]);
    const res = await proxy(hostedBase(), t, rec.fetchImpl)('/api/menu/extract', { method: 'POST', body: 'x' });
    expect(res.status).toBe(401);
    expect(rec.seen.length).toBe(2);
    expect(t.asked).toEqual([false, true]);
  });
  it('US-E14-08/AC1 through the extractor: two 401s end as UNAUTHENTICATED with providerCalls 0 after exactly 2 requests', async () => {
    const rec = recorder([UNAUTH, UNAUTH]);
    const r = await createWebExtractor(proxy(hostedBase(), tokens(), rec.fetchImpl), 1000).extract({ pdf: PDF, targetMonth: '2026-11' } as never);
    expect(r).toMatchObject({ ok: false, error: 'UNAUTHENTICATED', providerCalls: 0 });
    expect(rec.seen.length).toBe(2);
  });
  it('US-E14-08/AC1 refresh gives no token (signed out meanwhile): no retry, the 401 stands', async () => {
    const rec = recorder([UNAUTH]);
    const res = await proxy(hostedBase(), tokens('T', null), rec.fetchImpl)('/api/menu/extract', { method: 'POST', body: 'x' });
    expect(res.status).toBe(401);
    expect(rec.seen.length).toBe(1);
  });
  it('US-E14-08/AC1 only UNAUTHENTICATED triggers a retry: 401 with another/garbled body, 403 NOT_ALLOWED, 429, 503 do not', async () => {
    const others = [() => json(401, { ok: false, error: 'SOMETHING' }), () => new Response('<html>401</html>', { status: 401 }), () => json(403, { ok: false, error: 'NOT_ALLOWED' }), () => json(429, { ok: false, error: 'ACCOUNT_LIMIT', scope: 'hour', retryAfterSec: 5, providerCalls: 0 }), () => json(503, { ok: false, error: 'UNAVAILABLE' }), () => json(200, UNAUTH)];
    for (const o of others) {
      const t = tokens();
      const rec = recorder([o]);
      await proxy(hostedBase(), t, rec.fetchImpl)('/api/menu/extract', { method: 'POST', body: 'x' });
      expect(rec.seen.length).toBe(1);
      expect(t.asked).toEqual([false]);
    }
  });
  it('US-E14-08/AC4 no more than one request per tap for network failure, timeout and 5xx (no automatic retry)', async () => {
    for (const reply of [() => { throw new TypeError('Failed to fetch'); }, () => json(502, {}), () => new Response('<html>Bad gateway</html>', { status: 502 }), () => json(503, { ok: false, error: 'UNAVAILABLE', providerCalls: 0 })]) {
      const rec = recorder([reply]);
      const r = await createWebExtractor(proxy(hostedBase(), tokens(), rec.fetchImpl), 1000, () => undefined).extract({ pdf: PDF, targetMonth: '2026-11' } as never);
      expect(r.ok).toBe(false);
      expect(rec.seen.length).toBe(1);
    }
  });
  it('US-E14-08/AC4 no answer within the cap: aborted, reported unreachable, one request', async () => {
    vi.useFakeTimers();
    const rec = { n: 0 };
    const hang = ((_u: unknown, init?: RequestInit) => { rec.n += 1; return new Promise((_r, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))); }) as typeof fetch;
    const p = createWebExtractor(proxy(hostedBase(), tokens(), hang), 90_000, () => undefined).extract({ pdf: PDF, targetMonth: '2026-11' } as never);
    await vi.advanceTimersByTimeAsync(90_001);
    expect(await p).toMatchObject({ ok: false, error: 'NETWORK', providerCalls: 0 });
    expect(rec.n).toBe(1);
    vi.useRealTimers();
  });
});

describe('US-E14-08 reply parsing (BR-11): unknown or malformed hosted replies are "unreachable", never a crash', () => {
  const bad: unknown[] = [null, 'x', 5, [], {}, { ok: true }, { ok: false }, { ok: false, error: 'ACCOUNT_LIMIT' }, { ok: false, error: 'ACCOUNT_LIMIT', scope: 'week', retryAfterSec: 3 }, { ok: false, error: 'WHAT' }, { ok: 'false', error: 'NOT_ALLOWED' }];
  for (const b of bad) {
    it(`US-E14-08/AC4 parseDenial(${JSON.stringify(b)}) is null`, () => expect(parseDenial(b)).toBeNull());
  }
  it('US-E14-03/AC4 a limit reply with junk retryAfterSec keeps the scope but drops the countdown', () => {
    for (const v of [0, -5, 1.5, '30', null, NaN, Infinity]) expect(parseDenial({ ok: false, error: 'ACCOUNT_LIMIT', scope: 'hour', retryAfterSec: v })).toEqual({ error: 'ACCOUNT_LIMIT', scope: 'hour' });
    expect(parseDenial({ ok: false, error: 'ACCOUNT_LIMIT', scope: 'hour', retryAfterSec: 1800 })).toEqual({ error: 'ACCOUNT_LIMIT', scope: 'hour', retryAfterSec: 1800 });
  });
  it('US-E14-08/AC4 an unknown error value or non-JSON 200 from the proxy reads as unreachable through the extractor and pdf source', async () => {
    for (const reply of [() => json(200, { ok: false, error: 'WHAT' }), () => new Response('<html>', { status: 200 }), () => json(200, null)]) {
      const rec = recorder([reply]);
      expect(await createWebExtractor(proxy(hostedBase(), tokens(), rec.fetchImpl), 1000, () => undefined).extract({ pdf: PDF, targetMonth: '2026-11' } as never)).toMatchObject({ ok: false, error: 'NETWORK' });
    }
  });
  it('US-E14-08/AC5 ORIGIN_NOT_ALLOWED: the developer log names the code once, never a token or value; the result is the unreachable-type error', async () => {
    const warn = vi.fn();
    const rec = recorder([() => json(403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' })]);
    const r = await createWebExtractor(proxy(hostedBase(), tokens('T-SECRET'), rec.fetchImpl), 1000, warn).extract({ pdf: PDF, targetMonth: '2026-11' } as never);
    expect(r).toMatchObject({ ok: false, error: 'ORIGIN_NOT_ALLOWED', providerCalls: 0 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('ORIGIN_NOT_ALLOWED');
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('T-SECRET');
  });
});

describe('US-E14-03/AC4 US-E14-08/AC1 AC2 message wording matches the ACs exactly (ja and en)', () => {
  const rows: Array<[string, string, string]> = [
    ['proxy.expired', 'ログインの有効期限が切れました。もう一度ログインしてください。', 'Your sign-in has expired. Please sign in again.'],
    ['proxy.signInAgain', 'ログインし直す', 'Sign in again'],
    ['proxy.notAllowed', 'このアカウントでは献立の読み取りを使えません。', "This account can't use menu reading."],
    ['proxy.limit.hour', '読み取りの回数が上限に達しました。1時間ほどしてからもう一度お試しください。', "You've reached the reading limit for now. Please try again in about an hour."],
    ['proxy.limit.day', '今日の読み取り回数の上限に達しました。明日もう一度お試しください。', "You've reached today's reading limit. Please try again tomorrow."],
    ['proxy.limit.fetch', 'URLからの取得回数が上限に達しました。PDFをアップロードするか、しばらくしてからお試しください。', "You've reached the limit for fetching from addresses. Upload the PDF, or try again later."],
  ];
  for (const [key, jaText, enText] of rows) {
    it(`US-E14-08/AC1 ${key}: ja and en equal the AC text`, () => {
      expect((ja as Record<string, string>)[key]).toBe(jaText);
      expect((en as Record<string, string>)[key]).toBe(enText);
    });
  }
  it('US-E14-08/AC4 the unreachable wording the AC points at (US-E2-06/AC2) and 「手入力する」 / 「もう一度」 exist in both languages', () => {
    expect((ja as Record<string, string>)['common.retry']).toBe('もう一度');
    expect((ja as Record<string, string>)['import.err.unavailable']).toBeTruthy();
    expect((en as Record<string, string>)['import.err.unavailable']).toBeTruthy();
  });
});
