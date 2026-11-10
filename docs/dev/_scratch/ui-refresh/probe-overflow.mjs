// Lists elements wider than the viewport at 320 px. Usage: node probe-overflow.mjs '#/settings'
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const state = readFileSync('tests/fixtures/state/m2-november.json', 'utf8');
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 320, height: 640 }, isMobile: process.env.MOB === '1', hasTouch: process.env.MOB === '1', locale: 'en-US' });
await c.addInitScript((v) => { if (localStorage.getItem('bentominder.state') === null) localStorage.setItem('bentominder.state', v); }, state);
const p = await c.newPage();
for (const h of (process.argv[2] ?? '#/settings').split(',')) { await p.goto('http://localhost:4173/' + h); await p.waitForTimeout(300); }
await p.waitForTimeout(800);
console.log(await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, window.innerWidth, ...[...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > 320.5).map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)).slice(0, 10)]));
await b.close();
