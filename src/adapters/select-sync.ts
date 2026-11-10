// Where the sync function lives (ADR 016 slice C). Unset or invalid = sync is fully off. Vite inlines the variable.
import { parseSyncBase, SYNC_BASE_VARIABLE } from '../domain/sync/base-url.ts';

/**
 * The configured value. TEST SEAM (slice D e2e): only in the build made with VITE_AUTH_FAKE=1 (the e2e preview build) a
 * spec may switch sync on for one browser with the localStorage key below; Vite folds the branch away in every other
 * build, so the key and the lookup are not part of the production bundle (tests/unit/scripts/sync-bundle.test.ts).
 */
function configured(): unknown {
  if (import.meta.env.VITE_AUTH_FAKE === '1') {
    // eslint-disable-next-line no-restricted-properties -- e2e-only seam, folded away in every other build (see the header)
    const seam = window.localStorage.getItem('bentominder.fake-sync-base');
    if (seam !== null) return seam;
  }
  return import.meta.env.VITE_SYNC_BASE_URL;
}

/** True when sync is configured (no warning): the login screen shows the join hint only then. */
export function syncConfigured(): boolean {
  return parseSyncBase(configured()).base !== null;
}

/** The https base of the sync function, or null. An invalid value logs one warning naming the variable, never the value. */
export function selectSyncBase(): string | null {
  const parsed = parseSyncBase(configured());
  if (parsed.rejected) console.warn(`${SYNC_BASE_VARIABLE} is not a valid https address and is ignored; sync is off.`);
  return parsed.base;
}
