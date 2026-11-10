// The request pipeline of `sync` (origin, token, body, reply shape, failure handling), the Firestore adapter over a fake SDK,
// the Cloud Functions edge adapter and the configuration builder. Same policies as the `api` function (US-E14-01/05/06).
import { describe, expect, it } from 'vitest';
import { TooLarge, type CoreRequest } from '../../../../server/core/handle.ts';
import type { FnRequest, FnResponse } from '../../../../functions/src/adapter.ts';
import { buildSyncDeps } from '../../../../functions/src/sync/deps.ts';
import { DEFAULT_SYNC_CONFIG, parseSyncConfig } from '../../../../functions/src/sync/config.ts';
import { createSyncDb, type FirestoreLike } from '../../../../functions/src/sync/firestore-db.ts';
import { createSyncHandler } from '../../../../functions/src/sync/http.ts';
import { handleSync } from '../../../../functions/src/sync/service.ts';
import type { Row } from '../../../../functions/src/sync/types.ts';
import { FakeFirestore } from './fake-firestore.ts';
import { makeRig, ORIGIN, tokenOf, UID1 } from './harness.ts';

describe('origin and CORS (as the proxy, US-E14-05/AC1)', () => {
  it('US-E15-09/AC1 an allowed origin gets exactly that origin back; no wildcard, no credentials', async () => {
    const rig = makeRig();
    const r = await rig.call('membership.get', UID1, {}, { origin: ORIGIN });
    expect(r.status).toBe(200);
    expect(r.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(r.headers['access-control-allow-methods']).toBe('POST, OPTIONS');
    expect(r.headers['access-control-allow-credentials']).toBeUndefined();
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('US-E15-09/AC1 a foreign origin is refused before the token is even looked at, with no CORS headers, and nothing is read or written', async () => {
    const rig = makeRig();
    for (const origin of ['https://evil.example', 'https://mrdrah.github.io.evil.example', 'http://mrdrah.github.io', 'null', '*']) {
      const r = await rig.call('family.create', UID1, { consentVersion: 1 }, { origin });
      expect(r.status, origin).toBe(403);
      expect(r.body).toEqual({ ok: false, error: 'ORIGIN_NOT_ALLOWED' });
      expect(r.headers['access-control-allow-origin']).toBeUndefined();
    }
    expect(rig.db.docs.size).toBe(0);
  });

  it('US-E15-09/AC1 a preflight answers 204 with the CORS headers and needs no token', async () => {
    const rig = makeRig();
    const res = await handleSync({ method: 'OPTIONS', path: '/sync/v1/records.push', query: new URLSearchParams(), headers: { origin: ORIGIN }, readBody: () => Promise.reject(new Error('not read')) }, rig.deps());
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    expect(res.body).toBeNull();
  });
});

describe('routing and body', () => {
  const call = (rig: ReturnType<typeof makeRig>, req: Partial<CoreRequest> & { path: string }) =>
    handleSync({ method: 'POST', query: new URLSearchParams(), headers: { authorization: `Bearer ${tokenOf(UID1)}` }, readBody: () => Promise.resolve(new Uint8Array()), ...req }, rig.deps());
  const text = (b: unknown): Record<string, unknown> => JSON.parse(b as string) as Record<string, unknown>;

  it('US-E15-09/AC1 the operation is the last path segment under /v1/, with or without a prefix; anything else is 404; other methods 405', async () => {
    const rig = makeRig();
    expect((await call(rig, { path: '/v1/membership.get' })).status).toBe(200);
    expect((await call(rig, { path: '/sync/v1/membership.get' })).status).toBe(200);
    for (const path of ['/membership.get', '/v1/unknown.op', '/v1/', '/v1/membership.get/extra', '/api/menu/extract']) expect((await call(rig, { path })).status, path).toBe(404);
    const get = await call(rig, { path: '/v1/membership.get', method: 'GET' });
    expect(get.status).toBe(405);
    expect(get.headers['allow']).toBe('POST');
  });

  it('US-E15-09/AC7 a body that is not a JSON object is 400; an oversized body is 413 before anything is parsed', async () => {
    const rig = makeRig();
    const body = (s: string) => ({ path: '/v1/records.pull', readBody: () => Promise.resolve(new TextEncoder().encode(s)) });
    for (const s of ['{not json', '[1,2]', '"x"', 'null', '42']) expect((await call(rig, body(s))).status, s).toBe(400);
    const big = await call(rig, { path: '/v1/records.pull', readBody: () => Promise.reject(new TooLarge()) });
    expect(big.status).toBe(413);
    expect(text(big.body)).toMatchObject({ error: 'LIMIT', scope: 'request' });
  });

  it('US-E15-09/AC1 every successful reply carries ok:true and the server time', async () => {
    const rig = makeRig();
    rig.now += 1234;
    const r = await rig.ok('membership.get', UID1);
    expect(r).toMatchObject({ ok: true, serverNowMs: rig.now });
  });
});

describe('token handling (US-E14-01)', () => {
  it('US-E15-09/AC1 a verifier that throws or returns an unsafe uid never lets the request through', async () => {
    const rig = makeRig();
    const base = rig.deps();
    const throwing = { ...base, verifier: () => Promise.reject(new Error('certs unreachable')) };
    const odd = { ...base, verifier: () => Promise.resolve({ uid: 'a/../b', emailVerified: true }) };
    const empty = { ...base, verifier: () => Promise.resolve({ uid: '', emailVerified: true }) };
    for (const deps of [throwing, odd, empty]) {
      const r = await rig.call('family.create', UID1, { consentVersion: 1 }, {}, deps);
      expect(r).toMatchObject({ status: 401, body: { ok: false, error: 'UNAUTHENTICATED' } });
    }
    expect(rig.db.docs.size).toBe(0);
  });
});

describe('failures are closed and silent', () => {
  it('US-E15-10/AC6 a database failure is a fixed 503 UNAVAILABLE whose log line has the error class only, never its message', async () => {
    const rig = makeRig();
    rig.db.failReads = true;
    const r = await rig.call('records.pull', UID1, { cursor: 0 });
    expect(r).toMatchObject({ status: 503, body: { ok: false, error: 'UNAVAILABLE' } });
    expect(rig.logs.some((l) => /^error op=records\.pull class=Error$/.test(l))).toBe(true);
    expect(rig.logs.join('\n')).not.toContain('UNAVAILABLE');
  });

  it('US-E15-09/AC1 a corrupt stored document fails closed (503), it is not guessed at', async () => {
    const rig = makeRig();
    rig.db.seed(`accounts/${UID1}`, { status: 'member', familyId: 'broken' });
    rig.db.seed('families/broken', { status: 'active' }); // no counters
    rig.db.seed(`families/broken/members/${UID1}`, { consentVersion: 1 });
    const r = await rig.call('records.pull', UID1, { cursor: 0 });
    expect(r.status).toBe(503);
  });
});

describe('Firestore adapter over a fake SDK (no Google SDK is named in functions/src/sync/firestore-db.ts)', () => {
  function fakeSdk() {
    const log: string[] = [];
    const store = new Map<string, Record<string, unknown>>([['a/1', { v: 1 }]]);
    const query = (collection: string, parts: string[]) => ({
      where: (f: string, op: string, v: unknown) => query(collection, [...parts, `where:${f}${op}${String(v)}`]),
      orderBy: (f: string) => query(collection, [...parts, `order:${f}`]),
      limit: (n: number) => query(collection, [...parts, `limit:${n}`]),
      get: () => {
        log.push(`query ${collection} ${parts.join(' ')}`);
        return Promise.resolve({ docs: [{ ref: { path: `${collection}/z` }, data: () => ({ hit: true }) }] });
      },
    });
    const sdk: FirestoreLike = {
      doc: (path) => ({ path }),
      collection: (path) => query(path, []),
      runTransaction: (fn) =>
        fn({
          get: (target) => {
            if ('get' in target) return (target as unknown as { get(): Promise<never> }).get();
            const data = store.get(target.path);
            return Promise.resolve({ exists: data !== undefined, data: () => data });
          },
          set: (ref, data) => void log.push(`set ${ref.path} ${JSON.stringify(data)}`),
          delete: (ref) => void log.push(`delete ${ref.path}`),
        }),
      recursiveDelete: (ref) => {
        log.push(`recursiveDelete ${ref.path}`);
        return Promise.resolve();
      },
    };
    return { sdk, log };
  }

  it('US-E15-10/AC4 get, query (where, order, limit), set, delete and recursiveDelete map one to one', async () => {
    const { sdk, log } = fakeSdk();
    const db = createSyncDb(sdk);
    const rows = await db.runTransaction(async (tx) => {
      expect(await tx.get('a/1')).toEqual({ exists: true, data: { v: 1 } });
      expect(await tx.get('a/2')).toEqual({ exists: false, data: undefined });
      const r: Row[] = await tx.query('f/x/records', { where: { field: 'seq', op: '>', value: 3 }, orderBy: 'seq', limit: 7 });
      tx.set('a/3', { k: 1 });
      tx.delete('a/4');
      return r;
    });
    expect(rows).toEqual([{ path: 'f/x/records/z', data: { hit: true } }]);
    await db.query('invites', { where: { field: 'familyId', op: '==', value: 'F' } });
    await db.recursiveDelete('families/F');
    expect(log).toEqual([
      'query f/x/records where:seq>3 order:seq limit:7',
      'set a/3 {"k":1}',
      'delete a/4',
      'query invites where:familyId==F',
      'recursiveDelete families/F',
    ]);
  });
});

describe('Cloud Functions edge adapter', () => {
  function edge() {
    const rig = makeRig();
    const handler = createSyncHandler(() => rig.deps());
    const send = async (op: string, uid: string | null, body: unknown, getDeps?: () => never) => {
      const raw = new TextEncoder().encode(JSON.stringify(body));
      const req: FnRequest = { method: 'POST', url: `/v1/${op}`, headers: { ...(uid === null ? {} : { authorization: `Bearer ${tokenOf(uid)}` }), origin: ORIGIN }, rawBody: raw };
      const sent: { status: number; headers: Record<string, string>; body: string } = { status: 0, headers: {}, body: '' };
      const res: FnResponse = {
        statusCode: 0,
        setHeader: (n, v) => void (sent.headers[n] = v),
        end: (b) => {
          sent.status = res.statusCode;
          sent.body = typeof b === 'string' ? b : '';
          res.writableEnded = true;
        },
        on: () => undefined,
      };
      await (getDeps === undefined ? handler : createSyncHandler(getDeps))(req, res);
      return sent;
    };
    return { rig, send };
  }

  it('US-E15-01/AC3 a family.create through the edge adapter answers 200 with the reply body and the CORS headers', async () => {
    const { send } = edge();
    const r = await send('family.create', UID1, { consentVersion: 1 });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body)).toMatchObject({ ok: true, familyId: expect.any(String) });
    expect(r.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('US-E15-09/AC1 a request without a token answers 401 through the edge adapter', async () => {
    const { send } = edge();
    expect((await send('records.pull', null, { cursor: 0 })).status).toBe(401);
  });

  it('US-E15-10/AC6 if the dependencies cannot be built (a missing secret, say) the reply is a fixed 503 with no detail', async () => {
    const { send } = edge();
    const r = await send('records.pull', UID1, {}, () => {
      throw new Error('secret value leaked in message');
    });
    expect(r.status).toBe(503);
    expect(r.body).toBe('{"ok":false,"error":"UNAVAILABLE"}');
  });
});

describe('configuration', () => {
  it('US-E15-03/AC6 settings fall back to the contract defaults when absent or not positive integers; valid ones are used', () => {
    expect(parseSyncConfig({})).toEqual(DEFAULT_SYNC_CONFIG);
    expect(parseSyncConfig({ maxMembers: 0, inviteTtlHours: -1, inviteFailedPerHour: 1.5, writesPerHour: '9', cloudNoticeMinVersion: null })).toEqual(DEFAULT_SYNC_CONFIG);
    expect(parseSyncConfig({ maxMembers: 3, inviteTtlHours: 24, inviteFailedPerHour: 5, writesPerHour: 200, cloudNoticeMinVersion: 2 })).toEqual({ maxMembers: 3, inviteTtlHours: 24, inviteFailedPerHour: 5, writesPerHour: 200, cloudNoticeMinVersion: 2 });
    expect(DEFAULT_SYNC_CONFIG).toEqual({ maxMembers: 2, inviteTtlHours: 72, inviteFailedPerHour: 10, writesPerHour: 600, cloudNoticeMinVersion: 1 });
  });

  it('US-E15-09/AC1 buildSyncDeps reads origins as exact origins only and the allow-list from the secret; an absent secret allows nobody', () => {
    const ports = { verifier: () => Promise.resolve(null), db: new FakeFirestore(), nowMs: () => 0, random: (n: number) => new Uint8Array(n), log: () => undefined };
    const d = buildSyncDeps({ allowedAccounts: 'uid-1, a@b.test', allowedOrigins: 'https://x.example, *, https://y.example/path', settings: {} }, ports);
    expect(d.allowedOrigins).toEqual(['https://x.example']);
    expect([...d.allowList!.uids]).toEqual(['uid-1']);
    expect([...d.allowList!.emails]).toEqual(['a@b.test']);
    const none = buildSyncDeps({ allowedAccounts: undefined, allowedOrigins: undefined, settings: {} }, ports);
    expect(none.allowedOrigins).toEqual(['https://mrdrah.github.io']);
    expect(none.allowList!.uids.size + none.allowList!.emails.size).toBe(0);
  });
});
