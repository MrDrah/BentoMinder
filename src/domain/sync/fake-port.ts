// Contract 14.12: the fake adapter behind SyncPort. An in-memory cloud ("backend") shared by any number of ports (one
// per signed-in device), with a family store and a sequence cursor, the server's rules that matter to the client
// (membership and consent checks, winner rule, skew clamp, size limits) and switches to simulate offline, failing,
// slow-to-arrive and conflicting behaviour. Test support, but it lives in the domain so slice C and the e2e fixtures reuse it.
// It is not the server: the Function (slice B) has its own tests; this only has to be faithful enough for the client.
import { CLOUD_NOTICE_VERSION, SYNC_LIMITS } from './config.ts';
import { validateEnvelope } from './envelope.ts';
import { utf8Bytes } from './hash.ts';
import { clampUpdatedAt, compareEnvelopes } from './merge.ts';
import { toJstTimestamp, type Instant } from '../time/jst.ts';
import {
  SyncPortError,
  recordKeyOf,
  type Consent,
  type EndedReason,
  type Envelope,
  type Invite,
  type Membership,
  type PullResult,
  type PushResult,
  type RecordKey,
  type StoredEnvelope,
  type SyncPort,
} from './types.ts';

interface FakeFamily {
  id: string;
  seq: number;
  schemaVersion: number;
  records: Map<RecordKey, StoredEnvelope>;
  members: Map<string, { consentVersion: number | null }>;
  totalBytes: number;
  invite: { code: string; createdBy: string; expiresAtMs: number; usedBy?: string; cancelled?: true } | null;
}

interface FakeAccount {
  status: 'member' | 'ended';
  familyId?: string;
  endedReason?: EndedReason;
}

export interface FakeBackendOptions {
  nowMs: () => number;
  maxMembers?: number;
  /** The least cloud-notice version the server accepts for family data (CLOUD_NOTICE_MIN_VERSION). */
  minConsentVersion?: number;
  pullPageSize?: number;
}

const normalise = (code: string): string => code.toUpperCase().replace(/[\s-]/g, '');

export class FakeBackend {
  readonly families = new Map<string, FakeFamily>();
  readonly accounts = new Map<string, FakeAccount>();
  /** Sign-in e-mails shown in the member list (the wire sends `email` only when known). */
  readonly emails = new Map<string, string>();
  readonly nowMs: () => number;
  readonly maxMembers: number;
  readonly minConsentVersion: number;
  readonly pullPageSize: number;
  private familyCounter = 0;
  private inviteCounter = 0;

  constructor(options: FakeBackendOptions) {
    this.nowMs = options.nowMs;
    this.maxMembers = options.maxMembers ?? SYNC_LIMITS.maxMembers;
    this.minConsentVersion = options.minConsentVersion ?? CLOUD_NOTICE_VERSION;
    this.pullPageSize = options.pullPageSize ?? SYNC_LIMITS.pullPageSize;
  }

  /** A device of `uid`. Several ports may share one uid (two phones) or use different uids (two parents). */
  portFor(uid: string): FakeSyncPort {
    return new FakeSyncPort(this, uid);
  }

  /** Simulates the cloud's tombstone purge (US-E15-07/AC6): drops tombstones whose `deletedAt` is older than `olderThanMs`. */
  purgeTombstones(familyId: string, olderThanMs: number): number {
    const fam = this.families.get(familyId);
    if (fam === undefined) return 0;
    let n = 0;
    for (const [k, r] of fam.records) {
      if (r.deletedAt !== undefined && Date.parse(r.deletedAt) < olderThanMs) {
        fam.records.delete(k);
        n += 1;
      }
    }
    return n;
  }

  /** Everything still stored under a family (the completeness listing of US-E15-08/AC11). */
  listAll(familyId: string): string[] {
    const fam = this.families.get(familyId);
    if (fam === undefined) return [];
    return [`families/${familyId}`, ...[...fam.members.keys()].map((u) => `members/${u}`), ...fam.records.keys()];
  }

  /** @internal */
  newFamily(): FakeFamily {
    this.familyCounter += 1;
    const id = `fam-test-${String(this.familyCounter).padStart(3, '0')}`;
    const fam: FakeFamily = { id, seq: 0, schemaVersion: 1, records: new Map(), members: new Map(), totalBytes: 0, invite: null };
    this.families.set(id, fam);
    return fam;
  }

  /** @internal Deterministic codes: the contract fixture first, then derived ones. */
  nextCode(): string {
    this.inviteCounter += 1;
    return this.inviteCounter === 1 ? 'ABCD234567' : `FAKE${String(this.inviteCounter).padStart(6, '2')}`;
  }
}

export interface FakeCall {
  op: string;
  uid: string;
  count?: number;
}

export class FakeSyncPort implements SyncPort {
  /** Simulated network switch: every call fails with `offline` while true. */
  offline = false;
  /** Scripted failures: the next data calls (push or pull) fail with these, in order. */
  readonly script: SyncPortError[] = [];
  /** When set, a push is applied by the server but its answer is lost (the client sees `temporary`). */
  loseNextPushResponse = false;
  readonly calls: FakeCall[] = [];
  private hint: (() => void) | undefined;

  private readonly backend: FakeBackend;
  readonly uid: string;

  constructor(backend: FakeBackend, uid: string) {
    this.backend = backend;
    this.uid = uid;
  }

  private enter(op: string, count?: number): void {
    this.calls.push(count === undefined ? { op, uid: this.uid } : { op, uid: this.uid, count });
    if (this.offline) throw new SyncPortError('offline');
  }

  private scripted(): void {
    const next = this.script.shift();
    if (next !== undefined) throw next;
  }

  private account(): FakeAccount | undefined {
    return this.backend.accounts.get(this.uid);
  }

  /** The one authorisation gate (ADR 016 section 2.1): member, not removed, consent current. */
  private authorize(requireConsent: boolean): FakeFamily {
    const acc = this.account();
    if (acc === undefined) throw new SyncPortError('refused', 'not-member');
    if (acc.status === 'ended') throw new SyncPortError('membership-ended', acc.endedReason ?? 'family-deleted');
    const fam = this.backend.families.get(acc.familyId ?? '');
    const me = fam?.members.get(this.uid);
    if (fam === undefined || me === undefined) throw new SyncPortError('refused', 'not-member');
    if (requireConsent && (me.consentVersion ?? 0) < this.backend.minConsentVersion) throw new SyncPortError('consent-required');
    return fam;
  }

  async readMembership(detail = false): Promise<Membership> {
    this.enter('readMembership');
    const acc = this.account();
    if (acc === undefined) return { status: 'none' };
    if (acc.status === 'ended') return { status: 'ended', reason: acc.endedReason ?? 'family-deleted' };
    const fam = this.backend.families.get(acc.familyId ?? '');
    const base = { status: 'member' as const, familyId: acc.familyId ?? '', consentVersion: fam?.members.get(this.uid)?.consentVersion ?? null };
    if (!detail || fam === undefined) return base;
    const inv = fam.invite;
    const live = inv !== null && inv.usedBy === undefined && inv.cancelled !== true && this.backend.nowMs() < inv.expiresAtMs;
    return {
      ...base,
      maxMembers: this.backend.maxMembers,
      members: [...fam.members.keys()].map((uid) => {
        const email = this.backend.emails.get(uid);
        return { uid, you: uid === this.uid, ...(email === undefined ? {} : { email }) };
      }),
      invite: live ? { code: inv.code, expiresAt: toJstTimestamp(inv.expiresAtMs as Instant) } : null,
    };
  }

  async createFamily(consent: Consent): Promise<{ familyId: string }> {
    this.enter('createFamily');
    if (this.account()?.status === 'member') throw new SyncPortError('refused', 'already-in-family');
    const fam = this.backend.newFamily();
    fam.members.set(this.uid, { consentVersion: consent.version });
    this.backend.accounts.set(this.uid, { status: 'member', familyId: fam.id });
    return { familyId: fam.id };
  }

  async createInvite(): Promise<Invite> {
    this.enter('createInvite');
    const fam = this.authorize(true);
    const code = this.backend.nextCode();
    const expiresAtMs = this.backend.nowMs() + 72 * 3_600_000;
    fam.invite = { code, createdBy: this.uid, expiresAtMs };
    return { code, expiresAt: toJstTimestamp(expiresAtMs as Instant) };
  }

  async cancelInvite(): Promise<void> {
    this.enter('cancelInvite');
    const fam = this.authorize(false);
    if (fam.invite !== null) fam.invite.cancelled = true;
  }

  async redeemInvite(code: string, consent: Consent): Promise<{ familyId: string }> {
    this.enter('redeemInvite');
    if (this.account()?.status === 'member') throw new SyncPortError('refused', 'already-in-family');
    const wanted = normalise(code);
    for (const fam of this.backend.families.values()) {
      const inv = fam.invite;
      if (inv === null || inv.code !== wanted || inv.usedBy !== undefined || inv.cancelled === true) continue;
      if (this.backend.nowMs() >= inv.expiresAtMs) throw new SyncPortError('refused', 'expired');
      if (fam.members.size >= this.backend.maxMembers) throw new SyncPortError('refused', 'family-full');
      fam.members.set(this.uid, { consentVersion: consent.version });
      inv.usedBy = this.uid;
      this.backend.accounts.set(this.uid, { status: 'member', familyId: fam.id });
      return { familyId: fam.id };
    }
    throw new SyncPortError('refused', 'invalid-code');
  }

  async setConsent(consent: Consent): Promise<void> {
    this.enter('setConsent');
    const fam = this.authorize(false);
    const me = fam.members.get(this.uid);
    if (me !== undefined) me.consentVersion = consent.version;
  }

  private drop(fam: FakeFamily, uid: string, reason: EndedReason): void {
    fam.members.delete(uid);
    this.backend.accounts.set(uid, { status: 'ended', familyId: fam.id, endedReason: reason });
  }

  async leave(): Promise<void> {
    this.enter('leave');
    const fam = this.authorize(false);
    this.drop(fam, this.uid, 'left');
    if (fam.members.size === 0) this.backend.families.delete(fam.id);
  }

  async removeMember(uid: string): Promise<void> {
    this.enter('removeMember');
    const fam = this.authorize(false);
    if (!fam.members.has(uid) || uid === this.uid) throw new SyncPortError('refused', 'not-a-member');
    this.drop(fam, uid, 'removed');
  }

  async deleteFamily(): Promise<void> {
    this.enter('deleteFamily');
    const fam = this.authorize(false);
    for (const uid of [...fam.members.keys()]) {
      if (uid === this.uid) this.backend.accounts.delete(uid);
      else this.backend.accounts.set(uid, { status: 'ended', familyId: fam.id, endedReason: 'family-deleted' });
    }
    this.backend.families.delete(fam.id);
  }

  async ackMembershipEnd(): Promise<void> {
    this.enter('ackMembershipEnd');
    if (this.account()?.status === 'ended') this.backend.accounts.delete(this.uid);
  }

  async push(envelopes: readonly Envelope[]): Promise<PushResult[]> {
    this.enter('push', envelopes.length);
    this.scripted();
    const fam = this.authorize(true);
    if (envelopes.length > SYNC_LIMITS.pushBatchSize) throw new SyncPortError('refused', 'batch-too-large');
    const now = this.backend.nowMs();
    const results: PushResult[] = [];
    let bumped = false;
    for (const sent of envelopes) {
      const checked = validateEnvelope(sent);
      if (!checked.ok) throw new SyncPortError('refused', `${checked.rule}:${checked.reason}`);
      if (sent.payloadJson !== undefined && utf8Bytes(sent.payloadJson) > SYNC_LIMITS.maxRecordBytes) throw new SyncPortError('limit', 'record');
      const key = recordKeyOf(sent);
      // updatedBy comes from the token, never from the request; the skew clamp keeps one wrong clock from winning for good.
      const clamped = clampUpdatedAt(sent.updatedAtMs, now);
      const incoming: Envelope = {
        ...sent,
        updatedBy: this.uid,
        ...(clamped === sent.updatedAtMs
          ? {}
          : { updatedAtMs: clamped, updatedAt: toJstTimestamp(clamped as Instant), ...(sent.deletedAt === undefined ? {} : { deletedAt: toJstTimestamp(clamped as Instant) }) }),
      };
      const existing = fam.records.get(key);
      if (existing !== undefined && compareEnvelopes(incoming, existing) < 0) {
        results.push({ kind: sent.kind, key: sent.key, status: 'superseded', winner: existing });
        continue;
      }
      if (existing !== undefined && compareEnvelopes(incoming, existing) === 0) {
        results.push({ kind: sent.kind, key: sent.key, status: 'accepted', stored: existing });
        continue;
      }
      const bytes = utf8Bytes(incoming.payloadJson ?? '');
      const delta = bytes - utf8Bytes(existing?.payloadJson ?? '');
      if (fam.totalBytes + delta > SYNC_LIMITS.maxFamilyBytes) throw new SyncPortError('limit', 'family');
      if (!bumped) {
        fam.seq += 1;
        bumped = true;
      }
      const stored: StoredEnvelope = { ...incoming, seq: fam.seq };
      fam.records.set(key, stored);
      fam.totalBytes += delta;
      results.push({ kind: sent.kind, key: sent.key, status: 'accepted', stored });
    }
    if (this.loseNextPushResponse) {
      this.loseNextPushResponse = false;
      throw new SyncPortError('temporary', 'response-lost');
    }
    return results;
  }

  async pull(cursor: number): Promise<PullResult> {
    this.enter('pull');
    this.scripted();
    const fam = this.authorize(true);
    const all = [...fam.records.values()].filter((r) => r.seq > cursor).sort((a, b) => a.seq - b.seq);
    let end = Math.min(this.backend.pullPageSize, all.length);
    // A page never splits records that share one sequence number (one push), or the cursor would skip some.
    while (end < all.length && all[end]?.seq === all[end - 1]?.seq) end += 1;
    const page = all.slice(0, end);
    const hasMore = all.length > page.length;
    const last = page[page.length - 1];
    return {
      envelopes: page,
      seq: hasMore && last !== undefined ? last.seq : fam.seq,
      hasMore,
      serverNowMs: this.backend.nowMs(),
      schemaVersion: fam.schemaVersion,
    };
  }

  /** Test switch: tells the subscriber "pull now", as a listener adapter would. */
  triggerHint(): void {
    this.hint?.();
  }

  onHint(callback: () => void): () => void {
    this.hint = callback;
    return () => {
      this.hint = undefined;
    };
  }
}
