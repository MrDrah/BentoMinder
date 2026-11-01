// QA M5, US-E2-08 (consent before the first AI extraction), derived from the story ACs and design/copy.md
// (consent.*). Every request to /api/menu/extract is counted with page.on('request') on all origins.
import { expect, test, type Page } from '@playwright/test';
import { FX01, NOW, STATE_V1, type Json } from './helpers.ts';

function seed(page: Page, patch: (s: Json) => void) {
  const s: Json = JSON.parse(STATE_V1);
  s.menus = {};
  s.overrides = {};
  s.decisions = {};
  s.reminderLog = [];
  s.aiUsage = {};
  // The store must not be newer than the frozen clock (10:00 JST on 10-28), or a save is refused.
  s.createdAt = s.updatedAt = '2026-10-01T09:00:00+09:00';
  s.settings.createdAt = s.settings.updatedAt = '2026-10-01T09:00:00+09:00';
  patch(s);
  return page.addInitScript((v) => {
    if (window.localStorage.getItem('bentominder.state') === null) window.localStorage.setItem('bentominder.state', v);
  }, JSON.stringify(s));
}
function counter(page: Page) {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/menu/extract')) seen.push(r.method());
  });
  return seen;
}
const readStore = (page: Page): Promise<Json> => page.evaluate(() => JSON.parse(localStorage.getItem('bentominder.state') ?? 'null'));

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test('US-E2-08/AC1 no consent stored: the notice precedes any /api/menu/extract request; only accepting sends one', async ({ page }) => {
  const seen = counter(page);
  await seed(page, (s) => (s.consent = null));
  await page.goto('./#/import');
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  await page.waitForTimeout(800);
  expect(seen).toHaveLength(0);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  expect(seen).toEqual(['POST']);
});

test('US-E2-08/AC2 declining sends 0 requests, stores no consent, keeps manual entry, and the next import asks again', async ({ page }) => {
  const seen = counter(page);
  await seed(page, (s) => (s.consent = null));
  await page.goto('./#/import');
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-decline').click();
  await expect(page.getByTestId('consent-dialog')).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(seen).toHaveLength(0);
  await expect(page.getByTestId('import-manual')).toBeVisible();
  const s = await readStore(page);
  expect(s?.consent ?? null).toBeNull();
  expect(s?.aiUsage ?? {}).toEqual({});
  await page.getByTestId('import-upload').setInputFiles([]);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  expect(seen).toHaveLength(0);
});

test('US-E2-08/AC2 keyboard: Escape on the notice never sends a request', async ({ page }) => {
  const seen = counter(page);
  await seed(page, (s) => (s.consent = null));
  await page.goto('./#/import');
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  expect(seen).toHaveLength(0);
});

test('US-E2-08/AC3 consent stored for the current notice version: no notice and one request; a stored version 0 is not valid data (never silently accepted)', async ({ page, browser }) => {
  const seen = counter(page);
  await seed(page, (s) => (s.consent = { aiNoticeVersion: 1, consentedAt: '2026-10-28T20:19:00+09:00' }));
  await page.goto('./#/import');
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await expect(page.getByTestId('consent-dialog')).toHaveCount(0);
  expect(seen).toEqual(['POST']);

  // The notice version is an integer >= 1 (contract section 3.1): 0 is refused as corrupt data, and no request is made.
  const ctx = await browser.newContext({ baseURL: 'http://localhost:4173', locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  const page2 = await ctx.newPage();
  await page2.clock.setFixedTime(NOW);
  const seen2 = counter(page2);
  await seed(page2, (s) => (s.consent = { aiNoticeVersion: 0, consentedAt: '2026-10-01T09:00:00+09:00' }));
  await page2.goto('./#/import');
  await expect(page2.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page2.getByTestId('import-upload').count()).toBe(0);
  expect(seen2).toHaveLength(0);
  await ctx.close();
});

// A bump to notice version 2 cannot be driven in the e2e (the build ships version 1): it is checked at the
// domain level in tests/unit/domain/qa/m5-consent.test.ts (US-E2-08/AC3).

// AC4 facts 1-6 as keyword checks on the rendered text (copy.md consent.p1..p4), per language.
const FACTS: Record<'ja' | 'en', [string, RegExp][]> = {
  ja: [
    ['1 only the public menu PDF goes to Google Gemini', /献立表のPDF[\s\S]*Google[\s\S]*Gemini[\s\S]*公開している献立表PDFだけ/],
    ['2 nothing about the child or the family plans is sent', /お子さまの名前・年齢・アレルギー・好み[\s\S]*ご家族の予定は送りません/],
    ['3 free tier: Google may use content and result to improve products', /無料枠[\s\S]*Googleのサービス改善に使われ/],
    ['4 human reviewers may read', /担当者が内容を読む場合があります/],
    ['5 for parents, 18 or older', /保護者向け[\s\S]*18歳以上/],
    ['6 use in Japan', /日本国内/],
  ],
  en: [
    ['1 only the public menu PDF goes to Google Gemini', /menu PDF[\s\S]*Google[\s\S]*Gemini[\s\S]*only the public menu PDF/i],
    ['2 nothing about the child or the family plans is sent', /Nothing about your child[\s\S]*none of your family's plans is sent/i],
    ['3 free tier: Google may use content and result to improve products', /free tier[\s\S]*Google may use what is sent and the result to improve its products/i],
    ['4 human reviewers may read', /human reviewers may read/i],
    ['5 for parents, 18 or older', /for parents[\s\S]*18 or older/i],
    ['6 use in Japan', /in Japan/i],
  ],
};
const FORBIDDEN: Record<'ja' | 'en', RegExp> = {
  ja: /保存されません|削除されます|使われません|プライベート|安全に|機密|完全に/,
  en: /not (be )?(stored|used|retained|kept|shared)|will be deleted|is deleted|private|confidential|secure|never stored/i,
};

for (const lang of ['ja', 'en'] as const) {
  test(`US-E2-08/AC4 the notice states every free-tier fact in ${lang}, links the provider terms, and makes no privacy-guarantee claim`, async ({ page }) => {
    await seed(page, (s) => {
      s.consent = null;
      s.settings.language = lang;
    });
    await page.goto('./#/import');
    await page.getByTestId('import-upload').setInputFiles(FX01);
    const dialog = page.getByTestId('consent-dialog');
    await expect(dialog).toBeVisible();
    const text = (await dialog.innerText()).replace(/\s+/g, ' ');
    for (const [name, re] of FACTS[lang]) expect(text, `fact ${name}`).toMatch(re);
    expect(text).not.toMatch(FORBIDDEN[lang]);
    await expect(dialog.locator('a[href="https://ai.google.dev/gemini-api/terms"]')).toHaveCount(1);
    await expect(page.getByTestId('consent-accept')).toHaveText(lang === 'ja' ? '同意して読み取る' : 'Agree and read');
    await expect(page.getByTestId('consent-decline')).toHaveText(lang === 'ja' ? '同意しない' : "Don't agree");
  });
}
