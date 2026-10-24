// Local dev proxy (ADR 001, ADR 002). Node ≥ 22.18 runs this file directly (type stripping).
// M0: GET /api/health only; the menu routes arrive in M1 (fetch-pdf) and M5 (extract).
// Binds to 127.0.0.1 only. The AI key is read from .env in M5 and never sent to the client.
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function appVersion(): string {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version?: string };
  return pkg.version ?? '0.0.0';
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(text);
}

export function handle(req: IncomingMessage, res: ServerResponse, version: string): void {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/api/health') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD');
      sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
      return;
    }
    sendJson(res, 200, { ok: true, version });
    return;
  }
  sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
}

export function startServer(port: number, host = '127.0.0.1'): Server {
  const version = appVersion();
  const server = createServer((req, res) => handle(req, res, version));
  server.listen(port, host);
  return server;
}

export function proxyPort(env: NodeJS.ProcessEnv): number {
  const raw = env['PROXY_PORT'];
  const port = raw === undefined || raw === '' ? 8787 : Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError(`invalid PROXY_PORT: ${raw}`);
  return port;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = proxyPort(process.env);
  const server = startServer(port);
  server.on('listening', () => console.log(`BentoMinder proxy on http://127.0.0.1:${port} (GET /api/health)`));
}
