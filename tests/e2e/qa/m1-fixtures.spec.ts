// QA M1: every fixture's recorded stand-ins pushed through the real proxy + UI (header-injected scenario).
// Property tests on the review screen: every dish the model returned appears under the same date, nothing
// else is added (BR-11), allergens are never shown as "none" unless the sheet says so (BR-08), warnings show.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { FX01, fillProfile, freezeClock, readStore, ROOT, trackProviderCalls, useScenario } from './helpers.ts';

const MENUS = join(ROOT, 'tests', 'fixtures', 'menus');

interface Out {
  targetMonth: string;
  days: { date: string; items: { text: string }[]; allergenDeclaration?: { status: string; rawText?: string } }[];
  noLunchDays: { date: string; originalText: string }[];
  outOfMonthDays?: unknown[];
}
function modelOutput(fixture: string, name = 'hand-1'): Out {
  const j = JSON.parse(readFileSync(join(MENUS, fixture, 'recorded', `${name}.json`), 'utf8'));
  return j.response.modelOutput ?? JSON.parse(j.response.rawText);
}

/** A clock for which `month` is the preselected import month (the 20th of the month before, JST). */
function clockFor(month: string): Date {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const prev = m === 1 ? [y - 1, 12] : [y, m - 1];
  return new Date(`${prev[0]}-${String(prev[1]).padStart(2, '0')}-25T01:00:00Z`);
}

async function importWith(page: Page, fixture: string, scenario: string, month: string) {
  await page.clock.setFixedTime(clockFor(month));
  await useScenario(page, scenario);
  await page.goto('./');
  await fillProfile(page);
  await expect(page.getByTestId('import-month')).toHaveValue(month);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
}

const FIXTURES = readdirSync(MENUS).filter((d) => existsSync(join(MENUS, d, 'recorded', 'hand-1.json')) && !d.endsWith('-scan'));

for (const fixture of FIXTURES) {
  const month = fixture.match(/(\d{4}-\d{2})/)![1]!;
  test(`US-E2-04/AC1 US-E2-04/AC2 US-E2-04/AC3 US-E2-04/AC5 US-E3-01/AC1 ${fixture} hand-1: review shows exactly the model's dishes per date, no invention`, async ({ page }) => {
    const calls = trackProviderCalls(page);
    const out = modelOutput(fixture);
    await importWith(page, fixture, `${fixture}/hand-1`, month);
    await expect(page.getByTestId('screen-review')).toBeVisible();
    await expect.poll(() => calls.providerCalls).toBe(1);

    const rows = await page.locator('[data-testid^="review-day-"]').evaluateAll((els) =>
      els.map((e) => ({
        date: e.getAttribute('data-testid')!.replace('review-day-', ''),
        dishes: [...e.querySelectorAll('input[data-testid^="review-dish-"]')].map((i) => (i as HTMLInputElement).value),
        noLunch: (e.querySelector('input[data-testid^="review-nolunch-text-"]') as HTMLInputElement | null)?.value ?? null,
        text: (e as HTMLElement).innerText,
      })),
    );
    const byDate = new Map(rows.map((r) => [r.date, r]));
    // every dish the model returned, same date, same order, nothing extra
    for (const d of out.days) {
      const row = byDate.get(d.date);
      expect(row, `row for ${d.date}`).toBeDefined();
      expect(row!.dishes, d.date).toEqual(d.items.map((i) => i.text));
    }
    for (const n of out.noLunchDays) {
      const row = byDate.get(n.date);
      expect(row, `no-lunch row ${n.date}`).toBeDefined();
      expect(row!.noLunch, n.date).toBe(n.originalText);
      expect(row!.dishes, `${n.date} lists no dishes`).toEqual([]);
    }
    const known = new Set([...out.days.map((d) => d.date), ...out.noLunchDays.map((n) => n.date)]);
    for (const r of rows) {
      if (known.has(r.date)) continue;
      expect(r.dishes, `${r.date} was not in the PDF: no dish may appear`).toEqual([]);
      expect(r.text, r.date).toContain('献立に記載なし');
      const wd = new Date(`${r.date}T00:00:00Z`).getUTCDay();
      expect(wd >= 1 && wd <= 5, `${r.date} unlisted weekend day shown`).toBe(true);
    }
    // all Mon-Fri of the month are present
    const [y, m] = month.split('-').map(Number) as [number, number];
    for (let day = 1; day <= new Date(Date.UTC(y, m, 0)).getUTCDate(); day++) {
      const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
      const date = `${month}-${String(day).padStart(2, '0')}`;
      if (wd >= 1 && wd <= 5) expect(byDate.has(date), `weekday ${date} listed`).toBe(true);
    }
    // BR-08: a day without a declared allergen list never reads as "none"; declared-none quotes the sheet
    for (const d of out.days) {
      const row = byDate.get(d.date)!;
      const status = d.allergenDeclaration?.status ?? 'not-declared';
      if (status === 'not-declared') expect(row.text, `${d.date} not-declared`).toMatch(/献立表のアレルゲン表示\s*記載なし/);
      expect(row.text, `${d.date}`).not.toMatch(/アレルゲンなし|アレルゲン不使用|allergen[- ]free/i);
    }
    // nothing stored before confirm (BR-12)
    const s = await readStore(page);
    expect(s.menus[month].confirmed ?? null).toBeNull();
  });
}

test('US-E2-05/AC5 US-E3-01/AC2 an unflagged weekday mismatch is flagged by the app, not silently accepted', async ({ page }) => {
  await importWith(page, 'fixture-menu-2026-11-wdmismatch', 'fixture-menu-2026-11-wdmismatch/hand-unflagged', '2026-11');
  await expect(page.getByTestId('screen-review')).toBeVisible();
  const row = page.getByTestId('review-day-2026-11-04');
  await expect(row.locator('[data-testid^="review-tag-"]').first()).toContainText('要確認');
  await expect(row).toContainText('日付と曜日が合いません');
  await expect(page.getByTestId('review-summary')).not.toContainText('ありません');
});

test('US-E2-05/AC3 an impossible date (2027-02-29) is malformed: 2 calls then the malformed message, nothing stored', async ({ page }) => {
  const calls = trackProviderCalls(page);
  await importWith(page, 'fixture-menu-2027-02-reiwa', 'fixture-menu-2027-02-reiwa/hand-leap-invalid', '2027-02');
  await expect(page.getByTestId('import-error')).toContainText('献立を読み取れませんでした。時間をおいて再度お試しください。');
  await expect.poll(() => calls.providerCalls).toBe(2);
  expect((await readStore(page)).menus).toEqual({});
});

test('US-E3-01/AC4 layout-unrecognised and partial-extraction warnings are shown once, above the days; confirm stays available', async ({ page }) => {
  await importWith(page, 'fixture-menu-2027-01-twocol', 'fixture-menu-2027-01-twocol/hand-layout-unrecognised', '2027-01');
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await expect(page.getByTestId('banner-review-layout-unrecognised')).toHaveText('献立表の形式をうまく読み取れなかった可能性があります。');
  await expect(page.getByTestId('banner-review-layout-unrecognised')).toHaveCount(1);
  await expect(page.getByTestId('review-confirm')).not.toHaveAttribute('aria-disabled', 'true');
});

test('US-E3-01/AC4 partial-extraction warning text', async ({ page }) => {
  await importWith(page, 'fixture-menu-2027-01-twocol', 'fixture-menu-2027-01-twocol/hand-partial', '2027-01');
  await expect(page.getByTestId('banner-review-partial-extraction')).toHaveText('一部の日だけ読み取れました。足りない日は入力してください。');
});

test('US-E3-01/AC4 wrong-era detectedMonth shows the month-mismatch banner naming the chosen month', async ({ page }) => {
  await importWith(page, 'fixture-menu-2027-02-reiwa', 'fixture-menu-2027-02-reiwa/hand-wrong-era', '2027-02');
  await expect(page.getByTestId('banner-review-month-mismatch')).toHaveText('献立表の月が、選んだ月（2月）と違うようです。');
});

test('US-E3-01/AC4 US-E2-05/AC4 a PDF for another month: every day lands in 「対象月以外」, none imported, banner shown, confirm blocked or empty', async ({ page }) => {
  await importWith(page, 'fixture-menu-2027-02-reiwa', 'fixture-menu-2027-02-reiwa/hand-target-2027-03', '2027-03');
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await expect(page.getByTestId('banner-review-month-mismatch')).toContainText('（3月）');
  await expect(page.getByTestId('review-out-of-month')).toBeVisible();
  // nothing from February may be listed as a March day
  expect(await page.locator('[data-testid^="review-day-2027-02"]').count()).toBe(0);
  const dishInputs = await page.locator('input[data-testid^="review-dish-"]').count();
  expect(dishInputs).toBe(0);
  await expect(page.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
});

test('US-E3-01/AC4 choosing the previous month for the FX-01 PDF stores targetMonth as chosen and warns', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T01:00:00Z'));
  await useScenario(page, 'fixture-menu-2026-11/hand-1');
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-month').selectOption('2026-10');
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  const s = await readStore(page);
  expect(Object.keys(s.menus)).toEqual(['2026-10']);
  expect(s.menus['2026-10'].extractions[0].targetMonth).toBe('2026-10');
  await expect(page.getByTestId('banner-review-month-mismatch')).toContainText('（10月）');
  // every November date is outside October
  await expect(page.getByTestId('review-out-of-month')).toBeVisible();
});

test('US-E2-04/AC6 US-E2-02/AC2 stored source metadata: sha256 of the bytes, +09:00 timestamp, model, filename', async ({ page }) => {
  await freezeClock(page);
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  const src = (await readStore(page)).menus['2026-11'].extractions[0].source;
  const { createHash } = await import('node:crypto');
  expect(src.sha256).toBe(createHash('sha256').update(readFileSync(FX01)).digest('hex'));
  expect(src.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\+09:00|Z)$/);
  expect(src.model).toBeTruthy();
  expect(src).toMatchObject({ kind: 'upload', filename: 'menu.pdf' });
});
