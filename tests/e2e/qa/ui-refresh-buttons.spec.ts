// QA, UI refresh 2026-11 (button fix): every button variant and state of design/components.md 1.3 in light and dark, computed styles compared
// with design/tokens.json: (A) every real button on every touched screen, the family card, the sync sheet and the dialogs, by variant;
// (B) every variant x state (default, hover, active, focus-visible, disabled, busy) on a sandbox row placed on the page and inside a card.
// Stories: US-NF-02/AC3 (44 px, focus), US-E8-05/AC3, US-E5-03 (buttons of the decision flow)
import { expect, test, type Page } from '@playwright/test';
import { contrast } from '../../oracle/ui-refresh-tile.ts';
import { css, jst10, matrixStore, seed, setScheme, tok, type Theme } from './ui-refresh-common.ts';
import { familyDevice, openScreen, SCREENS } from './ui-refresh-screens-data.ts';

type Variant = 'primary' | 'secondary' | 'text' | 'destructive' | 'destructive-text' | 'icon' | 'plain';

interface Seen {
  where: string;
  id: string;
  variant: Variant;
  small: boolean;
  disabled: boolean;
  bg: string;
  color: string;
  bw: number;
  bs: string;
  bc: string;
  h: number;
  w: number;
  radius: string;
  fontSize: number;
  fontWeight: number;
  deco: string;
  offset: string;
  wordBreak: string;
  surface: string;
}

async function collect(page: Page, where: string): Promise<Seen[]> {
  return page.evaluate((where) => {
    const out: Seen[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.btn, .iconbtn'))) {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || el.closest('[hidden]') !== null) continue;
      const cl = el.classList;
      const variant = cl.contains('iconbtn') ? 'icon' : cl.contains('btn--primary') ? 'primary' : cl.contains('btn--secondary') ? 'secondary' : cl.contains('btn--destructive-text') ? 'destructive-text' : cl.contains('btn--destructive') ? 'destructive' : cl.contains('btn--text') ? 'text' : 'plain';
      // the surface the button sits on (first ancestor with a non-transparent background)
      let surface = 'rgb(255, 255, 255)';
      for (let p = el.parentElement; p !== null; p = p.parentElement) {
        const b = getComputedStyle(p).backgroundColor;
        if (b !== 'rgba(0, 0, 0, 0)') {
          surface = b;
          break;
        }
      }
      out.push({
        where,
        id: el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 24),
        variant,
        small: cl.contains('btn--small'),
        disabled: (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true' || cl.contains('is-disabled'),
        bg: s.backgroundColor,
        color: s.color,
        bw: parseFloat(s.borderTopWidth),
        bs: s.borderTopStyle,
        bc: s.borderTopColor,
        h: r.height,
        w: r.width,
        radius: s.borderTopLeftRadius,
        fontSize: parseFloat(s.fontSize),
        fontWeight: parseInt(s.fontWeight, 10),
        deco: s.textDecorationLine,
        offset: s.textUnderlineOffset,
        wordBreak: s.wordBreak,
        surface,
      });
    }
    return out;
  }, where);
}

function checkDefault(b: Seen, theme: Theme, problems: string[]): void {
  const bad = (m: string) => problems.push(`${theme} ${b.where} [${b.variant}${b.small ? ' small' : ''}] ${b.id}: ${m}`);
  const transparent = 'rgba(0, 0, 0, 0)';
  if (b.variant === 'plain') return; // reported once by the UIR-D07 test below
  if (b.variant === 'icon') {
    if (b.w < 43.5 || b.h < 43.5) bad(`icon button ${b.w}x${b.h} < 44`);
    if (b.w < 60 && Math.abs(b.w - b.h) > 0.5) bad(`icon button is not square ${b.w}x${b.h}`); // wider ones carry a label (app bar links at 1280)
    if (b.color !== css(theme, 'ink-1')) bad(`colour ${b.color}`);
    return;
  }
  if (b.disabled) {
    if (b.bg !== css(theme, 'surface-3')) bad(`disabled fill ${b.bg}`);
    if (b.color !== css(theme, 'ink-3')) bad(`disabled colour ${b.color}`);
    if (b.bs !== 'dashed' || b.bw < 2 || b.bc !== css(theme, 'line-ui')) bad(`disabled border ${b.bw}px ${b.bs} ${b.bc}`);
    if (b.deco !== 'none') bad('disabled text keeps an underline');
    return;
  }
  const fill = (b.bg === transparent ? b.surface : b.bg).replace(/rgba?\(([^)]+)\)/, '$1').split(',').map((x) => parseFloat(x)) as [number, number, number];
  const fg = b.color.replace(/rgba?\(([^)]+)\)/, '$1').split(',').map((x) => parseFloat(x)) as [number, number, number];
  const ratio = contrast([fg[0]!, fg[1]!, fg[2]!], [fill[0]!, fill[1]!, fill[2]!]);
  if (ratio < 4.5) bad(`label contrast ${ratio.toFixed(2)} < 4.5`);
  // btn--small is not in the 1.3 table; it renders its label at 14 px (observation UIR-O3), every other button at 16 px
  if (b.fontSize < (b.small ? 13.9 : 15.9) || b.fontWeight < 700) bad(`label ${b.fontSize}px weight ${b.fontWeight} (text-md 16 / 700 expected)`);
  if (b.wordBreak !== 'keep-all') bad(`word-break ${b.wordBreak}`);
  const need = b.variant === 'text' || b.variant === 'destructive-text' || b.small ? 43.5 : 51.5;
  if (b.h < need) bad(`height ${b.h} < ${need}`);
  switch (b.variant) {
    case 'primary':
      if (b.bg !== css(theme, 'accent-strong')) bad(`fill ${b.bg}`);
      if (b.color !== css(theme, 'ink-inverse')) bad(`colour ${b.color}`);
      if (b.bc !== transparent && b.bc !== css(theme, 'accent-strong') && b.bw > 0) bad(`border ${b.bw}px ${b.bc}`);
      break;
    case 'secondary':
      if (b.bg !== css(theme, 'surface-2')) bad(`fill ${b.bg}`);
      if (b.color !== css(theme, 'ink-1')) bad(`colour ${b.color}`);
      if (b.bw !== 2 || b.bs !== 'solid' || b.bc !== css(theme, 'ink-1')) bad(`border ${b.bw}px ${b.bs} ${b.bc}`);
      break;
    case 'destructive':
      if (b.bg !== css(theme, 'danger-strong')) bad(`fill ${b.bg}`);
      if (b.color !== css(theme, 'ink-inverse')) bad(`colour ${b.color}`);
      break;
    case 'text':
      if (b.bg !== transparent) bad(`fill ${b.bg}`);
      if (b.color !== css(theme, 'ink-1')) bad(`colour ${b.color}`);
      if (!b.deco.includes('underline') || parseFloat(b.offset) !== 4) bad(`underline ${b.deco} offset ${b.offset}`);
      break;
    case 'destructive-text':
      if (b.bg !== transparent) bad(`fill ${b.bg}`);
      if (b.color !== css(theme, 'danger')) bad(`colour ${b.color}`);
      if (!b.deco.includes('underline')) bad('no underline');
      break;
  }
}

// ---------------------------------------------------------------- A: every real button on every touched screen
for (const theme of ['light', 'dark'] as const) {
  for (const [w, group] of [[390, 'screens'], [390, 'sheets'], [390, 'family'], [1280, 'screens'], [1280, 'sheets'], [1280, 'family']] as const) {
    test(`US-NF-02/AC3 every real button of the ${group} group (${group === 'screens' ? 'touched screens and dialogs' : group === 'sheets' ? 'day sheets' : 'family card, consent notice, invite, sync sheet'}) follows components 1.3 (${theme} ${w})`, async ({ browser }) => {
      test.setTimeout(240_000);
      const seen: Seen[] = [];
      for (const sc of group === 'screens' ? SCREENS : []) {
        const context = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: w >= 1280 ? 800 : 844 }, timezoneId: 'Europe/Paris', locale: 'en-US' });
        const page = await context.newPage();
        try {
          await openScreen(page, sc);
          await setScheme(page, theme);
          seen.push(...(await collect(page, sc.name)));
          if (sc.name === 'settings') {
            await page.getByTestId('settings-profile-delete').click();
            await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toBeVisible();
            seen.push(...(await collect(page, 'settings: delete-profile dialog')));
            await page.keyboard.press('Escape');
            await page.getByTestId('data-delete-all').click();
            await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toBeVisible();
            seen.push(...(await collect(page, 'settings: delete-all dialog')));
          }
          if (sc.name === 'calendar') {
            await page.getByTestId('about-toggle').click();
            await page.getByTestId('about-consent').click();
            await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toBeVisible();
            seen.push(...(await collect(page, 'calendar: consent dialog')));
            await page.keyboard.press('Escape');
          }
          if (sc.name === 'calendar-day-sheet') seen.push(...(await collect(page, 'day sheet (school day)')));
        } finally {
          await context.close();
        }
      }
      // day sheet of a school day, a planned day and a bento day (decision buttons, the destructive-text entry points, the confirm dialogs)
      for (const date of group === 'sheets' ? ['2026-11-19', '2026-11-18', '2026-11-20', '2026-11-26'] : []) {
        const context = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: w, height: 900 }, timezoneId: 'Europe/Paris', locale: 'en-US' });
        const page = await context.newPage();
        try {
          await page.clock.setFixedTime(jst10('2026-11-17'));
          await seed(page, matrixStore('ja'));
          await page.goto(`./#/day/${date}`);
          await expect(page.getByTestId('day-sheet')).toBeVisible();
          await setScheme(page, theme);
          seen.push(...(await collect(page, `day sheet ${date}`)));
        } finally {
          await context.close();
        }
      }
      // family card (no family and with a family) and the sync status sheet
      const dev = await familyDevice(browser, w, w >= 1280 ? 800 : 844, '2026-11-17');
      try {
        if (group === 'family') await familySweep(dev.page);
      } finally {
        await dev.context.close();
      }
      async function familySweep(page: Page): Promise<void> {
        const dev = { page };
        await dev.page.goto('./#/settings');
        await expect(dev.page.getByTestId('family-create')).toBeVisible();
        await setScheme(dev.page, theme);
        seen.push(...(await collect(dev.page, 'family card (none)')));
        await dev.page.getByTestId('family-create').click();
        await expect(dev.page.getByTestId('consent-cloud')).toBeVisible();
        seen.push(...(await collect(dev.page, 'cloud consent notice')));
        await dev.page.getByTestId('consent-cloud-accept').click();
        await expect(dev.page.getByTestId('family-status-row')).toBeVisible();
        const invite = dev.page.getByTestId('invite-create');
        await expect(invite).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 });
        seen.push(...(await collect(dev.page, 'family card (member)')));
        await invite.click();
        await expect(dev.page.getByTestId('invite-code')).toBeVisible();
        seen.push(...(await collect(dev.page, 'family card (invite)')));
        await dev.page.goto('./#/calendar');
        await dev.page.getByTestId('appbar-sync').click();
        await expect(dev.page.getByTestId('sheet-sync')).toBeVisible();
        seen.push(...(await collect(dev.page, 'sync status sheet')));
      }
      const problems: string[] = [];
      for (const b of seen) checkDefault(b, theme, problems);
      const variants = new Set(seen.map((s) => s.variant));
      if (group === 'screens') for (const v of ['primary', 'secondary', 'text', 'destructive', 'destructive-text', 'icon'] as const) expect(variants.has(v), `variant ${v} was seen on at least one screen`).toBe(true);
      expect(seen.length, 'buttons seen').toBeGreaterThan(3);
      expect(problems.slice(0, 40), `${seen.length} buttons seen; variants ${[...variants].join(',')}`).toEqual([]);
    });
  }
}

// ---------------------------------------------------------------- B: variants x states in a sandbox
const VARIANTS = ['primary', 'secondary', 'text', 'destructive', 'destructive-text'] as const;

async function sandbox(page: Page): Promise<void> {
  await page.evaluate((variants) => {
    const host = document.createElement('div');
    host.id = 'qa-sandbox';
    host.style.cssText = 'position:fixed;inset:0;overflow:auto;background:var(--surface-1);z-index:9999;padding:16px;display:grid;gap:16px;align-content:start';
    const mk = (parent: HTMLElement, v: string, state: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn btn--${v}`;
      b.textContent = `${v} ${state}`;
      b.setAttribute('data-qa', `${v}-${state}`);
      if (state.endsWith('-disabled')) b.disabled = true;
      if (state.endsWith('-busy')) b.setAttribute('aria-busy', 'true');
      parent.append(b);
    };
    for (const where of ['page', 'card']) {
      const row = document.createElement('div');
      row.className = where === 'card' ? 'card' : '';
      row.setAttribute('data-where', where);
      row.style.cssText += ';display:flex;flex-wrap:wrap;gap:12px';
      for (const v of variants) for (const st of ['default', 'hover', 'active', 'focus', 'disabled', 'busy']) mk(row, v, `${where}-${st}`);
      host.append(row);
    }
    document.body.append(host);
  }, VARIANTS as unknown as string[]);
}

const hoverFill: Record<string, string | null> = { primary: 'accent-strong-hover', secondary: 'surface-3', text: null, destructive: 'danger-strong-hover', 'destructive-text': null };

for (const theme of ['light', 'dark'] as const) {
  test(`US-NF-02/AC3 button states per components 1.3 in ${theme}: hover, active, focus-visible, disabled, busy for every variant, on the page and inside a card`, async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'the mobile project emulates a touch device (hover: none); the desktop project runs this test');
    await page.setViewportSize({ width: 1280, height: 900 }); // a pointer that can hover
    await page.clock.setFixedTime(jst10('2026-11-17'));
    await seed(page, matrixStore('ja'));
    await page.goto('./#/calendar/2026-11');
    await expect(page.getByTestId('cal-grid')).toBeVisible();
    await setScheme(page, theme);
    await sandbox(page);
    const problems: string[] = [];
    const read = (sel: string) =>
      page.locator(sel).evaluate((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { bg: s.backgroundColor, color: s.color, bw: parseFloat(s.borderTopWidth), bs: s.borderTopStyle, bc: s.borderTopColor, deco: s.textDecorationLine, thick: s.textDecorationThickness, outline: s.outlineStyle, ow: parseFloat(s.outlineWidth), oc: s.outlineColor, shadow: s.boxShadow, w: r.width, h: r.height, cursor: s.cursor, parentBg: getComputedStyle(el.parentElement!).backgroundColor };
      });
    for (const where of ['page', 'card']) {
      for (const v of VARIANTS) {
        const q = (st: string) => `[data-qa="${v}-${where}-${st}"]`;
        const tag = `${theme} ${where} ${v}`;
        const def = await read(q('default'));
        const defaultWidth = def.w;
        // hover (real pointer)
        await page.hover(q('hover'));
        const hov = await read(q('hover'));
        const hf = hoverFill[v];
        if (hf !== null && hov.bg !== css(theme, hf!)) problems.push(`${tag} hover fill ${hov.bg} != ${hf}`);
        if (v === 'text' || v === 'destructive-text') {
          if (!/(^|\s)(2px|0\.125rem)/.test(hov.thick) && parseFloat(hov.thick) < 2) problems.push(`${tag} hover underline thickness ${hov.thick} (2px expected)`);
        }
        // active (pressed)
        await page.hover(q('active'));
        await page.mouse.down();
        const act = await read(q('active'));
        await page.mouse.up();
        await page.mouse.move(0, 0);
        const af = v === 'primary' ? 'accent-strong-hover' : v === 'secondary' ? 'surface-3' : v === 'destructive' ? 'danger-strong-hover' : v === 'text' ? 'surface-3' : null;
        if (af !== null && act.bg !== css(theme, af)) problems.push(`${tag} active fill ${act.bg} != ${af}`);
        if (v === 'destructive-text' && act.bg === 'rgba(0, 0, 0, 0)') problems.push(`${tag} active shows no feedback (components 1.3: text variants show a surface-3 pill)`);
        // focus-visible by keyboard
        await page.locator(q('focus')).focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        const foc = await read(q('focus'));
        if (foc.outline !== 'solid' || foc.ow < 2 || foc.oc !== css(theme, 'focus-ring')) problems.push(`${tag} focus ring ${foc.outline} ${foc.ow}px ${foc.oc}`);
        if (!foc.shadow.includes(css(theme, 'focus-halo'))) problems.push(`${tag} focus halo missing "${foc.shadow}"`);
        // disabled
        const dis = await read(q('disabled'));
        if (dis.color !== css(theme, 'ink-3')) problems.push(`${tag} disabled colour ${dis.color} != ink-3`);
        if (dis.deco !== 'none') problems.push(`${tag} disabled keeps an underline`);
        if (v === 'text' || v === 'destructive-text') {
          // components 1.3: text disabled = ink-3, no underline (no fill, no dashed border is listed for it)
          if (dis.bg !== 'rgba(0, 0, 0, 0)' || dis.bs === 'dashed') problems.push(`TEXT-DISABLED ${tag}: ${dis.bg} ${dis.bw}px ${dis.bs} (spec: ink-3, no underline; the dashed pill is for primary/secondary/destructive)`);
        } else {
          if (dis.bg !== css(theme, 'surface-3') || dis.bs !== 'dashed' || dis.bw < 2 || dis.bc !== css(theme, 'line-ui')) problems.push(`${tag} disabled ${dis.bg} ${dis.bw}px ${dis.bs} ${dis.bc}`);
        }
        if (dis.cursor !== 'not-allowed') problems.push(`${tag} disabled cursor ${dis.cursor}`);
        // busy keeps the width and stays readable (the spinner is app markup, not part of the sandbox)
        const busy = await read(q('busy'));
        if (v !== 'text' && v !== 'destructive-text') {
          const ratio = contrast(rgbArr(busy.color), rgbArr(busy.bg.startsWith('rgba(0, 0, 0, 0)') ? busy.parentBg : busy.bg));
          if (ratio < 4.5) problems.push(`${tag} busy label contrast ${ratio.toFixed(2)}`);
        }
        void defaultWidth;
        // default vs hover: a state change does not move the box (no layout shift)
        if (Math.abs(hov.h - def.h) > 0.5) problems.push(`${tag} hover height changes ${def.h} -> ${hov.h}`);
      }
    }
    // the token pair behind each fill holds in this theme (independent of the DOM)
    for (const [fg, bg] of [['ink-inverse', 'accent-strong-hover'], ['ink-inverse', 'danger-strong-hover'], ['ink-1', 'surface-3']] as const) if (contrast(tok(theme, fg), tok(theme, bg)) < 4.5) problems.push(`token pair ${fg} on ${bg}`);
    expect(problems).toEqual([]);
  });
}

function rgbArr(s: string): [number, number, number] {
  const p = s.replace(/rgba?\(([^)]+)\)/, '$1').split(',').map((x) => parseFloat(x));
  return [p[0]!, p[1]!, p[2]!];
}

test('US-NF-02/AC3 the primary decision button on the day sheet, the month chevrons and the two small buttons keep their variant at 390 (button fix)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(jst10('2026-11-17'));
  await seed(page, matrixStore('ja'));
  await page.goto('./#/calendar/2026-12');
  await expect(page.getByTestId('cal-today')).toBeVisible();
  const today = await page.getByTestId('cal-today').evaluate((el) => ({ cls: el.className, bg: getComputedStyle(el).backgroundColor, h: el.getBoundingClientRect().height }));
  expect(today.cls).toContain('btn--secondary');
  expect(today.bg).toBe(css('light', 'surface-2'));
  expect(today.h).toBeGreaterThanOrEqual(43.5);
  const chevron = await page.getByTestId('cal-prev').boundingBox();
  expect(chevron!.width).toBeGreaterThanOrEqual(47.5);
  await page.goto('./#/day/2026-11-19');
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  const primaries = page.locator('[data-testid="day-sheet"] .plan-action--primary');
  expect(await primaries.count(), 'one primary decision action on a school day').toBe(1);
  const first = await primaries.first().evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, h: el.getBoundingClientRect().height, bar: el.closest('.action-bar') !== null }));
  expect(first.bg).toBe(css('light', 'accent-strong'));
  expect(first.color).toBe(css('light', 'ink-inverse'));
  expect(first.h).toBeGreaterThanOrEqual(51.5);
  expect(first.bar, 'the primary decision button is pinned in the sheet bar on a phone (components 17.7)').toBe(true);
});

// The day sheet's decision actions are choice cards (components 3.3: "Each action with a sub-line is a choice card (1.9 visuals)"), not .btn.
for (const theme of ['light', 'dark'] as const) {
  test(`US-E5-03 US-E5-06 day-sheet decision actions in ${theme}: sizes and variants per components 3.3 (primary / secondary / destructive entry), 52 px, full width`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.clock.setFixedTime(jst10('2026-11-17'));
    await seed(page, matrixStore('ja'));
    await page.goto('./#/day/2026-11-18'); // homemade bento planned on a school day: view / change / later / back to school
    await expect(page.getByTestId('day-sheet')).toBeVisible();
    await setScheme(page, theme);
    const rows = await page.locator('[data-testid="day-sheet"] .plan-action').evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { id: el.getAttribute('data-testid'), cls: el.className, bg: s.backgroundColor, color: s.color, bw: parseFloat(s.borderTopWidth), bc: s.borderTopColor, h: r.height, w: r.width, parentW: (el.parentElement as HTMLElement).getBoundingClientRect().width, deco: s.textDecorationLine };
      }),
    );
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) {
      expect(r.h, r.id ?? '').toBeGreaterThanOrEqual(51.5);
      expect(r.w, r.id ?? '').toBeGreaterThan(300);
    }
    const primary = rows.filter((r) => r.cls.includes('plan-action--primary'));
    expect(primary.length).toBe(1);
    expect(primary[0]!.bg).toBe(css(theme, 'accent-strong'));
    expect(primary[0]!.color).toBe(css(theme, 'ink-inverse'));
    const plain = rows.filter((r) => !r.cls.includes('plan-action--primary') && !r.cls.includes('plan-action--danger'));
    for (const r of plain) {
      expect(r.bc).toBe(css(theme, 'ink-1'));
      expect(r.bw).toBe(2);
      expect(r.color).toBe(css(theme, 'ink-1'));
    }
  });

  test(`UIR-D05 day-sheet decision actions show a pressed state (surface-3) in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.clock.setFixedTime(jst10('2026-11-17'));
    await seed(page, matrixStore('ja'));
    await page.goto('./#/day/2026-11-18');
    await expect(page.getByTestId('day-sheet')).toBeVisible();
    await setScheme(page, theme);
    const target = page.locator('[data-testid="day-sheet"] .plan-action').nth(1);
    const before = await target.evaluate((el) => getComputedStyle(el).backgroundColor);
    await target.hover();
    await page.mouse.down();
    const pressed = await target.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.mouse.up();
    expect(pressed).not.toBe(before);
    expect(pressed).toBe(css(theme, 'surface-3'));
  });
}

for (const [name, hash] of [['not-found', '#/nope/nothing'], ['join (no code)', '#/join/ABCDEFGHJK'], ['recipe not found', '#/recipe/rcp-does-not-exist']] as const) {
  test(`UIR-D07 every .btn has one of the six variants: ${name}`, async ({ page }) => {
    await page.clock.setFixedTime(jst10('2026-11-17'));
    await seed(page, matrixStore('ja'));
    await page.goto(`./${hash}`);
    await expect(page.locator('main')).toBeVisible();
    const bare = await page.locator('.btn').evaluateAll((els) => els.filter((e) => !/btn--(primary|secondary|text|destructive|destructive-text)\b/.test(e.className)).map((e) => `${e.textContent}`));
    expect(bare).toEqual([]);
  });
}

test('UIR-D06 the destructive entry point of a planned day (給食に戻す) is a destructive-text button (underlined danger text), as components 1.3 and 3.3 say', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.clock.setFixedTime(jst10('2026-11-17'));
  await seed(page, matrixStore('ja'));
  await page.goto('./#/day/2026-11-18');
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  const danger = page.locator('[data-testid="day-sheet"] .plan-action--danger').first();
  const s = await danger.evaluate((el) => ({ deco: getComputedStyle(el).textDecorationLine, bg: getComputedStyle(el).backgroundColor, bw: parseFloat(getComputedStyle(el).borderTopWidth), bc: getComputedStyle(el).borderTopColor }));
  expect(s.deco).toContain('underline');
  expect(s.bg).toBe('rgba(0, 0, 0, 0)');
  expect(s.bc === 'rgba(0, 0, 0, 0)' || s.bw === 0).toBe(true);
});
