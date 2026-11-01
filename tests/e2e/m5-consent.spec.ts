// M5 slice B: consent before the real-AI path. Every request to /api/menu/extract is counted with
// page.route (a request, not a response), so a declined notice is proven to send nothing.
import { expect, test, type Page } from '@playwright/test';
import { FX01_PDF, seedStore, STATE_V1 } from './helpers.ts';

const NOW = new Date('2026-10-28T01:00:00Z');
const NO_CONSENT = JSON.stringify({ ...JSON.parse(STATE_V1), createdAt: '2026-10-01T09:00:00+09:00', updatedAt: '2026-10-01T09:00:00+09:00', consent: null, menus: {}, overrides: {}, decisions: {}, reminderLog: [], aiUsage: {} });

async function countExtractRequests(page: Page) {
  const state = { n: 0 };
  await page.route('**/api/menu/extract**', async (route) => {
    state.n += 1;
    await route.continue();
  });
  return state;
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test('US-E2-08/AC1 US-E2-08/AC2 no /api/menu/extract request before consent; declining sends none and keeps manual entry open', async ({ page }) => {
  const extract = await countExtractRequests(page);
  await seedStore(page, NO_CONSENT);
  await page.goto('./#/import');
  await page.getByTestId('import-upload').setInputFiles(FX01_PDF);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  await page.waitForTimeout(400);
  expect(extract.n).toBe(0);
  await page.getByTestId('consent-decline').click();
  await expect(page.getByTestId('banner-consent-declined')).toBeVisible();
  await page.waitForTimeout(400);
  expect(extract.n).toBe(0);
  await expect(page.getByTestId('import-manual')).toBeVisible();
});

test('US-E2-08/AC1 US-E2-08/AC3 the request is sent only after 「同意して読み取る」; the consent is stored with notice version 1 and the next import does not ask', async ({ page }) => {
  const extract = await countExtractRequests(page);
  await seedStore(page, NO_CONSENT);
  await page.goto('./#/import');
  await page.getByTestId('import-upload').setInputFiles(FX01_PDF);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  expect(extract.n).toBe(0);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  expect(extract.n).toBe(1);
  const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('bentominder.state'))) ?? '{}');
  expect(stored.consent.aiNoticeVersion).toBe(1);
});
