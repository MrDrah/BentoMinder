// Before/after screenshots. Usage: node shoot.mjs <outDir> ; expects the e2e preview on :4173 (fake auth build).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const out = process.argv[2];
const base = process.env.BASE ?? 'http://localhost:4173';
const state = readFileSync(join(process.cwd(), 'tests/fixtures/state/m2-november.json'), 'utf8');
const NOW = new Date('2026-11-02T10:00:00+09:00');
const sizes = { sp: { width: 390, height: 844 }, sp320: { width: 320, height: 640 }, tab: { width: 768, height: 1024 }, pc: { width: 1280, height: 800 } };
const browser = await chromium.launch();
async function ctx(size, { signedOut = false, lang = 'ja' } = {}) {
  const c = await browser.newContext({ viewport: sizes[size], hasTouch: size.startsWith('sp'), isMobile: size.startsWith('sp'), locale: lang === 'ja' ? 'ja-JP' : 'en-US', timezoneId: 'Asia/Tokyo' });
  const s = JSON.stringify(JSON.parse(state));
  await c.addInitScript(([v, so]) => { if (so) localStorage.setItem('bentominder.fake-auth', 'signed-out'); else if (localStorage.getItem('bentominder.state') === null) localStorage.setItem('bentominder.state', v); }, [s, signedOut]);
  const p = await c.newPage();
  await p.clock.setFixedTime(NOW);
  return p;
}
const shots = [
  ['home', '#/calendar'], ['day', '#/day/2026-11-04'], ['import', '#/import'], ['settings', '#/settings'],
  ['recommend', '#/recommend/2026-11-04'], ['recipes', '#/recipes'], ['recipe', null], ['profile', '#/profile'], ['review', '#/review/2026-11'],
];
for (const size of ['sp', 'pc']) {
  for (const [name, hash] of shots) {
    const p = await ctx(size);
    try {
      await p.goto(base + '/' + (hash ?? '#/recipes'));
      await p.waitForTimeout(700);
      if (name === 'recipe') { const a = p.locator('a[href^="#/recipe/"]').first(); if (await a.count()) { await a.click(); await p.waitForTimeout(500); } }
      await p.screenshot({ path: join(out, `${name}-${size}.png`), fullPage: true });
      if (name === 'settings') { await p.screenshot({ path: join(out, `${name}-${size}-viewport.png`) }); }
    } catch (e) { console.log('fail', name, size, String(e).slice(0, 120)); }
    await p.context().close();
  }
}
for (const size of ['sp', 'pc']) {
  const p = await ctx(size, { signedOut: true });
  await p.goto(base + '/#/calendar'); await p.waitForTimeout(700);
  await p.screenshot({ path: join(out, `login-${size}.png`), fullPage: true });
  await p.context().close();
}
for (const size of ['sp320', 'tab']) {
  const p = await ctx(size); await p.goto(base + '/#/calendar'); await p.waitForTimeout(700);
  await p.screenshot({ path: join(out, `home-${size}.png`), fullPage: true });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth); console.log(size, 'scrollWidth', sw);
  await p.context().close();
}
await browser.close();
