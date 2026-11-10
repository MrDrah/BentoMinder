// QA's independent E15 suite. From the repo root:
//   npx playwright test -c tests/e2e/qa/playwright.e15.config.ts --workers=2
// `npm run preview` (the e2e build with the fake sign-in and the sync test seam) is started on :4173. The sync function is the REAL
// request pipeline of functions/src/sync running in the test process over a fake Firestore (see e15-family-qa.spec.ts); the proxy is not needed.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /e15-.*\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  outputDir: '../../_scratch/qa-e15-results',
  timeout: 90_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: [{ command: 'npm run preview', port: 4173, reuseExistingServer: true, cwd: '../../..', timeout: 180_000 }],
  projects: [
    { name: 'mobile-ja', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'Asia/Tokyo', locale: 'ja-JP' } },
    { name: 'desktop-en', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, timezoneId: 'America/Los_Angeles', locale: 'en-US' } },
  ],
});
