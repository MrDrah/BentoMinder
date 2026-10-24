// Catalog parity, runtime fallback, banned phrases and date formats (BR-23).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { localDate, yearMonth } from '../../../src/domain/time/jst.ts';
import { en } from '../../../src/i18n/en.ts';
import { formatDate, formatMonth, formatTime } from '../../../src/i18n/format.ts';
import { createTranslator, interpolate } from '../../../src/i18n/index.ts';
import { ja } from '../../../src/i18n/ja.ts';

describe('US-E8-02/AC1 catalog parity (BR-23)', () => {
  it('US-E8-02/AC1 ja and en have exactly the same keys and no empty value', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
    for (const value of [...Object.values(ja), ...Object.values(en)]) expect(value.trim()).not.toBe('');
  });

  it('US-E8-02/AC1 every placeholder in a ja message exists in the en message and vice versa', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const differing = (Object.keys(ja) as (keyof typeof ja)[]).filter((k) => {
      // Date formats legitimately use different parts per language (copy.md §2).
      if (k.startsWith('fmt.')) return false;
      return JSON.stringify(names(ja[k])) !== JSON.stringify(names(en[k]));
    });
    expect(differing).toEqual([]);
  });
});

describe('US-E8-02/AC3 missing key fallback (BR-23)', () => {
  it('US-E8-02/AC3 a key missing in en at runtime shows the ja text and warns with the key name', () => {
    const warn = vi.fn();
    const partialEn: Partial<typeof en> = { ...en };
    delete partialEn['cal.today'];
    const t = createTranslator('en', { catalogs: { ja, en: partialEn }, warn });
    expect(t('cal.today')).toBe('今日');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cal.today'));
    expect(t('cal.nextMonth')).toBe('Next month');
  });

  it('US-E8-02/AC3 without a warn hook the fallback is silent; unknown keys show the key', () => {
    const t = createTranslator('en', { catalogs: { ja: {}, en: {} } });
    expect(t('cal.today')).toBe('cal.today');
  });

  it('interpolates named parameters and leaves unknown ones visible', () => {
    expect(interpolate('{a}と{b}', { a: 1 })).toBe('1と{b}');
    expect(createTranslator('ja')('cal.grid.label', { month: '2026年11月' })).toBe('2026年11月のカレンダー');
  });
});

describe('US-E8-03/AC1 Japanese and English date formats', () => {
  const tJa = createTranslator('ja');
  const tEn = createTranslator('en');

  it('US-E8-03/AC1 ja: month 2026-11 → 2026年11月, date 2026-11-04 → 11月4日（水）, time 17:30', () => {
    expect(formatMonth(tJa, 'ja', yearMonth('2026-11'))).toBe('2026年11月');
    expect(formatDate(tJa, 'ja', localDate('2026-11-04'))).toBe('11月4日（水）');
    expect(formatTime('17:30')).toBe('17:30');
  });

  it('US-E8-03/AC1 en: month 2026-11 → November 2026, date 2026-11-04 → Wed, Nov 4, time 17:30', () => {
    expect(formatMonth(tEn, 'en', yearMonth('2026-11'))).toBe('November 2026');
    expect(formatDate(tEn, 'en', localDate('2026-11-04'))).toBe('Wed, Nov 4');
    expect(formatTime('17:30')).toBe('17:30');
  });

  it('US-E8-03/AC2 no catalog string uses the 令和 era', () => {
    expect([...Object.values(ja), ...Object.values(en)].some((v) => v.includes('令和'))).toBe(false);
  });
});

describe('banned phrases never appear in either catalog (BR-07, BR-18, BR-19)', () => {
  const banned = JSON.parse(readFileSync(join(process.cwd(), 'data', 'banned-phrases.json'), 'utf8')) as {
    ja: string[];
    en: string[];
  };
  const fold = (s: string) => s.normalize('NFKC').toLowerCase();

  it('no ja value contains a banned ja phrase (substring match)', () => {
    const hits = Object.entries(ja).flatMap(([k, v]) => banned.ja.filter((p) => fold(v).includes(fold(p))).map((p) => `${k}: ${p}`));
    expect(hits).toEqual([]);
  });

  it('no en value contains a banned en phrase (whole words)', () => {
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hits = Object.entries(en).flatMap(([k, v]) =>
      banned.en.filter((p) => new RegExp(`(^|[^a-z0-9])${escape(fold(p))}($|[^a-z0-9])`).test(fold(v))).map((p) => `${k}: ${p}`),
    );
    expect(hits).toEqual([]);
  });
});
