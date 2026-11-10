// QA E14: US-E14-05/AC4/AC6, US-E14-06/AC3, US-E14-07/AC7. Builds the function bundle and the web bundle with sentinel
// secrets in the build environment and scans the outputs. Builds go to a temp dir; the committed tree is untouched
// (functions/lib is generated and git-ignored). Environment files are never read.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const require_vite = () => join(createRequire(join(ROOT, 'package.json')).resolve('vite/package.json'), '..', 'bin', 'vite.js');
const KEY = ['AIza', 'SyQA-E14-BUNDLE-0123456789abcdefg'].join('');
const ALLOW_EMAIL = 'qa-real-looking-parent@sentinel-mail.test';
const ALLOW_UID = 'qaSentinelUid0123456789';
const BASE = 'https://asia-northeast1-qa-sentinel.cloudfunctions.net/api';
const env = { ...process.env, GEMINI_API_KEY: KEY, ALLOWED_ACCOUNTS: `${ALLOW_EMAIL},${ALLOW_UID}`, VITE_AI_PROXY_BASE_URL: BASE, VITE_FIREBASE_API_KEY: '', VITE_GEMINI_API_KEY: '', EXTRACT_PER_HOUR: '4242', FETCH_PER_DAY: '31337' };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let fnBundle = '';
let webText = '';
let webDir = '';
let fnDir = '';

beforeAll(() => {
  // Own output folder: other test files build into functions/lib at the same time (parallel files).
  fnDir = mkdtempSync(join(tmpdir(), 'qa-e14-fn-'));
  execFileSync(process.execPath, ['functions/build.mjs'], { cwd: ROOT, env: { ...env, FUNCTIONS_OUT_DIR: fnDir }, stdio: 'pipe' });
  fnBundle = readFileSync(join(fnDir, 'index.js'), 'utf8');
  webDir = mkdtempSync(join(tmpdir(), 'qa-e14-web-'));
  execFileSync(process.execPath, [require_vite(), 'build', '--outDir', webDir, '--emptyOutDir'], { cwd: ROOT, env, stdio: 'pipe' });
  webText = walk(webDir)
    .filter((f) => /\.(js|css|html|json|webmanifest|map|txt)$/.test(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}, 240_000);

afterAll(() => {
  if (webDir !== '') rmSync(webDir, { recursive: true, force: true });
  if (fnDir !== '') rmSync(fnDir, { recursive: true, force: true });
});

describe('US-E14-05/AC4 no secret or configuration value in the function bundle', () => {
  it('US-E14-05/AC4 the bundle exists and is the single entry', () => {
    expect(existsSync(join(fnDir, 'index.js'))).toBe(true);
    expect(fnBundle.length).toBeGreaterThan(10_000);
  });
  it('US-E14-05/AC4 sentinel key, allow-list entries and limit values from the build environment are absent', () => {
    for (const s of [KEY, ALLOW_EMAIL, ALLOW_UID, '4242', '31337', 'sentinel-mail', 'qa-sentinel']) {
      if (/^\d+$/.test(s)) expect(fnBundle).not.toMatch(new RegExp(`(?<![\\d.])${s}(?![\\d.])`));
      else expect(fnBundle).not.toContain(s);
    }
  });
  it('US-E14-05/AC4 no Gemini-key-shaped string at all', () => {
    expect(fnBundle).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/);
  });
  it('US-E14-05/AC4 the secrets are read through the secret store (defineSecret) by name only', () => {
    expect(fnBundle).toMatch(/defineSecret\)?\(["']GEMINI_API_KEY["']\)|defineSecret\)\(["']GEMINI_API_KEY["']\)/);
    expect(fnBundle).toMatch(/["']ALLOWED_ACCOUNTS["']/);
  });
  it('US-E14-06/AC3 the hosted bundle has no on-disk cache, no recorded-fixture transport and no fs write', () => {
    expect(fnBundle).not.toMatch(/file-cache|mock-transport|fileCache|createFixtureTransports/);
    expect(fnBundle).not.toMatch(/writeFileSync|appendFileSync|createWriteStream|mkdirSync|\bwriteFile\b/);
    expect(fnBundle).not.toMatch(/require\(["'](node:)?fs["']\)/);
  });
  it('US-E14-05/AC4 only the two Firebase packages stay external; nothing else is required at run time', () => {
    const requires = [...fnBundle.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1] as string);
    const external = [...new Set(requires.filter((r) => !/^node:|^(https?|net|dns|crypto|stream|url|util|events|buffer|path|os|tls|zlib|http2|dns\/promises|timers|assert|string_decoder|querystring|fs|child_process)$/.test(r)))];
    for (const e of external) expect(e).toMatch(/^firebase-(admin|functions)(\/|$)/);
  });
  it('US-E14-05 the mock-scenario header name is not honoured in the hosted bundle path (allowScenarios false literal)', () => {
    expect(fnBundle).toMatch(/allowScenarios:\s*false/);
  });
});

describe('US-E14-05/AC6 US-E14-07/AC7 the web build holds no proxy credential', () => {
  it('US-E14-07/AC1 positive control: the public base URL IS in the build (variable was read)', () => {
    expect(webText).toContain('qa-sentinel.cloudfunctions.net');
  });
  it('US-E14-05/AC6 no key, allow-list entry or limit value; no key-shaped string; no secret names', () => {
    for (const s of [KEY, ALLOW_EMAIL, ALLOW_UID, 'sentinel-mail', 'GEMINI_API_KEY', 'ALLOWED_ACCOUNTS']) expect(webText).not.toContain(s);
    expect(webText).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/);
    expect(webText).not.toMatch(/(?<![\d.])(4242|31337)(?![\d.])/);
  });
  it('US-E14-05/AC6 no server-side SDK or counter collection in the web build', () => {
    for (const name of ['firebase-admin', 'firebase-functions', 'proxyLimits', 'getFirestore', 'initializeFirestore', 'FirestoreError', 'firestore.googleapis.com']) {
      expect(webText.includes(name), name).toBe(false);
    }
  });
  it('US-E14-07/AC6 the web build has exactly one place that names the proxy variable value, and no extra hosted host', () => {
    const hosts = new Set([...webText.matchAll(/https:\/\/[a-z0-9.-]*cloudfunctions\.net/g)].map((m) => m[0]));
    expect([...hosts]).toEqual(['https://asia-northeast1-qa-sentinel.cloudfunctions.net']);
  });
});
