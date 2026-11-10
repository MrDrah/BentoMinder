// Contract 14.2 / 14.15: the sync record envelope and its validation (rules sync-envelope-shape, sync-payload-valid,
// sync-key-matches-payload, sync-tombstone-no-payload). Pure and shared: the client checks every downloaded
// record with it, and the Function (slice B) runs the same function on every pushed record (rules-write-shape).
import { z } from 'zod';
import { childProfileSchema } from '../schema/profile.ts';
import { assessmentOverrideSchema, menuMonthSchema } from '../schema/menu.ts';
import { dayDecisionSchema } from '../schema/decision.ts';
import { settingsSchema } from '../schema/settings.ts';
import { intRange, isTimestamp } from '../schema/primitives.ts';
import { isLocalDate, isYearMonth } from '../time/jst.ts';
import { SYNC_LIMITS } from './config.ts';
import { utf8Bytes } from './hash.ts';
import { RECORD_KINDS, type Envelope, type RecordKind, type StoredEnvelope } from './types.ts';

export type EnvelopeRule =
  | 'sync-envelope-shape'
  | 'sync-payload-valid'
  | 'sync-key-matches-payload'
  | 'sync-tombstone-no-payload';

export type EnvelopeResult<E> = { ok: true; envelope: E } | { ok: false; rule: EnvelopeRule; reason: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The device-only settings fields (contract 14.2): never part of a synced settings payload. */
export const DEVICE_ONLY_SETTINGS = ['language', 'theme'] as const;

/** aiUsage payload: the family-wide count of one month (contract 14.2). */
export const aiUsagePayloadSchema = z.strictObject({ count: intRange(0) });

export function keyShapeOk(kind: RecordKind, key: string): boolean {
  switch (kind) {
    case 'profile':
    case 'settings':
      return key === kind;
    case 'menu':
    case 'aiUsage':
      return isYearMonth(key);
    case 'override':
    case 'decision':
      return isLocalDate(key);
  }
}

export type PayloadResult = { ok: true; value: Record<string, unknown> } | { ok: false; rule: 'sync-payload-valid' | 'sync-key-matches-payload'; reason: string };

/** Parses `payloadJson` and checks it with the same schema the local store uses for that kind. */
export function validatePayload(kind: RecordKind, key: string, payloadJson: string): PayloadResult {
  let doc: unknown;
  try {
    doc = JSON.parse(payloadJson);
  } catch {
    return { ok: false, rule: 'sync-payload-valid', reason: 'json-parse' };
  }
  if (!isRecord(doc)) return { ok: false, rule: 'sync-payload-valid', reason: 'not-an-object' };
  let parsed: { success: boolean; error?: z.ZodError };
  switch (kind) {
    case 'profile':
      parsed = childProfileSchema.safeParse(doc);
      break;
    case 'menu':
      parsed = menuMonthSchema.safeParse(doc);
      break;
    case 'override':
      parsed = assessmentOverrideSchema.safeParse(doc);
      break;
    case 'decision':
      parsed = dayDecisionSchema.safeParse(doc);
      break;
    case 'aiUsage':
      parsed = aiUsagePayloadSchema.safeParse(doc);
      break;
    case 'settings':
      if (DEVICE_ONLY_SETTINGS.some((f) => f in doc)) return { ok: false, rule: 'sync-payload-valid', reason: 'device-only-field' };
      parsed = settingsSchema.safeParse({ ...doc, language: 'ja', theme: 'auto' });
      break;
  }
  if (!parsed.success) return { ok: false, rule: 'sync-payload-valid', reason: parsed.error?.issues[0]?.message ?? 'invalid' };
  if (kind === 'menu' && doc['month'] !== key) return { ok: false, rule: 'sync-key-matches-payload', reason: 'month' };
  if ((kind === 'override' || kind === 'decision') && doc['date'] !== key) {
    return { ok: false, rule: 'sync-key-matches-payload', reason: 'date' };
  }
  return { ok: true, value: doc };
}

const CLIENT_FIELDS = ['kind', 'key', 'payloadJson', 'updatedAt', 'updatedAtMs', 'updatedBy', 'deviceId', 'deletedAt'] as const;
const SERVER_FIELDS = ['seq', 'bytes'] as const;

const fail = (rule: EnvelopeRule, reason: string): { ok: false; rule: EnvelopeRule; reason: string } => ({ ok: false, rule, reason });

/**
 * Validates one envelope. `allowServerFields` accepts `seq` (and `bytes`) as found on a downloaded record; a client push
 * with them is refused. Size limit: `payloadJson` at most 256 KiB (contract 14.10), reported as `too-large`.
 */
export function validateEnvelope(input: unknown, options: { allowServerFields?: boolean } = {}): EnvelopeResult<Envelope> {
  if (!isRecord(input)) return fail('sync-envelope-shape', 'not-an-object');
  const allowed: readonly string[] = options.allowServerFields === true ? [...CLIENT_FIELDS, ...SERVER_FIELDS] : CLIENT_FIELDS;
  for (const k of Object.keys(input)) if (!allowed.includes(k)) return fail('sync-envelope-shape', `unknown-field:${k}`);
  const { kind, key, payloadJson, updatedAt, updatedAtMs, updatedBy, deviceId, deletedAt } = input;
  if (typeof kind !== 'string' || !(RECORD_KINDS as readonly string[]).includes(kind)) return fail('sync-envelope-shape', 'kind');
  if (typeof key !== 'string' || !keyShapeOk(kind as RecordKind, key)) return fail('sync-envelope-shape', 'key');
  if (typeof updatedAt !== 'string' || !isTimestamp(updatedAt)) return fail('sync-envelope-shape', 'updatedAt');
  if (typeof updatedAtMs !== 'number' || !Number.isInteger(updatedAtMs) || updatedAtMs !== Date.parse(updatedAt)) {
    return fail('sync-envelope-shape', 'updatedAtMs');
  }
  if (typeof updatedBy !== 'string' || updatedBy.length < 1 || updatedBy.length > 128) return fail('sync-envelope-shape', 'updatedBy');
  if (typeof deviceId !== 'string' || deviceId.length < 1 || deviceId.length > 64) return fail('sync-envelope-shape', 'deviceId');
  if (options.allowServerFields === true) {
    if ('seq' in input && (typeof input['seq'] !== 'number' || !Number.isInteger(input['seq']) || input['seq'] < 0)) {
      return fail('sync-envelope-shape', 'seq');
    }
  }
  const k = kind as RecordKind;
  if (deletedAt !== undefined) {
    if (payloadJson !== undefined) return fail('sync-tombstone-no-payload', 'payload-on-tombstone');
    if (typeof deletedAt !== 'string' || deletedAt !== updatedAt) return fail('sync-envelope-shape', 'deletedAt');
    // aiUsage is merged by the larger count and is never deleted (ADR 016 section 3, merge.ts).
    if (k === 'aiUsage') return fail('sync-envelope-shape', 'aiUsage-tombstone');
  } else {
    if (typeof payloadJson !== 'string') return fail('sync-envelope-shape', 'payloadJson');
    if (utf8Bytes(payloadJson) > SYNC_LIMITS.maxRecordBytes) return fail('sync-envelope-shape', 'too-large');
    const payload = validatePayload(k, key as string, payloadJson);
    if (!payload.ok) return fail(payload.rule, payload.reason);
  }
  return { ok: true, envelope: input as unknown as Envelope };
}

/** A downloaded record: the envelope rules plus a valid `seq`. */
export function validateStoredEnvelope(input: unknown): EnvelopeResult<StoredEnvelope> {
  const r = validateEnvelope(input, { allowServerFields: true });
  if (!r.ok) return r;
  const seq = (input as Record<string, unknown>)['seq'];
  if (typeof seq !== 'number') return fail('sync-envelope-shape', 'seq');
  return { ok: true, envelope: input as StoredEnvelope };
}

export const isTombstone = (e: Pick<Envelope, 'deletedAt'>): boolean => e.deletedAt !== undefined;

/** Builds a live envelope. `updatedAt` is the contract timestamp of the edit. */
export function liveEnvelope(input: {
  kind: RecordKind;
  key: string;
  payloadJson: string;
  updatedAt: string;
  updatedBy: string;
  deviceId: string;
}): Envelope {
  return { ...input, updatedAtMs: Date.parse(input.updatedAt) };
}

/** Builds a tombstone: `deletedAt` equals `updatedAt`, no payload (contract 14.6). */
export function tombstoneEnvelope(input: {
  kind: RecordKind;
  key: string;
  updatedAt: string;
  updatedBy: string;
  deviceId: string;
}): Envelope {
  return { ...input, updatedAtMs: Date.parse(input.updatedAt), deletedAt: input.updatedAt };
}
