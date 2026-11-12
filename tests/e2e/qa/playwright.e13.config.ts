// QA's independent E13 suite. From the repo root:
//   npx playwright test -c tests/e2e/qa/playwright.e13.config.ts --workers=3
// `npm run preview` (e2e build with the fake sign-in) is started on :4173; the proxy on :8787 is needed by the
// menu import only (privacy test).
import { defineConfig, devices } from '@playwright/test';

process.env['PROXY_MOCK_SCENARIOS'] = '1';

export default defineConfig({
  testDir: '.',
  testMatch: /e13-(?!email).*\.spec\.ts/,
  fullyParallel: true,
  retries: 0,
  outputDir: '../../_scratch/qa-e13-results',
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run preview', port: 4173, reuseExistingServer: true, cwd: '../../..', timeout: 120_000 },
    {
      command: 'node server/index.ts',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: true,
      cwd: '../../..',
      timeout: 30_000,
      env: { PROXY_MOCK_SCENARIOS: '1', PROXY_EXTRACT_PER_HOUR: '1000', PROXY_EXTRACT_PER_DAY: '1000', PROXY_FETCH_PER_HOUR: '1000' },
    },
  ],
  projects: [
    { name: 'mobile-ja', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'Asia/Tokyo', locale: 'ja-JP' } },
    { name: 'desktop-en', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, timezoneId: 'America/Los_Angeles', locale: 'en-US' } },
  ],
});
