// M1 journeys on the production build with the local proxy (recorded-fixture extractor), in both
// projects (mobile 390 px Europe/Paris en-US; desktop 1280 px Los Angeles): first launch → profile → upload FX-01 → review → confirm
// → calendar; a fetch failure → upload fallback; an extraction failure; export / delete all.
// Every /api request is recorded to prove no child-profile field leaves the device (US-NF-03).
import { expect, test, type Page, type Request } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectNoSeriousAxe, FX01_PDF, seedStore, STATE_V1 } from './helpers.ts';

// 2026-10-28 10:00 JST (OQ-21: from the 20th the import preselects next month, 2026-11).
const NOW = new Date('2026-10-28T01:00:00Z');
const NICKNAME = 'はなちゃん';
const NOTE = '野菜は細かく切ると食べます';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

function recordApi(page: Page): Request[] {
  const seen: Request[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) seen.push(r);
  });
  return seen;
}

/** US-NF-03, US-E2-04/AC7, US-E10-01/AC2: no /api request carries any profile value. */
function expectNoProfileData(requests: Request[]) {
  expect(requests.length).toBeGreaterThan(0);
  const profileValues = [NICKNAME, NOTE, 'age-4-5', 'ing-chicken', 'ing-green-pepper', 'cat-fish', 'none-known', 'theme-animals', 'no-pork', 'child-1'];
  for (const r of requests) {
    const url = new URL(r.url());
    if (url.pathname === '/api/menu/extract') expect([...url.searchParams.keys()].sort()).toEqual(['promptVersion', 'schemaVersion', 'targetMonth']);
    const body = r.postDataBuffer() ?? Buffer.alloc(0);
    const text = `${r.url()} ${body.toString('utf8')} ${JSON.stringify(r.headers())}`;
    for (const v of profileValues) expect(text, `${url.pathname} carries "${v}"`).not.toContain(v);
  }
}

async function createProfile(page: Page) {
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  await page.getByTestId('input-nickname').fill(NICKNAME);
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('picker-likes-option-ing-chicken').click();
  await page.getByTestId('picker-dislikes-option-ing-green-pepper').click();
  await page.getByTestId('picker-dislikes-search').fill('さかな');
  await page.getByTestId('picker-dislikes-option-cat-fish').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('chip-diet-no-pork').click();
  await page.getByTestId('chip-theme-theme-animals').click();
  await page.getByTestId('input-note').fill(NOTE);
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
}

test('US-E1-01/AC1 US-E1-02/AC1 US-E2-03/AC1 US-E2-08/AC1 US-E3-01/AC2 US-E3-02/AC1 US-E3-03/AC1 US-NF-03/AC1 first launch → profile → upload → review → confirm → calendar', async ({ page }) => {
  const api = recordApi(page);
  await page.goto('./');
  await expectNoSeriousAxe(page, 'step 1');
  await createProfile(page);
  await expectNoSeriousAxe(page, 'step 2');
  await expect(page.getByTestId('import-month')).toHaveValue('2026-11');

  await page.getByTestId('import-upload').setInputFiles(FX01_PDF);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  await expectNoSeriousAxe(page, 'consent');
  await page.getByTestId('consent-accept').click();

  await expect(page.getByTestId('screen-review')).toBeVisible();
  await expect(page.getByTestId('stepper')).toContainText('ステップ 3 / 3');
  await expect(page.getByTestId('review-summary')).toContainText('確認が必要な項目：3件');
  await expect(page.getByTestId('review-dish-2026-11-05-0-uncertain')).toContainText('要確認');
  await expectNoSeriousAxe(page, 'review');
  await page.getByTestId('review-dish-2026-11-05-0').fill('さばのみそ煮');
  await expect(page.getByTestId('review-summary')).toContainText('確認が必要な項目：2件');

  await page.getByTestId('review-confirm').click();
  await expect(page.getByTestId('dialog-uncertain')).toContainText('確認が必要な項目が2件あります。このまま確定しますか？');
  await page.getByTestId('dialog-uncertain-confirm').click();

  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  await expect(page.getByTestId('menu-card-missing')).toHaveCount(0);
  await expectNoSeriousAxe(page, 'calendar');

  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('bentominder.state') ?? 'null'));
  expect(stored.profile).toMatchObject({ nickname: NICKNAME, likedIds: ['ing-chicken'], dislikedIds: ['ing-green-pepper', 'cat-fish'] });
  expect(stored.menus['2026-11'].confirmed.version).toBe(1);
  expect(stored.menus['2026-11'].confirmed.days.find((d: { date: string }) => d.date === '2026-11-05').items[0]).toMatchObject({ text: 'さばのみそ煮', verification: { status: 'parent-edited' } });
  expect(stored.menus['2026-11'].extractions[0].source).toMatchObject({ kind: 'upload', filename: 'menu.pdf' });
  expect(stored.consent.aiNoticeVersion).toBe(1);
  expectNoProfileData(api);

  // US-E1-01/AC2: the next launch opens the calendar directly.
  await page.reload();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
});

test('US-E2-02/AC1 US-E2-02/AC2 US-E2-02/AC3 a blocked URL keeps the URL and the upload fallback records both', async ({ page }) => {
  const api = recordApi(page);
  const blocked = 'https://127.0.0.1/menu/2026-11.pdf';
  await page.goto('./');
  await createProfile(page);
  await page.getByTestId('input-url').fill(blocked);
  await page.getByTestId('import-submit').click();
  const panel = page.getByTestId('import-error');
  await expect(panel).toContainText('このサイトからは自動で取得できません。PDFを保存してから、アップロードしてください。');
  await expect(panel).toContainText('入力したURLはそのまま残しています。');
  await expect(page.getByTestId('input-url')).toHaveValue(blocked);
  await expectNoSeriousAxe(page, 'fetch error');
  expect(api.filter((r) => r.url().includes('/api/menu/extract'))).toHaveLength(0);

  await page.getByTestId('import-upload').setInputFiles(FX01_PDF);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('bentominder.state') ?? 'null'));
  expect(stored.menus['2026-11'].extractions[0].source).toMatchObject({ kind: 'upload', filename: 'menu.pdf', url: blocked });
  expectNoProfileData(api);
});

test('US-E2-05/AC2 US-E3-04/AC1 an extraction that stays malformed offers retry, upload and manual entry', async ({ page }) => {
  await page.route('**/api/menu/extract**', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-bm-mock-scenario': 'fixture-menu-2026-11/hand-malformed' } }),
  );
  await page.goto('./');
  await createProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01_PDF);
  await page.getByTestId('consent-accept').click();
  const panel = page.getByTestId('import-error');
  await expect(panel).toContainText('献立を読み取れませんでした。時間をおいて再度お試しください。');
  await expect(page.getByTestId('import-error-retry')).toBeVisible();
  await expectNoSeriousAxe(page, 'extraction error');
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('bentominder.state') ?? 'null'));
  expect(stored.menus).toEqual({});
  expect(stored.aiUsage).toEqual({ '2026-10': 2 });

  await page.getByTestId('import-manual').click();
  await expect(page.getByTestId('screen-review')).toContainText('11月の献立を入力');
  await expect(page.getByTestId('review-confirm-hint')).toHaveText('少なくとも1日分を入力してください');
});

test('US-E10-03/AC4 US-E10-04/AC1 export the store as is, then delete everything', async ({ page }) => {
  await seedStore(page);
  await page.goto('./#/settings');
  await expect(page.getByTestId('screen-settings')).toBeVisible();
  await expectNoSeriousAxe(page, 'settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('data-export').click()]);
  expect(download.suggestedFilename()).toBe('bentominder-export-2026-10-28.json');
  const content = JSON.parse(readFileSync((await download.path()) as string, 'utf8')) as unknown;
  expect(content).toEqual(JSON.parse(STATE_V1));

  await page.getByTestId('data-delete-all').click();
  await expect(page.getByTestId('dialog-delete-all')).toBeVisible();
  await expectNoSeriousAxe(page, 'delete dialog');
  await page.getByTestId('dialog-delete-all-confirm').click();
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
});

test('US-E10-02/AC4 corrupt stored data offers export and start over', async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('seeded') === null) {
      window.localStorage.setItem('bentominder.state', '{ broken');
      window.sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('./');
  await expect(page.getByTestId('screen-corrupt-data')).toBeVisible();
  await expectNoSeriousAxe(page, 'corrupt');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('recovery-export').click()]);
  expect(readFileSync((await download.path()) as string, 'utf8')).toBe('{ broken');
  await page.getByTestId('recovery-reset').click();
  await page.getByTestId('dialog-reset-store-confirm').click();
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
});
