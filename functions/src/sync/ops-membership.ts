// Membership operations (ADR 016 sections 1, 2.3): create family, invites, redemption, consent, leave, remove, delete.
// Each is one transaction (reads first, then writes), starting with the authorisation gate. A thrown SyncError aborts the
// transaction, so a refusal writes nothing; the one exception is a failed redemption, which returns a value so that the
// attempt counter is committed.
import { toJstTimestamp, type Instant } from '../../../src/domain/time/jst.ts';
import { isAllowed } from '../../../server/core/hosted-policy.ts';
import { authorize, familyMax, familyMembers, gate, readAccount } from './authorize.ts';
import { CODE_ALPHABET, CODE_LENGTH, codeWellFormed, inviteHash, normaliseCode, num, optStr, path, str, without } from './store.ts';
import { refuse, type Caller, type Ctx, type Data, type SyncTx } from './types.ts';

export const CONFIRM_TEXT = '削除する';

const wholeSecond = (ms: number): number => Math.floor(ms / 1000) * 1000;
export const stamp = (ms: number): string => toJstTimestamp(wholeSecond(ms) as Instant);
const HOUR_MS = 3_600_000;

type Body = Record<string, unknown>;

function newFamilyId(ctx: Ctx): string {
  return Buffer.from(ctx.random(16)).toString('base64url'); // 128 bits, never derived from a uid (contract 14.3)
}

function newCode(ctx: Ctx): string {
  // 31 symbols: accept only bytes below 248 (= 31 * 8) so every symbol is equally likely (rejection sampling, no modulo bias).
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let out = '';
  while (out.length < CODE_LENGTH) {
    for (const b of ctx.random(CODE_LENGTH * 2)) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length] as string;
    }
  }
  return out;
}

/** The consent version a request carries: an integer at least the server minimum, or a refusal. */
function consentOf(ctx: Ctx, body: Body): number {
  const v = body['consentVersion'];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1_000_000) throw refuse.badRequest('consentVersion');
  if (v < ctx.config.cloudNoticeMinVersion) throw refuse.consentRequired();
  return v;
}

function memberDoc(ctx: Ctx, caller: Caller, consentVersion: number): Data {
  const d: Data = { joinedAt: stamp(ctx.nowMs()), consentVersion, consentedAt: stamp(ctx.nowMs()) };
  // The e-mail comes from the verified token only, is returned only to members and is never stored locally (ADR 016 Q5).
  // US-E13-08/AC9: an e-mail the provider has not confirmed (a password account) is not stored or shown to members.
  if (caller.emailVerified && caller.email !== undefined && caller.email !== '') d['email'] = caller.email;
  return d;
}

// ---- family.create ------------------------------------------------------------------------------

export async function createFamily(ctx: Ctx, caller: Caller, body: Body): Promise<Data> {
  if (!isAllowed(ctx.allowList, caller)) throw refuse.notAllowed(); // who may create a family: the AI allow-list (ADR 016 section 10 item 2)
  const consentVersion = consentOf(ctx, body);
  const familyId = newFamilyId(ctx);
  await ctx.db.runTransaction(async (tx) => {
    const acct = await readAccount(tx, caller.uid);
    if (acct.status === 'member' || acct.status === 'deleting') throw refuse.alreadyInFamily(); // family-one-per-account
    const clash = await tx.get(path.family(familyId));
    if (clash.exists) throw new Error('family id clash');
    tx.set(path.family(familyId), {
      schemaVersion: 1,
      createdAt: stamp(ctx.nowMs()),
      seq: 0,
      totalBytes: 0,
      maxMembers: ctx.config.maxMembers, // copied from configuration here, never from a request
      memberCount: 1,
      status: 'active',
    });
    tx.set(path.member(familyId, caller.uid), memberDoc(ctx, caller, consentVersion));
    tx.set(path.account(caller.uid), { status: 'member', familyId }); // also clears an `ended` marker
  });
  return { familyId };
}

// ---- membership.get / ack -----------------------------------------------------------------------

export async function getMembership(ctx: Ctx, caller: Caller): Promise<Data> {
  return ctx.db.runTransaction(async (tx) => {
    const acct = await readAccount(tx, caller.uid);
    if (acct.status === 'none') return { status: 'none' };
    if (acct.status === 'ended') return { status: 'ended', reason: acct.reason };
    if (acct.status === 'deleting') return { status: 'deleting' };
    const az = await authorize(tx, caller.uid, acct.familyId, 'membership.get', ctx.config);
    const rows = await tx.query(path.members(az.familyId), {});
    const activeHash = optStr(az.family, 'activeInviteHash');
    const inv = activeHash === undefined ? undefined : await tx.get(path.invite(activeHash));
    const invite =
      inv?.exists === true && inv.data !== undefined && inv.data['cancelledAt'] === undefined && inv.data['usedAt'] === undefined && ctx.nowMs() < num(inv.data, 'expiresAtMs')
        ? { code: str(inv.data, 'code'), expiresAt: str(inv.data, 'expiresAt') }
        : null;
    return {
      status: 'member',
      familyId: az.familyId,
      consentVersion: typeof az.member['consentVersion'] === 'number' ? az.member['consentVersion'] : null,
      consentedAt: optStr(az.member, 'consentedAt') ?? null,
      maxMembers: familyMax(az.family),
      members: rows.map((r) => {
        const uid = r.path.slice(r.path.lastIndexOf('/') + 1);
        return { uid, you: uid === caller.uid, joinedAt: str(r.data, 'joinedAt'), consentVersion: typeof r.data['consentVersion'] === 'number' ? r.data['consentVersion'] : null, ...(optStr(r.data, 'email') === undefined ? {} : { email: optStr(r.data, 'email') }) };
      }),
      invite,
    };
  });
}

export async function ackMembershipEnd(ctx: Ctx, caller: Caller): Promise<Data> {
  await ctx.db.runTransaction(async (tx) => {
    const acct = await readAccount(tx, caller.uid);
    if (acct.status === 'ended') tx.delete(path.account(caller.uid)); // only the caller's own marker
  });
  return {};
}

// ---- consent.set --------------------------------------------------------------------------------

export async function setConsent(ctx: Ctx, caller: Caller, body: Body): Promise<Data> {
  const consentVersion = consentOf(ctx, body);
  await ctx.db.runTransaction(async (tx) => {
    const az = await gate(tx, caller.uid, 'consent.set', ctx.config);
    // Only the caller's own consent fields change (US-E15-09/AC5); nothing else of the member document is touched.
    tx.set(path.member(az.familyId, caller.uid), { ...az.member, consentVersion, consentedAt: stamp(ctx.nowMs()) });
  });
  return {};
}

// ---- invites ------------------------------------------------------------------------------------

class CodeCollision extends Error {}

export async function createInvite(ctx: Ctx, caller: Caller): Promise<Data> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCode(ctx);
    const hash = inviteHash(code);
    try {
      return await ctx.db.runTransaction(async (tx) => {
        const az = await gate(tx, caller.uid, 'invite.create', ctx.config);
        if (familyMembers(az.family) >= familyMax(az.family)) throw refuse.familyFull();
        const previousHash = optStr(az.family, 'activeInviteHash');
        const previous = previousHash === undefined ? undefined : await tx.get(path.invite(previousHash));
        const clash = await tx.get(path.invite(hash));
        if (clash.exists) throw new CodeCollision();
        const nowMs = ctx.nowMs();
        const expiresAtMs = wholeSecond(nowMs) + ctx.config.inviteTtlHours * HOUR_MS;
        // A new invite cancels the earlier one at once (one active invite, US-E15-03/AC4).
        if (previousHash !== undefined && previous?.exists === true && previous.data !== undefined) {
          tx.set(path.invite(previousHash), { ...without(previous.data, 'code'), cancelledAt: stamp(nowMs) });
        }
        tx.set(path.invite(hash), { familyId: az.familyId, code, createdBy: caller.uid, createdAt: stamp(nowMs), expiresAt: stamp(expiresAtMs), expiresAtMs });
        tx.set(path.family(az.familyId), { ...az.family, activeInviteHash: hash });
        return { code, expiresAt: stamp(expiresAtMs) };
      });
    } catch (e) {
      if (!(e instanceof CodeCollision)) throw e;
    }
  }
  throw new Error('no free invite code');
}

export async function cancelInvite(ctx: Ctx, caller: Caller): Promise<Data> {
  await ctx.db.runTransaction(async (tx) => {
    const az = await gate(tx, caller.uid, 'invite.cancel', ctx.config);
    const hash = optStr(az.family, 'activeInviteHash');
    if (hash === undefined) return;
    const inv = await tx.get(path.invite(hash));
    if (inv.exists && inv.data !== undefined) tx.set(path.invite(hash), { ...without(inv.data, 'code'), cancelledAt: stamp(ctx.nowMs()) });
    tx.set(path.family(az.familyId), without(az.family, 'activeInviteHash'));
  });
  return {};
}

type Redeemed = { ok: true; familyId: string } | { ok: false; error: ReturnType<typeof refuse.inviteInvalid> };

export async function redeemInvite(ctx: Ctx, caller: Caller, body: Body): Promise<Data> {
  const rawCode = body['code'];
  if (typeof rawCode !== 'string' || rawCode.length > 64) throw refuse.badRequest('code');
  const consentVersion = consentOf(ctx, body);
  const code = normaliseCode(rawCode);
  const result = await ctx.db.runTransaction<Redeemed>(async (tx) => {
    const acct = await readAccount(tx, caller.uid);
    const attemptsSnap = await tx.get(path.attempts(caller.uid));
    if (acct.status === 'member' || acct.status === 'deleting') throw refuse.alreadyInFamily(); // shown to the redeemer only
    const now = ctx.nowMs();
    const earlier = Array.isArray(attemptsSnap.data?.['fails']) ? (attemptsSnap.data?.['fails'] as unknown[]).filter((t): t is number => typeof t === 'number' && t > now - HOUR_MS && t <= now) : [];
    if (earlier.length >= ctx.config.inviteFailedPerHour) {
      const oldest = Math.min(...earlier);
      throw refuse.tooManyAttempts(Math.max(1, Math.ceil((oldest + HOUR_MS - now) / 1000)));
    }
    const fail = (error: ReturnType<typeof refuse.inviteInvalid>): Redeemed => {
      tx.set(path.attempts(caller.uid), { fails: [...earlier, now] }); // a failed guess is counted and committed
      return { ok: false, error };
    };
    if (!codeWellFormed(code)) return fail(refuse.inviteInvalid());
    const inv = await tx.get(path.invite(inviteHash(code)));
    if (!inv.exists || inv.data === undefined) return fail(refuse.inviteInvalid());
    if (inv.data['usedAt'] !== undefined || inv.data['cancelledAt'] !== undefined) return fail(refuse.inviteInvalid());
    const fam = await tx.get(path.family(str(inv.data, 'familyId')));
    if (!fam.exists || fam.data === undefined || fam.data['status'] !== 'active') return fail(refuse.inviteInvalid());
    if (now >= num(inv.data, 'expiresAtMs')) return fail(refuse.inviteExpired());
    if (familyMembers(fam.data) >= familyMax(fam.data)) return fail(refuse.familyFull());
    const familyId = str(inv.data, 'familyId');
    // All or nothing: member, account index, used invite and the member count are one commit; the first redemption wins.
    tx.set(path.member(familyId, caller.uid), memberDoc(ctx, caller, consentVersion));
    tx.set(path.account(caller.uid), { status: 'member', familyId });
    tx.set(path.invite(inviteHash(code)), { ...without(inv.data, 'code'), usedBy: caller.uid, usedAt: stamp(now) });
    tx.set(path.family(familyId), { ...without(fam.data, 'activeInviteHash'), memberCount: familyMembers(fam.data) + 1 });
    return { ok: true, familyId };
  });
  if (!result.ok) throw result.error;
  return { familyId: result.familyId };
}

// ---- leave / remove / delete --------------------------------------------------------------------

function confirmed(body: Body): boolean {
  return body['confirmation'] === CONFIRM_TEXT;
}

function endMember(ctx: Ctx, tx: SyncTx, familyId: string, family: Data, uid: string, reason: 'left' | 'removed'): void {
  tx.delete(path.member(familyId, uid));
  tx.set(path.account(uid), { status: 'ended', endedReason: reason, endedAt: stamp(ctx.nowMs()) });
  tx.set(path.family(familyId), { ...family, memberCount: Math.max(0, familyMembers(family) - 1) });
}

export async function leaveFamily(ctx: Ctx, caller: Caller, body: Body): Promise<Data> {
  const outcome = await ctx.db.runTransaction<'left' | 'last'>(async (tx) => {
    const az = await gate(tx, caller.uid, 'family.leave', ctx.config);
    if (familyMembers(az.family) <= 1) {
      // The last member leaving takes the delete path, with its typed confirmation (US-E15-08/AC4).
      if (!confirmed(body)) throw refuse.confirmation('last-member');
      return 'last';
    }
    endMember(ctx, tx, az.familyId, az.family, caller.uid, 'left');
    return 'left';
  });
  if (outcome === 'last') return deleteFamily(ctx, caller, body);
  return {};
}

export async function removeMember(ctx: Ctx, caller: Caller, body: Body): Promise<Data> {
  const target = body['uid'];
  if (typeof target !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(target)) throw refuse.badRequest('uid');
  await ctx.db.runTransaction(async (tx) => {
    const az = await gate(tx, caller.uid, 'family.removeMember', ctx.config);
    // The target must belong to the caller's own family; any other uid gets the same answer as an unknown one.
    const t = await tx.get(path.member(az.familyId, target));
    if (target === caller.uid || !t.exists) throw refuse.targetNotFound();
    endMember(ctx, tx, az.familyId, az.family, target, 'removed');
  });
  return {};
}

export async function deleteFamily(ctx: Ctx, caller: Caller, body: Body): Promise<Data> {
  if (!confirmed(body)) throw refuse.confirmation('typed-confirmation');
  // Step 1 (one transaction): cut access first. The family is marked `deleting`, every other member gets a family-deleted
  // marker, the active invite goes, and the caller's own account stays `deleting` so a failed run can be repeated.
  const familyId = await ctx.db.runTransaction<string>(async (tx) => {
    const acct = await readAccount(tx, caller.uid);
    if (acct.status === 'deleting') return acct.familyId; // a retry: the first run already cut access
    const az = await gate(tx, caller.uid, 'family.delete', ctx.config);
    const rows = await tx.query(path.members(az.familyId), {});
    const hash = optStr(az.family, 'activeInviteHash');
    for (const r of rows) {
      const uid = r.path.slice(r.path.lastIndexOf('/') + 1);
      if (uid !== caller.uid) tx.set(path.account(uid), { status: 'ended', endedReason: 'family-deleted', endedAt: stamp(ctx.nowMs()) });
    }
    if (hash !== undefined) tx.delete(path.invite(hash));
    tx.set(path.account(caller.uid), { status: 'deleting', familyId: az.familyId });
    tx.set(path.family(az.familyId), { ...az.family, status: 'deleting' });
    return az.familyId;
  });
  // Step 2: the bulk delete (members, records, the family document), then every invite document of the family.
  await ctx.db.recursiveDelete(path.family(familyId));
  for (const row of await ctx.db.query(path.invites, { where: { field: 'familyId', op: '==', value: familyId } })) await ctx.db.recursiveDelete(row.path);
  // Step 3: only now the caller's own marker goes; the reply says `deleted` after everything is gone.
  await ctx.db.runTransaction(async (tx) => {
    const acct = await readAccount(tx, caller.uid);
    if (acct.status === 'deleting' && acct.familyId === familyId) tx.delete(path.account(caller.uid));
  });
  return { deleted: true };
}
