const fs = require('fs');
const edit = (p, pairs) => {
  let s = fs.readFileSync(p, 'utf8');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(p + ' miss ' + a); s = s.split(a).join(b); }
  fs.writeFileSync(p, s);
};
edit('design/_scratch/preview.src.html', [
  ["r:{ja:'くまさん弁当'", "r:{ja:'くまさん<br>弁当'"],
  ["r:{ja:'ほしのオムレツ'", "r:{ja:'ほしの<br>オムレツ'"],
  ["r:{ja:'ほしのハンバーグ',en:'Star burger'", "r:{ja:'ほし<br>バーグ',en:'Star burger'"],
  ["(lang==='ja'?'お弁当の日':'Bento day')", "(lang==='ja'?'お弁当<br>の日':'Bento day')"],
  ["(lang==='ja'?'給食なし':'No lunch')", "(lang==='ja'?'給食<br>なし':'No lunch')"],
]);
edit('design/a11y-responsive.md', [[
  '| Calendar cell words and recipe short names | `max-inline-size: 4em; line-break: strict; word-break: normal; letter-spacing: 0; text-align: center` | Curated `shortNameJa` ≤ 8 chars sets as 2 lines × 4 (「くまさん / おにぎり」); never mechanical truncation or ellipsis (US-E5-01/AC4) |',
  "| Calendar cell words and recipe short names | Split into at most 2 lines **at a phrase boundary**, each line `white-space: nowrap; letter-spacing: 0; text-align: center`. Split rule: segment with `Intl.Segmenter('ja', { granularity: 'word' })`, take the boundary that keeps both lines ≤ 4 characters and is closest to the middle; if none exists, split after character 4. Fixed cell words are pre-split (給食 / 給食・なし / お弁当・の日 / 未定) | A plain 4 em box breaks mid-word (「ほしのオ / ムレツ」, 「給食な / し」 in the preview screenshot). The BA should curate `shortNameJa` so a natural split exists (「くまさん / おにぎり」, 「ほしの / オムレツ」). Never mechanical truncation or ellipsis (US-E5-01/AC4) |",
]]);
edit('design/components.md', [[
  'decision word or recipe short name, text-xs 700, 2 lines × 4 chars max,\n│ おにぎり  │            word-break: keep-all; line-break: strict; letter-spacing 0',
  'decision word or recipe short name, text-xs 700, ≤ 2 lines × 4 chars,\n│ おにぎり  │            split at a phrase boundary (a11y-responsive.md §9), letter-spacing 0',
]]);
console.log('ok');
