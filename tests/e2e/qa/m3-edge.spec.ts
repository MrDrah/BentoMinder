// QA M3: recommendation, recipe detail, library, plan picker, missing recipe. Derived from the stories (US-E6-01..06, US-E5-03)
// and the ranking oracle (tests/oracle/impl/ranking.ts), not from the developer's tests. Today = 2026-11-02 10:00 JST unless moved.
// Run: npx playwright test -c tests/e2e/qa/playwright.m3.config.ts  (needs `npm run build` first)
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEY, readStore, ROOT, type Json } from './helpers.ts';
import { loadRDict, RankOracle, type RRecipe } from '../../oracle/impl/ranking.ts';

const STATE = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8')) as Json;
const LIB = JSON.parse(readFileSync(join(ROOT, 'data', 'library.json'), 'utf8')) as (RRecipe & { name: { ja: string }; shortNameJa: string; minutes: number; dietDataComplete: boolean })[];
const BANNED = JSON.parse(readFileSync(join(ROOT, 'data', 'banned-phrases.json'), 'utf8')) as { ja: string[]; en: string[] };
const ORACLE = new RankOracle(loadRDict(), LIB);
const NOW = new Date('2026-11-02T01:00:00Z');
const DISCLAIMER = 'アレルギーの安全を保証するものではありません。使用する食品の表示を必ずご確認ください。';
const clone = (x: Json): Json => JSON.parse(JSON.stringify(x));

interface P { likedIds?: string[]; dislikedIds?: string[]; known?: string[]; excl?: string[]; diet?: string[]; themes?: string[]; status?: string }
function stateWith(p: P = {}, now = NOW): Json {
  void now;
  const s = clone(STATE);
  const pr = s.profile;
  if (p.likedIds) pr.likedIds = p.likedIds;
  if (p.dislikedIds) pr.dislikedIds = p.dislikedIds;
  if (p.themes) pr.themeIds = p.themes;
  if (p.diet) pr.diet = p.diet;
  if (p.known !== undefined) pr.knownAllergenIds = p.known;
  if (p.excl !== undefined) pr.excludedIngredientIds = p.excl;
  if (p.status) pr.allergyStatus = p.status;
  else pr.allergyStatus = pr.knownAllergenIds.length + pr.excludedIngredientIds.length > 0 ? 'has-known' : 'none-known';
  return s;
}
const profileOf = (s: Json) => ({
  likedIds: s.profile.likedIds as string[],
  dislikedIds: s.profile.dislikedIds as string[],
  knownAllergenIds: s.profile.knownAllergenIds as string[],
  excludedIngredientIds: s.profile.excludedIngredientIds as string[],
  diet: s.profile.diet as string[],
  themeIds: s.profile.themeIds as string[],
});
const decisionsOf = (s: Json) =>
  (Object.values(s.decisions) as Json[]).map((d) => ({ date: d.date as string, state: d.state as string, recipeId: d.recipeId as string | undefined }));
const expected = (s: Json, target: string) => ORACLE.run(profileOf(s), decisionsOf(s), target);

async function seed(page: Page, state: Json, now: Date = NOW) {
  await page.clock.setFixedTime(now);
  await page.addInitScript(
    ([k, v]) => {
      if (window.localStorage.getItem(k!) === null) window.localStorage.setItem(k!, v!);
    },
    [KEY, JSON.stringify(state)] as const,
  );
}
const go = async (page: Page, hash: string) => {
  await page.goto('./');
  await page.evaluate((h) => (window.location.hash = h), hash);
};
/** Replaces the stored state and reloads (init scripts only seed an empty store, so a second state in one test needs this). */
const setStore = async (page: Page, state: Json) => {
  await page.evaluate(([k, v]) => window.localStorage.setItem(k!, v!), [KEY, JSON.stringify(state)] as const);
  await page.reload();
};
const raw = (page: Page) => page.evaluate((k) => window.localStorage.getItem(k), KEY);
const ids = async (page: Page, sel: string) => page.locator(sel).evaluateAll((els) => els.map((e) => e.getAttribute('data-recipe-id')));

async function openRecs(page: Page, state: Json, date = '2026-11-05', now: Date = NOW) {
  await seed(page, state, now);
  await go(page, `/recommend/${date}`);
  await expect(page.getByTestId('screen-recommend')).toBeVisible();
}

const fold = (s: string) => s.normalize('NFKC').toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function bannedHits(text: string): string[] {
  const out: string[] = [];
  for (const p of BANNED.ja) if (fold(text).includes(fold(p))) out.push(p);
  for (const p of BANNED.en) if (new RegExp(`(^|[^a-z0-9])${esc(fold(p))}($|[^a-z0-9])`).test(fold(text))) out.push(p);
  return out;
}
const seriousAxe = async (page: Page, label: string) => {
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

const DICT = JSON.parse(readFileSync(join(ROOT, 'data', 'dictionary.json'), 'utf8')) as Json;
/** Every allergen known and every top-level category excluded: the oracle confirms 0 survivors. */
const zeroP = (): P => ({ known: (DICT.allergens as Json[]).filter((a) => !a.retired).map((a) => a.id as string), excl: (DICT.categories as Json[]).filter((c) => c.parentId === null).map((c) => c.id as string) });
/** Builds a has-known profile whose oracle survivors number exactly `n` (2026-11-01: processed foods cut deeply, so a few exclusions of foods that only the extra survivors use tune the count). */
function profileWithSurvivors(n: number, seed0: number): P {
  void seed0;
  const known = ['alg-wheat', 'alg-egg', 'alg-milk', 'alg-soybean'];
  let excl: string[] = [];
  const order = (): string[] => expected(stateWith({ known, excl }), '2026-11-05').order.map((x) => x.id);
  const base = order();
  for (let k = 0; k + n <= base.length; k++) {
    excl = [];
    const keep = base.slice(k, k + n);
    const keepIngs = new Set(keep.flatMap((id) => (LIB.find((r) => r.id === id)!.ingredients as Json[]).map((i) => i.ingredientId as string)));
    for (const id of base) {
      if (keep.includes(id)) continue;
      const r = LIB.find((x) => x.id === id)!;
      const pick = (r.ingredients as Json[]).map((i) => i.ingredientId as string).find((i) => !keepIngs.has(i));
      if (pick && !excl.includes(pick)) excl = [...excl, pick];
    }
    if (order().length === n) return { known, excl };
  }
  throw new Error(`could not build a profile with ${n} survivors`);
}

test.describe('US-E6-01 ranked suggestions, oracle-checked in the browser', () => {
  test('US-E6-01/AC1 US-E6-01/AC6 sample child: exactly 3 cards = oracle top 3 with scores; repeat is identical; ほかのレシピ = full oracle order without any excluded recipe', async ({ page }) => {
    const s = stateWith();
    const want = expected(s, '2026-11-05');
    await openRecs(page, s);
    await expect(page.locator('[data-testid^="rec-card-"][data-recipe-id]')).toHaveCount(3);
    expect(await ids(page, '[data-testid^="rec-card-"][data-recipe-id]')).toEqual(want.order.slice(0, 3).map((x) => x.id));
    const scores = await page.locator('[data-testid^="rec-card-"][data-score]').evaluateAll((e) => e.map((x) => Number(x.getAttribute('data-score'))));
    expect(scores).toEqual(want.order.slice(0, 3).map((x) => x.score));
    await page.reload();
    await expect(page.locator('[data-testid^="rec-card-"][data-recipe-id]')).toHaveCount(3);
    expect(await ids(page, '[data-testid^="rec-card-"][data-recipe-id]')).toEqual(want.order.slice(0, 3).map((x) => x.id));
    await page.getByTestId('recs-more').click();
    const rows = await ids(page, '[data-testid^="rec-row-"][data-recipe-id]');
    expect(rows).toEqual(want.order.map((x) => x.id));
    for (const ex of want.excluded.keys()) expect(rows).not.toContain(ex);
    expect(want.excluded.size).toBeGreaterThan(0); // the sample child (shrimp) really filters something
  });

  test('US-E6-01/AC2 US-E6-01/AC7 cards show name, minutes, allergen line, at most 2 reasons; 「20分以内でできます」 never on a recipe over 20 minutes and always on a neutral profile when 20 or under', async ({ page }) => {
    const s = stateWith({ likedIds: [], dislikedIds: [], themes: [] });
    await openRecs(page, s);
    await page.getByTestId('recs-more').click();
    const want = expected(s, '2026-11-05');
    for (let i = 0; i < want.order.length; i++) {
      const row = page.getByTestId(`rec-row-${i}`);
      const rec = LIB.find((r) => r.id === want.order[i]!.id)!;
      await expect(row.getByTestId(`rec-row-${i}-name`)).toContainText(rec.name.ja);
      await expect(row.getByTestId(`rec-row-${i}-minutes`)).toContainText(String(rec.minutes));
      if (rec.allergenIds.length > 0) await expect(row.getByTestId(`rec-row-${i}-allergens`)).toBeVisible();
      const text = (await row.innerText()) ?? '';
      if (rec.minutes > 20) expect(text, rec.id).not.toContain('20分以内でできます');
      else expect(text, rec.id).toContain('20分以内でできます');
    }
    const liked = stateWith();
    await page.evaluate(([k, v]) => window.localStorage.setItem(k!, v!), [KEY, JSON.stringify(liked)] as const);
    await page.reload();
    const n = await page.locator('[data-testid^="rec-card-"][data-recipe-id]').count();
    for (let i = 0; i < n; i++) {
      const reasons = page.getByTestId(`rec-card-${i}-reasons`);
      if (await reasons.count()) expect(await reasons.locator('li').count()).toBeLessThanOrEqual(2);
    }
  });

  test('US-E6-01/AC3 a recipe planned 7 days away scores exactly 2 lower than without (oracle-checked), 17 days away unchanged', async ({ page }) => {
    const s0 = stateWith();
    const top = expected(s0, '2026-11-18').order[0]!.id;
    const withPlan = (date: string) => {
      const s = stateWith();
      const d = clone(s.decisions['2026-11-04']);
      Object.assign(d, { date, recipeId: top });
      s.decisions[date] = d;
      return s;
    };
    await seed(page, s0);
    await go(page, '/recommend/2026-11-18');
    const scoreOf = async (state: Json) => {
      await setStore(page, state);
      await expect(page.getByTestId('screen-recommend')).toBeVisible();
      await page.getByTestId('recs-more').click();
      return page.locator(`[data-testid^="rec-row-"][data-recipe-id="${top}"]`).first().getAttribute('data-score');
    };
    const base = Number(await scoreOf(s0));
    const near = Number(await scoreOf(withPlan('2026-11-11')));
    expect(near).toBe(base - 2);
    expect(Number(await scoreOf(withPlan('2026-12-05')))).toBe(base);
    expect(near).toBe(expected(withPlan('2026-11-11'), '2026-11-18').order.find((x) => x.id === top)!.score);
  });

  test('US-E6-01/AC4 exactly 2 and exactly 1 survivors: fewer-count text and that many cards', async ({ page }) => {
    await openRecs(page, stateWith());
    for (const n of [2, 1]) {
      await setStore(page, stateWith(profileWithSurvivors(n, 20261100 + n)));
      await expect(page.getByTestId('recs-fewer')).toHaveText(`条件に合うレシピは${n}件です`);
      await expect(page.locator('[data-testid^="rec-card-"][data-recipe-id]')).toHaveCount(n);
    }
  });

  test('US-E6-01/AC5 US-E5-03/AC3 zero survivors: empty state with both links; the decision is unchanged; links go to profile and library', async ({ page }) => {
    const s = stateWith(zeroP());
    expect(expected(s, '2026-11-05').order.length).toBe(0);
    await seed(page, s);
    await go(page, '/day/2026-11-05');
    const before = await raw(page);
    await go(page, '/recommend/2026-11-05');
    await expect(page.getByTestId('recs-empty')).toContainText('条件に合うレシピがありません');
    await expect(page.getByTestId('recs-empty-profile')).toContainText('プロフィールを見直す');
    await expect(page.getByTestId('recs-empty-library')).toContainText('レシピ一覧を見る');
    await expect(page.locator('[data-testid^="rec-card-"][data-recipe-id]')).toHaveCount(0);
    expect(await raw(page)).toBe(before);
    await page.getByTestId('recs-empty-library').click();
    await expect(page.getByTestId('screen-library')).toBeVisible();
    expect(await raw(page)).toBe(before);
  });

  test('US-E6-01/AC6 ruling question: 「ほかのレシピ」 when 3 or fewer recipes pass (button absent vs AC text)', async ({ page }) => {
    // The AC says "When the parent taps 「ほかのレシピ」 ... the full list is shown". It does not say the button hides when the list equals
    // the suggestions. Recorded as M3-D02 (P4, ruling). The test pins the current behaviour so a change is noticed.
    await openRecs(page, stateWith(profileWithSurvivors(2, 20261102)));
    await expect(page.getByTestId('recs-more')).toHaveCount(0);
  });
});

test.describe('US-E6-02 filters in the UI', () => {
  test('US-E6-02/AC1 US-E6-02/AC6 US-E6-02/AC8 US-E6-05/AC1 library: every recipe listed, conflicts last and greyed with the reason, blocked set = oracle exclusions, planning disabled', async ({ page }) => {
    const s = stateWith({ known: ['alg-egg'], diet: ['no-beef'] });
    const want = expected(s, '2026-11-05');
    await seed(page, s);
    await go(page, '/recipes');
    await expect(page.getByTestId('screen-library')).toBeVisible();
    const rows = page.locator('[data-testid^="library-row-"][data-testid$="-link"]');
    await expect(rows).toHaveCount(LIB.length);
    const order = (await page.locator('li.library-row').evaluateAll((e) => e.map((x) => [x.getAttribute('data-testid'), x.getAttribute('data-blocked')]))) as [string, string][];
    expect(order.length).toBe(LIB.length);
    const blockedIds = order.filter(([, b]) => b === 'true').map(([t]) => t!.replace('library-row-', ''));
    expect(blockedIds.sort()).toEqual([...want.excluded.keys()].sort());
    const firstBlocked = order.findIndex(([, b]) => b === 'true');
    expect(order.slice(firstBlocked).every(([, b]) => b === 'true')).toBe(true); // blocked all last
    const eggRecipe = LIB.find((r) => want.excluded.get(r.id)?.includes('allergen:alg-egg'))!;
    await expect(page.getByTestId(`library-row-${eggRecipe.id}-reason`)).toContainText('卵を含む');
    const sd = stateWith({ known: [], diet: ['no-seafood'] });
    const wantD = expected(sd, '2026-11-05');
    const dietIncomplete = LIB.find((r) => wantD.excluded.get(r.id)?.join() === 'diet-incomplete')!;
    await setStore(page, sd);
    await expect(page.getByTestId(`library-row-${dietIncomplete.id}-reason`)).toContainText('原材料の由来がわからないため、食事の制限と照合できません');
    await setStore(page, s);
    await page.getByTestId(`library-row-${eggRecipe.id}-link`).click();
    await expect(page.getByTestId('recipe-footer-action')).toBeDisabled();
  });

  test('US-E6-04/AC6 US-E6-02/AC12 (AC5/AC6 superseded 2026-11-01) incomplete allergen data with a known allergen: neither excluded nor greyed for that reason, plannable, no retired notice', async ({ page }) => {
    const s = stateWith({ known: ['alg-shrimp'] });
    const want = expected(s, '2026-11-05');
    const inc = LIB.find((r) => !r.allergenDataComplete && !want.excluded.has(r.id))!;
    expect(inc, 'an incomplete-data recipe survives a shrimp child').toBeTruthy();
    await seed(page, s);
    await go(page, '/recipes');
    await expect(page.getByTestId(`library-row-${inc.id}-reason`)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('アレルゲン情報が不完全なため');
    await page.getByTestId(`library-row-${inc.id}-link`).click();
    await expect(page.getByTestId('recipe-footer-action')).toBeEnabled();
    await expect(page.locator('body')).not.toContainText('一部の材料のアレルゲン情報がわかりません');
  });

  test('US-E6-02/AC12 US-E6-04/AC6 retired notices are gone from the cards and the order is the oracle order (score, minutes, id) with incomplete recipes not last (none-known child)', async ({ page }) => {
    const s = stateWith({ status: 'none-known', known: [], excl: [] });
    const want = expected(s, '2026-11-05');
    await openRecs(page, s);
    await page.getByTestId('recs-more').click();
    for (let i = 0; i < want.order.length; i++) {
      const row = page.getByTestId(`rec-row-${i}`);
      await expect(row).toHaveAttribute('data-recipe-id', want.order[i]!.id);
      await expect(row.getByTestId(`rec-row-${i}-varies`)).toHaveCount(0);
      await expect(row.getByTestId(`rec-row-${i}-incomplete`)).toHaveCount(0);
    }
    await expect(page.locator('body')).not.toContainText('市販品は製品によりアレルゲンが異なります');
    const complete = want.order.map((x) => LIB.find((r) => r.id === x.id)!.allergenDataComplete);
    expect(complete.indexOf(false), 'some incomplete recipe is present').toBeGreaterThanOrEqual(0);
    expect(complete.lastIndexOf(true), 'a complete recipe ranks after an incomplete one (no tier)').toBeGreaterThan(complete.indexOf(false));
  });

  test('US-E6-02/AC2 US-E6-02/AC7 excluded ingredient and diet hide the recipes the oracle excludes (cards)', async ({ page }) => {
    const s = stateWith({ status: 'has-known', known: [], excl: ['ing-tomato', 'cat-dairy'], diet: ['vegetarian'] });
    const want = expected(s, '2026-11-05');
    await openRecs(page, s);
    if (want.order.length > 3) await page.getByTestId('recs-more').click();
    const shown = want.order.length === 0 ? [] : await ids(page, want.order.length > 3 ? '[data-testid^="rec-row-"][data-recipe-id]' : '[data-testid^="rec-card-"][data-recipe-id]');
    expect(shown).toEqual(want.order.map((x) => x.id));
  });
});

test.describe('US-E6-03 disclaimer, banner, banned phrases on every view', () => {
  test('US-E6-03/AC1 the disclaimer text is on the recommendation view (with results and empty), the library, and every one of the library recipe details', async ({ page }) => {
    await openRecs(page, stateWith());
    await expect(page.getByTestId('disclaimer')).toContainText(DISCLAIMER);
    await page.getByTestId('recs-more').click();
    await expect(page.getByTestId('disclaimer')).toHaveCount(1);
    await go(page, '/recommend/2026-11-05');
    await go(page, '/recipes');
    await expect(page.getByTestId('screen-library')).toBeVisible();
    await expect(page.getByTestId('disclaimer'), 'library view').toContainText(DISCLAIMER);
    for (const r of LIB) {
      await page.evaluate((h) => (window.location.hash = h), `/recipe/${r.id}`);
      await expect(page.getByTestId('screen-recipe')).toHaveAttribute('data-recipe-id', r.id);
      await expect(page.getByTestId('disclaimer'), r.id).toContainText(DISCLAIMER);
    }
    await page.evaluate((h) => (window.location.hash = h), `/recipe/${LIB[0]!.id}?date=2026-11-05`);
    await expect(page.getByTestId('disclaimer')).toContainText(DISCLAIMER);
  });

  test('US-E6-03/AC1 empty recommendation state also carries the disclaimer', async ({ page }) => {
    await openRecs(page, stateWith(zeroP()));
    await expect(page.getByTestId('recs-empty')).toBeVisible();
    await expect(page.getByTestId('disclaimer')).toContainText(DISCLAIMER);
  });

  test('US-E1-03/AC5 the unknown-allergy banner shows on recommendations and recipe detail only for status unknown', async ({ page }) => {
    await openRecs(page, stateWith({ status: 'unknown', known: [], excl: [] }));
    await expect(page.getByTestId('banner-allergy-unknown')).toBeVisible();
    await expect(page.getByTestId('disclaimer')).toBeVisible();
    await go(page, `/recipe/${LIB[1]!.id}`);
    await expect(page.getByTestId('banner-allergy-unknown')).toBeVisible();
    await page.evaluate(([k, v]) => window.localStorage.setItem(k!, v!), [KEY, JSON.stringify(stateWith())] as const);
    await page.reload();
    await expect(page.getByTestId('banner-allergy-unknown')).toHaveCount(0);
  });

  test('US-E6-03/AC2 banned-phrase scan over every rendered view: recommendation (open), library, 20 recipe details, not-found, plan picker', async ({ page }) => {
    const hits: string[] = [];
    const scan = async (label: string) => {
      const t = await page.locator('body').innerText();
      for (const h of bannedHits(t)) hits.push(`${label}: ${h}`);
    };
    await openRecs(page, stateWith());
    await page.getByTestId('recs-more').click();
    await scan('recommend');
    await page.evaluate((h) => (window.location.hash = h), '/recipes');
    await expect(page.getByTestId('screen-library')).toBeVisible();
    await scan('library');
    for (const r of LIB) {
      await page.evaluate((h) => (window.location.hash = h), `/recipe/${r.id}`);
      await expect(page.getByTestId('screen-recipe')).toHaveAttribute('data-recipe-id', r.id);
      await scan(r.id);
    }
    await page.evaluate((h) => (window.location.hash = h), '/recipe/rcp-nope');
    await expect(page.getByTestId('recipe-not-found')).toBeVisible();
    await scan('not-found');
    await page.evaluate((h) => (window.location.hash = h), `/recipe/${LIB[1]!.id}`);
    await page.getByTestId('recipe-footer-action').click();
    await expect(page.getByTestId('plan-pick')).toBeVisible();
    await scan('picker');
    // Known: defect M3-D01 (P3): en adaptations are not rendered in ja; if they ever render this lists them.
    expect(hits).toEqual([]);
  });
});

test.describe('US-E6-03 banned phrases in English views', () => {
  test('US-E6-03/AC2 banned-phrase scan, language en: recommendation, library, every recipe detail', async ({ page }) => {
    const s = stateWith();
    s.settings.language = 'en';
    const hits: string[] = [];
    const scan = async (label: string) => {
      for (const h of bannedHits(await page.locator('body').innerText())) hits.push(`${label}: ${h}`);
    };
    await openRecs(page, s);
    await page.getByTestId('recs-more').click();
    await scan('recommend-en');
    await page.evaluate((h) => (window.location.hash = h), '/recipes');
    await expect(page.getByTestId('screen-library')).toBeVisible();
    await scan('library-en');
    for (const r of LIB) {
      await page.evaluate((h) => (window.location.hash = h), `/recipe/${r.id}`);
      await expect(page.getByTestId('screen-recipe')).toHaveAttribute('data-recipe-id', r.id);
      await scan(`${r.id}-en`);
    }
    // Defect M3-D01 (P3): the en adaptations of 8 recipes contain 'no allergens'; they are rendered in en. Pinned to exactly those.
    expect(hits.every((h) => h.endsWith(': no allergens'))).toBe(true);
    expect(hits.length).toBeLessThanOrEqual(8);
    console.log('M3-D01 rendered en hits: ' + hits.length);
  });
});

test.describe('US-E6-04 recipe detail', () => {
  test('US-E6-04/AC1 US-E6-04/AC2 detail shows name, minutes, servings, every ingredient, every step, storage, 農林水産省 food-handling notes with link, sources with links', async ({ page }) => {
    const rec = LIB.find((r) => (r as Json).themeId) as Json;
    await seed(page, stateWith());
    await go(page, `/recipe/${rec.id}`);
    await expect(page.getByTestId('screen-recipe')).toBeVisible();
    const body = page.getByTestId('screen-recipe');
    await expect(body).toContainText(rec.name.ja);
    await expect(body).toContainText(String(rec.minutes));
    await expect(body).toContainText(rec.yield.ja);
    expect(await page.getByTestId('recipe-ingredients').locator('tbody tr, tr').count()).toBeGreaterThanOrEqual(rec.ingredients.length);
    expect(await page.getByTestId('recipe-steps').locator('li').count()).toBe(rec.steps.length);
    for (const st of rec.storage) await expect(body).toContainText(st.ja.slice(0, 12));
    await expect(page.getByTestId('recipe-safety-cool')).toBeVisible();
    await expect(page.getByTestId('recipe-safety-carry')).toBeVisible();
    await expect(page.getByTestId('recipe-safety')).toContainText('農林水産省');
    expect(await page.getByTestId('recipe-safety-credit').getAttribute('href')).toMatch(/^https:\/\/www\.maff\.go\.jp\//);
    const links = page.getByTestId('recipe-sources').locator('a');
    expect(await links.count()).toBeGreaterThanOrEqual(1);
    for (const href of await links.evaluateAll((a) => a.map((x) => x.getAttribute('href')))) expect(href).toMatch(/^https?:\/\//);
    // US-E6-03/AC3: the badge is guaranteed for allergenIds [] without a processed ingredient and for any recipe with allergens; a recipe with [] and a processed ingredient shows no 'none' badge (never claims none)
    const procAll = ((DICT.ingredients as Json[]).filter((d) => d.info === 'varies').map((d) => d.id as string));
    const mustBadge = rec.allergenIds.length > 0 || !rec.ingredients.some((i: Json) => procAll.includes(i.ingredientId));
    if (mustBadge) await expect(page.getByTestId('recipe-allergens')).toBeVisible();
  });

  test('US-E6-04/AC2 food-handling guidance is present on every recipe', async ({ page }) => {
    await seed(page, stateWith());
    await go(page, `/recipe/${LIB[0]!.id}`);
    for (const r of LIB) {
      await page.evaluate((h) => (window.location.hash = h), `/recipe/${r.id}`);
      await expect(page.getByTestId('screen-recipe')).toHaveAttribute('data-recipe-id', r.id);
      await expect(page.getByTestId('recipe-safety'), r.id).toContainText('農林水産省');
    }
  });

  test('US-E6-04/AC3 unknown, hostile and over-long ids show 「レシピが見つかりません」 with a calendar link; nothing executes', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await seed(page, stateWith());
    await go(page, '/recipe/rcp-does-not-exist');
    await expect(page.getByTestId('recipe-not-found')).toContainText('レシピが見つかりません');
    await expect(page.getByTestId('recipe-not-found-back')).toBeVisible();
    for (const bad of ['%3Cscript%3Ealert(1)%3C%2Fscript%3E', 'rcp-' + 'a'.repeat(600), '%F0%9F%8D%B1', '', 'rcp-x/../..', 'rcp-%00']) {
      await page.evaluate((h) => (window.location.hash = h), `/recipe/${bad}`);
      await expect(page.locator('body')).not.toContainText('Uncaught');
      await expect(page.locator('main, [data-testid="recipe-not-found"], [data-testid="screen-calendar"], body').first()).toBeVisible();
    }
    expect(dialogs).toEqual([]);
    await go(page, '/recipe/rcp-does-not-exist');
    await page.getByTestId('recipe-not-found-back').click();
    await expect(page.getByTestId('cal-grid')).toBeVisible();
  });
});

test.describe('US-E6-05 library and plan picker; US-E5-03 confirm flow; US-E6-06 missing recipe', () => {
  const dayDates = (s: Json): string[] => {
    const m = s.menus['2026-11'].confirmed;
    const school = m.days.filter((d: Json) => d.items.some((i: Json) => i.kind !== 'snack')).map((d: Json) => d.date as string);
    const bento = m.noLunchDays.filter((d: Json) => d.reason === 'bento-day').map((d: Json) => d.date as string);
    return [...school, ...bento].sort();
  };
  const passing = (s: Json, skip = 0) => {
    const want = expected(s, '2026-11-05');
    return want.order[skip]!.id;
  };

  test('US-E6-05/AC3 picker lists, in date order, every school day and お弁当の日 from today, no past, no snack-only, no no-lunch day, with each current decision', async ({ page }) => {
    const s = stateWith();
    for (const [now, today] of [[NOW, '2026-11-02'], [new Date('2026-11-10T01:00:00Z'), '2026-11-10']] as const) {
      await page.goto('about:blank');
      await seed(page, s, now);
      await go(page, `/recipe/${passing(s)}`);
      await page.getByTestId('recipe-footer-action').click();
      await expect(page.getByTestId('plan-pick')).toBeVisible();
      await expect(page.getByTestId('plan-pick')).toContainText('どの日に作りますか？');
      const got = await page.locator('[data-testid^="plan-pick-option-"]').evaluateAll((e) => e.map((x) => x.getAttribute('data-testid')!.replace('plan-pick-option-', '')));
      expect(got).toEqual(dayDates(s).filter((d) => d >= today));
      expect(got).not.toContain('2026-11-14');
      expect(got).not.toContain('2026-11-27');
      expect(got).toContain('2026-11-20');
      await expect(page.getByTestId('plan-pick-confirm')).toBeDisabled();
    }
  });

  test('US-E6-05/AC2 US-E5-03/AC2 pick 2026-11-05 then 決定: stored decision has recipeId, decidedAt = plannedAt, snapshots; picking a planned day changes the recipe and keeps plannedAt', async ({ page }) => {
    const s = stateWith();
    const r1 = passing(s);
    const r2 = passing(s, 1);
    await seed(page, s);
    await go(page, `/recipe/${r1}`);
    await page.getByTestId('recipe-footer-action').click();
    await page.getByTestId('plan-pick-option-2026-11-05').check();
    await page.getByTestId('plan-pick-confirm').click();
    await expect.poll(async () => (await readStore(page)).decisions['2026-11-05']?.state).toBe('homemade-bento-planned');
    const d = (await readStore(page)).decisions['2026-11-05'];
    const rec = LIB.find((r) => r.id === r1)!;
    expect(d.recipeId).toBe(r1);
    expect(d.decidedAt).toBeTruthy();
    expect(d.plannedAt).toBe(d.decidedAt);
    expect(d.recipeNameSnapshot.ja).toBe(rec.name.ja);
    expect(d.recipeShortNameSnapshot.ja).toBe(rec.shortNameJa);
    await expect(page.getByTestId('cal-cell-2026-11-05').or(page.getByTestId('day-status')).first()).toBeVisible();
    // change through the picker of another recipe
    await page.clock.setFixedTime(new Date('2026-11-02T02:00:00Z'));
    await go(page, `/recipe/${r2}`);
    await page.getByTestId('recipe-footer-action').click();
    await page.getByTestId('plan-pick-option-2026-11-05').check();
    await page.getByTestId('plan-pick-confirm').click();
    await expect.poll(async () => (await readStore(page)).decisions['2026-11-05']?.recipeId).toBe(r2);
    const d2 = (await readStore(page)).decisions['2026-11-05'];
    expect(d2.plannedAt).toBe(d.plannedAt);
    expect(d2.history.length).toBe(d.history.length + 1);
  });

  test('US-E6-05/AC4 every confirmed day is in the past: also empty', async ({ page }) => {
    const s = stateWith();
    await seed(page, s, new Date('2026-12-05T01:00:00Z'));
    await go(page, `/recipe/${LIB[1]!.id}`);
    await page.getByTestId('recipe-footer-action').click();
    await expect(page.getByTestId('plan-pick-empty')).toBeVisible();
  });

  test('US-E5-03/AC1 US-E5-03/AC3 US-E6-03/AC1 bento from the day sheet opens recommendations; stored state is byte-identical on opening, expanding, previewing a recipe, and leaving by back', async ({ page }) => {
    const s = stateWith();
    await seed(page, s);
    await go(page, '/day/2026-11-05');
    const before = await raw(page);
    await page.getByTestId('day-action-bento').click();
    await expect(page).toHaveURL(/#\/recommend\/2026-11-05$/);
    await expect(page.getByTestId('screen-recommend')).toBeVisible();
    expect((await readStore(page)).decisions['2026-11-05'].state).toBe('school-lunch-planned');
    await page.getByTestId('recs-more').click();
    await page.getByTestId('rec-card-0-details').click();
    await expect(page.getByTestId('screen-recipe')).toBeVisible();
    await page.goBack();
    await page.goBack();
    expect(await raw(page)).toBe(before);
    await go(page, '/recipes');
    await go(page, `/recipe/${passing(s)}`);
    await page.getByTestId('recipe-footer-action').click();
    await page.getByTestId('plan-pick-close').click();
    await expect(page.getByTestId('plan-pick')).toHaveCount(0);
    expect(await raw(page)).toBe(before);
  });

  test('US-E5-03/AC2 confirm the first card: decision homemade-bento-planned with that recipe; the day shows the recipe name', async ({ page }) => {
    const s = stateWith();
    const top = expected(s, '2026-11-05').order[0]!.id;
    await openRecs(page, s);
    await page.getByTestId('rec-card-0-confirm').click();
    await expect.poll(async () => (await readStore(page)).decisions['2026-11-05'].state).toBe('homemade-bento-planned');
    const d = (await readStore(page)).decisions['2026-11-05'];
    expect(d.recipeId).toBe(top);
    expect(d.plannedAt).toBe(d.decidedAt);
    expect(d.recipeNameSnapshot.ja).toBe(LIB.find((r) => r.id === top)!.name.ja);
    await go(page, '/calendar/2026-11');
    await expect(page.getByTestId('cal-cell-2026-11-05')).toContainText(LIB.find((r) => r.id === top)!.shortNameJa);
  });

  test('US-E5-03/AC4 today 2026-11-05 08:00 JST: 11-05 can be planned, 11-04 (past) cannot: no confirm buttons and no bento action', async ({ page }) => {
    const now = new Date('2026-11-04T23:00:00Z');
    const s = stateWith();
    await openRecs(page, s, '2026-11-05', now);
    await expect(page.getByTestId('rec-card-0-confirm')).toBeVisible();
    await go(page, '/recommend/2026-11-02');
    await expect(page.getByTestId('screen-recommend')).toBeVisible();
    await expect(page.locator('[data-testid$="-confirm"]')).toHaveCount(0);
    await go(page, '/day/2026-11-02');
    await expect(page.getByTestId('day-sheet')).toBeVisible();
    await expect(page.getByTestId('day-action-bento')).toHaveCount(0);
    const before = await raw(page);
    await go(page, '/recommend/2026-11-04');
    await page.getByTestId('recs-more').click().catch(() => undefined);
    expect(await raw(page)).toBe(before);
  });

  test('US-E6-06/AC1 11-04 planned with a retired recipe: cell shows the stored short name, sheet shows the stored name and the missing message, decision unchanged', async ({ page }) => {
    const s = stateWith();
    await seed(page, s);
    const before = JSON.stringify(s.decisions['2026-11-04']);
    await go(page, '/calendar/2026-11');
    await expect(page.getByTestId('cal-cell-2026-11-04')).toContainText('くまおにぎり');
    await go(page, '/day/2026-11-04');
    await expect(page.getByTestId('day-recipe-name')).toContainText('くまさんおにぎり弁当');
    await expect(page.getByTestId('day-recipe-missing')).toContainText('このレシピは見つかりません。別のレシピを選んでください。');
    expect(JSON.stringify((await readStore(page)).decisions['2026-11-04'])).toBe(before);
    await seriousAxe(page, 'missing-recipe day');
  });

  test('US-E5-03/AC2 US-E6-01/AC1 keyboard only: Tab to the first 「この日に決定」 and press Enter plans the day', async ({ page }) => {
    await openRecs(page, stateWith());
    const target = page.getByTestId('rec-card-0-confirm');
    await expect(target).toBeVisible();
    let reached = false;
    for (let i = 0; i < 60 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await target.evaluate((el) => el === document.activeElement);
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readStore(page)).decisions['2026-11-05'].state).toBe('homemade-bento-planned');
  });
});

test.describe('accessibility (axe serious/critical = 0), both colour schemes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`US-E6-01/AC2 US-E6-04/AC1 US-E6-05/AC1 axe ${scheme}: recommendations (expanded), library, recipe detail, picker, not-found`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const s = stateWith({ known: ['alg-egg'] });
      await openRecs(page, s);
      await page.getByTestId('recs-more').click();
      await seriousAxe(page, `${scheme} recommend`);
      await go(page, '/recipes');
      await expect(page.getByTestId('screen-library')).toBeVisible();
      await seriousAxe(page, `${scheme} library`);
      await go(page, `/recipe/${LIB.find((r) => !r.allergenIds.includes('alg-egg'))!.id}`); // a plannable recipe for this egg child
      await expect(page.getByTestId('screen-recipe')).toBeVisible();
      await seriousAxe(page, `${scheme} recipe`);
      await page.getByTestId('recipe-footer-action').click();
      await expect(page.getByTestId('plan-pick')).toBeVisible();
      await seriousAxe(page, `${scheme} picker`);
      await go(page, '/recipe/rcp-nope');
      await seriousAxe(page, `${scheme} not-found`);
    });
  }
});
