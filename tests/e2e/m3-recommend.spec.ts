// M3 slice B on the production build, in both projects (mobile 390 px Europe/Paris en-US; desktop
// 1280 px Los Angeles en-US): recommendations for a day, choosing a recipe, recipe detail, the
// library and the plan-date picker, a plan that survives a reload, a planned recipe that is gone
// from the library, keyboard operation and axe in Japanese and English. Today is 2026-11-02 10:00 JST.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectNoSeriousAxe, seedStore } from './helpers.ts';

const STATE = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');
const NOW = new Date('2026-11-02T01:00:00Z');
const DISCLAIMER = 'アレルギーの安全を保証するものではありません。使用する食品の表示を必ずご確認ください。';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

const stored = (page: Page) => page.evaluate(() => JSON.parse(window.localStorage.getItem('bentominder.state') ?? 'null'));
const cell = (page: Page, date: string) => page.getByTestId(`cal-cell-${date}`);

async function toEnglish(page: Page) {
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}

test('US-E5-03/AC2 US-E6-01/AC1 US-E6-01/AC2 US-E6-03/AC1 the journey: bento for 11-12, three cards with the disclaimer, choose one, it is on the calendar and survives a reload', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./');
  await cell(page, '2026-11-12').getByRole('button').click();
  await page.getByTestId('day-action-bento').click();
  await expect(page.getByTestId('screen-recs')).toBeVisible();
  await expect(page.getByTestId('recs-list').locator('[data-recipe-id]')).toHaveCount(3);
  await expect(page.getByTestId('disclaimer')).toHaveText(DISCLAIMER);
  await expect(page.getByTestId('rec-card-0')).toContainText('1位');
  await expect(page.getByTestId('rec-card-0')).toContainText(/約\d+分/);
  const first = (await page.getByTestId('rec-card-0').getAttribute('data-recipe-id')) as string;
  await page.getByTestId('rec-card-0-confirm').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await expect(page.getByTestId('toast')).toContainText('を手作りお弁当にしました');
  await expect(cell(page, '2026-11-12')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  const d = (await stored(page)).decisions['2026-11-12'];
  expect(d).toMatchObject({ state: 'homemade-bento-planned', recipeId: first });
  expect(d.plannedAt).toBe(d.decidedAt);
  await page.reload();
  await expect(cell(page, '2026-11-12')).toHaveAttribute('data-icon', 'home'); // the tile has the icon, no recipe name (US-E5-01/AC4)
  expect((await stored(page)).decisions['2026-11-12'].recipeId).toBe(first);
});

test('US-E6-01/AC6 US-NF-02/AC1 the recommendation view with 「ほかのレシピ」 open is operable by keyboard; axe finds nothing serious in ja and en', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./#/recommend/2026-11-12');
  await expect(page.getByTestId('screen-recs')).toBeVisible();
  await expectNoSeriousAxe(page, 'recommend ja');
  await page.getByTestId('recs-more').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('recs-more-list')).toBeVisible();
  expect(await page.getByTestId('recs-more-list').locator('[data-recipe-id]').count()).toBeGreaterThan(3);
  await expectNoSeriousAxe(page, 'recommend more ja');
  // the first card's confirm is reachable with the keyboard and works with Enter
  await page.getByTestId('rec-card-0-confirm').focus();
  await expect(page.getByTestId('rec-card-0-confirm')).toBeFocused();
  await toEnglish(page);
  await expect(page.getByTestId('rec-card-0-confirm')).toHaveText('Choose for this day');
  await expect(page.getByTestId('disclaimer')).toContainText("can't guarantee anything about allergies");
  await expectNoSeriousAxe(page, 'recommend en');
  await page.getByTestId('rec-card-0-confirm').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await expect((await stored(page)).decisions['2026-11-12'].state).toBe('homemade-bento-planned');
});

test('US-E5-03/AC3 back from the recommendation view leaves the stored decision exactly as it was', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./#/recommend/2026-11-12');
  const before = await stored(page);
  await page.getByTestId('rec-card-1-details').click();
  await expect(page.getByTestId('recipe-footer-action')).toBeVisible();
  await page.getByTestId('topbar-back').click();
  await expect(page.getByTestId('screen-recs')).toBeVisible();
  await page.getByTestId('topbar-back').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  expect(await stored(page)).toEqual(before);
});

test('US-E6-04/AC1 US-E6-04/AC2 US-E6-04/AC3 recipe detail: content, the 農林水産省 notes, deep link, unknown id; axe in ja and en', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./#/recipes');
  await expect(page.getByTestId('screen-library')).toBeVisible();
  await page.getByTestId('library-list').getByRole('link').first().click();
  await expect(page.getByTestId('screen-recipe')).toBeVisible();
  await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
  await expect(page.getByTestId('recipe-steps').getByRole('listitem').first()).toBeVisible();
  await expect(page.getByTestId('recipe-safety')).toContainText('ごはんやおかずは、よく冷ましてから詰めましょう。');
  await expect(page.getByTestId('recipe-safety-credit')).toHaveText(/出典：農林水産省/);
  await expect(page.getByTestId('recipe-sources').getByRole('link').first()).toHaveAttribute('target', '_blank');
  await expect(page.getByTestId('disclaimer')).toHaveText(DISCLAIMER);
  await expectNoSeriousAxe(page, 'recipe ja');
  await toEnglish(page);
  await expect(page.getByTestId('recipe-safety')).toContainText('Let rice and side dishes cool fully');
  await expectNoSeriousAxe(page, 'recipe en');
  const url = page.url();
  await page.goto('./#/recipe/rcp-does-not-exist');
  await expect(page.getByTestId('recipe-not-found')).toBeVisible();
  await page.goto(url);
  await expect(page.getByTestId('screen-recipe')).toBeVisible();
});

test('US-E6-05/AC1 US-E6-05/AC2 US-E6-05/AC3 the library lists blocked recipes last; the picker plans a date by keyboard; axe with the picker open', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./#/recipes');
  const rows = page.getByTestId('library-list').locator('> li');
  const total = await rows.count();
  expect(total).toBeGreaterThanOrEqual(15);
  const flags = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['blocked'] === 'true'));
  expect(flags.lastIndexOf(false)).toBeLessThan(flags.indexOf(true)); // every blocked row after every plannable one
  await expectNoSeriousAxe(page, 'library ja');
  await toEnglish(page);
  await expectNoSeriousAxe(page, 'library en');
  // a blocked recipe cannot be planned and says why
  await page.locator('[data-blocked="true"] a').first().click();
  await expect(page.getByTestId('recipe-footer-action')).toBeDisabled();
  await expect(page.getByTestId('recipe-footer-hint')).toBeVisible();
  await page.getByTestId('topbar-back').click();
  // a plannable one: pick a date and confirm with the keyboard
  await page.locator('[data-testid^="library-row-"]:not([data-blocked]) a').first().click();
  const action = page.getByTestId('recipe-footer-action');
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('plan-pick')).toBeVisible();
  await expect(page.getByTestId('plan-pick-confirm')).toBeDisabled();
  await expectNoSeriousAxe(page, 'picker en');
  await page.getByTestId('plan-pick-option-2026-11-18').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('plan-pick-confirm')).toBeEnabled();
  await page.getByTestId('plan-pick-confirm').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  expect((await stored(page)).decisions['2026-11-18'].state).toBe('homemade-bento-planned');
  await expect(cell(page, '2026-11-18')).toHaveAttribute('data-decision', 'homemade-bento-planned');
});

test('US-E6-05/AC2 Escape closes the picker and returns the focus to 「日付を選んで計画」', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./#/recipes');
  await page.locator('[data-testid^="library-row-"]:not([data-blocked]) a').first().click();
  const action = page.getByTestId('recipe-footer-action');
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('plan-pick')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('plan-pick')).toHaveCount(0);
  await expect(action).toBeFocused();
});

test('US-E6-06/AC1 a planned recipe missing from the library keeps its stored names and the plan; the sheet offers a re-choice', async ({ page }) => {
  await seedStore(page, STATE);
  await page.goto('./');
  const before = await stored(page);
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-icon', 'home'); // the tile has no recipe name (US-E5-01/AC4); the sheet keeps it
  await cell(page, '2026-11-04').getByRole('button').click();
  await expect(page.getByTestId('day-recipe-name')).toHaveText('くまさんおにぎり弁当');
  await expect(page.getByTestId('day-recipe-missing')).toHaveText('このレシピは見つかりません。別のレシピを選んでください。');
  await expect(page.getByTestId('day-action-view-recipe')).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  await expectNoSeriousAxe(page, 'day sheet, recipe missing');
  await page.getByTestId('day-action-change-recipe').click();
  await expect(page.getByTestId('screen-recs')).toBeVisible();
  await page.getByTestId('rec-card-0-confirm').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  const d = (await stored(page)).decisions['2026-11-04'];
  expect(d.recipeId).not.toBe('rcp-kuma-onigiri');
  expect(d.plannedAt).toBe('2026-11-01T10:12:00+09:00');
});

test('US-E1-03/AC5 an unknown allergy status shows the warning above the cards and on a recipe; never a safety claim', async ({ page }) => {
  const s = JSON.parse(STATE);
  s.profile = { ...s.profile, allergyStatus: 'unknown', knownAllergenIds: [], excludedIngredientIds: [] };
  await seedStore(page, JSON.stringify(s));
  await page.goto('./#/recommend/2026-11-12');
  await expect(page.getByTestId('banner-allergy-unknown')).toBeVisible();
  await expect(page.getByTestId('banner-allergy-unknown')).toContainText('アレルギー情報が未登録です');
  await expectNoSeriousAxe(page, 'recommend, allergy unknown');
  await page.getByTestId('rec-card-0-details').click();
  await expect(page.getByTestId('banner-allergy-unknown')).toBeVisible();
  await expect(page.getByTestId('disclaimer')).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/アレルゲンなし|安全です|対応済み/);
});
