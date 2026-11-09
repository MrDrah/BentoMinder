// Framework-neutral request handler (ADR 015 §1): routing, query validation, body limits,
// fetch-pdf, extraction, error mapping. No node:http types. The local Node adapter
// (server/index.ts) and the hosted entry (slice B) both call `handle`.
// Order of outcomes when `deps.policy` is set (US-E14-02/AC6): origin, preflight/health (no token),
// route, token, allow-list, request validation, limit reservation, work. Local: `policy` is null.
import { EXTRACTION_SCHEMA_VERSION, PROMPT_VERSION } from '../../src/domain/menu/extraction.ts';
import { MAX_PDF_BYTES } from '../../src/domain/schema/extracted-menu.ts';
import { isYearMonth, toJstTimestamp, type Instant } from '../../src/domain/time/jst.ts';
import { runExtraction, sha256Hex, type CallCap, type ExtractDeps, type ExtractionCache, type ProviderTransport } from '../menu/extract.ts';
import { checkUrl, fetchPdf, startsWithMagic, type Requester, type Resolver } from '../menu/fetch-pdf.ts';
import { SCENARIO_HEADER, type FixtureTransports } from './scenario.ts';
import {
  accountKey,
  corsHeaders,
  filterProviderLog,
  formatErrorLine,
  formatLogLine,
  isAllowed,
  isAllowedOrigin,
  NOT_ALLOWED_BODY,
  ORIGIN_NOT_ALLOWED_BODY,
  parseBearer,
  reserve,
  UNAUTHENTICATED_BODY,
  UNAVAILABLE_BODY,
  type Endpoint,
  type HostedPolicy,
  type Reservation,
} from './hosted-policy.ts';

export interface CoreRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  /** Lower-cased header names. */
  headers: Readonly<Record<string, string | undefined>>;
  /** Reads the body, throwing `TooLarge` when it exceeds `limit` bytes. */
  readBody(limit: number): Promise<Uint8Array>;
  /** Aborted when the client gives up (US-E2-04/AC8). */
  signal?: AbortSignal | undefined;
}

export interface CoreResponse {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array | string | null;
}

export class TooLarge extends Error {}

export interface ProxyDeps {
  version: string;
  resolve: Resolver;
  request: Requester;
  fixtures: FixtureTransports;
  /** The real Gemini transport (M5); null/absent = recorded fixtures in tests, NOT_CONFIGURED otherwise. */
  provider?: ProviderTransport | null;
  cache: ExtractionCache;
  extractCap: CallCap;
  fetchCap: CallCap;
  primaryModel: string;
  fallbackModel: string;
  /** Honour the dev/test scenario header (never in a hosted deployment). */
  allowScenarios: boolean;
  /** Hosted rules (token, allow-list, origin, limits, log allow-list); null/absent = the local proxy. */
  policy?: HostedPolicy | null;
  nowMs(): number;
  sleep(ms: number): Promise<void>;
  log(message: string): void;
}

const EXTRACT_QUERY = ['targetMonth', 'promptVersion', 'schemaVersion'];
const BASE_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function json(status: number, body: unknown, extra: Record<string, string> = {}): CoreResponse {
  const text = JSON.stringify(body);
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-length': String(Buffer.byteLength(text)), ...BASE_HEADERS, ...extra },
    body: text,
  };
}

/** What a route produced, plus the operational facts the hosted log line may carry. */
interface Outcome {
  response: CoreResponse;
  outcome: string;
  providerCalls?: number | undefined;
  model?: string | undefined;
}

interface Ctx {
  endpoint: string;
  account?: string | undefined;
}

const out = (response: CoreResponse, outcome: string, extra: Partial<Outcome> = {}): Outcome => ({ response, outcome, ...extra });
const err = (status: number, code: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Outcome =>
  out(json(status, { ok: false, error: code, ...extra }, headers), code);

function limitReply(r: Extract<Reservation, { ok: false }>): Outcome {
  return out(
    json(429, { ok: false, error: 'ACCOUNT_LIMIT', scope: r.scope, retryAfterSec: r.retryAfterSec, providerCalls: 0 }, { 'retry-after': String(r.retryAfterSec) }),
    'ACCOUNT_LIMIT',
    { providerCalls: 0 },
  );
}

/** Token, allow-list, then (after validation, by the caller) limits. Returns the account or the refusal. */
async function authenticate(req: CoreRequest, policy: HostedPolicy, ctx: Ctx): Promise<{ uid: string } | Outcome> {
  const token = parseBearer(req.headers['authorization']);
  if (token === null) return out(json(401, UNAUTHENTICATED_BODY), 'UNAUTHENTICATED');
  let account;
  try {
    account = await policy.verifier(token);
  } catch {
    account = null; // a verifier that cannot decide never lets the request through
  }
  if (account === null || typeof account.uid !== 'string' || account.uid === '') return out(json(401, UNAUTHENTICATED_BODY), 'UNAUTHENTICATED');
  ctx.account = accountKey(account.uid);
  if (!isAllowed(policy.allowList, account)) return out(json(403, NOT_ALLOWED_BODY), 'NOT_ALLOWED');
  return { uid: account.uid };
}

/** Counts the request; any store failure refuses it (fail closed, US-E14-03/AC8). */
async function countRequest(policy: HostedPolicy, uid: string, endpoint: Endpoint, deps: ProxyDeps): Promise<Outcome | null> {
  let result: Reservation;
  try {
    result = await reserve(policy.store, accountKey(uid), endpoint, deps.nowMs(), policy.limits);
  } catch {
    return out(json(503, UNAVAILABLE_BODY), 'UNAVAILABLE', { providerCalls: 0 });
  }
  return result.ok ? null : limitReply(result);
}

async function handleFetchPdf(req: CoreRequest, deps: ProxyDeps, uid: string | null): Promise<Outcome> {
  const policy = deps.policy ?? null;
  let url: unknown;
  try {
    url = (JSON.parse(Buffer.from(await req.readBody(8192)).toString('utf8')) as { url?: unknown }).url;
  } catch {
    return err(400, 'BAD_REQUEST');
  }
  if (typeof url !== 'string') return err(400, 'BAD_REQUEST');
  if (policy !== null && uid !== null) {
    // Hosted: a request counts once its URL is a syntactically valid https URL (ADR 015, needs-a-decision list).
    if (checkUrl(url) === null) return err(422, 'URL_NOT_ALLOWED');
    const refused = await countRequest(policy, uid, 'fetch', deps);
    if (refused !== null) return refused;
  }
  if (!deps.fetchCap.allow()) return err(429, 'RATE_LIMITED');
  deps.fetchCap.record();
  const result = await fetchPdf(url, { resolve: deps.resolve, request: deps.request });
  if (!result.ok) return err(422, result.error);
  return out(
    {
      status: 200,
      headers: { 'content-type': 'application/pdf', 'content-length': String(result.bytes.byteLength), ...BASE_HEADERS, 'x-bm-sha256': sha256Hex(result.bytes) },
      body: result.bytes,
    },
    'OK',
  );
}

async function handleExtract(req: CoreRequest, deps: ProxyDeps, uid: string | null): Promise<Outcome> {
  const policy = deps.policy ?? null;
  const keys = [...req.query.keys()];
  const targetMonth = req.query.get('targetMonth') ?? '';
  const ok =
    keys.every((k) => EXTRACT_QUERY.includes(k)) &&
    isYearMonth(targetMonth) &&
    req.query.get('promptVersion') === String(PROMPT_VERSION) &&
    req.query.get('schemaVersion') === String(EXTRACTION_SCHEMA_VERSION);
  if (!ok) return err(400, 'BAD_REQUEST');
  const tooLarge = () => err(200, 'TOO_LARGE', { providerCalls: 0 });
  if (policy !== null) {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_PDF_BYTES) return tooLarge();
  }
  let pdf: Uint8Array;
  try {
    pdf = await req.readBody(MAX_PDF_BYTES);
  } catch (e) {
    return e instanceof TooLarge ? tooLarge() : err(400, 'BAD_REQUEST');
  }
  const header = req.headers[SCENARIO_HEADER];
  const scenario = deps.allowScenarios && typeof header === 'string' ? header : undefined;
  // Hosted: only the real provider, never recorded fixtures or scenarios (ADR 015 §1).
  const transport =
    policy !== null ? (deps.provider ?? null) : scenario === undefined && deps.provider ? deps.provider : deps.fixtures.forRequest(sha256Hex(pdf), scenario);
  if (policy !== null && uid !== null) {
    // Hosted: validation (size above, PDF magic here) comes before counting; so does "not configured".
    if (pdf.byteLength === 0 || !startsWithMagic(pdf)) return err(200, 'NOT_A_PDF', { providerCalls: 0 });
    if (transport !== null) {
      const refused = await countRequest(policy, uid, 'extract', deps);
      if (refused !== null) return refused;
    }
  }
  const log = policy === null ? deps.log : filterProviderLog(deps.log);
  const extractDeps: ExtractDeps = {
    transport,
    primaryModel: deps.primaryModel,
    fallbackModel: deps.fallbackModel,
    cache: deps.cache,
    cap: deps.extractCap,
    timestamp: () => toJstTimestamp(deps.nowMs() as Instant),
    sleep: deps.sleep,
    log,
    bypassCache: scenario !== undefined,
  };
  const result = await runExtraction({ pdf, targetMonth }, extractDeps, req.signal);
  return out(json(200, result), result.ok ? 'OK' : result.error, {
    providerCalls: result.ok ? result.meta.providerCalls : result.providerCalls,
    model: result.ok ? result.meta.model : undefined,
  });
}

async function route(req: CoreRequest, deps: ProxyDeps, ctx: Ctx): Promise<Outcome> {
  const policy = deps.policy ?? null;
  const method = req.method;
  if (req.path === '/api/health') {
    ctx.endpoint = 'health';
    if (policy !== null && method === 'OPTIONS') return out({ status: 204, headers: { ...BASE_HEADERS }, body: null }, 'PREFLIGHT');
    if (method !== 'GET' && method !== 'HEAD') return err(405, 'METHOD_NOT_ALLOWED', {}, { allow: 'GET, HEAD' });
    return out(json(200, { ok: true, version: deps.version }), 'OK');
  }
  const handlers: Record<string, [string, (uid: string | null) => Promise<Outcome>]> = {
    '/api/menu/fetch-pdf': ['fetch-pdf', (uid) => handleFetchPdf(req, deps, uid)],
    '/api/menu/extract': ['extract', (uid) => handleExtract(req, deps, uid)],
  };
  const entry = handlers[req.path];
  if (entry === undefined) return err(404, 'NOT_FOUND');
  ctx.endpoint = entry[0];
  if (policy !== null && method === 'OPTIONS') return out({ status: 204, headers: { ...BASE_HEADERS }, body: null }, 'PREFLIGHT');
  if (method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED', {}, { allow: 'POST' });
  if (policy === null) return entry[1](null);
  const who = await authenticate(req, policy, ctx);
  if ('response' in who) return who;
  return entry[1](who.uid);
}

export async function handle(req: CoreRequest, deps: ProxyDeps): Promise<CoreResponse> {
  const policy = deps.policy ?? null;
  const started = deps.nowMs();
  const ctx: Ctx = { endpoint: 'other' };
  let cors: Record<string, string> = {};
  let result: Outcome;
  try {
    const origin = req.headers['origin'];
    if (policy !== null && origin !== undefined && !isAllowedOrigin(policy, origin)) {
      result = out(json(403, ORIGIN_NOT_ALLOWED_BODY), 'ORIGIN_NOT_ALLOWED');
    } else {
      if (policy !== null && origin !== undefined) cors = corsHeaders(origin);
      result = await route(req, deps, ctx);
    }
  } catch (e) {
    deps.log(policy === null ? `proxy error: ${String(e)}` : formatErrorLine(ctx.endpoint, e));
    result = out(json(500, { ok: false, error: 'INTERNAL' }), 'INTERNAL');
  }
  const response: CoreResponse = { ...result.response, headers: { ...result.response.headers, ...cors } };
  if (policy !== null) {
    deps.log(
      formatLogLine({
        endpoint: ctx.endpoint,
        outcome: result.outcome,
        status: response.status,
        durationMs: deps.nowMs() - started,
        providerCalls: result.providerCalls,
        model: result.model,
        account: ctx.account,
      }),
    );
  }
  return response;
}
