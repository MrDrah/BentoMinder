// @vitest-environment node
// ADR 016 slice C: the production build with sync switched on (VITE_SYNC_BASE_URL set) carries no fake seam: not the fake
// sync backend or port (test support in src/domain/sync/fake-port.ts), not the fake sign-in or its fixed user. Builds into a
// temporary folder; the committed tree is untouched.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { build } from 'vite';

const out = mkdtempSync(join(tmpdir(), 'bm-sync-bundle-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const BASE = 'https://asia-northeast1-sentinel.cloudfunctions.net/sync';

describe('US-E15-11/AC1 no fake seam in the production build, sync on', () => {
  it('US-E15-11/AC1 the build holds no fake sync backend or port, no fake sign-in, no fixed test user; the configured base is inlined', async () => {
    delete process.env['VITE_AUTH_FAKE'];
    process.env['VITE_SYNC_BASE_URL'] = BASE;
    try {
      await build({ logLevel: 'silent', build: { outDir: out, emptyOutDir: true, write: true }, mode: 'production' });
    } finally {
      delete process.env['VITE_SYNC_BASE_URL'];
    }
    const js = walk(out).filter((f) => f.endsWith('.js'));
    expect(js.length).toBeGreaterThan(0);
    const text = js.map((f) => readFileSync(f, 'utf8')).join('\n');
    // Built from parts so this test never contains the markers itself.
    const markers = [
      ['Fake', 'Backend'].join(''),
      ['Fake', 'SyncPort'].join(''),
      ['loseNext', 'PushResponse'].join(''),
      ['ABCD', '234567'].join(''),
      ['response', 'lost'].join('-'),
      ['batch', 'too', 'large'].join('-'),
      ['FakeA', 'uth'].join(''),
      ['test', 'uid', '001'].join('-'),
      ['bentominder', 'fake', 'auth'].join('.'),
      // Slice D e2e seam: the localStorage key that switches sync on in the e2e build only (select-sync.ts).
      ['bentominder', 'fake', 'sync', 'base'].join('.'),
      ['fake', 'sync', 'base'].join('-'),
    ];
    expect(markers.filter((m) => text.includes(m))).toEqual([]);
    expect(text).toContain(BASE);
    expect(text).toContain('/v1/');
  }, 180_000);
});
