import { defineConfig, devices } from '@playwright/test';

// Architecture §11.3: both projects run in a non-JST timezone and a non-ja locale on purpose
// (BR-15, BR-23). Tests run against the production build served by `vite preview`.
export default defineConfig({
  testDir: 'tests/e2e',
  // QA's independent suite needs the proxy and its own config: tests/e2e/qa/playwright.qa.config.ts
  testIgnore: ['qa/**'],
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['junit', { outputFile: 'reports/junit-e2e.xml' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  // The production build (vite preview proxies /api) and the local proxy with the recorded-fixture
  // extractor (M1, ADR 002). The proxy's own call caps are raised for the test run only.
  webServer: [
    {
      command: 'npm run preview',
      port: 4173,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'node server/index.ts',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: true,
      timeout: 30_000,
      env: { PROXY_EXTRACT_PER_HOUR: '1000', PROXY_EXTRACT_PER_DAY: '1000', PROXY_FETCH_PER_HOUR: '1000' },
    },
  ],
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        timezoneId: 'Europe/Paris',
        locale: 'en-US',
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        timezoneId: 'America/Los_Angeles',
        locale: 'en-US',
      },
    },
  ],
});
