// QA M1: remaining AC coverage: stepper (E1-01/AC1), consent facts (E2-08/AC4), no PII fields in the contract
// (NF-03/AC2), original PDF link (E3-01/AC3), store version (E10-02/AC1), uncertain flag per field (E2-04/AC4).
import { expect, test } from '@playwright/test';
import { FX01, fillProfile, freezeClock, pinHand1, readStore, STATE_V1 } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

test('US-E1-01/AC1 onboarding shows 3 input steps (profile, menu source, review) and the calendar is not a numbered step', async ({ page }) => {
  await page.goto('./');
  const stepper = page.getByTestId('stepper');
  await expect(stepper).toContainText('ステップ 1 / 3');
  await expect(stepper.locator('li')).toHaveCount(3);
  await expect(stepper).toContainText('お子さまのこと');
  await expect(stepper).toContainText('献立の取り込み');
  await expect(stepper).toContainText('献立の確認');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('お子さまのこと');
  await fillProfile(page);
  await expect(page.getByTestId('stepper')).toContainText('ステップ 2 / 3');
  await page.getByTestId('import-later').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('stepper')).toHaveCount(0);
});

for (const lang of ['ja', 'en'] as const) {
  test(`US-E2-08/AC4 US-E2-08/AC1 the consent notice states all 6 facts and links the terms, with no privacy claim (${lang})`, async ({ page }) => {
    await page.goto('./');
    if (lang === 'en') await page.getByTestId('lang-toggle-en').click();
    await fillProfile(page);
    await page.getByTestId('import-upload').setInputFiles(FX01);
    const dlg = page.getByTestId('consent-dialog');
    await expect(dlg).toBeVisible();
    const text = await dlg.innerText();
    const facts =
      lang === 'ja'
        ? [/献立表のPDF/, /Gemini/, /お子さまの名前・年齢・アレルギー・好み/, /ご家族の予定は送りません/, /無料枠/, /サービス改善/, /担当者が内容を読む/, /保護者向け/, /18歳以上/, /日本国内/]
        : [/menu PDF/i, /Gemini/, /name, age, allergies/i, /family.s plans/i, /free tier/i, /improve/i, /reviewers? may read|human reviewers/i, /parents/i, /18/, /Japan/i];
    for (const f of facts) expect(text, String(f)).toMatch(f);
    const claims = lang === 'ja' ? /保存されません|削除されます|使われません|プライベート|完全に安全|匿名/ : /not stored|is deleted|never used|private|completely safe|anonymous/i;
    expect(text).not.toMatch(claims);
    const link = page.getByTestId('consent-link');
    await expect(link).toHaveAttribute('href', 'https://ai.google.dev/gemini-api/terms');
    await expect(link).toHaveAttribute('target', '_blank');
    expect(await link.getAttribute('rel')).toContain('noopener');
    // a decline keeps the manual path
    await page.getByTestId('consent-decline').click();
    await expect(page.getByTestId('import-manual')).toBeVisible();
  });
}

test('US-NF-03/AC2 BR-20 the profile contract has no birthdate, gender, height, weight, photo, name, school or address: a store carrying one is refused', async ({ page }) => {
  const base = JSON.parse(STATE_V1);
  for (const extra of ['birthdate', 'gender', 'height', 'weight', 'photo', 'realName', 'school', 'address', 'email', 'anything']) {
    const bad = JSON.stringify({ ...base, profile: { ...base.profile, [extra]: 'x' } });
    const p = await page.context().newPage();
    await freezeClock(p);
    await p.addInitScript((v) => localStorage.setItem('bentominder.state', v), bad);
    await p.goto('./');
    await expect(p.getByTestId('screen-corrupt-data'), extra).toBeVisible();
    expect(await p.evaluate(() => localStorage.getItem('bentominder.state'))).toBe(bad);
    await p.close();
  }
  // and through 「データを読み込む」 (the pages above share this origin's storage: start clean)
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.addInitScript((v) => localStorage.getItem('bentominder.state') === null && localStorage.setItem('bentominder.state', v), JSON.stringify(base));
  await page.goto('./#/settings');
  await page.reload(); // re-run the seeding init script on the cleared storage
  await page.getByTestId('data-import').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...base, profile: { ...base.profile, birthdate: '2021-04-02' } })) });
  await expect(page.getByTestId('data-import-error')).toBeVisible();
  await expect(page.getByTestId('dialog-import-data')).toHaveCount(0);
});

test('US-NF-03/AC2 BR-20 profile field limits are enforced by the contract: 21-char nickname, 201-char note, 31 likes, 4 themes in a store file are refused', async ({ page }) => {
  const base = JSON.parse(STATE_V1);
  await page.addInitScript((v) => localStorage.getItem('bentominder.state') === null && localStorage.setItem('bentominder.state', v), JSON.stringify(base));
  await page.goto('./#/settings');
  const variants: Record<string, object> = {
    nickname21: { nickname: 'a'.repeat(21) },
    note201: { note: 'a'.repeat(201) },
    likes31: { likedIds: Array.from({ length: 31 }, (_, i) => `ing-x${i}`) },
    themes4: { themeIds: ['theme-animals', 'theme-flowers', 'theme-cars', 'theme-sea'] },
    overlap: { likedIds: ['ing-chicken'], dislikedIds: ['ing-chicken'] },
    hasKnownEmpty: { allergyStatus: 'has-known', knownAllergenIds: [], excludedIngredientIds: [] },
  };
  for (const [name, patch] of Object.entries(variants)) {
    await page.getByTestId('data-import').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...base, profile: { ...base.profile, ...patch } })) });
    await expect(page.getByTestId('data-import-error'), name).toBeVisible();
    await expect(page.getByTestId('dialog-import-data'), name).toHaveCount(0);
  }
});

test('US-E3-01/AC3 「元のPDFを見る」 opens the uploaded file (or the source URL) in a new tab, safely', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  const link = page.getByTestId('review-open-pdf');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('target', '_blank');
  expect(await link.getAttribute('rel')).toContain('noopener');
  const href = (await link.getAttribute('href')) ?? '';
  expect(href).toMatch(/^blob:http:\/\/localhost:4173\//);
  // Not asserted: the viewer tab itself (headless Chromium has no PDF viewer; manual check in the report).
  const bytes = await page.evaluate(async (h) => (await (await fetch(h)).arrayBuffer()).byteLength, href);
  expect(bytes).toBeGreaterThan(1000); // the blob really holds the uploaded PDF
});

test('US-E2-04/AC4 US-E3-01/AC2 each uncertain field has a visible text label and icon, an accessible reason, and not colour alone', async ({ page }) => {
  await pinHand1(page);
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  const tags = page.locator('[data-testid^="review-tag-"]');
  expect(await tags.count()).toBe(3);
  for (let i = 0; i < 3; i++) {
    const tag = tags.nth(i);
    await expect(tag).toContainText('要確認');
    expect(await tag.locator('svg').count(), 'icon next to the label').toBeGreaterThan(0);
  }
  // the flagged input points at its reason (aria-describedby) so a screen reader reads why
  const described = await page.getByTestId('review-dish-2026-11-05-0').getAttribute('aria-describedby');
  expect(described).toMatch(/^reason-/);
  expect(await page.locator(`#${described}`).innerText()).toContain('要確認');
});

test('US-E10-02/AC1 US-E10-05 the stored root has schemaVersion 1 and exactly the contract top-level fields after a real journey', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page, { nickname: 'テスト' });
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  const s = await readStore(page);
  expect(s.schemaVersion).toBe(1);
  expect(Object.keys(s).sort()).toEqual(Object.keys(JSON.parse(STATE_V1)).sort());
  expect(Object.keys(s.decisions ?? {})).toHaveLength(0);
});
