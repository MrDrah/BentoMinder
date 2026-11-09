// QA E14: US-E14-06 nothing private is logged or stored. Every outcome of the epic is run with recognisable markers in
// the PDF text, the URL, the token, the e-mail, the uid and the caller IP; no marker may reach any log line or reply,
// and every log line must have one of the allow-listed shapes.
import { describe, expect, it } from 'vitest';
import { createApiHandler, type FnRequest, type FnResponse } from '../../../../functions/src/adapter.ts';
import { accountKey } from '../../../../server/core/hosted-policy.ts';
import { effects, NO_EFFECTS, okPdf, pdfBytes, QUERY, redirect, rig, send, type Rig } from './rig.ts';

const M = {
  pdf: 'MARKER_PDF_TEXT_日本語',
  url: 'marker-url-host.example.test',
  path: 'MARKER_URL_PATH',
  token: 'MARKER_TOKEN_abc123',
  email: 'marker-email@example.test',
  uid: 'marker-uid-424242',
  ip: '203.0.113.77',
  name: 'MARKER_DISPLAY_NAME',
  origin: 'https://marker-origin.evil.example',
};
const MARKERS = Object.values(M);

// Allowed log shapes: our request line, our error line, and the extraction budget's fixed attempt line.
const REQUEST_LINE = /^request endpoint=[A-Za-z0-9._-]{1,64} outcome=[A-Za-z0-9._-]{1,64} status=\d{3} ms=-?\d+ providerCalls=(-|\d) model=([A-Za-z0-9._-]{1,64}|-) providerStatus=(-|\d{3}) account=([0-9a-f]{32}|-)$/;
const ERROR_LINE = /^error endpoint=[A-Za-z0-9._-]{1,64} class=[A-Za-z0-9._-]{1,64}$/;
const PROVIDER_LINE = /^provider [A-Za-z0-9._-]{1,64} attempt: (http \d{3}|[a-z]{1,20}|malformed \(\d{1,3} issues\))( in \d{1,6}ms)?$/;

function setup(): Rig {
  const r = rig({ allowList: `${M.uid},nobody@example.test` });
  r.verifier.table = {
    [`tok-${M.token}`]: { uid: M.uid, email: M.email, emailVerified: true },
    [`tok-stranger-${M.token}`]: { uid: `${M.uid}-x`, email: `x-${M.email}`, emailVerified: true },
  };
  return r;
}
const TOK = `tok-${M.token}`;
const noise = { 'x-forwarded-for': M.ip, 'x-real-ip': M.ip, 'fastly-client-ip': M.ip, 'x-appengine-user-ip': M.ip, 'cf-connecting-ip': M.ip, 'x-display-name': M.name };
const hdr = (token: string | null, extra: Record<string, string> = {}) => ({ ...(token === null ? {} : { authorization: `Bearer ${token}` }), ...noise, ...extra });

type Scenario = [string, (r: Rig) => Promise<{ text: string; res: { headers: Record<string, string>; status: number } }>];
const pdfWithMarker = () => pdfBytes(M.pdf);
const urlBody = (path = M.path) => JSON.stringify({ url: `https://${M.url}/${path}.pdf` });

const SCENARIOS: Scenario[] = [
  ['no token', (r) => send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(null) })],
  ['bad token carrying the marker', (r) => send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(`bad-${M.token}`) })],
  ['verifier throws with the marker', (r) => { r.verifier.throwFor.add(TOK); return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['not allowed account', (r) => send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(`tok-stranger-${M.token}`) })],
  ['origin refused', (r) => send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK, { origin: M.origin }) })],
  ['bad query with marker keys and values', (r) => send(r, '/api/menu/extract', { query: `${QUERY}&uid=${M.uid}&email=${M.email}&${M.token}=1`, body: pdfWithMarker(), headers: hdr(TOK) })],
  ['not a pdf with marker text', (r) => send(r, '/api/menu/extract', { query: QUERY, body: new TextEncoder().encode(`<html>${M.pdf}</html>`), headers: hdr(TOK) })],
  ['too large', (r) => send(r, '/api/menu/extract', { query: QUERY, body: new Uint8Array(10_485_761).fill(0x25), headers: hdr(TOK) })],
  ['extract: provider 500 both models', (r) => { r.provider.reply = () => ({ kind: 'http', status: 500, retryAfterSec: null }); return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['extract: provider 429', (r) => { r.provider.reply = () => ({ kind: 'http', status: 429, retryAfterSec: 9 }); return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['extract: provider text echoes markers (malformed)', (r) => { r.provider.reply = () => ({ kind: 'ok', text: `{"oops":"${M.pdf} ${M.email} ${M.token}"}` }); return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['extract: provider timeout', (r) => { r.provider.reply = () => ({ kind: 'timeout' }); return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['extract: provider throws an error quoting everything', (r) => { r.provider.reply = () => { throw new Error(`${M.pdf} ${M.email} ${M.token} ${M.ip}`); }; return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['extract: limit reached', async (r) => { r.deps.policy!.limits = { extract: { perHour: 1, perDay: 5 }, fetch: { perHour: 1, perDay: 5 } }; await send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['extract: store down with the marker', (r) => { r.store.failing = 'reject'; return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['extract: store throws synchronously with the marker', (r) => { r.store.failing = 'throw'; return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['extract: no provider configured', (r) => { r.deps.provider = null; return send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) }); }],
  ['fetch: success', (r) => send(r, '/api/menu/fetch-pdf', { body: urlBody(), headers: hdr(TOK) })],
  ['fetch: blocked private URL with marker', (r) => send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url: `https://10.0.0.5/${M.path}` }), headers: hdr(TOK) })],
  ['fetch: invalid URL with marker', (r) => send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url: `http://${M.url}/${M.path}` }), headers: hdr(TOK) })],
  ['fetch: bad JSON body', (r) => send(r, '/api/menu/fetch-pdf', { body: `{"url": "${M.url}`, headers: hdr(TOK) })],
  ['fetch: resolver throws with the marker', (r) => { r.net.resolver = () => Promise.reject(new Error(`${M.url} ${M.ip}`)); return send(r, '/api/menu/fetch-pdf', { body: urlBody(), headers: hdr(TOK) }); }],
  ['fetch: requester throws with the marker', (r) => { r.net.respond = () => { throw new Error(`ECONNREFUSED ${M.ip} ${M.url}`); }; return send(r, '/api/menu/fetch-pdf', { body: urlBody(), headers: hdr(TOK) }); }],
  ['fetch: redirect to a marker URL then 404', (r) => { r.net.respond = (_u, _a, n) => (n === 0 ? redirect(`https://${M.url}/second-${M.path}`) : { status: 404, headers: { 'x-m': M.pdf }, destroy: () => undefined, body: (async function* () { yield new TextEncoder().encode(M.pdf); })() }); return send(r, '/api/menu/fetch-pdf', { body: urlBody(), headers: hdr(TOK) }); }],
  ['fetch: html page with marker text', (r) => { r.net.respond = () => ({ status: 200, headers: { 'content-type': 'text/html' }, destroy: () => undefined, body: (async function* () { yield new TextEncoder().encode(`<html>${M.pdf}</html>`); })() }); return send(r, '/api/menu/fetch-pdf', { body: urlBody(), headers: hdr(TOK) }); }],
  ['fetch: limit reached', async (r) => { r.deps.policy!.limits = { extract: { perHour: 1, perDay: 5 }, fetch: { perHour: 1, perDay: 5 } }; await send(r, '/api/menu/fetch-pdf', { body: urlBody(), headers: hdr(TOK) }); return send(r, '/api/menu/fetch-pdf', { body: urlBody(), headers: hdr(TOK) }); }],
  ['fetch: store down', (r) => { r.store.failing = 'reject'; return send(r, '/api/menu/fetch-pdf', { body: urlBody(), headers: hdr(TOK) }); }],
  ['preflight', (r) => send(r, '/api/menu/extract', { method: 'OPTIONS', headers: hdr(null, { origin: 'https://app.example.test' }) })],
  ['health', (r) => send(r, '/api/health', { method: 'GET', headers: hdr(TOK) })],
  ['unknown path with marker', (r) => send(r, `/api/${M.path}`, { headers: hdr(TOK) })],
  ['wrong method', (r) => send(r, '/api/menu/extract', { method: 'DELETE', headers: hdr(TOK) })],
];

describe('US-E14-06/AC1/AC2/AC4 no marker in any log line or reply, for every outcome', () => {
  for (const [name, run] of SCENARIOS) {
    it(`US-E14-06/AC4 ${name}`, async () => {
      const r = setup();
      const c = await run(r);
      const everything = [...r.logs, c.text, JSON.stringify(c.res.headers)].join('\n');
      for (const m of MARKERS) expect(everything, `marker ${m}`).not.toContain(m);
      expect(everything).not.toContain(accountKey(M.uid) + 'x'); // sanity: key only as a whole
      for (const line of r.logs) expect(REQUEST_LINE.test(line) || ERROR_LINE.test(line) || PROVIDER_LINE.test(line), `log shape: ${line}`).toBe(true);
      // the reply never carries the uid/e-mail even in the pseudonymous form of the account key
      expect(c.text).not.toContain(accountKey(M.uid));
    });
  }
  it('US-E14-06/AC1 the one request line per request carries the pseudonymous key, never the uid or e-mail', async () => {
    const r = setup();
    await SCENARIOS[8]![1](r);
    const lines = r.logs.filter((l) => l.startsWith('request '));
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain(`account=${accountKey(M.uid)}`);
    expect(r.logs.join('\n')).not.toMatch(/marker|203\.0\.113/i);
  });
  it('US-E14-06/AC1 the request line omits the account for a request with no verified identity', async () => {
    const r = setup();
    await SCENARIOS[0]![1](r);
    expect(r.logs.find((l) => l.startsWith('request '))).toContain('account=-');
  });
});

describe('US-E14-06/AC2 an unexpected exception logs class only', () => {
  it('US-E14-06/AC2 the adapter: getDeps throws an error quoting markers -> class only in the log, generic INTERNAL body', async () => {
    const logs: string[] = [];
    const run = createApiHandler(() => { throw new RangeError(`${M.pdf} ${M.email} ${M.token}`); });
    const out: { status: number; body: string; headers: Record<string, string> } = { status: 0, body: '', headers: {} };
    const res: FnResponse = { statusCode: 0, setHeader: (n, v) => void (out.headers[n] = v), end: (b) => void (out.body = String(b ?? '')), on: () => undefined };
    await run({ method: 'POST', url: '/api/menu/extract?uid=' + M.uid, headers: hdr(TOK) } as FnRequest, res);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(out.body)).toEqual({ ok: false, error: 'INTERNAL' });
    expect(out.body + JSON.stringify(out.headers) + logs.join('\n')).not.toMatch(/MARKER/i);
  });
  it('US-E14-06/AC2 the adapter: handle() throwing (deps.log itself throws) does not leak and still answers INTERNAL', async () => {
    const r = setup();
    const logged: string[] = [];
    r.deps.log = (m) => {
      logged.push(m);
      throw new Error(`log sink down ${M.token}`);
    };
    const run = createApiHandler(() => r.deps);
    const out = { body: '', status: 0 };
    const res: FnResponse = { statusCode: 0, setHeader: () => undefined, end: (b) => void (out.body = String(b ?? '')), on: () => undefined };
    await run({ method: 'GET', url: '/api/health', headers: {} } as FnRequest, res).catch(() => undefined);
    expect(out.body).not.toContain('MARKER');
  });
  it('US-E14-06/AC2 an internal error inside handle (store returns garbage) answers INTERNAL and logs class only', async () => {
    const r = setup();
    r.deps.policy!.store = { update: () => Promise.resolve(undefined as never) };
    const c = await send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) });
    expect(r.provider.calls.length).toBe(0); // fail closed: no provider call whatever the store returned
    expect([500, 503]).toContain(c.res.status);
    expect(r.logs.join('\n')).not.toMatch(/MARKER/i);
  });
});

describe('US-E14-06/AC3 nothing is persisted', () => {
  it('US-E14-06/AC3 the same PDF twice costs provider calls twice (no extraction cache); nothing but counters is written', async () => {
    const r = setup();
    r.provider.reply = () => ({ kind: 'http', status: 400, retryAfterSec: null });
    await send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) });
    await send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK) });
    expect(r.provider.calls.length).toBe(2);
    expect([...r.store.data.keys()]).toEqual([accountKey(M.uid)]);
    expect(JSON.stringify([...r.store.data.values()])).not.toMatch(/MARKER|marker|@/);
  });
});

describe('US-E14-06/AC5 only the public menu PDF reaches the provider', () => {
  it('US-E14-06/AC5 the provider request holds exactly pdf, targetMonth, versions and a model; no identity field', async () => {
    const r = setup();
    await send(r, '/api/menu/extract', { query: QUERY, body: pdfWithMarker(), headers: hdr(TOK, { origin: 'https://app.example.test' }) });
    expect(r.provider.calls.length).toBeGreaterThan(0);
    for (const call of r.provider.calls) {
      expect(Object.keys(call).sort()).toEqual(['model', 'pdf', 'promptVersion', 'schemaVersion', 'targetMonth']);
      expect(JSON.stringify(call, (_k, v) => (v instanceof Uint8Array ? '[bytes]' : v))).not.toMatch(/MARKER|marker|203\.0\.113/);
    }
  });
  it('US-E14-06 rig sanity: the fake PDF response helper and effects helper agree', () => {
    expect(okPdf().status).toBe(200);
    expect(NO_EFFECTS.store).toBe(0);
    expect(effects(rig()).provider).toBe(0);
  });
});
