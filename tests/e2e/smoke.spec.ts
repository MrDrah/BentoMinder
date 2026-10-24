// M0 smoke on the production build (vite preview), both projects in a non-JST timezone and an
// en-US browser locale on purpose (BR-15, BR-23). Time comes from page.clock, never the debug panel.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// 2026-11-15 00:30 JST = 2026-11-14 16:30 in Paris, 07:30 in Los Angeles.
const TOKYO_JUST_AFTER_MIDNIGHT = new Date('2026-11-14T15:30:00Z');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TOKYO_JUST_AFTER_MIDNIGHT);
});

test('US-E8-01/AC1 opens in Japanese whatever the browser language', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByTestId('lang-toggle-ja')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: '次の月' })).toBeVisible();
});

test('US-E8-01/AC2 one tap switches to EN and one tap back, without reload', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('cal-title')).toHaveText('November 2026');
  await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible();
  await page.getByTestId('lang-toggle-ja').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
});

test('US-E8-01/AC3 the language choice survives a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.getByTestId('cal-title')).toHaveText('November 2026');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('US-E5-01/AC1 opens on the current Tokyo month with the Tokyo date marked as today', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  await expect(page.getByTestId('cal-cell-2026-11-15')).toHaveAttribute('aria-current', 'date');
  await expect(page.getByTestId('cal-cell-2026-11-14')).not.toHaveAttribute('aria-current', 'date');
});

test('US-E5-01/AC1 at Tokyo month change the next month opens even though the device is still in the old one', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-30T15:30:00Z')); // 2026-12-01 00:30 JST
  await page.goto('./');
  await expect(page.getByTestId('cal-title')).toHaveText('2026年12月');
  await expect(page.getByTestId('cal-cell-2026-12-01')).toHaveAttribute('aria-current', 'date');
});

test('the calendar shell has no serious or critical axe violations in ja and en', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  for (const lang of ['ja', 'en'] as const) {
    await page.getByTestId(`lang-toggle-${lang}`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});

test('the production build has no debug UI (BR-24)', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('debug-open')).toHaveCount(0);
  await page.goto('./#/debug');
  await expect(page.getByTestId('screen-not-found')).toBeVisible();
});
