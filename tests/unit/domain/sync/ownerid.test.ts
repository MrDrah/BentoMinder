// US-E15-11 (domain parts: AC1 AC2 AC3 AC4 AC8 AC9), contract 14.7 and 14.11; sync metadata (14.2, ADR 016 section 4).
import { describe, expect, it } from 'vitest';
import { createRepository, validateStore } from '../../../../src/domain/storage/repository.ts';
import { createEmptyStore } from '../../../../src/domain/storage/defaults.ts';
import { storeKeysFor } from '../../../../src/domain/storage/keys.ts';
import { endMembership, startMembership } from '../../../../src/domain/sync/membership.ts';
import { ownerMismatchesFor } from '../../../../src/domain/sync/owner.ts';
import { emptySyncMeta, parseSyncMeta, safetyCopyKey, serializeSyncMeta, syncMetaKey, SYNC_META_VERSION } from '../../../../src/domain/sync/meta.ts';
import { extractRecords } from '../../../../src/domain/sync/records.ts';
import { syncCycle } from '../../../../src/domain/sync/cycle.ts';
import { emptySchedule } from '../../../../src/domain/sync/schedule.ts';
import { FakeBackend } from '../../../../src/domain/sync/fake-port.ts';
import { memoryStorage, fixedClock } from '../../helpers/memory-storage.ts';
import { DEVICE_A, T0, UID1, storeWithData, testClock } from './helpers.ts';

const FAM = 'fam-test-001';

describe('nothing changes until sharing is on (US-E15-11/AC1)', () => {
  it('US-E15-11/AC1 an account that is in no family: a cycle neither reads, writes nor changes the store; schemaVersion stays 1', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const port = backend.portFor(UID1);
    const store = storeWithData(DEVICE_A, UID1);
    const r = await syncCycle({ port, uid: UID1, store, meta: emptySyncMeta(), schedule: emptySchedule(), nowMs: clock.now });
    expect(r.outcome).toEqual({ kind: 'no-family' });
    expect(r.store).toBe(store);
    expect(r.store.schemaVersion).toBe(1);
    expect(port.calls).toEqual([]);
  });
});

describe('the local key stays the offline copy (US-E15-11/AC2, AC9)', () => {
  it('US-E15-11/AC2 sync metadata and the safety copy have their own keys next to, not inside, the store keys', () => {
    expect(syncMetaKey(UID1)).toBe('bentominder.test-uid-001.sync');
    expect(safetyCopyKey(UID1)).toBe('bentominder.test-uid-001.safety');
    const keys = storeKeysFor(UID1);
    expect([keys.state, keys.prev]).toEqual(['bentominder.test-uid-001.state', 'bentominder.test-uid-001.state.prev']);
    expect(new Set([keys.state, keys.prev, syncMetaKey(UID1), safetyCopyKey(UID1)]).size).toBe(4);
    expect(() => syncMetaKey('bad.uid')).toThrow('invalid-uid');
    expect(() => safetyCopyKey('')).toThrow('invalid-uid');
  });

  it('US-E15-11/AC9 the store shape does not change: no sync field in BentoMinderStore, schemaVersion 1', () => {
    const empty = createEmptyStore({ deviceId: DEVICE_A, now: T0 as never });
    expect(Object.keys(empty).sort()).toEqual(
      ['aiUsage', 'consent', 'createdAt', 'decisions', 'deviceId', 'menus', 'nextMonthCardHiddenOn', 'overrides', 'profile', 'reminderLog', 'schemaVersion', 'settings', 'updatedAt'],
    );
    const member = startMembership({ store: storeWithData(DEVICE_A, UID1), meta: emptySyncMeta(), familyId: FAM, consentVersion: 1, nowMs: T0 }).store;
    expect(Object.keys(member).sort()).toEqual(Object.keys(empty).sort());
    expect(member.schemaVersion).toBe(1);
  });

  it('US-E15-11/AC2 a store written by the previous app version (no sync code) still loads: it is just the store', async () => {
    const storage = memoryStorage({ [storeKeysFor(UID1).state]: JSON.stringify(storeWithData(DEVICE_A, UID1)) });
    const loaded = await createRepository(storage, fixedClock('2026-11-10T10:00:00+09:00'), { accountId: UID1 }).load();
    expect(loaded.kind).toBe('ok');
  });
});

describe('ownerId follows membership (US-E15-11/AC3, contract 14.7)', () => {
  it('US-E15-11/AC3 create or join: every record ownerId becomes the family id; the rule accepts the uid or the family id', () => {
    const local = storeWithData(DEVICE_A, UID1);
    expect(ownerMismatchesFor(local, [UID1, FAM])).toEqual([]);
    const { store } = startMembership({ store: local, meta: emptySyncMeta(), familyId: FAM, consentVersion: 1, nowMs: T0 });
    expect(store.settings.ownerId).toBe(FAM);
    expect(store.profile?.ownerId).toBe(FAM);
    expect(Object.values(store.menus).every((m) => m.ownerId === FAM)).toBe(true);
    expect(Object.values(store.decisions).every((d) => d.ownerId === FAM)).toBe(true);
    expect(Object.values(store.overrides).every((o) => o.ownerId === FAM)).toBe(true);
    expect(ownerMismatchesFor(store, [UID1, FAM])).toEqual([]);
    expect(ownerMismatchesFor(store, [UID1])).not.toEqual([]);
    expect(validateStore(store).ok).toBe(true);
  });

  it('US-E15-11/AC3 leave or removal: ownerId is the uid again, the family id and queue are gone, the store content is otherwise unchanged', () => {
    const local = storeWithData(DEVICE_A, UID1);
    const joined = startMembership({ store: local, meta: emptySyncMeta(), familyId: FAM, consentVersion: 1, nowMs: T0 });
    const meta = { ...joined.meta, cursor: 9, baselines: { 'profile_profile': { hash: 'h', updatedAt: 'x' } }, pending: { k: 1 }, safety: { createdAt: 'y' }, lastSyncedAt: 'z' };
    const ended = endMembership(joined.store, meta, UID1);
    expect(ended.store).toEqual(local);
    expect(ownerMismatchesFor(ended.store, [UID1])).toEqual([]);
    expect(ended.meta).toEqual({ ...emptySyncMeta(), safety: { createdAt: 'y' } });
  });

  it('US-E15-11/AC3 any other owner value fails the rule', () => {
    expect(ownerMismatchesFor(storeWithData(DEVICE_A, 'test-uid-002'), [UID1, FAM]).every((i) => i.rule === 'meta-owner-matches-account')).toBe(true);
  });
});

describe('export is unchanged (US-E15-11/AC4, AC8)', () => {
  it('US-E15-11/AC4 a member export is the store: no tombstone, baseline, queue, member or invite; same top-level fields as a non-member', () => {
    const { store, meta } = startMembership({ store: storeWithData(DEVICE_A, UID1), meta: emptySyncMeta(), familyId: FAM, consentVersion: 1, nowMs: T0 });
    const repo = createRepository(memoryStorage(), fixedClock('2026-11-10T10:00:00+09:00'));
    const text = repo.exportJson(store);
    const doc = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(doc).sort()).toEqual(Object.keys(storeWithData(DEVICE_A, UID1)).sort());
    for (const word of ['deletedAt', 'baselines', 'pending', 'members', 'invite', 'cursor', 'familyId', 'payloadJson', 'updatedBy']) expect(text).not.toContain(`"${word}"`);
    expect(repo.importJson(text)).toMatchObject({ ok: true });
    expect(serializeSyncMeta(meta)).not.toBe(text);
  });

  it('US-E15-11/AC8 the device id is only ever the tie-breaker and updatedBy metadata: no synced payload contains it', () => {
    const recs = [...extractRecords(storeWithData(DEVICE_A, FAM)).values()];
    expect(recs.every((r) => !r.payloadJson.includes(DEVICE_A))).toBe(true);
  });
});

describe('sync metadata (de)serialisation', () => {
  it('US-E15-11/AC2 round trips; version is 1', () => {
    const meta = { ...emptySyncMeta(), familyId: FAM, consent: { version: 1, at: '2026-11-10T10:00:00+09:00' }, cursor: 4, baselines: { 'menu_2026-11': { hash: 'abc', updatedAt: '2026-11-10T10:00:00+09:00' }, 'decision_2026-11-04': { hash: '', updatedAt: 'x', deleted: true as const } }, pending: { 'decision_2026-11-04': 5 }, adoption: { familyId: FAM, choice: 'add-device' as const, done: false }, safety: { createdAt: 'q' } };
    expect(SYNC_META_VERSION).toBe(1);
    expect(parseSyncMeta(serializeSyncMeta(meta))).toEqual({ kind: 'ok', meta });
  });

  it('US-E15-06/AC8 empty, corrupt and too-new documents are told apart; a newer version is never destroyed by this app', () => {
    expect(parseSyncMeta(null)).toEqual({ kind: 'empty' });
    expect(parseSyncMeta('{nope')).toEqual({ kind: 'corrupt' });
    expect(parseSyncMeta('{"version":1}')).toEqual({ kind: 'corrupt' });
    expect(parseSyncMeta('[]')).toEqual({ kind: 'corrupt' });
    expect(parseSyncMeta(JSON.stringify({ ...emptySyncMeta(), extra: 1 }))).toEqual({ kind: 'corrupt' });
    expect(parseSyncMeta(JSON.stringify({ ...emptySyncMeta(), version: 2, whatever: true }))).toEqual({ kind: 'too-new', version: 2 });
  });
});
