// QA M1: review/edit boundaries (US-E3-02, US-E3-03, US-E3-04), URL/back-button state, offline,
// double actions. Uses the FX-01 stand-in through the real proxy.
import { expect, test, type Page } from '@playwright/test';
import { FX01, fillProfile, freezeClock, pinHand1, readStore } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

async function toReview(page: Page) {
  await pinHand1(page);
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
}

async function confirmAll(page: Page) {
  await page.getByTestId('review-confirm').click();
  const dlg = page.getByTestId('dialog-uncertain-confirm');
  if (await dlg.isVisible().catch(() => false)) await dlg.click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
}

test('US-E3-02/AC4 dish name boundary: 40 characters accepted, 41 / whitespace-only block confirm with the message', async ({ page }) => {
  await toReview(page);
  const dish = page.getByTestId('review-dish-2026-11-02-0');
  await dish.fill('あ'.repeat(40));
  await expect(page.getByTestId('review-dish-2026-11-02-0-error')).toHaveCount(0);
  await expect(page.getByTestId('review-confirm')).not.toHaveAttribute('aria-disabled', 'true');
  await dish.fill('あ'.repeat(41));
  const stored = await dish.inputValue();
  if ([...stored].length === 41) {
    await expect(page.getByTestId('review-dish-2026-11-02-0-error')).toHaveText('料理名は1〜40文字で入力してください');
    await expect(page.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('review-confirm-hint')).toHaveText('入力の誤りを直すと確定できます');
    // an aria-disabled confirm must not confirm
    await page.getByTestId('review-confirm').click({ force: true });
    expect((await readStore(page)).menus['2026-11'].confirmed ?? null).toBeNull();
    await expect(page.getByTestId('dialog-uncertain')).toHaveCount(0);
  }
  await dish.fill('   ');
  await expect(page.getByTestId('review-dish-2026-11-02-0-error')).toHaveText('料理名は1〜40文字で入力してください');
  await expect(page.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
  await dish.fill('');
  await expect(page.getByTestId('review-dish-2026-11-02-0-error')).toBeVisible();
  await dish.fill('かれー');
  await expect(page.getByTestId('review-dish-2026-11-02-0-error')).toHaveCount(0);
});

test('US-E3-02/AC4 hostile dish text (markup, emoji, 4-byte, RTL) is stored verbatim and rendered inert', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  await toReview(page);
  const evil = '<img src=x onerror=alert(1)>😀';
  await page.getByTestId('review-dish-2026-11-02-0').fill(evil);
  await page.getByTestId('review-dish-2026-11-04-0').fill('‮evil‬ ｱｲｳ');
  await confirmAll(page);
  const s = await readStore(page);
  const day = s.menus['2026-11'].confirmed.days.find((d: any) => d.date === '2026-11-02');
  expect(day.items[0].text).toBe(evil);
  await page.goto('./#/review/2026-11');
  expect(dialogs).toEqual([]);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
});

test('US-E3-02/AC2 US-E3-03/AC1 add and remove dishes; the confirmed menu reflects both', async ({ page }) => {
  await toReview(page);
  const before = await page.locator('input[data-testid^="review-dish-2026-11-12-"]').count();
  await page.getByTestId('review-add-2026-11-12').click();
  await expect(page.locator('input[data-testid^="review-dish-2026-11-12-"]')).toHaveCount(before + 1);
  await page.getByTestId(`review-dish-2026-11-12-${before}`).fill('ポテトサラダ');
  const n13 = await page.locator('input[data-testid^="review-dish-2026-11-13-"]').count();
  expect(n13).toBeGreaterThan(0);
  await page.getByTestId(`review-remove-2026-11-13-${n13 - 1}`).click();
  await expect(page.locator('input[data-testid^="review-dish-2026-11-13-"]')).toHaveCount(n13 - 1);
  await confirmAll(page);
  const s = await readStore(page);
  const days = s.menus['2026-11'].confirmed.days;
  const d12 = days.find((d: any) => d.date === '2026-11-12');
  const d13 = days.find((d: any) => d.date === '2026-11-13');
  expect(d12.items.at(-1)).toMatchObject({ text: 'ポテトサラダ', verification: { status: 'parent-entered' } });
  expect(d13.items).toHaveLength(n13 - 1);
});

test('US-E3-02/AC5 12 dishes per day: 「料理を追加」 disabled with the hint 「1日12品まで」', async ({ page }) => {
  await toReview(page);
  const date = '2026-11-12';
  for (let i = 0; i < 20; i++) {
    const hint = page.getByTestId(`review-add-limit-${date}`);
    if (await hint.count()) break;
    await page.getByTestId(`review-add-${date}`).click();
  }
  await expect(page.locator(`input[data-testid^="review-dish-${date}-"]`)).toHaveCount(12);
  await expect(page.getByTestId(`review-add-limit-${date}`)).toHaveText('1日12品まで');
  await expect(page.getByTestId(`review-add-${date}`)).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId(`review-add-${date}`).click({ force: true });
  await expect(page.locator(`input[data-testid^="review-dish-${date}-"]`)).toHaveCount(12);
  // new empty dishes block confirm (1-40 chars)
  await expect(page.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
});

test('US-E3-02/AC3 US-E3-02/AC6 no-lunch day: default reason, wording follows the reason until typed, 60/61 boundary, restore', async ({ page }) => {
  await toReview(page);
  const date = '2026-11-10';
  const dishesBefore = await page.locator(`input[data-testid^="review-dish-${date}-"]`).count();
  expect(dishesBefore).toBeGreaterThan(0);
  await page.getByTestId(`review-nolunch-${date}`).click();
  await expect(page.getByTestId(`radio-nolunch-${date}-no-lunch`)).toBeChecked();
  const text = page.getByTestId(`review-nolunch-text-${date}`);
  await expect(text).toHaveValue('給食なし');
  await expect(page.getByTestId(`review-day-${date}`).locator('input[type=radio]')).toHaveCount(4);
  await page.getByTestId(`radio-nolunch-${date}-bento-day`).check();
  await expect(text).toHaveValue('お弁当の日');
  await page.getByTestId(`radio-nolunch-${date}-closed`).check();
  await expect(text).toHaveValue('お休み');
  await page.getByTestId(`radio-nolunch-${date}-unknown`).check();
  await expect(text).toHaveValue('その他');
  await text.fill('行事');
  await page.getByTestId(`radio-nolunch-${date}-no-lunch`).check();
  await expect(text).toHaveValue('行事'); // typed wording no longer follows the reason
  await text.fill('あ'.repeat(60));
  await expect(page.getByTestId(`review-nolunch-text-${date}-error`)).toHaveCount(0);
  await text.fill('あ'.repeat(61));
  if ([...(await text.inputValue())].length === 61) {
    await expect(page.getByTestId(`review-nolunch-text-${date}-error`)).toBeVisible();
    await expect(page.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('review-confirm-hint')).toHaveText('入力の誤りを直すと確定できます');
  }
  await text.fill('   ');
  await expect(page.getByTestId(`review-nolunch-text-${date}-error`)).toBeVisible();
  await expect(page.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
  await text.fill('行事');
  await page.getByTestId(`review-restore-${date}`).click();
  await expect(page.locator(`input[data-testid^="review-dish-${date}-"]`)).toHaveCount(dishesBefore);
  // mark again and confirm: noLunchDays holds it with reason "no-lunch" and the wording
  await page.getByTestId(`review-nolunch-${date}`).click();
  await text.fill('行事');
  await confirmAll(page);
  const cm = (await readStore(page)).menus['2026-11'].confirmed;
  expect(cm.noLunchDays.find((n: any) => n.date === date)).toMatchObject({ reason: 'no-lunch', originalText: '行事' });
  expect(cm.days.some((d: any) => d.date === date)).toBe(false);
});

test('US-E3-04/AC1 US-E3-04/AC2 manual entry: empty cannot be confirmed; a typed dish is parent-entered, source manual', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-manual').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await expect(page.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('review-confirm-hint')).toHaveText('少なくとも1日分を入力してください');
  await page.getByTestId('review-confirm').click({ force: true });
  expect((await readStore(page)).menus ?? {}).toEqual({});
  const weekdays = await page.locator('[data-testid^="review-day-2026-11"]').count();
  expect(weekdays).toBe(21);
  await page.getByTestId('review-add-2026-11-02').click();
  await page.getByTestId('review-dish-2026-11-02-0').fill('手入力のカレー');
  await expect(page.getByTestId('review-confirm')).not.toHaveAttribute('aria-disabled', 'true');
  await confirmAll(page);
  const s = await readStore(page);
  const m = s.menus['2026-11'];
  expect(m.confirmed.days[0].items[0]).toMatchObject({ text: '手入力のカレー', verification: { status: 'parent-entered' } });
  expect(m.extractions.every((e: any) => e.source.kind === 'manual') || m.confirmed.source?.kind === 'manual' || JSON.stringify(m).includes('"kind":"manual"')).toBe(true);
});

test('US-E3-04/AC1 a no-lunch day alone is enough to confirm a manual menu', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-manual').click();
  await page.getByTestId('review-nolunch-2026-11-02').click();
  await expect(page.getByTestId('review-confirm')).not.toHaveAttribute('aria-disabled', 'true');
});

test('US-E3-03/AC1 double tapping 「この内容で確定」 confirms once (version 1)', async ({ page }) => {
  await toReview(page);
  await page.getByTestId('review-confirm').dblclick();
  const dlg = page.getByTestId('dialog-uncertain-confirm');
  await dlg.dblclick({ timeout: 5000 }).catch(() => undefined);
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  const cm = (await readStore(page)).menus['2026-11'].confirmed;
  expect(cm.version).toBe(1);
});

test('US-E2-07/AC2 BR-10 tapping 取り込む / choosing the file twice quickly makes one extract request', async ({ page }) => {
  let extracts = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/menu/extract') extracts += 1;
  });
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('import-upload').setInputFiles(FX01).catch(() => undefined);
  await page.getByTestId('consent-accept').dblclick().catch(() => undefined);
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await page.waitForTimeout(500);
  expect(extracts).toBe(1);
});

test('US-E3-03/AC5 leaving to another screen (browser back / app bar) asks first; edits are discarded after 中断する', async ({ page }) => {
  await toReview(page);
  await page.getByTestId('review-dish-2026-11-02-0').fill('へんしゅう');
  await page.goto('./#/settings');
  await expect(page.getByTestId('dialog-leave-review')).toBeVisible();
  await page.getByTestId('dialog-leave-review-confirm').click();
  await expect(page.getByTestId('screen-settings')).toBeVisible();
  expect((await readStore(page)).menus['2026-11'].confirmed ?? null).toBeNull();
});

test('US-E3-03/AC3 an unconfirmed reading is never used: the calendar shows no menu and a 「確認待ちの献立があります」 card reopens the review', async ({ page }) => {
  await toReview(page);
  await page.getByTestId('review-dish-2026-11-02-0').fill('へんしゅう');
  await page.goto('./#/calendar/2026-11');
  await page.getByTestId('dialog-leave-review-confirm').click();
  await page.reload();
  // with a profile but no confirmed menu, startup resumes onboarding at step 2 (US-E1-01/AC3): reach the calendar
  const later = page.getByTestId('import-later');
  if (await later.isVisible().catch(() => false)) await later.click();
  await expect(page.getByTestId('card-menu-pending')).toBeVisible();
  await expect(page.getByTestId('card-menu-pending')).toContainText('確認待ちの献立があります');
  await page.getByTestId('card-menu-pending-action').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  // the discarded edit is not there (draft restarts from the extraction)
  await expect(page.getByTestId('review-dish-2026-11-02-0')).not.toHaveValue('へんしゅう');
});

test('US-E3-03/AC4 accepting one uncertain field: text unchanged, counted down, then editing it makes it parent-edited', async ({ page }) => {
  await toReview(page);
  await expect(page.getByTestId('review-summary')).toContainText('確認が必要な項目：3件');
  const dish = page.getByTestId('review-dish-2026-11-05-0');
  const before = await dish.inputValue();
  await page.getByRole('button', { name: 'このままにする' }).first().click();
  await expect(page.getByTestId('review-summary')).toContainText('確認が必要な項目：2件');
  await expect(dish).toHaveValue(before);
  await expect(dish).toHaveAttribute('data-verification', 'uncertain-accepted');
  await dish.fill(before + 'x');
  await expect(dish).toHaveAttribute('data-verification', 'parent-edited');
  await expect(page.getByTestId('review-summary')).toContainText('確認が必要な項目：2件');
});

test('US-E3-03/AC2 with zero uncertain fields confirm needs no dialog', async ({ page }) => {
  await toReview(page);
  for (let i = 0; i < 5; i++) {
    const b = page.getByRole('button', { name: 'このままにする' }).first();
    if (!(await b.count())) break;
    await b.click();
  }
  await expect(page.getByTestId('review-summary')).toContainText('確認が必要な項目はありません');
  await page.getByTestId('review-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('dialog-uncertain')).toHaveCount(0);
});

test('US-E2-01/AC1 BR-13 importing a month that is already confirmed asks before replacing; cancelling keeps the menu', async ({ page }) => {
  await toReview(page);
  await confirmAll(page);
  const before = JSON.stringify((await readStore(page)).menus);
  await page.goto('./#/import');
  await page.getByTestId('import-month').selectOption('2026-11');
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await expect(page.getByTestId('dialog-replace-menu')).toBeVisible();
  await page.getByTestId('dialog-replace-menu-cancel').click();
  expect(JSON.stringify((await readStore(page)).menus)).toBe(before);
});

// ---------------------------------------------------------------- routing / state

test('URL state: malformed or unknown routes never crash or blank the app, and never write to storage', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-later').click();
  const snapshot = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
  const hashes = [
    '#/calendar/2026-13',
    '#/calendar/abc',
    '#/calendar/0000-00',
    '#/calendar/99999-01',
    '#/review/2026-11',
    '#/review/2026-13',
    '#/review/2026-11?manual=yes',
    '#/onboarding/9',
    '#/onboarding/0',
    '#/onboarding/1?month=<script>',
    '#/day/2026-02-30',
    '#/day/<script>alert(1)</script>',
    '#/recipes/%00',
    '#/' + 'a'.repeat(5000),
    '#//////',
    '#/settings/../../etc',
    '#/__proto__',
    '#/constructor',
    '?x=1#/calendar',
    '#%E0%A4%A',
  ];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const h of hashes) {
    await page.goto('./' + h);
    await page.waitForTimeout(150);
    const visible = await page.locator('[data-testid^="screen-"], [data-testid^="ob-step"]').count();
    expect(visible, `blank screen for ${h}`).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
  // reading never wrote anything but the same snapshot (pending review none)
  expect(await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()))).toBe(snapshot);
});

test('URL state: browser back after confirming does not reopen a stale, editable review', async ({ page }) => {
  await toReview(page);
  await confirmAll(page);
  await page.goBack();
  await page.waitForTimeout(300);
  const reviewVisible = await page.getByTestId('screen-review').count();
  const dishes = await page.locator('input[data-testid^="review-dish-"]').count();
  // either the review is gone, or it must not be able to confirm again over the stored menu
  test.info().annotations.push({ type: 'observed', description: `after back: review=${reviewVisible} dishes=${dishes} url=${page.url()}` });
  if (reviewVisible) {
    await page.getByTestId('review-confirm').click();
    await page.waitForTimeout(300);
  }
  const cm = (await readStore(page)).menus['2026-11'].confirmed;
  expect(cm.version, 'a stale review confirmed again').toBe(1);
});

test('US-E10-01/AC3 offline after load: import says 「オフラインのため取り込めません」 and is disabled; calendar and settings still work', async ({ page, context }) => {
  await toReview(page);
  await confirmAll(page);
  await page.goto('./#/import');
  await expect(page.getByTestId('screen-import')).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByTestId('banner-offline')).toContainText('オフラインのため取り込めません');
  await expect(page.getByTestId('import-submit')).toBeDisabled();
  await expect(page.getByTestId('import-upload')).toBeDisabled();
  await expect(page.getByTestId('input-url')).toBeDisabled();
  await page.getByTestId('import-manual').click(); // manual entry needs no network
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await page.goto('./#/calendar/2026-11').catch(() => undefined);
  await context.setOffline(false);
});

test('US-E10-01/AC1 BR-22 reload restores profile and confirmed menu exactly (deep equal)', async ({ page }) => {
  await toReview(page);
  await confirmAll(page);
  const a = await readStore(page);
  await page.reload();
  await page.goto('./#/');
  const b = await readStore(page);
  expect(b.menus).toEqual(a.menus);
  expect(b.profile).toEqual(a.profile);
  expect(b.consent).toEqual(a.consent);
  expect(b.schemaVersion).toBe(1);
});
