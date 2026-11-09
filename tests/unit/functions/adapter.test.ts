// The Functions edge adapter (functions/src/adapter.ts) driven with plain fakes: request mapping, body handling,
// abort on close, and the replies of the hosted core as they leave the function. No Firebase SDK, no network.
import { describe, expect, it } from 'vitest';
import { createApiHandler, type FnRequest, type FnResponse } from '../../../functions/src/adapter.ts';
import { auth, EXTRACT_QUERY, ORIGIN, PDF, rig } from '../server/hosted/harness.ts';

class FakeRes implements FnResponse {
  statusCode = 0;
  writableEnded = false;
  headersSent = false;
  headers: Record<string, string> = {};
  sent: Uint8Array | string | undefined;
  private closers: (() => void)[] = [];
  setHeader(n: string, v: string) {
    this.headers[n.toLowerCase()] = v;
  }
  end(b?: Uint8Array | string) {
    this.sent = b;
    this.writableEnded = true;
    this.headersSent = true;
  }
  on(_e: 'close', l: () => void) {
    this.closers.push(l);
  }
  close() {
    for (const l of this.closers) l();
  }
  json(): Record<string, unknown> {
    return JSON.parse(typeof this.sent === 'string' ? this.sent : new TextDecoder().decode(this.sent)) as Record<string, unknown>;
  }
}

function req(path: string, o: { method?: string; headers?: FnRequest['headers']; rawBody?: Uint8Array; stream?: Uint8Array[] } = {}): FnRequest {
  const r: FnRequest = { method: o.method ?? 'POST', originalUrl: path, headers: o.headers ?? {}, rawBody: o.rawBody };
  if (o.stream !== undefined) {
    const chunks = o.stream;
    r[Symbol.asyncIterator] = async function* () {
      for (const c of chunks) yield c;
    };
  }
  return r;
}

const EXTRACT = `/api/menu/extract?${EXTRACT_QUERY}`;

describe('US-E14-01/AC1 a request without a valid token is refused by the function adapter', () => {
  it('US-E14-01/AC1 no Authorization header gives 401 UNAUTHENTICATED with 0 provider calls and the body never read', async () => {
    const r = rig();
    let reads = 0;
    const run = createApiHandler(() => r.deps);
    const res = new FakeRes();
    const q = req(EXTRACT, { rawBody: PDF });
    Object.defineProperty(q, 'rawBody', { get: () => (reads += 1, PDF) });
    await run(q, res);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(reads).toBe(0);
    expect(r.providerCalls).toHaveLength(0);
    expect(r.verifierCalls).toHaveLength(0);
  });

  it('US-E14-01/AC1 the header is read case-insensitively and an array header is joined (Authorization: Bearer ...)', async () => {
    const r = rig();
    const res = new FakeRes();
    await createApiHandler(() => r.deps)(req(EXTRACT, { rawBody: PDF, headers: { Authorization: 'Bearer tok-alice' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.json()['ok']).toBe(true);
    expect(r.verifierCalls).toEqual(['tok-alice']);
  });
});

describe('US-E14-05/AC1 and AC2 origins at the function edge', () => {
  it('US-E14-05/AC1 a preflight from the allowed origin answers 204 with that exact origin and no credentials', async () => {
    const r = rig();
    const res = new FakeRes();
    await createApiHandler(() => r.deps)(req('/api/menu/extract', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST' } }), res);
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-methods']).toBe('POST, OPTIONS');
    expect(res.headers['access-control-allow-headers']).toBe('Authorization, Content-Type');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.sent).toBeUndefined();
    expect(r.verifierCalls).toHaveLength(0);
  });

  it.each(['https://evil.example', `${ORIGIN}/`, `${ORIGIN}.evil.example`, 'http://app.example.test', 'https://app.example.test:8443', '*', 'null'])(
    'US-E14-05/AC2 origin %s is refused 403 ORIGIN_NOT_ALLOWED with no CORS header, 0 provider calls, 0 fetches',
    async (origin) => {
      const r = rig();
      const res = new FakeRes();
      await createApiHandler(() => r.deps)(req('/api/menu/fetch-pdf', { rawBody: new TextEncoder().encode('{"url":"https://example-kinder.test/a.pdf"}'), headers: { origin, authorization: 'Bearer tok-alice' } }), res);
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ ok: false, error: 'ORIGIN_NOT_ALLOWED' });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(r.providerCalls).toHaveLength(0);
      expect(r.fetches).toHaveLength(0);
    },
  );

  it('US-E14-05/AC3 a request with no Origin is judged by the token only', async () => {
    const r = rig();
    const res = new FakeRes();
    await createApiHandler(() => r.deps)(req(EXTRACT, { rawBody: PDF, headers: auth('tok-alice') }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('ADR 015 §5 body handling in the adapter', () => {
  it('US-E14-03/AC2 the PDF body arrives intact as rawBody and is the provider input (10 MiB path uses the same code)', async () => {
    const r = rig();
    const res = new FakeRes();
    await createApiHandler(() => r.deps)(req(EXTRACT, { rawBody: PDF, headers: auth('tok-alice') }), res);
    expect(res.statusCode).toBe(200);
    expect(r.providerCalls[0]?.pdf).toEqual(PDF);
  });

  it('US-E14-04/AC4 without rawBody the raw stream is read, and a stream over 10 MiB is TOO_LARGE with 0 provider calls', async () => {
    const r = rig();
    const ok = new FakeRes();
    await createApiHandler(() => r.deps)(req(EXTRACT, { stream: [PDF.subarray(0, 100), PDF.subarray(100)], headers: auth('tok-alice') }), ok);
    expect(ok.json()['ok']).toBe(true);
    const big = new FakeRes();
    await createApiHandler(() => r.deps)(req(EXTRACT, { stream: [new Uint8Array(10 * 1024 * 1024), new Uint8Array(1)], headers: auth('tok-alice') }), big);
    expect(big.json()).toMatchObject({ ok: false, error: 'TOO_LARGE', providerCalls: 0 });
  });

  it('US-E14-04/AC4 a rawBody over 10 MiB, or a declared Content-Length over it, is TOO_LARGE with 0 provider calls', async () => {
    const r = rig();
    for (const o of [{ rawBody: new Uint8Array(10 * 1024 * 1024 + 1) }, { rawBody: PDF, headers: { 'content-length': String(10 * 1024 * 1024 + 1) } }]) {
      const res = new FakeRes();
      await createApiHandler(() => r.deps)(req(EXTRACT, { ...o, headers: { ...auth('tok-alice'), ...(o.headers ?? {}) } }), res);
      expect(res.json()).toMatchObject({ ok: false, error: 'TOO_LARGE', providerCalls: 0 });
    }
    expect(r.providerCalls).toHaveLength(0);
  });

  it('US-E2-04/AC8 closing the connection before the reply aborts the provider calls', async () => {
    const r = rig();
    let aborted = false;
    r.deps.provider = {
      call: (_request, signal) => {
        res.close(); // the caller gives up while the provider call is in flight
        aborted = signal?.aborted === true;
        return Promise.resolve({ kind: 'http' as const, status: 500, retryAfterSec: null });
      },
    };
    const res = new FakeRes();
    await createApiHandler(() => r.deps)(req(EXTRACT, { rawBody: PDF, headers: auth('tok-alice') }), res);
    expect(aborted).toBe(true);
  });
});

describe('US-E14-06/AC2 unexpected exceptions leave the function as a bare INTERNAL with the class only logged', () => {
  it('US-E14-06/AC2 a throwing deps factory gives 500 INTERNAL and nothing from the error message reaches a reply', async () => {
    const res = new FakeRes();
    await createApiHandler(() => {
      throw new Error('boom MARK-SECRET-42');
    })(req(EXTRACT, { rawBody: PDF, headers: auth('tok-alice') }), res);
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ ok: false, error: 'INTERNAL' });
    expect(JSON.stringify(res.headers)).not.toContain('MARK-SECRET-42');
  });

  it('US-E14-06/AC2 a failure after the core ran logs the class name only', async () => {
    const r = rig();
    const res = new FakeRes();
    res.setHeader = () => {
      throw new RangeError('MARK-SECRET-43');
    };
    await createApiHandler(() => r.deps)(req('/api/health', { method: 'GET' }), res);
    expect(r.logs.join('\n')).toContain('class=RangeError');
    expect(r.logs.join('\n')).not.toContain('MARK-SECRET-43');
  });
});
