// Bundles the hosted function (ADR 015 §6): functions/src/index.ts plus ../server and ../src/domain inlined into
// functions/lib/index.js. Only firebase-admin and firebase-functions stay external (installed by the cloud build).
// Run from the repository root: `npm run build:functions`. The output is generated and git-ignored.
import { build } from 'esbuild';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version ?? '0.0.0';

rmSync(join(root, 'functions', 'lib'), { recursive: true, force: true });
await build({
  entryPoints: [join(root, 'functions', 'src', 'index.ts')],
  outfile: join(root, 'functions', 'lib', 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['firebase-admin', 'firebase-admin/*', 'firebase-functions', 'firebase-functions/*'],
  define: { __APP_VERSION__: JSON.stringify(version) },
  legalComments: 'none',
  logLevel: 'info',
});
