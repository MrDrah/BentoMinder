// QA E14 runner (the default vitest projects do not include tests/unit/qa/e14):
//   npx vitest run -c tests/unit/qa/e14/vitest.e14.config.ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: 'e14-node', environment: 'node', root: '.', include: ['tests/unit/qa/e14/**/*.test.ts'], testTimeout: 120_000 } },
      {
        extends: true,
        test: { name: 'e14-ui', environment: 'jsdom', root: '.', include: ['tests/unit/qa/e14/**/*.test.tsx'], setupFiles: ['tests/setup/dom.ts'], testTimeout: 20_000, hookTimeout: 20_000 },
      },
    ],
  },
});
