// One-off authoring aid for FX-08 (QA scratch). Writes tests/fixtures/menus/fixture-review-hostile/review-data.json.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const dir = 'C:/Projects/BentoMinder/tests/fixtures/menus/fixture-review-hostile';
const OK = { status: 'ok' };
const cp = (s) => [...s].length;
const name40 = 'とってもながいなまえのとくべつなおりょうりですよとってもながいなまえのとくべつな';
const name40b = name40.slice(0, 40);
const name41 = name40b + 'す';
if (cp(name40b) !== 40 || cp(name41) !== 41) throw new Error('length');
const ing30 = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ';
if (cp(ing30) !== 30) throw new Error('ing30 ' + cp(ing30));
const item = (text, kind = 'main') => ({ text, kind, verification: { ...OK } });
const noAlg = { status: 'not-declared', allergenIds: [], rawText: null, verification: { ...OK } };
const WD = ['日','月','火','水','木','金','土'];
const day = (d, items, extra = {}) => {
  const date = `2026-11-${String(d).padStart(2, '0')}`;
  const w = WD[new Date(Date.UTC(2026, 10, d)).getUTCDay()];
  return { date, printedDateText: `${d}日（${w}）`, printedWeekday: w, items, ingredientsStatus: 'not-listed', allergenDeclaration: noAlg, notes: [], verification: { ...OK }, ...extra };
};
const sha = createHash('sha256').update('synthetic:fixture-review-hostile').digest('hex');
const twelve = ['ごはん','みそ汁','からあげ','たまごやき','サラダ','ゼリー','りんご','みかん','バナナ','牛乳','のり','つけもの'].map((t) => item(t, 'unknown'));
const menu = {
  id: `ext-2026-11-${sha.slice(0, 8)}`,
  contract: 'extracted-menu/1',
  targetMonth: '2026-11',
  detectedMonth: '2026-11',
  source: { kind: 'fixture', filename: 'menu.pdf', sha256: sha, byteSize: 1, fetchedAt: '2026-10-28T10:00:00+09:00', model: 'gemini-3.8-flash', promptVersion: 1 },
  days: [
    day(2, [item('<script>alert(1)</script>'), item('"><img src=x onerror=alert(1)>', 'side')]),
    day(4, [item('🍙🍱', 'staple'), item(name40b)]),
    day(5, [item('から\u200Bあげ'), item('\u202Eあいう\u202C', 'side'), item('ｶﾚｰﾗｲｽ')]),
    day(6, twelve),
    day(9, [item('{{constructor.constructor("x")()}}'), item('${alert(1)}', 'side'), item('&lt;b&gt;太字&lt;/b&gt;', 'soup')], {
      ingredientsStatus: 'listed',
      ingredients: [{ text: ing30, foodGroup: null, verification: { ...OK } }, { text: '<b>bold</b>', foodGroup: 'red', verification: { ...OK } }],
      notes: ['<a href="javascript:alert(1)">リンク</a>'],
    }),
  ],
  noLunchDays: [{ date: '2026-11-20', reason: 'unknown', originalText: '<iframe src="https://example.test"></iframe>', verification: { ...OK } }],
  outOfMonthDays: [],
  warnings: [],
  extractedAt: '2026-10-28T10:00:14+09:00',
};
const doc = {
  synthetic: true,
  fixtureId: 'fixture-review-hostile',
  fixture: 'FX-08',
  hardFields: [],
  menu,
  expectOnReview: 'every string is rendered literally as text: no script runs, no element or attribute is injected, no request is made to example.test; layout does not break (long names wrap or truncate with the full text available)',
  typedInputCases: [
    { id: 'TI-01', field: 'dish name', input: name40b, codePoints: 40, expected: 'accepted (US-E3-02/AC4)' },
    { id: 'TI-02', field: 'dish name', input: name41, codePoints: 41, expected: '「料理名は1〜40文字で入力してください」 shown; confirm disabled (US-E3-02/AC4)' },
    { id: 'TI-03', field: 'dish name', input: '   ', codePoints: 3, expected: 'same error as TI-02 (only whitespace, US-E3-02/AC4)' },
    { id: 'TI-04', field: 'dish name', input: '\u3000\u3000', codePoints: 2, expected: 'same error as TI-02 (only ideographic spaces)' },
    { id: 'TI-05', field: 'dish name', input: '  からあげ  ', codePoints: 8, expected: 'accepted and stored trimmed as 「からあげ」 (contract string-untrimmed)' },
    { id: 'TI-06', field: 'dish name', input: '<script>alert(1)</script>', codePoints: 25, expected: 'accepted and shown literally; no script runs' },
    { id: 'TI-07', field: 'dish name', input: '🍙'.repeat(40), codePoints: 40, expected: 'accepted (40 code points, 80 UTF-16 units)' },
    { id: 'TI-08', field: 'dish name', input: '🍙'.repeat(41), codePoints: 41, expected: 'rejected as TI-02' },
    { id: 'TI-09', field: 'add dish', input: 'day 2026-11-06 (12 items)', expected: '「料理を追加」 disabled with the hint 「1日12品まで」 (US-E3-02/AC5)' },
  ],
};
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/review-data.json`, JSON.stringify(doc, null, 2) + '\n');
console.log('ok');
