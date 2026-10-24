// QA scratch: which M1 acceptance criteria are named by which tests.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const stories = readFileSync('docs/ba/user-stories.md', 'utf8');
const inScope = (id) => /^US-E1-0[1-6]$|^US-E2-0[1-8]$|^US-E3-0[1-4]$|^US-E10-0[1-5]$|^US-NF-03$/.test(id);
const acs = new Map();
let cur = null;
for (const line of stories.split('\n')) {
  const h = line.match(/^### (US-[A-Z0-9-]+)/);
  if (h) cur = h[1];
  const a = line.match(/^\s*Scenario(?: Outline)?: (AC\d+)/);
  if (a && cur && inScope(cur)) acs.set(`${cur}/${a[1]}`, '');
}
function walk(d, out = []) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      if (!/node_modules|_scratch|fixtures/.test(p)) walk(p, out);
    } else if (/\.(ts|tsx|mjs)$/.test(f)) out.push(p);
  }
  return out;
}
const files = walk('tests');
const named = new Map();
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const qa = f.split('\\').join('/').includes('tests/e2e/qa/');
  const fixmeLines = new Set();
  for (const m of text.matchAll(/US-[A-Z0-9]+(?:-\d+)?\/AC\d+/g)) {
    const e = named.get(m[0]) ?? { qa: 0, other: 0 };
    if (qa) e.qa++;
    else e.other++;
    named.set(m[0], e);
  }
}
let qaCovered = 0, anyCovered = 0, total = 0;
const notQa = [], none = [];
for (const id of acs.keys()) {
  total++;
  const n = named.get(id);
  if (n?.qa) qaCovered++;
  else notQa.push(id);
  if (n) anyCovered++;
  else none.push(id);
}
console.log(JSON.stringify({ total, qaCovered, anyCovered, notNamedByQa: notQa, namedByNobody: none }, null, 1));
