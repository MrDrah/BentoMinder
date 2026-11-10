// QA, UI refresh 2026-11: every screen at 320 / 390 / 768 / 1280: no horizontal scroll, 44 px targets, text capped at 36 em (components 17.3),
// including the settings screen with the E15 family card and the sync status sheet. Stories: US-NF-02/AC1 AC3, US-E15-07 (status), US-E8-02/AC1
import { expect, test, type Page } from '@playwright/test';
import { overflowX } from './ui-refresh-common.ts';
import { familyDevice, openScreen, SCREENS } from './ui-refresh-screens-data.ts';

/** Controls smaller than 44 x 44 CSS px (inline links in running text are exempt, as in WCAG 2.5.8). */
export async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const sel = 'button, a[href], [role="button"], [role="radio"], [role="switch"], [role="tab"], input:not([type=hidden]), select, textarea, summary';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (el.closest('[hidden], [aria-hidden="true"]') !== null && !(el as HTMLInputElement).type) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.classList.contains('visually-hidden') || el.closest('.visually-hidden') !== null) continue;
      if (el.classList.contains('skip-link')) continue; // off-screen until focused; 43 px high when focused: UIR-D03 (P4, pre-existing)
      // a native checkbox / radio is operated through its label row
      const type = (el as HTMLInputElement).type;
      if (type === 'checkbox' || type === 'radio') {
        const lab = el.closest('label');
        if (lab !== null) r = lab.getBoundingClientRect();
      }
      if (cs.display === 'inline' && el.tagName === 'A' && el.closest('p, li') !== null) continue;
      if (r.width < 43.5 || r.height < 43.5) out.push(`${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.className}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
}

/** Paragraphs wider than 36 em (body text and notes are capped; headings, grids, tables, controls are not). */
export async function wideProse(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const p of Array.from(document.querySelectorAll<HTMLElement>('main p, aside p, [role="region"] p, [role="dialog"] p'))) {
      if (p.classList.contains('visually-hidden') || (p.textContent ?? '').trim().length < 30) continue;
      const cs = getComputedStyle(p);
      if (cs.display === 'none') continue;
      const r = p.getBoundingClientRect();
      if (r.width === 0) continue;
      const cap = 36 * parseFloat(cs.fontSize) + 2;
      if (r.width > cap) out.push(`${p.getAttribute('data-testid') ?? p.className} ${Math.round(r.width)} > ${Math.round(cap)}`);
    }
    return out;
  });
}

for (const w of [320, 390, 768, 1280]) {
  for (const sc of SCREENS) {
    test(`US-NF-02/AC1 US-NF-02/AC3 ${sc.name} at ${w}: no horizontal scroll, 44 px targets${w >= 768 ? ', text capped at 36 em' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w >= 1280 ? 800 : w >= 768 ? 1024 : 844 });
      await openScreen(page, sc);
      expect(await overflowX(page), 'horizontal overflow (px)').toBeLessThanOrEqual(0);
      const small = await smallTargets(page);
      expect(small, `targets below 44 px at ${w}`).toEqual([]);
      if (w >= 768) expect(await wideProse(page), 'prose wider than 36 em').toEqual([]);
    });
  }
}

for (const lang of ['ja', 'en'] as const) {
  for (const w of [320, 360, 390]) {
    test(`UIR-D08 US-NF-02/AC1 month row with the 「今日」 pill (away from the current month) in ${lang} at ${w}: no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 700 });
      await openScreen(page, { name: 'calendar-away', hash: '#/calendar/2026-12', store: 'matrix', today: '2026-11-17', ready: '[data-testid="cal-today"]' }, lang);
      expect(await overflowX(page), `overflow at ${w} (${lang})`).toBeLessThanOrEqual(0);
      const right = await page.locator('.monthnav').evaluate((el) => Math.max(...Array.from(el.querySelectorAll('*')).map((e) => e.getBoundingClientRect().right)));
      expect(right, 'right edge of the month row content').toBeLessThanOrEqual(w + 0.5);
    });
  }
}

test('QA negative control: the overflow, target and prose checks detect a 30 px button, a 900 px paragraph and a 2000 px box', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openScreen(page, SCREENS[0]!);
  await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const b = document.createElement('button');
    b.textContent = 'x';
    b.style.cssText = 'width:30px;height:30px';
    const p = document.createElement('p');
    p.textContent = 'a long sentence '.repeat(20);
    p.style.cssText = 'width:900px;max-width:none';
    const d = document.createElement('div');
    d.style.cssText = 'width:2000px;height:2px';
    main.append(b, p, d);
  });
  expect((await smallTargets(page)).length).toBeGreaterThan(0);
  expect((await wideProse(page)).length).toBeGreaterThan(0);
  expect(await overflowX(page)).toBeGreaterThan(0);
});

test('US-NF-02/AC1 calendar with the about panel, the legend and the day panel open: no horizontal scroll at 320 / 390 / 768 / 1280', async ({ page }) => {
  for (const w of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width: w, height: 900 });
    await openScreen(page, SCREENS[0]!);
    await page.getByTestId('about-toggle').click();
    await page.getByTestId('legend-toggle').click();
    await page.waitForTimeout(300);
    expect(await overflowX(page), `width ${w}`).toBeLessThanOrEqual(0);
    expect(await smallTargets(page), `targets at ${w}`).toEqual([]);
    if (w >= 768) expect(await wideProse(page), `prose at ${w}`).toEqual([]);
  }
});

for (const lang of ['ja', 'en'] as const) {
  for (const w of [320, 390]) {
    test(`US-NF-02/AC1 US-E8-02/AC1 ${lang} text at ${w}: settings and import have no horizontal scroll and no small target`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 844 });
      for (const sc of SCREENS.filter((s) => ['settings', 'import', 'calendar'].includes(s.name))) {
        await openScreen(page, sc, lang);
        expect(await overflowX(page), `${sc.name} ${lang}`).toBeLessThanOrEqual(0);
        expect(await smallTargets(page), `${sc.name} ${lang}`).toEqual([]);
      }
    });
  }
}

// ---------------------------------------------------------------- family card and sync status (E15)
for (const w of [320, 390, 768, 1280]) {
  test(`US-E15-07 US-NF-02/AC1 settings with the family card (no family, family with invite) and the sync status sheet at ${w}: no horizontal scroll, 44 px targets`, async ({ browser }) => {
    const { context, page } = await familyDevice(browser, w, w >= 1280 ? 800 : w >= 768 ? 1024 : 844, '2026-11-17');
    try {
      await page.goto('./#/settings');
      await expect(page.getByTestId('family-create')).toBeVisible();
      expect(await overflowX(page), 'family card, no family').toBeLessThanOrEqual(0);
      expect(await smallTargets(page), 'targets, no family').toEqual([]);
      if (w >= 768) expect(await wideProse(page), 'prose, no family').toEqual([]);
      await page.getByTestId('family-create').click();
      await expect(page.getByTestId('consent-cloud')).toBeVisible();
      expect(await overflowX(page), 'consent notice').toBeLessThanOrEqual(0);
      expect(await smallTargets(page), 'targets, consent').toEqual([]);
      await page.getByTestId('consent-cloud-accept').click();
      await expect(page.getByTestId('family-status-row')).toBeVisible();
      const invite = page.getByTestId('invite-create');
      await expect(invite).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 });
      await invite.click();
      await expect(page.getByTestId('invite-code')).toBeVisible();
      expect(await overflowX(page), 'family card with invite').toBeLessThanOrEqual(0);
      expect(await smallTargets(page), 'targets, invite').toEqual([]);
      if (w >= 768) expect(await wideProse(page), 'prose, invite').toEqual([]);
      // the sync status sheet from the app bar
      await page.goto('./#/calendar');
      await expect(page.getByTestId('appbar-sync')).toBeVisible();
      expect(await overflowX(page), 'app bar with the sync button').toBeLessThanOrEqual(0);
      await page.getByTestId('appbar-sync').click();
      await expect(page.getByTestId('sheet-sync')).toBeVisible();
      expect(await overflowX(page), 'sync status sheet').toBeLessThanOrEqual(0);
      expect(await smallTargets(page), 'targets, sync sheet').toEqual([]);
      const sheet = await page.getByTestId('sheet-sync').boundingBox();
      expect(sheet!.x + sheet!.width).toBeLessThanOrEqual(w + 0.5);
      expect(sheet!.x).toBeGreaterThanOrEqual(-0.5);
    } finally {
      await context.close();
    }
  });
}
