// QA M1: every extraction failure path (US-E2-05/06/07), provider-call budget (BR-10), upload and URL
// validation (BR-14), consent (US-E2-08), stopping an import (US-E2-04/AC8), same-file reuse (US-E2-07/AC1).
// The proxy's test-only header x-bm-mock-scenario (route-injected) plays the recorded stand-ins.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FX01, fillProfile, freezeClock, readStore, ROOT, trackProviderCalls, useScenario } from './helpers.ts';

const NOT_A_PDF = join(ROOT, 'tests', 'fixtures', 'pdf', 'not-a-pdf.pdf');
const FX = 'fixture-menu-2026-11';
const OK = `${FX}/hand-1`;

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

async function toImportStep(page: Page) {
  await page.goto('./');
  await fillProfile(page);
  await expect(page.getByTestId('ob-step-2')).toBeVisible();
}

async function uploadFx01(page: Page, accept = true) {
  await page.getByTestId('import-upload').setInputFiles(FX01);
  if (accept) {
    await page.getByTestId('consent-accept').click();
  }
}

function pdfBuffer(total: number): Buffer {
  const b = Buffer.alloc(total, 0x20);
  b.write('%PDF-1.4\n', 0, 'latin1');
  return b;
}

interface Row {
  ac: string;
  scenario: string;
  calls: number;
  outcome: 'review' | 'malformed' | 'busy' | 'unavailable' | 'unreadable';
}
const MSG = {
  malformed: '献立を読み取れませんでした。時間をおいて再度お試しください。',
  busy: '混み合っています。1分ほどしてからもう一度お試しください。',
  unavailable: '読み取りサービスに接続できませんでした。時間をおいて再度お試しください。登録済みの献立と予定はそのままです。',
  unreadable: 'このPDFは読み取れませんでした',
};
const ROWS: Row[] = [
  { ac: 'US-E2-07/AC4 valid', scenario: OK, calls: 1, outcome: 'review' },
  { ac: 'US-E2-05/AC1 US-E2-07/AC4 malformed then valid', scenario: `${FX}/hand-malformed,${OK}`, calls: 2, outcome: 'review' },
  { ac: 'US-E2-05/AC2 US-E2-07/AC4 malformed twice', scenario: `${FX}/hand-malformed`, calls: 2, outcome: 'malformed' },
  { ac: 'US-E2-05/AC2 schema-invalid twice', scenario: `${FX}/hand-schema-invalid`, calls: 2, outcome: 'malformed' },
  { ac: 'US-E2-07/AC4 malformed then rate-limited', scenario: `${FX}/hand-malformed,${FX}/hand-rate-limited-no-retry-after`, calls: 2, outcome: 'busy' },
  { ac: 'US-E2-07/AC4 malformed then unavailable', scenario: `${FX}/hand-malformed,status:503`, calls: 2, outcome: 'unavailable' },
  { ac: 'US-E2-06/AC5 US-E2-07/AC4 rate-limited then valid (fallback)', scenario: `${FX}/hand-rate-limited-no-retry-after,${OK}`, calls: 2, outcome: 'review' },
  { ac: 'US-E2-07/AC4 rate-limited then malformed', scenario: `${FX}/hand-rate-limited-no-retry-after,${FX}/hand-malformed`, calls: 2, outcome: 'malformed' },
  { ac: 'US-E2-06/AC6 US-E2-07/AC4 rate-limited twice (no retry-after)', scenario: `${FX}/hand-rate-limited-no-retry-after`, calls: 2, outcome: 'busy' },
  { ac: 'US-E2-07/AC4 unavailable then valid', scenario: `status:503,${OK}`, calls: 2, outcome: 'review' },
  { ac: 'US-E2-06/AC2 US-E2-07/AC4 unavailable twice', scenario: 'status:503', calls: 2, outcome: 'unavailable' },
  { ac: 'US-E2-06/AC2 timeout twice', scenario: 'timeout', calls: 2, outcome: 'unavailable' },
  { ac: 'US-E2-06/AC7 US-E2-07/AC4 HTTP 400', scenario: 'status:400', calls: 1, outcome: 'unavailable' },
  { ac: 'US-E2-06/AC7 US-E2-07/AC4 HTTP 403', scenario: 'status:403', calls: 1, outcome: 'unavailable' },
  { ac: 'US-E2-06/AC7 US-E2-07/AC4 HTTP 404', scenario: 'status:404', calls: 1, outcome: 'unavailable' },
  { ac: 'US-E2-04/AC5 not-a-menu (1 call)', scenario: `${FX}/hand-not-a-menu`, calls: 1, outcome: 'unreadable' },
];

for (const row of ROWS) {
  test(`${row.ac}: ${row.scenario} -> ${row.calls} provider call(s), ${row.outcome}`, async ({ page }) => {
    const calls = trackProviderCalls(page);
    await useScenario(page, row.scenario);
    await toImportStep(page);
    await uploadFx01(page);
    if (row.outcome === 'review') {
      await expect(page.getByTestId('screen-review')).toBeVisible();
    } else {
      const panel = page.getByTestId('import-error');
      await expect(panel).toContainText(MSG[row.outcome]);
      // other paths always offered (except a bare unreadable file: upload + manual)
      await expect(page.getByTestId('import-upload')).toBeAttached();
      await expect(page.getByTestId('import-manual')).toBeVisible();
      if (row.outcome !== 'unreadable') await expect(page.getByTestId('import-error-retry')).toBeVisible();
      // US-E2-05/AC2, US-E2-06/AC3: nothing stored
      expect((await readStore(page)).menus).toEqual({});
    }
    await expect.poll(() => calls.extractRequests).toBe(1);
    await expect.poll(() => calls.providerCalls).toBe(row.calls);
    // BR-10: the app's own counter agrees with the proxy's
    await expect.poll(async () => Object.values((await readStore(page)).aiUsage as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(row.calls);
  });
}

test('US-E2-06/AC5 rate-limited then fallback: source.model is the fallback model id', async ({ page }) => {
  await useScenario(page, `${FX}/hand-rate-limited-no-retry-after,${OK}`);
  await toImportStep(page);
  await uploadFx01(page);
  await expect(page.getByTestId('screen-review')).toBeVisible();
  const s = await readStore(page);
  const ex = s.menus['2026-11'].extractions[0];
  expect(ex.source.model).toBe('gemini-3.5-flash-lite');
});

test('US-E2-06/AC6 US-E2-06/AC9 rate-limited with Retry-After 60: retry disabled with countdown, other paths enabled', async ({ page }) => {
  await useScenario(page, `${FX}/hand-rate-limited`);
  await toImportStep(page);
  await uploadFx01(page);
  const retry = page.getByTestId('import-error-retry');
  await expect(page.getByTestId('import-error')).toContainText('混み合っています。1分ほどしてからもう一度お試しください。', { timeout: 20_000 });
  await expect(retry).toHaveAttribute('aria-disabled', 'true');
  await expect(retry).toHaveText(/^もう一度（あと(60|59|58|57)秒）$/);
  // the retry button must not start a new import while disabled
  const before = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/menu/extract')).length);
  await retry.click({ force: true });
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/menu/extract')).length);
  expect(after).toBe(before);
  await expect(page.getByTestId('import-upload')).toBeEnabled();
  await expect(page.getByTestId('import-manual')).toBeEnabled();
  // counts down
  const t1 = await retry.innerText();
  await page.waitForTimeout(2200);
  const t2 = await retry.innerText();
  expect(t1).not.toBe(t2);
});

test('US-E2-07/AC2 「もう一度」 is a new action with its own budget of 2', async ({ page }) => {
  const calls = trackProviderCalls(page);
  await useScenario(page, `${FX}/hand-malformed`);
  await toImportStep(page);
  await uploadFx01(page);
  await expect(page.getByTestId('import-error')).toContainText(MSG.malformed);
  await expect.poll(() => calls.providerCalls).toBe(2);
  await page.getByTestId('import-error-retry').click();
  await expect(page.getByTestId('import-error')).toContainText(MSG.malformed);
  await expect.poll(() => calls.extractRequests).toBe(2);
  await expect.poll(() => calls.providerCalls).toBe(4);
  for (const r of calls.replies) expect(r.providerCalls).toBeLessThanOrEqual(2);
});

test('US-E2-06/AC3 a failed December import leaves the November menu byte-for-byte unchanged', async ({ page }) => {
  await toImportStep(page);
  await uploadFx01(page);
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();
  const before = await readStore(page);
  await useScenario(page, 'status:503');
  await page.goto('./#/import');
  await page.getByTestId('import-month').selectOption('2026-10');
  await page.getByTestId('import-upload').setInputFiles(join(ROOT, 'tests', 'fixtures', 'menus', 'fixture-menu-2026-12-events', 'menu.pdf'));
  await page.getByTestId('import-error').waitFor();
  const after = await readStore(page);
  expect(after.menus).toEqual(before.menus);
  expect(after.profile).toEqual(before.profile);
});

test('US-E2-04/AC8 stopping a running import keeps the file, stores no extraction, counts calls made', async ({ page }) => {
  let extractRequests = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/menu/extract') extractRequests += 1;
  });
  // rate limited with Retry-After 60: the proxy waits min(60,5)=5 s before call 2, giving time to stop
  await useScenario(page, `${FX}/hand-rate-limited,${OK}`);
  await toImportStep(page);
  await uploadFx01(page);
  await expect(page.getByTestId('import-progress')).toBeVisible();
  await page.getByTestId('import-cancel').click();
  await expect(page.getByTestId('screen-import')).toBeVisible();
  await page.waitForTimeout(7000); // the provider's answer arrives later: nothing may be stored
  const s = await readStore(page);
  expect(s.menus).toEqual({});
  expect(s.aiUsage).toEqual({ '2026-10': 1 });
  await expect(page.getByTestId('screen-review')).toHaveCount(0);
  expect(extractRequests).toBe(1);
});

test('US-E2-08/AC1 US-E2-08/AC2 US-E2-08/AC3 consent before any extract call; declining keeps manual open; consent stored once', async ({ page }) => {
  const calls = trackProviderCalls(page);
  await toImportStep(page);
  await uploadFx01(page, false);
  const dlg = page.getByTestId('consent-dialog');
  await expect(dlg).toBeVisible();
  const text = await dlg.innerText();
  for (const fact of ['Gemini', '無料枠', '18歳以上', '日本国内']) expect(text).toContain(fact);
  expect(text).not.toMatch(/保存されません|削除されます|プライベート|安全/);
  await expect(page.getByTestId('consent-link')).toHaveAttribute('href', 'https://ai.google.dev/gemini-api/terms');
  await page.getByTestId('consent-decline').click();
  expect(calls.extractRequests).toBe(0);
  await expect(page.getByTestId('banner-consent-declined')).toBeVisible();
  expect((await readStore(page)).consent?.aiNoticeVersion ?? null).toBeNull();
  await page.getByTestId('import-manual').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  expect(calls.extractRequests).toBe(0);
});

test('US-E2-07/AC1 same PDF a second time: 0 provider calls, stored extraction reopened with 「同じファイルです」', async ({ page }) => {
  const calls = trackProviderCalls(page);
  await toImportStep(page);
  await uploadFx01(page);
  await expect(page.getByTestId('screen-review')).toBeVisible();
  const first = calls.extractRequests;
  expect(first).toBe(1);
  await page.goto('./#/import');
  await page.getByTestId('dialog-leave-review-confirm').click();
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await expect(page.getByTestId('banner-same-file')).toBeVisible();
  await expect(page.getByTestId('banner-same-file')).toContainText('同じファイルです');
  expect(calls.extractRequests).toBe(first);
});

test('US-E2-06/AC4 an unknown PDF with the adapter not configured shows 「読み取り機能が設定されていません」, 0 provider calls', async ({ page }) => {
  const calls = trackProviderCalls(page);
  await toImportStep(page);
  await page.getByTestId('import-upload').setInputFiles({ name: 'unknown.pdf', mimeType: 'application/pdf', buffer: pdfBuffer(5000) });
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('import-error')).toContainText('読み取り機能が設定されていません');
  await expect.poll(() => calls.providerCalls).toBe(0);
});

test('US-E2-05/AC4 US-E2-05/AC6 US-E3-01/AC1 out-of-month day is listed aside; duplicate date merged and flagged', async ({ page }) => {
  await useScenario(page, `${FX}/hand-out-of-month`);
  await toImportStep(page);
  await uploadFx01(page);
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await expect(page.getByTestId('review-out-of-month')).toBeVisible();
  await expect(page.getByTestId('review-day-2026-12-01')).toHaveCount(0);
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  const s = await readStore(page);
  expect(s.menus['2026-11'].confirmed.days.some((d: any) => d.date.startsWith('2026-12'))).toBe(false);

  const p2 = await page.context().newPage();
  await freezeClock(p2);
  await useScenario(p2, `${FX}/hand-duplicate`);
  await p2.addInitScript(() => localStorage.clear());
  await p2.goto('./');
  await fillProfile(p2);
  await p2.getByTestId('import-upload').setInputFiles(FX01);
  await p2.getByTestId('consent-accept').click();
  await expect(p2.getByTestId('screen-review')).toBeVisible();
  await expect(p2.locator('[data-testid="review-day-2026-11-05"]')).toHaveCount(1);
  await expect(p2.getByTestId('review-day-2026-11-05')).toContainText('同じ日付');
});

test('US-E2-03/AC2 non-PDF files are rejected before any extract call', async ({ page }) => {
  const calls = trackProviderCalls(page);
  await toImportStep(page);
  const cases: { name: string; mimeType: string; buffer: Buffer; msg: string }[] = [
    { name: 'menu.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), msg: 'PDFファイルを選んでください' },
    { name: 'renamed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('hello this is text'), msg: 'PDFファイルを選んでください' },
    { name: 'almost.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDX-1.4 nope'), msg: 'PDFファイルを選んでください' },
    { name: '<img src=x onerror=alert(1)>.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>'), msg: 'PDFファイルを選んでください' },
  ];
  for (const c of cases) {
    await page.getByTestId('import-upload').setInputFiles({ name: c.name, mimeType: c.mimeType, buffer: c.buffer });
    await expect(page.getByTestId('import-error')).toContainText(c.msg);
  }
  await page.getByTestId('import-upload').setInputFiles(NOT_A_PDF);
  await expect(page.getByTestId('import-error')).toContainText('PDFファイルを選んでください');
  await expect(page.getByTestId('consent-dialog')).toHaveCount(0);
  expect(calls.extractRequests).toBe(0);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
});

test('US-E2-03/AC3 US-E2-03/AC4 size boundary: 10,485,760 B accepted, 10,485,761 B and 0 B rejected before any extract call', async ({ page }) => {
  const calls = trackProviderCalls(page);
  await toImportStep(page);
  await page.getByTestId('import-upload').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: pdfBuffer(10_485_761) });
  await expect(page.getByTestId('import-error')).toContainText('ファイルが大きすぎます（10MBまで）');
  await page.getByTestId('import-upload').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await expect(page.getByTestId('import-error')).toContainText('このPDFは読み取れませんでした');
  expect(calls.extractRequests).toBe(0);
  // exactly 10 MB is accepted by the client (BR-14): it reaches consent and the extract call
  await useScenario(page, OK);
  await page.getByTestId('import-upload').setInputFiles({ name: 'exact.pdf', mimeType: 'application/pdf', buffer: pdfBuffer(10_485_760) });
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible({ timeout: 30_000 });
  expect(calls.extractRequests).toBe(1);
});

test('US-E2-01/AC2 only https URLs without a port are accepted; nothing is requested for the rest', async ({ page }) => {
  const api: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) api.push(r.url());
  });
  await toImportStep(page);
  for (const bad of [
    'http://example-kinder.test/menu/2026-11.pdf',
    'https://example-kinder.test:8443/menu.pdf',
    'ftp://example.test/menu.pdf',
    'javascript:alert(1)',
    'menu.pdf',
    'https://',
    'https://user:pw@example-kinder.test/m.pdf',
    '   ',
    '<script>alert(1)</script>',
  ]) {
    await page.getByTestId('input-url').fill(bad);
    await page.getByTestId('import-submit').click();
    await expect(page.getByTestId('input-url-error'), bad).toContainText('PDFのURL（https://…）を入力してください');
  }
  expect(api).toEqual([]);
});

test('US-E2-01/AC3 URL length boundary 2048 accepted (reaches the proxy), 2049 rejected', async ({ page }) => {
  const fetches: string[] = [];
  // Fulfilled locally: this checks the client rule only (the proxy's own limit is tested directly).
  await page.route('**/api/menu/fetch-pdf', async (route) => {
    fetches.push(route.request().postData() ?? '');
    await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'NETWORK' }) });
  });
  await toImportStep(page);
  const base = 'https://example-kinder.test/';
  const url2048 = base + 'a'.repeat(2048 - base.length);
  const url2049 = url2048 + 'a';
  await page.getByTestId('input-url').fill(url2049);
  await page.getByTestId('import-submit').click();
  await expect(page.getByTestId('input-url-error')).toBeVisible();
  expect(fetches).toHaveLength(0);
  await page.getByTestId('input-url').fill(url2048);
  await page.getByTestId('input-url').press('Tab'); // blur first: see D-M1-02 below
  await page.getByTestId('import-submit').click();
  await expect(page.getByTestId('import-error')).toContainText('URLから取得できませんでした');
  expect(fetches).toHaveLength(1);
});

// D-M1-02 (P3): after an invalid-URL error, correcting the URL and tapping 取り込む straight away does nothing:
// the input's blur removes the error line, the button moves up ~32 px and the tap misses it.
test.fixme('US-E2-01/AC2 D-M1-02 correcting an invalid URL and tapping 取り込む once starts the import', async ({ page }) => {
  let fetches = 0;
  await page.route('**/api/menu/fetch-pdf', (route) => {
    fetches += 1;
    return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'NETWORK' }) });
  });
  await toImportStep(page);
  await page.getByTestId('input-url').fill('menu.pdf');
  await page.getByTestId('import-submit').click();
  await expect(page.getByTestId('input-url-error')).toBeVisible();
  await page.getByTestId('input-url').fill('https://example-kinder.test/ok.pdf');
  await page.getByTestId('import-submit').click();
  await expect(page.getByTestId('import-error')).toBeVisible();
  expect(fetches).toBe(1);
});

for (const [label, status, error, msg] of [
  ['network error', 422, 'NETWORK', 'URLから取得できませんでした。PDFをアップロードしてください。'],
  ['HTTP 404', 422, 'NOT_FOUND', 'ファイルが見つかりませんでした。URLを確かめるか、PDFをアップロードしてください。'],
  ['HTTP 403 / blocked', 422, 'BLOCKED', 'このサイトからは自動で取得できません。PDFを保存してから、アップロードしてください。'],
  ['HTML not a PDF', 422, 'NOT_A_PDF', 'PDFではないようです。献立表PDFのURLを入力するか、PDFをアップロードしてください。'],
  ['too large', 422, 'TOO_LARGE', 'ファイルが大きすぎます（10MBまで）'],
] as const) {
  test(`US-E2-02/AC1 US-E2-02/AC3 fetch failure "${label}" shows its message, keeps the URL, requests no extraction`, async ({ page }) => {
    const calls = trackProviderCalls(page);
    await page.route('**/api/menu/fetch-pdf', (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ ok: false, error }) }));
    await toImportStep(page);
    const url = 'https://example-kinder.test/menu.pdf';
    await page.getByTestId('input-url').fill(url);
    await page.getByTestId('import-submit').click();
    await expect(page.getByTestId('import-error')).toContainText(msg);
    await expect(page.getByTestId('input-url')).toHaveValue(url);
    await expect(page.getByTestId('import-upload')).toBeAttached();
    expect(calls.extractRequests).toBe(0);
  });
}

test('US-E2-01/AC1 US-E2-01/AC4 US-E2-02/AC2 a fetched PDF is extracted and its URL saved and prefilled next time', async ({ page }) => {
  const pdf = readFileSync(FX01);
  await page.route('**/api/menu/fetch-pdf', (route) => route.fulfill({ status: 200, contentType: 'application/pdf', body: pdf, headers: { 'x-bm-sha256': 'x' } }));
  await toImportStep(page);
  const url = 'https://example-kinder.test/menu/2026-11.pdf';
  await page.getByTestId('input-url').fill(url);
  await page.getByTestId('import-submit').click();
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  const s = await readStore(page);
  expect(s.menus['2026-11'].extractions[0].source).toMatchObject({ kind: 'url', url });
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  await page.goto('./#/import');
  await expect(page.getByTestId('input-url')).toHaveValue(url);
});

test('US-E2-01/AC5 target month: 19th preselects this month, 20th the next (Tokyo), whatever the device timezone', async ({ page }) => {
  for (const [iso, expected, opts] of [
    ['2026-11-19T14:59:00Z', '2026-11', ['2026-11', '2026-12']], // 2026-11-19 23:59 JST
    ['2026-11-19T15:00:00Z', '2026-12', ['2026-11', '2026-12']], // 2026-11-20 00:00 JST
    ['2026-12-19T15:00:00Z', '2027-01', ['2026-12', '2027-01']], // 2026-12-20 00:00 JST (year boundary)
    ['2026-12-31T15:00:00Z', '2027-01', ['2027-01', '2027-02']], // 2027-01-01 00:00 JST
  ] as const) {
    await page.clock.setFixedTime(new Date(iso));
    await page.goto('./');
    await page.evaluate(() => localStorage.clear());
    await page.goto('./');
    await fillProfile(page);
    await expect(page.getByTestId('import-month')).toHaveValue(expected);
    const values = await page.getByTestId('import-month').locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
    expect(values, iso).toEqual(opts);
  }
});
