// Slice 2 screenshots (day tiles). Usage: node docs/dev/_scratch/ui-refresh/shoot-slice2.mjs <outDir>; expects `npm run preview` on :4173.
// Fixture: tests/e2e/tile-states.ts (today = Tue 2026-11-17, every tile state present). Home 390 / 1280 in light and dark,
// the day sheet, the Today card, the legend open.
import { chromium } from '@playwright/test';
import { join } from 'node:path';
import { TILES_NOW, tileStatesState } from '../../../../tests/e2e/tile-states.ts';

const out = process.argv[2];
const base = process.env.BASE ?? 'http://localhost:4173';
const state = tileStatesState();
const sizes = { sp: { width: 390, height: 844 }, pc: { width: 1280, height: 800 } };
const browser = await chromium.launch();

async function page(size, scheme) {
  const c = await browser.newContext({ viewport: sizes[size], hasTouch: size === 'sp', isMobile: size === 'sp', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', colorScheme: scheme });
  await c.addInitScript((v) => { if (localStorage.getItem('bentominder.state') === null) localStorage.setItem('bentominder.state', v); }, state);
  const p = await c.newPage();
  await p.clock.setFixedTime(TILES_NOW);
  return p;
}

for (const size of ['sp', 'pc']) {
  for (const scheme of ['light', 'dark']) {
    const p = await page(size, scheme);
    await p.goto(`${base}/#/calendar`);
    await p.waitForTimeout(700);
    await p.screenshot({ path: join(out, `home-${size}-${scheme}.png`), fullPage: true });
    await p.getByTestId('cal-grid').screenshot({ path: join(out, `grid-${size}-${scheme}.png`) });
    await p.getByTestId('legend-toggle').click();
    await p.waitForTimeout(200);
    await p.locator('#legend-body').screenshot({ path: join(out, `legend-${size}-${scheme}.png`) });
    if (scheme === 'light') {
      await p.getByTestId('today-card').screenshot({ path: join(out, `today-card-${size}.png`) });
      await p.getByTestId('upcoming').screenshot({ path: join(out, `upcoming-${size}.png`) });
    }
    await p.context().close();
  }
  const p = await page(size, 'light');
  await p.goto(`${base}/#/day/2026-11-17`);
  await p.waitForTimeout(700);
  await p.screenshot({ path: join(out, `day-${size}.png`) });
  await p.context().close();
}
// agenda fallback (container < 340 px)
{
  const c = await browser.newContext({ viewport: { width: 320, height: 700 }, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  await c.addInitScript((v) => { if (localStorage.getItem('bentominder.state') === null) localStorage.setItem('bentominder.state', v); }, state);
  const p = await c.newPage();
  await p.clock.setFixedTime(TILES_NOW);
  await p.goto(`${base}/#/calendar`);
  await p.waitForTimeout(700);
  await p.screenshot({ path: join(out, 'agenda-320.png'), fullPage: true });
  await c.close();
}
await browser.close();
