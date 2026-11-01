// QA M5 config: npx playwright test -c tests/e2e/qa/playwright.m5.config.ts   (needs `npm run build` first)
// Preview :4173 and the proxy with mock scenarios :8787 (no key, no provider). Mobile ja (Tokyo) and desktop ja (Los Angeles).
import { defineConfig, devices } from '@playwright/test';

process.env['PROXY_MOCK_SCENARIOS'] = '1';
const mobile = { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
export default defineConfig({
  testDir: '.',
  testMatch: /m5-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: '../../_scratch/qa-m5-results',
  timeout: 90_000,
  reporter: [['list'], ['json', { outputFile: '../../reports/qa-m5-results.json' }]],
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
    { name: 'mobile-tokyo-ja', use: { ...mobile, timezoneId: 'Asia/Tokyo', locale: 'ja-JP' } },
    { name: 'desktop-la-ja', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, timezoneId: 'America/Los_Angeles', locale: 'ja-JP' } },
  ],
});
