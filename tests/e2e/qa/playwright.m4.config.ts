// QA M4 config: npx playwright test -c tests/e2e/qa/playwright.m4.config.ts   (needs `npm run build` first)
// Preview server :4173 and the proxy with mock scenarios :8787 (the full journey imports through it).
// Mobile and desktop, ja. Timezones are not Tokyo on purpose; individual describes override them.
import { defineConfig, devices } from '@playwright/test';

process.env['PROXY_MOCK_SCENARIOS'] = '1';
export default defineConfig({
  testDir: '.',
  testMatch: /(m4-edge|full-journey)\.spec\.ts/,
  fullyParallel: false,
  workers: 2,
  retries: 0,
  outputDir: '../../_scratch/qa-m4-results',
  timeout: 90_000,
  reporter: [['list'], ['json', { outputFile: '../../reports/qa-m4-results.json' }]],
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
  ],
  projects: [
    { name: 'mobile-ja', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'Pacific/Auckland', locale: 'ja-JP' } },
    { name: 'desktop-ja', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, timezoneId: 'America/Los_Angeles', locale: 'ja-JP' } },
  ],
});
