// QA: static checks for US-NF-01/AC3 (bundle budgets on the built dist) and US-NF-04/AC2 (suites never need live AI).
// Derived from the ACs in docs/ba/user-stories.md and the budget numbers they state; reads package.json, the Playwright
// configs and dist/ only.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const dist = join(root, 'dist', 'assets');

// Under vitest NODE_ENV is "test", which makes vite build a different (larger) bundle than the production one the budget is about.
const productionBuildEnv = (): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITEST'))),
  NODE_ENV: 'production',
});

beforeAll(() => {
  if (!existsSync(dist) || readdirSync(dist).length === 0) execSync('npm run build', { cwd: root, stdio: 'ignore', env: productionBuildEnv() });
}, 180_000);

const gzKb = (ext: string): number[] =>
  readdirSync(dist)
    .filter((f) => f.endsWith(ext))
    .map((f) => gzipSync(readFileSync(join(dist, f))).length / 1024);

describe('US-NF-01/AC3 budgets', () => {
  it('US-NF-01/AC3 the built JS is at most 420 KB gzip in total', () => {
    const sizes = gzKb('.js');
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(420);
  });

  it('US-NF-01/AC3 the built CSS is at most 50 KB gzip in total', () => {
    const sizes = gzKb('.css');
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(50);
  });
});

describe('US-NF-04/AC2 suites never need live AI', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };

  it('US-NF-04/AC2 the live evaluation is its own opt-in script and no test script calls it', () => {
    expect(pkg.scripts['eval:extraction']).toBeTruthy();
    for (const name of ['test', 'coverage', 'test:e2e', 'build', 'typecheck', 'lint', 'validate:data']) {
      const cmd = pkg.scripts[name] ?? '';
      expect(cmd, `script ${name}`).not.toMatch(/eval[:-]extraction|eval-extraction/);
    }
    expect(readFileSync(join(root, 'scripts', 'eval-extraction.mjs'), 'utf8')).toMatch(/\.env|API_KEY|GEMINI|key/i);
  });

  it('US-NF-04/AC2 the e2e configs start the proxy with recorded-fixture scenarios and no provider key', () => {
    const configs = [join(root, 'playwright.config.ts'), ...readdirSync(join(root, 'tests', 'e2e', 'qa')).filter((f) => /^playwright\..*\.ts$/.test(f)).map((f) => join(root, 'tests', 'e2e', 'qa', f))];
    expect(configs.length).toBeGreaterThan(1);
    for (const c of configs) {
      const text = readFileSync(c, 'utf8');
      if (text.includes('server/index.ts')) expect(text, c).toMatch(/PROXY_MOCK_SCENARIOS/); // a config that starts the proxy starts it with recorded replies
      expect(text, c).not.toMatch(/GEMINI_API_KEY|GOOGLE_API_KEY|API_KEY\s*:/);
    }
  });

  it('US-NF-04/AC2 the unit suites reach the AI only through fixtures (no test file reads a provider key or calls a provider host)', () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '_scratch' ? [] : walk(join(d, e.name))) : [join(d, e.name)]));
    const files = walk(join(root, 'tests')).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('nf-static.test.ts'));
    const offenders = files.filter((f) => /generativelanguage\.googleapis\.com|process\.env\[?['"]?(GEMINI|GOOGLE)_API_KEY/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
