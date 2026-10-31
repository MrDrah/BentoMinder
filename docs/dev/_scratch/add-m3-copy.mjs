// One-off: appends the M3 copy rows (design/copy.md §11, §12, fmt.minutes, live.recCount) to the catalogs by key.
import { readFileSync, writeFileSync } from 'node:fs';
const md = readFileSync('design/copy.md', 'utf8').split('\n');
const want = /^(rec|recipe|library)\./;
const rows = [];
for (const l of md) {
  const m = /^\| (\S+) \| (.*?) \| (.*?) \| /.exec(l);
  if (!m) continue;
  const [, key, ja, en] = m;
  if (want.test(key) || key === 'fmt.minutes' || key === 'live.recCount') rows.push({ key, ja: ja.trim(), en: en.trim() });
}
const BS = String.fromCharCode(92);
const q = (s) => "'" + s.split(BS).join(BS + BS).split("'").join(BS + "'") + "'";
const skip = new Set(['rec.title', 'rec.lead', 'recipe.plannedFor', 'library.title']);
const extra = [
  // Quantity formats by unit (data contract section 3.7 unit words); the copy sheet has no unit rows (reported).
  ['qty.g', '{n}g', '{n} g'],
  ['qty.ml', '{n}ml', '{n} ml'],
  ['qty.piece', '{n}個', '{n}'],
  ['qty.slice', '{n}枚', '{n, plural, one {# slice} other {# slices}}'],
  ['qty.stick', '{n}本', '{n, plural, one {# stick} other {# sticks}}'],
  ['qty.tbsp', '大さじ{n}', '{n} tbsp'],
  ['qty.tsp', '小さじ{n}', '{n} tsp'],
  ['qty.cup', '{n}カップ', '{n, plural, one {# cup} other {# cups}}'],
  ['qty.sheet', '{n}枚', '{n, plural, one {# sheet} other {# sheets}}'],
  ['qty.to-taste', '適量', 'to taste'],
  ['qty.small-amount', '少々', 'a little'],
];
let jaOut = '\n  // M3 (added from design/copy.md by key; qty.* from data contract section 3.7)\n';
let enOut = jaOut;
for (const r of rows) {
  if (skip.has(r.key)) continue;
  jaOut += `  ${q(r.key)}: ${q(r.ja)},\n`;
  enOut += `  ${q(r.key)}: ${q(r.en)},\n`;
}
for (const [k, j, e] of extra) {
  jaOut += `  ${q(k)}: ${q(j)},\n`;
  enOut += `  ${q(k)}: ${q(e)},\n`;
}
const patch = (file, marker, add) => {
  const s = readFileSync(file, 'utf8');
  const i = s.lastIndexOf(marker);
  writeFileSync(file, s.slice(0, i) + add.replace(/^\n/, '') + s.slice(i));
};
patch('src/i18n/ja.ts', '} as const;', jaOut);
patch('src/i18n/en.ts', '} satisfies Catalog;', enOut);
console.log(rows.length, 'rows');
