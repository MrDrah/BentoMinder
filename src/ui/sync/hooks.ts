// What every family screen reads: the controller, its state and whether the network is there.
import { useEffect, useState } from 'react';
import { useApp } from '../app-store.tsx';
import type { SyncController } from './controller.ts';
import type { SyncState } from './state.ts';
import { useSyncController, useSyncState } from './sync-context.tsx';

export function useOnline(): boolean {
  const { services } = useApp();
  const [online, setOnline] = useState(() => services.isOnline());
  useEffect(() => {
    const update = () => setOnline(services.isOnline());
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [services]);
  return online;
}

/** The controller and state of an account with sharing on; screens render only when this is non-null. */
export function useFamily(): { sync: SyncController; state: SyncState } | null {
  const sync = useSyncController();
  const state = useSyncState();
  return sync === null || !state.enabled ? null : { sync, state };
}
