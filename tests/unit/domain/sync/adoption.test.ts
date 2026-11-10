// Contract 14.4: first sync and adoption of local data. US-E15-04 (AC3-AC7, AC11), US-E15-05/AC6, US-E15-01/AC3.
import { describe, expect, it } from 'vitest';
import { adoptFamilyData, adoptionInterrupted, adoptionQuestionNeeded, familyHasData, hasData, planFirstSync, safetyCopyExpired } from '../../../../src/domain/sync/adoption.ts';
import { emptySyncMeta } from '../../../../src/domain/sync/meta.ts';
import { FakeBackend } from '../../../../src/domain/sync/fake-port.ts';
import { validateStore } from '../../../../src/domain/storage/repository.ts';
import type { StoredEnvelope } from '../../../../src/domain/sync/types.ts';
import { DAY, DEVICE_A, DEVICE_B, MIN, SEC, SimDevice, T0, UID1, UID2, adopt, clearDecision, emptyStore, familyOfTwo, setDecision, setNote, settle, storeWithData, syncedView, testClock, ts } from './helpers.ts';

describe('"has data" and the first-sync matrix (contract 14.4)', () => {
  it('US-E15-04/AC3 has data: a profile, or a menu month, decision or override; defaults-only settings do not count', () => {
    const empty = emptyStore(DEVICE_A, UID1);
    const full = storeWithData(DEVICE_A, UID1);
    expect(hasData(empty)).toBe(false);
    expect(hasData({ ...empty, settings: { ...empty.settings, updatedAt: ts(T0) } })).toBe(false);
    expect(hasData({ ...full, menus: {}, decisions: {}, overrides: {} })).toBe(true); // profile
    expect(hasData({ ...full, profile: null, decisions: {}, overrides: {} })).toBe(true); // menu
    expect(hasData({ ...full, profile: null, menus: {}, overrides: {} })).toBe(true); // decision
    expect(hasData({ ...full, profile: null, menus: {}, decisions: {} })).toBe(true); // override
    expect(hasData({ ...full, profile: null, menus: {}, decisions: {}, overrides: {} })).toBe(false);
  });

  it('US-E15-04/AC3 AC4 AC7 US-E15-05/AC6 the matrix: empty local downloads, data and empty family uploads, both have data asks', () => {
    expect(planFirstSync(false, false)).toBe('download');
    expect(planFirstSync(false, true)).toBe('download');
    expect(planFirstSync(true, false)).toBe('upload');
    expect(planFirstSync(true, true)).toBe('ask');
  });

  it('US-E15-04/AC7 the family has data when a live profile, menu, decision or override exists, not for settings, aiUsage or tombstones', async () => {
    const clock = testClock();
    const { backend, familyId } = await familyOfTwo(clock);
    const all = [...(backend.families.get(familyId)?.records.values() ?? [])];
    expect(familyHasData(all)).toBe(true);
    expect(familyHasData(all.filter((e) => e.kind === 'settings' || e.kind === 'aiUsage'))).toBe(false);
    expect(familyHasData(all.map((e) => ({ ...e, deletedAt: e.updatedAt })))).toBe(false);
    expect(familyHasData([])).toBe(false);
  });

  it('US-E15-04/AC11 US-E15-05/AC6 the question is asked once per device and family; an interrupted join resumes without asking again', () => {
    const meta = emptySyncMeta();
    expect(adoptionQuestionNeeded(meta, 'fam-test-001')).toBe(true);
    const started = { ...meta, adoption: { familyId: 'fam-test-001', choice: 'add-device' as const, done: false } };
    expect(adoptionQuestionNeeded(started, 'fam-test-001')).toBe(false);
    expect(adoptionInterrupted(started, 'fam-test-001')).toBe(true);
    const done = { ...started, adoption: { ...started.adoption, done: true } };
    expect(adoptionInterrupted(done, 'fam-test-001')).toBe(false);
    expect(adoptionQuestionNeeded(done, 'fam-test-002')).toBe(true);
    expect(adoptionInterrupted(meta, 'fam-test-001')).toBe(false);
  });
});

describe('join with an empty local copy (US-E15-04/AC3)', () => {
  it('US-E15-04/AC3 the device ends with the same profile, menus, decisions, overrides and settings as the other member, uploads nothing, and keeps its own device fields', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    expect(syncedView(b.store)).toEqual(syncedView(a.store));
    expect(b.store.deviceId).toBe(DEVICE_B);
    expect(b.store.settings.language).toBe('ja');
    clock.advance(20 * SEC);
    const r = await b.sync();
    expect(r.pushed).toEqual([]);
    expect(r.pendingCount).toBe(0);
    expect(validateStore(b.store).ok).toBe(true);
  });
});

describe('join with data on both sides (US-E15-04/AC5, AC6; US-E15-05/AC6)', () => {
  /** A family that holds a profile, the settings and one decision (2026-11-04, school lunch); the joiner holds a full different store. */
  async function scenario() {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const base = storeWithData(DEVICE_A, UID1);
    const small = setDecision({ ...base, menus: {}, overrides: {}, decisions: {}, aiUsage: {} }, '2026-11-04', 'school-lunch-planned', T0 - DAY);
    const a = new SimDevice(backend, UID1, { ...small, settings: { ...small.settings, updatedAt: ts(T0 - DAY) } }, clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.enter(familyId);
    await a.sync();
    const mine = setNote(storeWithData(DEVICE_B, UID2), '自分のメモ', T0 - 2 * DAY);
    const b = new SimDevice(backend, UID2, mine, clock);
    await b.fake.redeemInvite((await a.fake.createInvite()).code, { version: 1 });
    b.enter(familyId);
    return { clock, backend, a, b, familyId, mine };
  }

  it('US-E15-04/AC5 keep the family: the local copy is replaced, nothing from it is uploaded, no pending record is left', async () => {
    const { clock, a, b, backend, familyId } = await scenario();
    const before = backend.families.get(familyId)?.records.size;
    const out = await adopt(b, 'use-family', clock);
    expect(out.added).toEqual([]);
    expect(b.store.profile?.note).toBe(a.store.profile?.note);
    expect(b.store.decisions['2026-11-04']?.state).toBe('school-lunch-planned');
    expect(b.store.decisions['2026-11-05']).toBeUndefined();
    expect(b.store.menus).toEqual({});
    expect(b.store.overrides).toEqual({});
    clock.advance(20 * SEC);
    const r = await b.sync();
    expect(r.pushed).toEqual([]);
    expect(backend.families.get(familyId)?.records.size).toBe(before);
    expect(validateStore(b.store).ok).toBe(true);
    expect(b.store.deviceId).toBe(DEVICE_B);
  });

  it('US-E15-04/AC5 the previous local copy is available for the safety copy: the caller still has it (the adoption returns a new store)', async () => {
    const { clock, b, mine } = await scenario();
    await adopt(b, 'use-family', clock);
    expect(b.store).not.toBe(mine);
    expect(mine.profile?.note).toBe('自分のメモ');
    expect(mine.decisions['2026-11-05']).toBeDefined();
  });

  it('US-E15-04/AC6 add this device: the family profile, settings and shared keys stay; keys the family lacks are added and uploaded', async () => {
    const { clock, a, b, backend, familyId } = await scenario();
    const familyProfile = a.store.profile;
    const out = await adopt(b, 'add-device', clock);
    expect(b.store.profile?.note).toBe(familyProfile?.note);
    expect(b.store.profile?.note).not.toBe('自分のメモ');
    expect(b.store.decisions['2026-11-04']?.state).toBe('school-lunch-planned'); // both had it: the family's stays
    expect(b.store.decisions['2026-11-05']).toBeDefined(); // the family lacked it: added
    expect(Object.keys(b.store.menus)).toEqual(['2026-11']);
    expect(Object.keys(b.store.overrides)).toEqual(['2026-11-05']);
    expect(out.added).toEqual(['aiUsage_2026-11', 'decision_2026-11-05', 'menu_2026-11', 'override_2026-11-05']);
    clock.advance(20 * SEC);
    const r = await b.sync();
    expect(r.pushed.sort()).toEqual(out.added);
    clock.advance(20 * SEC);
    await settle([a, b], clock);
    expect(syncedView(a.store)).toEqual(syncedView(b.store));
    expect(a.store.decisions['2026-11-04']?.state).toBe('school-lunch-planned');
    expect(Object.keys(a.store.menus)).toEqual(['2026-11']);
    expect(backend.families.get(familyId)?.records.get('profile_profile')?.deviceId).toBe(DEVICE_A);
  });

  it('US-E15-04/AC6 profile and settings are never merged field by field', async () => {
    const { clock, b, a } = await scenario();
    await adopt(b, 'add-device', clock);
    expect(b.store.profile).toEqual({ ...a.store.profile });
    expect(b.store.settings.reminders).toEqual(a.store.settings.reminders);
  });

  it('US-E15-04/AC6 a profile or settings record the family lacks is added from the device', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = new SimDevice(backend, UID1, setDecision(emptyStore(DEVICE_A, UID1), '2026-11-04', 'school-lunch-planned', T0 - DAY), clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.enter(familyId);
    await a.sync();
    const b = new SimDevice(backend, UID2, storeWithData(DEVICE_B, UID2), clock);
    await b.fake.redeemInvite((await a.fake.createInvite()).code, { version: 1 });
    b.enter(familyId);
    const out = await adopt(b, 'add-device', clock);
    expect(out.added).toContain('profile_profile');
    expect(b.store.profile).not.toBeNull();
  });

  it('US-E15-04/AC6 a record the family deleted (a tombstone) stays deleted: the device copy of that key is not added back', async () => {
    const { clock, a, b } = await scenario();
    clock.advance(20 * SEC);
    a.edit((s) => clearDecision(s, '2026-11-04', clock.now));
    await a.sync();
    const out = await adopt(b, 'add-device', clock);
    expect(b.store.decisions['2026-11-04']).toBeUndefined();
    expect(out.added).not.toContain('decision_2026-11-04');
    expect(out.baselines['decision_2026-11-04']).toMatchObject({ deleted: true });
    clock.advance(20 * SEC);
    expect((await b.sync()).pushed).not.toContain('decision_2026-11-04');
  });

  it('US-E15-04/AC6 the aiUsage count is the larger of the two', () => {
    const local = { ...storeWithData(DEVICE_B, UID2), aiUsage: { '2026-11': 5, '2026-10': 1 } };
    const fam = (count: number): StoredEnvelope => ({ kind: 'aiUsage', key: '2026-11', payloadJson: `{"count":${count}}`, updatedAt: ts(T0), updatedAtMs: T0, updatedBy: UID1, deviceId: DEVICE_A, seq: 1 });
    const bigger = adoptFamilyData({ local, family: [fam(3)], choice: 'add-device', familyId: 'fam-test-001', nowMs: T0 });
    expect(bigger.store.aiUsage['2026-11']).toBe(5);
    expect(bigger.added).toContain('aiUsage_2026-11');
    const smaller = adoptFamilyData({ local, family: [fam(9)], choice: 'add-device', familyId: 'fam-test-001', nowMs: T0 });
    expect(smaller.store.aiUsage['2026-11']).toBe(9);
    expect(smaller.added).not.toContain('aiUsage_2026-11');
    expect(smaller.store.aiUsage['2026-10']).toBe(1);
  });

  it('US-E15-05/AC6 a further device of a member with different local data goes through the same choice (same account, another phone)', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    const phone2 = new SimDevice(backend, UID1, setNote(storeWithData('c0000000-0000-4000-8000-00000000000c', UID1), '別の端末', T0 - 3 * DAY), clock).enter(familyId);
    expect(adoptionQuestionNeeded(phone2.meta, familyId)).toBe(true);
    const out = await adopt(phone2, 'use-family', clock);
    expect(out.added).toEqual([]);
    expect(phone2.store.profile?.note).toBe(a.store.profile?.note);
    expect(adoptionQuestionNeeded(phone2.meta, familyId)).toBe(false);
  });
});

describe('local data and an empty family (US-E15-04/AC7, US-E15-01/AC3)', () => {
  it('US-E15-04/AC7 no question: everything the joiner has is uploaded after consent, with its own timestamps', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn });
    const a = new SimDevice(backend, UID1, emptyStore(DEVICE_A, UID1), clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.enter(familyId);
    await a.sync();
    const b = new SimDevice(backend, UID2, storeWithData(DEVICE_B, UID2), clock);
    await b.fake.redeemInvite((await a.fake.createInvite()).code, { version: 1 });
    b.enter(familyId);
    expect(planFirstSync(hasData(b.store), familyHasData([...(backend.families.get(familyId)?.records.values() ?? [])]))).toBe('upload');
    clock.advance(20 * SEC);
    const r = await b.sync();
    expect(r.pushed.sort()).toEqual(['aiUsage_2026-11', 'decision_2026-11-04', 'decision_2026-11-05', 'menu_2026-11', 'override_2026-11-05', 'profile_profile']);
    const stored = backend.families.get(familyId)?.records.get('decision_2026-11-04');
    expect(stored?.updatedAt).toBe(b.store.decisions['2026-11-04']?.updatedAt);
    expect(stored?.updatedAt).toBe('2026-11-01T10:12:00+09:00');
  });
});

describe('safety copy (contract 14.4)', () => {
  it('US-E15-04/AC5 the safety copy expires after 30 days, not before', () => {
    expect(safetyCopyExpired(ts(T0), T0 + 30 * DAY - MIN)).toBe(false);
    expect(safetyCopyExpired(ts(T0), T0 + 30 * DAY)).toBe(true);
    expect(safetyCopyExpired(ts(T0), T0 + 31 * DAY)).toBe(true);
  });
});
