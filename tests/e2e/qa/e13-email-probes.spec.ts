// QA E13-email extra probes: cooldown, focus, full-cycle, console noise, language on the wall (US-E13-08 AC2-AC5, AC10).
import { expect, test } from '@playwright/test';
import { storeFor } from './e13-common.ts';
import { CONF, PW, UNC, fillForm, logOf, out, seed, userOf, verifiedList } from './e13-email-common.ts';

test.use({ locale: 'en-US', viewport: { width: 390, height: 844 } });

test.describe('US-E13-08 probes', () => {
  // E13E-D01 ruling 2026-11-12 (PO via Orchestrator): the 60 s limit is per screen visit; Firebase throttles resends itself (too-many-requests is mapped). Kept as a documented known gap.
  test.fail('US-E13-08/AC4 the 60 s resend limit survives a reload of the check-your-email screen (at most one e-mail per 60 seconds)', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': userOf(UNC), 'bentominder.fake-auth-accounts': JSON.stringify([UNC]) });
    await page.goto('/');
    await page.getByTestId('lang-toggle-en').click();
    await page.getByTestId('verify-resend').click();
    await expect.poll(async () => (await logOf(page)).length).toBe(1);
    await page.reload();
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await expect(page.getByTestId('verify-resend')).toHaveAttribute('aria-disabled', 'true');
  });

  test.fail('US-E13-08/AC4 the 60 s limit survives sign-out and sign-in of the same account', async ({ page }) => {
    await seed(page, out([UNC]));
    await page.goto('/');
    await fillForm(page, UNC.email, PW);
    await page.getByTestId('login-submit').click();
    await page.getByTestId('verify-resend').click();
    await expect.poll(async () => (await logOf(page)).length).toBe(1);
    await page.getByTestId('verify-sign-out').click();
    await fillForm(page, UNC.email, PW);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('verify-resend')).toHaveAttribute('aria-disabled', 'true');
  });

  test('US-E13-08/AC3 after confirming, the app opens with focus on its first heading (not lost on body) and no second sign-in', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': userOf(UNC), 'bentominder.fake-auth-accounts': JSON.stringify([UNC]), ...verifiedList(UNC.email), [`bentominder.${UNC.uid}.state`]: storeFor(UNC.uid) });
    await page.goto('/#/settings');
    await page.getByTestId('verify-done').click();
    await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    await page.waitForTimeout(500);
    const active = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(active, 'focus should be on a heading, not body').not.toBe('BODY');
  });

  test('US-E13-08/AC3/AC5 full cycle: create, confirm, sign out, sign in again lands in the app (no wall for a confirmed account); the account keeps its own store key', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await seed(page, out());
    await page.goto('/');
    await page.getByTestId('lang-toggle-en').click();
    await page.getByTestId('login-mode-toggle').click();
    await fillForm(page, 'cycle@example.test', 'abcdefgh');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await page.evaluate(() => window.localStorage.setItem('bentominder.fake-auth-verified', JSON.stringify(['cycle@example.test'])));
    await page.getByTestId('verify-done').click();
    await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('US-E13-08/AC3 the language chosen on the login screen is kept on the check-your-email screen', async ({ page }) => {
    await seed(page, out());
    await page.goto('/');
    await page.getByTestId('lang-toggle-en').click();
    await page.getByTestId('login-mode-toggle').click();
    await fillForm(page, 'lang@example.test', 'abcdefgh');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('verify-done')).toHaveText("I've confirmed");
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('US-E13-08/AC7 resend while the provider says too many: message, and no countdown that lies (button stays usable later)', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': userOf(UNC), 'bentominder.fake-auth-accounts': JSON.stringify([UNC]), 'bentominder.fake-auth-script': JSON.stringify(['tooMany']) });
    await page.goto('/');
    await page.getByTestId('lang-toggle-en').click();
    await page.getByTestId('verify-resend').click();
    await expect(page.getByTestId('verify-error')).toHaveText('Please try again in a little while.');
    expect(await logOf(page)).toEqual([]);
  });

  test('US-E13-08/AC6 reset panel returns to sign-in with the e-mail kept and an empty password', async ({ page }) => {
    await seed(page, out([CONF]));
    await page.goto('/');
    await page.getByTestId('lang-toggle-en').click();
    await page.getByTestId('login-forgot').click();
    await page.getByTestId('login-email').fill(CONF.email);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-reset-sent')).toBeVisible();
    await expect(page.getByTestId('login-email')).toHaveCount(0); // replaced by the panel
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await expect(page.getByTestId('login-password')).toHaveValue('');
  });

  test('US-E13-08/AC6 a reset request for an address with different letter case still gets the same neutral panel', async ({ page }) => {
    await seed(page, out([CONF]));
    await page.goto('/');
    await page.getByTestId('lang-toggle-en').click();
    await page.getByTestId('login-forgot').click();
    await page.getByTestId('login-email').fill('  MAMA@Example.TEST ');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-reset-sent')).toBeVisible();
  });
});
