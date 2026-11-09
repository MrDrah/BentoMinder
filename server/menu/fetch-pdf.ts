// POST /api/menu/fetch-pdf core (ADR 002 §2, BR-14, US-E2-01, US-E2-02): download the school's
// public PDF without letting a URL reach anything but the public internet.
//   - https only, port 443, no userinfo, ≤ 2,048 characters;
//   - every host is resolved first and every resolved address checked (isBlockedAddress);
//     the connection goes to the validated address (no second DNS lookup an attacker could
//     rebind), with the original host name for TLS (SNI + certificate check);
//   - ≤ 3 redirects, each target validated the same way;
//   - the body must start with `%PDF-`; it is never echoed back;
//   - 10 MB cap enforced while streaming; 15 s timeout for the whole action.
// Resolver and requester are injected, so unit tests never touch the network.
import { MAX_PDF_BYTES, MAX_URL_LENGTH } from '../../src/domain/schema/extracted-menu.ts';
import { isBlockedAddress } from '../net/ip.ts';

export type FetchPdfError = 'URL_NOT_ALLOWED' | 'BLOCKED' | 'NOT_FOUND' | 'NOT_A_PDF' | 'TOO_LARGE' | 'EMPTY' | 'NETWORK';
export type FetchPdfResult = { ok: true; bytes: Uint8Array } | { ok: false; error: FetchPdfError };

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface PdfResponse {
  status: number;
  headers: Readonly<Record<string, string | undefined>>;
  body: AsyncIterable<Uint8Array>;
  /** Stops the download (connection closed). */
  destroy(): void;
}
export type Requester = (request: { url: URL; address: ResolvedAddress; signal: AbortSignal }) => Promise<PdfResponse>;

export interface FetchPdfOptions {
  resolve: Resolver;
  request: Requester;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_REDIRECTS = 3;
const MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/** BR-14: the URL itself (before any lookup). */
export function checkUrl(raw: string): URL | null {
  if (raw.length > MAX_URL_LENGTH || /\s/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443')) return null;
  if (url.username !== '' || url.password !== '') return null;
  return url;
}

const stripBrackets = (host: string) => host.replace(/^\[|\]$/g, '');

async function resolveSafe(url: URL, resolve: Resolver): Promise<ResolvedAddress | 'BLOCKED' | 'NETWORK'> {
  const host = stripBrackets(url.hostname);
  const literal = /^[\d.]+$/.test(host) ? 4 : host.includes(':') ? 6 : 0;
  if (literal !== 0) return isBlockedAddress(host) ? 'BLOCKED' : { address: host, family: literal };
  if (isInternalName(host)) return 'BLOCKED'; // no lookup, no connection (US-E14-04/AC1)
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolve(host);
  } catch {
    return 'NETWORK';
  }
  if (addresses.length === 0) return 'NETWORK';
  // Conservative: if any address of the name is internal, the name is refused.
  if (addresses.some((a) => isBlockedAddress(a.address))) return 'BLOCKED';
  // IPv4 first: the hosted egress may not route IPv6, and a failure there must read as NETWORK (ADR 015 §4).
  return (addresses.find((a) => a.family === 4) ?? addresses[0]) as ResolvedAddress;
}

/** Names that are never a public school site: single-label hosts, localhost, and internal/local zones (incl. metadata.google.internal). */
export function isInternalName(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return !h.includes('.') || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local') || h === 'metadata.google.internal';
}

const isRedirect = (status: number) => status === 301 || status === 302 || status === 303 || status === 307 || status === 308;

function statusError(status: number): FetchPdfError {
  if (status === 404 || status === 410) return 'NOT_FOUND';
  if (status === 401 || status === 403 || status === 407 || status === 451) return 'BLOCKED';
  return 'NETWORK';
}

async function readBody(res: PdfResponse, maxBytes: number): Promise<FetchPdfResult> {
  const declared = Number(res.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    res.destroy();
    return { ok: false, error: 'TOO_LARGE' };
  }
  const contentType = (res.headers['content-type'] ?? '').toLowerCase();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.byteLength;
    if (size > maxBytes) {
      res.destroy();
      return { ok: false, error: 'TOO_LARGE' };
    }
    chunks.push(chunk);
    // Fail fast on an HTML page instead of downloading 10 MB of it.
    if (size >= MAGIC.length && chunks.length === 1 && !startsWithMagic(chunk)) {
      res.destroy();
      return { ok: false, error: 'NOT_A_PDF' };
    }
  }
  if (size === 0) return { ok: false, error: 'EMPTY' };
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  if (!startsWithMagic(bytes) || contentType.startsWith('text/html')) return { ok: false, error: 'NOT_A_PDF' };
  return { ok: true, bytes };
}

export function startsWithMagic(bytes: Uint8Array): boolean {
  return MAGIC.every((b, i) => bytes[i] === b);
}

export async function fetchPdf(rawUrl: string, options: FetchPdfOptions): Promise<FetchPdfResult> {
  const timeoutMs = options.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_PDF_BYTES;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const timedOut = new Promise<FetchPdfResult>((resolve) => {
    controller.signal.addEventListener('abort', () => resolve({ ok: false, error: 'NETWORK' }), { once: true });
  });

  const run = async (): Promise<FetchPdfResult> => {
    let url = checkUrl(rawUrl);
    if (url === null) return { ok: false, error: 'URL_NOT_ALLOWED' };
    for (let redirects = 0; ; redirects += 1) {
      const target = await resolveSafe(url, options.resolve);
      if (target === 'BLOCKED' || target === 'NETWORK') return { ok: false, error: target };
      if (controller.signal.aborted) return { ok: false, error: 'NETWORK' };
      let res: PdfResponse;
      try {
        res = await options.request({ url, address: target, signal: controller.signal });
      } catch {
        return { ok: false, error: 'NETWORK' };
      }
      if (isRedirect(res.status)) {
        res.destroy();
        const location = res.headers['location'];
        if (redirects >= maxRedirects || location === undefined) return { ok: false, error: 'BLOCKED' };
        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          return { ok: false, error: 'BLOCKED' };
        }
        const checked = checkUrl(next.toString());
        if (checked === null) return { ok: false, error: 'BLOCKED' };
        url = checked;
        continue;
      }
      if (res.status < 200 || res.status > 299) {
        res.destroy();
        return { ok: false, error: statusError(res.status) };
      }
      try {
        return await readBody(res, maxBytes);
      } catch {
        return { ok: false, error: 'NETWORK' };
      }
    }
  };

  try {
    return await Promise.race([run(), timedOut]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
