// E13-D02 (QA): every record created while an account is signed in carries that account's uid, so the
// repository's meta-owner-matches-account rule accepts the save (ADR 014, US-E13-04/AC5, AC4).
import { describe, expect, it } from 'vitest';
import { setOverride } from '../../../../src/domain/assessment/override.ts';
import { applyDecisionEvent } from '../../../../src/domain/decision/apply.ts';
import { storeConfirmedMenu } from '../../../../src/domain/menu/store-ops.ts';
import { emptyProfileForm, formToProfile, saveProfile } from '../../../../src/domain/profile/profile.ts';
import { createEmptyStore } from '../../../../src/domain/storage/defaults.ts';
import { rewriteOwnerId } from '../../../../src/domain/storage/owner.ts';
import { createRepository } from '../../../../src/domain/storage/repository.ts';
import { storeKeysFor } from '../../../../src/domain/storage/keys.ts';
import { ownerMismatches } from '../../../../src/domain/schema/store.ts';
import type { Instant, LocalDate } from '../../../../src/domain/time/jst.ts';
import { d, day, menu, storeWith } from '../../helpers/menus.ts';
import { fixedClock, memoryStorage } from '../../helpers/memory-storage.ts';

const UID = 'test-uid-002';
const NOW = Date.parse('2026-11-10T01:00:00Z') as Instant; // 2026-11-10 10:00 JST
const clock = fixedClock('2026-11-10T01:00:00Z');
const env = { today: '2026-11-10' as LocalDate, now: NOW, recipe: () => undefined };
const freshAccountStore = () => createEmptyStore({ deviceId: '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d', now: NOW, ownerId: UID });
const oneMenu = () => menu([day('2026-11-12', ['ごはん']), day('2026-11-13', ['ごはん'])], [], { version: 1 });

describe('US-E13-04/AC5 records created while signed in take the account uid', () => {
  it('US-E13-04/AC5 a brand-new account store is owned by the account and passes the owner rule', () => {
    const store = freshAccountStore();
    expect(store.settings.ownerId).toBe(UID);
    expect(ownerMismatches(store, UID)).toEqual([]);
  });

  it('US-E13-04/AC5 US-E13-01/AC4 a new account finishes onboarding step 1: the profile is saved with the uid', async () => {
    const form = { ...emptyProfileForm(), ageRange: 'age-4-5' as const, allergyStatus: 'none-known' as const };
    const r = formToProfile(form, NOW, null);
    if (!r.ok) throw new Error('form');
    const store = saveProfile(freshAccountStore(), r.profile, NOW);
    expect(store.profile?.ownerId).toBe(UID);
    const storage = memoryStorage();
    await createRepository(storage, clock, { accountId: UID }).save(store); // refused before the fix
    expect(storage.data.has(storeKeysFor(UID).state)).toBe(true);
  });

  it('US-E13-04/AC5 a menu month created by an import or confirmation takes the uid', async () => {
    const store = storeConfirmedMenu(freshAccountStore(), oneMenu(), NOW);
    expect(store.menus['2026-11']?.ownerId).toBe(UID);
    await createRepository(memoryStorage(), clock, { accountId: UID }).save(store);
  });

  it('US-E13-04/AC5 US-E13-04/AC4 a day decision created in an account store takes the uid and saves', async () => {
    const account = rewriteOwnerId(storeWith({ menus: [oneMenu()] }), UID);
    const r = applyDecisionEvent(account, d('2026-11-12'), { type: 'DEFER' }, env);
    if (!r.ok) throw new Error(r.error);
    expect(r.store.decisions['2026-11-12']?.ownerId).toBe(UID);
    const storage = memoryStorage();
    await createRepository(storage, clock, { accountId: UID }).save(r.store);
    expect(storage.data.has(storeKeysFor(UID).state)).toBe(true);
  });

  it('US-E13-04/AC5 a new override takes the uid', async () => {
    const account = rewriteOwnerId(storeWith({ menus: [oneMenu()] }), UID);
    const r = setOverride(account, d('2026-11-13'), 'low-preference', { today: env.today, now: NOW });
    if (!r.ok) throw new Error(r.rule);
    expect(r.store.overrides['2026-11-13']?.ownerId).toBe(UID);
    await createRepository(memoryStorage(), clock, { accountId: UID }).save(r.store);
  });

  it('US-E13-04/AC5 the repository tells the app which owner a fresh store needs: the uid, or local when unkeyed', () => {
    expect(createRepository(memoryStorage(), clock, { accountId: UID }).ownerId).toBe(UID);
    expect(createRepository(memoryStorage(), clock).ownerId).toBe('local');
  });

  it('US-E13-04/AC5 the owner rule is not weakened: a record owned by another account is still refused', async () => {
    const wrong = rewriteOwnerId(storeWith({ menus: [oneMenu()] }), 'test-uid-001');
    await expect(createRepository(memoryStorage(), clock, { accountId: UID }).save(wrong)).rejects.toThrow();
  });

  it('US-E13-04/AC5 signed-out code paths keep ownerId local', () => {
    const store = createEmptyStore({ deviceId: '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d', now: NOW });
    expect(store.settings.ownerId).toBe('local');
  });
});
