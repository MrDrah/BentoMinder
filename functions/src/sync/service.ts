// The `sync` request pipeline (ADR 016 section 2.1): exact-origin CORS, bearer token through the same TokenVerifier as the
// proxy, JSON body, one operation, a fixed public reply, one log line without personal data. Pure: ports in, response out.
import { TooLarge, type CoreRequest, type CoreResponse } from '../../../server/core/handle.ts';
import { accountKey, corsHeaders, parseBearer, UNAUTHENTICATED_BODY, ORIGIN_NOT_ALLOWED_BODY, type TokenVerifier } from '../../../server/core/hosted-policy.ts';
import { OPS, type Op } from './authorize.ts';
import { ackMembershipEnd, cancelInvite, createFamily, createInvite, deleteFamily, getMembership, leaveFamily, redeemInvite, removeMember, setConsent } from './ops-membership.ts';
import { pullRecords, pushRecords } from './ops-records.ts';
import { isSafeUid } from './store.ts';
import { refuse, SyncError, type Caller, type Ctx, type Data } from './types.ts';

export interface SyncDeps extends Ctx {
  verifier: TokenVerifier;
  /** Exact origins (never "*"), as for the proxy. */
  allowedOrigins: readonly string[];
  log(message: string): void;
}

/** 9 MiB: under the platform's request limit; one push of 50 records is far smaller in practice (family total is 5 MiB). */
export const MAX_BODY_BYTES = 9 * 1024 * 1024;
const BASE_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function reply(status: number, body: unknown, extra: Record<string, string> = {}): CoreResponse {
  const text = JSON.stringify(body);
  return { status, headers: { 'content-type': 'application/json; charset=utf-8', 'content-length': String(Buffer.byteLength(text)), ...BASE_HEADERS, ...extra }, body: text };
}

const SAFE_TOKEN = /^[A-Za-z0-9._-]{1,64}$/;
const safe = (v: string | undefined): string => (v !== undefined && SAFE_TOKEN.test(v) ? v : '-');

/** The only log line of the sync function: fixed keys; values from a safe alphabet; the account is a salted hash. No content, no uid, no e-mail. */
export function formatSyncLog(f: { op: string; outcome: string; status: number; durationMs: number; account?: string | undefined }): string {
  return `sync op=${safe(f.op)} outcome=${safe(f.outcome)} status=${Math.trunc(f.status)} ms=${Math.max(0, Math.trunc(f.durationMs))} account=${safe(f.account)}`;
}

type Handler = (ctx: Ctx, caller: Caller, body: Record<string, unknown>) => Promise<Data>;

export const HANDLERS: Record<Op, Handler> = {
  'membership.get': (ctx, c) => getMembership(ctx, c),
  'membership.ack': (ctx, c) => ackMembershipEnd(ctx, c),
  'family.create': createFamily,
  'invite.create': (ctx, c) => createInvite(ctx, c),
  'invite.cancel': (ctx, c) => cancelInvite(ctx, c),
  'invite.redeem': redeemInvite,
  'consent.set': setConsent,
  'family.leave': leaveFamily,
  'family.removeMember': removeMember,
  'family.delete': deleteFamily,
  'records.push': pushRecords,
  'records.pull': pullRecords,
};

const ROUTE = /^(?:.*\/)?v1\/([A-Za-z.]{1,40})$/;
const isOp = (s: string): s is Op => (OPS as readonly string[]).includes(s);

async function parseBody(req: CoreRequest): Promise<Record<string, unknown>> {
  let bytes: Uint8Array;
  try {
    bytes = await req.readBody(MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof TooLarge) throw new SyncError(413, 'LIMIT', { scope: 'request' });
    throw e;
  }
  if (bytes.byteLength === 0) return {};
  let doc: unknown;
  try {
    doc = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw refuse.badRequest();
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) throw refuse.badRequest();
  return doc as Record<string, unknown>;
}

export async function handleSync(req: CoreRequest, deps: SyncDeps): Promise<CoreResponse> {
  const started = deps.nowMs();
  let op = 'other';
  let outcome = 'OK';
  let account: string | undefined;
  let cors: Record<string, string> = {};
  let response: CoreResponse;
  try {
    const origin = req.headers['origin'];
    if (origin !== undefined && !deps.allowedOrigins.includes(origin)) {
      outcome = 'ORIGIN_NOT_ALLOWED';
      response = reply(403, ORIGIN_NOT_ALLOWED_BODY);
    } else {
      if (origin !== undefined) cors = corsHeaders(origin);
      const name = ROUTE.exec(req.path)?.[1];
      if (name === undefined || !isOp(name)) {
        outcome = 'NOT_FOUND';
        response = reply(404, { ok: false, error: 'NOT_FOUND' });
      } else {
        op = name;
        if (req.method === 'OPTIONS') {
          outcome = 'PREFLIGHT';
          response = { status: 204, headers: { ...BASE_HEADERS }, body: null };
        } else if (req.method !== 'POST') {
          outcome = 'METHOD_NOT_ALLOWED';
          response = reply(405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, { allow: 'POST' });
        } else {
          response = await run(req, deps, name, (a) => {
            account = a;
          });
        }
      }
    }
  } catch (e) {
    if (e instanceof SyncError) {
      outcome = e.code;
      response = reply(e.status, { ok: false, error: e.code, ...e.extra }, e.status === 429 && typeof e.extra['retryAfterSec'] === 'number' ? { 'retry-after': String(e.extra['retryAfterSec']) } : {});
    } else {
      // Class only, never the message (it could carry a path or content): the same rule as the proxy (US-E14-06/AC2).
      outcome = 'INTERNAL';
      deps.log(`error op=${safe(op)} class=${safe(e instanceof Error ? e.constructor.name : typeof e)}`);
      response = reply(503, { ok: false, error: 'UNAVAILABLE' });
    }
  }
  const out: CoreResponse = { ...response, headers: { ...response.headers, ...cors } };
  deps.log(formatSyncLog({ op, outcome, status: out.status, durationMs: deps.nowMs() - started, account }));
  return out;
}

async function run(req: CoreRequest, deps: SyncDeps, op: Op, noteAccount: (a: string) => void): Promise<CoreResponse> {
  const token = parseBearer(req.headers['authorization']);
  if (token === null) throw new SyncError(401, UNAUTHENTICATED_BODY.error);
  let verified;
  try {
    verified = await deps.verifier(token);
  } catch {
    verified = null; // a verifier that cannot decide never lets the request through
  }
  if (verified === null || typeof verified.uid !== 'string' || !isSafeUid(verified.uid)) throw new SyncError(401, UNAUTHENTICATED_BODY.error);
  noteAccount(accountKey(verified.uid));
  const caller: Caller = { uid: verified.uid, email: verified.email, emailVerified: verified.emailVerified };
  const body = await parseBody(req);
  const result = await HANDLERS[op](deps, caller, body);
  return reply(200, { ok: true, ...result, serverNowMs: deps.nowMs() });
}
