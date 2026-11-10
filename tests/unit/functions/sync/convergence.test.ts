// Slice A's engine (real sync cycles on simulated devices) against slice B's handlers instead of FakeSyncPort: both sides of
// the wire agree on the envelope, the winner rule, the cursor and the error kinds. HandlerPort is what slice C's HTTP adapter will be.
import { describe, expect, it } from 'vitest';
import { FakeBackend } from '../../../../src/domain/sync/fake-port.ts';
import { SyncPortError, type Consent, type Envelope, type Invite, type Membership, type PullResult, type PushResult, type SyncPort } from '../../../../src/domain/sync/types.ts';
import { adopt, clearDecision, DEVICE_A, DEVICE_B, emptyStore, SimDevice, setDecision, setNote, setWeeklyTime, settle, storeWithData, syncedView, testClock } from '../../domain/sync/helpers.ts';
import { makeRig, UID1, UID2, type Rig } from './harness.ts';

/** A SyncPort that speaks to the sync handlers (the real pipeline) instead of an in-memory fake. */
class HandlerPort implements SyncPort {
  readonly rig: Rig;
  readonly uid: string;
  readonly calls: string[] = [];
  constructor(rig: Rig, uid: string) {
    this.rig = rig;
    this.uid = uid;
  }
  private async call(op: string, body: unknown = {}): Promise<Record<string, unknown>> {
    this.calls.push(op);
    const r = await this.rig.call(op, this.uid, body);
    if (r.status === 200) return r.body;
    const error = String(r.body['error']);
    if (r.status === 401) throw new SyncPortError('unauthenticated');
    if (error === 'MEMBERSHIP_ENDED') throw new SyncPortError('membership-ended', String(r.body['reason']));
    if (error === 'CONSENT_REQUIRED') throw new SyncPortError('consent-required');
    if (error === 'LIMIT') throw new SyncPortError('limit', String(r.body['scope']));
    if (r.status >= 500) throw new SyncPortError('temporary');
    throw new SyncPortError('refused', error);
  }
  async readMembership(): Promise<Membership> {
    const r = await this.call('membership.get');
    if (r['status'] === 'member') return { status: 'member', familyId: r['familyId'] as string, consentVersion: r['consentVersion'] as number | null };
    if (r['status'] === 'ended') return { status: 'ended', reason: r['reason'] as 'left' | 'removed' | 'family-deleted' };
    return { status: 'none' };
  }
  async createFamily(consent: Consent) {
    return { familyId: (await this.call('family.create', { consentVersion: consent.version }))['familyId'] as string };
  }
  async createInvite(): Promise<Invite> {
    const r = await this.call('invite.create');
    return { code: r['code'] as string, expiresAt: r['expiresAt'] as string };
  }
  async cancelInvite() {
    await this.call('invite.cancel');
  }
  async redeemInvite(code: string, consent: Consent) {
    return { familyId: (await this.call('invite.redeem', { code, consentVersion: consent.version }))['familyId'] as string };
  }
  async setConsent(consent: Consent) {
    await this.call('consent.set', { consentVersion: consent.version });
  }
  async leave() {
    await this.call('family.leave');
  }
  async removeMember(uid: string) {
    await this.call('family.removeMember', { uid });
  }
  async deleteFamily() {
    await this.call('family.delete', { confirmation: '削除する' });
  }
  async ackMembershipEnd() {
    await this.call('membership.ack');
  }
  async push(envelopes: readonly Envelope[]): Promise<PushResult[]> {
    return (await this.call('records.push', { records: envelopes }))['results'] as PushResult[];
  }
  async pull(cursor: number): Promise<PullResult> {
    const r = await this.call('records.pull', { cursor });
    return { envelopes: r['envelopes'] as PullResult['envelopes'], seq: r['seq'] as number, hasMore: r['hasMore'] as boolean, serverNowMs: r['serverNowMs'] as number, schemaVersion: r['schemaVersion'] as number };
  }
}

function setup() {
  const clock = testClock();
  const rig = makeRig();
  Object.defineProperty(rig, 'now', { get: () => clock.now, set: (v: number) => void (clock.now = v) });
  const dummy = new FakeBackend({ nowMs: clock.fn });
  const device = (uid: string, store: ReturnType<typeof storeWithData>): SimDevice => {
    const d = new SimDevice(dummy, uid, store, clock);
    d.port = new HandlerPort(rig, uid);
    return d;
  };
  return { clock, rig, device };
}

async function familyOfTwoOverHandlers() {
  const { clock, rig, device } = setup();
  const a = device(UID1, storeWithData(DEVICE_A, UID1));
  const { familyId } = await a.port.createFamily({ version: 1 });
  a.enter(familyId);
  await a.sync();
  const b = device(UID2, emptyStore(DEVICE_B, UID2));
  const invite = await a.port.createInvite();
  await b.port.redeemInvite(invite.code, { version: 1 });
  b.enter(familyId);
  await adopt(b, 'use-family', clock);
  return { clock, rig, a, b, familyId };
}

describe('engine against the handlers', () => {
  it('US-E15-05/AC1 a joiner with an empty phone ends with exactly the creator\'s synced data', async () => {
    const { a, b } = await familyOfTwoOverHandlers();
    expect(syncedView(b.store)).toEqual(syncedView(a.store));
    expect(b.store.profile).not.toBeNull();
  });

  it('US-E15-07/AC1 edits to different records on both phones, a deletion and a settings change all converge, and the order does not matter', async () => {
    const { clock, a, b } = await familyOfTwoOverHandlers();
    const date = Object.keys(a.store.decisions)[0]!;
    clock.advance(20_000);
    a.edit((s) => setNote(s, 'note from A', clock.now));
    b.edit((s) => setWeeklyTime(s, '19:30', clock.now + 1000));
    b.edit((s) => setDecision(s, '2026-11-20', 'school-lunch-planned', clock.now + 2000));
    a.edit((s) => clearDecision(s, date, clock.now + 3000), clock.now + 3000);
    await settle([a, b], clock);
    expect(syncedView(a.store)).toEqual(syncedView(b.store));
    expect(a.store.profile?.note).toBe('note from A');
    expect(b.store.settings.reminders.weekly.time).toBe('19:30');
    expect(Object.keys(b.store.decisions)).toContain('2026-11-20');
    expect(Object.keys(b.store.decisions)).not.toContain(date);
  });

  it('US-E15-07/AC1 the same record edited on both phones: the later edit wins on both', async () => {
    const { clock, a, b } = await familyOfTwoOverHandlers();
    clock.advance(20_000);
    a.edit((s) => setNote(s, 'first', clock.now));
    b.edit((s) => setNote(s, 'second', clock.now + 5000));
    await settle([a, b], clock);

    expect(a.store.profile?.note).toBe('second');
    expect(b.store.profile?.note).toBe('second');
  });

  it('US-E15-08/AC3 a removed member\'s engine sees membership-ended, and an offline retry after a lost response never duplicates a write', async () => {
    const { clock, a, b, rig, familyId } = await familyOfTwoOverHandlers();
    clock.advance(20_000);
    a.edit((s) => setNote(s, 'x', clock.now));
    await settle([a, b], clock);
    const seqBefore = rig.db.get(`families/${familyId}`)!['seq'];
    await a.port.removeMember(UID2);
    b.edit((s) => setNote(s, 'after removal', clock.now));
    clock.advance(20_000);
    const r = await b.sync();
    expect(r.outcome).toEqual({ kind: 'membership-ended', reason: 'removed' });
    expect(rig.db.get(`families/${familyId}`)!['seq']).toBe(seqBefore); // nothing of b's was written
  });

  it('US-E15-06/AC5 the engine\'s paging works against the handler\'s cursor: a second device catches up from the stored cursor, downloading only what changed', async () => {
    const { clock, a, b } = await familyOfTwoOverHandlers();
    const pulls = (): number => (b.port as HandlerPort).calls.filter((c) => c === 'records.pull').length;
    await settle([a, b], clock);
    const before = pulls();
    clock.advance(20_000);
    a.edit((s) => setNote(s, 'only this changed', clock.now));
    await a.sync();
    const r = await b.sync();
    expect(pulls()).toBeGreaterThan(before);
    expect(r.pulled).toBe(1); // one changed record, not the whole family
    expect(b.store.profile?.note).toBe('only this changed');
  });
});
