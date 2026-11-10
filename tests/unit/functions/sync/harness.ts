// Test rig for the sync function: fake Firestore, a settable clock, a token table, deterministic randomness, and a `call`
// helper that goes through the real request pipeline (handleSync) so origin, token, body and reply shape are exercised.
import { createHash } from 'node:crypto';
import type { CoreRequest } from '../../../../server/core/handle.ts';
import { parseAllowList, type TokenVerifier } from '../../../../server/core/hosted-policy.ts';
import { DEFAULT_SYNC_CONFIG, type SyncConfig } from '../../../../functions/src/sync/config.ts';
import { handleSync, type SyncDeps } from '../../../../functions/src/sync/service.ts';
import { liveEnvelope, tombstoneEnvelope } from '../../../../src/domain/sync/envelope.ts';
import { extractRecords } from '../../../../src/domain/sync/records.ts';
import type { Envelope } from '../../../../src/domain/sync/types.ts';
import { storeWithData } from '../../domain/sync/helpers.ts';
import { FakeFirestore } from './fake-firestore.ts';

export const T0 = Date.parse('2026-11-10T10:00:00+09:00');
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const UID1 = 'test-uid-001';
export const UID2 = 'test-uid-002';
export const UID3 = 'test-uid-003';
export const UID4 = 'test-uid-004'; // creates the "other" family
export const UID5 = 'test-uid-005';
export const UID_STRANGER = 'test-uid-099'; // signed in, not on the allow-list
export const ORIGIN = 'https://mrdrah.github.io';
export const DEVICE_A = 'a0000000-0000-4000-8000-00000000000a';
export const DEVICE_B = 'b0000000-0000-4000-8000-00000000000b';

export const tokenOf = (uid: string): string => `tok-${uid}`;
const EMAILS: Record<string, string> = { [UID1]: 'one@example.test', [UID2]: 'two@example.test', [UID3]: 'three@example.test' };

export interface Reply {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

export interface Rig {
  db: FakeFirestore;
  now: number;
  logs: string[];
  config: SyncConfig;
  /** A second function instance on the same database (cross-instance concurrency). */
  deps(): SyncDeps;
  call(op: string, uid: string | null, body?: unknown, headers?: Record<string, string>, deps?: SyncDeps): Promise<Reply>;
  /** Like `call` but asserts a 200 and returns the body. */
  ok(op: string, uid: string, body?: unknown, deps?: SyncDeps): Promise<Record<string, unknown>>;
}

export function makeRig(overrides: Partial<SyncConfig> = {}, allow = [UID1, UID2, UID3, UID4, UID5]): Rig {
  const db = new FakeFirestore();
  const config: SyncConfig = { ...DEFAULT_SYNC_CONFIG, ...overrides };
  let counter = 0;
  const verifier: TokenVerifier = async (token) => {
    if (!token.startsWith('tok-')) return null;
    const uid = token.slice(4);
    return { uid, email: EMAILS[uid], emailVerified: true };
  };
  const rig: Rig = {
    db,
    now: T0,
    logs: [],
    config,
    deps: () => ({
      db,
      config,
      nowMs: () => rig.now,
      random: (n) => {
        counter += 1;
        return Uint8Array.from(createHash('sha256').update(`seed-${counter}`).digest().subarray(0, n));
      },
      allowList: parseAllowList(allow.join(',')),
      verifier,
      allowedOrigins: [ORIGIN],
      log: (m) => rig.logs.push(m),
    }),
    async call(op, uid, body, headers = {}, deps) {
      const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
      const bytes = new TextEncoder().encode(text);
      const req: CoreRequest = {
        method: 'POST',
        path: `/v1/${op}`,
        query: new URLSearchParams(),
        headers: { ...(uid === null ? {} : { authorization: `Bearer ${tokenOf(uid)}` }), ...headers },
        readBody: () => Promise.resolve(bytes),
      };
      const res = await handleSync(req, deps ?? rig.deps());
      const raw = typeof res.body === 'string' ? res.body : '';
      return { status: res.status, body: raw === '' ? {} : (JSON.parse(raw) as Record<string, unknown>), headers: res.headers };
    },
    async ok(op, uid, body, deps) {
      const r = await rig.call(op, uid, body, {}, deps);
      if (r.status !== 200) throw new Error(`${op} as ${uid}: ${r.status} ${JSON.stringify(r.body)}`);
      return r.body;
    },
  };
  return rig;
}

/** `create` then returns the family id. */
export async function createFamilyOf(rig: Rig, uid: string, consentVersion = 1): Promise<string> {
  return (await rig.ok('family.create', uid, { consentVersion })).familyId as string;
}

/** uid1 creates a family, invites, uid2 joins: the usual two-member family. */
export async function familyOfTwo(rig: Rig): Promise<string> {
  const familyId = await createFamilyOf(rig, UID1);
  const { code } = await rig.ok('invite.create', UID1);
  await rig.ok('invite.redeem', UID2, { code, consentVersion: 1 });
  return familyId;
}


const ts = (ms: number): string => new Date(ms + 9 * HOUR).toISOString().slice(0, 19) + '+09:00';
export { ts };

/** Live envelopes of every record kind of the fixture store (validated by the shared validateEnvelope). Keys: profile_profile, menu_2026-11, ... */
export function fixtureEnvelopes(atMs = T0, deviceId = DEVICE_A): Record<string, Envelope> {
  const out: Record<string, Envelope> = {};
  for (const [k, r] of extractRecords(storeWithData(deviceId, 'fam-test-001'))) {
    out[k] = liveEnvelope({ kind: r.kind, key: r.key, payloadJson: r.payloadJson, updatedAt: ts(atMs), updatedBy: 'ignored-by-server', deviceId });
  }
  return out;
}

export function tombstoneOf(e: Envelope, atMs: number, deviceId = DEVICE_A): Envelope {
  return tombstoneEnvelope({ kind: e.kind, key: e.key, updatedAt: ts(atMs), updatedBy: 'x', deviceId });
}
