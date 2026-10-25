// Cross-checks the design docs against the copy sheet, the tokens and the shipped catalogs.
// 1. Every copy key named in components.md / flows.md / a11y-responsive.md (in `code`) exists in copy.md.
// 2. Every token named as `--x` or a bare token role in those docs exists in tokens.css.
// 3. Lists copy keys that the app catalog (src/i18n/ja.ts) does not have yet, grouped by section prefix,
//    so the next milestone knows what to add (informational, not a failure).
// node design/_scratch/check-refs.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const copyKeys = new Set();
for (const line of read('design/copy.md').split(/\r?\n/)) {
  if (!line.startsWith('| ')) continue;
  const c = line.split('|').slice(1, -1).map((s) => s.trim());
  if (c.length < 5 || c[0] === 'key' || c[0].startsWith('---')) continue;
  const k = c[0];
  // "wd.short.0 … 6" style rows
  const range = /^(.*\.)(\d+) … (\d+)$/.exec(k);
  if (range) for (let i = +range[2]; i <= +range[3]; i++) copyKeys.add(range[1] + i);
  else copyKeys.add(k);
}

const prefixes = new Set([...copyKeys].map((k) => k.split('.')[0]));
const tokensCss = read('design/tokens.css');
const tokenNames = new Set([...tokensCss.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));

// Store fields (data contract), not copy keys.
const storeFields = new Set(['settings.weekStartsOn', 'settings.language', 'settings.theme']);
let missing = 0;
for (const doc of ['design/components.md', 'design/flows.md', 'design/a11y-responsive.md']) {
  const text = read(doc);
  const seen = new Set();
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    let ref = m[1];
    if (seen.has(ref)) continue;
    seen.add(ref);
    if (ref.startsWith('--')) {
      if (!tokenNames.has(ref.slice(2))) { missing++; console.log(`${doc}: token ${ref} not in tokens.css`); }
      continue;
    }
    // bare token role (`surface-2`, `ink-3`, `navy-fill`…): must exist as --name
    const fam = ['surface', 'ink', 'accent', 'warning', 'success', 'danger', 'info', 'line', 'navy', 'focus', 'radius', 'elevation', 'duration', 'ease', 'space', 'stripe', 'planned', 'saturday', 'sunday', 'link', 'skeleton', 'scrim', 'hatch', 'touch', 'icon'];
    if (/^[a-z]+(-[a-z0-9]+)*$/.test(ref) && fam.includes(ref.split('-')[0]) && !/^(text|line)-(xs|sm|md|lg|xl|2xl|3xl)$/.test(ref)) {
      if (!tokenNames.has(ref)) { missing++; console.log(`${doc}: token role ${ref} not in tokens.css`); }
      continue;
    }
    // copy key: dotted, starts with a known copy prefix, no slash/paren
    if (!/^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+(\.\*)?$/.test(ref)) continue;
    const head = ref.split('.')[0];
    if (!prefixes.has(head) || storeFields.has(ref)) continue;
    if (ref.endsWith('.*')) {
      const p = ref.slice(0, -1);
      if (![...copyKeys].some((k) => k.startsWith(p))) { missing++; console.log(`${doc}: key family ${ref} has no rows in copy.md`); }
      continue;
    }
    if (!copyKeys.has(ref)) { missing++; console.log(`${doc}: key ${ref} not in copy.md`); }
  }
}

// Informational: copy keys not yet in the app catalog.
const appKeys = new Set([...read('src/i18n/ja.ts').matchAll(/^\s+'([^']+)':/gm)].map((m) => m[1]));
const notYet = {};
for (const k of copyKeys) {
  if (appKeys.has(k)) continue;
  const p = k.split('.')[0];
  (notYet[p] ??= []).push(k);
}
const summary = Object.entries(notYet).map(([p, ks]) => `${p}:${ks.length}`).join(' ');
console.log(`copy keys ${copyKeys.size}, in app catalog ${[...copyKeys].filter((k) => appKeys.has(k)).length}; not yet in the app: ${summary}`);
console.log(`${missing} unresolved references`);
process.exitCode = missing ? 1 : 0;
