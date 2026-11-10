// E15 slice D: the family journey on two simulated devices (two browser contexts, two parents) against the e2e build, with the
// FakeBackend of the engine tests served over the REAL wire (the production HTTP adapter posts to https://sync.e2e.test/v1/<op>;
// `context.route` answers from a FakeBackend that lives in this Node process and is shared by both contexts). Nothing fake is
// in the production bundle: the only seam is the localStorage key that switches sync on in the VITE_AUTH_FAKE=1 build.
import { expect, test, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import { FakeBackend } from '../../src/domain/sync/fake-port.ts';
import { SyncPortError, type Membership } from '../../src/domain/sync/types.ts';
import { expectNoSeriousAxe, STATE_V1 } from './helpers.ts';

const BASE = 'https://sync.e2e.test';
const USER_A = { uid: 'test-uid-001', displayName: 'Test Parent', email: 'parent@example.test', photoUrl: null };
const USER_B = { uid: 'test-uid-002', displayName: 'Other Parent', email: 'other@example.test', photoUrl: null };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };

const REFUSED: Record<string, [number, string]> = {
  'invalid-code': [400, 'INVITE_INVALID'],
  expired: [400, 'INVITE_EXPIRED'],
  'family-full': [409, 'FAMILY_FULL'],
  'already-in-family': [409, 'ALREADY_IN_FAMILY'],
  'too-many-attempts': [429, 'TOO_MANY_ATTEMPTS'],
  'not-member': [403, 'NOT_MEMBER'],
};

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

/** Answers the wire of the sync function from the FakeBackend. The caller's account is read from the fake ID token. */
async function serve(route: Route, backend: FakeBackend): Promise<void> {
  const request = route.request();
  if (request.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS });
    return;
  }
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
      case 'invite.redeem':
        result = await port.redeemInvite(String(body['code']), consent);
        break;
      case 'consent.set':
        await port.setConsent(consent);
        break;
      case 'family.leave':
        await port.leave();
        break;
      case 'family.removeMember':
        await port.removeMember(String(body['uid']));
        break;
      case 'family.delete':
        await port.deleteFamily();
        break;
      case 'membership.ack':
        await port.ackMembershipEnd();
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
    if (err.kind === 'consent-required') return json(403, { ok: false, error: 'CONSENT_REQUIRED' });
    if (err.kind === 'membership-ended') return json(410, { ok: false, error: 'MEMBERSHIP_ENDED', reason: err.detail });
    if (err.kind === 'refused') {
      const [status, code] = REFUSED[err.detail ?? ''] ?? [400, 'BAD_REQUEST'];
      return json(status, { ok: false, error: code });
    }
    return json(503, { ok: false, error: 'UNAVAILABLE' });
  }
}

async function device(browser: Browser, backend: FakeBackend, user: typeof USER_A, seedStore: boolean): Promise<{ context: BrowserContext; page: Page }> {
  const use = test.info().project.use;
  const context = await browser.newContext({
    baseURL: 'http://localhost:4173',
    ...(use.viewport === undefined ? {} : { viewport: use.viewport }),
    ...(use.hasTouch === undefined ? {} : { hasTouch: use.hasTouch }),
    ...(use.isMobile === undefined ? {} : { isMobile: use.isMobile }),
    ...(use.timezoneId === undefined ? {} : { timezoneId: use.timezoneId }),
    ...(use.locale === undefined ? {} : { locale: use.locale }),
  });
  await context.route(`${BASE}/**`, (route) => serve(route, backend));
  const page = await context.newPage();
  const entries: Record<string, string> = { 'bentominder.fake-auth': JSON.stringify(user), 'bentominder.fake-sync-base': BASE };
  if (seedStore) entries[`bentominder.${user.uid}.state`] = STATE_V1.replace(/"local"/g, `"${user.uid}"`);
  await page.addInitScript((e) => {
    if (window.sessionStorage.getItem('e15-seeded') !== null) return;
    window.sessionStorage.setItem('e15-seeded', '1');
    for (const [k, v] of Object.entries(e)) window.localStorage.setItem(k, v);
  }, entries);
  return { context, page };
}

test('US-E15-01/AC3 US-E15-03/AC1 US-E15-04/AC3 create -> invite -> join: two parents see the same family; consent first; no onboarding for the joiner', async ({ browser }) => {
  const backend = new FakeBackend({ nowMs: () => Date.now() });
  backend.emails.set(USER_A.uid, USER_A.email);
  backend.emails.set(USER_B.uid, USER_B.email);
  const a = await device(browser, backend, USER_A, true);
  const b = await device(browser, backend, USER_B, false);
  try {
    // Parent A: settings -> create family. The notice comes first; focus is on its heading.
    await a.page.goto('./#/settings');
    await expect(a.page.getByTestId('family-create')).toBeVisible();
    await expectNoSeriousAxe(a.page, 'family card (no family)');
    await a.page.getByTestId('family-create').click();
    await expect(a.page.getByTestId('consent-cloud')).toBeVisible();
    await expect(a.page.getByRole('heading', { level: 2, name: '家族でデータを共有する前に' })).toBeFocused();
    await expectNoSeriousAxe(a.page, 'consent notice');
    expect(backend.families.size).toBe(0);
    await a.page.getByTestId('consent-cloud-accept').click();
    await expect(a.page.getByTestId('family-status-row')).toBeVisible();
    expect(backend.families.size).toBe(1);

    // The first upload finishes, then the invite is possible.
    const invite = a.page.getByTestId('invite-create');
    await expect(invite).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 });
    await invite.click();
    const code = (await a.page.getByTestId('invite-code').locator('.visually-hidden').textContent())?.replace(/\s/g, '') ?? '';
    expect(code).toHaveLength(10);
    await expectNoSeriousAxe(a.page, 'invite shown');

    // Parent B opens the link on a device with nothing: the join screen, not onboarding.
    await b.page.goto(`./#/join/${code}`);
    await expect(b.page.getByTestId('screen-join')).toBeVisible();
    await expectNoSeriousAxe(b.page, 'join screen');
    await b.page.getByTestId('join-next').click();
    await expect(b.page.getByTestId('consent-cloud')).toBeVisible();
    await b.page.getByTestId('consent-cloud-accept').click();
    await expect(b.page.getByTestId('dialog-join-confirm')).toBeVisible();
    await b.page.getByTestId('dialog-join-confirm-ok').click();
    await expect(b.page.getByTestId('screen-calendar')).toBeVisible({ timeout: 15_000 });
    await expect(b.page.getByTestId('screen-onboarding')).toHaveCount(0);
    await expect(b.page.getByTestId('appbar-sync')).toBeVisible();

    // B sees the family in settings; A sees B after a focus (the page refreshes the list).
    await b.page.goto('./#/settings');
    await expect(b.page.getByTestId('family-member-1')).toBeVisible();
    await expectNoSeriousAxe(b.page, 'family card (member)');
    await a.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(a.page.getByTestId('family-member-1')).toContainText('other@example.test');
    expect(backend.families.size).toBe(1);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('US-E15-02/AC4 US-E15-01/AC2 declining the notice sends nothing and keeps the app local', async ({ browser }) => {
  const backend = new FakeBackend({ nowMs: () => Date.now() });
  const a = await device(browser, backend, USER_A, true);
  try {
    await a.page.goto('./#/settings');
    await a.page.getByTestId('family-create').click();
    await a.page.getByTestId('consent-cloud-decline').click();
    await expect(a.page.getByTestId('consent-cloud')).toHaveCount(0);
    await expect(a.page.getByTestId('toast')).toContainText('共有はしていません');
    await expect(a.page.getByTestId('family-create')).toBeVisible();
    expect(backend.families.size).toBe(0);
  } finally {
    await a.context.close();
  }
});
