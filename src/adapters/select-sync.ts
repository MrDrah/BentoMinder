// Where the sync function lives (ADR 016 slice C). Unset or invalid = sync is fully off. Vite inlines the variable.
import { parseSyncBase, SYNC_BASE_VARIABLE } from '../domain/sync/base-url.ts';

/** The https base of the sync function, or null. An invalid value logs one warning naming the variable, never the value. */
export function selectSyncBase(): string | null {
  const parsed = parseSyncBase(import.meta.env.VITE_SYNC_BASE_URL);
  if (parsed.rejected) console.warn(`${SYNC_BASE_VARIABLE} is not a valid https address and is ignored; sync is off.`);
  return parsed.base;
}
