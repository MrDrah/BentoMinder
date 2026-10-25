import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedStore } from './helpers.ts';

const STATE = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');
const OUT = 'C:/Users/qmila/AppData/Local/Temp/claude/C--Projects-coktail/bc50000c-ad84-46ea-b390-186e61f0ecc3/scratchpad/';

test('scratch screenshots', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date('2026-11-02T01:00:00Z'));
  await seedStore(page, STATE);
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  await page.screenshot({ path: OUT + `cal-${info.project.name}.png`, fullPage: true });
  await page.getByTestId('cal-cell-2026-11-04').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await page.screenshot({ path: OUT + `sheet-${info.project.name}.png` });
});
