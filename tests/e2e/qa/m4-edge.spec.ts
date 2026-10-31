// QA M4 edge tests: reminders, Today card, reminder settings, theme, share, debug absence. Derived from the stories
// (US-E7-01..07, US-E8-03, US-E8-05, US-E9-01/02, US-E11-01) and the reminder oracle, not from the developers' tests.
// Run: npx playwright test -c tests/e2e/qa/playwright.m4.config.ts m4-edge   (needs `npm run build` first)
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { axeSerious, KEY, readStore, ROOT, type Json } from './helpers.ts';

const BASE = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8')) as Json;
const BANNED = JSON.parse(readFileSync(join(ROOT, 'data', 'banned-phrases.json'), 'utf8')) as { ja: string[]; en: string[] };
const DICT = JSON.parse(readFileSync(join(ROOT, 'data', 'dictionary.json'), 'utf8')) as Json;
const HIMAWARI = 'rcp-delish-himawari-bento';
const clone = (x: Json): Json => JSON.parse(JSON.stringify(x));
const iso = (s: string) => new Date(s);

/** The November fixture; 11-04 planned with a real library recipe. Options adjust it. */
function state(o: { log?: boolean; decisions?: boolean; dislikes?: boolean; extra?: (s: Json) => void } = {}): Json {
  const s = clone(BASE);
  const d = s.decisions['2026-11-04'];
  d.recipeId = HIMAWARI;
  d.recipeNameSnapshot = { ja: 'ひまわり弁当', en: 'Sunflower bento (himawari bento)' };
  d.recipeShortNameSnapshot = { ja: 'ひまわり弁当', en: 'Himawari' };
  if (o.log !== false) s.reminderLog = [];
  if (o.decisions === false) { s.decisions = {}; s.overrides = {}; }
  if (o.dislikes === false) s.profile.dislikedIds = [];
  o.extra?.(s);
  return s;
}
/** A planned-bento decision record on any date (the menu need not list it: a kept plan stays, BR13/B7). */
function planned(date: string, plannedAt: string, recipe = HIMAWARI): Json {
  const d = clone(BASE.decisions['2026-11-04']);
  d.date = date;
  d.recipeId = recipe;
  d.plannedAt = plannedAt;
  d.decidedAt = plannedAt;
  d.recipeNameSnapshot = { ja: 'ひまわり弁当', en: 'Sunflower bento (himawari bento)' };
  d.recipeShortNameSnapshot = { ja: 'ひまわり弁当', en: 'Himawari' };
  d.history = [{ state: 'homemade-bento-planned', at: plannedAt, recipeId: recipe }];
  return d;
}
async function open(page: Page, at: string, s: Json, hash = './') {
  await page.clock.install({ time: iso(at) });
  await page.addInitScript(([k, v]) => { if (window.localStorage.getItem(k!) === null) window.localStorage.setItem(k!, v!); }, [KEY, JSON.stringify(s)] as const);
  await page.goto(hash);
}
const banner = (page: Page, key: string) => page.getByTestId(`reminder-${key}`);
const fold = (s: string) => s.normalize('NFKC').toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function bannedHits(text: string): string[] {
  const out: string[] = [];
  for (const p of BANNED.ja) if (fold(text).includes(fold(p))) out.push(p);
  for (const p of BANNED.en) if (new RegExp(`(^|[^a-z0-9])${esc(fold(p))}($|[^a-z0-9])`).test(fold(text))) out.push(p);
  return out;
}

test.describe('weekly reminder content (US-E7-01)', () => {
  test('US-E7-01/AC3 an empty week is still delivered and says so', async ({ page }) => {
    await open(page, '2026-11-22T05:00:00Z', state({ decisions: false, dislikes: false })); // Sun 14:00 JST, week 11-23..11-29
    const b = banner(page, 'weekly-2026-11-23');
    await expect(b).toBeVisible();
    await expect(b).toContainText('来週は手作りお弁当の予定はありません');
  });
  test('US-E7-01/AC4 a week across a month boundary lists the missing month', async ({ page }) => {
    await open(page, '2026-11-29T05:00:00Z', state({ decisions: false, dislikes: false }));
    const b = banner(page, 'weekly-2026-11-30');
    await expect(b).toBeVisible();
    await expect(b).toContainText('12月の献立がまだありません');
  });
  test('US-E7-01/AC5 a week with no menu at all points to the import', async ({ page }) => {
    await open(page, '2026-12-06T05:00:00Z', state({ decisions: false, dislikes: false }));
    const b = banner(page, 'weekly-2026-12-07');
    await expect(b).toBeVisible();
    await expect(b).toContainText('来週の献立がまだありません');
    await expect(b).toContainText('献立を取り込む');
  });
  test('US-E7-05/AC3 on Sunday 15:00 the old weekly (still unexpired) is not shown, only the newest', async ({ page }) => {
    await open(page, '2026-11-08T06:00:00Z', state());
    await expect(banner(page, 'weekly-2026-11-09')).toBeVisible();
    await expect(page.locator('[data-reminder-key="weekly:2026-11-02"]')).toHaveCount(0);
    await expect(page.locator('[data-reminder-key^="weekly:"]')).toHaveCount(1);
  });
});

test.describe('day-before reminder (US-E7-02)', () => {
  const DB = 'day-before-2026-11-04';
  test('US-E7-02/AC2 a missing recipe opens the day sheet instead of the recipe', async ({ page }) => {
    await open(page, '2026-11-03T12:00:00Z', state({ extra: (s) => { s.decisions['2026-11-04'].recipeId = 'rcp-does-not-exist'; } }));
    await expect(banner(page, DB)).toBeVisible();
    await banner(page, DB).getByTestId('reminder-cta').click();
    await expect(page.getByTestId('day-sheet')).toBeVisible();
    await expect(page.getByTestId('screen-recipe')).toHaveCount(0);
  });
  for (const c of [
    { ac: 'US-E7-02/AC3', plan: '2027-01-29', at: '2027-01-28T08:30:00Z', key: 'day-before-2027-01-29' },
    { ac: 'US-E7-02/AC3', plan: '2027-02-01', at: '2027-01-31T08:30:00Z', key: 'day-before-2027-02-01' },
    { ac: 'US-E7-02/AC4', plan: '2028-02-29', at: '2028-02-28T08:30:00Z', key: 'day-before-2028-02-29' },
    { ac: 'US-E7-02/AC4', plan: '2028-03-01', at: '2028-02-29T08:30:00Z', key: 'day-before-2028-03-01' },
  ]) {
    test(`${c.ac} ${c.plan} is reminded exactly at 17:30 JST the day before (browser in a non-Tokyo zone)`, async ({ page }) => {
      const s = state({ extra: (x) => { x.decisions[c.plan] = planned(c.plan, '2026-11-01T10:00:00+09:00'); } });
      await open(page, new Date(Date.parse(c.at) - 60_000).toISOString(), s);
      await expect(page.getByTestId('today-card')).toBeVisible();
      await expect(banner(page, c.key)).toHaveCount(0);
      await page.clock.fastForward('02:00');
      await expect(banner(page, c.key)).toBeVisible();
    });
  }
  test('US-E7-02/AC5 planned in the app at 19:00 the evening before: no day-before reminder, the plan is stored', async ({ page }) => {
    const s = state({ extra: (x) => { delete x.decisions['2026-11-04']; } });
    await open(page, '2026-11-03T10:00:00Z', s, './#/day/2026-11-04'); // 19:00 JST
    await page.getByTestId('day-action-bento').click();
    await expect(page.getByTestId('screen-recommend')).toBeVisible();
    await page.getByTestId('rec-card-0-confirm').click();
    await expect.poll(async () => (await readStore(page)).decisions['2026-11-04']?.state).toBe('homemade-bento-planned');
    const st = await readStore(page);
    expect(Date.parse(st.decisions['2026-11-04'].plannedAt)).toBeGreaterThan(Date.parse('2026-11-03T08:30:00Z'));
    await page.goto('./#/calendar');
    await page.clock.fastForward('01:00');
    await expect(banner(page, DB)).toHaveCount(0);
    await expect(page.getByTestId('today-card')).toBeVisible();
  });
  test('US-E7-02/AC6 cancelling the plan (back to school lunch) removes the pending reminder', async ({ page }) => {
    await open(page, '2026-11-03T05:00:00Z', state(), './#/day/2026-11-04'); // 14:00 JST, due 17:30
    await page.getByTestId('day-action-school').click();
    await page.getByTestId('dialog-cancel-plan-confirm').click();
    await expect.poll(async () => (await readStore(page)).decisions['2026-11-04']?.state).toBe('school-lunch-planned');
    await page.goto('./#/calendar');
    await page.clock.fastForward('04:00');
    await expect(banner(page, DB)).toHaveCount(0);
  });
  test('US-E7-02/AC7 a reminder missed at 17:30 and opened at 20:00 refers to the recipe the parent changed to; plannedAt is kept', async ({ page }) => {
    await open(page, '2026-11-03T11:00:00Z', state(), './#/day/2026-11-04'); // 20:00 JST
    const before = (await readStore(page)).decisions['2026-11-04'].plannedAt;
    await page.getByTestId('day-action-change-recipe').click();
    await expect(page.getByTestId('screen-recommend')).toBeVisible();
    const target = page.getByTestId('rec-card-0-confirm');
    await target.click();
    await expect.poll(async () => (await readStore(page)).decisions['2026-11-04'].recipeId).not.toBe(HIMAWARI);
    const st = await readStore(page);
    expect(st.decisions['2026-11-04'].plannedAt).toBe(before);
    await page.goto('./#/calendar');
    await expect(banner(page, 'day-before-2026-11-04')).toBeVisible();
    await expect(banner(page, 'day-before-2026-11-04')).toContainText(st.decisions['2026-11-04'].recipeNameSnapshot.ja);
  });
});

test.describe('today card (US-E7-03)', () => {
  test('US-E7-03/AC4 no upcoming school day is known', async ({ page }) => {
    const s = state({ log: true, extra: (x) => { x.menus['2026-11'].confirmed.days = x.menus['2026-11'].confirmed.days.filter((d: Json) => d.date <= '2026-11-27'); } });
    await open(page, '2026-11-28T01:00:00Z', s);
    await expect(page.getByTestId('today-card')).toContainText('次の登園日は、献立を取り込むと表示されます');
  });
  test('US-E7-03/AC5 an undecided today offers to decide and changes nothing', async ({ page }) => {
    const s = state({ extra: (x) => {
      const b = clone(x.decisions['2026-11-05']);
      x.decisions['2026-11-06'] = { ...b, date: '2026-11-06', state: 'not-confirmed', reservationDoneExternally: false, history: [{ state: 'not-confirmed', at: b.decidedAt }] };
    } });
    await open(page, '2026-11-06T01:00:00Z', s);
    await expect(page.getByTestId('today-card')).toContainText('今日の予定は未定です');
    const before = JSON.stringify((await readStore(page)).decisions);
    await page.getByTestId('today-cta').click();
    await expect(page.getByTestId('day-sheet')).toBeVisible();
    expect(JSON.stringify((await readStore(page)).decisions)).toBe(before);
  });
});

for (const tz of ['America/Los_Angeles', 'Europe/Paris', 'Pacific/Auckland']) {
  test.describe(`Tokyo midnight with the browser in ${tz} (BR-15)`, () => {
    test.use({ timezoneId: tz });
    test(`US-E7-03/AC3 US-E8-03/AC3 the today card switches at 00:00 JST without a reload, ${tz}`, async ({ page }) => {
      await open(page, '2026-11-03T14:59:30Z', state()); // 23:59:30 JST on 11-03
      await expect(page.getByTestId('today-card')).toBeVisible();
      await expect(page.getByTestId('today-card')).not.toContainText('今日は手作りお弁当');
      await page.clock.fastForward('02:30');
      await expect(page.getByTestId('today-card')).toContainText('今日は手作りお弁当');
    });
    test(`US-E7-07/AC1 US-E8-03/AC3 a reminder is due at 17:30 JST whatever the device clock says, ${tz}`, async ({ page }) => {
      await open(page, '2026-11-03T08:28:00Z', state());
      await expect(page.getByTestId('today-card')).toBeVisible();
      await expect(banner(page, 'day-before-2026-11-04')).toHaveCount(0);
      await page.clock.fastForward('03:00');
      await expect(banner(page, 'day-before-2026-11-04')).toBeVisible();
    });
    test(`US-E8-03/AC3 stored dates are plain YYYY-MM-DD and "today" is the Tokyo date at 00:30 JST, ${tz}`, async ({ page }) => {
      await open(page, '2026-11-03T15:30:00Z', state()); // 11-04 00:30 JST
      await expect(page.getByTestId('today-card')).toContainText('今日は手作りお弁当');
      const st = await readStore(page);
      for (const k of Object.keys(st.decisions)) expect(k).toMatch(/^\d{4}-\d\d-\d\d$/);
      for (const d of Object.values(st.decisions) as Json[]) expect(d.date).toMatch(/^\d{4}-\d\d-\d\d$/);
    });
  });
}

test.describe('timezone change while open', () => {
  // Chromium refuses a second timezone override on a page Playwright already configured, so the device zone is switched in
  // page code: every local-time getter, getTimezoneOffset and the default Intl zone follow window.__zone. The planner is also
  // run under four process TZ values in tests/unit/domain/qa/reminders.oracle.test.ts (RM31, RP4).
  test('US-E7-07/AC3 the device timezone changes while the app is open: today and due reminders are unchanged', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __zoneMin: number };
      w.__zoneMin = 540;
      const P = Date.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
      const shifted = (d: Date) => new Date(d.getTime() + w.__zoneMin * 60_000);
      const map: Record<string, string> = { getHours: 'getUTCHours', getMinutes: 'getUTCMinutes', getDate: 'getUTCDate', getDay: 'getUTCDay', getMonth: 'getUTCMonth', getFullYear: 'getUTCFullYear' };
      for (const [local, utc] of Object.entries(map)) P[local] = function (this: Date) { return (shifted(this) as unknown as Record<string, () => number>)[utc]!(); };
      P['getTimezoneOffset'] = () => -w.__zoneMin;
    });
    await open(page, '2026-11-03T08:28:00Z', state());
    await expect(page.getByTestId('today-card')).toBeVisible();
    const head = await page.getByTestId('today-headline').innerText();
    await page.evaluate(() => { (window as unknown as { __zoneMin: number }).__zoneMin = -480; }); // America/Los_Angeles, UTC-8
    await page.clock.fastForward('03:00');
    await expect(page.getByTestId('today-headline')).toHaveText(head);
    await expect(banner(page, 'day-before-2026-11-04')).toBeVisible();
  });
});

test.describe('reminder settings (US-E7-04, US-E7-06, US-E7-07/AC2)', () => {
  test('US-E7-04/AC3 stored 24:00 and 17:31 are replaced by the defaults', async ({ page }) => {
    const s = state({ extra: (x) => { x.settings.reminders.dayBefore.time = '17:31'; x.settings.reminders.weekly.time = '24:00'; } });
    await open(page, '2026-11-02T01:00:00Z', s, './#/settings');
    await expect(page.getByTestId('screen-settings')).toBeVisible();
    await expect(page.getByTestId('settings-day-before-value')).toContainText('17:30');
    await expect(page.getByTestId('settings-weekly-value')).toContainText('14:00');
  });
  test('US-E7-04/AC3 the hour list has 24 values and the minute list is 00 15 30 45; the weekday list has 7', async ({ page }) => {
    await open(page, '2026-11-02T01:00:00Z', state(), './#/settings');
    expect(await page.getByTestId('select-day-before-hour').locator('option').count()).toBe(24);
    expect(await page.getByTestId('select-day-before-minute').locator('option').allInnerTexts()).toEqual(['00', '15', '30', '45']);
    expect(await page.getByTestId('select-weekly-day').locator('option').count()).toBe(7);
  });
  test('US-E7-04/AC1 US-E7-06/AC1 the defaults are on with the web limitation sentence; non-Tokyo browsers see 「日本時間」', async ({ page }) => {
    await open(page, '2026-11-02T01:00:00Z', state(), './#/settings');
    await expect(page.getByTestId('settings-web-limit')).toContainText('ブラウザ版では、アプリを開いているとき・次に開いたときにお知らせします。閉じている間は通知できません。');
    await expect(page.getByTestId('switch-weekly')).toBeChecked();
    await expect(page.getByTestId('switch-day-before')).toBeChecked();
    await expect(page.getByTestId('screen-settings')).toContainText('日本時間');
  });
  test('US-E7-06/AC2 no string in the web build promises background notification', async ({ page }) => {
    const dir = join(ROOT, 'dist', 'assets');
    const text = readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.json')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    for (const p of ['閉じていても通知', '閉じていてもお知らせ', 'even when closed', 'even if the app is closed', 'push notification', 'プッシュ通知']) {
      expect(text.toLowerCase().includes(p.toLowerCase()), p).toBe(false);
    }
    await page.goto('./');
  });
});

test.describe('shown but undismissed (US-E7-05/AC4)', () => {
  const entry = { key: 'day-before:2026-11-04', type: 'day-before', dueAt: '2026-11-03T17:30:00+09:00', expiresAt: '2026-11-04T00:00:00+09:00', shownAt: '2026-11-03T17:30:30+09:00' };
  test('US-E7-05/AC4 shown again at 21:00 with its original time, gone once dismissed, expired at midnight', async ({ page }) => {
    await open(page, '2026-11-03T12:00:00Z', state({ extra: (s) => { s.reminderLog = [clone(entry)]; } }));
    const b = banner(page, 'day-before-2026-11-04');
    await expect(b).toBeVisible();
    await expect(b).toContainText('17:30');
    expect((await readStore(page)).reminderLog.find((e: Json) => e.key === entry.key).dismissedAt).toBeUndefined();
    await b.getByTestId('reminder-dismiss').click();
    await expect(b).toHaveCount(0);
    await page.clock.setSystemTime(iso('2026-11-03T13:00:00Z'));
    await page.reload();
    await expect(page.getByTestId('today-card')).toBeVisible();
    await expect(banner(page, 'day-before-2026-11-04')).toHaveCount(0);
  });
  test('US-E7-05/AC4 never dismissed: not shown on an open at 00:00 JST of the day', async ({ page }) => {
    await open(page, '2026-11-03T15:00:00Z', state({ extra: (s) => { s.reminderLog = [clone(entry)]; } }));
    await expect(page.getByTestId('today-card')).toBeVisible();
    await expect(banner(page, 'day-before-2026-11-04')).toHaveCount(0);
  });
});

test.describe('theme (US-E8-05)', () => {
  const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const lum = (c: string) => { const [r, g, b] = (c.match(/\d+/g) ?? ['0', '0', '0']).map(Number); return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255; };
  test('US-E8-05/AC1 auto follows prefers-color-scheme, also when it changes while open', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page, '2026-11-02T01:00:00Z', state());
    await expect(page.getByTestId('today-card')).toBeVisible();
    expect(lum(await bg(page))).toBeLessThan(0.3);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(async () => lum(await bg(page))).toBeGreaterThan(0.7);
  });
  test('US-E8-05/AC2 a manual dark choice wins over a light device and survives a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page, '2026-11-02T01:00:00Z', state(), './#/settings');
    await page.getByTestId('radio-theme-dark').check();
    await expect.poll(async () => lum(await bg(page))).toBeLessThan(0.3);
    await page.reload();
    await expect(page.getByTestId('screen-settings')).toBeVisible();
    expect(lum(await bg(page))).toBeLessThan(0.3);
    expect((await readStore(page)).settings.theme).toBe('dark');
    await axeSerious(page, 'settings dark');
  });
});

test.describe('share text and wording (US-E9-02, BR-21)', () => {
  const SUNDAY = '2026-11-01T01:00:00Z';
  test('US-E9-02/AC1 a rich profile never reaches the share text (names looked up in the dictionary), ja and en', async ({ page }) => {
    const names: string[] = ['はなちゃん', '野菜は細かく切ると食べます'];
    const prof = BASE.profile;
    const idsAll: string[] = [...prof.likedIds, ...prof.dislikedIds, ...prof.knownAllergenIds, ...prof.excludedIngredientIds, ...prof.themeIds];
    const walk = (o: Json) => {
      if (o !== null && typeof o === 'object') {
        if (typeof o.id === 'string' && idsAll.includes(o.id)) for (const v of [o.ja, o.en, o.name?.ja, o.name?.en, o.label?.ja, o.label?.en]) if (typeof v === 'string' && v.length > 1) names.push(v);
        for (const v of Object.values(o)) walk(v);
      }
    };
    walk(DICT);
    expect(names.length).toBeGreaterThan(4);
    await open(page, SUNDAY, state());
    for (const lang of ['ja', 'en'] as const) {
      if (lang === 'en') await page.getByTestId('lang-toggle-en').click();
      await page.getByTestId('share-button').click();
      const text = (await page.getByTestId('share-preview').innerText()).toLowerCase();
      expect(text).toContain('bentominder');
      for (const n of names) expect(text.includes(n.toLowerCase()), `${lang}: share text contains "${n}"`).toBe(false);
      for (const id of idsAll) expect(text).not.toContain(id);
      expect(bannedHits(text), `banned phrase in ${lang} share text`).toEqual([]);
      await page.keyboard.press('Escape');
      if (await page.getByTestId('share-sheet').count()) await page.getByRole('button', { name: /閉じる|close|キャンセル|cancel/i }).first().click().catch(() => undefined);
    }
  });
  test('US-E7-01 US-E7-02 US-E7-03 US-E9-01 BR-21 no banned phrase in reminder, today and share text, ja and en', async ({ page }) => {
    const s = state({ extra: (x) => { x.reminderLog = []; } });
    await open(page, '2026-11-01T05:00:00Z', s); // Sunday 14:00 JST: weekly due
    await expect(banner(page, 'weekly-2026-11-02')).toBeVisible();
    const grab = async () => (await page.locator('[data-reminder-key], [data-testid="today-card"]').allInnerTexts()).join('\n');
    const ja = await grab();
    await page.getByTestId('lang-toggle-en').click();
    const en = await grab();
    expect(ja.length).toBeGreaterThan(20);
    expect(en.length).toBeGreaterThan(20);
    expect(bannedHits(ja)).toEqual([]);
    expect(bannedHits(en)).toEqual([]);
    expect(en).not.toMatch(/[ぁ-んァ-ヶ]{3,}.*(明日|来週)/);
  });
});

test.describe('production build has no debug UI (US-E11-01/AC2)', () => {
  test('US-E11-01/AC2 /debug is the not-found page and the built JS carries none of the panel markers', async ({ page }) => {
    await open(page, '2026-11-02T01:00:00Z', state(), './#/debug');
    await expect(page.getByTestId('screen-not-found')).toBeVisible();
    await expect(page.getByTestId('debug-open')).toHaveCount(0);
    await page.goto('./#/calendar');
    await expect(page.getByTestId('debug-open')).toHaveCount(0);
    const dir = join(ROOT, 'dist', 'assets');
    const text = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    for (const m of ['BM_DEBUG_PANEL', 'debug-open', 'debug-clock-set', 'debug-triggered', '強制表示', 'テストデータを消去']) expect(text.includes(m), m).toBe(false);
  });
});

test('US-E8-02/AC2 US-E8-03/AC1 after switching to English the page title has no Japanese within a second (flaky unit test shell.test.tsx:111)', async ({ page }) => {
  await open(page, '2026-11-02T01:00:00Z', state(), './#/calendar/2026-11');
  await expect(page.getByTestId('cal-title')).toHaveText('2026年11月');
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.getByTestId('cal-title')).not.toHaveText(/[ぁ-んァ-ヶ一-龠]/);
  await expect.poll(() => page.title(), { timeout: 1000 }).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
});
