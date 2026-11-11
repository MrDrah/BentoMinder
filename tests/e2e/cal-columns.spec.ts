// PO 2026-11-11: on a phone the Saturday and Sunday columns were thinner than the weekday columns. All seven are equal.
// (A layout rule recorded in docs/PLAN.md section 7, not a story.)
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedStore } from './helpers.ts';

const STATE = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');

for (const width of [360, 390, 768]) {
  test(`calendar columns: all seven day columns have the same width at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date('2026-11-02T01:00:00Z'));
    await seedStore(page, STATE);
    await page.goto('./');
    await expect(page.getByTestId('cal-grid')).toBeVisible();
    const widths = await page.evaluate(() => [...(document.querySelectorAll('.cal-row')[1]?.children ?? [])].map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10));
    expect(widths).toHaveLength(7);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(0.6);
  });
}
