// POST /api/menu/extract core (ADR 002 §2–§5): the BR-10 call budget, the sha256 cache and the
// proxy's own call cap, around a swappable provider transport. M1 plugs in the recorded-fixture
// transport (mock-transport.ts); M5 swaps in the Gemini transport and nothing else changes.
//
// Budget per import action: call 1 = primary model. Call 2 = EITHER one repair retry on the
// primary (malformed output, with the validation errors) OR the fallback model (429, 408,
// 5xx, timeout), never both; 400/403/404 (and other 4xx) are never retried; a PDF whose sha256
// was already extracted costs 0 calls.
import { createHash } from 'node:crypto';
import { EXTRACTION_SCHEMA_VERSION, PROMPT_VERSION, parseModelReply } from '../../src/domain/menu/extraction.ts';
import type { ExtractedMenu } from '../../src/domain/schema/extracted-menu.ts';
import { MAX_PDF_BYTES } from '../../src/domain/schema/extracted-menu.ts';
import type { YearMonth } from '../../src/domain/time/jst.ts';
import { startsWithMagic } from './fetch-pdf.ts';

/** What the transport receives: exactly the allow-listed inputs (contract `ai-payload-allowlist`). */
export interface ProviderRequest {
  model: string;
  pdf: Uint8Array;
  targetMonth: string;
  promptVersion: number;
  schemaVersion: number;
  /** Validation errors of call 1, for the repair retry only. */
  repairErrors?: string[];
}

export type ProviderReply =
  | { kind: 'ok'; text: string }
  | { kind: 'http'; status: number; retryAfterSec: number | null }
  | { kind: 'timeout' };

export interface ProviderTransport {
  call(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderReply>;
}

export type ExtractErrorCode =
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'MALFORMED_OUTPUT'
  | 'NOT_A_MENU'
  | 'TOO_LARGE'
  | 'NOT_A_PDF'
  | 'NOT_CONFIGURED';

export type ServerExtractResult =
  | { ok: true; menu: ExtractedMenu; meta: { model: string; cached: boolean; promptVersion: number; schemaVersion: number; providerCalls: 0 | 1 | 2 } }
  | { ok: false; error: ExtractErrorCode; retryAfterSec?: number; providerCalls: 0 | 1 | 2 };

/** Validated replies by PDF sha256 (ADR 002 §2 layer 2). Only successes are cached. */
export interface ExtractionCache {
  get(sha256: string): { text: string; model: string } | undefined;
  set(sha256: string, entry: { text: string; model: string }): void;
}

export function memoryCache(): ExtractionCache {
  const map = new Map<string, { text: string; model: string }>();
  return { get: (k) => map.get(k), set: (k, v) => void map.set(k, v) };
}

/** ADR 002 §2: the proxy's own cap on provider calls (per hour and per day). */
export interface CallCap {
  allow(): boolean;
  record(): void;
}

export function windowCap(limits: { perHour: number; perDay: number }, nowMs: () => number): CallCap {
  const calls: number[] = [];
  const prune = () => {
    const dayAgo = nowMs() - 86_400_000;
    while (calls.length > 0 && (calls[0] as number) <= dayAgo) calls.shift();
  };
  return {
    allow() {
      prune();
      const hourAgo = nowMs() - 3_600_000;
      return calls.length < limits.perDay && calls.filter((t) => t > hourAgo).length < limits.perHour;
    },
    record() {
      calls.push(nowMs());
    },
  };
}

export interface ExtractDeps {
  /** null = no provider configured (US-E2-06/AC4): answer without calling anything. */
  transport: ProviderTransport | null;
  primaryModel: string;
  fallbackModel: string;
  cache: ExtractionCache;
  cap: CallCap;
  /** Contract timestamp for source.fetchedAt / extractedAt. */
  timestamp(): string;
  sleep(ms: number): Promise<void>;
  /** Server-side log only (model ids, status codes); never sent to the client. */
  log?(message: string): void;
  /** Test/dev scenarios bypass the cache so every request runs its scenario. */
  bypassCache?: boolean;
}

export interface ExtractInput {
  pdf: Uint8Array;
  targetMonth: YearMonth;
}

export const MAX_FALLBACK_WAIT_MS = 5_000;

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

export const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const isTransient = (r: ProviderReply) =>
  r.kind === 'timeout' || (r.kind === 'http' && (r.status === 429 || r.status === 408 || r.status >= 500));

export async function runExtraction(input: ExtractInput, deps: ExtractDeps, signal?: AbortSignal): Promise<ServerExtractResult> {
  const { pdf, targetMonth } = input;
  if (pdf.byteLength > MAX_PDF_BYTES) return { ok: false, error: 'TOO_LARGE', providerCalls: 0 };
  if (pdf.byteLength === 0 || !startsWithMagic(pdf)) return { ok: false, error: 'NOT_A_PDF', providerCalls: 0 };
  const sha256 = sha256Hex(pdf);
  const ctx = (model: string) => ({ targetMonth, sha256, byteSize: pdf.byteLength, model, promptVersion: PROMPT_VERSION, at: deps.timestamp() });
  const meta = (model: string, cached: boolean, providerCalls: 0 | 1 | 2) => ({ model, cached, promptVersion: PROMPT_VERSION, schemaVersion: EXTRACTION_SCHEMA_VERSION, providerCalls });

  const hit = deps.bypassCache === true ? undefined : deps.cache.get(sha256);
  if (hit !== undefined) {
    const out = parseModelReply(hit.text, ctx(hit.model));
    if (out.kind === 'ok') return { ok: true, menu: out.menu, meta: meta(hit.model, true, 0) };
  }
  if (deps.transport === null) return { ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 };
  if (!deps.cap.allow()) return { ok: false, error: 'RATE_LIMITED', providerCalls: 0 };

  const transport = deps.transport;
  let calls: 0 | 1 | 2 = 0;
  const call = async (model: string, repairErrors?: string[]): Promise<ProviderReply> => {
    deps.cap.record();
    calls = calls === 0 ? 1 : 2;
    const request: ProviderRequest = { model, pdf, targetMonth, promptVersion: PROMPT_VERSION, schemaVersion: EXTRACTION_SCHEMA_VERSION, ...(repairErrors === undefined ? {} : { repairErrors }) };
    try {
      return await transport.call(request, signal);
    } catch {
      return { kind: 'timeout' };
    }
  };
  const fail = (error: ExtractErrorCode, retryAfterSec?: number | null): ServerExtractResult =>
    retryAfterSec === undefined || retryAfterSec === null ? { ok: false, error, providerCalls: calls } : { ok: false, error, retryAfterSec, providerCalls: calls };
  const failureOf = (r: Exclude<ProviderReply, { kind: 'ok' }>, model: string): ServerExtractResult => {
    if (r.kind === 'http') deps.log?.(`provider ${model} answered HTTP ${r.status}`);
    if (r.kind === 'http' && r.status === 429) return fail('RATE_LIMITED', r.retryAfterSec);
    return fail('UNAVAILABLE');
  };
  const accept = (r: { kind: 'ok'; text: string }, model: string, final: boolean): ServerExtractResult | { malformed: string[] } => {
    const out = parseModelReply(r.text, ctx(model));
    if (out.kind === 'ok') {
      deps.cache.set(sha256, { text: r.text, model });
      return { ok: true, menu: out.menu, meta: meta(model, false, calls) };
    }
    if (out.kind === 'not-a-menu') return fail('NOT_A_MENU');
    return final ? fail('MALFORMED_OUTPUT') : { malformed: out.issues };
  };

  const first = await call(deps.primaryModel);
  if (isAborted(signal)) return fail('UNAVAILABLE');
  if (first.kind === 'ok') {
    const result = accept(first, deps.primaryModel, false);
    if (!('malformed' in result)) return result;
    // Call 2: one repair retry on the same model, with the validation errors.
    const second = await call(deps.primaryModel, result.malformed);
    if (second.kind !== 'ok') return failureOf(second, deps.primaryModel);
    return accept(second, deps.primaryModel, true) as ServerExtractResult;
  }
  if (!isTransient(first)) return failureOf(first, deps.primaryModel); // 400/403/404: never retried
  // Call 2: the fallback model, after min(Retry-After, 5 s).
  const wait = first.kind === 'http' && first.retryAfterSec !== null ? Math.min(first.retryAfterSec * 1000, MAX_FALLBACK_WAIT_MS) : 0;
  if (wait > 0) await deps.sleep(wait);
  if (isAborted(signal)) return fail('UNAVAILABLE');
  const second = await call(deps.fallbackModel);
  if (second.kind !== 'ok') return failureOf(second, deps.fallbackModel);
  return accept(second, deps.fallbackModel, true) as ServerExtractResult;
}
