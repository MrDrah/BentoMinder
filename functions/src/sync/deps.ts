// Builds the SyncDeps from plain values (the sync counterpart of hosted-deps.ts). Pure: tests pass fakes for every port.
import { parseAllowList, type TokenVerifier } from '../../../server/core/hosted-policy.ts';
import { DEFAULT_ORIGINS, parseOrigins } from '../hosted-deps.ts';
import { parseSyncConfig, type SyncSettings } from './config.ts';
import type { SyncDeps } from './service.ts';
import type { SyncDb } from './types.ts';

export interface SyncHostedConfig {
  /** Secret ALLOWED_ACCOUNTS (shared with the proxy); empty/absent: nobody may create a family. */
  allowedAccounts: string | undefined;
  allowedOrigins: string | undefined;
  settings: SyncSettings;
}

export interface SyncPorts {
  verifier: TokenVerifier;
  db: SyncDb;
  nowMs(): number;
  random(bytes: number): Uint8Array;
  log(message: string): void;
}

export function buildSyncDeps(config: SyncHostedConfig, ports: SyncPorts): SyncDeps {
  return {
    db: ports.db,
    config: parseSyncConfig(config.settings),
    nowMs: ports.nowMs,
    random: ports.random,
    allowList: parseAllowList(config.allowedAccounts),
    verifier: ports.verifier,
    allowedOrigins: parseOrigins(config.allowedOrigins ?? DEFAULT_ORIGINS),
    log: ports.log,
  };
}
