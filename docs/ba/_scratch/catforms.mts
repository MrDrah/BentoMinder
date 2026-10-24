import { readFileSync } from 'node:fs';
import { normalizeForMatch } from '../../../src/domain/text/normalize.ts';
const d = JSON.parse(readFileSync('data/dictionary.json','utf8'));
const owner = new Map<string,string>();
for (const a of d.ambiguity) for (const f of a.forms) owner.set(normalizeForMatch(f), a.id);
for (const e of [...d.ingredients, ...d.dishes]) for (const f of e.forms) owner.set(normalizeForMatch(f), e.id);
for (const c of d.categories) {
  const parts = [c.ja, ...c.ja.split('・')].map((s: string)=>s.replace(/類$/,''));
  const hits = [...new Set(parts)].map(p => `${p}→${owner.get(normalizeForMatch(p)) ?? '-'}`);
  console.log(c.id, c.ja, '|', hits.join(' '));
}
