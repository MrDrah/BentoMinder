// QA: US-E0-01 AC1..AC3 asserted as written in docs/ba/user-stories.md (derived from the story and data/library.json only).
// Browser clock 2026-10-28 10:00 JST, ja, mocked AI = the proxy's recorded fixture replies (PROXY_MOCK_SCENARIOS, hand-1).
// The AC's "debug clock" is a dev-only panel that the production build does not contain (US-E11 keeps it out), so the
// same effect is made with page.clock (as the M4 suites do). Run: npx playwright test -c tests/e2e/qa/playwright.h4.config.ts e0-journey
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FX01, pinHand1, readStore, type Json } from './helpers.ts';

const LIB = JSON.parse(readFileSync(join(process.cwd(), 'data', 'library.json'), 'utf8')) as Json[];
const jst = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+09:00`);
const cell = (page: Page, d: string) => page.getByTestId(`cal-cell-${d}`);

/** Counts user actions: taps, typed fields, file picks (US-E0-01/AC3). */
function actor() {
  const n = { count: 0 };
  return {
    n,
    click: async (l: Locator) => {
      n.count += 1;
      await l.click();
    },
    check: async (l: Locator) => {
      n.count += 1;
      await l.check();
    },
    pick: async (l: Locator, f: string) => {
      n.count += 1;
      await l.setInputFiles(f);
    },
  };
}

test('US-E0-01/AC1 US-E0-01/AC2 US-E0-01/AC3 the main journey from a fresh device to a confirmed bento day and its reminder, then a reload', async ({ page }) => {
  test.setTimeout(180_000);
  const a = actor();
  await page.clock.install({ time: new Date('2026-10-28T01:00:00Z') });
  await pinHand1(page);

  // Given a fresh device with no stored data, language ja
  await page.goto('./');
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

  // When the parent creates the sample child profile (likes 鶏肉 たまご とうもろこし; dislikes ピーマン なす さかな; shrimp allergy)
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  await a.click(page.getByTestId('chip-age-age-4-5'));
  for (const id of ['ing-chicken', 'ing-egg', 'ing-corn']) await a.click(page.getByTestId(`picker-likes-option-${id}`));
  for (const id of ['ing-green-pepper', 'ing-eggplant', 'cat-fish']) await a.click(page.getByTestId(`picker-dislikes-option-${id}`));
  await a.check(page.getByTestId('radio-allergy-has-known'));
  await a.click(page.getByTestId('chip-allergen-alg-shrimp'));
  await a.click(page.getByTestId('ob-next'));
  await expect(page.getByTestId('ob-step-2')).toBeVisible();

  // And uploads the fixture PDF, and confirms the extracted menu without edits
  await a.pick(page.getByTestId('import-upload'), FX01);
  await a.click(page.getByTestId('consent-accept'));
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await a.click(page.getByTestId('review-confirm'));
  const uncertain = page.getByTestId('dialog-uncertain-confirm');
  if (await uncertain.isVisible().catch(() => false)) await a.click(uncertain);

  // Then the calendar shows November 2026
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  // And 2026-11-04 is low-preference with an explanation that mentions 2 disliked ingredients, and still shows 「給食」
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-assessment', 'low-preference');
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-decision', 'school-lunch-planned');
  await expect(cell(page, '2026-11-04').getByRole('button')).toHaveAccessibleName(/給食|手作りお弁当/);
  await a.click(cell(page, '2026-11-04').getByRole('button'));
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await expect(page.getByTestId('assess-explanation')).toContainText(/苦手な食材が2つ/);
  await expect(page.getByTestId('day-status')).toContainText('給食');

  // When the parent chooses 「手作りお弁当にする」
  await expect(page.getByTestId('day-action-bento')).toContainText('手作りお弁当にする');
  await a.click(page.getByTestId('day-action-bento'));
  // Then exactly 3 recipe suggestions are shown and none contains alg-shrimp
  await expect(page.getByTestId('screen-recs')).toBeVisible();
  const cards = page.getByTestId('recs-list').locator('[data-recipe-id]');
  await expect(cards).toHaveCount(3);
  const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-recipe-id')));
  for (const id of ids) {
    const r = LIB.find((x) => x.id === id);
    expect(r, `suggested ${id} is in the library`).toBeTruthy();
    const all = [...r.allergenIds, ...r.ingredients.flatMap((i: Json) => i.allergenIds)]; // label data (may-contain) is warn-only since 2026-11-01
    expect(all, `${id} must not contain alg-shrimp`).not.toContain('alg-shrimp');
  }

  // When the parent selects the first suggestion and confirms 「この日に決定」
  const firstId = ids[0] as string;
  const first = LIB.find((x) => x.id === firstId) as Json;
  await expect(page.getByTestId('rec-card-0-confirm')).toContainText('この日に決定');
  await a.click(page.getByTestId('rec-card-0-confirm'));
  // Then (UI refresh 2026-11-10, US-E5-01/AC3 AC4, US-E5-03/AC2) the tile shows the crossed spoon-and-spatula icon and the red top border, never the recipe name
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-icon', 'home');
  await expect(cell(page, '2026-11-04')).not.toContainText(first.shortNameJa);
  expect((await readStore(page)).decisions['2026-11-04']).toMatchObject({ state: 'homemade-bento-planned', recipeId: firstId });
  // And the upcoming-bento summary lists 「11月4日（水）」 with that recipe
  if (await page.getByTestId('day-sheet-close').isVisible().catch(() => false)) await page.getByTestId('day-sheet-close').click();
  const row = page.getByTestId('upcoming-row-2026-11-04');
  await expect(row).toContainText('11月4日（水）');
  await expect(row).toContainText(first.name.ja);

  const afterJourney = await readStore(page);
  const actions = a.n.count;

  // When the clock is 2026-11-03 17:30 JST and the day-before reminder fires: the banner text, then the CTA opens the recipe
  await page.clock.setSystemTime(new Date(jst('2026-11-03', '17:29')));
  await page.reload();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await page.clock.fastForward('02:00');
  const banner = page.getByTestId('reminder-day-before-2026-11-04');
  await expect(banner).toContainText('明日は手作りお弁当の日！レシピを確認しましょう。');
  await banner.getByTestId('reminder-cta').click();
  await expect(page.getByTestId('screen-recipe')).toBeVisible();
  await expect(page.getByTestId('recipe-ingredients')).toBeVisible();
  await expect(page.getByTestId('recipe-steps').getByRole('listitem').first()).toBeVisible();
  await expect(page.getByTestId('disclaimer')).toBeVisible();
  await expect(page.getByTestId('screen-recipe')).toContainText(first.name.ja);

  // AC2: survives a reload (clock back at 2026-10-28 so "today" is the journey day)
  await page.clock.setSystemTime(new Date('2026-10-28T01:30:00Z'));
  await page.goto('./#/calendar');
  await page.reload();
  await expect(page.getByTestId('screen-calendar')).toBeVisible(); // no onboarding
  await expect(page.getByTestId('ob-step-1')).toHaveCount(0);
  await expect(page.getByTestId('cal-title')).toHaveText('2026年10月'); // current Tokyo month (US-E1-01/AC2)
  await page.getByTestId('cal-next').click();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  await expect(cell(page, '2026-11-04')).toHaveAttribute('data-icon', 'home');
  await expect(cell(page, '2026-11-04')).not.toContainText(first.shortNameJa);
  const reloaded = await readStore(page);
  expect(reloaded.profile).toEqual(afterJourney.profile);
  expect(reloaded.menus).toEqual(afterJourney.menus);
  expect(reloaded.decisions).toEqual(afterJourney.decisions);

  // AC3: at most 25 user actions from first launch to the confirmed bento day
  console.log(`US-E0-01/AC3 user actions to the confirmed bento day: ${actions}`);
  expect(actions).toBeLessThanOrEqual(25);
});

test('US-E0-01/AC3 no step of the journey needs more than 2 levels away from the calendar (calendar > day sheet > suggestions)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T01:00:00Z') });
  await page.addInitScript((s) => window.localStorage.setItem('bentominder.state', s), readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8'));
  await page.goto('./');
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await page.getByTestId('cal-next').click();
  await cell(page, '2026-11-12').getByRole('button').click(); // level 1: the day sheet
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await page.getByTestId('day-action-bento').click(); // level 2: the suggestions
  await expect(page.getByTestId('screen-recs')).toBeVisible();
  let back = 0;
  while (!(await page.getByTestId('screen-calendar').isVisible().catch(() => false)) && back < 5) {
    await page.goBack();
    back += 1;
    await page.waitForTimeout(150);
  }
  expect(back).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
});
