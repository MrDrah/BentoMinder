import { defineConfig, devices } from '@playwright/test';

// Architecture §11.3: both projects run in a non-JST timezone and a non-ja locale on purpose
// (BR-15, BR-23). Tests run against the production build served by `vite preview`.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['junit', { outputFile: 'reports/junit-e2e.xml' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
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
