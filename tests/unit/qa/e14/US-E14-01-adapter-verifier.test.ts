// QA E14: the edge pieces without a Google SDK: the token verifier port (US-E14-01/AC2) and the request adapter
// (body, headers, abort, CORS pass-through). Fakes only.
import { describe, expect, it } from 'vitest';
import { createAdminVerifier, type AuthLike, type DecodedLike } from '../../../../functions/src/admin-verifier.ts';
import { createApiHandler, toCoreRequest, type FnRequest, type FnResponse } from '../../../../functions/src/adapter.ts';
import { rig, ORIGIN, QUERY, pdfBytes } from './rig.ts';

const auth = (decoded: DecodedLike | Error, calls: Array<[string, boolean | undefined]> = []): AuthLike => ({
  verifyIdToken: (t, c) => {
    calls.push([t, c]);
    return decoded instanceof Error ? Promise.reject(decoded) : Promise.resolve(decoded);
  },
});

describe('US-E14-01/AC2 admin verifier port', () => {
  it('US-E14-01/AC2 accepts a decoded token of our project and maps uid/email/email_verified; revocation not checked', async () => {
    const calls: Array<[string, boolean | undefined]> = [];
    const v = createAdminVerifier(auth({ uid: 'u1', email: 'a@example.test', email_verified: true, aud: 'proj' }, calls), 'proj');
    expect(await v('tok')).toEqual({ uid: 'u1', email: 'a@example.test', emailVerified: true });
    expect(calls).toEqual([['tok', false]]);
  });
  it('US-E14-01/AC2 token issued for a different project (aud mismatch) is refused even if the SDK accepted it', async () => {
    expect(await createAdminVerifier(auth({ uid: 'u1', aud: 'other-proj' }), 'proj')('t')).toBeNull();
    expect(await createAdminVerifier(auth({ uid: 'u1' }), 'proj')('t')).toBeNull();
    expect(await createAdminVerifier(auth({ uid: 'u1', aud: ['proj'] }), 'proj')('t')).toBeNull();
  });
  it('US-E14-01/AC2 SDK rejection (bad signature, expired, malformed) gives null, never a throw or detail', async () => {
    for (const e of [new Error('Firebase ID token has expired MARKER'), new TypeError('bad'), 'string error']) {
      expect(await createAdminVerifier(auth(e as Error), 'proj')('t')).toBeNull();
    }
  });
  it('US-E14-01/AC2 missing/empty project id or auth handle fails closed', async () => {
    expect(await createAdminVerifier(auth({ uid: 'u1', aud: 'proj' }), undefined)('t')).toBeNull();
    expect(await createAdminVerifier(auth({ uid: 'u1', aud: '' }), '')('t')).toBeNull();
    expect(await createAdminVerifier(null, 'proj')('t')).toBeNull();
  });
  it('US-E14-01/AC2 a decoded token without a usable uid is refused; email_verified must be boolean true', async () => {
    for (const uid of [undefined, '', 5, null]) expect(await createAdminVerifier(auth({ uid, aud: 'proj' }), 'proj')('t')).toBeNull();
    for (const ev of ['true', 1, undefined, null]) expect((await createAdminVerifier(auth({ uid: 'u', email: 'a@b.test', email_verified: ev, aud: 'proj' }), 'proj')('t'))?.emailVerified).toBe(false);
  });
});

function fakeRes() {
  const out = { status: 0, headers: {} as Record<string, string>, body: '' as string | Uint8Array, ended: false, closeListener: null as null | (() => void) };
  const res: FnResponse = {
    statusCode: 0,
    writableEnded: false,
    setHeader: (n, v) => void (out.headers[n] = v),
    end: (b) => {
      out.body = b ?? '';
      out.ended = true;
      (res as { writableEnded: boolean }).writableEnded = true;
    },
    on: (_e, l) => void (out.closeListener = l),
  };
  return { out, res };
}

describe('US-E14-01 request adapter', () => {
  it('US-E14-01/AC3 rawBody is used as the body; a body over the 10 MiB limit is TooLarge', async () => {
    const req = toCoreRequest({ method: 'POST', url: '/api/menu/extract', headers: {}, rawBody: new Uint8Array(10_485_760) }, new AbortController().signal);
    expect((await req.readBody(10_485_760)).byteLength).toBe(10_485_760);
    await expect(toCoreRequest({ method: 'POST', url: '/x', headers: {}, rawBody: new Uint8Array(10_485_761) }, new AbortController().signal).readBody(10_485_760)).rejects.toThrow();
  });
  it('US-E14-01/AC3 without rawBody the raw stream is read (and the limit applied while streaming)', async () => {
    const chunks = [new Uint8Array(6_000_000), new Uint8Array(6_000_000)];
    const mk = (): FnRequest => ({ method: 'POST', url: '/x', headers: {}, async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; } });
    await expect(toCoreRequest(mk(), new AbortController().signal).readBody(10_485_760)).rejects.toThrow();
    expect((await toCoreRequest(mk(), new AbortController().signal).readBody(20_000_000)).byteLength).toBe(12_000_000);
  });
  it('US-E14-01/AC4 header names are lower-cased and array values joined; query and path parsed from the URL', () => {
    const r = toCoreRequest({ method: 'POST', originalUrl: '/api/menu/extract?targetMonth=2026-11&uid=x', headers: { Authorization: 'Bearer a', Origin: ['https://a.test', 'https://b.test'] } }, new AbortController().signal);
    expect(r.path).toBe('/api/menu/extract');
    expect(r.query.get('targetMonth')).toBe('2026-11');
    expect(r.headers['authorization']).toBe('Bearer a');
    expect(r.headers['origin']).toBe('https://a.test, https://b.test'); // two Origin headers can never equal an allowed origin
  });
  it('US-E14-05/AC2 an array of two Origin headers (one allowed) is refused through the whole handler', async () => {
    const r = rig();
    const run = createApiHandler(() => r.deps);
    const { out, res } = fakeRes();
    await run({ method: 'POST', url: `/api/menu/extract?${QUERY}`, headers: { authorization: 'Bearer tok-a', origin: [ORIGIN, 'https://evil.example'] }, rawBody: pdfBytes() }, res);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(String(out.body))).toEqual({ ok: false, error: 'ORIGIN_NOT_ALLOWED' });
    expect(r.provider.calls.length).toBe(0);
  });
  it('US-E14-01/AC3 end to end through the adapter: status, headers (CORS) and body are written once', async () => {
    const r = rig();
    const run = createApiHandler(() => r.deps);
    const { out, res } = fakeRes();
    await run({ method: 'POST', url: `/api/menu/extract?${QUERY}`, headers: { authorization: 'Bearer tok-a', origin: ORIGIN }, rawBody: pdfBytes() }, res);
    expect(res.statusCode).toBe(200);
    expect(out.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(out.ended).toBe(true);
  });
});
