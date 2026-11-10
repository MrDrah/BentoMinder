// ADR 016 slice C: what VITE_SYNC_BASE_URL means. Pure. Like the AI proxy base address, but https only: sync never talks
// to a plain-http address, and unset, empty or invalid means sync is fully off (the app behaves as before E15).
import { parseProxyBase } from '../proxy/base-url.ts';

export const SYNC_BASE_VARIABLE = 'VITE_SYNC_BASE_URL';

export interface ParsedSyncBase {
  /** The https base without a trailing slash, or null = sync is off. */
  base: string | null;
  /** True when a value was given but rejected: the caller logs one warning naming the variable, never the value. */
  rejected: boolean;
}

export function parseSyncBase(raw: unknown): ParsedSyncBase {
  const parsed = parseProxyBase(raw);
  if (parsed.rejected) return { base: null, rejected: true };
  const b = parsed.base;
  if (b.mode === 'hosted') return { base: b.base, rejected: false };
  // Unset or empty: off without a warning. A local http address is not accepted for sync.
  return b.mode === 'local' ? { base: null, rejected: true } : { base: null, rejected: false };
}
