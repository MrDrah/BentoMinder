// QA M3: US-E6-03/AC2 no safety claims in any catalog string (ja and en, every key, not only M3 keys) nor in the library
// recipe text; US-E6-03/AC1 the disclaimer string equals the AC text in ja; US-E6-02/AC4, AC5, AC6, AC8 wording present.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '../../../../src/i18n/en.ts';
import { ja } from '../../../../src/i18n/ja.ts';

const banned = JSON.parse(readFileSync(join(process.cwd(), 'data', 'banned-phrases.json'), 'utf8')) as { ja: string[]; en: string[] };
const fold = (s: string) => s.normalize('NFKC').toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hitJa = (v: string, p: string) => fold(v).includes(fold(p));
const hitEn = (v: string, p: string) => new RegExp(`(^|[^a-z0-9])${esc(fold(p))}($|[^a-z0-9])`).test(fold(v));
const strings = (o: unknown): string[] => (typeof o === 'string' ? [o] : Array.isArray(o) ? o.flatMap(strings) : o !== null && typeof o === 'object' ? Object.values(o).flatMap(strings) : []);

describe('QA M3 copy: banned phrases (BR-07)', () => {
  it('US-E6-03/AC2 banned list is non-empty in both languages (scan is not vacuous)', () => {
    expect(banned.ja.length).toBeGreaterThan(3);
    expect(banned.en.length).toBeGreaterThan(3);
  });
  it('US-E6-03/AC2 no catalog string, ja or en, matches a banned phrase', () => {
    const hits: string[] = [];
    for (const [k, v] of Object.entries(ja)) for (const p of banned.ja) if (hitJa(v, p)) hits.push(`ja ${k}: ${p}`);
    for (const [k, v] of Object.entries(en)) {
      for (const p of banned.en) if (hitEn(v, p)) hits.push(`en ${k}: ${p}`);
      for (const p of banned.ja) if (hitJa(v, p)) hits.push(`en ${k} (ja phrase): ${p}`);
    }
    expect(hits).toEqual([]);
    expect(Object.keys(ja).length).toBeGreaterThan(300);
  });
  it('US-E6-03/AC2 no recipe text in data/library.json matches a banned phrase', () => {
    const lib = JSON.parse(readFileSync(join(process.cwd(), 'data', 'library.json'), 'utf8')) as unknown[];
    const hits: string[] = [];
    for (const r of lib as { id: string }[]) {
      for (const s of strings(r)) {
        for (const p of banned.ja) if (hitJa(s, p)) hits.push(`${r.id}: ${p} in ${s.slice(0, 30)}`);
        for (const p of banned.en) if (hitEn(s, p)) hits.push(`${r.id}: ${p} in ${s.slice(0, 30)}`);
      }
    }
    // Defect M3-D01 fixed 2026-10-31 (8 en/ja adaptation notes reworded): no offender is allowed any more.
    expect(hits).toEqual([]);
  });
  it('US-E6-03/AC1 the catalog carries the exact disclaimer in ja and the key strings of AC4/AC5/AC6/AC8 and AC3', () => {
    const all = Object.values(ja);
    expect(all).toContain('アレルギーの安全を保証するものではありません。使用する食品の表示を必ずご確認ください。');
    expect(all).toContain('市販品は製品によりアレルゲンが異なります。表示を確認してください。');
    expect(all).toContain('一部の材料のアレルゲン情報がわかりません。食品の表示を確認してください。');
    expect(all).toContain('アレルゲン情報が不完全なため、登録したアレルギーと照合できません');
    expect(all).toContain('原材料の由来がわからないため、食事の制限と照合できません');
    expect(Object.values(en)).toContain('Allergen information is missing for some ingredients. Check the food labels.');
    expect(Object.values(en)).toContain("Allergen information is incomplete, so it can't be checked against the registered allergies");
    expect(Object.values(en)).toContain("The origin of some ingredients is unknown, so it can't be checked against the diet");
    expect(all.some((s) => s.includes('表示対象のアレルゲン：使用していません（食品の表示をご確認ください）'))).toBe(true);
  });
  it('US-E6-03/AC3 no catalog string is the bare 「アレルゲンなし」', () => {
    expect(Object.values(ja).filter((s) => s.trim() === 'アレルゲンなし')).toEqual([]);
  });
});
