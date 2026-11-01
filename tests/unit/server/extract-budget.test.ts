// Time budget of one import (D-H4-01, US-NF-04/AC3): the client aborts after 60 s, so the proxy's
// primary attempt plus the fallback must end inside that. Fake timers and a transport that hangs
// until its signal aborts; no network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERALL_BUDGET_MS, PRIMARY_TIMEOUT_MS, SECOND_CALL_MAX_MS, memoryCache, runExtraction, windowCap, type ProviderReply, type ProviderRequest } from '../../../server/menu/extract.ts';
import { PROVIDER_TIMEOUT_MS } from '../../../server/menu/gemini-transport.ts';
import { replyOf } from '../../../server/menu/mock-transport.ts';
import { buildPrompt } from '../../../server/menu/gemini-prompt.ts';
import { EXTRACT_TIMEOUT_MS } from '../../../src/adapters/web/extractor.ts';
import type { YearMonth } from '../../../src/domain/time/jst.ts';
import { loadFixture } from '../helpers/fixtures.ts';

const PDF = new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'menus', 'fixture-menu-2026-11', 'menu.pdf')));
const VALID = replyOf(loadFixture('menus/fixture-menu-2026-11/recorded/hand-1.json'));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Each scripted step either answers after `afterMs` or hangs until aborted (answering `timeout`). */
function harness(steps: ({ afterMs: number; reply: ProviderReply } | 'hang')[]) {
  const requests: ProviderRequest[] = [];
  const deps = {
    transport: {
      call(req: ProviderRequest, signal?: AbortSignal): Promise<ProviderReply> {
        const step = steps[requests.length];
        requests.push(req);
        if (step === undefined) throw new Error('unexpected third provider call');
        return new Promise((resolve) => {
          const done = (r: ProviderReply) => resolve(r);
          signal?.addEventListener('abort', () => done({ kind: 'timeout' }));
          if (step !== 'hang') setTimeout(() => done(step.reply), step.afterMs);
        });
      },
    },
    primaryModel: 'gemini-3.8-flash',
    fallbackModel: 'gemini-3.5-flash-lite',
    cache: memoryCache(),
    cap: windowCap({ perHour: 100, perDay: 100 }, () => 0),
    timestamp: () => '2026-10-28T10:00:00+09:00',
    sleep: () => Promise.resolve(),
  };
  return { requests, run: () => runExtraction({ pdf: PDF, targetMonth: '2026-11' as YearMonth }, deps) };
}

describe('US-NF-04/AC3 provider time budget fits inside the 60 s client limit', () => {
  it('the constants leave the client its margin: primary + second call <= overall < client', () => {
    expect(PRIMARY_TIMEOUT_MS + SECOND_CALL_MAX_MS).toBeLessThanOrEqual(OVERALL_BUDGET_MS);
    expect(OVERALL_BUDGET_MS).toBeLessThan(EXTRACT_TIMEOUT_MS);
    expect(PROVIDER_TIMEOUT_MS).toBeLessThanOrEqual(SECOND_CALL_MAX_MS);
  });

  it('a primary that hangs times out at 25 s, the fallback answers, total well under 60 s, 2 calls', async () => {
    const h = harness(['hang', { afterMs: 20_000, reply: VALID }]);
    const start = Date.now();
    const p = h.run();
    await vi.advanceTimersByTimeAsync(PRIMARY_TIMEOUT_MS - 1);
    expect(h.requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.requests).toHaveLength(2);
    expect(h.requests[1]!.model).toBe('gemini-3.5-flash-lite');
    await vi.advanceTimersByTimeAsync(20_000);
    const r = await p;
    expect(r.ok && r.meta.providerCalls).toBe(2);
    expect(Date.now() - start).toBeLessThan(EXTRACT_TIMEOUT_MS);
  });

  it('both calls hang: UNAVAILABLE after 55 s at most, never a third call', async () => {
    const h = harness(['hang', 'hang']);
    const start = Date.now();
    const p = h.run();
    await vi.advanceTimersByTimeAsync(PRIMARY_TIMEOUT_MS + SECOND_CALL_MAX_MS);
    const r = await p;
    expect(r).toMatchObject({ ok: false, error: 'UNAVAILABLE', providerCalls: 2 });
    expect(Date.now() - start).toBeLessThanOrEqual(OVERALL_BUDGET_MS);
    expect(h.requests).toHaveLength(2);
  });

  it('a primary that would answer at 28 s is cut at 25 s, then the fallback runs', async () => {
    const h = harness([{ afterMs: 28_000, reply: VALID }, { afterMs: 1_000, reply: VALID }]);
    const p = h.run();
    await vi.advanceTimersByTimeAsync(PRIMARY_TIMEOUT_MS + 1_000);
    expect((await p).ok).toBe(true);
    expect(h.requests.map((r) => r.model)).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  });
});

describe('prompt rules found by the live eval (M5)', () => {
  const text = buildPrompt('2026-12');
  it('item text carries no printed label and おやつ is kind snack', () => {
    expect(text).toContain('おやつ：');
    expect(text).toContain('"snack"');
  });
  it('a printed date with no dish and no reason is left out', () => {
    expect(text).toContain('left out completely');
  });
});
