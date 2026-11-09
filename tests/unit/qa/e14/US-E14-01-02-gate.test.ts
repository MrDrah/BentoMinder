// QA E14: US-E14-01 (token) and US-E14-02 (allow-list), derived from the stories and contract 13.2/13.3 only.
import { describe, expect, it } from 'vitest';
import { parseAllowList } from '../../../../server/core/hosted-policy.ts';
import { A, B, effects, extract, fetchUrl, headersString, NO_EFFECTS, ORIGIN, pdfBytes, QUERY, rig, send, bearer } from './rig.ts';

const ENDPOINTS = [
  ['extract', (r: ReturnType<typeof rig>, h?: Record<string, string>) => send(r, '/api/menu/extract', { query: QUERY, body: pdfBytes(), headers: h ?? {} })],
  ['fetch-pdf', (r: ReturnType<typeof rig>, h?: Record<string, string>) => send(r, '/api/menu/fetch-pdf', { body: JSON.stringify({ url: 'https://example-kinder.test/m.pdf' }), headers: h ?? {} })],
] as const;

describe('US-E14-01/AC1 no token is refused before any work', () => {
  for (const [name, call] of ENDPOINTS) {
    it(`US-E14-01/AC1 ${name}: 401 UNAUTHENTICATED, body never read, 0 verifier/provider/fetch/store`, async () => {
      const r = rig();
      const c = await call(r);
      expect(c.res.status).toBe(401);
      expect(c.json).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
      expect(c.bodyReads).toBe(0);
      expect(r.verifier.calls).toEqual([]);
      expect(effects(r)).toEqual(NO_EFFECTS);
    });
  }
});

describe('US-E14-01/AC2 invalid tokens are refused the same way', () => {
  const headers: Array<[string, string]> = [
    ['Bearer followed by nothing', 'Bearer '],
    ['Bearer alone', 'Bearer'],
    ['Basic scheme', 'Basic abc'],
    ['Basic with a valid token value', 'Basic tok-a'],
    ['token and extra word', 'Bearer tok-a extra'],
    ['two joined headers', 'Bearer tok-a, Bearer tok-b'],
    ['tab separated', 'Bearer\ttok-a'],
    ['9000-char token', `Bearer ${'x'.repeat(9000)}`],
    ['malformed token', 'Bearer not.a.jwt'],
    ['bad signature (verifier says null)', 'Bearer tok-badsig'],
    ['expired (verifier says null)', 'Bearer tok-expired'],
    ['other project (verifier says null)', 'Bearer tok-otherproject'],
    ['emoji token', 'Bearer 🍱🍱'],
    ['script token', 'Bearer <script>alert(1)</script>'],
  ];
  for (const [name, h] of headers) {
    for (const [ep, call] of ENDPOINTS) {
      it(`US-E14-01/AC2 ${ep}: ${name} -> 401, 0 provider, 0 outbound, 0 store`, async () => {
        const r = rig();
        const c = await call(r, { authorization: h });
        expect(c.res.status).toBe(401);
        expect(c.json).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
        expect(effects(r)).toEqual(NO_EFFECTS);
      });
    }
  }
  it('US-E14-01/AC2 a verifier that throws never lets the request through (401, not 500)', async () => {
    const r = rig();
    r.verifier.throwFor.add('tok-a');
    const c = await extract(r, 'tok-a');
    expect(c.res.status).toBe(401);
    expect(effects(r)).toEqual(NO_EFFECTS);
  });
  it('US-E14-01/AC2 all refusals are byte-identical (body and headers) whatever the reason', async () => {
    const seen = new Set<string>();
    for (const [, h] of headers) {
      const c = await ENDPOINTS[0][1](rig(), { authorization: h });
      seen.add(`${c.res.status}|${headersString(c.res)}|${c.text}`);
    }
    expect(seen.size).toBe(1);
  });
});

describe('US-E14-01/AC3 a valid allowed token is processed like the local proxy', () => {
  it('US-E14-01/AC3 extract reaches the provider with exactly the allow-listed inputs', async () => {
    const r = rig();
    const c = await extract(r);
    expect(c.res.status).toBe(200);
    expect(r.provider.calls.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(r.provider.calls[0] as object).sort()).toEqual(['model', 'pdf', 'promptVersion', 'schemaVersion', 'targetMonth']);
  });
  it('US-E14-01/AC3 fetch-pdf returns the PDF with the local response shape', async () => {
    const r = rig();
    const c = await fetchUrl(r, 'https://example-kinder.test/menu.pdf');
    expect(c.res.status).toBe(200);
    expect(c.res.headers['content-type']).toBe('application/pdf');
    expect(c.res.headers['x-bm-sha256']).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('US-E14-01/AC4 the account is the token uid, never client-supplied', () => {
  it('US-E14-01/AC4 identity headers and query naming account B are ignored on fetch-pdf; counted under A only', async () => {
    const r = rig();
    const c = await fetchUrl(r, 'https://example-kinder.test/menu.pdf', 'tok-a', {
      query: 'uid=test-uid-002&email=second@example.test&account=test-uid-002',
      headers: { uid: 'test-uid-002', 'x-uid': 'test-uid-002', email: 'second@example.test', 'x-account': 'test-uid-002', 'x-forwarded-user': 'test-uid-002' },
    });
    expect(c.res.status).toBe(200);
    expect(r.store.data.size).toBe(1);
    const { accountKey } = await import('../../../../server/core/hosted-policy.ts');
    expect([...r.store.data.keys()]).toEqual([accountKey(A.uid)]);
    expect(r.store.data.has(accountKey(B.uid))).toBe(false);
  });
  it('US-E14-01/AC4 extract still rejects an unknown query parameter (uid) as locally, with 0 provider calls', async () => {
    const r = rig();
    const c = await extract(r, 'tok-a', { query: `${QUERY}&uid=test-uid-002` });
    expect(c.res.status).toBe(400);
    expect(c.json['error']).toBe('BAD_REQUEST');
    expect(effects(r).provider).toBe(0);
  });
  it('US-E14-01/AC4 a stranger cannot become allowed by naming an allowed uid or e-mail', async () => {
    const r = rig();
    const c = await extract(r, 'tok-stranger', { headers: { uid: 'test-uid-001', email: 'allowed@example.test', 'x-account': 'test-uid-001' }, query: QUERY });
    expect(c.res.status).toBe(403);
    expect(effects(r)).toEqual(NO_EFFECTS);
  });
});

describe('US-E14-01/AC5 preflight needs no token and counts nothing', () => {
  for (const path of ['/api/menu/extract', '/api/menu/fetch-pdf']) {
    it(`US-E14-01/AC5 OPTIONS ${path} from the allowed origin: no verifier, no store, no body read`, async () => {
      const r = rig();
      const c = await send(r, path, { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
      expect(c.res.status).toBeGreaterThanOrEqual(200);
      expect(c.res.status).toBeLessThan(300);
      expect(c.bodyReads).toBe(0);
      expect(r.verifier.calls).toEqual([]);
      expect(effects(r)).toEqual(NO_EFFECTS);
    });
  }
});

describe('US-E14-01/AC6 the health route exposes nothing', () => {
  it('US-E14-01/AC6 GET /api/health without a token is exactly { ok, version }', async () => {
    const r = rig();
    const c = await send(r, '/api/health', { method: 'GET' });
    expect(c.res.status).toBe(200);
    expect(Object.keys(c.json).sort()).toEqual(['ok', 'version']);
    expect(c.json['ok']).toBe(true);
    expect(r.verifier.calls).toEqual([]);
    expect(c.text).not.toMatch(/allow|limit|provider|gemini|model|account/i);
  });
  it('US-E14-01/AC6 health costs nothing', async () => {
    const r = rig();
    await send(r, '/api/health', { method: 'GET' });
    expect(effects(r)).toEqual(NO_EFFECTS);
  });
});

describe('US-E14-01/AC7 a refused request costs nothing and its body is not stored', () => {
  it('US-E14-01/AC7 401s and 403s leave the counter store untouched, even after many', async () => {
    const r = rig();
    for (let i = 0; i < 12; i++) {
      await ENDPOINTS[0][1](r, {});
      await extract(r, 'tok-bogus');
      await extract(r, 'tok-stranger');
      await fetchUrl(r, 'https://example-kinder.test/x.pdf', 'tok-stranger');
    }
    expect(r.store.calls).toBe(0);
    expect(r.store.data.size).toBe(0);
    // and the allowed account still has its whole budget
    for (let i = 0; i < 5; i++) expect((await extract(r)).res.status).toBe(200);
    expect((await extract(r)).res.status).toBe(429);
  });
});

describe('US-E14-02/AC1 a signed-in account not on the list is denied', () => {
  for (const [name, call] of [
    ['extract', (r: ReturnType<typeof rig>) => extract(r, 'tok-stranger')],
    ['fetch-pdf', (r: ReturnType<typeof rig>) => fetchUrl(r, 'https://example-kinder.test/m.pdf', 'tok-stranger')],
  ] as const) {
    it(`US-E14-02/AC1 ${name}: 403 NOT_ALLOWED, 0 effects, body unread by the handler`, async () => {
      const r = rig();
      const c = await call(r);
      expect(c.res.status).toBe(403);
      expect(c.json).toEqual({ ok: false, error: 'NOT_ALLOWED' });
      expect(c.bodyReads).toBe(0);
      expect(effects(r)).toEqual(NO_EFFECTS);
    });
  }
});

describe('US-E14-02/AC2 matching rule', () => {
  it('US-E14-02/AC2 allowed by uid even when the e-mail is unlisted or unverified', async () => {
    const r = rig({ allowList: 'test-uid-001' });
    r.verifier.table['tok-a'] = { uid: 'test-uid-001', email: 'whoever@example.test', emailVerified: false };
    expect((await extract(r)).res.status).toBe(200);
  });
  it('US-E14-02/AC2 allowed by e-mail only when verified; case and spaces ignored on both sides', async () => {
    const r = rig({ allowList: '  Allowed@EXAMPLE.test  ' });
    r.verifier.table['tok-x'] = { uid: 'test-uid-123', email: '  allowed@example.TEST ', emailVerified: true };
    expect((await extract(r, 'tok-x')).res.status).toBe(200);
  });
  it('US-E14-02/AC2 unverified e-mail matching only by e-mail is NOT_ALLOWED', async () => {
    const r = rig({ allowList: 'allowed@example.test' });
    const c = await extract(r, 'tok-unverified');
    expect(c.res.status).toBe(403);
    expect(c.json['error']).toBe('NOT_ALLOWED');
    expect(effects(r)).toEqual(NO_EFFECTS);
  });
  it('US-E14-02/AC2 emailVerified must be exactly true (string "true" or 1 is not enough)', async () => {
    const r = rig({ allowList: 'allowed@example.test' });
    r.verifier.table['tok-str'] = { uid: 'u-1', email: 'allowed@example.test', emailVerified: 'true' as unknown as boolean };
    r.verifier.table['tok-one'] = { uid: 'u-2', email: 'allowed@example.test', emailVerified: 1 as unknown as boolean };
    expect((await extract(r, 'tok-str')).res.status).toBe(403);
    expect((await extract(r, 'tok-one')).res.status).toBe(403);
  });
  it('US-E14-02/AC2 a uid that merely contains or extends a listed uid is not allowed', async () => {
    const r = rig({ allowList: 'test-uid-001' });
    r.verifier.table['tok-p'] = { uid: 'test-uid-0011', emailVerified: true };
    r.verifier.table['tok-q'] = { uid: 'test-uid-00', emailVerified: true };
    r.verifier.table['tok-r'] = { uid: 'TEST-UID-001', emailVerified: true };
    for (const t of ['tok-p', 'tok-q', 'tok-r']) expect((await extract(r, t)).res.status).toBe(403);
  });
  it('US-E14-02/AC2 an e-mail that merely contains a listed e-mail is not allowed', async () => {
    const r = rig({ allowList: 'allowed@example.test' });
    r.verifier.table['tok-p'] = { uid: 'u-1', email: 'xallowed@example.test', emailVerified: true };
    r.verifier.table['tok-q'] = { uid: 'u-2', email: 'allowed@example.test.evil.test', emailVerified: true };
    r.verifier.table['tok-r'] = { uid: 'u-3', email: 'allowed@example.test\u0000', emailVerified: true };
    for (const t of ['tok-p', 'tok-q', 'tok-r']) expect((await extract(r, t)).res.status).toBe(403);
  });
  it('US-E14-02/AC2 a token without a uid never passes', async () => {
    const r = rig({ allowList: 'allowed@example.test' });
    r.verifier.table['tok-nouid'] = { uid: '', email: 'allowed@example.test', emailVerified: true };
    expect((await extract(r, 'tok-nouid')).res.status).toBe(401);
  });
});

describe('US-E14-02/AC4 missing or empty list fails closed', () => {
  const lists: Array<[string, string | null]> = [
    ['null (unreadable)', null],
    ['empty string', ''],
    ['blanks and separators', ' , ;\n ,'],
  ];
  for (const [name, list] of lists) {
    it(`US-E14-02/AC4 ${name}: every valid token is denied; reply carries no configuration detail`, async () => {
      const r = rig({ allowList: list });
      for (const t of ['tok-a', 'tok-b', 'tok-stranger']) {
        const c = await extract(r, t);
        expect(c.res.status).toBe(403);
        expect(c.json).toEqual({ ok: false, error: 'NOT_ALLOWED' });
      }
      expect(effects(r)).toEqual(NO_EFFECTS);
    });
  }
  it('US-E14-02/AC4 parseAllowList copes with non-string input (undefined, number, object, array)', () => {
    for (const raw of [undefined, null, 5, {}, ['a@b.test']]) {
      const l = parseAllowList(raw);
      expect(l.uids.size + l.emails.size).toBe(0);
    }
  });
});

describe('US-E14-02/AC5 the denial reveals nothing about the list', () => {
  it('US-E14-02/AC5 every denied account and every list state gets a byte-identical reply (status, headers, body)', async () => {
    const outcomes = new Set<string>();
    const tokens = ['tok-stranger', 'tok-unverified'];
    for (const list of ['test-uid-001,Second@Example.test', 'only-one-uid', 'a@b.test,c@d.test,e@f.test', '', null]) {
      for (const t of tokens) {
        for (const ep of ['extract', 'fetch'] as const) {
          const r = rig({ allowList: list === 'only-one-uid' ? 'only-one-uid' : list });
          const c = ep === 'extract' ? await extract(r, t) : await fetchUrl(r, 'https://example-kinder.test/m.pdf', t);
          outcomes.add(`${c.res.status}|${headersString(c.res)}|${c.text}`);
        }
      }
    }
    expect(outcomes.size).toBe(1);
  });
  it('US-E14-02/AC5 identical with an allowed Origin attached (CORS headers do not differ by account)', async () => {
    const outcomes = new Set<string>();
    for (const t of ['tok-stranger', 'tok-unverified']) {
      const c = await extract(rig(), t, { headers: { origin: ORIGIN } });
      outcomes.add(`${c.res.status}|${headersString(c.res)}|${c.text}`);
    }
    expect(outcomes.size).toBe(1);
  });
});

describe('US-E14-02/AC6 order of outcomes: token, then allow-list, then limits', () => {
  it('US-E14-02/AC6 an invalid token for an allowed uid is UNAUTHENTICATED, not NOT_ALLOWED', async () => {
    const r = rig();
    const c = await extract(r, 'tok-for-test-uid-001');
    expect(c.json['error']).toBe('UNAUTHENTICATED');
  });
  it('US-E14-02/AC6 a denied account is NOT_ALLOWED even when its (would-be) counters are exhausted', async () => {
    const r = rig({ limits: { extract: { perHour: 1, perDay: 1 }, fetch: { perHour: 1, perDay: 1 } } });
    const c = await extract(r, 'tok-stranger');
    expect(c.json['error']).toBe('NOT_ALLOWED');
  });
  it('US-E14-02/AC6 a bad query from a denied account is NOT_ALLOWED, not BAD_REQUEST (allow-list before validation)', async () => {
    const r = rig();
    const c = await extract(r, 'tok-stranger', { query: 'nonsense=1' });
    expect(c.json['error']).toBe('NOT_ALLOWED');
  });
  it('US-E14-02/AC6 allowed account at its limit gets ACCOUNT_LIMIT; account B unaffected', async () => {
    const r = rig({ limits: { extract: { perHour: 1, perDay: 5 }, fetch: { perHour: 1, perDay: 5 } } });
    expect((await extract(r, 'tok-a')).res.status).toBe(200);
    expect((await extract(r, 'tok-a')).json['error']).toBe('ACCOUNT_LIMIT');
    expect((await extract(r, 'tok-b')).res.status).toBe(200);
  });
  it('US-E14-02/AC3 allow-list changes take effect with a new configuration, removal denies again', async () => {
    const withB = rig({ allowList: 'test-uid-001,test-uid-002' });
    expect((await extract(withB, 'tok-b')).res.status).toBe(200);
    const without = rig({ allowList: 'test-uid-001' });
    expect((await extract(without, 'tok-b')).res.status).toBe(403);
  });
  it('US-E14-01/AC4 rig sanity: tokens map to the fake identities', () => {
    expect(A.uid).toBe('test-uid-001');
    expect(B.uid).toBe('test-uid-002');
    expect(bearer('x')).toEqual({ authorization: 'Bearer x' });
  });
});
