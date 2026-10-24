// Checks every ja/en value in design/copy.md against data/banned-phrases.json
// (US-E6-03/AC2 matching: NFKC + case-fold; ja substring; en whole words / word sequences),
// plus assessment-only words (US-E4-04/AC1) and background-notification / sync claims (US-E7-06/AC2, US-E9-02/AC2).
// node design/_scratch/check-copy.mjs [file]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = process.argv[2] ?? join(root, 'design', 'copy.md');
const banned = JSON.parse(readFileSync(join(root, 'data', 'banned-phrases.json'), 'utf8'));
const norm = (s) => s.normalize('NFKC').toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const enRe = (p) => new RegExp(`(^|[^a-z0-9])${esc(norm(p)).replace(/[\s-]+/g, '[\\s-]+')}($|[^a-z0-9])`);

const rows = [];
for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  if (!line.startsWith('| ') || line.startsWith('| key') || line.startsWith('|---')) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length < 5) continue;
  rows.push({ key: cells[0], ja: cells[1], en: cells[2] });
}
const extraJa = ['閉じていても通知', '自動で同期', '同期されます'];
const extraEn = ['even when closed', 'push notification', 'synced automatically', 'syncs automatically'];
const assessJa = ['よくない'];
const assessEn = ['unsuitable', 'avoid'];

let hits = 0;
for (const r of rows) {
  const ja = norm(r.ja); const en = norm(r.en);
  const isAssess = /^(assess|state)\./.test(r.key);
  for (const p of [...banned.ja, ...extraJa, ...(isAssess ? assessJa : [])]) {
    if (ja.includes(norm(p)) || en.includes(norm(p))) { hits++; console.log(`HIT ja "${p}" in ${r.key}: ${r.ja}`); }
  }
  for (const p of [...banned.en, ...extraEn, ...(isAssess ? assessEn : [])]) {
    if (enRe(p).test(en) || enRe(p).test(ja)) { hits++; console.log(`HIT en "${p}" in ${r.key}: ${r.en}`); }
  }
}
console.log(`${rows.length} rows checked, ${hits} hits`);
process.exitCode = hits ? 1 : 0;
