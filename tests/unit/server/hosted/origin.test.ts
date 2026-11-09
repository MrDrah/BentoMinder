// US-E14-05: browser origins; honest "not configured". The Gemini key itself (AC4) and the web build (AC6) are slice B/C.
import { describe, expect, it } from 'vitest';
import { corsHeaders } from '../../../../server/core/hosted-policy.ts';
import { auth, EXTRACT_QUERY, extract, fetchPdfReq, ORIGIN, PDF, rig, send } from './harness.ts';

describe('US-E14-05 origins', () => {
  it('US-E14-05/AC1 an allowed origin gets exactly that origin, POST and OPTIONS, Authorization and Content-Type, no credentials', async () => {
    const r = rig({ origins: [ORIGIN, 'http://localhost:5173'] });
    for (const origin of [ORIGIN, 'http://localhost:5173']) {
      const pre = await send(r, '/api/menu/extract', { method: 'OPTIONS', headers: { origin } });
      const real = await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF, headers: auth('tok-alice', { origin }) });
      const denied = await extract(r, 'tok-forged', { headers: { origin } });
      for (const c of [pre, real, denied]) {
        expect(c.res.headers['access-control-allow-origin']).toBe(origin);
        expect(c.res.headers['access-control-allow-methods']).toBe('POST, OPTIONS');
        expect(c.res.headers['access-control-allow-headers']).toBe('Authorization, Content-Type');
        expect(c.res.headers['access-control-allow-credentials']).toBeUndefined();
        expect(c.res.headers['vary']).toBe('Origin');
      }
      expect(real.res.status).toBe(200);
      expect(denied.res.status).toBe(401); // CORS headers also on refusals, so the browser can read them
    }
  });

  it('US-E14-05/AC1 never "*": corsHeaders echoes only the origin it is given', () => {
    expect(JSON.stringify(corsHeaders(ORIGIN))).not.toContain('"*"');
  });

  it.each([
    'https://evil.example',
    'http://app.example.test', // scheme
    'https://app.example.test:8443', // port
    'https://app.example.test/', // trailing slash
    'https://app.example.test/path', // trailing text
    'https://app.example.test.evil.example',
    'https://APP.example.test', // not the configured spelling
    'null',
    '',
    '*',
  ])('US-E14-05/AC2 Origin %j is refused: 403 ORIGIN_NOT_ALLOWED, no ACAO, no work', async (origin) => {
    const r = rig();
    for (const call of [
      () => extract(r, 'tok-alice', { headers: { origin } }),
      () => send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url: 'https://example-kinder.test/m.pdf' }), headers: auth('tok-alice', { origin }) }),
      () => send(r, '/api/menu/extract', { method: 'OPTIONS', headers: { origin } }),
      () => send(r, '/api/health', { method: 'GET', headers: { origin } }),
    ]) {
      const c = await call();
      expect(c.res.status).toBe(403);
      expect(c.json()).toEqual({ ok: false, error: 'ORIGIN_NOT_ALLOWED' });
      expect(Object.keys(c.res.headers).filter((h) => h.startsWith('access-control'))).toEqual([]);
    }
    expect(r.providerCalls).toHaveLength(0);
    expect(r.fetches).toHaveLength(0);
    expect(r.verifierCalls).toHaveLength(0);
    expect(r.store.calls).toBe(0);
  });

  it('US-E14-05/AC3 a request with no Origin is neither accepted nor refused for that: the token decides', async () => {
    const r = rig();
    expect((await extract(r)).res.status).toBe(200);
    expect((await send(r, '/api/menu/extract', { query: EXTRACT_QUERY, body: PDF })).res.status).toBe(401);
    expect((await extract(r, 'tok-stranger')).res.status).toBe(403);
    expect((await extract(r)).res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('US-E14-05/AC1 with an empty origin list every browser origin is refused', async () => {
    const r = rig({ origins: [] });
    expect((await extract(r, 'tok-alice', { headers: { origin: ORIGIN } })).res.status).toBe(403);
  });

  it('US-E14-05/AC5 no provider configured: extract answers NOT_CONFIGURED with 0 provider calls, fetch still works', async () => {
    const r = rig({ provider: false });
    const c = await extract(r);
    expect(c.json()).toEqual({ ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 });
    expect(r.providerCalls).toHaveLength(0);
    expect((await fetchPdfReq(r)).res.status).toBe(200);
  });

  it('US-E14-05/AC5 the hosted proxy never replays recorded fixtures or honours the scenario header', async () => {
    const r = rig({ provider: false });
    r.deps.allowScenarios = true; // even if mis-set, hosted mode ignores fixtures
    const c = await extract(r, 'tok-alice', { headers: { 'x-bm-mock-scenario': 'fixture-menu-2026-11/hand-1' } });
    expect(c.json()).toMatchObject({ ok: false, error: 'NOT_CONFIGURED' });
  });
});
