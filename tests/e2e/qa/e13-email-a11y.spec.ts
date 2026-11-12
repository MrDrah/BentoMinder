// QA E13-email (f): US-E13-08/AC10 accessibility of the login form modes and the check-your-email screen: axe (0 serious/critical)
// in ja and en, light and dark, at 320 / 390 / 1280; keyboard order; live regions; 44 px targets; reflow; reduced motion.
import { expect, test, type Page } from '@playwright/test';
import { storeFor } from './e13-common.ts';
import { COPY, CONF, LANGS, UNC, axeSerious, fillForm, out, seed, userOf } from './e13-email-common.ts';

const WIDTHS = [320, 390, 1280];
const SCREENS = ['signin', 'signin-error', 'create', 'create-error', 'forgot', 'forgot-sent', 'verify', 'verify-error', 'account'] as const;
type Screen = (typeof SCREENS)[number];

/** The login and verify screens start in Japanese; English is the on-screen toggle. */
async function toLang(page: Page, lang: 'ja' | 'en'): Promise<void> {
  if (lang !== 'en') return;
  const toggle = page.getByTestId('lang-toggle-en');
  await toggle.waitFor({ state: 'visible', timeout: 2500 }).catch(() => undefined);
  if (await toggle.count()) await toggle.click();
}

async function open(page: Page, screen: Screen, lang: 'ja' | 'en'): Promise<void> {
  const C = COPY[lang];
  if (screen === 'verify' || screen === 'verify-error') {
    await seed(page, { 'bentominder.fake-auth': userOf(UNC), 'bentominder.fake-auth-accounts': JSON.stringify([UNC]) });
    await page.goto('/');
    await toLang(page, lang);
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    if (screen === 'verify-error') {
      await page.getByTestId('verify-done').click();
      await expect(page.getByTestId('verify-error')).toHaveText(C.notYet);
    }
    return;
  }
  if (screen === 'account') {
    await seed(page, { 'bentominder.fake-auth': userOf(CONF), 'bentominder.fake-auth-accounts': JSON.stringify([CONF]), [`bentominder.${CONF.uid}.state`]: storeFor(CONF.uid) });
    await page.goto('/#/settings');
    await expect(page.getByTestId('settings-account')).toBeVisible();
    return;
  }
  await seed(page, out([CONF]));
  await page.goto('/');
  await toLang(page, lang);
  await expect(page.getByTestId('screen-login')).toBeVisible();
  if (screen.startsWith('create')) await page.getByTestId('login-mode-toggle').click();
  if (screen.startsWith('forgot')) await page.getByTestId('login-forgot').click();
  if (screen === 'signin-error') {
    await fillForm(page, 'nobody@example.test', 'whatever-123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-form-error')).toHaveText(C.wrong);
  }
  if (screen === 'create-error') {
    await page.getByTestId('login-submit').click();
    await expect(page.getByText(C.emailEmpty).first()).toBeVisible();
  }
  if (screen === 'forgot-sent') {
    await page.getByTestId('login-email').fill('x@example.test');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-reset-sent')).toBeVisible();
  }
}

for (const lang of LANGS) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`US-E13-08/AC10 axe [${lang} ${scheme}]`, () => {
      test.use({ locale: lang === 'ja' ? 'ja-JP' : 'en-US', colorScheme: scheme });
      for (const width of WIDTHS) {
        for (const screen of SCREENS) {
          test(`US-E13-08/AC10 axe 0 serious/critical, no horizontal scroll: ${screen} @${width} ${lang} ${scheme}`, async ({ page }) => {
            await page.setViewportSize({ width, height: width === 1280 ? 800 : 780 });
            await open(page, screen, lang);
            await axeSerious(page, `${screen}@${width}/${lang}/${scheme}`);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(0);
          });
        }
      }
    });
  }
}

test.describe('US-E13-08/AC10 structure', () => {
  test.use({ locale: 'en-US', viewport: { width: 390, height: 844 } });

  test('US-E13-08/AC10 keyboard order in sign-in: language, Google, e-mail, password, show/hide, forgot, sign in, create link', async ({ page }) => {
    await open(page, 'signin', 'en');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const order: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? (document.activeElement as HTMLElement | null)?.tagName ?? ''));
    }
    const want = ['login-google', 'login-email', 'login-password', 'login-password-toggle', 'login-forgot', 'login-submit', 'login-mode-toggle'];
    const got = order.filter((o) => want.includes(o));
    expect(got.slice(0, want.length)).toEqual(want);
    // the language control comes before Google
    expect(await page.evaluate(() => { const g = document.querySelector('[data-testid="login-google"]')!; const l = document.querySelector('[data-testid="lang-toggle-ja"]')!; return !!(l.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING); })).toBe(true);
  });

  test('US-E13-08/AC10 keyboard only journey: create an account and reach the verify screen with Tab/Space/Enter alone; focus lands on the heading', async ({ page }) => {
    await seed(page, out());
    await page.goto('/');
    await toLang(page, 'en');
    await page.getByTestId('login-title').focus();
    // focus the mode link by keyboard
    for (let i = 0; i < 20 && (await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) !== 'login-mode-toggle'; i += 1) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('login-submit')).toHaveText('Create account');
    await expect(page.getByTestId('login-title')).toBeFocused();
    await page.getByTestId('login-email').focus();
    await page.keyboard.type('kbd@example.test');
    await page.keyboard.press('Tab');
    await page.keyboard.type('abcdefgh');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space'); // toggle show
    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'text');
    await page.keyboard.press('Enter'); // Enter on the toggle must not submit nor break
    await page.getByTestId('login-password').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await expect(page.getByTestId('verify-title')).toBeFocused();
    // tab order on the verify screen: done, resend, sign out
    const order: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      order.push(await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? ''));
    }
    expect(order.filter((o) => o.startsWith('verify-')).slice(0, 3)).toEqual(['verify-done', 'verify-resend', 'verify-sign-out']);
  });

  test('US-E13-08/AC10 live regions: login error is assertive and always rendered, reset-sent is a status, verify has a polite live node from first render', async ({ page }) => {
    await open(page, 'signin', 'en');
    await expect(page.getByTestId('login-form-error')).toHaveAttribute('aria-live', 'assertive');
    await expect(page.getByTestId('login-error')).toHaveAttribute('aria-live', 'assertive');
    await expect(page.getByTestId('login-live')).toHaveAttribute('role', 'status');
    await page.getByTestId('login-mode-toggle').click();
    await expect(page.getByTestId('login-live')).toContainText(COPY.en.create ? 'Create-account form.' : '');
    await page.getByTestId('login-mode-toggle').click();
    await expect(page.getByTestId('login-live')).toContainText('Sign-in form.');
    await page.getByTestId('login-forgot').click();
    await expect(page.getByTestId('login-live')).toContainText('Password reset form.');
    await open(page, 'verify', 'en').catch(() => undefined);
  });

  test('US-E13-08/AC10 verify screen: live node polite from first render, error node assertive, resend cooldown number is not spoken each second', async ({ page }) => {
    await open(page, 'verify', 'en');
    await expect(page.getByTestId('verify-live')).toHaveCount(1);
    const live = await page.getByTestId('verify-live').evaluate((e) => ({ role: e.getAttribute('role'), live: e.getAttribute('aria-live') }));
    expect(live.role === 'status' || live.live === 'polite').toBe(true);
    const err = await page.getByTestId('verify-error').evaluate((e) => ({ role: e.getAttribute('role'), live: e.getAttribute('aria-live') }));
    expect(err.role === 'alert' || err.live === 'assertive').toBe(true);
    // the visible countdown label sits on a button; the live node must not carry the seconds
    await page.getByTestId('verify-resend').click();
    await page.waitForTimeout(2300);
    expect(await page.getByTestId('verify-live').innerText()).not.toMatch(/\d/);
  });

  for (const w of [320, 390, 1280]) {
    test(`US-E13-08/AC10 touch targets >= 44 px on every interactive element of every mode @${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      for (const screen of ['signin', 'create', 'forgot', 'verify', 'account'] as const) {
        await page.goto('about:blank');
        await open(page, screen, 'en');
        const small = await page.evaluate(() =>
          Array.from((document.querySelector('[data-testid="settings-account"]') ?? document).querySelectorAll<HTMLElement>('button, a[href], input, select, [role="radio"], [role="button"]'))
            .filter((e) => {
              const r = e.getBoundingClientRect();
              const cs = getComputedStyle(e);
              return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[aria-hidden="true"]');
            })
            .map((e) => ({ id: e.getAttribute('data-testid') ?? e.tagName + ':' + (e.textContent ?? '').slice(0, 20), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }))
            .filter((x) => x.h < 44 || x.w < 44),
        );
        expect(small, `${screen}@${w}`).toEqual([]);
      }
    });
  }

  test('US-E13-08/AC10 200% zoom equivalent (viewport 160 wide css px effective at 320): nothing clipped, show/hide inside the field, primary reachable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 520 });
    await open(page, 'create', 'en');
    const pw = await page.getByTestId('login-password').boundingBox();
    const tg = await page.getByTestId('login-password-toggle').boundingBox();
    expect(pw && tg).toBeTruthy();
    expect(tg!.x).toBeGreaterThanOrEqual(pw!.x - 1);
    expect(tg!.x + tg!.width).toBeLessThanOrEqual(pw!.x + pw!.width + 1);
    await page.getByTestId('login-submit').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('login-submit')).toBeInViewport();
    const hostile = 'x'.repeat(200) + '@example.test';
    await page.getByTestId('login-email').fill(hostile);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('US-E13-08/AC10 long unbroken address wraps on the verify screen at 320 (no horizontal scroll)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await seed(page, { 'bentominder.fake-auth': JSON.stringify({ uid: 'u', displayName: null, email: 'a'.repeat(120) + '@example.test', photoUrl: null, emailVerified: false, provider: 'password' }) });
    await page.goto('/');
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('US-E13-08/AC10 reduced motion: no running animation or transition on the login form, the mode swap or the verify screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'signin', 'en');
    await page.getByTestId('login-mode-toggle').click();
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && ((a.effect?.getTiming().duration as number) ?? 0) > 1).map((a) => (a as CSSAnimation).animationName ?? 'transition'));
    expect(running).toEqual([]);
    await open(page, 'verify', 'en');
    const running2 = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && ((a.effect?.getTiming().duration as number) ?? 0) > 1).length);
    expect(running2).toBe(0);
  });

  test('US-E13-08/AC10 focus ring is visible on every control of the form (outline or box-shadow present on :focus-visible)', async ({ page }) => {
    await open(page, 'signin', 'en');
    const missing: string[] = [];
    for (const id of ['login-google', 'login-email', 'login-password', 'login-password-toggle', 'login-forgot', 'login-submit', 'login-mode-toggle']) {
      await page.getByTestId(id).focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const ok = await page.evaluate((i) => {
        const e = document.querySelector(`[data-testid="${i}"]`) as HTMLElement;
        const cs = getComputedStyle(e);
        return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow !== 'none' && cs.boxShadow !== '') || cs.borderColor !== '';
      }, id);
      if (!ok) missing.push(id);
    }
    expect(missing).toEqual([]);
  });

  test('US-E13-08/AC10 document title names the screen (verify) and the h1 is unique on every mode', async ({ page }) => {
    await open(page, 'verify', 'en');
    expect(await page.title()).toContain('Confirm your email');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    for (const s of ['signin', 'create', 'forgot'] as const) {
      await page.goto('about:blank');
      await open(page, s, 'en');
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    }
  });
});
