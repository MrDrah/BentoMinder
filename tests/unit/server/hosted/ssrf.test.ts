// US-E14-04: the hosted URL fetch cannot be turned against the cloud. Everything goes through the hosted core
// (policy ON) with a fake resolver and a fake requester: no DNS, no network, no Google.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PdfResponse, Requester, ResolvedAddress, Resolver } from '../../../../server/menu/fetch-pdf.ts';
import { fetchPdfReq, PDF, rig, type Rig } from './harness.ts';

const PUBLIC = '93.184.215.14';
const MIB = 1024 * 1024;
const pdfBytes = (n: number): Uint8Array => {
  const b = new Uint8Array(n);
  b.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  return b;
};

interface Served {
  status?: number;
  headers?: Record<string, string>;
  chunks?: Uint8Array[];
  /** Never ends (a server that stalls). */
  stall?: boolean;
}

/** A fake network: url -> response; every call is recorded, a destroyed response stops yielding. */
function network(table: Record<string, Served>, onChunk?: () => void) {
  const calls: { url: string; address: ResolvedAddress; keys: string[]; signal: AbortSignal }[] = [];
  const destroyed: string[] = [];
  const request: Requester = (arg) => {
    calls.push({ url: arg.url.toString(), address: arg.address, keys: Object.keys(arg), signal: arg.signal });
    const served = table[arg.url.toString()];
    if (served === undefined) return Promise.reject(new Error('ECONNREFUSED 10.9.9.9 internal text'));
    let stopped = false;
    const res: PdfResponse = {
      status: served.status ?? 200,
      headers: { 'content-type': 'application/pdf', ...(served.headers ?? {}) },
      destroy: () => {
        stopped = true;
        destroyed.push(arg.url.toString());
      },
      body: (async function* () {
        if (served.stall === true) await new Promise<void>(() => undefined);
        for (const c of served.chunks ?? []) {
          if (stopped) return;
          onChunk?.();
          yield c;
        }
      })(),
    };
    return Promise.resolve(res);
  };
  return { request, calls, destroyed };
}

const names =
  (map: Record<string, string[]>): Resolver =>
  (host) => {
    const list = map[host];
    if (list === undefined) return Promise.reject(new Error('ENOTFOUND'));
    return Promise.resolve(list.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));
  };

function setup(table: Record<string, Served>, dns: Record<string, string[]> = {}, onChunk?: () => void): { r: Rig; net: ReturnType<typeof network>; lookups: string[] } {
  const r = rig();
  const net = network(table, onChunk);
  const lookups: string[] = [];
  const resolver = names({ 'example-kinder.test': [PUBLIC], ...dns });
  r.deps.resolve = (h) => {
    lookups.push(h);
    return resolver(h);
  };
  r.deps.request = net.request;
  return { r, net, lookups };
}

const ok = (...chunks: Uint8Array[]): Served => ({ chunks });
const body = (c: { json: () => Record<string, unknown> }) => c.json();

afterEach(() => {
  vi.useRealTimers();
});

describe('US-E14-04/AC1 unsafe URLs are refused before any connection', () => {
  const rows: [string, string][] = [
    ['not https', 'http://example-kinder.test/menu.pdf'],
    ['port 8443', 'https://example-kinder.test:8443/menu.pdf'],
    ['credentials in the URL', 'https://user:pw@example-kinder.test/menu.pdf'],
    ['IPv4 loopback', 'https://127.0.0.1/menu.pdf'],
    ['IPv6 loopback', 'https://[::1]/menu.pdf'],
    ['localhost', 'https://localhost/menu.pdf'],
    ['10/8', 'https://10.0.0.5/menu.pdf'],
    ['192.168/16', 'https://192.168.1.1/menu.pdf'],
    ['172.16/12', 'https://172.16.0.1/menu.pdf'],
    ['metadata address', 'https://169.254.169.254/computeMetadata/v1/'],
    ['metadata name', 'https://metadata.google.internal/'],
    ['decimal IPv4', 'https://2130706433/'],
    ['hex IPv4', 'https://0x7f.1/'],
    ['octal IPv4', 'https://0177.0.0.1/'],
    ['IPv4-mapped IPv6', 'https://[::ffff:127.0.0.1]/'],
    ['unique-local IPv6', 'https://[fd00::1]/'],
    ['link-local IPv6', 'https://[fe80::1]/'],
    ['CGNAT 100.64/10', 'https://100.64.0.1/'],
    ['multicast', 'https://224.0.0.1/'],
    ['reserved 240/4', 'https://240.0.0.1/'],
    ['unspecified', 'https://0.0.0.0/'],
    ['IPv6 multicast', 'https://[ff02::1]/'],
    ['single-label host', 'https://intranet/'],
    ['a URL longer than 2048 characters', `https://example-kinder.test/${'a'.repeat(2100)}.pdf`],
  ];

  it.each(rows)('US-E14-04/AC1 %s: no connection, no lookup, the blocked outcome, 0 provider calls', async (_label, url) => {
    const { r, net, lookups } = setup({});
    const c = await fetchPdfReq(r, url);
    expect(c.res.status).toBe(422);
    expect(['URL_NOT_ALLOWED', 'BLOCKED']).toContain(body(c)['error']);
    expect(net.calls).toHaveLength(0);
    expect(lookups).toHaveLength(0);
    expect(r.providerCalls).toHaveLength(0);
  });

  it('US-E14-04/AC1 a name that resolves to loopback or the metadata address is refused without a connection', async () => {
    const { r, net } = setup({}, { 'sneaky.test': ['127.0.0.1'], 'meta.test': ['169.254.169.254'], 'v6.test': ['::ffff:10.0.0.1'] });
    for (const host of ['sneaky.test', 'meta.test', 'v6.test']) {
      const c = await fetchPdfReq(r, `https://${host}/menu.pdf`);
      expect(body(c)['error']).toBe('BLOCKED');
    }
    expect(net.calls).toHaveLength(0);
  });
});

describe('US-E14-04/AC2 the address actually used is checked, not just the name', () => {
  it.each([
    ['one private address', ['10.0.0.5']],
    ['one public and one private address', [PUBLIC, '10.0.0.5']],
    ['a public IPv4 and a private IPv6 address', [PUBLIC, 'fd00::1']],
  ])('US-E14-04/AC2 kinder-redirect.test resolving to %s downloads nothing', async (_l, addresses) => {
    const { r, net } = setup({ 'https://kinder-redirect.test/menu.pdf': ok(pdfBytes(100)) }, { 'kinder-redirect.test': addresses });
    const c = await fetchPdfReq(r, 'https://kinder-redirect.test/menu.pdf');
    expect(body(c)['error']).toBe('BLOCKED');
    expect(net.calls).toHaveLength(0);
  });

  it('US-E14-04/AC2 the connection goes to the vetted address and the name is looked up once per hop (no rebinding window)', async () => {
    const { r, net, lookups } = setup({ 'https://flip.test/menu.pdf': ok(pdfBytes(100)) });
    let n = 0;
    r.deps.resolve = (h) => {
      lookups.push(h);
      n += 1;
      return Promise.resolve([{ address: n === 1 ? PUBLIC : '10.0.0.5', family: 4 as const }]); // public first, private on any later lookup
    };
    const c = await fetchPdfReq(r, 'https://flip.test/menu.pdf');
    expect(c.res.status).toBe(200);
    expect(lookups).toEqual(['flip.test']);
    expect(net.calls).toHaveLength(1);
    expect(net.calls[0]!.address).toEqual({ address: PUBLIC, family: 4 });
  });

  it('US-E14-04/AC2 an IPv4 address is tried first when a name has both', async () => {
    const { r, net } = setup({ 'https://dual.test/menu.pdf': ok(pdfBytes(100)) }, { 'dual.test': ['2606:4700:4700::1111', PUBLIC] });
    const c = await fetchPdfReq(r, 'https://dual.test/menu.pdf');
    expect(c.res.status).toBe(200);
    expect(net.calls[0]!.address).toEqual({ address: PUBLIC, family: 4 });
  });
});

describe('US-E14-04/AC3 every redirect hop is checked again', () => {
  const START = 'https://example-kinder.test/menu.pdf';
  const redirect = (to: string): Served => ({ status: 302, headers: { location: to } });

  it.each([
    ['the metadata address', 'https://169.254.169.254/'],
    ['a private address', 'https://10.1.2.3/menu.pdf'],
    ['a private IPv6 address', 'https://[fd00::1]/menu.pdf'],
    ['http://', 'http://example-kinder.test/menu.pdf'],
    ['a non-443 port', 'https://example-kinder.test:8443/menu.pdf'],
    ['a name that resolves to a private address', 'https://inner.test/menu.pdf'],
    ['credentials', 'https://u:p@example-kinder.test/menu.pdf'],
    ['a relative path to the metadata name', 'https://metadata.google.internal/x'],
  ])('US-E14-04/AC3 a redirect to %s is not followed (blocked, only the first hop connected)', async (_l, to) => {
    const { r, net } = setup({ [START]: redirect(to) }, { 'inner.test': ['192.168.0.9'] });
    const c = await fetchPdfReq(r, START);
    expect(body(c)['error']).toBe('BLOCKED');
    expect(net.calls.map((x) => x.url)).toEqual([START]);
  });

  it('US-E14-04/AC3 more than 3 redirects ends blocked', async () => {
    const hop = (n: number) => `https://example-kinder.test/${n}.pdf`;
    const { r, net } = setup({ [START]: redirect(hop(1)), [hop(1)]: redirect(hop(2)), [hop(2)]: redirect(hop(3)), [hop(3)]: redirect(hop(4)), [hop(4)]: ok(pdfBytes(50)) });
    const c = await fetchPdfReq(r, START);
    expect(body(c)['error']).toBe('BLOCKED');
    expect(net.calls).toHaveLength(4);
  });

  it('US-E14-04/AC3 exactly 3 redirects to a public file still work, and each hop is looked up again', async () => {
    const hop = (n: number) => `https://cdn${n}.test/menu.pdf`;
    const dns = { 'cdn1.test': [PUBLIC], 'cdn2.test': [PUBLIC], 'cdn3.test': [PUBLIC] };
    const { r, lookups } = setup({ [START]: redirect(hop(1)), [hop(1)]: redirect(hop(2)), [hop(2)]: redirect(hop(3)), [hop(3)]: ok(pdfBytes(50)) }, dns);
    const c = await fetchPdfReq(r, START);
    expect(c.res.status).toBe(200);
    expect(lookups).toEqual(['example-kinder.test', 'cdn1.test', 'cdn2.test', 'cdn3.test']);
  });
});

describe('US-E14-04/AC4 only a PDF of at most 10 MiB comes back', () => {
  const URL_ = 'https://example-kinder.test/menu.pdf';

  it('US-E14-04/AC4 10,485,760 bytes of PDF are returned', async () => {
    const whole = pdfBytes(10 * MIB);
    const { r } = setup({ [URL_]: ok(whole.subarray(0, MIB), whole.subarray(MIB)) });
    const c = await fetchPdfReq(r);
    expect(c.res.status).toBe(200);
    expect((c.res.body as Uint8Array).byteLength).toBe(10 * MIB);
  });

  it('US-E14-04/AC4 10,485,761 bytes are refused TOO_LARGE and the download stops at the limit', async () => {
    let read = 0;
    const chunks = Array.from({ length: 14 }, (_, i) => (i === 0 ? pdfBytes(MIB) : new Uint8Array(MIB)));
    chunks.splice(10, 0, new Uint8Array(1)); // crosses the limit by one byte after 10 MiB
    const { r, net } = setup({ [URL_]: ok(...chunks) }, {}, () => (read += 1));
    const c = await fetchPdfReq(r);
    expect(c.res.status).toBe(422);
    expect(body(c)).toEqual({ ok: false, error: 'TOO_LARGE' });
    expect(net.destroyed).toEqual([URL_]);
    expect(read).toBe(11); // the 12th chunk is never pulled
  });

  it('US-E14-04/AC4 a declared Content-Length over the limit is refused before any data is read', async () => {
    let read = 0;
    const { r, net } = setup({ [URL_]: { headers: { 'content-length': String(10 * MIB + 1) }, chunks: [pdfBytes(10)] } }, {}, () => (read += 1));
    const c = await fetchPdfReq(r);
    expect(body(c)['error']).toBe('TOO_LARGE');
    expect(read).toBe(0);
    expect(net.destroyed).toHaveLength(1);
  });

  it.each([
    ['a body that does not start with %PDF-', new TextEncoder().encode('GIF89a not a pdf at all'), 'application/pdf'],
    ['an HTML page', new TextEncoder().encode('<!doctype html><html><body>login</body></html>'), 'text/html'],
    ['an HTML page claiming to be a PDF', new TextEncoder().encode('<html>%PDF-</html>'), 'application/pdf'],
  ])('US-E14-04/AC4 %s is refused NOT_A_PDF', async (_l, bytes, type) => {
    const { r } = setup({ [URL_]: { headers: { 'content-type': type }, chunks: [bytes] } });
    const c = await fetchPdfReq(r);
    expect(c.res.status).toBe(422);
    expect(body(c)).toEqual({ ok: false, error: 'NOT_A_PDF' });
  });

  it('US-E14-04/AC4 an empty body is refused and nothing is passed on', async () => {
    const { r } = setup({ [URL_]: ok() });
    const c = await fetchPdfReq(r);
    expect(body(c)).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('US-E14-04/AC4 a real PDF fixture comes back with its sha-256 only as a response header', async () => {
    const { r } = setup({ [URL_]: ok(PDF) });
    const c = await fetchPdfReq(r);
    expect(c.res.status).toBe(200);
    expect(c.res.headers['x-bm-sha256']).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('US-E14-04/AC5 time is bounded', () => {
  it('US-E14-04/AC5 a server that never answers ends with NETWORK after 15 s and the request is aborted', async () => {
    vi.useFakeTimers();
    const r = rig();
    let signal: AbortSignal | undefined;
    r.deps.request = (arg) => {
      signal = arg.signal;
      return new Promise<PdfResponse>(() => undefined);
    };
    const pending = fetchPdfReq(r);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    const c = await pending;
    expect(c.res.status).toBe(422);
    expect(body(c)).toEqual({ ok: false, error: 'NETWORK' });
    expect(signal?.aborted).toBe(true);
  });

  it('US-E14-04/AC5 a body that stalls mid-download ends with NETWORK after 15 s, no further data is read', async () => {
    vi.useFakeTimers();
    let read = 0;
    const { r } = setup({ 'https://example-kinder.test/menu.pdf': { chunks: [pdfBytes(10)], stall: true } }, {}, () => (read += 1));
    const pending = fetchPdfReq(r);
    await vi.advanceTimersByTimeAsync(15_001);
    const c = await pending;
    expect(body(c)).toEqual({ ok: false, error: 'NETWORK' });
    expect(read).toBe(0);
  });
});

describe('US-E14-04/AC6 nothing of the requester or of the target leaks', () => {
  it('US-E14-04/AC6 the outbound request is built from the vetted target only (no caller header, cookie or token)', async () => {
    const { r, net } = setup({ 'https://example-kinder.test/menu.pdf': ok(pdfBytes(20)) });
    await fetchPdfReq(r, 'https://example-kinder.test/menu.pdf', 'tok-alice');
    expect(net.calls).toHaveLength(1);
    expect(net.calls[0]!.keys.sort()).toEqual(['address', 'signal', 'url']); // the requester gets no headers to forward
  });

  it('US-E14-04/AC6 failures carry only the outcome code: no status text, header, body, resolved IP or internal error text', async () => {
    const marker = 'LEAK-MARKER-xyz';
    const table: Record<string, Served> = {
      'https://example-kinder.test/missing.pdf': { status: 404, headers: { 'x-target-header': marker }, chunks: [new TextEncoder().encode(marker)] },
      'https://example-kinder.test/denied.pdf': { status: 403, headers: { 'x-target-header': marker }, chunks: [new TextEncoder().encode(marker)] },
      'https://example-kinder.test/page.pdf': { headers: { 'content-type': 'text/html', 'x-target-header': marker }, chunks: [new TextEncoder().encode(`<html>${marker}</html>`)] },
      'https://example-kinder.test/boom.pdf': { status: 500, chunks: [new TextEncoder().encode(marker)] },
    };
    const { r } = setup(table, { 'priv.test': ['10.20.30.40'] });
    const urls = [...Object.keys(table), 'https://example-kinder.test/refused.pdf', 'https://priv.test/x.pdf', 'https://nowhere.test/x.pdf', 'http://example-kinder.test/'];
    for (const url of urls) {
      const c = await fetchPdfReq(r, url);
      const text = JSON.stringify(c.res.body);
      expect(Object.keys(body(c)).sort()).toEqual(['error', 'ok']);
      expect(text).not.toContain(marker);
      expect(text).not.toMatch(/10\.20\.30\.40|10\.9\.9\.9|ECONN|ENOTFOUND|93\.184|Not Found|Forbidden/i);
      expect(Object.values(c.res.headers).join('\n')).not.toContain(marker);
    }
    expect(r.logs.join('\n')).not.toMatch(/10\.20\.30\.40|example-kinder|priv\.test|nowhere\.test|LEAK-MARKER/);
  });
});

describe('US-E14-04/AC7 failures give the same replies as the local proxy', () => {
  it.each([
    ['404', { status: 404 } as Served, 'NOT_FOUND'],
    ['403', { status: 403 } as Served, 'BLOCKED'],
    ['an HTML page', { headers: { 'content-type': 'text/html' }, chunks: [new TextEncoder().encode('<html></html>')] } as Served, 'NOT_A_PDF'],
    ['a server error', { status: 502 } as Served, 'NETWORK'],
  ])('US-E14-04/AC7 %s gives %s with HTTP 422 as locally', async (_l, served, code) => {
    const { r } = setup({ 'https://example-kinder.test/menu.pdf': served });
    const c = await fetchPdfReq(r);
    expect(c.res.status).toBe(422);
    expect(body(c)).toEqual({ ok: false, error: code });
  });

  it('US-E14-04/AC7 an unreachable server (connection error) is NETWORK', async () => {
    const { r } = setup({});
    const c = await fetchPdfReq(r, 'https://example-kinder.test/gone.pdf');
    expect(body(c)).toEqual({ ok: false, error: 'NETWORK' });
  });
});
