// QA M1: the proxy called directly (no browser): SSRF refusals (BR-14, US-E2-02/AC3), payload
// allow-list (BR-10, US-NF-03/AC1), provider-call cap and cache (BR-10, US-E2-06/AC8, US-E2-07/AC1).
// Each test group starts its own proxy instance on a free port, so caps/caches never leak between tests.
// A honeypot listens on 127.0.0.1:443 and [::1]:443: a refused SSRF target must never connect to it.
import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:net';
import { readFileSync } from 'node:fs';
import { FX, ROOT } from './helpers.ts';

const FX01 = FX('fixture-menu-2026-11');
const OK = 'fixture-menu-2026-11/hand-1';

async function startProxy(port: number, env: Record<string, string> = {}): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['server/index.ts'], { cwd: ROOT, env: { ...process.env, PROXY_PORT: String(port), ...env }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (r.ok) return child;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error('proxy did not start');
}

const post = (port: number, path: string, body: BodyInit, headers: Record<string, string> = {}) =>
  fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', body, headers });
const fetchPdf = (port: number, url: unknown) => post(port, '/api/menu/fetch-pdf', JSON.stringify({ url }), { 'content-type': 'application/json' });
const Q = 'targetMonth=2026-11&promptVersion=1&schemaVersion=1';
const extract = (port: number, pdf: Uint8Array, scenario?: string) => post(port, `/api/menu/extract?${Q}`, pdf, scenario ? { 'x-bm-mock-scenario': scenario } : {});

test.describe.configure({ mode: 'serial' });

test.describe('SSRF', () => {
  let proxy: ChildProcess;
  const hits: string[] = [];
  const honeypots: Server[] = [];
  const PORT = 18791;

  test.beforeAll(async () => {
    for (const host of ['127.0.0.1', '::1']) {
      await new Promise<void>((resolve) => {
        const srv = createServer((sock) => {
          hits.push(`${host} connection`);
          sock.destroy();
        });
        srv.on('error', () => resolve()); // port 443 busy / not permitted: the assertion below then only proves "no error from proxy"
        srv.listen(443, host, () => {
          honeypots.push(srv);
          resolve();
        });
      });
    }
    proxy = await startProxy(PORT, { PROXY_FETCH_PER_HOUR: '1000' });
  });
  test.afterAll(() => {
    proxy.kill();
    for (const s of honeypots) s.close();
  });

  const BLOCKED = [
    'https://127.0.0.1/menu.pdf',
    'https://localhost/menu.pdf',
    'https://localhost./menu.pdf',
    'https://LOCALHOST/menu.pdf',
    'https://169.254.169.254/latest/meta-data/',
    'https://[::1]/menu.pdf',
    'https://[::ffff:127.0.0.1]/menu.pdf',
    'https://[::ffff:7f00:1]/menu.pdf',
    'https://[::]/menu.pdf',
    'https://0.0.0.0/menu.pdf',
    'https://0/menu.pdf',
    'https://127.1/menu.pdf',
    'https://2130706433/menu.pdf',
    'https://0x7f000001/menu.pdf',
    'https://0177.0.0.1/menu.pdf',
    'https://10.0.0.1/menu.pdf',
    'https://172.16.0.1/menu.pdf',
    'https://192.168.0.1/menu.pdf',
    'https://100.64.0.1/menu.pdf',
    'https://[fe80::1]/menu.pdf',
    'https://[fc00::1]/menu.pdf',
    'https://[fd00::1]/menu.pdf',
    'https://[64:ff9b::7f00:1]/menu.pdf',
    'https://[2002:7f00:1::]/menu.pdf',
    'https://[::127.0.0.1]/menu.pdf',
    'https://127.0.0.1:443/menu.pdf',
    'https://user:pw@127.0.0.1/menu.pdf',
    'https://127.0.0.1%2f@example.test/x.pdf',
    'https://１２７.０.０.１/menu.pdf',
    'https://224.0.0.1/menu.pdf',
    'https://255.255.255.255/menu.pdf',
  ];
  for (const url of BLOCKED) {
    test(`US-E2-02/AC3 BR-14 blocked: ${url}`, async () => {
      const r = await fetchPdf(PORT, url);
      const j = await r.json();
      expect(r.status, JSON.stringify(j)).toBe(422);
      expect(j.ok).toBe(false);
      // refused targets answer with the 403 message (BLOCKED; URL_NOT_ALLOWED is mapped to it by the client), never a connection error
      expect(['BLOCKED', 'URL_NOT_ALLOWED'], `${url}: ${j.error}`).toContain(j.error);
      expect(hits).toEqual([]);
    });
  }

  for (const url of ['http://example-kinder.test/m.pdf', 'https://example-kinder.test:8443/m.pdf', 'ftp://example.test/m.pdf', 'javascript:alert(1)', 'menu.pdf', '', 'https://' + 'a'.repeat(2050) + '.test/m.pdf']) {
    test(`US-E2-01/AC2 BR-14 proxy refuses without any lookup: ${url.slice(0, 50)}`, async () => {
      const r = await fetchPdf(PORT, url);
      const j = await r.json();
      expect(r.status).toBe(422);
      expect(j.ok).toBe(false);
    });
  }

  test('BR-14 hostile bodies: not JSON, wrong type, huge body, GET', async () => {
    expect((await post(PORT, '/api/menu/fetch-pdf', 'not json')).status).toBe(400);
    expect((await fetchPdf(PORT, 42)).status).toBe(400);
    expect((await fetchPdf(PORT, null)).status).toBe(400);
    expect((await fetchPdf(PORT, { toString: 1 })).status).toBe(400);
    expect((await post(PORT, '/api/menu/fetch-pdf', JSON.stringify({ url: 'https://x.test/' + 'a'.repeat(20000) }))).status).toBeGreaterThanOrEqual(400);
    expect((await fetch(`http://127.0.0.1:${PORT}/api/menu/fetch-pdf`)).status).toBe(405);
    expect((await fetch(`http://127.0.0.1:${PORT}/api/menu/nope`)).status).toBe(404);
    expect(hits).toEqual([]);
  });

  test('BR-14 the proxy binds to 127.0.0.1 only', async () => {
    const nets = (await import('node:os')).networkInterfaces();
    const lan = Object.values(nets)
      .flat()
      .find((n) => n && n.family === 'IPv4' && !n.internal);
    if (!lan) test.skip(true, 'no LAN interface on this machine to probe');
    const r = await fetch(`http://${lan!.address}:${PORT}/api/health`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    expect(r).toBeNull();
  });
});

test.describe('extract allow-list, cache and caps', () => {
  test('BR-10 US-NF-03/AC1 US-E2-04/AC7 extract accepts only targetMonth, promptVersion, schemaVersion and the PDF', async () => {
    const proxy = await startProxy(18792);
    try {
      const pdf = readFileSync(FX01);
      const base = 'http://127.0.0.1:18792/api/menu/extract';
      for (const extra of ['nickname=Hana', 'allergen=egg', 'profile=%7B%7D', 'likes=ing-chicken', 'note=x']) {
        const r = await fetch(`${base}?${Q}&${extra}`, { method: 'POST', body: pdf });
        expect(r.status, extra).toBe(400);
      }
      for (const bad of ['targetMonth=2026-13&promptVersion=1&schemaVersion=1', 'targetMonth=2026-11&promptVersion=2&schemaVersion=1', 'targetMonth=2026-11&promptVersion=1', 'targetMonth=<script>&promptVersion=1&schemaVersion=1']) {
        expect((await fetch(`${base}?${bad}`, { method: 'POST', body: pdf })).status, bad).toBe(400);
      }
      expect((await fetch(`${base}?${Q}`, { method: 'GET' })).status).toBe(405);
    } finally {
      proxy.kill();
    }
  });

  test('US-E2-07/AC1 BR-10 a PDF extracted before costs 0 provider calls (server cache); second reply is cached', async () => {
    const proxy = await startProxy(18793);
    try {
      const pdf = readFileSync(FX01);
      const a = await (await extract(18793, pdf)).json();
      expect(a.ok).toBe(true);
      expect(a.meta.providerCalls).toBe(1);
      expect(a.meta.cached).toBe(false);
      const b = await (await extract(18793, pdf)).json();
      expect(b.ok).toBe(true);
      expect(b.meta.providerCalls).toBe(0);
      expect(b.meta.cached).toBe(true);
    } finally {
      proxy.kill();
    }
  });

  test('US-E2-06/AC8 BR-10 proxy cap: 5 per hour, then 0 provider calls and RATE_LIMITED; failures count toward the cap', async () => {
    const proxy = await startProxy(18794);
    try {
      const results: any[] = [];
      for (let i = 0; i < 7; i++) {
        const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(`unique-${i}`)]);
        results.push(await (await extract(18794, pdf, OK)).json());
      }
      expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
      expect(results[5]).toMatchObject({ ok: false, error: 'RATE_LIMITED', providerCalls: 0 });
      expect(results[6]).toMatchObject({ ok: false, error: 'RATE_LIMITED', providerCalls: 0 });
    } finally {
      proxy.kill();
    }
  });

  test('BR-10 extract: not-a-PDF, empty and oversize bodies make 0 provider calls', async () => {
    const proxy = await startProxy(18795);
    try {
      const notPdf = await (await extract(18795, Buffer.from('hello'), OK)).json();
      expect(notPdf).toMatchObject({ ok: false, error: 'NOT_A_PDF', providerCalls: 0 });
      const empty = await (await extract(18795, Buffer.alloc(0), OK)).json();
      expect(empty).toMatchObject({ ok: false, providerCalls: 0 });
      const big = Buffer.alloc(10_485_761, 0x20);
      big.write('%PDF-1.4', 0);
      const r = await extract(18795, big, OK);
      const j = await r.json();
      expect(j).toMatchObject({ ok: false, error: 'TOO_LARGE', providerCalls: 0 });
    } finally {
      proxy.kill();
    }
  });

  test('BR-10 scenario header is ignored when PROXY_MOCK_SCENARIOS=0 (hosted deployment switch)', async () => {
    const proxy = await startProxy(18796, { PROXY_MOCK_SCENARIOS: '0' });
    try {
      const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('unknown-bytes')]);
      const j = await (await extract(18796, pdf, OK)).json();
      expect(j).toMatchObject({ ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 });
    } finally {
      proxy.kill();
    }
  });

  test('BR-10 hostile scenario header values cannot read files outside tests/fixtures', async () => {
    const proxy = await startProxy(18797);
    try {
      const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('x')]);
      for (const h of ['../../package/x', '..\\..\\package', 'a/b/c', '%2e%2e/%2e%2e/etc', 'fixture-menu-2026-11/../../../package']) {
        const r = await extract(18797, pdf, h);
        const j = await r.json();
        expect(r.status, h).toBeLessThan(500);
        expect(j.ok, h).toBe(false);
      }
    } finally {
      proxy.kill();
    }
  });
});

// D-M1-09 (P3): a scenario-driven extraction (bypassCache) still WRITES its result to the proxy cache
// (server/menu/extract.ts, line "deps.cache.set" is unconditional), so a later normal request for the same PDF
// is answered with the scenario's reading instead of the PDF's own recorded one.
test.fixme('US-E2-07/AC1 BR-10 D-M1-09 a scenario reply must not be cached for later requests of the same PDF', async () => {
  const proxy = await startProxy(18798);
  try {
    const pdf = readFileSync(FX01);
    const a = await (await extract(18798, pdf, 'fixture-menu-2026-11/hand-duplicate')).json();
    expect(a.ok).toBe(true);
    const b = await (await extract(18798, pdf)).json();
    expect(b.ok).toBe(true);
    const dates = b.menu.days.map((d: { date: string }) => d.date);
    expect(dates.filter((d: string) => d === '2026-11-05')).toHaveLength(1);
    expect(JSON.stringify(b.menu)).not.toContain('duplicate-date');
  } finally {
    proxy.kill();
  }
});
