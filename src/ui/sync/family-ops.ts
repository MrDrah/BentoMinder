// ADR 016 slice D: what the family screens do, one function per user action. The pure rules live in src/domain/sync
// (adoption matrix, startMembership, endMembership); this file orders the calls: cloud first, then the metadata, then the
// local store, and always hands the finished state back to the controller (`resync`) so the engine continues from it.
// The controller passes in its own serialised metadata access, so nothing here races a running cycle.
import type { Storage } from '../../domain/ports.ts';
import type { BentoMinderStore } from '../../domain/schema/store.ts';
import { storeKeysFor } from '../../domain/storage/keys.ts';
import { StoreConflictError, type Repository } from '../../domain/storage/repository.ts';
import { toJstTimestamp, type Instant } from '../../domain/time/jst.ts';
import { adoptFamilyData, familyHasData, hasData, planFirstSync, safetyCopyExpired, type AdoptionChoice } from '../../domain/sync/adoption.ts';
import { endMembership, startMembership } from '../../domain/sync/membership.ts';
import { safetyCopyKey, serializeSyncMeta, syncMetaKey, type SyncMeta } from '../../domain/sync/meta.ts';
import type { OwnerScope } from '../../domain/sync/owner-scope.ts';
import { SyncPortError, type Invite, type Membership, type StoredEnvelope, type SyncPort } from '../../domain/sync/types.ts';

export type JoinError = 'generic' | 'expired' | 'full' | 'rate' | 'already' | 'offline' | 'other';
export type JoinResult = { kind: 'done' } | { kind: 'ask' } | { kind: 'error'; error: JoinError };

/** Result of the membership discovery at start (US-E15-05/AC1, AC5, AC6). */
export type Discovery = { kind: 'none' } | { kind: 'member'; adoptionAsked: boolean };

export interface LocalSummary {
  profile: boolean;
  months: number;
  decisions: number;
}

export interface FamilyOps {
  /** The cloud's full view of the family (members, open invite); throws a SyncPortError. */
  membership(): Promise<Membership>;
  /** Reads the account's membership once and starts the first sync when it is a member (no family data before consent). */
  discover(): Promise<Discovery>;
  create(): Promise<void>;
  /** Records the (new) notice version for a member and starts the first sync if it was waiting for consent. */
  acceptConsent(): Promise<void>;
  createInvite(): Promise<Invite>;
  cancelInvite(): Promise<void>;
  join(code: string): Promise<JoinResult>;
  localSummary(): Promise<LocalSummary>;
  completeAdoption(choice: AdoptionChoice): Promise<void>;
  /** Cancel of a first join that was just committed: the membership is undone, nothing of the device changed. */
  cancelJoin(): Promise<void>;
  leave(lastMember: boolean): Promise<void>;
  removeMember(uid: string): Promise<void>;
  deleteFamily(): Promise<void>;
  /** The parent saw "removed" / "family deleted": the device keeps its data as stand-alone (contract 14.7). */
  acknowledgeEnded(): Promise<void>;
  /** The parent deleted the backup copy of the data this device had before it joined (US-E15-04/AC5). */
  deleteSafetyCopy(): Promise<void>;
  /** The raw text of the backup copy, for 「控えを書き出す」; null when there is none. */
  safetyCopy(): Promise<string | null>;
  /** The cloud says this account is not (or no longer) a member while the device still names a family: end it locally. */
  reconcileMembership(): Promise<void>;
  /** Contract 14.4: a backup copy older than 30 days is deleted. Returns true when it did. */
  expireSafetyCopy(): Promise<boolean>;
}

export interface FamilyOpsContext {
  uid: string;
  port: SyncPort & { leaveAsLastMember?: () => Promise<void> };
  repository: Repository;
  storage: Storage;
  scope: OwnerScope;
  nowMs: () => number;
  /** The app's cloud-notice version (the engine's `noticeVersion`). */
  noticeVersion: number;
  freshStore: () => BentoMinderStore;
  /** The controller's metadata queue: one task at a time, never during a cycle's own write. */
  serial: <T>(task: () => Promise<T>) => Promise<T>;
  /** Called inside a metadata step that changes membership or the local copy: a running cycle drops its stale result. */
  membershipChanged: () => void;
  /** Waits between the retries of a delete (tests pass an instant one). */
  wait?: (ms: number) => Promise<void>;
  loadMeta: () => Promise<SyncMeta>;
  /** The store was changed by a membership step and saved: the app shows it. */
  applyStore: (store: BentoMinderStore) => void;
  /** The metadata changed: the controller re-reads it and runs a cycle. */
  resync: () => Promise<void>;
}

const RETRY_WAITS_MS = [1000, 3000, 6000] as const;
const stamp = (ms: number): string => toJstTimestamp(ms as Instant);

export function joinErrorOf(err: unknown): JoinError {
  if (!(err instanceof SyncPortError)) return 'other';
  if (err.kind === 'offline') return 'offline';
  if (err.kind !== 'refused') return 'other';
  switch (err.detail) {
    case 'invalid-code':
    case 'bad-request':
      return 'generic';
    case 'expired':
      return 'expired';
    case 'family-full':
      return 'full';
    case 'too-many-attempts':
      return 'rate';
    case 'already-in-family':
      return 'already';
    default:
      return 'other';
  }
}

export function createFamilyOps(ctx: FamilyOpsContext): FamilyOps {
  const { uid, port, repository, storage, scope, nowMs, noticeVersion } = ctx;
  const keys = storeKeysFor(uid);

  const writeMeta = (meta: SyncMeta): Promise<void> => storage.write(syncMetaKey(uid), serializeSyncMeta(meta));

  async function loadLocal(): Promise<{ store: BentoMinderStore | null; usable: boolean }> {
    const loaded = await repository.load();
    if (loaded.kind === 'ok' || loaded.kind === 'recovered-from-prev') return { store: loaded.state, usable: true };
    if (loaded.kind === 'empty') return { store: null, usable: true };
    return { store: null, usable: false }; // unreadable or newer: local recovery owns it
  }

  async function saveStore(store: BentoMinderStore): Promise<void> {
    try {
      await repository.save(store);
    } catch (err) {
      if (!(err instanceof StoreConflictError)) throw err;
      await repository.save(store, { force: true });
    }
    ctx.applyStore(store);
  }

  async function pullAll(): Promise<{ records: StoredEnvelope[]; seq: number }> {
    const records: StoredEnvelope[] = [];
    let cursor = 0;
    for (;;) {
      const page = await port.pull(cursor);
      records.push(...page.envelopes);
      cursor = page.seq;
      if (!page.hasMore) return { records, seq: cursor };
    }
  }

  /** Create, or a join that needs no question: the family owns the records, the engine uploads or downloads next. */
  async function enter(familyId: string, consentVersion: number, choice: 'upload' | 'download'): Promise<void> {
    await ctx.serial(async () => {
      const meta = await ctx.loadMeta();
      const { store, usable } = await loadLocal();
      if (!usable) throw new Error('local-copy-unreadable');
      const started = startMembership({ store: store ?? ctx.freshStore(), meta, familyId, consentVersion, nowMs: nowMs() });
      ctx.membershipChanged();
      scope.setFamilyId(familyId);
      await writeMeta({ ...started.meta, adoption: { familyId, choice, done: true } });
      if (store !== null) await saveStore(started.store);
    });
    await ctx.resync();
  }

  /** Contract 14.4: pull what the family holds, decide, and either continue silently or leave the question to the screen. */
  async function firstSync(familyId: string, consentVersion: number, consentAt: string): Promise<boolean> {
    const { records } = await pullAll();
    const { store, usable } = await ctx.serial(loadLocal);
    if (!usable) throw new Error('local-copy-unreadable');
    const plan = planFirstSync(store !== null && hasData(store), familyHasData(records));
    if (plan === 'ask') {
      await ctx.serial(async () => {
        const meta = await ctx.loadMeta();
        ctx.membershipChanged();
        scope.setFamilyId(familyId);
        await writeMeta({
          ...meta,
          familyId,
          consent: { version: consentVersion, at: consentAt },
          cursor: 0,
          baselines: {},
          pending: {},
          adoption: { familyId, choice: 'use-family', done: false },
        });
      });
      await ctx.resync();
      return true;
    }
    await enter(familyId, consentVersion, plan);
    return false;
  }

  /**
   * One cloud action of the end of a membership. A 'temporary' answer (the server is still finishing an earlier delete, or a
   * short outage) is asked again a few times; nothing is queued (US-E15-08/AC9): the action either completes now or fails and
   * changes nothing here. 'membership-ended' means the goal is reached already.
   */
  async function cloudStep(call: () => Promise<void>): Promise<void> {
    const wait = ctx.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    for (let attempt = 0; ; attempt += 1) {
      try {
        await call();
        return;
      } catch (err) {
        if (err instanceof SyncPortError && err.kind === 'membership-ended') return;
        if (!(err instanceof SyncPortError) || err.kind !== 'temporary' || attempt >= RETRY_WAITS_MS.length) throw err;
        await wait(RETRY_WAITS_MS[attempt] as number);
      }
    }
  }

  async function endLocal(): Promise<void> {
    await ctx.serial(async () => {
      const meta = await ctx.loadMeta();
      const { store } = await loadLocal();
      const ended = endMembership(store ?? ctx.freshStore(), meta, uid);
      ctx.membershipChanged();
      // Order matters for a crash in between: the store first (the uid is still accepted as owner while the family id is in
      // the metadata), then the metadata. The other order would leave a family-owned store that no rule accepts any more.
      if (store !== null) await saveStore(ended.store);
      scope.setFamilyId(null);
      await writeMeta(ended.meta);
    });
    await ctx.resync();
  }

  return {
    membership: () => port.readMembership(true),

    async discover() {
      const meta = await ctx.loadMeta();
      if (meta.familyId !== null) return { kind: 'member', adoptionAsked: meta.adoption !== null && !meta.adoption.done };
      const m = await port.readMembership(true);
      if (m.status !== 'member') return { kind: 'none' };
      const current = m.consentVersion !== null && m.consentVersion >= noticeVersion;
      if (!current) {
        // Paused until the parent decides (US-E15-02/AC6); the first sync starts at acceptance.
        await ctx.serial(async () => {
          ctx.membershipChanged();
          scope.setFamilyId(m.familyId);
          await writeMeta({ ...(await ctx.loadMeta()), familyId: m.familyId, consent: null });
        });
        await ctx.resync();
        return { kind: 'member', adoptionAsked: false };
      }
      const asked = await firstSync(m.familyId, m.consentVersion as number, m.consentedAt ?? stamp(nowMs()));
      return { kind: 'member', adoptionAsked: asked };
    },

    async create() {
      let familyId: string;
      try {
        familyId = (await port.createFamily({ version: noticeVersion })).familyId;
      } catch (err) {
        // A second tap or an interrupted earlier try: the account is already a member, carry on with that family.
        if (!(err instanceof SyncPortError) || err.detail !== 'already-in-family') throw err;
        const m = await port.readMembership();
        if (m.status !== 'member') throw err;
        familyId = m.familyId;
      }
      await enter(familyId, noticeVersion, 'upload');
    },

    async acceptConsent() {
      await port.setConsent({ version: noticeVersion });
      const meta = await ctx.loadMeta();
      const at = stamp(nowMs());
      if (meta.familyId !== null && meta.adoption === null && meta.lastSyncedAt === null) {
        await firstSync(meta.familyId, noticeVersion, at); // the device had only read the membership so far
        return;
      }
      await ctx.serial(async () => writeMeta({ ...(await ctx.loadMeta()), consent: { version: noticeVersion, at } }));
      await ctx.resync();
    },

    createInvite: () => port.createInvite(),
    cancelInvite: () => port.cancelInvite(),

    async join(code) {
      let familyId: string;
      try {
        familyId = (await port.redeemInvite(code, { version: noticeVersion })).familyId;
      } catch (err) {
        return { kind: 'error', error: joinErrorOf(err) };
      }
      try {
        const asked = await firstSync(familyId, noticeVersion, stamp(nowMs()));
        return asked ? { kind: 'ask' } : { kind: 'done' };
      } catch {
        // The member is added but the download did not finish: the next open resumes (US-E15-04/AC11).
        await ctx.serial(async () => {
          ctx.membershipChanged();
          scope.setFamilyId(familyId);
          await writeMeta({ ...(await ctx.loadMeta()), familyId, consent: { version: noticeVersion, at: stamp(nowMs()) } });
        });
        await ctx.resync();
        return { kind: 'done' };
      }
    },

    async localSummary() {
      const { store } = await ctx.serial(loadLocal);
      return {
        profile: store !== null && store.profile !== null,
        months: store === null ? 0 : Object.keys(store.menus).length,
        decisions: store === null ? 0 : Object.keys(store.decisions).length,
      };
    },

    async completeAdoption(choice) {
      const { records, seq } = await pullAll();
      await ctx.serial(async () => {
        const meta = await ctx.loadMeta();
        const familyId = meta.familyId;
        if (familyId === null || meta.adoption === null || meta.adoption.done) return;
        const { store, usable } = await loadLocal();
        if (!usable) throw new Error('local-copy-unreadable');
        ctx.membershipChanged();
        // Contract 14.4, crash-safe in three writes: (1) the safety copy and its note in the metadata, (2) the new store,
        // (3) the metadata that says the adoption is done. A run that was interrupted after (2) must not copy the already
        // replaced store over the real safety copy, so an existing copy is kept as it is.
        const existing = await storage.read(safetyCopyKey(uid));
        let safety = meta.safety;
        if (existing === null) {
          const raw = await storage.read(keys.state);
          if (raw !== null) {
            await storage.write(safetyCopyKey(uid), raw);
            safety = { createdAt: stamp(nowMs()) };
          }
        } else if (safety === null) {
          safety = { createdAt: stamp(nowMs()) };
        }
        if (safety !== meta.safety) await writeMeta({ ...meta, safety });
        const outcome = adoptFamilyData({ local: store ?? ctx.freshStore(), family: records, choice, familyId, nowMs: nowMs() });
        scope.setFamilyId(familyId);
        await saveStore(outcome.store);
        await writeMeta({
          ...meta,
          cursor: seq,
          baselines: outcome.baselines,
          pending: {},
          adoption: { familyId, choice, done: true },
          safety,
        });
      });
      await ctx.resync();
    },

    async cancelJoin() {
      await port.leave();
      await port.ackMembershipEnd().catch(() => undefined);
      await ctx.serial(async () => {
        const meta = await ctx.loadMeta();
        ctx.membershipChanged();
        scope.setFamilyId(null);
        await writeMeta({ ...meta, familyId: null, consent: null, cursor: 0, baselines: {}, pending: {}, adoption: null });
      });
      await ctx.resync();
    },

    async leave(lastMember) {
      await cloudStep(() => (lastMember && port.leaveAsLastMember !== undefined ? port.leaveAsLastMember() : port.leave()));
      await endLocal();
    },

    async removeMember(memberUid) {
      await port.removeMember(memberUid);
    },

    async deleteFamily() {
      await cloudStep(() => port.deleteFamily());
      await endLocal();
    },

    async acknowledgeEnded() {
      await port.ackMembershipEnd().catch(() => undefined);
      await endLocal();
    },

    safetyCopy: () => storage.read(safetyCopyKey(uid)),

    async reconcileMembership() {
      const meta = await ctx.loadMeta();
      if (meta.familyId === null) return;
      const m = await port.readMembership();
      if (m.status === 'ended' || (m.status === 'member' && m.familyId === meta.familyId)) return; // the cycle reports an end; a member stays
      await endLocal(); // no membership any more (a delete or leave whose local step was interrupted, or a second device of the account)
    },

    async expireSafetyCopy() {
      const due = await ctx.serial(async () => {
        const meta = await ctx.loadMeta();
        if (meta.safety === null || !safetyCopyExpired(meta.safety.createdAt, nowMs())) return false;
        await storage.remove(safetyCopyKey(uid));
        await writeMeta({ ...meta, safety: null });
        return true;
      });
      if (due) await ctx.resync();
      return due;
    },

    async deleteSafetyCopy() {
      await ctx.serial(async () => {
        await storage.remove(safetyCopyKey(uid));
        await writeMeta({ ...(await ctx.loadMeta()), safety: null });
      });
      await ctx.resync();
    },
  };
}
