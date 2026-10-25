// M2 on the production build, in both projects (mobile 390 px Europe/Paris en-US; desktop 1280 px
// Los Angeles en-US): the calendar with the assessment and the decision of every day, the grid
// keyboard model, month boundaries, the day sheet, overrides and decisions, a refresh that keeps
// both, and two tabs editing decisions. Today is fixed at 2026-11-02 10:00 JST.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectNoSeriousAxe, FX01_PDF, seedStore } from './helpers.ts';

const STATE = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');
const NOW = new Date('2026-11-02T01:00:00Z');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

const stored = (page: Page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('bentominder.state') ?? 'null'));
const cell = (page: Page, date: string) => page.getByTestId(`cal-cell-${date}`);
const openDay = async (page: Page, date: string) => {
  // on a phone an open sheet covers the grid: close it first (the desktop panel stays beside it)
  const close = page.getByTestId('day-sheet-close');
  if (await close.isVisible().catch(() => false)) await close.click();
  await cell(page, date).getByRole('button').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
};

test('US-E5-01/AC3 US-E5-01/AC4 US-NF-02/AC1 the calendar shows assessment and decision apart; axe finds nothing serious', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-assessment', 'low-preference');
  await expect(cell(page, '2026-11-12')).toHaveAttribute('data-decision', 'school-lunch-planned');
  await expect(cell(page, '2026-11-12')).toHaveAttribute('data-assessment', 'low-preference');
  await expect(cell(page, '2026-11-02')).toHaveAttribute('aria-current', 'date');
  await expect(cell(page, '2026-11-04').getByRole('button')).toHaveAccessibleName('11月4日（水）、苦手かも、手作りお弁当：くまさんおにぎり弁当');
  await expectNoSeriousAxe(page, 'calendar');
  await page.getByTestId('legend-toggle').click();
  await expectNoSeriousAxe(page, 'calendar with legend');
});

test('US-E5-01/AC3 grid keyboard: one tab stop, arrows, Home/End, PageDown, Enter opens the sheet and Esc returns the focus to the cell', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./');
  const button = (date: string) => cell(page, date).getByRole('button');
  await button('2026-11-04').focus();
  await page.keyboard.press('ArrowRight');
  await expect(button('2026-11-05')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(button('2026-11-12')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(button('2026-11-09')).toBeFocused();
  await page.keyboard.press('End');
  await expect(button('2026-11-15')).toBeFocused();
  // Tab leaves the grid: only the roving date is a tab stop
  await expect(page.locator('[data-testid="cal-grid"] button[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('cal-title')).toHaveText('2026年12月');
  await expect(button('2026-12-15')).toBeFocused();
  await page.keyboard.press('PageUp');
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  await button('2026-11-04').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await expect(page.getByTestId('day-sheet-title')).toBeFocused();
  await expectNoSeriousAxe(page, 'day sheet');
  if (test.info().project.name === 'mobile') {
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('day-sheet')).toHaveCount(0);
    await expect(button('2026-11-04')).toBeFocused();
  }
});

test('US-E5-01/AC5 US-E5-01/AC6 month boundaries: Nov → Jan 2027 with two taps, 「今日」 returns, February 2028 has 29 cells', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./');
  await page.getByTestId('cal-next').click();
  await page.getByTestId('cal-next').click();
  await expect(page.getByTestId('cal-title')).toHaveText('2027年1月');
  await expect(page.getByTestId('cal-cell-2027-01-01').getByRole('button')).toHaveAccessibleName('1月1日（金）、献立未取り込み');
  await expect(page.getByTestId('menu-card-missing')).toContainText('1月の献立がまだありません');
  await page.getByTestId('cal-today').click();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  await page.goto('./#/calendar/2028-02');
  await expect(page.locator('[data-testid^="cal-cell-2028-02-"]')).toHaveCount(29);
  await page.goto('./#/calendar/2027-02');
  await expect(page.locator('[data-testid^="cal-cell-2027-02-"]')).toHaveCount(28);
});

test('US-E4-03/AC2 US-E3-05/AC1 US-E3-05/AC9 an override survives a reload and a menu refresh; the refresh keeps the plan and lists the changed days', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./');
  await openDay(page, '2026-11-11');
  await page.getByTestId('override-open').click();
  await page.getByTestId('override-option-low-preference').click();
  await expect(page.getByTestId('assess-override-tag')).toBeVisible();
  await expect(cell(page, '2026-11-11')).toHaveAttribute('data-override', 'low-preference');
  await page.reload();
  await expect(cell(page, '2026-11-11')).toHaveAttribute('data-override', 'low-preference');
  const before = await stored(page);
  expect(before.overrides['2026-11-11']).toMatchObject({ state: 'low-preference', menuVersionAtSet: 1 });

  // refresh November: import the PDF again (the stand-in answer differs on 11-05), confirm
  await page.goto('./#/import');
  await page.getByTestId('import-month').selectOption('2026-11');
  await page.getByTestId('import-upload').setInputFiles(FX01_PDF);
  const replace = page.getByTestId('dialog-replace-menu');
  if (await replace.isVisible().catch(() => false)) {
    await expect(replace).toContainText('お弁当の予定は変更されません');
    await page.getByTestId('dialog-replace-menu-confirm').click();
  }
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await page.getByTestId('review-confirm').click();
  const ask = page.getByTestId('dialog-uncertain-confirm');
  if (await ask.isVisible().catch(() => false)) await ask.click();
  await expect(page.getByTestId('screen-refresh-review')).toBeVisible();
  await expect(page.getByTestId('refresh-review-row-2026-11-05')).toContainText('判定を手動で変更しています');
  await expectNoSeriousAxe(page, 'refresh review');

  const after = await stored(page);
  expect(after.menus['2026-11'].confirmed.version).toBe(2);
  expect(after.decisions).toEqual(before.decisions); // 100 % of the decisions kept
  expect(after.overrides).toEqual(before.overrides); // and of the overrides
  await page.getByTestId('refresh-review-done').click();
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  await expect(cell(page, '2026-11-11')).toHaveAttribute('data-override', 'low-preference');
  await page.reload();
  await expect(cell(page, '2026-11-11')).toHaveAttribute('data-override', 'low-preference');
  await page.goto('./#/settings');
  await expect(page.getByTestId('settings-menu-needs-review')).toContainText('確認が必要な日');
});

test('US-E5-05/AC1 US-E5-06/AC2 US-E5-06/AC3 US-E5-07/AC3 decide later, tick the reservation record, and go back to school lunch only after the dialog; reloads keep it', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./');
  await openDay(page, '2026-11-11');
  await page.getByTestId('day-action-later').click();
  await expect(page.getByTestId('toast')).toContainText('11月11日（水）を「未定」にしました');
  await expect(cell(page, '2026-11-11')).toHaveAttribute('data-decision', 'not-confirmed');
  await page.reload();
  await expect(cell(page, '2026-11-11')).toHaveAttribute('data-decision', 'not-confirmed');
  await openDay(page, '2026-11-04');
  await page.getByTestId('day-action-school').click();
  await expect(page.getByRole('alertdialog')).toContainText('11月4日の手作りお弁当の予定を取り消しますか？');
  await expectNoSeriousAxe(page, 'cancel dialog');
  await page.getByTestId('dialog-cancel-plan-cancel').click();
  expect((await stored(page)).decisions['2026-11-04'].state).toBe('homemade-bento-planned');
  await page.getByTestId('day-action-school').click();
  await page.getByTestId('dialog-cancel-plan-confirm').click();
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-decision', 'school-lunch-planned');
  expect((await stored(page)).decisions['2026-11-04']).toMatchObject({ state: 'school-lunch-planned' });
  expect((await stored(page)).decisions['2026-11-04']).not.toHaveProperty('recipeId');
});

test('US-E5-03/AC1 US-E5-03/AC3 「手作りお弁当にする」 opens the recommendation view and changes nothing; back returns to the sheet', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./');
  await openDay(page, '2026-11-12');
  const before = await stored(page);
  await page.getByTestId('day-action-bento').click();
  await expect(page.getByTestId('screen-recommend')).toBeVisible();
  await page.getByTestId('topbar-back').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  expect(await stored(page)).toEqual(before);
});

test('US-E5-01/AC8 the week can start on Sunday; the setting survives a reload', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./#/settings');
  await page.getByTestId('radio-week-start-sunday').check();
  await expectNoSeriousAxe(page, 'settings');
  await page.goto('./');
  await expect(page.getByRole('columnheader').first()).toHaveText('日');
  await page.reload();
  await expect(page.getByRole('columnheader').first()).toHaveText('日');
});

test('US-E3-05/AC2 US-E3-05/AC7 a refresh conflict is flagged; 「このまま」 keeps the plan, 「計画を取り消す」 asks and removes it', async ({ page }) => {
  const conflicted = JSON.parse(STATE);
  const confirmed = conflicted.menus['2026-11'].confirmed;
  confirmed.version = 2;
  confirmed.days = confirmed.days.filter((d: { date: string }) => d.date !== '2026-11-04');
  confirmed.noLunchDays = [...confirmed.noLunchDays, { date: '2026-11-04', reason: 'no-lunch', originalText: '午前保育（給食なし）', verification: { status: 'ok' } }].sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
  confirmed.changedDatesSincePrevious = ['2026-11-04'];
  await seedStore(page, JSON.stringify(conflicted));
  await page.goto('./');
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-flag', 'changed');
  await expect(page.getByTestId('upcoming-conflict-2026-11-04')).toContainText('献立が変わりました');
  await openDay(page, '2026-11-04');
  await expect(page.getByTestId('day-banner-conflict')).toContainText('献立の更新で、この日は給食なしになりました。予定を確認してください。');
  await expect(page.getByTestId('day-action-keep')).toBeVisible();
  await expect(page.getByTestId('day-action-later')).toHaveCount(0);
  await expectNoSeriousAxe(page, 'conflict sheet');
  await page.getByTestId('day-action-keep').click();
  await expect(page.getByTestId('upcoming-conflict-2026-11-04')).toHaveCount(0);
  expect((await stored(page)).decisions['2026-11-04']).toMatchObject({ state: 'homemade-bento-planned', acknowledgedMenuVersion: 2 });
  await page.getByTestId('day-action-clear-plan').click();
  await page.getByTestId('dialog-clear-plan-confirm').click();
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-decision', 'no-school-lunch');
  expect((await stored(page)).decisions['2026-11-04']).toBeUndefined();
});

test('US-E2-05/AC7 US-E2-05/AC9 review: a weekday-mismatch day is moved to a free date with the picker; axe clean on the picker', async ({ page }) => {
  // the recorded weekday-mismatch fixture as a pending review
  const hand = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'menus', 'fixture-menu-2026-11-wdmismatch', 'recorded', 'hand-1.json'), 'utf8'));
  const base = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'v1.json'), 'utf8'));
  base.menus = {};
  base.decisions = {};
  base.overrides = {};
  const out = hand.response.modelOutput;
  const extraction = {
    ...out,
    id: 'ext-2026-11-aaaaaaaa',
    source: { kind: 'fixture', filename: 'menu.pdf', sha256: 'a'.repeat(64), byteSize: 1, fetchedAt: '2026-11-02T10:00:00+09:00', model: 'gemini-3.8-flash', promptVersion: 1 },
    extractedAt: '2026-11-02T10:00:00+09:00',
  };
  base.menus['2026-11'] = { month: '2026-11', extractions: [extraction], confirmed: null, pendingReviewExtractionId: extraction.id, ownerId: 'local', createdAt: extraction.extractedAt, updatedAt: extraction.extractedAt };
  await seedStore(page, JSON.stringify(base));
  await page.goto('./#/review/2026-11');
  const day = page.getByTestId('review-day-2026-11-04');
  await expect(day).toContainText('日付と曜日が合いません');
  for (let i = 4; i >= 0; i -= 1) {
    const remove = page.getByTestId(`review-remove-2026-11-05-${i}`);
    if (await remove.count()) await remove.click();
  }
  await page.getByTestId('review-fixdate-2026-11-04').click();
  await expect(page.getByTestId('datefix-sheet')).toBeVisible();
  await expect(page.getByTestId('datefix-cell-2026-11-05')).toBeFocused();
  await expectNoSeriousAxe(page, 'date picker');
  await page.getByTestId('datefix-cell-2026-11-12').click({ force: true }); // aria-disabled: Playwright treats it as not enabled, a person can still press it
  await expect(page.getByTestId('datefix-status')).toContainText('11月12日（木）は選べません：ほかの献立があります');
  await page.getByTestId('datefix-cell-2026-11-05').click();
  await page.getByTestId('datefix-apply').click();
  await expect(page.getByTestId('review-printed-2026-11-05')).toContainText('献立表の表記：4日（木）');
  await expect(page.getByTestId('review-day-2026-11-04')).toContainText('献立に記載なし');
  await expectNoSeriousAxe(page, 'review after the correction');
});

test('US-E10-01/AC1 D-M1-06 two tabs: an idle tab shows the other tab\'s decision; a stale tab\'s edit is refused and the stored decision stays', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  for (const p of [a, b]) {
    await p.clock.setFixedTime(NOW);
    await seedStore(p, STATE);
  }
  // tab B never hears about tab A's save, so only the compare-and-swap protects the data
  await b.addInitScript(() => {
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
      if (type === 'storage') return;
      return (original as (...args: unknown[]) => void).call(this, type, ...rest);
    } as typeof original;
  });
  await a.goto('./');
  await b.goto('./');
  await expect(cell(b, '2026-11-11')).toBeVisible();
  await openDay(a, '2026-11-11');
  await a.getByTestId('day-action-later').click();
  await expect(cell(a, '2026-11-11')).toHaveAttribute('data-decision', 'not-confirmed');
  // B is stale: it still shows school lunch for 11-11 and tries to plan 11-12 as "decide later"
  await expect(cell(b, '2026-11-11')).toHaveAttribute('data-decision', 'school-lunch-planned');
  await openDay(b, '2026-11-12');
  await b.getByTestId('day-action-later').click();
  await expect(b.getByTestId('banner-updated-elsewhere')).toBeVisible();
  const state = await stored(b);
  expect(state.decisions['2026-11-11'].state).toBe('not-confirmed'); // A's decision survives
  expect(state.decisions['2026-11-12']).toBeUndefined(); // B's refused edit was not written, not merged
  await expect(cell(b, '2026-11-11')).toHaveAttribute('data-decision', 'not-confirmed'); // B now shows what is stored
  await expect(cell(b, '2026-11-12')).toHaveAttribute('data-decision', 'school-lunch-planned');
});

test('US-E10-01/AC1 D-M1-06 two tabs: with the storage event an idle tab reloads and shows the decision at once', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  for (const p of [a, b]) {
    await p.clock.setFixedTime(NOW);
    await seedStore(p, STATE);
  }
  await a.goto('./');
  await b.goto('./');
  await expect(cell(b, '2026-11-11')).toBeVisible();
  await openDay(a, '2026-11-11');
  await a.getByTestId('day-action-later').click();
  await expect(b.getByTestId('banner-updated-elsewhere')).toBeVisible();
  await expect(cell(b, '2026-11-11')).toHaveAttribute('data-decision', 'not-confirmed');
});
