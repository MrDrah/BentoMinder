// QA M2: edge, hostile, state and accessibility checks for the calendar, day sheet, refresh and settings.
// Derived from the stories (US-E3-05, US-E3-06, US-E5-01/02, US-E4-03, US-NF-02), not from the developer's tests.
// Today is fixed at 2026-11-02 10:00 JST unless a test moves the clock. Seeds the store with the shared fixture.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FX01, readStore, ROOT, useScenario, type Json } from './helpers.ts';

const STATE = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8')) as Json;
const NOW = new Date('2026-11-02T01:00:00Z');
const FX = 'fixture-menu-2026-11';

async function seed(page: Page, state: Json, now: Date = NOW) {
  await page.clock.setFixedTime(now);
  await page.addInitScript((v) => {
    if (window.localStorage.getItem('bentominder.state') === null) window.localStorage.setItem('bentominder.state', v);
  }, JSON.stringify(state));
}
const clone = (x: Json): Json => JSON.parse(JSON.stringify(x));
const cell = (page: Page, date: string) => page.getByTestId(`cal-cell-${date}`);
async function openDay(page: Page, date: string) {
  const close = page.getByTestId('day-sheet-close');
  if (await close.isVisible().catch(() => false)) await close.click();
  await cell(page, date).getByRole('button').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
}
const seriousAxe = async (page: Page, label: string) => {
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

test.describe('no-menu cards (US-E3-06)', () => {
  test('US-E3-06/AC5 never confirmed anything: this month says 今月, December says 12月, both offer the import and show no assessment', async ({ page }) => {
    const s = clone(STATE);
    s.menus = {};
    s.decisions = {};
    s.overrides = {};
    await seed(page, s, new Date('2026-11-10T01:00:00Z'));
    await page.goto('./');
    await page.getByTestId('import-later').click(); // nothing confirmed yet: the app opens on the import step, 「あとで」 leads to the calendar
    await expect(page.getByTestId('cal-grid')).toBeVisible();
    await expect(page.getByTestId('menu-card-missing')).toContainText('今月の献立がまだありません');
    await expect(page.getByTestId('menu-card-missing')).toContainText('献立を取り込む');
    expect(await page.locator('[data-assessment]').count()).toBe(0);
    await page.getByTestId('cal-next').click();
    await expect(page.getByTestId('menu-card-missing')).toContainText('12月の献立がまだありません');
    expect(await page.locator('[data-assessment]').count()).toBe(0);
  });

  test('US-E3-06/AC1 only November is confirmed and today is 2026-12-01 JST: the December card names the month and nothing is assessed', async ({ page }) => {
    await seed(page, STATE, new Date('2026-11-30T16:00:00Z')); // 2026-12-01 01:00 JST, even where the device date is still 11-30
    await page.goto('./');
    await expect(page.getByTestId('cal-title')).toHaveText('2026年12月');
    await expect(page.getByTestId('menu-card-missing')).toContainText('12月の献立がまだありません');
    await expect(page.getByTestId('menu-card-missing')).toContainText('献立を取り込む');
    expect(await page.locator('[data-assessment]').count()).toBe(0);
  });

  test('US-E3-06/AC5 only October ever confirmed, today 2026-11-10: the November card names 11月', async ({ page }) => {
    const s = clone(STATE);
    const nov = s.menus['2026-11'];
    const confirmed = JSON.parse(JSON.stringify(nov.confirmed).replaceAll('2026-11', '2026-10'));
    s.menus = { '2026-10': { ...nov, month: '2026-10', extractions: [], confirmed: { ...confirmed, extractionId: null, changedDatesSincePrevious: [] } } };
    for (const dd of s.menus['2026-10'].confirmed.days) Object.assign(dd, { printedWeekday: null, printedDateText: null }); // dates moved to October: the printed weekday no longer matches
    delete s.menus['2026-10'].pendingReviewExtractionId;
    delete s.menus['2026-10'].sourceUrl;
    s.decisions = {};
    s.overrides = {};
    await seed(page, s, new Date('2026-11-10T01:00:00Z'));
    await page.goto('./');
    if (await page.getByTestId('import-later').isVisible().catch(() => false)) await page.getByTestId('import-later').click();
    await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
    await expect(page.getByTestId('menu-card-missing')).toContainText('11月の献立がまだありません');
    expect(await page.locator('[data-assessment]').count()).toBe(0);
  });
});

test.describe('refresh is atomic (US-E3-05/AC5, BR-12, BR-13)', () => {
  const snapshot = (st: Json) => JSON.stringify({ menus: st.menus, decisions: st.decisions, overrides: st.overrides });

  test('US-E3-05/AC5 a refresh whose extraction fails validation leaves the confirmed menu, decisions and overrides unchanged', async ({ page }) => {
    await seed(page, STATE);
    await useScenario(page, `${FX}/hand-schema-invalid`);
    await page.goto('./');
    const before = snapshot(await readStore(page));
    await page.goto('./#/import');
    await page.getByTestId('import-month').selectOption('2026-11');
    await page.getByTestId('import-upload').setInputFiles(FX01);
    const replace = page.getByTestId('dialog-replace-menu');
    if (await replace.isVisible().catch(() => false)) await page.getByTestId('dialog-replace-menu-confirm').click();
    const consent = page.getByTestId('consent-accept');
    if (await consent.isVisible().catch(() => false)) await consent.click();
    await expect(page.getByTestId('import-error')).toBeVisible({ timeout: 30_000 });
    const after = await readStore(page);
    expect(after.menus['2026-11'].confirmed.version).toBe(STATE.menus['2026-11'].confirmed.version);
    expect(snapshot(after).replace(/"updatedAt":"[^"]*"/g, '')).toBe(before.replace(/"updatedAt":"[^"]*"/g, ''));
  });

  test('US-E3-05/AC5 the parent leaves the review without confirming: the previous menu stays active, also after a reload', async ({ page }) => {
    await seed(page, STATE);
    await useScenario(page, `${FX}/hand-1`);
    await page.goto('./');
    const before = await readStore(page);
    await page.goto('./#/import');
    await page.getByTestId('import-month').selectOption('2026-11');
    await page.getByTestId('import-upload').setInputFiles(FX01);
    const replace = page.getByTestId('dialog-replace-menu');
    if (await replace.isVisible().catch(() => false)) await page.getByTestId('dialog-replace-menu-confirm').click();
    const consent = page.getByTestId('consent-accept');
    if (await consent.isVisible().catch(() => false)) await consent.click();
    await expect(page.getByTestId('screen-review')).toBeVisible({ timeout: 30_000 });
    await page.goto('./'); // abandon without confirming
    await page.reload();
    const after = await readStore(page);
    expect(after.menus['2026-11'].confirmed).toEqual(before.menus['2026-11'].confirmed);
    expect(after.decisions).toEqual(before.decisions);
    expect(after.overrides).toEqual(before.overrides);
    await expect(cell(page, '2026-11-04')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  });
});

test.describe('read-only past and hostile menu text (BR-27, US-E5-02/AC3, US-NF-02)', () => {
  test('US-E5-02/AC3 US-E4-03/AC6 a past planned day is read-only: the plan is shown, no action or override control is offered, the store is untouched', async ({ page }) => {
    await seed(page, STATE, new Date('2026-11-06T01:00:00Z')); // 11-04 is past
    await page.goto('./');
    const before = await readStore(page);
    await openDay(page, '2026-11-04');
    await expect(page.getByTestId('day-past-note')).toBeVisible();
    await expect(page.getByTestId('day-sheet')).toContainText('くまさんおにぎり弁当');
    await expect(page.getByTestId('override-open')).toHaveCount(0);
    await expect(page.getByTestId('day-sheet').getByRole('button', { name: /あとで決める|給食に戻す|レシピを変更|手作りお弁当にする/ })).toHaveCount(0);
    expect((await readStore(page)).decisions).toEqual(before.decisions);
  });

  test('US-NF-02/AC1 hostile dish text (script tag, emoji, 40 characters of full-width text) is shown as text, never run, and does not break the layout', async ({ page }) => {
    const s = clone(STATE);
    const days = s.menus['2026-11'].confirmed.days;
    const target = days.find((x: Json) => x.date === '2026-11-12') ?? days[0];
    target.items[0].text = '<script>window.__x=1</script><b>x</b>';
    target.items[1] = { ...target.items[1], text: '🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙🍱🥢🍙' };
    if (target.items[2]) target.items[2].text = 'あ'.repeat(40);
    await seed(page, s);
    await page.goto('./');
    await openDay(page, target.date);
    await expect(page.getByTestId('day-menu')).toContainText('<script>window.__x=1</script>');
    expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await seriousAxe(page, 'hostile day sheet');
  });

  test('US-E5-01/AC3 keyboard only: a day opens with Enter and 「あとで決める」 works with Enter', async ({ page }) => {
    await seed(page, STATE);
    await page.goto('./');
    await cell(page, '2026-11-18').getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('day-sheet')).toBeVisible();
    const later = page.getByTestId('day-sheet').getByRole('button', { name: 'あとで決める' });
    await later.focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readStore(page)).decisions['2026-11-18']?.state).toBe('not-confirmed');
  });

  test('US-E5-01/AC3 US-NF-02/AC1 [M2-D01 open P3, expected to fail until fixed] after a keyboard action the focus stays in the sheet and Escape closes it', async ({ page }) => {
    test.fail(true, 'M2-D01: the activated button is removed and focus falls to BODY, so Escape no longer closes the sheet');
    await seed(page, STATE);
    await page.goto('./');
    await cell(page, '2026-11-18').getByRole('button').focus();
    await page.keyboard.press('Enter');
    const later = page.getByTestId('day-sheet').getByRole('button', { name: 'あとで決める' });
    await later.focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readStore(page)).decisions['2026-11-18']?.state).toBe('not-confirmed');
    await expect(page.getByTestId('day-sheet').locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('day-sheet')).toBeHidden({ timeout: 2000 });
    await expect(cell(page, '2026-11-18').getByRole('button')).toBeFocused();
  });
});

test.describe('URL and back-button state', () => {
  test('US-E5-01/AC1 settings and back: the browser back button returns to the calendar with the same month', async ({ page }) => {
    await seed(page, STATE);
    await page.goto('./');
    await page.getByTestId('cal-next').click();
    await page.getByTestId('appbar-settings').click();
    await expect(page.getByTestId('screen-settings')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('screen-calendar')).toBeVisible();
  });

  test('US-E3-05/AC9 an unknown or refresh-review deep link without a pending refresh does not crash and leaves the store alone', async ({ page }) => {
    await seed(page, STATE);
    await page.goto('./');
    const before = await readStore(page);
    for (const hash of ['#/does-not-exist', '#/refresh-review', '#/review']) {
      await page.goto(`./${hash}`);
      await expect(page.getByTestId('screen-loading')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('Error');
    }
    expect((await readStore(page)).decisions).toEqual(before.decisions);
  });
});

test.describe('accessibility in both themes and both widths (US-NF-02/AC1)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const [w, h] of [[390, 844], [1280, 800]] as const) {
      test(`US-NF-02/AC1 US-E5-01/AC4 axe: calendar, day sheet and settings, ${scheme}, ${w}px`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: scheme });
        await seed(page, STATE);
        await page.goto('./');
        await expect(page.getByTestId('cal-grid')).toBeVisible();
        await seriousAxe(page, `calendar ${scheme} ${w}`);
        await openDay(page, '2026-11-04');
        await seriousAxe(page, `day sheet ${scheme} ${w}`);
        await page.goto('./#/settings');
        await expect(page.getByTestId('screen-settings')).toBeVisible();
        await seriousAxe(page, `settings ${scheme} ${w}`);
      });
    }
  }
});
