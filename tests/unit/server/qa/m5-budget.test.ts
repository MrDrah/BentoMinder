// QA M5: the provider-call budget (BR-10, US-E2-07/AC1, AC2, AC4, US-E2-06, US-E2-05) driven through the real
// HTTP proxy handler with an injected fake provider transport. Derived from ADR 002 section 5 and the story
// tables, not from the developers' tests. No network, no key, no live call.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createHandler, type ProxyDeps } from '../../../../server/index.ts';
import { memoryCache, windowCap, type ExtractionCache, type ProviderReply, type ProviderRequest, type ProviderTransport } from '../../../../server/menu/extract.ts';
import { fileCache } from '../../../../server/menu/file-cache.ts';
import { createFixtureTransports } from '../../../../server/menu/mock-transport.ts';
import { EXTRACTION_SCHEMA_VERSION, PROMPT_VERSION } from '../../../../src/domain/menu/extraction.ts';

const MENUS = join(process.cwd(), 'tests', 'fixtures', 'menus');
const FX = join(MENUS, 'fixture-menu-2026-11');
const PDF = new Uint8Array(readFileSync(join(FX, 'menu.pdf')));
const recorded = (name: string) => JSON.parse(readFileSync(join(FX, 'recorded', `${name}.json`), 'utf8')).response as { rawText?: string; modelOutput?: unknown };
const textOf = (name: string) => {
  const r = recorded(name);
  return r.rawText ?? JSON.stringify(r.modelOutput);
};
const GOOD: ProviderReply = { kind: 'ok', text: textOf('hand-1') };
const MALFORMED: ProviderReply = { kind: 'ok', text: textOf('hand-malformed') };
const NOT_A_MENU: ProviderReply = { kind: 'ok', text: textOf('hand-not-a-menu') };
const EMPTY: ProviderReply = { kind: 'ok', text: '' };
const http = (status: number, retryAfterSec: number | null = null): ProviderReply => ({ kind: 'http', status, retryAfterSec });
const TIMEOUT: ProviderReply = { kind: 'timeout' };
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** A scripted provider: reply i for call i, the last reply repeats; every request is recorded. */
function scripted(replies: ProviderReply[], delayMs = 0) {
  const requests: ProviderRequest[] = [];
  const transport: ProviderTransport = {
    async call(req) {
      requests.push(req);
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      return replies[Math.min(requests.length - 1, replies.length - 1)] as ProviderReply;
    },
  };
  return { transport, requests };
}

const servers: Server[] = [];
afterAll(() => servers.forEach((s) => s.close()));

async function start(transport: ProviderTransport | null, over: Partial<ProxyDeps> = {}) {
  const sleeps: number[] = [];
  const deps: ProxyDeps = {
    version: 'qa',
    resolve: () => Promise.reject(new Error('no network in QA')),
    request: () => Promise.reject(new Error('no network in QA')),
    fixtures: createFixtureTransports(MENUS),
    provider: transport,
    cache: memoryCache(),
    extractCap: windowCap({ perHour: 1000, perDay: 1000 }, () => Date.now()),
    fetchCap: windowCap({ perHour: 1000, perDay: 1000 }, () => Date.now()),
    primaryModel: 'gemini-3.8-flash',
    fallbackModel: 'gemini-3.5-flash-lite',
    allowScenarios: false,
    nowMs: () => Date.parse('2026-10-28T01:00:00Z'),
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    log: () => undefined,
    ...over,
  };
  const server = createServer(createHandler(deps));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  servers.push(server);
  const port = (server.address() as AddressInfo).port;
  const post = async (pdf: Uint8Array = PDF, query = `targetMonth=2026-11&promptVersion=${PROMPT_VERSION}&schemaVersion=${EXTRACTION_SCHEMA_VERSION}`) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/menu/extract?${query}`, { method: 'POST', headers: { 'content-type': 'application/pdf' }, body: pdf as unknown as BodyInit });
    const j = (await res.json()) as { ok: boolean; error?: string; providerCalls?: number; retryAfterSec?: number; meta?: { providerCalls: number; cached: boolean; model: string } };
    // The wire shape carries providerCalls at the top level on failure and in meta on success (ADR 002 section 3).
    return { ...j, providerCalls: j.providerCalls ?? j.meta?.providerCalls ?? -1 };
  };
  return { post, sleeps, deps };
}

type Row = { name: string; replies: ProviderReply[]; calls: 1 | 2; error?: string; models: string[]; repair?: boolean[]; retryAfterSec?: number };
const P = 'gemini-3.8-flash';
const F = 'gemini-3.5-flash-lite';
const ROWS: Row[] = [
  { name: 'good', replies: [GOOD], calls: 1, models: [P] },
  { name: 'malformed then good (repair retry on primary)', replies: [MALFORMED, GOOD], calls: 2, models: [P, P], repair: [false, true] },
  { name: 'malformed twice', replies: [MALFORMED, MALFORMED], calls: 2, error: 'MALFORMED_OUTPUT', models: [P, P], repair: [false, true] },
  { name: 'malformed then 429', replies: [MALFORMED, http(429)], calls: 2, error: 'RATE_LIMITED', models: [P, P] },
  { name: 'malformed then 503: no fallback call', replies: [MALFORMED, http(503)], calls: 2, error: 'UNAVAILABLE', models: [P, P] },
  { name: '429 then good (fallback model)', replies: [http(429), GOOD], calls: 2, models: [P, F], repair: [false, false] },
  { name: '429 then 429', replies: [http(429), http(429, 7)], calls: 2, error: 'RATE_LIMITED', models: [P, F], retryAfterSec: 7 },
  { name: '429 then malformed: no repair retry', replies: [http(429), MALFORMED], calls: 2, error: 'MALFORMED_OUTPUT', models: [P, F], repair: [false, false] },
  { name: '503 primary then good fallback', replies: [http(503), GOOD], calls: 2, models: [P, F] },
  { name: '503 then 503', replies: [http(503), http(503)], calls: 2, error: 'UNAVAILABLE', models: [P, F] },
  { name: '500 then good', replies: [http(500), GOOD], calls: 2, models: [P, F] },
  { name: '502 then good', replies: [http(502), GOOD], calls: 2, models: [P, F] },
  { name: '504 then good', replies: [http(504), GOOD], calls: 2, models: [P, F] },
  { name: '408 then good', replies: [http(408), GOOD], calls: 2, models: [P, F] },
  { name: 'timeout then good', replies: [TIMEOUT, GOOD], calls: 2, models: [P, F] },
  { name: 'timeout then timeout', replies: [TIMEOUT, TIMEOUT], calls: 2, error: 'UNAVAILABLE', models: [P, F] },
  { name: '400 never retried', replies: [http(400), GOOD], calls: 1, error: 'UNAVAILABLE', models: [P] },
  { name: '401 never retried', replies: [http(401), GOOD], calls: 1, error: 'UNAVAILABLE', models: [P] },
  { name: '403 never retried', replies: [http(403), GOOD], calls: 1, error: 'UNAVAILABLE', models: [P] },
  { name: '404 never retried', replies: [http(404), GOOD], calls: 1, error: 'UNAVAILABLE', models: [P] },
  { name: 'empty candidate (no text) then good: repair retry', replies: [EMPTY, GOOD], calls: 2, models: [P, P], repair: [false, true] },
  { name: 'empty candidate twice', replies: [EMPTY, EMPTY], calls: 2, error: 'MALFORMED_OUTPUT', models: [P, P] },
  { name: 'not a menu', replies: [NOT_A_MENU, GOOD], calls: 1, error: 'NOT_A_MENU', models: [P] },
  { name: 'malformed then not a menu', replies: [MALFORMED, NOT_A_MENU], calls: 2, error: 'NOT_A_MENU', models: [P, P] },
];

describe('US-E2-07/AC4 US-E2-06/AC2 AC5 AC6 AC7 US-E2-05/AC1 AC2 every failure row of ADR 002 section 5: exact calls, models, outcome; never more than 2 (BR-10)', () => {
  for (const row of ROWS) {
    it(row.name, async () => {
      const p = scripted(row.replies);
      const { post } = await start(p.transport);
      const body = await post();
      expect(p.requests.length, 'provider calls made').toBe(row.calls);
      expect(p.requests.length).toBeLessThanOrEqual(2);
      expect(body.providerCalls).toBe(row.calls);
      expect(p.requests.map((r) => r.model)).toEqual(row.models);
      if (row.repair) expect(p.requests.map((r) => r.repairErrors !== undefined)).toEqual(row.repair);
      if (row.error === undefined) {
        expect(body.ok).toBe(true);
        expect(body.meta?.providerCalls).toBe(row.calls);
      } else {
        expect(body.ok).toBe(false);
        expect(body.error).toBe(row.error);
        if (row.retryAfterSec !== undefined) expect(body.retryAfterSec).toBe(row.retryAfterSec);
      }
    });
  }

  it('a 429 with Retry-After waits at most 5 s before the fallback call', async () => {
    const p = scripted([http(429, 60), GOOD]);
    const { post, sleeps } = await start(p.transport);
    expect((await post()).ok).toBe(true);
    expect(sleeps).toEqual([5000]);
  });

  it('a transport that throws counts as a timeout and still stops at 2 calls', async () => {
    let n = 0;
    const { post } = await start({
      call() {
        n += 1;
        return Promise.reject(new Error('boom'));
      },
    });
    const body = await post();
    expect(n).toBe(2);
    expect(body).toMatchObject({ ok: false, error: 'UNAVAILABLE', providerCalls: 2 });
  });
});

describe('BR-14 / ADR 002 section 5: rejected before any call (0 calls)', () => {
  it('not a PDF, empty body, and over 10 MB make 0 provider calls', async () => {
    const p = scripted([GOOD]);
    const { post } = await start(p.transport);
    expect(await post(new TextEncoder().encode('hello, not a pdf'))).toMatchObject({ ok: false, error: 'NOT_A_PDF', providerCalls: 0 });
    expect(await post(new Uint8Array(0))).toMatchObject({ ok: false, providerCalls: 0 });
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(new TextEncoder().encode('%PDF-1.4'));
    expect(await post(big)).toMatchObject({ ok: false, error: 'TOO_LARGE', providerCalls: 0 });
    expect(p.requests).toHaveLength(0);
  });

  it('a stale client (old promptVersion/schemaVersion) or a stray query key is refused with 400 and 0 calls', async () => {
    const p = scripted([GOOD]);
    const { post } = await start(p.transport);
    expect((await post(PDF, `targetMonth=2026-11&promptVersion=${PROMPT_VERSION - 1}&schemaVersion=${EXTRACTION_SCHEMA_VERSION}`)).error).toBe('BAD_REQUEST');
    expect((await post(PDF, `targetMonth=2026-11&promptVersion=${PROMPT_VERSION}&schemaVersion=${EXTRACTION_SCHEMA_VERSION + 1}`)).error).toBe('BAD_REQUEST');
    expect((await post(PDF, `targetMonth=2026-11&promptVersion=${PROMPT_VERSION}&schemaVersion=${EXTRACTION_SCHEMA_VERSION}&nickname=Hana`)).error).toBe('BAD_REQUEST');
    expect((await post(PDF, 'targetMonth=2026-13&promptVersion=1&schemaVersion=1')).error).toBe('BAD_REQUEST');
    expect(p.requests).toHaveLength(0);
  });

  it('no provider configured (no key): NOT_CONFIGURED with 0 calls for an unknown PDF (US-E2-06/AC4)', async () => {
    const { post } = await start(null);
    const odd = new Uint8Array([...new TextEncoder().encode('%PDF-1.4 unknown '), 1, 2, 3]);
    expect(await post(odd)).toMatchObject({ ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 });
  });
});

describe('US-E2-07/AC1 BR-10: a PDF with a known SHA-256 costs 0 provider calls', () => {
  it('memory cache: the second import of the same bytes makes 0 calls and is flagged cached; changed bytes call again', async () => {
    const p = scripted([GOOD]);
    const { post } = await start(p.transport);
    expect((await post()).providerCalls).toBe(1);
    const again = await post();
    expect(again).toMatchObject({ ok: true, providerCalls: 0, meta: { cached: true, providerCalls: 0 } });
    expect(p.requests).toHaveLength(1);
    const other = new Uint8Array([...PDF, 10, 10, 37, 37, 69, 79, 70]); // trailing bytes: a different SHA-256
    expect((await post(other)).providerCalls).toBe(1);
    expect(p.requests).toHaveLength(2);
  });

  it('failures are never cached: a retry after a failure makes a new call', async () => {
    const p = scripted([http(400), GOOD]);
    const { post } = await start(p.transport);
    expect((await post()).ok).toBe(false);
    expect((await post()).ok).toBe(true);
    expect(p.requests).toHaveLength(2);
  });
});

describe('ADR 002 section 2 on-disk cache', () => {
  const dirs: string[] = [];
  const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), 'bm-qa-cache-'));
    dirs.push(d);
    return d;
  };
  afterEach(() => {
    while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
  });

  it('survives a proxy restart (a new cache object on the same directory): 0 calls', async () => {
    const dir = tmp();
    const p1 = scripted([GOOD]);
    expect((await (await start(p1.transport, { cache: fileCache({ dir }) })).post()).providerCalls).toBe(1);
    const p2 = scripted([GOOD]);
    const body = await (await start(p2.transport, { cache: fileCache({ dir }) })).post();
    expect(body).toMatchObject({ ok: true, providerCalls: 0 });
    expect(p2.requests).toHaveLength(0);
  });

  it('a changed prompt version or schema version never serves a stale entry', async () => {
    const dir = tmp();
    await (await start(scripted([GOOD]).transport, { cache: fileCache({ dir }) })).post();
    expect(readdirSync(dir)).toEqual([`${sha(PDF)}.json`]);
    for (const [pv, sv] of [
      [PROMPT_VERSION + 1, EXTRACTION_SCHEMA_VERSION],
      [PROMPT_VERSION - 1, EXTRACTION_SCHEMA_VERSION],
      [PROMPT_VERSION, EXTRACTION_SCHEMA_VERSION + 1],
    ] as const) {
      expect(fileCache({ dir, promptVersion: pv, schemaVersion: sv }).get(sha(PDF)), `prompt ${pv} schema ${sv}`).toBeUndefined();
    }
    // The same bump driven by hand-editing the stored entry (as an old proxy build would have left it).
    const file = join(dir, `${sha(PDF)}.json`);
    const entry = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({ ...entry, promptVersion: PROMPT_VERSION - 1 }));
    const p = scripted([GOOD]);
    const body = await (await start(p.transport, { cache: fileCache({ dir }) })).post();
    expect(body).toMatchObject({ ok: true, providerCalls: 1 });
    expect(p.requests).toHaveLength(1);
  });

  it('a corrupt, truncated, empty, non-object or wrongly shaped cache file is a miss, never a crash', async () => {
    const bad: [string, string][] = [
      ['not json', '{{{{ nope'],
      ['truncated', '{"text":"abc","model":"gemini-3.8-flash","promptVersion":'],
      ['empty', ''],
      ['array', '[]'],
      ['null', 'null'],
      ['text not a string', JSON.stringify({ text: 5, model: 'm', promptVersion: PROMPT_VERSION, schemaVersion: EXTRACTION_SCHEMA_VERSION })],
      ['valid shape but the reply is not an extraction', JSON.stringify({ text: '{"hello":1}', model: 'm', promptVersion: PROMPT_VERSION, schemaVersion: EXTRACTION_SCHEMA_VERSION })],
    ];
    for (const [name, content] of bad) {
      const dir = tmp();
      writeFileSync(join(dir, `${sha(PDF)}.json`), content);
      const p = scripted([GOOD]);
      const body = await (await start(p.transport, { cache: fileCache({ dir }) })).post();
      expect(body, name).toMatchObject({ ok: true, providerCalls: 1 });
      expect(p.requests, name).toHaveLength(1);
    }
  });

  it('a non-hex or path-like key never touches the disk outside the directory', () => {
    const dir = tmp();
    const c = fileCache({ dir });
    for (const k of ['../x', '..\\x', 'abc', `${'a'.repeat(63)}/`, 'A'.repeat(64)]) {
      c.set(k, { text: 'x', model: 'm' });
      expect(c.get(k)).toBeUndefined();
    }
    expect(readdirSync(dir)).toEqual([]);
  });

  it('entries hold only the validated reply and meta: no key, headers, PDF bytes or child data; no temp files left', async () => {
    const dir = tmp();
    const SENTINEL = 'SENTINEL-KEY-qa-9f3c';
    const { post } = await start(scripted([GOOD]).transport, { cache: fileCache({ dir }) });
    await post();
    const files = readdirSync(dir);
    expect(files).toEqual([`${sha(PDF)}.json`]);
    const raw = readFileSync(join(dir, files[0] as string), 'latin1');
    const entry = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(entry).sort()).toEqual(['model', 'promptVersion', 'schemaVersion', 'storedAt', 'text']);
    expect(raw).not.toContain(SENTINEL);
    expect(raw).not.toMatch(/x-goog-api-key|authorization|api[_-]?key|bearer/i);
    expect(raw).not.toContain('%PDF-');
    expect(raw).not.toContain(Buffer.from(PDF.subarray(0, 120)).toString('base64').slice(0, 60));
    expect(raw).not.toMatch(/nickname|likedIds|dislikedIds|knownAllergenIds|deviceId|child-1/);
  });

  it('the cache is capped (entries) and eviction removes the oldest first', () => {
    const dir = tmp();
    let t = 1_000_000;
    const c = fileCache({ dir, maxEntries: 3, nowMs: () => (t += 1000) });
    const keys = [1, 2, 3, 4, 5].map((n) => n.toString(16).repeat(64));
    for (const k of keys) c.set(k, { text: 't', model: 'm' });
    expect(readdirSync(dir).length).toBeLessThanOrEqual(3);
    expect(c.get(keys[4] as string)).toBeDefined();
    expect(c.get(keys[0] as string)).toBeUndefined();
  });

  it('an unwritable cache directory does not break an import (falls back, still returns the menu)', async () => {
    const dir = tmp();
    const blocker = join(dir, 'file-not-dir');
    writeFileSync(blocker, 'x');
    let cache: ExtractionCache;
    try {
      cache = fileCache({ dir: join(blocker, 'sub') }); // mkdir under a file: throws at construction
    } catch {
      cache = memoryCache();
    }
    const body = await (await start(scripted([GOOD]).transport, { cache })).post();
    expect(body.ok).toBe(true);
    mkdirSync(join(dir, 'ok'), { recursive: true });
  });
});

describe('concurrency and the proxy call cap (ADR 002 section 2, BR-10)', () => {
  it('two simultaneous identical requests: each action stays within 2 calls (observation: both reach the provider, see M5-D02)', async () => {
    const p = scripted([GOOD], 80);
    const { post } = await start(p.transport);
    const [a, b] = await Promise.all([post(), post()]);
    expect(a.ok && b.ok).toBe(true);
    expect(a.providerCalls).toBeLessThanOrEqual(2);
    expect(b.providerCalls).toBeLessThanOrEqual(2);
    expect(p.requests.length).toBeLessThanOrEqual(2);
    // A third request after both finished is free.
    expect((await post()).providerCalls).toBe(0);
    console.log(`M5 concurrency observation: 2 simultaneous identical imports made ${p.requests.length} provider call(s) (ideal 1)`);
  });

  it('two simultaneous failing identical requests never exceed 2 calls per action', async () => {
    const p = scripted([http(503), http(503)], 40);
    const { post } = await start(p.transport);
    const [a, b] = await Promise.all([post(), post()]);
    expect(a.providerCalls).toBeLessThanOrEqual(2);
    expect(b.providerCalls).toBeLessThanOrEqual(2);
    expect(p.requests.length).toBeLessThanOrEqual(4);
    console.log(`M5 concurrency observation: 2 simultaneous failing identical imports made ${p.requests.length} provider calls (cap 2 per action)`);
  });

  it('the proxy cap refuses with 0 calls once the hourly allowance is used (RATE_LIMITED, no provider call); overshoot is at most one action', async () => {
    const p = scripted([GOOD]);
    const { post } = await start(p.transport, { extractCap: windowCap({ perHour: 3, perDay: 20 }, () => Date.now()) });
    const pdfs = [1, 2, 3, 4, 5].map((n) => new Uint8Array([...PDF, n, n, n]));
    const results = [];
    for (const f of pdfs) results.push(await post(f));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false, false]);
    expect(results[3]).toMatchObject({ error: 'RATE_LIMITED', providerCalls: 0 });
    expect(p.requests).toHaveLength(3);
  });

  it('the cap counts a 2-call action as 2: with perHour 5 a third failing action starts at 4 and ends at 6 calls (documented overshoot of 1)', async () => {
    const p = scripted([http(503)]);
    const { post } = await start(p.transport, { extractCap: windowCap({ perHour: 5, perDay: 20 }, () => Date.now()) });
    const out = [];
    for (let n = 1; n <= 4; n += 1) out.push(await post(new Uint8Array([...PDF, n, n, n])));
    expect(out.map((r) => r.providerCalls)).toEqual([2, 2, 2, 0]);
    expect(p.requests.length).toBe(6);
  });

  it('a repeated PDF is served from the cache even when the cap is exhausted (0 calls beats RATE_LIMITED)', async () => {
    const p = scripted([GOOD]);
    const cap = windowCap({ perHour: 1, perDay: 1 }, () => Date.now());
    const { post } = await start(p.transport, { extractCap: cap });
    expect((await post()).ok).toBe(true);
    expect(await post()).toMatchObject({ ok: true, providerCalls: 0 });
    expect(await post(new Uint8Array([...PDF, 9, 9, 9]))).toMatchObject({ ok: false, error: 'RATE_LIMITED', providerCalls: 0 });
  });
});
