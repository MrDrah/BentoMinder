// ADR 016 section 2.1: the one authorisation gate. Every operation that touches a family goes through `gate`, which reads
// the caller's account index, then `authorize(tx, uid, familyId, op)`, which requires a member document in that family, an
// active family and (for data operations) a current consent. A removed member is denied on the very next request: no cache,
// no custom claim. The family id is never taken from the request; it comes from the account index.
import { num, path } from './store.ts';
import { refuse, type Data, type SyncTx } from './types.ts';
import type { SyncConfig } from './config.ts';

export const OPS = [
  'membership.get',
  'membership.ack',
  'family.create',
  'invite.create',
  'invite.cancel',
  'invite.redeem',
  'consent.set',
  'family.leave',
  'family.removeMember',
  'family.delete',
  'records.push',
  'records.pull',
] as const;
export type Op = (typeof OPS)[number];

/** `member`: the caller must already belong to a family. `consent`: and must hold a consent of the current minimum version. */
export interface OpRule {
  member: boolean;
  consent: boolean;
}
export const OP_RULES: Record<Op, OpRule> = {
  'membership.get': { member: false, consent: false }, // reads only the caller's own account; the member view goes through authorize
  'membership.ack': { member: false, consent: false }, // touches only the caller's own account marker
  'family.create': { member: false, consent: false }, // the caller must be in NO family (family-one-per-account)
  'invite.redeem': { member: false, consent: false }, // the caller must be in NO family
  'invite.create': { member: true, consent: true },
  'invite.cancel': { member: true, consent: false },
  'consent.set': { member: true, consent: false },
  'family.leave': { member: true, consent: false },
  'family.removeMember': { member: true, consent: false },
  'family.delete': { member: true, consent: false },
  'records.push': { member: true, consent: true },
  'records.pull': { member: true, consent: true },
};

export type AccountState =
  | { status: 'none' }
  | { status: 'member'; familyId: string }
  | { status: 'deleting'; familyId: string }
  | { status: 'ended'; reason: string };

/** Reads the caller's own account index document (one read). */
export async function readAccount(tx: SyncTx, uid: string): Promise<AccountState> {
  const snap = await tx.get(path.account(uid));
  if (!snap.exists || snap.data === undefined) return { status: 'none' };
  const status = snap.data['status'];
  if (status === 'member' || status === 'deleting') {
    const familyId = snap.data['familyId'];
    return typeof familyId === 'string' && familyId !== '' ? { status, familyId } : { status: 'none' };
  }
  if (status === 'ended') {
    const r = snap.data['endedReason'];
    return { status: 'ended', reason: r === 'left' || r === 'removed' || r === 'family-deleted' ? r : 'family-deleted' };
  }
  return { status: 'none' };
}

export interface Authz {
  uid: string;
  familyId: string;
  family: Data;
  member: Data;
}

/**
 * `authorize(uid, familyId, op)`: the caller must be a member of exactly this family. Every refusal for a non-member is
 * the same NOT_MEMBER body, whether the family exists, belongs to someone else or is unknown (US-E15-09/AC2).
 */
export async function authorize(tx: SyncTx, uid: string, familyId: string, op: Op, config: SyncConfig): Promise<Authz> {
  const rule = OP_RULES[op];
  const member = await tx.get(path.member(familyId, uid));
  const family = await tx.get(path.family(familyId));
  if (!member.exists || member.data === undefined || !family.exists || family.data === undefined) throw refuse.notMember();
  if (family.data['status'] !== 'active') throw refuse.ended('family-deleted');
  if (rule.consent) {
    const v = member.data['consentVersion'];
    if (typeof v !== 'number' || v < config.cloudNoticeMinVersion) throw refuse.consentRequired();
  }
  return { uid, familyId, family: family.data, member: member.data };
}

/** Resolves the caller's family from the account index, then authorizes. The first step of every member operation. */
export async function gate(tx: SyncTx, uid: string, op: Op, config: SyncConfig): Promise<Authz> {
  const acct = await readAccount(tx, uid);
  if (acct.status === 'none') throw refuse.notMember();
  if (acct.status === 'ended') throw refuse.ended(acct.reason);
  if (acct.status === 'deleting') throw refuse.ended('family-deleted');
  return authorize(tx, uid, acct.familyId, op, config);
}

export const familySeq = (family: Data): number => num(family, 'seq');
export const familyBytes = (family: Data): number => num(family, 'totalBytes');
export const familyMembers = (family: Data): number => num(family, 'memberCount');
export const familyMax = (family: Data): number => num(family, 'maxMembers');
export const familySchema = (family: Data): number => num(family, 'schemaVersion');
export const memberConsent = (member: Data): number => (typeof member['consentVersion'] === 'number' ? member['consentVersion'] : 0);
