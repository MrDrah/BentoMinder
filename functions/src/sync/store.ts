// Document paths and typed readers of the sync data model (ADR 016 section 1). Stored documents are read defensively:
// a malformed document throws (the caller turns it into 503), it is never trusted.
import { createHash } from 'node:crypto';
import type { Envelope, StoredEnvelope } from '../../../src/domain/sync/types.ts';
import type { Data } from './types.ts';

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

/** Firebase uids are short alphanumeric strings; anything else is never used as a document id. */
export const isSafeUid = (uid: string): boolean => /^[A-Za-z0-9_-]{1,128}$/.test(uid);

export const path = {
  account: (uid: string) => `accounts/${uid}`,
  family: (familyId: string) => `families/${familyId}`,
  members: (familyId: string) => `families/${familyId}/members`,
  member: (familyId: string, uid: string) => `families/${familyId}/members/${uid}`,
  records: (familyId: string) => `families/${familyId}/records`,
  record: (familyId: string, docId: string) => `families/${familyId}/records/${docId}`,
  invites: 'invites',
  invite: (hash: string) => `invites/${hash}`,
  attempts: (uid: string) => `inviteAttempts/${sha256(`bm-sync-v1:${uid}`)}`,
  limits: (uid: string) => `syncLimits/${sha256(`bm-sync-v1:${uid}`)}`,
};

export const inviteHash = (normalisedCode: string): string => sha256(`bm-invite-v1:${normalisedCode}`);

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 10;
export const normaliseCode = (code: string): string => code.toUpperCase().replace(/[\s-]/g, '');
export const codeWellFormed = (code: string): boolean => code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));

export const str = (d: Data, k: string): string => {
  const v = d[k];
  if (typeof v !== 'string') throw new TypeError(`malformed document: ${k}`);
  return v;
};
export const num = (d: Data, k: string): number => {
  const v = d[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`malformed document: ${k}`);
  return v;
};
export const optStr = (d: Data, k: string): string | undefined => (typeof d[k] === 'string' ? (d[k] as string) : undefined);

/** A copy of `d` without the named keys (Firestore documents cannot hold undefined). */
export function without(d: Data, ...keys: string[]): Data {
  return Object.fromEntries(Object.entries(d).filter(([k]) => !keys.includes(k)));
}

/** The stored record document (client fields plus seq, bytes and, for a tombstone, deletedAtMs) to the wire form. */
export function toStored(d: Data): StoredEnvelope {
  const e: StoredEnvelope = {
    kind: str(d, 'kind') as StoredEnvelope['kind'],
    key: str(d, 'key'),
    updatedAt: str(d, 'updatedAt'),
    updatedAtMs: num(d, 'updatedAtMs'),
    updatedBy: str(d, 'updatedBy'),
    deviceId: str(d, 'deviceId'),
    seq: num(d, 'seq'),
  };
  const payload = optStr(d, 'payloadJson');
  if (payload !== undefined) e.payloadJson = payload;
  const deletedAt = optStr(d, 'deletedAt');
  if (deletedAt !== undefined) e.deletedAt = deletedAt;
  return e;
}

/** What is stored for an accepted envelope. */
export function toDocument(e: Envelope, seq: number, bytes: number): Data {
  const d: Data = { kind: e.kind, key: e.key, updatedAt: e.updatedAt, updatedAtMs: e.updatedAtMs, updatedBy: e.updatedBy, deviceId: e.deviceId, seq, bytes };
  if (e.payloadJson !== undefined) d['payloadJson'] = e.payloadJson;
  if (e.deletedAt !== undefined) {
    d['deletedAt'] = e.deletedAt;
    d['deletedAtMs'] = e.updatedAtMs; // numeric, so the lazy purge is a single-field range query
  }
  return d;
}
