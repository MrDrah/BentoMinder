// Contract 14.2 / 14.15: validateEnvelope and its rule ids; 14.10 size limits; US-E15-09/AC6 (shape, shared with the Function).
import { describe, expect, it } from 'vitest';
import { liveEnvelope, tombstoneEnvelope, validateEnvelope, validatePayload, validateStoredEnvelope } from '../../../../src/domain/sync/envelope.ts';
import { extractRecords } from '../../../../src/domain/sync/records.ts';
import { SYNC_LIMITS } from '../../../../src/domain/sync/config.ts';
import { DEVICE_A, T0, UID1, storeWithData, ts } from './helpers.ts';

const store = storeWithData(DEVICE_A, 'fam-test-001');
const recs = extractRecords(store);
const rec = (key: string) => {
  const r = recs.get(key);
  if (r === undefined) throw new Error(key);
  return r;
};
const make = (key: string, extra: Record<string, unknown> = {}) => {
  const r = rec(key);
  return { ...liveEnvelope({ kind: r.kind, key: r.key, payloadJson: r.payloadJson, updatedAt: ts(T0), updatedBy: UID1, deviceId: 'device-A' }), ...extra };
};

describe('validateEnvelope', () => {
  it('US-E15-09/AC6 every record kind of a real store passes', () => {
    for (const key of recs.keys()) expect(validateEnvelope(make(key)).ok, key).toBe(true);
    expect([...recs.values()].map((r) => r.kind).sort()).toEqual(['aiUsage', 'decision', 'decision', 'menu', 'override', 'profile', 'settings']);
  });

  it('US-E15-09/AC6 sync-envelope-shape: unknown fields, kinds, keys and stamps are refused', () => {
    expect(validateEnvelope(make('profile_profile', { extra: 1 }))).toMatchObject({ ok: false, rule: 'sync-envelope-shape' });
    expect(validateEnvelope(make('profile_profile', { kind: 'recipe' }))).toMatchObject({ ok: false, rule: 'sync-envelope-shape' });
    expect(validateEnvelope(make('profile_profile', { key: 'other' }))).toMatchObject({ ok: false, rule: 'sync-envelope-shape' });
    expect(validateEnvelope(make('menu_2026-11', { key: '2026-13' }))).toMatchObject({ ok: false, rule: 'sync-envelope-shape' });
    expect(validateEnvelope(make('decision_2026-11-04', { key: '2026-02-30' }))).toMatchObject({ ok: false, rule: 'sync-envelope-shape' });
    expect(validateEnvelope(make('profile_profile', { updatedAt: 'yesterday' }))).toMatchObject({ ok: false });
    expect(validateEnvelope(make('profile_profile', { updatedAtMs: 1 }))).toMatchObject({ ok: false, reason: 'updatedAtMs' });
    expect(validateEnvelope(make('profile_profile', { updatedBy: '' }))).toMatchObject({ ok: false });
    expect(validateEnvelope(make('profile_profile', { deviceId: undefined }))).toMatchObject({ ok: false });
    expect(validateEnvelope(null)).toMatchObject({ ok: false });
    expect(validateEnvelope([])).toMatchObject({ ok: false });
  });

  it('US-E15-09/AC6 server-only fields are refused from a client and accepted on a downloaded record', () => {
    expect(validateEnvelope(make('profile_profile', { seq: 3 }))).toMatchObject({ ok: false, reason: 'unknown-field:seq' });
    expect(validateStoredEnvelope(make('profile_profile', { seq: 3 })).ok).toBe(true);
    expect(validateStoredEnvelope(make('profile_profile')).ok).toBe(false);
    expect(validateStoredEnvelope(make('profile_profile', { seq: -1 })).ok).toBe(false);
  });

  it('US-E15-06/AC9 sync-payload-valid: a payload that fails the contract rules is refused', () => {
    const bad = JSON.stringify({ ...JSON.parse(rec('profile_profile').payloadJson), allergyStatus: 'none-known' });
    expect(validateEnvelope(make('profile_profile', { payloadJson: bad }))).toMatchObject({ ok: false, rule: 'sync-payload-valid' });
    expect(validateEnvelope(make('profile_profile', { payloadJson: '{not json' }))).toMatchObject({ ok: false, rule: 'sync-payload-valid', reason: 'json-parse' });
    expect(validateEnvelope(make('profile_profile', { payloadJson: '[]' }))).toMatchObject({ ok: false, rule: 'sync-payload-valid' });
    expect(validateEnvelope(make('aiUsage_2026-11', { payloadJson: '{"count":-1}' }))).toMatchObject({ ok: false, rule: 'sync-payload-valid' });
    expect(validateEnvelope(make('aiUsage_2026-11', { payloadJson: '{"count":1,"x":2}' }))).toMatchObject({ ok: false });
  });

  it('US-E15-09/AC6 sync-payload-valid: device-only settings fields never travel', () => {
    const withLanguage = JSON.stringify({ ...JSON.parse(rec('settings_settings').payloadJson), language: 'en' });
    expect(validateEnvelope(make('settings_settings', { payloadJson: withLanguage }))).toMatchObject({ ok: false, reason: 'device-only-field' });
    expect(rec('settings_settings').payloadJson).not.toContain('"language"');
    expect(rec('settings_settings').payloadJson).not.toContain('"theme"');
  });

  it('US-E15-09/AC6 sync-key-matches-payload: key must equal payload.month / payload.date', () => {
    expect(validateEnvelope(make('menu_2026-11', { key: '2026-12' }))).toMatchObject({ ok: false, rule: 'sync-key-matches-payload' });
    expect(validateEnvelope(make('decision_2026-11-04', { key: '2026-11-05' }))).toMatchObject({ ok: false, rule: 'sync-key-matches-payload' });
    expect(validateEnvelope(make('override_2026-11-05', { key: '2026-11-06' }))).toMatchObject({ ok: false, rule: 'sync-key-matches-payload' });
    expect(validatePayload('menu', '2026-11', rec('menu_2026-11').payloadJson).ok).toBe(true);
  });

  it('US-E15-07/AC4 sync-tombstone-no-payload: a tombstone has deletedAt = updatedAt and no payload', () => {
    const t = tombstoneEnvelope({ kind: 'decision', key: '2026-11-04', updatedAt: ts(T0), updatedBy: UID1, deviceId: 'device-A' });
    expect(validateEnvelope(t).ok).toBe(true);
    expect(validateEnvelope({ ...t, payloadJson: '{}' })).toMatchObject({ ok: false, rule: 'sync-tombstone-no-payload' });
    expect(validateEnvelope({ ...t, deletedAt: ts(T0 + 1000) })).toMatchObject({ ok: false, rule: 'sync-envelope-shape' });
    expect(validateEnvelope({ ...make('decision_2026-11-04'), payloadJson: undefined })).toMatchObject({ ok: false, reason: 'payloadJson' });
  });

  it('US-E15-07/AC11 an aiUsage record is never deleted (merged by the larger count)', () => {
    const t = tombstoneEnvelope({ kind: 'aiUsage', key: '2026-11', updatedAt: ts(T0), updatedBy: UID1, deviceId: 'device-A' });
    expect(validateEnvelope(t)).toMatchObject({ ok: false, reason: 'aiUsage-tombstone' });
  });

  it('US-E15-10/AC1 size limit: a payload over 256 KiB is refused, exactly 256 KiB is not', () => {
    const base = JSON.parse(rec('profile_profile').payloadJson) as Record<string, unknown>;
    expect(SYNC_LIMITS.maxRecordBytes).toBe(262_144);
    // the note field is capped at 200 characters, so use a settings-shaped padding via a raw payload that stays valid:
    const big = JSON.stringify({ ...base }) + ' '.repeat(SYNC_LIMITS.maxRecordBytes);
    expect(validateEnvelope(make('profile_profile', { payloadJson: big }))).toMatchObject({ ok: false, reason: 'too-large' });
    const exact = JSON.stringify(base);
    const padded = exact + ' '.repeat(SYNC_LIMITS.maxRecordBytes - Buffer.byteLength(exact));
    expect(Buffer.byteLength(padded)).toBe(SYNC_LIMITS.maxRecordBytes);
    expect(validateEnvelope(make('profile_profile', { payloadJson: padded })).ok).toBe(true);
  });

  it('US-E15-10/AC1 the largest fixture record is far below the limit (measured, reported)', () => {
    const sizes = [...recs.values()].map((r) => Buffer.byteLength(r.payloadJson));
    expect(Math.max(...sizes)).toBeLessThan(SYNC_LIMITS.maxRecordBytes / 20);
  });
});
