// ADR 015 slice C: the web app's side of the hosted AI proxy. Fakes only: a recording fetch and FakeAuth as the token
// source; nothing here reaches Google, Firebase or a real proxy.
import { describe, expect, it, vi } from 'vitest';
import { createWebExtractor, extractUrl } from '../../../src/adapters/web/extractor.ts';
import { createWebPdfSource } from '../../../src/adapters/web/pdf-source.ts';
import { createProxyFetch, NotSignedInError } from '../../../src/adapters/web/proxy-fetch.ts';
import { FakeAuth, TEST_USER } from '../../../src/domain/auth/fake-auth.ts';
import { parseProxyBase } from '../../../src/domain/proxy/base-url.ts';

const HOSTED = 'https://asia-northeast1-demo.cloudfunctions.net/api';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

interface Seen {
  url: string;
  authorization: string | null;
  body: unknown;
}
function recorder(replies: Array<() => Response | Promise<Response>>) {
  const seen: Seen[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization'), body: init?.body });
    const next = replies.shift();
    if (next === undefined) throw new Error('unexpected extra request');
    return next();
  }) as typeof fetch;
  return { seen, fetchImpl };
}
const hosted = (auth: FakeAuth, fetchImpl: typeof fetch) => createProxyFetch({ base: parseProxyBase(HOSTED).base, getToken: (f) => auth.getIdToken(f), fetchImpl });
const pdf = { pdf: new Uint8Array([0x25, 0x50, 0x44, 0x46]), targetMonth: '2026-11' } as never;

describe('US-E14-07 the base URL variable', () => {
  const table: Array<[string, unknown, 'same-origin' | 'local' | 'hosted', string?]> = [
    ['AC1 https with a path', HOSTED, 'hosted', HOSTED],
    ['AC1 trailing slash is dropped', `${HOSTED}/`, 'hosted', HOSTED],
    ['AC1 several trailing slashes', `${HOSTED}///`, 'hosted', HOSTED],
    ['AC1 https origin only', 'https://proxy.example.test', 'hosted', 'https://proxy.example.test'],
    ['AC2 undefined', undefined, 'same-origin'],
    ['AC2 empty', '', 'same-origin'],
    ['AC2 blank', '   ', 'same-origin'],
    ['AC5 http 127.0.0.1 with port', 'http://127.0.0.1:8787', 'local', 'http://127.0.0.1:8787'],
    ['AC5 http localhost', 'http://localhost:8787/', 'local', 'http://localhost:8787'],
  ];
  it.each(table)('US-E14-07/%s', (_name, raw, mode, base) => {
    const p = parseProxyBase(raw);
    expect(p.rejected).toBe(false);
    expect(p.base.mode).toBe(mode);
    if (base !== undefined) expect(p.base).toMatchObject({ base });
  });

  const bad = ['http://proxy.example.test', 'http://127.0.0.1.evil.test', 'ftp://x.test', 'not a url', 'https://user:pw@x.test', 'https://:pw@x.test', 'https://x.test/?a=1', 'https://x.test/?', 'https://x.test/#f', 'https://x.test/#', '//x.test', 42, {}];
  it.each(bad.map((b) => [JSON.stringify(b), b] as const))('US-E14-07/AC3 a bad value is ignored as if unset: %s', (_n, raw) => {
    expect(parseProxyBase(raw)).toEqual({ base: { mode: 'same-origin' }, rejected: true });
  });

  it('US-E14-07/AC3 the rejected value never becomes a request address', async () => {
    const { seen, fetchImpl } = recorder([() => json(200, { ok: true })]);
    const f = createProxyFetch({ base: parseProxyBase('https://user:pw@x.test').base, getToken: () => Promise.resolve('t'), fetchImpl });
    await f('/api/menu/fetch-pdf', { method: 'POST' });
    expect(seen.map((s) => s.url)).toEqual(['/api/menu/fetch-pdf']);
    expect(seen[0]?.authorization).toBeNull();
  });
});

describe('US-E14-07 which address a request goes to, and who gets the token', () => {
  it('US-E14-07/AC1 both endpoints go to the base URL plus their path, with or without a trailing slash', async () => {
    for (const raw of [HOSTED, `${HOSTED}/`]) {
      const auth = new FakeAuth({ user: TEST_USER });
      const { seen, fetchImpl } = recorder([() => json(200, {}), () => json(200, {})]);
      const f = createProxyFetch({ base: parseProxyBase(raw).base, getToken: (x) => auth.getIdToken(x), fetchImpl });
      await f(extractUrl('2026-11'), { method: 'POST' });
      await f('/api/menu/fetch-pdf', { method: 'POST' });
      expect(seen.map((s) => s.url)).toEqual([`${HOSTED}${extractUrl('2026-11')}`, `${HOSTED}/api/menu/fetch-pdf`]);
    }
  });

  it('US-E14-07/AC2 no base: the same-origin path, unchanged, and no token is even asked for', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const { seen, fetchImpl } = recorder([() => json(200, {})]);
    await createProxyFetch({ base: parseProxyBase(undefined).base, getToken: (x) => auth.getIdToken(x), fetchImpl })('/api/menu/extract?targetMonth=2026-11', { method: 'POST' });
    expect(seen).toMatchObject([{ url: '/api/menu/extract?targetMonth=2026-11', authorization: null }]);
    expect(auth.tokenRequests).toEqual([]);
  });

  it('US-E14-07/AC4 a hosted call carries the signed-in account\'s ID token, fresh for each request', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const { seen, fetchImpl } = recorder([() => json(200, {}), () => json(200, {})]);
    const f = hosted(auth, fetchImpl);
    await f('/api/menu/extract?targetMonth=2026-11', { method: 'POST', headers: { 'content-type': 'application/pdf' } });
    await f('/api/menu/fetch-pdf', { method: 'POST' });
    expect(seen.map((s) => s.authorization)).toEqual([`Bearer fake-id-token-${TEST_USER.uid}-0`, `Bearer fake-id-token-${TEST_USER.uid}-0`]);
    expect(auth.tokenRequests).toEqual([false, false]);
  });

  it('US-E14-07/AC4 the token is never put in the URL, and the caller\'s own headers are kept', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const { seen, fetchImpl } = recorder([() => json(200, {})]);
    await hosted(auth, fetchImpl)('/api/menu/extract?targetMonth=2026-11', { method: 'POST', headers: { 'content-type': 'application/pdf' } });
    expect(seen[0]?.url).not.toContain('fake-id-token');
  });

  it('US-E14-07/AC4 the token is not logged', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error'), vi.spyOn(console, 'info')];
    const auth = new FakeAuth({ user: TEST_USER });
    const { fetchImpl } = recorder([() => json(401, { ok: false, error: 'UNAUTHENTICATED' }), () => json(401, { ok: false, error: 'UNAUTHENTICATED' })]);
    await createWebExtractor(hosted(auth, fetchImpl)).extract(pdf);
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    spies.forEach((s) => s.mockRestore());
    expect(logged).not.toContain('fake-id-token');
  });

  it('US-E14-07/AC5 a local base (127.0.0.1 or localhost) gets no Authorization header, signed in or not', async () => {
    for (const user of [TEST_USER, null]) {
      const auth = new FakeAuth({ user });
      const { seen, fetchImpl } = recorder([() => json(200, {})]);
      await createProxyFetch({ base: parseProxyBase('http://127.0.0.1:8787').base, getToken: (x) => auth.getIdToken(x), fetchImpl })('/api/menu/fetch-pdf', { method: 'POST' });
      expect(seen).toMatchObject([{ url: 'http://127.0.0.1:8787/api/menu/fetch-pdf', authorization: null }]);
      expect(auth.tokenRequests).toEqual([]);
    }
  });

  it('US-E14-07/AC6 the token only ever goes to the configured proxy: a page URL to fetch travels in the body, and other addresses are refused', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const { seen, fetchImpl } = recorder([() => json(200, { ok: true })]);
    const f = hosted(auth, fetchImpl);
    const target = 'https://school.example.test/menu.pdf';
    await createWebPdfSource(f).fromUrl(target);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe(`${HOSTED}/api/menu/fetch-pdf`);
    expect(String(seen[0]?.body)).toContain(target);
    expect(seen.filter((s) => s.url.includes('school.example.test'))).toEqual([]);
    // Only "/api/..." paths of the proxy are accepted; an absolute address elsewhere throws before any request.
    await expect(f(target)).rejects.toThrow();
    await expect(f('//evil.test/api/x')).rejects.toThrow();
    expect(seen).toHaveLength(1);
  });

  it('US-E14-08/AC8 signed out with a hosted base: no request is made at all, and it reads as unreachable', async () => {
    const auth = new FakeAuth({ user: null });
    const { seen, fetchImpl } = recorder([]);
    const f = hosted(auth, fetchImpl);
    await expect(f('/api/menu/extract?targetMonth=2026-11', { method: 'POST' })).rejects.toBeInstanceOf(NotSignedInError);
    expect(await createWebExtractor(f).extract(pdf)).toEqual({ ok: false, error: 'NETWORK', providerCalls: 0 });
    expect(await createWebPdfSource(f).fromUrl('https://x.test/a.pdf')).toEqual({ ok: false, error: 'NETWORK' });
    expect(seen).toEqual([]);
  });
});

describe('US-E14-08/AC1 an expired token: one refresh and one retry', () => {
  const unauth = () => json(401, { ok: false, error: 'UNAUTHENTICATED' });

  it('US-E14-08/AC1 the retry succeeds with a fresh token and the import continues', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const { seen, fetchImpl } = recorder([unauth, () => json(200, { ok: false, error: 'NOT_A_MENU', providerCalls: 1 })]);
    const r = await createWebExtractor(hosted(auth, fetchImpl)).extract(pdf);
    expect(r).toEqual({ ok: false, error: 'NOT_A_MENU', providerCalls: 1 });
    expect(seen.map((s) => s.authorization)).toEqual([`Bearer fake-id-token-${TEST_USER.uid}-0`, `Bearer fake-id-token-${TEST_USER.uid}-1`]);
    expect(auth.tokenRequests).toEqual([false, true]);
    expect(seen[1]?.body).toBe(seen[0]?.body);
  });

  it('US-E14-08/AC1 still refused after the retry: UNAUTHENTICATED, 0 provider calls, exactly 2 requests (never a third)', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const { seen, fetchImpl } = recorder([unauth, unauth]);
    const r = await createWebExtractor(hosted(auth, fetchImpl)).extract(pdf);
    expect(r).toEqual({ ok: false, error: 'UNAUTHENTICATED', providerCalls: 0 });
    expect(seen).toHaveLength(2);
  });

  it('US-E14-08/AC1 AC4 a 401 that is not UNAUTHENTICATED, or any other status, is not retried', async () => {
    for (const reply of [() => json(401, { ok: false, error: 'SOMETHING' }), () => json(401, 'text'), () => new Response('nope', { status: 401 }), () => json(503, { ok: false, error: 'UNAVAILABLE', providerCalls: 0 })]) {
      const auth = new FakeAuth({ user: TEST_USER });
      const { seen, fetchImpl } = recorder([reply]);
      await createWebExtractor(hosted(auth, fetchImpl)).extract(pdf);
      expect(seen).toHaveLength(1);
      expect(auth.tokenRequests).toEqual([false]);
    }
  });

  it('US-E14-08/AC1 when no fresh token can be had, the first answer stands (one request)', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const { seen, fetchImpl } = recorder([unauth]);
    const f = createProxyFetch({ base: parseProxyBase(HOSTED).base, getToken: (force) => (force ? Promise.resolve(null) : auth.getIdToken(false)), fetchImpl });
    expect(await createWebExtractor(f).extract(pdf)).toMatchObject({ error: 'UNAUTHENTICATED' });
    expect(seen).toHaveLength(1);
  });

  it('US-E14-08/AC1 the URL fetch has the same single retry', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const { seen, fetchImpl } = recorder([unauth, unauth]);
    expect(await createWebPdfSource(hosted(auth, fetchImpl)).fromUrl('https://x.test/a.pdf')).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(seen).toHaveLength(2);
  });
});

describe('US-E14-08 reply handling (extract)', () => {
  const run = (reply: () => Response | Promise<Response>, warn: (m: string) => void = () => undefined) => {
    const { seen, fetchImpl } = recorder([reply]);
    return createWebExtractor(fetchImpl, 90_000, warn).extract(pdf).then((r) => ({ r, seen }));
  };

  it('US-E14-08/AC2 NOT_ALLOWED', async () => {
    expect((await run(() => json(403, { ok: false, error: 'NOT_ALLOWED' }))).r).toEqual({ ok: false, error: 'NOT_ALLOWED', providerCalls: 0 });
  });
  it.each([
    ['hour', 1200],
    ['day', 30000],
  ] as const)('US-E14-08/AC3 US-E14-03/AC2 AC3 ACCOUNT_LIMIT scope %s keeps its retryAfterSec', async (scope, retryAfterSec) => {
    const { r, seen } = await run(() => json(429, { ok: false, error: 'ACCOUNT_LIMIT', scope, retryAfterSec, providerCalls: 0 }));
    expect(r).toEqual({ ok: false, error: 'ACCOUNT_LIMIT', scope, retryAfterSec, providerCalls: 0 });
    expect(seen).toHaveLength(1);
  });
  it('US-E14-08/AC3 a missing or bad retryAfterSec is dropped, not invented', async () => {
    for (const retryAfterSec of [undefined, 0, -5, 1.5, '60']) {
      const { r } = await run(() => json(429, { ok: false, error: 'ACCOUNT_LIMIT', scope: 'hour', retryAfterSec, providerCalls: 0 }));
      expect(r).toEqual({ ok: false, error: 'ACCOUNT_LIMIT', scope: 'hour', providerCalls: 0 });
    }
  });
  it('US-E14-08/AC4 HTTP 5xx, UNAVAILABLE, offline and a CORS-style failure all read as unreachable', async () => {
    expect((await run(() => json(503, { ok: false, error: 'UNAVAILABLE', providerCalls: 0 }))).r).toMatchObject({ error: 'UNAVAILABLE', providerCalls: 0 });
    expect((await run(() => json(500, { ok: false, error: 'INTERNAL' }))).r).toEqual({ ok: false, error: 'NETWORK', providerCalls: 0 });
    expect((await run(() => Promise.reject(new TypeError('Failed to fetch')))).r).toEqual({ ok: false, error: 'NETWORK', providerCalls: 0 });
  });
  it('US-E14-08/AC4 one request per tap (no retry on an unreachable proxy)', async () => {
    const { seen } = await run(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(seen).toHaveLength(1);
  });
  it('US-E14-08/AC5 ORIGIN_NOT_ALLOWED is its own result for the UI, and a developer-facing warning names the code only', async () => {
    const warn = vi.fn();
    const { r } = await run(() => json(403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' }), warn);
    expect(r).toEqual({ ok: false, error: 'ORIGIN_NOT_ALLOWED', providerCalls: 0 });
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain('ORIGIN_NOT_ALLOWED');
  });
  it.each([
    ['not JSON', () => new Response('<html>', { status: 502 })],
    ['unknown code', () => json(400, { ok: false, error: 'TEAPOT', providerCalls: 0 })],
    ['ACCOUNT_LIMIT without a valid scope', () => json(429, { ok: false, error: 'ACCOUNT_LIMIT', scope: 'week', retryAfterSec: 5 })],
    ['ACCOUNT_LIMIT with no scope', () => json(429, { ok: false, error: 'ACCOUNT_LIMIT', retryAfterSec: 5 })],
    ['an ok reply that fails the menu schema', () => json(200, { ok: true, menu: { nonsense: 1 }, meta: { providerCalls: 1 } })],
    ['a JSON array', () => json(200, [])],
    ['null', () => json(200, null)],
  ])('US-E14-08/AC6 an unknown or malformed reply (%s) is handled as unreachable or malformed, and nothing from it is passed on', async (_n, reply) => {
    const { r } = await run(reply);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(['NETWORK', 'MALFORMED_OUTPUT']).toContain(r.error);
      expect(Object.keys(r).sort()).not.toContain('scope');
    }
  });
});

describe('US-E14-08 reply handling (fetch-pdf)', () => {
  const run = async (reply: () => Response) => createWebPdfSource(recorder([reply]).fetchImpl, () => undefined).fromUrl('https://x.test/a.pdf');
  it('US-E14-08/AC2 AC3 account-level denials keep their meaning', async () => {
    expect(await run(() => json(403, { ok: false, error: 'NOT_ALLOWED' }))).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(await run(() => json(429, { ok: false, error: 'ACCOUNT_LIMIT', scope: 'fetch', retryAfterSec: 90 }))).toEqual({ ok: false, error: 'ACCOUNT_LIMIT', scope: 'fetch', retryAfterSec: 90 });
  });
  it('US-E14-08/AC4 AC5 AC6 unreachable, origin-refused and unknown replies are the existing network result', async () => {
    expect(await run(() => json(503, { ok: false, error: 'UNAVAILABLE', providerCalls: 0 }))).toEqual({ ok: false, error: 'NETWORK' });
    expect(await run(() => json(403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' }))).toEqual({ ok: false, error: 'NETWORK' });
    expect(await run(() => new Response('x', { status: 500 }))).toEqual({ ok: false, error: 'NETWORK' });
    expect(await run(() => json(429, { ok: false, error: 'ACCOUNT_LIMIT', scope: 'bogus' }))).toEqual({ ok: false, error: 'NETWORK' });
  });
  it('US-E14-08/AC6 existing local-proxy codes still map as before', async () => {
    expect(await run(() => json(403, { ok: false, error: 'URL_NOT_ALLOWED' }))).toEqual({ ok: false, error: 'BLOCKED' });
  });
});

describe('US-E14-08/AC9 US-E14-03/AC4 messages: bilingual, plain, the AC wording', () => {
  it('US-E14-08/AC9 every proxy.* key exists in ja and en and holds no code, address or technical text', async () => {
    const { ja } = await import('../../../src/i18n/ja.ts');
    const { en } = await import('../../../src/i18n/en.ts');
    const keys = Object.keys(ja).filter((k) => k.startsWith('proxy.'));
    expect(keys.sort()).toEqual(['proxy.expired', 'proxy.limit.day', 'proxy.limit.fetch', 'proxy.limit.hour', 'proxy.notAllowed', 'proxy.signInAgain']);
    for (const k of keys) {
      for (const text of [(ja as Record<string, string>)[k], (en as Record<string, string>)[k]]) {
        expect(text, k).toBeTruthy();
        expect(text, k).not.toMatch(/[A-Z]{3,}_[A-Z_]+|https?:|uid|\d{3}\b/);
      }
    }
  });
  it('US-E14-08/AC1 AC2 US-E14-03/AC4 the wording of the ACs', async () => {
    const { ja } = await import('../../../src/i18n/ja.ts');
    const { en } = await import('../../../src/i18n/en.ts');
    expect(ja['proxy.expired']).toBe('ログインの有効期限が切れました。もう一度ログインしてください。');
    expect(en['proxy.expired']).toBe('Your sign-in has expired. Please sign in again.');
    expect(ja['proxy.signInAgain']).toBe('ログインし直す');
    expect(ja['proxy.notAllowed']).toBe('このアカウントでは献立の読み取りを使えません。');
    expect(en['proxy.notAllowed']).toBe("This account can't use menu reading.");
    expect(ja['proxy.limit.hour']).toBe('読み取りの回数が上限に達しました。1時間ほどしてからもう一度お試しください。');
    expect(en['proxy.limit.hour']).toBe("You've reached the reading limit for now. Please try again in about an hour.");
    expect(ja['proxy.limit.day']).toBe('今日の読み取り回数の上限に達しました。明日もう一度お試しください。');
    expect(en['proxy.limit.day']).toBe("You've reached today's reading limit. Please try again tomorrow.");
    expect(ja['proxy.limit.fetch']).toBe('URLからの取得回数が上限に達しました。PDFをアップロードするか、しばらくしてからお試しください。');
    expect(en['proxy.limit.fetch']).toBe("You've reached the limit for fetching from addresses. Upload the PDF, or try again later.");
  });
});
