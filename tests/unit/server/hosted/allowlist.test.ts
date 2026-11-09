// US-E14-02: only allow-listed accounts. Fake identities only (test-uid-xxx, *@example.test).
import { describe, expect, it } from 'vitest';
import { isAllowed, parseAllowList } from '../../../../server/core/hosted-policy.ts';
import { ALICE, BOB, EXTRACT_QUERY, extract, fetchPdfReq, PDF, rig, send, STRANGER, UNVERIFIED } from './harness.ts';

describe('US-E14-02 allow-list', () => {
  it.each([
    ['extract', (r: ReturnType<typeof rig>) => extract(r, 'tok-stranger')],
    ['fetch-pdf', (r: ReturnType<typeof rig>) => fetchPdfReq(r, undefined, 'tok-stranger')],
  ] as const)('US-E14-02/AC1 a valid token not on the list gets 403 NOT_ALLOWED on %s, with no work and no count', async (_n, call) => {
    const r = rig();
    const c = await call(r);
    expect(c.res.status).toBe(403);
    expect(c.json()).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(r.providerCalls).toHaveLength(0);
    expect(r.fetches).toHaveLength(0);
    expect(r.store.calls).toBe(0);
  });

  it('US-E14-02/AC2 allowed when the uid is listed, or the e-mail is listed and verified', () => {
    const list = parseAllowList('test-uid-001, Second@Example.test');
    expect(isAllowed(list, ALICE)).toBe(true); // by uid
    expect(isAllowed(list, BOB)).toBe(true); // by e-mail, verified
    expect(isAllowed(list, STRANGER)).toBe(false);
  });

  it('US-E14-02/AC2 an unverified e-mail that matches only by e-mail is denied', async () => {
    expect(isAllowed(parseAllowList('second@example.test'), UNVERIFIED)).toBe(false);
    const r = rig();
    const c = await extract(r, 'tok-unverified');
    expect(c.res.status).toBe(403);
    expect(c.json()['error']).toBe('NOT_ALLOWED');
  });

  it('US-E14-02/AC2 a listed uid is enough even with an unverified e-mail; e-mail case and spaces are ignored', () => {
    expect(isAllowed(parseAllowList('test-uid-777'), UNVERIFIED)).toBe(true);
    expect(isAllowed(parseAllowList('  SECOND@example.TEST  '), { ...BOB, email: ' Second@Example.Test ' })).toBe(true);
  });

  it('US-E14-02/AC2 uids are compared exactly (case-sensitive), not as e-mails', () => {
    expect(isAllowed(parseAllowList('TEST-UID-001'), ALICE)).toBe(false);
  });

  it('US-E14-02/AC3 the list is configuration: changing the string changes who is allowed, no code change', async () => {
    const before = await extract(rig({ allowList: 'test-uid-001' }), 'tok-bob');
    expect(before.res.status).toBe(403);
    const added = await extract(rig({ allowList: 'test-uid-001,test-uid-002' }), 'tok-bob');
    expect(added.res.status).toBe(200);
    const removed = await extract(rig({ allowList: 'test-uid-002' }), 'tok-alice');
    expect(removed.res.status).toBe(403);
  });

  it('US-E14-02/AC3 parseAllowList trims, lower-cases e-mails, drops blanks', () => {
    const l = parseAllowList(' a1 ,, B@X.test ;\n c3 ,');
    expect([...l.uids].sort()).toEqual(['a1', 'c3']);
    expect([...l.emails]).toEqual(['b@x.test']);
  });

  it.each([
    ['unset', undefined],
    ['null (unreadable)', null],
    ['empty string', ''],
    ['only separators', ' , ,; '],
    ['not a string', 42],
  ])('US-E14-02/AC4 a %s list fails closed: every valid token is denied', async (_n, raw) => {
    const r = rig();
    r.deps.policy!.allowList = raw === null ? null : parseAllowList(raw);
    for (const t of ['tok-alice', 'tok-bob']) {
      const c = await extract(r, t);
      expect(c.res.status).toBe(403);
      expect(c.json()).toEqual({ ok: false, error: 'NOT_ALLOWED' }); // no detail about the configuration
    }
    expect(r.providerCalls).toHaveLength(0);
  });

  it('US-E14-02/AC5 the denial body and headers are identical for every denied account', async () => {
    const r = rig();
    const a = await extract(r, 'tok-stranger');
    const b = await extract(r, 'tok-unverified');
    const c = await fetchPdfReq(r, undefined, 'tok-stranger');
    expect(a.res.body).toBe(b.res.body);
    expect(a.res.body).toBe(c.res.body);
    expect(a.res.headers).toEqual(b.res.headers);
    const empty = rig({ allowList: '' });
    expect((await extract(empty, 'tok-alice')).res.body).toBe(a.res.body); // same as "not on the list"
  });

  it('US-E14-02/AC6 order of outcomes: invalid token, then denied account, then limits', async () => {
    const r = rig({ allowList: 'test-uid-001', limits: { extract: { perHour: 0, perDay: 0 }, fetch: { perHour: 0, perDay: 0 } } });
    // invalid token for an otherwise allowed uid -> 401
    expect((await extract(r, 'tok-forged')).res.status).toBe(401);
    // valid token of a denied account while the limit is zero -> 403, not 429
    expect((await extract(r, 'tok-stranger')).res.status).toBe(403);
    // allowed account, bad query AND over limit -> validation first (400), no count
    const bad = await send(r, '/api/menu/extract', { query: 'targetMonth=bad', body: PDF, headers: { authorization: 'Bearer tok-alice' } });
    expect(bad.res.status).toBe(400);
    // allowed account, valid request -> limits apply
    expect((await extract(r, 'tok-alice')).res.status).toBe(429);
    expect(r.providerCalls).toHaveLength(0);
    void EXTRACT_QUERY;
  });
});
