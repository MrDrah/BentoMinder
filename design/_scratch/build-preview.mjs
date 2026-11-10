// Builds design/preview/index.html from design/_scratch/preview.src.html + design/tokens.css (inlined, self-contained).
// node design/_scratch/build-preview.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'preview.src.html'), 'utf8');
const tokens = readFileSync(join(here, '..', 'tokens.css'), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, '');
if (!src.includes('/*@TOKENS@*/')) throw new Error('placeholder missing');
// The day-tile matrix shows a light panel even when the page is dark, so repeat the light colour roles for it.
const from = tokens.indexOf('/* Colour roles: light */');
const to = tokens.indexOf('/* Typography');
const lightVars = tokens
  .slice(from, to)
  .split('\n')
  .filter((l) => /^\s*--[a-z0-9-]+:/.test(l))
  .join('\n');
const extra = '\n.tm-theme[data-theme="light"]{color-scheme:light;\n' + lightVars + '\n}\n';
writeFileSync(join(here, '..', 'preview', 'index.html'), src.replace('/*@TOKENS@*/', () => tokens + extra));
console.log('preview written');
