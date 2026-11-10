// QA's independent UI refresh suite (2026-11). From the repo root:
//   npx playwright test -c tests/e2e/qa/playwright.uir.config.ts --workers=2
// `npm run preview` (the e2e build with the fake sign-in and the sync test seam) is started on :4173. No proxy is needed.
// Two projects, as the developer's suite: a phone (390) and a desktop (1280); specs resize the viewport where a width matters.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /ui-refresh-.*\.spec\.ts/,
  fullyParallel: true,
  retries: 0,
  outputDir: '../../_scratch/qa-uir-results',
  timeout: 90_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: [{ command: 'npm run preview', port: 4173, reuseExistingServer: true, cwd: '../../..', timeout: 180_000 }],
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'Europe/Paris', locale: 'en-US' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, timezoneId: 'America/Los_Angeles', locale: 'en-US' } },
  ],
});
