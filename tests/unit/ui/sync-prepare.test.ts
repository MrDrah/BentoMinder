// ADR 016 slice C: prepareSync wires the HTTP adapter to the controller; after stop (sign-out) the token is never asked for.
import { describe, expect, it, vi } from 'vitest';
import { FakeAuth } from '../../../src/domain/auth/fake-auth.ts';
import { storeKeysFor } from '../../../src/domain/storage/keys.ts';
import { createRepository } from '../../../src/domain/storage/repository.ts';
import { startMembership } from '../../../src/domain/sync/membership.ts';
import { emptySyncMeta, serializeSyncMeta, syncMetaKey } from '../../../src/domain/sync/meta.ts';
import { prepareSync } from '../../../src/ui/sync/open.ts';
import { DEVICE_A, storeWithData } from '../domain/sync/helpers.ts';
import { memoryStorage } from '../helpers/memory-storage.ts';

const BASE = 'https://asia-northeast1-demo.cloudfunctions.net/sync';
const T = '2026-11-10T10:00:00+09:00';

describe('US-E15-06/AC10 prepareSync: the token is never asked for after sign-out', () => {
  it('US-E15-06/AC10 a started controller sends with the account token to the sync base only; after stop nothing is requested', async () => {
    const base = startMembership({ store: storeWithData(DEVICE_A, 'u1'), meta: emptySyncMeta(), familyId: 'fam1', consentVersion: 1, nowMs: Date.parse(T) });
    const storage = memoryStorage({ [storeKeysFor('u1').state]: JSON.stringify(base.store), [syncMetaKey('u1')]: serializeSyncMeta(base.meta) });
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const requests: Array<{ url: string; authorization: string | null }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') });
      return new Response(JSON.stringify({ ok: true, serverNowMs: 1, envelopes: [], seq: 0, hasMore: false, schemaVersion: 1, results: [] }), { status: 200 });
    }) as typeof fetch;
    const handlers = new Set<(e: 'focus') => void>();
    const host = {
      isOnline: () => true,
      isVisible: () => true,
      subscribe: (h: (e: 'focus') => void) => {
        handlers.add(h);
        return () => handlers.delete(h);
      },
    };
    const clock = { now: () => Date.parse(T) as never };
    const prepared = await prepareSync({ uid: 'u1', base: BASE, getToken: (f) => auth.getIdToken(f), storage, clock, newDeviceId: () => DEVICE_A, isOnline: () => true, host: host as never, fetchImpl, random: () => 0 });
    expect(prepared.scope.ids()).toEqual(['u1', 'fam1']);
    const repo = createRepository(storage, clock, { accountId: 'u1', allowedOwnerIds: () => prepared.scope.ids() });
    const ctl = prepared.attach(repo);
    ctl.start();
    await vi.waitFor(() => expect(requests.length).toBeGreaterThan(1));
    expect(requests.every((r) => r.url.startsWith(`${BASE}/v1/`) && r.authorization?.startsWith('Bearer ') === true)).toBe(true);
    ctl.stop();
    const sent = requests.length;
    const tokensAsked = auth.tokenRequests.length;
    for (const h of handlers) h('focus');
    await new Promise((r) => setTimeout(r, 40));
    expect(requests.length).toBe(sent);
    expect(auth.tokenRequests.length).toBe(tokensAsked);
  });

  it('US-E15-11/AC1 an account that is in no family has an owner scope of its uid only and makes no request', async () => {
    const storage = memoryStorage();
    const fetchImpl = vi.fn();
    const clock = { now: () => Date.parse(T) as never };
    const prepared = await prepareSync({ uid: 'u1', base: BASE, getToken: () => Promise.resolve('t'), storage, clock, newDeviceId: () => DEVICE_A, isOnline: () => true, fetchImpl: fetchImpl as never });
    expect(prepared.scope.ids()).toEqual(['u1']);
    const ctl = prepared.attach(createRepository(storage, clock, { accountId: 'u1' }));
    ctl.start();
    await new Promise((r) => setTimeout(r, 40));
    expect(fetchImpl).not.toHaveBeenCalled();
    ctl.stop();
  });
});
