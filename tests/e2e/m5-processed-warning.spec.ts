// The processed-food allergen rule on the production build with the shipped library (ADR 013,
// design/components.md 5.4), in both projects (mobile 390 px, desktop 1280 px): no registered allergen
// means no warning anywhere; a peanut-only child sees the notice and the markers; a wheat or a salmon
// child sees the excluded recipes greyed with the child's own allergen; the detail's reading order;
// axe in ja and en, light and dark. Today is 2026-11-02 10:00 JST.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectNoSeriousAxe, seedStore } from './helpers.ts';

const read = <T>(...p: string[]) => JSON.parse(readFileSync(join(process.cwd(), ...p), 'utf8')) as T;
const NOW = new Date('2026-11-02T01:00:00Z');
const dictionary = read<{ ingredients: { id: string; info: string }[] }>('data', 'dictionary.json');
const library = read<{ id: string; ingredients: { ingredientId: string }[] }[]>('data', 'library.json');
const processedIds = new Set(dictionary.ingredients.filter((i) => i.info === 'varies').map((i) => i.id));
const hasProcessed = (id: string) => (library.find((r) => r.id === id)?.ingredients ?? []).some((i) => processedIds.has(i.ingredientId));

const PEANUT_RECIPE = 'rcp-delish-niwatori-hiyoko-onigiri'; // no allergens listed, curry powder (processed)
const BREAD_RECIPE = 'rcp-joc-tamago-sando-bento'; // bread: wheat is in its allergenIds
const SOY_SAUCE_RECIPE = 'rcp-delish-satsumaimo-gohan-bento';
const CHIKUWA_RECIPE = 'rcp-delish-flower-bento'; // chikuwa: fish group, salmon is not in its allergenIds

function seed(patch: Record<string, unknown>): string {
  const s = read<{ profile: Record<string, unknown> }>('tests', 'fixtures', 'state', 'm2-november.json');
  s.profile = { ...s.profile, ...patch };
  return JSON.stringify(s);
}
const NONE = seed({ allergyStatus: 'none-known', knownAllergenIds: [], excludedIngredientIds: [] });
const PEANUT = seed({ allergyStatus: 'has-known', knownAllergenIds: ['alg-peanut'], excludedIngredientIds: [] });
const WHEAT = seed({ allergyStatus: 'has-known', knownAllergenIds: ['alg-wheat'], excludedIngredientIds: [] });
const SALMON = seed({ allergyStatus: 'has-known', knownAllergenIds: ['alg-salmon'], excludedIngredientIds: [] });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

const processed = (page: Page) => page.locator('[data-testid$="-processed"], [data-testid="recipe-processed-notice"]');
const toEnglish = async (page: Page) => {
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
};

test('US-E6-02/AC12 US-E6-03/AC5 US-E6-04/AC5 a child with no registered allergen sees no processed-food warning on cards, rows, library, picker or detail', async ({ page }) => {
  await seedStore(page, NONE);
  await page.goto('./#/recommend/2026-11-12');
  await page.getByTestId('recs-more').click();
  await expect(page.getByTestId('recs-more-list')).toBeVisible();
  await expect(processed(page)).toHaveCount(0);
  await page.goto(`./#/recipes`);
  await expect(page.getByTestId('library-list')).toBeVisible();
  await expect(processed(page)).toHaveCount(0);
  await page.goto(`./#/recipe/${PEANUT_RECIPE}`);
  await expect(page.getByTestId('screen-recipe')).toBeVisible();
  await expect(processed(page)).toHaveCount(0);
  await expect(page.getByTestId('disclaimer')).toBeVisible();
  await page.getByTestId('recipe-footer-action').click();
  await expect(page.getByTestId('plan-pick')).toBeVisible();
  await expect(page.getByTestId('plan-pick-processed')).toHaveCount(0);
});

test('US-E6-02/AC11 US-E6-04/AC4 a peanut-only child: the detail shows one notice naming 落花生 above the list and a marker on the processed ingredient', async ({ page }) => {
  await seedStore(page, PEANUT);
  await page.goto(`./#/recipe/${PEANUT_RECIPE}`);
  const notice = page.getByTestId('recipe-processed-notice');
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText('市販品には、登録したアレルゲン（落花生）が含まれる場合があります。パッケージの表示を確認してください。');
  await expect(notice).not.toHaveAttribute('role', /.*/);
  const marker = page.getByTestId('recipe-ingredient-ing-curry-powder-processed');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveText('市販品。表示を確認');
  const above = await notice.evaluate((n) => n.compareDocumentPosition(document.querySelector('[data-testid="recipe-ingredients"]') as Element) & Node.DOCUMENT_POSITION_FOLLOWING);
  expect(above).toBeTruthy();
  await toEnglish(page);
  await expect(notice).toContainText('Store-bought products may contain the registered allergens (Peanut). Check the package label.');
  await expect(marker).toHaveText('Store-bought product: check the label');
});

test('US-E6-02/AC11 US-E6-02/AC12 cards, 「ほかのレシピ」 rows and library rows show the compact line exactly for recipes with a processed ingredient', async ({ page }) => {
  await seedStore(page, PEANUT);
  await page.goto('./#/recommend/2026-11-12');
  await page.getByTestId('recs-more').click();
  const rows = page.getByTestId('recs-more-list').locator('[data-recipe-id]');
  expect(await rows.count()).toBeGreaterThan(3);
  for (const row of await rows.all()) {
    const id = (await row.getAttribute('data-recipe-id')) as string;
    const line = row.locator('[data-testid$="-processed"]');
    await expect(line).toHaveCount(hasProcessed(id) ? 1 : 0);
    if (hasProcessed(id)) await expect(line).toHaveText('市販品の表示を確認');
  }
  expect(await page.locator('[data-testid^="rec-card-"][data-testid$="-processed"]').count()).toBeGreaterThan(0);
  await page.goto('./#/recipes');
  await expect(page.getByTestId(`library-row-${PEANUT_RECIPE}-processed`)).toHaveText('市販品の表示を確認');
});

test('US-E6-02/AC9 US-E6-02/AC10 a wheat child: the bread and the soy-sauce recipes are excluded with 「小麦を含む」, not suggested, no notice on them', async ({ page }) => {
  await seedStore(page, WHEAT);
  await page.goto('./#/recommend/2026-11-12');
  await page.getByTestId('recs-more').click();
  for (const id of [BREAD_RECIPE, SOY_SAUCE_RECIPE]) await expect(page.locator(`[data-recipe-id="${id}"]`)).toHaveCount(0);
  await page.goto('./#/recipes');
  for (const id of [BREAD_RECIPE, SOY_SAUCE_RECIPE]) {
    await expect(page.getByTestId(`library-row-${id}`)).toHaveAttribute('data-blocked', 'true');
    await expect(page.getByTestId(`library-row-${id}-reason`)).toContainText('小麦を含む');
    await expect(page.getByTestId(`library-row-${id}-processed`)).toHaveCount(0);
  }
  await page.getByTestId(`library-row-${BREAD_RECIPE}-link`).click();
  await expect(page.getByTestId('recipe-footer-action')).toBeDisabled();
  await expect(page.getByTestId('recipe-processed-notice')).toHaveCount(0);
  await toEnglish(page);
  await expect(page.getByTestId('recipe-conflicts')).toContainText('Contains Wheat');
});

test('US-E6-02/AC15 US-E6-02/AC9 a salmon child: a recipe with chikuwa is excluded with 「さけを含む」 and is not suggested', async ({ page }) => {
  await seedStore(page, SALMON);
  await page.goto('./#/recommend/2026-11-12');
  await page.getByTestId('recs-more').click();
  await expect(page.locator(`[data-recipe-id="${CHIKUWA_RECIPE}"]`)).toHaveCount(0);
  await page.goto('./#/recipes');
  await expect(page.getByTestId(`library-row-${CHIKUWA_RECIPE}`)).toHaveAttribute('data-blocked', 'true');
  await expect(page.getByTestId(`library-row-${CHIKUWA_RECIPE}-reason`)).toContainText('さけを含む');
  await expect(page.getByTestId(`library-row-${CHIKUWA_RECIPE}-reason`)).not.toContainText('魚');
});

test('US-E6-02/AC11 the plan-date picker header shows the compact line for a recipe with a processed ingredient', async ({ page }) => {
  await seedStore(page, PEANUT);
  await page.goto(`./#/recipe/${PEANUT_RECIPE}`);
  await page.getByTestId('recipe-footer-action').click();
  await expect(page.getByTestId('plan-pick-processed')).toHaveText('市販品の表示を確認');
});

test('US-E1-03/AC7 onboarding: the hint appears under the allergen picker only once an allergen is chosen', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('radio-allergy-has-known').check();
  await expect(page.getByTestId('allergy-processed-hint')).toHaveCount(0);
  await page.getByTestId('chip-allergen-alg-peanut').click();
  await expect(page.getByTestId('allergy-processed-hint')).toHaveText('市販品を使うレシピには、登録したアレルゲンを挙げて、パッケージの表示を確認するようご案内します。');
  await toEnglish(page);
  await expect(page.getByTestId('allergy-processed-hint')).toContainText('For recipes that use store-bought products');
});

test('US-E6-02/AC11 US-NF-02/AC3 the notice gets role="status" only when the profile changes while the detail is open', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  for (const p of [a, b]) await p.clock.setFixedTime(NOW);
  await seedStore(a, NONE);
  await a.goto('./');
  await b.goto(`./#/recipe/${PEANUT_RECIPE}`);
  await expect(b.getByTestId('screen-recipe')).toBeVisible();
  await expect(b.getByTestId('recipe-processed-notice')).toHaveCount(0);
  // tab A saves a profile with a registered allergen; tab B hears the storage event
  await a.evaluate((json) => window.localStorage.setItem('bentominder.state', json), PEANUT);
  const notice = b.getByTestId('recipe-processed-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('role', 'status');
});

test('US-E6-02/AC11 US-NF-02/AC2 reading order: the notice and the markers are static text, no stop in the tab order', async ({ page }) => {
  await seedStore(page, PEANUT);
  await page.goto(`./#/recipe/${PEANUT_RECIPE}`);
  await expect(page.getByTestId('recipe-processed-notice')).toBeVisible();
  const focusable = await page.locator('[data-testid="recipe-processed-notice"], [data-testid$="-processed"]').evaluateAll((els) => els.map((e) => e.querySelectorAll('a,button,input,select,textarea,[tabindex]').length + (e.hasAttribute('tabindex') ? 1 : 0)));
  expect(focusable.every((n) => n === 0)).toBe(true);
  await page.getByTestId('topbar-back').focus();
  const seen: string[] = [];
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => (document.activeElement?.closest('[data-testid="recipe-processed-notice"], [data-testid$="-processed"]') ? 'processed' : (document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? ''))));
  }
  expect(seen).not.toContain('processed');
  expect(seen).toContain('recipe-footer-action'); // the footer action is still reachable
});

for (const scheme of ['light', 'dark'] as const) {
  test(`US-NF-02/AC1 US-E8-05/AC3 axe finds nothing serious on the detail, recommendations and library of a peanut child, ja and en, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await seedStore(page, PEANUT);
    await page.goto(`./#/recipe/${PEANUT_RECIPE}`);
    await expect(page.getByTestId('recipe-processed-notice')).toBeVisible();
    await expectNoSeriousAxe(page, `detail ja ${scheme}`);
    await page.goto('./#/recommend/2026-11-12');
    await expect(page.locator('[data-testid^="rec-card-"][data-testid$="-processed"]').first()).toBeVisible();
    await expectNoSeriousAxe(page, `recommend ja ${scheme}`);
    await page.goto('./#/recipes');
    await expect(page.getByTestId(`library-row-${PEANUT_RECIPE}-processed`)).toBeVisible();
    await expectNoSeriousAxe(page, `library ja ${scheme}`);
    await toEnglish(page);
    await expectNoSeriousAxe(page, `library en ${scheme}`);
    await page.goto(`./#/recipe/${PEANUT_RECIPE}`);
    await expect(page.getByTestId('recipe-processed-notice')).toBeVisible();
    await expectNoSeriousAxe(page, `detail en ${scheme}`);
    await page.goto('./#/recommend/2026-11-12');
    await expect(page.locator('[data-testid^="rec-card-"][data-testid$="-processed"]').first()).toBeVisible();
    await expectNoSeriousAxe(page, `recommend en ${scheme}`);
  });
}
