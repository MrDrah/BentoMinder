// ADR 016 slice C (US-E15-06, US-E15-10/AC1): the push path around a SyncPort. It never sends what the server would
// refuse (a live record beyond the 13-month retention, a record over the size limit), and when the server refuses a
// batch for one invalid record it sends the records one by one, so a single bad record never blocks the rest. A record
// the server refused is not offered again until it is edited (its `updatedAt` changes). Pure: time is an argument.
import { SYNC_LIMITS } from './config.ts';
import { utf8Bytes } from './hash.ts';
import { isBeyondRetention } from './merge.ts';
import { SyncPortError, recordKeyOf, type Envelope, type PushResult, type SyncPort } from './types.ts';

export const INVALID_RECORD_DETAIL = 'invalid-record';
export const REQUEST_TOO_LARGE_DETAIL = 'request';

const isInvalidRecord = (err: unknown): boolean => err instanceof SyncPortError && err.kind === 'refused' && err.detail === INVALID_RECORD_DETAIL;
const isRequestTooLarge = (err: unknown): boolean => err instanceof SyncPortError && err.kind === 'limit' && err.detail === REQUEST_TOO_LARGE_DETAIL;

/** True when the server would refuse this envelope for retention or size (tombstones are always accepted). */
export function wouldBeRefused(env: Envelope, nowMs: number): boolean {
  if (env.deletedAt !== undefined) return false;
  if (isBeyondRetention(env.kind, env.key, nowMs)) return true;
  return env.payloadJson !== undefined && utf8Bytes(env.payloadJson) > SYNC_LIMITS.maxRecordBytes;
}

export interface GuardedPort extends SyncPort {
  /** Records the server refused, not offered again until edited (record key -> the refused `updatedAt`). */
  readonly refused: ReadonlyMap<string, string>;
}

export function withPushGuard(inner: SyncPort, nowMs: () => number): GuardedPort {
  const refused = new Map<string, string>();

  async function sendAll(list: readonly Envelope[]): Promise<PushResult[]> {
    try {
      return await inner.push(list);
    } catch (err) {
      const invalid = isInvalidRecord(err);
      if (list.length > 1 && (invalid || isRequestTooLarge(err))) {
        const half = Math.ceil(list.length / 2);
        const parts = invalid ? list.map((e) => [e]) : [list.slice(0, half), list.slice(half)];
        const results: PushResult[] = [];
        for (const part of parts) {
          try {
            results.push(...(await sendAll(part)));
          } catch (e) {
            if (results.length > 0) return results; // what was accepted is kept; the error shows again next cycle
            throw e;
          }
        }
        return results;
      }
      const only = list[0];
      if (list.length === 1 && invalid && only !== undefined) {
        refused.set(recordKeyOf(only), only.updatedAt);
        return [];
      }
      throw err;
    }
  }

  return {
    refused,
    readMembership: () => inner.readMembership(),
    createFamily: (c) => inner.createFamily(c),
    createInvite: () => inner.createInvite(),
    cancelInvite: () => inner.cancelInvite(),
    redeemInvite: (code, c) => inner.redeemInvite(code, c),
    setConsent: (c) => inner.setConsent(c),
    leave: () => inner.leave(),
    removeMember: (uid) => inner.removeMember(uid),
    deleteFamily: () => inner.deleteFamily(),
    ackMembershipEnd: () => inner.ackMembershipEnd(),
    pull: (cursor) => inner.pull(cursor),
    push: async (envelopes) => {
      const now = nowMs();
      const list = envelopes.filter((e) => !wouldBeRefused(e, now) && refused.get(recordKeyOf(e)) !== e.updatedAt);
      return list.length === 0 ? [] : sendAll(list);
    },
  };
}
