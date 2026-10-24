// QA M1: persistence, export / delete-all / import round trip, corrupt, newer and old stores,
// failing storage (US-E10-01…05, US-E1-06, US-E8-01/AC3).
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { allKeys, FX01, fillProfile, freezeClock, KEY, readStore, ROOT, STATE_V1 } from './helpers.ts';

const SCRATCH = join(ROOT, 'tests', '_scratch', 'qa-m1');
mkdirSync(SCRATCH, { recursive: true });

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

/** A real store built by the app: profile + confirmed menu + EN language + consent. */
async function buildRealStore(page: Page) {
  await page.goto('./');
  await fillProfile(page, { nickname: 'テスト', likes: ['ing-chicken'], dislikes: ['ing-green-pepper'], note: 'ノート' });
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await page.getByTestId('review-dish-2026-11-05-0').fill('さばのみそ煮');
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
}

test('US-E10-03/AC4 US-E10-04/AC1 US-E10-03/AC3 US-E10-01/AC1 export, delete all, back to onboarding, import the file: identical store', async ({ page }) => {
  await buildRealStore(page);
  await page.getByTestId('lang-toggle-en').click().catch(() => undefined);
  await page.goto('./#/settings');
  const before = await readStore(page);
  const keysBefore = await allKeys(page);
  expect(keysBefore).toContain(KEY);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('data-export').click()]);
  expect(download.suggestedFilename()).toBe('bentominder-export-2026-10-28.json');
  const file = join(SCRATCH, `export-${test.info().project.name}.json`);
  await download.saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(Object.keys(exported).sort()).toEqual(Object.keys(before).sort()); // no other top-level field
  expect(exported).toEqual(before);

  // 取り消し keeps everything (US-E10-04/AC2)
  await page.getByTestId('data-delete-all').click();
  await page.getByTestId('dialog-delete-all-cancel').click();
  expect(await readStore(page)).toEqual(before);
  await page.getByTestId('data-delete-all').click();
  await page.getByTestId('dialog-delete-all-confirm').click();
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  expect(await allKeys(page)).toEqual([]);

  // import the exported file from settings (the store is empty: onboarding step 1 has no settings link, navigate by URL)
  await page.goto('./#/settings');
  await expect(page.getByTestId('screen-settings')).toBeVisible();
  await page.getByTestId('data-import').setInputFiles(file);
  await expect(page.getByTestId('dialog-import-data')).toBeVisible();
  await page.getByTestId('dialog-import-data-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  const after = await readStore(page);
  expect(after).toEqual(before);
  await page.reload();
  expect(await readStore(page)).toEqual(before);
});

// US-E10-03/AC2: with nothing stored the settings screen is never reached (D-M1-03, P4): a deep link to
// #/settings opens onboarding step 1, so the disabled-export state cannot be seen through the UI.
test('US-E10-03/AC2 D-M1-03 with nothing stored #/settings opens onboarding, so no export is possible', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  await expect(page.getByTestId('data-export')).toHaveCount(0);
  expect(await allKeys(page)).toEqual([]);
});

test.fixme('US-E10-03/AC2 D-M1-03 settings with nothing stored shows the export button disabled with 「書き出すデータがありません」', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByTestId('data-export')).toHaveAttribute('aria-disabled', 'true');
});

test('US-E10-03/AC5 US-E10-03/AC6 a file that is not a valid export, or from a newer app, changes nothing', async ({ page }) => {
  await page.addInitScript((v) => {
    if (localStorage.getItem('bentominder.state') === null) localStorage.setItem('bentominder.state', v);
  }, JSON.stringify(JSON.parse(STATE_V1)));
  await page.goto('./#/settings');
  const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
  const input = page.getByTestId('data-import');
  const bad = [
    { name: 'a.json', buffer: Buffer.from('not json at all') },
    { name: 'b.json', buffer: Buffer.from('{"schemaVersion":1}') },
    { name: 'c.json', buffer: Buffer.from('[]') },
    { name: 'd.json', buffer: Buffer.from('null') },
    { name: 'e.json', buffer: Buffer.from(JSON.stringify({ ...JSON.parse(STATE_V1), extraTopLevel: 1 })) },
    { name: 'f.json', buffer: Buffer.from('<script>alert(1)</script>') },
    { name: 'g.json', buffer: Buffer.from('\u0000\u0001') },
  ];
  for (const b of bad) {
    await input.setInputFiles({ name: b.name, mimeType: 'application/json', buffer: b.buffer });
    await expect(page.getByTestId('data-import-error'), b.name).toHaveText('このファイルは読み込めません。BentoMinderから書き出したファイルを選んでください。');
    await expect(page.getByTestId('dialog-import-data')).toHaveCount(0);
  }
  await input.setInputFiles({ name: 'new.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...JSON.parse(STATE_V1), schemaVersion: 99 })) });
  await expect(page.getByTestId('data-import-error')).toHaveText('このファイルは新しいバージョンのアプリで作られています。アプリを更新してください。');
  await expect(page.getByTestId('dialog-import-data')).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(before);
});

test('US-E10-03/AC3 cancelling the replace dialog keeps the current data', async ({ page }) => {
  await page.addInitScript((v) => {
    if (localStorage.getItem('bentominder.state') === null) localStorage.setItem('bentominder.state', v);
  }, JSON.stringify(JSON.parse(STATE_V1)));
  await page.goto('./#/settings');
  const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
  const other = JSON.parse(STATE_V1);
  other.profile = { ...other.profile, nickname: 'ほかの子' };
  await page.getByTestId('data-import').setInputFiles({ name: 'o.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(other)) });
  await expect(page.getByTestId('dialog-import-data')).toBeVisible();
  await page.getByTestId('dialog-import-data-cancel').click();
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(before);
});

test('US-E10-02/AC4 US-E10-02/AC7 corrupt store: nothing written until chosen; export gives the raw text; cancel keeps; reset asks and starts over', async ({ page }) => {
  const raws = ['{ broken', '', '[]', 'null', '"x"', JSON.stringify({ schemaVersion: 1, nope: true }), '\u0000'];
  for (const raw of raws) {
    const p = await page.context().newPage();
    await freezeClock(p);
    await p.addInitScript((r) => {
      if (sessionStorage.getItem('seeded') === null) {
        localStorage.setItem('bentominder.state', r);
        sessionStorage.setItem('seeded', '1');
      }
    }, raw);
    await p.goto('./');
    // an empty string is how the browser stores "no value": the app may treat it as corrupt; either is acceptable, but it must not crash.
    const corrupt = p.getByTestId('screen-corrupt-data');
    const onboarding = p.getByTestId('ob-step-1');
    await expect(corrupt.or(onboarding), `raw=${JSON.stringify(raw)}`).toBeVisible();
    if (await corrupt.isVisible()) {
      expect(await p.evaluate(() => localStorage.getItem('bentominder.state'))).toBe(raw);
      expect(await p.evaluate(() => Object.keys(localStorage))).toEqual(['bentominder.state']); // nothing written
      const [d] = await Promise.all([p.waitForEvent('download'), p.getByTestId('recovery-export').click()]);
      expect(readFileSync((await d.path()) as string, 'utf8')).toBe(raw);
      await p.getByTestId('recovery-reset').click();
      await expect(p.getByTestId('dialog-reset-store')).toContainText('データを初期化しますか？');
      await p.getByTestId('dialog-reset-store-cancel').click();
      await expect(corrupt).toBeVisible();
      expect(await p.evaluate(() => localStorage.getItem('bentominder.state'))).toBe(raw);
      await p.getByTestId('recovery-reset').click();
      await p.getByTestId('dialog-reset-store-confirm').click();
      await expect(p.getByTestId('ob-step-1')).toBeVisible();
      await expect(p.locator('html')).toHaveAttribute('lang', 'ja');
      expect(await p.evaluate(() => localStorage.getItem('bentominder.state'))).toBeNull();
    }
    await p.close();
  }
});

test('US-E10-02/AC3 a newer store (schemaVersion 99) is never overwritten; only export is offered; reload keeps it', async ({ page }) => {
  const newer = JSON.stringify({ ...JSON.parse(STATE_V1), schemaVersion: 99 });
  await page.addInitScript((v) => {
    if (sessionStorage.getItem('seeded') === null) {
      localStorage.setItem('bentominder.state', v);
      sessionStorage.setItem('seeded', '1');
    }
  }, newer);
  await page.goto('./');
  await expect(page.getByTestId('screen-newer-data')).toBeVisible();
  await expect(page.locator('main')).toContainText('新しいバージョンのデータです。アプリを更新してください。');
  await expect(page.getByTestId('recovery-reset')).toHaveCount(0);
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('recovery-export').click()]);
  expect(readFileSync((await d.path()) as string, 'utf8')).toBe(newer);
  await page.reload();
  await expect(page.getByTestId('screen-newer-data')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bentominder.state'))).toBe(newer);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['bentominder.state']);
});

test('US-E10-02/AC3 newer-version store stays untouched when the user tampers with the URL (import / settings / review)', async ({ page }) => {
  const newer = JSON.stringify({ ...JSON.parse(STATE_V1), schemaVersion: 99 });
  await page.addInitScript((v) => localStorage.getItem('bentominder.state') === null && localStorage.setItem('bentominder.state', v), newer);
  for (const hash of ['#/settings', '#/import', '#/review/2026-11', '#/onboarding/2', '#/calendar/2026-11']) {
    await page.goto('./' + hash);
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('bentominder.state')), hash).toBe(newer);
  }
});

// D-M1-04 (P4, spec gap): schema v1 is the first shape, so no real schemaVersion-0 fixture exists and the migration
// map is empty. A v1 fixture with only schemaVersion changed is (correctly) treated as unreadable. AC2 is verified
// only by the developer's unit test of migrate(); there is nothing to run end to end until a v2 exists.
test.fixme('US-E10-02/AC2 D-M1-04 an older store is migrated once with a backup, nothing lost (needs a real v0 fixture)', async ({ page }) => {
  await page.goto('./');
});

test('US-E10-02/AC4 a schemaVersion-0 document that is not a real v0 shape is treated as unreadable, not silently rewritten', async ({ page }) => {
  const v0 = JSON.stringify({ ...JSON.parse(STATE_V1), schemaVersion: 0 });
  await page.addInitScript((v) => localStorage.getItem('bentominder.state') === null && localStorage.setItem('bentominder.state', v), v0);
  await page.goto('./');
  await expect(page.getByTestId('screen-corrupt-data')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bentominder.state'))).toBe(v0);
});

test('US-E10-05/AC1 a stored store that fails the contract is refused (unknown top-level field, bad decision)', async ({ page }) => {
  const bad = JSON.stringify({ ...JSON.parse(STATE_V1), extra: 1 });
  await page.addInitScript((v) => localStorage.getItem('bentominder.state') === null && localStorage.setItem('bentominder.state', v), bad);
  await page.goto('./');
  await expect(page.getByTestId('screen-corrupt-data')).toBeVisible();
});

test('US-E1-06/AC1 US-E1-06/AC2 US-E1-06/AC3 deleting the profile keeps the menu, the next launch asks for a profile again', async ({ page }) => {
  await buildRealStore(page);
  const before = await readStore(page);
  await page.goto('./#/settings');
  await page.getByTestId('settings-profile-delete').click();
  await expect(page.getByTestId('dialog-delete-profile')).toBeVisible();
  await page.getByTestId('dialog-delete-profile-cancel').click();
  expect((await readStore(page)).profile).toEqual(before.profile);
  await page.getByTestId('settings-profile-delete').click();
  await page.getByTestId('dialog-delete-profile-confirm').click();
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  const after = await readStore(page);
  expect(after.profile).toBeNull();
  expect(after.menus).toEqual(before.menus);
  expect(JSON.stringify(after)).not.toContain('テスト');
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
});

test('US-E1-05/AC3 cancel discards unsaved profile edits; save stores them', async ({ page }) => {
  await buildRealStore(page);
  await page.goto('./#/profile');
  await page.getByTestId('input-nickname').fill('へんこう');
  await page.getByTestId('profile-cancel').click();
  await page.getByTestId('dialog-discard-profile-confirm').click();
  expect((await readStore(page)).profile.nickname).toBe('テスト');
  await page.goto('./#/profile');
  await page.getByTestId('input-nickname').fill('へんこう');
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('screen-settings')).toBeVisible();
  expect((await readStore(page)).profile.nickname).toBe('へんこう');
});

test('US-E10-02/AC5 US-E10-02/AC6 storage that cannot be written: the app says so and never claims it saved', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if ((window as unknown as { __failWrites?: boolean }).__failWrites) throw new DOMException('full', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
  });
  await page.goto('./');
  await fillProfile(page);
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await page.evaluate(() => ((window as unknown as { __failWrites: boolean }).__failWrites = true));
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.locator('body')).toContainText('保存できませんでした。もう一度お試しください。');
  await expect(page.locator('body')).not.toContainText('の献立を確定しました');
  expect((await readStore(page)).menus['2026-11'].confirmed ?? null).toBeNull();
  await page.evaluate(() => ((window as unknown as { __failWrites: boolean }).__failWrites = false));
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  expect((await readStore(page)).menus['2026-11'].confirmed.version).toBe(1);
});

test('US-E8-01/AC3 the chosen language persists across reload; delete-all returns to Japanese', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('lang-toggle-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('ob-step-1')).toBeVisible();
  writeFileSync(join(SCRATCH, 'lang-keys.json'), JSON.stringify(await allKeys(page)));
});
