// ADR 003 repository over an in-memory Storage: round trip, last-good copy, corrupt and
// too-new data, migrations with backup, refused writes, export/import, delete all.
import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../../src/domain/ports.ts';
import { createEmptyStore, defaultSettings } from '../../../src/domain/storage/defaults.ts';
import { migrate, MigrationError, migrations } from '../../../src/domain/storage/migrations/index.ts';
import { createRepository, StoreValidationError, validateStore } from '../../../src/domain/storage/repository.ts';
import type { Instant } from '../../../src/domain/time/jst.ts';
import { clone, storeV1 } from '../helpers/fixtures.ts';
import { fixedClock, memoryStorage } from '../helpers/memory-storage.ts';

const clock = fixedClock('2026-11-01T01:00:00Z'); // 2026-11-01 10:00 JST
const raw = (value: unknown) => JSON.stringify(value);

describe('US-E10-01/AC1 data stays on the device and survives reload (repository part)', () => {
  it('US-E10-01/AC1 a saved store with profile, menu, decisions, override and reminder times loads back exactly', async () => {
    const storage = memoryStorage();
    const state = storeV1();
    state.settings.reminders.dayBefore.time = '19:45';
    await createRepository(storage, clock).save(state);
    const reloaded = await createRepository(storage, clock).load();
    expect(reloaded).toEqual({ kind: 'ok', state });
  });

  it('US-E10-01/AC1 nothing stored means first launch', async () => {
    expect(await createRepository(memoryStorage(), clock).load()).toEqual({ kind: 'empty' });
  });

  it('US-E10-01/AC1 each save keeps the previous valid document as the last good copy', async () => {
    const storage = memoryStorage();
    const repo = createRepository(storage, clock);
    const first = storeV1();
    await repo.save(first);
    expect(storage.data.has('bentominder.state.prev')).toBe(false);
    const second = { ...storeV1(), aiUsage: { '2026-11': 2 } };
    await repo.save(second);
    expect(JSON.parse(storage.data.get('bentominder.state.prev')!)).toEqual(first);
    expect(JSON.parse(storage.data.get('bentominder.state')!)).toEqual(second);
  });

  it('US-E10-01/AC1 a corrupt current document is never copied over the last good copy', async () => {
    const good = raw(storeV1());
    const storage = memoryStorage({ 'bentominder.state': '{broken', 'bentominder.state.prev': good });
    await createRepository(storage, clock).save(storeV1());
    expect(storage.data.get('bentominder.state.prev')).toBe(good);
  });
});

describe('US-E10-02 versioned schema and migrations (repository part)', () => {
  it('US-E10-02/AC2 an older store is migrated once, with the original kept as a backup, and all decisions preserved', async () => {
    const v1 = storeV1();
    const v0 = { ...clone(v1), schemaVersion: 0, plans: v1.decisions } as Record<string, unknown>;
    delete v0['decisions'];
    const testMigrations = {
      0: (doc: Record<string, unknown>) => {
        const { plans, ...rest } = doc;
        return { ...rest, decisions: plans };
      },
    };
    const original = raw(v0);
    const storage = memoryStorage({ 'bentominder.state': original });
    const result = await createRepository(storage, clock, { migrations: testMigrations }).load();
    expect(result).toEqual({ kind: 'ok', state: v1, migratedFrom: 0 });
    expect(storage.data.get('bentominder.state.prev')).toBe(original);
    expect(JSON.parse(storage.data.get('bentominder.state')!).decisions).toEqual(v1.decisions);
    const again = await createRepository(storage, clock, { migrations: testMigrations }).load();
    expect(again).toEqual({ kind: 'ok', state: v1 });
  });

  it('US-E10-02/AC3 a store from a newer version is reported and nothing is written', async () => {
    const text = raw({ ...storeV1(), schemaVersion: 99 });
    const storage = memoryStorage({ 'bentominder.state': text });
    // The raw text comes back so the recovery screen can offer it as an export (US-E10-02/AC3).
    expect(await createRepository(storage, clock).load()).toEqual({ kind: 'too-new', version: 99, raw: text });
    expect(storage.writes).toBe(0);
  });

  it('US-E10-02/AC4 unparseable JSON with no good copy opens recovery and writes nothing', async () => {
    const storage = memoryStorage({ 'bentominder.state': '{"schemaVersion":1,' });
    expect(await createRepository(storage, clock).load()).toEqual({ kind: 'corrupt', raw: '{"schemaVersion":1,', reason: 'json-parse' });
    expect(storage.writes).toBe(0);
  });

  it('US-E10-02/AC4 a document that fails validation, with an invalid previous copy, is corrupt', async () => {
    const bad = raw({ ...storeV1(), settings: { language: 'fr' } });
    const storage = memoryStorage({ 'bentominder.state': bad, 'bentominder.state.prev': '[]' });
    expect(await createRepository(storage, clock).load()).toEqual({ kind: 'corrupt', raw: bad, reason: 'schema-invalid' });
    expect(storage.writes).toBe(0);
  });

  it('US-E10-02/AC4 a failed migration is reported as corrupt (shipped map has no v0 step)', async () => {
    const storage = memoryStorage({ 'bentominder.state': raw({ ...storeV1(), schemaVersion: 0 }) });
    const result = await createRepository(storage, clock).load();
    expect(result).toMatchObject({ kind: 'corrupt', reason: 'migration-failed' });
  });

  it('US-E10-02/AC4 a bad current document recovers from a valid previous copy', async () => {
    const prev = storeV1();
    const storage = memoryStorage({ 'bentominder.state': 'not json', 'bentominder.state.prev': raw(prev) });
    expect(await createRepository(storage, clock).load()).toEqual({ kind: 'recovered-from-prev', state: prev, reason: 'json-parse' });
  });

  it('US-E10-02/AC5 a storage write failure propagates so the UI never claims it saved', async () => {
    const storage = memoryStorage();
    storage.failWrites = true;
    await expect(createRepository(storage, clock).save(storeV1())).rejects.toThrow('QuotaExceededError');
  });

  it('migrations run in order, stamp the version, and fail on a gap or a throwing step', () => {
    expect(migrations).toEqual({});
    const map = { 0: (d: Record<string, unknown>) => ({ ...d, a: 1 }), 1: (d: Record<string, unknown>) => ({ ...d, b: 2 }) };
    expect(migrate({ schemaVersion: 0 }, 0, 2, map)).toEqual({ schemaVersion: 2, a: 1, b: 2 });
    expect(() => migrate({ schemaVersion: 0 }, 0, 3, map)).toThrow(MigrationError);
    const throwing = {
      0: () => {
        throw new Error('boom');
      },
    };
    expect(() => migrate({}, 0, 1, throwing)).toThrow(/no migration from schema version 0/);
  });
});

describe('US-E10-05/AC1 invalid writes are refused (BR-03)', () => {
  it('US-E10-05/AC1 a bento plan without recipeId is refused with decision-bento-requires-recipe and the previous state remains', async () => {
    const storage = memoryStorage();
    const repo = createRepository(storage, clock);
    const good = storeV1();
    await repo.save(good);
    const bad = storeV1();
    delete bad.decisions['2026-11-04']!.recipeId;
    const error = await repo.save(bad).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StoreValidationError);
    expect((error as StoreValidationError).issues).toContainEqual({ rule: 'decision-bento-requires-recipe', path: 'decisions.2026-11-04.recipeId' });
    expect(JSON.parse(storage.data.get('bentominder.state')!)).toEqual(good);
  });
});

describe('export and import (contract export-roundtrip)', () => {
  it('an export re-validates as a store of the same schemaVersion and imports back equal', () => {
    const repo = createRepository(memoryStorage(), clock);
    const text = repo.exportJson(storeV1());
    expect(repo.importJson(text)).toEqual({ ok: true, state: storeV1() });
    expect(repo.exportFileName()).toBe('bentominder-export-2026-11-01.json');
  });

  it('import rejects non-JSON, non-stores, newer versions and invalid stores without writing', () => {
    const storage = memoryStorage();
    const repo = createRepository(storage, clock);
    expect(repo.importJson('{')).toEqual({ ok: false, error: 'json-parse' });
    expect(repo.importJson('[1,2]')).toEqual({ ok: false, error: 'not-a-store' });
    expect(repo.importJson(raw({ schemaVersion: 1 }))).toEqual({ ok: false, error: 'not-a-store' });
    expect(repo.importJson(raw({ ...storeV1(), schemaVersion: 7 }))).toEqual({ ok: false, error: 'too-new', version: 7 });
    const invalid = repo.importJson(raw({ ...storeV1(), consent: { aiNoticeVersion: 0, consentedAt: 'x' } }));
    expect(invalid).toMatchObject({ ok: false, error: 'schema-invalid' });
    expect(storage.writes).toBe(0);
  });

  it('exporting an invalid state throws instead of producing a file that would not import', () => {
    const repo = createRepository(memoryStorage(), clock);
    expect(() => repo.exportJson({ ...storeV1(), deviceId: 'nope' })).toThrow(StoreValidationError);
  });
});

describe('US-E10-04/AC1 delete all data (repository part, BR-22)', () => {
  it('US-E10-04/AC1 removes every BentoMinder key: store and backup', async () => {
    const storage = memoryStorage({ 'bentominder.state': raw(storeV1()), 'bentominder.state.prev': raw(storeV1()) });
    await createRepository(storage, clock).deleteAll();
    expect(STORAGE_KEYS.every((k) => !storage.data.has(k))).toBe(true);
    expect(storage.data.size).toBe(0);
  });
});

describe('first-launch defaults (contract §3.9, BR-16, BR-23)', () => {
  it('US-E8-01/AC1 a fresh store is valid, Japanese, Monday-first, auto theme, with BR-16 reminder defaults', () => {
    const now = Date.parse('2026-10-28T11:15:00Z') as Instant;
    const store = createEmptyStore({ deviceId: '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d', now });
    expect(validateStore(store).ok).toBe(true);
    expect(store.settings).toMatchObject({
      language: 'ja',
      timezone: 'Asia/Tokyo',
      weekStartsOn: 'monday',
      theme: 'auto',
      reminders: { weekly: { enabled: true, weekday: 0, time: '14:00' }, dayBefore: { enabled: true, time: '17:30' } },
    });
    expect(store.createdAt).toBe('2026-10-28T20:15:00+09:00');
    expect(defaultSettings(now).ownerId).toBe('local');
  });
});
