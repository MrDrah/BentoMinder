// What the sync controller needs to know about the page: online, visible, and the events that mean "sync now".
import type { SyncHost } from '../../domain/sync/host.ts';

export function createWebSyncHost(): SyncHost {
  return {
    isOnline: () => navigator.onLine,
    isVisible: () => document.visibilityState === 'visible',
    subscribe(handler) {
      const onVisibility = () => handler(document.visibilityState === 'visible' ? 'visible' : 'hidden');
      const onFocus = () => handler('focus');
      const onOnline = () => handler('online');
      const onOffline = () => handler('offline');
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('focus', onFocus);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    },
  };
}
