// QA: catalog scans for the never-rules N2 (no safety claims) and N4 (no reservation claims), derived from the ACs
// of US-E4-04, US-E5-07 and US-E4-02. Scans the full string catalog (ja and en), not only rendered screens.
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

const assessKeys = (cat: Record<string, string>) => Object.keys(cat).filter((k) => /^(assess\.|state\.|day\.assess\.|override\.|cal\.state|legend\.)/.test(k));

describe('QA catalog: US-E4-04 neutral wording', () => {
  it('US-E4-04/AC1 the assessment strings exist in both languages (the scan is not vacuous)', () => {
    expect(assessKeys(ja).length).toBeGreaterThanOrEqual(15);
    expect(assessKeys(en).length).toBe(assessKeys(ja).length);
  });

  it('US-E4-04/AC1 no assessment string (ja or en) matches a banned phrase or contains 「よくない」, "unsuitable" or "avoid"', () => {
    const extraJa = ['よくない', '良くない', 'ダメ', '悪い'];
    const extraEn = ['unsuitable', 'avoid', 'bad', 'poor', 'unhealthy'];
    const hits: string[] = [];
    for (const k of assessKeys(ja)) {
      for (const p of [...banned.ja, ...extraJa]) if (hitJa(ja[k as keyof typeof ja], p)) hits.push(`ja ${k}: ${p}`);
    }
    for (const k of assessKeys(en)) {
      for (const p of [...banned.en, ...extraEn]) if (hitEn(en[k as keyof typeof en], p)) hits.push(`en ${k}: ${p}`);
    }
    expect(hits).toEqual([]);
  });

  it('US-E4-04/AC1 the whole catalog (every key, ja and en) has no banned phrase', () => {
    const hits: string[] = [];
    for (const [k, v] of Object.entries(ja)) for (const p of banned.ja) if (hitJa(v, p)) hits.push(`ja ${k}: ${p}`);
    for (const [k, v] of Object.entries(en)) for (const p of banned.en) if (hitEn(v, p)) hits.push(`en ${k}: ${p}`);
    expect(hits).toEqual([]);
  });

  it('US-E4-04/AC2 the state labels are the child-preference words of the story', () => {
    expect([ja['state.likely'], ja['state.mixed'], ja['state.low'], ja['state.notAssessed'], ja['state.noLunch']]).toEqual(['たのしめそう', 'どちらとも', '苦手かも', '未判定', '給食なし']);
    for (const k of ['state.likely', 'state.mixed', 'state.low', 'state.notAssessed', 'state.noLunch'] as const) {
      expect(en[k].trim(), k).not.toBe('');
      // the en labels talk about the child, never about the food or the school
      expect(en[k].toLowerCase(), k).not.toMatch(/\b(bad|poor|avoid|unsuitable|unhealthy|wrong)\b/);
    }
  });
});

describe('QA catalog: US-E5-07 never claim a school reservation (N4, BR-19)', () => {
  it('US-E5-07/AC1 the school-lunch note says the reservation is made with the school, in ja with the exact sentence of the story', () => {
    expect(ja['day.reservation.note']).toBe('給食の予約は園の方法で行ってください（このアプリでは予約されません）');
    expect(en['day.reservation.note'].toLowerCase()).toMatch(/school/);
    expect(en['day.reservation.note'].toLowerCase()).toMatch(/doesn't|does not|not/);
  });

  it('US-E5-07/AC2 no ja or en string matches a reservation phrase of the banned list (the checkbox label key is exempt by key, listed here)', () => {
    const EXEMPT = new Set(['day.reservation.check']); // AC2 exemption, by key: 「園で予約済み（自分で記録）」 / its en label
    const hits: string[] = [];
    const resJa = banned.ja.filter((p) => /予約|注文|申し込|キャンセル/.test(p));
    const resEn = banned.en.filter((p) => /reserv|book|ordered|cancel/.test(p));
    expect(resJa.length).toBeGreaterThan(3);
    expect(resEn.length).toBeGreaterThan(3);
    for (const [k, v] of Object.entries(ja)) if (!EXEMPT.has(k)) for (const p of resJa) if (hitJa(v, p)) hits.push(`ja ${k}: ${p}`);
    for (const [k, v] of Object.entries(en)) if (!EXEMPT.has(k)) for (const p of resEn) if (hitEn(v, p)) hits.push(`en ${k}: ${p}`);
    expect(hits).toEqual([]);
  });

  it('US-E5-07/AC2 N4 stronger probe: no ja string says 予約 in the past or completed form, no en string says "we reserved/booked"', () => {
    const hits: string[] = [];
    for (const [k, v] of Object.entries(ja)) if (/予約(しました|完了|を受け付け|が完了|を確定)/.test(v)) hits.push(`ja ${k}`);
    for (const [k, v] of Object.entries(en)) if (/\b(we|i|app)\s+(have\s+)?(reserved|booked|ordered)\b|\bbooking confirmed\b|\breservation (is )?(made|done|complete)/i.test(v)) hits.push(`en ${k}`);
    expect(hits).toEqual([]);
  });
});
