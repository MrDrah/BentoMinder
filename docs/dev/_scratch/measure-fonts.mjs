// Scratch: measures the first-screen font transfer of the production build (ADR 001 asks for it).
// Usage: npm run preview (port 4173), then node docs/dev/_scratch/measure-fonts.mjs
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
for (const [name, viewport] of [['mobile 390', { width: 390, height: 844 }], ['desktop 1280', { width: 1280, height: 800 }]]) {
  for (const lang of ['ja', 'en']) {
    const context = await browser.newContext({ viewport, locale: 'en-US', timezoneId: 'Europe/Paris' });
    const page = await context.newPage();
    const fonts = new Map();
    const other = { js: 0, css: 0 };
    page.on('response', async (res) => {
      const url = res.url();
      const body = await res.body().catch(() => Buffer.alloc(0));
      if (url.endsWith('.woff2')) fonts.set(url.split('/').pop(), body.length);
      else if (url.endsWith('.js')) other.js += body.length;
      else if (url.endsWith('.css')) other.css += body.length;
    });
    if (lang === 'en') {
      await page.goto('http://localhost:4173/');
      await page.getByTestId('lang-toggle-en').click();
      fonts.clear();
      await page.reload();
    } else {
      await page.goto('http://localhost:4173/');
    }
    await page.getByTestId('screen-calendar').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const total = [...fonts.values()].reduce((a, b) => a + b, 0);
    console.log(`${name} ${lang}: ${fonts.size} font files, ${(total / 1024).toFixed(1)} KB (js ${(other.js / 1024).toFixed(1)} KB raw, css ${(other.css / 1024).toFixed(1)} KB raw)`);
    await context.close();
  }
}
await browser.close();
