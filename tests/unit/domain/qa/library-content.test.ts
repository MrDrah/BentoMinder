// QA: US-E6-07 curated library content, asserted over data/library.json (derived from the ACs; nothing from src/).
// AC1 validity is the project's own validator command (scripts/validate-data.mjs) exiting 0 with no data/library.json line.
// AC4 (reviewedBy "verifier" on every shipped recipe) was an expected failure (defect D-H4-02) until the verifier pass over all 20 recipes landed (2026-11-01); it is now a normal test.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
interface Recipe {
  id: string;
  style: string;
  minutes: number;
  shortNameJa: string;
  shortNameEn: string;
  reviewedBy: string;
  sources: { url: string }[];
}
const lib = JSON.parse(readFileSync(join(root, 'data', 'library.json'), 'utf8')) as Recipe[];
const cp = (s: string) => [...s].length;

describe('US-E6-07 library content', () => {
  it('US-E6-07/AC1 the library has 15 to 20 recipes with unique ids', () => {
    expect(lib.length).toBeGreaterThanOrEqual(15);
    expect(lib.length).toBeLessThanOrEqual(20);
    expect(new Set(lib.map((r) => r.id)).size).toBe(lib.length);
  });

  it('US-E6-07/AC1 the project validator reports 0 errors for the library', () => {
    const r = spawnSync(process.execPath, ['scripts/validate-data.mjs'], { cwd: root, encoding: 'utf8' });
    const out = `${r.stdout}${r.stderr}`;
    expect(out.split('\n').filter((l) => l.includes('data/library.json'))).toEqual([]);
    expect(r.status, out.slice(0, 400)).toBe(0);
  }, 60_000);

  it('US-E6-07/AC2 mix: >= 6 japanese, >= 4 western-inspired, >= 5 with minutes <= 20', () => {
    expect(lib.filter((r) => r.style === 'japanese').length).toBeGreaterThanOrEqual(6);
    expect(lib.filter((r) => r.style === 'western-inspired').length).toBeGreaterThanOrEqual(4);
    expect(lib.filter((r) => r.minutes <= 20).length).toBeGreaterThanOrEqual(5);
  });

  it('US-E6-07/AC3 every recipe has at least 1 source with an https URL whose fetched text is cached', () => {
    const cacheName = (url: string) => createHash('sha1').update(url).digest('hex').slice(0, 16) + '.txt';
    for (const r of lib) {
      expect(r.sources.length, r.id).toBeGreaterThanOrEqual(1);
      for (const s of r.sources) {
        expect(s.url, r.id).toMatch(/^https:\/\//);
        expect(existsSync(join(root, '.cache', 'sources', cacheName(s.url))), `${r.id} cached source ${s.url}`).toBe(true);
      }
    }
  });

  it('US-E6-07/AC3 the overlap audit reports 0 FAIL and 0 UNVERIFIED', () => {
    const r = spawnSync(process.execPath, ['.claude/skills/quality-gate/scripts/validate.mjs', 'overlap'], { cwd: root, encoding: 'utf8' });
    const out = `${r.stdout}${r.stderr}`;
    expect(out).toMatch(/0 FAIL, 0 UNVERIFIED/);
    expect(r.status, out.slice(-300)).toBe(0);
  }, 120_000);

  it('US-E6-07/AC5 every recipe has shortNameJa and shortNameEn of 1 to 8 characters', () => {
    for (const r of lib) {
      expect(cp(r.shortNameJa), `${r.id} shortNameJa`).toBeGreaterThanOrEqual(1);
      expect(cp(r.shortNameJa), `${r.id} shortNameJa`).toBeLessThanOrEqual(8);
      expect(cp(r.shortNameEn), `${r.id} shortNameEn`).toBeGreaterThanOrEqual(1);
      expect(cp(r.shortNameEn), `${r.id} shortNameEn`).toBeLessThanOrEqual(8);
    }
  });

  // Expected failure while D-H4-02 is open: passes (as "failing as expected") until every recipe is verifier-reviewed.
  it('US-E6-07/AC4 (D-H4-02 fixed 2026-11-01) every shipped recipe has reviewedBy "verifier"', () => {
    expect(lib.filter((r) => r.reviewedBy !== 'verifier').map((r) => r.id)).toEqual([]);
  });
});
