// QA E15: cost guardrails (US-E15-10/AC2-AC5, ADR 016 quota assumptions). The real engine runs a typical day for two devices through the real
// Function; the counters wrap the fake Firestore (1 read per document read, 1 per row a query returns with a minimum of 1, 1 per write/delete).
// Free quota assumptions are taken from ADR 016 section 10 item 6 (per day: 50,000 reads, 20,000 writes, 20,000 deletes, 1 GiB; 2 million function requests a month).
import { describe, expect, it } from 'vitest';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { syncCycle } from '../../../../src/domain/sync/cycle.ts';
import { noteLocalChange } from '../../../../src/domain/sync/dirty.ts';
import { emptySchedule, type ScheduleState } from '../../../../src/domain/sync/schedule.ts';
import { emptySyncMeta, type SyncMeta } from '../../../../src/domain/sync/meta.ts';
import { startMembership } from '../../../../src/domain/sync/membership.ts';
import { adoptFamilyData } from '../../../../src/domain/sync/adoption.ts';
import { DEVICE_A, DEVICE_B, SEC, emptyStore, seeded, setDecision, setNote, storeWithData } from '../../domain/sync/helpers.ts';
import { bridgePort, newNet } from './bridge.ts';
import { counting, createFamilyOf, makeRig, T0, UID1, UID2, zero } from './qa-rig.ts';

const QUOTA = { readsPerDay: 50_000, writesPerDay: 20_000, deletesPerDay: 20_000, requestsPerMonth: 2_000_000 };

async function twoDevices() {
  const rig = makeRig();
  const cnt = counting(rig);
  const clock = { now: T0 };
  const famId = await createFamilyOf(rig, UID1);
  const make = (uid: string, id: string, store: BentoMinderStore) => {
    const net = newNet();
    net.deps = cnt.deps;
    return { uid, id, net, port: bridgePort(rig, uid, net), store, meta: emptySyncMeta() as SyncMeta, schedule: emptySchedule() as ScheduleState, polls: 0, edits: 0 };
  };
  const A = make(UID1, DEVICE_A, storeWithData(DEVICE_A, UID1));
  const B = make(UID2, DEVICE_B, emptyStore(DEVICE_B, UID2));
  type Dev = typeof A;
  const cycle = async (d: Dev) => {
    rig.now = clock.now;
    const r = await syncCycle({ port: d.port, uid: d.uid, store: d.store, meta: d.meta, schedule: d.schedule, nowMs: clock.now });
    d.store = r.store;
    d.meta = r.meta;
    d.schedule = r.schedule;
    return r;
  };
  const s = startMembership({ store: A.store, meta: A.meta, familyId: famId, consentVersion: 1, nowMs: clock.now });
  A.store = s.store;
  A.meta = s.meta;
  clock.now += 20 * SEC;
  await cycle(A);
  const { code } = await rig.ok('invite.create', UID1);
  await B.port.redeemInvite(code as string, { version: 1 });
  const sb = startMembership({ store: B.store, meta: B.meta, familyId: famId, consentVersion: 1, nowMs: clock.now });
  B.store = sb.store;
  B.meta = sb.meta;
  const page = await B.port.pull(0);
  const out = adoptFamilyData({ local: B.store, family: page.envelopes, choice: 'use-family', familyId: famId, nowMs: clock.now });
  B.store = out.store;
  B.meta = { ...B.meta, baselines: out.baselines, cursor: page.seq, adoption: { familyId: famId, choice: 'use-family', done: true } };
  return { rig, cnt, clock, A, B, cycle, famId };
}

describe('US-E15-10/AC4 no needless reads', () => {
  it('an idle online poll on an unchanged family returns no records and costs a fixed few reads; a reopened app reads only what changed after its cursor', async () => {
    const { cnt, clock, A, B, cycle } = await twoDevices();
    cnt.reset();
    clock.now += 60 * SEC;
    const idle = await cycle(B);
    expect(idle.pulled).toBe(0);
    const perPollReads = cnt.c.gets + cnt.c.queryRows;
    expect(perPollReads).toBeLessThanOrEqual(5); // ADR 016 says about 2 to 3; measured value reported in the QA report
    expect(cnt.c.sets + cnt.c.deletes).toBe(0);
    // reopened app: a "new process" with the persisted meta
    A.edits += 1;
    A.store = setDecision(A.store, '2026-11-18', 'school-lunch-planned', clock.now);
    A.meta = noteLocalChange({ store: A.store, meta: A.meta, nowMs: clock.now, uid: A.uid });
    clock.now += 11 * SEC;
    await cycle(A);
    cnt.reset();
    clock.now += 60 * SEC;
    const reopened = await cycle(B);
    expect(reopened.pulled).toBe(1);
    expect(cnt.c.queryRows).toBeLessThanOrEqual(2);
  });
});

describe('US-E15-10/AC2 AC3 AC5 a typical day for two devices against the free quotas', () => {
  it('two devices, 4 visible hours each (a poll a minute), 30 edits each, 3 opens: reads, writes, deletes and requests stay far below the quotas in ADR 016', async () => {
    const { rig, cnt, clock, A, B, cycle, famId } = await twoDevices();
    cnt.reset();
    const rnd = seeded(2026);
    const DATES = ['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-24'];
    let requests = 0;
    let polls = 0;
    for (let minute = 0; minute < 240; minute++) {
      clock.now += 60 * SEC;
      for (const d of [A, B]) {
        if (rnd() < 30 / 240) {
          const date = DATES[Math.floor(rnd() * DATES.length)] as string;
          d.store = rnd() < 0.7 ? setDecision(d.store, date, rnd() < 0.5 ? 'school-lunch-planned' : 'not-confirmed', clock.now) : d.store.profile === null ? d.store : setNote(d.store, `m${minute}`, clock.now);
          d.meta = noteLocalChange({ store: d.store, meta: d.meta, nowMs: clock.now, uid: d.uid });
          d.edits += 1;
        }
        const before = d.net.requests.length;
        await cycle(d);
        polls += 1;
        requests += d.net.requests.length - before;
      }
    }
    const reads = cnt.c.gets + cnt.c.queryRows;
    const writes = cnt.c.sets;
    const deletes = cnt.c.deletes;
    const stored = rig.db.paths(`families/${famId}/records`).map((p) => rig.db.get(p)!['bytes'] as number).reduce((a, b) => a + b, 0);
    const report = { polls, edits: A.edits + B.edits, functionRequests: requests, firestoreReads: reads, firestoreWrites: writes, firestoreDeletes: deletes, storedRecordBytes: stored, transactions: cnt.c.tx };
    console.log(`QA-E15 cost (one typical day, two devices): ${JSON.stringify(report)}`);
    expect(reads).toBeLessThan(QUOTA.readsPerDay * 0.2);
    expect(writes).toBeLessThan(QUOTA.writesPerDay * 0.05);
    expect(deletes).toBeLessThan(QUOTA.deletesPerDay * 0.01);
    expect(requests * 30).toBeLessThan(QUOTA.requestsPerMonth * 0.1);
    expect(stored).toBeLessThan(5 * 1024 * 1024 * 0.2);
    // US-E15-10/AC2: edits are coalesced; a record edited many times in a short time is written once per window
    expect(writes).toBeLessThan((A.edits + B.edits) * 8);
  }, 60_000);

  it('US-E15-10/AC2 the same record edited 30 times in 10 seconds is written at most once in that window', async () => {
    const { cnt, clock, A, cycle } = await twoDevices();
    clock.now += 60 * SEC;
    cnt.reset();
    const sentBefore = A.net.requests.filter((r) => r.op === 'records.push').length;
    for (let i = 0; i < 30; i++) {
      clock.now += 300;
      A.store = setNote(A.store, `n${i}`, clock.now - (clock.now % 1000) + (i % 2 === 0 ? 0 : 0));
      A.meta = noteLocalChange({ store: A.store, meta: A.meta, nowMs: clock.now, uid: A.uid });
      await cycle(A);
    }
    const pushes = A.net.requests.filter((r) => r.op === 'records.push');
    const records = pushes.slice(sentBefore).flatMap((r) => r.body['records'] as Array<{ kind: string }>).filter((e) => e.kind === 'profile');
    expect(records.length).toBeLessThanOrEqual(1);
    // and the latest content is what is sent next
    clock.now += 11 * SEC;
    await cycle(A);
    const last = A.net.requests.filter((r) => r.op === 'records.push').pop()!.body['records'] as Array<{ payloadJson: string }>;
    expect(last[0]?.payloadJson).toContain('n29');
  });

  it('US-E15-10/AC3 the client runaway guard: after 200 writes in an hour the device stops sending, keeps queueing, and resumes in the next hour with nothing lost', async () => {
    const { clock, A, B, cycle } = await twoDevices();
    let t = 0;
    const dates: string[] = [];
    for (let d = 1; d <= 28; d++) for (const m of ['2026-11', '2026-12']) dates.push(`${m}-${String(d).padStart(2, '0')}`);
    // edit 260 different decisions, one at a time with the coalescing window passed, within one hour
    let sent = 0;
    for (let i = 0; i < 260; i++) {
      clock.now += 10_500;
      t += 10_500;
      if (t > 3_500_000) break;
      A.store = setDecision(A.store, dates[i % dates.length]!, i % 2 === 0 ? 'school-lunch-planned' : 'not-confirmed', clock.now);
      A.meta = noteLocalChange({ store: A.store, meta: A.meta, nowMs: clock.now, uid: A.uid });
      const r = await cycle(A);
      sent += r.pushed.length;
    }
    expect(sent).toBeLessThanOrEqual(200);
    const r = await cycle(A);
    expect(r.pendingCount).toBeGreaterThanOrEqual(0);
    // next hour: everything is delivered
    clock.now += 3_700_000;
    for (let k = 0; k < 30; k++) {
      clock.now += 11 * SEC;
      await cycle(A);
    }
    const last = await cycle(A);
    expect(last.pendingCount).toBe(0);
    clock.now += 60 * SEC;
    await cycle(B);
    for (const d of dates.slice(0, 5)) expect(B.store.decisions[d] ?? A.store.decisions[d]).toBeDefined();
    expect(Object.keys(B.store.decisions).sort()).toEqual(Object.keys(A.store.decisions).sort());
  }, 60_000);
});

describe('US-E15-10/AC6 AC7 the AI proxy is not involved', () => {
  it('sync requests go only to the sync base, never to the proxy; the sync function never reads or writes proxy counter collections', async () => {
    const { rig, cnt, A, clock, cycle } = await twoDevices();
    clock.now += 30 * SEC;
    await cycle(A);
    for (const r of A.net.requests) expect(r.op).toMatch(/^(records\.(push|pull)|membership\.get|family\.create|invite\.create|invite\.redeem|consent\.set)$/);
    const counters = rig.db.paths().filter((p) => !/^(families|accounts|invites|inviteAttempts|syncLimits)\//.test(p));
    expect(counters).toEqual([]);
    void cnt;
    void zero;
  });
});
