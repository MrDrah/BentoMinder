# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: nf04-resilience.spec.ts >> US-NF-04/AC3 D-H4-01 an extraction request that hangs is abandoned after 60 s and shown as unavailable
- Location: tests\e2e\qa\nf04-resilience.spec.ts:83:6

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('import-error')
Expected substring: "読み取りサービスに接続できませんでした"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByTestId('import-error') with timeout 5000ms
  - waiting for getByTestId('import-error')

```

```yaml
- link "本文へ移動":
  - /url: "#main"
- banner:
  - link "お子さまのことに戻る":
    - /url: "#/onboarding/1"
  - heading "献立の取り込み" [level=1]
  - radiogroup "表示言語":
    - radio "日本語" [checked]
    - radio "EN"
  - link "設定":
    - /url: "#/settings?from=2"
  - list "ステップ 2 / 3":
    - listitem: お子さまのこと 完了
    - listitem: ステップ 2 / 3献立の取り込み 入力中
    - listitem: 献立の確認
- main:
  - status: 献立を読み取っています…
  - paragraph: 1分ほどかかることがあります。このままお待ちください。
  - button "中止する"
- status
```

# Test source

```ts
  1  | // QA: US-NF-04 AC1 (everything except import works with the AI adapter down) and AC3 (60 s extraction timeout).
  2  | // "Down" = every /api/** request is aborted at the network layer. Run with playwright.h4.config.ts.
  3  | import { expect, test, type Page } from '@playwright/test';
  4  | import { readFileSync } from 'node:fs';
  5  | import { join } from 'node:path';
  6  | import { FX01, fillProfile, readStore } from './helpers.ts';
  7  | 
  8  | const jst = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+09:00`);
  9  | const cell = (page: Page, d: string) => page.getByTestId(`cal-cell-${d}`);
  10 | 
  11 | /** The November fixture with a real library recipe planned on 11-04 (as the M4 suites do). */
  12 | function state(): string {
  13 |   const s = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8'));
  14 |   const d = s.decisions['2026-11-04'];
  15 |   d.recipeId = 'rcp-delish-himawari-bento';
  16 |   d.recipeNameSnapshot = { ja: 'ひまわり弁当', en: 'Sunflower bento (himawari bento)' };
  17 |   d.recipeShortNameSnapshot = { ja: 'ひまわり弁当', en: 'Himawari' };
  18 |   return JSON.stringify(s);
  19 | }
  20 | 
  21 | async function down(page: Page): Promise<string[]> {
  22 |   const blocked: string[] = [];
  23 |   await page.route('**/api/**', (route) => {
  24 |     blocked.push(route.request().url());
  25 |     return route.abort('connectionrefused');
  26 |   });
  27 |   return blocked;
  28 | }
  29 | 
  30 | test('US-NF-04/AC1 with the adapter down: calendar, assessment, decisions, recommendations, reminders, share and export all work', async ({ page }) => {
  31 |   const blocked = await down(page);
  32 |   await page.clock.install({ time: new Date(jst('2026-11-03', '17:29')) });
  33 |   await page.addInitScript((s) => window.localStorage.setItem('bentominder.state', s), state());
  34 |   await page.goto('./');
  35 | 
  36 |   // calendar and assessment
  37 |   await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  38 |   await expect(cell(page, '2026-11-12')).toHaveAttribute('data-assessment', 'low-preference');
  39 | 
  40 |   // reminders (day-before fires at 17:30 JST)
  41 |   await page.clock.fastForward('02:00');
  42 |   await expect(page.getByTestId('reminder-day-before-2026-11-04')).toContainText('明日は手作りお弁当の日！レシピを確認しましょう。');
  43 | 
  44 |   // recommendations and a decision
  45 |   await cell(page, '2026-11-12').getByRole('button').click();
  46 |   await expect(page.getByTestId('day-sheet')).toBeVisible();
  47 |   await page.getByTestId('day-action-bento').click();
  48 |   await expect(page.getByTestId('recs-list').locator('[data-recipe-id]')).toHaveCount(3);
  49 |   await page.getByTestId('rec-card-0-confirm').click();
  50 |   await expect(cell(page, '2026-11-12')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  51 |   expect((await readStore(page)).decisions['2026-11-12'].state).toBe('homemade-bento-planned');
  52 | 
  53 |   // sharing
  54 |   if (await page.getByTestId('day-sheet-close').isVisible().catch(() => false)) await page.getByTestId('day-sheet-close').click();
  55 |   await page.getByTestId('share-button').click();
  56 |   await expect(page.getByTestId('share-preview')).toContainText('【BentoMinder】');
  57 |   await page.keyboard.press('Escape');
  58 | 
  59 |   // export
  60 |   await page.goto('./#/settings');
  61 |   const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('data-export').click()]);
  62 |   expect(download.suggestedFilename()).toMatch(/^bentominder-export-/);
  63 | 
  64 |   // the app never needed the adapter for any of this
  65 |   expect(blocked.filter((u) => u.includes('/api/menu/extract'))).toEqual([]);
  66 | });
  67 | 
  68 | test('US-NF-04/AC1 with the adapter down, importing says the service is unavailable, offers the other paths and leaves stored data alone', async ({ page }) => {
  69 |   await down(page);
  70 |   await page.goto('./');
  71 |   await fillProfile(page);
  72 |   await expect(page.getByTestId('ob-step-2')).toBeVisible();
  73 |   await page.getByTestId('import-upload').setInputFiles(FX01);
  74 |   await page.getByTestId('consent-accept').click();
  75 |   await expect(page.getByTestId('import-error')).toContainText('読み取りサービスに接続できませんでした');
  76 |   await expect(page.getByTestId('import-manual')).toBeVisible();
  77 |   expect((await readStore(page)).menus).toEqual({});
  78 | });
  79 | 
  80 | // D-H4-01: no 60 s extraction timeout exists on the client (the web extractor only forwards the caller's signal; the import
  81 | // screen sets no timer) or in the server transport. A hanging adapter leaves the import spinning forever.
  82 | // Expected failure (test.fail) until it is built; it turns red when fixed so the marker is removed then.
  83 | test.fail('US-NF-04/AC3 D-H4-01 an extraction request that hangs is abandoned after 60 s and shown as unavailable', async ({ page }) => {
  84 |   await page.clock.install({ time: new Date(jst('2026-10-28', '10:00')) });
  85 |   await page.route('**/api/menu/extract**', () => new Promise(() => undefined)); // never answers
  86 |   await page.goto('./');
  87 |   await fillProfile(page);
  88 |   await expect(page.getByTestId('ob-step-2')).toBeVisible();
  89 |   await page.getByTestId('import-upload').setInputFiles(FX01);
  90 |   await page.getByTestId('consent-accept').click();
  91 |   await expect(page.getByTestId('import-progress')).toBeVisible();
  92 |   await page.clock.fastForward(59_000);
  93 |   await expect(page.getByTestId('import-error')).toHaveCount(0); // not yet
  94 |   await page.clock.fastForward(2_000); // 61 s in
> 95 |   await expect(page.getByTestId('import-error')).toContainText('読み取りサービスに接続できませんでした', { timeout: 5_000 });
     |                                                  ^ Error: expect(locator).toContainText(expected) failed
  96 | });
  97 | 
```