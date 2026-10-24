// One-off M1 helper: copies the rows of design/copy.md whose keys match the M1 screens into
// src/i18n/ja.ts and en.ts verbatim (existing keys keep their values). Not part of the build.
import { readFileSync, writeFileSync } from 'node:fs';

const copy = readFileSync('design/copy.md', 'utf8');
const rows = new Map();
for (const line of copy.split('\n')) {
  const m = /^\| ([a-zA-Z0-9.]+) \| (.*?) \| (.*?) \| .*\|$/.exec(line);
  if (!m || m[1] === 'key') continue;
  // split cells properly (no escaped pipes in the sheet)
  const cells = line.split(' | ');
  const key = cells[0].replace(/^\| /, '');
  if (!rows.has(key)) rows.set(key, { ja: cells[1], en: cells[2] });
}

const WANT = [
  /^common\.(close|cancel|next|save|retry|retryIn|optional|required|selected|error\.generic|newWindow)$/,
  /^ob\./,
  /^profile\./,
  /^allergy\./,
  /^diet\./,
  /^theme\./,
  /^import\./,
  /^consent\./,
  /^review\./,
  /^menuCard\.(import|pending|pending\.action)$/,
  /^settings\.(menu|menu\.url|menu\.urlNone|menu\.import|profile|profile\.edit|profile\.delete|data|data\.where|about|about\.consent|about\.version)$/,
  /^profileEdit\./,
  /^profileDelete\./,
  /^data\./,
  /^storage\.corrupt\.(export|reset|resetTitle|resetBody)$/,
  /^storage\.migrated$/,
  /^toast\.saveFailed$/,
  /^live\.formErrors$/,
];
const SKIP = new Set(['import.err.notConfigured.dev']); // dev-only: debug catalog (copy §0)

const picked = [...rows.entries()].filter(([k]) => WANT.some((r) => r.test(k)) && !SKIP.has(k));

function update(file, lang) {
  const src = readFileSync(file, 'utf8');
  const existing = new Set([...src.matchAll(/^\s+'([^']+)':/gm)].map((m) => m[1]));
  const add = picked.filter(([k]) => !existing.has(k));
  const lit = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const block = `\n  // M1 (seeded verbatim from design/copy.md by key)\n${add.map(([k, v]) => `  '${k}': ${lit(v[lang])},`).join('\n')}\n`;
  const marker = lang === 'ja' ? '} as const;' : '} satisfies Catalog;';
  if (!src.includes(marker)) throw new Error(`marker missing in ${file}`);
  writeFileSync(file, src.replace(marker, `${block}${marker}`));
  console.log(`${file}: +${add.length}`);
}
update('src/i18n/ja.ts', 'ja');
update('src/i18n/en.ts', 'en');
