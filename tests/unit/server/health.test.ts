// Local proxy routes over HTTP on 127.0.0.1 (ADR 001, ADR 002). Outbound network is faked:
// the resolver and requester are injected, the extractor replays recorded fixtures.
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appVersion, createHandler, defaultDeps, proxyPort, startServer, type ProxyDeps } from '../../../server/index.ts';
import { memoryCache, windowCap } from '../../../server/menu/extract.ts';
import type { PdfResponse } from '../../../server/menu/fetch-pdf.ts';
import { createFixtureTransports } from '../../../server/menu/mock-transport.ts';

const MENUS = join(process.cwd(), 'tests', 'fixtures', 'menus');
const PDF = readFileSync(join(MENUS, 'fixture-menu-2026-11', 'menu.pdf'));

function servePdf(): PdfResponse {
  return {
    status: 200,
    headers: { 'content-type': 'application/pdf' },
    destroy: () => undefined,
    body: (async function* () {
      yield new Uint8Array(PDF);
    })(),
  };
}

const deps: ProxyDeps = {
  version: appVersion(),
  resolve: (host) => Promise.resolve(host === 'example-kinder.test' ? [{ address: '93.184.215.14', family: 4 }] : [{ address: '10.0.0.5', family: 4 }]),
  request: () => Promise.resolve(servePdf()),
  fixtures: createFixtureTransports(MENUS),
  cache: memoryCache(),
  extractCap: windowCap({ perHour: 100, perDay: 100 }, () => 0),
  fetchCap: windowCap({ perHour: 100, perDay: 100 }, () => 0),
  primaryModel: 'gemini-3.8-flash',
  fallbackModel: 'gemini-3.5-flash-lite',
  allowScenarios: true,
  nowMs: () => Date.parse('2026-10-28T01:00:00Z'),
  sleep: () => Promise.resolve(),
  log: () => undefined,
};

let base = '';
let server: ReturnType<typeof startServer>;

beforeAll(async () => {
  server = startServer(0, '127.0.0.1', deps);
  await new Promise<void>((resolve) => server.on('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const extract = (query: string, raw: Uint8Array = PDF, headers: Record<string, string> = {}) =>
  fetch(`${base}/api/menu/extract?${query}`, { method: 'POST', body: new Uint8Array(raw), headers: { 'content-type': 'application/pdf', ...headers } });

describe('local proxy', () => {
  it('GET /api/health answers { ok: true, version }', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ ok: true, version: appVersion() });
  });

  it('refuses other methods and unknown routes', async () => {
    expect((await fetch(`${base}/api/health`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${base}/api/menu/extract`)).status).toBe(405);
    expect((await fetch(`${base}/api/menu/fetch-pdf`)).status).toBe(405);
    const missing = await fetch(`${base}/api/menu/other`, { method: 'POST' });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('reads PROXY_PORT with 8787 as the default, and the caps from the environment', () => {
    expect(proxyPort({})).toBe(8787);
    expect(proxyPort({ PROXY_PORT: '9000' })).toBe(9000);
    expect(() => proxyPort({ PROXY_PORT: 'abc' })).toThrow(RangeError);
    expect(defaultDeps({}).primaryModel).toBe('gemini-3.8-flash');
    expect(defaultDeps({}).fallbackModel).toBe('gemini-3.5-flash-lite');
    expect(() => defaultDeps({ PROXY_EXTRACT_PER_HOUR: '-1' })).toThrow(RangeError);
    // D-M1-09: the scenario header is honoured only when explicitly switched on.
    expect(defaultDeps({}).allowScenarios).toBe(false);
    expect(defaultDeps({ PROXY_MOCK_SCENARIOS: '0' }).allowScenarios).toBe(false);
    expect(defaultDeps({ PROXY_MOCK_SCENARIOS: '1' }).allowScenarios).toBe(true);
    expect(defaultDeps({}).fixtures.known.size).toBeGreaterThan(0);
    expect(typeof createHandler(deps)).toBe('function');
  });
});

describe('POST /api/menu/fetch-pdf', () => {
  const post = (body: string) => fetch(`${base}/api/menu/fetch-pdf`, { method: 'POST', body, headers: { 'content-type': 'application/json' } });

  it('US-E2-01/AC1 returns the PDF bytes with their sha256', async () => {
    const res = await post(JSON.stringify({ url: 'https://example-kinder.test/menu/2026-11.pdf' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await res.arrayBuffer()).equals(PDF)).toBe(true);
    expect(res.headers.get('x-bm-sha256')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('US-E2-02/AC3 a host resolving to a private address answers BLOCKED as JSON', async () => {
    const res = await post(JSON.stringify({ url: 'https://intranet.test/m.pdf' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, error: 'BLOCKED' });
  });

  it('US-E2-01/AC2 bad bodies are refused', async () => {
    expect((await post('not json')).status).toBe(400);
    expect((await post(JSON.stringify({ url: 3 }))).status).toBe(400);
    expect(await (await post(JSON.stringify({ url: 'http://a.test/m.pdf' }))).json()).toEqual({ ok: false, error: 'URL_NOT_ALLOWED' });
  });
});

describe('POST /api/menu/extract', () => {
  const ok = 'targetMonth=2026-11&promptVersion=1&schemaVersion=1';

  it('US-E2-04/AC1 the FX-01 PDF is recognised by sha256 and its recorded reading returned', async () => {
    const res = await extract(ok);
    const body = (await res.json()) as { ok: boolean; menu: { days: unknown[] }; meta: { providerCalls: number } };
    expect(body.ok).toBe(true);
    expect(body.menu.days).toHaveLength(18);
    expect([0, 1]).toContain(body.meta.providerCalls);
  });

  it('US-NF-03/AC1 only targetMonth, promptVersion and schemaVersion are accepted in the query (BR-10)', async () => {
    expect((await extract(`${ok}&nickname=hana`)).status).toBe(400);
    expect((await extract('targetMonth=2026-13&promptVersion=1&schemaVersion=1')).status).toBe(400);
    expect((await extract('targetMonth=2026-11&promptVersion=9&schemaVersion=1')).status).toBe(400);
  });

  it('US-E2-06/AC4 an unknown PDF without a scenario is NOT_CONFIGURED', async () => {
    const other = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('other')]);
    expect(await (await extract(ok, other)).json()).toEqual({ ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 });
  });

  it('US-E2-05/AC2 a scenario header replays malformed replies: 2 calls, MALFORMED_OUTPUT', async () => {
    const res = await extract(ok, PDF, { 'x-bm-mock-scenario': 'fixture-menu-2026-11/hand-malformed' });
    expect(await res.json()).toEqual({ ok: false, error: 'MALFORMED_OUTPUT', providerCalls: 2 });
  });

  it('US-E2-03/AC3 a body over 10 MB is refused as TOO_LARGE', async () => {
    const big = Buffer.alloc(10_485_761);
    big.write('%PDF-');
    expect(await (await extract(ok, big)).json()).toEqual({ ok: false, error: 'TOO_LARGE', providerCalls: 0 });
  });
});
