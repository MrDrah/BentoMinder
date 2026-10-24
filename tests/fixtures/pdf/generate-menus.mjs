#!/usr/bin/env node
// Renders every synthetic menu layout (tests/fixtures/menus/<id>/layout.html) to
// tests/fixtures/menus/<id>/menu.pdf with Playwright Chromium (page.pdf, A4), and writes
// tests/fixtures/pdf/not-a-pdf.pdf (text bytes). Generated files: never edit them by hand.
//
// Fonts: only Japanese fonts installed with Windows ("Yu Gothic", "Meiryo", "BIZ UDGothic"),
// chosen by CSS font-family in each layout. Nothing is downloaded. On a machine without these
// fonts Chromium falls back to another font, so regenerate on Windows (see fixtures-plan §7).
//
// Output is made byte-stable across runs: the PDF CreationDate/ModDate are overwritten with a
// fixed value of the same length (offsets in the xref table stay valid).
//
// Usage: node tests/fixtures/pdf/generate-menus.mjs [fixture-id ...]
// The oversize case (> 10 MB) is generated at test time, never committed.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const menusDir = join(here, '..', 'menus');
const MAX_BYTES = 1_048_576; // fixture budget: each PDF < 1 MB
const FIXED_DATE = '20261024000000';
const SCAN_DPI = 150;

const only = process.argv.slice(2);
const ids = readdirSync(menusDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(menusDir, e.name, 'layout.html')))
  .map((e) => e.name)
  .filter((id) => only.length === 0 || only.includes(id))
  .sort();

/** Overwrite the volatile dates in the PDF Info dictionary (same length, so xref offsets hold). */
function stabilise(buf) {
  const latin = buf.toString('latin1');
  const fixed = latin.replace(/(\/(?:CreationDate|ModDate)\s*\(D:)(\d{14})/g, (_, p) => `${p}${FIXED_DATE}`);
  return Buffer.from(fixed, 'latin1');
}

const pageCount = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

async function renderLayout(browser, id) {
  const html = join(menusDir, id, 'layout.html');
  const source = readFileSync(html, 'utf8');
  const landscape = source.includes('data-orientation="landscape"');
  const scanOf = /data-scan-of="([^"]+)"/.exec(source)?.[1];
  const context = await browser.newContext({ locale: 'ja-JP' });
  const page = await context.newPage();
  // Block every non-file request: layouts are self-contained and nothing may be fetched.
  await page.route(/^(?!file:)/, (route) => route.abort());
  if (scanOf) {
    // 1. Rasterise the source layout at 150 dpi (A4 = 794 x 1123 CSS px at 96 dpi).
    const src = await context.newPage();
    await src.route(/^(?!file:)/, (route) => route.abort());
    await src.setViewportSize({ width: 794, height: 1123 });
    await src.goto(pathToFileURL(join(menusDir, scanOf, 'layout.html')).href);
    await src.evaluate(() => document.fonts.ready);
    const scale = SCAN_DPI / 96;
    const box = await src.evaluate((sel) => {
      const cells = [...document.querySelectorAll(sel)].map((c) => c.getBoundingClientRect());
      if (cells.length === 0) return null;
      const x = Math.min(...cells.map((r) => r.left));
      const y = Math.min(...cells.map((r) => r.top));
      return { x, y, w: Math.max(...cells.map((r) => r.right)) - x, h: Math.max(...cells.map((r) => r.bottom)) - y };
    }, '.col-green');
    await src.close();
    const hi = await browser.newContext({ locale: 'ja-JP', viewport: { width: 794, height: 1123 }, deviceScaleFactor: scale });
    const hp = await hi.newPage();
    await hp.route(/^(?!file:)/, (route) => route.abort());
    await hp.goto(pathToFileURL(join(menusDir, scanOf, 'layout.html')).href);
    await hp.evaluate(() => document.fonts.ready);
    const shot = await hp.screenshot({ type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 794, height: 1123 } });
    await hi.close();
    // 2. Compose the scanned look in the fixture's own layout.html, then print it.
    await page.goto(pathToFileURL(html).href);
    const scaled = box && { x: Math.round(box.x * scale), y: Math.round(box.y * scale), w: Math.round(box.w * scale), h: Math.round(box.h * scale) };
    await page.evaluate(([url, b]) => window.composeScan(url, b), [`data:image/jpeg;base64,${shot.toString('base64')}`, scaled]);
  } else {
    await page.goto(pathToFileURL(html).href);
    await page.evaluate(() => document.fonts.ready);
  }
  // The layout must fit its single page: body is fixed to the page size with overflow hidden,
  // so overflowing content would be silently clipped. Fail instead.
  const overflow = await page.evaluate(() => document.body.scrollHeight - document.body.clientHeight);
  if (overflow > 1) throw new Error(`${id}: layout overflows its page by ${overflow}px`);
  const pdf = await page.pdf({ format: 'A4', landscape, printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  await context.close();
  return stabilise(pdf);
}

const browser = await chromium.launch();
let failed = false;
try {
  for (const id of ids) {
    const pdf = await renderLayout(browser, id);
    const out = join(menusDir, id, 'menu.pdf');
    writeFileSync(out, pdf);
    const magic = pdf.subarray(0, 5).toString('latin1') === '%PDF-';
    const ok = magic && pdf.length < MAX_BYTES;
    if (!ok) failed = true;
    const sha = createHash('sha256').update(pdf).digest('hex');
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${id}/menu.pdf  ${pdf.length} bytes  ${pageCount(pdf)} page(s)  sha256 ${sha.slice(0, 12)}${magic ? '' : '  (no %PDF- header)'}`);
  }
} finally {
  await browser.close();
}

if (only.length === 0) {
  // A file named .pdf whose bytes are plain text (BR-14 magic-byte check, US-E2-03).
  const notPdf = join(here, 'not-a-pdf.pdf');
  writeFileSync(notPdf, 'This is a plain text file with a .pdf extension. Synthetic test fixture, not a PDF.\nテスト用のファイルです。PDFではありません。\n');
  console.log('OK   pdf/not-a-pdf.pdf (text bytes)');
}
if (failed) process.exit(1);
