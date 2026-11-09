// Hosted-proxy policy (ADR 015 §1-3, stories US-E14-01/02/03/05/06). Pure: no network, no clock,
// no Google SDK. The token verifier and the counter store are ports; the hosted entry (slice B)
// supplies the real ones, tests supply in-memory fakes. Local proxy passes `policy: null`.
import { createHash } from 'node:crypto';
import { addDays, jstWallToInstant, todayJst, type Instant } from '../../src/domain/time/jst.ts';
import type { CallCap, ExtractionCache } from '../menu/extract.ts';

// ---- Token port and header parsing (US-E14-01) ------------------------------------------------

export interface VerifiedAccount {
  uid: string;
  email?: string | undefined;
  emailVerified: boolean;
}
/** Resolves the verified account, or null for any token that is not valid for this project. */
export type TokenVerifier = (token: string) => Promise<VerifiedAccount | null>;

const MAX_TOKEN_LENGTH = 8192;

/** `Bearer <non-empty token>` only; anything else costs no verifier call. */
export function parseBearer(header: string | undefined): string | null {
  if (header === undefined) return null;
  const m = /^Bearer +(\S+)$/i.exec(header);
  if (m === null || m[1] === undefined || m[1].length > MAX_TOKEN_LENGTH) return null;
  return m[1];
}

// ---- Allow-list (US-E14-02) -------------------------------------------------------------------

export interface AllowList {
  uids: ReadonlySet<string>;
  emails: ReadonlySet<string>;
}

/** Comma/newline separated uids and e-mails. Blank, missing or non-string input gives an empty list (deny all). */
export function parseAllowList(raw: unknown): AllowList {
  const uids = new Set<string>();
  const emails = new Set<string>();
  if (typeof raw === 'string') {
    for (const part of raw.split(/[,\n;]/)) {
      const item = part.trim();
      if (item === '') continue;
      if (item.includes('@')) emails.add(item.toLowerCase());
      else uids.add(item);
    }
  }
  return { uids, emails };
}

export function isAllowed(list: AllowList | null | undefined, account: VerifiedAccount): boolean {
  if (list === null || list === undefined) return false;
  if (list.uids.size === 0 && list.emails.size === 0) return false;
  if (list.uids.has(account.uid)) return true;
  return account.emailVerified === true && typeof account.email === 'string' && list.emails.has(account.email.trim().toLowerCase());
}

// ---- Limits (US-E14-03) -----------------------------------------------------------------------

export type Endpoint = 'extract' | 'fetch';
export interface EndpointLimits {
  perHour: number;
  perDay: number;
}
export interface AccountLimits {
  extract: EndpointLimits;
  fetch: EndpointLimits;
}
/** Contract §13.4 defaults. */
export const DEFAULT_LIMITS: AccountLimits = { extract: { perHour: 5, perDay: 20 }, fetch: { perHour: 30, perDay: 100 } };

/** What is stored per account and endpoint: timestamps and counts only (US-E14-03/AC7). */
export interface EndpointState {
  hour: number[]; // epoch ms of counted requests within the last 60 minutes
  dayKey: string; // Tokyo calendar day, YYYY-MM-DD
  dayCount: number;
}
export interface AccountCounters {
  extract?: EndpointState;
  fetch?: EndpointState;
}

export type LimitScope = 'hour' | 'day' | 'fetch';
export type Reservation = { ok: true } | { ok: false; scope: LimitScope; retryAfterSec: number };

const HOUR_MS = 3_600_000;

/** Pure reservation: checks hour then day; on success returns the state with this request counted. */
export function applyReservation(
  state: EndpointState | undefined,
  nowMs: number,
  limits: EndpointLimits,
  endpoint: Endpoint,
): { result: Reservation; state: EndpointState } {
  const today = todayJst(nowMs as Instant);
  const hour = (state?.hour ?? []).filter((t) => t > nowMs - HOUR_MS && t <= nowMs).sort((a, b) => a - b);
  const dayCount = state !== undefined && state.dayKey === today ? state.dayCount : 0;
  const current: EndpointState = { hour, dayKey: today, dayCount };
  const scopeOf = (s: 'hour' | 'day'): LimitScope => (endpoint === 'fetch' ? 'fetch' : s);

  if (hour.length >= limits.perHour) {
    // The slot that frees first once the window slides: the (count - limit + 1)th oldest entry.
    const blocking = hour[hour.length - limits.perHour];
    const waitMs = blocking === undefined ? HOUR_MS : blocking + HOUR_MS - nowMs;
    return { result: { ok: false, scope: scopeOf('hour'), retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)) }, state: current };
  }
  if (dayCount >= limits.perDay) {
    const midnight = jstWallToInstant(addDays(today, 1), '00:00');
    return { result: { ok: false, scope: scopeOf('day'), retryAfterSec: Math.max(1, Math.ceil((midnight - nowMs) / 1000)) }, state: current };
  }
  return { result: { ok: true }, state: { hour: [...hour, nowMs], dayKey: today, dayCount: dayCount + 1 } };
}

/**
 * Atomic read-modify-write of one account's counters. The Firestore adapter (slice B) runs `update`
 * inside a transaction (retrying on contention); a throw means the store failed (fail closed).
 */
export interface CounterStore {
  update<T>(accountKey: string, fn: (current: AccountCounters | undefined) => { next: AccountCounters; value: T }): Promise<T>;
}

export function reserve(store: CounterStore, accountKey: string, endpoint: Endpoint, nowMs: number, limits: AccountLimits): Promise<Reservation> {
  return store.update(accountKey, (current) => {
    const { result, state } = applyReservation(current?.[endpoint], nowMs, limits[endpoint], endpoint);
    return { next: { ...(current ?? {}), [endpoint]: state }, value: result };
  });
}

/** Pseudonymous account key: never the e-mail, and the only account identifier that may reach a log. */
export function accountKey(uid: string): string {
  return createHash('sha256').update(`bm-proxy-v1:${uid}`).digest('hex').slice(0, 32);
}

// ---- Policy object, replies ---------------------------------------------------------------------

export interface HostedPolicy {
  /** Exact origins (scheme, host, port; no trailing text). Never "*". */
  allowedOrigins: readonly string[];
  verifier: TokenVerifier;
  /** null = unreadable list: deny everyone (US-E14-02/AC4). */
  allowList: AllowList | null;
  limits: AccountLimits;
  store: CounterStore;
}

export const UNAUTHENTICATED_BODY = { ok: false, error: 'UNAUTHENTICATED' } as const;
/** One constant body for every denied account (US-E14-02/AC5). */
export const NOT_ALLOWED_BODY = { ok: false, error: 'NOT_ALLOWED' } as const;
export const ORIGIN_NOT_ALLOWED_BODY = { ok: false, error: 'ORIGIN_NOT_ALLOWED' } as const;
export const UNAVAILABLE_BODY = { ok: false, error: 'UNAVAILABLE', providerCalls: 0 } as const;

export function isAllowedOrigin(policy: HostedPolicy, origin: string): boolean {
  return policy.allowedOrigins.includes(origin);
}

/** CORS for an allowed origin only: that exact origin, POST and OPTIONS, no credentials (US-E14-05/AC1). */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-expose-headers': 'x-bm-sha256',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

// ---- Log allow-list (US-E14-06) ---------------------------------------------------------------

export interface LogFields {
  endpoint: string;
  outcome: string;
  status: number;
  durationMs: number;
  providerCalls?: number | undefined;
  model?: string | undefined;
  providerStatus?: number | undefined;
  account?: string | undefined;
}

const SAFE_TOKEN = /^[A-Za-z0-9._-]{1,64}$/;
const safe = (v: string | undefined): string => (v !== undefined && SAFE_TOKEN.test(v) ? v : '-');
const num = (v: number | undefined): string => (v !== undefined && Number.isFinite(v) ? String(Math.trunc(v)) : '-');

/** The only request log line of the hosted proxy: fixed keys, values restricted to a safe alphabet. */
export function formatLogLine(f: LogFields): string {
  return (
    `request endpoint=${safe(f.endpoint)} outcome=${safe(f.outcome)} status=${num(f.status)} ms=${num(f.durationMs)}` +
    ` providerCalls=${num(f.providerCalls)} model=${safe(f.model)} providerStatus=${num(f.providerStatus)} account=${safe(f.account)}`
  );
}

/** Error class only, never the message (US-E14-06/AC2). */
export function formatErrorLine(endpoint: string, err: unknown): string {
  const cls = err instanceof Error ? err.constructor.name : typeof err;
  return `error endpoint=${safe(endpoint)} class=${safe(cls)}`;
}

const PROVIDER_LINE = /^provider ([A-Za-z0-9._-]{1,64}) attempt: (http \d{3}|[a-z]{1,20}|malformed \(\d{1,3} issues\))( in \d{1,6}ms)?$/;
/** Wraps a logger for the extraction budget: only its own fixed-shape lines pass; anything else is dropped. */
export function filterProviderLog(log: (m: string) => void): (m: string) => void {
  return (m) => {
    if (PROVIDER_LINE.test(m)) log(m);
  };
}

// ---- Hosted dependency stand-ins ---------------------------------------------------------------

/** Stores nothing (US-E14-06/AC3). */
export const nullCache: ExtractionCache = { get: () => undefined, set: () => undefined };
/** The process-local cap is replaced by per-account limits on the hosted proxy. */
export const unlimitedCap: CallCap = { allow: () => true, record: () => undefined };
