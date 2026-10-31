// QA full journey (M1..M4 end to end), mobile and desktop, browser outside Tokyo:
// first launch -> profile (allergen + dislike + nickname + note) -> mocked import -> review -> confirm -> calendar assessment
// -> flagged day -> recommendation -> plan -> reload -> reminder due through page.clock -> Today card -> share text ->
// export -> delete everything. Requests to /api never carry profile data. axe in ja and en on each major screen.
// Run: npx playwright test -c tests/e2e/qa/playwright.m4.config.ts full-journey   (needs `npm run build` first)
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { axeSerious, FX01, pinHand1, readStore, recordAll, requestText, ROOT, KEY } from './helpers.ts';

const NICK = 'ユニークはな７';
const NOTE = 'QA固有メモ９９';
const BANNED = JSON.parse(readFileSync(join(ROOT, 'data', 'banned-phrases.json'), 'utf8')) as { ja: string[]; en: string[] };
const jst = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+09:00`);
const addDay = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function visit(page: Page, hash: string, testid: string) {
  await page.goto(`./#${hash}`);
  await expect(page.getByTestId(testid)).toBeVisible();
}

test('US-E1-01/AC1 US-E1-02/AC1 US-E1-03/AC1 US-E2-03/AC1 US-E3-03/AC1 US-E4-01/AC1 US-E5-03/AC1 US-E6-01/AC1 US-E7-02/AC1 US-E7-03/AC1 US-E9-01/AC1 US-E9-02/AC1 US-E10-01/AC2 US-E10-03/AC3 US-E10-04/AC1 full journey: import to reminder to share to delete', async ({ page }) => {
  test.setTimeout(240_000);
  const reqs = recordAll(page);
  await page.clock.install({ time: new Date('2026-10-28T01:00:00Z') }); // 10:00 JST, next month is preselected
  await pinHand1(page);
  const downloads: string[] = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));

  // 1 first launch and profile
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  await axeSerious(page, 'onboarding 1 (ja)');
  await page.getByTestId('input-nickname').fill(NICK);
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('picker-likes-option-ing-chicken').click();
  await page.getByTestId('picker-dislikes-option-ing-green-pepper').click();
  await page.getByTestId('radio-allergy-has-known').check();
  await page.getByTestId('chip-allergen-alg-shrimp').click();
  await page.getByTestId('input-note').fill(NOTE);
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
  let s = await readStore(page);
  expect(s.profile).toMatchObject({ nickname: NICK, dislikedIds: ['ing-green-pepper'], knownAllergenIds: ['alg-shrimp'], note: NOTE });

  // 2 import (mock scenario), consent, review, confirm
  await expect(page.getByTestId('import-month')).toHaveValue('2026-11');
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await axeSerious(page, 'review (ja)');
  await page.getByTestId('review-confirm').click();
  if (await page.getByTestId('dialog-uncertain-confirm').isVisible().catch(() => false)) await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  s = await readStore(page);
  expect(s.menus['2026-11'].confirmed.version).toBe(1);
  expect(s.menus['2026-11'].confirmed.days.length).toBeGreaterThan(10);
  await axeSerious(page, 'calendar (ja)');

  // 3 the assessment is visible on the calendar and a flagged day exists for the stored dislike
  const flagged = page.locator('[data-testid^="cal-cell-"][data-assessment="low-preference"]');
  await expect.poll(() => flagged.count()).toBeGreaterThan(0);
  const flaggedDate = (await flagged.first().getAttribute('data-testid'))!.replace('cal-cell-', '');
  expect(flaggedDate).toMatch(/^2026-11-\d\d$/);
  await expect(page.locator('[data-testid^="cal-cell-"][data-assessment="no-concern"], [data-testid^="cal-cell-"][data-assessment="ok"], [data-testid^="cal-cell-"]:not([data-assessment="low-preference"])').first()).toBeVisible();

  // 4 open the flagged day, recommendation, plan
  await flagged.first().getByRole('button').click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await axeSerious(page, 'day sheet (ja)');
  await page.getByTestId('day-action-bento').click();
  await expect(page.getByTestId('screen-recommend')).toBeVisible();
  await expect(page.getByTestId('rec-card-0')).toBeVisible();
  await expect(page.getByTestId('disclaimer')).toBeVisible();
  await axeSerious(page, 'recommend (ja)');
  const recText = await page.getByTestId('rec-card-0').innerText();
  expect(recText).not.toMatch(/エビ|えび|海老|shrimp/i); // never a recipe with the registered allergen
  await page.getByTestId('rec-card-0-confirm').click();
  await expect.poll(async () => (await readStore(page)).decisions[flaggedDate]?.state).toBe('homemade-bento-planned');
  s = await readStore(page);
  const dec = s.decisions[flaggedDate];
  expect(dec.recipeId).toBeTruthy();
  expect(Date.parse(dec.plannedAt)).toBeLessThan(jst(addDay(flaggedDate, -1), '17:30'));

  // 5 reload: the plan survives; then the clock reaches 17:30 JST the day before
  await page.goto('./#/calendar/2026-11');
  await page.reload();
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  expect((await readStore(page)).decisions[flaggedDate].recipeId).toBe(dec.recipeId);
  const eve = addDay(flaggedDate, -1);
  await page.clock.setSystemTime(new Date(jst(eve, '17:30') - 120_000));
  await page.reload();
  await expect(page.getByTestId('cal-title')).toBeVisible();
  const dayBefore = page.getByTestId(`reminder-day-before-${flaggedDate}`);
  await expect(dayBefore).toHaveCount(0);
  await page.clock.fastForward('04:00');
  await expect(dayBefore).toBeVisible();
  await expect(dayBefore).toContainText(dec.recipeNameSnapshot.ja);
  await axeSerious(page, 'reminder banner (ja)');
  const bannerText = await dayBefore.innerText();
  for (const p of BANNED.ja) expect(bannerText.includes(p), `banned phrase ${p}`).toBe(false);

  // 6 Today card on the planned day itself (Tokyo midnight rolls over with the browser outside Tokyo)
  await page.clock.setSystemTime(new Date(jst(flaggedDate, '08:00')));
  await page.reload();
  await expect(page.getByTestId('today-card')).toContainText(dec.recipeNameSnapshot.ja);
  await expect(page.getByTestId(`reminder-day-before-${flaggedDate}`)).toHaveCount(0); // expired at 00:00 JST

  // 7 share text, then English screens with axe
  await page.getByTestId('share-button').click();
  const share = await page.getByTestId('share-preview').innerText();
  expect(share).toContain('【BentoMinder】');
  for (const secret of [NICK, NOTE, 'alg-shrimp', 'ing-green-pepper', 'ing-chicken', 'エビ', 'えび', 'ピーマン']) expect(share, `share text must not contain ${secret}`).not.toContain(secret);
  for (const p of BANNED.ja) expect(share.includes(p), `banned phrase ${p}`).toBe(false);
  await axeSerious(page, 'share sheet (ja)');
  await page.keyboard.press('Escape');
  await page.goto('./#/calendar');
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await axeSerious(page, 'calendar (en)');
  await page.getByTestId('share-button').click();
  const shareEn = await page.getByTestId('share-preview').innerText();
  for (const secret of [NICK, NOTE, 'shrimp', 'green pepper']) expect(shareEn.toLowerCase()).not.toContain(secret.toLowerCase());
  await axeSerious(page, 'share sheet (en)');
  await page.keyboard.press('Escape');
  await visit(page, `/recommend/${flaggedDate}`, 'screen-recommend');
  await axeSerious(page, 'recommend (en)');
  await visit(page, '/settings', 'screen-settings');
  await axeSerious(page, 'settings (en)');

  // 8 export and delete everything
  const before = await readStore(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('data-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^bentominder-export-\d{4}-\d\d-\d\d\.json$/);
  const path = await download.path();
  const exported = JSON.parse(readFileSync(path, 'utf8'));
  expect(exported.profile.nickname).toBe(NICK);
  expect(exported.decisions[flaggedDate].state).toBe('homemade-bento-planned');
  expect(Object.keys(exported).sort()).toEqual(Object.keys(before).sort());
  await page.getByTestId('data-delete-all').click();
  await page.getByTestId('dialog-delete-all-confirm').click();
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  const left = await page.evaluate(() => ({ keys: Object.keys(window.localStorage), values: Object.values(window.localStorage).join('') }));
  expect(left.values).not.toContain(NICK);
  expect(left.values).not.toContain(NOTE);
  expect(left.keys.filter((k) => k === KEY)).toEqual([]);
  expect(await page.evaluate(() => window.localStorage.getItem('bentominder.state'))).toBeNull();

  // 9 nothing from the profile or the plan ever left the browser
  const api = reqs.filter((r) => new URL(r.url()).pathname.startsWith('/api'));
  expect(api.length).toBeGreaterThan(0); // the import did use the proxy
  for (const r of api) {
    const t = requestText(r);
    for (const secret of [NICK, NOTE, 'likedIds', 'dislikedIds', 'knownAllergenIds', 'allergyStatus', 'reminderLog', 'plannedAt']) expect(t, `${r.method()} ${r.url()} carries ${secret}`).not.toContain(secret);
    expect(t).not.toContain(encodeURIComponent(NICK));
  }
  const foreign = reqs.map((r) => new URL(r.url())).filter((u) => !['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob'));
  expect(foreign.map((u) => u.href)).toEqual([]);
  expect(downloads.length).toBe(1);
});
