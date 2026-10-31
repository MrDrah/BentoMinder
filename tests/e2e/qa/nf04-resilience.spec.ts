// QA: US-NF-04 AC1 (everything except import works with the AI adapter down) and AC3 (60 s extraction timeout).
// "Down" = every /api/** request is aborted at the network layer. Run with playwright.h4.config.ts.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FX01, fillProfile, readStore } from './helpers.ts';

const jst = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+09:00`);
const cell = (page: Page, d: string) => page.getByTestId(`cal-cell-${d}`);

/** The November fixture with a real library recipe planned on 11-04 (as the M4 suites do). */
function state(): string {
  const s = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8'));
  const d = s.decisions['2026-11-04'];
  d.recipeId = 'rcp-delish-himawari-bento';
  d.recipeNameSnapshot = { ja: 'ひまわり弁当', en: 'Sunflower bento (himawari bento)' };
  d.recipeShortNameSnapshot = { ja: 'ひまわり弁当', en: 'Himawari' };
  return JSON.stringify(s);
}

async function down(page: Page): Promise<string[]> {
  const blocked: string[] = [];
  await page.route('**/api/**', (route) => {
    blocked.push(route.request().url());
    return route.abort('connectionrefused');
  });
  return blocked;
}

test('US-NF-04/AC1 with the adapter down: calendar, assessment, decisions, recommendations, reminders, share and export all work', async ({ page }) => {
  const blocked = await down(page);
  await page.clock.install({ time: new Date(jst('2026-11-03', '17:29')) });
  await page.addInitScript((s) => window.localStorage.setItem('bentominder.state', s), state());
  await page.goto('./');

  // calendar and assessment
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  await expect(cell(page, '2026-11-12')).toHaveAttribute('data-assessment', 'low-preference');

  // reminders (day-before fires at 17:30 JST)
  await page.clock.fastForward('02:00');
  await expect(page.getByTestId('reminder-day-before-2026-11-04')).toContainText('明日は手作りお弁当の日！レシピを確認しましょう。');

  // recommendations and a decision
  await cell(page, '2026-11-12').getByRole('button').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await page.getByTestId('day-action-bento').click();
  await expect(page.getByTestId('recs-list').locator('[data-recipe-id]')).toHaveCount(3);
  await page.getByTestId('rec-card-0-confirm').click();
  await expect(cell(page, '2026-11-12')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  expect((await readStore(page)).decisions['2026-11-12'].state).toBe('homemade-bento-planned');

  // sharing
  if (await page.getByTestId('day-sheet-close').isVisible().catch(() => false)) await page.getByTestId('day-sheet-close').click();
  await page.getByTestId('share-button').click();
  await expect(page.getByTestId('share-preview')).toContainText('【BentoMinder】');
  await page.keyboard.press('Escape');

  // export
  await page.goto('./#/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('data-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^bentominder-export-/);

  // the app never needed the adapter for any of this
  expect(blocked.filter((u) => u.includes('/api/menu/extract'))).toEqual([]);
});

test('US-NF-04/AC1 with the adapter down, importing says the service is unavailable, offers the other paths and leaves stored data alone', async ({ page }) => {
  await down(page);
  await page.goto('./');
  await fillProfile(page);
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('import-error')).toContainText('読み取りサービスに接続できませんでした');
  await expect(page.getByTestId('import-manual')).toBeVisible();
  expect((await readStore(page)).menus).toEqual({});
});

// D-H4-01: no 60 s extraction timeout exists on the client (the web extractor only forwards the caller's signal; the import
// screen sets no timer) or in the server transport. A hanging adapter leaves the import spinning forever.
// Expected failure (test.fail) until it is built; it turns red when fixed so the marker is removed then.
test.fail('US-NF-04/AC3 D-H4-01 an extraction request that hangs is abandoned after 60 s and shown as unavailable', async ({ page }) => {
  await page.clock.install({ time: new Date(jst('2026-10-28', '10:00')) });
  await page.route('**/api/menu/extract**', () => new Promise(() => undefined)); // never answers
  await page.goto('./');
  await fillProfile(page);
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('import-progress')).toBeVisible();
  await page.clock.fastForward(59_000);
  await expect(page.getByTestId('import-error')).toHaveCount(0); // not yet
  await page.clock.fastForward(2_000); // 61 s in
  await expect(page.getByTestId('import-error')).toContainText('読み取りサービスに接続できませんでした', { timeout: 5_000 });
});
