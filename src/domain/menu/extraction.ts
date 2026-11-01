// Turning a model reply into a validated ExtractedMenu (ADR 002 §3–§4): JSON parse →
// normalise (F-1) → app-set fields → strict zod parse → "not a menu" check. Shared by the proxy
// (server-side adapter) and by tests; the client re-validates what the proxy returns.
import { extractedMenuSchema, toRuleIssues, type ExtractedMenu } from '../schema/index.ts';
import type { YearMonth } from '../time/jst.ts';
import { isNotAMenu, normalizeModelOutput } from './normalize.ts';

/** Version of the fixed extraction prompt (ADR 002 §3); bump when the prompt text changes. */
export const PROMPT_VERSION = 2;
/** Version of the ExtractedMenu JSON Schema sent to the model (contract `extracted-menu/1`). */
export const EXTRACTION_SCHEMA_VERSION = 1;

/** Contract §3.3: `ext-<YYYY-MM>-<first 8 hex of sha256>`. */
export function extractionId(month: string, sha256: string): string {
  return `ext-${month}-${sha256.slice(0, 8)}`;
}

export interface ReplyContext {
  targetMonth: YearMonth;
  sha256: string;
  byteSize: number;
  model: string;
  promptVersion: number;
  /** Contract timestamp of when the bytes were obtained / the reply arrived. */
  at: string;
}

export type ReplyOutcome =
  | { kind: 'ok'; menu: ExtractedMenu }
  | { kind: 'malformed'; issues: string[] }
  | { kind: 'not-a-menu' };

/**
 * The proxy doesn't know how the parent obtained the PDF (URL or file name never reach it,
 * BR-10), so it validates with a provisional `upload` source; the client replaces kind, url and
 * filename with `stampOrigin` and validates again.
 */
export const PROVISIONAL_FILENAME = 'menu.pdf';

export function parseModelReply(text: string, ctx: ReplyContext): ReplyOutcome {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: 'malformed', issues: ['json-parse'] };
  }
  const normalized = normalizeModelOutput(json, ctx.targetMonth);
  if (typeof normalized !== 'object' || normalized === null || Array.isArray(normalized)) {
    return { kind: 'malformed', issues: ['not-an-object'] };
  }
  const full = {
    ...normalized,
    id: extractionId(ctx.targetMonth, ctx.sha256),
    source: {
      kind: 'upload',
      filename: PROVISIONAL_FILENAME,
      sha256: ctx.sha256,
      byteSize: ctx.byteSize,
      fetchedAt: ctx.at,
      model: ctx.model,
      promptVersion: ctx.promptVersion,
    },
    extractedAt: ctx.at,
  };
  const parsed = extractedMenuSchema.safeParse(full);
  if (!parsed.success) return { kind: 'malformed', issues: toRuleIssues(parsed.error).map((i) => `${i.rule} ${i.path}`.trim()) };
  if (isNotAMenu(parsed.data)) return { kind: 'not-a-menu' };
  return { kind: 'ok', menu: parsed.data };
}

export type MenuOrigin = { kind: 'url'; url: string } | { kind: 'upload'; filename: string; url?: string };

/** A file name as the contract stores it: NFC, trimmed, 1–255 code points. */
export function safeFilename(name: string): string {
  const cleaned = [...name.normalize('NFC').trim()].slice(0, 255).join('').trim();
  return cleaned === '' ? PROVISIONAL_FILENAME : cleaned;
}

/** Records how the parent obtained the PDF (US-E2-01/AC1, US-E2-02/AC2); validates the result. */
export function stampOrigin(menu: ExtractedMenu, origin: MenuOrigin): ExtractedMenu | null {
  const { kind: _kind, url: _url, filename: _filename, ...rest } = menu.source;
  void _kind;
  void _url;
  void _filename;
  const source =
    origin.kind === 'url'
      ? { ...rest, kind: 'url' as const, url: origin.url }
      : { ...rest, kind: 'upload' as const, filename: safeFilename(origin.filename), ...(origin.url === undefined ? {} : { url: origin.url }) };
  const parsed = extractedMenuSchema.safeParse({ ...menu, source });
  return parsed.success ? parsed.data : null;
}
