import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
const ids = process.argv.slice(2);
const b = await chromium.launch();
for (const id of ids) {
  const land = id.includes('twocol');
  const p = await b.newPage({ viewport: land ? { width: 1123, height: 794 } : { width: 794, height: 1123 } });
  await p.goto(pathToFileURL(`C:/Projects/BentoMinder/tests/fixtures/menus/${id}/layout.html`).href);
  await p.evaluate(() => document.fonts.ready);
  const h = await p.evaluate(() => document.body.scrollHeight);
  console.log(id, 'height', h);
  await p.screenshot({ path: `C:/Projects/BentoMinder/tests/_scratch/fixtures/shots/${id}.png`, fullPage: true });
  await p.close();
}
await b.close();
