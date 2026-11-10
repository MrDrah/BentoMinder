// The Family card of the settings screen (components §16.1), shell only: it picks one of the three variants and holds the
// two buttons of variant A and the status row of variant B. Everything heavier (consent, create, members, invite, safety
// copy, dialogs) is the lazy `family` chunk. No cloud request is made from here until a button is tapped.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app-store.tsx';
import { Banner, BannerIcon } from '../components/Controls.tsx';
import { Icon } from '../components/Icon.tsx';
import { navigate } from '../router.ts';
import { formatWhen } from './format.ts';
import { useFamily, useOnline } from './hooks.ts';
import { ChunkBoundary, LazyCreateFamilyFlow, LazyFamilyMembers, LazySafetyRow, LazyStatusSheet, Pending } from './lazy.tsx';
import { statusText, SyncIcon } from './status-view.tsx';

const SKELETON_MAX_MS = 3000;

export function FamilyCard() {
  const fam = useFamily();
  const { t, state: app, now } = useApp();
  const online = useOnline();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<'offline' | 'generic' | null>(null);
  const [sheet, setSheet] = useState(false);
  const [waited, setWaited] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const unknown = fam !== null && fam.state.membership === 'unknown' && fam.state.familyId === null;
  useEffect(() => {
    if (!unknown) return undefined;
    const id = setTimeout(() => setWaited(true), SKELETON_MAX_MS);
    return () => clearTimeout(id);
  }, [unknown]);
  // Back online: the "connect first" line is no longer true.
  useEffect(() => {
    if (online && error === 'offline') setError(null);
  }, [online, error]);

  if (fam === null) return null;
  const s = fam.state;
  const lang = app.language;
  const member = s.familyId !== null;
  const ended = s.endedReason === 'removed' || s.endedReason === 'family-deleted';

  const guarded = (action: () => void) => () => {
    if (!online) {
      setError('offline');
      return;
    }
    setError(null);
    action();
  };

  const errorLine = error !== null && (
    <p id="family-offline" className="field-error" role="alert" aria-live="assertive" data-testid="family-offline">
      <BannerIcon variant="danger" />
      {error === 'offline' ? t('family.offline') : t('common.error.generic')}
    </p>
  );

  let body;
  if (ended) {
    const key = s.endedReason === 'removed' ? 'removed' : 'deleted';
    body = (
      <Banner variant="info" testId="banner-ended" title={t(`family.ended.${key}.title` as 'family.ended.removed.title')}>
        <p className="banner__body">{t(`family.ended.${key}.body` as 'family.ended.removed.body')}</p>
        <div className="banner__actions">
          <button type="button" className="btn btn--secondary btn--small" data-testid="banner-ended-ok" onClick={() => void fam.sync.family.acknowledgeEnded()}>
            {t('family.ended.ok')}
          </button>
        </div>
      </Banner>
    );
  } else if (member) {
    const word = t(statusText(s.view.state, s.limitScope).word);
    const paused = !s.adoptionPending && s.view.lastSyncedAt === null && (s.view.state === 'pending-offline' || s.view.state === 'retrying');
    body = (
      <>
        <div data-testid="sync-row">
          <button ref={rowRef} type="button" className="family-status-row" data-testid="family-status-row" aria-haspopup="dialog" onClick={() => setSheet(true)}>
            <SyncIcon state={s.view.state} stale={s.view.stale} size={28} />
            <span className="family-status-row__text">
              <span className="family-status-row__word">
                <span className="visually-hidden">{t('sync.row.label')}</span>
                {word}
              </span>
              <span className="family-status-row__last">{s.view.lastSyncedAt === null ? t('sync.last.never') : t('sync.last', { when: formatWhen(t, lang, s.view.lastSyncedAt, now()) })}</span>
            </span>
            <Icon name="chevronRight" />
          </button>
        </div>
        {paused && (
          <Banner variant="info" testId="family-create-paused">
            <p className="banner__body">{t('family.create.paused')}</p>
          </Banner>
        )}
        <ChunkBoundary>
          <LazyFamilyMembers />
        </ChunkBoundary>
        {sheet && (
          <ChunkBoundary>
            <LazyStatusSheet
              onClose={() => {
                setSheet(false);
                setTimeout(() => rowRef.current?.focus(), 0);
              }}
            />
          </ChunkBoundary>
        )}
      </>
    );
  } else if (unknown && !waited) {
    body = (
      <div className="family-skeleton" aria-busy="true" data-testid="family-skeleton">
        <span className="family-skeleton__line" />
        <span className="family-skeleton__line family-skeleton__line--short" />
        <span className="family-skeleton__block" />
      </div>
    );
  } else {
    const ariaDisabled = !online ? true : undefined;
    body = (
      <>
        <p className="family-lead">{t('family.none.lead')}</p>
        <p className="field__hint">{t('family.none.hint')}</p>
        <div className="family-actions">
          <button
            type="button"
            className={`btn btn--primary${online ? '' : ' is-disabled'}`}
            data-testid="family-create"
            aria-disabled={ariaDisabled}
            aria-describedby={!online || error !== null ? 'family-offline' : undefined}
            aria-busy={creating || undefined}
            onClick={guarded(() => setCreating(true))}
          >
            {t('family.create')}
          </button>
          <button
            type="button"
            className={`btn btn--secondary${online ? '' : ' is-disabled'}`}
            data-testid="family-join"
            aria-disabled={ariaDisabled}
            aria-describedby={!online || error !== null ? 'family-offline' : undefined}
            onClick={guarded(() => navigate({ name: 'join', code: null }))}
          >
            {t('family.join')}
          </button>
        </div>
        {errorLine}
        {s.safetyCreatedAt !== null && (
          <ChunkBoundary fallback={<Pending />}>
            <LazySafetyRow />
          </ChunkBoundary>
        )}
        {creating && (
          <ChunkBoundary fallback={<Pending label="family.create.busy" />}>
            <LazyCreateFamilyFlow
              onDone={(result) => {
                setCreating(false);
                if (result === 'error') setError('generic');
                setTimeout(() => titleRef.current?.focus(), 0);
              }}
            />
          </ChunkBoundary>
        )}
      </>
    );
  }

  return (
    <section className="card family-card" aria-labelledby="settings-family-title" data-testid="settings-family">
      <h2 id="settings-family-title" ref={titleRef} tabIndex={-1} className="card__title">
        {t('family.section')}
      </h2>
      {body}
    </section>
  );
}
