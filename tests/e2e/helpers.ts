// Shared e2e helpers: seeding the stored data and the axe check.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const STATE_V1 = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'v1.json'), 'utf8');
export const FX01_PDF = join(process.cwd(), 'tests', 'fixtures', 'menus', 'fixture-menu-2026-11', 'menu.pdf');

/** Seeds the store once (a reload keeps what the app wrote since). */
export async function seedStore(page: Page, json: string = STATE_V1): Promise<void> {
  await page.addInitScript((value) => {
    if (window.localStorage.getItem('bentominder.state') === null) window.localStorage.setItem('bentominder.state', value);
  }, JSON.stringify(JSON.parse(json)));
}

/** US-NF-02/AC1: 0 serious or critical axe violations on the current screen. */
export async function expectNoSeriousAxe(page: Page, label: string): Promise<void> {
  // Axe reads colours mid-fade (the reminder banner fades in over 200 ms): let animations finish first.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => !((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest('.dish .a')).map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
