// The on-disk extraction cache (ADR 002 §2): US-E2-07/AC1 (a repeated PDF costs 0 provider calls), BR-10.
// Temp directory, fake time, scripted transport: no network.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runExtraction, sha256Hex, windowCap, type ExtractDeps, type ProviderRequest } from '../../../server/menu/extract.ts';
import { defaultCache, fileCache } from '../../../server/menu/file-cache.ts';
import { replyOf } from '../../../server/menu/mock-transport.ts';
import type { YearMonth } from '../../../src/domain/time/jst.ts';
import { loadFixture } from '../helpers/fixtures.ts';

const PDF = new Uint8Array(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'menus', 'fixture-menu-2026-11', 'menu.pdf')));
const VALID = replyOf(loadFixture('menus/fixture-menu-2026-11/recorded/hand-1.json'));
const sha = (n: number) => n.toString(16).padStart(64, '0');
let dir: string;
let now = 1_000;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bm-cache-'));
  now = 1_000;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('US-E2-07/AC1 file cache', () => {
  it('hit after set, miss for an unknown or malformed key', () => {
    const c = fileCache({ dir, nowMs: () => now });
    expect(c.get(sha(1))).toBeUndefined();
    c.set(sha(1), { text: '{"a":1}', model: 'm' });
    expect(c.get(sha(1))).toEqual({ text: '{"a":1}', model: 'm' });
    expect(c.get('../../etc/passwd')).toBeUndefined();
    c.set('../evil', { text: 'x', model: 'm' });
    expect(readdirSync(dir)).toEqual([`${sha(1)}.json`]);
  });

  it('survives a restart (a new cache over the same directory)', () => {
    fileCache({ dir }).set(sha(2), { text: 't', model: 'm' });
    expect(fileCache({ dir }).get(sha(2))).toEqual({ text: 't', model: 'm' });
  });

  it('an entry from another prompt or schema version is a miss', () => {
    fileCache({ dir, promptVersion: 1, schemaVersion: 1 }).set(sha(3), { text: 't', model: 'm' });
    expect(fileCache({ dir, promptVersion: 2, schemaVersion: 1 }).get(sha(3))).toBeUndefined();
    expect(fileCache({ dir, promptVersion: 1, schemaVersion: 2 }).get(sha(3))).toBeUndefined();
    expect(fileCache({ dir, promptVersion: 1, schemaVersion: 1 }).get(sha(3))).toBeDefined();
  });

  it('a corrupt or wrongly shaped file is a miss, never a throw', () => {
    const c = fileCache({ dir });
    writeFileSync(join(dir, `${sha(4)}.json`), '{not json');
    writeFileSync(join(dir, `${sha(5)}.json`), 'null');
    writeFileSync(join(dir, `${sha(6)}.json`), JSON.stringify({ text: 1, model: 'm', promptVersion: 2, schemaVersion: 1 }));
    for (const n of [4, 5, 6]) expect(c.get(sha(n))).toBeUndefined();
  });

  it('evicts the oldest entries first beyond the entry cap and the byte cap', () => {
    const c = fileCache({ dir, maxEntries: 2, nowMs: () => now });
    for (const n of [1, 2, 3]) {
      now += 1000;
      c.set(sha(n), { text: 't', model: 'm' });
    }
    expect(c.get(sha(1))).toBeUndefined();
    expect(c.get(sha(2))).toBeDefined();
    expect(c.get(sha(3))).toBeDefined();
    const big = fileCache({ dir: join(dir, 'b'), maxBytes: 400, nowMs: () => now });
    for (const n of [1, 2, 3]) {
      now += 1000;
      big.set(sha(n), { text: 'x'.repeat(150), model: 'm' });
    }
    expect(big.get(sha(1))).toBeUndefined();
    expect(big.get(sha(3))).toBeDefined();
  });

  it('writes atomically: no temp file is left and the entry holds only reply, model and versions', () => {
    const c = fileCache({ dir, nowMs: () => now });
    c.set(sha(7), { text: 't', model: 'm' });
    expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    expect(Object.keys(JSON.parse(readFileSync(join(dir, `${sha(7)}.json`), 'utf8'))).sort()).toEqual(['model', 'promptVersion', 'schemaVersion', 'storedAt', 'text']);
  });

  it('defaultCache falls back to memory when the directory cannot be created', () => {
    const blocker = join(dir, 'file');
    writeFileSync(blocker, 'x');
    chmodSync(blocker, 0o444);
    const logs: string[] = [];
    const c = defaultCache(join(blocker, 'sub'), (m) => logs.push(m));
    c.set(sha(8), { text: 't', model: 'm' });
    expect(c.get(sha(8))).toEqual({ text: 't', model: 'm' });
    expect(logs).toHaveLength(1);
    expect(existsSync(join(blocker, 'sub'))).toBe(false);
  });

  it('US-E2-07/AC1 BR-10 the same PDF through runExtraction costs 1 provider call, then 0 (also after a restart)', async () => {
    const requests: ProviderRequest[] = [];
    const mk = (): ExtractDeps => ({
      transport: { call: (req) => (requests.push(req), Promise.resolve(VALID)) },
      primaryModel: 'p',
      fallbackModel: 'f',
      cache: fileCache({ dir, nowMs: () => now }),
      cap: windowCap({ perHour: 100, perDay: 100 }, () => 0),
      timestamp: () => '2026-10-28T10:00:00+09:00',
      sleep: () => Promise.resolve(),
    });
    const input = { pdf: PDF, targetMonth: '2026-11' as YearMonth };
    const first = await runExtraction(input, mk());
    expect(first).toMatchObject({ ok: true, meta: { cached: false, providerCalls: 1 } });
    expect(readdirSync(dir)).toEqual([`${sha256Hex(PDF)}.json`]);
    const second = await runExtraction(input, mk());
    expect(second).toMatchObject({ ok: true, meta: { cached: true, providerCalls: 0 } });
    expect(requests).toHaveLength(1);
  });
});
