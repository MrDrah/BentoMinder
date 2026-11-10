// QA helpers (independent of tests/e2e/helpers.ts).
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type Request } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Untyped JSON read from the app store and the proxy: the one documented, scoped exception to no-explicit-any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export const ROOT = process.cwd();
export const KEY = 'bentominder.state';
export const FX = (id: string, file = 'menu.pdf') => join(ROOT, 'tests', 'fixtures', 'menus', id, file);
export const FX01 = FX('fixture-menu-2026-11');
export const STATE_V1 = readFileSync(join(ROOT, 'tests', 'fixtures', 'state', 'v1.json'), 'utf8');
/** 2026-10-28 10:00 JST: from the 20th the import preselects next month (OQ-21). */
export const NOW = new Date('2026-10-28T01:00:00Z');

export const PROXY_DIRECT = 'http://127.0.0.1:8788';

export async function freezeClock(page: Page) {
  await page.clock.setFixedTime(NOW);
}

/** Records every request the page makes (all origins). */
export function recordAll(page: Page): Request[] {
  const seen: Request[] = [];
  page.on('request', (r) => seen.push(r));
  return seen;
}

export function requestText(r: Request): string {
  const body = r.postDataBuffer();
  let text = `${r.method()} ${r.url()} ${JSON.stringify(r.headers())}`;
  if (body) text += ' ' + body.toString('latin1') + ' ' + body.toString('utf8');
  return text;
}

export async function axeSerious(page: Page, label: string) {
  // The reminder banner fades in over 200 ms: axe would read colours mid-fade (same rule as tests/e2e/helpers.ts; UI refresh QA pass).
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

export async function readStore(page: Page): Promise<Json> {
  return page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), KEY);
}

export async function allKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(window.localStorage));
}

export interface ProfileInput {
  nickname?: string;
  note?: string;
  age?: string;
  allergy?: 'none-known' | 'has-known' | 'unknown';
  likes?: string[]; // option ids in the popular list
  dislikes?: string[];
}

/** Fills onboarding step 1 and presses 次へ; does not wait for step 2. */
export async function fillProfile(page: Page, p: ProfileInput = {}) {
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  if (p.nickname !== undefined) await page.getByTestId('input-nickname').fill(p.nickname);
  await page.getByTestId(`chip-age-${p.age ?? 'age-4-5'}`).click();
  for (const id of p.likes ?? []) await page.getByTestId(`picker-likes-option-${id}`).click();
  for (const id of p.dislikes ?? []) await page.getByTestId(`picker-dislikes-option-${id}`).click();
  await page.getByTestId(`radio-allergy-${p.allergy ?? 'none-known'}`).check();
  if (p.note !== undefined) await page.getByTestId('input-note').fill(p.note);
  await page.getByTestId('ob-next').click();
}

/** Tracks the sum of providerCalls reported by the proxy for /api/menu/extract. */
export function trackProviderCalls(page: Page) {
  const state = { extractRequests: 0, providerCalls: 0, replies: [] as Json[] };
  page.on('response', async (resp) => {
    if (new URL(resp.url()).pathname === '/api/menu/extract') {
      state.extractRequests += 1;
      try {
        const j = await resp.json();
        state.replies.push(j);
        const n = j.ok ? (j.meta?.providerCalls ?? 0) : (j.providerCalls ?? 0);
        state.providerCalls += n;
      } catch {
        /* non-JSON */
      }
    }
  });
  return state;
}

/** Pins the proxy reply to FX-01's recorded hand-1 (D-M1-09: a scenario-driven reply can otherwise leave a different reading in the proxy cache). */
export async function pinHand1(page: Page) {
  await useScenario(page, 'fixture-menu-2026-11/hand-1');
}

/** Forces the proxy's mock scenario on /api/menu/extract (test-only header). */
export async function useScenario(page: Page, scenario: string) {
  await page.route('**/api/menu/extract**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-bm-mock-scenario': scenario } }));
}
