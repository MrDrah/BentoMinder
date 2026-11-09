// E13 (slice A): account-keyed storage, one-time adoption, owner rule, export/delete per account.
import { describe, expect, it } from 'vitest';
import { adoptLegacyStore } from '../../../../src/domain/storage/adoption.ts';
import { isValidUid, storeKeysFor } from '../../../../src/domain/storage/keys.ts';
import { rewriteOwnerId } from '../../../../src/domain/storage/owner.ts';
import { createRepository, StoreValidationError } from '../../../../src/domain/storage/repository.ts';
import { ownerMismatches } from '../../../../src/domain/schema/store.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import type { Storage, StorageKey } from '../../../../src/domain/ports.ts';
import { clone, storeV1 } from '../../helpers/fixtures.ts';
import { fixedClock, memoryStorage } from '../../helpers/memory-storage.ts';

const clock = fixedClock('2026-11-09T01:00:00Z');
const A = 'test-uid-001';
const B = 'test-uid-002';
const keysA = storeKeysFor(A);
const keysB = storeKeysFor(B);
const legacy = () => storeV1(); // ownerId `local`
const forAccount = (uid: string): BentoMinderStore => rewriteOwnerId(storeV1(), uid);
const text = (v: unknown) => JSON.stringify(v);

/** A storage that records every key read, to prove another account's keys are never read. */
function spy(inner: Storage) {
  const reads: string[] = [];
  const s: Storage = { ...inner, read: (k: StorageKey) => (reads.push(k), inner.read(k)) };
  return { s, reads };
}

describe('US-E13-04 local data is keyed to the account', () => {
  it('US-E13-04/AC1 key names follow bentominder.<uid>.state and .state.prev; a uid with a dot or space is refused', () => {
    expect(keysA).toEqual({ state: 'bentominder.test-uid-001.state', prev: 'bentominder.test-uid-001.state.prev' });
    expect(isValidUid('a.b')).toBe(false);
    expect(isValidUid('a b')).toBe(false);
    expect(isValidUid('')).toBe(false);
    expect(isValidUid('x'.repeat(128))).toBe(true);
    expect(isValidUid('x'.repeat(129))).toBe(false);
    expect(() => storeKeysFor('a.b')).toThrow();
  });

  it('US-E13-04/AC1 existing data is adopted by the first account: ownerId becomes the uid, nothing else changes, legacy keys go', async () => {
    const before = legacy();
    const storage = memoryStorage({ 'bentominder.state': text(before), 'bentominder.state.prev': text(before) });
    expect(await adoptLegacyStore(storage, clock, A)).toEqual({ kind: 'adopted' });
    const adopted = JSON.parse(storage.data.get(keysA.state)!) as BentoMinderStore;
    expect(adopted).toEqual(rewriteOwnerId(before, A));
    expect(JSON.stringify(adopted)).not.toContain('"local"');
    expect(adopted.schemaVersion).toBe(1);
    expect(adopted.deviceId).toBe(before.deviceId);
    expect(storage.data.has('bentominder.state')).toBe(false);
    expect(storage.data.has('bentominder.state.prev')).toBe(false);
    expect(storage.data.has(keysA.prev)).toBe(true);
  });

  it('US-E13-04/AC1 the legacy keys stay when the new copy cannot be written', async () => {
    const storage = memoryStorage({ 'bentominder.state': text(legacy()) });
    storage.failWrites = true;
    await expect(adoptLegacyStore(storage, clock, A)).rejects.toThrow('QuotaExceededError');
    expect(storage.data.has('bentominder.state')).toBe(true);
    expect(storage.data.has(keysA.state)).toBe(false);
  });

  it('US-E13-04/AC1 the legacy keys stay when the read-back differs from what was written', async () => {
    const storage = memoryStorage({ 'bentominder.state': text(legacy()) });
    const flaky: Storage = { ...storage, read: async (k) => ((await storage.read(k)) !== null && k === keysA.state ? 'tampered' : storage.read(k)) };
    await expect(adoptLegacyStore(flaky, clock, A)).rejects.toThrow('adoption-readback-mismatch');
    expect(storage.data.has('bentominder.state')).toBe(true);
    expect(storage.data.has(keysA.state)).toBe(false);
  });

  it('US-E13-04/AC1 an unreadable legacy document is left alone and not adopted', async () => {
    const storage = memoryStorage({ 'bentominder.state': '{broken' });
    expect(await adoptLegacyStore(storage, clock, A)).toEqual({ kind: 'legacy-unreadable' });
    expect(storage.data.get('bentominder.state')).toBe('{broken');
    expect(storage.data.has(keysA.state)).toBe(false);
  });

  it('US-E13-04/AC1 a crash after writing but before removing the legacy keys is finished by the same account only', async () => {
    const storage = memoryStorage({ 'bentominder.state': text(legacy()) });
    await adoptLegacyStore(storage, clock, A);
    storage.data.set('bentominder.state', text(legacy())); // leftover as after a crash
    expect(await adoptLegacyStore(storage, clock, A)).toEqual({ kind: 'account-has-data', cleanedLeftover: true });
    expect(storage.data.has('bentominder.state')).toBe(false);
  });

  it('US-E13-04/AC2 adoption happens once: account B starts empty and never receives A\'s data', async () => {
    const storage = memoryStorage({ 'bentominder.state': text(legacy()) });
    await adoptLegacyStore(storage, clock, A);
    expect(await adoptLegacyStore(storage, clock, B)).toEqual({ kind: 'none' });
    expect(await createRepository(storage, clock, { accountId: B }).load()).toEqual({ kind: 'empty' });
    expect(storage.data.has(keysB.state)).toBe(false);
  });

  it('US-E13-04/AC2 a second sign-in by A does not adopt again and leaves A\'s data as it was', async () => {
    const storage = memoryStorage({ 'bentominder.state': text(legacy()) });
    await adoptLegacyStore(storage, clock, A);
    const kept = storage.data.get(keysA.state);
    expect(await adoptLegacyStore(storage, clock, A)).toEqual({ kind: 'account-has-data', cleanedLeftover: false });
    expect(storage.data.get(keysA.state)).toBe(kept);
  });

  it('US-E13-04/AC3 the same account returns to exactly its data after another account used the device', async () => {
    const storage = memoryStorage();
    const mine = forAccount(A);
    mine.settings.reminders.dayBefore.time = '19:45';
    await createRepository(storage, clock, { accountId: A }).save(mine);
    const other = forAccount(B);
    await createRepository(storage, clock, { accountId: B }).save({ ...other, aiUsage: { '2026-11': 1 } });
    expect(await createRepository(storage, clock, { accountId: A }).load()).toEqual({ kind: 'ok', state: mine });
  });

  it('US-E13-04/AC4 a different account sees none of A\'s data and A\'s keys are never read', async () => {
    const storage = memoryStorage({ [keysA.state]: text(forAccount(A)), [keysA.prev]: text(forAccount(A)) });
    const { s, reads } = spy(storage);
    const repo = createRepository(s, clock, { accountId: B });
    expect(await repo.load()).toEqual({ kind: 'empty' });
    await repo.save(forAccount(B));
    expect(reads.some((k) => k.includes(A))).toBe(false);
    expect(JSON.stringify(JSON.parse(storage.data.get(keysB.state)!))).not.toContain(A);
  });

  it('US-E13-04/AC5 every record in an account store carries the uid; a store with another ownerId is refused on save and load', async () => {
    expect(ownerMismatches(forAccount(A), A)).toEqual([]);
    const wrong = clone(forAccount(A));
    wrong.settings.ownerId = 'local';
    const first = Object.keys(wrong.decisions)[0]!;
    wrong.decisions[first]!.ownerId = 'someone@example.test';
    expect(ownerMismatches(wrong, A).map((i) => i.path)).toEqual(['settings.ownerId', `decisions.${first}.ownerId`]);
    const storage = memoryStorage();
    const repo = createRepository(storage, clock, { accountId: A });
    await expect(repo.save(wrong)).rejects.toBeInstanceOf(StoreValidationError);
    await expect(repo.save(wrong)).rejects.toThrow('meta-owner-matches-account');
    expect(storage.data.size).toBe(0);
    const poisoned = memoryStorage({ [keysA.state]: text(wrong) });
    expect(await createRepository(poisoned, clock, { accountId: A }).load()).toMatchObject({ kind: 'corrupt', reason: 'schema-invalid' });
  });

  it('US-E13-04/AC5 the ownerId of an account store is the uid, never an e-mail address', () => {
    expect(ownerMismatches(forAccount(A), 'parent@example.test').length).toBeGreaterThan(0);
  });

  it('US-E13-04/AC6 export reads only the account store and delete-all removes only the account\'s two keys', async () => {
    const storage = memoryStorage({
      [keysA.state]: text(forAccount(A)),
      [keysA.prev]: text(forAccount(A)),
      [keysB.state]: text(forAccount(B)),
      [keysB.prev]: text(forAccount(B)),
      'bentominder.state': text(legacy()),
    });
    const repoA = createRepository(storage, clock, { accountId: A });
    const loaded = await repoA.load();
    if (loaded.kind !== 'ok') throw new Error('expected ok');
    expect(repoA.exportJson(loaded.state)).not.toContain(B);
    await expect(() => repoA.exportJson(forAccount(B))).toThrow(StoreValidationError);
    await repoA.deleteAll();
    expect([...storage.data.keys()].sort()).toEqual([keysB.prev, keysB.state, 'bentominder.state'].sort());
  });

  it('US-E13-04/AC6 a file imported while signed in becomes this account\'s data (ownerId rewritten to the uid)', () => {
    const repo = createRepository(memoryStorage(), clock, { accountId: A });
    const result = repo.importJson(text(legacy()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(ownerMismatches(result.state, A)).toEqual([]);
  });

  it('US-E13-04/AC3 the existing single-key behaviour is unchanged when no account is given', async () => {
    const storage = memoryStorage();
    await createRepository(storage, clock).save(legacy());
    expect(storage.data.has('bentominder.state')).toBe(true);
    expect(await createRepository(storage, clock).load()).toEqual({ kind: 'ok', state: legacy() });
  });
});

describe('US-E13-06/AC1 only the uid is stored by the app', () => {
  it('US-E13-06/AC1 no name, e-mail or photo URL appears in the account store or its export', async () => {
    const storage = memoryStorage({ 'bentominder.state': text(legacy()) });
    await adoptLegacyStore(storage, clock, A);
    const repo = createRepository(storage, clock, { accountId: A });
    const loaded = await repo.load();
    if (loaded.kind !== 'ok') throw new Error('expected ok');
    const blob = [...storage.data.values()].join('\n') + repo.exportJson(loaded.state);
    for (const secret of ['Test Parent', 'parent@example.test', 'photoUrl']) expect(blob).not.toContain(secret);
  });
});
