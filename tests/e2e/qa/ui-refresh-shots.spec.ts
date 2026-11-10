// QA, UI refresh 2026-11: visual evidence. Screenshots of the home with every tile state (the QA matrix, today = 2026-11-17) at 390 / 768 / 1280 in
// light and dark, plus the legend, the about panel and the family card, written to docs/dev/_scratch/ui-refresh/qa/. Not a visual-regression test:
// the only assertion is that each file was written.
// Stories: US-E5-01/AC3 AC15 (evidence), US-NF-02/AC3
import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { jst10, matrixStore, seed, setScheme } from './ui-refresh-common.ts';

const OUT = join(process.cwd(), 'docs', 'dev', '_scratch', 'ui-refresh', 'qa');

for (const [w, h] of [
  [390, 844],
  [768, 1024],
  [1280, 800],
] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`QA screenshots home ${w} ${theme}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize({ width: w, height: h });
      await page.clock.setFixedTime(jst10('2026-11-17'));
      await seed(page, matrixStore('ja', (s) => { s.settings.reminders.weekly.enabled = false; s.settings.reminders.dayBefore.enabled = false; }));
      await page.goto('./#/calendar/2026-11');
      await expect(page.getByTestId('cal-grid')).toBeVisible();
      await setScheme(page, theme);
      const file = (name: string) => join(OUT, `home-${w}-${theme}${name}.png`);
      await page.screenshot({ path: file('') });
      await page.screenshot({ path: file('-full'), fullPage: true });
      await page.getByTestId('legend-toggle').click();
      await page.getByTestId('legend').scrollIntoViewIfNeeded();
      await page.screenshot({ path: file('-legend') });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByTestId('about-toggle').click();
      await page.waitForTimeout(350);
      await page.screenshot({ path: file('-about') });
      for (const n of ['', '-full', '-legend', '-about']) expect(existsSync(file(n))).toBe(true);
    });
  }
}
