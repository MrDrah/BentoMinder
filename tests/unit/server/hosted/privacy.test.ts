// US-E14-06: nothing private is logged or stored. Every outcome is run with recognisable markers
// in the PDF text, URL, token and e-mail; the captured log must contain none of them.
import { describe, expect, it } from 'vitest';
import { accountKey, filterProviderLog, formatErrorLine, formatLogLine } from '../../../../server/core/hosted-policy.ts';
import { auth, EXTRACT_QUERY, extract, fetchPdfReq, ORIGIN, PDF, rig, send, TOKENS } from './harness.ts';

const M = { pdf: 'MARK-PDF-TEXT', url: 'mark-url-host', token: 'MARK-TOKEN-xyz', email: 'mark-email@example.test', uid: 'mark-uid-123' };
const markerPdf = new TextEncoder().encode(`%PDF-1.7\n${M.pdf} unknown to the fixtures`);

const LINE = /^request endpoint=[\w.-]+ outcome=[\w.-]+ status=\d+ ms=\d+ providerCalls=(\d+|-) model=[\w.-]+ providerStatus=(\d+|-) account=([0-9a-f]{32}|-)$/;

const ERROR_LINE = /^error endpoint=[\w.-]+ class=\w+$/;
const PROVIDER =/^provider [\w.-]+ attempt: (http \d{3}|[a-z]+|malformed \(\d+ issues\))( in \d+ms)?$/;

async function runEveryOutcome(r: ReturnType<typeof rig>) {
  TOKENS[M.token] = { uid: M.uid, email: M.email, emailVerified: true };
  TOKENS['tok-mark-denied'] = { uid: `${M.uid}-denied`, email: `denied-${M.email}`, emailVerified: true };
  const q = EXTRACT_QUERY;
  const url = `https://${M.url}.example/${M.pdf}.pdf`;
  r.deps.policy!.allowList = { uids: new Set([M.uid]), emails: new Set() };
  await send(r, '/api/menu/extract', { query: q, body: markerPdf }); // no token
  await send(r, '/api/menu/extract', { query: q, body: markerPdf, headers: { authorization: `Bearer ${M.token}-forged` } });
  await send(r, '/api/menu/extract', { query: q, body: markerPdf, headers: auth('tok-mark-denied') });
  await send(r, '/api/menu/extract', { query: q, body: markerPdf, headers: auth(M.token, { origin: 'https://evil.example' }) });
  await send(r, '/api/menu/extract', { query: `${q}&nick=${M.pdf}`, body: markerPdf, headers: auth(M.token) });
  await send(r, '/api/menu/extract', { query: q, body: markerPdf, headers: auth(M.token) }); // provider fails (unknown pdf)
  await send(r, '/api/menu/extract', { query: q, body: new TextEncoder().encode(M.pdf), headers: auth(M.token) }); // not a pdf
  await send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url }), headers: auth(M.token) });
  await send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url: `http://${M.url}.example/` }), headers: auth(M.token) });
  await send(r, '/api/menu/fetch-pdf', { body: M.pdf, headers: auth(M.token) });
  await send(r, '/api/menu/extract', { method: 'OPTIONS', headers: { origin: ORIGIN } });
  await send(r, '/api/health', { method: 'GET' });
  r.store.failing = true;
  await send(r, '/api/menu/extract', { query: q, body: markerPdf, headers: auth(M.token) });
  r.store.failing = false;
  // unexpected exceptions with a marker in the message
  r.deps.request = () => Promise.reject(new Error(`boom ${M.url} ${M.pdf}`));
  r.deps.resolve = () => Promise.reject(new Error(`resolver ${M.url}`));
  await send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url }), headers: auth(M.token) });
  r.deps.fixtures = { known: new Map(), forRequest: () => { throw new Error(`fixtures ${M.pdf}`); } };
  r.deps.provider = { call: () => Promise.reject(new Error(`provider said ${M.pdf} ${M.email}`)) };
  await send(r, '/api/menu/extract', { query: q, body: markerPdf, headers: auth(M.token) });
  r.deps.cache = { get: () => { throw new RangeError(`cache ${M.pdf} ${M.email}`); }, set: () => undefined };
  await send(r, '/api/menu/extract', { query: q, body: markerPdf, headers: auth(M.token) });
  r.deps.policy!.verifier = () => Promise.reject(new Error(`verifier ${M.token}`));
  await send(r, '/api/menu/extract', { query: q, body: markerPdf, headers: auth(M.token) });
}

describe('US-E14-06 logging and storage', () => {
  it('US-E14-06/AC4 the captured logs of every outcome contain none of the markers', async () => {
    const r = rig();
    await runEveryOutcome(r);
    expect(r.logs.length).toBeGreaterThan(10);
    const all = r.logs.join('\n');
    for (const marker of [M.pdf, M.url, M.token, M.email, M.uid, 'Bearer', 'example.test', 'evil.example', '127.0.0.1']) expect(all).not.toContain(marker);
  });

  it('US-E14-06/AC1 every log line has only the allowed fields; the account is the pseudonymous key', async () => {
    const r = rig();
    await runEveryOutcome(r);
    for (const line of r.logs) {
      const re = line.startsWith('provider ') ? PROVIDER : line.startsWith('error ') ? ERROR_LINE : LINE;
      expect(re.test(line), line).toBe(true);
    }
    expect(r.logs.some((l) => l.includes(`account=${accountKey(M.uid)}`))).toBe(true);
  });

  it('US-E14-06/AC1 a successful extraction logs endpoint, outcome, status, duration, provider calls and model only', async () => {
    const r = rig();
    await extract(r);
    const line = r.logs.find((l) => l.includes('endpoint=extract'))!;
    expect(line).toMatch(/outcome=OK status=200 ms=0 providerCalls=1 model=model-primary providerStatus=- account=[0-9a-f]{32}$/);
  });

  it('US-E14-06/AC2 exceptions are logged as outcome code and error class only', async () => {
    const r = rig();
    r.deps.cache = { get: () => { throw new RangeError(`secret ${M.pdf}`); }, set: () => undefined };
    const c = await extract(r);
    expect(c.res.status).toBe(500);
    expect(c.json()).toEqual({ ok: false, error: 'INTERNAL' });
    expect(r.logs.join('\n')).toContain('error endpoint=extract class=RangeError');
    expect(r.logs.join('\n')).not.toContain(M.pdf);
    expect(formatErrorLine('extract', 'a string with MARKER')).toBe('error endpoint=extract class=string');
  });

  it('US-E14-06/AC1 unsafe values are replaced, never echoed', () => {
    const line = formatLogLine({ endpoint: 'extract', outcome: 'https://x.test/a b', status: 200, durationMs: 1, model: 'a@b.test', account: 'user@example.test' });
    expect(line).toBe('request endpoint=extract outcome=- status=200 ms=1 providerCalls=- model=- providerStatus=- account=-');
  });

  it('US-E14-06/AC2 the extraction budget log is filtered to its own fixed-shape lines', () => {
    const seen: string[] = [];
    const f = filterProviderLog((m) => void seen.push(m));
    f('provider model-primary attempt: http 429 in 12ms');
    f('provider model-primary attempt: timeout in 45000ms');
    f('provider model-primary attempt: malformed (3 issues)');
    f('provider model-primary attempt: ok in 5ms');
    f(`provider x attempt: leaked ${M.pdf}`);
    f(`usage model in=1 out=2 ${M.email}`);
    expect(seen).toHaveLength(4);
  });

  it('US-E14-06/AC3 nothing is persisted: no cache entry, only limit counters', async () => {
    const r = rig();
    await extract(r);
    await fetchPdfReq(r);
    const { sha256Hex } = await import('../../../../server/menu/extract.ts');
    expect(r.deps.cache.get(sha256Hex(PDF))).toBeUndefined();
    r.deps.cache.set('k', { text: 'x', model: 'm' });
    expect(r.deps.cache.get('k')).toBeUndefined();
    expect([...r.store.data.values()].every((v) => Object.keys(v).every((k) => k === 'extract' || k === 'fetch'))).toBe(true);
    const second = await extract(r);
    expect((second.json() as { meta: { cached: boolean } }).meta.cached).toBe(false); // nothing reused on the server
  });

  it('US-E14-06/AC5 the provider request holds only the allow-listed fields, no uid, e-mail or token', async () => {
    const r = rig();
    await extract(r);
    const req = r.providerCalls[0]!;
    expect(Object.keys(req).sort()).toEqual(['model', 'pdf', 'promptVersion', 'schemaVersion', 'targetMonth']);
    expect(JSON.stringify({ ...req, pdf: undefined })).not.toMatch(/test-uid|example\.test|tok-/);
  });

  it('US-E14-06/AC1 replies never carry a stack trace, a provider message or the allow-list', async () => {
    const r = rig();
    r.deps.provider = { call: () => Promise.reject(new Error(`provider said ${M.pdf}`)) };
    const bodies = [(await extract(r)).res.body, (await extract(r, 'tok-stranger')).res.body, (await extract(r, 'tok-forged')).res.body];
    for (const b of bodies) {
      expect(String(b)).not.toMatch(/at |stack|test-uid|example\.test|MARK/);
    }
  });
});
