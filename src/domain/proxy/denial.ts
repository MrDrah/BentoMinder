// US-E14-08/AC6: reads the hosted proxy's denial replies (data contract 13.3) defensively. Anything that is not
// exactly one of the documented shapes returns null, and the caller treats it as "unreachable" (BR-11).
import type { LimitScope, ProxyDenial } from '../ports.ts';

export interface Denial {
  error: ProxyDenial;
  scope?: LimitScope;
  retryAfterSec?: number;
}

const SCOPES: readonly LimitScope[] = ['hour', 'day', 'fetch'];

export function parseDenial(body: unknown): Denial | null {
  if (typeof body !== 'object' || body === null) return null;
  const r = body as { ok?: unknown; error?: unknown; scope?: unknown; retryAfterSec?: unknown };
  if (r.ok !== false) return null;
  if (r.error === 'UNAUTHENTICATED' || r.error === 'NOT_ALLOWED') return { error: r.error };
  if (r.error !== 'ACCOUNT_LIMIT') return null;
  const scope = SCOPES.find((s) => s === r.scope);
  if (scope === undefined) return null;
  const retry = typeof r.retryAfterSec === 'number' && Number.isInteger(r.retryAfterSec) && r.retryAfterSec >= 1 ? { retryAfterSec: r.retryAfterSec } : {};
  return { error: 'ACCOUNT_LIMIT', scope, ...retry };
}
