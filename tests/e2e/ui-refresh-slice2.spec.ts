// UI refresh 2026-11, slice 2 (design/components.md §18; BA US-E5-01/AC3-AC4, AC9-AC16): the day tile with every state
// present (tests/e2e/tile-states.ts, today = 2026-11-17), in both projects (390 and 1280 px), light and dark.
import { expect, test, type Page } from '@playwright/test';
import { expectNoSeriousAxe, seedStore } from './helpers.ts';
import { TILE_DATES as D, TILES_NOW, tileStatesState } from './tile-states.ts';

const cell = (page: Page, date: string) => page.getByTestId(`cal-cell-${date}`);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TILES_NOW);
  await seedStore(page, tileStatesState());
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
});

test('US-E5-01/AC3 US-E5-01/AC10 US-E5-01/AC11 US-E5-01/AC12 US-E5-01/AC13 US-E5-01/AC16 every tile state shows the right icon, markers and name', async ({ page }) => {
  const name = (date: string) => cell(page, date).getByRole('button');
  await expect(cell(page, D.pastSchool)).toHaveAttribute('data-icon', 'school');
  await expect(name(D.pastSchool)).toHaveAccessibleName('11月9日（月）、給食、過去の日');
  await expect(cell(page, D.pastHomeChanged)).toHaveAttribute('data-icon', 'home');
  await expect(name(D.pastHomeChanged)).toHaveAccessibleName('11月4日（水）、手作りお弁当、手動で変更、過去の日');
  await expect(name(D.pastSchoolChanged)).toHaveAccessibleName('11月5日（木）、給食、アレルギーに注意、手動で変更、過去の日');
  await expect(cell(page, D.pastUnsure)).toHaveAttribute('data-icon', 'unsure');
  await expect(name(D.pastUnsure)).toHaveAccessibleName('11月10日（火）、未定、手動で変更、過去の日');
  await expect(name(D.pastAllergen)).toHaveAccessibleName('11月11日（水）、給食、アレルギーに注意、過去の日');
  await expect(cell(page, D.pastAllergen).locator('.cell__allergen')).toHaveCount(1);
  await expect(name(D.todayAllergenChanged)).toHaveAccessibleName('11月17日（火）、給食、アレルギーに注意、手動で変更、今日');
  await expect(cell(page, D.todayAllergenChanged)).toHaveAttribute('aria-current', 'date');
  await expect(name(D.tomorrow)).toHaveAccessibleName('11月18日（水）、給食、明日');
  await expect(cell(page, D.tomorrow)).toHaveAttribute('data-tomorrow', 'true');
  await expect(name(D.futureAllergen)).toHaveAccessibleName('11月19日（木）、給食、アレルギーに注意');
  await expect(name(D.dash)).toHaveAccessibleName('11月20日（金）、手作りお弁当の日、お弁当の準備が未定');
  await expect(cell(page, D.dash).locator('.cell__dash')).toHaveCount(1);
  await expect(cell(page, D.dash).locator('.cell__allergen')).toHaveCount(0);
  await expect(name(D.futureHome)).toHaveAccessibleName('11月24日（火）、手作りお弁当、手動で変更');
  await expect(name(D.futureUnsure)).toHaveAccessibleName('11月25日（水）、未定、手動で変更');
  await expect(name(D.futureSchoolChanged)).toHaveAccessibleName('11月26日（木）、給食、手動で変更');
  await expect(cell(page, D.noLunch)).toHaveAttribute('data-icon', 'none');
  await expect(cell(page, D.weekend)).toHaveAttribute('data-icon', 'none');
  // content budget: number, one icon, at most one mark and one dash
  const budget = await page.locator('[data-testid^="cal-cell-2026-11-"]').evaluateAll((cells) =>
    cells.map((c) => ({ id: c.getAttribute('data-testid'), svg: c.querySelectorAll('svg').length, al: c.querySelectorAll('.cell__allergen').length, dash: c.querySelectorAll('.cell__dash').length, words: c.querySelectorAll('.cell__word, .mark, .flag-badge').length })),
  );
  for (const b of budget) expect(b.svg <= 1 && b.al <= 1 && b.dash <= 1 && b.words === 0, JSON.stringify(b)).toBe(true);
});

test('US-E5-01/AC11 today is the only filled tile and the tomorrow tile has a 2 px frame', async ({ page }) => {
  const style = (date: string) =>
    cell(page, date)
      .locator('.cell__btn')
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, border: s.borderTopWidth };
      });
  const navy = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.background = 'var(--navy-fill)';
    document.body.append(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });
  expect((await style(D.todayAllergenChanged)).bg).toBe(navy);
  for (const date of [D.tomorrow, D.futureHome, D.pastSchool, D.dash, D.noLunch]) expect((await style(date)).bg, date).not.toBe(navy);
  expect((await style(D.tomorrow)).border).toBe('2px');
});

test('US-NF-02/AC3 axe finds nothing serious with every tile state and the legend open, in light and dark', async ({ page }) => {
  await page.getByTestId('legend-toggle').click();
  await expect(page.getByTestId('legend-row')).toHaveCount(10);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectNoSeriousAxe(page, `tiles ${scheme}`);
  }
});

test('US-NF-02/AC3 US-E5-01/AC3 the focus ring on a tile is drawn and not clipped by an ancestor; the tile is at least 44 x 44', async ({ page }) => {
  for (const date of [D.todayAllergenChanged, D.pastSchool, D.weekend]) {
    const btn = cell(page, date).getByRole('button');
    const box = await btn.boundingBox();
    expect(box?.width ?? 0, date).toBeGreaterThanOrEqual(43.5);
    expect(box?.height ?? 0, date).toBeGreaterThanOrEqual(43.5);
  }
  await cell(page, D.tomorrow).getByRole('button').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  const ring = await cell(page, D.tomorrow).getByRole('button').evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const reach = parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset);
    const clippers: string[] = [];
    for (let p = el.parentElement; p !== null && p !== document.documentElement; p = p.parentElement) {
      const c = getComputedStyle(p);
      const clips = c.overflowX !== 'visible' || c.overflowY !== 'visible' || c.contain.includes('paint');
      if (!clips) continue;
      const pr = p.getBoundingClientRect();
      if (pr.left > r.left - reach || pr.right < r.right + reach || pr.top > r.top - reach || pr.bottom < r.bottom + reach) clippers.push(`${p.className || p.tagName}`);
    }
    return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor, reach, clippers };
  });
  expect(ring.style).toBe('solid');
  expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
  expect(ring.clippers).toEqual([]);
});

test('US-E5-01/AC15 the legend explains each tile mark in text and is closed on load', async ({ page }) => {
  await expect(page.getByTestId('legend-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.getByTestId('legend-toggle').click();
  const body = page.locator('#legend-body');
  await expect(body).toContainText('日付の下の絵は、その日の予定です');
  for (const text of ['給食の日', '手作りお弁当の日', 'お弁当かも？', '赤い短い線', 'アレルギーに注意が必要な給食の日', '赤い上の線', '塗りつぶし：今日', '太い枠：明日', 'グレー：過去の日']) await expect(body).toContainText(text);
});
