import { readFileSync, writeFileSync } from 'node:fs';
const md = readFileSync('design/copy.md', 'utf8').split('\n');
const rows = new Map();
for (const line of md) {
  if (!line.startsWith('| ')) continue;
  const c = line.split("|").map((s) => s.trim());
  if (c.length > 4 && /^[a-zA-Z]+(\.[a-zA-Z0-9]+)+$/.test(c[1])) rows.set(c[1], [c[2], c[3]]);
}
const want = ['common.japanTime', 'fmt.range',
  ...[...rows.keys()].filter((k) => /^(reminder\.|today\.)/.test(k)),
  'settings.reminders','settings.weekly','settings.weekly.value','settings.weekly.day','settings.weekly.hint','settings.dayBefore','settings.dayBefore.hint',
  'settings.time.hour','settings.time.minute','settings.time.group','settings.switch.on','settings.switch.off','settings.webLimit',
  'settings.theme','settings.theme.auto','settings.theme.light','settings.theme.dark','settings.theme.autoHint'];
const q = (s) => "'" + s.split("'").join(String.fromCharCode(92) + "'") + "'";
let ja = readFileSync('src/i18n/ja.ts', 'utf8'), en = readFileSync('src/i18n/en.ts', 'utf8');
const jaOut = [], enOut = [], missing = [];
for (const k of want) {
  const r = rows.get(k);
  if (!r) { missing.push(k); continue; }
  if (ja.includes(`'${k}':`)) continue;
  jaOut.push(`  ${q(k)}: ${q(r[0])},`); enOut.push(`  ${q(k)}: ${q(r[1])},`);
}
ja = ja.replace("} as const;\n\nexport type MessageKey", `  // M4 (added from design/copy.md by key)\n${jaOut.join('\n')}\n} as const;\n\nexport type MessageKey`);
en = en.replace("} satisfies Catalog;", `  // M4 (added from design/copy.md by key)\n${enOut.join('\n')}\n} satisfies Catalog;`);
writeFileSync('src/i18n/ja.ts', ja); writeFileSync('src/i18n/en.ts', en);
console.log('added', jaOut.length, 'missing', missing);
