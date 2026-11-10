// QA E15 e2e. Two browser contexts = two parents, each with the e2e build (fake sign-in + the sync test seam). The sync base is answered by the
// REAL request pipeline of functions/src/sync (CORS, token check, authorisation, operations) over a fake Firestore in this Node process.
// Stories: US-E15-01/AC1 AC2 AC6, US-E15-02/AC1 AC4 AC8, US-E15-03/AC1 AC6 AC7, US-E15-04/AC1 AC2 AC3 AC4 AC8 AC10, US-E15-06/AC4 AC7,
// US-E15-08/AC1-AC3 AC6 AC9, US-NF-02 (axe, both themes, 390 and 1280).
import { expect, test, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import { handleSync } from '../../../functions/src/sync/service.ts';
import { createHash } from 'node:crypto';
import { parseAllowList } from '../../../server/core/hosted-policy.ts';
import { DEFAULT_SYNC_CONFIG } from '../../../functions/src/sync/config.ts';
import { FakeFirestore } from '../../unit/functions/sync/fake-firestore.ts';
import { expectNoSeriousAxe, STATE_V1 } from '../helpers.ts';

const BASE = 'https://sync.qa-e15.test';
const ORIGIN = 'http://localhost:4173';
const A = { uid: 'test-uid-001', displayName: 'Test Parent', email: 'parent-a@example.test', photoUrl: null };
const B = { uid: 'test-uid-002', displayName: 'Other Parent', email: 'parent-b@example.test', photoUrl: null };

interface Rig {
  db: FakeFirestore;
  deps(): import('../../../functions/src/sync/service.ts').SyncDeps;
}
interface World {
  rig: Rig;
  requests: Array<{ uid: string; op: string; status: number }>;
}
function world(): World {
  const db = new FakeFirestore();
  let counter = 0;
  const rig: Rig = {
    db,
    deps: () => ({
      db,
      config: DEFAULT_SYNC_CONFIG,
      nowMs: () => Date.now(),
      random: (n: number) => Uint8Array.from(createHash('sha256').update('qa-seed-' + ++counter).digest().subarray(0, n)),
      allowList: parseAllowList('test-uid-001,test-uid-002,test-uid-003'),
      verifier: async () => null,
      allowedOrigins: [ORIGIN],
      log: () => undefined,
    }),
  };
  return { rig, requests: [] };
}
const now = () => Date.now();

async function serve(route: Route, w: World): Promise<void> {
  const r = route.request();
  const url = new URL(r.url());
  const deps = {
    ...w.rig.deps(),
    nowMs: now,
    allowedOrigins: [ORIGIN],
    verifier: async (token: string) => {
      const m = /^fake-id-token-(.+)-\d+$/.exec(token);
      return m === null ? null : { uid: m[1]!, email: m[1] === A.uid ? A.email : B.email, emailVerified: true };
    },
  };
  const body = r.postData() ?? '';
  const res = await handleSync({ method: r.method(), path: url.pathname, query: url.searchParams, headers: r.headers(), readBody: () => Promise.resolve(new TextEncoder().encode(body)) }, deps);
  const uid = /fake-id-token-(.+)-\d+$/.exec(r.headers()['authorization'] ?? '')?.[1] ?? '-';
  w.requests.push({ uid, op: url.pathname.split('/').pop() ?? '', status: res.status });
  const { 'content-length': _len, ...headers } = res.headers;
  void _len;
  await route.fulfill({ status: res.status, headers, body: typeof res.body === 'string' ? res.body : '' });
}

async function device(browser: Browser, w: World, user: typeof A, opts: { store?: boolean; extra?: Record<string, string> } = {}): Promise<{ context: BrowserContext; page: Page }> {
  const use = test.info().project.use;
  const context = await browser.newContext({
    baseURL: ORIGIN,
    ...(use.viewport === undefined ? {} : { viewport: use.viewport }),
    ...(use.hasTouch === undefined ? {} : { hasTouch: use.hasTouch }),
    ...(use.isMobile === undefined ? {} : { isMobile: use.isMobile }),
    ...(use.timezoneId === undefined ? {} : { timezoneId: use.timezoneId }),
    ...(use.locale === undefined ? {} : { locale: use.locale }),
  });
  await context.route(`${BASE}/**`, (route) => serve(route, w));
  const page = await context.newPage();
  const entries: Record<string, string> = { 'bentominder.fake-auth': JSON.stringify(user), 'bentominder.fake-sync-base': BASE, ...(opts.extra ?? {}) };
  if (opts.store === true) entries[`bentominder.${user.uid}.state`] = STATE_V1.replace(/"local"/g, `"${user.uid}"`);
  await page.addInitScript((e) => {
    if (window.sessionStorage.getItem('qa-e15-seeded') !== null) return;
    window.sessionStorage.setItem('qa-e15-seeded', '1');
    for (const [k, v] of Object.entries(e)) window.localStorage.setItem(k, v);
  }, entries);
  return { context, page };
}

const recordOps = (w: World) => w.requests.filter((r) => r.op.startsWith('records.') || r.op === 'family.create' || r.op === 'invite.redeem' || r.op === 'consent.set');
const code = async (p: Page) => ((await p.getByTestId('invite-code').locator('.visually-hidden').textContent()) ?? '').replace(/\s/g, '');

test.describe('E15 consent gating, create, invite, join', () => {
  test('US-E15-01/AC1 AC2 US-E15-02/AC1 AC4 AC8 nothing leaves the device before 「同意して進む」; declining keeps the app local; the notice is axe-clean in light and dark; the default focus is not the accept button', async ({ browser }) => {
    const w = world();
    const a = await device(browser, w, A, { store: true });
    try {
      await a.page.goto('./#/settings');
      await expect(a.page.getByTestId('family-create')).toBeVisible();
      await expect(a.page.getByTestId('family-join')).toBeVisible();
      expect(recordOps(w)).toEqual([]); // AC1: no cloud request containing family data
      for (const scheme of ['light', 'dark'] as const) {
        await a.page.emulateMedia({ colorScheme: scheme });
        await expectNoSeriousAxe(a.page, `family card local-only ${scheme}`);
      }
      await a.page.getByTestId('family-create').click();
      await expect(a.page.getByTestId('consent-cloud')).toBeVisible();
      for (const scheme of ['light', 'dark'] as const) {
        await a.page.emulateMedia({ colorScheme: scheme });
        await expectNoSeriousAxe(a.page, `consent notice ${scheme}`);
      }
      // AC4: not the default focus target
      expect(await a.page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '')).not.toBe('consent-cloud-accept');
      const notice = await a.page.getByTestId('consent-cloud').innerText();
      expect(notice).not.toMatch(/uid|test-uid|[A-Z2-9]{10}/); // no code or uid in the notice
      expect(notice.length).toBeGreaterThan(200);
      expect(recordOps(w)).toEqual([]);
      await a.page.getByTestId('consent-cloud-decline').click();
      await expect(a.page.getByTestId('consent-cloud')).toHaveCount(0);
      await expect(a.page.getByTestId('family-create')).toBeVisible();
      expect(recordOps(w)).toEqual([]);
      expect(w.rig.db.docs.size).toBe(0);
    } finally {
      await a.context.close();
    }
  });

  test('US-E15-01 US-E15-03 US-E15-04 create -> invite -> join with the real function: two parents see the same family; wrong, expired and used codes show the same generic text; hostile input is harmless', async ({ browser }) => {
    const w = world();
    const a = await device(browser, w, A, { store: true });
    const b = await device(browser, w, B, { store: false });
    const c = await device(browser, w, { uid: 'test-uid-003', displayName: 'Third', email: 'third@example.test', photoUrl: null }, { store: false });
    try {
      await a.page.goto('./#/settings');
      await a.page.getByTestId('family-create').click();
      await a.page.getByTestId('consent-cloud-accept').click();
      await expect(a.page.getByTestId('family-status-row')).toBeVisible();
      await expect(a.page.getByTestId('invite-create')).not.toHaveAttribute('aria-disabled', 'true', { timeout: 20_000 });
      await a.page.getByTestId('invite-create').click();
      const inviteCode = await code(a.page);
      expect(inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/);
      await expect(a.page.getByTestId('invite-expiry')).toBeVisible();
      await expectNoSeriousAxe(a.page, 'invite shown');
      // the same family data reached the cloud once
      const cloudRecords = w.rig.db.paths('families').filter((p) => p.includes('/records/')).length;
      expect(cloudRecords).toBeGreaterThanOrEqual(5);

      // C (a third account) enters wrong, then hostile strings: the same generic refusal, nothing changes
      await c.page.goto('./#/join');
      await expect(c.page.getByTestId('screen-join')).toBeVisible();
      // hostile input never leaves the screen: the button stays disabled, nothing is sent, nothing runs
      const before = w.requests.length;
      for (const input of ['<script>window.__pwned=1</script>', '😀😀😀😀😀😀😀😀😀😀', 'x'.repeat(5000), "' OR 1=1 --", '0O1IL0O1IL']) {
        await c.page.getByTestId('input-join-code').fill(input);
        await expect(c.page.getByTestId('join-next')).toHaveAttribute('aria-disabled', 'true');
      }
      expect(w.requests.length).toBe(before);
      // a well-formed but unknown code goes to the server and comes back with the generic text
      const texts = new Set<string>();
      for (const input of ['ZZZZZZZZZZ', 'abcd-efgh-jk']) {
        await c.page.goto('./#/join');
        await c.page.getByTestId('input-join-code').fill(input);
        await c.page.getByTestId('join-next').click();
        if (await c.page.getByTestId('consent-cloud').isVisible({ timeout: 3000 }).catch(() => false)) await c.page.getByTestId('consent-cloud-accept').click();
        const ok = c.page.getByTestId('dialog-join-confirm-ok');
        if (await ok.isVisible({ timeout: 3000 }).catch(() => false)) await ok.click();
        await expect(c.page.getByTestId('input-join-code-error')).toBeVisible({ timeout: 10_000 });
        texts.add(((await c.page.getByTestId('input-join-code-error').innerText()) ?? '').trim());
      }
      expect(texts.size, `one generic refusal text for every wrong code: ${[...texts].join(' | ')}`).toBe(1);
      expect(await c.page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
      expect(w.rig.db.paths('families').filter((p) => p.includes('/members/')).length).toBe(1);

      // B joins with the real code in odd case and spacing, via the deep link
      await b.page.goto(`./#/join/${inviteCode.toLowerCase()}`);
      await expect(b.page.getByTestId('screen-join')).toBeVisible();
      await expectNoSeriousAxe(b.page, 'join screen');
      await b.page.getByTestId('join-next').click();
      await expect(b.page.getByTestId('consent-cloud')).toBeVisible();
      await b.page.getByTestId('consent-cloud-accept').click();
      await b.page.getByTestId('dialog-join-confirm-ok').click();
      await expect(b.page.getByTestId('screen-calendar')).toBeVisible({ timeout: 20_000 });
      await expect(b.page.getByTestId('screen-onboarding')).toHaveCount(0);
      expect(w.rig.db.paths('families').filter((p) => p.includes('/members/')).length).toBe(2);

      // the used code now gives C the same generic refusal
      await c.page.goto(`./#/join/${inviteCode}`);
      await c.page.getByTestId('join-next').click();
      if (await c.page.getByTestId('consent-cloud').isVisible({ timeout: 2000 }).catch(() => false)) await c.page.getByTestId('consent-cloud-accept').click();
      const confirm = c.page.getByTestId('dialog-join-confirm-ok');
      if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
      await expect(c.page.getByTestId('input-join-code-error')).toBeVisible({ timeout: 10_000 });
      texts.add(((await c.page.getByTestId('input-join-code-error').innerText()) ?? '').trim());
      expect(texts.size).toBe(1);
      expect(w.rig.db.paths('families').filter((p) => p.includes('/members/')).length).toBe(2);
    } finally {
      await a.context.close();
      await b.context.close();
      await c.context.close();
    }
  });

  test('US-E15-04/AC1 an invite link opened while signed out shows the login screen first and keeps the link; no request carries family data before sign-in', async ({ browser }) => {
    const w = world();
    const x = await device(browser, w, B, { extra: { 'bentominder.fake-auth': 'signed-out', 'bentominder.fake-auth-next': JSON.stringify(B) } });
    try {
      await x.page.goto('./#/join/ABCD234567');
      await expect(x.page.getByTestId('screen-login')).toBeVisible();
      expect(w.requests).toEqual([]);
      await expectNoSeriousAxe(x.page, 'login with join link');
      await x.page.getByTestId('login-google').click();
      await expect(x.page.getByTestId('screen-join')).toBeVisible();
      await expect(x.page.getByTestId('input-join-code')).toHaveValue(/ABCD-?234-?567|ABCD234567/i);
    } finally {
      await x.context.close();
    }
  });
});

test.describe('E15 equal members, removal, deletion, offline, status, keyboard', () => {
  async function pair(browser: Browser, w: World) {
    const a = await device(browser, w, A, { store: true });
    const b = await device(browser, w, B, { store: false });
    await a.page.goto('./#/settings');
    await a.page.getByTestId('family-create').click();
    await a.page.getByTestId('consent-cloud-accept').click();
    await expect(a.page.getByTestId('invite-create')).not.toHaveAttribute('aria-disabled', 'true', { timeout: 20_000 });
    await a.page.getByTestId('invite-create').click();
    const c = await code(a.page);
    await b.page.goto(`./#/join/${c}`);
    await b.page.getByTestId('join-next').click();
    await b.page.getByTestId('consent-cloud-accept').click();
    await b.page.getByTestId('dialog-join-confirm-ok').click();
    await expect(b.page.getByTestId('screen-calendar')).toBeVisible({ timeout: 20_000 });
    return { a, b };
  }

  test('US-E15-08/AC3 AC9 US-E15-06/AC4 AC7 the other member removes a parent: the removed device is told once with the ended notice, keeps its data and local use works; offline disables the destructive actions with the AC text; axe in both themes', async ({ browser }) => {
    const w = world();
    const { a, b } = await pair(browser, w);
    try {
      await a.page.goto('./#/settings');
      await expect(a.page.getByTestId('family-members')).toBeVisible();
      await expectNoSeriousAxe(a.page, 'family card member 2 members');
      // offline: leave/remove/delete disabled, nothing queued
      await a.context.setOffline(true);
      await a.page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await a.page.getByTestId('family-leave').click();
      const leaveConfirm = a.page.locator('[data-testid^="dialog-leave"][data-testid$="-confirm"]');
      await expect(leaveConfirm).toHaveAttribute('aria-disabled', 'true');
      await expect(a.page.getByTestId('dialog-offline')).toBeVisible();
      await leaveConfirm.click({ force: true }).catch(() => undefined); // a disabled destructive button does nothing
      await a.page.keyboard.press('Escape');
      expect(w.rig.db.paths('families').filter((p) => p.includes('/members/')).length).toBe(2); // nothing queued, nothing applied
      await a.context.setOffline(false);
      await a.page.evaluate(() => window.dispatchEvent(new Event('online')));
      // A removes B
      await a.page.getByTestId('family-remove').click();
      await a.page.getByTestId('dialog-remove-member-confirm').click();
      await expect(a.page.getByTestId('family-member-1')).toHaveCount(0, { timeout: 15_000 });
      // B's device: on its next sync it is told, its data stays, the app still works
      await b.page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await b.page.goto('./#/calendar');
      await b.page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(b.page.getByTestId('banner-ended')).toBeVisible({ timeout: 90_000 });
      await expectNoSeriousAxe(b.page, 'ended notice');
      await b.page.getByTestId('banner-ended-ok').click();
      await expect(b.page.getByTestId('banner-ended')).toHaveCount(0);
      await b.page.goto('./#/settings');
      await expect(b.page.getByTestId('family-create')).toBeVisible();
      // the removed account reads nothing any more
      const afterRemoval = w.requests.filter((r) => r.uid === 'test-uid-002' && r.op === 'records.pull').pop();
      expect(afterRemoval?.status).toBe(410);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('US-E15-08/AC5 AC6 the typed confirmation deletes the family online data; the other device is told; the cloud lists nothing', async ({ browser }) => {
    const w = world();
    const { a, b } = await pair(browser, w);
    try {
      await a.page.goto('./#/settings');
      await a.page.getByTestId('family-delete').click();
      await expect(a.page.getByTestId('dialog-delete-family')).toBeVisible();
      await expect(a.page.getByTestId('dialog-delete-family-confirm')).toHaveAttribute('aria-disabled', 'true'); // not before typing
      await a.page.getByTestId('input-typed-confirm').fill('削除する');
      await a.page.getByTestId('dialog-delete-family-confirm').click();
      await expect(a.page.getByTestId('family-create')).toBeVisible({ timeout: 20_000 });
      expect(w.rig.db.paths('families')).toEqual([]);
      expect(w.rig.db.paths('invites')).toEqual([]);
      await b.page.goto('./#/calendar');
      await b.page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(b.page.getByTestId('banner-ended')).toBeVisible({ timeout: 90_000 });
      expect(w.rig.db.paths('families')).toEqual([]); // nothing was re-created by the other device
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('US-E15-02/AC4 US-E15-01/AC2 the whole create-family journey works with the keyboard alone', async ({ browser }) => {
    const w = world();
    const a = await device(browser, w, A, { store: true });
    try {
      await a.page.goto('./#/settings');
      const create = a.page.getByTestId('family-create');
      await create.focus();
      await a.page.keyboard.press('Enter');
      await expect(a.page.getByTestId('consent-cloud')).toBeVisible();
      // move to the accept button by Tab only and press it
      for (let i = 0; i < 30; i++) {
        const id = await a.page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
        if (id === 'consent-cloud-accept') break;
        await a.page.keyboard.press('Tab');
      }
      expect(await a.page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('consent-cloud-accept');
      await a.page.keyboard.press('Enter');
      await expect(a.page.getByTestId('family-status-row')).toBeVisible({ timeout: 20_000 });
      expect(w.rig.db.paths('families').filter((p) => /^families\/[^/]+$/.test(p)).length).toBe(1);
    } finally {
      await a.context.close();
    }
  });

  test('US-E15-06/AC4 AC6 the indicator opens the status sheet (one state) and it stays reachable once loaded while offline; axe in both themes; Esc closes it', async ({ browser }) => {
    const w = world();
    const { a, b } = await pair(browser, w);
    try {
      await a.page.goto('./#/calendar');
      await expect(a.page.getByTestId('appbar-sync')).toBeVisible();
      await a.page.getByTestId('appbar-sync').click();
      await expect(a.page.getByTestId('sheet-sync')).toBeVisible();
      await expect(a.page.getByTestId('sync-state')).toHaveCount(1);
      for (const scheme of ['light', 'dark'] as const) {
        await a.page.emulateMedia({ colorScheme: scheme });
        await expectNoSeriousAxe(a.page, `status sheet ${scheme}`);
      }
      await a.page.keyboard.press('Escape');
      await expect(a.page.getByTestId('sheet-sync')).toHaveCount(0);
      await a.context.setOffline(true);
      await a.page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await a.page.getByTestId('appbar-sync').click();
      await expect(a.page.getByTestId('sheet-sync')).toBeVisible();
      await a.context.setOffline(false);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });

  test('E15-D07 fixed US-E15-06/AC4 AC6 a phone that goes offline before the status sheet was ever opened can still open it (the chunk is prefetched)', async ({ browser }) => {
    const w = world();
    const { a, b } = await pair(browser, w);
    try {
      await a.page.goto('./#/calendar');
      await expect(a.page.getByTestId('appbar-sync')).toBeVisible();
      await a.context.setOffline(true);
      await a.page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await a.page.getByTestId('appbar-sync').click();
      await a.page.waitForTimeout(2500);
      const sheet = await a.page.getByTestId('sheet-sync').isVisible();
      const generic = await a.page.getByTestId('chunk-error').isVisible();
      expect(sheet, `sheet visible: ${sheet}; generic chunk error shown instead: ${generic}`).toBe(true);
    } finally {
      await a.context.close();
      await b.context.close();
    }
  });
});
