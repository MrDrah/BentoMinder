// The recipe library is its own lazy chunk (dist/assets/library/library-<hash>.js). The calendar never waits for it;
// the screens that need recipes show a skeleton, then the data, or a retry state when the request fails; once loaded
// they work offline. Today is 2026-11-02 10:00 JST. (A loading-behaviour rule recorded in docs/PLAN.md, not a story.)
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedStore } from './helpers.ts';

const STATE = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');
const CHUNK = '**/assets/library/*.js';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T01:00:00Z'));
});

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('lazy library: the home renders and is interactive while the library request is blocked', async ({ page }) => {
  let released = false;
  await page.route(CHUNK, async (route) => {
    while (!released) await new Promise((r) => setTimeout(r, 50));
    await route.continue();
  });
  await seedStore(page, STATE);
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  await page.getByTestId('cal-cell-2026-11-12').getByRole('button').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await expect(page.getByTestId('day-action-bento')).toBeVisible();
  released = true;
});

test('lazy library: the recipe list and a recipe page show a skeleton, then the data (no empty-state flash)', async ({ page }) => {
  const errors = watchErrors(page);
  let released = false;
  await page.route(CHUNK, async (route) => {
    while (!released) await new Promise((r) => setTimeout(r, 50));
    await route.continue();
  });
  await seedStore(page, STATE);
  await page.goto('./#/recipes');
  await expect(page.getByTestId('library-skeleton')).toBeVisible();
  await expect(page.getByTestId('library-empty')).toHaveCount(0);
  await expect(page.getByTestId('library-list')).toHaveCount(0);
  released = true;
  await expect(page.getByTestId('library-list')).toBeVisible();
  await expect(page.getByTestId('library-skeleton')).toHaveCount(0);
  const first = await page.locator('[data-testid^="library-row-"][data-testid$="-link"]').first().getAttribute('href');
  expect(first).toContain('#/recipe/');

  // A recipe page opened cold shows the skeleton, never "recipe not found".
  released = false;
  await page.unroute(CHUNK);
  await page.route(CHUNK, async (route) => {
    while (!released) await new Promise((r) => setTimeout(r, 50));
    await route.continue();
  });
  await page.goto(`./${first}`);
  await page.reload();
  await expect(page.getByTestId('library-skeleton')).toBeVisible();
  await expect(page.getByTestId('recipe-not-found')).toHaveCount(0);
  released = true;
  await expect(page.locator('[data-testid="screen-recipe"][data-recipe-id]')).toBeVisible();
  await expect(page.getByTestId('recipe-not-found')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('lazy library: a failed request shows a plain retry state and retry works', async ({ page }) => {
  await page.route(CHUNK, (route) => route.abort('failed'));
  await seedStore(page, STATE);
  await page.goto('./#/recipes');
  await expect(page.getByTestId('library-error')).toBeVisible();
  await expect(page.getByTestId('library-empty')).toHaveCount(0);
  await page.unroute(CHUNK);
  await page.getByTestId('library-retry').click();
  await expect(page.getByTestId('library-list')).toBeVisible();
  await expect(page.getByTestId('library-error')).toHaveCount(0);
});

test('lazy library: after the first load the library screens work offline, with no console errors', async ({ page, context }) => {
  const errors = watchErrors(page);
  await seedStore(page, STATE);
  const chunk = page.waitForResponse((r) => /\/assets\/library\/library-.*\.js/.test(r.url()));
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  await chunk; // started on idle after first paint, without any visit to a recipe screen
  // The first look at the recipe screens happens online (that also fetches the lazy dish illustrations); then the network goes.
  const art = page.waitForResponse((r) => r.url().includes('/assets/dish-art-'));
  await page.evaluate(() => {
    window.location.hash = '#/recipes';
  });
  await expect(page.getByTestId('library-list')).toBeVisible();
  await art;
  await page.waitForTimeout(300);
  await context.setOffline(true);
  await page.evaluate(() => {
    window.location.hash = '#/';
  });
  await page.evaluate(() => {
    window.location.hash = '#/recipes';
  });
  await expect(page.getByTestId('library-list')).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = '#/';
  });
  await page.getByTestId('cal-cell-2026-11-12').getByRole('button').click();
  await page.getByTestId('day-action-bento').click();
  await expect(page.getByTestId('screen-recs')).toBeVisible();
  // Offline, assets the visit never needed before (dish illustrations, extra font slices) cannot load; that is not a script error.
  expect(errors.filter((e) => !/Failed to load resource: net::ERR_INTERNET_DISCONNECTED/.test(e))).toEqual([]);
});
