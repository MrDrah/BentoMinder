// Notes of the sharing engine (components §16.8): an ended membership, edits that lost to a newer family edit, records that
// were ignored. Info banners (role=status, never an alert), dismissible, one at a time, shown once: the engine's item is
// cleared when it is taken here, so dismissing never brings it back. The ended note stays until acknowledged.
import { useEffect, useRef, useState } from 'react';
import type { LostEdit } from '../../domain/sync/cycle.ts';
import { isLocalDate, isYearMonth, type LocalDate, type YearMonth } from '../../domain/time/jst.ts';
import { formatDateNoWeekday, formatMonth } from '../../i18n/format.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useApp } from '../app-store.tsx';
import { Banner } from '../components/Controls.tsx';
import { navigate, type Route } from '../router.ts';
import { useFamily } from './hooks.ts';
import { ChunkBoundary, LazyLostListDialog } from './lazy.tsx';

/** The label kind of an engine record kind (decisions are the "plan" of a day). */
export type LostKind = 'plan' | 'override' | 'menu' | 'profile' | 'settings';

export function lostKindOf(edit: LostEdit): LostKind | null {
  switch (edit.kind) {
    case 'decision':
      return 'plan';
    case 'override':
    case 'menu':
    case 'profile':
    case 'settings':
      return edit.kind;
    default:
      return null; // aiUsage is a counter, never an edit the parent made
  }
}

/** Where "見る" goes: the day sheet, the month, the profile or the settings. */
export function lostRoute(edit: LostEdit): Route | null {
  switch (lostKindOf(edit)) {
    case 'plan':
    case 'override':
      return isLocalDate(edit.key) ? { name: 'day', date: edit.key } : null;
    case 'menu':
      return isYearMonth(edit.key) ? { name: 'calendar', month: edit.key } : null;
    case 'profile':
      return { name: 'profile' };
    case 'settings':
      return { name: 'settings' };
    default:
      return null;
  }
}

export function useLostText() {
  const { t, state } = useApp();
  const lang = state.language;
  const params = (edit: LostEdit): Record<string, string> => ({
    dateShort: isLocalDate(edit.key) ? formatDateNoWeekday(t, lang, edit.key as LocalDate) : edit.key,
    month: isYearMonth(edit.key) ? formatMonth(t, lang, edit.key as YearMonth) : edit.key,
  });
  return {
    one: (edit: LostEdit): string => t(`family.lost.one.${lostKindOf(edit) ?? 'plan'}` as MessageKey, params(edit)),
    row: (edit: LostEdit): string => t(`family.lost.row.${lostKindOf(edit) ?? 'plan'}` as MessageKey, params(edit)),
  };
}

export function SyncNotes({ includeEnded = true }: { includeEnded?: boolean }) {
  const fam = useFamily();
  const { t, showToast } = useApp();
  const text = useLostText();
  const [lost, setLost] = useState<LostEdit[]>([]);
  const [ignored, setIgnored] = useState(0);
  const [list, setList] = useState(false);
  const left = useRef(false);

  const incomingLost = fam?.state.lostEdits;
  const incomingIgnored = fam?.state.ignoredRecords ?? 0;
  const sync = fam?.sync;
  useEffect(() => {
    if (sync === undefined) return;
    if ((incomingLost ?? []).length === 0 && incomingIgnored === 0) return;
    const edits = (incomingLost ?? []).filter((e) => lostKindOf(e) !== null);
    // Taken once: the engine forgets them, this component keeps them until the parent dismisses.
    setLost((l) => [...l, ...edits]);
    setIgnored((n) => n + incomingIgnored);
    sync.clearNotices();
  }, [incomingLost, incomingIgnored, sync]);

  const reason = fam?.state.endedReason ?? null;
  useEffect(() => {
    // Left on another device: only a toast, and the stand-alone copy continues (US-E15-08/AC6).
    if (reason !== 'left' || left.current || sync === undefined) return;
    left.current = true;
    showToast(t('family.toast.left'));
    void sync.family.acknowledgeEnded();
  }, [reason, sync, showToast, t]);

  if (fam === null) return null;

  if (includeEnded && (reason === 'removed' || reason === 'family-deleted')) {
    const key = reason === 'removed' ? 'removed' : 'deleted';
    return (
      <Banner variant="info" testId="banner-ended" title={t(`family.ended.${key}.title` as MessageKey)}>
        <p className="banner__body">{t(`family.ended.${key}.body` as MessageKey)}</p>
        <div className="banner__actions">
          <button type="button" className="btn btn--secondary btn--small" data-testid="banner-ended-ok" onClick={() => void fam.sync.family.acknowledgeEnded()}>
            {t('family.ended.ok')}
          </button>
        </div>
      </Banner>
    );
  }

  const close = (testId: string, onClick: () => void) => (
    <button type="button" className="btn btn--text btn--small" data-testid={testId} onClick={onClick}>
      {t('common.close')}
    </button>
  );

  const first = lost[0];
  if (first !== undefined) {
    const many = lost.length > 1;
    const route = lostRoute(first);
    return (
      <>
        <Banner variant="info" testId="banner-lost-edit" title={many ? t('family.lost.many', { n: lost.length }) : text.one(first)}>
          <div className="banner__actions">
            {many ? (
              <button type="button" className="btn btn--secondary btn--small" data-testid="banner-lost-show" onClick={() => setList(true)}>
                {t('family.lost.showAll')}
              </button>
            ) : (
              route !== null && (
                <button
                  type="button"
                  className="btn btn--secondary btn--small"
                  data-testid="banner-lost-show"
                  onClick={() => {
                    setLost([]);
                    navigate(route);
                  }}
                >
                  {t('family.lost.show')}
                </button>
              )
            )}
            {close('banner-lost-close', () => setLost([]))}
          </div>
        </Banner>
        {list && (
          <ChunkBoundary>
            <LazyLostListDialog
              items={lost.slice(0, 10)}
              onClose={() => setList(false)}
              onOpen={(edit) => {
                const target = lostRoute(edit);
                setList(false);
                setLost([]);
                if (target !== null) navigate(target);
              }}
            />
          </ChunkBoundary>
        )}
      </>
    );
  }

  if (ignored > 0) {
    return (
      <Banner variant="info" testId="banner-ignored" title={t('family.ignored.title')}>
        <p className="banner__body">{t('family.ignored.body')}</p>
        <div className="banner__actions">{close('banner-ignored-close', () => setIgnored(0))}</div>
      </Banner>
    );
  }
  return null;
}
