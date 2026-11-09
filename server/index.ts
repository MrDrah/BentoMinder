// Local dev proxy (ADR 001, ADR 002). Node ≥ 22.18 runs this file directly (type stripping).
// Routes: GET /api/health · POST /api/menu/fetch-pdf { url } · POST /api/menu/extract
// (body = PDF bytes, query = targetMonth, promptVersion, schemaVersion: nothing else is
// accepted, contract `ai-payload-allowlist`). Binds to 127.0.0.1 only. With GEMINI_API_KEY set
// (and no PROXY_MOCK_SCENARIOS) extraction uses the Gemini transport; otherwise recorded fixtures.
// This file is only the Node `http` adapter (ADR 015 §1); the request logic is in server/core/handle.ts.
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle, TooLarge, type CoreRequest, type ProxyDeps } from './core/handle.ts';
import { defaultCache } from './menu/file-cache.ts';
import { memoryCache, windowCap } from './menu/extract.ts';
import { createGeminiTransport } from './menu/gemini-transport.ts';
import { createFixtureTransports } from './menu/mock-transport.ts';
import { nodeRequester, nodeResolver } from './menu/node-net.ts';

export type { ProxyDeps };

const here = dirname(fileURLToPath(import.meta.url));

export function appVersion(): string {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version?: string };
  return pkg.version ?? '0.0.0';
}

/** Reads a request body, refusing more than `limit` bytes without buffering them. */
function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        req.removeAllListeners('data');
        req.resume();
        reject(new TooLarge());
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createHandler(deps: ProxyDeps) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const headers: Record<string, string | undefined> = {};
    for (const [name, value] of Object.entries(req.headers)) headers[name] = Array.isArray(value) ? value.join(', ') : value;
    const controller = new AbortController();
    // The client stopped the import (US-E2-04/AC8): make no further provider call.
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    const coreReq: CoreRequest = {
      method: req.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      headers,
      readBody: (limit) => readBody(req, limit),
      signal: controller.signal,
    };
    handle(coreReq, deps).then(
      (out) => {
        if (res.writableEnded || res.destroyed) return;
        res.writeHead(out.status, out.headers);
        res.end(out.body === null ? undefined : typeof out.body === 'string' ? out.body : Buffer.from(out.body));
      },
      (e: unknown) => {
        deps.log(`proxy error: ${String(e)}`);
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
          res.end('{"ok":false,"error":"INTERNAL"}');
        }
      },
    );
  };
}

function envInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  const n = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`invalid ${name}: ${raw}`);
  return n;
}

/** Production wiring of the proxy from the environment (GEMINI_API_KEY is read here and nowhere else). */
export function defaultDeps(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = globalThis.fetch): ProxyDeps {
  const nowMs = () => Date.now();
  const log = (m: string) => console.log(m);
  // Mock scenarios (the e2e runs) never get a real transport.
  const apiKey = env['GEMINI_API_KEY'];
  const useReal = apiKey !== undefined && apiKey.trim() !== '' && env['PROXY_MOCK_SCENARIOS'] !== '1';
  return {
    version: appVersion(),
    resolve: nodeResolver,
    request: nodeRequester,
    fixtures: createFixtureTransports(join(here, '..', 'tests', 'fixtures', 'menus')),
    provider: useReal
      ? createGeminiTransport({
          apiKey,
          fetch: fetchImpl,
          ...(env['AI_ALLOW_PAID_MODELS'] === 'true' ? { allowedModels: null } : {}),
          log,
          onUsage: (model, u) => log(`usage ${model} in=${u.inputTokens} out=${u.outputTokens}`),
        })
      : null,
    // Real provider: replies are kept on disk (ADR 002 §2, git-ignored). Recorded-fixture mode keeps them in memory only, so repeat runs of the test suites never see stale entries.
    cache: useReal ? defaultCache(join(here, '.cache'), log) : memoryCache(),
    // ADR 002 §2: extract ≤ 5/hour and ≤ 20/day; fetch-pdf ≤ 30/hour. Raised only for the e2e run.
    extractCap: windowCap({ perHour: envInt(env, 'PROXY_EXTRACT_PER_HOUR', 5), perDay: envInt(env, 'PROXY_EXTRACT_PER_DAY', 20) }, nowMs),
    fetchCap: windowCap({ perHour: envInt(env, 'PROXY_FETCH_PER_HOUR', 30), perDay: Number.MAX_SAFE_INTEGER }, nowMs),
    primaryModel: env['GEMINI_MODEL_PRIMARY'] || 'gemini-3.5-flash-lite',
    fallbackModel: env['GEMINI_MODEL_FALLBACK'] || 'gemini-3.8-flash',
    // Off unless PROXY_MOCK_SCENARIOS=1: only the test runs set it (D-M1-09).
    allowScenarios: env['PROXY_MOCK_SCENARIOS'] === '1',
    policy: null, // local: token-optional, no origin check (ADR 015 §1)
    nowMs,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log,
  };
}

export function startServer(port: number, host = '127.0.0.1', deps: ProxyDeps = defaultDeps()): Server {
  const server = createServer(createHandler(deps));
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
  server.on('listening', () => console.log(`BentoMinder proxy on http://127.0.0.1:${port} (health, menu/fetch-pdf, menu/extract [recorded fixtures])`));
}
