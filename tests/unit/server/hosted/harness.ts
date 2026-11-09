// Fakes for the hosted-proxy tests (ADR 015 §8, N3 of E14): fake verifier, fake allow-list, fake clock,
// in-memory counter store, fake resolver/requester, spy provider. No network, no Google, no Gemini.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPT_VERSION } from '../../../../src/domain/menu/extraction.ts';
import { handle, TooLarge, type CoreRequest, type CoreResponse, type ProxyDeps } from '../../../../server/core/handle.ts';
import {
  DEFAULT_LIMITS,
  nullCache,
  parseAllowList,
  unlimitedCap,
  type AccountCounters,
  type AccountLimits,
  type CounterStore,
  type HostedPolicy,
  type VerifiedAccount,
} from '../../../../server/core/hosted-policy.ts';
import { sha256Hex, type ProviderReply, type ProviderRequest, type ProviderTransport } from '../../../../server/menu/extract.ts';
import type { PdfResponse } from '../../../../server/menu/fetch-pdf.ts';
import { createFixtureTransports } from '../../../../server/menu/mock-transport.ts';

const MENUS = join(process.cwd(), 'tests', 'fixtures', 'menus');
export const PDF = new Uint8Array(readFileSync(join(MENUS, 'fixture-menu-2026-11', 'menu.pdf')));
export const ORIGIN = 'https://app.example.test';
export const EXTRACT_QUERY = `targetMonth=2026-11&promptVersion=${PROMPT_VERSION}&schemaVersion=1`;
export const NOW = Date.parse('2026-11-10T03:00:00Z'); // 12:00 JST

// Clearly fake identities (US-E14-02/AC3, contract 13.8).
export const ALICE: VerifiedAccount = { uid: 'test-uid-001', email: 'allowed@example.test', emailVerified: true };
export const BOB: VerifiedAccount = { uid: 'test-uid-002', email: 'second@example.test', emailVerified: true };
export const STRANGER: VerifiedAccount = { uid: 'test-uid-999', email: 'stranger@example.test', emailVerified: true };

export const UNVERIFIED: VerifiedAccount = { uid: 'test-uid-777', email: 'second@example.test', emailVerified: false };
export const TOKENS: Record<string, VerifiedAccount> = { 'tok-alice': ALICE, 'tok-bob': BOB, 'tok-stranger': STRANGER, 'tok-unverified': UNVERIFIED };

export class MemoryStore implements CounterStore {
  readonly data = new Map<string, AccountCounters>();
  failing = false;
  calls = 0;
  update<T>(key: string, fn: (c: AccountCounters | undefined) => { next: AccountCounters; value: T }): Promise<T> {
    this.calls += 1;
    if (this.failing) return Promise.reject(new Error('store down'));
    const { next, value } = fn(this.data.get(key));
    this.data.set(key, next);
    return Promise.resolve(value);
  }
}

export interface Rig {
  deps: ProxyDeps;
  store: MemoryStore;
  logs: string[];
  clock: { now: number };
  providerCalls: ProviderRequest[];
  verifierCalls: string[];
  fetches: string[];
  /** Replace the provider reply (default: delegate to the recorded fixture for the known PDF). */
  providerReply: { override: ProviderReply | null };
}

export interface RigOptions {
  allowList?: string | null;
  origins?: string[];
  limits?: AccountLimits;
  provider?: boolean;
  store?: MemoryStore;
  policy?: boolean;
}

function servePdf(): PdfResponse {
  return { status: 200, headers: { 'content-type': 'application/pdf' }, destroy: () => undefined, body: (async function* () { yield PDF; })() };
}

export function rig(opts: RigOptions = {}): Rig {
  const store = opts.store ?? new MemoryStore();
  const logs: string[] = [];
  const clock = { now: NOW };
  const providerCalls: ProviderRequest[] = [];
  const verifierCalls: string[] = [];
  const fetches: string[] = [];
  const providerReply: { override: ProviderReply | null } = { override: null };
  const fixtures = createFixtureTransports(MENUS);
  const provider: ProviderTransport = {
    call(request, signal) {
      providerCalls.push(request);
      if (providerReply.override !== null) return Promise.resolve(providerReply.override);
      const t = fixtures.forRequest(sha256Hex(request.pdf), undefined);
      return t === null ? Promise.resolve({ kind: 'http', status: 500, retryAfterSec: null }) : t.call(request, signal);
    },
  };
  const policy: HostedPolicy = {
    allowedOrigins: opts.origins ?? [ORIGIN],
    verifier: (token) => {
      verifierCalls.push(token);
      return Promise.resolve(TOKENS[token] ?? null);
    },
    allowList: opts.allowList === null ? null : parseAllowList(opts.allowList ?? 'test-uid-001,Second@Example.test'),
    limits: opts.limits ?? DEFAULT_LIMITS,
    store,
  };
  const deps: ProxyDeps = {
    version: '9.9.9',
    resolve: (host) => {
      fetches.push(host);
      return Promise.resolve([{ address: '93.184.215.14', family: 4 }]);
    },
    request: () => Promise.resolve(servePdf()),
    fixtures,
    provider: opts.provider === false ? null : provider,
    cache: nullCache,
    extractCap: unlimitedCap,
    fetchCap: unlimitedCap,
    primaryModel: 'model-primary',
    fallbackModel: 'model-fallback',
    allowScenarios: false,
    policy: opts.policy === false ? null : policy,
    nowMs: () => clock.now,
    sleep: () => Promise.resolve(),
    log: (m) => void logs.push(m),
  };
  return { deps, store, logs, clock, providerCalls, verifierCalls, fetches, providerReply };
}

export interface Call {
  res: CoreResponse;
  bodyReads: number;
  json: () => Record<string, unknown>;
}

export interface Send {
  method?: string;
  query?: string;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
  signal?: AbortSignal;
}

export async function send(r: Rig, path: string, s: Send = {}): Promise<Call> {
  let bodyReads = 0;
  const body = typeof s.body === 'string' ? new TextEncoder().encode(s.body) : (s.body ?? new Uint8Array());
  const req: CoreRequest = {
    method: s.method ?? 'POST',
    path,
    query: new URLSearchParams(s.query ?? ''),
    headers: Object.fromEntries(Object.entries(s.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
    readBody: (limit) => {
      bodyReads += 1;
      return body.byteLength > limit ? Promise.reject(new TooLarge()) : Promise.resolve(body);
    },
    signal: s.signal,
  };
  const res = await handle(req, r.deps);
  return {
    res,
    bodyReads,
    json: () => JSON.parse(typeof res.body === 'string' ? res.body : new TextDecoder().decode(res.body ?? new Uint8Array())) as Record<string, unknown>,
  };
}

export const auth = (token: string, extra: Record<string, string> = {}): Record<string, string> => ({ authorization: `Bearer ${token}`, ...extra });

export const extract = (r: Rig, token = 'tok-alice', extra: Send = {}) =>
  send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF, headers: auth(token, extra.headers), ...(extra.signal ? { signal: extra.signal } : {}) });

export const fetchPdfReq = (r: Rig, url = 'https://example-kinder.test/menu.pdf', token = 'tok-alice') =>
  send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url }), headers: auth(token) });
