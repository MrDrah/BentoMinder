// Lazy chunk `sync-status` (components §16.7, §16.8): the status sheet and the list of edits that lost to a family edit.
// Loaded only when the parent opens the status button or the list. Read-only information; nothing here blocks the app.
import { useEffect, useId, useRef, useState } from 'react';
import type { LostEdit } from '../../../domain/sync/cycle.ts';
import { useApp } from '../../app-store.tsx';
import { useFocusTrap } from '../../hooks.ts';
import { reopenConsentPrompt } from '../consent-prompt.ts';
import { formatWhen } from '../format.ts';
import { useFamily } from '../hooks.ts';
import { statusText, SyncIcon } from '../status-view.tsx';
import { useLostText } from '../SyncNotes.tsx';

/** How long "試しています…" shows before the sheet says the retry did not work (the sheet never closes by itself). */
export const RETRY_WAIT_MS = 2500;

export function StatusSheet({ onClose }: { onClose: () => void }) {
  const fam = useFamily();
  const { t, state: app, now } = useApp();
  const headId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const [retrying, setRetrying] = useState(false);
  const [failed, setFailed] = useState(false);
  useFocusTrap(boxRef, true, onClose);
  useEffect(() => {
    headRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!retrying) return undefined;
    const id = setTimeout(() => {
      setRetrying(false);
      setFailed(true);
    }, RETRY_WAIT_MS);
    return () => clearTimeout(id);
  }, [retrying]);
  const status = fam?.state.view.state;
  useEffect(() => {
    // The retry worked: the state left "retrying".
    if (status !== 'retrying') {
      setRetrying(false);
      setFailed(false);
    }
  }, [status]);

  if (fam === null) return null;
  const { sync, state: s } = fam;
  const v = s.view;
  const text = statusText(v.state, s.limitScope);
  const lang = app.language;

  let action = null;
  if (v.state === 'retrying' && v.showRetryNow) {
    action = (
      <button
        type="button"
        className="btn btn--secondary btn--block"
        data-testid="sync-retry-now"
        aria-disabled={retrying ? true : undefined}
        aria-busy={retrying ? true : undefined}
        onClick={() => {
          if (retrying) return;
          setFailed(false);
          setRetrying(true);
          sync.syncNow();
        }}
      >
        {retrying && <span className="auth-spinner" aria-hidden="true" />}
        {retrying ? t('sync.retrying.busy') : t('sync.retryNow')}
      </button>
    );
  } else if (v.state === 'paused-no-consent') {
    action = (
      <button
        type="button"
        className="btn btn--secondary btn--block"
        data-testid="sync-action"
        onClick={() => {
          reopenConsentPrompt();
          onClose();
        }}
      >
        {t('sync.needsConsent.action')}
      </button>
    );
  } else if (v.state === 'paused-app-too-old') {
    action = (
      <button type="button" className="btn btn--secondary btn--block" data-testid="sync-action" onClick={() => window.location.reload()}>
        {t('sync.appTooOld.action')}
      </button>
    );
  } else if (v.state === 'membership-ended') {
    action = (
      <button
        type="button"
        className="btn btn--secondary btn--block"
        data-testid="sync-action"
        onClick={() => {
          void sync.family.acknowledgeEnded();
          onClose();
        }}
      >
        {t('family.ended.ok')}
      </button>
    );
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" data-testid="sheet-sync-scrim" />
      <div ref={boxRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby={headId} data-testid="sheet-sync">
        <div className="sheet__handle" aria-hidden="true" />
        <div className="sheet__head">
          <h2 id={headId} ref={headRef} tabIndex={-1} className="sheet__title">
            {t('sync.sheet.title')}
          </h2>
        </div>
        <div className="sheet__body family-sheet">
          <p className="family-sheet__state" data-testid="sync-sheet-state" data-state={v.state}>
            <SyncIcon state={v.state} stale={v.stale} size={32} />
            <span>{t(text.word)}</span>
          </p>
          {text.hint !== null && <p>{t(text.hint)}</p>}
          <p className="family-sheet__last" data-testid="sync-last">
            {v.lastSyncedAt === null ? t('sync.last.never') : t('sync.last', { when: formatWhen(t, lang, v.lastSyncedAt, now()) })}
          </p>
          {v.pendingCount > 0 && (
            <p data-testid="sync-pending">{t('sync.pending', { n: v.pendingCount })}</p>
          )}
          {v.stale && (
            <p>
              <span className="tag tag--warning" data-testid="sync-stale">
                {t('sync.stale')}
              </span>
            </p>
          )}
          {failed && (
            <p className="field-error" role="alert" data-testid="sync-retry-failed">
              {t('sync.retry.failed')}
            </p>
          )}
          {action}
          <button type="button" className="btn btn--text btn--block" data-testid="sheet-sync-close" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </>
  );
}

export function LostListDialog({ items, onClose, onOpen }: { items: readonly LostEdit[]; onClose: () => void; onOpen: (edit: LostEdit) => void }) {
  const { t } = useApp();
  const text = useLostText();
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  useFocusTrap(boxRef, true, onClose);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    headRef.current?.focus();
    return () => previous?.focus?.();
  }, []);
  return (
    <div className="scrim">
      <div ref={boxRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="dialog-lost-list">
        <h2 id={titleId} ref={headRef} tabIndex={-1} className="dialog__title">
          {t('family.lost.list.title')}
        </h2>
        <ul className="family-list">
          {items.map((edit, i) => (
            <li key={`${edit.kind}-${edit.key}-${i}`}>
              <button type="button" className="btn btn--text family-list__link" data-testid={`lost-row-${i}`} onClick={() => onOpen(edit)}>
                {text.row(edit)}
              </button>
            </li>
          ))}
        </ul>
        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary" data-testid="dialog-lost-list-close" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
