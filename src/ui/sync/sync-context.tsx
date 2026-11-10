// What slice D renders from: the controller of the open account (or nothing when sync is off) and its state.
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SyncController } from './controller.ts';
import { DISABLED_SYNC_STATE, type SyncState } from './state.ts';

export const SyncContext = createContext<SyncController | null>(null);

/** The controller, or null when sync is not configured (VITE_SYNC_BASE_URL unset or invalid). */
export const useSyncController = (): SyncController | null => useContext(SyncContext);

const noopSubscribe = (): (() => void) => () => undefined;

/** The status state of the nine statuses (contract 14.9); `enabled: false` and `local-only` when sync is off. */
export function useSyncState(): SyncState {
  const controller = useContext(SyncContext);
  return useSyncExternalStore(
    controller === null ? noopSubscribe : controller.subscribe,
    controller === null ? () => DISABLED_SYNC_STATE : controller.getState,
  );
}
