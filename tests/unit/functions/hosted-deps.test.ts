// How the function wires the core (functions/src/hosted-deps.ts): configuration parsing and the hosted-only
// dependency choices (US-E14-03/AC1, US-E14-05, US-E14-06/AC3). Fakes for every port; no Firebase, no Gemini.
import { describe, expect, it, vi } from 'vitest';
import { handle, TooLarge, type CoreRequest } from '../../../server/core/handle.ts';
import { DEFAULT_LIMITS, type AccountCounters, type CounterStore } from '../../../server/core/hosted-policy.ts';
import { buildHostedDeps, DEFAULT_ORIGINS, parseLimits, parseOrigins, type HostedConfig, type HostedPorts } from '../../../functions/src/hosted-deps.ts';
import { ALICE, auth, EXTRACT_QUERY, NOW, ORIGIN, PDF } from '../server/hosted/harness.ts';

const FAKE_KEY = ['fake', 'gemini', 'key', 'for', 'tests'].join('-');
const GOOD_REPLY = { candidates: [{ content: { parts: [{ text: '{}' }] } }] };

function ports(over: Partial<HostedPorts> = {}) {
  const logs: string[] = [];
  const store: CounterStore = { update: vi.fn((_k, fn) => Promise.resolve(fn(undefined as AccountCounters | undefined).value)) } as unknown as CounterStore;
  const fetchSpy = vi.fn(() => Promise.resolve(new Response(JSON.stringify(GOOD_REPLY), { status: 200 })));
  const resolveSpy = vi.fn(() => Promise.resolve([{ address: '93.184.215.14', family: 4 as const }]));
  const requestSpy = vi.fn(() => Promise.resolve({ status: 200, headers: { 'content-type': 'application/pdf' }, destroy: () => undefined, body: (async function* () { yield PDF; })() }));
  const p: HostedPorts = {
    verifier: (t) => Promise.resolve(t === 'tok-alice' ? ALICE : null),
    store,
    resolve: resolveSpy,
    request: requestSpy,
    fetch: fetchSpy as unknown as typeof fetch,
    nowMs: () => NOW,
    sleep: () => Promise.resolve(),
    log: (m) => void logs.push(m),
    ...over,
  };
  return { p, logs, store, fetchSpy, requestSpy };
}

const config = (over: Partial<HostedConfig> = {}): HostedConfig => ({ version: '1.2.3', geminiKey: FAKE_KEY, allowedAccounts: 'test-uid-001', allowedOrigins: ORIGIN, limits: {}, ...over });

function post(path: string, headers: Record<string, string>, body: Uint8Array | string = new Uint8Array(), query = ''): CoreRequest {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  return {
    method: 'POST',
    path,
    query: new URLSearchParams(query),
    headers,
    readBody: (limit) => (bytes.byteLength > limit ? Promise.reject(new TooLarge()) : Promise.resolve(bytes)),
  };
}
const text = (b: Uint8Array | string | null) => (typeof b === 'string' ? b : new TextDecoder().decode(b ?? new Uint8Array()));

describe('US-E14-05/AC1 allowed origins are configuration', () => {
  it.each([
    ['https://mrdrah.github.io', ['https://mrdrah.github.io']],
    ['https://mrdrah.github.io, http://localhost:5173', ['https://mrdrah.github.io', 'http://localhost:5173']],
    ['https://a.example\nhttps://b.example', ['https://a.example', 'https://b.example']],
    ['*', []],
    ['https://*.example.com', []],
    ['https://mrdrah.github.io/', []],
    ['https://mrdrah.github.io/app', []],
    ['mrdrah.github.io', []],
    ['javascript:alert(1)', []],
    ['', []],
  ])('US-E14-05/AC1 origins %j parse to %j (exact origins only, never a wildcard)', (raw, expected) => {
    expect(parseOrigins(raw)).toEqual(expected);
  });
  it('US-E14-05/AC1 non-strings give no origin and the DEFAULT is the Pages origin', () => {
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins(42)).toEqual([]);
    expect(DEFAULT_ORIGINS).toBe('https://mrdrah.github.io');
  });
  it('US-E14-05/AC1 an unset origins setting falls back to the DEFAULT', () => {
    expect(buildHostedDeps(config({ allowedOrigins: undefined }), ports().p).policy?.allowedOrigins).toEqual(['https://mrdrah.github.io']);
  });
});

describe('US-E14-03/AC1 limits are configuration with the contract DEFAULT values', () => {
  it('US-E14-03/AC1 absent settings give 5/20 extract and 30/100 fetch', () => {
    expect(parseLimits({})).toEqual(DEFAULT_LIMITS);
    expect(DEFAULT_LIMITS).toEqual({ extract: { perHour: 5, perDay: 20 }, fetch: { perHour: 30, perDay: 100 } });
  });
  it('US-E14-03/AC1 configured values replace the defaults', () => {
    expect(parseLimits({ extractPerHour: 2, extractPerDay: 3, fetchPerHour: 4, fetchPerDay: 5 })).toEqual({ extract: { perHour: 2, perDay: 3 }, fetch: { perHour: 4, perDay: 5 } });
  });
  it.each([0, -1, 1.5, NaN, '7', null, undefined])('US-E14-03/AC1 an invalid value %j keeps the DEFAULT', (v) => {
    expect(parseLimits({ extractPerHour: v, fetchPerDay: v })).toEqual(DEFAULT_LIMITS);
  });
  it('US-E14-03/AC1 a configured hourly limit of 2 is what the core enforces', async () => {
    const memory = new Map<string, AccountCounters>();
    const { p } = ports({
      store: { update: (k, fn) => { const r = fn(memory.get(k)); memory.set(k, r.next); return Promise.resolve(r.value); } } as CounterStore,
    });
    const deps = buildHostedDeps(config({ limits: { extractPerHour: 2 } }), p);
    const run = () => handle(post('/api/menu/extract', auth('tok-alice'), PDF, EXTRACT_QUERY), deps);
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(429);
  });
});

describe('US-E14-05/AC4 and AC5 the key is only a runtime secret; absent means not configured', () => {
  it.each([undefined, '', '   '])('US-E14-05/AC5 a missing key (%j) gives NOT_CONFIGURED with 0 provider calls, no count, and fetch still works', async (key) => {
    const { p, fetchSpy, store } = ports();
    const deps = buildHostedDeps(config({ geminiKey: key }), p);
    expect(deps.provider).toBeNull();
    const e = await handle(post('/api/menu/extract', auth('tok-alice'), PDF, EXTRACT_QUERY), deps);
    expect(JSON.parse(text(e.body))).toMatchObject({ ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled(); // a request that could not be served is not counted
    const f = await handle(post('/api/menu/fetch-pdf', auth('tok-alice'), JSON.stringify({ url: 'https://example-kinder.test/menu.pdf' })), deps);
    expect(f.status).toBe(200);
  });

  it('US-E14-05/AC4 with a key the provider is called with it, and the key never appears in a reply, header or log line', async () => {
    const { p, logs, fetchSpy } = ports();
    const deps = buildHostedDeps(config(), p);
    const e = await handle(post('/api/menu/extract', auth('tok-alice'), PDF, EXTRACT_QUERY), deps);
    expect(fetchSpy).toHaveBeenCalled();
    expect(`${text(e.body)}${JSON.stringify(e.headers)}${logs.join('\n')}`).not.toContain(FAKE_KEY);
  });

  it('US-E14-05/AC4 a provider failure whose message holds the key logs and replies without it', async () => {
    const { p, logs } = ports({ fetch: (() => Promise.reject(new Error(`connect failed ${FAKE_KEY}`))) as unknown as typeof fetch });
    const e = await handle(post('/api/menu/extract', auth('tok-alice'), PDF, EXTRACT_QUERY), buildHostedDeps(config(), p));
    expect(`${text(e.body)}${JSON.stringify(e.headers)}${logs.join('\n')}`).not.toContain(FAKE_KEY);
  });
});

describe('US-E14-02/AC4 the allow-list secret', () => {
  it.each([undefined, '', ' , ,\n'])('US-E14-02/AC4 an unset or blank list (%j) denies every account', async (list) => {
    const deps = buildHostedDeps(config({ allowedAccounts: list }), ports().p);
    const e = await handle(post('/api/menu/extract', auth('tok-alice'), PDF, EXTRACT_QUERY), deps);
    expect(e.status).toBe(403);
    expect(JSON.parse(text(e.body))).toEqual({ ok: false, error: 'NOT_ALLOWED' });
  });
});

describe('US-E14-06/AC3 nothing is persisted; hosted-only dependency choices', () => {
  it('US-E14-06/AC3 hosted policy is on, scenarios are off, no fixtures, no cache entry, no process-local cap', async () => {
    const deps = buildHostedDeps(config(), ports().p);
    expect(deps.policy).not.toBeNull();
    expect(deps.allowScenarios).toBe(false);
    expect(deps.fixtures.known.size).toBe(0);
    expect(deps.fixtures.forRequest('abc', 'any/scenario')).toBeNull();
    deps.cache.set('k', { ok: true } as never);
    expect(deps.cache.get('k')).toBeUndefined();
    expect(deps.version).toBe('1.2.3');
  });

  it('US-E14-06/AC3 a scenario header is ignored: the recorded-fixture path is never taken hosted', async () => {
    const { p, fetchSpy } = ports();
    const deps = buildHostedDeps(config({ geminiKey: undefined }), p);
    const e = await handle(post('/api/menu/extract', { ...auth('tok-alice'), 'x-bm-mock-scenario': 'fixture-menu-2026-11/hand-1' }, PDF, EXTRACT_QUERY), deps);
    expect(JSON.parse(text(e.body))).toMatchObject({ ok: false, error: 'NOT_CONFIGURED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('US-E14-06/AC3 the same PDF twice calls the provider twice: no stored extraction on the server', async () => {
    const memory = new Map<string, AccountCounters>();
    const { p, fetchSpy } = ports({ store: { update: (k, fn) => { const r = fn(memory.get(k)); memory.set(k, r.next); return Promise.resolve(r.value); } } as CounterStore });
    const deps = buildHostedDeps(config(), p);
    for (let i = 0; i < 2; i += 1) await handle(post('/api/menu/extract', auth('tok-alice'), PDF, EXTRACT_QUERY), deps);
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
