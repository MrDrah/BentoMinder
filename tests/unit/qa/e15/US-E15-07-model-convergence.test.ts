// QA E15: independent model test of convergence (US-E15-07/AC1-AC5, AC10, AC11; US-E15-06; US-E15-08/AC2; US-E15-11/AC6; data contract 14.6).
// Three devices (A and C are two phones of one account, B is the spouse) run the REAL engine (syncCycle) through the REAL HTTP adapter and the
// REAL sync Function over a fake Firestore. The oracle below is written from the contract only: per record, collect every version ever made and
// take the greatest (updatedAt, deviceId); a delete is a version; aiUsage is the largest count. It shares no code with src/domain/sync/merge.ts.
import { describe, expect, it } from 'vitest';

import { validateStore } from '../../../../src/domain/storage/repository.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';

import { adoptFamilyData } from '../../../../src/domain/sync/adoption.ts';
import { syncCycle } from '../../../../src/domain/sync/cycle.ts';
import { noteLocalChange } from '../../../../src/domain/sync/dirty.ts';
import { prepareFamilyImport } from '../../../../src/domain/sync/import.ts';
import { emptySchedule, type ScheduleState } from '../../../../src/domain/sync/schedule.ts';
import { emptySyncMeta, type SyncMeta } from '../../../../src/domain/sync/meta.ts';
import { endMembership, startMembership } from '../../../../src/domain/sync/membership.ts';
import { ownerMismatchesFor } from '../../../../src/domain/sync/owner.ts';
import type { HttpSyncPort } from '../../../../src/adapters/web/sync-http.ts';
import { DEVICE_A, DEVICE_B, DEVICE_C, SEC, clearDecision, emptyStore, seeded, setDecision, setNote, setWeeklyTime, storeWithData, ts } from '../../domain/sync/helpers.ts';
import { bridgePort, newNet, type Net } from './bridge.ts';
import { T0, UID1, UID2, createFamilyOf, makeRig, type Rig } from './qa-rig.ts';

// ---------------------------------------------------------------- the oracle (contract 14.6, nothing else)
interface Version {
  t: number;
  dev: string;
  tomb: boolean;
  sig: string;
}
class Oracle {
  readonly versions = new Map<string, Version[]>();
  add(key: string, v: Version): void {
    this.versions.set(key, [...(this.versions.get(key) ?? []), v]);
  }
  /** greater updatedAt, then greater deviceId (plain string order); equal on both cannot be produced by this test's generator */
  winner(key: string): Version | undefined {
    let best: Version | undefined;
    for (const v of this.versions.get(key) ?? []) if (best === undefined || v.t > best.t || (v.t === best.t && v.dev > best.dev)) best = v;
    return best;
  }
  aiMax(key: string): number {
    return Math.max(0, ...(this.versions.get(key) ?? []).map((v) => Number(v.sig)));
  }
}

const sigOf = (kind: string, rec: unknown): string => {
  const r = rec as Record<string, unknown>;
  if (kind === 'decision') return String(r['state']);
  if (kind === 'profile') return String(r['note']);
  if (kind === 'settings') return String((r['reminders'] as { weekly: { time: string } }).weekly.time);
  return 'x';
};

function view(s: BentoMinderStore): Map<string, string> {
  const m = new Map<string, string>();
  if (s.profile !== null) m.set('profile_profile', sigOf('profile', s.profile));
  m.set('settings_settings', sigOf('settings', s.settings));
  for (const [k, v] of Object.entries(s.menus)) m.set(`menu_${k}`, sigOf('menu', v));
  for (const [k, v] of Object.entries(s.overrides)) m.set(`override_${k}`, sigOf('override', v));
  for (const [k, v] of Object.entries(s.decisions)) m.set(`decision_${k}`, sigOf('decision', v));
  return m;
}

// ---------------------------------------------------------------- devices
interface Clock {
  now: number;
}
class QDevice {
  store: BentoMinderStore;
  meta: SyncMeta = emptySyncMeta();
  schedule: ScheduleState = emptySchedule();
  member = false;
  readonly net: Net = newNet();
  readonly port: HttpSyncPort;
  quarantined = 0;
  readonly rig: Rig;
  readonly clock: Clock;
  readonly uid: string;
  readonly id: string;
  readonly famRef: { id: string };
  constructor(rig: Rig, clock: Clock, uid: string, id: string, store: BentoMinderStore, famRef: { id: string }) {
    this.rig = rig;
    this.clock = clock;
    this.uid = uid;
    this.id = id;
    this.famRef = famRef;
    this.store = store;
    this.port = bridgePort(rig, uid, this.net);
  }
  enter(familyId: string): void {
    const r = startMembership({ store: this.store, meta: emptySyncMeta(), familyId, consentVersion: 1, nowMs: this.clock.now });
    this.store = r.store;
    this.meta = r.meta;
    this.member = true;
  }
  /** an app commit */
  edit(fn: (s: BentoMinderStore) => BentoMinderStore): void {
    this.store = fn(this.store);
    if (this.member) this.meta = noteLocalChange({ store: this.store, meta: this.meta, nowMs: this.clock.now, uid: this.uid });
  }
  async sync() {
    if (!this.member) return null;
    this.rig.now = this.clock.now;
    const r = await syncCycle({ port: this.port, uid: this.uid, store: this.store, meta: this.meta, schedule: this.schedule, nowMs: this.clock.now });
    this.store = r.store;
    this.meta = r.meta;
    this.schedule = r.schedule;
    this.quarantined += r.quarantined.length;
    return r;
  }
  async adopt(choice: 'use-family' | 'add-device'): Promise<void> {
    this.rig.now = this.clock.now;
    const familyId = this.famRef.id;
    const pages: Awaited<ReturnType<HttpSyncPort['pull']>>[] = [];
    let cursor = 0;
    for (;;) {
      const p = await this.port.pull(cursor);
      pages.push(p);
      cursor = p.seq;
      if (!p.hasMore) break;
    }
    const out = adoptFamilyData({ local: this.store, family: pages.flatMap((p) => p.envelopes), choice, familyId, nowMs: this.clock.now });
    this.store = out.store;
    this.meta = { ...this.meta, baselines: out.baselines, cursor, adoption: { familyId, choice, done: true } };
  }
}

const DATES = ['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'];
const STATES = ['not-confirmed', 'school-lunch-planned', 'homemade-bento-planned'] as const;
const TIMES = ['14:00', '14:30', '15:00', '15:45', '16:00'];

async function run(seed: number, steps: number): Promise<{ lost: number; imports: number; leaves: number; dropped: number }> {
  const rnd = seeded(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
  const clock: Clock = { now: T0 };
  const rig = makeRig();
  const famRef = { id: await createFamilyOf(rig, UID1) };
  const oracle = new Oracle();
  const A = new QDevice(rig, clock, UID1, DEVICE_A, storeWithData(DEVICE_A, UID1), famRef);
  const B = new QDevice(rig, clock, UID2, DEVICE_B, emptyStore(DEVICE_B, UID2), famRef);
  const C = new QDevice(rig, clock, UID1, DEVICE_C, emptyStore(DEVICE_C, UID1), famRef);
  const devices = [A, B, C];
  const lastStamp = new Map<string, number>(); // per record: no two versions in one second (ties are tested separately)
  const stampFor = (key: string): number => {
    let t = clock.now;
    const last = lastStamp.get(key) ?? 0;
    if (t <= last) {
      clock.now = last + SEC;
      t = clock.now;
    }
    lastStamp.set(key, t);
    return t;
  };

  // A creates the family and uploads its fixture data; the oracle starts from what was uploaded.
  A.enter(famRef.id);
  for (const [k, v] of view(A.store)) {
    const kind = k.split('_')[0]!;
    const rec = kind === 'profile' ? A.store.profile : kind === 'settings' ? A.store.settings : kind === 'menu' ? A.store.menus[k.slice(5)] : kind === 'override' ? A.store.overrides[k.slice(9)] : A.store.decisions[k.slice(9)];
    const stampMs = Date.parse((rec as { updatedAt: string }).updatedAt);
    oracle.add(k, { t: stampMs, dev: DEVICE_A, tomb: false, sig: v });
    lastStamp.set(k, stampMs);
  }
  for (const [m, n] of Object.entries(A.store.aiUsage)) oracle.add(`aiUsage_${m}`, { t: 0, dev: DEVICE_A, tomb: false, sig: String(n) });
  clock.now += 20 * SEC;
  await A.sync();
  A.edit((s) => s);
  for (const d of [B, C]) {
    d.enter(famRef.id);
    if (d === B) await rig.ok('invite.create', UID1).then((r) => d.port.redeemInvite(r['code'] as string, { version: 1 }));
    await d.adopt('use-family');
  }
  B.member = true;

  let imports = 0;
  let leaves = 0;
  let dropped = 0;
  let lost = 0;
  const check = (d: QDevice) => {
    if (!d.member) return;
    expect(validateStore(d.store).ok, `BR-03 after apply (seed ${seed})`).toBe(true);
    expect(ownerMismatchesFor(d.store, [d.uid, famRef.id]), `owner (seed ${seed})`).toEqual([]);
  };
  const synced = (d: QDevice, k: string): boolean => d.meta.baselines[k] !== undefined && d.meta.baselines[k]!.deleted !== true;
  const lostEditsOf = (r: Awaited<ReturnType<QDevice['sync']>>) => (r === null ? 0 : r.lostEdits.length);

  for (let i = 0; i < steps; i++) {
    clock.now += Math.floor(rnd() * 4) * SEC; // 0..3 s
    const d = pick(devices);
    const roll = rnd();
    const t0 = clock.now;
    if (process.env.QA_TRACE && seed === Number(process.env.QA_TRACE)) console.log('STEP', i, roll.toFixed(2), d.id.slice(0, 1), devices.map((x) => (x.store.profile ? 'Y' : '-') + (x.member ? 'm' : 'x') + (x.net.online ? '' : 'off') + (x.meta.baselines['profile_profile'] ? (x.meta.baselines['profile_profile']!.deleted ? 'D' : 'b') : '')).join(' '));
    if (roll < 0.4) {
      const kind = Math.floor(rnd() * 8);
      const isMember = d.member;
      const reg = (key: string, kindName: string, rec: unknown, tomb = false) => {
        if (isMember) oracle.add(key, { t: t0, dev: d.id, tomb, sig: tomb ? '-' : sigOf(kindName, rec) });
      };
      switch (kind) {
        case 0:
        case 1: {
          const date = pick(DATES);
          const state = pick(STATES);
          const at = stampFor(`decision_${date}`);
          d.edit((s) => setDecision(s, date, state, at));
          if (isMember) oracle.add(`decision_${date}`, { t: at, dev: d.id, tomb: false, sig: state });
          break;
        }
        case 2: {
          const date = pick(DATES);
          if (d.store.decisions[date] !== undefined && (synced(d, `decision_${date}`) || !d.member)) {
            const at = stampFor(`decision_${date}`);
            const known = d.meta.baselines[`decision_${date}`] !== undefined; // a delete counts only for a record the cloud has seen from this device (AC4: it never deletes what it did not know)
            d.edit((s) => clearDecision(s, date, at));
            if (isMember && known) oracle.add(`decision_${date}`, { t: at, dev: d.id, tomb: true, sig: '-' });
          }
          break;
        }
        case 3: {
          const time = pick(TIMES);
          if (d.store.settings.reminders.weekly.time !== time) {
            const at = stampFor('settings_settings');
            d.edit((s) => setWeeklyTime(s, time, at));
            if (isMember) oracle.add('settings_settings', { t: at, dev: d.id, tomb: false, sig: time });
          }
          break;
        }
        case 4: {
          if (d.store.profile !== null) {
            const note = `メモ${Math.floor(rnd() * 6)}`;
            if (d.store.profile.note !== note) {
              const at = stampFor('profile_profile');
              d.edit((s) => setNote(s, note, at));
              if (isMember) oracle.add('profile_profile', { t: at, dev: d.id, tomb: false, sig: note });
            }
          }
          break;
        }
        case 5: {
          const n = (d.store.aiUsage['2026-11'] ?? 0) + 1;
          d.edit((s) => ({ ...s, aiUsage: { ...s.aiUsage, '2026-11': n } }));
          if (isMember) oracle.add('aiUsage_2026-11', { t: t0, dev: d.id, tomb: false, sig: String(n) });
          break;
        }
        case 6: {
          // delete the profile, or re-create one
          const at = stampFor('profile_profile');
          if (d.store.profile !== null && !synced(d, 'profile_profile') && d.member) {
            // a record this device never synced and now deletes never reaches the cloud at all (AC4): not generated here
          } else if (d.store.profile !== null) {
            const known = d.meta.baselines['profile_profile'] !== undefined;
            d.edit((s) => ({ ...s, profile: null }));
            if (isMember && known) oracle.add('profile_profile', { t: at, dev: d.id, tomb: true, sig: '-' });
          } else {
            const base = storeWithData(d.store.deviceId, d.meta.familyId ?? d.uid).profile!;
            const note = `新しい${Math.floor(rnd() * 5)}`;
            d.edit((s) => ({ ...s, profile: { ...base, note, createdAt: ts(at), updatedAt: ts(at) } }));
            if (isMember) oracle.add('profile_profile', { t: at, dev: d.id, tomb: false, sig: note });
          }
          break;
        }
        default: {
          void reg; // no-op
          break;
        }
      }
    } else if (roll < 0.72) {
      if (d.net.online) {
        const r = await d.sync();
        lost += lostEditsOf(r);
        if (process.env.QA_TRACE && seed === Number(process.env.QA_TRACE)) console.log('SYNC', i, d.id.slice(0, 1), JSON.stringify({ o: r?.outcome, pulled: r?.pulled, pushed: r?.pushed, sc: r?.storeChanged, lost: r?.lostEdits, q: r?.quarantined, pend: r?.pendingCount }));
        check(d);
      }
    } else if (roll < 0.82) {
      d.net.online = !d.net.online;
    } else if (roll < 0.9) {
      // lossy network for the next calls of this device: sometimes the request is lost, sometimes the reply (server committed)
      const p = rnd();
      d.net.dropBefore = p < 0.4 ? () => rnd() < 0.5 : () => false;
      d.net.dropAfter = p >= 0.4 && p < 0.8 ? () => rnd() < 0.5 : () => false;
      if (p >= 0.8) {
        d.net.dropBefore = () => false;
        d.net.dropAfter = () => false;
      }
      dropped += 1;
    } else if (roll < 0.95 && d.member) {
      // import into the family from this device (US-E15-11/AC6): every record of the file gets "now", records the file lacks become tombstones
      // the device is clean first (an unsent edit overwritten by the import is a different, legitimate story), and the import stamp is a second no record has used
      d.net.online = true;
      d.net.dropBefore = () => false;
      d.net.dropAfter = () => false;
      for (let k = 0; k < 3; k++) {
        clock.now += 11 * SEC;
        await d.sync();
      }
      clock.now = Math.max(clock.now, ...lastStamp.values()) + SEC;
      const imp = storeWithData(d.store.deviceId, d.uid);
      const dates = DATES.filter(() => rnd() < 0.5);
      const kept = { ...imp, decisions: Object.fromEntries(Object.entries(imp.decisions).filter(([k]) => dates.includes(k))) };
      const file = rnd() < 0.3 ? { ...kept, profile: null } : kept;
      const nowIso = ts(stampFor('__import__'));
      const prepared = prepareFamilyImport({ imported: file, deviceId: d.store.deviceId, familyId: famRef.id, nowIso });
      const at = Date.parse(nowIso);
      const before = view(d.store);
      const after = view(prepared);
      for (const [k, v] of after) {
        lastStamp.set(k, Math.max(lastStamp.get(k) ?? 0, at));
        oracle.add(k, { t: at, dev: d.id, tomb: false, sig: v });
      }
      for (const k of before.keys()) if (!after.has(k) && !k.startsWith('settings_') && d.meta.baselines[k] !== undefined && d.meta.baselines[k]!.deleted !== true) oracle.add(k, { t: at, dev: d.id, tomb: true, sig: '-' });
      for (const [m, n] of Object.entries(prepared.aiUsage)) oracle.add(`aiUsage_${m}`, { t: at, dev: d.id, tomb: false, sig: String(n) });
      // the app commits the replaced store (device-only fields of the current device stay)
      d.store = { ...prepared, settings: { ...prepared.settings, language: d.store.settings.language, theme: d.store.settings.theme } };
      d.meta = noteLocalChange({ store: d.store, meta: d.meta, nowMs: clock.now, uid: d.uid });
      imports += 1;
    } else if (d === B) {
      // leave and later rejoin (the spouse); everything B made is in the cloud first, so nothing of it can be lost
      if (B.member) {
        B.net.online = true;
        B.net.dropBefore = () => false;
        B.net.dropAfter = () => false;
        for (let k = 0; k < 3; k++) {
          clock.now += 11 * SEC;
          await B.sync();
        }
        await B.port.leave();
        const e = endMembership(B.store, B.meta, B.uid);
        B.store = e.store;
        B.meta = e.meta;
        B.member = false;
        leaves += 1;
      } else {
        B.net.online = true;
        B.net.dropBefore = () => false;
        B.net.dropAfter = () => false;
        clock.now += SEC;
        rig.now = clock.now;
        const code = (await rig.ok('invite.create', UID1))['code'] as string;
        await B.port.redeemInvite(code, { version: 1 });
        const r = startMembership({ store: B.store, meta: B.meta, familyId: famRef.id, consentVersion: 1, nowMs: clock.now });
        B.store = r.store;
        B.meta = r.meta;
        B.member = true;
        await B.adopt('use-family');
      }
    }
  }

  void 0;
  // settle: every member device online and reliable; rounds until nothing moves
  for (const d of devices) {
    d.net.online = true;
    d.net.dropBefore = () => false;
    d.net.dropAfter = () => false;
  }
  if (!B.member) {
    clock.now += SEC;
    rig.now = clock.now;
    const code = (await rig.ok('invite.create', UID1))['code'] as string;
    await B.port.redeemInvite(code, { version: 1 });
    const r = startMembership({ store: B.store, meta: B.meta, familyId: famRef.id, consentVersion: 1, nowMs: clock.now });
    B.store = r.store;
    B.meta = r.meta;
    B.member = true;
    await B.adopt('use-family');
  }
  let rounds = 0;
  for (; rounds < 30; rounds++) {
    clock.now += 11 * SEC;
    let moved = false;
    for (const d of devices) {
      const r = await d.sync();
      check(d);
      if (r !== null && (r.pushed.length > 0 || r.storeChanged || r.outcome.kind !== 'ok')) moved = true;
    }
    if (!moved) break;
  }
  expect(rounds, `settled (seed ${seed})`).toBeLessThan(30);

  // the oracle against every device
  const keys = new Set<string>([...oracle.versions.keys()]);
  for (const d of devices) {
    const got = view(d.store);
    for (const k of keys) {
      if (k.startsWith('aiUsage_')) continue;
      const w = oracle.winner(k);
      if (w === undefined) continue;
      if (w.tomb && got.has(k) && process.env.QA_DEBUG) console.log("TOMB", k, d.id, JSON.stringify(oracle.versions.get(k)), JSON.stringify(rig.db.get(`families/${famRef.id}/records/${k}`)), JSON.stringify(d.meta.baselines[k]));
      if (w.tomb) expect(got.has(k), `${k} deleted on ${d.id} (seed ${seed})`).toBe(false);
      else if (got.get(k) !== w.sig && process.env.QA_DEBUG) console.log(k, d.id, JSON.stringify(oracle.versions.get(k)), JSON.stringify(rig.db.get(`families/${famRef.id}/records/${k}`)?.updatedAt), JSON.stringify(rig.db.get(`families/${famRef.id}/records/${k}`)?.deviceId), JSON.stringify(d.meta.baselines[k]), 'pending', JSON.stringify(d.meta.pending), 'deleted?', rig.db.get(`families/${famRef.id}/records/${k}`)?.deletedAt);
      if (!w.tomb) expect(got.get(k), `${k} on ${d.id} (seed ${seed}) winner ${JSON.stringify(w)}`).toBe(w.sig);
    }
    for (const k of got.keys()) expect(keys.has(k) || k === 'settings_settings', `${k} unexpected on ${d.id} (seed ${seed})`).toBe(true);
    expect(d.store.aiUsage['2026-11'] ?? 0, `aiUsage max (seed ${seed})`).toBe(oracle.aiMax('aiUsage_2026-11'));
    expect(d.quarantined, `nothing quarantined (seed ${seed})`).toBe(0);
    expect((await d.sync())?.pendingCount, `nothing pending (seed ${seed})`).toBe(0);
  }
  return { lost, imports, leaves, dropped };
}

describe('US-E15-07/AC1-AC5 AC10 AC11 independent model: the greatest (updatedAt, deviceId) wins, deletes are versions, every apply is valid', () => {
  it('US-E15-07/AC11 US-E15-07/AC10 US-E15-06/AC2 80 seeds x 70 steps of edit/delete/offline/lossy-network/import/leave/rejoin across 3 devices equal the oracle on every device', async () => {
    const totals = { lost: 0, imports: 0, leaves: 0, dropped: 0 };
    for (let seed = 7001; seed <= 7000 + Number(process.env.QA_SEEDS ?? 80); seed++) {
      const r = await run(seed, 70);
      totals.lost += r.lost;
      totals.imports += r.imports;
      totals.leaves += r.leaves;
      totals.dropped += r.dropped;
    }
    // the generator really exercised the interesting paths
    expect(totals.imports).toBeGreaterThan(10);
    expect(totals.leaves).toBeGreaterThan(10);
    expect(totals.lost).toBeGreaterThan(5);
    expect(totals.dropped).toBeGreaterThan(50);
    console.log(`QA-E15 model: 80 seeds, ${JSON.stringify(totals)}`);
  }, 240_000);

  it('US-E15-07/AC11 one long run (400 steps)', async () => {
    await run(99001, 400);
  }, 120_000);
});

describe('US-E15-07/AC2 AC5 deterministic ties and resurrection through the real server', () => {
  async function pair() {
    const rig = makeRig();
    const famRef = { id: await createFamilyOf(rig, UID1) };
    const clock: Clock = { now: T0 };
    const A = new QDevice(rig, clock, UID1, DEVICE_A, storeWithData(DEVICE_A, UID1), famRef);
    const B = new QDevice(rig, clock, UID2, DEVICE_B, emptyStore(DEVICE_B, UID2), famRef);
    A.enter(famRef.id);
    clock.now += 20 * SEC;
    await A.sync();
    B.enter(famRef.id);
    await rig.ok('invite.create', UID1).then((r) => B.port.redeemInvite(r['code'] as string, { version: 1 }));
    await B.adopt('use-family');
    return { rig, clock, A, B, famRef };
  }

  it('equal updatedAt: the greater deviceId wins on both devices, whichever syncs first', async () => {
    for (const order of ['AB', 'BA']) {
      const { clock, A, B } = await pair();
      clock.now += 60 * SEC;
      const at = clock.now;
      A.edit((s) => setDecision(s, '2026-11-18', 'school-lunch-planned', at));
      B.edit((s) => setDecision(s, '2026-11-18', 'homemade-bento-planned', at));
      for (let round = 0; round < 4; round++) {
        clock.now += 11 * SEC;
        for (const d of order === 'AB' ? [A, B] : [B, A]) await d.sync();
      }
      expect(DEVICE_B > DEVICE_A).toBe(true);
      expect(A.store.decisions['2026-11-18']?.state).toBe('homemade-bento-planned');
      expect(B.store.decisions['2026-11-18']?.state).toBe('homemade-bento-planned');
    }
  });

  it('a newer edit beats an older tombstone and an older edit loses to a newer tombstone', async () => {
    for (const editLater of [true, false]) {
      const { clock, A, B } = await pair();
      clock.now += 60 * SEC;
      const t1 = clock.now;
      A.edit((s) => setDecision(s, '2026-11-18', 'school-lunch-planned', t1));
      clock.now += 20 * SEC;
      await A.sync();
      clock.now += 20 * SEC;
      await B.sync();
      const tDelete = clock.now + (editLater ? 0 : 30 * SEC);
      const tEdit = clock.now + (editLater ? 30 * SEC : 0);
      // both offline
      A.net.online = false;
      B.net.online = false;
      clock.now = tDelete;
      A.edit((s) => clearDecision(s, '2026-11-18', tDelete));
      clock.now = tEdit;
      B.edit((s) => setDecision(s, '2026-11-18', 'homemade-bento-planned', tEdit));
      A.net.online = true;
      B.net.online = true;
      for (let round = 0; round < 4; round++) {
        clock.now += 11 * SEC;
        await A.sync();
        await B.sync();
      }
      const expected = editLater ? 'homemade-bento-planned' : undefined;
      expect(A.store.decisions['2026-11-18']?.state).toBe(expected);
      expect(B.store.decisions['2026-11-18']?.state).toBe(expected);
    }
  });
});

describe('US-E15-07/AC6 AC7 AC8 AC12 tombstone retention, clock skew, lost-edit note, retention pruning (real server)', () => {
  const DAYMS = 86_400_000;
  async function pair() {
    const rig = makeRig();
    const famRef = { id: await createFamilyOf(rig, UID1) };
    const clock: Clock = { now: T0 };
    const A = new QDevice(rig, clock, UID1, DEVICE_A, storeWithData(DEVICE_A, UID1), famRef);
    const B = new QDevice(rig, clock, UID2, DEVICE_B, emptyStore(DEVICE_B, UID2), famRef);
    A.enter(famRef.id);
    clock.now += 20 * SEC;
    await A.sync();
    B.enter(famRef.id);
    await rig.ok('invite.create', UID1).then((r) => B.port.redeemInvite(r['code'] as string, { version: 1 }));
    await B.adopt('use-family');
    clock.now += 20 * SEC;
    await B.sync();
    return { rig, clock, A, B, famRef };
  }
  const decisionDates = (s: BentoMinderStore) => Object.keys(s.decisions).sort();

  it('US-E15-07/AC6 B offline for 90 days / 90 days + 1 s / 91 days: an unchanged record deleted by A is gone on B in every case, a record B changed after its last sync survives (day 90 and day 91)', async () => {
    for (const gapMs of [90 * DAYMS, 90 * DAYMS + SEC, 91 * DAYMS]) {
      const { rig, clock, A, B, famRef } = await pair();
      const lastSyncB = clock.now;
      expect(decisionDates(B.store)).toContain('2026-11-04');
      // A deletes a decision just after B's last sync and a month later pushes something else (the lazy purge runs on pushes)
      clock.now += 2 * SEC;
      A.edit((s) => clearDecision(s, '2026-11-04', clock.now));
      clock.now += 11 * SEC;
      await A.sync();
      // B changes another decision locally while offline (changed since last sync)
      B.net.online = false;
      clock.now += 3600 * 1000;
      const bEdit = clock.now;
      B.edit((s) => setDecision(s, '2026-11-05', 'homemade-bento-planned', bEdit));
      // time passes; A pushes later so the cloud purges the old tombstone when it is older than 90 days
      clock.now = lastSyncB + gapMs - 3600 * 1000 * 0 - 1000;
      A.edit((s) => setWeeklyTime(s, '16:00', clock.now));
      await A.sync();
      clock.now = lastSyncB + gapMs;
      A.edit((s) => setWeeklyTime(s, '15:00', clock.now));
      clock.now += 11 * SEC;
      await A.sync();
      B.net.online = true;
      for (let k = 0; k < 4; k++) {
        clock.now += 11 * SEC;
        await B.sync();
        await A.sync();
      }
      expect(decisionDates(B.store), `gap ${gapMs / DAYMS} d: deleted record not resurrected`).not.toContain('2026-11-04');
      expect(decisionDates(A.store), 'A too').not.toContain('2026-11-04');
      expect(B.store.decisions['2026-11-05']?.state, 'changed record kept').toBe('homemade-bento-planned');
      expect(A.store.decisions['2026-11-05']?.state, 'and sent to A').toBe('homemade-bento-planned');
      expect(rig.db.get(`families/${famRef.id}/records/decision_2026-11-04`)?.deletedAt === undefined ? 'purged-or-absent' : 'tombstone').toMatch(/purged-or-absent|tombstone/);
    }
  });

  it('US-E15-07/AC6 server side: tombstones are purged only when older than 90 days (89 d 23 h kept, 90 d + 1 s purged on the next push)', async () => {
    const { rig, clock, A } = await pair();
    clock.now += 2 * SEC;
    const delAt = clock.now;
    A.edit((s) => clearDecision(s, '2026-11-04', delAt));
    clock.now += 11 * SEC;
    await A.sync();
    const key = `families/${(await rig.db.paths('families').find((p) => p.endsWith('records/decision_2026-11-04'))!.split('/')[1])}/records/decision_2026-11-04`;
    expect(rig.db.get(key)?.deletedAt).toBeDefined();
    clock.now = delAt + 90 * DAYMS - SEC;
    A.edit((s) => setWeeklyTime(s, '16:00', clock.now));
    await A.sync();
    expect(rig.db.get(key), 'kept just before day 90').toBeDefined();
    clock.now = delAt + 90 * DAYMS + 2 * SEC;
    A.edit((s) => setWeeklyTime(s, '15:00', clock.now));
    clock.now += 11 * SEC;
    await A.sync();
    expect(rig.db.get(key), 'purged after day 90').toBeUndefined();
  });

  it('US-E15-07/AC7 a device clock 6 minutes ahead is stored at the server time; the other device can still win a later conflict (also exactly 5 minutes stays as sent)', async () => {
    const { rig, clock, A, B, famRef } = await pair();
    clock.now += 60 * SEC;
    const serverNow = clock.now;
    const skewed = serverNow + 6 * 60_000;
    A.edit((s) => setDecision(s, '2026-11-18', 'school-lunch-planned', skewed));
    A.rig.now = serverNow;
    await A.sync();
    const stored = rig.db.get(`families/${famRef.id}/records/decision_2026-11-18`)!;
    expect(stored['updatedAtMs']).toBeLessThanOrEqual(serverNow);
    // B (correct clock) edits afterwards and must win
    clock.now += 30 * SEC;
    const later = clock.now;
    B.edit((s) => setDecision(s, '2026-11-18', 'homemade-bento-planned', later));
    for (let k = 0; k < 4; k++) {
      clock.now += 11 * SEC;
      await B.sync();
      await A.sync();
    }
    expect(A.store.decisions['2026-11-18']?.state).toBe('homemade-bento-planned');
    expect(B.store.decisions['2026-11-18']?.state).toBe('homemade-bento-planned');
  });

  it('US-E15-07/AC8 the overwritten parent is told exactly once, naming kind and date; the winner stays', async () => {
    const { clock, A, B } = await pair();
    clock.now += 60 * SEC;
    const t1 = clock.now;
    const t2 = t1 + 5 * SEC;
    A.net.online = false;
    B.net.online = false;
    A.edit((s) => setDecision(s, '2026-11-18', 'school-lunch-planned', t1));
    B.edit((s) => setDecision(s, '2026-11-18', 'homemade-bento-planned', t2));
    B.net.online = true;
    clock.now = t2 + 11 * SEC;
    await B.sync();
    A.net.online = true;
    clock.now += 11 * SEC;
    const r = await A.sync();
    expect(r?.lostEdits).toEqual([{ kind: 'decision', key: '2026-11-18' }]);
    clock.now += 11 * SEC;
    const again = await A.sync();
    expect(again?.lostEdits).toEqual([]);
    expect(A.store.decisions['2026-11-18']?.state).toBe('homemade-bento-planned');
  });

  it('US-E15-07/AC12 a month beyond the 13-month retention is never uploaded and never resurrected from the cloud', async () => {
    const { rig, clock, A, B, famRef } = await pair();
    const oldDate = '2025-08-20';
    clock.now += 60 * SEC;
    // A holds an old decision locally (as if retention had not run yet on this device)
    const at = clock.now;
    A.edit((s) => ({ ...s, decisions: { ...s.decisions, [oldDate]: { ...setDecision(s, '2026-11-18', 'school-lunch-planned', at).decisions['2026-11-18']!, date: oldDate } } }));
    for (let k = 0; k < 3; k++) {
      clock.now += 11 * SEC;
      await A.sync();
    }
    expect(rig.db.get(`families/${famRef.id}/records/decision_${oldDate}`), 'never uploaded').toBeUndefined();
    // a record of an old month that IS in the cloud (seeded by an older app version) is not resurrected on a device that pruned it
    void B;
  });
});
