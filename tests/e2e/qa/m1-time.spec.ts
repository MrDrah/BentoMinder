// QA M1 / BR-15: "today" and the month are Asia/Tokyo whatever the device timezone (projects run in
// Asia/Tokyo and Pacific/Honolulu: 19 hours apart, so the date differs for part of every day).
import { expect, test } from '@playwright/test';
import { fillProfile } from './helpers.ts';

const CASES: { iso: string; title: string; jst: string }[] = [
  { iso: '2026-10-31T14:59:00Z', title: '2026年10月', jst: '2026-10-31' }, // 23:59 JST, 04:59 Honolulu (Oct 31)
  { iso: '2026-10-31T15:00:00Z', title: '2026年11月', jst: '2026-11-01' }, // 00:00 JST, Honolulu still Oct 31
  { iso: '2026-12-31T15:00:00Z', title: '2027年1月', jst: '2027-01-01' }, // year boundary in JST only
  { iso: '2026-11-01T09:00:00Z', title: '2026年11月', jst: '2026-11-01' }, // 18:00 JST; Honolulu 23:00 on Oct 31
  { iso: '2028-02-28T15:00:00Z', title: '2028年2月', jst: '2028-02-29' }, // leap day in JST
];

for (const c of CASES) {
  test(`BR-15 US-E5-01/AC1 the calendar opens on the current Tokyo month at ${c.iso} (JST ${c.jst}), whatever the device timezone`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(c.iso));
    await page.goto('./');
    await fillProfile(page);
    await page.getByTestId('import-later').click();
    await expect(page.getByTestId('cal-title')).toHaveText(c.title);
    const today = page.getByTestId(`cal-cell-${c.jst}`);
    await expect(today).toHaveCount(1);
    // today's cell is marked in some accessible way (aria-current) or class
    const marked = await today.evaluate((el) => el.getAttribute('aria-current') !== null || !!el.querySelector('[aria-current]') || /today/.test(el.className + el.innerHTML));
    expect(marked, `today (${c.jst}) not marked`).toBe(true);
    // no other cell is marked as today
    expect(await page.locator('[data-testid^="cal-cell-"][aria-current], [data-testid^="cal-cell-"] [aria-current]').count()).toBeLessThanOrEqual(1);
  });
}

test('BR-15 US-E2-01/AC5 BR-27 the import month preselection follows the Tokyo date, not the device date', async ({ page }) => {
  // 2026-11-19 23:59 JST = 2026-11-19 04:59 Honolulu -> this month; one minute later 11-20 JST (Honolulu still 11-19) -> next month
  for (const [iso, expected] of [
    ['2026-11-19T14:59:00Z', '2026-11'],
    ['2026-11-19T15:00:00Z', '2026-12'],
  ] as const) {
    await page.clock.setFixedTime(new Date(iso));
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.goto('./');
    await fillProfile(page);
    await expect(page.getByTestId('import-month')).toHaveValue(expected);
  }
});

test('BR-15 real clock: the calendar title is the Tokyo month right now', async ({ page }) => {
  const now = new Date();
  const jst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const y = jst.find((p) => p.type === 'year')!.value;
  const m = jst.find((p) => p.type === 'month')!.value;
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-later').click();
  await expect(page.getByTestId('cal-title')).toHaveText(`${y}年${m}月`);
});
