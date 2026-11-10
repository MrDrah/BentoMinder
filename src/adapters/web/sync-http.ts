// ADR 016 slice C: the HTTP SyncPort adapter. Maps the wire operations of the `sync` function (slice-b-wire.md) to the
// SyncPort and every refusal to a SyncPortError. The ID token goes only to the sync base, in the Authorization header,
// never in an address; a signed-out app makes no request at all; a 401 UNAUTHENTICATED reply gets one forced-refresh retry.
import { validateStoredEnvelope } from '../../domain/sync/envelope.ts';
import {
  SyncPortError,
  type Consent,
  type Envelope,
  type EndedReason,
  type Invite,
  type Membership,
  type PullResult,
  type PushResult,
  type StoredEnvelope,
  type SyncPort,
} from '../../domain/sync/types.ts';
import type { IdTokenSupplier } from './proxy-fetch.ts';

/** What the family delete confirmation must say (wire contract). */
export const DELETE_CONFIRMATION = '削除する';

export interface HttpSyncOptions {
  /** The https base, no trailing slash (`parseSyncBase`). */
  base: string;
  getToken: IdTokenSupplier;
  fetchImpl?: typeof fetch;
  /** Offline is told from "the server did not answer" by this (navigator.onLine in the browser). */
  isOnline?: () => boolean;
  /** Called with the number of downloaded envelopes dropped for failing the envelope rules (US-E15-06/AC9). */
  onDropped?: (count: number) => void;
}

/** The port plus what only the settings screens of slice D need beyond the engine's SyncPort. */
export interface HttpSyncPort extends SyncPort {
  /** The last member leaving deletes the family: the wire needs the confirmation word. */
  leaveAsLastMember(): Promise<void>;
}

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

const REFUSED_DETAIL: Record<string, string> = {
  NOT_MEMBER: 'not-member',
  NOT_ALLOWED: 'not-allowed',
  ORIGIN_NOT_ALLOWED: 'origin-not-allowed',
  ALREADY_IN_FAMILY: 'already-in-family',
  FAMILY_FULL: 'family-full',
  CONFIRMATION_REQUIRED: 'confirmation-required',
  INVITE_INVALID: 'invalid-code',
  INVITE_EXPIRED: 'expired',
  TOO_MANY_ATTEMPTS: 'too-many-attempts',
  INVALID_RECORD: 'invalid-record',
  BAD_REQUEST: 'bad-request',
  TARGET_NOT_FOUND: 'not-found',
  NOT_FOUND: 'not-found',
};

/** Slice-b-wire.md refusal table. The reply body is never copied into the error (it carries no content, but is not trusted). */
export function refusalToError(status: number, body: Record<string, unknown>): SyncPortError {
  const code = str(body['error']);
  if (status >= 500 || code === 'UNAVAILABLE') return new SyncPortError('temporary', `http-${status}`);
  switch (code) {
    case 'UNAUTHENTICATED':
      return new SyncPortError('unauthenticated');
    case 'CONSENT_REQUIRED':
      return new SyncPortError('consent-required');
    case 'MEMBERSHIP_ENDED': {
      const r = str(body['reason']);
      const reason: EndedReason = r === 'left' || r === 'removed' ? r : 'family-deleted';
      return new SyncPortError('membership-ended', reason);
    }
    case 'LIMIT': {
      const scope = str(body['scope']);
      return new SyncPortError('limit', scope === 'record' || scope === 'family' || scope === 'writes' ? scope : 'request');
    }
  }
  if (code !== undefined && REFUSED_DETAIL[code] !== undefined) return new SyncPortError('refused', REFUSED_DETAIL[code]);
  if (status === 401) return new SyncPortError('unauthenticated');
  return new SyncPortError('refused', `http-${status}`);
}

export function createHttpSyncPort(options: HttpSyncOptions): HttpSyncPort {
  const { base, getToken, isOnline = () => true, onDropped } = options;
  const fetchImpl: typeof fetch = options.fetchImpl ?? ((...args) => fetch(...args));

  async function send(op: string, body: unknown, token: string): Promise<Reply> {
    const res = await fetchImpl(`${base}/v1/${op}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    return { status: res.status, body: isObject(parsed) ? parsed : {} };
  }

  async function call(op: string, body: unknown = {}): Promise<Record<string, unknown>> {
    if (!isOnline()) throw new SyncPortError('offline');
    const token = await getToken(false);
    if (token === null) throw new SyncPortError('unauthenticated'); // signed out: nothing is sent
    let reply: Reply;
    try {
      reply = await send(op, body, token);
      if (reply.status === 401 && reply.body['error'] === 'UNAUTHENTICATED') {
        const fresh = await getToken(true);
        if (fresh === null) throw new SyncPortError('unauthenticated');
        reply = await send(op, body, fresh);
      }
    } catch (err) {
      if (err instanceof SyncPortError) throw err;
      // fetch itself failed: no connection, or the server could not be reached.
      throw new SyncPortError(isOnline() ? 'temporary' : 'offline', 'network');
    }
    if (reply.status === 200 && reply.body['ok'] === true) return reply.body;
    if (reply.status === 200) throw new SyncPortError('temporary', 'bad-reply');
    throw refusalToError(reply.status, reply.body);
  }

  const badReply = (): SyncPortError => new SyncPortError('temporary', 'bad-reply');

  function storedList(v: unknown): StoredEnvelope[] {
    if (!Array.isArray(v)) throw badReply();
    const out: StoredEnvelope[] = [];
    let dropped = 0;
    for (const item of v) {
      const checked = validateStoredEnvelope(item);
      if (checked.ok) out.push(checked.envelope);
      else dropped += 1;
    }
    if (dropped > 0) onDropped?.(dropped);
    return out;
  }

  function wireEnvelope(e: Envelope): Envelope {
    // Client fields only: nothing else of an object is ever sent (the server sets seq, bytes, updatedBy checks).
    return {
      kind: e.kind,
      key: e.key,
      ...(e.payloadJson === undefined ? {} : { payloadJson: e.payloadJson }),
      updatedAt: e.updatedAt,
      updatedAtMs: e.updatedAtMs,
      updatedBy: e.updatedBy,
      deviceId: e.deviceId,
      ...(e.deletedAt === undefined ? {} : { deletedAt: e.deletedAt }),
    };
  }

  const leaveWith = async (confirmation?: string): Promise<void> => {
    await call('family.leave', confirmation === undefined ? {} : { confirmation });
  };

  return {
    async readMembership(): Promise<Membership> {
      const r = await call('membership.get');
      switch (r['status']) {
        case 'none':
          return { status: 'none' };
        case 'deleting':
          throw new SyncPortError('temporary', 'deleting'); // an unfinished delete: ask again
        case 'ended': {
          const reason = str(r['reason']);
          return { status: 'ended', reason: reason === 'left' || reason === 'removed' ? reason : 'family-deleted' };
        }
        case 'member': {
          const familyId = str(r['familyId']);
          if (familyId === undefined) throw badReply();
          const cv = r['consentVersion'];
          const members = Array.isArray(r['members'])
            ? r['members'].filter(isObject).map((m) => {
                const email = str(m['email']);
                const joinedAt = str(m['joinedAt']);
                return { uid: str(m['uid']) ?? '', you: m['you'] === true, ...(joinedAt === undefined ? {} : { joinedAt }), ...(email === undefined ? {} : { email }) };
              })
            : undefined;
          const inv = r['invite'];
          const code = isObject(inv) ? str(inv['code']) : undefined;
          const expiresAt = isObject(inv) ? str(inv['expiresAt']) : undefined;
          const consentedAt = str(r['consentedAt']);
          const maxMembers = r['maxMembers'];
          return {
            status: 'member',
            familyId,
            consentVersion: typeof cv === 'number' ? cv : null,
            ...(consentedAt === undefined ? {} : { consentedAt }),
            ...(typeof maxMembers === 'number' ? { maxMembers } : {}),
            ...(members === undefined ? {} : { members }),
            ...('invite' in r ? { invite: code !== undefined && expiresAt !== undefined ? { code, expiresAt } : null } : {}),
          };
        }
        default:
          throw badReply();
      }
    },
    async createFamily(consent: Consent) {
      const familyId = str((await call('family.create', { consentVersion: consent.version }))['familyId']);
      if (familyId === undefined) throw badReply();
      return { familyId };
    },
    async createInvite(): Promise<Invite> {
      const r = await call('invite.create');
      const code = str(r['code']);
      const expiresAt = str(r['expiresAt']);
      if (code === undefined || expiresAt === undefined) throw badReply();
      return { code, expiresAt };
    },
    async cancelInvite() {
      await call('invite.cancel');
    },
    async redeemInvite(code: string, consent: Consent) {
      const familyId = str((await call('invite.redeem', { code, consentVersion: consent.version }))['familyId']);
      if (familyId === undefined) throw badReply();
      return { familyId };
    },
    async setConsent(consent: Consent) {
      await call('consent.set', { consentVersion: consent.version });
    },
    leave: () => leaveWith(),
    leaveAsLastMember: () => leaveWith(DELETE_CONFIRMATION),
    async removeMember(uid: string) {
      await call('family.removeMember', { uid });
    },
    async deleteFamily() {
      await call('family.delete', { confirmation: DELETE_CONFIRMATION });
    },
    async ackMembershipEnd() {
      await call('membership.ack');
    },
    async push(envelopes: readonly Envelope[]): Promise<PushResult[]> {
      const r = await call('records.push', { records: envelopes.map(wireEnvelope) });
      const results = r['results'];
      if (!Array.isArray(results)) throw badReply();
      const out: PushResult[] = [];
      for (const item of results) {
        if (!isObject(item)) throw badReply();
        const kind = item['kind'];
        const key = item['key'];
        const status = item['status'];
        if (typeof kind !== 'string' || typeof key !== 'string') throw badReply();
        const which = status === 'accepted' ? item['stored'] : item['winner'];
        const checked = validateStoredEnvelope(which);
        if (!checked.ok || (status !== 'accepted' && status !== 'superseded')) throw badReply();
        const base = { kind: kind as PushResult['kind'], key };
        out.push(status === 'accepted' ? { ...base, status, stored: checked.envelope } : { ...base, status, winner: checked.envelope });
      }
      return out;
    },
    async pull(cursor: number): Promise<PullResult> {
      const r = await call('records.pull', { cursor });
      const { seq, hasMore, serverNowMs, schemaVersion } = r;
      if (typeof seq !== 'number' || typeof hasMore !== 'boolean' || typeof schemaVersion !== 'number') throw badReply();
      return { envelopes: storedList(r['envelopes']), seq, hasMore, serverNowMs: typeof serverNowMs === 'number' ? serverNowMs : 0, schemaVersion };
    },
  };
}

