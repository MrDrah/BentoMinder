// Local dev proxy (ADR 001, ADR 002). Node ≥ 22.18 runs this file directly (type stripping).
// Routes: GET /api/health · POST /api/menu/fetch-pdf { url } · POST /api/menu/extract
// (body = PDF bytes, query = targetMonth, promptVersion, schemaVersion: nothing else is
// accepted, contract `ai-payload-allowlist`). Binds to 127.0.0.1 only. M1 extracts with the
// recorded-fixture transport; the Gemini transport and its key (read from .env) arrive in M5.
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXTRACTION_SCHEMA_VERSION, PROMPT_VERSION } from '../src/domain/menu/extraction.ts';
import { MAX_PDF_BYTES } from '../src/domain/schema/extracted-menu.ts';
import { isYearMonth, toJstTimestamp, type Instant } from '../src/domain/time/jst.ts';
import { memoryCache, runExtraction, sha256Hex, windowCap, type CallCap, type ExtractDeps, type ExtractionCache } from './menu/extract.ts';
import { fetchPdf, type Requester, type Resolver } from './menu/fetch-pdf.ts';
import { createFixtureTransports, SCENARIO_HEADER, type FixtureTransports } from './menu/mock-transport.ts';
import { nodeRequester, nodeResolver } from './menu/node-net.ts';

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

class TooLarge extends Error {}

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

export interface ProxyDeps {
  version: string;
  resolve: Resolver;
  request: Requester;
  fixtures: FixtureTransports;
  cache: ExtractionCache;
  extractCap: CallCap;
  fetchCap: CallCap;
  primaryModel: string;
  fallbackModel: string;
  /** Honour the dev/test scenario header (never in a hosted deployment). */
  allowScenarios: boolean;
  nowMs(): number;
  sleep(ms: number): Promise<void>;
  log(message: string): void;
}

const EXTRACT_QUERY = ['targetMonth', 'promptVersion', 'schemaVersion'];

async function handleFetchPdf(req: IncomingMessage, res: ServerResponse, deps: ProxyDeps): Promise<void> {
  let url: unknown;
  try {
    url = (JSON.parse((await readBody(req, 8192)).toString('utf8')) as { url?: unknown }).url;
  } catch {
    sendJson(res, 400, { ok: false, error: 'BAD_REQUEST' });
    return;
  }
  if (typeof url !== 'string') {
    sendJson(res, 400, { ok: false, error: 'BAD_REQUEST' });
    return;
  }
  if (!deps.fetchCap.allow()) {
    sendJson(res, 429, { ok: false, error: 'RATE_LIMITED' });
    return;
  }
  deps.fetchCap.record();
  const result = await fetchPdf(url, { resolve: deps.resolve, request: deps.request });
  if (!result.ok) {
    sendJson(res, 422, { ok: false, error: result.error });
    return;
  }
  res.writeHead(200, {
    'content-type': 'application/pdf',
    'content-length': result.bytes.byteLength,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-bm-sha256': sha256Hex(result.bytes),
  });
  res.end(Buffer.from(result.bytes));
}

async function handleExtract(req: IncomingMessage, res: ServerResponse, url: URL, deps: ProxyDeps): Promise<void> {
  const keys = [...url.searchParams.keys()];
  const targetMonth = url.searchParams.get('targetMonth') ?? '';
  const ok =
    keys.every((k) => EXTRACT_QUERY.includes(k)) &&
    isYearMonth(targetMonth) &&
    url.searchParams.get('promptVersion') === String(PROMPT_VERSION) &&
    url.searchParams.get('schemaVersion') === String(EXTRACTION_SCHEMA_VERSION);
  if (!ok) {
    sendJson(res, 400, { ok: false, error: 'BAD_REQUEST' });
    return;
  }
  let pdf: Buffer;
  try {
    pdf = await readBody(req, MAX_PDF_BYTES);
  } catch (err) {
    if (err instanceof TooLarge) sendJson(res, 200, { ok: false, error: 'TOO_LARGE', providerCalls: 0 });
    else sendJson(res, 400, { ok: false, error: 'BAD_REQUEST' });
    return;
  }
  const header = req.headers[SCENARIO_HEADER];
  const scenario = deps.allowScenarios && typeof header === 'string' ? header : undefined;
  const bytes = new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength);
  const extractDeps: ExtractDeps = {
    transport: deps.fixtures.forRequest(sha256Hex(bytes), scenario),
    primaryModel: deps.primaryModel,
    fallbackModel: deps.fallbackModel,
    cache: deps.cache,
    cap: deps.extractCap,
    timestamp: () => toJstTimestamp(deps.nowMs() as Instant),
    sleep: deps.sleep,
    log: deps.log,
    bypassCache: scenario !== undefined,
  };
  const controller = new AbortController();
  // The client stopped the import (US-E2-04/AC8): make no further provider call.
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  const result = await runExtraction({ pdf: bytes, targetMonth }, extractDeps, controller.signal);
  if (!res.writableEnded && !res.destroyed) sendJson(res, 200, result);
}

export function createHandler(deps: ProxyDeps) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const route = (method: string, run: () => Promise<void>) => {
      if (req.method !== method) {
        res.setHeader('allow', method);
        sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      run().catch((err: unknown) => {
        deps.log(`proxy error: ${String(err)}`);
        if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'INTERNAL' });
      });
    };
    if (url.pathname === '/api/health') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('allow', 'GET, HEAD');
        sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
        return;
      }
      sendJson(res, 200, { ok: true, version: deps.version });
      return;
    }
    if (url.pathname === '/api/menu/fetch-pdf') return route('POST', () => handleFetchPdf(req, res, deps));
    if (url.pathname === '/api/menu/extract') return route('POST', () => handleExtract(req, res, url, deps));
    sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
  };
}

function envInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  const n = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`invalid ${name}: ${raw}`);
  return n;
}

/** Production wiring of the proxy from the environment (no secrets are read in M1). */
export function defaultDeps(env: NodeJS.ProcessEnv = process.env): ProxyDeps {
  const nowMs = () => Date.now();
  return {
    version: appVersion(),
    resolve: nodeResolver,
    request: nodeRequester,
    fixtures: createFixtureTransports(join(here, '..', 'tests', 'fixtures', 'menus')),
    cache: memoryCache(),
    // ADR 002 §2: extract ≤ 5/hour and ≤ 20/day; fetch-pdf ≤ 30/hour. Raised only for the e2e run.
    extractCap: windowCap({ perHour: envInt(env, 'PROXY_EXTRACT_PER_HOUR', 5), perDay: envInt(env, 'PROXY_EXTRACT_PER_DAY', 20) }, nowMs),
    fetchCap: windowCap({ perHour: envInt(env, 'PROXY_FETCH_PER_HOUR', 30), perDay: Number.MAX_SAFE_INTEGER }, nowMs),
    primaryModel: env['GEMINI_MODEL_PRIMARY'] || 'gemini-3.8-flash',
    fallbackModel: env['GEMINI_MODEL_FALLBACK'] || 'gemini-3.5-flash-lite',
    // Off unless PROXY_MOCK_SCENARIOS=1: only the test runs set it (D-M1-09).
    allowScenarios: env['PROXY_MOCK_SCENARIOS'] === '1',
    nowMs,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (m) => console.log(m),
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
