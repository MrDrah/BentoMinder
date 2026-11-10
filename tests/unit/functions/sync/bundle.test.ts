// ADR 016 section 2.1 and 8: the built function bundle exports both `api` and `sync`, `sync` is declared as designed (Tokyo, 3
// instances, 256 MiB, 30 s, the allow-list secret only), and no new package is needed outside the bundle.
// Builds into its own folder (FUNCTIONS_OUT_DIR) so it never races the other bundle test.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const KEY_SENTINEL = ['AIza', 'SyBUNDLE-SENTINEL-0123456789abcdefg'].join('');
const LIST_SENTINEL = ['allowlist', 'sentinel', 'someone@example.test'].join('-');
const out = mkdtempSync(join(tmpdir(), 'bm-e15-fn-'));
let bundle = '';
const source = readFileSync(join(ROOT, 'functions', 'src', 'index.ts'), 'utf8');

describe('the function bundle with `sync`', () => {
  beforeAll(() => {
    const env = { ...process.env, FUNCTIONS_OUT_DIR: out, GEMINI_API_KEY: KEY_SENTINEL, ALLOWED_ACCOUNTS: LIST_SENTINEL };
    const run = spawnSync(process.execPath, [join(ROOT, 'functions', 'build.mjs')], { cwd: ROOT, env, encoding: 'utf8', timeout: 60_000 });
    expect(run.status, run.stderr).toBe(0);
    bundle = readFileSync(join(out, 'index.js'), 'utf8');
  }, 90_000);
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it('US-E15-09/AC9 the bundle exports both functions, `api` and `sync`', () => {
    expect(bundle).toMatch(/0 && \(module\.exports = \{[^}]*\bapi\b[^}]*\bsync\b[^}]*\}\)|0 && \(module\.exports = \{[^}]*\bsync\b[^}]*\bapi\b[^}]*\}\)/);
  });

  it('US-E15-09/AC9 nothing new is required outside the bundle: only Node built-ins and the two Firebase packages', () => {
    const required = [...bundle.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1] as string);
    for (const name of required) expect(name, name).toMatch(/^(node:[a-z/_]+|firebase-admin(\/[a-z]+)?|firebase-functions(\/[a-z0-9]+)*)$/);
  });

  it('US-E15-09/AC9 the bundle holds no secret value, and the sync function reads no Gemini key', () => {
    expect(bundle).not.toContain(KEY_SENTINEL);
    expect(bundle).not.toContain(LIST_SENTINEL);
    const syncStart = source.indexOf('export const sync');
    expect(syncStart).toBeGreaterThan(0);
    const block = source.slice(syncStart);
    expect(block).not.toContain('GEMINI_API_KEY');
    expect(block).toContain('secrets: [ALLOWED_ACCOUNTS]');
  });

  it('ADR 016 section 2.1 `sync` is declared: Tokyo, public invoker, maxInstances 3, 256 MiB, 30 s; `api` keeps its own settings', () => {
    const syncBlock = source.slice(source.indexOf('export const sync'));
    for (const needle of ["region: 'asia-northeast1'", "invoker: 'public'", 'maxInstances: 3', "memory: '256MiB'", 'timeoutSeconds: 30']) expect(syncBlock).toContain(needle);
    const apiBlock = source.slice(source.indexOf('export const api'), source.indexOf('export const sync'));
    for (const needle of ["memory: '512MiB'", 'timeoutSeconds: 120', 'secrets: [GEMINI_API_KEY, ALLOWED_ACCOUNTS]']) expect(apiBlock).toContain(needle);
  });

  it('ADR 016 section 8 every new setting has a default in functions/params.example and is read as a Cloud Functions parameter with the same default', () => {
    const example = readFileSync(join(ROOT, 'functions', 'params.example'), 'utf8');
    const defaults: Record<string, string> = { MAX_MEMBERS: '2', INVITE_TTL_HOURS: '72', INVITE_FAILED_PER_HOUR: '10', SYNC_WRITES_PER_HOUR: '600', CLOUD_NOTICE_MIN_VERSION: '1' };
    for (const [name, value] of Object.entries(defaults)) {
      expect(example, name).toMatch(new RegExp(`^${name}=${value}$`, 'm'));
      expect(source, name).toContain(`defineInt('${name}', { default: ${value} })`);
    }
  });

  it('US-E15-10/AC6 the sync bundle holds no console output other than the fixed log lines', () => {
    expect(readFileSync(join(ROOT, 'functions', 'src', 'sync', 'service.ts'), 'utf8')).not.toMatch(/console\./);
    for (const f of ['ops-membership.ts', 'ops-records.ts', 'authorize.ts', 'store.ts', 'firestore-db.ts', 'http.ts', 'deps.ts']) {
      expect(readFileSync(join(ROOT, 'functions', 'src', 'sync', f), 'utf8'), f).not.toMatch(/console\./);
    }
  });
});
