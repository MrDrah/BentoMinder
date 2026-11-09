// US-E14-05/AC4 and AC6, ADR 015 §6: the built function bundle and the web build hold no secret value, the hosted
// bundle holds no recorded-fixture or disk-cache code, and the web source never reaches the function or the Admin SDK.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
// Key-shaped sentinels built from parts so the repository secret scan does not flag this file.
const KEY_SENTINEL = ['AIza', 'SyBUNDLE-SENTINEL-0123456789abcdefg'].join('');
const LIST_SENTINEL = ['allowlist', 'sentinel', 'someone@example.test'].join('-');
const KEY_SHAPE = /AIza[0-9A-Za-z_-]{30,}/;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const env = { ...process.env, GEMINI_API_KEY: KEY_SENTINEL, ALLOWED_ACCOUNTS: LIST_SENTINEL, VITE_GEMINI_API_KEY: '', VITE_FIREBASE_API_KEY: '' };
let bundle = '';

describe('US-E14-05/AC4 the function bundle', () => {
  beforeAll(() => {
    const run = spawnSync(process.execPath, [join(ROOT, 'functions', 'build.mjs')], { cwd: ROOT, env, encoding: 'utf8', timeout: 60_000 });
    expect(run.status, run.stderr).toBe(0);
    bundle = readFileSync(join(ROOT, 'functions', 'lib', 'index.js'), 'utf8');
  }, 90_000);

  it('US-E14-05/AC4 the bundle exists and exports the single function `api`', () => {
    expect(bundle.length).toBeGreaterThan(10_000);
    expect(bundle).toMatch(/\bapi\b/);
    expect(bundle).toContain('asia-northeast1');
  });

  it('US-E14-05/AC4 a build with the secrets in its environment still contains no secret value or key-shaped string', () => {
    expect(bundle).not.toContain(KEY_SENTINEL);
    expect(bundle).not.toContain(LIST_SENTINEL);
    expect(bundle).not.toMatch(KEY_SHAPE);
  });

  it('US-E14-05/AC4 the secrets are read only through the runtime secret binding', () => {
    expect(bundle).toMatch(/defineSecret\)?\(["']GEMINI_API_KEY["']/);
    expect(bundle).not.toMatch(/process\.env\.GEMINI_API_KEY|process\.env\[["']GEMINI_API_KEY/);
  });

  it('US-E14-06/AC3 the hosted bundle holds no disk-cache, recorded-fixture or file-system code', () => {
    expect(bundle).not.toMatch(/file-cache|mock-transport|readdirSync|readFileSync|writeFileSync|tests\/fixtures|server\/\.cache/);
    expect(bundle).not.toMatch(/require\("(node:)?fs(\/promises)?"\)/);
  });

  it('US-E14-04/AC2 the only runtime dependencies left outside the bundle are the two Firebase packages and Node built-ins', () => {
    const required = [...bundle.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1] as string);
    expect(required.length).toBeGreaterThan(0);
    for (const name of required) expect(name, name).toMatch(/^(node:[a-z/_]+|firebase-admin(\/[a-z]+)?|firebase-functions(\/[a-z0-9]+)*)$/);
  });

  it('ADR 015 §1 the function declares region, instances, memory, timeout and the two secrets', () => {
    const src = readFileSync(join(ROOT, 'functions', 'src', 'index.ts'), 'utf8');
    for (const needle of ["region: 'asia-northeast1'", 'maxInstances: 3', "memory: '512MiB'", 'timeoutSeconds: 120', 'secrets: [GEMINI_API_KEY, ALLOWED_ACCOUNTS]', "invoker: 'public'"]) {
      expect(src).toContain(needle);
    }
  });
});

describe('US-E14-05/AC6 the web source and the web build hold no proxy credential and never reach the function', () => {
  it('US-E14-05/AC6 nothing under src/ imports functions/, firebase-admin, firebase-functions or Firestore', () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const text = readFileSync(file, 'utf8');
      if (/from\s+['"][^'"]*(\/functions\/|firebase-admin|firebase-functions|firebase\/firestore)[^'"]*['"]|import\(\s*['"][^'"]*(firebase-admin|firebase-functions|firebase\/firestore)/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('US-E14-05/AC6 only functions/src names the Admin and Functions SDKs (server/ and src/ do not)', () => {
    const offenders: string[] = [];
    for (const dir of ['server', 'src']) {
      for (const file of walk(join(ROOT, dir)).filter((f) => /\.(ts|tsx)$/.test(f))) {
        if (/['"](firebase-admin|firebase-functions)(\/[^'"]*)?['"]/.test(readFileSync(file, 'utf8'))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('US-E14-05/AC4 a production web build (secrets in its environment) holds neither secret, nor the SDK names, nor the allow-list or counter names', () => {
    const out = mkdtempSync(join(tmpdir(), 'bm-e14-dist-'));
    try {
      const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
      const run = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir'], { cwd: ROOT, env, encoding: 'utf8', timeout: 110_000 });
      expect(run.status, run.stderr).toBe(0);
      const files = walk(out).filter((f) => /\.(js|css|html|json|webmanifest|map|txt)$/i.test(f));
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        const text = readFileSync(f, 'utf8');
        expect(text, f).not.toContain(KEY_SENTINEL);
        expect(text, f).not.toContain(LIST_SENTINEL);
        expect(text, f).not.toMatch(KEY_SHAPE);
        expect(text, f).not.toMatch(/firebase-admin|firebase-functions|proxyLimits|ALLOWED_ACCOUNTS/);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 130_000);

  it('US-E14-05/AC4 an existing dist/ (the gate builds before it runs e2e) is clean too', () => {
    const dist = join(ROOT, 'dist');
    if (!existsSync(dist)) return;
    for (const f of walk(dist).filter((p) => /\.(js|css|html|json)$/i.test(p))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(KEY_SHAPE);
      expect(text, f).not.toMatch(/firebase-admin|firebase-functions|proxyLimits|ALLOWED_ACCOUNTS/);
    }
  });
});

