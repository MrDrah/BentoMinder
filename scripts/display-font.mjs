// Display-font @font-face subset (ADR 001 "Fonts", revisit clause). The full @fontsource CSS
// for Zen Maru Gothic declares ~120 unicode-range slices per weight; its unicode-range lists
// alone are ~57 KB gzip, more than the 50 KB CSS budget. The display font only renders app
// text (catalogs) and recipe names, so the build keeps the slices that cover those characters
// (woff2 only; every target WebView supports it). Characters outside the kept slices fall back
// to the token font stack, as with font-display: swap.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const FAMILY = 'Zen Maru Gothic';

/** Parses `U+0000-00FF,U+0131` into [start, end] pairs. */
export function parseUnicodeRange(value) {
  return value
    .split(',')
    .map((part) => part.trim().replace(/^U\+/i, ''))
    .filter(Boolean)
    .map((part) => {
      if (part.includes('?')) return [parseInt(part.replaceAll('?', '0'), 16), parseInt(part.replaceAll('?', 'F'), 16)];
      const [a, b = a] = part.split('-');
      return [parseInt(a, 16), parseInt(b, 16)];
    });
}

/** Splits an @fontsource CSS file into its @font-face blocks. */
export function parseFontFaces(css) {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => {
    const body = m[1];
    const woff2 = /url\(([^)]+\.woff2)\)/.exec(body)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(body)?.[1] ?? 'U+0-10FFFF';
    const weight = /font-weight:\s*(\d+)/.exec(body)?.[1] ?? '400';
    return { woff2, weight, ranges: parseUnicodeRange(range), rangeText: range.trim() };
  });
}

export function codePointsOf(texts) {
  const set = new Set();
  for (const text of texts) for (const ch of text) set.add(ch.codePointAt(0));
  return set;
}

/**
 * Builds the subset CSS. `fileUrl(name)` maps a font file name to the url() used in the CSS.
 * Returns the CSS and the number of kept / total slices.
 */
export function buildDisplayFontCss({ texts, weights = ['500', '700'], fileUrl }) {
  const require = createRequire(import.meta.url);
  const pkgDir = dirname(require.resolve('@fontsource/zen-maru-gothic/package.json'));
  const points = [...codePointsOf(texts)];
  let kept = 0;
  let total = 0;
  const blocks = [];
  for (const weight of weights) {
    for (const face of parseFontFaces(readFileSync(join(pkgDir, `${weight}.css`), 'utf8'))) {
      total += 1;
      if (face.woff2 === undefined) continue;
      const used = points.some((p) => face.ranges.some(([a, b]) => p >= a && p <= b));
      if (!used) continue;
      kept += 1;
      const name = face.woff2.replace(/^\.\/files\//, '');
      blocks.push(
        `@font-face{font-family:'${FAMILY}';font-style:normal;font-display:swap;font-weight:${face.weight};` +
          `src:url(${fileUrl(name)}) format('woff2');unicode-range:${face.rangeText}}`,
      );
    }
  }
  return { css: `${blocks.join('\n')}\n`, kept, total };
}
