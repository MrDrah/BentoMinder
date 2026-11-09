// US-E14-01: every hosted request carries a valid sign-in token. Fixtures and fakes only.
import { describe, expect, it } from 'vitest';
import { accountKey, parseBearer } from '../../../../server/core/hosted-policy.ts';
import { auth, EXTRACT_QUERY, extract, fetchPdfReq, ORIGIN, PDF, rig, send } from './harness.ts';

const ENDPOINTS = [
  ['extract', (r: ReturnType<typeof rig>, headers: Record<string, string>) => send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF, headers })],
  ['fetch-pdf', (r: ReturnType<typeof rig>, headers: Record<string, string>) => send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url: 'https://example-kinder.test/m.pdf' }), headers })],
] as const;

describe('US-E14-01 token gate', () => {
  it.each(ENDPOINTS)('US-E14-01/AC1 %s with no Authorization header: 401, no body read, no provider call, no outbound fetch', async (_n, call) => {
    const r = rig();
    const c = await call(r, {});
    expect(c.res.status).toBe(401);
    expect(c.json()).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(c.bodyReads).toBe(0);
    expect(r.providerCalls).toHaveLength(0);
    expect(r.fetches).toHaveLength(0);
    expect(r.verifierCalls).toHaveLength(0);
  });

  const headers: [string, string, boolean][] = [
    ['"Bearer " followed by nothing', 'Bearer ', false],
    ['"Bearer" alone', 'Bearer', false],
    ['Basic scheme', 'Basic abc', false],
    ['two tokens', 'Bearer a b', false],
    ['not a well-formed ID token', 'Bearer not-a-jwt', true],
    ['bad signature', 'Bearer eyJ.bad.signature', true],
    ['expired token', 'Bearer expired-token', true],
    ['token for a different Firebase project', 'Bearer other-project-token', true],
  ];
  for (const [label, header, reachesVerifier] of headers) {
    it.each(ENDPOINTS)(`US-E14-01/AC2 %s with ${label}: 401 UNAUTHENTICATED, 0 provider calls, 0 fetches`, async (_n, call) => {
      const r = rig();
      const c = await call(r, { authorization: header });
      expect(c.res.status).toBe(401);
      expect(c.json()).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
      expect(r.providerCalls).toHaveLength(0);
      expect(r.fetches).toHaveLength(0);
      expect(r.verifierCalls.length).toBe(reachesVerifier ? 1 : 0); // malformed headers cost no verifier call
    });
  }

  it('US-E14-01/AC2 a verifier that throws never lets the request through', async () => {
    const r = rig();
    r.deps.policy!.verifier = () => Promise.reject(new Error('certs unreachable'));
    const c = await extract(r);
    expect(c.res.status).toBe(401);
    expect(r.providerCalls).toHaveLength(0);
  });

  it('US-E14-01/AC2 a verified account without a uid is refused', async () => {
    const r = rig();
    r.deps.policy!.verifier = () => Promise.resolve({ uid: '', emailVerified: true });
    expect((await extract(r)).res.status).toBe(401);
  });

  it('US-E14-01/AC2 parseBearer accepts only "Bearer <token>"', () => {
    expect(parseBearer('Bearer abc.def')).toBe('abc.def');
    expect(parseBearer('bearer abc')).toBe('abc');
    for (const bad of [undefined, '', 'Bearer', 'Bearer ', 'Basic abc', 'abc', 'Bearer a b', `Bearer ${'x'.repeat(9000)}`]) expect(parseBearer(bad)).toBeNull();
  });

  it('US-E14-01/AC3 a valid token of an allowed account is processed exactly as the local proxy would', async () => {
    const hosted = await extract(rig());
    const local = await send(rig({ policy: false }), '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF });
    expect(hosted.res.status).toBe(200);
    expect(hosted.json()).toEqual(local.json());
    expect(hosted.json()['ok']).toBe(true);
    const hf = await fetchPdfReq(rig());
    const lf = await send(rig({ policy: false }), '/api/menu/fetch-pdf', { body: JSON.stringify({ url: 'https://example-kinder.test/menu.pdf' }) });
    expect(hf.res.status).toBe(200);
    expect(hf.res.headers['x-bm-sha256']).toBe(lf.res.headers['x-bm-sha256']);
    expect(Buffer.from(hf.res.body as Uint8Array).equals(Buffer.from(PDF))).toBe(true);
  });

  it('US-E14-01/AC3 the local proxy needs no token and checks no origin', async () => {
    const r = rig({ policy: false });
    expect((await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF, headers: { origin: 'https://evil.example' } })).res.status).toBe(200);
    expect(r.logs.filter((l) => l.startsWith('request '))).toEqual([]); // no hosted request line locally
  });

  it('US-E14-01/AC4 the account is the token uid; client-sent uid, email and account values are ignored', async () => {
    const r = rig();
    const c = await send(r, '/api/menu/fetch-pdf', {
      query: 'uid=test-uid-002&email=second@example.test&account=test-uid-002',
      body: JSON.stringify({ url: 'https://example-kinder.test/m.pdf', uid: 'test-uid-002' }),
      headers: auth('tok-alice', { uid: 'test-uid-002', email: 'second@example.test', account: 'test-uid-002', 'x-uid': 'test-uid-002' }),
    });
    expect(c.res.status).toBe(200);
    expect([...r.store.data.keys()]).toEqual([accountKey('test-uid-001')]);
  });

  it('US-E14-01/AC4 extract still rejects unknown query parameters, after the token check', async () => {
    const r = rig();
    const c = await send(r, '/api/menu/extract', { query: `${EXTRACT_QUERY}&uid=test-uid-002`, body: PDF, headers: auth('tok-alice') });
    expect(c.res.status).toBe(400);
    expect(c.json()).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(r.store.calls).toBe(0);
    expect(r.providerCalls).toHaveLength(0);
  });

  it('US-E14-01/AC5 a preflight needs no token and does not count toward a limit', async () => {
    const r = rig();
    for (const path of ['/api/menu/extract', '/api/menu/fetch-pdf', '/api/health']) {
      const c = await send(r, path, { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST' } });
      expect(c.res.status).toBe(204);
      expect(c.res.headers['access-control-allow-origin']).toBe(ORIGIN);
    }
    expect(r.verifierCalls).toHaveLength(0);
    expect(r.store.calls).toBe(0);
    expect(r.providerCalls).toHaveLength(0);
  });

  it('US-E14-01/AC6 GET /api/health answers without a token with only { ok, version }', async () => {
    const r = rig();
    const c = await send(r, '/api/health', { method: 'GET' });
    expect(c.res.status).toBe(200);
    expect(c.json()).toEqual({ ok: true, version: '9.9.9' });
    expect(r.verifierCalls).toHaveLength(0);
    expect(r.store.calls).toBe(0);
  });

  it('US-E14-01/AC7 a request refused for its token costs nothing: no counter, no stored body', async () => {
    const r = rig();
    await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF });
    await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF, headers: { authorization: 'Bearer nope' } });
    expect(r.store.calls).toBe(0);
    expect(r.store.data.size).toBe(0);
    expect(r.deps.cache.get('anything')).toBeUndefined();
  });

  it('US-E14-01/AC3 unknown paths and wrong methods answer 404 / 405 as locally', async () => {
    const r = rig();
    expect((await send(r, '/api/nothing')).res.status).toBe(404);
    expect((await send(r, '/api/menu/extract', { method: 'GET' })).res.status).toBe(405);
    expect((await send(r, '/api/health', { method: 'POST' })).res.status).toBe(405);
  });
});
