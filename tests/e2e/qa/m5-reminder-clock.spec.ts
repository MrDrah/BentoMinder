// QA M5 investigation: why a (missed) reminder shows in the m1-import first-launch journey, and what the
// correct behaviour is. Pins US-E7-01, US-E7-05/AC2, AC3 and BR-17 against the injected clock only.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FX01, type Json } from './helpers.ts';

const state = (): string => {
  const s: Json = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8'));
  s.reminderLog = [];
  return JSON.stringify(s);
};
async function open(page: Page, iso: string, mode: 'install' | 'fixed', json = state()) {
  if (mode === 'install') await page.clock.install({ time: new Date(iso) });
  else await page.clock.setFixedTime(new Date(iso));
  await page.addInitScript((v) => {
    if (window.localStorage.getItem('bentominder.state') === null) window.localStorage.setItem('bentominder.state', v);
  }, json);
  await page.goto('./');
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
}
const keys = async (page: Page) => {
  const more = page.getByTestId('reminder-more');
  if ((await more.count()) > 0) await more.click();
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-reminder-key]')].map((e) => e.dataset['reminderKey']).sort());
};

for (const mode of ['install', 'fixed'] as const) {
  test(`US-E7-05/AC2 [${mode}] opened 2026-11-03 21:00 JST: the 11-04 day-before reminder shows, labelled with its original 17:30; the weekly of 11-01 is the one other reminder`, async ({ page }) => {
    await open(page, '2026-11-03T12:00:00Z', mode);
    expect(await keys(page)).toEqual(['day-before:2026-11-04', 'weekly:2026-11-02']);
    const banner = page.getByTestId('reminder-day-before-2026-11-04');
    await expect(banner.getByTestId('reminder-missed')).toContainText('17:30');
    await expect(banner.getByTestId('reminder-missed')).toContainText('11月3日');
  });

  test(`US-E7-05/AC2 [${mode}] first opened 2026-11-04 07:00 JST: the 11-04 day-before reminder is expired and not shown`, async ({ page }) => {
    await open(page, '2026-11-03T22:00:00Z', mode);
    expect(await keys(page)).toEqual(['weekly:2026-11-02']);
  });

  test(`US-E7-05/AC3 [${mode}] of several weekly reminders only the most recent unexpired one shows: 11-08 13:59 JST the 11-01 one, from 11-08 14:00 only the 11-08 one`, async ({ page, context }) => {
    await open(page, '2026-11-08T04:59:00Z', mode);
    expect((await keys(page)).filter((k) => k?.startsWith('weekly'))).toEqual(['weekly:2026-11-02']);
    const p2 = await context.newPage();
    await open(p2, '2026-11-08T05:01:00Z', mode);
    expect((await keys(p2)).filter((k) => k?.startsWith('weekly'))).toEqual(['weekly:2026-11-09']);
  });
}

test('BR-17 the reminders follow the injected clock, not the system clock: 2030-06-02 14:05 JST shows no 2026 reminder and the in-page Date is the fake one', async ({ page }) => {
  await open(page, '2030-06-02T05:05:00Z', 'fixed');
  expect(await page.evaluate(() => Date.now())).toBe(Date.parse('2030-06-02T05:05:00Z'));
  expect(await keys(page)).toEqual(['weekly:2030-06-03']);
});

test('clock: setFixedTime freezes Date.now (timers still run), so reminder evaluation cannot drift with the system time', async ({ page }) => {
  await open(page, '2026-11-03T12:00:00Z', 'fixed');
  const a = await page.evaluate(() => Date.now());
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => Date.now())).toBe(a);
});

test('US-E7-05/AC2 US-E1-01 first launch at 2026-10-28 10:00 JST (the m1-import clock) deterministically shows the weekly 10-25 reminder as MISSED once the profile exists (BR-17); this is the banner axe meets', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
  await page.goto('./');
  await page.getByTestId('input-nickname').fill('a');
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('ob-next').click();
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('reminder-weekly-2026-10-26')).toBeVisible();
  await expect(page.getByTestId('reminder-missed')).toContainText('10月25日（日） 14:00のお知らせ');
  await expect(page.getByTestId('reminder-list')).toHaveCount(1);
});

test('root cause of the intermittent axe failure: the banner fades in over 200 ms (opacity 0 to 1); axe measured mid-fade reports color-contrast, settled it does not', async ({ page }) => {
  await open(page, '2026-11-03T12:00:00Z', 'fixed');
  const contrast = async () => {
    const r = await new AxeBuilder({ page }).options({ runOnly: ['color-contrast'] }).analyze();
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').flatMap((v) => v.nodes.map((n) => n.target.join(' ')));
  };
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  expect(await contrast()).toEqual([]);
  // Hold the banner's fade half-way: what a slow or loaded run can hit.
  const midFade = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.reminder');
    if (el === null) return null;
    const a = el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 200 });
    a.pause();
    a.currentTime = 0;
    return getComputedStyle(el).opacity;
  });
  expect(Number(midFade)).toBeLessThan(1);
  const during = await contrast();
  console.log('mid-fade contrast nodes:', during.join(' | '));
  expect(during.length, 'mid-fade color-contrast violations (documents the mechanism)').toBeGreaterThan(0);
});

test('measurement: axe run right after a banner mounts (no wait for the fade) hits the fade on some loads; reported, not asserted', async ({ page }) => {
  await open(page, '2026-11-03T12:00:00Z', 'fixed');
  let hit = 0;
  const trials = 12;
  for (let i = 0; i < trials; i += 1) {
    await page.reload();
    await expect(page.getByTestId('reminder-day-before-2026-11-04')).toBeVisible();
    const r = await new AxeBuilder({ page }).options({ runOnly: ['color-contrast'] }).analyze();
    if (r.violations.some((v) => v.impact === 'serious' || v.impact === 'critical')) hit += 1;
  }
  console.log(`M5 fade race: ${hit} of ${trials} immediate axe runs saw a color-contrast violation`);
  expect(trials).toBe(12);
});
