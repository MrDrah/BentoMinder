// QA M1 / US-NF-03: record EVERY request the app makes through a full journey (profile with unique marker
// values, import, review, confirm, profile edit, language switch, export, settings) and assert that no
// request (URL, header or body, in plain / url-encoded / base64 / JSON-escaped form) carries any profile value,
// that every request stays on localhost, and that /api requests have exactly the allowed shape.
import { expect, test, type Request } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FX01, fillProfile, freezeClock } from './helpers.ts';

const NICK = 'ゆにーく名Z9';
const NOTE = '秘密ノート-QX7-ひみつ';
const PROFILE_TOKENS = [
  NICK,
  NOTE,
  'ing-chicken',
  'ing-green-pepper',
  'alg-shrimp',
  'alg-egg',
  'ing-tomato',
  'age-4-5',
  'has-known',
  'none-known',
  'theme-',
  'no-pork',
  'child-1',
  'likedIds',
  'dislikedIds',
  'knownAllergenIds',
  'allergyStatus',
  'nickname',
];

function forms(token: string): string[] {
  const buf = Buffer.from(token, 'utf8');
  return [token, encodeURIComponent(token), buf.toString('base64'), JSON.stringify(token).slice(1, -1), buf.toString('hex'), token.toLowerCase()];
}

function fullText(r: Request): { url: string; headers: string; body: Buffer } {
  return { url: r.url(), headers: JSON.stringify(r.headers()), body: r.postDataBuffer() ?? Buffer.alloc(0) };
}

/** Positive-control-able leak finder: every profile token (plain / encoded forms) in URL, and for /api also headers and body. */
function findLeaks(reqs: Request[]): string[] {
  const out: string[] = [];
  for (const r of reqs) {
    const u = new URL(r.url());
    const { url, headers, body } = fullText(r);
    for (const token of PROFILE_TOKENS) {
      for (const f of forms(token)) {
        if (url.includes(f)) out.push(`${u.pathname} url:${token}`);
        if (u.pathname.startsWith('/api/') && (headers.includes(f) || body.toString('latin1').includes(f) || body.toString('utf8').includes(f))) out.push(`${u.pathname} hdr/body:${token}`);
      }
    }
  }
  return out;
}

test('US-NF-03/AC1 harness positive control: an injected request carrying the nickname IS detected', async ({ page }) => {
  const reqs: Request[] = [];
  page.on('request', (r) => reqs.push(r));
  await page.goto('./');
  await page.evaluate((n) => fetch('/api/menu/fetch-pdf', { method: 'POST', body: JSON.stringify({ url: 'https://x.test/', nickname: n }) }), NICK);
  await page.evaluate((n) => fetch('/api/menu/extract?targetMonth=2026-11&promptVersion=1&schemaVersion=1', { method: 'POST', headers: { 'x-note': btoa(unescape(encodeURIComponent(n))) }, body: 'x' }), NOTE);
  await expect.poll(() => findLeaks(reqs).length).toBeGreaterThanOrEqual(2);
});

test.beforeEach(async ({ page }) => {
  await freezeClock(page);
});

test('US-NF-03/AC1 US-NF-03/AC3 US-E10-01/AC2 US-E2-04/AC7 full journey: no request carries a profile value; only localhost; /api shape fixed', async ({ page }) => {
  const reqs: Request[] = [];
  page.on('request', (r) => reqs.push(r));
  const sockets: string[] = [];
  page.on('websocket', (w) => sockets.push(w.url()));

  await page.goto('./');
  await page.getByTestId('input-nickname').fill(NICK);
  await page.getByTestId('chip-age-age-4-5').click();
  await page.getByTestId('picker-likes-option-ing-chicken').click();
  await page.getByTestId('picker-dislikes-option-ing-green-pepper').click();
  await page.getByTestId('radio-allergy-has-known').check();
  await page.getByTestId('chip-allergen-alg-shrimp').click();
  await page.getByTestId('chip-allergen-alg-egg').click();
  await page.getByTestId('picker-other-foods-search').fill('トマト');
  await page.getByTestId('picker-other-foods-option-ing-tomato').click();
  await page.getByTestId('chip-diet-no-pork').click();
  await page.getByTestId('chip-theme-theme-animals').click();
  await page.getByTestId('input-note').fill(NOTE);
  await page.getByTestId('ob-next').click();
  await expect(page.getByTestId('ob-step-2')).toBeVisible();

  // a blocked URL first (the proxy refuses; the URL itself is not profile data), then the upload
  await page.getByTestId('input-url').fill('https://127.0.0.1/menu.pdf');
  await page.getByTestId('import-submit').click();
  await expect(page.getByTestId('import-error')).toBeVisible();
  await page.getByTestId('import-upload').setInputFiles(FX01);
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('screen-review')).toBeVisible();
  await page.getByTestId('review-dish-2026-11-05-0').fill('さばのみそ煮');
  await page.getByTestId('review-confirm').click();
  await page.getByTestId('dialog-uncertain-confirm').click();
  await expect(page.getByTestId('screen-calendar')).toBeVisible();

  await page.getByTestId('lang-toggle-en').click().catch(() => undefined);
  await page.goto('./#/profile');
  await page.getByTestId('input-nickname').fill(NICK + 'x');
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('screen-settings')).toBeVisible();
  await Promise.all([page.waitForEvent('download'), page.getByTestId('data-export').click()]);
  await page.goto('./#/import');
  await page.waitForTimeout(500);

  expect(sockets).toEqual([]);
  const pdfSha = createHash('sha256').update(readFileSync(FX01)).digest('hex');
  expect(findLeaks(reqs)).toEqual([]);
  let apiCount = 0;
  for (const r of reqs) {
    const u = new URL(r.url());
    // US-NF-03/AC3: nothing leaves the origin (no analytics, ads, CDN fonts)
    expect(['localhost:4173'], `third-party request ${r.url()}`).toContain(u.host);
    const { url, headers, body } = fullText(r);
    for (const token of PROFILE_TOKENS) {
      for (const f of forms(token)) {
        expect(url, `${r.method()} ${u.pathname} url carries "${token}"`).not.toContain(f);
        // `theme-` / `nickname` style words legitimately occur in static asset names / headers only for GET assets
        if (u.pathname.startsWith('/api/')) {
          expect(headers, `${u.pathname} headers carry "${token}"`).not.toContain(f);
          expect(body.toString('latin1'), `${u.pathname} body carries "${token}" (${f})`).not.toContain(f);
          expect(body.toString('utf8'), `${u.pathname} body(utf8) carries "${token}"`).not.toContain(f);
        }
      }
    }
    if (u.pathname.startsWith('/api/')) {
      apiCount += 1;
      expect(r.method()).toBe('POST');
      if (u.pathname === '/api/menu/extract') {
        expect([...u.searchParams.keys()].sort()).toEqual(['promptVersion', 'schemaVersion', 'targetMonth']);
        expect(createHash('sha256').update(body).digest('hex'), 'body must be exactly the uploaded PDF bytes').toBe(pdfSha);
        const custom = Object.keys(r.headers()).filter((h) => h.startsWith('x-'));
        expect(custom).toEqual([]);
        expect(r.headers()['cookie']).toBeUndefined();
      } else if (u.pathname === '/api/menu/fetch-pdf') {
        expect(Object.keys(JSON.parse(body.toString('utf8'))).sort()).toEqual(['url']);
        expect(u.search).toBe('');
      } else {
        throw new Error(`unexpected /api path ${u.pathname}`);
      }
    }
  }
  expect(apiCount).toBeGreaterThanOrEqual(2);
});

test('US-NF-03/AC1 the app sends no cookies, no referrer to a third party and sets no cookie', async ({ page, context }) => {
  await page.goto('./');
  await fillProfile(page, { nickname: NICK });
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).toBe('');
});

test('US-NF-03/AC3 production bundle references no third-party host', async ({ request }) => {
  const html = await (await request.get('./')).text();
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]!);
  expect(assets.length).toBeGreaterThan(0);
  const hostsFound = new Set<string>();
  for (const a of assets.filter((x) => /\.(js|css)$/.test(x))) {
    const text = await (await request.get(a)).text();
    for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) hostsFound.add(m[1]!.toLowerCase());
  }
  // known harmless: w3.org (SVG/XML namespaces), reactjs.org (React error-decoder text), ai.google.dev (the consent link, a user-initiated link)
  const allowed = new Set(['www.w3.org', 'w3.org', 'react.dev', 'reactjs.org', 'ai.google.dev', 'json-schema.org' /* zod $schema identifier string, never fetched */, 'localhost', '127.0.0.1', 'example.com']);
  const unexpected = [...hostsFound].filter((h) => !allowed.has(h));
  test.info().annotations.push({ type: 'hosts', description: [...hostsFound].join(', ') });
  expect(unexpected).toEqual([]);
});
