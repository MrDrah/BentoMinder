// Contract 14.2 (what syncs), 14.6 (valid after every apply), US-E15-07/AC10, US-E15-06/AC9 and AC11.
import { describe, expect, it } from 'vitest';
import { displayedDecision } from '../../../../src/domain/decision/decision.ts';
import type { LocalDate } from '../../../../src/domain/time/jst.ts';
import { validateStore } from '../../../../src/domain/storage/repository.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { liveEnvelope, tombstoneEnvelope } from '../../../../src/domain/sync/envelope.ts';
import { applyEnvelopes, extractRecords } from '../../../../src/domain/sync/records.ts';
import { ownerMismatchesFor } from '../../../../src/domain/sync/owner.ts';
import type { Envelope } from '../../../../src/domain/sync/types.ts';
import { DEVICE_A, DEVICE_B, MIN, T0, UID1, clearDecision, setDecision, setNote, setWeeklyTime, storeWithData, ts } from './helpers.ts';

const FAM = 'fam-test-001';
const base = (): BentoMinderStore => storeWithData(DEVICE_A, FAM);
const env = (store: BentoMinderStore, key: string, atMs: number, device = DEVICE_B): Envelope => {
  const r = extractRecords(store).get(key);
  if (r === undefined) throw new Error(`no ${key}`);
  return liveEnvelope({ kind: r.kind, key: r.key, payloadJson: r.payloadJson, updatedAt: ts(atMs), updatedBy: 'test-uid-002', deviceId: device });
};
const apply = (s: BentoMinderStore, es: Envelope[]) => applyEnvelopes(s, es, { ownerId: FAM, allowedOwnerIds: [UID1, FAM] });

describe('what syncs and what stays on the device (contract 14.2)', () => {
  it('US-E15-06/AC11 reminderLog, consent, nextMonthCardHiddenOn, deviceId, language and theme are never extracted', () => {
    const s = base();
    const all = [...extractRecords(s).values()].map((r) => r.payloadJson).join('\n');
    expect(all).not.toContain(DEVICE_A);
    expect(all).not.toContain('reminderLog');
    expect(all).not.toContain('aiNoticeVersion');
    expect(all).not.toContain('nextMonthCardHiddenOn');
    expect(all).not.toContain('"language"');
    expect(all).not.toContain('"theme":"auto"');
  });

  it('US-E15-06/AC11 the reminder settings (weekday, times, enabled) do sync', () => {
    const s = setWeeklyTime(base(), '15:30', T0);
    expect(extractRecords(s).get('settings_settings')?.payloadJson).toContain('"time":"15:30"');
  });

  it('US-E15-05/AC7 one record per profile, settings, month, override, decision, aiUsage month', () => {
    expect([...extractRecords(base()).keys()].sort()).toEqual([
      'aiUsage_2026-11', 'decision_2026-11-04', 'decision_2026-11-05', 'menu_2026-11', 'override_2026-11-05', 'profile_profile', 'settings_settings',
    ]);
  });

  it('extracting is deterministic: key order of the store does not change the payload text', () => {
    const a = base();
    const b = JSON.parse(JSON.stringify(a), (_k, v: unknown) => (typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)) as BentoMinderStore;
    expect(Object.fromEntries(extractRecords(a))).toEqual(Object.fromEntries(extractRecords(b)));
  });
});

describe('applying winners (US-E15-07/AC10)', () => {
  it('US-E15-05/AC7 changes made on another device arrive: decision, setting, profile', () => {
    const remote = setNote(setWeeklyTime(setDecision(base(), '2026-11-18', 'homemade-bento-planned', T0 + MIN), '15:30', T0 + MIN), '新しいメモ', T0 + MIN);
    const winners = ['decision_2026-11-18', 'settings_settings', 'profile_profile'].map((k) => env(remote, k, T0 + MIN));
    const r = apply(base(), winners);
    expect(r.quarantined).toEqual([]);
    expect(r.changed.sort()).toEqual(['decision_2026-11-18', 'profile_profile', 'settings_settings']);
    expect(r.store.decisions['2026-11-18']?.state).toBe('homemade-bento-planned');
    expect(r.store.settings.reminders.weekly.time).toBe('15:30');
    expect(r.store.profile?.note).toBe('新しいメモ');
    expect(validateStore(r.store).ok).toBe(true);
  });

  it('US-E15-06/AC11 an applied settings record keeps this device language, theme and the device-only parts', () => {
    const local = { ...base(), settings: { ...base().settings, language: 'en' as const, theme: 'dark' as const } };
    const remote = setWeeklyTime(base(), '16:00', T0 + MIN);
    const r = apply(local, [env(remote, 'settings_settings', T0 + MIN)]);
    expect(r.store.settings.language).toBe('en');
    expect(r.store.settings.theme).toBe('dark');
    expect(r.store.settings.reminders.weekly.time).toBe('16:00');
    expect(r.store.reminderLog).toEqual(local.reminderLog);
    expect(r.store.consent).toEqual(local.consent);
    expect(r.store.deviceId).toBe(DEVICE_A);
  });

  it('US-E15-11/AC3 every applied record takes the family id as ownerId', () => {
    const remote = storeWithData(DEVICE_B, 'someone-else');
    const r = apply(base(), [env(remote, 'profile_profile', T0 + MIN), env(remote, 'menu_2026-11', T0 + MIN)]);
    expect(r.store.profile?.ownerId).toBe(FAM);
    expect(r.store.menus['2026-11']?.ownerId).toBe(FAM);
    expect(ownerMismatchesFor(r.store, [UID1, FAM])).toEqual([]);
  });

  it('US-E15-07/AC4 a tombstone removes the record: decision, override, menu, profile', () => {
    const t = (kind: Envelope['kind'], key: string) => tombstoneEnvelope({ kind, key, updatedAt: ts(T0), updatedBy: 'test-uid-002', deviceId: DEVICE_B });
    const r = apply(base(), [t('decision', '2026-11-04'), t('override', '2026-11-05'), t('menu', '2026-11'), t('profile', 'profile')]);
    expect(r.store.decisions['2026-11-04']).toBeUndefined();
    expect(r.store.decisions['2026-11-05']).toBeDefined();
    expect(r.store.overrides).toEqual({});
    expect(r.store.menus).toEqual({});
    expect(r.store.profile).toBeNull();
    expect(r.changed.sort()).toEqual(['decision_2026-11-04', 'menu_2026-11', 'override_2026-11-05', 'profile_profile']);
    expect(validateStore(r.store).ok).toBe(true);
  });

  it('US-E15-07/AC4 a tombstone for settings or a missing record changes nothing', () => {
    const t = (kind: Envelope['kind'], key: string) => tombstoneEnvelope({ kind, key, updatedAt: ts(T0), updatedBy: 'u', deviceId: DEVICE_B });
    const s = base();
    const r = apply(s, [t('settings', 'settings'), t('decision', '2026-11-20')]);
    expect(r.changed).toEqual([]);
    expect(r.store).toEqual(s);
  });

  it('US-E15-07/AC10 a decision whose menu or recipe no longer resolves is stored as is and shown dormant, never a crash', () => {
    const s = base();
    const t = tombstoneEnvelope({ kind: 'menu', key: '2026-11', updatedAt: ts(T0), updatedBy: 'u', deviceId: DEVICE_B });
    const r = apply(setDecision(s, '2026-11-18', 'school-lunch-planned', T0 - MIN), [t]);
    expect(r.store.menus).toEqual({});
    const kept = r.store.decisions['2026-11-18'];
    expect(kept?.state).toBe('school-lunch-planned');
    expect(validateStore(r.store).ok).toBe(true);
    const shown = displayedDecision({ date: '2026-11-18' as LocalDate, kind: 'not-in-menu', menuVersion: null, changedInCurrentVersion: false }, kept);
    expect(shown).toMatchObject({ state: null, conflict: 'dormant' });
    // a planned bento stays visible with a plan-date-removed conflict instead of vanishing
    const bento = displayedDecision({ date: '2026-11-18' as LocalDate, kind: 'not-in-menu', menuVersion: null, changedInCurrentVersion: false }, r.store.decisions['2026-11-04']);
    expect(bento.conflict).toBe('plan-date-removed');
  });

  it('US-E15-06/AC9 a record that fails validation is not stored; the local version is kept; others still apply', () => {
    const remote = setDecision(base(), '2026-11-18', 'not-confirmed', T0 + MIN);
    const good = env(remote, 'decision_2026-11-18', T0 + MIN);
    const bad = { ...env(base(), 'profile_profile', T0 + MIN), payloadJson: JSON.stringify({ ...JSON.parse(extractRecords(base()).get('profile_profile')?.payloadJson ?? '{}'), allergyStatus: 'none-known' }) };
    const local = base();
    const r = apply(local, [bad, good]);
    expect(r.quarantined).toEqual([{ key: 'profile_profile', rule: 'sync-payload-valid', reason: 'profile-allergy-status' }]);
    expect(r.store.profile).toEqual(local.profile);
    expect(r.store.decisions['2026-11-18']).toBeDefined();
  });

  it('US-E15-07/AC10 a cross-record failure of the whole-store check quarantines the records one by one and leaves the store valid', () => {
    const s = base();
    const remote = setDecision(base(), '2026-11-18', 'not-confirmed', T0 + MIN);
    // ownerId that the whole-store check does not accept: every record fails the check, none is applied
    const r = applyEnvelopes(s, [env(remote, 'decision_2026-11-18', T0 + MIN)], { ownerId: 'fam-other', allowedOwnerIds: ['not-this'] });
    expect(r.quarantined.map((q) => q.rule)).toEqual(['store-invalid-after-apply']);
    expect(r.store).toBe(s);
    expect(r.changed).toEqual([]);
  });

  it('US-E15-07/AC7 a record stored with a clamped updatedAt: the local record adopts the stored stamp', () => {
    const future = setDecision(base(), '2026-11-18', 'not-confirmed', T0 + 2 * 86_400_000);
    const clamped = env(future, 'decision_2026-11-18', T0); // envelope clamped to receive time, payload still future
    const r = apply(base(), [clamped]);
    const d = r.store.decisions['2026-11-18'];
    expect(d?.updatedAt).toBe(ts(T0));
    expect(Date.parse(d?.createdAt ?? '')).toBeLessThanOrEqual(T0);
    expect(validateStore(r.store).ok).toBe(true);
  });

  it('US-E15-07/AC10 the store meta updatedAt follows the newest applied stamp and stays valid', () => {
    const remote = setDecision(base(), '2026-11-18', 'not-confirmed', T0 + 5 * MIN);
    const r = apply(base(), [env(remote, 'decision_2026-11-18', T0 + 5 * MIN)]);
    expect(Date.parse(r.store.updatedAt)).toBe(T0 + 5 * MIN);
    expect(r.store.updatedAt >= r.store.createdAt).toBe(true);
  });

  it('applying aiUsage sets the month count', () => {
    const e = liveEnvelope({ kind: 'aiUsage', key: '2026-10', payloadJson: '{"count":4}', updatedAt: ts(T0), updatedBy: 'u', deviceId: DEVICE_B });
    expect(apply(base(), [e]).store.aiUsage).toEqual({ '2026-11': 1, '2026-10': 4 });
  });

  it('clearing a decision locally and extracting again drops its record key', () => {
    expect(extractRecords(clearDecision(base(), '2026-11-04', T0)).has('decision_2026-11-04')).toBe(false);
  });
});

describe('ownerMismatchesFor (contract 14.7)', () => {
  it('US-E15-11/AC3 accepts the uid or the family id and no other value', () => {
    expect(ownerMismatchesFor(storeWithData(DEVICE_A, UID1), [UID1, FAM])).toEqual([]);
    expect(ownerMismatchesFor(storeWithData(DEVICE_A, FAM), [UID1, FAM])).toEqual([]);
    const other = storeWithData(DEVICE_A, 'someone-else');
    expect(ownerMismatchesFor(other, [UID1, FAM]).length).toBeGreaterThan(0);
    expect(ownerMismatchesFor(other, [UID1, FAM]).every((i) => i.rule === 'meta-owner-matches-account')).toBe(true);
    expect(ownerMismatchesFor(other, []).length).toBeGreaterThan(0);
  });

  it('US-E15-11/AC3 a mixed store (one record with a stranger owner) fails only for that record', () => {
    const s = storeWithData(DEVICE_A, FAM);
    const mixed = { ...s, profile: s.profile === null ? null : { ...s.profile, ownerId: 'stranger' } };
    expect(ownerMismatchesFor(mixed, [UID1, FAM]).map((i) => i.path)).toEqual(['profile.ownerId']);
  });
});
