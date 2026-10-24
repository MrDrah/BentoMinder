// Builds design/preview/index.html from design/_scratch/preview.src.html + design/tokens.css (inlined, self-contained).
// node design/_scratch/build-preview.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'preview.src.html'), 'utf8');
const tokens = readFileSync(join(here, '..', 'tokens.css'), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, '');
if (!src.includes('/*@TOKENS@*/')) throw new Error('placeholder missing');
writeFileSync(join(here, '..', 'preview', 'index.html'), src.replace('/*@TOKENS@*/', tokens));
console.log('preview written');
