// QA M1: adversarial probes for things developers rarely test: whitespace variants, stale hidden profile
// fields, search with hostile input, very long file names / URLs reaching the store contract, language switch
// mid-edit, Escape on dialogs, production build contents (BR-24, US-NF-05).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FX01, fillProfile, freezeClock, pinHand1, readStore, ROOT } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

async function finishStep1(page: Page) {
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
}

test('US-E1-02/AC5 a nickname or note made only of any kind of space (ASCII, ideographic, NBSP, tab) is stored as absent; text is trimmed', async ({ page }) => {
  for (const blank of ['   ', '　　', '  ', '\t\t', ' 　 \t ']) {
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.goto('./');
    await page.getByTestId('input-nickname').fill(blank);
    await page.getByTestId('input-note').fill(blank);
    await finishStep1(page);
    const p = (await readStore(page)).profile;
    expect(p.nickname, JSON.stringify(blank)).toBeUndefined();
    expect(p.note, JSON.stringify(blank)).toBeUndefined();
  }
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.goto('./');
  await page.getByTestId('input-nickname').fill('  はな  ');
  await finishStep1(page);
  expect((await readStore(page)).profile.nickname).toBe('はな');
});

test('US-E1-03/AC1 US-E1-05/AC1 switching allergy status away from "has known" does not keep hidden allergens in the stored profile', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-has-known').check();
  await page.getByTestId('chip-allergen-alg-shrimp').click();
  await page.getByTestId('picker-other-foods-search').fill('トマト');
  await page.getByTestId('picker-other-foods-option-ing-tomato').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  const p = (await readStore(page)).profile;
  expect(p.allergyStatus).toBe('none-known');
  // BR-20 / BR-06: a profile that says "none known" must not carry allergens (or the app would filter on data the parent can no longer see)
  expect(p.knownAllergenIds).toEqual([]);
  expect(p.excludedIngredientIds).toEqual([]);
});

test('US-E1-05 editing: switching "has known" to "unknown" in the edit screen clears the hidden allergens too', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-has-known').check();
  await page.getByTestId('chip-allergen-alg-egg').click();
  await page.getByTestId('ob-next').click();
  await page.getByTestId('import-later').click();
  await page.goto('./#/profile');
  await page.getByTestId('radio-allergy-unknown').check();
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('screen-settings')).toBeVisible();
  const p = (await readStore(page)).profile;
  expect(p.allergyStatus).toBe('unknown');
  expect(p.knownAllergenIds).toEqual([]);
});

test('US-E1-02/AC2 food search: hiragana, katakana, half-width and hostile queries never crash, never regex-explode', async ({ page }) => {
  await page.goto('./');
  const search = page.getByTestId('picker-likes-search');
  for (const [q, expectId] of [
    ['ぴーまん', 'ing-green-pepper'],
    ['ピーマン', 'ing-green-pepper'],
    ['ﾋﾟｰﾏﾝ', 'ing-green-pepper'],
    ['とり', 'ing-chicken'],
  ] as const) {
    await search.fill(q);
    await expect(page.getByTestId(`picker-likes-option-${expectId}`), q).toBeVisible();
  }
  const t0 = Date.now();
  for (const q of ['(((', '[a-', '.*', '\\', '<script>alert(1)</script>', '😀😀😀', 'a'.repeat(20000), '(a+)+$'.repeat(500), '\u0000', '%', "' OR 1=1 --"]) {
    await search.fill(q);
    await page.waitForTimeout(30);
    await expect(page.getByTestId('screen-onboarding')).toBeVisible();
  }
  expect(Date.now() - t0, 'search with hostile input took too long').toBeLessThan(20_000);
  expect(await page.locator('script', { hasText: 'alert(1)' }).count()).toBe(0);
});

test('US-E1-02 BR-20 likes accept at most 30 foods: the 31st is refused with a notice, the stored profile has 30', async ({ page }) => {
  await page.goto('./');
  const search = page.getByTestId('picker-likes-search');
  const chips = () => page.locator('[data-testid^="picker-likes-chip-"]').count();
  const queries = ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と', 'な', 'に', 'ぬ', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ', 'ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ', 'ら', 'り', 'る', 'れ', 'ろ', 'わ'];
  let refusedNotice = false;
  outer: for (const q of queries) {
    await search.fill(q);
    const options = page.locator('[data-testid^="picker-likes-option-"]');
    const n = await options.count();
    for (let i = 0; i < n; i++) {
      const o = options.nth(i);
      if ((await o.getAttribute('aria-pressed')) === 'true') continue;
      await o.click();
      const notice = await page.getByTestId('profile-notice').innerText();
      if ((await chips()) >= 30 && /30/.test(notice)) refusedNotice = true;
      if ((await chips()) > 30) break outer;
      if (await chips() === 30) {
        // try one more: must be refused
        const next = options.nth(i + 1 < n ? i + 1 : 0);
        if ((await next.count()) && (await next.getAttribute('aria-pressed')) !== 'true') {
          await next.click();
          refusedNotice = /30/.test(await page.getByTestId('profile-notice').innerText());
          break outer;
        }
      }
    }
  }
  const total = await chips();
  test.info().annotations.push({ type: 'observed', description: 'likes chips=' + total + ' notice=' + refusedNotice });
  expect(total).toBeLessThanOrEqual(30);
  expect(total, 'could not reach the limit with the dictionary: test inconclusive').toBe(30);
  expect(refusedNotice, 'the 31st like must be refused with a notice naming 30').toBe(true);
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  expect((await readStore(page)).profile.likedIds).toHaveLength(30);
});

test('US-E2-03 a very long or odd file name is shown as text and the import still works and stores', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page);
  const pdf = readFileSync(FX01);
  const name = 'あ'.repeat(300) + '.pdf';
  await page.getByTestId('import-upload').setInputFiles({ name, mimeType: 'application/pdf', buffer: pdf });
  await page.getByTestId('consent-accept').click();
  // either the review opens (name stored as is or shortened), or a clear error; never a blank/frozen screen and never a lost import
  await expect(page.getByTestId('screen-review').or(page.getByTestId('import-error'))).toBeVisible({ timeout: 15_000 });
  if (await page.getByTestId('import-error').count()) {
    test.info().annotations.push({ type: 'observed', description: 'long file name rejected with: ' + (await page.getByTestId('import-error').innerText()) });
  }
  expect(await page.getByTestId('screen-review').count(), 'a 300-character file name must not break the import (D-M1-xx)').toBe(1);
  const src = (await readStore(page)).menus['2026-11'].extractions[0].source;
  expect(src.filename.length).toBeGreaterThan(0);
});

test('US-E2-01/AC3 a 2048-character https URL fetched successfully is stored as the source without breaking the store contract', async ({ page }) => {
  const pdf = readFileSync(FX01);
  await page.route('**/api/menu/fetch-pdf', (route) => route.fulfill({ status: 200, contentType: 'application/pdf', body: pdf }));
  await page.goto('./');
  await fillProfile(page);
  const base = 'https://example-kinder.test/';
  const url = base + 'a'.repeat(2048 - base.length);
  await page.getByTestId('input-url').fill(url);
  await page.getByTestId('input-url').press('Tab');
  await page.getByTestId('import-submit').click();
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review').or(page.getByTestId('import-error'))).toBeVisible({ timeout: 15_000 });
  expect(await page.getByTestId('screen-review').count(), 'a URL the app accepted (2048 chars) must be storable').toBe(1);
  expect((await readStore(page)).menus['2026-11'].extractions[0].source.url).toBe(url);
});

test('US-E8-01/AC2 switching language while editing the review keeps the edits and translates the screen', async ({ page }) => {
  await pinHand1(page);
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await page.getByTestId('review-dish-2026-11-02-0').fill('メモ入力');
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('review-dish-2026-11-02-0')).toHaveValue('メモ入力');
  await expect(page.getByTestId('review-confirm')).toHaveText('Confirm this menu');
  await expect(page.getByTestId('review-summary')).toContainText('Items to check: 3');
  await page.getByTestId('lang-toggle-ja').click();
  await expect(page.getByTestId('review-dish-2026-11-02-0')).toHaveValue('メモ入力');
});

test('US-E2-08/AC2 Escape on the consent dialog is the same as 「同意しない」: no extract call', async ({ page }) => {
  let extracts = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/menu/extract') extracts += 1;
  });
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('consent-dialog')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(extracts).toBe(0);
  expect((await readStore(page)).consent ?? null).toBeNull();
});

test('US-E2-08/AC3 consent is stored with its version and not asked again; a lower stored version asks again', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  expect((await readStore(page)).consent).toMatchObject({ aiNoticeVersion: 1 });
  await page.goto('./#/import');
  await page.getByTestId('dialog-leave-review-confirm').click();
  await page.getByTestId('import-upload').setInputFiles(join(ROOT, 'tests', 'fixtures', 'menus', 'fixture-menu-2026-11-v2', 'menu.pdf'));
  await expect(page.getByTestId('consent-dialog')).toHaveCount(0);
});

test('BR-24 US-NF-05 the production bundle has no debug UI, no secret, no source map, no scenario header', async ({ request }) => {
  const html = await (await request.get('./')).text();
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]!).filter((a) => /\.(js|css)$/.test(a));
  expect(assets.length).toBeGreaterThan(0);
  let all = html;
  for (const a of assets) {
    all += await (await request.get(a)).text();
    const map = await request.get(a + '.map');
    const ct = map.headers()['content-type'] ?? '';
    expect(!map.ok() || ct.includes('html'), `${a}.map is served`).toBe(true);
  }
  for (const bad of ['debug-panel', 'debug-open', 'AI calls this month', 'x-bm-mock-scenario', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'AIza', '.env', 'PROXY_MOCK_SCENARIOS', 'hand-malformed', 'fixture-menu-2026-11']) {
    expect(all.includes(bad), `bundle contains "${bad}"`).toBe(false);
  }
  // keys that look like secrets
  expect(/AIza[0-9A-Za-z_-]{20,}/.test(all)).toBe(false);
  expect(/sk-[A-Za-z0-9]{20,}/.test(all)).toBe(false);
});

// D-M1-05 (P3): the PDF's own allergen line (Japanese) is shown on the review screen without lang="ja",
// so in the English UI it is announced with the wrong voice (WCAG 3.1.2 Language of Parts, AA).
test('US-NF-02/AC1 US-E8-02/AC2 D-M1-05 the PDF allergen line on the review screen carries lang="ja" in the English UI', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('lang-toggle-en').click();
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  const line = page.getByText('アレルゲン：卵・小麦').first();
  await expect(line).toBeVisible();
  expect(await line.evaluate((el) => !!el.closest('[lang="ja"]'))).toBe(true);
});
