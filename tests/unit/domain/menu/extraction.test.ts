// F-1: model replies are normalised before the strict parse (US-E2-05/AC3–AC6, BR-11). Every
// case uses QA's recorded stand-ins under tests/fixtures/menus/*/recorded/.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractionId,
  isNotAMenu,
  normalizeModelOutput,
  parseModelReply,
  safeFilename,
  stampOrigin,
  type ReplyContext,
} from '../../../../src/domain/index.ts';
import type { YearMonth } from '../../../../src/domain/time/jst.ts';
import { loadFixture } from '../../helpers/fixtures.ts';

interface Recorded {
  scenario: string;
  model: string;
  response: { httpStatus: number; modelOutput?: Record<string, unknown>; rawText?: string };
  expect: { extractResult: string; strictSchemaValid?: boolean };
}

const SHA = 'a'.repeat(64);
const rec = (fixture: string, name: string) => loadFixture<Recorded>(`menus/${fixture}/recorded/${name}.json`);
const ctx = (targetMonth: string): ReplyContext => ({
  targetMonth: targetMonth as YearMonth,
  sha256: SHA,
  byteSize: 1000,
  model: 'gemini-3.8-flash',
  promptVersion: 1,
  at: '2026-10-28T10:00:00+09:00',
});
const reply = (r: Recorded) => r.response.rawText ?? JSON.stringify(r.response.modelOutput);
const parse = (fixture: string, name: string, month?: string) => {
  const r = rec(fixture, name);
  return parseModelReply(reply(r), ctx(month ?? String(r.response.modelOutput?.['targetMonth'] ?? '2026-11')));
};

describe('US-E2-04/AC1 recorded ok replies validate (BR-11)', () => {
  const menusDir = join(process.cwd(), 'tests', 'fixtures', 'menus');
  const okFiles = readdirSync(menusDir).flatMap((d) => {
    try {
      return readdirSync(join(menusDir, d, 'recorded')).map((f) => [d, f.replace(/\.json$/, '')] as const);
    } catch {
      return [];
    }
  });

  it('US-E2-04/AC1 every stand-in whose expected result is "ok" parses to an ExtractedMenu after normalisation', () => {
    const checked = okFiles.filter(([d, f]) => rec(d, f).expect.extractResult === 'ok' && rec(d, f).response.httpStatus === 200);
    expect(checked.length).toBeGreaterThanOrEqual(15);
    for (const [d, f] of checked) {
      const out = parse(d, f);
      expect(out.kind, `${d}/${f}`).toBe('ok');
    }
  });

  it('US-E2-04/AC6 the app sets id, source (sha256, byteSize, model, promptVersion, fetchedAt) and extractedAt', () => {
    const out = parse('fixture-menu-2026-11', 'hand-1');
    if (out.kind !== 'ok') throw new Error(out.kind);
    expect(out.menu.id).toBe(extractionId('2026-11', SHA));
    expect(out.menu.id).toBe('ext-2026-11-aaaaaaaa');
    expect(out.menu.source).toMatchObject({ sha256: SHA, byteSize: 1000, model: 'gemini-3.8-flash', promptVersion: 1 });
    expect(out.menu.extractedAt).toBe('2026-10-28T10:00:00+09:00');
  });

  it('US-E2-04/AC4 the hard-to-read dish comes back uncertain with a reason', () => {
    const out = parse('fixture-menu-2026-11', 'hand-1');
    if (out.kind !== 'ok') throw new Error(out.kind);
    const item = out.menu.days.find((d) => d.date === '2026-11-05')!.items[0]!;
    expect(item.text).toBe('さばのみそに');
    expect(item.verification.status).toBe('uncertain');
    expect(item.verification.reason).toBeDefined();
  });
});

describe('US-E2-05 malformed or impossible output (BR-10, BR-11)', () => {
  it('US-E2-05/AC1 text that is not JSON is malformed (json-parse)', () => {
    expect(parse('fixture-menu-2026-11', 'hand-malformed')).toEqual({ kind: 'malformed', issues: ['json-parse'] });
  });

  it('US-E2-05/AC2 JSON missing a required field is malformed', () => {
    expect(parse('fixture-menu-2026-11', 'hand-schema-invalid').kind).toBe('malformed');
  });

  it('US-E2-05/AC3 an impossible date (2027-02-29) is malformed with date-invalid', () => {
    const out = parse('fixture-menu-2027-02-reiwa', 'hand-leap-invalid');
    expect(out.kind).toBe('malformed');
    if (out.kind === 'malformed') expect(out.issues.some((i) => i.startsWith('date-invalid'))).toBe(true);
  });

  it('US-E2-05/AC4 a lunch day outside the target month moves to outOfMonthDays instead of failing', () => {
    const out = parse('fixture-menu-2026-11', 'hand-out-of-month');
    if (out.kind !== 'ok') throw new Error(out.kind);
    expect(out.menu.days.some((d) => d.date === '2026-12-01')).toBe(false);
    expect(out.menu.outOfMonthDays).toEqual([expect.objectContaining({ kind: 'lunch-day', day: expect.objectContaining({ date: '2026-12-01' }) })]);
  });

  it('US-E2-05/AC4 out-of-month no-lunch days move too, and a different detected month adds month-mismatch', () => {
    const out = parse('fixture-menu-2027-02-reiwa', 'hand-target-2027-03', '2027-03');
    if (out.kind !== 'ok') throw new Error(out.kind);
    expect(out.menu.days).toEqual([]);
    expect(out.menu.noLunchDays).toEqual([]);
    expect(out.menu.outOfMonthDays.length).toBeGreaterThan(10);
    expect(out.menu.outOfMonthDays.some((e) => e.kind === 'no-lunch-day')).toBe(true);
    expect(out.menu.warnings).toContain('month-mismatch');
  });

  it('US-E2-05/AC5 an unflagged weekday mismatch is flagged uncertain / weekday-mismatch, not malformed', () => {
    const out = parse('fixture-menu-2026-11-wdmismatch', 'hand-unflagged');
    if (out.kind !== 'ok') throw new Error(out.kind);
    const day = out.menu.days.find((d) => d.date === '2026-11-04')!;
    expect(day.printedWeekday).toBe('木');
    expect(day.verification).toEqual({ status: 'uncertain', reason: 'weekday-mismatch' });
  });

  it('US-E2-05/AC6 a duplicate date is merged into one entry with all items, flagged duplicate-date', () => {
    const out = parse('fixture-menu-2026-11', 'hand-duplicate');
    if (out.kind !== 'ok') throw new Error(out.kind);
    const days = out.menu.days.filter((d) => d.date === '2026-11-05');
    expect(days).toHaveLength(1);
    expect(days[0]!.items).toHaveLength(5);
    expect(days[0]!.verification).toEqual({ status: 'uncertain', reason: 'duplicate-date' });
  });

  it('US-E2-05/AC6 duplicate no-lunch dates keep one entry flagged duplicate-date; mismatch on a merged day keeps both reasons', () => {
    const out = normalizeModelOutput(
      {
        detectedMonth: '2026-11',
        warnings: [],
        days: [
          { date: '2026-11-05', printedWeekday: '金', items: [{ text: 'a' }], verification: { status: 'ok' }, notes: ['x'], ingredientsStatus: 'listed', ingredients: [{ text: 'i' }], allergenDeclaration: { status: 'declared', allergenIds: ['alg-egg'], rawText: '卵' } },
          { date: '2026-11-05', items: [{ text: 'b' }], notes: ['x', 'y'], ingredientsStatus: 'listed', ingredients: [{ text: 'j' }], allergenDeclaration: { status: 'declared', allergenIds: ['alg-wheat'], rawText: '小麦' } },
        ],
        noLunchDays: [
          { date: '2026-11-20', reason: 'bento-day' },
          { date: '2026-11-20', reason: 'no-lunch' },
        ],
      },
      '2026-11' as YearMonth,
    ) as { days: Record<string, unknown>[]; noLunchDays: Record<string, unknown>[] };
    expect(out.noLunchDays).toEqual([{ date: '2026-11-20', reason: 'bento-day', verification: { status: 'uncertain', reason: 'duplicate-date' } }]);
    const day = out.days[0]!;
    expect(day['verification']).toEqual({ status: 'uncertain', reason: 'weekday-mismatch', note: 'duplicate-date' });
    expect(day['notes']).toEqual(['x', 'y']);
    expect((day['ingredients'] as unknown[]).length).toBe(2);
    expect(day['allergenDeclaration']).toMatchObject({ status: 'declared', allergenIds: ['alg-egg', 'alg-wheat'], rawText: '卵／小麦' });
  });

  it('ADR 002 §5: a reply with no dates at all is not a menu', () => {
    expect(parse('fixture-menu-2026-11', 'hand-not-a-menu')).toEqual({ kind: 'not-a-menu' });
    expect(isNotAMenu({ days: [], noLunchDays: [], outOfMonthDays: [{}] })).toBe(false);
  });

  it('normalisation leaves non-objects and malformed entries for the strict schema', () => {
    expect(normalizeModelOutput([1], '2026-11' as YearMonth)).toEqual([1]);
    expect(parseModelReply('[1]', ctx('2026-11'))).toEqual({ kind: 'malformed', issues: ['not-an-object'] });
    const out = normalizeModelOutput({ days: [null, { items: [] }] }, '2026-11' as YearMonth) as { days: unknown[] };
    expect(out.days).toHaveLength(2);
  });
});

describe('US-E2-02/AC2 the client records how the PDF was obtained', () => {
  const ok = () => {
    const out = parse('fixture-menu-2026-11', 'hand-1');
    if (out.kind !== 'ok') throw new Error(out.kind);
    return out.menu;
  };

  it('US-E2-01/AC1 a URL import stores kind url with the URL', () => {
    const m = stampOrigin(ok(), { kind: 'url', url: 'https://example-kinder.test/menu/2026-11.pdf' });
    expect(m?.source).toMatchObject({ kind: 'url', url: 'https://example-kinder.test/menu/2026-11.pdf' });
    expect(m?.source.filename).toBeUndefined();
  });

  it('US-E2-02/AC2 an upload after a failed URL stores both the filename and the URL', () => {
    const m = stampOrigin(ok(), { kind: 'upload', filename: ' 11gatsu.pdf ', url: 'https://example-kinder.test/m.pdf' });
    expect(m?.source).toMatchObject({ kind: 'upload', filename: '11gatsu.pdf', url: 'https://example-kinder.test/m.pdf' });
    expect(stampOrigin(ok(), { kind: 'url', url: 'http://x.test/m.pdf' })).toBeNull();
    expect(safeFilename('   ')).toBe('menu.pdf');
    expect([...safeFilename('あ'.repeat(300))]).toHaveLength(255);
  });
});
