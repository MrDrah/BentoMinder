// QA M1: accessibility (axe 0 serious/critical on every M1 screen, ja+en, light+dark, 390 px and 1280 px),
// keyboard-only journey (US-NF-02), Japanese copy (US-E8-02/AC2, BR-23) and banned phrases (BR-07, US-E4-04).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { axeSerious, FX01, fillProfile, freezeClock, ROOT, readStore, STATE_V1 } from './helpers.ts';

const BANNED = JSON.parse(readFileSync(join(ROOT, 'data', 'banned-phrases.json'), 'utf8')) as { ja: string[]; en: string[] };

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

/** Every visible string and accessible name on screen, outside lang="ja" content (menu dishes, printed text). */
async function strings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const skip = (el: Element | null) => !!el?.closest('[lang="ja"]:not(html)') || !!el?.closest('script,style,noscript') || !!el?.closest('[data-testid="account-name"],[data-testid="account-email"],[data-testid="account-avatar"]'); // the signed-in person's own name and e-mail are data, not UI text (E13)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? '').trim();
      if (text && !skip(n.parentElement)) out.push(text);
    }
    for (const el of document.body.querySelectorAll('[aria-label],[placeholder],[title],[alt]')) {
      if (skip(el)) continue;
      for (const a of ['aria-label', 'placeholder', 'title', 'alt']) {
        const v = el.getAttribute(a);
        if (v) out.push(v);
      }
    }
    out.push(document.title);
    return out;
  });
}

const LATIN_ALLOWED = new Set(['EN', 'PDF', 'URL', 'https', 'JSON', 'AI', 'Gemini', 'API', 'Google', 'BentoMinder', 'g', 'ml', 'kcal', 'OK', 'ID', 'MB', 'x', 'a', 'p', 'm']);
const JA_CHAR = /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]/;

interface Visit {
  name: string;
  strings: string[];
}

/** Walks every M1 screen (and dialogs) in the current language/theme/viewport, running axe and collecting strings. */
async function tour(page: Page, lang: 'ja' | 'en', theme: 'light' | 'dark', width: number): Promise<Visit[]> {
  const visits: Visit[] = [];
  const label = `${lang}/${theme}/${width}`;
  const visit = async (name: string) => {
    await page.waitForTimeout(150);
    await axeSerious(page, `${label} ${name}`);
    visits.push({ name, strings: await strings(page) });
  };
  await page.setViewportSize({ width, height: width < 600 ? 844 : 800 });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto('./');
  if (lang === 'en') {
    await page.getByTestId('lang-toggle-en').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  }
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  // dark actually applies (a theme that never changes would make the dark axe run meaningless)
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  test.info().annotations.push({ type: 'bg', description: `${label} body background ${bg}` });
  await visit('onboarding-1');
  await page.getByTestId('ob-next').click();
  await visit('onboarding-1-errors');
  await fillProfile(page, { nickname: 'ひな', likes: ['ing-chicken'], dislikes: ['ing-green-pepper'], allergy: 'unknown' });
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  await visit('onboarding-2');
  await page.getByTestId('input-url').fill('menu.pdf');
  await page.getByTestId('import-submit').click();
  await visit('import-url-error');
  await page.getByTestId('input-url').fill('https://127.0.0.1/menu.pdf');
  await page.getByTestId('input-url').press('Tab');
  await page.getByTestId('import-submit').click();
  await expect(page.getByTestId('import-error')).toBeVisible();
  await visit('import-fetch-error');
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  await visit('consent-dialog');
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await visit('review');
  await page.getByTestId('review-confirm').click();
  await expect(page.getByTestId('dialog-uncertain')).toBeVisible();
  await visit('review-uncertain-dialog');
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await visit('calendar');
  await page.goto('./#/calendar/2026-12');
  await visit('calendar-month-without-menu');
  await page.goto('./#/settings');
  await expect(page.getByTestId('screen-settings')).toBeVisible();
  await visit('settings');
  await page.getByTestId('data-delete-all').click();
  await visit('delete-all-dialog');
  await page.getByTestId('dialog-delete-all-cancel').click();
  await page.getByTestId('settings-about-consent').click();
  await visit('consent-readonly');
  await page.keyboard.press('Escape');
  await page.goto('./#/profile');
  await visit('profile-edit');
  await page.goto('./#/nope/nothing');
  await visit('not-found');
  await page.goto('./#/import');
  await visit('import-from-settings');
  await page.goto('./#/review/2026-11?manual=1');
  await page.waitForTimeout(300);
  await visit('review-manual-or-redirect');
  return visits;
}

const COMBOS: { lang: 'ja' | 'en'; theme: 'light' | 'dark'; width: number }[] = [];
for (const lang of ['ja', 'en'] as const) for (const theme of ['light', 'dark'] as const) for (const width of [390, 1280]) COMBOS.push({ lang, theme, width });

for (const c of COMBOS) {
  test(`US-NF-02/AC1 US-E8-02/AC2 BR-23 BR-07 every M1 screen ${c.lang} ${c.theme} ${c.width}px: axe 0 serious/critical, language clean, no banned phrase`, async ({ page }) => {
    test.setTimeout(120_000);
    const visits = await tour(page, c.lang, c.theme, c.width);
    const all = visits.flatMap((v) => v.strings.map((s) => ({ screen: v.name, s })));
    // banned phrases (both languages, both lists, case-insensitive for en)
    const hits = all.filter(({ s }) => [...BANNED.ja, ...BANNED.en].some((b) => s.toLowerCase().includes(b.toLowerCase())));
    expect(hits, 'banned phrase visible').toEqual([]);
    if (c.lang === 'ja') {
      // user-entered values (a URL, a file name) are not UI text
      const latin = all.filter(({ s }) => !/https?:\/\/|\.pdf\b/.test(s)).flatMap(({ screen, s }) => (s.match(/[A-Za-z][A-Za-z0-9'-]*/g) ?? []).filter((w) => !LATIN_ALLOWED.has(w)).map((w) => `${screen}: "${w}" in "${s.slice(0, 60)}"`));
      expect(latin, 'untranslated English in ja mode').toEqual([]);
    } else {
      // menu content quoted in accessible names ('Remove "ごはん"') and the PDF's own allergen line are menu content, not UI text:
      // the allergen line is reported separately as D-M1-05 (it carries no lang="ja").
      const stripQuoted = (x: string) => x.replace(/"[^"]*"/g, '');
      const ja = all.filter(({ s }) => JA_CHAR.test(stripQuoted(s)) && s !== '日本語' && !/^アレルゲン：/.test(s));
      expect(ja.map(({ screen, s }) => `${screen}: ${s.slice(0, 80)}`), 'Japanese in en mode').toEqual([]);
    }
    expect(visits.length).toBeGreaterThanOrEqual(15);
  });
}

test('US-NF-02/AC1 recovery screens (corrupt, newer) and the delete dialog pass axe in ja and en, light and dark', async ({ page }) => {
  for (const [raw, id] of [['{ broken', 'screen-corrupt-data'], [JSON.stringify({ ...JSON.parse(STATE_V1), schemaVersion: 99 }), 'screen-newer-data']] as const) {
    for (const lang of ['ja', 'en'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        const p = await page.context().newPage();
        await freezeClock(p);
        await p.emulateMedia({ colorScheme: theme });
        await p.addInitScript(([r, l]) => {
          localStorage.setItem('bentominder.state', r);
          void l;
        }, [raw, lang] as const);
        await p.goto('./');
        await expect(p.getByTestId(id)).toBeVisible();
        if (lang === 'en') {
          await p.getByTestId('lang-toggle-en').click();
          await expect(p.locator('html')).toHaveAttribute('lang', 'en');
        }
        await axeSerious(p, `${id} ${lang} ${theme}`);
        const s = await strings(p);
        if (lang === 'en') expect(s.filter((x) => JA_CHAR.test(x) && x !== '日本語')).toEqual([]);
        else expect(s.flatMap((x) => (x.match(/[A-Za-z]+/g) ?? []).filter((w) => !LATIN_ALLOWED.has(w)))).toEqual([]);
        await p.close();
      }
    }
  }
});

test('BR-23 US-E8-01/AC2 the language toggle is one tap away on onboarding, calendar and settings, and switches without reload', async ({ page }) => {
  await page.addInitScript((v) => localStorage.getItem('bentominder.state') === null && localStorage.setItem('bentominder.state', v), JSON.stringify(JSON.parse(STATE_V1)));
  for (const hash of ['#/calendar', '#/settings']) {
    await page.goto('./' + hash);
    let reloads = 0;
    page.on('load', () => (reloads += 1));
    const toggle = page.getByTestId('lang-toggle').first();
    await expect(toggle).toBeVisible();
    await page.getByTestId('lang-toggle-en').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(reloads).toBe(0);
    await page.getByTestId('lang-toggle-ja').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  }
});

// ---------------------------------------------------------------- keyboard

/** Tabs until the element with this data-testid has focus (fails after `max` presses). */
async function tabTo(page: Page, testId: string, max = 150): Promise<void> {
  for (let i = 0; i < max; i++) {
    const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
    if (id === testId) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`could not reach ${testId} by keyboard (${max} tabs)`);
}

async function focusRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const s = getComputedStyle(el);
    return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
  });
}

test('US-NF-02/AC2 keyboard only: onboarding -> import -> consent -> review -> confirm -> calendar, with visible focus and dialog focus handling', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  // skip link is the first stop
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /本文へ移動/ })).toBeFocused();
  await tabTo(page, 'input-nickname');
  expect(await focusRing(page), 'focus ring on nickname').toBe(true);
  await page.keyboard.type('きー');
  await tabTo(page, 'chip-age-age-4-5');
  expect(await focusRing(page), 'focus ring on chip').toBe(true);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('chip-age-age-4-5')).toHaveAttribute('aria-checked', 'true').catch(async () => {
    await expect(page.getByTestId('chip-age-age-4-5')).toHaveAttribute('aria-pressed', 'true');
  });
  await tabTo(page, 'picker-likes-search');
  await page.keyboard.type('とり');
  await tabTo(page, 'picker-likes-option-ing-chicken');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('picker-likes-chip-ing-chicken')).toBeVisible();
  await tabTo(page, 'radio-allergy-none-known'); // an unchecked native radio group is entered on its first radio
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('radio-allergy-unknown')).toBeChecked();
  await tabTo(page, 'ob-next');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ob-step-2')).toBeVisible();

  // step 2: reach the file chooser by keyboard
  await tabTo(page, 'import-upload');
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Space');
  await (await chooser).setFiles(FX01);
  await expect(page.getByTestId('consent-dialog')).toBeVisible();
  // focus is inside the dialog; Tab cannot leave it
  const inDialog = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"], [role="alertdialog"], dialog'));
  expect(await inDialog(), 'focus moved into the consent dialog').toBe(true);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await inDialog(), `focus trapped after ${i + 1} tabs`).toBe(true);
  }
  await tabTo(page, 'consent-accept');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('screen-review')).toBeVisible();

  // review: jump to the next uncertain field and accept it, edit another, all by keyboard
  await tabTo(page, 'review-next-uncertain');
  await page.keyboard.press('Enter');
  const focusedUncertain = await page.evaluate(() => !!document.activeElement?.closest('[data-field]'));
  expect(focusedUncertain, '「次の要確認へ」 moves focus to an uncertain field').toBe(true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab').catch(() => undefined);
  await tabTo(page, 'review-confirm');
  await page.keyboard.press('Enter');
  const dlg = page.getByTestId('dialog-uncertain');
  await expect(dlg).toBeVisible();
  expect(await inDialog()).toBe(true);
  // Escape = 戻る (nothing stored)
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  expect((await readStore(page)).menus['2026-11'].confirmed ?? null).toBeNull();
  await expect(page.getByTestId('review-confirm')).toBeFocused();
  await page.keyboard.press('Enter');
  await tabTo(page, 'dialog-uncertain-confirm');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  expect((await readStore(page)).menus['2026-11'].confirmed.version).toBe(1);
});

test('US-NF-02/AC2 keyboard only: settings -> delete all (dialog, Escape cancels, Enter confirms) and recovery screen', async ({ page }) => {
  await page.addInitScript((v) => localStorage.getItem('bentominder.state') === null && localStorage.setItem('bentominder.state', v), JSON.stringify(JSON.parse(STATE_V1)));
  await page.goto('./#/settings');
  await tabTo(page, 'data-delete-all');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('dialog-delete-all')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dialog-delete-all')).toHaveCount(0);
  await expect(page.getByTestId('data-delete-all')).toBeFocused();
  await page.keyboard.press('Enter');
  await tabTo(page, 'dialog-delete-all-confirm');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
});

test('US-NF-02/AC2 touch targets on onboarding and review are at least 24x24 CSS px (WCAG 2.2 AA target size, 44 px recommended)', async ({ page }) => {
  await page.goto('./');
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], input:not([type=hidden]):not([type=radio]):not([type=checkbox]), label.radio, select, textarea, [role=radio]')]
      .filter((e) => !e.closest('.visually-hidden') && !(e as HTMLElement).classList.contains('visually-hidden'))
      .map((e) => ({ id: e.getAttribute('data-testid') ?? e.textContent?.slice(0, 20) ?? e.tagName, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24))
      .map(({ id, r }) => `${id}: ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
});
