// The Android adapters, loaded by `selectAdapters` only when running inside the Capacitor shell (dynamic import:
// this module and the plugin packages are separate chunks the web never fetches).
import type { Clock, FileExport, Share, Storage } from '../../domain/ports.ts';
import { createNativeFileExport } from './file-export.ts';
import { createNativeNotifications, type NativeNotifications } from './notifications.ts';
import { loadNativePlugins } from './plugins.ts';
import { createNativeShare } from './share.ts';
import { createNativeStorage } from './storage.ts';

export interface NativeAdapters {
  storage: Storage;
  notifications: NativeNotifications;
  share: Share;
  fileExport: FileExport;
}

export async function createNativeAdapters(clock: Clock): Promise<NativeAdapters> {
  const plugins = await loadNativePlugins();
  return {
    storage: createNativeStorage(plugins.preferences),
    notifications: createNativeNotifications({ plugins, now: () => clock.now() }),
    share: createNativeShare(plugins.share),
    fileExport: createNativeFileExport(plugins),
  };
}
