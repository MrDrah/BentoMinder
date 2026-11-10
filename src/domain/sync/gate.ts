// Gates that decide what the app may do before the cloud is known or consented to.
import { CLOUD_NOTICE_VERSION } from './config.ts';
import type { SyncMeta } from './meta.ts';

/**
 * US-E15-02/AC1, AC5, AC6 (ADR 016 section 6): family data may be sent or fetched only when the cached consent of
 * this member is at least the app's notice version. `family.create` and `invite.redeem` carry no family data.
 */
export function consentOk(meta: Pick<SyncMeta, 'consent'>, appVersion: number = CLOUD_NOTICE_VERSION): boolean {
  return meta.consent !== null && meta.consent.version >= appVersion;
}

export type StartGate =
  /** No local copy and the family is not yet known: a loading state, never onboarding (rule new-device-no-onboarding-before-family-known). */
  | 'loading'
  /** No local copy and the membership or data read failed or took more than 15 seconds: the retry screen. */
  | 'retry'
  /** A member's new device: the calendar from the family's data once downloaded. */
  | 'calendar-from-family'
  /** A local copy exists: open at once, sync in the background (offline-first). */
  | 'calendar-from-local'
  /** Not in a family and no local copy: the normal first start (onboarding). */
  | 'normal-start';

export const NEW_DEVICE_LOAD_TIMEOUT_MS = 15_000;

export interface StartFacts {
  hasLocalCopy: boolean;
  /** `unknown` until the membership read answered. */
  membership: 'unknown' | 'none' | 'member' | 'ended';
  /** The family data of a member has been downloaded to this device. */
  familyDataLoaded: boolean;
  readFailed: boolean;
  /** Time since the first-sign-in read started. */
  elapsedMs: number;
}

/** Contract 14.8 and US-E15-05/AC1, AC3, AC4, AC5. */
export function startGate(f: StartFacts): StartGate {
  if (f.hasLocalCopy) return 'calendar-from-local';
  switch (f.membership) {
    case 'unknown':
      return f.readFailed || f.elapsedMs > NEW_DEVICE_LOAD_TIMEOUT_MS ? 'retry' : 'loading';
    case 'member':
      if (f.familyDataLoaded) return 'calendar-from-family';
      return f.readFailed || f.elapsedMs > NEW_DEVICE_LOAD_TIMEOUT_MS ? 'retry' : 'loading';
    case 'none':
    case 'ended':
      return 'normal-start';
  }
}
