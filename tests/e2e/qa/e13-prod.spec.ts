// QA E13: the production build (built WITHOUT VITE_AUTH_FAKE) must not contain the fake sign-in selection, and with a
// missing Firebase configuration it must fail safe: login screen, generic message, no values or secrets in the console,
// no request leaves this machine (all non-local hosts are aborted by the test; none must even be attempted for sign-in).
// US-E13-07/AC1 AC4, US-E13-06/AC3 AC4, US-E13-03/AC5.
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'tests', '_scratch', 'qa-e13-prod-dist');
const SENTINEL = 'QA-SENTINEL-KEY-0123456789';
const PORT = 4175;

function filesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? filesOf(p) : [p];
  });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
  const env: NodeJS.ProcessEnv = { ...process.env, VITE_AUTH_FAKE: '', VITE_FIREBASE_API_KEY: SENTINEL };
  for (const n of ['AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID', 'MEASUREMENT_ID']) env[`VITE_FIREBASE_${n}`] = '';
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', OUT, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, env, stdio: 'pipe' });
});

test('US-E13-07/AC4 US-E13-01/AC1 the production build contains no fake-auth selection, seam keys or test accounts', async () => {
  expect(existsSync(OUT)).toBe(true);
  const js = filesOf(OUT).filter((f) => /\.(js|html|css)$/.test(f));
  expect(js.length).toBeGreaterThan(0);
  const all = js.map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const marker of ['bentominder.fake-auth', 'fake-auth-script', 'fake-auth-delay', 'fake-auth-next', 'test-uid-001', 'parent@example.test', 'Test Parent']) {
    expect(all.includes(marker), `marker "${marker}" found in production bundle`).toBe(false);
  }
  // sanity: the grep is meaningful, the e2e seam build does contain the marker
  const seamDir = join(ROOT, 'node_modules', '.cache', 'bentominder-e2e-dist');
  if (existsSync(seamDir)) {
    const seam = filesOf(seamDir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(seam.includes('bentominder.fake-auth')).toBe(true);
  }
});

test('US-E13-06/AC4 the production bundle has no analytics or advertising endpoints (the "@firebase/analytics" string in firebase-app is only a library-name registry entry)', async () => {
  const all = filesOf(OUT).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const marker of ['google-analytics.com', 'googletagmanager', 'doubleclick', 'gtag(']) {
    expect(all.includes(marker), `marker "${marker}" found`).toBe(false);
  }
});

test.describe('missing Firebase configuration', () => {
  let stop: () => Promise<void> = async () => undefined;
  test.beforeAll(async () => {
    const { preview } = await import('vite');
    const server = await preview({ root: ROOT, logLevel: 'error', build: { outDir: OUT }, preview: { port: PORT, strictPort: true } });
    stop = () => new Promise((r) => server.httpServer.close(() => r()));
  });
  test.afterAll(async () => {
    await stop();
  });

  test('US-E13-03/AC5 US-E13-01/AC1 US-E13-06/AC3 fails safe: login wall (never the app), generic message, no secret or config value in console or page, no external request', async ({ page }) => {
    const consoleText: string[] = [];
    const external: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (m) => consoleText.push(`${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => pageErrors.push(e.message + (e.stack ?? '')));
    // Never let a test reach Google/Firebase: abort anything that is not this local server.
    await page.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return route.continue();
      external.push(u.hostname);
      return route.abort();
    });
    await page.goto(`http://localhost:${PORT}/#/day/2026-11-13`);
    await expect(page.getByTestId('screen-login').or(page.getByTestId('screen-restoring'))).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('screen-login')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('screen-calendar')).toHaveCount(0);
    await page.getByTestId('login-google').click();
    await page.waitForTimeout(800);
    await expect(page.getByTestId('screen-login')).toBeVisible();
    await expect(page.getByTestId('screen-calendar')).toHaveCount(0);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/auth\/|VITE_|api[-_ ]?key|firebase/i);
    const all = consoleText.join('\n') + '\n' + pageErrors.join('\n') + '\n' + text + '\n' + (await page.content());
    expect(all).not.toContain(SENTINEL);
    expect(consoleText.filter((c) => /VITE_FIREBASE_[A-Z_]+\s*[:=]\s*\S+/.test(c))).toEqual([]);
    expect(external, 'a request to an external host was attempted').toEqual([]);
    expect(pageErrors).toEqual([]);
    // the failure is recoverable: the button works again and still starts nothing external
    await expect(page.getByTestId('login-google')).not.toHaveAttribute('aria-busy', 'true');
  });
});
