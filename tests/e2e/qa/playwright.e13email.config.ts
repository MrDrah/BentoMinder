// QA's independent E13 e-mail + password suite (US-E13-08). From the repo root:
//   npx playwright test -c tests/e2e/qa/playwright.e13email.config.ts --workers=3
// `npm run preview` (e2e build with the fake sign-in) is started on :4173. No proxy is needed (the specs assert that nothing calls it).
// One project; each spec sets its own locale (ja/en) and viewport.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /e13-email-.*\.spec\.ts/,
  fullyParallel: true,
  retries: 0,
  outputDir: '../../_scratch/qa-e13email-results',
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', ...devices['Desktop Chrome'], timezoneId: 'Europe/Paris' },
  webServer: [{ command: 'npm run preview', port: 4173, reuseExistingServer: true, cwd: '../../..', timeout: 180_000 }],
});
