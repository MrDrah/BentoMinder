// QA M3 config: npx playwright test -c tests/e2e/qa/playwright.m3.config.ts
// Needs only the preview server (:4173); no proxy calls are made by the M3 views. Mobile and desktop, ja, Tokyo.
import { defineConfig, devices } from '@playwright/test';

const base = { timezoneId: 'Asia/Tokyo', locale: 'ja-JP' };
export default defineConfig({
  testDir: '.',
  testMatch: /m3-.*\.spec\.ts/,
  fullyParallel: false,
  workers: 2,
  retries: 0,
  outputDir: '../../_scratch/qa-m3-results',
  timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: '../../reports/qa-m3-results.json' }]],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: [{ command: 'npm run preview', port: 4173, reuseExistingServer: true, cwd: '../../..', timeout: 60_000 }],
  projects: [
    { name: 'mobile-ja', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...base } },
    { name: 'desktop-ja', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, ...base } },
  ],
});
