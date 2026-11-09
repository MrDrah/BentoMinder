// E14 slice C: how the import screen shows the hosted proxy's answers (data contract 13.3). The real proxy is not
// involved: page.route answers the same-origin /api request with the documented reply shape, so this proves what the
// parent sees and that stored data stays byte-for-byte unchanged. The token and base-URL rules are unit-tested
// (tests/unit/ui/proxy-client.test.ts). The app starts in Japanese.
import { expect, test, type Page, type Route } from '@playwright/test';
import { FX01_PDF, seedStore, STATE_V1 } from './helpers.ts';

const NOW = new Date('2026-10-28T01:00:00Z');
const CONSENTED = JSON.stringify({ ...JSON.parse(STATE_V1), menus: {}, overrides: {}, decisions: {}, reminderLog: [], aiUsage: {} });
const NO_CONSENT = JSON.stringify({ ...JSON.parse(CONSENTED), consent: null });

const reply = (status: number, body: unknown) => (route: Route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const stored = (page: Page) => page.evaluate(() => window.localStorage.getItem('bentominder.state'));

async function openAndUpload(page: Page, extract: (route: Route) => Promise<void>, seed: string = CONSENTED) {
  const calls = { n: 0 };
  await page.route('**/api/menu/extract**', async (route) => {
    calls.n += 1;
    await extract(route);
  });
  await seedStore(page, seed);
  await page.goto('./#/import');
  const before = await stored(page);
  await page.getByTestId('import-upload').setInputFiles(FX01_PDF);
  return { calls, before };
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test('US-E14-08/AC3 US-E14-03/AC4 hour limit: message, upload and manual, a retry button that counts down; nothing stored', async ({ page }) => {
  const { calls, before } = await openAndUpload(page, reply(429, { ok: false, error: 'ACCOUNT_LIMIT', scope: 'hour', retryAfterSec: 120, providerCalls: 0 }));
  const panel = page.getByTestId('import-error');
  await expect(panel).toContainText('読み取りの回数が上限に達しました。1時間ほどしてからもう一度お試しください。');
  await expect(panel).not.toContainText('ACCOUNT_LIMIT');
  await expect(page.getByTestId('import-error-retry')).toContainText('あと');
  await expect(page.getByTestId('import-error-retry')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('import-upload')).toBeAttached();
  await expect(page.getByTestId('import-manual')).toBeVisible();
  expect(calls.n).toBe(1);
  expect(await stored(page)).toBe(before);
});

test('US-E14-08/AC3 US-E14-03/AC4 day limit: no retry button', async ({ page }) => {
  const { before } = await openAndUpload(page, reply(429, { ok: false, error: 'ACCOUNT_LIMIT', scope: 'day', retryAfterSec: 30000, providerCalls: 0 }));
  await expect(page.getByTestId('import-error')).toContainText('今日の読み取り回数の上限に達しました。明日もう一度お試しください。');
  await expect(page.getByTestId('import-error-retry')).toHaveCount(0);
  await expect(page.getByTestId('import-upload')).toBeAttached();
  await expect(page.getByTestId('import-manual')).toBeVisible();
  expect(await stored(page)).toBe(before);
});

test('US-E14-08/AC2 NOT_ALLOWED: manual entry only, no upload and no retry', async ({ page }) => {
  const { before } = await openAndUpload(page, reply(403, { ok: false, error: 'NOT_ALLOWED' }));
  await expect(page.getByTestId('import-error')).toContainText('このアカウントでは献立の読み取りを使えません。');
  await expect(page.getByTestId('import-error-retry')).toHaveCount(0);
  await expect(page.getByTestId('import-upload')).toHaveCount(0);
  await expect(page.getByTestId('import-manual')).toBeVisible();
  expect(await stored(page)).toBe(before);
  // Every other feature still works (US-NF-04/AC1): the manual path opens.
  await page.getByTestId('import-manual').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
});

test('US-E14-08/AC1 UNAUTHENTICATED: expired message with 「ログインし直す」, which signs out to the login screen', async ({ page }) => {
  const { before } = await openAndUpload(page, reply(401, { ok: false, error: 'UNAUTHENTICATED' }));
  await expect(page.getByTestId('import-error')).toContainText('ログインの有効期限が切れました。もう一度ログインしてください。');
  await expect(page.getByTestId('import-error-retry')).toHaveCount(0);
  await expect(page.getByTestId('import-upload')).toBeAttached();
  await expect(page.getByTestId('import-manual')).toBeVisible();
  expect(await stored(page)).toBe(before);
  await page.getByTestId('import-error-signin').click();
  await expect(page.getByTestId('screen-login')).toBeVisible();
});

test('US-E14-08/AC4 AC5 AC6 unreachable, origin refused, 5xx and an unknown reply all show the service-unreachable message with 「もう一度」', async ({ page }) => {
  const cases: Array<(route: Route) => Promise<void>> = [
    reply(403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' }),
    reply(503, { ok: false, error: 'UNAVAILABLE', providerCalls: 0 }),
    reply(502, { ok: false, error: 'TEAPOT' }),
    (route) => route.abort('failed'),
  ];
  for (const handler of cases) {
    const fresh = await page.context().newPage();
    const { calls, before } = await openAndUpload(fresh, handler);
    await expect(fresh.getByTestId('import-error')).toContainText('読み取りサービスに接続できませんでした');
    await expect(fresh.getByTestId('import-error')).not.toContainText('ORIGIN_NOT_ALLOWED');
    await expect(fresh.getByTestId('import-error-retry')).toBeVisible();
    await expect(fresh.getByTestId('import-upload')).toBeAttached();
    await expect(fresh.getByTestId('import-manual')).toBeVisible();
    expect(calls.n).toBe(1); // one request per tap
    expect(await stored(fresh)).toBe(before);
    await fresh.close();
  }
});

test('US-E14-08/AC3 US-E14-03/AC4 the URL fetch limit: message with the upload option and manual entry, no retry', async ({ page }) => {
  await page.route('**/api/menu/fetch-pdf', reply(429, { ok: false, error: 'ACCOUNT_LIMIT', scope: 'fetch', retryAfterSec: 600, providerCalls: 0 }));
  await seedStore(page, CONSENTED);
  await page.goto('./#/import');
  const before = await stored(page);
  await page.getByTestId('input-url').fill('https://school.example.test/menu.pdf');
  await page.getByTestId('import-submit').click();
  await expect(page.getByTestId('import-error')).toContainText('URLからの取得回数が上限に達しました。PDFをアップロードするか、しばらくしてからお試しください。');
  await expect(page.getByTestId('import-error-retry')).toHaveCount(0);
  await expect(page.getByTestId('import-upload')).toBeAttached();
  await expect(page.getByTestId('import-manual')).toBeVisible();
  expect(await stored(page)).toBe(before);
});

test('US-E14-06/AC5 declining the notice sends nothing to the proxy; the notice is still required first', async ({ page }) => {
  const { calls } = await openAndUpload(page, reply(200, { ok: false, error: 'NOT_A_MENU', providerCalls: 1 }), NO_CONSENT);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  expect(calls.n).toBe(0);
  await page.getByTestId('consent-decline').click();
  await expect(page.getByTestId('banner-consent-declined')).toBeVisible();
  await page.waitForTimeout(300);
  expect(calls.n).toBe(0);
});
