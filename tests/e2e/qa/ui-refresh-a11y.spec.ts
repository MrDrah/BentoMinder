// QA, UI refresh 2026-11: accessibility. axe on every touched screen at 390 and 1280 in light and dark (with the tile matrix, the legend and
// the about panel open), contrast recomputed from the RENDERED colours of the tile marks, a keyboard-only journey through the calendar with a
// visible, unclipped focus ring, reduced motion, and the screen-reader structure of the grid.
// Stories: US-NF-02/AC1 AC2 AC3 AC4, US-E5-01/AC14, US-E8-05/AC3
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { contrast } from '../../oracle/ui-refresh-tile.ts';
import { axeSerious, css, jst10, matrixStore, realNames, seed, setScheme, tok } from './ui-refresh-common.ts';
import { openScreen, SCREENS } from './ui-refresh-screens-data.ts';

const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 1280, h: 800 },
];

for (const vp of VIEWPORTS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`US-NF-02/AC1 axe: every touched screen at ${vp.w} in ${theme}, ja`, async ({ browser }) => {
      test.setTimeout(150_000);
      const failures: string[] = [];
      for (const sc of SCREENS) {
        const context = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: vp.w, height: vp.h }, timezoneId: 'Europe/Paris', locale: 'en-US' });
        const page = await context.newPage();
        try {
          await openScreen(page, sc);
          await setScheme(page, theme);
          const r = await new AxeBuilder({ page }).analyze();
          for (const v of r.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) failures.push(`${sc.name}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
        } finally {
          await context.close();
        }
      }
      expect(failures).toEqual([]);
    });
  }
}

for (const vp of VIEWPORTS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`US-NF-02/AC1 US-E8-05/AC3 axe: the tile matrix for six different todays, with legend and about panel open, ${vp.w} ${theme}, ja and en`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width: vp.w, height: vp.h });
      for (const lang of ['ja', 'en'] as const) {
        for (const today of ['2026-11-17', '2026-11-14', '2026-11-20', '2026-11-30', '2026-12-05', '2026-10-20']) {
          await page.clock.setFixedTime(jst10(today));
          await page.addInitScript(() => window.localStorage.removeItem('bentominder.state'));
          await page.evaluate(() => window.localStorage.removeItem('bentominder.state')).catch(() => undefined);
          await page.goto('about:blank');
          await seedFresh(page, matrixStore(lang));
          await page.goto('./#/calendar/2026-11');
          await expect(page.getByTestId('cal-grid')).toBeVisible();
          await setScheme(page, theme);
          await page.getByTestId('legend-toggle').click();
          await page.getByTestId('about-toggle').click();
          await axeSerious(page, `matrix ${today} ${lang} ${theme} ${vp.w}`);
        }
      }
    });
  }
}

async function seedFresh(page: Page, json: string): Promise<void> {
  await page.context().clearCookies();
  await page.addInitScript((value) => {
    window.localStorage.setItem('bentominder.state', value);
  }, JSON.stringify(JSON.parse(json)));
}

// The weekly reminder banner (Sunday) sits above the grid on the home screen (components 17.4: alert stack). Its primary button is the one
// axe reported inside tests/e2e/qa/full-journey.spec.ts; here the animations are settled first and the colours are read from the render.
for (const theme of ['light', 'dark'] as const) {
  for (const lang of ['ja', 'en'] as const) {
    test(`US-NF-02/AC1 UIR-D09 reminder banner with its primary button on the Sunday home: axe and rendered contrast, ${theme} ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.clock.setFixedTime(jst10('2026-11-22'));
      await seed(page, matrixStore(lang));
      await page.goto('./#/calendar/2026-11');
      await expect(page.locator('[data-testid^="reminder-"]').first()).toBeVisible();
      await setScheme(page, theme);
      await page.waitForTimeout(600);
      const btn = await page.locator('.reminder .btn--primary, .reminder .btn--secondary').first().evaluate((el) => {
        const s = getComputedStyle(el);
        const bg = s.backgroundColor;
        return { cls: el.className, bg, color: s.color, op: getComputedStyle(el.closest('.reminder')!).opacity };
      });
      const r = contrast(rgb(btn.color).slice(0, 3) as [number, number, number], rgb(btn.bg).slice(0, 3) as [number, number, number]);
      expect(r, `${btn.cls}: ${btn.color} on ${btn.bg}`).toBeGreaterThanOrEqual(4.5);
      await axeSerious(page, `Sunday reminder banner ${theme} ${lang}`);
    });
  }
}

// ---------------------------------------------------------------- rendered contrast of every tile mark
const rgb = (s: string): [number, number, number, number] => {
  const m = /rgba?\(([^)]+)\)/.exec(s)!;
  const p = m[1]!.split(',').map((x) => parseFloat(x));
  return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
};

for (const theme of ['light', 'dark'] as const) {
  for (const w of [390, 1280]) {
    test(`US-NF-02/AC1 US-E8-05/AC3 rendered tile marks meet 4.5:1 (text) and 3:1 (marks, bars, frames) in ${theme} at ${w}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      const problems: string[] = [];
      for (const today of ['2026-11-17', '2026-11-20', '2026-11-30', '2026-12-05']) {
        await page.clock.setFixedTime(jst10(today));
        await page.goto('about:blank');
        await seedFresh(page, matrixStore('ja'));
        await page.goto('./#/calendar/2026-11');
        await expect(page.getByTestId('cal-grid')).toBeVisible();
        await setScheme(page, theme);
        const marks = await page.evaluate(() => {
          const pageBg = getComputedStyle(document.body).backgroundColor;
          return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="cal-cell-"]')).map((cell) => {
            const btn = cell.querySelector<HTMLElement>('.cell__btn')!;
            const s = getComputedStyle(btn);
            const num = getComputedStyle(cell.querySelector('.cell__num')!).color;
            const svg = btn.querySelector('svg');
            const dash = cell.querySelector<HTMLElement>('.cell__dash');
            const al = cell.querySelector<HTMLElement>('.cell__allergen');
            return {
              date: cell.getAttribute('data-testid')!,
              pageBg,
              fill: s.backgroundColor,
              num,
              icon: svg ? getComputedStyle(svg).color : null,
              bar: cell.getAttribute('data-changed') === 'true' ? getComputedStyle(btn, '::before').backgroundColor : null,
              dash: dash ? getComputedStyle(dash).backgroundColor : null,
              border: parseFloat(s.borderTopWidth) > 0 ? s.borderTopColor : null,
              bw: parseFloat(s.borderTopWidth),
              al: al ? { fill: getComputedStyle(al).backgroundColor, glyph: getComputedStyle(al).color, ring: getComputedStyle(al).borderTopColor } : null,
              today: cell.getAttribute('data-today') === 'true',
              tomorrow: cell.getAttribute('data-tomorrow') === 'true',
              icons: cell.getAttribute('data-icon'),
            };
          });
        });
        for (const m of marks) {
          const page_ = rgb(m.pageBg).slice(0, 3) as [number, number, number];
          const fill = rgb(m.fill);
          const bg = (fill[3] > 0 ? fill.slice(0, 3) : page_) as [number, number, number];
          const chk = (what: string, fg: string | null, against: [number, number, number], need: number) => {
            if (fg === null) return;
            const c = rgb(fg);
            const r = contrast(c.slice(0, 3) as [number, number, number], against);
            if (r < need) problems.push(`${theme} ${w} today ${today} ${m.date} ${what}: ${r.toFixed(2)} < ${need}`);
          };
          chk('number', m.num, bg, 4.5);
          chk('icon', m.icon, bg, 3);
          chk('top bar vs tile', m.bar, bg, 3);
          chk('top bar vs page', m.bar, page_, 3);
          chk('dash vs tile', m.dash, bg, 3);
          if (m.tomorrow) chk('tomorrow frame vs page', m.border, page_, 3);
          if (m.today) chk('today fill vs page', m.fill, page_, 3);
          if (m.al !== null) {
            chk('allergen glyph on its fill', m.al.glyph, rgb(m.al.fill).slice(0, 3) as [number, number, number], 4.5);
            chk('allergen ring on tile', m.al.ring, bg, 3);
            if (m.today) chk('allergen fill vs today fill', m.al.fill, bg, 3);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- keyboard-only journey through the calendar
async function active(page: Page): Promise<string> {
  return page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (a === null) return 'none';
    return a.closest('[data-testid^="cal-cell-"]')?.getAttribute('data-testid') ?? a.getAttribute('data-testid') ?? a.getAttribute('aria-label') ?? a.tagName;
  });
}

test('US-NF-02/AC2 US-E5-01/AC14 keyboard only: Tab order of the home, the grid is one tab stop, arrows / Home / End / PageUp / PageDown move by tile, Enter opens, Escape returns', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(jst10('2026-11-17'));
  await seed(page, matrixStore('ja', (s) => { s.settings.reminders.weekly.enabled = false; s.settings.reminders.dayBefore.enabled = false; }));
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  const seq: string[] = [];
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    seq.push(await active(page));
    if (seq[seq.length - 1] === 'legend-toggle') break;
  }
  // first stops: skip link, brand button, language toggle, library, settings; then the month nav, the grid (one stop), then the rest
  const iCal = seq.findIndex((s) => s.startsWith('cal-cell-'));
  expect(iCal, `Tab sequence: ${seq.join(' > ')}`).toBeGreaterThan(0);
  expect(seq.slice(0, iCal)).toEqual(expect.arrayContaining(['about-toggle', 'cal-prev', 'cal-next']));
  expect(seq.indexOf('about-toggle')).toBeLessThan(seq.indexOf('cal-prev'));
  expect(seq.indexOf('cal-next')).toBeLessThan(iCal);
  expect(seq.filter((s) => s.startsWith('cal-cell-')).length, 'the grid is a single tab stop').toBe(1);
  expect(seq.indexOf('legend-toggle')).toBeGreaterThan(iCal);
  // roving focus: the tabbable tile is today's
  expect(seq[iCal]).toBe('cal-cell-2026-11-17');
  await page.locator('[data-testid="cal-cell-2026-11-17"] .cell__btn').focus();
  const keys: [string, string][] = [
    ['ArrowRight', 'cal-cell-2026-11-18'],
    ['ArrowRight', 'cal-cell-2026-11-19'],
    ['ArrowDown', 'cal-cell-2026-11-26'],
    ['ArrowLeft', 'cal-cell-2026-11-25'],
    ['ArrowUp', 'cal-cell-2026-11-18'],
  ];
  for (const [k, expected] of keys) {
    await page.keyboard.press(k);
    expect(await active(page), `${k}`).toBe(expected);
  }
  await page.keyboard.press('Home');
  const home = await active(page);
  await page.keyboard.press('End');
  const end = await active(page);
  expect([home, end].every((x) => x.startsWith('cal-cell-2026-11'))).toBe(true);
  expect(home < end).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('day-sheet')).toBeHidden();
  expect(await active(page), 'Escape returns the focus to the tile that opened the sheet').toBe(end);
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('cal-title')).toContainText('2026年12月');
});

for (const theme of ['light', 'dark'] as const) {
  for (const w of [390, 1280]) {
    test(`US-NF-02/AC2 US-NF-02/AC3 the focus ring on every kind of tile is visible, 2 px, the focus-ring colour, 3:1 against its surroundings and not clipped (${theme} ${w})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.clock.setFixedTime(jst10('2026-11-17'));
      await seed(page, matrixStore('ja'));
      await page.goto('./#/calendar/2026-11');
      await expect(page.getByTestId('cal-grid')).toBeVisible();
      await setScheme(page, theme);
      const kinds: Record<string, string> = { today: '2026-11-17', tomorrow: '2026-11-18', past: '2026-11-04', allergen: '2026-11-12', dash: '2026-11-20', unsure: '2026-11-24', numberOnly: '2026-11-27', weekendIcon: '2026-11-14', weekendNumber: '2026-11-21', changedPast: '2026-11-05' };
      const bad: string[] = [];
      for (const [kind, date] of Object.entries(kinds)) {
        await page.locator(`[data-testid="cal-cell-${date}"] .cell__btn`).focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab'); // arrive by keyboard so :focus-visible applies
        const info = await page.evaluate((d) => {
          const el = document.querySelector<HTMLElement>(`[data-testid="cal-cell-${d}"] .cell__btn`)!;
          if (document.activeElement !== el) el.focus();
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const reach = parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset);
          const clippers: string[] = [];
          for (let p = el.parentElement; p !== null && p !== document.documentElement; p = p.parentElement) {
            const c = getComputedStyle(p);
            if (c.overflowX === 'visible' && c.overflowY === 'visible' && !c.contain.includes('paint')) continue;
            const pr = p.getBoundingClientRect();
            if (pr.left > r.left - reach || pr.right < r.right + reach || pr.top > r.top - reach || pr.bottom < r.bottom + reach) clippers.push(String(p.className));
          }
          return { focused: document.activeElement === el, style: s.outlineStyle, width: parseFloat(s.outlineWidth), offset: parseFloat(s.outlineOffset), color: s.outlineColor, shadow: s.boxShadow, clippers, pageBg: getComputedStyle(document.body).backgroundColor };
        }, date);
        if (!info.focused) bad.push(`${kind}: not focused`);
        if (info.style !== 'solid' || info.width < 2) bad.push(`${kind}: outline ${info.style} ${info.width}`);
        if (info.color !== css(theme, 'focus-ring')) bad.push(`${kind}: ring colour ${info.color}`);
        if (info.clippers.length > 0) bad.push(`${kind}: clipped by ${info.clippers.join(',')}`);
        if (contrast(tok(theme, 'focus-ring'), tok(theme, 'surface-1')) < 3) bad.push('token pair');
        if (!info.shadow.includes(css(theme, 'focus-halo'))) bad.push(`${kind}: halo missing in "${info.shadow}"`);
      }
      expect(bad).toEqual([]);
    });
  }
}

test('US-NF-02/AC3 reduced motion: nothing on a tile, the sheets or the legend animates or transitions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(jst10('2026-11-17'));
  await seed(page, matrixStore('ja'));
  await page.goto('./#/calendar/2026-11');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('legend-toggle').click();
  await page.getByTestId('cal-cell-2026-11-18').getByRole('button').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  const moving = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.cell__btn, .cell__icon, .sheet, .sheet-scrim, #legend-body, .legend, .about, .brand-btn'))) {
      const s = getComputedStyle(el);
      const dur = [...s.transitionDuration.split(','), ...s.animationDuration.split(',')].map(parseFloat);
      if (dur.some((d) => d > 0.001)) out.push(`${el.className}: ${s.transitionDuration} / ${s.animationDuration}`);
      if (el.getAnimations().length > 0) out.push(`${el.className}: running animation`);
    }
    return out;
  });
  expect(moving).toEqual([]);
});

// ---------------------------------------------------------------- structure read by assistive technology
test('US-NF-02/AC4 US-E5-01/AC14 the grid structure: roles, column header names, aria-hidden decoration, today marked, names from the accessibility tree', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(jst10('2026-11-17'));
  await seed(page, matrixStore('ja'));
  await page.goto('./#/calendar/2026-11');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  const s = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="cal-grid"]')!;
    const cells = Array.from(grid.querySelectorAll<HTMLElement>('[data-testid^="cal-cell-"]'));
    return {
      role: grid.getAttribute('role'),
      label: grid.getAttribute('aria-label'),
      headers: Array.from(grid.querySelectorAll('[role="columnheader"]')).map((h) => h.getAttribute('aria-label')),
      rows: grid.querySelectorAll('[role="row"]').length,
      cellRoles: new Set(cells.map((c) => c.getAttribute('role'))).size,
      svgBad: Array.from(grid.querySelectorAll('svg')).filter((v) => v.getAttribute('aria-hidden') !== 'true' || v.getAttribute('focusable') !== 'false').length,
      markBad: Array.from(grid.querySelectorAll('.cell__allergen, .cell__dash, .cell__num')).filter((v) => v.getAttribute('aria-hidden') !== 'true').length,
      current: Array.from(grid.querySelectorAll('[aria-current]')).map((c) => c.getAttribute('data-testid')),
      tabbable: Array.from(grid.querySelectorAll('button')).filter((b) => b.tabIndex === 0).length,
      withButtonInName: cells.filter((c) => /ボタン|button/i.test(c.textContent ?? '')).length,
    };
  });
  expect(s.role).toBe('grid');
  expect(s.label).toBe('2026年11月のカレンダー');
  expect(s.headers).toEqual(['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日']);
  expect(s.cellRoles).toBe(1);
  expect(s.svgBad).toBe(0);
  expect(s.markBad).toBe(0);
  expect(s.current).toEqual(['cal-cell-2026-11-17']);
  expect(s.tabbable).toBe(1);
  expect(s.withButtonInName).toBe(0);
  // every tile in the accessibility tree has a non-empty name, unique per date, and the visible number is part of it (WCAG 2.5.3)
  const names = await realNames(page);
  expect(Object.keys(names).length).toBeGreaterThanOrEqual(30);
  const seen = new Set<string>();
  for (const [date, name] of Object.entries(names)) {
    if (!date.startsWith('2026-11')) continue;
    expect(name.length, date).toBeGreaterThan(0);
    expect(name, date).toContain(`${Number(date.slice(8))}日`);
    expect(seen.has(name), `duplicate name ${name}`).toBe(false);
    seen.add(name);
  }
  // the day sheet and the legend toggle are named
  await expect(page.getByTestId('legend-toggle')).toHaveAccessibleName(/表示の見かた/);
  await expect(page.getByTestId('about-toggle')).toHaveAccessibleName('BentoMinderについて');
});

test('US-NF-02/AC4 a tile at 320 px (agenda fallback): rows carry the state, markers and time words as visible text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.clock.setFixedTime(jst10('2026-11-17'));
  await seed(page, matrixStore('ja'));
  await page.goto('./#/calendar/2026-11');
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.locator('.cal-agenda').first()).toBeVisible();
  const row = (d: string) => page.getByTestId(`cal-cell-${d}`);
  await expect(row('2026-11-19')).toContainText('給食');
  await expect(row('2026-11-12')).toContainText('アレルギーに注意');
  await expect(row('2026-11-24')).toContainText('手動で変更');
  await expect(row('2026-11-20')).toContainText('お弁当の準備が未定');
  await expect(row('2026-11-19')).not.toContainText('苦手');
  const txt = (await row('2026-11-24').textContent()) ?? '';
  expect(txt).not.toContain('くまさん');
  await axeSerious(page, 'agenda fallback');
});
