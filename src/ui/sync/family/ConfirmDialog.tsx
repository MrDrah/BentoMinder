// The dialogs of components §16.10: leave, leave as the last member, remove, delete the online data, delete the backup
// copy, import into the family. An alertdialog with initial focus on 「キャンセル」, Esc/backdrop = cancel (not while busy),
// the network check (the destructive button is aria-disabled offline and nothing is queued), a busy lock with a polite
// status, and the typed confirmation (NFKC + trim; checked on `input` and on `compositionend`, never mid-composition).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../../app-store.tsx';
import { BannerIcon } from '../../components/Controls.tsx';
import { useFocusTrap } from '../../hooks.ts';

export const normaliseTyped = (value: string): string => value.normalize('NFKC').trim().toLowerCase();

export interface ConfirmDialogProps {
  /** Test id suffix: `dialog-<name>`, `dialog-<name>-confirm`, `dialog-<name>-cancel`. */
  name: string;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** The word the parent must type, or undefined when one clear tap is enough. */
  typed?: string;
  /** `dialog` instead of `alertdialog`, for a primary (non-destructive) confirm. */
  plain?: boolean;
  /** Needs the network (leave, remove, delete): the confirm is disabled with `family.offline.action` while offline. */
  needsNetwork?: boolean;
  online: boolean;
  /** Resolves when done (the caller closes the dialog); a rejection shows `common.error.generic` and nothing changes. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function typedLabel(label: string, word: string): ReactNode {
  const quoted = `「${word}」`;
  const at = label.indexOf(quoted);
  if (at < 0) return label;
  return (
    <>
      {label.slice(0, at)}
      {'「'}
      <strong>{word}</strong>
      {'」'}
      {label.slice(at + quoted.length)}
    </>
  );
}

export function ConfirmDialog({ name, title, body, confirmLabel, typed, plain = false, needsNetwork = false, online, onConfirm, onClose }: ConfirmDialogProps) {
  const { t, state: app } = useApp();
  const titleId = useId();
  const bodyId = useId();
  const hintId = useId();
  const offlineId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [value, setValue] = useState('');
  const [matches, setMatches] = useState(false);
  const composing = useRef(false);
  const word = typed ?? '';

  const cancel = () => {
    if (!busy) onClose();
  };
  useFocusTrap(boxRef, true, cancel);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      // The trigger may be gone (the card changed variant): the caller moves focus then.
      if (previous !== null && document.contains(previous)) previous.focus();
    };
  }, []);

  const check = (v: string) => setMatches(normaliseTyped(v) === normaliseTyped(word));
  const blockedOffline = needsNetwork && !online;
  const blockedTyped = typed !== undefined && !matches;
  const blocked = blockedOffline || blockedTyped || busy;

  const run = async () => {
    if (blocked) return;
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && cancel()}>
      <div
        ref={boxRef}
        className="dialog"
        role={plain ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid={`dialog-${name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && typed !== undefined && matches && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            void run();
          }
        }}
      >
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        <div id={bodyId} className="dialog__body">
          {body}
        </div>
        {typed !== undefined && (
          <div className="field">
            <label className="field__label" htmlFor={`${hintId}-input`}>
              {typedLabel(t('family.typed.label'), word)}
            </label>
            <input
              id={`${hintId}-input`}
              className="input"
              type="text"
              lang={app.language}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={value}
              aria-describedby={hintId}
              data-testid="input-typed-confirm"
              onChange={(e) => {
                setValue(e.target.value);
                if (!composing.current) check(e.target.value);
              }}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={(e) => {
                composing.current = false;
                check(e.currentTarget.value);
              }}
            />
            <p id={hintId} className="field__hint">
              {t('family.typed.hint')}
            </p>
          </div>
        )}
        {blockedOffline && (
          <p id={offlineId} className="field__hint" data-testid="dialog-offline">
            {t('family.offline.action')}
          </p>
        )}
        <p className="visually-hidden" role="status" aria-live="polite" data-testid="dialog-busy-live">
          {busy ? t('family.dialog.busy.live') : ''}
        </p>
        {failed && (
          <p className="field-error" role="alert" data-testid="dialog-error">
            <BannerIcon variant="danger" />
            {t('common.error.generic')}
          </p>
        )}
        <div className="dialog__actions">
          <button
            type="button"
            className={`btn ${plain ? 'btn--primary' : 'btn--destructive'}${blocked && !busy ? ' is-disabled' : ''}`}
            data-testid={`dialog-${name}-confirm`}
            aria-disabled={blocked ? true : undefined}
            aria-busy={busy ? true : undefined}
            aria-describedby={blockedOffline ? offlineId : blockedTyped ? hintId : undefined}
            onClick={() => void run()}
          >
            {busy && <span className="auth-spinner" aria-hidden="true" />}
            {busy ? t('family.dialog.busy') : confirmLabel}
          </button>
          <button ref={cancelRef} type="button" className="btn btn--secondary" data-testid={`dialog-${name}-cancel`} aria-disabled={busy ? true : undefined} onClick={cancel}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
