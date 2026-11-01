// The server-side extraction adapter: BR-10 call budget, sha256 cache, proxy call cap and the
// payload allow-list (US-E2-05, US-E2-06, US-E2-07, US-NF-03). The transport is a scripted fake
// fed with QA's recorded stand-ins; no network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  memoryCache,
  runExtraction,
  sha256Hex,
  windowCap,
  type ExtractDeps,
  type ProviderReply,
  type ProviderRequest,
} from '../../../server/menu/extract.ts';
import { createFixtureTransports, replyOf } from '../../../server/menu/mock-transport.ts';
import type { YearMonth } from '../../../src/domain/time/jst.ts';
import { PROMPT_VERSION } from '../../../src/domain/menu/extraction.ts';
import { loadFixture } from '../helpers/fixtures.ts';

const MENUS = join(process.cwd(), 'tests', 'fixtures', 'menus');
const PDF = new Uint8Array(readFileSync(join(MENUS, 'fixture-menu-2026-11', 'menu.pdf')));
const rec = (name: string, fixture = 'fixture-menu-2026-11') => replyOf(loadFixture(`menus/${fixture}/recorded/${name}.json`));
const VALID = rec('hand-1');
const MALFORMED = rec('hand-malformed');
const RATE_60 = rec('hand-rate-limited');
const RATE = rec('hand-rate-limited-no-retry-after');
const NOT_MENU = rec('hand-not-a-menu');
const UNAVAILABLE: ProviderReply = { kind: 'http', status: 503, retryAfterSec: null };
const http = (status: number): ProviderReply => ({ kind: 'http', status, retryAfterSec: null });

function setup(replies: ProviderReply[], extra: Partial<ExtractDeps> = {}) {
  const requests: ProviderRequest[] = [];
  const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
  const deps: ExtractDeps = {
    transport: {
      call(req) {
        requests.push(req);
        const r = replies[requests.length - 1];
        if (r === undefined) throw new Error('unexpected provider call');
        return Promise.resolve(r);
      },
    },
    primaryModel: 'gemini-3.8-flash',
    fallbackModel: 'gemini-3.5-flash-lite',
    cache: memoryCache(),
    cap: windowCap({ perHour: 100, perDay: 100 }, () => 0),
    timestamp: () => '2026-10-28T10:00:00+09:00',
    sleep,
    ...extra,
  };
  return { deps, requests, sleep, run: () => runExtraction({ pdf: PDF, targetMonth: '2026-11' as YearMonth }, deps) };
}

describe('US-E2-07/AC4 every failure sequence stops after at most 2 calls (BR-10)', () => {
  const rows: [string, ProviderReply, ProviderReply | null, number, 'primary' | 'fallback' | null, string][] = [
    ['valid', VALID, null, 1, null, 'ok'],
    ['malformed → valid', MALFORMED, VALID, 2, 'primary', 'ok'],
    ['malformed → malformed', MALFORMED, MALFORMED, 2, 'primary', 'MALFORMED_OUTPUT'],
    ['malformed → rate-limited', MALFORMED, RATE, 2, 'primary', 'RATE_LIMITED'],
    ['malformed → unavailable', MALFORMED, UNAVAILABLE, 2, 'primary', 'UNAVAILABLE'],
    ['rate-limited → valid', RATE, VALID, 2, 'fallback', 'ok'],
    ['rate-limited → malformed', RATE, MALFORMED, 2, 'fallback', 'MALFORMED_OUTPUT'],
    ['rate-limited → rate-limited', RATE, RATE_60, 2, 'fallback', 'RATE_LIMITED'],
    ['unavailable → valid', UNAVAILABLE, VALID, 2, 'fallback', 'ok'],
    ['unavailable → unavailable', UNAVAILABLE, UNAVAILABLE, 2, 'fallback', 'UNAVAILABLE'],
    ['HTTP 400', http(400), null, 1, null, 'UNAVAILABLE'],
    ['HTTP 403', http(403), null, 1, null, 'UNAVAILABLE'],
    ['HTTP 404', http(404), null, 1, null, 'UNAVAILABLE'],
    ['timeout → valid', { kind: 'timeout' }, VALID, 2, 'fallback', 'ok'],
    ['HTTP 408 → unavailable', http(408), http(500), 2, 'fallback', 'UNAVAILABLE'],
  ];

  it.each(rows)('US-E2-07/AC4 %s', async (_label, first, second, calls, call2, outcome) => {
    const { run, requests } = setup(second === null ? [first] : [first, second]);
    const result = await run();
    expect(requests).toHaveLength(calls);
    expect(requests[0]!.model).toBe('gemini-3.8-flash');
    if (call2 !== null) expect(requests[1]!.model).toBe(call2 === 'primary' ? 'gemini-3.8-flash' : 'gemini-3.5-flash-lite');
    expect(result.ok ? 'ok' : result.error).toBe(outcome);
    expect(result.ok ? result.meta.providerCalls : result.providerCalls).toBe(calls);
  });
});

describe('US-E2-05 malformed output', () => {
  it('US-E2-05/AC1 the repair retry goes to the same model with the validation errors of call 1', async () => {
    const { run, requests } = setup([rec('hand-schema-invalid'), VALID]);
    const r = await run();
    expect(r.ok).toBe(true);
    expect(requests[0]!.repairErrors).toBeUndefined();
    expect(requests[1]!.model).toBe('gemini-3.8-flash');
    expect(requests[1]!.repairErrors?.length).toBeGreaterThan(0);
  });

  it('US-E2-05/AC2 two malformed replies stop with MALFORMED_OUTPUT and no third call', async () => {
    const { run, requests } = setup([MALFORMED, rec('hand-schema-invalid')]);
    expect(await run()).toEqual({ ok: false, error: 'MALFORMED_OUTPUT', providerCalls: 2 });
    expect(requests).toHaveLength(2);
  });

  it('US-E2-05/AC3 an impossible date is malformed (repair retry, then MALFORMED_OUTPUT)', async () => {
    const leap = rec('hand-leap-invalid', 'fixture-menu-2027-02-reiwa');
    const { deps, requests } = setup([leap, leap]);
    const r = await runExtraction({ pdf: PDF, targetMonth: '2027-02' as YearMonth }, deps);
    expect(r).toEqual({ ok: false, error: 'MALFORMED_OUTPUT', providerCalls: 2 });
    expect(requests).toHaveLength(2);
  });

  it('US-E2-05/AC4 US-E2-05/AC5 US-E2-05/AC6 F-1 stand-ins succeed in one call (flags, not MALFORMED_OUTPUT)', async () => {
    for (const [fixture, name] of [['fixture-menu-2026-11', 'hand-out-of-month'], ['fixture-menu-2026-11', 'hand-duplicate'], ['fixture-menu-2026-11-wdmismatch', 'hand-unflagged']] as const) {
      const { run, requests } = setup([rec(name, fixture)]);
      const r = await run();
      expect(r.ok, name).toBe(true);
      expect(requests).toHaveLength(1);
    }
  });

  it('ADR 002 §5: "not a menu" stops after 1 call', async () => {
    const { run } = setup([NOT_MENU]);
    expect(await run()).toEqual({ ok: false, error: 'NOT_A_MENU', providerCalls: 1 });
  });
});

describe('US-E2-06 rate limits and outages', () => {
  it('US-E2-06/AC5 a 429 on the primary switches once to the fallback; source.model is the fallback model', async () => {
    const { run, sleep } = setup([RATE_60, VALID]);
    const r = await run();
    if (!r.ok) throw new Error(r.error);
    expect(r.meta.model).toBe('gemini-3.5-flash-lite');
    expect(r.menu.source.model).toBe('gemini-3.5-flash-lite');
    expect(sleep).toHaveBeenCalledWith(5000); // min(Retry-After 60 s, 5 s)
  });

  it('US-E2-06/AC6 429 on both models → RATE_LIMITED with retryAfterSec from call 2', async () => {
    const { run, sleep } = setup([RATE, RATE_60]);
    expect(await run()).toEqual({ ok: false, error: 'RATE_LIMITED', retryAfterSec: 60, providerCalls: 2 });
    expect(sleep).not.toHaveBeenCalled(); // no Retry-After on call 1: fallback at once
    const { run: run2 } = setup([RATE, RATE]);
    expect(await run2()).toEqual({ ok: false, error: 'RATE_LIMITED', providerCalls: 2 });
  });

  it('US-E2-06/AC2 unavailable on both models → UNAVAILABLE after exactly 2 calls', async () => {
    const { run, requests } = setup([http(500), http(504)]);
    expect(await run()).toEqual({ ok: false, error: 'UNAVAILABLE', providerCalls: 2 });
    expect(requests.map((r) => r.model)).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  });

  it('US-E2-06/AC7 HTTP 400/403/404 are never retried and the status is logged server-side', async () => {
    const log = vi.fn();
    const { run, requests } = setup([http(404)], { log });
    expect(await run()).toEqual({ ok: false, error: 'UNAVAILABLE', providerCalls: 1 });
    expect(requests).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('gemini-3.8-flash attempt: http 404'));
  });

  it('US-E2-06/AC4 no provider configured → NOT_CONFIGURED without any call', async () => {
    const { run } = setup([], { transport: null });
    expect(await run()).toEqual({ ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 });
  });

  it('US-E2-06/AC8 the proxy cap answers RATE_LIMITED with 0 provider calls', async () => {
    let now = 0;
    const cap = windowCap({ perHour: 2, perDay: 3 }, () => now);
    const a = setup([VALID], { cap, bypassCache: true });
    expect((await a.run()).ok).toBe(true);
    expect((await setup([VALID], { cap, bypassCache: true }).run()).ok).toBe(true);
    const blocked = setup([VALID], { cap, bypassCache: true });
    expect(await blocked.run()).toEqual({ ok: false, error: 'RATE_LIMITED', providerCalls: 0 });
    expect(blocked.requests).toHaveLength(0);
    now = 3_600_001; // an hour later the hourly window allows one more, the daily cap (3) then stops
    expect((await setup([VALID], { cap, bypassCache: true }).run()).ok).toBe(true);
    expect(await setup([VALID], { cap, bypassCache: true }).run()).toMatchObject({ error: 'RATE_LIMITED' });
    now = 86_400_001 + 3_600_001;
    expect((await setup([VALID], { cap, bypassCache: true }).run()).ok).toBe(true);
  });

  it('US-E2-07/AC1 D-M1-09 a scenario-driven (bypassCache) extraction never writes to the cache', async () => {
    const a = setup([VALID], { bypassCache: true });
    expect((await a.run()).ok).toBe(true);
    expect(a.deps.cache.get(sha256Hex(PDF))).toBeUndefined();
    const b = setup([VALID]);
    expect((await b.run()).ok).toBe(true);
    expect(b.deps.cache.get(sha256Hex(PDF))).toBeDefined();
  });

  it('US-E2-04/AC8 a stopped import makes no further provider call', async () => {
    const controller = new AbortController();
    const { deps, requests } = setup([RATE, VALID]);
    deps.transport = {
      call(req) {
        requests.push(req);
        controller.abort();
        return Promise.resolve(RATE);
      },
    };
    const r = await runExtraction({ pdf: PDF, targetMonth: '2026-11' as YearMonth }, deps, controller.signal);
    expect(r).toMatchObject({ ok: false, providerCalls: 1 });
    expect(requests).toHaveLength(1);
  });

  it('a transport that throws counts as a timeout (fallback once)', async () => {
    const { deps, requests } = setup([]);
    deps.transport = {
      call(req) {
        requests.push(req);
        return requests.length === 1 ? Promise.reject(new Error('socket')) : Promise.resolve(VALID);
      },
    };
    const r = await runExtraction({ pdf: PDF, targetMonth: '2026-11' as YearMonth }, deps);
    expect(r.ok && r.meta.model).toBe('gemini-3.5-flash-lite');
  });
});

describe('US-E2-07 one extraction per PDF (BR-10)', () => {
  it('US-E2-07/AC1 the same PDF again costs 0 calls (server cache by sha256)', async () => {
    const cache = memoryCache();
    const first = setup([VALID], { cache });
    expect((await first.run()).ok).toBe(true);
    const second = setup([], { cache });
    const r = await second.run();
    expect(r.ok && r.meta).toMatchObject({ cached: true, providerCalls: 0 });
    expect(second.requests).toHaveLength(0);
  });

  it('US-E2-07/AC2 failures are not cached: a new action has its own budget of 2', async () => {
    const cache = memoryCache();
    expect((await setup([MALFORMED, MALFORMED], { cache }).run()).ok).toBe(false);
    const again = setup([MALFORMED, VALID], { cache });
    expect((await again.run()).ok).toBe(true);
    expect(again.requests).toHaveLength(2);
  });

  it('BR-14: oversize, empty or non-PDF bytes are refused before any call', async () => {
    const { deps, requests } = setup([VALID]);
    expect(await runExtraction({ pdf: new Uint8Array(10_485_761), targetMonth: '2026-11' as YearMonth }, deps)).toEqual({ ok: false, error: 'TOO_LARGE', providerCalls: 0 });
    expect(await runExtraction({ pdf: new Uint8Array(0), targetMonth: '2026-11' as YearMonth }, deps)).toEqual({ ok: false, error: 'NOT_A_PDF', providerCalls: 0 });
    expect(await runExtraction({ pdf: new TextEncoder().encode('<html>'), targetMonth: '2026-11' as YearMonth }, deps)).toEqual({ ok: false, error: 'NOT_A_PDF', providerCalls: 0 });
    expect(requests).toHaveLength(0);
  });
});

describe('US-NF-03/AC1 the provider request holds only the allow-listed inputs (BR-10)', () => {
  it('US-NF-03/AC1 US-E2-04/AC7 model, PDF, targetMonth, promptVersion, schemaVersion (+ repair errors) and nothing else', async () => {
    const { run, requests } = setup([MALFORMED, VALID]);
    await run();
    expect(Object.keys(requests[0]!).sort()).toEqual(['model', 'pdf', 'promptVersion', 'schemaVersion', 'targetMonth']);
    expect(Object.keys(requests[1]!).sort()).toEqual(['model', 'pdf', 'promptVersion', 'repairErrors', 'schemaVersion', 'targetMonth']);
    expect(requests[0]).toMatchObject({ targetMonth: '2026-11', promptVersion: PROMPT_VERSION, schemaVersion: 1 });
  });
});

describe('recorded-fixture transport (M1 stand-in for Gemini)', () => {
  const fixtures = createFixtureTransports(MENUS);

  it('maps every committed fixture PDF by sha256 to its hand-1 reply', async () => {
    expect(fixtures.known.size).toBeGreaterThanOrEqual(10);
    const { sha256Hex } = await import('../../../server/menu/extract.ts');
    const t = fixtures.forRequest(sha256Hex(PDF), undefined);
    expect(await t!.call({} as ProviderRequest)).toEqual(VALID);
    expect(fixtures.forRequest('0'.repeat(64), undefined)).toBeNull();
  });

  it('plays a scenario call by call, the last entry repeating; rejects unsafe entries', async () => {
    const t = fixtures.forRequest('x', 'fixture-menu-2026-11/hand-malformed, status:503,timeout')!;
    expect(await t.call({} as ProviderRequest)).toEqual(MALFORMED);
    expect(await t.call({} as ProviderRequest)).toEqual(UNAVAILABLE);
    expect(await t.call({} as ProviderRequest)).toEqual({ kind: 'timeout' });
    expect(await t.call({} as ProviderRequest)).toEqual({ kind: 'timeout' });
    expect(fixtures.forRequest('x', '../../etc/passwd')).toBeNull();
    expect(createFixtureTransports(join(MENUS, 'missing')).known.size).toBe(0);
  });
});
