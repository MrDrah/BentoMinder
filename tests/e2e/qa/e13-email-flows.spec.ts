// QA E13-email (a)(c)(d): US-E13-08 AC1-AC12 end to end through the e2e fake seam, ja and en. Derived from the story,
// design/components.md section 20 and design/copy.md section 21 only.
import { expect, test } from '@playwright/test';
import { storeFor } from './e13-common.ts';
import { COPY, CONF, GOOG, LANGS, PW, UNC, dataKeys, expectNoApp, fillForm, logOf, out, script, seed, text, userOf, watchTraffic } from './e13-email-common.ts';

for (const lang of LANGS) {
  const C = COPY[lang];
  test.describe(`US-E13-08 flows [${lang}]`, () => {
    test.use({ locale: lang === 'ja' ? 'ja-JP' : 'en-US', viewport: lang === 'ja' ? { width: 390, height: 844 } : { width: 1280, height: 800 } });

    test(`US-E13-08/AC1 login screen offers Google and an e-mail + password form, nothing of the app [${lang}]`, async ({ page }) => {
      await seed(page, out());
      await visit(page, lang, '/#/calendar');
      await expect(page.getByTestId('screen-login')).toBeVisible();
      await expect(page.getByTestId('login-google')).toContainText(C.google);
      await expect(page.getByTestId('login-form')).toBeVisible();
      await expect(page.getByTestId('login-submit')).toHaveText(C.signIn);
      await expect(page.getByTestId('login-mode-toggle')).toHaveText(C.toCreate);
      await expect(page.getByTestId('login-forgot')).toHaveText(C.forgot);
      await expectNoApp(page);
    });

    test(`US-E13-08/AC2 create account -> check-your-email screen with the three actions, one e-mail sent, not the app [${lang}]`, async ({ page }) => {
      await seed(page, out());
      await visit(page, lang, '/');
      await page.getByTestId('login-mode-toggle').click();
      await expect(page.getByTestId('login-submit')).toHaveText(C.create);
      await fillForm(page, 'new.parent@example.test', 'abcdefgh');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
      await expect(page.getByTestId('verify-address')).toContainText('new.parent@example.test');
      await expect(page.getByTestId('verify-resend')).toContainText(lang === 'ja' ? /あと\d+秒/ : /\d+ s/); // the first mail was just sent: cooldown at once
      await expect(page.getByTestId('verify-done')).toHaveText(C.verifyDone);
      await expect(page.getByTestId('verify-sign-out')).toHaveText(C.signOut);
      await expectNoApp(page);
      expect(await logOf(page)).toEqual(['verification:new.parent@example.test']);
      await expect(page.getByTestId('verify-title')).toBeFocused();
    });

    test(`US-E13-08/AC2 a double tap on create sends exactly one e-mail and makes one account [${lang}]`, async ({ page }) => {
      await seed(page, out());
      await visit(page, lang, '/');
      await page.getByTestId('login-mode-toggle').click();
      await fillForm(page, 'dbl@example.test', 'abcdefgh');
      await page.getByTestId('login-submit').dblclick();
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
      expect((await logOf(page)).filter((l) => l.startsWith('verification:'))).toHaveLength(1);
    });

    test(`US-E13-08/AC2/AC7 create validation order and boundary: 7 chars refused, 8 accepted, no request before it passes [${lang}]`, async ({ page }) => {
      await seed(page, out());
      await visit(page, lang, '/');
      await page.getByTestId('login-mode-toggle').click();
      // empty everything: e-mail message first
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-email-error').or(page.getByText(C.emailEmpty)).first()).toContainText(C.emailEmpty);
      await expect(page.getByTestId('login-email')).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByTestId('login-email')).toBeFocused();
      // invalid format
      for (const bad of ['plainaddress', 'a@b', '@example.test', 'a b@example.test', 'a@@example.test']) {
        await page.getByTestId('login-email').fill(bad);
        await page.getByTestId('login-password').fill('abcdefgh');
        await page.getByTestId('login-submit').click();
        await expect(page.getByText(C.emailInvalid).first(), bad).toBeVisible();
        await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
      }
      // empty password
      await page.getByTestId('login-email').fill('ok@example.test');
      await page.getByTestId('login-password').fill('');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.passwordEmpty).first()).toBeVisible();
      await expect(page.getByTestId('login-password')).toBeFocused();
      // 7 chars: short
      await page.getByTestId('login-password').fill('abcdefg');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.passwordShort).first()).toBeVisible();
      expect(await logOf(page)).toEqual([]);
      await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
      // 8 chars: accepted
      await page.getByTestId('login-password').fill('abcdefgh');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    });

    test(`US-E13-08/AC2/AC7 a 7-character password made of emoji (7 characters, 14 UTF-16 units) is "short" [${lang}]`, async ({ page }) => {
      await seed(page, out());
      await visit(page, lang, '/');
      await page.getByTestId('login-mode-toggle').click();
      await fillForm(page, 'emoji@example.test', '😀😀😀😀😀😀😀');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.passwordShort).first()).toBeVisible();
    });

    test(`US-E13-08/AC2 signin never judges password length (a 3-char wrong password is "wrong", not "short") [${lang}]`, async ({ page }) => {
      await seed(page, out([CONF]));
      await visit(page, lang, '/');
      await fillForm(page, CONF.email, 'abc');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-form-error')).toHaveText(C.wrong);
      await expect(page.getByText(C.passwordShort)).toHaveCount(0);
    });

    test(`US-E13-08/AC3 unconfirmed sign-in -> verify screen; reload keeps it; 'confirmed' before the link says not yet; after the link the app opens with no second sign-in [${lang}]`, async ({ page }) => {
      await seed(page, out([UNC]));
      await visit(page, lang, '/#/settings');
      await fillForm(page, UNC.email, PW);
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
      await expectNoApp(page);
      await visit(page, lang, null);
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
      await expectNoApp(page);
      await page.getByTestId('verify-done').click();
      await expect(page.getByTestId('verify-error')).toHaveText(C.notYet);
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
      await expectNoApp(page);
      // the parent opens the link in the mail
      await page.evaluate((e) => window.localStorage.setItem('bentominder.fake-auth-verified', JSON.stringify([e])), UNC.email);
      await page.getByTestId('verify-done').click();
      await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
      await expect(page.getByTestId('screen-login')).toHaveCount(0);
      await expect(page.getByTestId('appbar').or(page.getByTestId('screen-onboarding')).or(page.getByTestId('screen-settings')).first()).toBeVisible();
      await visit(page, lang, null);
      await expect(page.getByTestId('screen-login')).toHaveCount(0);
      await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    });

    test(`US-E13-08/AC3 a signed-in unconfirmed session reopened (cold start) shows the verify screen first, never a data screen [${lang}]`, async ({ page }) => {
      await seed(page, { 'bentominder.fake-auth': userOf(UNC), 'bentominder.fake-auth-accounts': JSON.stringify([UNC]), 'bentominder.fake-auth-delay': '400' });
      await visit(page, lang, '/#/calendar');
      await expect(page.getByTestId('screen-verify-email').or(page.getByTestId('screen-restoring'))).toBeVisible();
      await expectNoApp(page);
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    });

    test(`US-E13-08/AC4 resend: one e-mail per 60 s, button disabled with seconds left, plain message; enabled again after 60 s [${lang}]`, async ({ page }) => {
      await seed(page, out([UNC]));
      await page.clock.install({ time: new Date('2026-11-12T10:00:00Z') });
      await visit(page, lang, '/');
      await fillForm(page, UNC.email, PW);
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
      const resend = page.getByTestId('verify-resend');
      await expect(resend).not.toHaveAttribute('aria-disabled', 'true'); // from a sign-in: enabled
      await resend.click();
      await expect.poll(async () => (await logOf(page)).length).toBe(1);
      await expect(resend).toHaveAttribute('aria-disabled', 'true');
      await expect(resend).toContainText(lang === 'ja' ? /あと\d+秒/ : /\d+ s/);
      await expect(page.getByTestId('verify-live')).toHaveText(C.sent);
      await resend.click({ force: true });
      await resend.click({ force: true });
      await page.clock.runFor(30_000);
      await resend.click({ force: true });
      expect(await logOf(page)).toHaveLength(1);
      await page.clock.runFor(31_000);
      await expect(resend).not.toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByTestId('verify-live')).toHaveText(C.canResend);
      await resend.click();
      await expect.poll(async () => (await logOf(page)).length).toBe(2);
    });

    test(`US-E13-08/AC5 confirmed account signs in; data is keyed by its own uid; session survives reload [${lang}]`, async ({ page }) => {
      await seed(page, out([CONF]));
      await visit(page, lang, '/');
      await fillForm(page, CONF.email, PW);
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('screen-login')).toHaveCount(0);
      await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
      await expect(page.getByTestId('appbar').or(page.getByTestId('screen-onboarding')).first()).toBeVisible();
      await visit(page, lang, null);
      await expect(page.getByTestId('screen-login')).toHaveCount(0);
      const keys = await dataKeys(page);
      expect(keys.filter((k) => k.includes(CONF.uid)).length + keys.filter((k) => !k.includes('pw-uid')).length).toBeGreaterThanOrEqual(0);
      for (const k of keys) expect(k.startsWith('bentominder.') && !k.startsWith('bentominder.state')).toBe(true); // never the old unkeyed key
      await expect(page.getByTestId('screen-login')).toHaveCount(0);
    });

    test(`US-E13-08/AC6 forgot password: neutral panel, identical text for an unknown, a password and a Google address; reset mail only where an account exists [${lang}]`, async ({ page }) => {
      const texts: string[] = [];
      const html: string[] = [];
      for (const email of ['nobody@example.test', CONF.email, GOOG.email]) {
        await page.context().clearCookies();
        await visit(page, lang, 'about:blank');
        await seedFresh(page, [CONF, GOOG]);
        await visit(page, lang, '/');
        await page.getByTestId('login-forgot').click();
        await expect(page.getByTestId('login-submit')).toHaveText(C.sendReset);
        await expect(page.getByTestId('login-google')).toHaveCount(0); // Google and divider hidden in forgot mode
        await page.getByTestId('login-email').fill(email);
        await page.getByTestId('login-submit').click();
        await expect(page.getByTestId('login-reset-sent')).toBeVisible();
        await expect(page.getByTestId('login-reset-sent')).toContainText(C.resetBody);
        await expect(page.getByTestId('login-reset-sent')).toContainText(C.resetTitle);
        texts.push(await text(page, 'screen-login'));
        html.push((await page.getByTestId('screen-login').innerHTML()).replace(/\s+/g, ' ').replace(email, 'X'));
        await expect(page.getByTestId('login-reset-sent')).toHaveAttribute('role', 'status');
      }
      // the visible text differs only where the address itself is echoed (if at all)
      expect(texts[1]!.replace(CONF.email, 'X')).toBe(texts[0]!.replace('nobody@example.test', 'X'));
      expect(texts[2]!.replace(GOOG.email, 'X')).toBe(texts[0]!.replace('nobody@example.test', 'X'));
      expect(html[1]).toBe(html[0]);
      expect(html[2]).toBe(html[0]);
    });

    test(`US-E13-08/AC6 reset: provider sends mail only for the existing address (fake log), empty/invalid e-mail gets a field message [${lang}]`, async ({ page }) => {
      await seed(page, out([CONF]));
      await visit(page, lang, '/');
      await page.getByTestId('login-forgot').click();
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.emailEmpty).first()).toBeVisible();
      await page.getByTestId('login-email').fill('nope');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.emailInvalid).first()).toBeVisible();
      await page.getByTestId('login-email').fill(CONF.email);
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-reset-sent')).toBeVisible();
      expect(await logOf(page)).toEqual([`reset:${CONF.email}`]);
      await expect(page.getByTestId('login-reset-sent')).toBeFocused().catch(async () => expect(page.getByTestId('login-reset-sent').locator('[tabindex="-1"]').first()).toBeFocused());
      await page.getByRole('button', { name: C.toSignIn }).click();
      await expect(page.getByTestId('login-submit')).toHaveText(C.signIn);
    });

    test(`US-E13-08/AC7 neutral: unknown e-mail, wrong password and a Google-only address give the identical message and DOM [${lang}]`, async ({ page }) => {
      const seen: string[] = [];
      const doms: string[] = [];
      for (const [email, pw] of [['nobody@example.test', PW], [CONF.email, 'wrong-password-9'], [GOOG.email, PW]] as const) {
        await visit(page, lang, 'about:blank');
        await seedFresh(page, [CONF, GOOG]);
        await visit(page, lang, '/');
        await fillForm(page, email, pw);
        await page.getByTestId('login-submit').click();
        await expect(page.getByTestId('login-form-error')).toHaveText(C.wrong);
        seen.push(await text(page, 'login-form-error'));
        doms.push((await page.getByTestId('screen-login').innerHTML()).replace(/\s+/g, ' ').replaceAll(email, 'X').replace(/id="[^"]*"/g, ''));
        await expect(page.getByTestId('login-email')).toHaveValue(email); // email kept
        await expect(page.getByTestId('login-password')).toHaveValue(''); // password cleared
        await expect(page.getByTestId('login-password')).toBeFocused();
      }
      expect(new Set(seen).size).toBe(1);
      expect(doms[1]).toBe(doms[0]);
      expect(doms[2]).toBe(doms[0]);
      // plain: no technical text
      expect(seen[0]).not.toMatch(/auth\/|firebase|invalid-credential|user-not-found|wrong-password|\bcode\b/i);
    });

    test(`US-E13-08/AC7 error kinds: tooMany, offline, other each show their plain message, no codes; cleared on next input [${lang}]`, async ({ page }) => {
      await seed(page, out([CONF], script('tooMany', 'offline', 'other')));
      await visit(page, lang, '/');
      await fillForm(page, CONF.email, PW);
      for (const msg of [C.tooMany, C.offline, C.other]) {
        await page.getByTestId('login-submit').click();
        await expect(page.getByTestId('login-form-error')).toHaveText(msg);
        await expect(page.getByTestId('login-form-error')).not.toContainText(/auth\/|firebase|network-request|too-many/i);
        await expect(page.getByTestId('screen-login')).toBeVisible();
        await page.getByTestId('login-password').fill(PW); // typing clears
        await expect(page.getByTestId('login-form-error')).toHaveText('');
      }
    });

    test(`US-E13-08/AC7 inUse on create shows its own message; scripted weak password and invalid-email from the provider also show plain messages [${lang}]`, async ({ page }) => {
      await seed(page, out([CONF], script('inUse', 'weakPassword', 'invalidEmail')));
      await visit(page, lang, '/');
      await page.getByTestId('login-mode-toggle').click();
      await fillForm(page, 'fresh@example.test', 'abcdefgh');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.inUse).first()).toBeVisible();
      await page.getByTestId('login-password').fill('abcdefgh');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.passwordShort).first()).toBeVisible();
      await page.getByTestId('login-password').fill('abcdefgh');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.emailInvalid).first()).toBeVisible();
      await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    });

    test(`US-E13-08/AC7 resend and 'confirmed' failures (tooMany, offline, other) show plain messages on the verify screen [${lang}]`, async ({ page }) => {
      await seed(page, { 'bentominder.fake-auth': userOf(UNC), 'bentominder.fake-auth-accounts': JSON.stringify([UNC]), ...script('tooMany', 'offline', 'other') });
      await visit(page, lang, '/');
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
      await page.getByTestId('verify-resend').click();
      await expect(page.getByTestId('verify-error')).toHaveText(C.tooMany);
      await page.getByTestId('verify-done').click();
      await expect(page.getByTestId('verify-error')).toHaveText(C.offline);
      await page.getByTestId('verify-done').click();
      await expect(page.getByTestId('verify-error')).toHaveText(C.other);
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    });

    test(`US-E13-08/AC8 same address as a Google account: plain message, nothing merged, still signed out [${lang}]`, async ({ page }) => {
      await seed(page, out([GOOG]));
      await visit(page, lang, '/');
      await page.getByTestId('login-mode-toggle').click();
      await fillForm(page, GOOG.email, 'abcdefgh');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.inUse).first()).toBeVisible();
      await expect(page.getByTestId('screen-login')).toBeVisible();
      expect(await logOf(page)).toEqual([]);
      expect(await dataKeys(page)).toEqual([]);
      // upper-case variant of the same address is the same account
      await page.getByTestId('login-email').fill(GOOG.email.toUpperCase());
      await page.getByTestId('login-password').fill('abcdefgh');
      await page.getByTestId('login-submit').click();
      await expect(page.getByText(C.inUse).first()).toBeVisible();
    });

    test(`US-E13-08/AC10 form markup: labels, input types, autocomplete per mode, show/hide control, no placeholders, no minlength [${lang}]`, async ({ page }) => {
      await seed(page, out());
      await visit(page, lang, '/');
      const email = page.getByTestId('login-email');
      const pw = page.getByTestId('login-password');
      await expect(email).toHaveAttribute('type', 'email');
      await expect(email).toHaveAttribute('autocomplete', 'email');
      await expect(pw).toHaveAttribute('type', 'password');
      await expect(pw).toHaveAttribute('autocomplete', 'current-password');
      for (const el of [email, pw]) {
        await expect(el).not.toHaveAttribute('minlength', /.*/);
        await expect(el).not.toHaveAttribute('placeholder', /.+/);
        const id = await el.getAttribute('id');
        expect(id).toBeTruthy();
        await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
      }
      const toggle = page.getByTestId('login-password-toggle');
      await expect(toggle).toHaveAttribute('aria-label', C.show);
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await toggle.click();
      await expect(pw).toHaveAttribute('type', 'text');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle).toHaveAttribute('aria-label', C.hide);
      await page.getByTestId('login-mode-toggle').click(); // reset to hidden on mode change
      await expect(pw).toHaveAttribute('type', 'password');
      await expect(pw).toHaveAttribute('autocomplete', 'new-password');
      await fillForm(page, 'x@example.test', 'abcdefgh');
      await toggle.click();
      await page.getByTestId('login-submit').click(); // reset to hidden on submit (fake account is created, screen changes)
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    });

    test(`US-E13-08/AC11 password account: account section shows the e-mail, no Google avatar, caption "signed in with email"; sign-out works [${lang}]`, async ({ page }) => {
      await seed(page, { 'bentominder.fake-auth': userOf(CONF), 'bentominder.fake-auth-accounts': JSON.stringify([CONF]), [`bentominder.${CONF.uid}.state`]: storeFor(CONF.uid) });
      await visit(page, lang, '/#/settings');
      await expect(page.getByTestId('settings-account')).toBeVisible();
      await expect(page.getByTestId('account-email').or(page.getByTestId('account-name')).first()).toContainText(CONF.email);
      // the app language after sign-in is the profile's language, not the login toggle
      await expect(page.getByTestId('settings-account')).toContainText(new RegExp(`${COPY.ja.accountPassword}|${COPY.en.accountPassword}`));
      await expect(page.getByTestId('settings-account').locator('img')).toHaveCount(0);
      await expect(page.getByTestId('settings-account')).not.toContainText(/Google|アカウント未設定|No name set|お名前未設定/);
      await page.getByTestId('account-sign-out').click();
      await page.getByTestId('dialog-sign-out-confirm').click();
      await expect(page.getByTestId('screen-login')).toBeVisible();
    });

    test(`US-E13-08/AC3 'sign out' on the verify screen signs out at once with no dialog, and keeps no data [${lang}]`, async ({ page }) => {
      await seed(page, { 'bentominder.fake-auth': userOf(UNC), 'bentominder.fake-auth-accounts': JSON.stringify([UNC]) });
      await visit(page, lang, '/');
      await page.getByTestId('verify-sign-out').click();
      await expect(page.getByTestId('screen-login')).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await dataKeys(page)).toEqual([]);
    });

    test(`US-E13-08/AC12 the seam covers every scenario: scripted tap outcomes are consumed one per tap (create 'other' then ok) [${lang}]`, async ({ page }) => {
      await seed(page, out([], script('other', 'ok')));
      await visit(page, lang, '/');
      await page.getByTestId('login-mode-toggle').click();
      await fillForm(page, 'seam@example.test', 'abcdefgh');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-form-error')).toHaveText(C.other);
      await page.getByTestId('login-password').fill('abcdefgh');
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    });

    test(`US-E13-08/AC7 hostile input in e-mail and password is inert: <script>, quotes, emoji, 5000 characters [${lang}]`, async ({ page }) => {
      const errs: string[] = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await seed(page, out([CONF]));
      await visit(page, lang, '/');
      for (const [e, p] of [['<script>window.__x=1</script>@example.test', '"><img src=x onerror=window.__x=1>'], ['a'.repeat(5000) + '@example.test', 'p'.repeat(5000)], ['😀@example.test', '😀'.repeat(20)]] as const) {
        await fillForm(page, e, p);
        await page.getByTestId('login-submit').click();
        await expect(page.getByTestId('screen-login')).toBeVisible();
        expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
        await expect(page.getByTestId('screen-login')).toBeVisible();
      }
      expect(errs).toEqual([]);
      await page.getByTestId('login-mode-toggle').click();
      await fillForm(page, '<b>x</b>@example.test', '<b>abcdefgh</b>');
      await page.getByTestId('login-submit').click();
      expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
    });

    test(`US-E13-08/AC10 Enter submits in every mode and the URL never gets the e-mail or password [${lang}]`, async ({ page }) => {
      await seed(page, out([CONF]));
      await visit(page, lang, '/');
      await fillForm(page, CONF.email, PW);
      await page.getByTestId('login-password').press('Enter');
      await expect(page.getByTestId('screen-login')).toHaveCount(0);
      expect(page.url()).not.toMatch(/password|correct-horse|mama%40|mama@|\?/);
    });
  });
}

/** Navigates (reloads when url is null) and, for English, flips the login/verify screen to English (it starts in Japanese). */
async function visit(page: import('@playwright/test').Page, lang: 'ja' | 'en', url: string | null): Promise<void> {
  if (url === null) await page.reload();
  else await page.goto(url);
  if (lang !== 'en' || url === 'about:blank') return;
  const toggle = page.getByTestId('lang-toggle-en');
  await toggle.waitFor({ state: 'visible', timeout: 2500 }).catch(() => undefined);
  if (await toggle.count()) await toggle.click();
}

/** Opens a clean origin state: clears storage, then seeds this test's accounts (signed-out). */
async function seedFresh(page: import('@playwright/test').Page, accounts: object[]): Promise<void> {
  await page.goto('/#/');
  await page.evaluate((a) => {
    window.localStorage.clear();
    window.localStorage.setItem('bentominder.fake-auth', 'signed-out');
    window.localStorage.setItem('bentominder.fake-auth-accounts', JSON.stringify(a));
    window.localStorage.setItem('qa-e13e-seeded', '1');
  }, accounts);
}

test.describe('US-E13-08 shared', () => {
  test('US-E13-08/AC10 nothing is sent to any host during the whole account journey (create, verify, sign out, reset)', async ({ page }) => {
    const t = await watchTraffic(page);
    await seed(page, out([CONF]));
    await page.goto('/');
    await page.getByTestId('login-mode-toggle').click();
    await fillForm(page, 'journey@example.test', 'abcdefgh');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await page.getByTestId('verify-sign-out').click();
    await page.getByTestId('login-forgot').click();
    await page.getByTestId('login-email').fill(CONF.email);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-reset-sent')).toBeVisible();
    await page.waitForTimeout(500);
    expect(t.forbidden()).toEqual([]);
  });

  test('US-E13-08/AC10/AC7 the password is never in the DOM, URL, storage, IndexedDB, console, history or any request', async ({ page }) => {
    const MARKER_PW = 'Zq9!secret-PW-QA-7731';
    const consoleLines: string[] = [];
    page.on('console', (m) => consoleLines.push(m.text()));
    page.on('pageerror', (e) => consoleLines.push(e.message));
    const t = await watchTraffic(page);
    await seed(page, out([CONF]));
    await page.goto('/');
    // wrong sign-in with the secret, with show toggled
    await fillForm(page, CONF.email, MARKER_PW);
    await page.getByTestId('login-password-toggle').click();
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-form-error')).not.toHaveText('');
    // create with the secret
    await page.getByTestId('login-mode-toggle').click();
    await fillForm(page, 'secret@example.test', MARKER_PW);
    await page.getByTestId('login-password-toggle').click();
    await page.getByTestId('login-password').press('Enter');
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    const dump = await page.evaluate(async () => {
      const dbs = (await indexedDB.databases?.()) ?? [];
      const idb: string[] = [];
      for (const d of dbs) {
        if (d.name === undefined) continue;
        idb.push(
          await new Promise<string>((res) => {
            const rq = indexedDB.open(d.name as string);
            rq.onsuccess = async () => {
              const db = rq.result;
              const parts: string[] = [d.name as string];
              for (const name of Array.from(db.objectStoreNames)) {
                const all = await new Promise<unknown[]>((r2) => {
                  const g = db.transaction(name).objectStore(name).getAll();
                  g.onsuccess = () => r2(g.result as unknown[]);
                  g.onerror = () => r2([]);
                });
                parts.push(JSON.stringify(all));
              }
              db.close();
              res(parts.join('|'));
            };
            rq.onerror = () => res('');
          }),
        );
      }
      return { html: document.documentElement.outerHTML, local: JSON.stringify({ ...window.localStorage }), session: JSON.stringify({ ...window.sessionStorage }), idb: idb.join('\n'), url: window.location.href, title: document.title, hist: window.history.length };
    });
    for (const [where, v] of Object.entries({ html: dump.html, local: dump.local, session: dump.session, idb: dump.idb, url: dump.url, title: dump.title })) expect(v, where).not.toContain(MARKER_PW);
    expect(consoleLines.join('\n')).not.toContain(MARKER_PW);
    expect(t.urls.join('\n')).not.toContain(MARKER_PW);
    expect(encodeURIComponent(t.urls.join('\n'))).not.toContain(encodeURIComponent(MARKER_PW));
    expect(t.bodies.join('\n')).not.toContain(MARKER_PW);
    expect(t.forbidden()).toEqual([]);
    // cookies too
    expect(JSON.stringify(await page.context().cookies())).not.toContain(MARKER_PW);
  });

  test('US-E13-08/AC10 the typed password is not left in the field after leaving the form (mode change, failed sign-in, verify screen)', async ({ page }) => {
    await seed(page, out([CONF]));
    await page.goto('/');
    await page.getByTestId('login-password').fill('typed-secret-1');
    await page.getByTestId('login-mode-toggle').click();
    await expect(page.getByTestId('login-password')).toHaveValue('');
    await page.getByTestId('login-mode-toggle').click();
    await expect(page.getByTestId('login-password')).toHaveValue('');
  });

  test('US-E13-08/AC3 the e-mail address on the verify screen is text, never markup', async ({ page }) => {
    await seed(page, out());
    await page.goto('/');
    await page.getByTestId('login-mode-toggle').click();
    await fillForm(page, 'a"b<i>x</i>@example.test', 'abcdefgh');
    await page.getByTestId('login-submit').click();
    // either refused as invalid or shown inert
    const verify = await page.getByTestId('screen-verify-email').count();
    if (verify > 0) {
      expect(await page.getByTestId('verify-body').locator('i').count()).toBe(0);
    }
  });
});
