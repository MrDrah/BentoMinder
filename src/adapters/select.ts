// Picks the adapters for this platform at start-up (architecture §3, ADR 005). In the browser: the web adapters, as
// always. Inside the Capacitor Android shell: the same web adapters with storage, notifications, share and file export
// replaced by the native ones, loaded by dynamic import so the web never fetches them.
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
import { isNativePlatform } from './platform.ts';
import type { NativeAdapters } from './native/index.ts';

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

/** How the platform is told apart and the native adapters loaded (replaced in tests). */
export interface PlatformProbe {
  isNative: () => boolean;
  loadNative: (clock: Clock) => Promise<NativeAdapters>;
}
const realPlatform: PlatformProbe = {
  isNative: () => isNativePlatform(),
  loadNative: async (clock) => (await import('./native/index.ts')).createNativeAdapters(clock),
};

/** `accountId` (ADR 014) binds storage to the signed-in account; omitted = legacy unkeyed storage. */
export async function selectAdapters(accountId?: string, getToken: IdTokenSupplier = () => Promise.resolve(null), platform: PlatformProbe = realPlatform): Promise<Adapters> {
  const web = selectWebAdapters(accountId, getToken);
  if (!platform.isNative()) return web;
  const native = await platform.loadNative(web.clock);
  return { ...web, ...native };
}

function selectWebAdapters(accountId: string | undefined, getToken: IdTokenSupplier): Adapters {
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
