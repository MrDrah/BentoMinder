// M4 slice B on the production build, in both projects (mobile 390 px Europe/Paris, desktop 1280 px
// America/Los_Angeles, so every time below is checked against a non-Tokyo browser): in-app reminders that
// appear while the app is open (the clock is driven with page.clock, no debug panel), missed ones on the next
// open, the today card and its rollover at Tokyo midnight, reminder settings, the theme and axe in ja and en.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectNoSeriousAxe, seedStore } from './helpers.ts';

const HIMAWARI = 'rcp-delish-himawari-bento';

/** The November fixture with a real library recipe on 11-04 (the fixture's own recipe is not in the shipped library). */
function state(options: { clearLog?: boolean } = {}): string {
  const s = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8'));
  const d = s.decisions['2026-11-04'];
  d.recipeId = HIMAWARI;
  d.recipeNameSnapshot = { ja: 'ひまわり弁当', en: 'Sunflower bento (himawari bento)' };
  d.recipeShortNameSnapshot = { ja: 'ひまわり弁当', en: 'Himawari' };
  if (options.clearLog === true) s.reminderLog = [];
  return JSON.stringify(s);
}

const stored = (page: Page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('bentominder.state') ?? 'null'));

/** Opens the app with the browser clock at `iso`, ticking naturally from there. */
async function open(page: Page, iso: string, hash = './', json: string = state()) {
  await page.clock.install({ time: new Date(iso) });
  await seedStore(page, json);
  await page.goto(hash);
}

/** The 200 ms banner fade must be over before axe measures contrast (opacity 1 on every banner). */
const settled = (page: Page) =>
  expect
    .poll(() => page.evaluate(() => [...document.querySelectorAll('.reminder')].every((el) => getComputedStyle(el).opacity === '1')))
    .toBe(true);

const rgb = (page: Page, css: string) =>
  page.evaluate((value) => {
    const el = document.createElement('div');
    el.style.background = value;
    document.body.append(el);
    const c = getComputedStyle(el).backgroundColor;
    el.remove();
    return c;
  }, css);

test('US-E7-02/AC1 US-E7-07/AC1 US-E7-05/AC1 the day-before reminder appears at 17:30 Tokyo time while the app is open, opens the recipe, and once dismissed stays away after a reload', async ({ page }) => {
  await open(page, '2026-11-03T08:29:00Z'); // 17:29 JST (09:29 Paris, 00:29 Los Angeles)
  await expect(page.getByTestId('today-card')).toBeVisible();
  await expect(page.getByTestId('reminder-day-before-2026-11-04')).toHaveCount(0);
  await page.clock.fastForward('02:00');
  const banner = page.getByTestId('reminder-day-before-2026-11-04');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('明日は手作りお弁当の日！レシピを確認しましょう。');
  await expect(banner).toContainText('ひまわり弁当');
  await expect(banner.getByTestId('reminder-missed')).toHaveCount(0); // live, not missed
  await expect(page.getByTestId('reminder-day-before-2026-11-05')).toHaveCount(0);
  await expect.poll(async () => (await stored(page)).reminderLog.find((e: { key: string }) => e.key === 'day-before:2026-11-04')?.shownAt).toMatch(/^2026-11-03T17:3\d:\d\d\+09:00$/);
  await banner.getByTestId('reminder-cta').click();
  await expect(page.getByTestId('screen-recipe')).toBeVisible();
  expect(page.url()).toContain(`#/recipe/${HIMAWARI}?date=2026-11-04`);
  await page.goBack();
  await page.getByTestId('reminder-day-before-2026-11-04').getByTestId('reminder-dismiss').click();
  await expect(page.getByTestId('reminder-day-before-2026-11-04')).toHaveCount(0);
  await expect.poll(async () => (await stored(page)).reminderLog.find((e: { key: string }) => e.key === 'day-before:2026-11-04')?.dismissedAt).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId('today-card')).toBeVisible();
  await expect(page.getByTestId('reminder-day-before-2026-11-04')).toHaveCount(0);
});

test('US-E7-05/AC2 US-E7-07/AC2 opened at 21:00 Tokyo time the missed reminder is shown with its original time and 「（日本時間）」', async ({ page }) => {
  await open(page, '2026-11-03T12:00:00Z'); // 21:00 JST
  const banner = page.getByTestId('reminder-day-before-2026-11-04');
  await expect(banner).toBeVisible();
  await expect(banner.getByTestId('reminder-missed')).toHaveText('11月3日（火） 17:30のお知らせ （日本時間）');
});

test('US-E7-05/AC2 US-E7-03/AC1 first opened at 07:00 Tokyo time on the day: the reminder expired and the today card shows the plan', async ({ page }) => {
  await open(page, '2026-11-03T22:00:00Z'); // 2026-11-04 07:00 JST
  await expect(page.getByTestId('today-headline')).toHaveText('今日は手作りお弁当：ひまわり弁当');
  await expect(page.getByTestId('reminder-list')).toHaveCount(0);
  await expect(page.getByTestId('today-cta')).toHaveAttribute('href', `#/recipe/${HIMAWARI}?date=2026-11-04`);
});

test('US-E7-03/AC3 the today card rolls over at Tokyo midnight without a reload, whatever the browser timezone', async ({ page }) => {
  await open(page, '2026-11-03T14:59:30Z'); // 23:59:30 JST on 11-03 (a holiday outside the menu)
  const card = page.getByTestId('today-card');
  await expect(card).toHaveAttribute('data-today', '2026-11-03');
  await expect(page.getByTestId('today-headline')).toHaveText('次の登園日：11月4日（水）手作りお弁当：ひまわり弁当');
  await page.clock.fastForward('01:00');
  await expect(card).toHaveAttribute('data-today', '2026-11-04');
  await expect(page.getByTestId('today-headline')).toHaveText('今日は手作りお弁当：ひまわり弁当');
  await expect(page.getByTestId('cal-cell-2026-11-04')).toHaveAttribute('data-today', 'true');
});

test('US-E7-01/AC1 US-E7-01/AC2 US-E8-03/AC1 the weekly summary appears on Sunday 14:00 Tokyo time, 「計画する」 opens the day sheet; English dates follow US-E8-03', async ({ page }) => {
  await open(page, '2026-11-08T04:59:00Z', './', state({ clearLog: true })); // 13:59 JST
  await expect(page.getByTestId('today-card')).toBeVisible();
  await expect(page.getByTestId('reminder-weekly-2026-11-09')).toHaveCount(0);
  await page.clock.fastForward('02:00');
  const banner = page.getByTestId('reminder-weekly-2026-11-09');
  await expect(banner).toContainText('週のまとめ（11月9日（月）〜11月15日（日））');
  await expect(banner.getByTestId('reminder-weekly-item-2026-11-12')).toHaveText(/11月12日（木）苦手かも・未計画/);
  await expect(banner.getByTestId('reminder-missed')).toHaveCount(0);
  await settled(page);
  await expectNoSeriousAxe(page, 'weekly banner ja');
  await page.getByTestId('lang-toggle-en').click();
  await expect(banner.getByTestId('reminder-weekly-item-2026-11-12')).toContainText('Thu, Nov 12 might not enjoy · not planned');
  await expect(banner).toContainText('Weekly summary (Mon, Nov 9 – Sun, Nov 15)');
  await expectNoSeriousAxe(page, 'weekly banner en');
  const before = (await stored(page)).decisions;
  await banner.getByTestId('reminder-weekly-plan-2026-11-12').click();
  await expect(page.getByTestId('day-sheet')).toHaveAttribute('data-date', '2026-11-12');
  expect((await stored(page)).decisions).toEqual(before);
});

test('US-E7-05/AC5 US-NF-02/AC1 a day-before and a weekly reminder together: one banner and 「ほかに1件のお知らせ」, keyboard operable, axe finds nothing in ja and en', async ({ page }) => {
  await open(page, '2026-11-03T12:00:00Z', './', state({ clearLog: true })); // 21:00 JST
  await expect(page.getByTestId('reminder-day-before-2026-11-04')).toBeVisible();
  const more = page.getByTestId('reminder-more');
  await expect(more).toHaveText('ほかに1件のお知らせ');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('reminder-weekly-2026-11-02')).toBeVisible();
  await settled(page);
  await expectNoSeriousAxe(page, 'reminders ja');
  await page.getByTestId('lang-toggle-en').click();
  await expect(more).toHaveText('1 more reminder');
  await expect(page.getByTestId('reminder-day-before-2026-11-04')).toContainText('Homemade bento tomorrow! Take a look at the recipe.');
  await expectNoSeriousAxe(page, 'reminders en');
  // dismissing from the keyboard sends focus on to the next banner
  await page.getByTestId('reminder-day-before-2026-11-04').getByTestId('reminder-dismiss').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reminder-weekly-2026-11-02')).toBeFocused();
});

test('US-E7-04/AC1 US-E7-04/AC2 US-E7-06/AC1 US-E7-07/AC2 reminder settings: defaults, the web limit, 「（日本時間）」, changes persist; axe in ja and en', async ({ page }) => {
  await open(page, '2026-11-02T01:00:00Z', './#/settings');
  await expect(page.getByTestId('screen-settings')).toBeVisible();
  await expect(page.getByTestId('switch-weekly')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('switch-day-before')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('settings-weekly-value')).toHaveText('日曜日 14:00 （日本時間）');
  await expect(page.getByTestId('settings-day-before-value')).toHaveText('17:30 （日本時間）');
  await expect(page.getByTestId('settings-web-limit')).toHaveText('ブラウザ版では、アプリを開いているとき・次に開いたときにお知らせします。閉じている間は通知できません。');
  await expectNoSeriousAxe(page, 'settings ja');
  await page.getByTestId('select-weekly-day').selectOption('6');
  await page.getByTestId('select-weekly-hour').selectOption('20');
  await page.getByTestId('select-day-before-hour').selectOption('19');
  await page.getByTestId('select-day-before-minute').selectOption('15');
  await expect(page.getByTestId('settings-saved')).toHaveText('設定を保存しました');
  await page.reload();
  await expect(page.getByTestId('settings-weekly-value')).toHaveText('土曜日 20:00 （日本時間）');
  await expect(page.getByTestId('settings-day-before-value')).toHaveText('19:15 （日本時間）');
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.getByTestId('settings-web-limit')).toContainText("They can't reach you while it's closed.");
  await expect(page.getByTestId('settings-weekly-value')).toHaveText('Saturday 20:00 (Japan time)');
  await expectNoSeriousAxe(page, 'settings en');
});

test('US-E7-04/AC4 switching off 前日のお知らせ removes day-before reminders and the today card still works', async ({ page }) => {
  await open(page, '2026-11-03T09:00:00Z', './#/settings'); // 18:00 JST
  await page.getByTestId('switch-day-before').click();
  await expect(page.getByTestId('switch-day-before')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('select-day-before-hour')).toBeDisabled();
  await page.goto('./#/calendar');
  await expect(page.getByTestId('today-card')).toBeVisible();
  await expect(page.getByTestId('reminder-day-before-2026-11-04')).toHaveCount(0);
});

test('US-E8-05/AC1 US-E8-05/AC2 US-E8-05/AC3 the theme follows the device by default, a manual choice persists, and only planned cells stay solid-filled in both themes; axe in both', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await open(page, '2026-11-03T12:00:00Z'); // a reminder banner is on screen too
  await expect(page.getByTestId('reminder-list')).toBeVisible();
  const body = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const navy = await rgb(page, 'var(--navy-fill)');
  const planned = () => page.getByTestId('cal-cell-2026-11-04').locator('.cell__btn');
  const plain = () => page.getByTestId('cal-cell-2026-11-05').locator('.cell__btn');
  const bg = (loc: ReturnType<typeof planned>) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);
  const light = await body();
  expect(light).toBe(await rgb(page, 'var(--surface-1)'));
  expect(await bg(planned())).toBe(navy);
  expect(await bg(plain())).not.toBe(navy);
  await settled(page);
  await expectNoSeriousAxe(page, 'light calendar');

  await page.emulateMedia({ colorScheme: 'dark' }); // auto follows the device
  await expect.poll(body).not.toBe(light);
  const darkNavy = await rgb(page, 'var(--navy-fill)');
  expect(await bg(planned())).toBe(darkNavy);
  expect(await bg(plain())).not.toBe(darkNavy);
  await settled(page);
  await expectNoSeriousAxe(page, 'auto dark calendar');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(body).toBe(light);
  await page.goto('./#/settings');
  await page.getByTestId('radio-theme-dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(body).not.toBe(light); // dark whatever the device says
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('radio-theme-dark')).toBeChecked();
  await expectNoSeriousAxe(page, 'dark settings');
  await page.goto('./#/calendar');
  await expect(page.getByTestId('today-card')).toBeVisible();
  expect(await bg(planned())).toBe(darkNavy);
  await settled(page);
  await expectNoSeriousAxe(page, 'dark calendar');
  await page.goto('./#/settings');
  await page.getByTestId('radio-theme-auto').check();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await expect.poll(body).toBe(light);
});

test('US-E7-03/AC1 US-E7-03/AC2 US-NF-02/AC1 the today card on a Saturday points to the next school day; axe in ja and en', async ({ page }) => {
  await open(page, '2026-11-07T00:00:00Z'); // Saturday 09:00 JST
  await expect(page.getByTestId('today-headline')).toHaveText('次の登園日：11月9日（月）給食');
  await expect(page.getByTestId('today-card')).toHaveAttribute('href', '#/day/2026-11-09');
  await expectNoSeriousAxe(page, 'today next ja');
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.getByTestId('today-headline')).toHaveText('Next school day: Mon, Nov 9 School lunch');
  await expectNoSeriousAxe(page, 'today next en');
  await page.getByTestId('today-card').click();
  await expect(page.getByTestId('day-sheet')).toHaveAttribute('data-date', '2026-11-09');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`US-E7-05/AC2 US-E7-07/AC2 US-NF-02/AC1 the missed reminder (original time, title, recipe line) passes axe contrast in ja and en, ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, '2026-11-03T12:00:00Z'); // 21:00 JST: the 17:30 reminder is missed
    const banner = page.getByTestId('reminder-day-before-2026-11-04');
    await expect(banner.getByTestId('reminder-missed')).toBeVisible();
    await settled(page);
    await expectNoSeriousAxe(page, `missed reminder ja ${scheme}`);
    await page.getByTestId('lang-toggle-en').click();
    await expect(banner.getByTestId('reminder-missed')).toContainText('Japan time');
    await settled(page);
    await expectNoSeriousAxe(page, `missed reminder en ${scheme}`);
  });
}
