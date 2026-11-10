// Data contract 14.10 limits and guardrails. Configuration, not scattered literals; the server copies the
// same values from its own configuration (ADR 016 section 1).
export const SYNC_LIMITS = {
  maxMembers: 2,
  maxRecordBytes: 262_144,
  maxFamilyBytes: 5_242_880,
  writeCoalesceSeconds: 10,
  maxWritesPerDevicePerHour: 200,
  backoffStartMs: 5_000,
  backoffMaxMs: 300_000,
  backoffJitter: 0.2,
  retryNowAfterMs: 300_000,
  tombstoneRetentionDays: 90,
  safetyCopyDays: 30,
  liveUpdateSeconds: 60,
  clockSkewMs: 5 * 60_000,
  retentionMonths: 13,
  pushBatchSize: 50,
  pullPageSize: 500,
  staleHighlightMs: 24 * 3_600_000,
} as const;

/** US-E15-02 / contract 14.5: version 1 = the content of items a to i. */
export const CLOUD_NOTICE_VERSION = 1;

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
