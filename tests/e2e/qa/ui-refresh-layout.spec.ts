// QA, UI refresh 2026-11: layout (design/components.md §17): home order and rhythm, the about panel, the legend, the sticky action
// bars, the import focus order, the login layout, and no horizontal scroll / 44 px targets / 36 em text on every screen.
// Stories: US-E5-01/AC1 AC15, US-E7-03/AC1, US-NF-02/AC1 AC2 AC3, US-NF-01/AC3 (budgets are the gate's), US-E8-02/AC1
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { css, jst10, matrixStore, M2, seed, setScheme, overflowX, type Json } from './ui-refresh-common.ts';

const wide = (page: Page) => page.viewportSize()!.width;

async function openHome(page: Page, today = '2026-11-22', lang: 'ja' | 'en' = 'ja', width?: number, height?: number): Promise<void> {
  await page.clock.setFixedTime(jst10(today));
  await seed(page, matrixStore(lang));
  if (width !== undefined) await page.setViewportSize({ width, height: height ?? 844 });
  await page.goto('./');
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('cal-title')).toBeVisible();
}

const box = async (page: Page, testId: string) => (await page.getByTestId(testId).first().boundingBox())!;

for (const [w, h] of [
  [390, 844],
  [768, 1024],
  [1280, 800],
] as const) {
  test(`US-E5-01/AC1 US-E7-03/AC1 home order and rhythm at ${w}: alerts, month row, grid, Today card, upcoming, next-month, tools`, async ({ page }) => {
    await openHome(page, '2026-11-22', 'ja', w, h);
    await expect(page.getByTestId('card-menu-next')).toBeVisible();
    const order = ['appbar', 'cal-prev', 'cal-grid', 'today-card', 'upcoming', 'card-menu-next', 'legend-toggle'];
    const ys: number[] = [];
    for (const id of order) ys.push((await box(page, id)).y);
    // DOM order always; for a single column (below 1280) the vertical order too
    const dom = await page.evaluate((ids) => {
      const els = ids.map((i) => document.querySelector(`[data-testid="${i}"]`)!);
      return els.every((e, i) => i === 0 || (els[i - 1]!.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
    }, order);
    expect(dom, 'DOM order').toBe(true);
    for (let i = 1; i < ys.length; i += 1) expect(ys[i]!, `${order[i]} below ${order[i - 1]}`).toBeGreaterThan(ys[i - 1]!);
    // share is in the tools row with the legend toggle
    const share = await page.getByRole('button', { name: /今週の予定を共有/ }).boundingBox();
    const tog = await box(page, 'legend-toggle');
    expect(Math.abs((share?.y ?? -999) - tog.y) < 60 || w < 400, 'share and legend toggle share the tools row (or wrap on a narrow phone)').toBe(true);
    // gap from the grid to the stack below it: rhythm-section 40 / 48 / 64
    const grid = await box(page, 'cal-grid');
    const today = await box(page, 'today-card');
    const section = w >= 1280 ? 64 : w >= 768 ? 48 : 40;
    expect(today.y - (grid.y + grid.height), 'grid to below stack').toBeGreaterThanOrEqual(section - 1);
    // blocks inside the stack: rhythm-block 24 / 32 / 40
    const up = await box(page, 'upcoming');
    const blockGap = w >= 1280 ? 40 : w >= 768 ? 32 : 24;
    expect(up.y - (today.y + today.height), 'today to upcoming').toBeGreaterThanOrEqual(blockGap - 1);
    const nxt = await box(page, 'card-menu-next');
    expect(nxt.y - (up.y + up.height), 'upcoming to next-month card').toBeGreaterThanOrEqual(blockGap - 1);
    // card padding 20 / 24 / 24 and page gutter 20 / 24 / 24
    const pad = await page.getByTestId('card-menu-next').evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    expect(pad).toBe(w >= 768 ? 24 : 20);
    const gutter = await page.getByTestId('today-card').evaluate((el) => el.getBoundingClientRect().left);
    if (w < 1280) expect(Math.abs(gutter - (w >= 768 ? (w - 640) / 2 : 20))).toBeLessThanOrEqual(w >= 768 ? 120 : 1);
    if (w >= 768 && w < 1280) expect(Math.round(grid.width)).toBeLessThanOrEqual(648);
  });
}

test('US-E5-01/AC1 principle 1: with no alert the whole month is in view on 390 x 844 and starts near the top', async ({ page }) => {
  await page.clock.setFixedTime(jst10('2026-11-10'));
  await seed(page, matrixStore('ja', (s) => { s.settings.reminders.weekly.enabled = false; s.settings.reminders.dayBefore.enabled = false; }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  await expect(page.getByTestId('reminder-list')).toHaveCount(0);
  const grid = await box(page, 'cal-grid');
  expect(grid.y).toBeLessThan(200);
  expect(grid.y + grid.height).toBeLessThanOrEqual(844);
});

test('US-E5-01/AC1 observation: on Sunday the weekly reminder (an alert) is allowed above the grid; its height is reported, not asserted', async ({ page }, info) => {
  await openHome(page, '2026-11-22', 'ja', 390, 844);
  const alerts = await page.locator('.cal-alerts').boundingBox();
  info.annotations.push({ type: 'observation', description: `weekly reminder alert stack is ${Math.round(alerts?.height ?? 0)} px high at 390 (grid starts at y=${Math.round((await box(page, 'cal-grid')).y)})` });
  expect(alerts?.height ?? 0).toBeGreaterThan(0);
});

test('US-E5-01/AC1 alerts come first: the missing-menu card sits above the month row, the grid below it', async ({ page }) => {
  await openHome(page, '2026-12-02');
  await expect(page.getByTestId('menu-card-missing')).toBeVisible();
  const a = await box(page, 'menu-card-missing');
  const n = await box(page, 'cal-prev');
  const g = await box(page, 'cal-grid');
  expect(a.y + a.height).toBeLessThanOrEqual(n.y);
  expect(n.y).toBeLessThan(g.y);
  expect(await page.evaluate(() => document.querySelector('[data-testid="today-card"]')!.getBoundingClientRect().top > document.querySelector('[data-testid="cal-grid"]')!.getBoundingClientRect().bottom)).toBe(true);
});

test('US-E5-01/AC1 the month nav row: chevrons 48 px, 今日 pill only away from the current month', async ({ page }) => {
  await openHome(page, '2026-11-10');
  await expect(page.getByTestId('cal-today')).toHaveCount(0);
  const prev = await box(page, 'cal-prev');
  expect(prev.width).toBeGreaterThanOrEqual(47.5);
  expect(prev.height).toBeGreaterThanOrEqual(47.5);
  await page.getByTestId('cal-next').click();
  await expect(page.getByTestId('cal-today')).toBeVisible();
  expect((await box(page, 'cal-today')).height).toBeGreaterThanOrEqual(43.5);
});

// ---------------------------------------------------------------- about panel
test('US-NF-02/AC2 about panel: closed on load, aria wiring, Escape and Close return the focus, opening does not move it, never remembered (ja)', async ({ page }) => {
  await openHome(page, '2026-11-10');
  const toggle = page.getByTestId('about-toggle');
  const panel = page.getByTestId('about-panel');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toBeHidden();
  const controls = await toggle.getAttribute('aria-controls');
  expect(await panel.getAttribute('id')).toBe(controls);
  expect(await panel.getAttribute('role')).toBe('region');
  expect(await panel.getAttribute('aria-labelledby')).not.toBeNull();
  await expect(toggle).toHaveAttribute('aria-label', 'BentoMinderについて');
  // the panel follows the trigger in the DOM, directly after the app bar
  expect(await page.evaluate(() => { const t = document.querySelector('[data-testid="about-toggle"]')!; const p = document.querySelector('[data-testid="about-panel"]')!; return (t.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0; })).toBe(true);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toBeFocused(); // opening does not move the focus
  await expect(page.getByRole('heading', { level: 2, name: 'おべんとう、忘れない。' })).toBeVisible();
  await expect(panel).toContainText('BentoMinderは、園の給食の献立表を読み取って、お弁当の日を忘れないようにお知らせするアプリです。');
  await expect(panel).toContainText('お子さまの好みに合わなさそうな給食に印をつけ、手作りお弁当の日には、おすすめのレシピを3つ提案します。');
  // reach the panel's own controls (the Tab order itself is asserted in the UIR-D01 test below)
  await page.getByTestId('about-close').focus();
  expect(await page.getByTestId('about-close').getAttribute('aria-label')).toBe('説明を閉じる');
  expect((await box(page, 'about-close')).height).toBeGreaterThanOrEqual(43.5);
  await page.keyboard.press('Enter');
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
  // Escape from inside
  await toggle.click();
  await page.getByTestId('about-consent').focus();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
  // trigger again closes
  await toggle.click();
  await toggle.click();
  await expect(panel).toBeHidden();
  // navigating to another screen closes it, and a reload starts closed
  await toggle.click();
  await page.getByTestId('appbar-settings').click();
  await page.goBack();
  await expect(panel).toBeHidden();
  await toggle.click();
  await page.reload();
  await expect(page.getByTestId('about-panel')).toBeHidden();
});

// UIR-D01 (P3): design/components.md 17.2 and a11y 12 say the next Tab after the brand button enters the panel (consent button, then
// Close) and Tab past Close continues to the language toggle. The panel is after the whole app bar in the DOM, so Tab goes to the
// language toggle, library and settings first. test.fail() keeps this repro in the suite: it goes red when the defect is fixed.
test('UIR-D01 US-NF-02/AC2 [expected to fail until fixed] after opening the panel, the next Tab enters it', async ({ page }) => {
  test.fail(true, 'UIR-D01: Tab order puts the panel after the language toggle and the two icon links (P3, qa-ui-refresh.md)');
  await openHome(page, '2026-11-10');
  await page.getByTestId('about-toggle').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('about-consent')).toBeFocused({ timeout: 1500 });
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('about-close')).toBeFocused({ timeout: 1500 });
});

test('US-NF-02/AC1 about panel in English: copy and the accessible name contain the visible brand name', async ({ page }) => {
  await openHome(page, '2026-11-10', 'en');
  const toggle = page.getByTestId('about-toggle');
  await expect(toggle).toHaveAttribute('aria-label', 'About BentoMinder');
  await toggle.click();
  const panel = page.getByTestId('about-panel');
  await expect(panel).toContainText("BentoMinder reads your school's lunch menu and reminds you about your homemade bento days.");
  await expect(panel).toContainText('It marks school lunches your child may not enjoy, and suggests three recipes for each bento day.');
  await expect(page.getByTestId('about-close')).toHaveAttribute('aria-label', 'Close this description');
  const name = await page.evaluate(() => document.querySelector('.appbar__name')?.textContent ?? '');
  expect('About BentoMinder'.includes(name.trim())).toBe(true);
});

for (const [w, h, popover] of [
  [390, 844, false],
  [767, 900, false],
  [768, 1024, true],
  [1280, 800, true],
] as const) {
  test(`US-NF-02/AC1 about panel presentation at ${w}: ${popover ? 'non-modal popover 360 px, outside click closes' : 'inline pull-down that pushes the page, outside click does not close'}`, async ({ page }) => {
    await openHome(page, '2026-11-10', 'ja', w, h);
    const before = await box(page, 'cal-grid');
    await page.getByTestId('about-toggle').click();
    const panel = page.getByTestId('about-panel');
    await expect(panel).toBeVisible();
    await page.waitForTimeout(400); // the pull-down animates for 200 ms
    const pos =await panel.evaluate((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { position: s.position, width: r.width, left: r.left, top: r.top, shadow: s.boxShadow, z: s.zIndex, bg: s.backgroundColor, radius: s.borderTopLeftRadius };
    });
    const after = await box(page, 'cal-grid');
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    if (popover) {
      expect(['absolute', 'fixed'], 'components 17.2 says absolutely positioned; fixed is accepted (observation UIR-O1)').toContain(pos.position);
      expect(Math.round(pos.width)).toBe(360);
      expect(Math.abs(after.y - before.y)).toBeLessThan(2); // does not push the page
      expect(pos.shadow).not.toBe('none');
      // non-modal: no scrim, the page behind stays clickable and Tab is not trapped
      await expect(page.locator('.scrim, .sheet-scrim, [aria-modal="true"]')).toHaveCount(0);
      await page.mouse.click(w - 6, h - 6); // outside the popover
      await expect(panel).toBeHidden();
    } else {
      expect(['static', 'relative']).toContain(pos.position);
      expect(Math.round(pos.width)).toBe(w);
      expect(after.y).toBeGreaterThan(before.y + 80); // pushes the page down
      expect(pos.shadow).toBe('none');
      await page.getByTestId('cal-title').click();
      await expect(panel).toBeVisible(); // a tap outside does not close it on a phone
      await page.getByTestId('about-close').click();
      await expect(panel).toBeHidden();
    }
  });
}

test('US-NF-02/AC1 about panel: 320 px has no horizontal scroll, the brand button is 44 px, the name hides below 400 px and shows at 768', async ({ page }) => {
  await openHome(page, '2026-11-10', 'ja', 320, 640);
  const t = await box(page, 'about-toggle');
  expect(t.width).toBeGreaterThanOrEqual(43.5);
  expect(t.height).toBeGreaterThanOrEqual(43.5);
  await page.getByTestId('about-toggle').click();
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
  const nameVisible = (p: Page) => p.evaluate(() => { const e = document.querySelector('.appbar__name') as HTMLElement | null; return e !== null && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none'; });
  expect(await nameVisible(page)).toBe(false);
  await page.setViewportSize({ width: 768, height: 900 });
  expect(await nameVisible(page)).toBe(true);
  // the focus ring of the trigger is not clipped by the app bar
  await page.getByTestId('about-toggle').focus();
  const clip = await page.getByTestId('about-toggle').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const bad: string[] = [];
    for (let p = el.parentElement; p !== null && p !== document.documentElement; p = p.parentElement) {
      const c = getComputedStyle(p);
      if (c.overflowX === 'visible' && c.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (pr.left > r.left - 4 || pr.right < r.right + 4 || pr.top > r.top - 4 || pr.bottom < r.bottom + 4) bad.push(String(p.className));
    }
    return bad;
  });
  expect(clip).toEqual([]);
});

test('US-NF-02/AC3 reduced motion: the about panel appears and disappears with no animation', async ({ page }) => {
  await openHome(page, '2026-11-10');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('about-toggle').click();
  const dur = await page.getByTestId('about-panel').evaluate((el) => {
    const s = getComputedStyle(el);
    return { t: s.transitionDuration, a: s.animationDuration, anims: el.getAnimations().length };
  });
  expect(dur.anims).toBe(0);
  for (const d of [dur.t, dur.a]) for (const part of d.split(',')) expect(parseFloat(part)).toBe(0);
});

// ---------------------------------------------------------------- legend
test('US-E5-01/AC15 legend: closed on load even on a fresh calendar, aria wiring, ten rows whose samples are the tile states, text in ja and en', async ({ page }) => {
  await openHome(page, '2026-11-10');
  const toggle = page.getByTestId('legend-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAttribute('aria-controls', 'legend-body');
  await expect(page.locator('#legend-body')).toBeHidden();
  expect((await box(page, 'legend-toggle')).height).toBeGreaterThanOrEqual(43.5);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const rows = page.getByTestId('legend-row');
  await expect(rows).toHaveCount(10);
  const expectJa = ['給食の日', '手作りお弁当の日', 'お弁当かも？（未定・あとで決める）', '赤い短い線：お弁当の準備が未定（今日から先の日）', '！：登録したアレルギーに注意が必要な給食の日', '赤い上の線：手動で変更した日', '塗りつぶし：今日', '太い枠：明日', 'グレー：過去の日', '土・日・祝（数字の色と「祝」）'];
  const texts = (await rows.allTextContents()).map((s) => s.replace(/\s+/g, '').replace(/^\d+/, ''));
  for (let i = 0; i < expectJa.length; i += 1) expect(texts[i], `row ${i}`).toContain(expectJa[i]!.replace(/\s+/g, ''));
  await expect(page.locator('#legend-body')).toContainText('日付の下の絵は、その日の予定です。給食の見立てやレシピ名は、日付を開くと見られます。');
  // samples show what the tile shows: icon kinds, dash, mark, bar, fill, frame, grey
  const samples = await rows.evaluateAll((els) =>
    els.map((r) => {
      const s = r.querySelector<HTMLElement>('[class*="sample"], .cell')!;
      const btn = s?.querySelector<HTMLElement>('.cell__btn') ?? s;
      const cs = btn ? getComputedStyle(btn) : null;
      return {
        svg: r.querySelectorAll('svg').length,
        dash: r.querySelectorAll('.cell__dash').length,
        allergen: r.querySelectorAll('.cell__allergen').length,
        hidden: s?.getAttribute('aria-hidden') ?? s?.closest('[aria-hidden="true"]')?.getAttribute('aria-hidden') ?? null,
        bar: btn ? getComputedStyle(btn, '::before').backgroundColor : '',
        bg: cs?.backgroundColor ?? '',
        bw: cs ? parseFloat(cs.borderTopWidth) : 0,
        bc: cs?.borderTopColor ?? '',
        numColor: r.querySelector<HTMLElement>('.cell__num') ? getComputedStyle(r.querySelector<HTMLElement>('.cell__num')!).color : '',
      };
    }),
  );
  expect(samples.slice(0, 3).map((s) => s.svg)).toEqual([1, 1, 1]);
  expect(samples[3]!.dash).toBe(1);
  expect(samples[4]!.allergen).toBe(1);
  expect(samples[4]!.svg).toBe(1);
  expect(samples[5]!.bar).toBe(css('light', 'accent'));
  expect(samples[6]!.bg).toBe(css('light', 'navy-fill'));
  expect(samples[7]!.bw).toBe(2);
  expect(samples[7]!.bc).toBe(css('light', 'ink-1'));
  expect(samples[8]!.numColor).toBe(css('light', 'ink-3'));
  for (const s of samples.slice(0, 9)) expect(s.hidden, 'sample is aria-hidden').toBe('true');
  // no assessment symbol, no recipe name, no hatch or dashed frame in the legend
  const body = (await page.locator('#legend-body').textContent()) ?? '';
  for (const w of ['○', '△', '苦手かも', 'たのしめそう', 'くまさん']) expect(body.includes(w), w).toBe(false);
  // open for the session only: a reload shows it closed again
  await page.reload();
  await expect(page.getByTestId('legend-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('US-E5-01/AC15 legend in English, and the ten rows equal the tile states of the matrix (each state the oracle produces has a row)', async ({ page }) => {
  await openHome(page, '2026-11-17', 'en');
  await page.getByTestId('legend-toggle').click();
  const body = page.locator('#legend-body');
  for (const s of ['School lunch day', 'Homemade bento day', 'Maybe a bento? (undecided, decide later)', 'Short red line: bento still to plan (today and later)', '! mark: school lunch day that needs allergen attention (your registered allergens)', 'Red line along the top: a day you changed', 'Filled tile: today', 'Thick frame: tomorrow', 'Grey: past day', 'Sat, Sun, holidays (number colour and "Hol")']) await expect(body).toContainText(s);
  await expect(body).toContainText("The picture under the date is that day's plan. Open a day to see the lunch assessment and the recipe name.");
  // every distinct mark the grid can show exists in the legend: icons (3), dash, allergen mark, top bar, today fill, tomorrow frame, past grey
  const grid = await page.evaluate(() => ({
    icons: new Set(Array.from(document.querySelectorAll('[data-testid^="cal-cell-"]')).map((c) => c.getAttribute('data-icon')).filter((i) => i !== 'none')).size,
    dash: document.querySelectorAll('[data-testid^="cal-cell-"][data-dash="true"]').length > 0,
    allergen: document.querySelectorAll('[data-testid^="cal-cell-"][data-allergen="true"]').length > 0,
    changed: document.querySelectorAll('[data-testid^="cal-cell-"][data-changed="true"]').length > 0,
    today: document.querySelectorAll('[data-today="true"]').length > 0,
    tomorrow: document.querySelectorAll('[data-tomorrow="true"]').length > 0,
    past: document.querySelectorAll('[data-past="true"]').length > 0,
  }));
  expect(grid).toEqual({ icons: 3, dash: true, allergen: true, changed: true, today: true, tomorrow: true, past: true });
  expect(await page.getByTestId('legend-row').count()).toBe(10);
});

// ---------------------------------------------------------------- sticky action bars
function reviewStore(): string {
  const hand = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'menus', 'fixture-menu-2026-11-wdmismatch', 'recorded', 'hand-1.json'), 'utf8'));
  const base: Json = JSON.parse(JSON.stringify(M2));
  base.menus = {};
  base.decisions = {};
  base.overrides = {};
  const extraction = {
    ...hand.response.modelOutput,
    id: 'ext-2026-11-aaaaaaaa',
    source: { kind: 'fixture', filename: 'menu.pdf', sha256: 'a'.repeat(64), byteSize: 1, fetchedAt: '2026-11-02T10:00:00+09:00', model: 'gemini-3.8-flash', promptVersion: 1 },
    extractedAt: '2026-11-02T10:00:00+09:00',
  };
  base.menus['2026-11'] = { month: '2026-11', extractions: [extraction], confirmed: null, pendingReviewExtractionId: extraction.id, ownerId: 'local', createdAt: extraction.extractedAt, updatedAt: extraction.extractedAt };
  return JSON.stringify(base);
}

const BAR_SCREENS: { name: string; hash: string; store: () => string; last: string }[] = [
  { name: 'import', hash: '#/import', store: () => matrixStore('ja'), last: 'import-submit' },
  { name: 'review', hash: '#/review/2026-11', store: reviewStore, last: 'review-confirm' },
  { name: 'profile edit', hash: '#/profile', store: () => matrixStore('ja'), last: '' },
];

for (const sc of BAR_SCREENS) {
  for (const [w, h] of [
    [320, 568],
    [320, 300],
    [390, 844],
    [768, 1024],
    [1280, 800],
  ] as const) {
    test(`US-NF-02/AC3 sticky action bar on ${sc.name} at ${w}x${h}: phone only, safe-area rule, never covers the last field, 40% rule`, async ({ page }) => {
      if (sc.name === 'review' && w >= 768) test.fail(true, 'UIR-D02 (P4): the review footer stays sticky from 768 px; components 17.6 says it is not sticky there');
      await page.clock.setFixedTime(jst10('2026-11-02'));
      await seed(page, sc.store());
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`./${sc.hash}`);
      const bar = page.locator('.action-bar').first();
      await expect(bar).toBeVisible();
      const st = await bar.evaluate((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { position: s.position, bottom: s.bottom, padB: parseFloat(s.paddingBottom), padT: parseFloat(s.paddingTop), h: r.height, border: s.borderTopWidth, shadow: s.boxShadow, bg: s.backgroundColor };
      });
      if (w >= 768) {
        // not sticky at >= 768 (the review footer is a normal footer: components 17.6)
        expect(st.position, `${sc.name} bar position at ${w}`).not.toBe('sticky');
        return;
      }
      if (st.position === 'sticky') {
        expect(st.h, 'a sticky bar never takes more than 40 % of the viewport height').toBeLessThanOrEqual(h * 0.4 + 1);
        expect(st.shadow).toBe('none');
        expect(st.padT).toBeGreaterThanOrEqual(12);
        // safe-area: the declared rule uses env(safe-area-inset-bottom) (a desktop browser cannot simulate the inset)
        const rule = await page.evaluate(() => {
          for (const sheet of Array.from(document.styleSheets)) for (const r of Array.from(sheet.cssRules)) if (r instanceof CSSStyleRule && r.selectorText === '.action-bar') return r.cssText;
          return '';
        });
        expect(rule).toMatch(/safe-area-inset-bottom/);
      } else {
        // it stopped being sticky: it must flow at the end of the content
        expect(['static', 'relative']).toContain(st.position);
      }
      // never covers the last field: focus the last focusable control above the bar after scrolling to the bottom
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const lastField = await page.evaluate(() => {
        const barEl = document.querySelector('.action-bar')!;
        const fields = Array.from(document.querySelectorAll<HTMLElement>('main input:not([type=hidden]), main select, main textarea, main button, main a[href]')).filter((e) => !barEl.contains(e) && e.getBoundingClientRect().width > 0);
        const f = fields[fields.length - 1];
        if (!f) return null;
        f.focus();
        return true;
      });
      expect(lastField).toBe(true);
      await page.waitForTimeout(150);
      const overlap = await page.evaluate(() => {
        const barEl = document.querySelector('.action-bar') as HTMLElement;
        const a = document.activeElement as HTMLElement;
        const b = barEl.getBoundingClientRect();
        const f = a.getBoundingClientRect();
        const covered = getComputedStyle(barEl).position === 'sticky' && f.bottom > b.top + 1 && f.top < b.bottom && f.height > 0;
        return { covered, f: [f.top, f.bottom], b: [b.top, b.bottom] };
      });
      expect(overlap.covered, `the focused last control is covered by the bar ${JSON.stringify(overlap)}`).toBe(false);
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
    });
  }
}

test('US-NF-02/AC2 import focus order: the screen controls come first, the submit button (in the bar) is last', async ({ page }) => {
  await page.clock.setFixedTime(jst10('2026-11-02'));
  await seed(page, matrixStore('ja'));
  await page.goto('./#/import');
  await expect(page.getByTestId('import-submit')).toBeVisible();
  const order = await page.evaluate(async () => {
    const seen: string[] = [];
    (document.activeElement as HTMLElement | null)?.blur();
    const main = document.querySelector('[data-testid="screen-import"]')!.closest('.screen')!;
    const all = Array.from(main.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')).filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('[hidden]'));
    for (const e of all) seen.push(e.getAttribute('data-testid') ?? e.getAttribute('aria-label') ?? e.tagName);
    return seen;
  });
  expect(order[order.length - 1]).toBe('import-submit');
  // and the real Tab key reaches it after every other control of the form
  await page.getByTestId('input-url').focus();
  const reached: string[] = [];
  for (let i = 0; i < 14; i += 1) {
    await page.keyboard.press('Tab');
    reached.push(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute('data-testid') ?? (document.activeElement as HTMLElement).tagName));
    if (reached[reached.length - 1] === 'import-submit' || reached[reached.length - 1] === 'BODY') break;
  }
  const idx = reached.indexOf('import-submit');
  if (idx >= 0) for (const id of ['import-upload', 'import-manual']) if (reached.includes(id)) expect(reached.indexOf(id)).toBeLessThan(idx);
});

// ---------------------------------------------------------------- login
for (const [w, h] of [
  [390, 844],
  [320, 568],
  [768, 1024],
  [1280, 800],
] as const) {
  test(`US-E13-01 UI refresh 17.7 login layout at ${w}x${h}: brand on top, sign-in in the lower part on a phone, one centred 400 px column from 768, no scroll`, async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('bentominder.fake-auth', 'signed-out'));
    await page.setViewportSize({ width: w, height: h });
    await page.goto('./');
    await expect(page.getByTestId('login-google')).toBeVisible();
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    const brand = await page.locator('.auth__brand').boundingBox();
    const btn = (await page.getByTestId('login-google').boundingBox())!;
    const priv = (await page.getByTestId('login-privacy').boundingBox())!;
    expect(btn.height).toBeGreaterThanOrEqual(43.5);
    if (w < 768) {
      expect(brand!.y).toBeLessThan(h / 3 + 40);
      if (h >= 800) {
        expect(btn.y, 'sign-in button in the lower half').toBeGreaterThan(h / 2);
        expect(priv.y + priv.height, 'privacy line above the bottom edge').toBeLessThanOrEqual(h);
      }
    } else {
      const col = (await page.locator('.auth__col').boundingBox())!;
      expect(Math.round(col.width)).toBeLessThanOrEqual(400);
      expect(Math.abs(col.x + col.width / 2 - w / 2)).toBeLessThanOrEqual(2);
      expect(col.y).toBeGreaterThan(40); // vertically centred, not stuck to the top
    }
    // axe: both themes
    for (const theme of ['light', 'dark'] as const) {
      await setScheme(page, theme);
      const { default: AxeBuilder } = await import('@axe-core/playwright');
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    }
  });
}

test('US-NF-03 the refreshed home sends nothing to a third party: calendar, about panel, legend, day sheet and the consent text make no request outside the app origin', async ({ page }) => {
  const origins = new Set<string>();
  const bodies: string[] = [];
  page.on('request', (r) => {
    origins.add(new URL(r.url()).origin);
    if (r.method() !== 'GET') bodies.push(`${r.method()} ${r.url()}`);
  });
  await openHome(page, '2026-11-17', 'ja', 390, 844);
  await page.getByTestId('about-toggle').click();
  await page.getByTestId('about-consent').click();
  await expect(page.locator('[role="dialog"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('legend-toggle').click();
  await page.getByTestId('cal-cell-2026-11-12').getByRole('button').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await page.waitForTimeout(500);
  expect([...origins].filter((o) => o !== 'http://localhost:4173' && o !== 'null' && !o.startsWith('data:'))).toEqual([]);
  expect(bodies, 'no write request while reading the calendar').toEqual([]);
});

test('UIR-O2 [expected to fail until decided] the selected tile (desktop panel open) has no aria-selected (components 18.6: "no aria-selected")', async ({ page }) => {
  test.fail(true, 'UIR-O2 (P4, observation): DayCell sets aria-selected on the gridcell of the open day; components 18.6 says none is added. aria-selected on a gridcell is valid ARIA, so the design text or the code should be aligned');
  await openHome(page, '2026-11-17', 'ja', 1280, 800);
  await page.getByTestId('cal-cell-2026-11-18').getByRole('button').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  expect(await page.getByTestId('cal-cell-2026-11-18').getAttribute('aria-selected')).toBeNull();
});

test('US-NF-02/AC2 login: the sign-in button is keyboard reachable with a visible focus ring', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('bentominder.fake-auth', 'signed-out'));
  await page.goto('./');
  await page.getByTestId('login-google').focus();
  const ring = await page.getByTestId('login-google').evaluate((el) => { const s = getComputedStyle(el); return { style: s.outlineStyle, w: parseFloat(s.outlineWidth) }; });
  expect(ring.style).toBe('solid');
  expect(ring.w).toBeGreaterThanOrEqual(2);
  void wide;
});
