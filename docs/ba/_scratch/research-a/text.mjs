// usage: node text.mjs file.html [from] [to] -> visible text, scripts/styles removed
import fs from 'node:fs';
const h = fs.readFileSync(process.argv[2], 'utf8');
let t = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d|tr|dt|dd|section)>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(m,n)=>String.fromCodePoint(+n)).replace(/&quot;/g,'"');
t = t.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
const from = process.argv[3], to = process.argv[4];
if (from) { const i = t.indexOf(from); t = i >= 0 ? t.slice(i) : '[from not found]\n' + t; }
if (to) { const j = t.indexOf(to, 1); if (j > 0) t = t.slice(0, j); }
console.log(t);
