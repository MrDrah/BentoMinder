import { write } from './lib.mjs';
import fs from 'node:fs';
const recs = [];
for (const f of ['r1', 'r2', 'r3', 'r4', 'r5']) {
  if (fs.existsSync(new URL(`./${f}.mjs`, import.meta.url))) {
    const m = await import(`./${f}.mjs`);
    recs.push(...Object.values(m).flat());
  }
}
write('C:/Projects/BentoMinder/data/_research/batch-c.json', recs);
console.log('wrote', recs.length);
