// QA E14 rig. Written from the stories (N3: fake verifier, allow-list, clock, resolver, provider); it shares no
// helper with the developers' tests/unit/server/hosted/harness.ts.
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
import type { ProviderReply, ProviderRequest, ProviderTransport } from '../../../../server/menu/extract.ts';
import type { PdfResponse, ResolvedAddress } from '../../../../server/menu/fetch-pdf.ts';

export const ORIGIN = 'https://app.example.test';
export const NOW = Date.parse('2026-11-10T03:00:00Z'); // 12:00 JST
export const QUERY = 'targetMonth=2026-11&promptVersion=3&schemaVersion=1'; // prompt version 3 per src/domain/menu/extraction.ts
export const pdfBytes = (extra = '') => new TextEncoder().encode(`%PDF-1.4\n${extra}\n%%EOF`);

export const A: VerifiedAccount = { uid: 'test-uid-001', email: 'allowed@example.test', emailVerified: true };
export const B: VerifiedAccount = { uid: 'test-uid-002', email: 'second@example.test', emailVerified: true };
export const STRANGER: VerifiedAccount = { uid: 'test-uid-999', email: 'stranger@example.test', emailVerified: true };
export const EMAIL_ONLY_UNVERIFIED: VerifiedAccount = { uid: 'test-uid-555', email: 'Allowed@Example.Test', emailVerified: false };

/** In-memory store that serialises updates like a transaction, optionally yielding in between. */
export class SerialStore implements CounterStore {
  readonly data = new Map<string, AccountCounters>();
  failing: 'reject' | 'throw' | null = null;
  calls = 0;
  jitter = false;
  private tail: Promise<unknown> = Promise.resolve();
  update<T>(key: string, fn: (c: AccountCounters | undefined) => { next: AccountCounters; value: T }): Promise<T> {
    this.calls += 1;
    if (this.failing === 'throw') throw new Error('store exploded MARKER_STORE');
    if (this.failing === 'reject') return Promise.reject(new Error('store down MARKER_STORE'));
    const run = async () => {
      const cur = this.data.get(key);
      if (this.jitter) await new Promise((r) => setTimeout(r, Math.random() * 3));
      const { next, value } = fn(cur === undefined ? undefined : structuredClone(cur));
      this.data.set(key, next);
      return value;
    };
    const p = this.tail.then(run, run);
    this.tail = p.catch(() => undefined);
    return p;
  }
}

export interface Rig {
  deps: ProxyDeps;
  store: SerialStore;
  logs: string[];
  clock: { now: number };
  provider: { calls: ProviderRequest[]; reply: () => ProviderReply | Promise<ProviderReply> };
  verifier: { calls: string[]; table: Record<string, VerifiedAccount>; throwFor: Set<string> };
  net: {
    resolves: string[];
    requests: Array<{ url: string; address: ResolvedAddress; keys: string[] }>;
    respond: (url: URL, address: ResolvedAddress, n: number) => PdfResponse | Promise<PdfResponse>;
    resolver: (host: string, n: number) => ResolvedAddress[] | Promise<ResolvedAddress[]>;
  };
}

export const okPdf = (bytes: Uint8Array = pdfBytes()): PdfResponse => ({
  status: 200,
  headers: { 'content-type': 'application/pdf' },
  destroy: () => undefined,
  body: (async function* () {
    yield bytes;
  })(),
});
export const redirect = (location: string, status = 302): PdfResponse => ({
  status,
  headers: { location },
  destroy: () => undefined,
  body: (async function* () {
    // empty
  })(),
});

export interface RigOptions {
  allowList?: string | null;
  origins?: string[];
  limits?: AccountLimits;
  noProvider?: boolean;
  store?: SerialStore;
}

export function rig(opts: RigOptions = {}): Rig {
  const store = opts.store ?? new SerialStore();
  const logs: string[] = [];
  const clock = { now: NOW };
  const provider: Rig['provider'] = { calls: [], reply: () => ({ kind: 'http', status: 400, retryAfterSec: null }) };
  const verifier: Rig['verifier'] = {
    calls: [],
    table: { 'tok-a': A, 'tok-b': B, 'tok-stranger': STRANGER, 'tok-unverified': EMAIL_ONLY_UNVERIFIED },
    throwFor: new Set(),
  };
  const net: Rig['net'] = {
    resolves: [],
    requests: [],
    respond: () => okPdf(),
    resolver: () => [{ address: '93.184.215.14', family: 4 }],
  };
  let nResolve = 0;
  let nRequest = 0;
  const transport: ProviderTransport = {
    call(request) {
      provider.calls.push(request);
      return Promise.resolve(provider.reply());
    },
  };
  const policy: HostedPolicy = {
    allowedOrigins: opts.origins ?? [ORIGIN],
    verifier: (token) => {
      verifier.calls.push(token);
      if (verifier.throwFor.has(token)) return Promise.reject(new Error(`verifier blew up ${token} MARKER_VERIFIER`));
      return Promise.resolve(verifier.table[token] ?? null);
    },
    allowList: opts.allowList === null ? null : parseAllowList(opts.allowList ?? 'test-uid-001, Second@Example.test'),
    limits: opts.limits ?? DEFAULT_LIMITS,
    store,
  };
  const deps: ProxyDeps = {
    version: '9.9.9',
    resolve: async (host) => {
      net.resolves.push(host);
      return net.resolver(host, nResolve++);
    },
    request: async (r) => {
      net.requests.push({ url: r.url.toString(), address: r.address, keys: Object.keys(r).sort() });
      return net.respond(r.url, r.address, nRequest++);
    },
    fixtures: { known: new Map(), forRequest: () => null },
    provider: opts.noProvider === true ? null : transport,
    cache: nullCache,
    extractCap: unlimitedCap,
    fetchCap: unlimitedCap,
    primaryModel: 'model-primary',
    fallbackModel: 'model-fallback',
    allowScenarios: false,
    policy,
    nowMs: () => clock.now,
    sleep: () => Promise.resolve(),
    log: (m) => void logs.push(m),
  };
  return { deps, store, logs, clock, provider, verifier, net };
}

export interface Send {
  method?: string;
  query?: string;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
}
export interface Call {
  res: CoreResponse;
  bodyReads: number;
  text: string;
  json: Record<string, unknown>;
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
  };
  const res = await handle(req, r.deps);
  const text = res.body === null ? '' : typeof res.body === 'string' ? res.body : new TextDecoder().decode(res.body);
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // binary body
  }
  return { res, bodyReads, text, json };
}

export const bearer = (t: string, extra: Record<string, string> = {}) => ({ authorization: `Bearer ${t}`, ...extra });
export const extract = (r: Rig, token = 'tok-a', o: { headers?: Record<string, string>; query?: string; body?: Uint8Array } = {}) =>
  send(r, '/api/menu/extract', { query: o.query ?? QUERY, body: o.body ?? pdfBytes(), headers: { ...bearer(token), ...(o.headers ?? {}) } });
export const fetchUrl = (r: Rig, url: string, token = 'tok-a', o: { headers?: Record<string, string>; query?: string } = {}) =>
  send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url }), ...(o.query === undefined ? {} : { query: o.query }), headers: { ...bearer(token), ...(o.headers ?? {}) } });

/** Everything a request did that costs something or touches the outside. */
export const effects = (r: Rig) => ({ provider: r.provider.calls.length, resolves: r.net.resolves.length, outbound: r.net.requests.length, store: r.store.calls });
export const NO_EFFECTS = { provider: 0, resolves: 0, outbound: 0, store: 0 };
export const headersString = (res: CoreResponse) => JSON.stringify(Object.entries(res.headers).sort(([a], [b]) => a.localeCompare(b)));
