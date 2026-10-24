// POST /api/menu/fetch-pdf core: SSRF protection, redirects, size cap, magic bytes, timeout
// (ADR 002 §2, BR-14, US-E2-02/AC1, AC3). Resolver and requester are fakes: no network.
import { describe, expect, it, vi } from 'vitest';
import { checkUrl, fetchPdf, type PdfResponse, type Requester, type ResolvedAddress, type Resolver } from '../../../server/menu/fetch-pdf.ts';
import { isBlockedAddress, parseIPv6 } from '../../../server/net/ip.ts';

const PDF = new TextEncoder().encode('%PDF-1.7\n...fixture bytes...');
const PUBLIC: ResolvedAddress = { address: '93.184.215.14', family: 4 };

function response(status: number, body: Uint8Array[] = [], headers: Record<string, string> = {}): PdfResponse & { destroyed: boolean } {
  const state = { destroyed: false };
  const r = {
    status,
    headers,
    destroyed: false,
    body: (async function* () {
      for (const c of body) {
        if (state.destroyed) return;
        yield c;
      }
    })(),
    destroy() {
      state.destroyed = true;
      r.destroyed = true;
    },
  };
  return r;
}

const resolver = (map: Record<string, string[]>): Resolver => (host) => {
  const list = map[host];
  if (list === undefined) return Promise.reject(new Error('ENOTFOUND'));
  return Promise.resolve(list.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));
};

describe('US-E2-02/AC3 private and internal targets are refused before anything is fetched (BR-14)', () => {
  it.each([
    '127.0.0.1', '127.255.0.9', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.10', '169.254.169.254', '100.64.0.1',
    '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1', '192.0.2.5',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd00:ec2::254', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1',
    '64:ff9b::a9fe:a9fe', '2002:c0a8:0101::1', '2001:db8::1', '::127.0.0.1', 'not-an-ip',
  ])('US-E2-02/AC3 %s is blocked', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(['93.184.215.14', '8.8.8.8', '2606:4700:4700::1111', '::ffff:93.184.215.14', '2002:5db8:d70e::1', '64:ff9b::808:808'])('US-E2-02/AC3 public %s is allowed', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it('parses compressed and dotted IPv6 forms', () => {
    expect(parseIPv6('::ffff:1.2.3.4')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x0102, 0x0304]);
    expect(parseIPv6('1::2:3::4')).toBeNull();
    expect(parseIPv6('1:2:3:4:5:6:7')).toBeNull();
    expect(parseIPv6('fe80::1%eth0')).toEqual([0xfe80, 0, 0, 0, 0, 0, 0, 1]);
    expect(parseIPv6('::ffff:1.2.3')).toBeNull();
  });

  it('US-E2-02/AC3 a host that resolves to a loopback address is never requested', async () => {
    const request = vi.fn<Requester>();
    const r = await fetchPdf('https://evil.test/menu.pdf', { resolve: resolver({ 'evil.test': ['127.0.0.1'] }), request });
    expect(r).toEqual({ ok: false, error: 'BLOCKED' });
    expect(request).not.toHaveBeenCalled();
  });

  it('US-E2-02/AC3 a host with any internal address among its answers is refused', async () => {
    const request = vi.fn<Requester>();
    const r = await fetchPdf('https://mixed.test/m.pdf', { resolve: resolver({ 'mixed.test': ['93.184.215.14', '10.0.0.1'] }), request });
    expect(r).toEqual({ ok: false, error: 'BLOCKED' });
    expect(request).not.toHaveBeenCalled();
  });

  it('US-E2-02/AC3 IP-literal URLs are checked without DNS', async () => {
    const resolve = vi.fn<Resolver>();
    const request = vi.fn<Requester>();
    expect(await fetchPdf('https://127.0.0.1/m.pdf', { resolve, request })).toEqual({ ok: false, error: 'BLOCKED' });
    expect(await fetchPdf('https://[::1]/m.pdf', { resolve, request })).toEqual({ ok: false, error: 'BLOCKED' });
    expect(await fetchPdf('https://[::ffff:169.254.169.254]/m.pdf', { resolve, request })).toEqual({ ok: false, error: 'BLOCKED' });
    expect(resolve).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(response(200, [PDF]));
    expect(await fetchPdf('https://93.184.215.14/m.pdf', { resolve, request })).toMatchObject({ ok: true });
    expect(request.mock.calls[0]?.[0].address).toEqual({ address: '93.184.215.14', family: 4 });
  });

  it('US-E2-01/AC2 the URL itself must be https on port 443 without userinfo (BR-14)', async () => {
    for (const bad of ['http://a.test/m.pdf', 'https://a.test:8443/m.pdf', 'ftp://a.test/m.pdf', 'javascript:alert(1)', 'menu.pdf', 'https://u:p@a.test/m.pdf', `https://a.test/${'a'.repeat(2049)}`]) {
      expect(checkUrl(bad), bad).toBeNull();
      expect(await fetchPdf(bad, { resolve: vi.fn(), request: vi.fn() })).toEqual({ ok: false, error: 'URL_NOT_ALLOWED' });
    }
    expect(checkUrl('https://a.test:443/m.pdf')).not.toBeNull();
  });
});

describe('US-E2-01/AC1 a valid public PDF is fetched from the validated address', () => {
  it('US-E2-01/AC1 connects to the resolved address with the original URL (for TLS) and returns the bytes', async () => {
    const request = vi.fn<Requester>().mockResolvedValue(response(200, [PDF.slice(0, 3), PDF.slice(3)], { 'content-type': 'application/pdf' }));
    const r = await fetchPdf('https://example-kinder.test/menu/2026-11.pdf', { resolve: resolver({ 'example-kinder.test': ['93.184.215.14'] }), request });
    expect(r).toEqual({ ok: true, bytes: PDF });
    expect(request.mock.calls[0]?.[0].url.hostname).toBe('example-kinder.test');
    expect(request.mock.calls[0]?.[0].address).toEqual(PUBLIC);
  });
});

describe('US-E2-02/AC1 retrieval failures map to the parent-facing errors', () => {
  const resolve = resolver({ 'a.test': ['93.184.215.14'] });
  const run = (res: PdfResponse) => fetchPdf('https://a.test/m.pdf', { resolve, request: () => Promise.resolve(res) });

  it('US-E2-02/AC1 404 → NOT_FOUND, 403 → BLOCKED, 500 → NETWORK', async () => {
    expect(await run(response(404))).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await run(response(403))).toEqual({ ok: false, error: 'BLOCKED' });
    expect(await run(response(500))).toEqual({ ok: false, error: 'NETWORK' });
  });

  it('US-E2-02/AC1 an HTML page is NOT_A_PDF and the download stops early', async () => {
    const html = response(200, [new TextEncoder().encode('<!doctype html><p>hi'), new Uint8Array(100)], { 'content-type': 'text/html' });
    expect(await run(html)).toEqual({ ok: false, error: 'NOT_A_PDF' });
    expect(html.destroyed).toBe(true);
    expect(await run(response(200, [PDF], { 'content-type': 'text/html; charset=utf-8' }))).toEqual({ ok: false, error: 'NOT_A_PDF' });
  });

  it('US-E2-03/AC4 an empty body is EMPTY', async () => {
    expect(await run(response(200, []))).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('US-E2-02/AC1 DNS failure, connection error and a thrown stream are NETWORK', async () => {
    expect(await fetchPdf('https://nowhere.test/m.pdf', { resolve, request: vi.fn() })).toEqual({ ok: false, error: 'NETWORK' });
    expect(await fetchPdf('https://a.test/m.pdf', { resolve: () => Promise.resolve([]), request: vi.fn() })).toEqual({ ok: false, error: 'NETWORK' });
    expect(await fetchPdf('https://a.test/m.pdf', { resolve, request: () => Promise.reject(new Error('ECONNRESET')) })).toEqual({ ok: false, error: 'NETWORK' });
    const broken: PdfResponse = {
      status: 200,
      headers: {},
      destroy: () => undefined,
      body: (async function* () {
        yield PDF;
        throw new Error('reset');
      })(),
    };
    expect(await run(broken)).toEqual({ ok: false, error: 'NETWORK' });
  });

  it('US-E2-02/AC1 a fetch that takes longer than the timeout (15 s) is NETWORK', async () => {
    vi.useFakeTimers();
    try {
      const pending = fetchPdf('https://a.test/m.pdf', { resolve, request: () => new Promise(() => undefined) });
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await pending).toEqual({ ok: false, error: 'NETWORK' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('US-E2-02/AC3 the 10 MB cap is enforced while streaming (BR-14)', () => {
  const resolve = resolver({ 'a.test': ['93.184.215.14'] });
  const MB = 1024 * 1024;

  it('US-E2-02/AC3 a body over 10,485,760 bytes is stopped at the limit', async () => {
    const chunk = new Uint8Array(MB);
    chunk.set(PDF);
    let served = 0;
    const stop = { destroyed: false };
    const big: PdfResponse & { destroyed: boolean } = {
      status: 200,
      headers: {},
      destroyed: false,
      destroy() {
        stop.destroyed = true;
        big.destroyed = true;
      },
      body: (async function* () {
        for (let i = 0; i < 50; i += 1) {
          if (stop.destroyed) return;
          served += 1;
          yield chunk;
        }
      })(),
    };
    expect(await fetchPdf('https://a.test/m.pdf', { resolve, request: () => Promise.resolve(big) })).toEqual({ ok: false, error: 'TOO_LARGE' });
    expect(big.destroyed).toBe(true);
    expect(served).toBe(11);
  });

  it('US-E2-02/AC3 a declared Content-Length over the cap is refused without reading', async () => {
    const res = response(200, [PDF], { 'content-length': String(10_485_761) });
    expect(await fetchPdf('https://a.test/m.pdf', { resolve, request: () => Promise.resolve(res) })).toEqual({ ok: false, error: 'TOO_LARGE' });
  });

  it('US-E2-03/AC3 exactly 10,485,760 bytes are accepted', async () => {
    const exact = new Uint8Array(10_485_760);
    exact.set(PDF);
    const r = await fetchPdf('https://a.test/m.pdf', { resolve, request: () => Promise.resolve(response(200, [exact])) });
    expect(r.ok && r.bytes.byteLength).toBe(10_485_760);
  });
});

describe('US-E2-02/AC3 redirects: at most 3, each one re-validated', () => {
  it('US-E2-02/AC3 follows up to 3 redirects to public hosts', async () => {
    const resolve = resolver({ 'a.test': ['93.184.215.14'], 'b.test': ['93.184.215.15'] });
    const seen: string[] = [];
    const request: Requester = ({ url }) => {
      seen.push(url.toString());
      if (seen.length <= 3) return Promise.resolve(response(302, [], { location: seen.length === 2 ? 'https://b.test/x.pdf' : '/next.pdf' }));
      return Promise.resolve(response(200, [PDF]));
    };
    expect(await fetchPdf('https://a.test/m.pdf', { resolve, request })).toMatchObject({ ok: true });
    expect(seen).toEqual(['https://a.test/m.pdf', 'https://a.test/next.pdf', 'https://b.test/x.pdf', 'https://b.test/next.pdf']);
  });

  it('US-E2-02/AC3 a 4th redirect is refused', async () => {
    const resolve = resolver({ 'a.test': ['93.184.215.14'] });
    const request = vi.fn<Requester>().mockImplementation(() => Promise.resolve(response(301, [], { location: '/again.pdf' })));
    expect(await fetchPdf('https://a.test/m.pdf', { resolve, request })).toEqual({ ok: false, error: 'BLOCKED' });
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('US-E2-02/AC3 a redirect to a private address is refused before it is requested', async () => {
    const resolve = resolver({ 'a.test': ['93.184.215.14'], 'internal.test': ['192.168.0.10'] });
    const request = vi.fn<Requester>().mockResolvedValueOnce(response(302, [], { location: 'https://internal.test/admin' }));
    expect(await fetchPdf('https://a.test/m.pdf', { resolve, request })).toEqual({ ok: false, error: 'BLOCKED' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('US-E2-02/AC3 redirects to http, to an IP literal in a private range, or without a Location are refused', async () => {
    const resolve = resolver({ 'a.test': ['93.184.215.14'] });
    for (const headers of [{ location: 'http://a.test/m.pdf' }, { location: 'https://169.254.169.254/latest/meta-data' }, {} as Record<string, string>, { location: 'https://[::1]:443/x' }]) {
      const request = vi.fn<Requester>().mockResolvedValueOnce(response(307, [], headers));
      expect(await fetchPdf('https://a.test/m.pdf', { resolve, request })).toEqual({ ok: false, error: 'BLOCKED' });
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
});
