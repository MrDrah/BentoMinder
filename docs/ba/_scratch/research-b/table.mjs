// usage: node table.mjs file.html regex -> prints header(s) and matching rows with column names
import fs from 'node:fs';
const h = fs.readFileSync(process.argv[2], 'utf8');
const re = new RegExp(process.argv[3]);
const clean = (s) => s.replace(/<[^>]+>/g, '').replace(/&#174;/g, '®').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
for (const t of h.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
  const rows = [...t.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => [...m[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => clean(c[1])));
  const header = rows.find((r) => r.some((c) => c === '卵' || c === '小麦'));
  for (const r of rows) if (re.test(r[0] ?? '')) {
    console.log(r[0]);
    if (header) console.log('  ', header.map((c, i) => `${c}=${r[i] ?? ''}`).filter((x) => /=●|=○|=\S/.test(x) && !x.startsWith(r[0])).join(' | '));
  }
}
