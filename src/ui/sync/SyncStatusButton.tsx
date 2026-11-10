// The app-bar status button (components §16.7): a 44 px icon button left of 設定, hidden while the account is in no family
// (`local-only`), so the app looks exactly as before. Opens the status sheet (lazy chunk `sync-status`).
import { useRef, useState } from 'react';
import { useApp } from '../app-store.tsx';
import { ChunkBoundary, LazyStatusSheet } from './lazy.tsx';
import { useSyncState } from './sync-context.tsx';
import { statusText, SyncIcon } from './status-view.tsx';

/** True while the button is drawn; the app bar uses it to move the brand-text breakpoint (480 px, §16.7). */
export function useSyncButtonShown(): boolean {
  const s = useSyncState();
  return s.enabled && s.view.state !== 'local-only';
}

export function SyncStatusButton() {
  const { t } = useApp();
  const s = useSyncState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  if (!s.enabled || s.view.state === 'local-only') return null;
  const word = t(statusText(s.view.state, s.limitScope).word);
  const shown = s.view.stale ? t('sync.stale.short') : word;
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`iconbtn sync-btn${s.view.stale ? ' sync-btn--stale' : ''}`}
        data-testid="appbar-sync"
        aria-label={t('sync.chip.aria', { state: shown })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <SyncIcon state={s.view.state} stale={s.view.stale} />
        <span className="sync-btn__word" data-testid="sync-state" data-state={s.view.state}>
          {shown}
        </span>
      </button>
      {open && (
        <ChunkBoundary>
          <LazyStatusSheet
            onClose={() => {
              setOpen(false);
              setTimeout(() => ref.current?.focus(), 0);
            }}
          />
        </ChunkBoundary>
      )}
    </>
  );
}
