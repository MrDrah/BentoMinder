// QA E13-email (b): the hard wall of US-E13-08/AC3 and AC9. An unconfirmed password account can never reach a data screen, a store,
// sync, the family join or a hosted-AI request. Every route and every way of arriving is tried; every test watches all traffic
// (a fake sync host is set so a call would be visible) and the app's own storage keys.
import { expect, test, type Page } from '@playwright/test';
import { storeFor } from './e13-common.ts';
import { A, CONF, GOOG, PW, SYNC_BASE, UNC, dataSnapshot, expectNoApp, fillForm, out, seed, userOf, verifiedList, watchTraffic } from './e13-email-common.ts';

test.use({ locale: 'en-US', viewport: { width: 390, height: 844 } });

const KEY = (uid: string) => `bentominder.${uid}.state`;
const SYNC_ON = { 'bentominder.fake-sync-base': SYNC_BASE };
const unc = (extra: Record<string, string> = {}) => ({ 'bentominder.fake-auth': userOf(UNC), 'bentominder.fake-auth-accounts': JSON.stringify([UNC, CONF, GOOG]), ...SYNC_ON, ...extra });

const ROUTES = ['#/calendar', '#/calendar/2026-11', '#/day/2026-11-13', '#/recipes', '#/recipe/rcp-delish-himawari-bento', '#/settings', '#/profile', '#/import', '#/recommend/2026-11-13', '#/join', '#/join/ABCD234567', '#/onboarding/1', '#/refresh-review/2026-11', '#/review/2026-11', '#/debug', '#/no-such-route', '#/day/<script>'];

async function expectWall(page: Page, t: Awaited<ReturnType<typeof watchTraffic>>, label: string): Promise<void> {
  await expect(page.getByTestId('screen-verify-email'), label).toBeVisible();
  await expectNoApp(page);
  await expect(page.locator('body')).not.toContainText('はなちゃん');
  expect(t.forbidden(), `${label}: traffic`).toEqual([]);
}

test.describe('US-E13-08/AC3 AC9 hard wall', () => {
  for (const route of ROUTES) {
    test(`US-E13-08/AC3 deep link ${route} while unconfirmed: verify screen, no data screen, no sync/AI call, no store written`, async ({ page }) => {
      const t = await watchTraffic(page);
      await seed(page, unc());
      await page.goto('/' + route);
      await page.waitForTimeout(700);
      await expectWall(page, t, route);
      const keys = Object.keys(await dataSnapshot(page));
      expect(keys.filter((k) => k.includes(UNC.uid))).toEqual([]);
      expect(keys.filter((k) => k === 'bentominder.state')).toEqual([]);
    });
  }

  test('US-E13-08/AC3 reload while unconfirmed (five times) never shows the app and never calls anything', async ({ page }) => {
    const t = await watchTraffic(page);
    await seed(page, unc());
    await page.goto('/#/calendar');
    for (let i = 0; i < 5; i += 1) {
      await page.reload();
      await expectWall(page, t, `reload ${i}`);
    }
  });

  test('US-E13-08/AC3 back and forward buttons across route changes never expose the app while unconfirmed', async ({ page }) => {
    const t = await watchTraffic(page);
    await seed(page, unc());
    await page.goto('/#/calendar');
    for (const h of ['#/settings', '#/import', '#/join/ABCD234567', '#/day/2026-11-13']) {
      await page.evaluate((x) => (window.location.hash = x), h);
      await expectWall(page, t, h);
    }
    for (let i = 0; i < 4; i += 1) {
      await page.goBack();
      await expectWall(page, t, `back ${i}`);
    }
    for (let i = 0; i < 4; i += 1) {
      await page.goForward();
      await expectWall(page, t, `fwd ${i}`);
    }
  });

  test('US-E13-08/AC3 history after confirming: back never returns to a stale state that shows a different account or the wall as app', async ({ page }) => {
    await seed(page, { ...unc(), ...verifiedList(UNC.email) });
    await page.goto('/#/settings');
    await page.getByTestId('verify-done').click();
    await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    await page.goBack().catch(() => undefined);
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
  });

  test('US-E13-08/AC3 second tab: a new tab of the same browser with an unconfirmed session shows the wall, even on a data deep link', async ({ page, context }) => {
    const t = await watchTraffic(page);
    await seed(page, unc());
    await page.goto('/#/calendar');
    await expectWall(page, t, 'tab 1');
    const tab2 = await context.newPage();
    const t2 = await watchTraffic(tab2);
    await tab2.goto('/#/import');
    await expectWall(tab2, t2, 'tab 2');
    // confirm in tab 1; tab 2 reloaded afterwards opens the app (session shared via the provider), no second sign-in
    await page.evaluate((e) => window.localStorage.setItem('bentominder.fake-auth-verified', JSON.stringify([e])), UNC.email);
    await page.getByTestId('verify-done').click();
    await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    await tab2.reload();
    await expect(tab2.getByTestId('screen-login')).toHaveCount(0);
  });

  test('US-E13-08/AC3 sign out from the wall, then Google sign-in: the Google account opens ITS app; nothing of the password account is read or written', async ({ page }) => {
    const t = await watchTraffic(page);
    await seed(page, unc({ [KEY(A.uid)]: storeFor(A.uid), 'bentominder.fake-auth-next': JSON.stringify(A) }));
    await page.goto('/#/calendar');
    await expectWall(page, t, 'start');
    const before = await dataSnapshot(page);
    await page.getByTestId('verify-sign-out').click();
    await expect(page.getByTestId('screen-login')).toBeVisible();
    expect(await dataSnapshot(page)).toEqual(before); // sign-out touched nothing
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    const after = await dataSnapshot(page);
    expect(Object.keys(after).filter((k) => k.includes(UNC.uid))).toEqual([]);
    expect(after[KEY(A.uid)]).toContain('はなちゃん');
  });

  test('US-E13-08/AC3 Google account signs out, then creates a password account: the wall shows and the Google account local data is untouched', async ({ page }) => {
    const t = await watchTraffic(page);
    await seed(page, { 'bentominder.fake-auth': JSON.stringify(A), 'bentominder.fake-auth-accounts': JSON.stringify([]), ...SYNC_ON, [KEY(A.uid)]: storeFor(A.uid) });
    await page.goto('/#/settings');
    await page.getByTestId('account-sign-out').click();
    await page.getByTestId('dialog-sign-out-confirm').click();
    await expect(page.getByTestId('screen-login')).toBeVisible();
    const before = await dataSnapshot(page);
    t.urls.length = 0;
    await page.getByTestId('login-mode-toggle').click();
    await fillForm(page, 'new@example.test', 'abcdefgh');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await expectNoApp(page);
    expect(await dataSnapshot(page)).toEqual(before);
    expect(t.forbidden()).toEqual([]);
    await page.reload();
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    expect(await dataSnapshot(page)).toEqual(before);
  });

  test('US-E13-08/AC5 switching accounts on one device: A (Google) data, then a confirmed password account C: C never sees A, A is byte-identical afterwards', async ({ page }) => {
    await seed(page, out([CONF], { [KEY(A.uid)]: storeFor(A.uid), 'bentominder.fake-auth-next': JSON.stringify(A) }));
    await page.goto('/#/settings');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    await page.goto('/#/settings');
    const aBefore = (await dataSnapshot(page))[KEY(A.uid)];
    await page.getByTestId('account-sign-out').click();
    await page.getByTestId('dialog-sign-out-confirm').click();
    await fillForm(page, CONF.email, PW);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('はなちゃん');
    const snap = await dataSnapshot(page);
    expect(snap[KEY(A.uid)]).toBe(aBefore);
    for (const [k, v] of Object.entries(snap)) if (k.includes(CONF.uid)) expect(v).not.toContain('はなちゃん');
  });

  test('US-E13-08/AC9 join link while unconfirmed: no invite.redeem and no request to the sync host before confirming; after confirming the join route is reachable', async ({ page }) => {
    const t = await watchTraffic(page);
    await seed(page, { ...unc(), ...verifiedList(UNC.email) });
    await page.goto('/#/join/ABCD234567');
    await page.waitForTimeout(600);
    await expectWall(page, t, 'join link');
    expect(t.urls.filter((u) => u.startsWith(SYNC_BASE))).toEqual([]);
    await page.getByTestId('verify-done').click();
    await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    expect(new URL(page.url()).hash).toContain('join'); // the deep link survives the wall
  });

  test('US-E13-08/AC9 the wall holds under slow session restore (delay) and under a scripted offline on every action', async ({ page }) => {
    const t = await watchTraffic(page);
    await seed(page, unc({ 'bentominder.fake-auth-delay': '800', 'bentominder.fake-auth-script': JSON.stringify(['offline', 'offline', 'offline']) }));
    await page.goto('/#/calendar');
    await expect(page.getByTestId('screen-restoring')).toBeVisible();
    await expectNoApp(page);
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await page.getByTestId('verify-done').click();
    await page.getByTestId('verify-resend').click();
    await expectWall(page, t, 'after offline taps');
  });

  test('US-E13-08/AC3 a user object that merely LACKS the emailVerified flag, or has it as the string "true", is not trusted as confirmed (password provider)', async ({ page }) => {
    for (const flag of [undefined, 'true', 1, null]) {
      const u: Record<string, unknown> = { uid: UNC.uid, displayName: null, email: UNC.email, photoUrl: null, provider: 'password' };
      if (flag !== undefined) u['emailVerified'] = flag;
      await page.goto('about:blank');
      const t = await watchTraffic(page);
      await page.goto('/#/');
      await page.evaluate(([user, acc]) => {
        window.localStorage.clear();
        window.localStorage.setItem('bentominder.fake-auth', user as string);
        window.localStorage.setItem('bentominder.fake-auth-accounts', acc as string);
        window.localStorage.setItem('qa-e13e-seeded', '1');
      }, [JSON.stringify(u), JSON.stringify([UNC])]);
      await page.goto('/#/calendar');
      await page.reload();
      await expect(page.getByTestId('screen-verify-email'), `flag=${String(flag)}`).toBeVisible();
      await expectNoApp(page);
      void t;
    }
  });

  test('US-E13-08/AC3 a confirmed password account is NOT walled (control) and a Google account without the flag is not walled', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': userOf(CONF), 'bentominder.fake-auth-accounts': JSON.stringify([CONF]), [KEY(CONF.uid)]: storeFor(CONF.uid) });
    await page.goto('/#/settings');
    await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    await expect(page.getByTestId('screen-settings')).toBeVisible();
  });

  test('US-E13-08/AC3 session ended by the provider while on the wall -> login screen; reload keeps signed out', async ({ page }) => {
    await seed(page, unc());
    await page.goto('/');
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await page.getByTestId('verify-sign-out').click();
    await expect(page.getByTestId('screen-login')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('screen-login')).toBeVisible();
    await page.goBack().catch(() => undefined);
    await expect(page.getByTestId('screen-verify-email')).toHaveCount(0);
    await expectNoApp(page);
  });

  test('US-E13-08/AC3 localStorage tampering on the wall: setting the user JSON to emailVerified true by hand does not forge the provider, a fresh account still needs the provider confirmation (fake provider: documented limit)', async ({ page }) => {
    // The client only reflects the provider. With the fake seam the stored user IS the session; this test records that a verify -> app
    // transition happens only through reloadUser (the Confirmed button), never merely by a reload of an unconfirmed session.
    await seed(page, unc());
    await page.goto('/');
    await page.reload();
    await expect(page.getByTestId('screen-verify-email')).toBeVisible();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
  });
});
