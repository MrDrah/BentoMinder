import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, normalizePath, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildDisplayFontCss } from './scripts/display-font.mjs';
import { en } from './src/i18n/en.ts';
import { ja } from './src/i18n/ja.ts';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * `virtual:display-font.css`: Zen Maru Gothic 500/700 @font-face rules for the slices that
 * cover the catalogs and recipe names (ADR 001 "Fonts"; scripts/display-font.mjs).
 */
function displayFont(): Plugin {
  const id = 'virtual:display-font.css';
  const resolved = normalizePath(join(root, 'src', 'ui', 'styles', '__display-font.css'));
  const filesDir = join(root, 'node_modules', '@fontsource', 'zen-maru-gothic', 'files');
  return {
    name: 'bentominder-display-font',
    // The dev server re-requests the module by its URL (/src/ui/styles/__display-font.css).
    resolveId: (source) => (source === id || source.endsWith('/__display-font.css') ? resolved : null),
    load(loadId) {
      if (normalizePath(loadId) !== resolved) return null;
      const library = JSON.parse(readFileSync(join(root, 'data', 'library.json'), 'utf8')) as {
        name: { ja: string; en?: string };
        shortNameJa: string;
        shortNameEn: string;
      }[];
      const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
      const texts = [
        ascii,
        ...Object.values(ja),
        ...Object.values(en),
        ...library.flatMap((r) => [r.name.ja, r.name.en ?? '', r.shortNameJa, r.shortNameEn]),
      ];
      const rel = relative(dirname(resolved), filesDir).replaceAll('\\', '/');
      return buildDisplayFontCss({ texts, fileUrl: (name: string) => `${rel}/${name}` }).css;
    },
  };
}

// ADR 001: static build, relative base so the same dist/ loads inside the Capacitor WebView.
// Nothing secret is ever defined here: the AI key lives only in the proxy's .env.
export default defineConfig({
  base: './',
  plugins: [react(), displayFont()],
  build: {
    target: ['es2022', 'chrome111'],
    sourcemap: false,
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
