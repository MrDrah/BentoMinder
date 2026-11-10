// Shared test support for the sync core: a settable clock, store edit helpers that stamp `updatedAt` like the app, and
// a simulated device (store + metadata + schedule) that runs real sync cycles over a FakeSyncPort.
import { createEmptyStore } from '../../../../src/domain/storage/defaults.ts';
import { toJstTimestamp, type Instant } from '../../../../src/domain/time/jst.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import type { DayDecision } from '../../../../src/domain/schema/decision.ts';
import { FakeBackend, type FakeSyncPort } from '../../../../src/domain/sync/fake-port.ts';
import type { SyncPort } from '../../../../src/domain/sync/types.ts';
import { syncCycle, type CycleResult, type LostEdit } from '../../../../src/domain/sync/cycle.ts';
import { emptySchedule, type ScheduleState } from '../../../../src/domain/sync/schedule.ts';
import { emptySyncMeta, type SyncMeta } from '../../../../src/domain/sync/meta.ts';
import { startMembership } from '../../../../src/domain/sync/membership.ts';
import type { Quarantined } from '../../../../src/domain/sync/records.ts';
import { noteLocalChange } from '../../../../src/domain/sync/dirty.ts';
import { adoptFamilyData, type AdoptionOutcome } from '../../../../src/domain/sync/adoption.ts';
import { decisionRecord } from '../../helpers/menus.ts';
import { clone, storeV1 } from '../../helpers/fixtures.ts';

export const T0 = Date.parse('2026-11-10T10:00:00+09:00');
export const SEC = 1000;
export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

export const DEVICE_A = 'a0000000-0000-4000-8000-00000000000a';
export const DEVICE_B = 'b0000000-0000-4000-8000-00000000000b';
export const DEVICE_C = 'c0000000-0000-4000-8000-00000000000c';
export const UID1 = 'test-uid-001';
export const UID2 = 'test-uid-002';
export const UID3 = 'test-uid-003';

export const ts = (ms: number): string => toJstTimestamp(ms as Instant);

export interface TestClock {
  now: number;
  fn: () => number;
  advance(ms: number): void;
}
export function testClock(start = T0): TestClock {
  const c: TestClock = {
    now: start,
    fn: () => c.now,
    advance(ms) {
      c.now += ms;
    },
  };
  return c;
}

/** Seeded random in [0, 1) (mulberry32) for property tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A store with data (profile, one menu, two decisions, an override, aiUsage) owned by `ownerId`. */
export function storeWithData(deviceId: string, ownerId: string): BentoMinderStore {
  const s = clone(storeV1());
  return JSON.parse(JSON.stringify({ ...s, deviceId }).replaceAll('"ownerId":"local"', `"ownerId":"${ownerId}"`)) as BentoMinderStore;
}

export function emptyStore(deviceId: string, ownerId: string, nowMs = T0 - 40 * DAY): BentoMinderStore {
  return createEmptyStore({ deviceId, now: nowMs as Instant, ownerId });
}

const bump = (s: BentoMinderStore, atMs: number): BentoMinderStore => ({ ...s, updatedAt: ts(Math.max(Date.parse(s.updatedAt), atMs)) });

/** Sets or replaces the decision of `date`, stamped at `atMs` like an app edit. */
export function setDecision(s: BentoMinderStore, date: string, state: DayDecision['state'], atMs: number, extra: Partial<DayDecision> = {}): BentoMinderStore {
  const prev = s.decisions[date];
  const rec = decisionRecord(date, state, { ownerId: s.settings.ownerId, createdAt: prev?.createdAt ?? ts(atMs), updatedAt: ts(atMs), decidedAt: ts(atMs), ...(state === 'homemade-bento-planned' ? { plannedAt: ts(atMs) } : {}), history: [{ state: state as 'not-confirmed', at: ts(atMs), ...(state === 'homemade-bento-planned' ? { recipeId: 'rcp-kuma-onigiri' } : {}) }], ...extra });
  return bump({ ...s, decisions: { ...s.decisions, [date]: rec } }, atMs);
}

export function clearDecision(s: BentoMinderStore, date: string, atMs: number): BentoMinderStore {
  return bump({ ...s, decisions: Object.fromEntries(Object.entries(s.decisions).filter(([k]) => k !== date)) }, atMs);
}

export function setWeeklyTime(s: BentoMinderStore, time: string, atMs: number): BentoMinderStore {
  const settings = { ...s.settings, reminders: { ...s.settings.reminders, weekly: { ...s.settings.reminders.weekly, time } }, updatedAt: ts(atMs) };
  return bump({ ...s, settings }, atMs);
}

export function setNote(s: BentoMinderStore, note: string, atMs: number): BentoMinderStore {
  if (s.profile === null) throw new Error('no profile');
  return bump({ ...s, profile: { ...s.profile, note, updatedAt: ts(atMs) } }, atMs);
}

export function removeProfile(s: BentoMinderStore, atMs: number): BentoMinderStore {
  return bump({ ...s, profile: null }, atMs);
}

/** A simulated device: its store, sync metadata and schedule, driven by real sync cycles. */
export class SimDevice {
  store: BentoMinderStore;
  meta: SyncMeta = emptySyncMeta();
  schedule: ScheduleState = emptySchedule();
  readonly lost: LostEdit[] = [];
  readonly quarantined: Quarantined[] = [];
  last: CycleResult | undefined;
  port: SyncPort;
  readonly fake: FakeSyncPort;
  private readonly clock: TestClock;
  readonly uid: string;

  constructor(backend: FakeBackend, uid: string, store: BentoMinderStore, clock: TestClock) {
    this.uid = uid;
    this.fake = backend.portFor(uid);
    this.port = this.fake;
    this.store = store;
    this.clock = clock;
  }

  /** Becomes a member of `familyId` (as after create or join): owner rewritten, consent cached, baselines empty. */
  enter(familyId: string, consentVersion = 1): this {
    const r = startMembership({ store: this.store, meta: this.meta, familyId, consentVersion, nowMs: this.clock.now });
    this.store = r.store;
    this.meta = r.meta;
    return this;
  }

  /** A local commit; the engine notes the change right away (`noticeAtMs` lets a test place a deletion in time). */
  edit(fn: (s: BentoMinderStore) => BentoMinderStore, noticeAtMs?: number): this {
    this.store = fn(this.store);
    this.meta = noteLocalChange({ store: this.store, meta: this.meta, nowMs: noticeAtMs ?? this.clock.now, uid: this.uid });
    return this;
  }

  async sync(): Promise<CycleResult> {
    const r = await syncCycle({ port: this.port, uid: this.uid, store: this.store, meta: this.meta, schedule: this.schedule, nowMs: this.clock.now });
    this.store = r.store;
    this.meta = r.meta;
    this.schedule = r.schedule;
    this.lost.push(...r.lostEdits);
    this.quarantined.push(...r.quarantined);
    this.last = r;
    return r;
  }
}

/** Runs cycles over all devices (advancing the clock past the coalesce window) until nothing moves any more. */
export async function settle(devices: readonly SimDevice[], clock: TestClock, maxRounds = 12): Promise<number> {
  for (let round = 1; round <= maxRounds; round++) {
    clock.advance(11 * SEC);
    let moved = false;
    for (const d of devices) {
      const r = await d.sync();
      if (r.pushed.length > 0 || r.storeChanged) moved = true;
    }
    if (!moved) return round;
  }
  throw new Error('did not settle');
}

/** Joins as after the join screen: downloads everything, adopts it by `choice`, records the adoption as done. */
export async function adopt(device: SimDevice, choice: 'use-family' | 'add-device', clock: TestClock): Promise<AdoptionOutcome> {
  const familyId = device.meta.familyId;
  if (familyId === null) throw new Error('not a member');
  const page = await device.port.pull(0);
  const out = adoptFamilyData({ local: device.store, family: page.envelopes, choice, familyId, nowMs: clock.now });
  device.store = out.store;
  device.meta = { ...device.meta, baselines: out.baselines, cursor: page.seq, adoption: { familyId, choice, done: true } };
  return out;
}

/** The usual start: parent 1 creates a family with data and uploads it; parent 2 joins with an empty phone. */
export async function familyOfTwo(clock: TestClock): Promise<{ backend: FakeBackend; a: SimDevice; b: SimDevice; familyId: string }> {
  const backend = new FakeBackend({ nowMs: clock.fn });
  const a = new SimDevice(backend, UID1, storeWithData(DEVICE_A, UID1), clock);
  const { familyId } = await a.fake.createFamily({ version: 1 });
  a.enter(familyId);
  await a.sync();
  const b = new SimDevice(backend, UID2, emptyStore(DEVICE_B, UID2), clock);
  const invite = await a.fake.createInvite();
  await b.fake.redeemInvite(invite.code, { version: 1 });
  b.enter(familyId);
  await adopt(b, 'use-family', clock);
  return { backend, a, b, familyId };
}

/** Comparable view of the synced content of a store (device-only fields excluded). */
export function syncedView(s: BentoMinderStore): unknown {
  return { profile: s.profile, menus: s.menus, overrides: s.overrides, decisions: s.decisions, settings: { ...s.settings, language: '', theme: '', createdAt: '', updatedAt: '' }, aiUsage: s.aiUsage };
}
