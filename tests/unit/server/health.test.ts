// Local proxy (ADR 001): GET /api/health answers; every other /api route is 404 until M1/M5.
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appVersion, proxyPort, startServer } from '../../../server/index.ts';

let base = '';
let server: ReturnType<typeof startServer>;

beforeAll(async () => {
  server = startServer(0);
  await new Promise<void>((resolve) => server.on('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('local proxy', () => {
  it('GET /api/health answers { ok: true, version }', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ ok: true, version: appVersion() });
  });

  it('refuses other methods on /api/health and unknown routes', async () => {
    const post = await fetch(`${base}/api/health`, { method: 'POST' });
    expect(post.status).toBe(405);
    const missing = await fetch(`${base}/api/menu/extract`, { method: 'POST' });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('reads PROXY_PORT with 8787 as the default', () => {
    expect(proxyPort({})).toBe(8787);
    expect(proxyPort({ PROXY_PORT: '9000' })).toBe(9000);
    expect(() => proxyPort({ PROXY_PORT: 'abc' })).toThrow(RangeError);
  });
});
