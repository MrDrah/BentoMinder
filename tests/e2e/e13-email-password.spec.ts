// US-E13-08: e-mail + password sign-in against the e2e build, whose sign-in is the fake (src/adapters/web/e2e-auth.ts).
// No request may go to Google or Firebase, and none to the proxy or sync while an account is unconfirmed (AC9, AC10).
import { expect, test, type Page } from '@playwright/test';
import { expectNoSeriousAxe, seedStore } from './helpers.ts';

const PW = 'correct-horse-1'; // E2E_PASSWORD of the seam: accepted by every seeded password account
const CONFIRMED = { email: 'mama@example.test', uid: 'pw-uid-100', provider: 'password', verified: true };
const UNCONFIRMED = { email: 'papa@example.test', uid: 'pw-uid-101', provider: 'password', verified: false };
const GOOGLE = { email: 'g@example.test', uid: 'google-uid-1', provider: 'google', verified: true };
const userJson = (a: { email: string; uid: string; provider: string; verified: boolean }) =>
  JSON.stringify({ uid: a.uid, displayName: null, email: a.email, photoUrl: null, emailVerified: a.verified, provider: a.provider });

async function seed(page: Page, entries: Record<string, string>): Promise<void> {
  await page.addInitScript((e) => {
    if (window.sessionStorage.getItem('e13pw-seeded') !== null) return;
    window.sessionStorage.setItem('e13pw-seeded', '1');
    for (const [k, v] of Object.entries(e)) window.localStorage.setItem(k, v);
  }, entries);
}
const signedOut = (extra: Record<string, string> = {}) => ({ 'bentominder.fake-auth': 'signed-out', ...extra });
const accounts = (...a: object[]) => ({ 'bentominder.fake-auth-accounts': JSON.stringify(a) });
const stored = (page: Page, key: string) => page.evaluate((k) => window.localStorage.getItem(k), key);

function watchRequests(page: Page): { external: string[]; backend: string[] } {
  const seen = { external: [] as string[], backend: [] as string[] };
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (/google|gstatic|firebase|googleapis/i.test(url.hostname)) seen.external.push(r.url());
    if (url.pathname.startsWith('/api/') || /\/v1\//.test(url.pathname)) seen.backend.push(r.url());
  });
  return seen;
}

const fill = async (page: Page, email: string, password: string) => {
  await page.getByTestId('login-email').fill(email);
  if (password !== '') await page.getByTestId('login-password').fill(password);
};

test.describe('E13-08 e-mail and password', () => {
  test('US-E13-08/AC1 AC10 both ways are offered; passes axe in ja and en, light and dark, in every mode, at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed(page, signedOut());
    await page.goto('/');
    await expect(page.getByTestId('login-google')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toHaveText('ログイン');
    await expect(page.getByTestId('login-mode-toggle')).toHaveText('アカウントを作る');
    await expect(page.getByTestId('screen-calendar')).toHaveCount(0);
    for (const lang of ['ja', 'en'] as const) {
      await page.getByTestId(`lang-toggle-${lang}`).click();
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await expectNoSeriousAxe(page, `signin ${lang} ${scheme}`);
        await page.getByTestId('login-mode-toggle').click();
        await expectNoSeriousAxe(page, `create ${lang} ${scheme}`);
        await page.getByTestId('login-mode-toggle').click();
        await page.getByTestId('login-forgot').click();
        await expectNoSeriousAxe(page, `forgot ${lang} ${scheme}`);
        await page.getByTestId('login-mode-toggle').click();
      }
    }
  });

  test('US-E13-08/AC10 targets are at least 44 px and nothing scrolls sideways at 320 px, even with an error showing', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await seed(page, signedOut(accounts(CONFIRMED)));
    await page.goto('/');
    await page.getByTestId('lang-toggle-en').click();
    const noSideScroll = async (label: string) => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, label).toBeLessThanOrEqual(0);
    };
    for (const id of ['login-password-toggle', 'login-forgot', 'login-submit', 'login-mode-toggle', 'login-google']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0, id).toBeGreaterThanOrEqual(44);
    }
    await noSideScroll('signin');
    await page.getByTestId('login-submit').click(); // empty: field error
    await noSideScroll('signin with error');
    await fill(page, CONFIRMED.email, 'wrong-password-1');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-form-error')).toContainText('incorrect');
    await noSideScroll('wrong password');
    await page.getByTestId('login-mode-toggle').click();
    await noSideScroll('create');
    await page.getByTestId('login-mode-toggle').click();
    await page.getByTestId('login-forgot').click();
    await noSideScroll('forgot');
  });

  test('US-E13-08/AC2 AC3 AC9 AC10 create, check-your-email, confirm, open: no data, sync or AI request before, no password anywhere, nothing sent to Firebase', async ({ page }) => {
    const seen = watchRequests(page);
    const typed = 'Zx9-unique-typed-pw';
    await seed(page, signedOut());
    await page.goto('/');
    await page.getByTestId('login-mode-toggle').click();
    await fill(page, 'new@example.test', typed);
    await page.getByTestId('login-password-toggle').click();
    const leak = async (label: string) => {
      const hits = await page.evaluate((s) => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll('*'))) {
          for (const a of Array.from(el.attributes)) if (a.value.includes(s)) out.push(`${el.tagName}[${a.name}]`);
          if (el.children.length === 0 && el.tagName !== 'INPUT' && (el.textContent ?? '').includes(s)) out.push(`${el.tagName} text`);
        }
        if (window.location.href.includes(s) || document.title.includes(s)) out.push('url/title');
        for (const store of [window.localStorage, window.sessionStorage]) for (let i = 0; i < store.length; i += 1) if ((store.getItem(store.key(i) ?? '') ?? '').includes(s)) out.push('storage');
        return out;
      }, typed);
      expect(hits, label).toEqual([]);
    };
    await leak('while typing');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await leak('verify screen');
    await expect(page.getByTestId('verify-address')).toHaveText('new@example.test');
    await expect(page.getByTestId('verify-resend')).toHaveAttribute('aria-disabled', 'true');
    expect(JSON.parse((await stored(page, 'bentominder.fake-auth-log')) ?? '[]')).toEqual(['verification:new@example.test']);
    await expect(page.getByTestId('screen-onboarding')).toHaveCount(0);
    expect(await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.endsWith('.state')))).toEqual([]);
    // Not confirmed yet.
    await page.getByTestId('verify-done').click();
    await expect(page.getByTestId('verify-error')).toContainText('まだ確認できていません');
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    // A reopen stays on the wall.
    await page.reload();
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await expect(page.getByTestId('verify-resend')).not.toHaveAttribute('aria-disabled', 'true');
    // The parent opens the link, then taps 「確認しました」.
    await page.evaluate(() => window.localStorage.setItem('bentominder.fake-auth-verified', JSON.stringify(['new@example.test'])));
    await page.getByTestId('verify-done').click();
    await expect(page.getByTestId('screen-onboarding')).toBeVisible();
    await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    await leak('app');
    expect(seen.external).toEqual([]);
    expect(seen.backend).toEqual([]);
    await page.reload();
    await expect(page.getByTestId('screen-onboarding')).toBeVisible(); // the confirmed session is kept
  });

  test('US-E13-08/AC3 AC10 the check-your-email screen passes axe in ja and en, light and dark, at 390 px and does not scroll sideways at 320', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': userJson(UNCONFIRMED), ...accounts(UNCONFIRMED) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    for (const lang of ['ja', 'en'] as const) {
      await page.getByTestId(`lang-toggle-${lang}`).click();
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await expectNoSeriousAxe(page, `verify ${lang} ${scheme}`);
      }
    }
    await page.getByTestId('verify-done').click();
    await expect(page.getByTestId('verify-error')).not.toBeEmpty();
    await expectNoSeriousAxe(page, 'verify with error');
    await page.setViewportSize({ width: 320, height: 640 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
    for (const id of ['verify-done', 'verify-resend', 'verify-sign-out']) expect((await page.getByTestId(id).boundingBox())?.height ?? 0, id).toBeGreaterThanOrEqual(44);
  });

  test('US-E13-08/AC4 resend is limited to one per 60 seconds, counts down, then works again', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-14T10:00:00Z') });
    await seed(page, { 'bentominder.fake-auth': userJson(UNCONFIRMED), ...accounts(UNCONFIRMED) });
    await page.goto('/');
    await page.getByTestId('lang-toggle-en').click();
    const resend = page.getByTestId('verify-resend');
    await expect(resend).toHaveText('Resend confirmation email');
    await resend.click();
    await expect(resend).toHaveAttribute('aria-disabled', 'true');
    await expect(resend).toContainText('60 s');
    await expect(page.getByTestId('verify-live')).toHaveText('Confirmation email sent.');
    await resend.click({ force: true }); // still limited: nothing more is sent
    expect(JSON.parse((await stored(page, 'bentominder.fake-auth-log')) ?? '[]')).toEqual(['verification:papa@example.test']);
    await page.clock.fastForward(61_000);
    await expect(resend).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('verify-live')).toHaveText('You can resend the email now.');
    await resend.click();
    expect(JSON.parse((await stored(page, 'bentominder.fake-auth-log')) ?? '[]')).toHaveLength(2);
  });

  test('US-E13-08/AC5 AC11 a confirmed account signs in, keeps its session, shows the e-mail without a photo, and signs out', async ({ page }) => {
    await seedStore(page);
    await seed(page, signedOut(accounts(CONFIRMED)));
    await page.goto('/#/settings');
    await fill(page, CONFIRMED.email, PW);
    await page.getByTestId('login-password').press('Enter');
    await expect(page.getByTestId('settings-account')).toBeVisible();
    await expect(page.getByTestId('account-name')).toHaveText(CONFIRMED.email);
    await expect(page.getByTestId('settings-account')).toContainText('メールアドレスでログイン中');
    await expect(page.getByTestId('account-email')).toHaveCount(0);
    await expect(page.getByTestId('settings-account').locator('img')).toHaveCount(0);
    await expect(page.getByTestId('account-avatar')).toHaveText('m');
    await page.reload();
    await expect(page.getByTestId('settings-account')).toBeVisible();
    await page.getByTestId('account-sign-out').click();
    await page.getByTestId('dialog-sign-out-confirm').click();
    await expect(page.getByTestId('screen-login')).toBeVisible();
  });

  test('US-E13-08/AC6 forgot password: the same neutral message with or without an account; a real account gets one e-mail', async ({ page }) => {
    await seed(page, signedOut(accounts(CONFIRMED)));
    await page.goto('/');
    await page.getByTestId('login-forgot').click();
    await expect(page.getByTestId('login-title')).toBeFocused();
    await expect(page.getByTestId('login-google')).toHaveCount(0);
    const texts: string[] = [];
    for (const address of ['nobody@example.test', CONFIRMED.email]) {
      await page.getByTestId('login-email').fill(address);
      await page.getByTestId('login-submit').click();
      await expect(page.getByTestId('login-reset-sent')).toBeVisible();
      texts.push((await page.getByTestId('login-reset-sent').textContent()) ?? '');
      await page.getByTestId('login-mode-toggle').click(); // back to sign in
      await page.getByTestId('login-forgot').click();
    }
    expect(texts[0]).toBe(texts[1]);
    expect(texts[0]).toContain('そのメールアドレスのアカウントがある場合');
    expect(JSON.parse((await stored(page, 'bentominder.fake-auth-log')) ?? '[]')).toEqual([`reset:${CONFIRMED.email}`]);
  });

  test('US-E13-08/AC7 AC8 plain errors: one message for wrong credentials, field messages, in use, too many, offline; no code is shown', async ({ page }) => {
    await seed(page, signedOut({ ...accounts(CONFIRMED, GOOGLE), 'bentominder.fake-auth-script': JSON.stringify(['ok', 'ok', 'ok', 'tooMany', 'offline']) }));
    await page.goto('/');
    const err = page.getByTestId('login-form-error');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-email-error')).toHaveText('メールアドレスを入力してください。');
    await fill(page, 'not-an-address', 'x');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-email-error')).toContainText('形式が正しくありません');
    await fill(page, CONFIRMED.email, 'wrong-password-1');
    await page.getByTestId('login-submit').click();
    await expect(err).toContainText('メールアドレスまたはパスワードが違います');
    await expect(page.getByTestId('login-password')).toHaveValue('');
    await expect(page.getByTestId('login-password')).toBeFocused();
    const wrongText = await err.textContent();
    await fill(page, 'nobody@example.test', 'wrong-password-1');
    await page.getByTestId('login-submit').click();
    await expect(err).toHaveText(wrongText ?? '');
    // Create mode: short password, then the address already used with Google.
    await page.getByTestId('login-mode-toggle').click();
    await fill(page, 'a@example.test', 'short');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-password-error')).toContainText('8文字以上');
    await fill(page, GOOGLE.email, 'password-long-1');
    await page.getByTestId('login-submit').click();
    await expect(err).toContainText('すでに使われています');
    await expect(page.getByTestId('screen-login')).toBeVisible(); // nothing merged, nobody signed in
    // Scripted: too many attempts, then offline.
    await fill(page, 'a@example.test', 'password-long-1');
    await page.getByTestId('login-submit').click();
    await expect(err).toContainText('しばらくしてからもう一度お試しください');
    await fill(page, 'a@example.test', 'password-long-1');
    await page.getByTestId('login-submit').click();
    await expect(err).toContainText('インターネットにつながっていません');
    expect(await page.locator('body').innerText()).not.toMatch(/auth\/|FirebaseError/);
  });
});
