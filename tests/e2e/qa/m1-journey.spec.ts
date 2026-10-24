// QA M1 journey: first launch -> profile (boundaries, hostile input) -> upload FX-01 -> review ->
// confirm -> calendar -> reload. Runs in both projects (Asia/Tokyo ja-JP, Pacific/Honolulu en-US).
import { expect, test } from '@playwright/test';
import { axeSerious, FX01, fillProfile, freezeClock, pinHand1, readStore, recordAll, requestText, trackProviderCalls } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

test('US-E8-01/AC1 BR-23 first launch is Japanese whatever the browser language, onboarding step 1', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  await expect(page.getByTestId('stepper')).toContainText('ステップ 1 / 3');
});

test('US-E1-02/AC4 US-E1-03/AC3 US-E1-03/AC4 required fields block 次へ and store nothing', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('age-error')).toContainText('年齢を選んでください');
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  expect(await readStore(page)).toBeNull();
  // focus goes to the age control (AC4)
  await expect(page.getByTestId('group-age').locator(':focus')).toHaveCount(1);
  await page.getByTestId('chip-age-age-4-5').click();
  // allergy: three options, none preselected (US-E1-03/AC3)
  await expect(page.getByTestId('group-allergy').locator('input[type=radio]')).toHaveCount(3);
  await expect(page.getByTestId('group-allergy').locator('input[type=radio]:checked')).toHaveCount(0);
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('allergy-error')).toBeVisible();
  expect(await readStore(page)).toBeNull();
  // has-known with nothing selected (AC4)
  await page.getByTestId('radio-allergy-has-known').check();
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('allergy-error')).toContainText('アレルギーの食材を1つ以上選んでください');
  expect(await readStore(page)).toBeNull();
});

test('US-E1-03/AC1 US-E1-03/AC2 US-E1-03/AC6 known allergens + other ingredient stored; no safety claim on the screen', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-has-known').check();
  await page.getByTestId('chip-allergen-alg-shrimp').click();
  await page.getByTestId('chip-allergen-alg-egg').click();
  await page.getByTestId('picker-other-foods-search').fill('トマト');
  await page.getByTestId('picker-other-foods-option-ing-tomato').click();
  const text = await page.getByTestId('screen-onboarding').innerText();
  for (const bad of ['安全です', 'アレルギー対応済み', '安心して']) expect(text).not.toContain(bad);
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  const s = await readStore(page);
  expect(s.profile).toMatchObject({ allergyStatus: 'has-known', knownAllergenIds: ['alg-shrimp', 'alg-egg'], excludedIngredientIds: ['ing-tomato'] });
});

test('US-E1-03/AC5 US-E1-02/AC1 allergy "unknown" is stored with a banner, minimal profile has no nickname', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-unknown').check();
  await expect(page.getByTestId('banner-allergy-unknown')).toBeVisible();
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  const s = await readStore(page);
  expect(s.profile.allergyStatus).toBe('unknown');
  expect(s.profile.ageRange).toBe('age-4-5');
  expect(s.profile.nickname).toBeUndefined();
  expect(s.profile.likedIds).toEqual([]);
  expect(s.profile.dislikedIds).toEqual([]);
  expect(s.profile.diet).toEqual([]);
  expect(s.profile.themeIds).toEqual([]);
});

test('US-E1-02/AC5 US-E1-02/AC7 nickname max 20, 21st dropped, spaces-only absent, note max 200', async ({ page }) => {
  await page.goto('./');
  const nick = page.getByTestId('input-nickname');
  await nick.fill('あ'.repeat(25));
  await expect(nick).toHaveValue('あ'.repeat(20));
  await nick.fill('a'.repeat(21));
  await expect(nick).toHaveValue('a'.repeat(20));
  await nick.fill('     ');
  const note = page.getByTestId('input-note');
  await note.fill('x'.repeat(250));
  await expect(note).toHaveValue('x'.repeat(200));
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  const s = await readStore(page);
  expect(s.profile.nickname).toBeUndefined();
  expect([...s.profile.note].length).toBe(200);
});

test('US-E1-02/AC5 BR-20 emoji nickname: surrogate pairs counted as characters, never split', async ({ page }) => {
  await page.goto('./');
  const nick = page.getByTestId('input-nickname');
  await nick.fill('😀'.repeat(21));
  expect([...(await nick.inputValue())].length).toBe(20);
  expect(/[�-�](?![�-�])/.test(await nick.inputValue())).toBe(false);
});

// D-M1-01 (P4): clamping at 20 code points can leave a dangling zero-width joiner.
test.fixme('US-E1-02/AC5 BR-20 D-M1-01 ZWJ emoji sequence is not cut mid-sequence', async ({ page }) => {
  await page.goto('./');
  const nick = page.getByTestId('input-nickname');
  await nick.fill('👨‍👩‍👧‍👦'.repeat(5));
  const v = await nick.inputValue();
  expect(v.length).toBeGreaterThan(0);
  expect(v.endsWith('‍')).toBe(false);
  expect(/[\ud800-\udbff](?![\udc00-\udfff])/.test(v)).toBe(false);
});

test('US-E1-02/AC7 BR-20 hostile input (<script>, markup, very long) is stored and rendered as inert text', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  await page.goto('./');
  const evil = '<script>alert(1)</script>';
  await page.getByTestId('input-nickname').fill(evil);
  await page.getByTestId('input-note').fill('<img src=x onerror=alert(2)>' + '😀'.repeat(300));
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  await page.goto('./#/settings');
  await page.waitForTimeout(500);
  expect(dialogs).toEqual([]);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  const s = await readStore(page);
  expect(s.profile.nickname).toBe(evil.slice(0, 20));
});

test('US-E1-02/AC2 US-E1-02/AC3 US-E1-04/AC3 likes/dislikes move between lists, themes max 3', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('radio-allergy-none-known').check();
  await page.getByTestId('picker-dislikes-option-ing-green-pepper').click();
  await expect(page.getByTestId('picker-dislikes-chip-ing-green-pepper')).toBeVisible();
  await page.getByTestId('picker-likes-option-ing-green-pepper').click();
  await expect(page.getByTestId('picker-dislikes-chip-ing-green-pepper')).toHaveCount(0);
  await expect(page.getByTestId('picker-likes-chip-ing-green-pepper')).toBeVisible();
  await expect(page.getByTestId('profile-notice')).not.toBeEmpty();
  const themes = page.getByTestId('group-theme').locator('button');
  await expect(themes).toHaveCount(8);
  for (let i = 0; i < 3; i++) await themes.nth(i).click();
  await themes.nth(3).click({ force: true });
  await expect(page.getByTestId('theme-limit')).toContainText('テーマは3つまで選べます');
  await expect(page.getByTestId('group-theme').locator('[aria-pressed=true]')).toHaveCount(3);
  await page.getByTestId('ob-next').click();
  const s = await readStore(page);
  expect(s.profile.likedIds).toEqual(['ing-green-pepper']);
  expect(s.profile.dislikedIds).toEqual([]);
  expect(s.profile.themeIds).toHaveLength(3);
});

test('US-E1-02/AC6 BR-20 no field for birthdate, gender, height, weight, photo, full name or school', async ({ page }) => {
  await page.goto('./');
  const html = (await page.getByTestId('ob-step-1').innerText()) + (await page.locator('form').innerHTML());
  for (const w of ['生年月日', '誕生日', '性別', '身長', '体重', '写真', '氏名', '学校名', '園名', 'birth', 'gender', 'height', 'weight', 'photo', 'school']) {
    expect(html.toLowerCase(), w).not.toContain(w.toLowerCase());
  }
  expect(await page.locator('input[type=file], input[type=date]').count()).toBe(0);
});

test('US-E1-01/AC3 US-E1-01/AC4 reload on step 2 resumes at step 2 with profile kept', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page, { nickname: 'ゆうと' });
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  expect((await readStore(page)).profile.nickname).toBe('ゆうと');
});

test('US-E1-01/AC2 US-E2-03/AC1 US-E2-08/AC1 US-E3-01/AC1 US-E3-01/AC2 US-E3-02/AC1 US-E3-03/AC1 US-E3-03/AC2 US-E3-03/AC4 US-E10-01/AC1 full journey with FX-01 upload', async ({ page }) => {
  const reqs = recordAll(page);
  const calls = trackProviderCalls(page);
  await pinHand1(page);
  await page.goto('./');
  await fillProfile(page, { nickname: 'はなちゃん', likes: ['ing-chicken'] });
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  await expect(page.getByTestId('import-month')).toHaveValue('2026-11');
  const options = await page.getByTestId('import-month').locator('option').allInnerTexts();
  expect(options).toEqual(['2026年10月', '2026年11月']);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  // consent first: no extract request before 同意して読み取る (US-E2-08/AC1)
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  expect(calls.extractRequests).toBe(0);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  expect(calls.providerCalls).toBeLessThanOrEqual(2);

  // every weekday of Nov 2026 listed, in date order
  const days = page.locator('[data-testid^="review-day-2026-"]');
  const ids = await days.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('review-day-', '')));
  expect([...ids].sort()).toEqual(ids);
  const dates = new Set(ids);
  for (let d = 1; d <= 30; d++) {
    const wd = new Date(Date.UTC(2026, 10, d)).getUTCDay();
    if (wd >= 1 && wd <= 5) expect(dates.has(`2026-11-${String(d).padStart(2, '0')}`), `weekday 2026-11-${d} listed`).toBe(true);
  }
  await expect(page.getByTestId('review-summary')).toContainText('確認が必要な項目：3件');
  expect(await page.locator('[data-testid^="review-tag-"]').count()).toBe(3);
  await expect(page.locator('[data-testid^="review-tag-"]').first()).toContainText('要確認');
  await axeSerious(page, 'review');

  // edit one dish -> parent-edited; accept another with 「このままにする」
  await page.getByTestId('review-dish-2026-11-05-0').fill('さばのみそ煮');
  await expect(page.getByTestId('review-dish-2026-11-05-0')).toHaveAttribute('data-verification', 'parent-edited');
  await expect(page.getByTestId('review-summary')).toContainText('確認が必要な項目：2件');
  await page.getByRole('button', { name: 'このままにする' }).first().click();
  await expect(page.getByTestId('review-summary')).toContainText('確認が必要な項目：1件');

  await page.getByTestId('review-confirm').click();
  await expect(page.getByTestId('dialog-uncertain')).toContainText('確認が必要な項目が1件あります。このまま確定しますか？');
  await page.getByTestId('dialog-uncertain-cancel').click();
  expect((await readStore(page)).menus['2026-11'].confirmed ?? null).toBeNull();
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');

  const s = await readStore(page);
  const cm = s.menus['2026-11'].confirmed;
  expect(cm.version).toBe(1);
  const statuses = cm.days.flatMap((d: any) => d.items.map((i: any) => i.verification.status));
  expect(statuses).toContain('parent-edited');
  expect(statuses).toContain('uncertain-accepted');
  expect(cm.confirmedAt).toMatch(/\+09:00$/);

  await page.reload();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月'); // the URL keeps #/calendar/2026-11
  await page.goto('./#/');
  await expect(page.getByTestId('cal-title')).toHaveText('2026年10月'); // current Tokyo month
  await page.getByTestId('cal-next').click();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  await expect(page.getByTestId('menu-card-missing')).toHaveCount(0);
  expect((await readStore(page)).menus['2026-11'].confirmed.version).toBe(1);

  for (const r of reqs) {
    const t = requestText(r);
    for (const v of ['はなちゃん', 'ing-chicken', 'age-4-5', 'none-known', encodeURIComponent('はなちゃん')]) expect(t, `${r.url()} carries ${v}`).not.toContain(v);
  }
});

test('US-E1-01/AC5 skipping the menu gives an empty calendar with the generic empty card', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-later').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('menu-card-missing')).toBeVisible();
  await expect(page.getByTestId('menu-card-missing')).toContainText('今月の献立がまだありません');
  await expect(page.getByTestId('menu-card-missing')).toContainText('献立を取り込む');
  await axeSerious(page, 'calendar empty');
});

test('US-E3-03/AC3 US-E3-03/AC5 leaving the review asks first; 中断する keeps nothing confirmed', async ({ page }) => {
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await page.getByTestId('review-dish-2026-11-05-0').fill('編集した');
  await page.goBack();
  await expect(page.getByTestId('dialog-leave-review')).toContainText('確認を中断しますか？');
  await page.getByTestId('dialog-leave-review-cancel').click();
  await expect(page.getByTestId('review-dish-2026-11-05-0')).toHaveValue('編集した');
  await page.goBack();
  await page.getByTestId('dialog-leave-review-confirm').click();
  const s = await readStore(page);
  expect(s.menus['2026-11'].confirmed ?? null).toBeNull();
});
