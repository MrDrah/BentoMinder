// UI refresh 2026-11, slice 1 (design/components.md §17): about disclosure, home order, 44 px targets, no horizontal
// scroll at 320 px, sticky action bar, and axe on the touched screens. Runs in both projects (390 and 1280 px).
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectNoSeriousAxe, seedStore } from './helpers.ts';

const STATE = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T01:00:00Z'));
  await seedStore(page, STATE);
});

test('US-NF-02/AC1 the about panel is closed on load, opens, passes axe, closes with Escape and returns the focus', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  const toggle = page.getByTestId('about-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('about-panel')).toBeHidden();
  const box = await toggle.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(page.getByTestId('about-panel')).toBeVisible();
  await expectNoSeriousAxe(page, 'calendar with about open');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('about-panel')).toBeHidden();
  await expect(toggle).toBeFocused();
  // closed again on every load
  await toggle.click();
  await page.reload();
  await expect(page.getByTestId('about-panel')).toBeHidden();
});

test('US-E5-01/AC1 the grid comes before the Today card, the legend is closed, and axe finds nothing serious with it open', async ({ page }) => {
  await page.goto('./');
  const grid = await page.getByTestId('cal-grid').boundingBox();
  const today = await page.getByTestId('today-card').boundingBox();
  expect((grid?.y ?? 0) + (grid?.height ?? 0)).toBeLessThanOrEqual(today?.y ?? 0);
  await expect(page.getByTestId('legend-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.getByTestId('legend-toggle').click();
  await expectNoSeriousAxe(page, 'calendar with legend open');
});

test('US-NF-02/AC1 no horizontal scroll at 320 px on the home, import and settings screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const hash of ['#/calendar', '#/import', '#/settings', '#/recipes']) {
    await page.goto(`./${hash}`);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, hash).toBeLessThanOrEqual(0);
  }
});

test('US-NF-02/AC1 the import primary button is in the action bar, and axe finds nothing serious on import and settings', async ({ page }) => {
  await page.goto('./#/import');
  await expect(page.getByTestId('import-submit')).toBeVisible();
  expect(await page.getByTestId('import-submit').evaluate((el) => el.closest('.action-bar') !== null)).toBe(true);
  await expectNoSeriousAxe(page, 'import');
  await page.goto('./#/settings');
  await expect(page.getByTestId('settings-profile-edit')).toBeVisible();
  await expectNoSeriousAxe(page, 'settings');
});
