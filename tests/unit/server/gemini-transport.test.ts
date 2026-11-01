// Contract tests for the real Gemini transport (ADR 002 §5, M5 slice A). A fake fetch replays
// QA's recorded replies wrapped in the generateContent envelope; no network, no real key.
/* eslint-disable @typescript-eslint/no-explicit-any -- the provider payload is inspected as untyped JSON */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { memoryCache, runExtraction, windowCap, type ExtractDeps, type ServerExtractResult } from '../../../server/menu/extract.ts';
import { createGeminiTransport, GEMINI_ENDPOINT, type Usage } from '../../../server/menu/gemini-transport.ts';
import { createHandler, defaultDeps } from '../../../server/index.ts';
import type { YearMonth } from '../../../src/domain/time/jst.ts';
import { PROMPT_VERSION } from '../../../src/domain/menu/extraction.ts';
import { loadFixture } from '../helpers/fixtures.ts';

const KEY = 'TEST-SENTINEL-KEY-0123456789';
const MENUS = join(process.cwd(), 'tests', 'fixtures', 'menus');
const PDF = new Uint8Array(readFileSync(join(MENUS, 'fixture-menu-2026-11', 'menu.pdf')));
const PRIMARY = 'gemini-3.8-flash';
const FALLBACK = 'gemini-3.5-flash-lite';

interface Recorded {
  response: { httpStatus: number; modelOutput?: unknown; rawText?: string; retryAfterSeconds?: number | null; body?: unknown };
}
const recorded = (name: string) => loadFixture<Recorded>(`menus/fixture-menu-2026-11/recorded/${name}.json`);

const envelope = (text: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 3000, candidatesTokenCount: 800 }, ...extra }), { status: 200 });
/** The recorded stand-in as the provider would send it. */
function replay(name: string): Response {
  const r = recorded(name).response;
  if (r.httpStatus === 200) return envelope(r.rawText ?? JSON.stringify(r.modelOutput));
  const headers = r.retryAfterSeconds === undefined || r.retryAfterSeconds === null ? {} : { 'retry-after': String(r.retryAfterSeconds) };
  return new Response(JSON.stringify(r.body ?? { error: { code: r.httpStatus } }), { status: r.httpStatus, headers });
}
const status = (code: number, body: unknown = { error: { code } }) => () => new Response(JSON.stringify(body), { status: code });

interface Seen {
  url: string;
  init: RequestInit;
  body: Record<string, any>;
}
function setup(replies: (() => Response)[], opts: { logs?: string[]; usages?: Usage[] } = {}) {
  const seen: Seen[] = [];
  const logs = opts.logs ?? [];
  const fake = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const make = replies[seen.length];
    seen.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body)) as Record<string, any> });
    if (make === undefined) throw new Error('unexpected provider call');
    return Promise.resolve(make());
  });
  const transport = createGeminiTransport({ apiKey: KEY, fetch: fake as unknown as typeof fetch, log: (m) => logs.push(m), onUsage: (_m, u) => opts.usages?.push(u) });
  const deps: ExtractDeps = {
    transport,
    primaryModel: PRIMARY,
    fallbackModel: FALLBACK,
    cache: memoryCache(),
    cap: windowCap({ perHour: 100, perDay: 100 }, () => 0),
    timestamp: () => '2026-10-28T10:00:00+09:00',
    sleep: () => Promise.resolve(),
    log: (m) => logs.push(m),
  };
  return { seen, logs, transport, run: () => runExtraction({ pdf: PDF, targetMonth: '2026-11' as YearMonth }, deps) };
}
const modelOf = (s: Seen) => /models\/([^:]+):generateContent/.exec(s.url)?.[1];
const outcome = (r: ServerExtractResult) => (r.ok ? 'ok' : r.error);

describe('US-E2-04/AC1 a good reply becomes a validated menu (1 call)', () => {
  it('US-E2-04/AC1 returns the menu, records the model and reports token usage', async () => {
    const usages: Usage[] = [];
    const { run, seen } = setup([() => replay('hand-1')], { usages });
    const result = await run();
    expect(outcome(result)).toBe('ok');
    expect(seen).toHaveLength(1);
    if (result.ok) {
      expect(result.menu.source.model).toBe(PRIMARY);
      expect(result.meta.providerCalls).toBe(1);
    }
    expect(usages).toEqual([{ inputTokens: 3000, outputTokens: 800 }]);
  });
});

describe('US-E2-04/AC7 the provider request holds only the allow-listed inputs (ai-payload-allowlist)', () => {
  it('US-E2-04/AC7 model path, key in header (not URL), inline PDF, schema, JSON output, low temperature', async () => {
    const { run, seen } = setup([() => replay('hand-1')]);
    await run();
    const s = seen[0]!;
    expect(s.url.startsWith(GEMINI_ENDPOINT + '/')).toBe(true);
    expect(new URL(s.url).pathname.endsWith(`/models/${PRIMARY}:generateContent`)).toBe(true);
    expect(new URL(s.url).search).toBe('');
    expect(s.url).not.toContain(KEY);
    expect(s.init.method).toBe('POST');
    const headers = s.init.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe(KEY);
    const parts = s.body['contents'][0].parts as Record<string, any>[];
    expect(parts).toHaveLength(2);
    expect(parts[0]!['inline_data'].mime_type).toBe('application/pdf');
    expect(parts[0]!['inline_data'].data).toBe(Buffer.from(PDF).toString('base64'));
    expect(parts[1]!['text']).toContain('2026-11');
    const cfg = s.body['generationConfig'];
    expect(cfg.responseMimeType).toBe('application/json');
    expect(cfg.temperature).toBeLessThanOrEqual(0.2);
    expect(cfg.responseJsonSchema.properties.days).toBeDefined();
    expect(cfg.responseJsonSchema.properties.source).toBeUndefined();
    expect(cfg.responseJsonSchema.required).not.toContain('id');
    expect(Object.keys(s.body).sort()).toEqual(['contents', 'generationConfig']);
  });

  it('US-E2-04/AC7 no profile or child field names appear anywhere in the payload', async () => {
    const { run, seen } = setup([() => replay('hand-1')]);
    await run();
    const text = JSON.stringify({ ...seen[0]!.body, contents: [{ parts: [seen[0]!.body['contents'][0].parts[1]] }] }); // prompt + schema, not the PDF bytes
    for (const word of ['nickname', 'ageRange', 'likes', 'dislikes', 'excludedIngredients', 'diet', 'themes', 'decisions', 'overrides', 'allergyStatus', 'はなちゃん']) {
      expect(text, word).not.toContain(word);
    }
  });
});

describe('US-E2-05 malformed output', () => {
  it('US-E2-05/AC1 malformed then good: a repair retry on the same model carries the validation errors', async () => {
    const { run, seen } = setup([() => replay('hand-malformed'), () => replay('hand-1')]);
    const result = await run();
    expect(outcome(result)).toBe('ok');
    expect(seen.map(modelOf)).toEqual([PRIMARY, PRIMARY]);
    expect(JSON.stringify(seen[0]!.body)).not.toContain('failed validation');
    expect(JSON.stringify(seen[1]!.body)).toContain('failed validation');
    expect(JSON.stringify(seen[1]!.body)).toContain('json-parse');
  });

  it('US-E2-05/AC2 malformed twice stops after 2 calls', async () => {
    const { run, seen } = setup([() => replay('hand-malformed'), () => replay('hand-malformed')]);
    const result = await run();
    expect(outcome(result)).toBe('MALFORMED_OUTPUT');
    expect(seen).toHaveLength(2);
  });

  it('US-E2-05/AC1 an empty candidate text counts as malformed output (repair retry, then stop)', async () => {
    const { run, seen } = setup([() => envelope(''), () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })]);
    expect(outcome(await run())).toBe('MALFORMED_OUTPUT');
    expect(seen).toHaveLength(2);
  });

  it('US-E2-05/AC1 a non-JSON 200 body counts as malformed output', async () => {
    const { run } = setup([() => new Response('<html>oops</html>', { status: 200 }), () => envelope('{}')]);
    expect(outcome(await run())).toBe('MALFORMED_OUTPUT');
  });

  it('US-E2-04/AC5 thought parts are ignored, text parts are joined', async () => {
    const json = JSON.stringify(recorded('hand-1').response.modelOutput);
    const half = Math.floor(json.length / 2);
    const reply = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'thinking...', thought: true }, { text: json.slice(0, half) }, { text: json.slice(half) }] } }] }), { status: 200 });
    expect(outcome(await setup([reply]).run())).toBe('ok');
  });
});

describe('US-E2-04 not a menu', () => {
  it('US-E2-04/AC1 a "not a menu" reply stops with NOT_A_MENU after 1 call', async () => {
    const { run, seen } = setup([() => replay('hand-not-a-menu')]);
    expect(outcome(await run())).toBe('NOT_A_MENU');
    expect(seen).toHaveLength(1);
  });
});

describe('US-E2-06 provider errors (BR-10 budget of 2 calls)', () => {
  it('US-E2-06/AC5 429 on the primary then good on the fallback model', async () => {
    const { run, seen } = setup([() => replay('hand-rate-limited'), () => replay('hand-1')]);
    const result = await run();
    expect(seen.map(modelOf)).toEqual([PRIMARY, FALLBACK]);
    expect(result.ok && result.menu.source.model).toBe(FALLBACK);
  });

  it('US-E2-06/AC6 429 on both models stops with RATE_LIMITED and the retry delay (header or RetryInfo)', async () => {
    const info = status(429, { error: { code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '42s' }] } });
    const { run, seen } = setup([() => replay('hand-rate-limited-no-retry-after'), info]);
    const result = await run();
    expect(seen).toHaveLength(2);
    expect(result).toMatchObject({ ok: false, error: 'RATE_LIMITED', retryAfterSec: 42, providerCalls: 2 });
    const viaHeader = setup([status(429), () => replay('hand-rate-limited')]);
    expect(await viaHeader.run()).toMatchObject({ error: 'RATE_LIMITED', retryAfterSec: 60 });
  });

  it('US-E2-06/AC2 503 on both models stops with UNAVAILABLE after 2 calls', async () => {
    const { run, seen } = setup([status(503), status(503)]);
    expect(outcome(await run())).toBe('UNAVAILABLE');
    expect(seen).toHaveLength(2);
  });

  it('US-E2-06/AC2 503 then good on the fallback model', async () => {
    const { run } = setup([status(503), () => replay('hand-1')]);
    expect(outcome(await run())).toBe('ok');
  });

  it.each([400, 401, 403, 404])('US-E2-06/AC7 HTTP %i is never retried (1 call) and the status is logged', async (code) => {
    const { run, seen, logs } = setup([status(code)]);
    const result = await run();
    expect(outcome(result)).toBe('UNAVAILABLE');
    expect(seen).toHaveLength(1);
    expect(logs.some((l) => l.includes(String(code)) && l.includes(PRIMARY))).toBe(true);
  });

  it('US-E2-06/AC7 a blocked prompt or a SAFETY candidate is treated like a 400 (1 call)', async () => {
    const blocked = setup([() => new Response(JSON.stringify({ promptFeedback: { blockReason: 'OTHER' } }), { status: 200 })]);
    expect(outcome(await blocked.run())).toBe('UNAVAILABLE');
    expect(blocked.seen).toHaveLength(1);
    const safety = setup([() => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), { status: 200 })]);
    expect(outcome(await safety.run())).toBe('UNAVAILABLE');
    expect(safety.seen).toHaveLength(1);
  });

  it('US-E2-06/AC2 a network failure is UNAVAILABLE and falls back once', async () => {
    const seen: string[] = [];
    const transport = createGeminiTransport({
      apiKey: KEY,
      fetch: ((url: string) => {
        seen.push(url);
        return Promise.reject(new TypeError(`fetch failed for ${url}`));
      }) as unknown as typeof fetch,
    });
    const reply = await transport.call({ model: PRIMARY, pdf: PDF, targetMonth: '2026-11', promptVersion: 1, schemaVersion: 1 });
    expect(reply).toEqual({ kind: 'timeout' });
  });

  it('US-E2-06/AC2 the provider timeout aborts the request (signal passed to fetch)', async () => {
    const transport = createGeminiTransport({
      apiKey: KEY,
      timeoutMs: 5,
      fetch: ((_url: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'TimeoutError'))))) as unknown as typeof fetch,
    });
    expect(await transport.call({ model: PRIMARY, pdf: PDF, targetMonth: '2026-11', promptVersion: 1, schemaVersion: 1 })).toEqual({ kind: 'timeout' });
  });

  it('US-E2-04/AC8 the caller\'s abort signal reaches fetch', async () => {
    const controller = new AbortController();
    let received: AbortSignal | undefined;
    const transport = createGeminiTransport({
      apiKey: KEY,
      fetch: ((_url: string, init: RequestInit) => {
        received = init.signal ?? undefined;
        return Promise.resolve(envelope('{}'));
      }) as unknown as typeof fetch,
    });
    await transport.call({ model: PRIMARY, pdf: PDF, targetMonth: '2026-11', promptVersion: 1, schemaVersion: 1 }, controller.signal);
    controller.abort();
    expect(received?.aborted).toBe(true);
  });

  it('US-E2-06/AC7 a model id outside the free-tier allow-list is refused without a request', async () => {
    const fake = vi.fn();
    const transport = createGeminiTransport({ apiKey: KEY, fetch: fake as unknown as typeof fetch });
    expect(await transport.call({ model: 'gemini-9-pro', pdf: PDF, targetMonth: '2026-11', promptVersion: 1, schemaVersion: 1 })).toMatchObject({ kind: 'http', status: 400 });
    expect(fake).not.toHaveBeenCalled();
    const paid = createGeminiTransport({ apiKey: KEY, fetch: (() => Promise.resolve(envelope('{}'))) as unknown as typeof fetch, allowedModels: null });
    expect((await paid.call({ model: 'gemini-9-pro', pdf: PDF, targetMonth: '2026-11', promptVersion: 1, schemaVersion: 1 })).kind).toBe('ok');
  });

  it('US-E2-06/AC4 an empty key is refused at construction', () => {
    expect(() => createGeminiTransport({ apiKey: ' ', fetch: fetch })).toThrow();
  });
});

describe('US-NF-03 the key never leaves the transport', () => {
  const everything = async (replies: (() => Response)[]) => {
    const logs: string[] = [];
    const { run, seen } = setup(replies, { logs });
    const result = await run();
    return { text: JSON.stringify(result) + logs.join('\n'), seen };
  };

  it.each([
    ['good', [() => replay('hand-1')]],
    ['malformed twice', [() => replay('hand-malformed'), () => replay('hand-malformed')]],
    ['429 twice', [status(429), status(429)]],
    ['403', [status(403, { error: { message: `API key ${KEY} is not valid` } })]],
    ['503 twice', [status(503), status(503)]],
  ] as [string, (() => Response)[]][])('US-NF-03/AC1 %s: not in results, logs or the request URL/body', async (_n, replies) => {
    const { text, seen } = await everything(replies);
    expect(text).not.toContain(KEY);
    for (const s of seen) {
      expect(s.url).not.toContain(KEY);
      expect(JSON.stringify(s.body)).not.toContain(KEY);
    }
  });

  it('US-NF-03/AC1 not in a thrown error and not in the proxy response (wired through defaultDeps)', async () => {
    const logs: string[] = [];
    const log = vi.spyOn(console, 'log').mockImplementation((m: unknown) => void logs.push(String(m)));
    const calls: string[] = [];
    const fake = ((url: string) => {
      calls.push(url);
      return Promise.resolve(calls.length === 1 ? new Response(JSON.stringify({ error: { message: KEY } }), { status: 403 }) : envelope('{}'));
    }) as unknown as typeof fetch;
    const server = createServer(createHandler(defaultDeps({ GEMINI_API_KEY: KEY }, fake)));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    try {
      const port = (server.address() as AddressInfo).port;
      const res = await fetch(`http://127.0.0.1:${port}/api/menu/extract?targetMonth=2026-11&promptVersion=${PROMPT_VERSION}&schemaVersion=1`, { method: 'POST', body: Buffer.from(PDF), headers: { 'content-type': 'application/pdf' } });
      const body = await res.text();
      expect(JSON.parse(body)).toMatchObject({ ok: false, error: 'UNAVAILABLE', providerCalls: 1 });
      expect(calls).toHaveLength(1);
      expect(body).not.toContain(KEY);
      expect(logs.join('\n')).not.toContain(KEY);
      expect(res.headers.get('x-goog-api-key')).toBeNull();
    } finally {
      log.mockRestore();
      server.close();
    }
  });
});

describe('US-E2-06/AC4 wiring in defaultDeps', () => {
  it('US-E2-06/AC4 no key: no real transport (mock scenarios in tests, NOT_CONFIGURED otherwise)', () => {
    expect(defaultDeps({}).provider).toBeNull();
    expect(defaultDeps({ GEMINI_API_KEY: '' }).provider).toBeNull();
  });
  it('US-E2-06/AC4 key + PROXY_MOCK_SCENARIOS=1: the e2e runs keep the recorded scenarios', () => {
    expect(defaultDeps({ GEMINI_API_KEY: KEY, PROXY_MOCK_SCENARIOS: '1' }).provider).toBeNull();
  });
  it('US-E2-06/AC4 key without mock scenarios: the Gemini transport is wired', () => {
    expect(defaultDeps({ GEMINI_API_KEY: KEY }).provider).not.toBeNull();
  });
});

describe('Gemini prompt (first live eval, 2026-10-31)', () => {
  it('US-E2-06/AC1 the prompt pins the contract id and the ingredients and out-of-month rules the live model got wrong', async () => {
    const { buildPrompt } = await import('../../../server/menu/gemini-prompt.ts');
    const p = buildPrompt('2026-11');
    expect(p).toContain('"extracted-menu/1"');
    expect(p).toContain('never an empty array');
    expect(p).toContain('leave outOfMonthDays as an empty array');
  });
});
