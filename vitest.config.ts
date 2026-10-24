import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Architecture §11.3: three projects. "tz" re-runs the domain time tests with a non-JST
// device timezone so BR-15 (all dates in Asia/Tokyo) is proven, not assumed.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          environment: 'node',
          include: ['tests/unit/domain/**/*.test.ts', 'tests/unit/server/**/*.test.ts', 'tests/unit/scripts/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['tests/unit/ui/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/setup/dom.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'tz',
          environment: 'node',
          include: ['tests/unit/domain/time/**/*.test.ts'],
          env: { TZ: 'America/Los_Angeles' },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      exclude: ['src/domain/**/*.d.ts'],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
