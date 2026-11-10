// Renders design/preview/index.html (slot h and the tile matrix) with Playwright. No dev server: file URL.
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const out = 'docs/dev/_scratch/ui-refresh/after-design';
const b = await chromium.launch();
const errs = [];
const url = pathToFileURL(resolve('design/preview/index.html')).href;
async function open(q, w = 900, h = 1100) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url + q);
  return p;
}
for (const theme of ['light', 'dark']) {
  const p = await open(theme === 'dark' ? '?theme=dark' : '');
  const slot = p.locator('section.rf');
  await slot.screenshot({ path: `${out}/slot-h-${theme}.png` });
  await p.locator('#legendBtn').click();
  await p.locator('section.rf .scroll').evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await slot.screenshot({ path: `${out}/slot-h-${theme}-legend.png` });
  await p.locator('#tileMatrix').screenshot({ path: `${out}/tile-matrix-${theme === 'dark' ? 'page-dark' : 'page-light'}.png` });
  await p.close();
}
const pe = await open('?lang=en');
await pe.locator('section.rf').screenshot({ path: `${out}/slot-h-light-en.png` });
const names = await pe.locator('section.rf [data-testid^="cal-cell-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid').slice(-2) + ': ' + e.getAttribute('aria-label')));
console.log(names.filter((n) => /^(04|09|13|17|18|20|24|25|27|03|21)/.test(n)).join('\n'));
await pe.close();
await b.close();
console.log('errors', errs);
