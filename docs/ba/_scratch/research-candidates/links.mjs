// node links.mjs file.html pattern  -> list unique hrefs matching pattern with nearby text/alt
import fs from 'node:fs';
const [f, pat] = process.argv.slice(2);
const h = fs.readFileSync(f, 'utf8');
const re = new RegExp(`href="([^"]*${pat}[^"]*)"([\s\S]{0,800}?)</a>`, 'g');
const seen = new Map(); let m;
while ((m = re.exec(h))) {
  const alt = (m[2].match(/alt="([^"]*)"/) || [])[1];
  const t = alt || m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!seen.has(m[1]) || (!seen.get(m[1]) && t)) seen.set(m[1], t.slice(0, 70));
}
for (const [k, v] of seen) console.log(k, '|', v);
