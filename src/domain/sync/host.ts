// The page as the sync controller sees it (an interface only; the web adapter and the tests implement it).
export type HostEvent = 'focus' | 'visible' | 'hidden' | 'online' | 'offline';

export interface SyncHost {
  isOnline(): boolean;
  isVisible(): boolean;
  /** Calls `handler` for each page event; returns unsubscribe. */
  subscribe(handler: (event: HostEvent) => void): () => void;
}
