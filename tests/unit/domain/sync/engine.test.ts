// The pull/push/apply cycle over a FakeSyncPort: US-E15-06 (offline-first, queue, catch-up, errors, newer app,
// bad cloud data, account switch), US-E15-05/AC7-AC8 (changes appear on the other device), US-E15-10/AC4 (no needless reads).
import { describe, expect, it } from 'vitest';
import { detectDirty } from '../../../../src/domain/sync/dirty.ts';
import { FakeBackend } from '../../../../src/domain/sync/fake-port.ts';
import { parseSyncMeta, serializeSyncMeta } from '../../../../src/domain/sync/meta.ts';
import { statusFactsOf } from '../../../../src/domain/sync/cycle.ts';
import { computeStatus } from '../../../../src/domain/sync/status.ts';
import { validateStore } from '../../../../src/domain/storage/repository.ts';
import { liveEnvelope } from '../../../../src/domain/sync/envelope.ts';
import { SyncPortError } from '../../../../src/domain/sync/types.ts';
import { ownerMismatchesFor } from '../../../../src/domain/sync/owner.ts';
import { SimDevice, UID2, SEC, DEVICE_B, emptyStore, familyOfTwo, setDecision, setNote, setWeeklyTime, settle, testClock, ts, storeWithData, DEVICE_A, UID1 } from './helpers.ts';

describe('edits are local first and queue by record (US-E15-06/AC1, AC2)', () => {
  it('US-E15-06/AC1 a cycle that cannot reach the cloud leaves the local store exactly as it was', async () => {
    const clock = testClock();
    const { a } = await familyOfTwo(clock);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    const before = a.store;
    a.fake.offline = true;
    const r = await a.sync();
    expect(r.outcome).toEqual({ kind: 'offline' });
    expect(a.store).toBe(before);
  });

  it('US-E15-06/AC2 3 edits to 2 records plus 2 edits to a third: the queue holds 3 records, not 5 edits, and shows pending-offline', async () => {
    const clock = testClock();
    const { a } = await familyOfTwo(clock);
    a.fake.offline = true;
    clock.advance(20 * SEC);
    a.edit((s) => setWeeklyTime(s, '15:00', clock.now));
    a.edit((s) => setWeeklyTime(s, '15:30', clock.now + SEC));
    a.edit((s) => setNote(s, 'メモ1', clock.now + 2 * SEC));
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now + 3 * SEC));
    a.edit((s) => setDecision(s, '2026-11-18', 'school-lunch-planned', clock.now + 4 * SEC));
    const r = await a.sync();
    expect(r.pendingCount).toBe(3);
    expect(r.oldestPendingAt).not.toBeNull();
    expect(computeStatus(statusFactsOf(r, { online: false }))).toBe('pending-offline');
  });

  it('US-E15-06/AC2 the queue survives closing and reopening the app (it is derived from the baselines in the saved metadata)', async () => {
    const clock = testClock();
    const { a } = await familyOfTwo(clock);
    a.edit((s) => setWeeklyTime(s, '15:00', clock.now + 5 * SEC));
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now + 6 * SEC));
    const savedMeta = parseSyncMeta(serializeSyncMeta(a.meta));
    if (savedMeta.kind !== 'ok') throw new Error('meta');
    const reopened = detectDirty({ store: JSON.parse(JSON.stringify(a.store)), baselines: savedMeta.meta.baselines, pending: savedMeta.meta.pending, nowMs: clock.now, uid: UID1 });
    expect(reopened.dirty.map((d) => d.key)).toEqual(['decision_2026-11-18', 'settings_settings']);
  });

  it('US-E15-06/AC2 an edit that is changed back to the synced content is no longer pending', async () => {
    const clock = testClock();
    const { a } = await familyOfTwo(clock);
    const original = a.store;
    a.edit((s) => setNote(s, '一時的', clock.now + SEC));
    expect(detectDirty({ store: a.store, baselines: a.meta.baselines, pending: {}, nowMs: clock.now, uid: UID1 }).dirty).toHaveLength(1);
    a.store = original;
    expect(detectDirty({ store: a.store, baselines: a.meta.baselines, pending: {}, nowMs: clock.now, uid: UID1 }).dirty).toHaveLength(0);
  });
});

describe('catch-up and live updates (US-E15-06/AC3, US-E15-05/AC7)', () => {
  it('US-E15-06/AC3 when the network returns the queue is sent without parent action and the status goes to synced with the time', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    a.fake.offline = true;
    clock.advance(30 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    a.edit((s) => setWeeklyTime(s, '15:30', clock.now));
    expect((await a.sync()).pendingCount).toBe(2);
    // meanwhile B changes a different record
    clock.advance(30 * SEC);
    b.edit((s) => setNote(s, 'B のメモ', clock.now));
    await b.sync();
    a.fake.offline = false;
    clock.advance(30 * SEC);
    const r = await a.sync();
    expect(r.outcome).toEqual({ kind: 'ok' });
    expect(r.pushed.sort()).toEqual(['decision_2026-11-18', 'settings_settings']);
    expect(r.pendingCount).toBe(0);
    expect(a.store.profile?.note).toBe('B のメモ');
    expect(a.meta.lastSyncedAt).toBe(ts(clock.now));
    expect(computeStatus(statusFactsOf(r, { online: true }))).toBe('synced');
  });

  it('US-E15-05/AC7 A confirms/plans/changes the weekly reminder; B shows them after its next cycle, and the reminder setting is the synced one', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'homemade-bento-planned', clock.now));
    a.edit((s) => setWeeklyTime(s, '15:45', clock.now));
    await a.sync();
    clock.advance(60 * SEC);
    const r = await b.sync();
    expect(r.storeChanged).toBe(true);
    expect(b.store.decisions['2026-11-18']?.state).toBe('homemade-bento-planned');
    expect(b.store.settings.reminders.weekly.time).toBe('15:45');
    // B's reminder planning reads b.store.settings on every plan, so the new time is what it plans from.
    expect(b.store.settings.language).toBe('ja');
  });

  it('US-E15-05/AC8 a changed profile arrives as a changed stored profile (assessments are derived on read from it)', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    const profile = a.store.profile;
    if (profile === null) throw new Error('profile');
    a.edit((s) => ({ ...s, profile: { ...profile, allergyStatus: 'has-known', knownAllergenIds: ['alg-shrimp', 'alg-egg'], updatedAt: ts(clock.now) } }));
    await a.sync();
    await b.sync();
    expect(b.store.profile?.knownAllergenIds).toEqual(['alg-shrimp', 'alg-egg']);
  });

  it('US-E15-07/AC3 different records never overwrite each other: both changes exist on both devices', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    a.edit((s) => setWeeklyTime(s, '15:15', clock.now));
    b.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    await settle([a, b], clock);
    for (const d of [a, b]) {
      expect(d.store.settings.reminders.weekly.time).toBe('15:15');
      expect(d.store.decisions['2026-11-18']?.state).toBe('not-confirmed');
    }
    expect(a.lost).toEqual([]);
    expect(b.lost).toEqual([]);
  });

  it('US-E15-06/AC3 syncing twice with nothing changed sends and applies nothing', async () => {
    const clock = testClock();
    const { a } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    await a.sync(); // reads back what this device itself sent
    clock.advance(20 * SEC);
    const r = await a.sync();
    expect(r.pushed).toEqual([]);
    expect(r.storeChanged).toBe(false);
    expect(r.pulled).toBe(0);
  });
});

describe('no needless reads (US-E15-10/AC4)', () => {
  it('US-E15-10/AC4 an idle device does not re-download the dataset; it reads only what changed since its cursor', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    expect((await b.sync()).pulled).toBe(0);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    await a.sync();
    clock.advance(20 * SEC);
    const r = await b.sync();
    expect(r.pulled).toBe(1);
    expect(b.meta.cursor).toBeGreaterThan(0);
    // and a reopened app (new cycle state, same saved metadata) reads nothing again
    clock.advance(20 * SEC);
    expect((await b.sync()).pulled).toBe(0);
  });

  it('US-E15-10/AC4 a large dataset is pulled in pages and the cursor reaches the end', async () => {
    const clock = testClock();
    const backend = new FakeBackend({ nowMs: clock.fn, pullPageSize: 3 });
    const a = new SimDevice(backend, UID1, storeWithData(DEVICE_A, UID1), clock);
    const { familyId } = await a.fake.createFamily({ version: 1 });
    a.enter(familyId);
    for (let i = 1; i <= 8; i++) a.edit((s) => setDecision(s, `2026-11-${String(10 + i)}`, 'not-confirmed', clock.now - 1000 * i));
    await a.sync();
    const b = new SimDevice(backend, UID2, emptyStore(DEVICE_B, UID2), clock);
    const code = (await a.fake.createInvite()).code;
    await b.fake.redeemInvite(code, { version: 1 });
    b.enter(familyId);
    const r = await b.sync();
    expect(r.pulled).toBe(14); // the never-edited default settings are not data and are not uploaded
    expect(Object.keys(b.store.decisions)).toHaveLength(10);
  });
});

describe('errors retry calmly (US-E15-06/AC5)', () => {
  it('US-E15-06/AC5 a temporary error makes the status retrying, keeps the queue and the local data, and throws nothing', async () => {
    const clock = testClock();
    const { a } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    const before = a.store;
    a.fake.script.push(new SyncPortError('temporary'));
    const r = await a.sync();
    expect(r.outcome).toEqual({ kind: 'retry' });
    expect(r.pendingCount).toBe(1);
    expect(a.store).toBe(before);
    expect(computeStatus(statusFactsOf(r, { online: true }))).toBe('retrying');
    clock.advance(10 * SEC);
    const again = await a.sync();
    expect(again.outcome).toEqual({ kind: 'ok' });
    expect(again.pushed).toEqual(['decision_2026-11-18']);
  });

  it('US-E15-06/AC5 a push whose answer was lost is repeated without harm (the same envelope is a no-op on the server)', async () => {
    const clock = testClock();
    const { a, b, backend, familyId } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    a.fake.loseNextPushResponse = true;
    expect((await a.sync()).outcome).toEqual({ kind: 'retry' });
    const seqAfterLoss = backend.families.get(familyId)?.seq;
    clock.advance(20 * SEC);
    const r = await a.sync();
    expect(r.outcome).toEqual({ kind: 'ok' });
    expect(backend.families.get(familyId)?.seq).toBe(seqAfterLoss);
    await b.sync();
    expect(b.store.decisions['2026-11-18']?.state).toBe('not-confirmed');
  });

  it('US-E15-06/AC5 an error in the middle of several batches keeps what was already accepted (nothing is sent twice)', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    for (let i = 0; i < 60; i++) {
      const key = i < 31 ? `2026-12-${String(i + 1).padStart(2, '0')}` : `2027-01-${String(i - 30).padStart(2, '0')}`;
      a.edit((s) => setDecision(s, key, 'not-confirmed', clock.now - (i + 1) * SEC));
    }
    const dirty = a.sync();
    // second batch fails: the first batch (50 records) was accepted
    const origPush = a.fake.push.bind(a.fake);
    let n = 0;
    a.fake.push = async (e) => {
      n += 1;
      if (n === 2) throw new SyncPortError('temporary');
      return origPush(e);
    };
    const r = await dirty;
    expect(r.outcome).toEqual({ kind: 'retry' });
    expect(r.pushed).toHaveLength(50);
    expect(r.pendingCount).toBe(10);
    expect(backend.families.get(familyId)?.records.size).toBeGreaterThan(50);
  });

  it('a non-port error is a bug and is not swallowed', async () => {
    const clock = testClock();
    const { a } = await familyOfTwo(clock);
    a.fake.push = () => Promise.reject(new TypeError('bug'));
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now + SEC));
    await expect(a.sync()).rejects.toThrow('bug');
  });

  it.each([
    [new SyncPortError('unauthenticated'), 'unauthenticated'],
    [new SyncPortError('consent-required'), 'paused-no-consent'],
    [new SyncPortError('app-too-old'), 'paused-app-too-old'],
    [new SyncPortError('limit', 'family'), 'paused-limit'],
    [new SyncPortError('limit', 'record'), 'paused-limit'],
    [new SyncPortError('refused', 'x'), 'refused'],
    [new SyncPortError('membership-ended', 'removed'), 'membership-ended'],
    [new SyncPortError('membership-ended', 'left'), 'membership-ended'],
    [new SyncPortError('membership-ended', 'other'), 'membership-ended'],
  ])('US-E15-06/AC4 a %s reply maps to the outcome %s', async (error, kind) => {
    const clock = testClock();
    const { a } = await familyOfTwo(clock);
    a.fake.script.push(error);
    const r = await a.sync();
    expect(r.outcome.kind).toBe(kind);
    expect(r.store).toBe(a.store);
  });
});

describe('guards before any call', () => {
  it('US-E15-06/AC10 an account that is in no family sends and reads nothing (nothing is sent under another account)', async () => {
    const clock = testClock();
    const { backend } = await familyOfTwo(clock);
    const stranger = new SimDevice(backend, 'test-uid-003', storeWithData(DEVICE_B, 'test-uid-003'), clock);
    const r = await stranger.sync();
    expect(r.outcome).toEqual({ kind: 'no-family' });
    expect(stranger.fake.calls).toEqual([]);
    expect(computeStatus(statusFactsOf(r, { online: true }))).toBe('local-only');
  });

  it('US-E15-11/AC7 after the local data was deleted, a device with no baselines downloads the family data instead of sending deletions', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    const wiped = new SimDevice(backend, UID1, emptyStore(DEVICE_A, UID1), clock).enter(familyId);
    const r = await wiped.sync();
    expect(r.outcome).toEqual({ kind: 'ok' });
    expect(wiped.store.decisions['2026-11-04']).toBeDefined();
    expect(wiped.store.profile?.nickname).toBe(a.store.profile?.nickname);
    const records = backend.families.get(familyId)?.records;
    expect([...(records?.values() ?? [])].some((e) => e.deletedAt !== undefined)).toBe(false);
  });

  it('US-E15-04/AC11 an interrupted adoption blocks record sync until it is finished', async () => {
    const clock = testClock();
    const { b } = await familyOfTwo(clock);
    b.meta = { ...b.meta, adoption: { familyId: b.meta.familyId ?? '', choice: 'add-device', done: false } };
    const callsBefore = b.fake.calls.length;
    const r = await b.sync();
    expect(r.outcome).toEqual({ kind: 'adoption-pending' });
    expect(b.fake.calls).toHaveLength(callsBefore);
  });
});

describe('cloud data from a newer app or failing validation', () => {
  it('US-E15-06/AC8 a cloud schemaVersion above the app pauses sync: nothing changed, nothing uploaded', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    const fam = backend.families.get(familyId);
    if (fam === undefined) throw new Error('family');
    fam.schemaVersion = 2;
    clock.advance(20 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    const before = a.store;
    const pushesBefore = a.fake.calls.filter((c) => c.op === 'push').length;
    const r = await a.sync();
    expect(r.outcome).toEqual({ kind: 'paused-app-too-old' });
    expect(a.store).toBe(before);
    expect(a.fake.calls.filter((c) => c.op === 'push')).toHaveLength(pushesBefore);
    expect(computeStatus(statusFactsOf(r, { online: true }))).toBe('paused-app-too-old');
  });

  it('US-E15-06/AC9 a downloaded record that fails validation is ignored once, the local version is kept, other records still apply', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    const fam = backend.families.get(familyId);
    if (fam === undefined) throw new Error('family');
    const good = setDecision(a.store, '2026-11-18', 'not-confirmed', clock.now + 10 * SEC);
    const goodRec = good.decisions['2026-11-18'];
    const bad = liveEnvelope({ kind: 'profile', key: 'profile', payloadJson: JSON.stringify({ ...a.store.profile, allergyStatus: 'none-known' }), updatedAt: ts(clock.now + 20 * SEC), updatedBy: 'u', deviceId: DEVICE_B });
    const ok = liveEnvelope({ kind: 'decision', key: '2026-11-18', payloadJson: JSON.stringify(goodRec), updatedAt: ts(clock.now + 10 * SEC), updatedBy: 'u', deviceId: DEVICE_B });
    fam.seq += 1;
    fam.records.set('profile_profile', { ...bad, seq: fam.seq });
    fam.records.set('decision_2026-11-18', { ...ok, seq: fam.seq });
    const profileBefore = a.store.profile;
    clock.advance(30 * SEC);
    const r = await a.sync();
    expect(r.quarantined.map((q) => q.key)).toEqual(['profile_profile']);
    expect(a.store.profile).toEqual(profileBefore);
    expect(a.store.decisions['2026-11-18']?.state).toBe('not-confirmed');
    expect(validateStore(a.store).ok).toBe(true);
    // the ignored record is not sent back and does not come again
    clock.advance(30 * SEC);
    expect((await a.sync()).pulled).toBe(0);
  });

  it('US-E15-07/AC10 after every apply the local copy passes the store validation and the owner rule', async () => {
    const clock = testClock();
    const { a, b } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'homemade-bento-planned', clock.now));
    await a.sync();
    clock.advance(20 * SEC);
    await b.sync();
    for (const d of [a, b]) {
      expect(validateStore(d.store).ok).toBe(true);
      expect(ownerMismatchesFor(d.store, [d.uid, d.meta.familyId ?? ''])).toEqual([]);
    }
  });
});

describe('clock skew (US-E15-07/AC7)', () => {
  it('US-E15-07/AC7 a device clock 2 days ahead is clamped to the cloud receive time and adopts the stored stamp; the next real edit wins', async () => {
    const clock = testClock();
    const { a, b, backend, familyId } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    const wrong = clock.now + 2 * 86_400_000;
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', wrong));
    await a.sync();
    expect(backend.families.get(familyId)?.records.get('decision_2026-11-18')?.updatedAtMs).toBe(clock.now);
    expect(a.store.decisions['2026-11-18']?.updatedAt).toBe(ts(clock.now));
    expect(validateStore(a.store).ok).toBe(true);
    // B edits the same record a minute later: B wins everywhere (one wrong clock does not win every future conflict)
    clock.advance(60 * SEC);
    b.edit((s) => setDecision(s, '2026-11-18', 'school-lunch-planned', clock.now));
    await settle([a, b], clock);
    expect(a.store.decisions['2026-11-18']?.state).toBe('school-lunch-planned');
    expect(b.store.decisions['2026-11-18']?.state).toBe('school-lunch-planned');
    expect((await a.sync()).pendingCount).toBe(0);
  });

  it('US-E15-07/AC7 a stamp up to 5 minutes ahead is kept as sent', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now + 5 * 60_000));
    await a.sync();
    expect(backend.families.get(familyId)?.records.get('decision_2026-11-18')?.updatedAtMs).toBe(clock.now + 5 * 60_000);
  });
});

describe('limits (US-E15-10/AC1, AC3) in a cycle', () => {
  it('US-E15-10/AC1 a record over the size limit is not sent: paused-limit, the local copy keeps working and other records still go', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    clock.advance(20 * SEC);
    // a profile note is capped by the schema, so inflate through a menu month's sourceUrl-free path is not possible;
    // use the settings-free route: an extra huge decision history is also capped. Test the guard with a stubbed size via an oversized record.
    const huge = 'x'.repeat(270_000);
    a.edit((s) => ({ ...s, menus: { ...s.menus, '2026-11': { ...(s.menus['2026-11'] as NonNullable<(typeof s.menus)[string]>), sourceUrl: `https://example.test/${huge}`, updatedAt: ts(clock.now) } } }));
    a.edit((s) => setDecision(s, '2026-11-18', 'not-confirmed', clock.now));
    const r = await a.sync();
    expect(r.outcome).toEqual({ kind: 'paused-limit', scope: 'record' });
    expect(r.limitHit).toBe(true);
    expect(r.pushed).toEqual(['decision_2026-11-18']);
    expect(r.pendingCount).toBe(1);
    expect(computeStatus(statusFactsOf(r, { online: true }))).toBe('paused-limit');
    expect(backend.families.get(familyId)?.records.get('menu_2026-11')?.payloadJson).not.toContain('example.test');
  });

  it('US-E15-10/AC3 more than 200 writes in an hour: sending stops with paused-limit, the queue keeps filling, nothing is lost, and it resumes later', async () => {
    const clock = testClock();
    const { a, backend, familyId } = await familyOfTwo(clock);
    const edits = (from: number, to: number) => {
      for (let i = from; i < to; i++) {
        const day = new Date(Date.UTC(2026, 10, 12) + i * 86_400_000);
        const key = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`;
        a.edit((s) => setDecision(s, key, 'not-confirmed', clock.now - 5 * SEC));
      }
    };
    edits(0, 215);
    let sent = 0;
    for (let i = 0; i < 6; i++) {
      clock.advance(11 * SEC);
      const r = await a.sync();
      sent += r.pushed.length;
    }
    expect(sent).toBeLessThanOrEqual(200);
    expect(a.last?.outcome).toEqual({ kind: 'paused-limit', scope: 'writes' });
    expect(a.last?.pendingCount).toBeGreaterThan(0);
    expect(a.last?.nextSendAt).not.toBeNull();
    clock.advance(3_600_000);
    for (let i = 0; i < 3; i++) {
      clock.advance(11 * SEC);
      await a.sync();
    }
    expect(a.last?.pendingCount).toBe(0);
    expect(backend.families.get(familyId)?.records.size).toBeGreaterThan(215);
  });
});
