// QA M1: hostile / unexpected responses from the proxy (the client must not trust it), progress state,
// calendar extremes, two tabs writing the same store.
import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FX01, fillProfile, freezeClock, readStore } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

/** Lets the real proxy answer, then rewrites its JSON body. */
async function mutateExtract(page: Page, mutate: (j: any) => any) {
  await page.route('**/api/menu/extract**', async (route) => {
    const resp = await route.fetch({ headers: { ...route.request().headers(), 'x-bm-mock-scenario': 'fixture-menu-2026-11/hand-1' } });
    const json = await resp.json();
    await route.fulfill({ response: resp, body: JSON.stringify(mutate(json)), headers: { ...resp.headers(), 'content-length': undefined as unknown as string } });
  });
}

async function upload(page: Page) {
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
}

test('US-E2-05 BR-11 a dish name carrying markup from the service is rendered as text, never executed', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  await mutateExtract(page, (j) => {
    j.menu.days[0].items[0].text = '<img src=x onerror=alert(1)>';
    return j;
  });
  await upload(page);
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await expect(page.getByTestId('review-dish-2026-11-02-0')).toHaveValue('<img src=x onerror=alert(1)>');
  expect(dialogs).toEqual([]);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
});

test('US-E2-05/AC2 BR-11 service output that breaks the contract (unknown field, 5000-char dish, bad date) is refused, nothing stored', async ({ page }) => {
  for (const [label, mutate] of [
    ['unknown top-level field', (j: any) => ((j.menu.profile = { nickname: 'x' }), j)],
    ['5000-char dish', (j: any) => ((j.menu.days[0].items[0].text = 'あ'.repeat(5000)), j)],
    ['impossible date', (j: any) => ((j.menu.days[0].date = '2026-11-31'), j)],
    ['days is not an array', (j: any) => ((j.menu.days = 'x'), j)],
    ['menu is null', (j: any) => ((j.menu = null), j)],
    ['ok true without menu', (j: any) => ({ ok: true }) as unknown as typeof j],
    ['html instead of json', () => '<html>' as unknown as object],
  ] as const) {
    const p = await page.context().newPage();
    await freezeClock(p);
    await mutateExtract(p, mutate as (j: any) => any);
    await p.addInitScript(() => sessionStorage.getItem('c') === null && (localStorage.clear(), sessionStorage.setItem('c', '1')));
    await upload(p);
    const outcome = p.getByTestId('import-error').or(p.getByTestId('screen-review'));
    await expect(outcome, label).toBeVisible({ timeout: 15_000 });
    const s = await readStore(p);
    if (await p.getByTestId('import-error').count()) {
      expect(s.menus, label).toEqual({});
    } else {
      // reached review: then the 5000-char dish must at least be flagged invalid and block confirm
      test.info().annotations.push({ type: 'observed', description: `${label}: reached review` });
      if (label === '5000-char dish') {
        await expect(p.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
      } else {
        expect(false, `${label}: invalid service output reached the review screen`).toBe(true);
      }
    }
    await p.close();
  }
});

test('BR-22 a prototype-polluting key in the service reply does not pollute the app', async ({ page }) => {
  await page.route('**/api/menu/extract**', async (route) => {
    const resp = await route.fetch({ headers: { ...route.request().headers(), 'x-bm-mock-scenario': 'fixture-menu-2026-11/hand-1' } });
    const text = (await resp.text()).replace('{"ok":true,', '{"__proto__":{"polluted":"yes"},"ok":true,');
    await route.fulfill({ response: resp, body: text, headers: { ...resp.headers(), 'content-length': undefined as unknown as string } });
  });
  await upload(page);
  await expect(page.getByTestId('screen-review').or(page.getByTestId('import-error'))).toBeVisible();
  expect(await page.evaluate(() => ({} as Record<string, unknown>)['polluted'])).toBeUndefined();
});

// D-M1-07 (P4): the client stores source.sha256 from the service reply instead of its own digest of the bytes.
test.fixme('US-E2-04/AC6 D-M1-07 the stored sha256 is computed on the device from the bytes, not taken from the service reply', async ({ page }) => {
  await mutateExtract(page, (j) => {
    j.menu.source.sha256 = 'f'.repeat(64);
    return j;
  });
  await upload(page);
  await expect(page.getByTestId('screen-review').or(page.getByTestId('import-error'))).toBeVisible();
  if (await page.getByTestId('screen-review').count()) {
    const src = (await readStore(page)).menus['2026-11'].extractions[0].source;
    expect(src.sha256).toBe(createHash('sha256').update(readFileSync(FX01)).digest('hex'));
  }
});

test('US-E2-01/AC1 US-E2-04/AC8 progress state 「献立を読み取っています…」 with 「中止する」 is shown while the service works', async ({ page }) => {
  await page.route('**/api/menu/extract**', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('import-progress')).toContainText('献立を読み取っています…');
  await expect(page.getByTestId('import-cancel')).toHaveText('中止する');
  await expect(page.getByTestId('screen-review')).toBeVisible({ timeout: 15_000 });
});

test('US-E2-01/AC1 URL import shows PDFを取得しています… while fetching and disables the button (no double submit)', async ({ page }) => {
  let fetches = 0;
  const pdf = readFileSync(FX01);
  await page.route('**/api/menu/fetch-pdf', async (route) => {
    fetches += 1;
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: pdf });
  });
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('input-url').fill('https://example-kinder.test/m.pdf');
  await page.getByTestId('import-submit').click();
  await expect(page.getByTestId('import-submit')).toBeDisabled();
  await expect(page.getByTestId('import-submit')).toContainText('PDFを取得しています…');
  await page.getByTestId('import-submit').click({ force: true, timeout: 1000 }).catch(() => undefined);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible({ timeout: 15_000 });
  expect(fetches).toBe(1);
});

test('boundaries: the calendar at the extremes of the year range does not crash or show a wrong year', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-later').click();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const [hash, title] of [
    ['#/calendar/9999-12', '9999年12月'],
    ['#/calendar/2000-01', '2000年1月'],
    ['#/calendar/2028-02', '2028年2月'],
    ['#/calendar/2100-02', '2100年2月'],
  ] as const) {
    await page.goto('./' + hash);
    await expect(page.getByTestId('cal-title'), hash).toHaveText(title);
  }
  // 2028-02 has 29 days, 2100-02 has 28 (not a leap year)
  await page.goto('./#/calendar/2028-02');
  expect(await page.locator('[data-testid^="cal-cell-2028-02-"]').count()).toBe(29);
  await page.goto('./#/calendar/2100-02');
  expect(await page.locator('[data-testid^="cal-cell-2100-02-"]').count()).toBe(28);
  await page.goto('./#/calendar/9999-12');
  await page.getByTestId('cal-next').click();
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
  await expect(page.locator('[data-testid^="screen-"]').first()).toBeVisible();
  await page.goto('./#/calendar/0001-01');
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
  await expect(page.locator('[data-testid^="screen-"]').first()).toBeVisible();
});

// D-M1-06 (P2): a tab holding a stale in-memory store overwrites the whole store on its next save (no storage event, no merge).
test.fixme('BR-22 US-E10-01/AC1 D-M1-06 two tabs: a tab that loaded before the other finished must not erase the other tab’s confirmed menu', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  for (const p of [a, b]) await freezeClock(p);
  await a.goto('./');
  await b.goto('./');
  await expect(b.getByTestId('ob-step-1')).toBeVisible();
  // tab A completes onboarding with a confirmed menu
  await fillProfile(a, { nickname: 'タブA' });
  await a.getByTestId('import-upload').setInputFiles(FX01);
  await a.getByTestId('consent-accept').click();
  await expect(a.getByTestId('screen-review')).toBeVisible();
  await a.getByTestId('review-confirm').click();
  await a.getByTestId('dialog-uncertain-confirm').click();
  await expect(a.getByTestId('screen-calendar')).toBeVisible();
  const before = await readStore(a);
  expect(before.menus['2026-11'].confirmed.version).toBe(1);
  // tab B (stale: it still believes nothing is stored) now submits its own profile
  await fillProfile(b, { nickname: 'タブB' });
  await expect(b.getByTestId('ob-step-2')).toBeVisible({ timeout: 5000 }).catch(() => undefined);
  const after = await readStore(b);
  test.info().annotations.push({ type: 'observed', description: `after stale tab B saved: menus=${Object.keys(after.menus).join(',') || 'none'} nickname=${after.profile?.nickname}` });
  expect(Object.keys(after.menus), "tab A's confirmed menu was erased by the stale tab B").toContain('2026-11');
});
