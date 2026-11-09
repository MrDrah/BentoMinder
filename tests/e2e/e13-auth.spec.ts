// US-E13: the sign-in wall, session, sign-out and per-account data, against the e2e build whose sign-in is the fake
// (src/adapters/web/e2e-auth.ts). No request may go to Google or Firebase (US-E13-07/AC3).
import { expect, test, type Page } from '@playwright/test';
import { expectNoSeriousAxe, STATE_V1 } from './helpers.ts';

const USER_A = { uid: 'test-uid-001', displayName: 'Test Parent', email: 'parent@example.test', photoUrl: null };
const USER_B = { uid: 'test-uid-002', displayName: 'Other Parent', email: 'other@example.test', photoUrl: null };

/** Sets localStorage keys once per tab (a reload keeps what the app wrote since). */
async function seed(page: Page, entries: Record<string, string>): Promise<void> {
  await page.addInitScript((e) => {
    if (window.sessionStorage.getItem('e13-seeded') !== null) return;
    window.sessionStorage.setItem('e13-seeded', '1');
    for (const [k, v] of Object.entries(e)) window.localStorage.setItem(k, v);
  }, entries);
}

function watchExternalRequests(page: Page): string[] {
  const hits: string[] = [];
  page.on('request', (r) => {
    if (/google|gstatic|firebase|googleapis/i.test(new URL(r.url()).hostname)) hits.push(r.url());
  });
  return hits;
}

const stored = (page: Page, key: string) => page.evaluate((k) => window.localStorage.getItem(k), key);

test.describe('E13 sign-in', () => {
  test('US-E13-01/AC1 AC3 AC5 US-E13-07/AC3 first run: only the login screen, no window before a tap, accessible in light and dark', async ({ page }) => {
    const external = watchExternalRequests(page);
    await seed(page, { 'bentominder.fake-auth': 'signed-out' });
    await page.goto('/#/day/2026-11-13');
    await expect(page.getByTestId('screen-login')).toBeVisible();
    await expect(page.getByTestId('login-google')).toBeVisible();
    await expect(page.getByTestId('login-lang')).toBeVisible();
    await expect(page.getByTestId('screen-calendar')).toHaveCount(0);
    await expect(page.getByTestId('appbar')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expectNoSeriousAxe(page, 'login light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectNoSeriousAxe(page, 'login dark');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('login-google')).toBeFocused();
    expect(external).toEqual([]);
  });

  test('US-E13-01/AC2 AC4 sign-in keeps the deep link and lands in onboarding for a new account', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': 'signed-out' });
    await page.goto('/#/settings');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-onboarding')).toBeVisible();
  });

  test('US-E13-02/AC1 reload stays signed in', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': 'signed-out' });
    await page.goto('/');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-onboarding')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('screen-onboarding')).toBeVisible();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
  });

  test('US-E13-02/AC2 the splash shows while the session is read, never the login screen', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': JSON.stringify(USER_A), 'bentominder.fake-auth-delay': '1500' });
    await page.goto('/');
    await expect(page.getByTestId('screen-restoring')).toBeVisible();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    await expect(page.getByTestId('screen-onboarding')).toBeVisible({ timeout: 10_000 });
  });

  test('US-E13-03/AC1 AC2 cancelling shows nothing; a blocked pop-up shows the message; then it works', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': 'signed-out', 'bentominder.fake-auth-script': JSON.stringify(['cancelled', 'popupBlocked', 'ok']) });
    await page.goto('/');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('login-google')).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('login-error')).toBeEmpty();
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('login-error')).toContainText('ポップアップ');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-onboarding')).toBeVisible();
  });

  test('US-E13-05 US-E13-04/AC3 sign-out keeps the data and signing in again restores it', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': 'signed-out', 'bentominder.state': STATE_V1 });
    await page.goto('/');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    // US-E13-04/AC1: the old unkeyed data was adopted by this account.
    expect(await stored(page, 'bentominder.state')).toBeNull();
    expect(await stored(page, 'bentominder.test-uid-001.state')).toContain('はなちゃん');

    await page.goto('/#/settings');
    await expect(page.getByTestId('account-name')).toHaveText('Test Parent');
    await page.getByTestId('account-sign-out').click();
    await expect(page.getByTestId('dialog-sign-out-cancel')).toBeFocused();
    await page.getByTestId('dialog-sign-out-confirm').click();
    await expect(page.getByTestId('screen-login')).toBeVisible();
    expect(await stored(page, 'bentominder.test-uid-001.state')).toContain('はなちゃん');

    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-calendar').or(page.getByTestId('screen-settings'))).toBeVisible();
    expect(await stored(page, 'bentominder.test-uid-001.state')).toContain('はなちゃん');
  });

  test('US-E13-04/AC2 AC4 a second account sees an empty app and the first account keeps its data', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': JSON.stringify(USER_A), 'bentominder.fake-auth-next': JSON.stringify(USER_B), 'bentominder.state': STATE_V1 });
    await page.goto('/#/settings');
    // Signed in as A at the start: the old data is adopted by A.
    await expect(page.getByTestId('account-name')).toHaveText('Test Parent');
    await page.getByTestId('account-sign-out').click();
    await page.getByTestId('dialog-sign-out-confirm').click();
    await expect(page.getByTestId('screen-login')).toBeVisible();
    await page.reload(); // the fake reads "who signs in next" when the page starts
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-onboarding')).toBeVisible();
    expect(await stored(page, 'bentominder.test-uid-001.state')).toContain('はなちゃん');
    expect(await stored(page, 'bentominder.test-uid-002.state')).toBeNull();
    await expect(page.locator('body')).not.toContainText('はなちゃん');
  });
});
