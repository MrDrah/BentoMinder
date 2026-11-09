// @vitest-environment node
// US-E13-07/AC4: the production build must carry no way for an end user to skip sign-in. It builds the app the way
// `npm run build` does (flag unset) into a temporary folder and scans every file for the fake adapter and its fixed user.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { build } from 'vite';

const out = mkdtempSync(join(tmpdir(), 'bm-auth-bundle-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

describe('US-E13-07/AC4 no test bypass in the production build', () => {
  it('US-E13-07/AC4 US-E14-07/AC8 the build holds no fake sign-in, no fixed test user and no seed key', async () => {
    delete process.env['VITE_AUTH_FAKE'];
    await build({ logLevel: 'silent', build: { outDir: out, emptyOutDir: true, write: true }, mode: 'production' });
    const js = walk(out).filter((f) => f.endsWith('.js'));
    expect(js.length).toBeGreaterThan(0);
    // Built from parts so this test never contains the markers itself.
    const markers = [['test', 'uid', '001'].join('-'), ['parent', 'example.test'].join('@'), ['bentominder', 'fake', 'auth'].join('.'), 'FakeAuth', ['signInUser'].join(''), ['fake', 'id', 'token'].join('-')];
    const hits = js.flatMap((f) => markers.filter((m) => readFileSync(f, 'utf8').includes(m)).map((m) => `${f.slice(out.length)}: ${m}`));
    expect(hits).toEqual([]);
  }, 120_000);
});
