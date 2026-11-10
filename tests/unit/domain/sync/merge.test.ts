// US-E15-07 (conflicts), data contract 14.6: winner rule, tombstones, skew, retention, convergence.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { liveEnvelope, tombstoneEnvelope } from '../../../../src/domain/sync/envelope.ts';
import { clampUpdatedAt, compareEnvelopes, isBeyondRetention, isStaleDevice, winner, winnerOf } from '../../../../src/domain/sync/merge.ts';
import type { Envelope } from '../../../../src/domain/sync/types.ts';
import { DAY, MIN, SEC, T0, seeded, ts } from './helpers.ts';

const live = (atMs: number, deviceId: string, payload = '{"v":1}', kind: Envelope['kind'] = 'decision', key = '2026-11-18'): Envelope =>
  liveEnvelope({ kind, key, payloadJson: payload, updatedAt: ts(atMs), updatedBy: 'test-uid-001', deviceId });
const dead = (atMs: number, deviceId: string): Envelope =>
  tombstoneEnvelope({ kind: 'decision', key: '2026-11-18', updatedAt: ts(atMs), updatedBy: 'test-uid-001', deviceId });

describe('winner rule (contract 14.6)', () => {
  it('US-E15-07/AC1 the later updatedAt wins, per record, whichever order they are compared in', () => {
    const a = live(T0, 'device-A', '{"by":"A"}');
    const b = live(T0 + 5 * SEC, 'device-B', '{"by":"B"}');
    expect(winner(a, b)).toBe(b);
    expect(winner(b, a)).toBe(b);
  });

  it('US-E15-07/AC1 records that differ are each decided on their own', () => {
    const decisionA = live(T0, 'device-A', '{"by":"A"}', 'decision', '2026-11-18');
    const decisionB = live(T0 + 5 * SEC, 'device-B', '{"by":"B"}', 'decision', '2026-11-18');
    const menuA = live(T0 + 9 * SEC, 'device-A', '{"by":"A"}', 'menu', '2026-12');
    const menuB = live(T0 + 1 * SEC, 'device-B', '{"by":"B"}', 'menu', '2026-12');
    expect(winner(decisionA, decisionB).deviceId).toBe('device-B');
    expect(winner(menuA, menuB).deviceId).toBe('device-A');
  });

  it('US-E15-07/AC2 equal updatedAt: the greater deviceId (plain string order) wins on every device', () => {
    const a = live(T0, 'device-A');
    const b = live(T0, 'device-B');
    expect(winner(a, b).deviceId).toBe('device-B');
    expect(winner(b, a).deviceId).toBe('device-B');
    // plain string order, not numeric or locale order
    expect(winner(live(T0, 'device-10'), live(T0, 'device-9')).deviceId).toBe('device-9');
    expect(winner(live(T0, 'Z'), live(T0, 'a')).deviceId).toBe('a');
  });

  it('US-E15-07/AC2 the same device and instant still gives one deterministic winner (content order)', () => {
    const a = live(T0, 'device-A', '{"v":1}');
    const b = live(T0, 'device-A', '{"v":2}');
    expect(winner(a, b)).toBe(winner(b, a));
    expect(compareEnvelopes(a, a)).toBe(0);
  });

  it('US-E15-07/AC5 a newer edit beats an older tombstone', () => {
    const tomb = dead(T0, 'device-A');
    const edit = live(T0 + 30 * SEC, 'device-B');
    expect(winner(tomb, edit)).toBe(edit);
    expect(winner(edit, tomb)).toBe(edit);
  });

  it('US-E15-07/AC5 with the times swapped the delete wins', () => {
    const tomb = dead(T0 + 30 * SEC, 'device-A');
    const edit = live(T0, 'device-B');
    expect(winner(tomb, edit)).toBe(tomb);
    expect(winner(edit, tomb)).toBe(tomb);
  });

  it('US-E15-07/AC4 a tombstone carries deletedAt equal to updatedAt, no payload, and competes by the same rule', () => {
    const tomb = dead(T0, 'device-A');
    expect(tomb.deletedAt).toBe(tomb.updatedAt);
    expect(tomb.payloadJson).toBeUndefined();
    // a record created by another device before the delete is not deleted by it
    expect(winner(tomb, live(T0 - SEC, 'device-B')).deletedAt).toBeDefined();
    expect(winner(tomb, live(T0 + SEC, 'device-B')).deletedAt).toBeUndefined();
  });

  it('US-E15-07/AC4 at an exact tie a tombstone beats a live record (deterministic, order independent)', () => {
    const tomb = dead(T0, 'device-A');
    const edit = live(T0, 'device-A');
    expect(winner(tomb, edit)).toBe(tomb);
    expect(winner(edit, tomb)).toBe(tomb);
  });

  it('US-E15-07/AC9 whole-record granularity: the later whole month record wins, the loser extra content is dropped', () => {
    const a = live(T0, 'device-A', '{"extractions":["x1","x2"]}', 'menu', '2026-12');
    const b = live(T0 + MIN, 'device-B', '{"extractions":["y1"]}', 'menu', '2026-12');
    expect(winner(a, b).payloadJson).toBe('{"extractions":["y1"]}');
  });

  it('winnerOf folds a list and is undefined for none', () => {
    expect(winnerOf([])).toBeUndefined();
    const xs = [live(T0, 'a'), live(T0 + 3 * SEC, 'b'), live(T0 + SEC, 'c')];
    expect(winnerOf(xs)?.deviceId).toBe('b');
  });
});

describe('clock skew (contract 14.6)', () => {
  it('US-E15-07/AC7 a stamp more than 5 minutes ahead of the receive time becomes the receive time', () => {
    expect(clampUpdatedAt(T0 + 5 * MIN + 1, T0)).toBe(T0);
    expect(clampUpdatedAt(T0 + 2 * DAY, T0)).toBe(T0);
  });

  it('US-E15-07/AC7 exactly 5 minutes ahead, or earlier, is kept', () => {
    expect(clampUpdatedAt(T0 + 5 * MIN, T0)).toBe(T0 + 5 * MIN);
    expect(clampUpdatedAt(T0 - DAY, T0)).toBe(T0 - DAY);
  });
});

describe('tombstone retention and the long-offline device (contract 14.6)', () => {
  const last = T0;
  it('US-E15-07/AC6 day 90 is not stale, day 91 is (fake-clock boundary)', () => {
    expect(isStaleDevice(last, last + 89 * DAY)).toBe(false);
    expect(isStaleDevice(last, last + 90 * DAY)).toBe(false);
    expect(isStaleDevice(last, last + 90 * DAY + 1)).toBe(true);
    expect(isStaleDevice(last, last + 91 * DAY)).toBe(true);
  });

  it('US-E15-07/AC6 a device that never synced is not stale', () => {
    expect(isStaleDevice(null, T0 + 400 * DAY)).toBe(false);
  });
});

describe('retention pruning (contract 7, 14.6)', () => {
  const now = Date.parse('2026-11-10T10:00:00+09:00');
  it('US-E15-07/AC12 a record older than 13 months is beyond retention; the 13th month back is not', () => {
    expect(isBeyondRetention('menu', '2025-10', now)).toBe(false);
    expect(isBeyondRetention('menu', '2025-09', now)).toBe(true);
    expect(isBeyondRetention('decision', '2025-10-31', now)).toBe(false);
    expect(isBeyondRetention('decision', '2025-09-30', now)).toBe(true);
    expect(isBeyondRetention('override', '2024-01-01', now)).toBe(true);
    expect(isBeyondRetention('aiUsage', '2025-09', now)).toBe(true);
  });

  it('US-E15-07/AC12 profile and settings are never pruned', () => {
    expect(isBeyondRetention('profile', 'profile', now + 900 * DAY)).toBe(false);
    expect(isBeyondRetention('settings', 'settings', now + 900 * DAY)).toBe(false);
  });
});

describe('aiUsage merge: the larger count', () => {
  const ai = (count: number, atMs: number, device: string): Envelope =>
    liveEnvelope({ kind: 'aiUsage', key: '2026-11', payloadJson: `{"count":${count}}`, updatedAt: ts(atMs), updatedBy: 'u', deviceId: device });
  it('US-E15-07/AC11 the larger count wins even against a newer stamp', () => {
    expect(winner(ai(5, T0, 'a'), ai(3, T0 + MIN, 'b')).payloadJson).toBe('{"count":5}');
    expect(winner(ai(3, T0 + MIN, 'b'), ai(5, T0, 'a')).payloadJson).toBe('{"count":5}');
  });
});

// ---- Property tests (US-E15-07/AC11, rule sync-merge-convergent) ----

const envArb = fc
  .record({
    at: fc.integer({ min: 0, max: 4 }),
    device: fc.constantFrom('device-A', 'device-B', 'device-C'),
    dead: fc.boolean(),
    payload: fc.constantFrom('{"v":1}', '{"v":2}', '{"v":3}'),
    by: fc.constantFrom('test-uid-001', 'test-uid-002'),
  })
  .map((r) =>
    r.dead
      ? tombstoneEnvelope({ kind: 'decision', key: '2026-11-18', updatedAt: ts(T0 + r.at * SEC), updatedBy: r.by, deviceId: r.device })
      : liveEnvelope({ kind: 'decision', key: '2026-11-18', payloadJson: r.payload, updatedAt: ts(T0 + r.at * SEC), updatedBy: r.by, deviceId: r.device }),
  );

const aiArb = fc
  .record({ count: fc.integer({ min: 0, max: 4 }), at: fc.integer({ min: 0, max: 3 }), device: fc.constantFrom('device-A', 'device-B') })
  .map((r) => liveEnvelope({ kind: 'aiUsage', key: '2026-11', payloadJson: `{"count":${r.count}}`, updatedAt: ts(T0 + r.at * SEC), updatedBy: 'u', deviceId: r.device }));

describe.each([
  ['decision records (with tombstones)', envArb],
  ['aiUsage records', aiArb],
])('merge is a semilattice: %s', (_name, arb) => {
  it('US-E15-07/AC11 commutative', () => {
    fc.assert(fc.property(arb, arb, (a, b) => { expect(winner(a, b)).toStrictEqual(winner(b, a)); }), { numRuns: 500 });
  });
  it('US-E15-07/AC11 associative', () => {
    fc.assert(fc.property(arb, arb, arb, (a, b, c) => { expect(winner(winner(a, b), c)).toStrictEqual(winner(a, winner(b, c))); }), { numRuns: 500 });
  });
  it('US-E15-07/AC11 idempotent (any repetition of the same set)', () => {
    fc.assert(fc.property(arb, arb, (a, b) => { expect(winner(winner(a, b), b)).toStrictEqual(winner(a, b)); }), { numRuns: 500 });
    fc.assert(fc.property(arb, (a) => { expect(winner(a, a)).toStrictEqual(a); }), { numRuns: 200 });
  });
  it('US-E15-07/AC11 any order and any repetition of the same set gives the same result', () => {
    fc.assert(
      fc.property(fc.array(arb, { minLength: 1, maxLength: 8 }), fc.integer(), (xs, seed) => {
        const expected = winnerOf(xs);
        const rnd = seeded(seed);
        const shuffled = [...xs, ...xs];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j] as Envelope, shuffled[i] as Envelope];
        }
        expect(winnerOf(shuffled)).toStrictEqual(expected);
        expect(winnerOf([...xs].reverse())).toStrictEqual(expected);
      }),
      { numRuns: 300 },
    );
  });
});
