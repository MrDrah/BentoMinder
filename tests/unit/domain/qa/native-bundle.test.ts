// US-E12-01: the web page never loads native plugin code. Reads the built dist/ only: the entry chunk and everything it
// imports statically must contain no Capacitor plugin code; that code exists only in dynamically imported chunks.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const assets = join(root, 'dist', 'assets');
const NATIVE_MARKERS = ['localNotificationActionPerformed', 'registerPlugin', 'appStateChange', 'SharedPreferences'];
const read = (name: string) => readFileSync(join(assets, name), 'utf8');
const jsFiles = () => readdirSync(assets).filter((f) => f.endsWith('.js'));

beforeAll(() => {
  const stale = !existsSync(assets) || !jsFiles().some((f) => read(f).includes('localNotificationActionPerformed'));
  if (stale) {
    const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST'))), NODE_ENV: 'production' };
    execSync('npm run build', { cwd: root, stdio: 'ignore', env });
  }
}, 180_000);

/** Files loaded by `<script src>` and, transitively, by static `import … from './x.js'` / `import './x.js'` (not `import('…')`). */
function staticGraph(): Set<string> {
  const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
  const seen = new Set<string>();
  const visit = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    const text = read(name);
    for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*)"\.\/([^"]+\.js)"/g)) visit(m[1] as string);
  };
  for (const m of html.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.js)"/g)) visit(m[1] as string);
  return seen;
}

describe('US-E12-01 the web bundle carries no native plugin code', () => {
  it('US-E12-01 the entry chunk and its static imports contain none of the Capacitor plugin code', () => {
    const graph = staticGraph();
    expect(graph.size).toBeGreaterThan(0);
    for (const file of graph) for (const marker of NATIVE_MARKERS) expect(read(file), `${file} must not contain ${marker}`).not.toContain(marker);
  });

  it('US-E12-01 the native plugins do exist, in chunks that are not part of the static graph (loaded only on native)', () => {
    const graph = staticGraph();
    const native = jsFiles().filter((f) => read(f).includes('localNotificationActionPerformed'));
    expect(native.length).toBeGreaterThan(0);
    for (const f of native) expect(graph.has(f)).toBe(false);
  });

  it('US-E12-01 the native adapter module is only reached through a dynamic import', () => {
    const src = readFileSync(join(root, 'src/adapters/select.ts'), 'utf8');
    expect(src).toMatch(/import\(\s*'\.\/native\/index\.ts'\s*\)/);
    expect(src).not.toMatch(/^import\s(?!type)[^;]*from\s+'\.\/native\//m);
  });
});
