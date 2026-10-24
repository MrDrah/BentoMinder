// ESLint flat config (architecture §11.3). Encodes three project rules:
// 1. UI strings only from src/i18n (react/jsx-no-literals in src/ui, BR-23).
// 2. WebView-safe platform access only inside src/adapters/web (ADR 001).
// 3. The pure domain imports no React, UI or adapters (ADR 004).
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const platformGlobals = [
  { name: 'localStorage', message: 'Use the Storage port (src/adapters/web/storage.ts).' },
  { name: 'sessionStorage', message: 'Use the Storage port (src/adapters/web/storage.ts).' },
  { name: 'indexedDB', message: 'Use the Storage port.' },
  { name: 'Notification', message: 'Use the NotificationScheduler port.' },
  // Node types are visible to src/ only because tests share tsconfig.app.json; the browser has neither.
  { name: 'process', message: 'Not available in the browser or the WebView.' },
  { name: 'Buffer', message: 'Not available in the browser or the WebView.' },
];
const platformProperties = [
  { object: 'window', property: 'localStorage', message: 'Use the Storage port.' },
  { object: 'window', property: 'indexedDB', message: 'Use the Storage port.' },
  { object: 'navigator', property: 'share', message: 'Use the Share port.' },
  { object: 'navigator', property: 'clipboard', message: 'Use the Share port.' },
  { object: 'Date', property: 'now', message: 'Use the Clock port.' },
];
const noArgDate = {
  selector: "NewExpression[callee.name='Date'][arguments.length=0]",
  message: 'new Date() reads the device clock: use the Clock port.',
};

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'reports/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', '.claude/**', 'design/**', 'docs/**', '**/_scratch/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', console: 'readonly', crypto: 'readonly',
        process: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', Buffer: 'readonly', Intl: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', HTMLElement: 'readonly', HTMLButtonElement: 'readonly',
        Blob: 'readonly', AbortSignal: 'readonly', fetch: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-globals': ['error', ...platformGlobals],
      'no-restricted-properties': ['error', ...platformProperties],
      'no-restricted-syntax': ['error', noArgDate],
    },
  },
  {
    // The web adapters are where platform APIs belong; scripts, server and tests run in Node or Playwright.
    files: ['src/adapters/web/**', 'scripts/**', 'server/**', 'tests/**', '*.config.{ts,js}'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off', 'no-restricted-syntax': 'off' },
  },
  {
    // Tests index fixtures they just built or loaded; a missing entry fails the test anyway.
    files: ['tests/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: { 'react/jsx-no-literals': ['error', { noStrings: false, ignoreProps: true }] },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*', 'react-dom/*'], message: 'The domain is pure: no React (ADR 004).' },
            { group: ['**/ui/**', '**/ui', '**/adapters/**', '**/adapters', '**/i18n/**', '**/debug/**'], message: 'The domain imports no UI, adapters, i18n or debug code (ADR 004).' },
          ],
        },
      ],
    },
  },
);
