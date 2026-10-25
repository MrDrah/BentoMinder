// QA M1: touch targets at 360 px (US-NF-02/AC3: every target at least 44 x 44 CSS px) and reflow at 320 px (WCAG 1.4.10).
import { expect, test, type Page } from '@playwright/test';
import { FX01, fillProfile, freezeClock } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

async function smallTargets(page: Page): Promise<{ id: string; w: number; h: number }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, label.radio, label.file-button')]
      .filter((e) => !e.closest('.visually-hidden') && !e.classList.contains('visually-hidden'))
      .filter((e) => {
        const i = e as HTMLInputElement;
        return i.type !== 'radio' && i.type !== 'file' && !e.classList.contains('skip-link');
      })
      .map((e) => {
        const b = e.getBoundingClientRect();
        return { id: e.getAttribute('data-testid') ?? (e.textContent ?? '').trim().slice(0, 18), w: Math.round(b.width), h: Math.round(b.height) };
      })
      .filter((x) => x.w > 0 && (x.w < 44 || x.h < 44)),
  );
}

async function walk(page: Page, at: (name: string) => Promise<void>) {
  await page.goto('./');
  await at('onboarding-1');
  await fillProfile(page, { likes: ['ing-chicken'], dislikes: ['ing-green-pepper'] });
  await at('onboarding-2');
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await at('review');
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await at('calendar');
  for (const [hash, name] of [['#/settings', 'settings'], ['#/profile', 'profile-edit'], ['#/import', 'import']] as const) {
    await page.goto('./' + hash);
    await at(name);
  }
}

test('US-NF-02/AC3 at 360 px every touch target on the M1 screens is at least 44 x 44 CSS px (except the language toggle, D-M1-08)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const bad: string[] = [];
  await walk(page, async (name) => {
    for (const t of await smallTargets(page)) if (!/^lang-toggle/.test(t.id)) bad.push(`${name}: ${t.id} ${t.w}x${t.h}`);
  });
  expect(bad).toEqual([]);
});

// D-M1-08 (P2): the 日本語 / EN toggle on every screen is 66x36 and 48x36 px.
test('US-NF-02/AC3 D-M1-08 the language toggle is at least 44 x 44 CSS px at 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('./');
  expect((await smallTargets(page)).filter((t) => /^lang-toggle/.test(t.id))).toEqual([]);
});

test('NF-02 reflow: no horizontal scrolling at 320 px on any M1 screen, in ja and en', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const bad: string[] = [];
  for (const lang of ['ja', 'en'] as const) {
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.goto('./');
    if (lang === 'en') await page.getByTestId('lang-toggle-en').click();
    await walk(page, async (name) => {
      if (lang === 'en' && name === 'onboarding-1') await page.getByTestId('lang-toggle-en').click();
      const over = await page.evaluate(() => {
        const de = document.documentElement;
        const wide = [...document.querySelectorAll('body *')].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.right > de.clientWidth + 1 && !e.closest('.visually-hidden') && getComputedStyle(e).position !== 'fixed';
        });
        return { scroll: de.scrollWidth - de.clientWidth, wide: wide.slice(0, 3).map((e) => e.getAttribute('data-testid') ?? e.tagName) };
      });
      if (over.scroll > 1 || over.wide.length) bad.push(`${lang} ${name}: scroll ${over.scroll} wide ${over.wide.join(',')}`);
    });
  }
  expect(bad).toEqual([]);
});
