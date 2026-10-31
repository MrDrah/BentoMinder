// The real provider transport: Gemini Developer API generateContent (ADR 002 §1–§5, M5).
// The key is injected (read from the environment only in server/index.ts) and travels only in the
// `x-goog-api-key` header; it is never put in a URL, a log line, an error or a reply. fetch is
// injected so every test runs against a fake.
import type { ProviderReply, ProviderRequest, ProviderTransport } from './extract.ts';
import { buildPrompt, modelResponseSchema } from './gemini-prompt.ts';

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
/** ADR 002 §1: ids the proxy accepts unless AI_ALLOW_PAID_MODELS=true. */
export const FREE_TIER_MODELS: readonly string[] = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
export const PROVIDER_TIMEOUT_MS = 60_000;
export const GEMINI_TEMPERATURE = 0.1;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface GeminiTransportOptions {
  apiKey: string;
  fetch: typeof fetch;
  /** null = any model id (AI_ALLOW_PAID_MODELS=true). */
  allowedModels?: readonly string[] | null;
  timeoutMs?: number;
  /** Server-side log: model ids and status codes only. */
  log?(message: string): void;
  onUsage?(model: string, usage: Usage): void;
}

interface Part {
  text?: unknown;
  thought?: unknown;
}
interface GenerateResponse {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

const BLOCKED_FINISH = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY']);

function retryAfterOf(header: string | null, body: unknown): number | null {
  if (header !== null && /^\d{1,5}$/.test(header.trim())) return Number(header.trim());
  const details = (body as { error?: { details?: { retryDelay?: unknown }[] } } | null)?.error?.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      const m = typeof d?.retryDelay === 'string' ? /^(\d+(?:\.\d+)?)s$/.exec(d.retryDelay) : null;
      if (m !== null) return Math.ceil(Number(m[1]));
    }
  }
  return null;
}

export function createGeminiTransport(options: GeminiTransportOptions): ProviderTransport {
  const { apiKey, log } = options;
  if (apiKey.trim() === '') throw new RangeError('GEMINI_API_KEY is empty');
  const allowed = options.allowedModels === undefined ? FREE_TIER_MODELS : options.allowedModels;
  const timeoutMs = options.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  const schema = modelResponseSchema();

  return {
    async call(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderReply> {
      const { model } = request;
      if (!/^[a-z0-9][a-z0-9.-]{0,63}$/.test(model) || (allowed !== null && !allowed.includes(model))) {
        log?.(`model not allowed: ${model.slice(0, 64)}`);
        return { kind: 'http', status: 400, retryAfterSec: null };
      }
      const body = {
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: Buffer.from(request.pdf).toString('base64') } },
              { text: buildPrompt(request.targetMonth, request.repairErrors) },
            ],
          },
        ],
        generationConfig: {
          temperature: GEMINI_TEMPERATURE,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          // ADR 002 §1: 3.8 Flash rejects "minimal"; Flash-Lite's setting is UNVERIFIED, so it is left at default.
          ...(model.includes('lite') ? {} : { thinkingConfig: { thinkingLevel: 'low' } }),
        },
      };
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
      let res: Response;
      try {
        res = await options.fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: combined,
        });
      } catch (err) {
        log?.(`provider ${model} request failed (${err instanceof Error ? err.name : 'error'})`);
        return { kind: 'timeout' };
      }
      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }
      if (!res.ok) return { kind: 'http', status: res.status, retryAfterSec: retryAfterOf(res.headers.get('retry-after'), payload) };

      const data = (payload ?? {}) as GenerateResponse;
      const usage = data.usageMetadata;
      if (usage !== undefined) {
        options.onUsage?.(model, { inputTokens: Number(usage.promptTokenCount ?? 0), outputTokens: Number(usage.candidatesTokenCount ?? 0) });
      }
      const candidate = data.candidates?.[0];
      if (data.promptFeedback?.blockReason !== undefined || (candidate?.finishReason !== undefined && BLOCKED_FINISH.has(candidate.finishReason))) {
        // Blocked content does not improve on a retry: treated like a 400 (one call, no retry).
        log?.(`provider ${model} blocked the reply (${data.promptFeedback?.blockReason ?? candidate?.finishReason})`);
        return { kind: 'http', status: 400, retryAfterSec: null };
      }
      const text = (candidate?.content?.parts ?? [])
        .filter((p) => p.thought !== true && typeof p.text === 'string')
        .map((p) => p.text as string)
        .join('');
      // An empty or truncated reply is "malformed output": the BR-10 repair retry decides what follows.
      return { kind: 'ok', text };
    },
  };
}
