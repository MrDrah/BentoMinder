// One persistent polite status node (`sync-live`, components §16.7). It announces only what needs attention: entering
// pending-offline, entering retrying after the 5-minute mark, any paused state, membership-ended, and the return to
// synced after any of these. Routine syncing -> synced cycles are silent; at most one message per 10 seconds.
import { useEffect, useRef, useState } from 'react';
import type { SyncStatus } from '../../domain/sync/types.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useApp } from '../app-store.tsx';
import { useSyncState } from './sync-context.tsx';

export const LIVE_MIN_GAP_MS = 10_000;

const ATTENTION = new Set<SyncStatus>(['pending-offline', 'retrying', 'paused-no-consent', 'paused-limit', 'paused-app-too-old', 'membership-ended']);

export function liveKeyFor(prev: SyncStatus, next: SyncStatus, wasAttention: boolean): MessageKey | null {
  if (next === prev) return null;
  switch (next) {
    case 'pending-offline':
      return 'sync.live.pendingOffline';
    case 'retrying':
      return null; // announced when the retry-now mark is reached (below)
    case 'paused-no-consent':
    case 'paused-limit':
    case 'paused-app-too-old':
      return 'sync.live.paused';
    case 'membership-ended':
      return 'sync.live.ended';
    case 'synced':
      return wasAttention ? 'sync.live.synced' : null;
    default:
      return null;
  }
}

export function SyncLive() {
  const { t, now } = useApp();
  const s = useSyncState();
  const [text, setText] = useState('');
  const prev = useRef<{ state: SyncStatus; retryNow: boolean; attention: boolean }>({ state: s.view.state, retryNow: false, attention: ATTENTION.has(s.view.state) });
  const lastAt = useRef(Number.NEGATIVE_INFINITY);
  const state = s.view.state;
  const retryNow = s.view.showRetryNow;
  useEffect(() => {
    const before = prev.current;
    let key = liveKeyFor(before.state, state, before.attention);
    if (state === 'retrying' && retryNow && !before.retryNow) key = 'sync.live.retrying'; // the 5-minute mark
    // A syncing state in between does not forget that the parent was told about a problem.
    const attention = ATTENTION.has(state) ? true : state === 'synced' ? false : before.attention;
    prev.current = { state, retryNow, attention };
    if (key === null) return;
    const at = now();
    if (at - lastAt.current < LIVE_MIN_GAP_MS) return;
    lastAt.current = at;
    setText(t(key));
  }, [state, retryNow, t, now]);
  if (!s.enabled) return null;
  return (
    <div className="visually-hidden" role="status" aria-live="polite" data-testid="sync-live">
      {text}
    </div>
  );
}
