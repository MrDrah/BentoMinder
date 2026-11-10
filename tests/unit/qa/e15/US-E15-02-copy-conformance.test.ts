// QA E15: the shipped ja and en strings equal design/copy.md section 22 row by row (the table is parsed here, not copied), carry the same
// placeholders in both languages, contain no technical words, no legal claim and no code, and the notice has every item (a) to (i) of US-E15-02/AC2.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '../../../../src/i18n/en.ts';
import { ja } from '../../../../src/i18n/ja.ts';

interface Row {
  key: string;
  ja: string;
  en: string;
  line: number;
}
function rows(): Row[] {
  const text = readFileSync('design/copy.md', 'utf8').split('\n');
  const start = text.findIndex((l) => l.startsWith('## 22.'));
  const out: Row[] = [];
  for (let i = start; i < text.length; i++) {
    const l = text[i]!;
    if (i > start && l.startsWith('## ') && !l.startsWith('## 22.')) break;
    const m = /^\| ((?:consent\.cloud|family|sync)\.[A-Za-z0-9_.-]+) \| (.*)$/.exec(l);
    if (m === null) continue;
    const cells = m[2]!.split(' | ');
    out.push({ key: m[1]!, ja: cells[0]!.trim(), en: cells[1]!.trim(), line: i + 1 });
  }
  return out;
}
const unbackslash = (s: string): string => s.replace(/\\\|/g, '|').replace(/<br>/g, '\n').replace(/`/g, '');
const cat = { ja: ja as Record<string, string>, en: en as Record<string, string> };

describe('US-E15-02/AC3 copy section 22 versus the shipped catalogs', () => {
  const table = rows();
  it('the copy table has the 200+ E15 rows and every key exists in both catalogs', () => {
    expect(table.length).toBeGreaterThan(190);
    const missing = table.filter((r) => cat.ja[r.key] === undefined || cat.en[r.key] === undefined).map((r) => r.key);
    expect(missing).toEqual([]);
  });

  it('every ja and en string equals the copy sheet (whitespace-normalised); differences are listed by key and line', () => {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const diffs: string[] = [];
    for (const r of table) {
      for (const lang of ['ja', 'en'] as const) {
        const want = norm(unbackslash(r[lang]));
        const got = norm(cat[lang][r.key] ?? '');
        if (want !== got) diffs.push(`${r.key}/${lang} (copy.md:${r.line})`);
      }
    }
    expect(diffs).toEqual([]);
  });

  it('ja and en carry the same placeholders for each key (BR-23)', () => {
    const ph = (s: string) => [...new Set([...s.matchAll(/\{([A-Za-z]+)[,}]/g)].map((m) => m[1]!).filter((n) => !['yes', 'none', 'one', 'other'].includes(n)))].sort().join(','); // ICU branch words are not variables
    const bad = table.filter((r) => ph(cat.ja[r.key] ?? '') !== ph(cat.en[r.key] ?? '')).map((r) => r.key);
    expect(bad).toEqual([]);
  });

  it('no E15 string shows technical or legal text: no sync/server/Firebase wording outside the notice, no "complies", no uid/code placeholders', () => {
    const all = table.map((r) => ({ key: r.key, ja: cat.ja[r.key] ?? '', en: cat.en[r.key] ?? '' }));
    for (const s of all) {
      const text = `${s.ja}\n${s.en}`;
      expect(text, s.key).not.toMatch(/complies|compliant|APPI に|APPIに準拠|法令に準拠|GDPR/i);
      // the invite message the parent chooses to send carries the code by design
      if (s.key !== 'family.invite.shareText') expect(text, s.key).not.toMatch(/\{(uid|familyId|code)\}/);
      if (!s.key.startsWith('consent.cloud.')) expect(text, s.key).not.toMatch(/\bserver\b|サーバー|uid\b|Firestore|JSON|API\b/i);
    }
    // "sync" / 「同期」 only as the AC-fixed status words (copy section 22 header)
    for (const s of all) {
      const en2 = s.en.replace(/\bsynced\b/gi, '');
      expect(en2, s.key).not.toMatch(/\bsync(ing)?\b/i);
      const ja2 = s.ja.replace(/同期済み|同期中/g, '');
      expect(ja2, s.key).not.toMatch(/同期/);
    }
  });

  it('US-E15-02/AC2 the notice (version 1) covers all of (a) what, (b) why, (c) where, (d) who, (e) operator access, (f) AI separate, (g) how to stop, (h) contact, (i) parent or guardian, in both languages', () => {
    const body = (lang: 'ja' | 'en') => Object.keys(cat[lang]).filter((k) => k.startsWith('consent.cloud.')).map((k) => `${k}=${cat[lang][k]}`).join('\n');
    const j = body('ja');
    const e = body('en');
    for (const [name, jr, er] of [
      ['a what: profile, allergies, menus, plans, settings', /アレルギー/, /allerg/i],
      ['c where: Firebase Firestore Tokyo Japan', /Firestore[\s\S]*東京|東京[\s\S]*Firestore/, /Firestore[\s\S]*Tokyo|Tokyo[\s\S]*Firestore/],
      ['d who: members only, no sale, no advertising', /広告/, /advertis/i],
      ['e operator can technically reach the data and does not use it', /管理(画面|コンソール)|運営/, /operator|console/i],
      ['f AI reading is separate', /AI/, /\bAI\b/],
      ['g how to stop: leave or delete', /抜ける|削除/, /leave|delete/i],
      ['i parent or guardian', /保護者/, /parent or guardian|guardian/i],
    ] as const) {
      expect(j, `ja ${name}`).toMatch(jr);
      expect(e, `en ${name}`).toMatch(er);
    }
    for (const k of ['consent.cloud.what.h', 'consent.cloud.why.h', 'consent.cloud.where.h', 'consent.cloud.who.h']) {
      expect(cat.ja[k], k).toBeTruthy();
      expect(cat.en[k], k).toBeTruthy();
    }
    const heads = Object.keys(cat.ja).filter((k) => /^consent\.cloud\..*\.h$/.test(k));
    expect(heads.length).toBeGreaterThanOrEqual(7); // headed items (a) to (g); (h) contact and (i) parent line stand alone
    expect(Object.keys(cat.ja)).toEqual(expect.arrayContaining(['consent.cloud.contact', 'consent.cloud.parent']));
  });

  it('US-E15-02/AC4 the two buttons are 「同意して進む」 and 「やめる」, none pre-ticked: the strings exist as the AC names them', () => {
    expect(Object.values(cat.ja)).toContain('同意して進む');
    expect(Object.values(cat.ja)).toContain('やめる');
  });

  it('the AC-fixed wording appears verbatim: 同期中, 同期済み, 確認が必要です, 家族のデータを読み込めませんでした, 家族から外されました, 家族のデータが削除されました, 一部のデータを読み込めませんでした, アプリを更新してください, しばらくしてからお試しください, メンバーは上限です, インターネットに接続してください', () => {
    const joined = Object.values(cat.ja).join('\n');
    for (const s of ['同期中', '同期済み', '確認が必要です', '家族のデータを読み込めませんでした', 'もう一度試す', '家族から外されました', '家族のデータが削除されました', '一部のデータを読み込めませんでした', 'アプリを更新してください', 'しばらくしてからお試しください', 'メンバーは上限です', 'インターネットに接続してください', 'すでに別の家族に参加しています', 'データが大きすぎます', '招待コードで参加する', '家族をつくる', '家族を抜ける', 'メンバーを外す', '家族のオンラインデータを削除', '削除する', '今すぐ再試行', '家族のデータを使う', 'この端末のデータを足す', '招待を取り消す', 'すべてのデータを削除']) {
      expect(joined, s).toContain(s);
    }
  });
});
