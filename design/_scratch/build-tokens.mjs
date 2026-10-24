// Generates design/tokens.css from design/tokens.json.  node design/_scratch/build-tokens.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, '..', 'tokens.json'), 'utf8'));

const block = (obj, key = 'value') =>
  Object.entries(obj).filter(([, v]) => v[key] !== undefined && !String(v.value).startsWith('All durations'))
    .map(([k, v]) => `  --${k}: ${v[key]};`).join('\n');
const fontVar = (k) => k.startsWith('family-') ? k.replace('family-', 'font-') : k;
const fonts = Object.entries(t.font).map(([k, v]) => `  --${fontVar(k)}: ${v.value};`).join('\n');
const darkColors = Object.entries(t.color.dark).map(([k, v]) => `    --${k}: ${v.value};`).join('\n');
const darkElev = Object.entries(t.elevation).filter(([, v]) => v.dark).map(([k, v]) => `    --${k}: ${v.dark};`).join('\n');
const darkBlock = `${darkColors}\n${darkElev}`;

const css = `/* BentoMinder design tokens v${t.version} (H2 final, 2026-10-24)
   GENERATED from design/tokens.json by design/_scratch/build-tokens.mjs. Edit the JSON, then regenerate.
   Light is the default. Dark applies with [data-theme="dark"] (settings.theme = "dark")
   or, when settings.theme = "auto" (no data-theme attribute), with prefers-color-scheme: dark.
   settings.theme = "light" sets [data-theme="light"], which blocks the OS dark preference. */

:root {
  color-scheme: light;

  /* Colour roles: light */
${block(t.color.light)}

  /* Typography */
${fonts}

  /* Spacing: 4 px scale */
${block(t.space)}

  /* Sizes */
${block(t.size)}

  /* Radii */
${block(t.radius)}

  /* Elevation */
${block(t.elevation)}

  /* Motion */
${block(t.motion)}

  /* Layers */
${block(t.z)}

  /* Breakpoints (for reference in JS; CSS media queries use the literal values) */
${block(t.breakpoint)}

  /* Patterns */
${block(t.pattern)}
}

html[lang="en"] {
  --tracking-body: 0;
  --tracking-heading: 0;
}

[data-theme="dark"] {
  color-scheme: dark;
${darkBlock.replace(/^    /gm, '  ')}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;
${darkBlock}
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-base: 0ms;
    --duration-slow: 0ms;
    --duration-shimmer: 0ms;
    --sheet-offset: 0px;
  }
}

/* Focus: one rule for every focusable element (a11y-responsive.md §4). */
:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
  box-shadow: 0 0 0 var(--focus-offset) var(--focus-halo);
}
`;
writeFileSync(join(here, '..', 'tokens.css'), css);
console.log('tokens.css written');
