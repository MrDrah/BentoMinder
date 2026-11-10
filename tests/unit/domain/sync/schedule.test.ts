// US-E15-10/AC2-AC3 (coalescing, runaway guard), US-E15-06/AC5 (back-off), contract 14.10; pure, fake clock, seeded random.
import { describe, expect, it } from 'vitest';
import { SYNC_LIMITS } from '../../../../src/domain/sync/config.ts';
import { emptySchedule, nextDelay, pollDelayMs, recordWrites, retryNowOffered, selectDue } from '../../../../src/domain/sync/schedule.ts';
import { HOUR, MIN, SEC, T0, seeded } from './helpers.ts';

describe('write coalescing (contract 14.10)', () => {
  it('US-E15-10/AC2 30 edits of one record within 10 seconds are one write of the latest content', () => {
    let state = emptySchedule();
    const sent: number[] = [];
    for (let i = 0; i < 30; i++) {
      const now = T0 + i * 300; // 30 edits over 9 seconds
      const due = selectDue(state, ['decision_2026-11-18'], now);
      if (due.send.length > 0) {
        sent.push(now);
        state = recordWrites(state, due.send, now);
      }
    }
    expect(sent).toHaveLength(1);
  });

  it('US-E15-10/AC2 after 10 seconds the record is sendable again, and a deferred record reports when', () => {
    let state = recordWrites(emptySchedule(), ['decision_2026-11-18'], T0);
    const early = selectDue(state, ['decision_2026-11-18'], T0 + 9_999);
    expect(early).toMatchObject({ send: [], coalesced: ['decision_2026-11-18'], limitHit: false, nextAt: T0 + 10 * SEC });
    expect(selectDue(state, ['decision_2026-11-18'], T0 + 10 * SEC).send).toEqual(['decision_2026-11-18']);
    state = recordWrites(state, ['decision_2026-11-18'], T0 + 10 * SEC);
    expect(selectDue(state, ['decision_2026-11-19'], T0 + 10 * SEC).send).toEqual(['decision_2026-11-19']);
  });
});

describe('runaway guard (contract 14.10)', () => {
  const keys = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `decision_k${from + i}`);

  it('US-E15-10/AC3 the 201st write within an hour is not sent: limit hit, the queue keeps what it has', () => {
    let state = emptySchedule();
    const first = selectDue(state, keys(200), T0);
    expect(first.send).toHaveLength(200);
    expect(first.limitHit).toBe(false);
    state = recordWrites(state, first.send, T0);
    const next = selectDue(state, ['decision_extra'], T0 + 30 * MIN);
    expect(next).toMatchObject({ send: [], limitHit: true });
    expect(next.nextAt).toBe(T0 + HOUR);
  });

  it('US-E15-10/AC3 sends as many as the budget allows in one pass and flags the rest', () => {
    const state = recordWrites(emptySchedule(), keys(150), T0);
    const due = selectDue(state, keys(80, 1000), T0 + 20 * SEC);
    expect(due.send).toHaveLength(50);
    expect(due.limitHit).toBe(true);
  });

  it('US-E15-10/AC3 resumes in the next hour without data loss: the window slides', () => {
    const state = recordWrites(emptySchedule(), keys(200), T0);
    expect(selectDue(state, ['decision_extra'], T0 + HOUR - 1).limitHit).toBe(true);
    const later = selectDue(state, ['decision_extra'], T0 + HOUR + 1);
    expect(later).toMatchObject({ send: ['decision_extra'], limitHit: false });
    const pruned = recordWrites(state, ['decision_extra'], T0 + HOUR + 1);
    expect(pruned.writeLog).toEqual([T0 + HOUR + 1]);
    expect(Object.keys(pruned.lastSentAt)).toEqual(['decision_extra']);
  });

  it('the default limits are the contract values', () => {
    expect(SYNC_LIMITS.maxWritesPerDevicePerHour).toBe(200);
    expect(SYNC_LIMITS.writeCoalesceSeconds).toBe(10);
  });
});

describe('back-off (contract 14.10)', () => {
  it('US-E15-06/AC5 starts at 5 seconds, doubles, and never exceeds 5 minutes (with jitter)', () => {
    const none = () => 0;
    const all = () => 0.999999;
    expect([0, 1, 2, 3, 4, 5, 6, 7, 20].map((a) => nextDelay(a, none))).toEqual([5000, 10000, 20000, 40000, 80000, 160000, 300000, 300000, 300000]);
    expect(nextDelay(0, all)).toBeLessThanOrEqual(6000);
    expect(nextDelay(0, all)).toBeGreaterThanOrEqual(5000);
    for (let a = 0; a < 12; a++) expect(nextDelay(a, all)).toBeLessThanOrEqual(300_000);
  });

  it('US-E15-06/AC5 jitter is at most 20 percent, over a seeded sample', () => {
    const rnd = seeded(42);
    for (let a = 0; a < 6; a++) {
      const base = Math.min(5000 * 2 ** a, 300_000);
      for (let i = 0; i < 50; i++) {
        const d = nextDelay(a, rnd);
        expect(d).toBeGreaterThanOrEqual(base);
        expect(d).toBeLessThanOrEqual(Math.min(base * 1.2, 300_000));
      }
    }
    expect(nextDelay(-3, () => 0)).toBe(5000);
  });

  it('US-E15-06/AC5 「今すぐ再試行」 is offered after 5 minutes of failure, not before', () => {
    expect(retryNowOffered(null, T0)).toBe(false);
    expect(retryNowOffered(T0, T0 + 5 * MIN - 1)).toBe(false);
    expect(retryNowOffered(T0, T0 + 5 * MIN)).toBe(true);
  });
});

describe('polling (contract 14.10, Q12)', () => {
  it('US-E15-05/AC7 polls every 60 seconds while visible and online, not while hidden or offline', () => {
    expect(pollDelayMs({ visible: true, online: true })).toBe(60_000);
    expect(pollDelayMs({ visible: false, online: true })).toBeNull();
    expect(pollDelayMs({ visible: true, online: false })).toBeNull();
  });
});
