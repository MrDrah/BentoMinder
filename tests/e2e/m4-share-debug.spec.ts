// M4 slice C, both projects (mobile 390 px Europe/Paris, desktop 1280 px America/Los_Angeles, en-US browser):
// the weekly share on the production build (US-E9-01, US-E9-02), the absence of any debug code from that build
// (US-E11-01/AC2) and the debug panel on a Vite development server started by this file (US-E11-01..03).
import { expect, test as base, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { expectNoSeriousAxe, seedStore } from './helpers.ts';

// The debug panel needs the development build, so this file serves it itself (one server per worker).
const test = base.extend<object, { dev: { url: string } }>({
  dev: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const port = 5300 + workerInfo.parallelIndex;
      const server: ViteDevServer = await createServer({ configFile: join(process.cwd(), 'vite.config.ts'), logLevel: 'silent', server: { port, strictPort: true, host: '127.0.0.1' } });
      await server.listen();
      await use({ url: `http://127.0.0.1:${port}/` });
      await server.close();
    },
    { scope: 'worker', timeout: 90_000 },
  ],
});

const HIMAWARI = 'rcp-delish-himawari-bento';
const SUNDAY = '2026-11-01T01:00:00Z'; // 10:00 JST, 2026-11-01

/** The November fixture with a real library recipe on 11-04 and a not-confirmed 11-06 (the AC1 example week). */
function state(options: { clearLog?: boolean; empty?: boolean } = {}): string {
  const s = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8'));
  const d = s.decisions['2026-11-04'];
  d.recipeId = HIMAWARI;
  d.recipeNameSnapshot = { ja: 'ひまわり弁当', en: 'Sunflower bento (himawari bento)' };
  d.recipeShortNameSnapshot = { ja: 'ひまわり弁当', en: 'Himawari' };
  const base = s.decisions['2026-11-05'];
  s.decisions['2026-11-06'] = { ...base, date: '2026-11-06', state: 'not-confirmed', reservationDoneExternally: false, history: [{ state: 'not-confirmed', at: base.decidedAt }] };
  if (options.clearLog === true) s.reminderLog = [];
  if (options.empty === true) s.decisions = {};
  return JSON.stringify(s);
}

async function open(page: Page, iso: string, hash = './', json: string = state()) {
  await page.clock.install({ time: new Date(iso) });
  await seedStore(page, json);
  await page.goto(hash);
}

const JA_AC1 = [
  '【BentoMinder】11月2日（月）〜11月8日（日）のお弁当予定',
  '11月4日（水）手作りお弁当：ひまわり弁当',
  '11月6日（金）未定',
  'ほかの日は給食（または給食なし）です。',
  '※給食の予約は園の方法で行ってください。',
].join('\n');

/** The browser has no share sheet and a clipboard that records, or refuses, what is written. */
async function fakePlatform(page: Page, mode: { share: 'none' | 'ok' | 'reject'; clipboard: 'ok' | 'blocked' }) {
  await page.addInitScript((m) => {
    const w = window as unknown as { __shared: string[]; __copied: string[] };
    w.__shared = [];
    w.__copied = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: m.share === 'none' ? undefined : (data: { text: string }) => (m.share === 'ok' ? (w.__shared.push(data.text), Promise.resolve()) : Promise.reject(new DOMException('x', 'AbortError'))),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => (m.clipboard === 'ok' ? (w.__copied.push(text), Promise.resolve()) : Promise.reject(new DOMException('x', 'NotAllowedError'))) },
    });
  }, mode);
}
const recorded = (page: Page, key: '__shared' | '__copied') => page.evaluate((k) => (window as unknown as Record<string, string[]>)[k], key);

test.describe('weekly share on the production build', () => {
  test('US-E9-01/AC1 US-E9-02/AC1 US-E9-02/AC2 the sheet previews the exact text, with the two notes and no child data', async ({ page }) => {
    await fakePlatform(page, { share: 'ok', clipboard: 'ok' });
    await open(page, SUNDAY);
    await page.getByTestId('share-button').click();
    const preview = page.getByTestId('share-preview');
    await expect(preview).toHaveText(JA_AC1);
    await expect(page.getByTestId('share-sheet')).toContainText('共有した時点の予定です。自動では同期されません。');
    await expect(page.getByTestId('share-privacy')).toHaveText('お子さまのプロフィールは含まれません。');
    const text = (await preview.textContent()) ?? '';
    for (const secret of ['はなちゃん', 'age-4-5', '野菜は細かく切ると食べます', 'ing-chicken', 'alg-shrimp', 'theme-animals']) expect(text).not.toContain(secret);
    expect(await recorded(page, '__shared')).toEqual([]); // nothing leaves the app until a tap
    await expectNoSeriousAxe(page, 'share sheet (ja)');
  });

  test('US-E9-01/AC1 US-E9-02/AC2 the English text and the sheet pass axe', async ({ page }) => {
    await fakePlatform(page, { share: 'ok', clipboard: 'ok' });
    await open(page, SUNDAY);
    await page.getByTestId('lang-toggle-en').click();
    await expect(page.getByTestId('share-button')).toHaveText("Share this week's plan");
    await page.getByTestId('share-button').click();
    await expect(page.getByTestId('share-preview')).toHaveText(
      [
        '[BentoMinder] Bento plan for Mon, Nov 2 – Sun, Nov 8',
        'Wed, Nov 4 Homemade bento: Sunflower bento (himawari bento)',
        'Fri, Nov 6 Not decided',
        'Other days: school lunch (or no school lunch).',
        '* Please arrange school lunch through your school as usual.',
      ].join('\n'),
    );
    await expect(page.getByTestId('share-sheet')).toContainText("This is the plan as of now. It doesn't update automatically.");
    await expectNoSeriousAxe(page, 'share sheet (en)');
  });

  test('US-E9-01/AC2 the native share sheet receives the text', async ({ page }) => {
    await fakePlatform(page, { share: 'ok', clipboard: 'ok' });
    await open(page, SUNDAY);
    await page.getByTestId('share-button').click();
    await page.getByTestId('share-native').click();
    expect(await recorded(page, '__shared')).toEqual([JA_AC1]);
    await expect(page.getByTestId('toast')).toHaveCount(0);
  });

  test('US-E9-01/AC2 a rejected share falls back to the clipboard and 「コピーしました」 shows', async ({ page }) => {
    await fakePlatform(page, { share: 'reject', clipboard: 'ok' });
    await open(page, SUNDAY);
    await page.getByTestId('share-button').click();
    await page.getByTestId('share-native').click();
    await expect(page.getByTestId('toast')).toHaveText('コピーしました');
    expect(await recorded(page, '__copied')).toEqual([JA_AC1]);
  });

  test('US-E9-01/AC2 without a share sheet only 「コピーする」 is offered and copies', async ({ page }) => {
    await fakePlatform(page, { share: 'none', clipboard: 'ok' });
    await open(page, SUNDAY);
    await page.getByTestId('share-button').click();
    await expect(page.getByTestId('share-native')).toHaveCount(0);
    await page.getByTestId('share-copy').click();
    await expect(page.getByTestId('toast')).toHaveText('コピーしました');
    expect(await recorded(page, '__copied')).toEqual([JA_AC1]);
  });

  test('US-E9-01/AC4 when the clipboard is blocked too, the message shows and the text is selected', async ({ page }) => {
    await fakePlatform(page, { share: 'reject', clipboard: 'blocked' });
    await open(page, SUNDAY);
    await page.getByTestId('share-button').click();
    await page.getByTestId('share-native').click();
    await expect(page.getByTestId('share-copy-failed')).toHaveText('コピーできませんでした。下の文章を選んでコピーしてください。');
    await expect(page.getByTestId('toast')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(JA_AC1);
    await page.mouse.move(0, 0); // axe must not run mid-way through a hover transition
    await page.waitForTimeout(400);
    await expectNoSeriousAxe(page, 'share sheet copy failed');
  });

  test('US-E9-01/AC3 an empty week says so (exact text, no others line)', async ({ page }) => {
    await fakePlatform(page, { share: 'none', clipboard: 'ok' });
    await open(page, SUNDAY, './', state({ empty: true }));
    await page.getByTestId('share-button').click();
    await expect(page.getByTestId('share-preview')).toHaveText(
      ['【BentoMinder】11月2日（月）〜11月8日（日）のお弁当予定', '今週は手作りお弁当の予定はありません。', '※給食の予約は園の方法で行ってください。'].join('\n'),
    );
  });
});

test.describe('no debug code on the production build', () => {
  test('US-E11-01/AC2 no debug UI renders, /debug is the not-found page and the built JS has no marker string', async ({ page }) => {
    await open(page, SUNDAY, './#/debug');
    await expect(page.getByTestId('screen-not-found')).toBeVisible();
    await expect(page.getByTestId('debug-open')).toHaveCount(0);
    await expect(page.getByTestId('debug-panel')).toHaveCount(0);
    await page.goto('./#/calendar');
    await expect(page.getByTestId('debug-open')).toHaveCount(0);
    expect(await page.locator('[data-marker], [data-debug], #bentominder-debug').count()).toBe(0);
    const html = await (await page.request.get('./')).text();
    const urls = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+\.js)"/g)].map((m) => m[1] as string);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const js = await (await page.request.get(url)).text();
      for (const marker of ['__BENTOMINDER_DEBUG__', 'BM_DEBUG_PANEL', 'debug-sample-menu', 'デバッグパネル', 'Simulate AI failures']) expect(js, `${url} ${marker}`).not.toContain(marker);
    }
  });
});

test.describe('debug panel on the development server', () => {
  test.setTimeout(90_000);

  test('US-E11-01/AC1 a 「Debug」 button is visible in a corner and opens the panel (axe)', async ({ page, dev }) => {
    await open(page, SUNDAY, dev.url);
    const button = page.getByTestId('debug-open');
    await expect(button).toHaveText('Debug');
    const box = await button.boundingBox();
    expect(box?.x ?? 999).toBeLessThan(40);
    await button.click();
    await expect(page.getByTestId('debug-panel')).toHaveAttribute('data-marker', 'BM_DEBUG_PANEL');
    await expectNoSeriousAxe(page, 'debug panel');
  });

  test('US-E11-02/AC1 US-E11-02/AC3 simulating 17:29 then +1 minute makes the day-before reminder due; 「実時間に戻す」 restores real time', async ({ page, dev }) => {
    await open(page, SUNDAY, dev.url, state({ clearLog: true }));
    await page.getByTestId('debug-open').click();
    await page.getByTestId('debug-clock-input').fill('2026-11-03T17:29');
    await page.getByTestId('debug-clock-set').click();
    await expect(page.getByTestId('debug-clock-simulated')).toBeVisible();
    await expect(page.getByTestId('debug-clock-status')).toContainText('2026-11-03 17:29');
    await expect(page.getByTestId('today-card')).toBeVisible();
    await expect(page.getByTestId('reminder-day-before-2026-11-04')).toHaveCount(0);
    await page.getByTestId('debug-clock-plus-minute').click();
    await expect(page.getByTestId('reminder-day-before-2026-11-04')).toBeVisible();
    await page.getByTestId('debug-clock-real').click();
    await expect(page.getByTestId('debug-clock-simulated')).toHaveCount(0);
    await expect(page.getByTestId('debug-clock-status')).toContainText('2026-11-01 10:0');
  });

  test('US-E11-02/AC2 triggering shows a debug-marked reminder and does not write the shown-reminders log', async ({ page, dev }) => {
    await open(page, SUNDAY, dev.url, state({ clearLog: true }));
    await page.getByTestId('debug-open').click();
    await page.getByTestId('debug-clock-input').fill('2026-11-03T12:00');
    await page.getByTestId('debug-clock-set').click();
    const log = () => page.evaluate(() => JSON.stringify(JSON.parse(window.localStorage.getItem('bentominder.state') ?? '{}').reminderLog));
    const before = await log();
    await page.getByTestId('debug-trigger-day-before').click();
    const shown = page.getByTestId('debug-triggered');
    await expect(shown).toContainText('デバッグ表示');
    await expect(shown.getByTestId('reminder-day-before-2026-11-04')).toBeVisible();
    await page.getByTestId('debug-trigger-weekly').click();
    await expect(page.getByTestId('debug-triggered').locator('[data-reminder-key^="weekly:"]')).toBeVisible();
    expect(await log()).toBe(before);
  });

  test('US-E11-03/AC1 US-E11-03/AC3 the sample menu opens the review without an AI call; the stored decisions are listed and can be cleared', async ({ page, dev }) => {
    const calls: string[] = [];
    page.on('request', (r) => r.url().includes('/api/') && calls.push(r.url()));
    await open(page, SUNDAY, dev.url);
    await page.getByTestId('debug-open').click();
    await expect(page.getByTestId('debug-decisions')).toContainText('2026-11-04');
    await page.getByTestId('debug-sample-menu').click();
    await expect(page).toHaveURL(/#\/review\/2026-11$/);
    await expect(page.getByTestId('screen-review-page')).toBeVisible();
    expect(calls).toEqual([]);
    await page.getByTestId('debug-clear').click();
    await page.getByTestId('dialog-debug-clear-confirm').click();
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('bentominder.state'))).toBeNull();
  });

  test('US-E11-03/AC2 the panel selects a failure mode and shows the AI call count of this month (the mode-to-result mapping is unit-tested)', async ({ page, dev }) => {
    await open(page, SUNDAY, dev.url);
    await page.getByTestId('debug-open').click();
    await page.getByTestId('debug-ai-mode').selectOption('rate-limited');
    await expect(page.getByTestId('debug-ai-mode')).toHaveValue('rate-limited');
    await expect(page.getByTestId('debug-ai-usage')).toContainText(/AI呼び出し：\d+回/);
  });
});
