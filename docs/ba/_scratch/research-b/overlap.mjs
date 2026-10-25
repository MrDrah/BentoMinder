// usage: node overlap.mjs <recipe-id> page1.html page2.html ... -> reports copied runs (en >=8 words, ja >=12 chars)
import fs from 'node:fs';
const [id, ...pages] = process.argv.slice(2);
const recs = JSON.parse(fs.readFileSync(new URL('../../../../data/_research/batch-b.json', import.meta.url), 'utf8'));
const r = recs.find((x) => x.id === id);
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
const raw = pages.map((p) => fs.readFileSync(p, 'utf8')).join(' ');
const src = strip(raw) + ' ' + raw; // include JSON-LD text too
const srcWords = src.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean).join(' ');
const srcJa = src.replace(/\s+/g, '');
const texts = [r.description, ...r.steps, ...r.storage, ...r.adaptations];
let hits = 0;
for (const t of texts) {
  const w = (t.en ?? '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i + 8 <= w.length; i++) { const run = w.slice(i, i + 8).join(' '); if (srcWords.includes(run)) { hits++; console.log('EN', run); break; } }
  const j = t.ja.replace(/\s+/g, '');
  for (let i = 0; i + 12 <= j.length; i++) { const run = j.slice(i, i + 12); if (srcJa.includes(run)) { hits++; console.log('JA', run); break; } }
}
console.log(id, hits ? hits + ' copied runs' : 'no copied runs');
