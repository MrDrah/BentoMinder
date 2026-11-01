// MenuExtractor web adapter (ADR 002 §2–§3): POST /api/menu/extract with the PDF bytes as the
// body and exactly targetMonth, promptVersion and schemaVersion in the query (contract
// `ai-payload-allowlist`, US-NF-03/AC1). Nothing else, and never a profile field, leaves the app.
// The reply is validated again here before the app uses it (BR-11).
import { EXTRACTION_SCHEMA_VERSION, PROMPT_VERSION } from '../../domain/menu/extraction.ts';
import type { ExtractError, ExtractResult, MenuExtractor, ProviderCalls } from '../../domain/ports.ts';
import { extractedMenuSchema } from '../../domain/schema/extracted-menu.ts';

const ERRORS: readonly ExtractError[] = ['RATE_LIMITED', 'UNAVAILABLE', 'MALFORMED_OUTPUT', 'NOT_A_MENU', 'TOO_LARGE', 'NOT_A_PDF', 'NOT_CONFIGURED', 'NETWORK'];

const calls = (n: unknown): ProviderCalls => (n === 1 || n === 2 ? n : 0);

export function extractUrl(targetMonth: string): string {
  const q = new URLSearchParams({ targetMonth, promptVersion: String(PROMPT_VERSION), schemaVersion: String(EXTRACTION_SCHEMA_VERSION) });
  return `/api/menu/extract?${q.toString()}`;
}

/** US-NF-04/AC3: a request still unanswered after this long is abandoned and shown as unavailable. */
export const EXTRACT_TIMEOUT_MS = 90_000;

export function createWebExtractor(fetchImpl: typeof fetch = (...args) => fetch(...args), timeoutMs: number = EXTRACT_TIMEOUT_MS): MenuExtractor {
  return {
    async extract({ pdf, targetMonth }, callerSignal) {
      let body: unknown;
      // One internal controller: aborted by the timer or by the caller's signal.
      const ctl = new AbortController();
      const signal = ctl.signal;
      const onCaller = () => ctl.abort();
      if (callerSignal?.aborted === true) ctl.abort();
      else callerSignal?.addEventListener('abort', onCaller, { once: true });
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(extractUrl(targetMonth), {
          method: 'POST',
          headers: { 'content-type': 'application/pdf' },
          body: new Uint8Array(pdf),
          signal,
        });
        body = await res.json();
      } catch {
        // Timeout, network failure and caller abort all end here; no provider call is counted.
        return { ok: false, error: 'NETWORK', providerCalls: 0 };
      } finally {
        clearTimeout(timer);
        callerSignal?.removeEventListener('abort', onCaller);
      }
      const r = body as { ok?: unknown; menu?: unknown; meta?: Record<string, unknown>; error?: unknown; retryAfterSec?: unknown; providerCalls?: unknown };
      if (r.ok === true) {
        const menu = extractedMenuSchema.safeParse(r.menu);
        const meta = r.meta ?? {};
        if (!menu.success) return { ok: false, error: 'MALFORMED_OUTPUT', providerCalls: calls(meta['providerCalls']) };
        const result: ExtractResult = {
          ok: true,
          menu: menu.data,
          meta: {
            model: String(meta['model'] ?? ''),
            cached: meta['cached'] === true,
            promptVersion: Number(meta['promptVersion'] ?? PROMPT_VERSION),
            schemaVersion: Number(meta['schemaVersion'] ?? EXTRACTION_SCHEMA_VERSION),
            providerCalls: calls(meta['providerCalls']),
          },
        };
        return result;
      }
      const error = ERRORS.find((e) => e === r.error) ?? 'NETWORK';
      const retry = typeof r.retryAfterSec === 'number' && r.retryAfterSec > 0 ? { retryAfterSec: r.retryAfterSec } : {};
      return { ok: false, error, providerCalls: calls(r.providerCalls), ...retry };
    },
  };
}
