// Share sheet (design/components.md §10, US-E9-01, US-E9-02): the button under the calendar legend and the
// dialog with the exact text, the two notes and the actions. Nothing happens until the parent taps.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createDayViewer } from '../../domain/calendar/day-view.ts';
import { composeShareText, shareWeek, type ShareLabels } from '../../domain/share/week-text.ts';
import { formatDate } from '../../i18n/format.ts';
import { useApp, useStore } from '../app-store.tsx';

export function ShareSheet() {
  const { t, state, today, services, showToast } = useApp();
  const store = useStore();
  const lang = state.language;
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const view = useMemo(() => createDayViewer(services.dictionary), [services.dictionary]);

  const text = useMemo(() => {
    if (!open) return '';
    const date = (d: Parameters<typeof formatDate>[2]) => formatDate(t, lang, d);
    const labels: ShareLabels = {
      header: (from, to) => t('share.text.header', { range: t('fmt.range', { from: date(from), to: date(to) }) }),
      bento: (d, recipe) => t('share.text.bento', { date: date(d), recipe: recipe === undefined ? '' : lang === 'en' ? recipe.en : recipe.ja }),
      notConfirmed: (d) => t('share.text.notConfirmed', { date: date(d) }),
      others: t('share.text.others'),
      reservation: t('share.text.reservation'),
      empty: t('share.text.empty'),
    };
    return composeShareText(shareWeek(store, today, view), labels);
  }, [open, store, today, view, t, lang]);

  const selectText = () => {
    const el = preview.current;
    if (el === null) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };
  const fail = () => {
    setFailed(true);
    // after the message renders; the text is selected so the parent can copy it by hand (AC4)
    setTimeout(selectText, 0);
  };
  const run = async (action: () => Promise<'shared' | 'copied' | 'cancelled'>) => {
    const r = await action();
    if (r === 'copied') {
      setFailed(false);
      showToast(t('share.copied'));
    } else if (r === 'cancelled') fail();
    else setFailed(false);
  };
  const close = () => {
    setOpen(false);
    setFailed(false);
    opener.current?.focus();
  };
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  return (
    <>
      <button ref={opener} type="button" className="btn btn--secondary btn--block share-button" data-testid="share-button" onClick={() => setOpen(true)}>
        <svg className="icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t('share.button')}
      </button>
      {open && (
        <div className="scrim">
          <div
            className="dialog share-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            data-testid="share-sheet"
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
          >
            <h2 id="share-title" className="dialog__title">
              {t('share.sheet.title')}
            </h2>
            <p className="share-sheet__label" id="share-preview-label">
              {t('share.sheet.preview')}
            </p>
            <div ref={preview} className="share-sheet__preview" data-testid="share-preview" role="group" aria-labelledby="share-preview-label" lang={lang}>
              {text}
            </div>
            {failed && (
              <p className="field-error" role="alert" data-testid="share-copy-failed">
                {t('share.copyFailed')}
              </p>
            )}
            <p className="share-sheet__note" data-testid="share-note">
              {t('share.sheet.note')}
            </p>
            <p className="share-sheet__note" data-testid="share-privacy">
              {t('share.sheet.privacy')}
            </p>
            <div className="dialog__actions">
              {services.share.canShare() && (
                <button type="button" className="btn btn--primary" data-testid="share-native" onClick={() => void run(() => services.share.share(text))}>
                  {t('share.sheet.share')}
                </button>
              )}
              <button type="button" className={services.share.canShare() ? 'btn btn--secondary' : 'btn btn--primary'} data-testid="share-copy" onClick={() => void run(async () => ((await services.share.copy(text)) ? 'copied' : 'cancelled'))}>
                {t('share.sheet.copy')}
              </button>
              <button ref={closeRef} type="button" className="btn btn--text" data-testid="share-close" onClick={close}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
