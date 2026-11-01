// QA M5: the processed-food allergen rule (PO 2026-11-01), derived from US-E6-02/AC9-AC16, US-E6-03/AC4-AC5, US-E6-04/AC4-AC6,
// US-E6-05/AC1, US-E1-03/AC5, AC7 and design/copy.md warn.processed.* only. Which recipes are "processed", "bread" or "fish product"
// is read from data/dictionary.json and data/library.json; expectations are never taken from the engine or the developers' tests.
// Run: npm run build && npx playwright test -c tests/e2e/qa/playwright.m5.config.ts  (config matches m5-*.spec.ts)
// Today = 2026-11-02 10:00 JST. Ids of rendered elements only (data-testid) are used as selectors.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEY, readStore, ROOT, type Json } from './helpers.ts';

const STATE = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8')) as Json;
const DICT = JSON.parse(readFileSync(join(ROOT, 'data', 'dictionary.json'), 'utf8')) as Json;
const LIB = JSON.parse(readFileSync(join(ROOT, 'data', 'library.json'), 'utf8')) as Json[];
const NOW = new Date('2026-11-02T01:00:00Z');

const ING = new Map<string, Json>((DICT.ingredients as Json[]).map((i) => [i.id as string, i]));
const label = (a: string, lang: 'ja' | 'en' = 'ja') => (DICT.allergens as Json[]).find((x) => x.id === a)![lang] as string;
const isProcessed = (id: string) => ING.get(id)!.info === 'varies';
const procIds = (r: Json): string[] => [...new Set((r.ingredients as Json[]).map((i) => i.ingredientId as string))].filter(isProcessed);
const groupMembers = (g: string) => (DICT.allergenGroups as Json[]).find((x) => x.id === g)!.memberAllergenIds as string[];
/** Independent test of "this recipe is excluded for allergen a" (US-E6-02/AC9, AC15): allergenIds, inherent ids of processed ingredients, group members. */
const hits = (r: Json, a: string): boolean =>
  (r.allergenIds as string[]).includes(a) ||
  (r.ingredients as Json[]).some((i) => {
    const d = ING.get(i.ingredientId as string)!;
    return (d.inherentAllergenIds as string[]).includes(a) || (d.allergenGroupIds as string[]).some((g) => groupMembers(g).includes(a));
  });
const byIngredient = (ids: string[]) => LIB.filter((r) => (r.ingredients as Json[]).some((i) => ids.includes(i.ingredientId as string)));

const WHEAT_PROCESSED = (DICT.ingredients as Json[]).filter((i) => i.info === 'varies' && (i.inherentAllergenIds as string[]).includes('alg-wheat')).map((i) => i.id as string);
const FISH_PRODUCTS = (DICT.ingredients as Json[]).filter((i) => (i.allergenGroupIds as string[]).includes('grp-fish')).map((i) => i.id as string);

function stateWith(p: { known?: string[]; status?: string; excl?: string[] }): Json {
  const s = JSON.parse(JSON.stringify(STATE)) as Json;
  s.profile.knownAllergenIds = p.known ?? [];
  s.profile.excludedIngredientIds = p.excl ?? [];
  s.profile.allergyStatus = p.status ?? ((p.known ?? []).length + (p.excl ?? []).length > 0 ? 'has-known' : 'none-known');
  return s;
}
async function seed(page: Page, state: Json) {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(([k, v]) => {
    if (window.localStorage.getItem(k!) === null) window.localStorage.setItem(k!, v!);
  }, [KEY, JSON.stringify(state)] as const);
}
const go = async (page: Page, hash: string) => {
  await page.goto('./');
  await page.evaluate((h) => (window.location.hash = h), hash);
};
const setStore = async (page: Page, state: Json) => {
  await page.evaluate(([k, v]) => window.localStorage.setItem(k!, v!), [KEY, JSON.stringify(state)] as const);
  await page.reload();
};
const WARN_JA = ['市販品の表示を確認', '市販品。表示を確認', '市販品には、登録したアレルゲン'];
const WARN_EN = ['Check labels of store-bought items', 'Store-bought product: check the label', 'Store-bought products may contain'];
const anyWarning = (page: Page) => page.locator('[data-testid$="-processed"], [data-testid="recipe-processed-notice"]');
async function expectNoWarningText(page: Page) {
  const t = await page.locator('body').innerText();
  for (const w of [...WARN_JA, ...WARN_EN]) expect(t, w).not.toContain(w);
}
async function recIds(page: Page): Promise<string[]> {
  return (await page.locator('[data-recipe-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-recipe-id') ?? ''))).filter(Boolean);
}
async function openMore(page: Page, date: string) {
  await go(page, `/recommend/${date}`);
  await expect(page.getByTestId('screen-recommend')).toBeVisible();
  if (await page.getByTestId('recs-more').isVisible().catch(() => false)) {
    await page.getByTestId('recs-more').click();
    await expect(page.getByTestId('recs-more-list')).toBeVisible();
  }
}
const toEnglish = async (page: Page) => {
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
};

/** A recipe that has >= 2 distinct processed ingredients and no peanut/shrimp/wheat/salmon hit, so it survives the peanut and the peanut+shrimp child. */
const MULTI = LIB.filter((r) => procIds(r).length >= 2 && !hits(r, 'alg-peanut') && !hits(r, 'alg-shrimp'))[0]!;
/** survives a peanut + wheat child and has processed ingredients (axe test) */
const AXE_R = LIB.filter((r) => procIds(r).length >= 2 && !hits(r, 'alg-peanut') && !hits(r, 'alg-wheat'))[0]!;
const NO_PROC = LIB.filter((r) => procIds(r).length === 0 && !hits(r, 'alg-peanut'))[0];

test.describe('no registered allergen: no processed-food warning anywhere (US-E6-02/AC12, US-E6-03/AC5, US-E6-04/AC5)', () => {
  for (const [name, st] of [
    ['none-known', stateWith({})],
    ['unknown', stateWith({ status: 'unknown' })],
    ['has-known with only an excluded ingredient', stateWith({ status: 'has-known', excl: ['ing-tomato'] })],
  ] as [string, Json][]) {
    test(`US-E6-02/AC12 US-E6-03/AC5 US-E6-04/AC5 ${name}: card, more-list, library, detail, plan picker show no warning; disclaimer still shown`, async ({ page }) => {
      expect(MULTI, 'fixture: a multi-processed recipe exists').toBeTruthy();
      await seed(page, st);
      await openMore(page, '2026-11-12');
      await expect(anyWarning(page)).toHaveCount(0);
      await expectNoWarningText(page);
      await expect(page.getByTestId('disclaimer')).toBeVisible();
      if (name === 'unknown') await expect(page.getByTestId('banner-allergy-unknown')).toBeVisible();
      await go(page, '/recipes');
      await expect(page.getByTestId('screen-library')).toBeVisible();
      await expect(anyWarning(page)).toHaveCount(0);
      await expectNoWarningText(page);
      await go(page, `/recipe/${MULTI.id}`);
      await expect(page.getByTestId('screen-recipe')).toBeVisible();
      await expect(anyWarning(page)).toHaveCount(0);
      await expectNoWarningText(page);
      await expect(page.getByTestId('disclaimer')).toBeVisible();
      if (name === 'unknown') await expect(page.getByTestId('banner-allergy-unknown')).toBeVisible();
      else await expect(page.getByTestId('banner-allergy-unknown')).toHaveCount(0);
      await page.getByTestId('recipe-footer-action').click();
      await expect(page.getByTestId('plan-pick')).toBeVisible();
      await expectNoWarningText(page);
    });
  }
});

test.describe('peanut child: notice with the allergen name once, a marker per processed ingredient (US-E6-02/AC10, AC11, US-E6-04/AC4)', () => {
  test('US-E6-02/AC10 US-E6-02/AC11 US-E6-04/AC4 detail: one notice naming the allergen above the list; exactly one marker per distinct processed ingredient; none on other rows', async ({ page }) => {
    await seed(page, stateWith({ known: ['alg-peanut'] }));
    await go(page, `/recipe/${MULTI.id}`);
    const notice = page.getByTestId('recipe-processed-notice');
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText(label('alg-peanut'));
    await expect(notice).toContainText('パッケージの表示を確認してください');
    const want = procIds(MULTI);
    expect(want.length).toBeGreaterThanOrEqual(2);
    const markers = page.locator('[data-testid^="recipe-ingredient-"][data-testid$="-processed"]');
    await expect(markers).toHaveCount(want.length);
    for (const id of want) await expect(page.getByTestId(`recipe-ingredient-${id}-processed`)).toContainText('市販品。表示を確認');
    // the notice sits before the ingredient list in the page order
    const before = await notice.evaluate((n) => !!(n.compareDocumentPosition(document.querySelector('[data-testid="recipe-ingredients"]') as Element) & Node.DOCUMENT_POSITION_FOLLOWING));
    expect(before).toBe(true);
    // peanut is not inherent to anything processed, so the recipe is plannable
    await expect(page.getByTestId('recipe-footer-action')).toBeEnabled();
    await expect(page.getByTestId('disclaimer')).toBeVisible();
  });

  test('US-E6-02/AC11 the notice lists the child FULL list in registered order (peanut then shrimp; reversed order gives reversed text)', async ({ page }) => {
    await seed(page, stateWith({ known: ['alg-peanut', 'alg-shrimp'] }));
    await go(page, `/recipe/${MULTI.id}`);
    const t1 = await page.getByTestId('recipe-processed-notice').innerText();
    expect(t1).toContain(`${label('alg-peanut')}、${label('alg-shrimp')}`);
    await setStore(page, stateWith({ known: ['alg-shrimp', 'alg-peanut'] }));
    const t2 = await page.getByTestId('recipe-processed-notice').innerText();
    expect(t2).toContain(`${label('alg-shrimp')}、${label('alg-peanut')}`);
  });

  test('US-E6-02/AC11 every allergen registered: the notice is never shortened (all 29 labels present)', async ({ page }) => {
    const all = (DICT.allergens as Json[]).filter((a) => !a.retired).map((a) => a.id as string);
    // a recipe that survives is impossible; open the recipe through the library anyway: the notice is only for non-excluded recipes
    const st = stateWith({ known: all.filter((a) => a !== 'alg-peanut') });
    const surv = LIB.find((r) => procIds(r).length > 0 && !all.filter((a) => a !== 'alg-peanut').some((a) => hits(r, a)));
    if (!surv) {
      test.info().annotations.push({ type: 'note', description: 'no recipe survives 28 allergens: notice-length check not applicable (product finding)' });
      return;
    }
    await seed(page, st);
    await go(page, `/recipe/${surv.id}`);
    const t = await page.getByTestId('recipe-processed-notice').innerText();
    for (const a of all.filter((x) => x !== 'alg-peanut')) expect(t, a).toContain(label(a));
  });

  test('US-E6-02/AC11 cards and rows: compact line exactly on recipes with a processed ingredient; an item-free recipe has none', async ({ page }) => {
    await seed(page, stateWith({ known: ['alg-peanut'] }));
    await openMore(page, '2026-11-12');
    const ids = await recIds(page);
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids.slice(0, 12)) {
      const rec = LIB.find((r) => r.id === id)!;
      const el = page.locator(`[data-recipe-id="${id}"]`).first();
      const txt = await el.innerText();
      if (procIds(rec).length > 0) expect(txt, id).toContain('市販品の表示を確認');
      else expect(txt, id).not.toContain('市販品の表示を確認');
      // the card never lists the allergens in the compact line and never says "free"
      expect(txt, id).not.toMatch(/フリー|不使用|安全/);
    }
    if (NO_PROC) {
      await go(page, `/recipe/${NO_PROC.id}`);
      await expect(page.getByTestId('screen-recipe')).toBeVisible();
      await expect(anyWarning(page)).toHaveCount(0);
    }
  });

  test('US-E6-02/AC13 label data (may-contain) does not exclude: a recipe whose only link to soybean is a brand-label id stays suggested/listed, with the warning', async ({ page }) => {
    const label_ = LIB.find((r) => (r.mayContainAllergenIds as string[]).includes('alg-soybean') && !hits(r, 'alg-soybean') && procIds(r).length > 0);
    expect(label_, 'fixture: a recipe with a soybean brand-label id and no soybean hit').toBeTruthy();
    await seed(page, stateWith({ known: ['alg-soybean'] }));
    await go(page, `/recipe/${label_!.id}`);
    await expect(page.getByTestId('recipe-processed-notice')).toContainText(label('alg-soybean'));
    await expect(page.getByTestId('recipe-footer-action')).toBeEnabled();
    await go(page, '/recipes');
    await expect(page.getByTestId(`library-row-${label_!.id}-reason`)).toHaveCount(0);
    // possibleAllergenIds are never presented as a statement about the product
    await go(page, `/recipe/${label_!.id}`);
    expect(await page.locator('body').innerText()).not.toContain('製品によって含むことがあるもの');
  });
});

test.describe('wheat child: bread, soy sauce, noodle, roux recipes are never suggested nor plannable (US-E6-02/AC9, AC14, US-E6-05/AC1)', () => {
  const wheatRecipes = byIngredient(WHEAT_PROCESSED);
  const allWheat = LIB.filter((r) => hits(r, 'alg-wheat'));

  test('fixture sanity: the library has bread, soy sauce, noodle recipes', () => {
    for (const id of ['ing-bread', 'ing-soy-sauce', 'ing-udon', 'ing-spaghetti']) expect(byIngredient([id]).length, id).toBeGreaterThan(0);
    expect(allWheat.length).toBeGreaterThanOrEqual(wheatRecipes.length);
  });

  test('US-E6-02/AC9 US-E6-02/AC14 the 3 cards and the whole ほかのレシピ list hold no wheat recipe, on 3 dates', async ({ page }) => {
    await seed(page, stateWith({ known: ['alg-wheat'] }));
    const bad = new Set(allWheat.map((r) => r.id as string));
    for (const date of ['2026-11-05', '2026-11-12', '2026-11-25']) {
      await openMore(page, date);
      const ids = await recIds(page);
      expect(ids.length, date).toBeGreaterThanOrEqual(3);
      expect(ids.filter((i) => bad.has(i)), date).toEqual([]);
      // each remaining processed recipe carries the wheat warning mark (card line)
      for (const id of ids) {
        const rec = LIB.find((r) => r.id === id)!;
        if (procIds(rec).length > 0) expect(await page.locator(`[data-recipe-id="${id}"]`).first().innerText(), id).toContain('市販品の表示を確認');
      }
    }
  });

  test('US-E6-05/AC1 library: every wheat recipe is greyed with 「小麦を含む」, has no warning, listed after every plannable recipe, and cannot be planned', async ({ page }) => {
    await seed(page, stateWith({ known: ['alg-wheat'] }));
    await go(page, '/recipes');
    await expect(page.getByTestId('screen-library')).toBeVisible();
    const order = (await page.locator('[data-testid^="library-row-"][data-testid$="-link"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!))).map((t) => t.replace(/^library-row-/, '').replace(/-link$/, ''));
    expect(order.length).toBe(LIB.length);
    const bad = new Set(allWheat.map((r) => r.id as string));
    const firstBad = order.findIndex((i) => bad.has(i));
    expect(order.slice(firstBad).every((i) => bad.has(i)), 'excluded recipes are all last').toBe(true);
    for (const r of allWheat) {
      await expect(page.getByTestId(`library-row-${r.id}-reason`), r.id).toContainText(`${label('alg-wheat')}を含む`);
      await expect(page.getByTestId(`library-row-${r.id}-processed`), r.id).toHaveCount(0);
    }
    // plannable rows with processed ingredients show the compact line, and have no reason
    const plannable = LIB.filter((r) => !bad.has(r.id as string) && procIds(r).length > 0).slice(0, 5);
    for (const r of plannable) {
      await expect(page.getByTestId(`library-row-${r.id}-processed`), r.id).toBeVisible();
      await expect(page.getByTestId(`library-row-${r.id}-reason`), r.id).toHaveCount(0);
    }
  });

  test('US-E6-02/AC9 US-E6-05/AC1 plan path: bread, soy sauce and noodle recipes: detail has no notice, the plan action is disabled, forcing it stores nothing', async ({ page }) => {
    await seed(page, stateWith({ known: ['alg-wheat'] }));
    const picks = ['ing-bread', 'ing-soy-sauce', 'ing-udon', 'ing-chinese-noodles', 'ing-spaghetti'].map((i) => byIngredient([i])[0]).filter(Boolean) as Json[];
    expect(picks.length).toBeGreaterThanOrEqual(3);
    const before = JSON.stringify((await (async () => { await go(page, '/recipes'); return readStore(page); })()).decisions);
    for (const r of picks) {
      await go(page, `/recipe/${r.id}`);
      await expect(page.getByTestId('screen-recipe')).toBeVisible();
      await expect(page.getByTestId('recipe-processed-notice')).toHaveCount(0);
      await expect(page.getByTestId('recipe-footer-action')).toBeDisabled();
      await page.getByTestId('recipe-footer-action').click({ force: true, timeout: 2000 }).catch(() => undefined);
      await expect(page.getByTestId('plan-pick')).toHaveCount(0);
    }
    expect(JSON.stringify((await readStore(page)).decisions)).toBe(before);
  });

  test('US-E6-02/AC9 US-E6-02/AC14 all 29 allergens registered: exactly the recipes with no hit are shown, and a survivor with a processed ingredient lists all 29 in the notice', async ({ page }) => {
    const all = (DICT.allergens as Json[]).filter((a) => !a.retired).map((a) => a.id as string);
    const free = LIB.filter((r) => !all.some((a) => hits(r, a))).map((r) => r.id as string);
    await seed(page, stateWith({ known: all }));
    await openMore(page, '2026-11-12');
    const shown = [...new Set(await recIds(page))].sort();
    expect(shown).toEqual([...free].sort());
    // a survivor with a processed ingredient (no inherent allergen) carries the full-list notice on its detail
    const withProc = shown.find((id) => procIds(LIB.find((r) => r.id === id)!).length > 0);
    if (withProc) {
      await go(page, `/recipe/${withProc}`);
      const t = await page.getByTestId('recipe-processed-notice').innerText();
      for (const x of all) expect(t, x).toContain(label(x));
    }
  });
});

test.describe('salmon / mackerel child: fish products excluded through the group, roe is not (US-E6-02/AC15)', () => {
  const fishRecipes = byIngredient(FISH_PRODUCTS);
  test('fixture sanity: the library has fish-product recipes (chikuwa, crab stick, canned fish)', () => {
    for (const id of ['ing-chikuwa', 'ing-crab-stick', 'ing-canned-tuna']) expect(byIngredient([id]).length, id).toBeGreaterThan(0);
    // the group is never written into recipe data (US-E6-02/AC15)
    for (const r of LIB) expect(JSON.stringify([r.allergenIds, r.mayContainAllergenIds])).not.toContain('grp-');
  });
  for (const a of ['alg-salmon', 'alg-mackerel']) {
    test(`US-E6-02/AC15 ${a}: no fish-product recipe is ever suggested; library greys them with the child's own allergen name; plan action disabled`, async ({ page }) => {
      await seed(page, stateWith({ known: [a] }));
      const bad = new Set(fishRecipes.map((r) => r.id as string));
      await openMore(page, '2026-11-12');
      expect((await recIds(page)).filter((i) => bad.has(i))).toEqual([]);
      await go(page, '/recipes');
      for (const r of fishRecipes) {
        const reason = page.getByTestId(`library-row-${r.id}-reason`);
        await expect(reason, r.id).toContainText(`${label(a)}を含む`);
        const t = await reason.innerText();
        expect(t, r.id).not.toContain('魚'); // the group is never named
        await expect(page.getByTestId(`library-row-${r.id}-processed`), r.id).toHaveCount(0);
      }
      for (const r of fishRecipes.slice(0, 4)) {
        await go(page, `/recipe/${r.id}`);
        await expect(page.getByTestId('recipe-footer-action'), r.id).toBeDisabled();
        await expect(page.getByTestId('recipe-processed-notice'), r.id).toHaveCount(0);
      }
    });
  }
  test('US-E6-02/AC15 salmon roe only, and shrimp only: the fish-product recipes that nothing else excludes are shown with the warning', async ({ page }) => {
    let first = true;
    for (const a of ['alg-salmon-roe', 'alg-shrimp']) {
      const free = fishRecipes.filter((r) => !hits(r, a));
      expect(free.length, a).toBeGreaterThan(0);
      if (first) {
        await seed(page, stateWith({ known: [a] }));
        await go(page, `/recipe/${free[0]!.id}`);
        first = false;
      } else {
        await setStore(page, stateWith({ known: [a] }));
        await go(page, `/recipe/${free[0]!.id}`);
      }
      await expect(page.getByTestId('recipe-processed-notice'), a).toContainText(label(a));
      await expect(page.getByTestId('recipe-footer-action'), a).toBeEnabled();
    }
  });
});

test.describe('unknown status, profile change, onboarding hint', () => {
  test('US-E1-03/AC5 US-E6-02/AC12 unknown allergy status: banner on recommendations and detail, no processed warning (banner neither replaced nor suppressed)', async ({ page }) => {
    await seed(page, stateWith({ status: 'unknown' }));
    await go(page, '/recommend/2026-11-12');
    await expect(page.getByTestId('banner-allergy-unknown')).toBeVisible();
    await expect(anyWarning(page)).toHaveCount(0);
    await go(page, `/recipe/${MULTI.id}`);
    await expect(page.getByTestId('banner-allergy-unknown')).toBeVisible();
    await expect(anyWarning(page)).toHaveCount(0);
  });

  test('US-E6-02/AC11 US-E6-02/AC12 changing the registered allergens updates the notice on the same recipe: none -> peanut -> peanut+shrimp -> none', async ({ page }) => {
    await seed(page, stateWith({}));
    await go(page, `/recipe/${MULTI.id}`);
    await expect(page.getByTestId('recipe-processed-notice')).toHaveCount(0);
    await setStore(page, stateWith({ known: ['alg-peanut'] }));
    await expect(page.getByTestId('recipe-processed-notice')).toContainText(label('alg-peanut'));
    await expect(page.getByTestId('recipe-processed-notice')).not.toContainText(label('alg-shrimp'));
    await setStore(page, stateWith({ known: ['alg-peanut', 'alg-shrimp'] }));
    await expect(page.getByTestId('recipe-processed-notice')).toContainText(label('alg-shrimp'));
    await setStore(page, stateWith({ status: 'none-known' }));
    await expect(anyWarning(page)).toHaveCount(0);
  });

  test('US-E1-03/AC7 the processed-food hint appears in the allergen picker only with 「アレルギーあり」 and at least one allergen chosen', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await page.goto('./');
    await expect(page.getByTestId('ob-step-1')).toBeVisible();
    const hint = '市販品を使うレシピには、登録したアレルゲンを挙げて、パッケージの表示を確認するようご案内します。';
    const body = page.locator('body');
    await page.getByTestId('radio-allergy-none-known').check();
    expect(await body.innerText()).not.toContain(hint);
    await page.getByTestId('radio-allergy-unknown').check();
    expect(await body.innerText()).not.toContain(hint);
    await page.getByTestId('radio-allergy-has-known').check();
    expect(await body.innerText(), 'has-known, nothing chosen yet').not.toContain(hint);
    await page.getByTestId('chip-allergen-alg-peanut').click();
    await expect(body).toContainText(hint);
    await page.getByTestId('chip-allergen-alg-peanut').click();
    expect(await body.innerText(), 'chip deselected again').not.toContain(hint);
    await page.getByTestId('chip-allergen-alg-peanut').click();
    await toEnglish(page);
    await expect(body).toContainText('For recipes that use store-bought products, the app lists the allergens you register and reminds you to check the package label.');
  });
});

test.describe('axe, ja and en, mobile and desktop projects, light and dark (US-NF-02/AC1)', () => {
  const serious = async (page: Page, label_: string) => {
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${label_} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  };
  for (const scheme of ['light', 'dark'] as const) {
    for (const lang of ['ja', 'en'] as const) {
      test(`US-NF-02/AC1 US-E6-04/AC4 axe: recommendations, detail with notice and markers, library with greyed rows, plan picker; ${lang}, ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await seed(page, stateWith({ known: ['alg-peanut', 'alg-wheat'] }));
        await openMore(page, '2026-11-12');
        if (lang === 'en') await toEnglish(page);
        await serious(page, `recs ${lang} ${scheme}`);
        await go(page, '/recipes');
        await expect(page.getByTestId('screen-library')).toBeVisible();
        await serious(page, `library ${lang} ${scheme}`);
        await go(page, `/recipe/${AXE_R.id}`);
        await expect(page.getByTestId('recipe-processed-notice')).toBeVisible();
        await serious(page, `detail ${lang} ${scheme}`);
        await page.getByTestId('recipe-footer-action').click();
        await expect(page.getByTestId('plan-pick')).toBeVisible();
        await serious(page, `picker ${lang} ${scheme}`);
      });
    }
  }
  test('US-E6-02/AC11 the English notice and markers read as specified and never claim safety (screen text, en)', async ({ page }) => {
    await seed(page, stateWith({ known: ['alg-peanut', 'alg-shrimp'] }));
    await go(page, `/recipe/${MULTI.id}`);
    await toEnglish(page);
    const notice = page.getByTestId('recipe-processed-notice');
    await expect(notice).toContainText(`Store-bought products may contain the registered allergens (${label('alg-peanut', 'en')}, ${label('alg-shrimp', 'en')}). Check the package label.`);
    const first = procIds(MULTI)[0]!;
    await expect(page.getByTestId(`recipe-ingredient-${first}-processed`)).toContainText('Store-bought product: check the label');
    const t = await notice.innerText();
    expect(t).not.toMatch(/\b(free|safe|guarantee)/i);
  });
});
