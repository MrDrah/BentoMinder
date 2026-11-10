// Server-side limits of the sync function: the contract 14.10 values live in src/domain/sync/config.ts and are reused;
// the settings below are Cloud Functions parameters (functions/params.example) with the contract/ADR defaults.
export interface SyncConfig {
  maxMembers: number;
  inviteTtlHours: number;
  inviteFailedPerHour: number;
  /** Record writes per account per hour (ADR 016 section 1: three times the 200 client guard). */
  writesPerHour: number;
  /** CLOUD_NOTICE_MIN_VERSION: family data is refused for a member whose consent is older. */
  cloudNoticeMinVersion: number;
}

export interface SyncSettings {
  maxMembers?: unknown;
  inviteTtlHours?: unknown;
  inviteFailedPerHour?: unknown;
  writesPerHour?: unknown;
  cloudNoticeMinVersion?: unknown;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = { maxMembers: 2, inviteTtlHours: 72, inviteFailedPerHour: 10, writesPerHour: 600, cloudNoticeMinVersion: 1 };

const positive = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : fallback);

/** A setting that is absent or not a positive integer falls back to its default (as parseLimits for the proxy). */
export function parseSyncConfig(s: SyncSettings): SyncConfig {
  return {
    maxMembers: positive(s.maxMembers, DEFAULT_SYNC_CONFIG.maxMembers),
    inviteTtlHours: positive(s.inviteTtlHours, DEFAULT_SYNC_CONFIG.inviteTtlHours),
    inviteFailedPerHour: positive(s.inviteFailedPerHour, DEFAULT_SYNC_CONFIG.inviteFailedPerHour),
    writesPerHour: positive(s.writesPerHour, DEFAULT_SYNC_CONFIG.writesPerHour),
    cloudNoticeMinVersion: positive(s.cloudNoticeMinVersion, DEFAULT_SYNC_CONFIG.cloudNoticeMinVersion),
  };
}
