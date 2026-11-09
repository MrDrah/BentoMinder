// PdfSource web adapter (ADR 002 §2). URL path: the proxy downloads the PDF (browsers can't
// fetch other sites' PDFs, and the proxy owns the SSRF checks). File path: size and `%PDF-`
// checks happen here before anything is read into memory or sent (BR-14, US-E2-03).
import type { PdfError, PdfSource } from '../../domain/ports.ts';
import { parseDenial } from '../../domain/proxy/denial.ts';
import { MAX_PDF_BYTES } from '../../domain/schema/extracted-menu.ts';

const MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const startsWithMagic = (bytes: Uint8Array) => MAGIC.every((b, i) => bytes[i] === b);

const SERVER_ERRORS: Readonly<Record<string, PdfError>> = {
  URL_NOT_ALLOWED: 'BLOCKED',
  BLOCKED: 'BLOCKED',
  NOT_FOUND: 'NOT_FOUND',
  NOT_A_PDF: 'NOT_A_PDF',
  TOO_LARGE: 'TOO_LARGE',
  EMPTY: 'EMPTY',
};

export function createWebPdfSource(fetchImpl: typeof fetch = (...args) => fetch(...args), warn: (message: string) => void = (m) => console.warn(m)): PdfSource {
  return {
    async fromUrl(url, signal) {
      let res: Response;
      try {
        res = await fetchImpl('/api/menu/fetch-pdf', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
          ...(signal === undefined ? {} : { signal }),
        });
      } catch {
        return { ok: false, error: 'NETWORK' };
      }
      if (res.ok && (res.headers.get('content-type') ?? '').startsWith('application/pdf')) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (!startsWithMagic(bytes)) return { ok: false, error: 'NOT_A_PDF' };
        return { ok: true, bytes, sha256: await sha256Hex(bytes), byteSize: bytes.byteLength };
      }
      let code = '';
      try {
        const body: unknown = await res.json();
        // US-E14-08/AC1-AC3: the hosted proxy's account-level denials.
        const denial = parseDenial(body);
        if (denial !== null) return { ok: false, ...denial };
        code = String((body as { error?: unknown }).error ?? '');
      } catch {
        // not JSON: the proxy isn't there (e.g. a static host)
      }
      if (code === 'ORIGIN_NOT_ALLOWED') warn('The hosted proxy refused this site (ORIGIN_NOT_ALLOWED). Check its allowed origins.');
      return { ok: false, error: SERVER_ERRORS[code] ?? 'NETWORK' };
    },

    async fromFile(file) {
      if (file.size === 0) return { ok: false, error: 'EMPTY' };
      if (file.size > MAX_PDF_BYTES) return { ok: false, error: 'TOO_LARGE' };
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!startsWithMagic(bytes)) return { ok: false, error: 'NOT_A_PDF' };
      return {
        ok: true,
        bytes,
        sha256: await sha256Hex(bytes),
        byteSize: bytes.byteLength,
        ...(file.name === undefined || file.name === '' ? {} : { filename: file.name }),
      };
    },
  };
}
