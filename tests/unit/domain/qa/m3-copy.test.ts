// QA M3: US-E6-03/AC2 no safety claims in any catalog string (ja and en, every key, not only M3 keys) nor in the library
// recipe text; US-E6-03/AC1 the disclaimer string equals the AC text in ja; US-E6-02/AC8 wording present; 2026-11-01: warn.processed.* strings, retired keys gone.
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
  it('US-E6-03/AC1 the catalog carries the exact disclaimer in ja, the AC8 diet wording and the AC3 empty-allergen badge', () => {
    const all = Object.values(ja);
    expect(all).toContain('アレルギーの安全を保証するものではありません。使用する食品の表示を必ずご確認ください。');
    expect(all).toContain('原材料の由来がわからないため、食事の制限と照合できません');
    expect(Object.values(en)).toContain("The origin of some ingredients is unknown, so it can't be checked against the diet");
    expect(all.some((s) => s.includes('表示対象のアレルゲン：使用していません（食品の表示をご確認ください）'))).toBe(true);
  });
  it('US-E6-02/AC11 US-E6-04/AC6 the processed-food strings exist with the designer wording (ja and en) and the retired keys and strings are gone', () => {
    const j = ja as Record<string, string>;
    const e = en as Record<string, string>;
    expect(j['warn.processed.card']).toBe('市販品の表示を確認');
    expect(e['warn.processed.card']).toBe('Check labels of store-bought items');
    expect(j['warn.processed.item']).toBe('市販品。表示を確認');
    expect(e['warn.processed.item']).toBe('Store-bought product: check the label');
    expect(j['warn.processed.recipe']).toBe('市販品には、登録したアレルゲン（{allergens}）が含まれる場合があります。パッケージの表示を確認してください。');
    expect(e['warn.processed.recipe']).toBe('Store-bought products may contain the registered allergens ({allergens}). Check the package label.');
    expect(j['warn.processed.prefix']).toBe('注意');
    expect(e['warn.processed.prefix']).toBe('Note');
    expect(j['allergy.processed.hint']).toBe('市販品を使うレシピには、登録したアレルゲンを挙げて、パッケージの表示を確認するようご案内します。');
    expect(e['allergy.processed.hint']).toBe('For recipes that use store-bought products, the app lists the allergens you register and reminds you to check the package label.');
    for (const k of ['rec.variesByProduct', 'rec.incomplete', 'rec.mayContain', 'library.conflict.incomplete']) {
      expect(k in j, `ja ${k}`).toBe(false);
      expect(k in e, `en ${k}`).toBe(false);
    }
    const retired = ['市販品は製品によりアレルゲンが異なります', '一部の材料のアレルゲン情報がわかりません', 'アレルゲン情報が不完全なため'];
    const retiredEn = ['Store-bought products differ in allergens', 'Allergen information is missing for some ingredients', 'Allergen information is incomplete'];
    for (const v of Object.values(ja)) for (const r of retired) expect(v.includes(r), r).toBe(false);
    for (const v of Object.values(en)) for (const r of retiredEn) expect(v.includes(r), r).toBe(false);
  });
  it('US-E6-03/AC4 US-E1-03/AC7 banned-phrase scan over ALL new processed-food strings (ja and en, both phrase lists) and none says or implies safety', () => {
    const keys = Object.keys(ja).filter((k) => k.startsWith('warn.processed.') || k === 'allergy.processed.hint');
    expect(keys.length).toBeGreaterThanOrEqual(5);
    // implied-safety patterns, independent of the banned list: absence / freedom / OK-ness claims about the product
    const impliesSafetyJa = /(含まれません|含みません|含まない|不使用|使用していません|入っていません|フリー|安全|安心|大丈夫|問題ありません|心配(は)?ありません|除去|対応済|対応しています)/;
    const impliesSafetyEn = /\b(free|safe|safely|without|no\s+\w*allergen|does not contain|doesn't contain|not contain|guarantee[sd]?|ok|okay|fine|suitable)\b/i;
    const hits: string[] = [];
    for (const k of keys) {
      const jv = (ja as Record<string, string>)[k]!;
      const ev = (en as Record<string, string>)[k];
      expect(ev, `en ${k}`).toBeTypeOf('string');
      for (const [lang, v] of [['ja', jv], ['en', ev!]] as const) {
        for (const p of banned.ja) if (hitJa(v, p)) hits.push(`${lang} ${k}: banned ja ${p}`);
        for (const p of banned.en) if (hitEn(v, p)) hits.push(`${lang} ${k}: banned en ${p}`);
      }
      if (impliesSafetyJa.test(jv.normalize('NFKC'))) hits.push(`ja ${k}: implies safety`);
      if (impliesSafetyEn.test(ev!)) hits.push(`en ${k}: implies safety`);
    }
    expect(hits).toEqual([]);
    // the card, item and notice phrase the allergens as something to check: each tells the parent to check (確認 / check)
    for (const k of ['warn.processed.card', 'warn.processed.item', 'warn.processed.recipe']) {
      expect((ja as Record<string, string>)[k]).toContain('確認');
      expect((en as Record<string, string>)[k]!.toLowerCase()).toContain('check');
    }
    expect((ja as Record<string, string>)['warn.processed.recipe']).toContain('含まれる場合があります');
    expect((en as Record<string, string>)['warn.processed.recipe']).toContain('may contain');
  });
  it('US-E6-03/AC3 no catalog string is the bare 「アレルゲンなし」', () => {
    expect(Object.values(ja).filter((s) => s.trim() === 'アレルゲンなし')).toEqual([]);
  });
});
