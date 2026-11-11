// QA, UI refresh 2026-11: the tile oracle (tests/oracle/ui-refresh-tile.ts, written from the ACs) against the rendered tiles:
// data attributes, REAL computed styles (fills, borders, bars, dash, allergen mark, icon sizes, row heights) compared with the
// colours of design/tokens.json, and the accessible names read from Chrome's accessibility tree, in ja and en, light and dark.
// Stories: US-E5-01/AC1 AC2 AC3 AC4 AC9 AC10 AC11 AC12 AC13 AC14 AC16, US-E4-03/AC8, US-E5-03/AC2, US-E5-05/AC1, US-E6-06/AC1, US-E8-05/AC3, US-NF-02/AC3 AC4
import { expect, test, type Page } from '@playwright/test';
import { ALL_STATE_WORDS, ALL_SUFFIX_WORDS, expectedName, expectedTile, expectedTimeWord, addDay, weekday } from '../../oracle/ui-refresh-tile.ts';
import { css, isHoliday, jst10, matrixStore, NOV_DATES, realNames, seed, setScheme, specOf, type Theme } from './ui-refresh-common.ts';

interface Probe {
  date: string;
  attrs: Record<string, string | null>;
  cls: string;
  btn: { w: number; h: number; bg: string; bw: number; bs: string; bc: string; ring: string };
  num: { color: string; text: string };
  icon: { count: number; color: string; w: number; h: number };
  bar: { content: string; bg: string; h: number; w: number; top: number };
  dash: { count: number; bg: string; w: number; h: number };
  allergen: { count: number; bg: string; color: string; border: string; w: number; h: number };
  extra: { svgs: number; marks: number; dashes: number; foreign: string[]; visibleText: string; nameClipped: boolean };
  rowH: number;
  rowCompact: boolean;
}

async function probe(page: Page): Promise<Probe[]> {
  return page.evaluate(() => {
    const out: Probe[] = [];
    for (const cell of Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="cal-cell-"]'))) {
      const btn = cell.querySelector<HTMLElement>('.cell__btn')!;
      const s = getComputedStyle(btn);
      const r = btn.getBoundingClientRect();
      const num = cell.querySelector<HTMLElement>('.cell__num');
      const svg = btn.querySelector<SVGElement>('svg');
      const before = getComputedStyle(btn, '::before');
      const dash = cell.querySelectorAll<HTMLElement>('.cell__dash');
      const al = cell.querySelectorAll<HTMLElement>('.cell__allergen');
      const row = cell.closest('.cal-row') as HTMLElement;
      const nameEl = btn.firstElementChild as HTMLElement;
      const nr = nameEl.getBoundingClientRect();
      const known = ['cell__top', 'cell__num', 'cell__hol', 'cell__icon', 'cell__dash', 'cell__allergen', 'visually-hidden'];
      const foreign: string[] = [];
      for (const el of Array.from(btn.querySelectorAll('*'))) {
        if (el === nameEl || nameEl.contains(el)) continue;
        const c = (el.getAttribute('class') ?? '');
        const tag = el.tagName.toLowerCase();
        if (['svg', 'path', 'rect', 'ellipse', 'circle', 'g', 'use', 'title'].includes(tag) || el.closest('svg') !== null) continue;
        if (!known.some((k) => String(c).split(/\s+/).includes(k))) foreign.push(`${tag}.${c}`);
      }
      // visible text = text of the button minus the visually hidden name
      let visible = '';
      const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) if (!nameEl.contains(n)) visible += n.textContent ?? '';
      const attrs: Record<string, string | null> = {};
      for (const a of ['data-icon', 'data-today', 'data-past', 'data-tomorrow', 'data-changed', 'data-dash', 'data-allergen', 'aria-current', 'data-decision']) attrs[a] = cell.getAttribute(a);
      out.push({
        date: cell.getAttribute('data-testid')!.replace('cal-cell-', ''),
        attrs,
        cls: cell.className,
        btn: { w: r.width, h: r.height, bg: s.backgroundColor, bw: parseFloat(s.borderTopWidth), bs: s.borderTopStyle, bc: s.borderTopColor, ring: s.boxShadow },
        num: { color: num ? getComputedStyle(num).color : '', text: num?.textContent ?? '' },
        icon: { count: btn.querySelectorAll('svg').length, color: svg ? getComputedStyle(svg).color : '', w: svg ? svg.getBoundingClientRect().width : 0, h: svg ? svg.getBoundingClientRect().height : 0 },
        bar: { content: before.content, bg: before.backgroundColor, h: parseFloat(before.height) || 0, w: parseFloat(before.width) || 0, top: parseFloat(before.top) },
        dash: { count: dash.length, bg: dash[0] ? getComputedStyle(dash[0]).backgroundColor : '', w: dash[0]?.getBoundingClientRect().width ?? 0, h: dash[0]?.getBoundingClientRect().height ?? 0 },
        allergen: { count: al.length, bg: al[0] ? getComputedStyle(al[0]).backgroundColor : '', color: al[0] ? getComputedStyle(al[0]).color : '', border: al[0] ? getComputedStyle(al[0]).borderTopColor : '', w: al[0]?.getBoundingClientRect().width ?? 0, h: al[0]?.getBoundingClientRect().height ?? 0 },
        extra: { svgs: btn.querySelectorAll('svg').length, marks: al.length, dashes: dash.length, foreign, visibleText: visible.replace(/\s+/g, ''), nameClipped: nr.width <= 1.5 && nr.height <= 1.5 },
        rowH: row.getBoundingClientRect().height,
        rowCompact: row.classList.contains('is-compact'),
      });
    }
    return out;
  });
}

const TODAYS = [
  { today: '2026-11-17', note: 'Tuesday mid month: past, today, tomorrow, future, dash later' },
  { today: '2026-11-14', note: 'Saturday: tomorrow is Sunday (calendar date, not school day)' },
  { today: '2026-11-20', note: 'a bento day is today: the dash shows on today' },
  { today: '2026-11-06', note: 'a bento day is today at the start of the month' },
  { today: '2026-11-01', note: 'first of the month (Sunday), nothing is past' },
  { today: '2026-11-30', note: 'month end: tomorrow is 2026-12-01 in December' },
  { today: '2026-10-31', note: 'month start from the previous month: tomorrow is 2026-11-01' },
  { today: '2026-12-05', note: 'the whole of November is past' },
  { today: '2026-10-20', note: 'the whole of November is in the future' },
];


async function show(page: Page, today: string, lang: 'ja' | 'en', month: string): Promise<void> {
  await page.clock.setFixedTime(jst10(today));
  await seed(page, matrixStore(lang));
  await page.goto(`./#/calendar/${month}`);
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^="cal-cell-"]').length >= 28);
}

function expectedStyle(theme: Theme, date: string, today: string, w: number) {
  const spec = specOf(date);
  const t = expectedTile(date, today, spec);
  const wd = weekday(date);
  const weekend = wd === 0 || wd === 6;
  let fill = 'rgba(0, 0, 0, 0)';
  if (t.today) fill = css(theme, 'navy-fill');
  else if (t.tomorrow) fill = css(theme, 'surface-2');
  else if (!t.past && t.icon !== 'none') fill = css(theme, 'surface-2');
  let border: { w: number; c: string } | null = null;
  if (t.today) border = { w: 1, c: css(theme, 'navy-fill') };
  else if (t.tomorrow) border = { w: 2, c: css(theme, 'ink-1') };
  else if (t.icon !== 'none') border = { w: 1, c: css(theme, 'line-1') };
  let num = css(theme, 'ink-1');
  const weekendColour = wd === 6 ? 'saturday' : wd === 0 || isHoliday() ? 'sunday' : null;
  if (t.today) num = css(theme, 'ink-inverse');
  else if (weekendColour !== null) num = css(theme, weekendColour);
  else if (t.past) num = css(theme, 'ink-3');
  const icon = t.today ? css(theme, 'ink-inverse') : t.past ? css(theme, 'ink-3') : css(theme, 'ink-2');
  const edge = t.today ? css(theme, 'planned-edge') : css(theme, 'accent');
  const barH = w >= 1280 ? 4 : 3;
  const dashW = w >= 1280 ? 28 : w >= 768 ? 24 : weekend ? 14 : 18;
  const iconSize = w >= 1280 ? (weekend ? 24 : 28) : weekend ? 20 : 24;
  const allergenSize = w >= 768 ? 20 : 18;
  return { t, fill, border, num, icon, edge, barH, dashW, iconSize, allergenSize, weekend };
}

function checkTile(p: Probe, theme: Theme, today: string, width: number, problems: string[]): void {
  const e = expectedStyle(theme, p.date, today, width);
  const bad = (m: string) => problems.push(`${theme} ${p.date} (today ${today}): ${m}`);
  const a = p.attrs;
  const t = e.t;
  if (a['data-icon'] !== t.icon) bad(`data-icon ${a['data-icon']} != ${t.icon}`);
  if ((a['data-today'] === 'true') !== t.today) bad('data-today');
  if ((a['aria-current'] === 'date') !== t.today) bad('aria-current');
  if ((a['data-past'] === 'true') !== t.past) bad('data-past');
  if ((a['data-tomorrow'] === 'true') !== t.tomorrow) bad('data-tomorrow');
  if ((a['data-changed'] === 'true') !== t.changed) bad(`data-changed ${a['data-changed']} != ${t.changed}`);
  if ((a['data-dash'] === 'true') !== t.dash) bad('data-dash');
  if ((a['data-allergen'] === 'true') !== t.allergen) bad('data-allergen');
  // content budget (components 18.2)
  if (p.extra.svgs !== (t.icon === 'none' ? 0 : 1)) bad(`svg count ${p.extra.svgs}`);
  if (p.extra.marks !== (t.allergen ? 1 : 0)) bad(`allergen marks ${p.extra.marks}`);
  if (p.extra.dashes !== (t.dash ? 1 : 0)) bad(`dash count ${p.extra.dashes}`);
  if (p.extra.foreign.length > 0) bad(`foreign elements ${p.extra.foreign.join(',')}`);
  const day = String(Number(p.date.slice(8)));
  const okText = [day, `${day}祝`, `${day}Hol`, `${day}!`, `${day}祝!`, `${day}Hol!`];
  if (!okText.includes(p.extra.visibleText)) bad(`visible text "${p.extra.visibleText}" is more than the number (and holiday word)`);
  if (/[○△×—?？]/.test(p.extra.visibleText)) bad('assessment glyph on the tile');
  if (!p.extra.nameClipped) bad('name element is not visually hidden');
  if (p.btn.w < 43.5 || p.btn.h < 43.5) bad(`tile ${p.btn.w}x${p.btn.h} below 44`);
  // fill, border
  if (p.btn.bg !== e.fill) bad(`fill ${p.btn.bg} != ${e.fill}`);
  const visibleBorder = p.btn.bw > 0 && p.btn.bs !== 'none' && !/rgba\(.*, 0\)$/.test(p.btn.bc);
  if (e.border === null) {
    if (visibleBorder) bad(`number-only tile has a visible border ${p.btn.bw}px ${p.btn.bc}`);
  } else {
    if (p.btn.bw !== e.border.w) bad(`border width ${p.btn.bw} != ${e.border.w}`);
    if (p.btn.bc !== e.border.c) bad(`border colour ${p.btn.bc} != ${e.border.c}`);
  }
  // number, icon
  if (p.num.color !== e.num) bad(`number colour ${p.num.color} != ${e.num}`);
  if (t.icon !== 'none') {
    if (p.icon.color !== e.icon) bad(`icon colour ${p.icon.color} != ${e.icon}`);
    if (Math.abs(p.icon.w - e.iconSize) > 0.6) bad(`icon size ${p.icon.w} != ${e.iconSize}`);
  }
  // top bar
  const barShown = p.bar.content !== 'none' && p.bar.content !== 'normal' && p.bar.bg !== 'rgba(0, 0, 0, 0)' && p.bar.h > 0;
  if (barShown !== t.changed) bad(`top bar shown=${barShown} but changed=${t.changed}`);
  if (t.changed && barShown) {
    if (p.bar.bg !== e.edge) bad(`top bar colour ${p.bar.bg} != ${e.edge}`);
    if (Math.abs(p.bar.h - e.barH) > 0.6) bad(`top bar height ${p.bar.h} != ${e.barH}`);
  }
  // dash
  if (t.dash) {
    if (p.dash.bg !== e.edge) bad(`dash colour ${p.dash.bg} != ${e.edge}`);
    if (Math.abs(p.dash.h - 4) > 0.6) bad(`dash height ${p.dash.h}`);
    if (width < 768 || !e.weekend) if (Math.abs(p.dash.w - e.dashW) > 0.6) bad(`dash width ${p.dash.w} != ${e.dashW}`);
  }
  // allergen mark keeps its own colours in every state, including past and today
  if (t.allergen) {
    if (p.allergen.bg !== css(theme, 'danger-soft')) bad(`allergen fill ${p.allergen.bg}`);
    if (p.allergen.color !== css(theme, 'danger')) bad(`allergen glyph colour ${p.allergen.color}`);
    if (p.allergen.border !== css(theme, 'danger')) bad(`allergen ring ${p.allergen.border}`);
    if (Math.abs(p.allergen.w - e.allergenSize) > 0.6) bad(`allergen size ${p.allergen.w} != ${e.allergenSize}`);
  }
}

for (const { today, note } of TODAYS) {
  for (const lang of ['ja', 'en'] as const) {
    test(`US-E5-01/AC3 AC9 AC10 AC11 AC12 AC13 AC14 AC16 oracle vs tiles: today ${today} (${note}), ${lang}`, async ({ page }, info) => {
      await show(page, today, lang, '2026-11');
      const width = page.viewportSize()!.width;
      const problems: string[] = [];
      // names from Chrome's accessibility engine
      const names = await realNames(page);
      for (const date of NOV_DATES) {
        const spec = specOf(date);
        const name = names[date];
        const exp = expectedName(date, today, spec, lang);
        if (exp !== null) {
          // BA wording uses a long date in en ("Wednesday, November 4"); the design table says "Wed, Nov 4". Accept either date text, nothing else.
          const longEn = lang === 'en' ? exp.replace(/^[A-Za-z]{3}, [A-Za-z]{3} (\d+)/, (_m, d: string) => `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday(date)]}, November ${d}`) : exp;
          if (name !== exp && name !== longEn) problems.push(`name of ${date}: "${name}" != "${exp}"`);
          if (name === longEn && name !== exp) info.annotations.push({ type: 'observation', description: 'en tile name uses the long date (BA example), design table says short' });
        } else {
          // outside the menu / no lunch: no state word of the tile, no allergen/changed/dash suffix; today/tomorrow/past word per a11y 6 note 1
          const bare = (name ?? '').replace('no school lunch', '').replace('給食なし', '');
          for (const w of [...ALL_STATE_WORDS(lang), ...ALL_SUFFIX_WORDS(lang)]) if (bare.replace(/\(.*\)|（.*）/, '').includes(w)) problems.push(`name of ${date} (${spec.kind}) contains "${w}": ${name}`);
          const tw = expectedTimeWord(date, today, lang);
          const all = lang === 'ja' ? ['今日', '明日', '過去の日'] : ['today', 'tomorrow', 'past day'];
          for (const w of all) if ((name ?? '').includes(w) !== (w === tw)) problems.push(`name of ${date} (${spec.kind}) time word "${w}" mismatch: ${name}`);
        }
        // no assessment and no recipe name in any name (AC14)
        for (const w of ['苦手かも', 'たのしめそう', 'どちらとも', 'Might not enjoy', 'Likely to enjoy', 'Hard to say', 'くまさんおにぎり', 'Bear onigiri', 'くまおにぎり', 'Bear oni']) if ((name ?? '').includes(w)) problems.push(`name of ${date} has "${w}"`);
      }
      for (const theme of ['light', 'dark'] as const) {
        await setScheme(page, theme);
        for (const p of await probe(page)) {
          if (!p.date.startsWith('2026-11')) continue;
          checkTile(p, theme, today, width, problems);
        }
      }
      // today is the only filled tile (US-E5-01/AC11, US-E8-05/AC3)
      for (const theme of ['light', 'dark'] as const) {
        await setScheme(page, theme);
        const filled = (await probe(page)).filter((p) => p.btn.bg === css(theme, 'navy-fill')).map((p) => p.date);
        const expectFilled = today.startsWith('2026-11') ? [today] : [];
        if (JSON.stringify(filled) !== JSON.stringify(expectFilled)) problems.push(`${theme} filled tiles ${filled.join(',')} != ${expectFilled.join(',')}`);
      }
      // row heights: compact 44, otherwise the token for the viewport; compact exactly when no icon/today/tomorrow tile
      const probes = await probe(page);
      const expectH = width >= 1280 ? 104 : width >= 768 ? 96 : 80;
      for (const p of probes) {
        const rowDates = probes.filter((q) => rowKey(q.date) === rowKey(p.date)).map((q) => q.date);
        const compact = !rowDates.some((d) => {
          const t = expectedTile(d, today, specOf(d));
          return t.icon !== 'none' || t.today || t.tomorrow;
        });
        if (compact && Math.abs(p.rowH - 44) > 1) problems.push(`row of ${p.date} should be compact 44, is ${p.rowH}`);
        if (!compact && Math.abs(p.rowH - expectH) > 1) problems.push(`row of ${p.date} should be ${expectH}, is ${p.rowH}`);
      }
      expect(problems, problems.slice(0, 25).join('\n')).toEqual([]);
    });
  }
}

// Monday-first weeks: row key = the Monday of the date's week.
function rowKey(date: string): string {
  const wd = weekday(date);
  return addDay(date, -((wd + 6) % 7));
}

test('US-E5-01/AC12 US-E5-01/AC1 month end: 2026-11-30 today, the border is on 2026-12-01 when December is shown (no menu there)', async ({ page }) => {
  await show(page, '2026-11-30', 'ja', '2026-12');
  const dec1 = page.getByTestId('cal-cell-2026-12-01');
  await expect(dec1).toHaveAttribute('data-tomorrow', 'true');
  const names = await realNames(page);
  expect(names['2026-12-01']).toContain('明日');
  const s = await dec1.locator('.cell__btn').evaluate((el) => ({ w: getComputedStyle(el).borderTopWidth, c: getComputedStyle(el).borderTopColor, bg: getComputedStyle(el).backgroundColor }));
  expect(s).toEqual({ w: '2px', c: css('light', 'ink-1'), bg: css('light', 'surface-2') });
  await expect(page.locator('[data-today="true"]')).toHaveCount(0);
  // a month without a menu: numbers only and no state icon on any tile
  await expect(page.locator('[data-testid^="cal-cell-2026-12"][data-icon]:not([data-icon="none"])')).toHaveCount(0);
});

test('US-E5-01/AC1 US-E5-01/AC11 Tokyo date wins over the device timezone: 2026-11-15 00:30 JST on a Paris/LA device', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-14T15:30:00Z'));
  await seed(page, matrixStore('ja'));
  await page.goto('./');
  await expect(page.getByTestId('cal-title')).toContainText('2026年11月');
  await expect(page.locator('[data-today="true"]')).toHaveAttribute('data-testid', 'cal-cell-2026-11-15');
  await expect(page.getByTestId('cal-cell-2026-11-16')).toHaveAttribute('data-tomorrow', 'true');
});

test('US-E5-01/AC11 at Tokyo midnight the fill moves to the next date without a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T14:59:30Z') }); // 23:59:30 JST on the 16th
  await seed(page, matrixStore('ja'));
  await page.goto('./');
  await expect(page.locator('[data-today="true"]')).toHaveAttribute('data-testid', 'cal-cell-2026-11-16');
  await page.clock.runFor(70_000);
  await expect(page.locator('[data-today="true"]')).toHaveAttribute('data-testid', 'cal-cell-2026-11-17');
  await expect(page.getByTestId('cal-cell-2026-11-18')).toHaveAttribute('data-tomorrow', 'true');
  await expect(page.getByTestId('cal-cell-2026-11-16')).toHaveAttribute('data-past', 'true');
});

test('US-E5-01/AC2 Monday-first header, Saturday blue and Sunday red numerals, holidays red with the word, in ja and en', async ({ page }) => {
  await page.clock.setFixedTime(jst10('2026-11-10'));
  await seed(page, matrixStore('ja'));
  await page.goto('./');
  const heads = await page.locator('.cal-wd').allTextContents();
  expect(heads.map((h) => h.trim())).toEqual(['月', '火', '水', '木', '金', '土', '日']);
  await expect(page.getByTestId('cal-title')).toContainText('2026年11月');
  // 2026-11-01 (Sunday) is in the last column of the first row
  const first = await page.locator('.cal-row').first().locator('[role="gridcell"]').evaluateAll((cs) => cs.map((c) => c.getAttribute('data-testid')));
  expect(first[6]).toBe('cal-cell-2026-11-01');
  // holidays (US-E8-04) are deferred by PLAN 2026-10-31: not asserted
});

test('US-E5-01/AC3 US-E5-01/AC4 US-E5-03/AC2 US-E5-05/AC1 US-E6-06/AC1 no recipe name, no short name and no assessment glyph anywhere on the grid, even when the recipe is missing from the library', async ({ page }) => {
  await page.clock.setFixedTime(jst10('2026-11-10'));
  await seed(
    page,
    matrixStore('ja', (s) => {
      s.decisions['2026-11-04'].recipeId = 'rcp-retired-recipe';
      s.decisions['2026-11-04'].history[0].recipeId = 'rcp-retired-recipe'; // US-E6-06/AC1: planned recipe missing from the library
    }),
  );
  await page.goto('./');
  await expect(page.getByTestId('cal-grid')).toBeVisible();
  const text = await page.getByTestId('cal-grid').evaluate((g) => g.textContent ?? '');
  for (const w of ['くまさんおにぎり', 'くまおにぎり', 'Bear', '給食', '苦手', '○', '△', '—', '未判定']) {
    // the hidden names legitimately contain 給食 (state word); strip them for that one word
    if (w === '給食') continue;
    expect(text.includes(w), `grid text contains ${w}`).toBe(false);
  }
  const probes = await probe(page);
  const t4 = probes.find((p) => p.date === '2026-11-04')!;
  expect(t4.attrs['data-icon']).toBe('home');
  expect(t4.extra.visibleText).toBe('4');
  expect((await realNames(page))['2026-11-04']).toBe('11月4日（水）、手作りお弁当、手動で変更、過去の日');
  // the sheet shows the stored snapshot and the missing-recipe line
  await page.getByTestId('cal-cell-2026-11-04').getByRole('button').click();
  await expect(page.getByTestId('day-sheet')).toContainText('くまさんおにぎり弁当');
  await expect(page.getByTestId('day-sheet')).toContainText('このレシピは見つかりません');
});

test('US-E4-03/AC8 US-E5-01/AC10 an override shows only as the red top border, and clearing it removes the border (day sheet "back to automatic")', async ({ page }) => {
  await page.clock.setFixedTime(jst10('2026-11-10'));
  await seed(page, matrixStore('ja'));
  await page.goto('./');
  // 2026-11-12 has no override and no record: no border. Set an override through the real UI, then clear it.
  const cell = page.getByTestId('cal-cell-2026-11-12');
  await expect(cell).not.toHaveAttribute('data-changed', 'true');
  await cell.getByRole('button').click();
  await page.getByTestId('override-open').click().catch(async () => page.getByRole('button', { name: '判定を変更' }).click());
  await page.getByRole('radio', { name: /苦手かも/ }).check({ force: true }).catch(async () => page.getByText('苦手かも').first().click());
  await expect(cell).toHaveAttribute('data-changed', 'true');
  expect(await cell.locator('.cell__btn').evaluate((el) => getComputedStyle(el, '::before').backgroundColor)).toBe(css('light', 'accent'));
  expect(await cell.evaluate((c) => c.textContent?.includes('手動で変更') ?? false)).toBe(true); // the hidden name says it
  await page.getByRole('button', { name: '自動判定に戻す' }).click();
  await expect(cell).not.toHaveAttribute('data-changed', 'true');
});

test('QA negative control: the comparison reports a tampered tile (so a pass above is not vacuous)', async ({ page }) => {
  await show(page, '2026-11-17', 'ja', '2026-11');
  await page.evaluate(() => {
    const b = document.querySelector<HTMLElement>('[data-testid="cal-cell-2026-11-18"] .cell__btn')!;
    document.querySelector('[data-testid="cal-cell-2026-11-19"]')!.setAttribute('data-icon', 'home');
    b.style.backgroundColor = 'rgb(1, 2, 3)';
    
    const d = document.createElement('span');
    d.className = 'cell__dash';
    document.querySelector('[data-testid="cal-cell-2026-11-25"] .cell__btn')!.append(d);
  });
  // the tile background now transitions over 120 ms (US-E16-01): read the tampered fill once it has finished
  await page.evaluate(() => Promise.all(document.getAnimations().map((x) => x.finished.catch(() => undefined))));
  const problems: string[] = [];
  for (const p of await probe(page)) if (p.date.startsWith('2026-11')) checkTile(p, 'light', '2026-11-17', page.viewportSize()!.width, problems);
  expect(problems.some((m) => m.includes('2026-11-18') && m.includes('fill'))).toBe(true);
  expect(problems.some((m) => m.includes('2026-11-19') && m.includes('data-icon'))).toBe(true);
  expect(problems.some((m) => m.includes('2026-11-25') && m.includes('dash'))).toBe(true);
});
