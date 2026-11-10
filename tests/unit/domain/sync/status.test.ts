// US-E15-06/AC4, AC6, AC7, AC8: the status reducer gives exactly one of nine states; contract 14.9.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeStatus, statusView, type StatusFacts } from '../../../../src/domain/sync/status.ts';
import { HOUR, MIN, T0, ts } from './helpers.ts';

const quiet: StatusFacts = { membership: 'member', online: true, pending: 0, consentOk: true, schemaOk: true, limitHit: false, retrying: false, syncing: false };
const f = (x: Partial<StatusFacts>): StatusFacts => ({ ...quiet, ...x });

describe('status reducer', () => {
  it('US-E15-06/AC4 each of the nine states is reachable with its own facts', () => {
    expect(computeStatus(f({ membership: 'none' }))).toBe('local-only');
    expect(computeStatus(f({}))).toBe('synced');
    expect(computeStatus(f({ syncing: true }))).toBe('syncing');
    expect(computeStatus(f({ online: false, pending: 2 }))).toBe('pending-offline');
    expect(computeStatus(f({ retrying: true, pending: 1 }))).toBe('retrying');
    expect(computeStatus(f({ consentOk: false }))).toBe('paused-no-consent');
    expect(computeStatus(f({ limitHit: true }))).toBe('paused-limit');
    expect(computeStatus(f({ schemaOk: false }))).toBe('paused-app-too-old');
    expect(computeStatus(f({ membership: 'ended' }))).toBe('membership-ended');
  });

  it('US-E15-06/AC4 precedence: membership-ended, local-only, no-consent, app-too-old, limit, offline, retrying, syncing, synced', () => {
    const everything = f({ membership: 'ended', online: false, pending: 3, consentOk: false, schemaOk: false, limitHit: true, retrying: true, syncing: true });
    let facts: StatusFacts = everything;
    expect(computeStatus(facts)).toBe('membership-ended');
    // strip the facts one by one: the next one down takes over
    facts = f({ ...everything, membership: 'none' });
    expect(computeStatus(facts)).toBe('local-only');
    facts = f({ ...everything, membership: 'member' });
    expect(computeStatus(facts)).toBe('paused-no-consent');
    facts = { ...facts, consentOk: true };
    expect(computeStatus(facts)).toBe('paused-app-too-old');
    facts = { ...facts, schemaOk: true };
    expect(computeStatus(facts)).toBe('paused-limit');
    facts = { ...facts, limitHit: false };
    expect(computeStatus(facts)).toBe('pending-offline');
    facts = { ...facts, online: true };
    expect(computeStatus(facts)).toBe('retrying');
    facts = { ...facts, retrying: false };
    expect(computeStatus(facts)).toBe('syncing');
    facts = { ...facts, syncing: false };
    expect(computeStatus(facts)).toBe('synced');
  });

  it('US-E15-06/AC4 offline with nothing pending is not pending-offline', () => {
    expect(computeStatus(f({ online: false, pending: 0 }))).toBe('synced');
  });

  it('US-E15-06/AC4 exactly one state for any combination of facts (property)', () => {
    const states = new Set(['local-only', 'synced', 'syncing', 'pending-offline', 'retrying', 'paused-no-consent', 'paused-limit', 'paused-app-too-old', 'membership-ended']);
    fc.assert(
      fc.property(
        fc.record({
          membership: fc.constantFrom('none', 'member', 'ended'),
          online: fc.boolean(),
          pending: fc.integer({ min: 0, max: 5 }),
          consentOk: fc.boolean(),
          schemaOk: fc.boolean(),
          limitHit: fc.boolean(),
          retrying: fc.boolean(),
          syncing: fc.boolean(),
        }),
        (facts) => {
          expect(states.has(computeStatus(facts))).toBe(true);
        },
      ),
      { numRuns: 400 },
    );
  });

  it('US-E15-06/AC7 a status other than synced never blocks the local app: the reducer is only a label', () => {
    // the reducer takes no store and returns no gate; nothing in it can disable a screen
    expect(Object.keys(statusView({ facts: f({ online: false, pending: 1 }), lastSyncedAt: null, oldestPendingAt: null, firstFailureAtMs: null, nowMs: T0 })).sort()).toEqual(
      ['lastSyncedAt', 'oldestPendingAt', 'pendingCount', 'showRetryNow', 'stale', 'state'],
    );
  });
});

describe('status view', () => {
  const base = { lastSyncedAt: ts(T0 - HOUR), firstFailureAtMs: null as number | null, nowMs: T0 };

  it('US-E15-06/AC6 carries the last synced time and the pending count', () => {
    const v = statusView({ ...base, facts: f({ pending: 3, online: false }), oldestPendingAt: ts(T0 - MIN) });
    expect(v).toMatchObject({ state: 'pending-offline', lastSyncedAt: ts(T0 - HOUR), pendingCount: 3, stale: false });
  });

  it('US-E15-06/AC6 pending changes older than 24 hours highlight the indicator', () => {
    const at = (age: number) => statusView({ ...base, facts: f({ pending: 1, online: false }), oldestPendingAt: ts(T0 - age) }).stale;
    expect(at(24 * HOUR - 1000)).toBe(false);
    expect(at(24 * HOUR)).toBe(true);
    expect(statusView({ ...base, facts: f({ pending: 0 }), oldestPendingAt: ts(T0 - 48 * HOUR) }).stale).toBe(false);
  });

  it('US-E15-06/AC5 「今すぐ再試行」 shows only while retrying and after 5 minutes', () => {
    const v = (failedAgo: number, retrying = true) => statusView({ ...base, facts: f({ retrying, pending: 1 }), oldestPendingAt: null, firstFailureAtMs: T0 - failedAgo }).showRetryNow;
    expect(v(4 * MIN)).toBe(false);
    expect(v(5 * MIN)).toBe(true);
    expect(v(10 * MIN, false)).toBe(false);
  });
});
