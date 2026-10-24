// PdfSource web adapter. M0 stub: UNAVAILABLE. M1 adds the URL path via the proxy
// (POST /api/menu/fetch-pdf, browsers can't fetch other sites' PDFs) and file upload.
import type { PdfSource } from '../../domain/ports.ts';

export function createWebPdfSource(): PdfSource {
  return {
    fromUrl: () => Promise.resolve({ ok: false, error: 'UNAVAILABLE' }),
    fromFile: () => Promise.resolve({ ok: false, error: 'UNAVAILABLE' }),
  };
}
