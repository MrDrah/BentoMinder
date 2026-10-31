// QA: US-NF-01 AC1 (approximation) and AC2 on the November fixture, production build.
// AC1 is a Lighthouse requirement; Lighthouse is not installed and no dependency may be added, so this approximates it with
// Chromium CDP throttling (4x CPU, 1.6 Mbps / 150 ms RTT = Lighthouse "slow 4G") and in-page LCP and long-task (TBT) entries.
// It does NOT replace a Lighthouse run: listed as an open item in the H4 report.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const STATE = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');
const seed = async (page: Page) => {
  await page.addInitScript((s) => window.localStorage.setItem('bentominder.state', s), STATE);
};

async function toNovember(page: Page) {
  // real clock (timings must not run on a faked one): the calendar opens on the real current month (October 2026), so step to November
  if ((await page.getByTestId('cal-title').innerText()) !== '2026年11月') await page.getByTestId('cal-next').click();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
}

/** Milliseconds from the action to the first frame that shows `ready` (two animation frames after it exists). */
async function timed(page: Page, action: string, ready: string, text = ''): Promise<number> {
  return page.evaluate(
    ({ action, ready, text }) =>
      new Promise<number>((resolve) => {
        const t0 = performance.now();
        (document.querySelector(action) as HTMLElement).click();
        const poll = () => {
          const el = document.querySelector(ready);
          if (el && (text === '' || (el.textContent ?? '').includes(text))) requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
          else requestAnimationFrame(poll);
        };
        poll();
      }),
    { action, ready, text },
  );
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] as number;

test('US-NF-01/AC2 switching months renders in <= 100 ms', async ({ page }) => {
  await seed(page);
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  const runs: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const before = await page.getByTestId('cal-title').innerText();
    // ready = the title no longer equals the previous month
    runs.push(
      await page.evaluate(
        (prev) =>
          new Promise<number>((resolve) => {
            const t0 = performance.now();
            (document.querySelector('[data-testid="cal-next"]') as HTMLElement).click();
            const poll = () => {
              if (document.querySelector('[data-testid="cal-title"]')?.textContent !== prev) requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
              else requestAnimationFrame(poll);
            };
            poll();
          }),
        before,
      ),
    );
  }
  console.log(`month switch ms: ${runs.map((x) => x.toFixed(0)).join(',')}`);
  expect(median(runs)).toBeLessThanOrEqual(100);
});

test('US-NF-01/AC2 opening a day sheet renders in <= 100 ms', async ({ page }) => {
  await seed(page);
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  await toNovember(page);
  const runs: number[] = [];
  for (const d of [4, 5, 6, 9, 10]) {
    // a different day each time: on desktop the sheet stays open beside the grid
    runs.push(await timed(page, `[data-testid="cal-cell-2026-11-${String(d).padStart(2, '0')}"] button`, '[data-testid="day-sheet-title"]', `11月${d}日`));
  }
  console.log(`day sheet ms: ${runs.map((x) => x.toFixed(0)).join(',')}`);
  expect(median(runs)).toBeLessThanOrEqual(100);
});

test('US-NF-01/AC2 showing 3 recommendations renders in <= 100 ms', async ({ page }) => {
  await seed(page);
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  await toNovember(page);
  const runs: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    await page.getByTestId('cal-cell-2026-11-12').getByRole('button').click();
    await expect(page.getByTestId('day-sheet')).toBeVisible();
    runs.push(await timed(page, '[data-testid="day-action-bento"]', '[data-testid="recs-list"] [data-recipe-id]:nth-child(3)'));
    await expect(page.getByTestId('recs-list').locator('[data-recipe-id]')).toHaveCount(3);
    await page.goto('./#/calendar/2026-11');
    await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  }
  console.log(`3 recommendations ms: ${runs.map((x) => x.toFixed(0)).join(',')}`);
  expect(median(runs)).toBeLessThanOrEqual(100);
});

test('US-NF-01/AC1 approximation: calendar with the November fixture under slow-4G and 4x CPU has LCP <= 2.5 s and TBT <= 200 ms', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP throttling exists in Chromium only');
  await seed(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number; __fcp: number; __long: { start: number; dur: number }[] };
    w.__lcp = 0;
    w.__fcp = 0;
    w.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => e.name === 'first-contentful-paint' && (w.__fcp = e.startTime))).observe({ type: 'paint', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__long.push({ start: e.startTime, dur: e.duration }))).observe({ type: 'longtask', buffered: true });
  });
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.getByTestId('cal-grid')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3000);
  const m = await page.evaluate(() => {
    const w = window as unknown as { __lcp: number; __fcp: number; __long: { start: number; dur: number }[] };
    return { lcp: w.__lcp, fcp: w.__fcp, tbt: w.__long.filter((t) => t.start >= w.__fcp).reduce((a, t) => a + Math.max(0, t.dur - 50), 0) };
  });
  console.log(`LCP ${m.lcp.toFixed(0)} ms, FCP ${m.fcp.toFixed(0)} ms, TBT ${m.tbt.toFixed(0)} ms`);
  expect(m.lcp).toBeGreaterThan(0);
  expect(m.lcp).toBeLessThanOrEqual(2500);
  expect(m.tbt).toBeLessThanOrEqual(200);
});
