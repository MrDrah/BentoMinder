// QA E14: US-E14-05 browser origins (CORS) and the Gemini key, plus buildHostedDeps wiring (config -> policy).
import { describe, expect, it } from 'vitest';
import { handle, TooLarge, type CoreRequest } from '../../../../server/core/handle.ts';
import { accountKey, type AccountCounters, type CounterStore } from '../../../../server/core/hosted-policy.ts';
import { buildHostedDeps, DEFAULT_ORIGINS, parseOrigins, type HostedConfig, type HostedPorts } from '../../../../functions/src/hosted-deps.ts';
import { A, effects, extract, fetchUrl, NO_EFFECTS, okPdf, ORIGIN, pdfBytes, QUERY, rig, send, bearer } from './rig.ts';

const SENTINEL_KEY = ['AIza', 'SyQA-E14-SENTINEL-0123456789abcdefgh'].join('');
const header = (c: { res: { headers: Record<string, string> } }, name: string) => Object.entries(c.res.headers).find(([k]) => k.toLowerCase() === name)?.[1];
const hasHeader = (c: { res: { headers: Record<string, string> } }, name: string) => header(c, name) !== undefined;

describe('US-E14-05/AC1 allowed origins get exact CORS headers', () => {
  for (const path of ['/api/menu/extract', '/api/menu/fetch-pdf', '/api/health']) {
    it(`US-E14-05/AC1 preflight ${path}: names exactly the origin, POST+OPTIONS only, Authorization+Content-Type only, no credentials, never *`, async () => {
      const r = rig();
      const c = await send(r, path, { method: 'OPTIONS', headers: { origin: ORIGIN } });
      expect(header(c, 'access-control-allow-origin')).toBe(ORIGIN);
      expect(header(c, 'access-control-allow-methods')?.split(/\s*,\s*/).sort()).toEqual(['OPTIONS', 'POST']);
      expect(header(c, 'access-control-allow-headers')?.toLowerCase().split(/\s*,\s*/).sort()).toEqual(['authorization', 'content-type']);
      expect(hasHeader(c, 'access-control-allow-credentials')).toBe(false);
      expect(JSON.stringify(c.res.headers)).not.toContain('"*"');
      expect(effects(r)).toEqual(NO_EFFECTS);
    });
  }
  it('US-E14-05/AC1 real responses (200, 401, 403, 429) from the allowed origin carry the same exact origin, never *', async () => {
    const r = rig();
    const ok = await extract(r, 'tok-a', { headers: { origin: ORIGIN } });
    const noTok = await send(r, '/api/menu/extract', { query: QUERY, body: pdfBytes(), headers: { origin: ORIGIN } });
    const denied = await extract(r, 'tok-stranger', { headers: { origin: ORIGIN } });
    for (let i = 0; i < 5; i++) await extract(r, 'tok-a', { headers: { origin: ORIGIN } });
    const limited = await extract(r, 'tok-a', { headers: { origin: ORIGIN } });
    for (const c of [ok, noTok, denied, limited]) {
      expect(header(c, 'access-control-allow-origin')).toBe(ORIGIN);
      expect(hasHeader(c, 'access-control-allow-credentials')).toBe(false);
    }
    expect([noTok.res.status, denied.res.status, limited.res.status]).toEqual([401, 403, 429]);
  });
  it('US-E14-05/AC1 two configured origins: each is echoed exactly, not the list', async () => {
    const r = rig({ origins: [ORIGIN, 'http://localhost:5173'] });
    expect(header(await send(r, '/api/health', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }), 'access-control-allow-origin')).toBe('http://localhost:5173');
    expect(header(await send(r, '/api/health', { method: 'OPTIONS', headers: { origin: ORIGIN } }), 'access-control-allow-origin')).toBe(ORIGIN);
  });
});

describe('US-E14-05/AC2 other origins are not served', () => {
  const bad = [
    'https://evil.example',
    'null',
    '',
    '*',
    `${ORIGIN}/`,
    `${ORIGIN}/path`,
    `${ORIGIN}:443`,
    `${ORIGIN}:8443`,
    'http://app.example.test',
    'https://APP.example.test',
    'https://app.example.test.evil.example',
    'https://evilapp.example.test',
    'https://app.example.test@evil.example',
    'https://evil.example/https://app.example.test',
    `${ORIGIN} `,
    ` ${ORIGIN}`,
    `${ORIGIN}, https://evil.example`,
    'https://app.example.test\u0000',
    'app.example.test',
    'file://',
    'chrome-extension://abcdefghijklmnop',
  ];
  for (const origin of bad) {
    it(`US-E14-05/AC2 Origin ${JSON.stringify(origin)}: 403 ORIGIN_NOT_ALLOWED, no ACAO header, nothing called (POST with a valid token, preflight, health)`, async () => {
      const r = rig();
      const post = await extract(r, 'tok-a', { headers: { origin } });
      const pre = await send(r, '/api/menu/extract', { method: 'OPTIONS', headers: { origin } });
      const health = await send(r, '/api/health', { method: 'GET', headers: { origin } });
      const fetchc = await fetchUrl(r, 'https://example-kinder.test/m.pdf', 'tok-a', { headers: { origin } });
      for (const c of [post, pre, health, fetchc]) {
        expect(c.res.status).toBe(403);
        expect(c.json).toEqual({ ok: false, error: 'ORIGIN_NOT_ALLOWED' });
        expect(hasHeader(c, 'access-control-allow-origin')).toBe(false);
        expect(Object.keys(c.res.headers).some((k) => k.toLowerCase().startsWith('access-control-'))).toBe(false);
        expect(c.bodyReads).toBe(0);
      }
      expect(r.verifier.calls).toEqual([]);
      expect(effects(r)).toEqual(NO_EFFECTS);
    });
  }
  it('US-E14-05/AC2 the origin is judged before the token: bad origin + no token is ORIGIN_NOT_ALLOWED', async () => {
    const r = rig();
    const c = await send(r, '/api/menu/extract', { query: QUERY, body: pdfBytes(), headers: { origin: 'https://evil.example' } });
    expect(c.json['error']).toBe('ORIGIN_NOT_ALLOWED');
  });
});

describe('US-E14-05/AC3 a request with no Origin is judged by the token', () => {
  it('US-E14-05/AC3 no Origin and no token: UNAUTHENTICATED; with a stranger token: NOT_ALLOWED; with an allowed token: processed', async () => {
    const r = rig();
    expect((await send(r, '/api/menu/extract', { query: QUERY, body: pdfBytes() })).json['error']).toBe('UNAUTHENTICATED');
    expect((await extract(r, 'tok-stranger')).json['error']).toBe('NOT_ALLOWED');
    const ok = await extract(r, 'tok-a');
    expect(ok.res.status).toBe(200);
    expect(hasHeader(ok, 'access-control-allow-origin')).toBe(false);
  });
});

describe('US-E14-05 origin configuration (parseOrigins / buildHostedDeps)', () => {
  it('US-E14-05/AC1 only exact scheme://host[:port] entries survive; wildcards, paths, trailing slashes, junk are dropped', () => {
    expect(parseOrigins('https://mrdrah.github.io')).toEqual(['https://mrdrah.github.io']);
    expect(parseOrigins('https://mrdrah.github.io, http://localhost:5173')).toEqual(['https://mrdrah.github.io', 'http://localhost:5173']);
    for (const junk of ['*', 'https://*.github.io', 'https://mrdrah.github.io/', 'https://mrdrah.github.io/app', 'mrdrah.github.io', 'https://', 'javascript:alert(1)', 'https://a.test?x', 'https://a.test#x', '']) {
      expect(parseOrigins(junk)).toEqual([]);
    }
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins(42)).toEqual([]);
  });
  it('US-E14-05/AC1 DEFAULT origin is https://mrdrah.github.io and the dev origin is NOT in the default', () => {
    expect(DEFAULT_ORIGINS).toBe('https://mrdrah.github.io');
  });
});

// ---- buildHostedDeps with a fake provider fetch (N3: nothing leaves the machine) --------------------------------------
interface Seen {
  url: string;
  headers: Record<string, string>;
  body: string;
}
function hostedRig(config: Partial<HostedConfig>, fetchImpl?: (u: string, init: RequestInit) => Promise<Response>) {
  const seen: Seen[] = [];
  const logs: string[] = [];
  const store: CounterStore = {
    data: new Map<string, AccountCounters>(),
    update(key: string, fn: (c: AccountCounters | undefined) => { next: AccountCounters; value: unknown }) {
      const { next, value } = fn(this.data.get(key));
      this.data.set(key, next);
      return Promise.resolve(value);
    },
  } as CounterStore & { data: Map<string, AccountCounters> };
  const ports: HostedPorts = {
    verifier: (t) => Promise.resolve(t === 'tok-a' ? A : null),
    store,
    resolve: () => Promise.resolve([{ address: '93.184.215.14', family: 4 }]),
    request: () => Promise.resolve(okPdf()),
    fetch: (async (u: string | URL | Request, init?: RequestInit) => {
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      seen.push({ url: String(u), headers, body: typeof init?.body === 'string' ? init.body : '[binary]' });
      return fetchImpl === undefined ? new Response('{}', { status: 500 }) : fetchImpl(String(u), init ?? {});
    }) as typeof fetch,
    nowMs: () => Date.parse('2026-11-10T03:00:00Z'),
    sleep: () => Promise.resolve(),
    log: (m) => void logs.push(m),
  };
  const deps = buildHostedDeps({ version: '1.2.3', geminiKey: SENTINEL_KEY, allowedAccounts: 'test-uid-001', allowedOrigins: ORIGIN, limits: {}, ...config }, ports);
  const call = async (path: string, o: { method?: string; query?: string; headers?: Record<string, string>; body?: Uint8Array | string } = {}) => {
    const body = typeof o.body === 'string' ? new TextEncoder().encode(o.body) : (o.body ?? new Uint8Array());
    const req: CoreRequest = {
      method: o.method ?? 'POST',
      path,
      query: new URLSearchParams(o.query ?? ''),
      headers: Object.fromEntries(Object.entries(o.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
      readBody: (l) => (body.byteLength > l ? Promise.reject(new TooLarge()) : Promise.resolve(body)),
    };
    const res = await handle(req, deps);
    const text = res.body === null ? '' : typeof res.body === 'string' ? res.body : new TextDecoder().decode(res.body);
    return { res, text, json: (() => { try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; } })() };
  };
  return { deps, seen, logs, call, store };
}
const doExtract = (h: ReturnType<typeof hostedRig>, extra: Record<string, string> = {}) => h.call('/api/menu/extract', { query: QUERY, body: pdfBytes(), headers: { ...bearer('tok-a'), ...extra } });

describe('US-E14-05/AC4 the Gemini key lives only in the outbound provider request', () => {
  it('US-E14-05/AC4 the key is sent to the provider in the x-goog-api-key header only, never URL or body', async () => {
    const h = hostedRig({});
    await doExtract(h);
    expect(h.seen.length).toBeGreaterThan(0);
    for (const s of h.seen) {
      expect(s.headers['x-goog-api-key']).toBe(SENTINEL_KEY);
      expect(s.url).not.toContain(SENTINEL_KEY);
      expect(s.body).not.toContain(SENTINEL_KEY);
    }
  });
  it('US-E14-05/AC4 the key is in no reply (body or headers) and no log line, for every provider failure kind incl. an exception that quotes the key', async () => {
    const failures: Array<(u: string, i: RequestInit) => Promise<Response>> = [
      () => Promise.resolve(new Response('{}', { status: 500 })),
      () => Promise.resolve(new Response(`{"error":{"message":"API key ${SENTINEL_KEY} is invalid"}}`, { status: 400 })),
      () => Promise.resolve(new Response(`{"error":{"message":"quota ${SENTINEL_KEY}"}}`, { status: 429, headers: { 'retry-after': '3' } })),
      () => Promise.resolve(new Response(`not json ${SENTINEL_KEY}`, { status: 200 })),
      () => Promise.reject(new Error(`fetch failed for key ${SENTINEL_KEY}`)),
      () => Promise.reject(Object.assign(new TypeError(`boom ${SENTINEL_KEY}`), { cause: new Error(SENTINEL_KEY) })),
    ];
    for (const f of failures) {
      const h = hostedRig({}, f);
      const c = await doExtract(h, { origin: ORIGIN });
      expect(c.text + JSON.stringify(c.res.headers) + h.logs.join('\n')).not.toContain(SENTINEL_KEY);
    }
  });
  it('US-E14-05/AC5 secret missing, empty or blank: NOT_CONFIGURED, providerCalls 0, no outbound provider call, URL fetch still works', async () => {
    for (const geminiKey of [undefined, '', '   ']) {
      const h = hostedRig({ geminiKey });
      const c = await doExtract(h);
      expect(c.json).toMatchObject({ ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 });
      expect(h.seen).toEqual([]);
      const f = await h.call('/api/menu/fetch-pdf', { body: JSON.stringify({ url: 'https://example-kinder.test/menu.pdf' }), headers: bearer('tok-a') });
      expect(f.res.status).toBe(200);
    }
  });
  it('US-E14-05 the hosted deps never honour the recorded-fixture scenario header or a cache', async () => {
    const h = hostedRig({}, () => Promise.resolve(new Response('{}', { status: 500 })));
    const c = await doExtract(h, { 'x-bm-mock-scenario': 'rate-limited' });
    expect(h.seen.length).toBeGreaterThan(0); // the real provider path ran, no scenario was served
    expect(c.json['ok']).toBe(false);
    expect(h.deps.allowScenarios).toBe(false);
    const again = await doExtract(h);
    expect(again.json['providerCalls']).not.toBe(0); // no cache: the same PDF costs calls again
  });
  it('US-E14-05/AC1 default config (no origins given) accepts only https://mrdrah.github.io', async () => {
    const h = hostedRig({ allowedOrigins: undefined });
    expect((await h.call('/api/health', { method: 'OPTIONS', headers: { origin: 'https://mrdrah.github.io' } })).res.headers['access-control-allow-origin']).toBe('https://mrdrah.github.io');
    expect((await h.call('/api/health', { method: 'GET', headers: { origin: 'http://localhost:5173' } })).res.status).toBe(403);
  });
  it('US-E14-05/AC1 a wildcard or empty origin configuration blocks every browser (fail closed), not everyone', async () => {
    for (const allowedOrigins of ['*', '', 'https://mrdrah.github.io/']) {
      const h = hostedRig({ allowedOrigins });
      expect((await h.call('/api/health', { method: 'GET', headers: { origin: 'https://anything.test' } })).res.status).toBe(403);
      expect((await doExtract(h)).res.status).toBe(200); // no Origin: token-judged
    }
  });
  it('US-E14-02/AC4 config: allow-list undefined/empty denies everyone; accountKey is used in the log', async () => {
    for (const allowedAccounts of [undefined, '', ' , ']) {
      const h = hostedRig({ allowedAccounts });
      const c = await doExtract(h);
      expect(c.json).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    }
    const h = hostedRig({});
    await doExtract(h);
    expect(h.logs.some((l) => l.includes(`account=${accountKey(A.uid)}`))).toBe(true);
  });
  it('US-E14-02/AC3 limits from configuration are honoured', async () => {
    const h = hostedRig({ limits: { extractPerHour: 1 } });
    expect((await doExtract(h)).json['error']).not.toBe('ACCOUNT_LIMIT');
    expect((await doExtract(h)).json['error']).toBe('ACCOUNT_LIMIT');
  });
});
