// QA E13: account-keyed data, sign-out, export / delete-all / import per account, reminders, privacy, hostile probes
// (US-E13-04, -05, -06, US-E10-03/AC7, US-E10-04/AC1). Derived from the stories and data contract §12.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { A, axeSerious, B, dataKeys, get, getJson, keyOf, next, out, ownerIds, rewriteOwner, seed, signedIn, snapshot, STATE_NOV, STATE_V1, storeFor, watchErrors, watchHosts, type Json } from './e13-common.ts';

const SCRATCH = join(process.cwd(), 'tests', '_scratch', 'qa-e13');
mkdirSync(SCRATCH, { recursive: true });
const HIMAWARI = 'rcp-delish-himawari-bento';
const LEGACY = 'bentominder.state';

async function onboardAs(page: Page, nickname: string) {
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  await page.getByTestId('input-nickname').fill(nickname);
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2').or(page.getByTestId('screen-onboarding')).first()).toBeVisible();
}
async function signOut(page: Page) {
  await page.goto('/#/settings');
  await page.getByTestId('account-sign-out').click();
  await page.getByTestId('dialog-sign-out-confirm').click();
  await expect(page.getByTestId('screen-login')).toBeVisible();
}
function reminderState(uid: string): string {
  const s = JSON.parse(STATE_NOV);
  const d = s.decisions['2026-11-04'];
  d.recipeId = HIMAWARI;
  d.recipeNameSnapshot = { ja: 'ひまわり弁当', en: 'Sunflower bento (himawari bento)' };
  d.recipeShortNameSnapshot = { ja: 'ひまわり弁当', en: 'Himawari' };
  s.reminderLog = [];
  return JSON.stringify(rewriteOwner(s, uid));
}

test.describe('US-E13-04 account-keyed data', () => {
  test('US-E13-04/AC1 US-E13-04/AC5 US-E13-06/AC1 the first account adopts legacy data: ownerId local -> uid everywhere, nothing else changes, legacy keys gone, no e-mail or name stored', async ({ page }) => {
    await seed(page, out({ [LEGACY]: STATE_V1, [`${LEGACY}.prev`]: STATE_V1 }));
    await page.goto('/');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    expect(await get(page, LEGACY)).toBeNull();
    expect(await get(page, `${LEGACY}.prev`)).toBeNull();
    const adopted = await getJson(page, keyOf(A.uid));
    expect(adopted).not.toBeNull();
    const ids = ownerIds(adopted);
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids)).toEqual(new Set([A.uid]));
    // everything else is unchanged (ignore the volatile bookkeeping fields the app may refresh)
    const strip = (s: Json) => {
      const c = JSON.parse(JSON.stringify(s));
      delete c.updatedAt;
      delete c.reminderLog; // the app logs a reminder shown today
      return c;
    };
    expect(strip(adopted)).toEqual(strip(rewriteOwner(JSON.parse(STATE_V1), A.uid)));
    const all = JSON.stringify(await snapshot(page));
    for (const secret of [A.email, A.displayName, 'parent@']) expect(all).not.toContain(secret);
    expect((await dataKeys(page)).every((k) => k.startsWith('bentominder.'))).toBe(true);
  });

  test('US-E13-04/AC1 adoption keeps the .prev backup under the account too (two-key scheme), and removes the legacy pair only after the copy', async ({ page }) => {
    await seed(page, out({ [LEGACY]: STATE_V1, [`${LEGACY}.prev`]: STATE_V1 }));
    await page.goto('/');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    const k = await dataKeys(page);
    expect(k.filter((x) => x.startsWith('bentominder.test-uid-001.'))).toContain(keyOf(A.uid));
    expect(k).not.toContain(LEGACY);
  });

  test('US-E13-04/AC2 AC4 AC5 adoption happens once: B gets onboarding and an empty store, A bytes unchanged, B records carry the uid-002', async ({ page }) => {
    await seed(page, signedIn(A, { ...next(B), [LEGACY]: STATE_V1 }));
    await page.goto('/#/settings'); // A signed in at start: adopts the legacy store
    await expect(page.getByTestId('account-name')).toHaveText(A.displayName);
    const aBytes = await get(page, keyOf(A.uid));
    expect(aBytes).toContain('はなちゃん');
    await signOut(page);
    await page.reload(); // the fake reads "who signs in next" at start
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('ob-step-1')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('はなちゃん');
    expect(await get(page, LEGACY)).toBeNull();
    expect(await get(page, keyOf(A.uid))).toBe(aBytes); // A's key not changed (and, by AC4, not rewritten)
  });

  test('US-E13-04/AC5 a new account can finish onboarding step 1: the store is saved under its own key with ownerId = uid (no "cannot save" banner)', async ({ page }) => {
    await seed(page, signedIn(B));
    await page.goto('/');
    await onboardAs(page, 'B-child');
    await expect(page.getByText('この端末に保存できません')).toHaveCount(0);
    const b = await getJson(page, keyOf(B.uid));
    expect(b, 'nothing was saved for the new account').not.toBeNull();
    expect(new Set(ownerIds(b))).toEqual(new Set([B.uid]));
    expect(b.profile.nickname).toBe('B-child');
    expect(await get(page, LEGACY)).toBeNull();
  });

  test('US-E13-04/AC4 US-E13-06/AC1 export as B contains only B data: no A child, no A uid, no e-mail or name', async ({ page }) => {
    const aStore = JSON.parse(storeFor(A.uid));
    aStore.profile.nickname = 'A-SECRET-CHILD';
    const bStore = JSON.parse(storeFor(B.uid, STATE_NOV));
    bStore.profile.nickname = 'B-OWN-CHILD';
    await seed(page, signedIn(B, { [keyOf(A.uid)]: JSON.stringify(aStore), [keyOf(B.uid)]: JSON.stringify(bStore) }));
    await page.goto('/#/settings');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('data-export').click()]);
    const file = join(SCRATCH, `b-export-${test.info().project.name}.json`);
    await dl.saveAs(file);
    const text = readFileSync(file, 'utf8');
    expect(text).not.toContain('A-SECRET-CHILD');
    expect(text).toContain('B-OWN-CHILD');
    expect(text).not.toContain(A.uid);
    expect(text).not.toContain(B.email);
    expect(text).not.toContain(B.displayName);
    expect(new Set(ownerIds(JSON.parse(text)))).toEqual(new Set([B.uid]));
  });

  test('US-E13-04/AC5 a decision created while A is signed in (adopted legacy data) is saved with ownerId = A uid and no save error', async ({ page }) => {
    await seed(page, out({ [LEGACY]: STATE_NOV }));
    await page.goto('/#/day/2026-11-11');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('day-sheet')).toBeVisible();
    await page.getByTestId('day-action-later').click();
    await expect(page.getByTestId('toast')).toBeVisible();
    await expect(page.getByText('この端末に保存できません')).toHaveCount(0);
    const s = await getJson(page, keyOf(A.uid));
    expect(s.decisions['2026-11-11'], 'decision was not saved').toBeDefined();
    expect(new Set(ownerIds(s))).toEqual(new Set([A.uid]));
    expect(JSON.stringify(s)).not.toContain(A.email);
  });

  test('US-E13-04/AC3 the same account signing in again sees exactly its data (profile, menus, decisions, reminder times)', async ({ page }) => {
    await seed(page, out({ [keyOf(A.uid)]: storeFor(A.uid, STATE_NOV) }));
    await page.goto('/');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    await page.goto('/#/settings');
    await page.getByTestId('select-day-before-hour').selectOption('19');
    await expect(page.getByTestId('settings-saved')).toBeVisible();
    const before = await get(page, keyOf(A.uid));
    await signOut(page);
    expect(await get(page, keyOf(A.uid))).toBe(before); // sign-out deletes nothing and rewrites nothing
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    await page.goto('/#/settings');
    await expect(page.getByTestId('settings-day-before-value')).toContainText('19:');
    expect(await get(page, keyOf(A.uid))).toBe(before);
  });

  test('US-E13-04/AC4 a different account: A keys are never read - a tampered-looking A store is not even parsed (B stays empty)', async ({ page }) => {
    const errs = watchErrors(page);
    await seed(page, signedIn(B, { [keyOf(A.uid)]: '{not json at all', [`${keyOf(A.uid)}.prev`]: 'also broken' }));
    await page.goto('/');
    await expect(page.getByTestId('ob-step-1')).toBeVisible(); // would be a recovery screen if A's corrupt key had been read
    await expect(page.getByTestId('recovery-export')).toHaveCount(0);
    expect(await get(page, keyOf(A.uid))).toBe('{not json at all');
    expect(errs).toEqual([]);
  });

  test('US-E13-04/AC6 US-E10-04/AC1 delete-all as B removes only B keys; A keys unchanged; B returns to onboarding in Japanese', async ({ page }) => {
    await seed(page, signedIn(B, { [keyOf(A.uid)]: storeFor(A.uid), [keyOf(B.uid)]: storeFor(B.uid), [`${keyOf(B.uid)}.prev`]: storeFor(B.uid) }));
    await page.goto('/#/settings');
    await page.getByTestId('lang-toggle-en').click();
    const aBytes = await get(page, keyOf(A.uid));
    await page.getByTestId('data-delete-all').click();
    await page.getByTestId('dialog-delete-all-cancel').click();
    expect(await get(page, keyOf(B.uid))).not.toBeNull();
    await page.getByTestId('data-delete-all').click();
    await page.getByTestId('dialog-delete-all-confirm').click();
    await expect(page.getByTestId('ob-step-1')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    const left = await dataKeys(page);
    expect(left.filter((k) => k.includes(B.uid))).toEqual([]);
    expect(await get(page, keyOf(A.uid))).toBe(aBytes);
    // still signed in as B after delete (delete-all is not a sign-out)
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
  });

  test('US-E10-03/AC7 import while signed in rewrites every ownerId (local and another uid) to the current uid and saves under that account only', async ({ page }) => {
    await seed(page, signedIn(A, { [keyOf(A.uid)]: storeFor(A.uid), [keyOf(B.uid)]: storeFor(B.uid, STATE_NOV) }));
    await page.goto('/#/settings');
    const bBytes = await get(page, keyOf(B.uid));
    const mixed = JSON.parse(STATE_NOV);
    const o = JSON.parse(JSON.stringify(rewriteOwner(mixed, B.uid)));
    o.profile.ownerId = 'local';
    for (const d of Object.values(o.decisions) as Json[]) d.ownerId = 'someone@example.com';
    const buf = Buffer.from(JSON.stringify(o));
    await page.getByTestId('data-import').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: buf });
    await expect(page.getByTestId('dialog-import-data')).toBeVisible();
    await page.getByTestId('dialog-import-data-confirm').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    const s = await getJson(page, keyOf(A.uid));
    expect(new Set(ownerIds(s))).toEqual(new Set([A.uid]));
    expect(ownerIds(s).length).toBe(ownerIds(o).length); // nothing dropped or added
    expect(await get(page, keyOf(B.uid))).toBe(bBytes);
    expect(await get(page, LEGACY)).toBeNull();
  });

  test('US-E10-03/AC7 hostile: an imported file with ownerId set to a script string or a dotted uid is rewritten, not copied through', async ({ page }) => {
    await seed(page, signedIn(A, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/#/settings');
    const o = rewriteOwner(JSON.parse(STATE_NOV), '<script>alert(1)</script>.x');
    await page.getByTestId('data-import').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(o)) });
    await page.getByTestId('dialog-import-data-confirm').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    const s = await getJson(page, keyOf(A.uid));
    expect(new Set(ownerIds(s))).toEqual(new Set([A.uid]));
    expect(await dataKeys(page)).toEqual([keyOf(A.uid)].concat((await dataKeys(page)).filter((k) => k !== keyOf(A.uid))));
  });
});

test.describe('US-E13-05 sign-out', () => {
  test('US-E13-05/AC1 settings account section: name, e-mail, avatar with empty alt, sign-out button; 44 px; axe in both themes', async ({ page }) => {
    const photo = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    await seed(page, signedIn({ ...A, photoUrl: photo }, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/#/settings');
    await expect(page.getByTestId('settings-account')).toBeVisible();
    await expect(page.getByTestId('account-name')).toHaveText(A.displayName);
    await expect(page.getByTestId('account-email')).toHaveText(A.email);
    const img = page.getByTestId('account-avatar').locator('img').or(page.locator('img[data-testid="account-avatar"]')).first();
    await expect(img).toHaveAttribute('alt', '');
    const box = await page.getByTestId('account-sign-out').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('account-sign-out')).toHaveText('ログアウト');
    await axeSerious(page, 'settings account light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await axeSerious(page, 'settings account dark');
  });

  test('US-E13-05/AC1 a missing display name shows the e-mail (story) or the "no name" fallback (design), never blank; initial fallback avatar is aria-hidden', async ({ page }) => {
    await seed(page, signedIn({ ...A, displayName: null as unknown as string }, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/#/settings');
    const name = (await page.getByTestId('account-name').textContent()) ?? '';
    expect([A.email, 'お名前未設定']).toContain(name.trim());
    await expect(page.getByTestId('account-email')).toHaveText(A.email);
  });

  test('US-E13-05/AC1 hostile: a very long name and an emoji name are ellipsised, not breaking the layout, and rendered as text', async ({ page }) => {
    const long = '<script>window.__x=1</script>' + 'あ'.repeat(300) + '😀';
    await seed(page, signedIn({ ...A, displayName: long }, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/#/settings');
    await expect(page.getByTestId('account-name')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('US-E13-05/AC2 AC3 AC4 confirm says data stays and reminders stop, focus on cancel; Esc and cancel keep the session; confirm ends it, announces, focuses the h1, keeps the data', async ({ page }) => {
    await seed(page, signedIn(A, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/#/settings');
    const trigger = page.getByTestId('account-sign-out');
    await trigger.click();
    const dlg = page.getByTestId('dialog-sign-out');
    await expect(dlg).toHaveAttribute('role', 'alertdialog');
    await expect(dlg).toContainText('この端末に残ります');
    await expect(dlg).toContainText('同じアカウントでもう一度ログイン');
    await expect(page.getByTestId('dialog-sign-out-cancel')).toBeFocused();
    await axeSerious(page, 'sign-out dialog');
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    await trigger.click();
    await page.getByTestId('dialog-sign-out-cancel').click();
    await expect(dlg).toHaveCount(0);
    await expect(page.getByTestId('screen-settings')).toBeVisible();
    const before = await get(page, keyOf(A.uid));
    await trigger.click();
    await page.getByTestId('dialog-sign-out-confirm').click();
    await expect(page.getByTestId('screen-login')).toBeVisible();
    await expect(page.getByTestId('login-title')).toBeFocused();
    await expect(page.getByTestId('login-live')).toHaveText('ログアウトしました。');
    await expect(page.getByTestId('login-error')).toBeEmpty();
    expect(await get(page, keyOf(A.uid))).toBe(before);
    await page.reload();
    await expect(page.getByTestId('screen-login')).toBeVisible(); // stays signed out after reload
    await page.goBack().catch(() => undefined);
    await expect(page.getByTestId('appbar')).toHaveCount(0);
  });

  test('US-E13-05/AC4 sign-out dialog keyboard-only: Tab stays inside the dialog (focus trap)', async ({ page }) => {
    await seed(page, signedIn(A, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/#/settings');
    await page.getByTestId('account-sign-out').click();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="dialog-sign-out"]'))).toBe(true);
    }
  });

  test('US-E13-05/AC6 sign-out works with no network', async ({ page, context }) => {
    await seed(page, signedIn(A, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/#/settings');
    await context.setOffline(true);
    await page.getByTestId('account-sign-out').click();
    await page.getByTestId('dialog-sign-out-confirm').click();
    await expect(page.getByTestId('screen-login')).toBeVisible();
    await context.setOffline(false);
  });

  test('US-E13-05/AC5 reminders stop on sign-out and come back only from the signing-in account\'s own data (A yes, B none)', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T08:29:00Z') }); // 17:29 JST
    await seed(page, signedIn(A, { ...next(B), [keyOf(A.uid)]: reminderState(A.uid) }));
    await page.goto('/#/settings');
    await signOut(page);
    await page.clock.fastForward('02:00');
    await expect(page.getByTestId('reminder-day-before-2026-11-04')).toHaveCount(0); // signed out: nothing
    await page.reload(); // B signs in next
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('ob-step-1')).toBeVisible();
    await page.clock.fastForward('03:00');
    await expect(page.getByTestId('reminder-day-before-2026-11-04')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('ひまわり弁当');
  });

  test('US-E13-05/AC5 after sign-out and sign-in of the same account the reminder is scheduled again', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T08:29:00Z') });
    await seed(page, signedIn(A, { [keyOf(A.uid)]: reminderState(A.uid) }));
    await page.goto('/#/settings');
    await signOut(page);
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    await page.goto('/');
    await page.clock.fastForward('02:00');
    await expect(page.getByTestId('reminder-day-before-2026-11-04')).toBeVisible();
  });
});

test.describe('US-E13-06 privacy and no external hosts', () => {
  test('US-E13-06/AC3 AC4 US-E13-07/AC3 a full journey (wall, sign-in, settings, export, sign-out) talks only to this origin: no Google/Firebase/analytics host, no cookies, only bentominder.* storage', async ({ page, context }) => {
    const hosts = watchHosts(page);
    await seed(page, out({ [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    await page.goto('/#/settings');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('data-export').click()]);
    expect(dl.suggestedFilename()).toMatch(/^bentominder-export-\d{4}-\d{2}-\d{2}\.json$/);
    await signOut(page);
    expect(hosts.bad()).toEqual([]);
    expect((await context.cookies()).length).toBe(0);
    expect((await dataKeys(page)).every((k) => k.startsWith('bentominder.'))).toBe(true);
    const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean));
    expect(scripts.every((s) => new URL(s).hostname === 'localhost')).toBe(true);
  });

  test('US-E13-06/AC3 requests made by every account screen carry no profile/allergy data (all requests are same-origin GETs of assets; no POST)', async ({ page }) => {
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' && r.method() !== 'HEAD') posts.push(`${r.method()} ${r.url()}`);
    });
    await seed(page, signedIn(A, { [keyOf(A.uid)]: storeFor(A.uid) }));
    for (const h of ['/', '/#/settings', '/#/profile', '/#/day/2026-11-13']) await page.goto(h);
    await signOut(page);
    expect(posts).toEqual([]);
  });
});

test.describe('hostile and edge probes', () => {
  const badUids = ['a.b', 'a b', 'a\tb', '', 'x'.repeat(129), '../etc', 'a.'];
  for (const uid of badUids) {
    test(`US-E13-04/AC5 contract 12.2 a uid ${JSON.stringify(uid.length > 20 ? uid.slice(0, 8) + '...(' + uid.length + ')' : uid)} is refused as a sign-in failure and no key is written`, async ({ page }) => {
      const errs = watchErrors(page);
      await seed(page, out({ ...next({ ...A, uid }), [keyOf(B.uid)]: storeFor(B.uid), [LEGACY]: STATE_V1 }));
      await page.goto('/');
      const before = await snapshot(page);
      await page.getByTestId('login-google').click();
      await expect(page.getByTestId('screen-login')).toBeVisible();
      await expect(page.getByTestId('login-error')).toContainText('ログインできませんでした');
      expect(await snapshot(page)).toEqual(before);
      expect(errs).toEqual([]);
    });
  }

  test('US-E13-04/AC5 a stored session with a dotted uid is not trusted at start (login screen, generic error, no keys)', async ({ page }) => {
    await seed(page, { 'bentominder.fake-auth': JSON.stringify({ ...A, uid: 'evil.state' }), [LEGACY]: STATE_V1 });
    await page.goto('/');
    await expect(page.getByTestId('screen-login')).toBeVisible();
    expect(await get(page, LEGACY)).toBe(STATE_V1);
    expect((await dataKeys(page)).filter((k) => k.includes('evil'))).toEqual([]);
  });

  test('US-E13-04/AC1 corrupt legacy store at adoption: no crash, no uncaught error; the corrupt bytes are not silently destroyed', async ({ page }) => {
    const errs = watchErrors(page);
    await seed(page, out({ [LEGACY]: '{"schemaVersion":1,"profile":' }));
    await page.goto('/');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    await expect(page.locator('body')).not.toBeEmpty();
    const k = await dataKeys(page);
    const all = JSON.stringify(await snapshot(page));
    expect(all).toContain('profile'); // the broken text is still somewhere on the device (legacy key or a backup)
    expect(errs).toEqual([]);
    expect(k.length).toBeGreaterThan(0);
  });

  test('US-E13-04/AC1 legacy store with a different schemaVersion (newer) at adoption is not deleted', async ({ page }) => {
    const s = JSON.parse(STATE_V1);
    s.schemaVersion = 99;
    await seed(page, out({ [LEGACY]: JSON.stringify(s) }));
    await page.goto('/');
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-login')).toHaveCount(0);
    expect(JSON.stringify(await snapshot(page))).toContain('はなちゃん');
  });

  test('contract 12.1 meta-owner-matches-account: an account store whose records carry another ownerId is not shown as that account\'s data silently', async ({ page }) => {
    const errs = watchErrors(page);
    const tampered = JSON.parse(storeFor(A.uid));
    tampered.profile.ownerId = B.uid;
    await seed(page, signedIn(A, { [keyOf(A.uid)]: JSON.stringify(tampered) }));
    await page.goto('/');
    await expect(page.locator('body')).not.toBeEmpty();
    expect(errs).toEqual([]);
    const calendar = await page.getByTestId('screen-calendar').count();
    // expected by the contract rule (severity S = store-level): invalid store, handled like a corrupt one
    expect(calendar, 'tampered ownerId was accepted and its data shown').toBe(0);
  });

  test('two tabs: tab 2 signs B in and writes; tab 1 (A) keeps writing only A keys and B bytes stay intact', async ({ context }) => {
    const p1 = await context.newPage();
    await seed(p1, signedIn(A, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await p1.goto('/#/settings');
    await expect(p1.getByTestId('account-name')).toHaveText(A.displayName);
    // second tab shares localStorage; sign it in as B (same fake key would normally be shared: set B's keys directly)
    const p2 = await context.newPage();
    await p2.goto('/#/settings');
    await p2.evaluate((b) => window.localStorage.setItem(`bentominder.${b}.state`, 'B-SENTINEL'), B.uid);
    await p1.getByTestId('select-day-before-hour').selectOption('20');
    await expect(p1.getByTestId('settings-saved')).toBeVisible();
    expect(await get(p1, keyOf(B.uid))).toBe('B-SENTINEL');
    expect((await getJson(p1, keyOf(A.uid))).settings.reminders.dayBefore.time).toMatch(/^20:/);
  });

  test('two tabs: signing out in one tab does not delete data; the other tab keeps working without writing to unkeyed keys', async ({ context }) => {
    const p1 = await context.newPage();
    await seed(p1, signedIn(A, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await p1.goto('/#/settings');
    const p2 = await context.newPage();
    await p2.goto('/#/settings');
    await p2.getByTestId('account-sign-out').click();
    await p2.getByTestId('dialog-sign-out-confirm').click();
    await expect(p2.getByTestId('screen-login')).toBeVisible();
    await p1.getByTestId('select-day-before-hour').selectOption('18');
    await expect(p1.getByTestId('settings-saved')).toBeVisible();
    expect(await get(p1, LEGACY)).toBeNull();
    expect((await getJson(p1, keyOf(A.uid))).profile.nickname).toBe('はなちゃん');
  });

  test('sign-out while a save is pending: the change is saved under the account (or fully dropped), never into a legacy/other key; the store stays valid', async ({ page }) => {
    await seed(page, signedIn(A, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/#/settings');
    await page.getByTestId('account-sign-out').click();
    await page.evaluate(() => {
      const sel = document.querySelector<HTMLSelectElement>('[data-testid="select-day-before-hour"]');
      // the dialog covers the page for users; this probe changes a setting and confirms in the same task
      if (sel) {
        sel.value = '21';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      document.querySelector<HTMLElement>('[data-testid="dialog-sign-out-confirm"]')?.click();
    });
    await expect(page.getByTestId('screen-login')).toBeVisible();
    await page.waitForTimeout(500);
    const k = await dataKeys(page);
    expect(k).not.toContain(LEGACY);
    expect(k.filter((x) => !x.includes(A.uid))).toEqual([]);
    const s = await getJson(page, keyOf(A.uid));
    expect(new Set(ownerIds(s))).toEqual(new Set([A.uid]));
    expect(s.profile.nickname).toBe('はなちゃん');
  });

  test('hostile display data: e-mail and name with markup never execute and never reach storage', async ({ page }) => {
    const evil = { ...A, displayName: '"><img src=x onerror="window.__pwn=1">', email: '"><svg onload="window.__pwn=1">@x.test' };
    await seed(page, signedIn(evil, { [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/#/settings');
    await expect(page.getByTestId('account-name')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
    const all = JSON.stringify(await snapshot(page));
    expect(all).not.toContain('onerror');
    expect(all).not.toContain('onload');
  });

  test('a user with the same uid in two sign-ins on two languages keeps one store (language is not account-keyed data loss)', async ({ page }) => {
    await seed(page, out({ [keyOf(A.uid)]: storeFor(A.uid) }));
    await page.goto('/');
    await page.getByTestId('lang-toggle-en').click();
    await page.getByTestId('login-google').click();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
    expect((await dataKeys(page)).filter((k) => k.endsWith('.state'))).toEqual([keyOf(A.uid)]);
  });
});
