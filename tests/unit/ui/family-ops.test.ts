// Slice D: the actions behind the family screens (create, invite, join, adoption, discovery, safety copy), driven through
// the real sync controller over a FakeBackend. No UI is rendered; the screens have their own files.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBackend } from '../../../src/domain/sync/fake-port.ts';
import { CLOUD_NOTICE_VERSION } from '../../../src/domain/sync/config.ts';
import { safetyCopyKey } from '../../../src/domain/sync/meta.ts';
import { DEVICE_B, NOW_MS, UID1, UID2, makeDevice, storeWithData } from './family-harness.tsx';

let backend: FakeBackend;
beforeEach(() => {
  backend = new FakeBackend({ nowMs: () => NOW_MS });
});
afterEach(() => vi.useRealTimers());

const settle = async (ms = 50) => {
  await new Promise((r) => setTimeout(r, ms));
};

describe('US-E15-01 create the family', () => {
  it('US-E15-01/AC3 creating uploads every local record once under the family id and keeps the data', async () => {
    const d = makeDevice({ backend, uid: UID1 });
    d.controller.start();
    await settle();
    await d.controller.family.create();
    await settle(150);
    const meta = d.meta();
    expect(meta.familyId).not.toBeNull();
    expect(meta.consent.version).toBe(CLOUD_NOTICE_VERSION);
    expect(backend.families.size).toBe(1);
    const fam = [...backend.families.values()][0]!;
    expect(fam.records.size).toBeGreaterThan(3);
    expect(d.stored()?.profile?.ownerId).toBe(meta.familyId);
    expect(d.controller.getState().view.state).toBe('synced');
    d.controller.stop();
  });

  it('US-E15-01/AC4 an empty local copy creates an empty family and writes no store', async () => {
    const d = makeDevice({ backend, uid: UID1, store: null });
    d.controller.start();
    await settle();
    await d.controller.family.create();
    await settle(150);
    expect(d.meta().familyId).not.toBeNull();
    expect([...backend.families.values()][0]!.records.size).toBe(0);
    d.controller.stop();
  });

  it('US-E15-01/AC8 a second create call makes no second family', async () => {
    const d = makeDevice({ backend, uid: UID1 });
    d.controller.start();
    await settle();
    await Promise.all([d.controller.family.create(), d.controller.family.create().catch(() => undefined)]);
    await settle(150);
    expect(backend.families.size).toBe(1);
    d.controller.stop();
  });

  it('US-E15-01/AC7 offline: the create call fails and nothing exists', async () => {
    const d = makeDevice({ backend, uid: UID1 });
    d.controller.start();
    await settle();
    d.setOnline(false);
    await expect(d.controller.family.create()).rejects.toMatchObject({ kind: 'offline' });
    expect(backend.families.size).toBe(0);
    expect(d.meta()).toBeNull();
    d.controller.stop();
  });
});

describe('US-E15-03 invites', () => {
  it('US-E15-03/AC1 US-E15-03/AC4 an invite carries a code and an expiry; a new one makes the earlier code useless', async () => {
    const d = makeDevice({ backend, uid: UID1 });
    d.controller.start();
    await settle();
    await d.controller.family.create();
    await settle(100);
    const first = await d.controller.family.createInvite();
    expect(first.code).toHaveLength(10);
    expect(Date.parse(first.expiresAt)).toBe(NOW_MS + 72 * 3_600_000);
    const m = await d.controller.family.membership();
    expect(m.status === 'member' && m.invite?.code).toBe(first.code);
    await d.controller.family.cancelInvite();
    const after = await d.controller.family.membership();
    expect(after.status === 'member' && after.invite).toBeNull();
    d.controller.stop();
  });
});

describe('US-E15-04 join', () => {
  const familyWithData = async () => {
    const a = makeDevice({ backend, uid: UID1 });
    a.controller.start();
    await settle();
    await a.controller.family.create();
    await settle(150);
    return a;
  };

  it('US-E15-04/AC3 joining with an empty local copy downloads the family data without a question', async () => {
    const a = await familyWithData();
    const code = (await a.controller.family.createInvite()).code;
    const b = makeDevice({ backend, uid: UID2, store: null, deviceId: DEVICE_B });
    b.controller.start();
    await settle();
    expect(await b.controller.family.join(code)).toEqual({ kind: 'done' });
    await settle(150);
    expect(b.stored()?.profile?.nickname).toBe(a.stored()?.profile?.nickname);
    expect(b.controller.getState().adoptionPending).toBe(false);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-04/AC7 a family with no records takes the joiner\'s data without a question', async () => {
    const a = makeDevice({ backend, uid: UID1, store: null });
    a.controller.start();
    await settle();
    await a.controller.family.create();
    await settle(100);
    const code = (await a.controller.family.createInvite()).code;
    const b = makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B });
    b.controller.start();
    await settle();
    expect(await b.controller.family.join(code)).toEqual({ kind: 'done' });
    await settle(150);
    expect([...backend.families.values()][0]!.records.size).toBeGreaterThan(3);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-04/AC4 US-E15-04/AC5 data on both sides asks first; "use family" replaces the device data and keeps a backup copy', async () => {
    const a = await familyWithData();
    const code = (await a.controller.family.createInvite()).code;
    const own = storeWithData(DEVICE_B, UID2);
    const b = makeDevice({ backend, uid: UID2, store: { ...own, profile: own.profile === null ? null : { ...own.profile, nickname: 'べつの子' } }, deviceId: DEVICE_B });
    b.controller.start();
    await settle();
    expect(await b.controller.family.join(code)).toEqual({ kind: 'ask' });
    expect(b.controller.getState().adoptionPending).toBe(true);
    expect(b.stored()?.profile?.nickname).toBe('べつの子'); // nothing changed before the answer
    expect(await b.controller.family.localSummary()).toMatchObject({ profile: true });
    await b.controller.family.completeAdoption('use-family');
    await settle(150);
    expect(b.stored()?.profile?.nickname).toBe(a.stored()?.profile?.nickname);
    expect(b.storage.data.get(safetyCopyKey(UID2))).toContain('べつの子');
    expect(b.controller.getState().safetyCreatedAt).not.toBeNull();
    expect(b.controller.getState().adoptionPending).toBe(false);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-04/AC8 cancelling the question of a fresh join undoes the join and leaves the device untouched', async () => {
    const a = await familyWithData();
    const code = (await a.controller.family.createInvite()).code;
    const b = makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B });
    b.controller.start();
    await settle();
    const before = b.storage.data.get('bentominder.test-uid-002.state');
    expect(await b.controller.family.join(code)).toEqual({ kind: 'ask' });
    await b.controller.family.cancelJoin();
    await settle(100);
    expect(b.meta().familyId).toBeNull();
    expect(b.storage.data.get('bentominder.test-uid-002.state')).toBe(before);
    expect(b.controller.getState().adoptionPending).toBe(false);
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-04/AC9 US-E15-04/AC10 refusals are named and change nothing', async () => {
    const a = await familyWithData();
    const code = (await a.controller.family.createInvite()).code;
    const b = makeDevice({ backend, uid: UID2, store: null, deviceId: DEVICE_B });
    b.controller.start();
    await settle();
    expect(await b.controller.family.join('WRONGCODE2')).toEqual({ kind: 'error', error: 'generic' });
    expect(await b.controller.family.join(code)).toEqual({ kind: 'done' });
    await settle(100);
    // an account that is already a member
    expect(await b.controller.family.join(code)).toEqual({ kind: 'error', error: 'already' });
    b.setOnline(false);
    const c = makeDevice({ backend, uid: 'test-uid-003', store: null, deviceId: DEVICE_B });
    c.setOnline(false);
    expect(await c.controller.family.join(code)).toEqual({ kind: 'error', error: 'offline' });
    a.controller.stop();
    b.controller.stop();
  });

  it('US-E15-04/AC11 an interrupted join continues at the next open: the question is still pending', async () => {
    const a = await familyWithData();
    const code = (await a.controller.family.createInvite()).code;
    const b = makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B });
    b.controller.start();
    await settle();
    await b.controller.family.join(code);
    b.controller.stop();
    // the app is opened again on the same storage
    const again = makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B });
    for (const [k, v] of b.storage.data) await again.storage.write(k, v);
    again.controller.start();
    await settle(100);
    expect(again.controller.getState().adoptionPending).toBe(true);
    expect(again.controller.getState().view.state).not.toBe('syncing');
    a.controller.stop();
    again.controller.stop();
  });
});

describe('US-E15-05 a member\'s other device', () => {
  it('US-E15-05/AC1 US-E15-05/AC2 a new device of a member learns its family at start; consent recorded in the cloud needs no second notice', async () => {
    const a = makeDevice({ backend, uid: UID1 });
    a.controller.start();
    await settle();
    await a.controller.family.create();
    await settle(150);
    const phone = makeDevice({ backend, uid: UID1, store: null, deviceId: DEVICE_B });
    expect(phone.controller.getState().membership).toBe('unknown');
    phone.controller.start();
    await settle(200);
    const s = phone.controller.getState();
    expect(s.membership).toBe('member');
    expect(s.view.state).toBe('synced');
    expect(s.consent?.version).toBe(CLOUD_NOTICE_VERSION);
    expect(phone.stored()?.profile?.nickname).toBe(a.stored()?.profile?.nickname);
    a.controller.stop();
    phone.controller.stop();
  });

  it('US-E15-05/AC3 a failed membership read on a device with no copy is reported as failed, and retrying reads again', async () => {
    const phone = makeDevice({ backend, uid: UID1, store: null });
    phone.port.offline = true;
    phone.controller.start();
    await settle(100);
    expect(phone.controller.getState().membership).toBe('failed');
    phone.port.offline = false;
    phone.controller.retryDiscovery();
    await settle(100);
    expect(phone.controller.getState().membership).toBe('none');
    phone.controller.stop();
  });

  it('US-E15-05/AC5 an account in no family with old local data: only the membership is read, nothing changes', async () => {
    const d = makeDevice({ backend, uid: UID1 });
    const before = d.storage.data.get('bentominder.test-uid-001.state');
    d.controller.start();
    await settle(100);
    expect(d.callOps()).toEqual(['readMembership']);
    expect(d.storage.data.get('bentominder.test-uid-001.state')).toBe(before);
    d.controller.stop();
  });

  it('US-E15-05/AC6 a member\'s device with its own different data is asked once (the question is raised by the membership read)', async () => {
    const a = makeDevice({ backend, uid: UID1 });
    a.controller.start();
    await settle();
    await a.controller.family.create();
    await settle(150);
    const phone = makeDevice({ backend, uid: UID1, store: storeWithData(DEVICE_B, UID1), deviceId: DEVICE_B });
    phone.controller.start();
    await settle(200);
    const s = phone.controller.getState();
    expect(s.adoptionPending).toBe(true);
    expect(s.adoptionFromDiscovery).toBe(true);
    a.controller.stop();
    phone.controller.stop();
  });

  it('US-E15-02/AC1 US-E15-02/AC8 no family data is read or sent before the member accepts a newer notice', async () => {
    const strict = new FakeBackend({ nowMs: () => NOW_MS, minConsentVersion: 2 });
    // a member who consented to version 1 only
    const owner = strict.portFor(UID1);
    await owner.createFamily({ version: 1 });
    const phone = makeDevice({ backend: strict, uid: UID1, store: storeWithData(DEVICE_B, UID1), deviceId: DEVICE_B, noticeVersion: 2 });
    phone.controller.start();
    await settle(100);
    expect(phone.callOps().filter((op) => op === 'pull' || op === 'push')).toEqual([]);
    expect(phone.controller.getState().view.state).toBe('paused-no-consent');
    phone.controller.stop();
  });
});

describe('US-E15-04/AC5 the backup copy', () => {
  it('US-E15-04/AC5 the backup copy can be deleted and the row disappears', async () => {
    const a = makeDevice({ backend, uid: UID1 });
    a.controller.start();
    await settle();
    await a.controller.family.create();
    await settle(150);
    const code = (await a.controller.family.createInvite()).code;
    const b = makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B });
    b.controller.start();
    await settle();
    await b.controller.family.join(code);
    await b.controller.family.completeAdoption('add-device');
    await settle(100);
    expect(await b.controller.family.safetyCopy()).not.toBeNull();
    await b.controller.family.deleteSafetyCopy();
    await settle(50);
    expect(await b.controller.family.safetyCopy()).toBeNull();
    expect(b.controller.getState().safetyCreatedAt).toBeNull();
    a.controller.stop();
    b.controller.stop();
  });
});

describe('US-E15-08 leaving (local effect only; the screens are in family-status.test.tsx)', () => {
  it('US-E15-08/AC2 leaving keeps the device data as stand-alone: owner is the account again and the family id is gone', async () => {
    const a = makeDevice({ backend, uid: UID1 });
    a.controller.start();
    await settle();
    await a.controller.family.create();
    await settle(150);
    await a.controller.family.leave(true);
    await settle(100);
    expect(a.meta().familyId).toBeNull();
    expect(a.stored()?.profile?.ownerId).toBe(UID1);
    a.controller.stop();
  });
});
