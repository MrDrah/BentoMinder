// QA E14: US-E14-04 SSRF, from the AC table and contract 13.6, with my own list of unsafe URL spellings.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPdf, type PdfResponse } from '../../../../server/menu/fetch-pdf.ts';
import { effects, fetchUrl, NO_EFFECTS, okPdf, pdfBytes, redirect, rig } from './rig.ts';

afterEach(() => vi.useRealTimers());

const BLOCKED_OUTCOMES = ['BLOCKED', 'URL_NOT_ALLOWED']; // the app maps both to the "blocked" message (pdf-source SERVER_ERRORS)

const UNSAFE: Array<[string, string]> = [
  ['plain http', 'http://example-kinder.test/menu.pdf'],
  ['port 8443', 'https://example-kinder.test:8443/menu.pdf'],
  ['port 80 with https', 'https://example-kinder.test:80/menu.pdf'],
  ['credentials', 'https://user:pw@example-kinder.test/menu.pdf'],
  ['user only', 'https://user@example-kinder.test/menu.pdf'],
  ['userinfo trick: public name in userinfo, private host', 'https://example-kinder.test@127.0.0.1/menu.pdf'],
  ['userinfo trick: private in userinfo', 'https://127.0.0.1@example-kinder.test/menu.pdf'],
  ['userinfo with encoded @', 'https://example-kinder.test%40127.0.0.1:pw@10.0.0.5/'],
  ['loopback v4', 'https://127.0.0.1/menu.pdf'],
  ['loopback 127.1', 'https://127.1/'],
  ['loopback 127.255.255.254', 'https://127.255.255.254/'],
  ['loopback decimal', 'https://2130706433/'],
  ['loopback hex whole', 'https://0x7f000001/'],
  ['loopback hex dotted', 'https://0x7f.1/'],
  ['loopback hex dotted full', 'https://0x7f.0x0.0x0.0x1/'],
  ['loopback octal dotted', 'https://0177.0.0.1/'],
  ['loopback octal whole', 'https://017700000001/'],
  ['loopback trailing dot', 'https://127.0.0.1./'],
  ['unspecified 0.0.0.0', 'https://0.0.0.0/'],
  ['unspecified 0', 'https://0/'],
  ['10/8', 'https://10.0.0.5/menu.pdf'],
  ['10/8 decimal', 'https://167772165/'],
  ['172.16/12 low', 'https://172.16.0.1/'],
  ['172.16/12 high', 'https://172.31.255.255/'],
  ['192.168/16', 'https://192.168.1.1/'],
  ['192.168 hex', 'https://0xc0a80101/'],
  ['link-local', 'https://169.254.1.1/'],
  ['metadata address', 'https://169.254.169.254/computeMetadata/v1/'],
  ['metadata address decimal', 'https://2852039166/'],
  ['metadata address hex', 'https://0xa9fea9fe/'],
  ['metadata address octal', 'https://0251.0376.0251.0376/'],
  ['metadata address trailing dot', 'https://169.254.169.254./'],
  ['CGNAT low', 'https://100.64.0.1/'],
  ['CGNAT high', 'https://100.127.255.254/'],
  ['multicast', 'https://224.0.0.1/'],
  ['multicast high', 'https://239.255.255.255/'],
  ['reserved 240/4', 'https://240.0.0.1/'],
  ['broadcast', 'https://255.255.255.255/'],
  ['TEST-NET-1', 'https://192.0.2.1/'],
  ['benchmark 198.18/15', 'https://198.19.255.255/'],
  ['v6 loopback', 'https://[::1]/'],
  ['v6 loopback expanded', 'https://[0:0:0:0:0:0:0:1]/'],
  ['v6 loopback compressed odd', 'https://[0::1]/'],
  ['v6 unspecified', 'https://[::]/'],
  ['v4-mapped dotted', 'https://[::ffff:127.0.0.1]/'],
  ['v4-mapped hex', 'https://[::ffff:7f00:1]/'],
  ['v4-mapped expanded', 'https://[0:0:0:0:0:ffff:7f00:1]/'],
  ['v4-mapped metadata', 'https://[::ffff:169.254.169.254]/'],
  ['v4-mapped private', 'https://[::ffff:10.0.0.5]/'],
  ['v4-compatible', 'https://[::127.0.0.1]/'],
  ['unique-local fd', 'https://[fd00::1]/'],
  ['unique-local fc', 'https://[fc00::1]/'],
  ['aws-style v6 metadata', 'https://[fd00:ec2::254]/'],
  ['link-local v6', 'https://[fe80::1]/'],
  ['link-local v6 high', 'https://[febf::1]/'],
  ['multicast v6', 'https://[ff02::1]/'],
  ['NAT64 of metadata', 'https://[64:ff9b::a9fe:a9fe]/'],
  ['6to4 of metadata', 'https://[2002:a9fe:a9fe::]/'],
  ['6to4 of loopback', 'https://[2002:7f00:1::1]/'],
  ['documentation v6', 'https://[2001:db8::1]/'],
  ['localhost', 'https://localhost/menu.pdf'],
  ['localhost upper', 'https://LOCALHOST/'],
  ['localhost trailing dot', 'https://localhost./'],
  ['subdomain of localhost', 'https://anything.localhost/'],
  ['metadata name', 'https://metadata.google.internal/'],
  ['metadata name upper', 'https://METADATA.GOOGLE.INTERNAL/'],
  ['metadata name trailing dot', 'https://metadata.google.internal./'],
  ['metadata short name', 'https://metadata/'],
  ['.internal zone', 'https://db.corp.internal/'],
  ['.local zone', 'https://printer.local/'],
  ['single label', 'https://intranet/'],
  ['too long (2049)', `https://example-kinder.test/${'a'.repeat(2049 - 'https://example-kinder.test/'.length)}`],
  ['javascript scheme', 'javascript:alert(1)'],
  ['file scheme', 'file:///etc/passwd'],
  ['ftp scheme', 'ftp://example-kinder.test/menu.pdf'],
  ['data scheme', 'data:application/pdf;base64,JVBERi0='],
  ['gopher', 'gopher://127.0.0.1:6379/_PING'],
  ['whitespace in host', 'https://example-kinder.test /menu.pdf'],
  ['newline injection', 'https://example-kinder.test/menu.pdf\r\nHost: 127.0.0.1'],
  ['empty', ''],
  ['not a url', 'not a url at all'],
];

describe('US-E14-04/AC1 unsafe URLs are refused before any connection (through the hosted handler)', () => {
  for (const [name, url] of UNSAFE) {
    it(`US-E14-04/AC1 ${name}`, async () => {
      const r = rig();
      // names that would resolve public must never be reached: make any lookup that happens report a PUBLIC address,
      // so a refusal can only come from the URL/host rules and not from the fake resolver.
      const c = await fetchUrl(r, url);
      expect(c.res.status).toBe(422);
      expect(BLOCKED_OUTCOMES).toContain(c.json['error']);
     
      expect(r.net.requests).toEqual([]); // no connection
      expect(r.provider.calls).toEqual([]);
      expect(Object.keys(c.json).sort()).toEqual(['error', 'ok']); // outcome code only
    });
  }
});

describe('US-E14-04/AC1 safe look-alikes are NOT over-blocked (the list is not just "refuse everything")', () => {
  for (const url of ['https://🍱.example.test/menu.pdf', 'https://example-kinder.test/menu.pdf', 'https://example-kinder.test:443/menu.pdf', 'https://www.city.example.test/a/b.pdf?x=1', 'https://93.184.215.14/m.pdf']) {
    it(`US-E14-04/AC1 ${url} is fetched`, async () => {
      const r = rig();
      const c = await fetchUrl(r, url);
      expect(c.res.status).toBe(200);
      expect(r.net.requests.length).toBe(1);
    });
  }
});

describe('US-E14-04/AC2 the address actually used is checked (fake resolver)', () => {
  it('US-E14-04/AC2 a name resolving to a private address: nothing downloaded, blocked', async () => {
    const r = rig();
    r.net.resolver = () => [{ address: '10.0.0.5', family: 4 }];
    const c = await fetchUrl(r, 'https://kinder-redirect.test/menu.pdf');
    expect(c.json['error']).toBe('BLOCKED');
    expect(r.net.requests).toEqual([]);
  });
  for (const mixed of [
    [['93.184.215.14', 4], ['10.0.0.5', 4]],
    [['10.0.0.5', 4], ['93.184.215.14', 4]],
    [['93.184.215.14', 4], ['::1', 6]],
    [['93.184.215.14', 4], ['::ffff:10.0.0.5', 6]],
    [['93.184.215.14', 4], ['fd00::1', 6]],
    [['93.184.215.14', 4], ['169.254.169.254', 4]],
    [['2606:4700::1111', 6], ['100.64.1.1', 4]],
  ] as const) {
    it(`US-E14-04/AC2 one public and one private address (${mixed.map((m) => m[0]).join(' + ')}) is refused`, async () => {
      const r = rig();
      r.net.resolver = () => mixed.map(([address, family]) => ({ address, family }));
      const c = await fetchUrl(r, 'https://kinder-mixed.test/menu.pdf');
      expect(c.json['error']).toBe('BLOCKED');
      expect(r.net.requests).toEqual([]);
    });
  }
  it('US-E14-04/AC2 a resolver that returns nothing or throws ends as NETWORK, never a connection', async () => {
    for (const resolver of [() => [], () => Promise.reject(new Error('NXDOMAIN MARKER_DNS 10.1.2.3'))]) {
      const r = rig();
      r.net.resolver = resolver;
      const c = await fetchUrl(r, 'https://kinder-gone.test/menu.pdf');
      expect(c.json['error']).toBe('NETWORK');
      expect(c.text).not.toContain('MARKER_DNS');
      expect(r.net.requests).toEqual([]);
    }
  });
  it('US-E14-04/AC2 rebinding: public at check time, private later. The connection goes to the vetted public address, and the name is not resolved again', async () => {
    const r = rig();
    r.net.resolver = (_h, n) => (n === 0 ? [{ address: '93.184.215.14', family: 4 }] : [{ address: '10.0.0.5', family: 4 }]);
    const c = await fetchUrl(r, 'https://kinder-rebind.test/menu.pdf');
    expect(c.res.status).toBe(200);
    expect(r.net.requests.map((q) => q.address.address)).toEqual(['93.184.215.14']);
    expect(r.net.resolves).toEqual(['kinder-rebind.test']); // exactly one lookup: no second, rebindable, lookup
  });
  it('US-E14-04/AC2 rebinding the other way: private at the first lookup is refused before any connect', async () => {
    const r = rig();
    r.net.resolver = (_h, n) => (n === 0 ? [{ address: '10.0.0.5', family: 4 }] : [{ address: '93.184.215.14', family: 4 }]);
    const c = await fetchUrl(r, 'https://kinder-rebind.test/menu.pdf');
    expect(c.json['error']).toBe('BLOCKED');
    expect(r.net.requests).toEqual([]);
  });
  it('US-E14-04/AC2 IPv4 is preferred over IPv6 when both are public', async () => {
    const r = rig();
    r.net.resolver = () => [
      { address: '2606:4700::1111', family: 6 },
      { address: '93.184.215.14', family: 4 },
    ];
    await fetchUrl(r, 'https://kinder-dual.test/menu.pdf');
    expect(r.net.requests[0]?.address.family).toBe(4);
  });
});

describe('US-E14-04/AC3 every redirect hop is checked again', () => {
  const targets: Array<[string, string]> = [
    ['metadata address', 'https://169.254.169.254/'],
    ['metadata name', 'https://metadata.google.internal/computeMetadata/v1/'],
    ['private v4', 'https://10.0.0.5/x.pdf'],
    ['loopback decimal', 'https://2130706433/x.pdf'],
    ['v4-mapped', 'https://[::ffff:7f00:1]/'],
    ['http', 'http://example-kinder.test/x.pdf'],
    ['non-443 port', 'https://example-kinder.test:8443/x.pdf'],
    ['credentials', 'https://u:p@example-kinder.test/x.pdf'],
    ['protocol-relative private', '//10.0.0.5/x.pdf'],
    ['localhost', 'https://localhost/x.pdf'],
    ['scheme javascript', 'javascript:alert(1)'],
    ['file', 'file:///etc/passwd'],
  ];
  for (const [name, location] of targets) {
    it(`US-E14-04/AC3 redirect to ${name} is not followed`, async () => {
      const r = rig();
      r.net.respond = (_u, _a, n) => (n === 0 ? redirect(location) : okPdf());
      const c = await fetchUrl(r, 'https://example-kinder.test/menu.pdf');
      expect(c.json['error']).toBe('BLOCKED');
      expect(r.net.requests.length).toBe(1);
    });
  }
  it('US-E14-04/AC3 redirect to a name that resolves private is blocked at that hop', async () => {
    const r = rig();
    r.net.resolver = (host) => (host === 'evil-hop.test' ? [{ address: '192.168.1.10', family: 4 }] : [{ address: '93.184.215.14', family: 4 }]);
    r.net.respond = (_u, _a, n) => (n === 0 ? redirect('https://evil-hop.test/x.pdf') : okPdf());
    const c = await fetchUrl(r, 'https://example-kinder.test/menu.pdf');
    expect(c.json['error']).toBe('BLOCKED');
    expect(r.net.requests.length).toBe(1);
  });
  it('US-E14-04/AC3 a relative redirect to a good place is followed (3 hops allowed), the 4th is not', async () => {
    const r = rig();
    r.net.respond = (_u, _a, n) => (n < 3 ? redirect(`/hop${n + 1}`) : okPdf());
    expect((await fetchUrl(r, 'https://example-kinder.test/menu.pdf')).res.status).toBe(200);
    const r2 = rig();
    r2.net.respond = (_u, _a, n) => (n < 4 ? redirect(`/hop${n + 1}`) : okPdf());
    const c = await fetchUrl(r2, 'https://example-kinder.test/menu.pdf');
    expect(c.json['error']).toBe('BLOCKED');
    expect(r2.net.requests.length).toBe(4);
  });
  it('US-E14-04/AC3 an endless redirect loop ends and does not hang', async () => {
    const r = rig();
    r.net.respond = () => redirect('/again');
    const c = await fetchUrl(r, 'https://example-kinder.test/menu.pdf');
    expect(c.json['error']).toBe('BLOCKED');
    expect(r.net.requests.length).toBeLessThanOrEqual(4);
  });
  it('US-E14-04/AC3 a redirect without Location is not followed', async () => {
    const r = rig();
    r.net.respond = () => ({ status: 302, headers: {}, destroy: () => undefined, body: (async function* () {})() });
    expect((await fetchUrl(r, 'https://example-kinder.test/menu.pdf')).json['error']).toBe('BLOCKED');
  });
});

describe('US-E14-04/AC4 only a PDF of at most 10 MiB comes back', () => {
  const MAX = 10_485_760;
  const body = (size: number, chunk = 1_048_576, head = '%PDF-'): { res: PdfResponse; read: () => number } => {
    let read = 0;
    const data = new Uint8Array(size).fill(0x41);
    data.set(new TextEncoder().encode(head).subarray(0, Math.min(head.length, size)));
    return {
      res: {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
        destroy: () => undefined,
        body: (async function* () {
          for (let at = 0; at < size; at += chunk) {
            const piece = data.subarray(at, Math.min(size, at + chunk));
            read += piece.byteLength;
            yield piece;
          }
        })(),
      },
      read: () => read,
    };
  };
  it('US-E14-04/AC4 exactly 10,485,760 bytes is returned', async () => {
    const r = rig();
    r.net.respond = () => body(MAX).res;
    const c = await fetchUrl(r, 'https://example-kinder.test/big.pdf');
    expect(c.res.status).toBe(200);
    expect((c.res.body as Uint8Array).byteLength).toBe(MAX);
  });
  it('US-E14-04/AC4 10,485,761 bytes is TOO_LARGE and the download stops at the limit', async () => {
    const r = rig();
    const b = body(MAX + 1);
    r.net.respond = () => b.res;
    const c = await fetchUrl(r, 'https://example-kinder.test/big.pdf');
    expect(c.json).toEqual({ ok: false, error: 'TOO_LARGE' });
    expect(b.read()).toBeLessThanOrEqual(MAX + 1_048_576);
  });
  it('US-E14-04/AC4 an endless stream is cut at the limit (not read forever)', async () => {
    const r = rig();
    let read = 0;
    r.net.respond = () => ({
      status: 200,
      headers: {},
      destroy: () => undefined,
      body: (async function* () {
        yield new TextEncoder().encode('%PDF-');
        for (;;) {
          read += 1_048_576;
          yield new Uint8Array(1_048_576);
          if (read > 64 * 1_048_576) throw new Error('read far past the limit');
        }
      })(),
    });
    const c = await fetchUrl(r, 'https://example-kinder.test/endless.pdf');
    expect(c.json['error']).toBe('TOO_LARGE');
    expect(read).toBeLessThanOrEqual(12 * 1_048_576);
  });
  it('US-E14-04/AC4 a declared Content-Length over the limit is refused without reading', async () => {
    const r = rig();
    let pulled = false;
    r.net.respond = () => ({
      status: 200,
      headers: { 'content-length': String(MAX + 1) },
      destroy: () => undefined,
      body: (async function* () {
        pulled = true;
        yield pdfBytes();
      })(),
    });
    expect((await fetchUrl(r, 'https://example-kinder.test/big.pdf')).json['error']).toBe('TOO_LARGE');
    expect(pulled).toBe(false);
  });
  for (const [name, bytes, type] of [
    ['an HTML page', '<!doctype html><html>nope</html>', 'text/html'],
    ['HTML with PDF header but text/html type', '%PDF-1.4 <html>', 'text/html'],
    ['JSON', '{"a":1}', 'application/json'],
    ['almost-magic %PDF', '%PDF', 'application/pdf'],
    ['lowercase magic', '%pdf-1.4', 'application/pdf'],
    ['leading space', ' %PDF-1.4', 'application/pdf'],
  ] as const) {
    it(`US-E14-04/AC4 ${name} is refused as not-a-PDF and nothing is passed on`, async () => {
      const r = rig();
      r.net.respond = () => ({ status: 200, headers: { 'content-type': type }, destroy: () => undefined, body: (async function* () { yield new TextEncoder().encode(bytes); })() });
      const c = await fetchUrl(r, 'https://example-kinder.test/x.pdf');
      expect(c.res.status).toBe(422);
      expect(['NOT_A_PDF', 'EMPTY']).toContain(c.json['error']);
      expect(c.text).not.toContain('nope');
    });
  }
  it('US-E14-04/AC4 an empty body is refused', async () => {
    const r = rig();
    r.net.respond = () => ({ status: 200, headers: {}, destroy: () => undefined, body: (async function* () {})() });
    expect((await fetchUrl(r, 'https://example-kinder.test/x.pdf')).res.status).toBe(422);
  });
});

describe('US-E14-04/AC5 time is bounded (fake timers)', () => {
  it('US-E14-04/AC5 a request that never answers ends as NETWORK at 15 s', async () => {
    vi.useFakeTimers();
    const p = fetchPdf('https://example-kinder.test/slow.pdf', {
      resolve: () => Promise.resolve([{ address: '93.184.215.14', family: 4 }]),
      request: () => new Promise(() => undefined),
    });
    await vi.advanceTimersByTimeAsync(14_999);
    let settled = false;
    void p.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await p).toEqual({ ok: false, error: 'NETWORK' });
  });
  it('US-E14-04/AC5 a body that trickles forever ends as NETWORK at 15 s total, whatever the per-chunk pace', async () => {
    vi.useFakeTimers();
    let chunks = 0;
    const p = fetchPdf('https://example-kinder.test/trickle.pdf', {
      resolve: () => Promise.resolve([{ address: '93.184.215.14', family: 4 }]),
      request: () =>
        Promise.resolve({
          status: 200,
          headers: {},
          destroy: () => undefined,
          body: (async function* () {
            yield new TextEncoder().encode('%PDF-');
            for (;;) {
              await new Promise((r) => setTimeout(r, 1000));
              chunks += 1;
              yield new Uint8Array(10);
            }
          })(),
        }),
    });
    await vi.advanceTimersByTimeAsync(15_001);
    expect(await p).toEqual({ ok: false, error: 'NETWORK' });
    expect(chunks).toBeLessThanOrEqual(15);
  });
});

describe('US-E14-04/AC6 nothing of the requester or the target leaks', () => {
  it('US-E14-04/AC6 the outbound call receives only url/address/signal: no caller header, cookie or token can ride along', async () => {
    const r = rig();
    await fetchUrl(r, 'https://example-kinder.test/menu.pdf', 'tok-a', { headers: { cookie: 'session=MARKER_COOKIE', 'x-forwarded-for': '203.0.113.9', origin: 'https://app.example.test' } });
    expect(r.net.requests[0]?.keys).toEqual(['address', 'signal', 'url']);
    expect(r.net.requests[0]?.url).not.toMatch(/MARKER|tok-a/);
  });
  for (const status of [301 + 0, 403, 404, 410, 451, 500, 502, 503]) {
    it(`US-E14-04/AC6/AC7 target status ${status}: reply carries only the outcome code, no status text/headers/body/IP`, async () => {
      const r = rig();
      r.net.respond = () => ({
        status,
        headers: { 'x-secret': 'MARKER_HDR', server: 'MARKER_SERVER', location: status === 301 ? 'https://example-kinder.test/' : '' },
        destroy: () => undefined,
        body: (async function* () {
          yield new TextEncoder().encode('MARKER_BODY');
        })(),
      });
      const c = await fetchUrl(r, 'https://example-kinder.test/menu.pdf');
      expect(c.res.status).toBe(422);
      expect(Object.keys(c.json).sort()).toEqual(['error', 'ok']);
      expect(c.text + JSON.stringify(c.res.headers)).not.toMatch(/MARKER|93\.184|status/i);
    });
  }
  it('US-E14-04/AC6 a requester that throws with internal text and the resolved IP: reply is NETWORK only', async () => {
    const r = rig();
    r.net.respond = () => {
      throw new Error('connect ECONNREFUSED 93.184.215.14:443 MARKER_ERR');
    };
    const c = await fetchUrl(r, 'https://example-kinder.test/menu.pdf');
    expect(c.json).toEqual({ ok: false, error: 'NETWORK' });
    expect(c.text).not.toMatch(/ECONN|93\.184|MARKER/);
  });
  it('US-E14-04/AC7 404 -> NOT_FOUND, 403 -> BLOCKED, timeout -> NETWORK, HTML -> NOT_A_PDF (local codes)', async () => {
    const codes: Record<number, string> = { 404: 'NOT_FOUND', 403: 'BLOCKED' };
    for (const [status, code] of Object.entries(codes)) {
      const r = rig();
      r.net.respond = () => ({ status: Number(status), headers: {}, destroy: () => undefined, body: (async function* () {})() });
      expect((await fetchUrl(r, 'https://example-kinder.test/x.pdf')).json['error']).toBe(code);
    }
  });
});

describe('US-E14-04 a syntactically valid URL counts against the fetch limit even when SSRF-refused; an invalid one does not (documented ADR 015 decision)', () => {
  it('US-E14-04/AC1 an unsafe-but-valid https URL still reaches no network and the store is consulted once', async () => {
    const r = rig();
    await fetchUrl(r, 'https://10.0.0.5/x.pdf');
    expect(effects(r)).toEqual({ ...NO_EFFECTS, store: 1 });
  });
  it('US-E14-04/AC1 an http:// URL is refused before counting', async () => {
    const r = rig();
    await fetchUrl(r, 'http://example-kinder.test/x.pdf');
    expect(effects(r)).toEqual(NO_EFFECTS);
  });
});

describe('US-E14-04 probes beyond the AC table (own list)', () => {
  // RFC 2765 IPv4-translated address ::ffff:0:a.b.c.d embeds an IPv4 address like ::ffff:a.b.c.d does.
  it.fails('E14-D01 (P4) IPv4-translated ::ffff:0:127.0.0.1 and ::ffff:0:169.254.169.254 are refused like IPv4-mapped forms', async () => {
    for (const url of ['https://[::ffff:0:7f00:1]/', 'https://[::ffff:0:a9fe:a9fe]/']) {
      const r = rig();
      const c = await fetchUrl(r, url);
      expect(r.net.requests).toEqual([]);
      expect(c.json['error']).toBe('BLOCKED');
    }
  });
});
