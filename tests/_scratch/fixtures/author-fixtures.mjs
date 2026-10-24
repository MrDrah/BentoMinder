#!/usr/bin/env node
// One-off authoring aid (QA scratch, M1 prep 2026-10-24). Writes the first version of every
// synthetic menu fixture under tests/fixtures/menus/<id>/: answer-key.json, recorded/*.json,
// layout.html and README.md, from the compact specs below, so the printed layout and the
// answer key start from the same facts. After this first write the fixture files are the
// source of truth and are edited by hand (BA review); do not re-run this over reviewed files.
// Usage: node tests/_scratch/fixtures/author-fixtures.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const menusDir = join(root, 'tests', 'fixtures', 'menus');

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const pad = (n) => String(n).padStart(2, '0');
const wdOf = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const OK = () => ({ status: 'ok' });
const UNC = (reason) => ({ status: 'uncertain', reason });
const KIND = { st: 'staple', mn: 'main', sd: 'side', sp: 'soup', dk: 'drink', ds: 'dessert', sn: 'snack', un: 'unknown' };
const GROUP_JA = { red: 'あか', yellow: 'きいろ', green: 'みどり' };
const SCHOOL = 'テストようちえん（架空）';
const FOOTER = 'テスト用の架空の献立表です。実在の園とは関係ありません。';
const MODEL = 'gemini-3.8-flash';
const clone = (x) => JSON.parse(JSON.stringify(x));
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// ---------------------------------------------------------------- shared dish pool
const POOL = [
  [['肉じゃが', 'mn'], ['ごはん', 'st'], ['みそ汁', 'sp']],
  [['さけのムニエル', 'mn'], ['パン', 'st'], ['コーンスープ', 'sp']],
  [['麻婆豆腐', 'mn'], ['ごはん', 'st'], ['中華スープ', 'sp']],
  [['ミートボール', 'mn'], ['ポテトサラダ', 'sd'], ['パン', 'st']],
  [['豚のしょうが焼き', 'mn'], ['ごはん', 'st'], ['けんちん汁', 'sp']],
  [['ぎょうざ', 'mn'], ['もやしのナムル', 'sd'], ['ごはん', 'st']],
  [['鶏肉のクリーム煮', 'mn'], ['パン', 'st'], ['ブロッコリーのサラダ', 'sd']],
  [['筑前煮', 'mn'], ['ごはん', 'st'], ['すまし汁', 'sp']],
  [['ハヤシライス', 'mn'], ['大根サラダ', 'sd']],
  [['焼き魚', 'mn'], ['ひじきの煮物', 'sd'], ['ごはん', 'st'], ['みそ汁', 'sp']],
  [['春巻き', 'mn'], ['ごはん', 'st'], ['わかめスープ', 'sp']],
  [['鶏のから揚げ', 'mn'], ['ごはん', 'st'], ['小松菜のおひたし', 'sd']],
  [['かき揚げうどん', 'mn'], ['みかん', 'ds']],
  [['ハンバーグ', 'mn'], ['にんじんのグラッセ', 'sd'], ['パン', 'st'], ['野菜スープ', 'sp']],
  [['親子丼', 'mn'], ['すまし汁', 'sp'], ['りんご', 'ds']],
  [['白身魚のフライ', 'mn'], ['ごはん', 'st'], ['きんぴらごぼう', 'sd']],
  [['ちゃんぽん', 'mn'], ['バナナ', 'ds']],
  [['鶏の照り焼き', 'mn'], ['ごはん', 'st'], ['かぼちゃの煮物', 'sd'], ['みそ汁', 'sp']],
  [['スパゲッティミートソース', 'mn'], ['コールスロー', 'sd'], ['ヨーグルト', 'ds']],
  [['ちらしずし', 'mn'], ['すまし汁', 'sp'], ['いちご', 'ds']],
];
const SNACKS = ['クッキー', 'ふかしいも', 'せんべい', 'ビスケット', '蒸しパン', 'おにぎり', 'ゼリー'];

/** Weekdays of a month (Mon–Fri), minus the excluded day numbers. */
function weekdays(year, month, exclude = []) {
  const out = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    const w = wdOf(`${year}-${pad(month)}-${pad(d)}`);
    if (w >= 1 && w <= 5 && !exclude.includes(d)) out.push(d);
  }
  return out;
}
const poolDays = (days, offset, extra = () => ({})) =>
  days.map((d, i) => ({ d, items: POOL[(i + offset) % POOL.length], ...extra(d, i) }));

// ---------------------------------------------------------------- styles (printed date form)
const STYLES = {
  rows: { dateText: (d, w) => `${d}日（${w}）`, printsWeekday: true },
  reiwa: { dateText: (d, w) => `${d}（${w}）`, printsWeekday: true },
  grid: { dateText: (d) => `${d}`, printsWeekday: true }, // weekday = column header (FX-Q4)
  twocol: { dateText: (d) => `${d}`, printsWeekday: false },
};

// ---------------------------------------------------------------- model building
function buildDay(fx, s) {
  const date = `${fx.month}-${pad(s.d)}`;
  const actual = WD[wdOf(date)];
  const style = STYLES[fx.style];
  const printedWd = style.printsWeekday ? (s.printedWd ?? actual) : null;
  const items = (s.items ?? []).map(([text, k]) => ({ text, kind: KIND[k], verification: OK() }));
  if (s.snack) items.push({ text: s.snack, kind: 'snack', verification: OK() });
  const day = {
    date,
    printedDateText: style.dateText(s.d, printedWd ?? actual),
    printedWeekday: printedWd,
    items,
    ingredientsStatus: s.ing ? 'listed' : 'not-listed',
  };
  if (s.ing) {
    day.ingredients = s.ing.flatMap(([group, texts]) =>
      texts.map((text) => ({ text, foodGroup: group, verification: OK() })),
    );
  }
  const a = s.alg;
  if (!a) day.allergenDeclaration = { status: 'not-declared', allergenIds: [], rawText: null, verification: OK() };
  else if (a.unreadable) day.allergenDeclaration = { status: 'unreadable', allergenIds: [], rawText: null, verification: UNC('low-legibility') };
  else if (a.none) day.allergenDeclaration = { status: 'declared-none', allergenIds: [], rawText: a.raw, verification: OK() };
  else day.allergenDeclaration = { status: 'declared', allergenIds: a.ids, rawText: a.raw, verification: OK() };
  day.notes = s.notes ?? [];
  day.verification = printedWd !== null && printedWd !== actual ? UNC('weekday-mismatch') : OK();
  return day;
}

function buildMenu(fx) {
  const sha = createHash('sha256').update(`synthetic:${fx.id}`).digest('hex');
  return {
    id: `ext-${fx.month}-${sha.slice(0, 8)}`,
    contract: 'extracted-menu/1',
    targetMonth: fx.month,
    detectedMonth: fx.detectedMonth,
    source: {
      kind: 'fixture',
      filename: 'menu.pdf',
      sha256: sha,
      byteSize: 1,
      fetchedAt: fx.fetchedAt,
      model: MODEL,
      promptVersion: 1,
    },
    days: fx.days.map((s) => buildDay(fx, s)),
    noLunchDays: (fx.noLunch ?? []).map((n) => ({
      date: `${fx.month}-${pad(n.d)}`,
      reason: n.reason,
      originalText: n.text,
      verification: OK(),
    })),
    outOfMonthDays: fx.outOfMonth ?? [],
    warnings: fx.warnings ?? [],
    extractedAt: fx.extractedAt,
  };
}

/** What the model returns: the menu minus the fields the app sets (ADR 002 §3). */
function modelOutputOf(menu) {
  const { id, source, extractedAt, ...rest } = clone(menu);
  void id; void source; void extractedAt;
  return rest;
}
const dayOf = (out, date) => out.days.find((d) => d.date === date);

// ---------------------------------------------------------------- layouts
const BASE_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: 210mm; height: 297mm; overflow: hidden; display: flex; flex-direction: column; padding: 11mm 12mm 8mm; color: #1f1f1f;
         font-family: "Yu Gothic", "YuGothic", "Meiryo", "BIZ UDGothic", sans-serif; font-weight: 500; font-size: 9pt; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #333; padding-bottom: 2mm; margin-bottom: 3mm; }
  h1 { font-family: "BIZ UDGothic", "Yu Gothic", "Meiryo", sans-serif; font-size: 16pt; margin: 0; letter-spacing: 0.08em; }
  .school { font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #555; padding: 1.2mm 1.5mm; vertical-align: top; line-height: 1.35; }
  th { background: #f1f1f1; font-weight: 700; font-size: 8.5pt; }
  .date { white-space: nowrap; font-weight: 700; }
  .dish + .dish::before { content: "、"; filter: none; }
  .alg { display: block; font-size: 7.5pt; margin-top: 0.6mm; }
  .smudge { filter: blur(0.75px); opacity: 0.7; display: inline-block; }
  .smudge-heavy { filter: blur(2.6px); opacity: 0.6; }
  .nolunch { text-align: center; font-weight: 700; background: #fafafa; }
  .sat .date { color: #555; }
  footer { margin-top: auto; font-size: 7.5pt; text-align: center; border-top: 1px solid #999; padding-top: 1.5mm; }
  .legend { font-size: 7.5pt; margin: 0 0 2mm; }
`;

function page(fx, title, body, extraCss = '') {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<!-- Synthetic test fixture ${fx.id}. Rendered to menu.pdf by tests/fixtures/pdf/generate-menus.mjs. Fonts: installed Windows fonts only. -->
<title>${esc(title)}</title>
<style>${BASE_CSS}${extraCss}</style>
</head>
<body data-fixture="${fx.id}"${fx.landscape ? ' data-orientation="landscape"' : ''}>
${body}
<footer>${FOOTER}</footer>
</body>
</html>
`;
}

const dishCell = (s) =>
  (s.items ?? [])
    .map(([t], i) => `<span class="dish${(s.smudge ?? []).includes(i) ? ' smudge' : ''}">${esc(t)}</span>`)
    .join('');
function algLine(s) {
  if (!s.alg) return '';
  if (s.alg.unreadable) return `<span class="alg smudge-heavy">アレルゲン：卵・乳・小麦</span>`;
  return `<span class="alg">${esc(s.alg.raw)}</span>`;
}
const ingCell = (s, group) => {
  const g = (s.ing ?? []).find(([k]) => k === group);
  return g ? esc(g[1].join('・')) : '';
};

function layoutRows(fx) {
  const kcal = fx.kcal === true;
  const rows = [];
  const all = [...fx.days.map((s) => ({ ...s, type: 'day' })), ...(fx.noLunch ?? []).map((n) => ({ ...n, type: 'nl' }))].sort((a, b) => a.d - b.d);
  for (const r of all) {
    const date = `${fx.month}-${pad(r.d)}`;
    const w = r.printedWd ?? WD[wdOf(date)];
    const dt = STYLES.rows.dateText(r.d, w);
    const cls = wdOf(date) === 6 ? ' class="sat"' : '';
    if (r.type === 'nl') {
      rows.push(`<tr${cls}><td class="date">${dt}</td><td class="nolunch" colspan="${kcal ? 6 : 5}">${esc(r.text)}</td></tr>`);
      continue;
    }
    rows.push(
      `<tr${cls}><td class="date">${dt}</td><td>${dishCell(r)}${algLine(r)}</td>` +
        `<td class="col-red">${ingCell(r, 'red')}</td><td class="col-yellow">${ingCell(r, 'yellow')}</td><td class="col-green">${ingCell(r, 'green')}</td>` +
        `<td>${r.snack ? esc(r.snack) : ''}</td>${kcal ? `<td class="num">${r.kcal ?? ''}</td>` : ''}</tr>`,
    );
  }
  const body = `<header><div><h1>${esc(fx.heading)}</h1></div><div class="school">${SCHOOL}</div></header>
${fx.subheading ? `<p class="legend">${esc(fx.subheading)}</p>` : ''}
<table>
<colgroup><col style="width:15mm"><col style="width:${kcal ? 56 : 66}mm"><col><col><col><col style="width:16mm">${kcal ? '<col style="width:13mm">' : ''}</colgroup>
<thead><tr><th>ひにち</th><th>こんだて</th><th>あか<br>（からだをつくる）</th><th>きいろ<br>（ちからになる）</th><th>みどり<br>（ちょうしをととのえる）</th><th>おやつ</th>${kcal ? '<th>エネルギー<br>（kcal）</th>' : ''}</tr></thead>
<tbody>
${rows.join('\n')}
</tbody>
</table>`;
  return page(fx, fx.heading, body, '.num { text-align: right; } tbody td { font-size: 8.6pt; }');
}

function layoutReiwa(fx) {
  const all = [...fx.days.map((s) => ({ ...s, type: 'day' })), ...(fx.noLunch ?? []).map((n) => ({ ...n, type: 'nl' }))].sort((a, b) => a.d - b.d);
  const rows = all.map((r) => {
    const date = `${fx.month}-${pad(r.d)}`;
    const dt = STYLES.reiwa.dateText(r.d, WD[wdOf(date)]);
    if (r.type === 'nl') return `<tr><td class="date">${dt}</td><td class="nolunch" colspan="2">${esc(r.text)}</td></tr>`;
    return `<tr><td class="date">${dt}</td><td>${(r.items ?? []).map(([t]) => esc(t)).join('、')}</td><td>${esc((r.notes ?? []).join('・'))}</td></tr>`;
  });
  const body = `<header><div><h1>${esc(fx.heading)}</h1></div><div class="school">${SCHOOL}</div></header>
<table>
<colgroup><col style="width:20mm"><col><col style="width:30mm"></colgroup>
<thead><tr><th>ひ</th><th>きゅうしょく</th><th>ぎょうじ</th></tr></thead>
<tbody>
${rows.join('\n')}
</tbody>
</table>`;
  return page(fx, fx.heading, body, 'tbody td { font-size: 9.5pt; padding: 1.6mm 2mm; }');
}

function layoutGrid(fx) {
  // Week rows Mon–Fri, starting with the week that contains the 1st.
  const [y, m] = fx.month.split('-').map(Number);
  const byDay = new Map(fx.days.map((s) => [s.d, { ...s, type: 'day' }]));
  for (const n of fx.noLunch ?? []) if (!n.band) byDay.set(n.d, { ...n, type: 'nl' });
  const bandDays = new Set((fx.noLunch ?? []).filter((n) => n.band).map((n) => n.d));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = new Date(Date.UTC(y, m - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7; // days back to Monday
  const rows = [];
  let bandPrinted = false;
  for (let start = 1 - mondayOffset; start <= last; start += 7) {
    const cells = [];
    let wd = 0;
    while (wd < 5) {
      const d = start + wd;
      if (bandDays.has(d)) {
        let span = 0;
        const nums = [];
        while (wd + span < 5) {
          const dd = start + wd + span;
          nums.push(dd <= last ? `${dd}` : `${dd - last}`);
          span++;
        }
        const text = bandPrinted ? '（冬休み）' : esc(fx.bandText);
        bandPrinted = true;
        cells.push(`<td class="band" colspan="${span}"><span class="nums">${nums.join('　')}</span><span class="bandtext">${text}</span></td>`);
        wd += span;
        continue;
      }
      if (d < 1 || d > last) {
        cells.push('<td class="empty"></td>');
      } else {
        const r = byDay.get(d);
        if (!r) cells.push(`<td><span class="num">${d}</span></td>`);
        else if (r.type === 'nl') cells.push(`<td class="nl"><span class="num">${d}</span><span class="nltext">${esc(r.text)}</span></td>`);
        else {
          cells.push(
            `<td><span class="num">${d}</span>${(r.items ?? []).map(([t]) => `<span class="dish">${esc(t)}</span>`).join('')}` +
              `${r.snack ? `<span class="snack">おやつ：${esc(r.snack)}</span>` : ''}${(r.notes ?? []).map((n) => `<span class="note">★${esc(n)}</span>`).join('')}</td>`,
          );
        }
      }
      wd++;
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
  }
  const body = `<header><div><h1>${esc(fx.heading)}</h1></div><div class="school">${SCHOOL}</div></header>
<p class="legend">${esc(fx.subheading)}</p>
<table class="grid">
<thead><tr>${['月', '火', '水', '木', '金'].map((w) => `<th>${w}</th>`).join('')}</tr></thead>
<tbody>
${rows.join('\n')}
</tbody>
</table>`;
  const css = `
  .grid td { height: 39mm; font-size: 8.4pt; }
  .grid .dish { display: block; }
  .grid .dish + .dish::before { content: none; }
  .num { display: block; font-size: 12pt; font-weight: 700; margin-bottom: 0.8mm; }
  .snack { display: block; margin-top: 0.8mm; font-size: 7.8pt; }
  .note { display: block; font-size: 6.8pt; color: #333; margin-top: 0.6mm; }
  .nl .nltext { display: block; font-weight: 700; margin-top: 3mm; }
  .empty { background: repeating-linear-gradient(45deg, #fff, #fff 3px, #eee 3px, #eee 6px); }
  .band { background: #eef3f8; vertical-align: middle; text-align: center; }
  .band .nums { display: block; text-align: left; font-weight: 700; font-size: 11pt; letter-spacing: 0.4em; }
  .band .bandtext { display: block; font-size: 11pt; font-weight: 700; margin-top: 4mm; }`;
  return page(fx, fx.heading, body, css);
}

function layoutTwocol(fx) {
  const byDay = new Map(fx.days.map((s) => [s.d, { ...s, type: 'day' }]));
  for (const n of fx.noLunch ?? []) byDay.set(n.d, { ...n, type: 'nl' });
  const block = (weeks) =>
    `<table class="blk"><colgroup><col style="width:9mm"><col><col style="width:24mm"></colgroup>
<thead><tr><th></th><th>こんだて</th><th>デザート</th></tr></thead><tbody>
${weeks
  .map((wk) => {
    const head = `<tr class="wk"><td colspan="3">${esc(wk.label)}</td></tr>`;
    const rows = wk.days.map((d, i) => {
      const merged = wk.mergedDessert ? (i === 0 ? `<td class="merged" rowspan="${wk.days.length}">${esc(wk.mergedDessert)}</td>` : '') : '<td></td>';
      if (wk.blank?.includes(d)) return `<tr><td class="date">${d}</td><td class="blankband" colspan="${wk.mergedDessert && i !== 0 ? 1 : 2}"></td>${wk.mergedDessert && i === 0 ? merged : ''}</tr>`;
      const r = byDay.get(d);
      if (r.type === 'nl') return `<tr><td class="date">${d}</td><td class="nolunch">${esc(r.text)}</td>${merged}</tr>`;
      const dishes = (r.items ?? []).filter(([, k]) => !(wk.mergedDessert && k === 'ds'));
      return `<tr><td class="date">${d}</td><td>${dishes.map(([t]) => esc(t)).join('、')}</td>${merged}</tr>`;
    });
    return head + rows.join('\n');
  })
  .join('\n')}
</tbody></table>`;
  const body = `<header><div><h1>${esc(fx.heading)}</h1></div><div class="school">${SCHOOL}</div></header>
<div class="cols"><div>${block(fx.blocks[0])}</div><div>${block(fx.blocks[1])}</div></div>`;
  const css = `
  @page { size: A4 landscape; margin: 0; }
  body { width: 297mm; height: 210mm; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .blk td { font-size: 9pt; height: 8.5mm; }
  .blk .date { text-align: center; font-size: 8pt; color: #333; }
  .wk td { background: #f1f1f1; font-weight: 700; font-size: 8pt; height: auto; }
  .merged { vertical-align: middle; text-align: center; font-weight: 700; background: #fff8ec; }
  .blankband { background: #e9e9e9; }`;
  return page(fx, fx.heading, body, css);
}

const LAYOUTS = { rows: layoutRows, reiwa: layoutReiwa, grid: layoutGrid, twocol: layoutTwocol };

// ---------------------------------------------------------------- FX-01 (journey fixture)
const FX01_DAYS = [
  { d: 2, items: [['鶏のから揚げ', 'mn'], ['ごはん', 'st'], ['わかめスープ', 'sp'], ['みかん', 'ds']] },
  { d: 4, items: [['ピーマンとなすのみそ炒め', 'mn'], ['ごはん', 'st'], ['すまし汁', 'sp']], ing: [['red', ['豚肉', 'みそ']], ['yellow', ['米', '油']], ['green', ['ピーマン', 'なす', 'たまねぎ']]] },
  {
    d: 5,
    items: [['さばのみそ煮', 'mn'], ['ごはん', 'st'], ['ほうれん草のおひたし', 'sd'], ['牛乳', 'dk']],
    smudge: [0],
    ing: [['red', ['さば', 'みそ', '牛乳']], ['yellow', ['米', '砂糖']], ['green', ['ほうれん草', 'しょうが']]],
    alg: { raw: 'アレルゲン：卵・小麦', ids: ['alg-egg', 'alg-wheat'] },
  },
  { d: 6, items: [['カレー', 'mn'], ['コールスロー', 'sd'], ['ヨーグルト', 'ds']] },
  { d: 9, items: [['卵焼き', 'sd'], ['おにぎり', 'st'], ['豚汁', 'sp']], snack: 'せんべい' },
  { d: 10, items: [['八宝菜', 'mn'], ['ごはん', 'st'], ['中華スープ', 'sp']] },
  { d: 11, items: [['ハンバーグ', 'mn'], ['ポテトサラダ', 'sd'], ['コーンスープ', 'sp'], ['ごはん', 'st']] },
  { d: 12, items: [['白身魚のフライ', 'mn'], ['ごはん', 'st'], ['みそ汁', 'sp'], ['りんご', 'ds']] },
  { d: 13, items: [['ナポリタン', 'mn'], ['ブロッコリーのサラダ', 'sd'], ['ゼリー', 'ds']] },
  { d: 14, items: [], snack: 'せんべい' },
  { d: 16, items: [['親子丼', 'mn'], ['すまし汁', 'sp'], ['バナナ', 'ds']], ing: [['red', ['鶏肉', '卵']], ['yellow', ['米', '砂糖']], ['green', ['たまねぎ', 'みつば']]] },
  { d: 17, items: [['さけのしおやき', 'mn'], ['切り干し大根の煮物', 'sd'], ['みそ汁', 'sp']] },
  { d: 18, items: [['タンドリーチキン', 'mn'], ['ナン', 'st'], ['ミネストローネ', 'sp']] },
  { d: 19, items: [['かぼちゃの煮物', 'sd'], ['鶏の照り焼き', 'mn'], ['ごはん', 'st']] },
  { d: 24, items: [['焼きそば', 'mn'], ['なすの揚げびたし', 'sd'], ['オレンジ', 'ds']] },
  { d: 25, items: [['アジフライ', 'mn'], ['ごはん', 'st'], ['野菜スープ', 'sp']] },
  { d: 26, items: [['マカロニグラタン', 'mn'], ['コーンスープ', 'sp'], ['りんご', 'ds']] },
  { d: 30, items: [['カレーライス', 'mn'], ['たまごサラダ', 'sd'], ['牛乳', 'dk']] },
];
const FX01_NL = [
  { d: 20, reason: 'bento-day', text: 'お弁当の日' },
  { d: 27, reason: 'no-lunch', text: '午前保育（給食なし）' },
];
const FX01_BASE = {
  month: '2026-11',
  detectedMonth: '2026-11',
  style: 'rows',
  heading: '令和8年11月　こんだてひょう（2026年11月）',
  fetchedAt: '2026-10-28T10:00:00+09:00',
  extractedAt: '2026-10-28T10:00:14+09:00',
};
/** The journey stand-in's three uncertain fields (US-E3-01/AC2, US-E3-02/AC1). */
function fx01Uncertain(out) {
  const d5 = dayOf(out, '2026-11-05');
  if (d5?.items[0]?.text === 'さばのみそ煮') d5.items[0] = { ...d5.items[0], text: 'さばのみそに', verification: UNC('low-legibility') };
  const d18 = dayOf(out, '2026-11-18');
  if (d18) d18.items[2].verification = UNC('low-legibility');
  const d25 = dayOf(out, '2026-11-25');
  if (d25) d25.items[0].verification = UNC('low-legibility');
  return out;
}
const FX01_DIFFS = ['days[2026-11-05].items[0]', 'days[2026-11-18].items[2].verification', 'days[2026-11-25].items[0].verification'];

const fixtures = [];

fixtures.push({
  ...FX01_BASE,
  id: 'fixture-menu-2026-11',
  fxNo: 'FX-01',
  title: 'standard month (the journey fixture)',
  days: FX01_DAYS,
  noLunch: FX01_NL,
  hardFields: ['days[2026-11-05].items[0].text'],
  tests: [
    'Date mapping from 「4日（水）」-style rows; 文化の日 (11-03) and 勤労感謝の日 (11-23) have no row and must not appear.',
    'Dish texts and kinds; standalone 「カレー」 (11-06); snack-only Saturday 11-14 (US-E4-01/AC10, OQ-07).',
    '三色食品群 ingredient columns on 11-04, 11-05, 11-16 (`listed`, `foodGroup` set); every other day `not-listed` (BR-11), incl. 11-10.',
    'Allergen line only on 11-05 (`declared` [alg-egg, alg-wheat]); every other day `not-declared`, never `declared-none` (BR-08).',
    'No-lunch days: 11-20 `bento-day` 「お弁当の日」, 11-27 `no-lunch` 「午前保育（給食なし）」.',
    'Hard field: 11-05 item 0 is printed smudged (CSS blur) and must come back `uncertain`.',
    "The sample child's whole month for the assessment oracle: 7 likely, 5 low, 5 mixed, 2 no-lunch (US-E5-04/AC1).",
  ],
  stories: 'US-E0-01, US-E2-04/AC1–AC6, US-E3-01/AC2, US-E3-02/AC1, US-E4-01/AC10, US-E5-04/AC1, contract §5',
  recorded: [
    {
      name: 'hand-1',
      scenario: 'ok',
      describe: 'Journey stand-in (RX-ok): the answer key with 3 uncertain fields; 11-05 item 0 misread as 「さばのみそに」.',
      mutate: fx01Uncertain,
      expect: { strictSchemaValid: true, extractResult: 'ok', differsFromAnswerKeyAt: FX01_DIFFS, flagsHardFields: true },
    },
    {
      name: 'hand-malformed',
      scenario: 'malformed',
      describe: 'RX-malformed: call 1 returns text that is not JSON (truncated, wrapped in a code fence).',
      rawText: '```json\n{"contract": "extracted-menu/1", "targetMonth": "2026-11", "detectedMonth": "2026-11", "days": [{"date": "2026-11-02", "printedDateText": "2日（月）", "items": [{"text": "鶏のから揚げ", "kind": "main"',
      expect: { jsonParses: false, extractResult: 'repair retry (call 2); MALFORMED_OUTPUT if call 2 is also invalid (US-E2-05/AC1, AC2)' },
    },
    {
      name: 'hand-schema-invalid',
      scenario: 'schema-invalid',
      describe: 'RX-schema-invalid: valid JSON without the required `days` field.',
      mutate: (out) => {
        delete out.days;
        return out;
      },
      expect: { strictSchemaValid: false, extractResult: 'repair retry (call 2); MALFORMED_OUTPUT if call 2 is also invalid (US-E2-05/AC2)' },
    },
    {
      name: 'hand-out-of-month',
      scenario: 'out-of-month',
      describe: 'RX-out-of-month: the hand-1 output plus a lunch day 2026-12-01 in `days`.',
      mutate: (out) => {
        fx01Uncertain(out);
        out.days.push(buildDay({ ...FX01_BASE, month: '2026-12', style: 'rows' }, { d: 1, items: [['肉じゃが', 'mn'], ['ごはん', 'st']] }));
        return out;
      },
      expect: {
        strictSchemaValid: false,
        strictSchemaRules: ['extracted-day-outside-month'],
        extractResult: 'ok',
        afterValidation: '2026-12-01 moved to outOfMonthDays as { kind: "lunch-day" }; listed on review under 「対象月以外の日付（取り込みません）」, not imported (US-E2-05/AC4)',
      },
    },
    {
      name: 'hand-duplicate',
      scenario: 'duplicate-date',
      describe: 'RX-duplicate: the hand-1 output with a second 2026-11-05 entry (the 牛乳 printed on its own line read as another day).',
      mutate: (out) => {
        fx01Uncertain(out);
        const i = out.days.findIndex((d) => d.date === '2026-11-05');
        const dup = clone(out.days[i]);
        dup.items = [{ text: '牛乳', kind: 'drink', verification: OK() }];
        delete dup.ingredients;
        dup.ingredientsStatus = 'not-listed';
        dup.allergenDeclaration = { status: 'not-declared', allergenIds: [], rawText: null, verification: OK() };
        out.days.splice(i + 1, 0, dup);
        return out;
      },
      expect: {
        strictSchemaValid: false,
        strictSchemaRules: ['days-unique-sorted'],
        extractResult: 'ok',
        afterValidation: 'one 2026-11-05 entry with the items of both (5 items), day verification uncertain / duplicate-date (US-E2-05/AC6)',
      },
    },
    {
      name: 'hand-not-a-menu',
      scenario: 'not-a-menu',
      describe: 'RX-not-a-menu: the model finds no dates at all.',
      mutate: (out) => ({ ...out, detectedMonth: null, days: [], noLunchDays: [], outOfMonthDays: [], warnings: ['layout-unrecognised'] }),
      expect: { strictSchemaValid: true, extractResult: 'NOT_A_MENU (1 call, ADR 002 §5)' },
    },
    {
      name: 'hand-rate-limited',
      scenario: 'rate-limited',
      describe: 'RX-429-retry60: HTTP 429 RESOURCE_EXHAUSTED with Retry-After 60.',
      http: { status: 429, retryAfterSeconds: 60, body: { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded (synthetic test response).' } } },
      expect: { extractResult: 'call 2 = fallback model (waits min(Retry-After, 5 s)); RATE_LIMITED with retryAfterSec 60 if call 2 is also 429 (US-E2-06/AC5, AC6)' },
    },
    {
      name: 'hand-rate-limited-no-retry-after',
      scenario: 'rate-limited',
      describe: 'RX-429: HTTP 429 without a Retry-After header.',
      http: { status: 429, retryAfterSeconds: null, body: { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded (synthetic test response).' } } },
      expect: { extractResult: 'call 2 = fallback model immediately; RATE_LIMITED without retryAfterSec if call 2 is also 429 (US-E2-06/AC5, AC6)' },
    },
  ],
});

fixtures.push({
  ...FX01_BASE,
  id: 'fixture-menu-2026-11-v2',
  fxNo: 'FX-01b',
  title: 'refresh of FX-01 with two changed dates',
  heading: '令和8年11月　こんだてひょう（2026年11月）改訂版',
  fetchedAt: '2026-11-10T19:00:00+09:00',
  extractedAt: '2026-11-10T19:00:11+09:00',
  days: FX01_DAYS.map((s) =>
    s.d === 18 ? { ...s, items: [['鶏のから揚げ', 'mn'], ['ナン', 'st'], ['ミネストローネ', 'sp']] } : s.d === 13 ? { ...s, items: s.items.filter(([t]) => t !== 'ゼリー') } : s,
  ),
  noLunch: FX01_NL,
  hardFields: ['days[2026-11-05].items[0].text'],
  tests: [
    'Refresh (US-E3-05): 11-18 タンドリーチキン → 鶏のから揚げ; 11-13 ゼリー removed; everything else equal to FX-01.',
    'Expected after confirm: `changedDatesSincePrevious` = [2026-11-13, 2026-11-18].',
  ],
  stories: 'US-E3-05',
  recorded: [
    {
      name: 'hand-1',
      scenario: 'ok',
      describe: 'Stand-in: the answer key with the same smudged 11-05 item 0 flagged as in FX-01.',
      mutate: (out) => {
        dayOf(out, '2026-11-05').items[0].verification = UNC('low-legibility');
        return out;
      },
      expect: { strictSchemaValid: true, extractResult: 'ok', differsFromAnswerKeyAt: ['days[2026-11-05].items[0].verification'], flagsHardFields: true },
    },
  ],
});

fixtures.push({
  ...FX01_BASE,
  id: 'fixture-menu-2026-11-v3',
  fxNo: 'FX-01c',
  title: 'refresh conflict: a planned day becomes no-lunch, another is removed',
  heading: '令和8年11月　こんだてひょう（2026年11月）改訂版',
  fetchedAt: '2026-11-03T09:00:00+09:00',
  extractedAt: '2026-11-03T09:00:12+09:00',
  days: FX01_DAYS.filter((s) => s.d !== 4 && s.d !== 11),
  noLunch: [{ d: 4, reason: 'no-lunch', text: '給食なし（行事のため）' }, ...FX01_NL],
  hardFields: ['days[2026-11-05].items[0].text'],
  tests: [
    'Refresh conflicts (US-E3-05/AC2): 11-04 becomes 「給食なし（行事のため）」 (`no-lunch`); the 11-11 row is removed.',
    'Decision oracle S10/T42/T47, assessment oracle A57, reminder oracle RM38/RM39.',
  ],
  stories: 'US-E3-05/AC2, AC9, AC11, AC12',
  recorded: [
    {
      name: 'hand-1',
      scenario: 'ok',
      describe: 'Stand-in: the answer key with the smudged 11-05 item 0 flagged.',
      mutate: (out) => {
        dayOf(out, '2026-11-05').items[0].verification = UNC('low-legibility');
        return out;
      },
      expect: { strictSchemaValid: true, extractResult: 'ok', differsFromAnswerKeyAt: ['days[2026-11-05].items[0].verification'], flagsHardFields: true },
    },
  ],
});

fixtures.push({
  ...FX01_BASE,
  id: 'fixture-menu-2026-11-wdmismatch',
  fxNo: 'FX-01d',
  title: 'printed weekday disagrees with the date',
  days: FX01_DAYS.map((s) => (s.d === 4 ? { ...s, printedWd: '木' } : s)),
  noLunch: FX01_NL,
  hardFields: ['days[2026-11-04].verification', 'days[2026-11-05].items[0].text'],
  tests: [
    '11-04 is printed 「4日（木）」 (2026-11-04 is a Wednesday): `printedWeekday` 木, day verification `uncertain / weekday-mismatch`, never silently fixed (US-E2-05/AC5).',
  ],
  stories: 'US-E2-05/AC5',
  recorded: [
    {
      name: 'hand-1',
      scenario: 'ok',
      describe: 'Stand-in: the model itself flags the mismatch (and the smudged 11-05 item 0).',
      mutate: (out) => {
        dayOf(out, '2026-11-05').items[0].verification = UNC('low-legibility');
        return out;
      },
      expect: { strictSchemaValid: true, extractResult: 'ok', differsFromAnswerKeyAt: ['days[2026-11-05].items[0].verification'], flagsHardFields: true },
    },
    {
      name: 'hand-unflagged',
      scenario: 'weekday-mismatch-unflagged',
      describe: 'The model copies 木 but leaves the day `ok`: the domain check must flag it (ADR 002 §4 layer 3).',
      mutate: (out) => {
        dayOf(out, '2026-11-04').verification = OK();
        dayOf(out, '2026-11-05').items[0].verification = UNC('low-legibility');
        return out;
      },
      expect: {
        strictSchemaValid: false,
        strictSchemaRules: ['weekday-mismatch'],
        extractResult: 'ok',
        afterValidation: '2026-11-04 verification uncertain / weekday-mismatch (domain check, not a malformed result)',
      },
    },
  ],
});

// ---------------------------------------------------------------- FX-02 December grid
{
  const lunch = [1, 2, 3, 4, 7, 8, 9, 10, 14, 15, 16, 17, 18, 21, 22];
  const days = lunch.map((d, i) => {
    if (d === 18) return { d, items: [['鶏の照り焼き', 'mn'], ['ピラフ', 'st'], ['コーンスープ', 'sp'], ['ケーキ', 'ds']], snack: 'ゼリー', notes: ['クリスマス会'] };
    return { d, items: POOL[i % POOL.length], snack: SNACKS[i % SNACKS.length] };
  });
  const BAND = '冬休み（12月24日〜1月6日）';
  const closed = [24, 25, 28, 29, 30, 31].map((d) => ({ d, reason: 'closed', text: BAND, band: true }));
  const janClosed = ['2027-01-01', '2027-01-04', '2027-01-05', '2027-01-06'].map((date) => ({
    kind: 'no-lunch-day',
    noLunchDay: { date, reason: 'closed', originalText: BAND, verification: OK() },
  }));
  fixtures.push({
    id: 'fixture-menu-2026-12-events',
    fxNo: 'FX-02',
    title: 'holidays, お弁当の日 and winter break (calendar grid)',
    month: '2026-12',
    detectedMonth: '2026-12',
    style: 'grid',
    heading: '令和8年12月　こんだてひょう（2026年12月）',
    subheading: 'ぎょうじのお知らせは★でしめしています。',
    bandText: BAND,
    fetchedAt: '2026-11-25T20:00:00+09:00',
    extractedAt: '2026-11-25T20:00:13+09:00',
    days,
    noLunch: [{ d: 11, reason: 'bento-day', text: 'お弁当の日' }, { d: 23, reason: 'no-lunch', text: '終業式・午前保育（給食なし）' }, ...closed],
    outOfMonth: janClosed,
    hardFields: [],
    tests: [
      'Grid layout (Mon–Fri columns, one row per week; 11-30 cell hatched): date mapping from day numbers + column header.',
      'Several no-lunch reasons in one month: 12-11 `bento-day`, 12-23 `no-lunch`, winter-break band → `closed` on in-month weekdays 12-24, 12-25, 12-28…12-31 (FX-Q1: weekdays only).',
      'Band continues into January: 2027-01-01, 01-04, 01-05, 01-06 → `outOfMonthDays` as `no-lunch-day` (US-E2-05/AC4; FX-Q3 resolved by contract H1).',
      'Event note: 12-18 `notes` = ["クリスマス会"] printed small with ★. Every lunch day has an おやつ item (kind `snack`).',
      'Next-month prompt (US-E3-06/AC2) and the weekly reminder across 11-30…12-06 (RM24) once confirmed.',
    ],
    stories: 'US-E2-05/AC4, US-E3-01/AC1, US-E3-06/AC2, US-E5-08',
    recorded: [
      {
        name: 'hand-1',
        scenario: 'ok',
        describe: 'Stand-in: identical to the answer key (a perfect read; grid fixtures test mapping, not legibility).',
        expect: { strictSchemaValid: true, extractResult: 'ok', differsFromAnswerKeyAt: [], flagsHardFields: true },
      },
    ],
  });
}

// ---------------------------------------------------------------- FX-03 Reiwa February 2027
{
  const lunch = weekdays(2027, 2, [11, 23]);
  const days = poolDays(lunch, 3, (d) => (d === 3 ? { items: [['いわしのかば焼き', 'mn'], ['ごはん', 'st'], ['けんちん汁', 'sp']], notes: ['節分'] } : {}));
  const base = {
    month: '2027-02',
    detectedMonth: '2027-02',
    style: 'reiwa',
    heading: '令和9年2月　こんだてひょう',
    fetchedAt: '2027-01-27T21:00:00+09:00',
    extractedAt: '2027-01-27T21:00:10+09:00',
  };
  fixtures.push({
    ...base,
    id: 'fixture-menu-2027-02-reiwa',
    fxNo: 'FX-03',
    title: '令和 header only, 28 days',
    days,
    noLunch: [
      { d: 11, reason: 'closed', text: '建国記念の日 おやすみ' },
      { d: 23, reason: 'closed', text: '天皇誕生日 おやすみ' },
    ],
    hardFields: [],
    tests: [
      'Reiwa → Gregorian: the header is only 「令和9年2月 こんだてひょう」 (no Gregorian year) → `detectedMonth` 2027-02.',
      'Dates printed 「1（月）」 without the month; holiday rows printed 「おやすみ」 → `closed` (2-11, 2-23); 2-03 note 「節分」.',
      'February length (28 days): lunch days = all weekdays 2-01…2-26 except 2-11 and 2-23 (18 days).',
      'Variants as recorded outputs: FX-03b (2027-02-29 → `date-invalid`, malformed; US-E2-05/AC3), FX-03c (wrong era → `detectedMonth` 2026-02 → `month-mismatch`), FX-03d (parent chose 2027-03 for this PDF → `month-mismatch`).',
    ],
    stories: 'US-E2-05/AC3, US-E3-01, US-E5-01',
    recorded: [
      {
        name: 'hand-1',
        scenario: 'ok',
        describe: 'Stand-in: identical to the answer key.',
        expect: { strictSchemaValid: true, extractResult: 'ok', differsFromAnswerKeyAt: [], flagsHardFields: true },
      },
      {
        name: 'hand-leap-invalid',
        scenario: 'impossible-date',
        describe: 'FX-03b / RX-leap-invalid: the model adds a lunch day dated 2027-02-29.',
        mutate: (out) => {
          const extra = clone(out.days[out.days.length - 1]);
          extra.date = '2027-02-29';
          extra.printedDateText = '29（月）';
          extra.printedWeekday = '月';
          out.days.push(extra);
          return out;
        },
        expect: { strictSchemaValid: false, strictSchemaRules: ['date-invalid'], extractResult: 'malformed: repair retry, then MALFORMED_OUTPUT (US-E2-05/AC3)' },
      },
      {
        name: 'hand-wrong-era',
        scenario: 'month-mismatch',
        describe: 'FX-03c: the model converts 令和9年 to 2026 in `detectedMonth` only; dates are correct.',
        mutate: (out) => ({ ...out, detectedMonth: '2026-02' }),
        expect: {
          strictSchemaValid: true,
          extractResult: 'ok',
          differsFromAnswerKeyAt: ['detectedMonth'],
          afterValidation: 'warning month-mismatch shown on review (detectedMonth 2026-02 ≠ targetMonth 2027-02)',
        },
      },
      {
        name: 'hand-target-2027-03',
        scenario: 'month-mismatch',
        describe: 'FX-03d: the parent chose target month 2027-03 for this February PDF; the model reports February dates.',
        mutate: (out) => ({ ...out, targetMonth: '2027-03' }),
        expect: {
          strictSchemaValid: false,
          strictSchemaRules: ['extracted-day-outside-month'],
          extractResult: 'ok',
          afterValidation: 'every day and no-lunch day moved to outOfMonthDays; warning month-mismatch (detectedMonth 2027-02 ≠ targetMonth 2027-03)',
        },
      },
    ],
  });
}

// ---------------------------------------------------------------- FX-04 leap February 2028
{
  const lunch = weekdays(2028, 2, [11, 23]);
  const days = poolDays(lunch, 7, (d) =>
    d === 29 ? { items: [['ハンバーグ', 'mn'], ['ごはん', 'st'], ['野菜スープ', 'sp']], ing: [['red', ['ぶた肉', '牛肉']], ['yellow', ['米', 'パン粉']], ['green', ['たまねぎ', 'にんじん']]] } : {},
  );
  fixtures.push({
    id: 'fixture-menu-2028-02-leap',
    fxNo: 'FX-04',
    title: 'leap February',
    month: '2028-02',
    detectedMonth: '2028-02',
    style: 'rows',
    heading: '令和10年2月　こんだてひょう（2028年2月）',
    fetchedAt: '2028-01-26T20:00:00+09:00',
    extractedAt: '2028-01-26T20:00:12+09:00',
    days,
    noLunch: [],
    hardFields: [],
    tests: [
      '29-day February: 2028-02-29 (火) has a lunch row with a listed ingredient block; 2-11 (金, 建国記念の日) and 2-23 (水, 天皇誕生日) have no rows.',
      '2-29 mapping (US-E5-01/AC6); day-before reminders on 2-28 and 2-29 (US-E7-02/AC4, RM10).',
    ],
    stories: 'US-E5-01/AC6, US-E7-02/AC4',
    recorded: [
      {
        name: 'hand-1',
        scenario: 'ok',
        describe: 'Stand-in: identical to the answer key.',
        expect: { strictSchemaValid: true, extractResult: 'ok', differsFromAnswerKeyAt: [], flagsHardFields: true },
      },
    ],
  });
}

// ---------------------------------------------------------------- FX-05 two-column January 2027
{
  const lunch = [8, 12, 13, 14, 15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29];
  const days = lunch.map((d, i) => {
    const items = POOL[(i + 11) % POOL.length].filter(([, k]) => k !== 'ds');
    return { d, items: d >= 18 && d <= 22 ? [...items, ['りんご', 'ds']] : items };
  });
  const base = {
    month: '2027-01',
    detectedMonth: '2027-01',
    style: 'twocol',
    landscape: true,
    heading: '1月　きゅうしょくこんだて（2027年1月）',
    fetchedAt: '2026-12-22T20:00:00+09:00',
    extractedAt: '2026-12-22T20:00:15+09:00',
  };
  fixtures.push({
    ...base,
    id: 'fixture-menu-2027-01-twocol',
    fxNo: 'FX-05',
    title: 'tricky layout: two week-blocks per column, merged cells',
    days,
    noLunch: [{ d: 7, reason: 'no-lunch', text: '始業式・午前保育（給食なし）' }],
    blocks: [
      [
        { label: 'だい2しゅう', days: [11, 12, 13, 14, 15], blank: [11] },
        { label: 'だい3しゅう', days: [18, 19, 20, 21, 22], mergedDessert: '今週のデザート：りんご' },
      ],
      [
        { label: 'だい4しゅう', days: [25, 26, 27, 28, 29] },
        { label: 'だい1しゅう', days: [7, 8] },
      ],
    ],
    hardFields: [],
    tests: [
      'Landscape page, two blocks side by side; the right block ends with the first week (reading order ≠ date order). Dates are bare day numbers (`printedWeekday` null).',
      'Merged cell 「今週のデザート：りんご」 spans 1-18…1-22 → item 「りんご」 (`dessert`) on each of those days (FX-Q2: `ok` or `uncertain/other` both accepted by the scorer).',
      '1-11 (成人の日) is a blank shaded band → absent. 1-07 `no-lunch` 「始業式・午前保育（給食なし）」; 1-08 first lunch.',
      'US-E7-02/AC3 (1-29 金 planned). Recorded variants: partial extraction, unrecognised layout, and FX-05b (week mapping swapped; scorer must report < 100%).',
    ],
    stories: 'US-E2-04, US-E7-02/AC3',
    recorded: [
      {
        name: 'hand-1',
        scenario: 'ok',
        describe: 'Stand-in: identical to the answer key.',
        expect: { strictSchemaValid: true, extractResult: 'ok', differsFromAnswerKeyAt: [], flagsHardFields: true },
      },
      {
        name: 'hand-partial',
        scenario: 'partial-extraction',
        describe: 'The model reads only the left block (weeks 2 and 3) and says so.',
        mutate: (out) => ({ ...out, days: out.days.filter((d) => d.date >= '2027-01-11' && d.date <= '2027-01-22'), noLunchDays: [], warnings: ['partial-extraction'] }),
        expect: { strictSchemaValid: true, extractResult: 'ok', afterValidation: 'review shows the partial-extraction warning; 1-07, 1-08 and 1-25…1-29 missing' },
      },
      {
        name: 'hand-layout-unrecognised',
        scenario: 'layout-unrecognised',
        describe: 'The model reads only the first week and reports the layout as unrecognised.',
        mutate: (out) => ({ ...out, days: out.days.filter((d) => d.date === '2027-01-08'), warnings: ['layout-unrecognised', 'partial-extraction'] }),
        expect: { strictSchemaValid: true, extractResult: 'ok', afterValidation: 'review shows both warnings; only 1-07 and 1-08 present' },
      },
      {
        name: 'hand-shifted',
        scenario: 'wrong-date-mapping',
        describe: 'FX-05b: the weeks of 1-18 and 1-25 are swapped (a realistic misreading of the side-by-side blocks). Schema-valid but wrong; for the live-eval scorer only.',
        mutate: (out) => {
          const shift = (date) => {
            const n = Number(date.slice(8));
            if (n >= 18 && n <= 22) return `2027-01-${pad(n + 7)}`;
            if (n >= 25 && n <= 29) return `2027-01-${pad(n - 7)}`;
            return date;
          };
          out.days = out.days.map((d) => ({ ...d, date: shift(d.date), printedDateText: String(Number(shift(d.date).slice(8))) })).sort((a, b) => (a.date < b.date ? -1 : 1));
          return out;
        },
        expect: { strictSchemaValid: true, extractResult: 'ok', scorer: 'date mapping < 100% (10 of 15 lunch days wrong)' },
      },
    ],
  });
}

// ---------------------------------------------------------------- FX-07 allergens March 2027
{
  const lunch = weekdays(2027, 3).filter((d) => d <= 17);
  const ALG = {
    1: { raw: 'アレルゲン：卵・乳・小麦', ids: ['alg-egg', 'alg-milk', 'alg-wheat'] },
    2: { raw: '特定原材料：えび・かに', ids: ['alg-shrimp', 'alg-crab'] },
    3: { none: true, raw: 'アレルゲン：なし' },
    4: { raw: 'アレルゲン：乳成分・大豆', ids: ['alg-milk', 'alg-soybean'] },
    5: { unreadable: true },
    8: null,
  };
  const days = poolDays(lunch, 0, (d, i) => ({
    alg: d in ALG ? ALG[d] ?? undefined : { raw: 'アレルゲン：小麦', ids: ['alg-wheat'] },
    kcal: 480 + ((i * 17) % 90),
  }));
  fixtures.push({
    id: 'fixture-menu-2027-03-allergens',
    fxNo: 'FX-07',
    title: 'allergen line on every day vs none',
    month: '2027-03',
    detectedMonth: '2027-03',
    style: 'rows',
    kcal: true,
    heading: '令和9年3月　こんだてひょう（2027年3月）',
    subheading: 'アレルゲンは、その日のこんだてに使う特定原材料などをしめしています。',
    fetchedAt: '2027-02-24T20:00:00+09:00',
    extractedAt: '2027-02-24T20:00:12+09:00',
    days,
    noLunch: [{ d: 18, reason: 'no-lunch', text: '修了式・午前保育（給食なし）' }],
    hardFields: ['days[2027-03-05].allergenDeclaration'],
    tests: [
      'Every `AllergenDeclaration` status (BR-08, US-E2-04/AC3, US-E4-05): 3-01 declared [egg, milk, wheat]; 3-02 「特定原材料：えび・かに」; 3-03 「アレルゲン：なし」 → `declared-none` with rawText; 3-04 synonym 乳成分 → alg-milk; 3-05 line printed but unreadable → `unreadable` + `uncertain/low-legibility`; 3-08 no line → `not-declared` (never "none"); other days 「アレルゲン：小麦」.',
      'kcal column printed and ignored (no field for it). No national-holiday dates; 3-18 `no-lunch` 「修了式・午前保育（給食なし）」.',
      'Contrast with FX-01, which declares only on 11-05.',
    ],
    stories: 'US-E2-04/AC3, US-E4-05, BR-08',
    recorded: [
      {
        name: 'hand-1',
        scenario: 'ok',
        describe: 'Stand-in: identical to the answer key (3-05 already unreadable / uncertain).',
        expect: { strictSchemaValid: true, extractResult: 'ok', differsFromAnswerKeyAt: [], flagsHardFields: true },
      },
    ],
  });
}

// ---------------------------------------------------------------- FX-06 scan of FX-01
const FX01 = fixtures[0];
const GREEN_PATHS = (menu) =>
  menu.days.flatMap((d) => (d.ingredients ?? []).map((ing, i) => (ing.foodGroup === 'green' ? `days[${d.date}].ingredients[${i}].text` : null)).filter(Boolean));
fixtures.push({
  ...FX01,
  id: 'fixture-menu-2026-11-scan',
  fxNo: 'FX-06',
  title: 'scanned-image style (no text layer)',
  scanOf: 'fixture-menu-2026-11',
  hardFieldsFn: (menu) => ['days[2026-11-05].items[0].text', ...GREEN_PATHS(menu)],
  tests: [
    'The FX-01 page rasterised at 150 dpi, rotated 1.5°, light seeded noise, the みどり (green) ingredient column at reduced contrast, embedded as the only content (no text layer).',
    'Live eval only (accuracy reported, not gated). In the gate only the recorded output is used; the answer key is FX-01 plus `hardFields` for every green-column ingredient.',
  ],
  stories: 'US-E2-04 (live eval)',
  recorded: [
    {
      name: 'hand-1',
      scenario: 'ok',
      describe: 'Stand-in: FX-01 hand-1 plus every green-column ingredient flagged low-legibility.',
      mutate: (out) => {
        fx01Uncertain(out);
        for (const d of out.days) for (const ing of d.ingredients ?? []) if (ing.foodGroup === 'green') ing.verification = UNC('low-legibility');
        return out;
      },
      expectFn: (menu) => ({
        strictSchemaValid: true,
        extractResult: 'ok',
        differsFromAnswerKeyAt: [...FX01_DIFFS, ...GREEN_PATHS(menu).map((p) => p.replace(/\.text$/, '.verification'))],
        flagsHardFields: true,
      }),
    },
  ],
});

// ---------------------------------------------------------------- write
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function scanLayout(fx) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<!-- Synthetic test fixture ${fx.id}: a scanned-looking copy of ../${fx.scanOf}/layout.html.
     generate-menus.mjs screenshots the source page (150 dpi, JPEG), calls composeScan() below and
     prints the result as the only content of menu.pdf (no text layer). -->
<title>scan of ${fx.scanOf}</title>
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  #out { display: block; width: 210mm; height: 297mm; }
  canvas { display: none; }
</style>
</head>
<body data-fixture="${fx.id}" data-scan-of="${fx.scanOf}">
<img id="out" alt="">
<canvas id="c"></canvas>
<script>
  // Scan parameters (edit here, then regenerate).
  const SCAN = { rotateDeg: 1.5, noiseAmplitude: 22, seed: 20261105, lowContrastSelector: '.col-green', lowContrastFactor: 0.35, jpegQuality: 0.72 };
  window.SCAN = SCAN;
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // box: the low-contrast column in source-image pixels { x, y, w, h }.
  window.composeScan = (dataUrl, box) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight;
      const src = document.createElement('canvas'); src.width = W; src.height = H;
      const sctx = src.getContext('2d'); sctx.drawImage(img, 0, 0);
      const data = sctx.getImageData(0, 0, W, H); const p = data.data; const rand = rng(SCAN.seed);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const inBox = box && x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
        const n = (rand() - 0.5) * SCAN.noiseAmplitude;
        for (let c = 0; c < 3; c++) {
          let v = p[i + c];
          if (inBox) v = 255 - (255 - v) * SCAN.lowContrastFactor;
          p[i + c] = Math.max(0, Math.min(255, v + n));
        }
      }
      sctx.putImageData(data, 0, 0);
      const out = document.getElementById('c'); out.width = W; out.height = H;
      const ctx = out.getContext('2d'); ctx.fillStyle = '#f7f6f2'; ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2); ctx.rotate(SCAN.rotateDeg * Math.PI / 180); ctx.drawImage(src, -W / 2, -H / 2);
      const el = document.getElementById('out');
      el.onload = () => resolve(true);
      el.src = out.toDataURL('image/jpeg', SCAN.jpegQuality);
    };
    img.src = dataUrl;
  });
</script>
</body>
</html>
`;
}

function readme(fx, menu, hardFields) {
  const files = ['answer-key.json', 'layout.html', 'menu.pdf (generated)', ...fx.recorded.map((r) => `recorded/${r.name}.json`), 'README.md'];
  return `# ${fx.fxNo} \`${fx.id}\` — ${fx.title}

Synthetic test fixture. School 「${SCHOOL}」; every page prints 「${FOOTER}」. Not a real school's menu.

## What it tests
${fx.tests.map((t) => `- ${t}`).join('\n')}

Stories / rules: ${fx.stories}.

## Expected outline
- \`targetMonth\` ${menu.targetMonth}, \`detectedMonth\` ${menu.detectedMonth}
- \`days\`: ${menu.days.length} (${menu.days.map((d) => d.date.slice(5)).join(', ')})
- \`noLunchDays\`: ${menu.noLunchDays.length ? menu.noLunchDays.map((n) => `${n.date.slice(5)} \`${n.reason}\` 「${n.originalText}」`).join('; ') : 'none'}
- \`outOfMonthDays\`: ${menu.outOfMonthDays.length ? menu.outOfMonthDays.map((e) => `${(e.day ?? e.noLunchDay).date} ${e.kind}`).join(', ') : 'none'}
- \`warnings\`: ${menu.warnings.length ? menu.warnings.join(', ') : 'none'}
- \`hardFields\` (must come back \`uncertain\`): ${hardFields.length ? hardFields.map((h) => `\`${h}\``).join(', ') : 'none'}

## Files
${files.map((f) => `- \`${f}\``).join('\n')}

Recorded stand-ins (\`"recordedBy": "hand"\`, replaced by live recordings at M5):
${fx.recorded.map((r) => `- \`${r.name}\` (${r.scenario}): ${r.describe}`).join('\n')}

Conventions: see \`tests/plan/fixtures-plan.md\` §1 and §7. \`answer-key.json\` → \`menu\` is a valid \`ExtractedMenu\` v1; its \`id\`, \`source\` and \`extractedAt\` are fixed synthetic stand-ins (not the PDF's real hash or size) and are never scored. Recorded files hold the model output (\`ExtractedMenu\` minus \`id\`, \`source\`, \`extractedAt\`, ADR 002 §3) or the HTTP failure.

## Answer-key review (BA)
- pending — reviewer, date, result (answer key checked against \`menu.pdf\`: dates, weekdays, dish texts, no-lunch reasons, allergen lines)
`;
}

for (const fx of fixtures) {
  const dir = join(menusDir, fx.id);
  const menu = buildMenu(fx);
  const hardFields = fx.hardFieldsFn ? fx.hardFieldsFn(menu) : fx.hardFields;
  writeJson(join(dir, 'answer-key.json'), {
    synthetic: true,
    fixtureId: fx.id,
    fixture: fx.fxNo,
    hardFields,
    menu,
  });
  for (const r of fx.recorded) {
    const rec = { synthetic: true, recordedBy: 'hand', fixtureId: fx.id, scenario: r.scenario, description: r.describe, model: MODEL, promptVersion: 1 };
    if (r.http) rec.response = { httpStatus: r.http.status, retryAfterSeconds: r.http.retryAfterSeconds, body: r.http.body };
    else if (r.rawText !== undefined) rec.response = { httpStatus: 200, rawText: r.rawText };
    else rec.response = { httpStatus: 200, modelOutput: (r.mutate ?? ((x) => x))(modelOutputOf(menu)) };
    rec.expect = r.expectFn ? r.expectFn(menu) : r.expect;
    writeJson(join(dir, 'recorded', `${r.name}.json`), rec);
  }
  writeFileSync(join(dir, 'layout.html'), fx.scanOf ? scanLayout(fx) : LAYOUTS[fx.style](fx));
  writeFileSync(join(dir, 'README.md'), readme(fx, menu, hardFields));
  console.log(`${fx.fxNo.padEnd(6)} ${fx.id}: ${menu.days.length} days, ${menu.noLunchDays.length} no-lunch, ${fx.recorded.length} recorded`);
}
