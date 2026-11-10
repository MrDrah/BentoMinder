// The nine statuses as words, hints and icon shapes (components §16.7). The shape differs per state so colour is never
// the only signal; the words are the catalog's (the only 「同期」 are the two the ACs fix). Main bundle: the app-bar
// button and the settings row need them before any lazy chunk loads.
import type { MessageKey } from '../../i18n/index.ts';
import type { SyncStatus } from '../../domain/sync/types.ts';
import type { SyncState } from './state.ts';

interface StateText {
  word: MessageKey;
  hint: MessageKey | null;
}

const TEXT: Record<SyncStatus, StateText> = {
  'local-only': { word: 'sync.localOnly', hint: null },
  synced: { word: 'sync.synced', hint: 'sync.synced.hint' },
  syncing: { word: 'sync.syncing', hint: 'sync.syncing.hint' },
  'pending-offline': { word: 'sync.pendingOffline', hint: 'sync.pendingOffline.hint' },
  retrying: { word: 'sync.retrying', hint: 'sync.retrying.hint' },
  'paused-no-consent': { word: 'sync.needsConsent', hint: 'sync.needsConsent.hint' },
  'paused-limit': { word: 'sync.limit', hint: 'sync.limit.hint' },
  'paused-app-too-old': { word: 'sync.appTooOld', hint: 'sync.appTooOld.hint' },
  'membership-ended': { word: 'sync.membershipEnded', hint: 'sync.membershipEnded.hint' },
};

export function statusText(state: SyncStatus, limitScope: SyncState['limitScope']): StateText {
  if (state === 'paused-limit' && limitScope === 'writes') return { word: 'sync.limit.writes', hint: 'sync.limit.writes.hint' };
  return TEXT[state];
}

const CLOUD = 'M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9a4.5 4.5 0 0 0 0 9z';
const MARK: Record<SyncStatus, string> = {
  'local-only': '',
  synced: 'M9.5 13.5l2 2 3.5-4',
  syncing: 'M10 12.5l2-2 2 2M14 15.5l-2 2-2-2',
  'pending-offline': 'M4 4l16 16',
  retrying: 'M14.5 13a2.5 2.5 0 1 1-.8-1.8M14.6 9.8v1.8h-1.8',
  'paused-no-consent': 'M10.5 11.5v4M13.5 11.5v4',
  'paused-limit': 'M9.5 11.5v4M12.5 11.5v4M16 11v2M16 15v.01',
  'paused-app-too-old': 'M12 16v-5M9.5 13l2.5-2.5 2.5 2.5',
  'membership-ended': 'M10 11.5l4 4M14 11.5l-4 4',
};

export function SyncIcon({ state, stale = false, size = 24 }: { state: SyncStatus; stale?: boolean; size?: number }) {
  return (
    <svg className={`sync-icon${state === 'syncing' ? ' sync-icon--spin' : ''}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" data-shape={state}>
      <path d={CLOUD} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {MARK[state] !== '' && <path d={MARK[state]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {stale && <path d="M20 3v3M20 8.5v.01" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
    </svg>
  );
}
