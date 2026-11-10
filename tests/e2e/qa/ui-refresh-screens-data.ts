// Every screen the UI refresh touched, with the store it needs. Used by the layout, a11y and screenshot specs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakeBackend } from '../../../src/domain/sync/fake-port.ts';
import { SyncPortError, type Membership } from '../../../src/domain/sync/types.ts';
import type { Browser, BrowserContext, Page, Route } from '@playwright/test';
import { expect } from '@playwright/test';
import { jst10, M2, matrixStore, seed, type Json } from './ui-refresh-common.ts';

export function reviewStore(): string {
  const hand = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'menus', 'fixture-menu-2026-11-wdmismatch', 'recorded', 'hand-1.json'), 'utf8'));
  const base: Json = JSON.parse(JSON.stringify(M2));
  base.menus = {};
  base.decisions = {};
  base.overrides = {};
  const extraction = {
    ...hand.response.modelOutput,
    id: 'ext-2026-11-aaaaaaaa',
    source: { kind: 'fixture', filename: 'menu.pdf', sha256: 'a'.repeat(64), byteSize: 1, fetchedAt: '2026-11-02T10:00:00+09:00', model: 'gemini-3.8-flash', promptVersion: 1 },
    extractedAt: '2026-11-02T10:00:00+09:00',
  };
  base.menus['2026-11'] = { month: '2026-11', extractions: [extraction], confirmed: null, pendingReviewExtractionId: extraction.id, ownerId: 'local', createdAt: extraction.extractedAt, updatedAt: extraction.extractedAt };
  return JSON.stringify(base);
}

export interface Screen {
  name: string;
  hash: string;
  /** null = no store (a brand-new device: onboarding), 'signed-out' = the login screen */
  store: 'matrix' | 'review' | 'none' | 'signed-out';
  today?: string;
  /** a selector that proves the screen is up */
  ready: string;
}

export const SCREENS: Screen[] = [
  { name: 'calendar', hash: '#/calendar/2026-11', store: 'matrix', today: '2026-11-17', ready: '[data-testid="screen-calendar"]' },
  { name: 'calendar-day-sheet', hash: '#/day/2026-11-18', store: 'matrix', today: '2026-11-17', ready: '[data-testid="day-sheet"]' },
  { name: 'calendar-no-menu', hash: '#/calendar/2026-12', store: 'matrix', today: '2026-12-02', ready: '[data-testid="menu-card-missing"]' },
  { name: 'import', hash: '#/import', store: 'matrix', today: '2026-11-17', ready: '[data-testid="screen-import"]' },
  { name: 'review', hash: '#/review/2026-11', store: 'review', today: '2026-11-02', ready: '[data-testid="review-confirm"]' },
  { name: 'onboarding-1', hash: '#/onboarding/1', store: 'none', today: '2026-11-17', ready: '[data-testid="screen-onboarding"]' },
  { name: 'profile', hash: '#/profile', store: 'matrix', today: '2026-11-17', ready: 'main' },
  { name: 'settings', hash: '#/settings', store: 'matrix', today: '2026-11-17', ready: '[data-testid="settings-profile-edit"]' },
  { name: 'recipes', hash: '#/recipes', store: 'matrix', today: '2026-11-17', ready: 'main' },
  { name: 'recipe-detail', hash: '#/recipe/rcp-kuma-onigiri?date=2026-11-18', store: 'matrix', today: '2026-11-17', ready: 'main' },
  { name: 'recommend', hash: '#/recommend/2026-11-18', store: 'matrix', today: '2026-11-17', ready: 'main' },
  { name: 'login', hash: '#/', store: 'signed-out', today: '2026-11-17', ready: '[data-testid="login-google"]' },
  { name: 'join', hash: '#/join/ABCDEFGHJK', store: 'matrix', today: '2026-11-17', ready: 'main' },
  { name: 'not-found', hash: '#/nope/nothing', store: 'matrix', today: '2026-11-17', ready: 'main' },
];

// ---------------------------------------------------------------- the E15 family card and the sync status, over the FakeBackend of the engine tests
const BASE = 'https://sync.e2e.test';
export const USER_A = { uid: 'test-uid-001', displayName: 'Test Parent', email: 'parent@example.test', photoUrl: null };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };

function wireMembership(m: Membership): Record<string, unknown> {
  if (m.status !== 'member') return m.status === 'none' ? { status: 'none' } : { status: 'ended', reason: m.reason };
  return {
    status: 'member',
    familyId: m.familyId,
    consentVersion: m.consentVersion,
    consentedAt: new Date().toISOString(),
    maxMembers: m.maxMembers ?? 2,
    members: (m.members ?? []).map((x) => ({ uid: x.uid, you: x.you, joinedAt: new Date().toISOString(), consentVersion: 1, ...(x.email === undefined ? {} : { email: x.email }) })),
    invite: m.invite ?? null,
  };
}

async function serve(route: Route, backend: FakeBackend): Promise<void> {
  const request = route.request();
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const uid = /^Bearer fake-id-token-(.+)-\d+$/.exec(request.headers()['authorization'] ?? '')?.[1];
  const op = new URL(request.url()).pathname.replace(/^\/v1\//, '');
  const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
  const json = (status: number, payload: Record<string, unknown>) => route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(payload) });
  if (uid === undefined) return json(401, { ok: false, error: 'UNAUTHENTICATED' });
  const port = backend.portFor(uid);
  const consent = { version: Number(body['consentVersion'] ?? 1) };
  try {
    let result: Record<string, unknown> = {};
    switch (op) {
      case 'membership.get':
        result = wireMembership(await port.readMembership(true));
        break;
      case 'family.create':
        result = await port.createFamily(consent);
        break;
      case 'invite.create':
        result = { ...(await port.createInvite()) };
        break;
      case 'invite.cancel':
        await port.cancelInvite();
        break;
      case 'consent.set':
        await port.setConsent(consent);
        break;
      case 'records.push':
        result = { results: await port.push(body['records'] as never), seq: 0, schemaVersion: 1 };
        break;
      case 'records.pull':
        result = { ...(await port.pull(Number(body['cursor'] ?? 0))) };
        break;
      default:
        return json(404, { ok: false, error: 'NOT_FOUND' });
    }
    return json(200, { ok: true, serverNowMs: Date.now(), ...result });
  } catch (err) {
    if (!(err instanceof SyncPortError)) throw err;
    return json(503, { ok: false, error: 'UNAVAILABLE' });
  }
}

/** A device signed in as USER_A with sync switched on against a FakeBackend (the same seam the E15 specs use). */
export async function familyDevice(browser: Browser, width: number, height: number, _today: string, storeJson?: string): Promise<{ context: BrowserContext; page: Page; backend: FakeBackend }> {
  const backend = new FakeBackend({ nowMs: () => Date.now() });
  backend.emails.set(USER_A.uid, USER_A.email);
  const context = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width, height }, timezoneId: 'Asia/Tokyo', locale: 'ja-JP', hasTouch: width < 768, isMobile: width < 768 });
  await context.route(`${BASE}/**`, (route) => serve(route, backend));
  const page = await context.newPage();
  const entries: Record<string, string> = {
    'bentominder.fake-auth': JSON.stringify(USER_A),
    'bentominder.fake-sync-base': BASE,
    [`bentominder.${USER_A.uid}.state`]: (storeJson ?? readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'v1.json'), 'utf8')).replace(/"local"/g, `"${USER_A.uid}"`),
  };
  await page.addInitScript((e) => {
    if (window.sessionStorage.getItem('uir-seeded') !== null) return;
    window.sessionStorage.setItem('uir-seeded', '1');
    for (const [k, v] of Object.entries(e)) window.localStorage.setItem(k, v);
  }, entries);
  return { context, page, backend };
}

export async function openScreen(page: Page, sc: Screen, lang: 'ja' | 'en' = 'ja'): Promise<void> {
  await page.clock.setFixedTime(jst10(sc.today ?? '2026-11-17'));
  if (sc.store === 'matrix') await seed(page, matrixStore(lang));
  else if (sc.store === 'review') await seed(page, reviewStore());
  else if (sc.store === 'signed-out') await page.addInitScript(() => window.localStorage.setItem('bentominder.fake-auth', 'signed-out'));
  await page.goto(`./${sc.hash}`);
  await expect(page.locator(sc.ready).first()).toBeVisible();
  await page.waitForTimeout(250);
}
