// ADR 016 section 2: the narrow Firestore port of the `sync` function, the typed refusal and the shared request context.
// Paths are plain strings ("families/<id>/records/<doc>"). No Google SDK is named here; firestore-db.ts adapts the Admin
// SDK and tests use FakeFirestore, which enforces the real constraints (reads before writes, 500 writes, 1 MiB documents).
import type { AllowList } from '../../../server/core/hosted-policy.ts';
import type { SyncConfig } from './config.ts';

export type Data = Record<string, unknown>;
export interface Snap {
  exists: boolean;
  data: Data | undefined;
}
export interface QuerySpec {
  where?: { field: string; op: '>' | '<' | '=='; value: string | number };
  orderBy?: string;
  limit?: number;
}
export interface Row {
  path: string;
  data: Data;
}
export interface SyncTx {
  get(path: string): Promise<Snap>;
  /** `collection` is a collection path ("families/<id>/records"); read-only, so it must come before any write. */
  query(collection: string, spec: QuerySpec): Promise<Row[]>;
  /** Replaces the document. Values must not be undefined. */
  set(path: string, data: Data): void;
  delete(path: string): void;
}
export interface SyncDb {
  /** The callback may run again on contention: it must not have side effects outside the transaction. */
  runTransaction<T>(fn: (tx: SyncTx) => Promise<T>): Promise<T>;
  query(collection: string, spec: QuerySpec): Promise<Row[]>;
  /** Deletes the document at `path` and everything below it, in chunks of at most 500 writes. */
  recursiveDelete(path: string): Promise<void>;
}

/** A refusal with a fixed public body. Thrown inside a transaction it aborts it, so nothing is written. */
export class SyncError extends Error {
  readonly status: number;
  readonly code: string;
  readonly extra: Readonly<Record<string, unknown>>;
  constructor(status: number, code: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.name = 'SyncError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const refuse = {
  badRequest: (what = 'body') => new SyncError(400, 'BAD_REQUEST', { field: what }),
  /** One body for every non-member, whatever the reason (no family, other family, unknown family): US-E15-09/AC2. */
  notMember: () => new SyncError(403, 'NOT_MEMBER'),
  ended: (reason: string) => new SyncError(410, 'MEMBERSHIP_ENDED', { reason }),
  consentRequired: () => new SyncError(403, 'CONSENT_REQUIRED'),
  notAllowed: () => new SyncError(403, 'NOT_ALLOWED'),
  alreadyInFamily: () => new SyncError(409, 'ALREADY_IN_FAMILY'),
  familyFull: () => new SyncError(409, 'FAMILY_FULL'),
  /** wrong, used and cancelled all give exactly this (US-E15-03/AC7). */
  inviteInvalid: () => new SyncError(400, 'INVITE_INVALID'),
  inviteExpired: () => new SyncError(400, 'INVITE_EXPIRED'),
  tooManyAttempts: (retryAfterSec: number) => new SyncError(429, 'TOO_MANY_ATTEMPTS', { retryAfterSec }),
  confirmation: (why: string) => new SyncError(409, 'CONFIRMATION_REQUIRED', { why }),
  targetNotFound: () => new SyncError(404, 'TARGET_NOT_FOUND'),
  limit: (scope: 'record' | 'family' | 'writes', extra: Record<string, unknown> = {}) => new SyncError(scope === 'writes' ? 429 : 413, 'LIMIT', { scope, ...extra }),
  invalidRecord: (index: number, rule: string, reason: string) => new SyncError(400, 'INVALID_RECORD', { index, rule, reason }),
};

export interface Caller {
  uid: string;
  email?: string | undefined;
  emailVerified: boolean;
}

export interface Ctx {
  db: SyncDb;
  config: SyncConfig;
  nowMs(): number;
  /** Cryptographically strong random bytes (family ids and invite codes). */
  random(bytes: number): Uint8Array;
  /** null = unreadable list: nobody may create a family (as the proxy, US-E14-02/AC4). */
  allowList: AllowList | null;
}
