// Picks the adapters for this platform at start-up (architecture §3). Web only until v1, when
// a Capacitor.isNativePlatform() branch returns the Android adapters (ADR 005).
import type { Clock, FileExport, MenuExtractor, PdfSource, Share, Storage } from '../domain/ports.ts';
import { createSystemClock, newDeviceId } from './web/clock.ts';
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

export function selectAdapters(): Adapters {
  return {
    storage: createWebStorage(),
    clock: createSystemClock(),
    extractor: createWebExtractor(),
    pdfSource: createWebPdfSource(),
    notifications: createWebNotifications(),
    share: createWebShare(),
    fileExport: createWebFileExport(),
    isOnline: webIsOnline,
    newDeviceId,
  };
}
