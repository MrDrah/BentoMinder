// The cloud-storage notice (components §16.2, `consent.cloud.*`, US-E15-02). One component: first time, upgrade (a new
// notice version), and the read view. It is the only thing between 「家族をつくる」/「参加する」 and any upload or download:
// nothing is requested before 「同意して進む」. Initial focus is the heading (never the accept button, AC4); accept and
// decline are equal buttons; Esc declines (no penalty); no checkbox, no pre-tick.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CLOUD_NOTICE_VERSION } from '../../../domain/sync/config.ts';
import type { MessageKey } from '../../../i18n/index.ts';
import { useApp } from '../../app-store.tsx';
import { Banner, BannerIcon } from '../../components/Controls.tsx';
import { LangToggle } from '../../components/LangToggle.tsx';
import { useFocusTrap } from '../../hooks.ts';

export type ConsentMode = 'first' | 'upgrade' | 'read';

const ITEMS = ['what', 'why', 'where', 'who', 'operator', 'ai', 'stop'] as const;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** The contact sentence with its address as a mailto link (the text of the link is the address, `lang="en"`). */
function contactLine(text: string): ReactNode {
  const m = EMAIL.exec(text);
  if (m === null) return text;
  const at = m.index;
  return (
    <>
      {text.slice(0, at)}
      <a href={`mailto:${m[0]}`} lang="en" className="family-link" data-testid="consent-cloud-contact">
        {m[0]}
      </a>
      {text.slice(at + m[0].length)}
    </>
  );
}

export interface ConsentNoticeProps {
  mode: ConsentMode;
  online: boolean;
  busy?: boolean;
  /** Shown above the buttons (assertive): the consent could not be recorded. */
  error?: boolean;
  /** Read view: the date the parent agreed (already formatted). */
  agreedOn?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onClose?: () => void;
  onLeave?: () => void;
}

export function ConsentNotice({ mode, online, busy = false, error = false, agreedOn, onAccept, onDecline, onClose, onLeave }: ConsentNoticeProps) {
  const { t } = useApp();
  const titleId = useId();
  const leadId = useId();
  const offlineId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const read = mode === 'read';
  const escape = () => {
    if (busy) return;
    if (read) onClose?.();
    else onDecline?.();
  };
  useFocusTrap(boxRef, true, escape);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const acceptBlocked = busy || !online;

  return (
    <div className="scrim consent-scrim">
      <div ref={boxRef} className="dialog consent" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={leadId} data-testid="consent-cloud">
        <div className="consent__top">
          <LangToggle />
        </div>
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="dialog__title">
          {t('consent.cloud.title')}
        </h2>
        {read && agreedOn !== undefined && (
          <p className="field__hint" data-testid="consent-cloud-agreed-on">
            {t('consent.cloud.agreedOn', { consentDate: agreedOn })}
          </p>
        )}
        {mode === 'upgrade' && (
          <Banner variant="info" testId="consent-cloud-upgrade" title={t('consent.cloud.upgrade.title')}>
            <p className="banner__body">{t('consent.cloud.upgrade.lead')}</p>
          </Banner>
        )}
        <p id={leadId}>{t('consent.cloud.lead')}</p>
        <dl className="consent__list">
          {ITEMS.map((k) => (
            <div key={k} className="consent__item">
              <dt>{t(`consent.cloud.${k}.h` as MessageKey)}</dt>
              <dd>{t(`consent.cloud.${k}.b` as MessageKey)}</dd>
            </div>
          ))}
        </dl>
        <p className="family-small">{contactLine(t('consent.cloud.contact'))}</p>
        {!read && <p className="consent__parent">{t('consent.cloud.parent')}</p>}
        {error && (
          <p className="field-error" role="alert" data-testid="consent-cloud-error">
            <BannerIcon variant="danger" />
            {t('consent.cloud.error')}
          </p>
        )}
        {!read && !online && (
          <p id={offlineId} className="field__hint" data-testid="consent-cloud-offline">
            {t('consent.cloud.offline')}
          </p>
        )}
        <div className="dialog__actions consent__actions">
          {read ? (
            <>
              <button type="button" className="btn btn--secondary" data-testid="consent-cloud-close" onClick={onClose}>
                {t('common.close')}
              </button>
              {onLeave !== undefined && (
                <button type="button" className="btn btn--destructive-text" data-testid="consent-cloud-leave" onClick={onLeave}>
                  {t('family.leave')}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className={`btn btn--primary${acceptBlocked ? ' is-disabled' : ''}`}
                data-testid="consent-cloud-accept"
                aria-disabled={acceptBlocked ? true : undefined}
                aria-busy={busy ? true : undefined}
                aria-describedby={!online ? offlineId : undefined}
                onClick={() => {
                  if (!acceptBlocked) onAccept?.();
                }}
              >
                {busy && <span className="auth-spinner" aria-hidden="true" />}
                {busy ? t('consent.cloud.busy') : t('consent.cloud.accept')}
              </button>
              <button type="button" className="btn btn--secondary" data-testid="consent-cloud-decline" aria-disabled={busy ? true : undefined} onClick={() => !busy && onDecline?.()}>
                {t('consent.cloud.decline')}
              </button>
            </>
          )}
        </div>
        <p className="family-small family-version" data-testid="consent-cloud-version">
          {t('consent.cloud.version', { version: CLOUD_NOTICE_VERSION })}
        </p>
      </div>
    </div>
  );
}
