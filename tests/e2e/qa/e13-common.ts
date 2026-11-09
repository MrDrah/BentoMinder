// QA E13 helpers (independent of the developers' e2e helpers). Seeds the e2e build's fake sign-in
// (src/adapters/web/e2e-auth.ts header): bentominder.fake-auth / -next / -script / -delay.
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';

// Untyped JSON read from storage: the scoped exception, as in helpers.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export const A = { uid: 'test-uid-001', displayName: 'Test Parent', email: 'parent@example.test', photoUrl: null as string | null };
export const B = { uid: 'test-uid-002', displayName: 'Other Parent', email: 'other@example.test', photoUrl: null as string | null };
export const STATE_V1 = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'v1.json'), 'utf8');
export const STATE_NOV = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8');
export const SIGNED_OUT = 'signed-out';
export const keyOf = (uid: string) => `bentominder.${uid}.state`;

/** Sets localStorage once per tab session (a reload keeps what the app wrote since). */
export async function seed(page: Page, entries: Record<string, string>): Promise<void> {
  await page.addInitScript((e) => {
    if (window.sessionStorage.getItem('qa-e13-seeded') !== null) return;
    window.sessionStorage.setItem('qa-e13-seeded', '1');
    for (const [k, v] of Object.entries(e)) window.localStorage.setItem(k, v);
  }, entries);
}

export const out = (extra: Record<string, string> = {}) => ({ 'bentominder.fake-auth': SIGNED_OUT, ...extra });
export const signedIn = (u: typeof A, extra: Record<string, string> = {}) => ({ 'bentominder.fake-auth': JSON.stringify(u), ...extra });
export const script = (...o: string[]) => ({ 'bentominder.fake-auth-script': JSON.stringify(o) });
export const next = (u: typeof A) => ({ 'bentominder.fake-auth-next': JSON.stringify(u) });

/** A store whose every ownerId is the given uid (what an account's own store looks like). */
export function storeFor(uid: string, json: string = STATE_V1): string {
  return JSON.stringify(rewriteOwner(JSON.parse(json), uid));
}
export function rewriteOwner<T>(v: T, uid: string): T {
  if (Array.isArray(v)) return v.map((x) => rewriteOwner(x, uid)) as T;
  if (v !== null && typeof v === 'object') {
    const o: Json = {};
    for (const [k, val] of Object.entries(v as Json)) o[k] = k === 'ownerId' ? uid : rewriteOwner(val, uid);
    return o;
  }
  return v;
}
export function ownerIds(v: Json, acc: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => ownerIds(x, acc));
  else if (v !== null && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) {
      if (k === 'ownerId') acc.push(String(val));
      else ownerIds(val, acc);
    }
  }
  return acc;
}

export const get = (page: Page, key: string) => page.evaluate((k) => window.localStorage.getItem(k), key);
export const getJson = async (page: Page, key: string): Promise<Json> => {
  const raw = await get(page, key);
  return raw === null ? null : JSON.parse(raw);
};
export const keys = (page: Page) => page.evaluate(() => Object.keys(window.localStorage).sort());
/** App data keys: everything except the test seam's own keys. */
export const dataKeys = async (page: Page) => (await keys(page)).filter((k) => !k.includes('fake-auth'));
/** Snapshot of every app data key and value (the seam's keys excluded). */
export const snapshot = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.keys(window.localStorage).filter((k) => !k.includes('fake-auth')).sort().map((k) => [k, window.localStorage.getItem(k)])));

/** Fails the test on a request to a non-local host. Returns the list of all seen hosts. */
export function watchHosts(page: Page): { hosts: Set<string>; bad: () => string[] } {
  const hosts = new Set<string>();
  page.on('request', (r) => {
    try {
      const u = new URL(r.url());
      if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.hostname);
    } catch {
      /* ignore */
    }
  });
  return { hosts, bad: () => [...hosts].filter((h) => !['localhost', '127.0.0.1'].includes(h)) };
}

export async function axeSerious(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

export async function signOutViaSettings(page: Page) {
  await page.goto('/#/settings');
  await page.getByTestId('account-sign-out').click();
  await page.getByTestId('dialog-sign-out-confirm').click();
  await expect(page.getByTestId('screen-login')).toBeVisible();
}

/** Records pageerror events (uncaught exceptions) for the whole test. */
export function watchErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return errs;
}
