// Builds the hosted ProxyDeps (ADR 015 §1-2) from plain values: hosted policy ON, no recorded fixtures, no
// scenarios (hard-coded), no stored extraction (nullCache), per-account limits instead of the local cap.
// Never imports file-cache or mock-transport. Pure: tests pass fakes for every port.
import type { ProxyDeps } from '../../server/core/handle.ts';
import {
  DEFAULT_LIMITS,
  nullCache,
  parseAllowList,
  unlimitedCap,
  type AccountLimits,
  type CounterStore,
  type HostedPolicy,
  type TokenVerifier,
} from '../../server/core/hosted-policy.ts';
import type { ProviderTransport } from '../../server/menu/extract.ts';
import type { Requester, Resolver } from '../../server/menu/fetch-pdf.ts';
import { createGeminiTransport } from '../../server/menu/gemini-transport.ts';

export const DEFAULT_ORIGINS = 'https://mrdrah.github.io';
export const PRIMARY_MODEL = 'gemini-3.5-flash-lite';
export const FALLBACK_MODEL = 'gemini-3.8-flash';

/** Exact origins only: scheme://host[:port], no path, no wildcard. Anything else is dropped. */
export function parseOrigins(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const out: string[] = [];
  for (const part of raw.split(/[,\n;]/)) {
    const item = part.trim();
    if (!/^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/.test(item)) continue; // no "*", no path, no trailing text
    out.push(item);
  }
  return out;
}

const positive = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : fallback);

export interface LimitSettings {
  extractPerHour?: unknown;
  extractPerDay?: unknown;
  fetchPerHour?: unknown;
  fetchPerDay?: unknown;
}

/** Contract §13.4: configuration, with the DEFAULT value when a setting is absent or not a positive integer. */
export function parseLimits(s: LimitSettings): AccountLimits {
  return {
    extract: { perHour: positive(s.extractPerHour, DEFAULT_LIMITS.extract.perHour), perDay: positive(s.extractPerDay, DEFAULT_LIMITS.extract.perDay) },
    fetch: { perHour: positive(s.fetchPerHour, DEFAULT_LIMITS.fetch.perHour), perDay: positive(s.fetchPerDay, DEFAULT_LIMITS.fetch.perDay) },
  };
}

export interface HostedConfig {
  version: string;
  /** Secret GEMINI_API_KEY; empty/absent gives NOT_CONFIGURED (US-E14-05/AC5). */
  geminiKey: string | undefined;
  /** Secret ALLOWED_ACCOUNTS; empty/absent denies everyone (US-E14-02/AC4). */
  allowedAccounts: string | undefined;
  allowedOrigins: string | undefined;
  limits: LimitSettings;
}

export interface HostedPorts {
  verifier: TokenVerifier;
  store: CounterStore;
  resolve: Resolver;
  request: Requester;
  fetch: typeof fetch;
  nowMs(): number;
  sleep(ms: number): Promise<void>;
  log(message: string): void;
}

export function buildHostedDeps(config: HostedConfig, ports: HostedPorts): ProxyDeps {
  const key = config.geminiKey?.trim() ?? '';
  const provider: ProviderTransport | null =
    key === ''
      ? null
      : createGeminiTransport({
          apiKey: key,
          fetch: ports.fetch,
          // The extraction budget logs its own fixed-shape attempt line; the transport's free text is dropped (US-E14-06).
          log: () => undefined,
        });
  const policy: HostedPolicy = {
    allowedOrigins: parseOrigins(config.allowedOrigins ?? DEFAULT_ORIGINS),
    verifier: ports.verifier,
    allowList: parseAllowList(config.allowedAccounts),
    limits: parseLimits(config.limits),
    store: ports.store,
  };
  return {
    version: config.version,
    resolve: ports.resolve,
    request: ports.request,
    fixtures: { known: new Map(), forRequest: () => null }, // recorded fixtures never run hosted
    provider,
    cache: nullCache, // nothing stored (US-E14-06/AC3)
    extractCap: unlimitedCap, // per-account limits replace the process-local cap
    fetchCap: unlimitedCap,
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    allowScenarios: false, // hard-coded, not read from configuration
    policy,
    nowMs: ports.nowMs,
    sleep: ports.sleep,
    log: ports.log,
  };
}
