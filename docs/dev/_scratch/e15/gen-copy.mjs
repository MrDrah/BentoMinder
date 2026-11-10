// One-off: copies the rows of design/copy.md section 22 into src/i18n/ja.ts and en.ts (verbatim).
import { readFileSync, writeFileSync } from 'node:fs';
const md = readFileSync('design/copy.md', 'utf8').split('\n');
const start = md.findIndex((l) => l.startsWith('## 22.'));
const rows = md
  .slice(start)
  .filter((l) => /^\| (consent|family|sync)\./.test(l))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const BS = String.fromCharCode(92);
const q = (s) => "'" + s.split(BS).join(BS + BS).split("'").join(BS + "'") + "'";
for (const [lang, idx] of [['ja', 1], ['en', 2]]) {
  const f = `src/i18n/${lang}.ts`;
  let src = readFileSync(f, 'utf8');
  if (src.includes("'family.section'")) continue;
  const body = ['  // §22 Family sharing, cloud notice, sharing status (E15)', ...rows.map((r) => `  ${q(r[0])}: ${q(r[idx])},`)].join('\n');
  const end = lang === 'ja' ? '} as const;' : '} satisfies Catalog;';
  const at = src.lastIndexOf('\n' + end);
  src = src.slice(0, at) + '\n' + body + src.slice(at);
  writeFileSync(f, src);
}
console.log(rows.length);
