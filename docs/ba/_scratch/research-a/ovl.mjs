// usage: node ovl.mjs <recipe-id> page1.html [page2.html ...]
// Longest run copied from the source pages, per own-words field (ja: chars, after NFKC and
// whitespace removal; en: words). Flags ja runs >= 12 chars and en runs >= 8 words.
import { readFileSync } from 'node:fs';

const [id, ...pages] = process.argv.slice(2);
const rec = JSON.parse(readFileSync(`rec/${id}.json`, 'utf8'));
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
const srcRaw = pages.map((p) => strip(readFileSync(p, 'utf8'))).join(' ');
const normJa = (s) => s.normalize('NFKC').replace(/\s+/g, '');
const src = normJa(srcRaw);

function lcs(a, b) {
  let best = 0, end = 0;
  let prev = new Uint16Array(b.length + 1);
  for (let x = 1; x <= a.length; x++) {
    const cur = new Uint16Array(b.length + 1);
    for (let y = 1; y <= b.length; y++) {
      if (a[x - 1] === b[y - 1]) {
        cur[y] = prev[y - 1] + 1;
        if (cur[y] > best) { best = cur[y]; end = x; }
      }
    }
    prev = cur;
  }
  return { len: best, text: a.slice(end - best, end) };
}

const words = (s) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const srcWords = words(srcRaw.normalize('NFKC')).join(' ');
function enRun(t) {
  const w = words(t);
  let best = 0, txt = '';
  for (let s = 0; s < w.length; s++) {
    for (let e = s + best + 1; e <= w.length; e++) {
      const phrase = w.slice(s, e).join(' ');
      if (srcWords.includes(phrase)) { best = e - s; txt = phrase; } else break;
    }
  }
  return { len: best, text: txt };
}

const fields = [['description', [rec.description]], ['makeAhead', rec.makeAhead ? [rec.makeAhead] : []], ['steps', rec.steps], ['storage', rec.storage], ['adaptations', rec.adaptations]];
let flagged = 0;
for (const [name, list] of fields) {
  list.forEach((t, n) => {
    const r = lcs(normJa(t.ja), src);
    const e = t.en ? enRun(t.en) : { len: 0, text: '' };
    const bad = r.len >= 12 || e.len >= 8;
    if (bad) flagged++;
    if (bad || r.len >= 9) console.log(`${bad ? 'FAIL' : 'near'} ${name}[${n}] ja=${r.len} 「${r.text}」 en=${e.len} "${e.text}"`);
  });
}
console.log(`${id}: ${flagged} field(s) flagged`);
