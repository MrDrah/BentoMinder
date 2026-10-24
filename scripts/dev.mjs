#!/usr/bin/env node
// `npm run dev`: starts the local proxy (dev:proxy) and Vite (dev:web) together and forwards
// Ctrl+C / termination to both. No `concurrently` dependency (architecture §11.3).
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = ['dev:proxy', 'dev:web'].map((script) =>
  spawn(npm, ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' }),
);

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exitCode = code;
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
for (const child of children) child.on('exit', (code) => stop(code ?? 0));
