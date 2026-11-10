// ADR 016 section 3: sync types and the SyncPort. No Firebase type and no HTTP detail crosses this file.
export const RECORD_KINDS = ['profile', 'menu', 'override', 'decision', 'settings', 'aiUsage'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export interface RecordId {
  kind: RecordKind;
  key: string;
}

/** Map key of a record: `{kind}_{key}` (`menu_2026-11`, `profile_profile`), also the Firestore document id. */
export type RecordKey = string;
export const recordKeyOf = (id: RecordId): RecordKey => `${id.kind}_${id.key}`;

/**
 * The cloud form of one record (contract 14.2). `payloadJson` is canonical JSON of the record as in contract 3
 * (absent on a tombstone); `updatedAtMs` is `Date.parse(updatedAt)`.
 */
export interface Envelope {
  kind: RecordKind;
  key: string;
  payloadJson?: string;
  updatedAt: string;
  updatedAtMs: number;
  updatedBy: string;
  deviceId: string;
  deletedAt?: string;
}

/** What a pull returns: the envelope plus the server's sequence number. */
export interface StoredEnvelope extends Envelope {
  seq: number;
}

export type SyncStatus =
  | 'local-only'
  | 'synced'
  | 'syncing'
  | 'pending-offline'
  | 'retrying'
  | 'paused-no-consent'
  | 'paused-limit'
  | 'paused-app-too-old'
  | 'membership-ended';

export type EndedReason = 'left' | 'removed' | 'family-deleted';

export type Membership =
  | { status: 'none' }
  | { status: 'member'; familyId: string; consentVersion: number | null }
  | { status: 'ended'; reason: EndedReason };

export interface Consent {
  version: number;
}

export interface Invite {
  code: string;
  expiresAt: string;
}

export type PushResult =
  | { kind: RecordKind; key: string; status: 'accepted'; stored: StoredEnvelope }
  | { kind: RecordKind; key: string; status: 'superseded'; winner: StoredEnvelope };

export interface PullResult {
  envelopes: StoredEnvelope[];
  /** The family's sequence number after these envelopes; the next cursor when `hasMore` is false. */
  seq: number;
  hasMore: boolean;
  serverNowMs: number;
  /** The family's schema version; above the app's = paused-app-too-old. */
  schemaVersion: number;
}

export type SyncErrorKind =
  | 'offline'
  | 'temporary'
  | 'unauthenticated'
  | 'consent-required'
  | 'limit'
  | 'app-too-old'
  | 'membership-ended'
  | 'refused';

export class SyncPortError extends Error {
  readonly kind: SyncErrorKind;
  /** membership-ended: why; limit: record, family or writes; refused: the generic reason. */
  readonly detail?: string;
  constructor(kind: SyncErrorKind, detail?: string) {
    super(detail === undefined ? kind : `${kind}: ${detail}`);
    this.name = 'SyncPortError';
    this.kind = kind;
    if (detail !== undefined) this.detail = detail;
  }
}

export interface SyncPort {
  readMembership(): Promise<Membership>;
  createFamily(consent: Consent): Promise<{ familyId: string }>;
  createInvite(): Promise<Invite>;
  cancelInvite(): Promise<void>;
  redeemInvite(code: string, consent: Consent): Promise<{ familyId: string }>;
  setConsent(consent: Consent): Promise<void>;
  leave(): Promise<void>;
  removeMember(uid: string): Promise<void>;
  deleteFamily(): Promise<void>;
  ackMembershipEnd(): Promise<void>;
  push(envelopes: readonly Envelope[]): Promise<PushResult[]>;
  pull(cursor: number): Promise<PullResult>;
  /** Optional: an adapter that can say "pull now" (unused by the polling HTTP adapter). Returns unsubscribe. */
  onHint?(callback: () => void): () => void;
}
