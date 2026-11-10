// ADR 016 slice C: the HTTP SyncPort adapter against a recording fake fetch (slice-b-wire.md is the contract). No network.
import { describe, expect, it, vi } from 'vitest';
import { createHttpSyncPort, DELETE_CONFIRMATION, refusalToError } from '../../../src/adapters/web/sync-http.ts';
import { FakeAuth } from '../../../src/domain/auth/fake-auth.ts';
import { liveEnvelope } from '../../../src/domain/sync/envelope.ts';
import { extractRecords } from '../../../src/domain/sync/records.ts';
import { SyncPortError } from '../../../src/domain/sync/types.ts';
import { storeWithData } from '../domain/sync/helpers.ts';

const BASE = 'https://asia-northeast1-demo.cloudfunctions.net/sync';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ok = (extra: Record<string, unknown> = {}) => json(200, { ok: true, serverNowMs: 1, ...extra });

interface Seen {
  url: string;
  method: string | undefined;
  authorization: string | null;
  body: Record<string, unknown>;
}
function recorder(replies: Array<() => Response | Promise<Response>>) {
  const seen: Seen[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), method: init?.method, authorization: new Headers(init?.headers).get('authorization'), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    const next = replies.shift();
    if (next === undefined) throw new Error('unexpected extra request');
    return next();
  }) as typeof fetch;
  return { seen, fetchImpl };
}
const portWith = (auth: FakeAuth, fetchImpl: typeof fetch, extra: { isOnline?: () => boolean; onDropped?: (n: number) => void } = {}) =>
  createHttpSyncPort({ base: BASE, getToken: (f) => auth.getIdToken(f), fetchImpl, ...extra });

const T = '2026-11-10T10:00:00+09:00';
const records = extractRecords(storeWithData('dev-a', 'fam1'));
const stored = (kind: string, key: string, seq: number) => ({ kind, key, payloadJson: records.get(`${kind}_${key}`)?.payloadJson ?? '{}', updatedAt: T, updatedAtMs: Date.parse(T), updatedBy: 'u1', deviceId: 'dev-a', seq });

describe('US-E15-06/AC3 the wire operations (slice-b-wire.md)', () => {
  it('US-E15-04/AC1 each operation posts to /v1/<op> with a Bearer token and a JSON body, and reads the documented reply', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const { seen, fetchImpl } = recorder([
      () => ok({ status: 'none' }),
      () => ok({ status: 'ended', reason: 'removed' }),
      () => ok({ status: 'member', familyId: 'fam1', consentVersion: 1, maxMembers: 2, members: [], invite: null }),
      () => ok({ familyId: 'fam1' }),
      () => ok({ code: 'ABCD234567', expiresAt: T }),
      () => ok({}),
      () => ok({ familyId: 'fam1' }),
      () => ok({}),
      () => ok({}),
      () => ok({}),
      () => ok({ deleted: true }),
      () => ok({}),
    ]);
    const port = portWith(auth, fetchImpl);
    expect(await port.readMembership()).toEqual({ status: 'none' });
    expect(await port.readMembership()).toEqual({ status: 'ended', reason: 'removed' });
    expect(await port.readMembership()).toEqual({ status: 'member', familyId: 'fam1', consentVersion: 1 });
    expect(await port.createFamily({ version: 1 })).toEqual({ familyId: 'fam1' });
    expect(await port.createInvite()).toEqual({ code: 'ABCD234567', expiresAt: T });
    await port.cancelInvite();
    expect(await port.redeemInvite('ABCD234567', { version: 1 })).toEqual({ familyId: 'fam1' });
    await port.setConsent({ version: 1 });
    await port.leave();
    await port.removeMember('u2');
    await port.deleteFamily();
    await port.ackMembershipEnd();
    expect(seen.map((s) => s.url.slice(BASE.length))).toEqual([
      '/v1/membership.get', '/v1/membership.get', '/v1/membership.get', '/v1/family.create', '/v1/invite.create', '/v1/invite.cancel', '/v1/invite.redeem', '/v1/consent.set', '/v1/family.leave', '/v1/family.removeMember', '/v1/family.delete', '/v1/membership.ack',
    ]);
    expect(seen.every((s) => s.method === 'POST' && s.authorization?.startsWith('Bearer ') === true)).toBe(true);
    expect(seen[3]?.body).toEqual({ consentVersion: 1 });
    expect(seen[6]?.body).toEqual({ code: 'ABCD234567', consentVersion: 1 });
    expect(seen[7]?.body).toEqual({ consentVersion: 1 });
    expect(seen[8]?.body).toEqual({});
    expect(seen[9]?.body).toEqual({ uid: 'u2' });
    expect(seen[10]?.body).toEqual({ confirmation: DELETE_CONFIRMATION });
  });

  it('US-E15-04/AC1 the last member leaving sends the confirmation word; an unfinished delete is a temporary condition', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const { seen, fetchImpl } = recorder([() => ok({ deleted: true }), () => ok({ status: 'deleting' })]);
    const port = portWith(auth, fetchImpl);
    await port.leaveAsLastMember();
    expect(seen[0]?.body).toEqual({ confirmation: '削除する' });
    await expect(port.readMembership()).rejects.toMatchObject({ kind: 'temporary' });
  });

  it('US-E15-05/AC7 a pull sends the cursor and returns valid envelopes; an invalid one is dropped and counted (US-E15-06/AC9)', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const onDropped = vi.fn();
    const bad = { ...stored('decision', '2026-11-04', 2), updatedAtMs: 1 };
    const { seen, fetchImpl } = recorder([() => ok({ envelopes: [stored('profile', 'profile', 1), bad, 'nonsense'], seq: 2, hasMore: false, schemaVersion: 1 })]);
    const r = await portWith(auth, fetchImpl, { onDropped }).pull(0);
    expect(seen[0]?.body).toEqual({ cursor: 0 });
    expect(r.seq).toBe(2);
    expect(r.hasMore).toBe(false);
    expect(r.schemaVersion).toBe(1);
    expect(r.envelopes.map((e) => `${e.kind}_${e.key}`)).toEqual(['profile_profile']);
    expect(onDropped).toHaveBeenCalledWith(2);
  });

  it('US-E15-06/AC3 a push sends client fields only (no seq, no extra property) and maps accepted and superseded results', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const env = liveEnvelope({ kind: 'profile', key: 'profile', payloadJson: stored('profile', 'profile', 0).payloadJson, updatedAt: T, updatedBy: 'u1', deviceId: 'dev-a' });
    const sneaky = { ...env, seq: 9, secret: 'x' } as unknown as typeof env;
    const { seen, fetchImpl } = recorder([
      () => ok({ results: [{ kind: 'profile', key: 'profile', status: 'accepted', stored: stored('profile', 'profile', 3) }, { kind: 'menu', key: '2026-11', status: 'superseded', winner: stored('menu', '2026-11', 4) }], seq: 4, schemaVersion: 1 }),
    ]);
    const r = await portWith(auth, fetchImpl).push([sneaky]);
    expect(Object.keys((seen[0]?.body['records'] as Array<Record<string, unknown>>)[0] ?? {}).sort()).toEqual(['deviceId', 'key', 'kind', 'payloadJson', 'updatedAt', 'updatedAtMs', 'updatedBy']);
    expect(r.map((x) => x.status)).toEqual(['accepted', 'superseded']);
  });

  it('US-E15-06/AC3 a reply that is not the documented shape is a temporary failure, never a crash', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const { fetchImpl } = recorder([() => ok({ envelopes: 'x' }), () => json(200, 'plain'), () => new Response('<html>', { status: 200 }), () => ok({ results: [{ kind: 'menu' }] })]);
    const port = portWith(auth, fetchImpl);
    await expect(port.pull(0)).rejects.toMatchObject({ kind: 'temporary' });
    await expect(port.pull(0)).rejects.toMatchObject({ kind: 'temporary' });
    await expect(port.pull(0)).rejects.toMatchObject({ kind: 'temporary' });
    await expect(port.push([])).rejects.toMatchObject({ kind: 'temporary' });
  });
});

describe('US-E15-06/AC5 refusals become SyncPortError kinds exactly as slice-b-wire.md says', () => {
  const table: Array<[number, Record<string, unknown>, string, string | undefined]> = [
    [401, { error: 'UNAUTHENTICATED' }, 'unauthenticated', undefined],
    [403, { error: 'NOT_MEMBER' }, 'refused', 'not-member'],
    [410, { error: 'MEMBERSHIP_ENDED', reason: 'left' }, 'membership-ended', 'left'],
    [410, { error: 'MEMBERSHIP_ENDED', reason: 'removed' }, 'membership-ended', 'removed'],
    [410, { error: 'MEMBERSHIP_ENDED', reason: 'family-deleted' }, 'membership-ended', 'family-deleted'],
    [403, { error: 'CONSENT_REQUIRED' }, 'consent-required', undefined],
    [403, { error: 'NOT_ALLOWED' }, 'refused', 'not-allowed'],
    [403, { error: 'ORIGIN_NOT_ALLOWED' }, 'refused', 'origin-not-allowed'],
    [409, { error: 'ALREADY_IN_FAMILY' }, 'refused', 'already-in-family'],
    [409, { error: 'FAMILY_FULL' }, 'refused', 'family-full'],
    [409, { error: 'CONFIRMATION_REQUIRED', why: 'last-member' }, 'refused', 'confirmation-required'],
    [400, { error: 'INVITE_INVALID' }, 'refused', 'invalid-code'],
    [400, { error: 'INVITE_EXPIRED' }, 'refused', 'expired'],
    [429, { error: 'TOO_MANY_ATTEMPTS', retryAfterSec: 60 }, 'refused', 'too-many-attempts'],
    [413, { error: 'LIMIT', scope: 'record' }, 'limit', 'record'],
    [413, { error: 'LIMIT', scope: 'family' }, 'limit', 'family'],
    [429, { error: 'LIMIT', scope: 'writes', retryAfterSec: 30 }, 'limit', 'writes'],
    [413, { error: 'LIMIT', scope: 'request' }, 'limit', 'request'],
    [400, { error: 'INVALID_RECORD', index: 3, rule: 'r', reason: 'x' }, 'refused', 'invalid-record'],
    [400, { error: 'BAD_REQUEST', field: 'cursor' }, 'refused', 'bad-request'],
    [404, { error: 'TARGET_NOT_FOUND' }, 'refused', 'not-found'],
    [404, { error: 'NOT_FOUND' }, 'refused', 'not-found'],
    [503, { error: 'UNAVAILABLE' }, 'temporary', 'http-503'],
    [500, {}, 'temporary', 'http-500'],
  ];
  it.each(table)('US-E15-06/AC5 %s %j', (status, body, kind, detail) => {
    const err = refusalToError(status, body);
    expect(err).toBeInstanceOf(SyncPortError);
    expect(err.kind).toBe(kind);
    expect(err.detail).toBe(detail);
  });

  it('US-E15-06/AC5 the refusal text carries no reply content', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const { fetchImpl } = recorder([() => json(400, { error: 'INVALID_RECORD', index: 0, rule: 'r', reason: 'secret-note-text' })]);
    const err = await portWith(auth, fetchImpl).push([]).catch((e: unknown) => e as Error);
    expect(String(err)).not.toContain('secret-note-text');
  });
});

describe('US-E15-06/AC10 the token goes only to the sync base, and a signed-out app sends nothing', () => {
  it('US-E15-06/AC10 signed out: no request at all, the failure is unauthenticated', async () => {
    const auth = new FakeAuth({ user: null });
    const { seen, fetchImpl } = recorder([]);
    await expect(portWith(auth, fetchImpl).pull(0)).rejects.toMatchObject({ kind: 'unauthenticated' });
    await expect(portWith(auth, fetchImpl).readMembership()).rejects.toMatchObject({ kind: 'unauthenticated' });
    expect(seen).toEqual([]);
  });

  it('US-E15-06/AC10 every request goes to the sync base only; the token is in the header and nowhere in the address or body', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const { seen, fetchImpl } = recorder([() => ok({ status: 'none' }), () => ok({ envelopes: [], seq: 0, hasMore: false, schemaVersion: 1 })]);
    const port = portWith(auth, fetchImpl);
    await port.readMembership();
    await port.pull(0);
    const token = await auth.getIdToken();
    for (const s of seen) {
      expect(s.url.startsWith(`${BASE}/v1/`)).toBe(true);
      expect(s.url).not.toContain(String(token));
      expect(JSON.stringify(s.body)).not.toContain(String(token));
      expect(s.authorization).toBe(`Bearer ${String(token)}`);
    }
  });

  it('US-E15-06/AC10 a 401 UNAUTHENTICATED gets one forced-refresh retry, with the fresh token; a second 401 is unauthenticated', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const getToken = vi.fn((force: boolean) => Promise.resolve(force ? 'fresh-token' : 'old-token'));
    const first = recorder([() => json(401, { ok: false, error: 'UNAUTHENTICATED' }), () => ok({ status: 'none' })]);
    const port = createHttpSyncPort({ base: BASE, getToken, fetchImpl: first.fetchImpl });
    expect(await port.readMembership()).toEqual({ status: 'none' });
    expect(first.seen.map((s) => s.authorization)).toEqual(['Bearer old-token', 'Bearer fresh-token']);
    expect(getToken.mock.calls.map((c) => c[0])).toEqual([false, true]);
    const second = recorder([() => json(401, { error: 'UNAUTHENTICATED' }), () => json(401, { error: 'UNAUTHENTICATED' })]);
    await expect(createHttpSyncPort({ base: BASE, getToken, fetchImpl: second.fetchImpl }).readMembership()).rejects.toMatchObject({ kind: 'unauthenticated' });
    expect(second.seen).toHaveLength(2);
    void auth;
  });

  it('US-E15-06/AC10 when no fresh token can be had, the refresh gives up without a second request', async () => {
    const getToken = vi.fn((force: boolean) => Promise.resolve(force ? null : 'old-token'));
    const { seen, fetchImpl } = recorder([() => json(401, { error: 'UNAUTHENTICATED' })]);
    await expect(createHttpSyncPort({ base: BASE, getToken, fetchImpl }).readMembership()).rejects.toMatchObject({ kind: 'unauthenticated' });
    expect(seen).toHaveLength(1);
  });
});

describe('US-E15-06/AC2 offline and temporary failures', () => {
  it('US-E15-06/AC2 offline sends nothing and is the offline kind', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const { seen, fetchImpl } = recorder([]);
    await expect(portWith(auth, fetchImpl, { isOnline: () => false }).pull(0)).rejects.toMatchObject({ kind: 'offline' });
    expect(seen).toEqual([]);
  });

  it('US-E15-06/AC5 a network failure while the browser says online is temporary, and offline when it says offline', async () => {
    const auth = new FakeAuth({ user: { uid: 'u1', displayName: null, email: null, photoUrl: null } });
    const failing = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    await expect(portWith(auth, failing).pull(0)).rejects.toMatchObject({ kind: 'temporary' });
    let online = true;
    const dropping = (() => {
      online = false;
      return Promise.reject(new TypeError('Failed to fetch'));
    }) as typeof fetch;
    await expect(portWith(auth, dropping, { isOnline: () => online }).pull(0)).rejects.toMatchObject({ kind: 'offline' });
  });
});
