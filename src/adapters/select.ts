// Picks the adapters for this platform at start-up (architecture §3). Web only until v1, when
// a Capacitor.isNativePlatform() branch returns the Android adapters (ADR 005).
import type { Clock, FileExport, MenuExtractor, PdfSource, Share, Storage } from '../domain/ports.ts';
import { createSystemClock, newDeviceId } from './web/clock.ts';
import { parseProxyBase, PROXY_BASE_VARIABLE } from '../domain/proxy/base-url.ts';
import { createProxyFetch, type IdTokenSupplier } from './web/proxy-fetch.ts';
import { createWebExtractor } from './web/extractor.ts';
import { createWebFileExport, webIsOnline } from './web/file-export.ts';
import { createWebNotifications, type WebNotifications } from './web/notifications.ts';
import { createWebPdfSource } from './web/pdf-source.ts';
import { createWebShare } from './web/share.ts';
import { createWebStorage } from './web/storage.ts';

export interface Adapters {
  storage: Storage;
  clock: Clock;
  extractor: MenuExtractor;
  pdfSource: PdfSource;
  notifications: WebNotifications;
  share: Share;
  fileExport: FileExport;
  isOnline: () => boolean;
  newDeviceId: () => string;
}

/** `accountId` (ADR 014) binds storage to the signed-in account; omitted = legacy unkeyed storage. */
export function selectAdapters(accountId?: string, getToken: IdTokenSupplier = () => Promise.resolve(null)): Adapters {
  // US-E14-07: where the AI proxy lives. Unset (or rejected) = this origin, as before. The warning names the variable only.
  const parsed = parseProxyBase(import.meta.env.VITE_AI_PROXY_BASE_URL);
  if (parsed.rejected) console.warn(`${PROXY_BASE_VARIABLE} is not a valid proxy address and is ignored.`);
  const proxyFetch = createProxyFetch({ base: parsed.base, getToken });
  return {
    storage: createWebStorage(undefined, accountId),
    clock: createSystemClock(),
    extractor: createWebExtractor(proxyFetch),
    pdfSource: createWebPdfSource(proxyFetch),
    notifications: createWebNotifications(),
    share: createWebShare(),
    fileExport: createWebFileExport(),
    isOnline: webIsOnline,
    newDeviceId,
  };
}
