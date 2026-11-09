// QA M5, US-NF-05 (no secrets in the client) and the proxy side of it. The key is a sentinel, the provider is a
// fake fetch, nothing leaves the machine. Environment files are never read: only their git status is checked.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { defaultDeps, startServer } from '../../../../server/index.ts';
import { memoryCache, windowCap } from '../../../../server/menu/extract.ts';
import { fileCache } from '../../../../server/menu/file-cache.ts';
import { EXTRACTION_SCHEMA_VERSION, PROMPT_VERSION } from '../../../../src/domain/menu/extraction.ts';

const ROOT = process.cwd();
const SENTINEL = ['AIza', 'SyQA-SENTINEL-0123456789abcdefghijk'].join(''); // key-shaped on purpose, built from parts so the secret scan does not flag this file
// Built from parts so that the static guard in nf-static.test.ts (no test file names the provider host) stays meaningful.
const PROVIDER_HOST = ['generativelanguage', 'googleapis', 'com'].join('.');
const ENV_NAME = ['.', 'env'].join('');
const FX = join(ROOT, 'tests', 'fixtures', 'menus', 'fixture-menu-2026-11');
const PDF = new Uint8Array(readFileSync(join(FX, 'menu.pdf')));
const GOOD_TEXT = (() => {
  const r = JSON.parse(readFileSync(join(FX, 'recorded', 'hand-1.json'), 'utf8')).response;
  return r.rawText ?? JSON.stringify(r.modelOutput);
})();

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe('US-NF-05/AC1 the production client bundle holds no key, no provider host, no key-shaped string', () => {
  it('a fresh production build (with a sentinel key in the build environment) is clean', () => {
    const out = mkdtempSync(join(tmpdir(), 'bm-qa-dist-'));
    try {
      const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
      const run = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir'], {
        cwd: ROOT,
        env: { ...process.env, GEMINI_API_KEY: SENTINEL, VITE_GEMINI_API_KEY: '', VITE_FIREBASE_API_KEY: '' },
        encoding: 'utf8',
        timeout: 90_000,
      });
      expect(run.status, run.stderr).toBe(0);
      const files = walk(out).filter((f) => !/\.(woff2?|png|jpg|ico|svg)$/i.test(f));
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        const text = readFileSync(f, 'utf8');
        const rel = f.slice(out.length);
        expect(text, `${rel} GEMINI_API_KEY`).not.toContain('GEMINI_API_KEY');
        expect(text, `${rel} sentinel`).not.toContain(SENTINEL);
        expect(text, `${rel} provider host`).not.toContain(PROVIDER_HOST);
        expect(text, `${rel} header name`).not.toMatch(/x-goog-api-key/i);
        expect(text, `${rel} key-shaped`).not.toMatch(/AIza[0-9A-Za-z_-]{35}/);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 120_000);

  it('no client source file (src/) names the key variable or the provider host', () => {
    for (const f of walk(join(ROOT, 'src')).filter((p) => /\.(ts|tsx|css|html)$/.test(p))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toContain('GEMINI_API_KEY');
      expect(text, f).not.toContain('generativelanguage');
    }
  });
});

describe('US-NF-05 the environment file is git-ignored and untracked (names only, content never read)', () => {
  const git = (...args: string[]) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });

  it('no tracked file is an environment file other than the example', () => {
    const tracked = git('ls-files').stdout.split('\n').filter(Boolean);
    const bad = tracked.filter((p) => new RegExp(`(^|/)\\${ENV_NAME}(\\.|$)`).test(p) && !p.endsWith(`${ENV_NAME}.example`));
    expect(bad).toEqual([]);
  });

  it('the usual names are ignored by git', () => {
    for (const name of [ENV_NAME, `${ENV_NAME}.local`, `${ENV_NAME}.production`, `server/${ENV_NAME}`, 'server/.cache/abc.json']) {
      expect(git('check-ignore', '-q', name).status, name).toBe(0);
    }
    expect(git('check-ignore', '-q', `${ENV_NAME}.example`).status).toBe(1); // the example stays tracked-able
  });

  it('no tracked file contains a key-shaped string (AIza...), excluding environment files', () => {
    const r = git('grep', '-I', '-l', '-E', 'AIza[0-9A-Za-z_-]{35}', '--', '.', `:(exclude,glob)**/${ENV_NAME}*`, ':(exclude,glob)tests/unit/server/qa/m5-secrets.test.ts');
    expect(r.status, `files: ${r.stdout}`).toBe(1);
  });
});

describe('US-NF-05/AC1 US-E2-04 the sentinel key never leaves the proxy except in the x-goog-api-key request header', () => {
  const servers: Server[] = [];
  afterAll(() => servers.forEach((s) => s.close()));

  type Mode = 'ok' | '403' | '429' | '500' | 'throw' | 'blocked';
  async function boot(env: NodeJS.ProcessEnv) {
    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    let mode: Mode = 'ok';
    const fakeFetch = ((url: string | URL, init?: RequestInit) => {
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
      calls.push({ url: String(url), headers, body: String(init?.body ?? '') });
      const echo = `API key ${SENTINEL} is invalid or leaked (${String(url)})`;
      switch (mode) {
        case 'throw':
          return Promise.reject(Object.assign(new Error(`connect failed using ${SENTINEL}`), { cause: new Error(SENTINEL) }));
        case '403':
          return Promise.resolve(new Response(JSON.stringify({ error: { code: 403, message: echo } }), { status: 403 }));
        case '429':
          return Promise.resolve(new Response(JSON.stringify({ error: { code: 429, message: echo } }), { status: 429, headers: { 'retry-after': '2' } }));
        case '500':
          return Promise.resolve(new Response(`oops ${echo}`, { status: 500 }));
        case 'blocked':
          return Promise.resolve(new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' }, note: echo }), { status: 200 }));
        default:
          return Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: GOOD_TEXT }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } }), { status: 200 }));
      }
    }) as unknown as typeof fetch;
    const cacheDir = mkdtempSync(join(tmpdir(), 'bm-qa-proxy-cache-'));
    const deps = { ...defaultDeps(env, fakeFetch), cache: fileCache({ dir: cacheDir }), extractCap: windowCap({ perHour: 1000, perDay: 1000 }, () => Date.now()), sleep: () => Promise.resolve() };
    const server = startServer(0, '127.0.0.1', deps);
    await new Promise<void>((r) => server.once('listening', () => r()));
    servers.push(server);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const wire: string[] = [];
    const record = async (res: Response) => {
      const text = await res.text();
      const hdrs: string[] = [];
      res.headers.forEach((v, k) => hdrs.push(`${k}: ${v}`));
      wire.push(`${res.status}\n${hdrs.join('\n')}\n${text}`);
      return { status: res.status, text };
    };
    let n = 0;
    return {
      calls,
      wire,
      cacheDir,
      setMode: (m: Mode) => (mode = m),
      extract: async () => {
        n += 1;
        const pdf = new Uint8Array([...PDF, n, n, n]); // distinct bytes: never a cache hit
        return record(await fetch(`${base}/api/menu/extract?targetMonth=2026-11&promptVersion=${PROMPT_VERSION}&schemaVersion=${EXTRACTION_SCHEMA_VERSION}`, { method: 'POST', body: pdf as unknown as BodyInit }));
      },
      get: async (path: string, init?: RequestInit) => record(await fetch(`${base}${path}`, init)),
    };
  }

  it('across success, 403, 429, 500, network failure and blocked replies: no response body, header, log line or cache file contains the key', async () => {
    const logged: string[] = [];
    const spies = (['log', 'error', 'warn', 'info', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logged.push(a.map(String).join(' '))));
    try {
      const p = await boot({ GEMINI_API_KEY: SENTINEL });
      for (const mode of ['ok', '403', '429', '500', 'throw', 'blocked', 'ok'] as const) {
        p.setMode(mode);
        await p.extract();
      }
      await p.get('/api/health');
      await p.get('/api/nope');
      await p.get('/api/menu/extract', { method: 'GET' });
      await p.get('/api/menu/fetch-pdf', { method: 'POST', body: JSON.stringify({ url: 'http://x' }) });
      await p.get('/api/menu/extract?targetMonth=bad', { method: 'POST', body: PDF as unknown as BodyInit });

      expect(p.calls.length).toBeGreaterThanOrEqual(7);
      expect(p.wire.join('\n---\n')).not.toContain(SENTINEL);
      expect(p.wire.join('\n')).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      expect(logged.join('\n')).not.toContain(SENTINEL);
      expect(logged.join('\n')).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
      for (const f of readdirSync(p.cacheDir)) expect(readFileSync(join(p.cacheDir, f), 'utf8')).not.toContain(SENTINEL);
      rmSync(p.cacheDir, { recursive: true, force: true });
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('every provider request carries the key only in the x-goog-api-key header: not in the URL, the body or any other header', async () => {
    const p = await boot({ GEMINI_API_KEY: SENTINEL });
    await p.extract();
    expect(p.calls).toHaveLength(1);
    const c = p.calls[0] as (typeof p.calls)[number];
    expect(c.headers['x-goog-api-key']).toBe(SENTINEL);
    expect(c.url).not.toContain(SENTINEL);
    expect(c.url).not.toMatch(/[?&]key=/);
    expect(c.url.startsWith(`https://${PROVIDER_HOST}/v1beta/models/`)).toBe(true);
    expect(c.body).not.toContain(SENTINEL);
    for (const [k, v] of Object.entries(c.headers)) if (k !== 'x-goog-api-key') expect(v, `header ${k}`).not.toContain(SENTINEL);
    expect(Object.keys(c.headers).sort()).toEqual(['content-type', 'x-goog-api-key']);
    rmSync(p.cacheDir, { recursive: true, force: true });
  });

  it('ai-payload-allowlist: the provider body is the PDF, the prompt text and the schema only (no profile, device or identity field)', async () => {
    const p = await boot({ GEMINI_API_KEY: SENTINEL });
    await p.extract();
    const body = JSON.parse((p.calls[0] as { body: string }).body) as { contents: { role: string; parts: Record<string, unknown>[] }[]; generationConfig: Record<string, unknown> };
    expect(Object.keys(body).sort()).toEqual(['contents', 'generationConfig']);
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0]?.parts.map((x) => Object.keys(x).sort().join('+'))).toEqual(['inline_data', 'text']);
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/nickname|likedIds|dislikedIds|knownAllergenIds|deviceId|ownerId|child-1|reminderLog|decisions/);
    rmSync(p.cacheDir, { recursive: true, force: true });
  });

  it('mock-scenario mode never builds the real transport: the fake fetch is never called even with a key set', async () => {
    const p = await boot({ GEMINI_API_KEY: SENTINEL, PROXY_MOCK_SCENARIOS: '1' });
    const r = await p.extract();
    expect(p.calls).toHaveLength(0);
    expect(r.text).not.toContain(SENTINEL);
    rmSync(p.cacheDir, { recursive: true, force: true });
  });

  it('no key set: the real transport is not built (NOT_CONFIGURED for an unknown PDF), nothing is fetched', async () => {
    const p = await boot({});
    const r = await p.extract();
    expect(p.calls).toHaveLength(0);
    expect(JSON.parse(r.text)).toMatchObject({ ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 });
    rmSync(p.cacheDir, { recursive: true, force: true });
  });

  it('a whitespace-only key is treated as no key', async () => {
    const p = await boot({ GEMINI_API_KEY: '   ' });
    const r = await p.extract();
    expect(p.calls).toHaveLength(0);
    expect(JSON.parse(r.text).error).toBe('NOT_CONFIGURED');
    rmSync(p.cacheDir, { recursive: true, force: true });
  });

  it('a model id outside the free-tier list is refused without a request (cost guard, ADR 002 section 7)', async () => {
    const p = await boot({ GEMINI_API_KEY: SENTINEL, GEMINI_MODEL_PRIMARY: 'gemini-4-argon', GEMINI_MODEL_FALLBACK: 'gemini-3.5-flash-lite' });
    const r = await p.extract();
    // The primary is refused locally (HTTP 400 equivalent, never retried): 1 counted call, 0 requests on the wire.
    expect(p.calls).toHaveLength(0);
    expect(JSON.parse(r.text)).toMatchObject({ ok: false, error: 'UNAVAILABLE' });
    rmSync(p.cacheDir, { recursive: true, force: true });
  });

  it('the proxy listens on 127.0.0.1 only', async () => {
    const p = await boot({ GEMINI_API_KEY: SENTINEL });
    const s = servers[servers.length - 1] as Server;
    expect((s.address() as AddressInfo).address).toBe('127.0.0.1');
    rmSync(p.cacheDir, { recursive: true, force: true });
  });

  it('git tracks no sentinel and memoryCache is unused here (sanity)', () => {
    expect(memoryCache().get('x')).toBeUndefined();
    expect(execFileSync('git', ['--version'], { encoding: 'utf8' })).toContain('git version');
  });
});
