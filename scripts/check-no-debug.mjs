#!/usr/bin/env node
// BR-24 / US-E11-01/AC2: the production build must contain no debug code. Fails if any file
// in dist/ contains the marker exported by src/debug/marker.ts (proof, not trust).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
// Built from parts so this script never contains the marker itself.
const MARKERS = [['__BENTOMINDER', 'DEBUG__'].join('_'), ['BM', 'DEBUG', 'PANEL'].join('_')];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (!existsSync(dist)) {
  console.error('check-no-debug: dist/ is missing; run npm run build first');
  process.exit(1);
}
const files = walk(dist);
const hits = files.filter((f) => {
  const text = readFileSync(f, 'latin1');
  return MARKERS.some((m) => text.includes(m));
});
if (hits.length > 0) {
  for (const f of hits) console.error(`debug marker found in ${relative(root, f)}`);
  process.exit(1);
}
console.log(`check-no-debug: OK (${files.length} files in dist/, no debug marker)`);
