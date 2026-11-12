// QA E13-email unit suite. The root vitest.config.ts lists its include globs and does not (yet) include this folder, so run:
//   npx vitest run -c tests/unit/qa/e13-email/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('../../../..', import.meta.url)),
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/unit/qa/e13-email/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
