// QA's independent M1 suite. Run from the repo root:
//   npx playwright test -c tests/e2e/qa/playwright.qa.config.ts
// Expects `npm run build && npm run preview` on :4173 and the proxy on :8787 (raised caps)
// and a second proxy with DEFAULT caps on :8788 (PROXY_PORT=8788) for direct cap/SSRF tests.
import { defineConfig, devices } from '@playwright/test';

// The scenario header is off by default (D-M1-09); the proxies this suite starts or spawns turn it on.
// Workers inherit this, so the proxies that m1-proxy.spec.ts spawns get it too.
process.env['PROXY_MOCK_SCENARIOS'] = '1';

const mobile = { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 2,
  retries: 0,
  outputDir: '../../_scratch/qa-results',
  timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: '../../reports/qa-m1-results.json' }]],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run preview', port: 4173, reuseExistingServer: true, cwd: '../../..', timeout: 60_000 },
    {
      command: 'node server/index.ts',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: true,
      cwd: '../../..',
      timeout: 30_000,
      env: { PROXY_MOCK_SCENARIOS: '1', PROXY_EXTRACT_PER_HOUR: '1000', PROXY_EXTRACT_PER_DAY: '1000', PROXY_FETCH_PER_HOUR: '1000' },
    },
    {
      command: 'node server/index.ts',
      url: 'http://127.0.0.1:8788/api/health',
      reuseExistingServer: true,
      cwd: '../../..',
      timeout: 30_000,
      env: { PROXY_PORT: '8788', PROXY_MOCK_SCENARIOS: '1' },
    },
  ],
  projects: [
    { name: 'tokyo-ja', use: { ...mobile, timezoneId: 'Asia/Tokyo', locale: 'ja-JP' } },
    { name: 'honolulu-en', use: { ...mobile, timezoneId: 'Pacific/Honolulu', locale: 'en-US' } },
    // cross combinations for the specs where timezone/locale matter (BR-15, BR-23)
    { name: 'tokyo-en', testMatch: /m1-(journey|time|privacy).spec.ts/, use: { ...mobile, timezoneId: 'Asia/Tokyo', locale: 'en-US' } },
    { name: 'honolulu-ja', testMatch: /m1-(journey|time|privacy).spec.ts/, use: { ...mobile, timezoneId: 'Pacific/Honolulu', locale: 'ja-JP' } },
  ],
});
