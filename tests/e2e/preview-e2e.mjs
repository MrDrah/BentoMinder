// `npm run preview` (what every Playwright config starts): builds the app WITH the sign-in test seam and serves it
// on :4173. The seam (src/adapters/web/e2e-auth.ts, chosen by VITE_AUTH_FAKE=1) lets the e2e suites start with the
// fake account already signed in; see the header of that file for the localStorage keys a spec can set.
//
// The seam build goes to node_modules/.cache/bentominder-e2e-dist: git-ignored and never part of dist/, so a
// deployed or budgeted `npm run build` output never contains it (proved by tests/unit/scripts/auth-bundle.test.ts).
// To look at the real production build use `npm run preview:prod` (Google sign-in, needs the VITE_FIREBASE_* values).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'node_modules', '.cache', 'bentominder-e2e-dist');

// VITE_AUTH_FAKE=1 also lets a spec switch sync on for one browser (localStorage `bentominder.fake-sync-base`, slice D,
// src/adapters/select-sync.ts); with no such key sync stays off exactly as in a normal build.
process.env.VITE_AUTH_FAKE = '1';
await build({ root, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
const server = await preview({ root, build: { outDir }, preview: { port: 4173, strictPort: true } });
server.printUrls();
