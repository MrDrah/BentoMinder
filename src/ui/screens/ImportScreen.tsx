// Menu import (design/components.md §6.5–§6.7, flows F2): month, URL or PDF file, the AI
// consent notice, progress with 「中止する」, and the error panel with the other paths
// (US-E2-01…E2-08, US-E10-01/AC3). Rules come from the domain; only the PDF and the target month
// leave the device (BR-10).
import { useCallback, useEffect, useRef, useState } from 'react';
import { stampOrigin, type MenuOrigin } from '../../domain/menu/extraction.ts';
import {
  addAiUsage,
  findExtractionBySha,
  giveConsent,
  importMonthOptions,
  isValidMenuUrl,
  needsConsent,
  recordExtraction,
  savedSourceUrl,
} from '../../domain/menu/store-ops.ts';
import type { ExtractError, PdfBytes, PdfError } from '../../domain/ports.ts';
import type { BentoMinderStore } from '../../domain/schema/store.ts';
import type { YearMonth } from '../../domain/time/jst.ts';
import { formatMonth } from '../../i18n/format.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useApp, useStore } from '../app-store.tsx';
import { Banner, Dialog, FieldError } from '../components/Controls.tsx';
import { navigate, type Route } from '../router.ts';
import { rememberSessionPdf } from '../session.ts';

const CONSENT_TERMS_URL = 'https://ai.google.dev/gemini-api/terms';

type Panel =
  | { kind: 'fetch'; message: MessageKey; urlKept: boolean }
  | { kind: 'file'; message: MessageKey }
  | { kind: 'ai'; message: MessageKey; retry: boolean; upload: boolean; retryAfterSec?: number };

interface Pending {
  bytes: PdfBytes;
  sha256: string;
  origin: MenuOrigin;
}

const FETCH_ERRORS: Record<PdfError, MessageKey> = {
  NETWORK: 'import.err.network',
  NOT_FOUND: 'import.err.notFound',
  BLOCKED: 'import.err.blocked',
  NOT_A_PDF: 'import.err.notPdfUrl',
  TOO_LARGE: 'import.err.tooLarge',
  EMPTY: 'import.err.unreadable',
};
const FILE_ERRORS: Record<PdfError, MessageKey> = {
  NETWORK: 'import.err.unreadable',
  NOT_FOUND: 'import.err.unreadable',
  BLOCKED: 'import.err.unreadable',
  NOT_A_PDF: 'import.err.notPdfFile',
  TOO_LARGE: 'import.err.tooLarge',
  EMPTY: 'import.err.unreadable',
};

function aiPanel(error: ExtractError, retryAfterSec?: number): Panel {
  switch (error) {
    case 'MALFORMED_OUTPUT':
      return { kind: 'ai', message: 'import.err.malformed', retry: true, upload: true };
    case 'RATE_LIMITED':
      return { kind: 'ai', message: 'import.err.busy', retry: true, upload: true, ...(retryAfterSec === undefined ? {} : { retryAfterSec }) };
    case 'NOT_CONFIGURED':
      return { kind: 'ai', message: 'import.err.notConfigured', retry: false, upload: false };
    case 'NOT_A_MENU':
      return { kind: 'file', message: 'import.err.unreadable' };
    case 'TOO_LARGE':
      return { kind: 'file', message: 'import.err.tooLarge' };
    case 'NOT_A_PDF':
      return { kind: 'file', message: 'import.err.notPdfFile' };
    case 'UNAVAILABLE':
    case 'NETWORK':
      return { kind: 'ai', message: 'import.err.unavailable', retry: true, upload: true };
  }
}

export function ImportScreen({ onboarding }: { onboarding: boolean }) {
  const { t, state, today, now, services, commit, setFlash } = useApp();
  const store = useStore();
  const storeRef = useRef<BentoMinderStore>(store);
  storeRef.current = store;
  const lang = state.language;
  const months = importMonthOptions(today, store.settings.nextMonthPromptFromDay);
  const [month, setMonth] = useState<YearMonth>(months.selected);
  const [url, setUrl] = useState(() => savedSourceUrl(store) ?? '');
  const [urlError, setUrlError] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'extracting'>('idle');
  const [pending, setPending] = useState<Pending | null>(null);
  const [consentFor, setConsentFor] = useState<Pending | null>(null);
  const [declined, setDeclined] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [replaceThen, setReplaceThen] = useState<(() => void) | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [online, setOnline] = useState(() => services.isOnline());
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reviewRoute = (m: string): Route => (onboarding ? { name: 'onboarding', step: 3, month: m as YearMonth, manual: false } : { name: 'review', month: m as YearMonth, manual: false });

  useEffect(() => {
    const update = () => setOnline(services.isOnline());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [services]);

  useEffect(() => {
    if (panel !== null) panelRef.current?.focus();
  }, [panel]);

  // US-E2-06/AC9: the retry countdown, held in memory only.
  useEffect(() => {
    if (countdown <= 0) return undefined;
    const id = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const showPanel = (p: Panel) => {
    setPanel(p);
    setCountdown(p.kind === 'ai' && p.retryAfterSec !== undefined ? p.retryAfterSec : 0);
  };

  const withReplaceCheck = (run: () => void) => {
    if (storeRef.current.menus[month]?.confirmed) setReplaceThen(() => run);
    else run();
  };

  const runExtraction = useCallback(
    async (p: Pending) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase('extracting');
      const result = await services.extractor.extract({ pdf: p.bytes, targetMonth: month }, controller.signal);
      if (controller.signal.aborted) return;
      abortRef.current = null;
      setPhase('idle');
      const calls = result.ok ? result.meta.providerCalls : result.providerCalls;
      let next = addAiUsage(storeRef.current, now(), calls);
      if (!result.ok) {
        if (next !== storeRef.current) await commit(next);
        showPanel(aiPanel(result.error, result.retryAfterSec));
        return;
      }
      const menu = stampOrigin(result.menu, p.origin);
      if (menu === null) {
        if (next !== storeRef.current) await commit(next);
        showPanel(aiPanel('MALFORMED_OUTPUT'));
        return;
      }
      next = recordExtraction(next, menu, now(), p.origin.url);
      if (await commit(next)) navigate(reviewRoute(menu.targetMonth));
      else showPanel({ kind: 'ai', message: 'toast.saveFailed', retry: true, upload: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services, month, now, commit],
  );

  const continueWith = async (p: Pending) => {
    setPending(p);
    rememberSessionPdf(p.sha256, p.bytes);
    // US-E2-07/AC1 (BR-10): a PDF already read reopens its stored reading, 0 AI calls.
    const known = findExtractionBySha(storeRef.current, p.sha256, month);
    if (known !== null) {
      if (await commit(recordExtraction(storeRef.current, known, now()))) {
        // Read once by the review screen (in memory only).
        setFlash({ sameFile: true });
        navigate(reviewRoute(known.targetMonth));
      }
      return;
    }
    if (needsConsent(storeRef.current)) {
      setConsentFor(p);
      return;
    }
    await runExtraction(p);
  };

  const startUrl = () => {
    setPanel(null);
    setDeclined(false);
    if (!isValidMenuUrl(url.trim())) {
      setUrlError(true);
      return;
    }
    setUrlError(false);
    withReplaceCheck(() => {
      void (async () => {
        const target = url.trim();
        setPhase('fetching');
        const r = await services.pdfSource.fromUrl(target);
        setPhase('idle');
        if (!r.ok) {
          setFailedUrl(target);
          showPanel({ kind: 'fetch', message: FETCH_ERRORS[r.error], urlKept: r.error !== 'NOT_A_PDF' && r.error !== 'TOO_LARGE' && r.error !== 'EMPTY' });
          return;
        }
        await continueWith({ bytes: r.bytes, sha256: r.sha256, origin: { kind: 'url', url: target } });
      })();
    });
  };

  const startFile = (file: File) => {
    setPanel(null);
    setDeclined(false);
    setFilename(file.name);
    withReplaceCheck(() => {
      void (async () => {
        const r = await services.pdfSource.fromFile(file);
        if (!r.ok) {
          showPanel({ kind: 'file', message: FILE_ERRORS[r.error] });
          return;
        }
        // US-E2-02/AC2: an upload after a failed URL keeps that URL as the source reference.
        const keepUrl = failedUrl !== null && isValidMenuUrl(failedUrl) ? { url: failedUrl } : {};
        await continueWith({ bytes: r.bytes, sha256: r.sha256, origin: { kind: 'upload', filename: r.filename ?? file.name, ...keepUrl } });
      })();
    });
  };

  const cancelRunning = () => {
    const controller = abortRef.current;
    abortRef.current = null;
    controller?.abort();
    setPhase('idle');
    // US-E2-04/AC8: nothing from this action is stored except aiUsage; the request had reached
    // the proxy, so call 1 is counted (the proxy makes no further call once the client leaves).
    void commit(addAiUsage(storeRef.current, now(), 1));
  };

  const manualRoute: Route = onboarding ? { name: 'onboarding', step: 3, month, manual: true } : { name: 'review', month, manual: true };
  const uploadPrimary = panel !== null;
  const disabled = !online || phase !== 'idle';

  if (phase === 'extracting') {
    return (
      <div className="progress" data-testid="import-progress">
        <div className="progress__illus" aria-hidden="true" />
        <h1 className="progress__title" role="status" tabIndex={-1}>
          {t('import.progress')}
        </h1>
        <p className="field__hint">{t('import.progress.sub')}</p>
        <div className="progress__bar" aria-hidden="true">
          <span />
        </div>
        <button type="button" className="btn btn--text" data-testid="import-cancel" onClick={cancelRunning}>
          {t('import.progress.cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className="import" data-testid="screen-import">
      <h2 className="section-title">{t('import.title')}</h2>
      <p>{t('import.lead')}</p>
      {!online && (
        <Banner variant="danger" testId="banner-offline">
          {t('import.err.offline')}
        </Banner>
      )}

      <div className="field">
        <label className="field__label" htmlFor="import-month">
          {t('import.month.label')}
        </label>
        <select id="import-month" className="input select" value={month} onChange={(e) => setMonth(e.target.value as YearMonth)} data-testid="import-month">
          {months.options.map((m) => (
            <option key={m} value={m}>
              {formatMonth(t, lang, m)}
            </option>
          ))}
        </select>
      </div>

      <div className={`field${urlError ? ' has-error' : ''}`}>
        <label className="field__label" htmlFor="import-url">
          {t('import.url.label')}
        </label>
        <input
          id="import-url"
          className="input"
          type="url"
          inputMode="url"
          value={url}
          placeholder={t('import.url.placeholder')}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => urlError && setUrlError(!isValidMenuUrl(url.trim()))}
          aria-invalid={urlError || undefined}
          aria-describedby={urlError ? 'import-url-hint import-url-error' : 'import-url-hint'}
          disabled={!online}
          data-testid="input-url"
          autoComplete="url"
        />
        <p id="import-url-hint" className="field__hint">
          {t('import.url.hint')}
        </p>
        {urlError && <FieldError id="import-url-error" text={t('import.url.error')} testId="input-url-error" />}
      </div>

      {panel !== null && (
        <div ref={panelRef} tabIndex={-1} className="panel-error">
          <Banner variant="danger" testId="import-error">
            <p className="banner__body">{t(panel.message)}</p>
            {panel.kind === 'fetch' && panel.urlKept && <p className="banner__body">{t('import.err.urlKept')}</p>}
            {panel.kind === 'ai' && (
              <div className="banner__actions">
                {panel.retry && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    data-testid="import-error-retry"
                    aria-disabled={countdown > 0 || undefined}
                    onClick={() => {
                      if (countdown > 0 || pending === null) return;
                      setPanel(null);
                      // US-E2-07/AC2: 「もう一度」 is a new action with its own budget of 2 calls.
                      void runExtraction(pending);
                    }}
                  >
                    {countdown > 0 ? t('common.retryIn', { s: countdown }) : t('common.retry')}
                  </button>
                )}
                <p className="field__sublabel">{t('import.err.otherPaths')}</p>
              </div>
            )}
          </Banner>
        </div>
      )}
      {declined && (
        <Banner variant="info" testId="banner-consent-declined">
          {t('consent.declined')}
        </Banner>
      )}

      <div className="import__actions">
        <button type="button" className={`btn ${uploadPrimary ? 'btn--secondary' : 'btn--primary'} btn--block`} data-testid="import-submit" disabled={disabled} aria-busy={phase === 'fetching' || undefined} onClick={startUrl}>
          {phase === 'fetching' ? t('import.progress.fetching') : t('import.submit')}
        </button>
        <p className="divider">{t('import.or')}</p>
        {!(panel?.kind === 'ai' && !panel.upload) && (
          <label className={`btn ${uploadPrimary ? 'btn--primary' : 'btn--secondary'} btn--block file-button${disabled ? ' is-disabled' : ''}`}>
            <input
              type="file"
              accept="application/pdf"
              className="visually-hidden"
              data-testid="import-upload"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file !== undefined) startFile(file);
              }}
            />
            {t('import.upload')}
          </label>
        )}
        {filename !== null && <p className="field__hint">{t('import.upload.selected', { filename })}</p>}
      </div>

      <section className="infobox" aria-labelledby="import-privacy-title">
        <h3 id="import-privacy-title" className="infobox__title">
          {t('import.privacy.title')}
        </h3>
        <p>{t('import.privacy.body')}</p>
        <button type="button" className="btn btn--text" data-testid="import-privacy-more" onClick={() => setShowTerms(true)}>
          {t('import.privacy.more')}
        </button>
      </section>

      <div className="text-actions">
        <button type="button" className={`btn ${declined ? 'btn--primary' : 'btn--text'}`} data-testid="import-manual" onClick={() => navigate(manualRoute)}>
          {t('import.manual')}
        </button>
        {onboarding && (
          <button type="button" className="btn btn--text" data-testid="import-later" onClick={() => navigate({ name: 'calendar', month: null })}>
            {t('import.later')}
          </button>
        )}
      </div>

      {consentFor !== null && (
        <ConsentDialog
          onAccept={() => {
            const p = consentFor;
            setConsentFor(null);
            void (async () => {
              if (await commit(giveConsent(storeRef.current, now()))) await runExtraction(p);
            })();
          }}
          onDecline={() => {
            setConsentFor(null);
            setDeclined(true);
          }}
        />
      )}
      {showTerms && <ConsentDialog readOnly onAccept={() => setShowTerms(false)} onDecline={() => setShowTerms(false)} />}
      {replaceThen !== null && (
        <Dialog
          name="replace-menu"
          title={t('import.replace.title', { m: monthLabel(t, lang, month) })}
          body={<p>{t('import.replace.body', { m: monthLabel(t, lang, month) })}</p>}
          confirmLabel={t('import.replace.confirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            const run = replaceThen;
            setReplaceThen(null);
            run();
          }}
          onCancel={() => setReplaceThen(null)}
        />
      )}
    </div>
  );
}

/** `{m}` in copy: ja month number (「11」→「11月」 in the sentence), en month name. */
export function monthLabel(t: ReturnType<typeof useApp>['t'], lang: 'ja' | 'en', month: string): string {
  const n = Number(month.slice(5, 7));
  if (lang === 'ja') return String(n);
  return formatMonth(t, lang, month as YearMonth).replace(/\s\d{4}$/, '');
}

/** US-E2-08/AC1–AC4: the free-tier notice, before the first AI reading (or read-only from 「くわしく見る」). */
export function ConsentDialog({ onAccept, onDecline, readOnly = false }: { onAccept: () => void; onDecline: () => void; readOnly?: boolean }) {
  const { t } = useApp();
  const body = (
    <div className="consent__text">
      <p>{t('consent.p1')}</p>
      <p>{t('consent.p2')}</p>
      <p>{t('consent.p3')}</p>
      <p>{t('consent.p4')}</p>
      <p>
        <a href={CONSENT_TERMS_URL} target="_blank" rel="noopener noreferrer" data-testid="consent-link">
          {t('consent.link')}
          <span className="visually-hidden">{t('common.newWindow')}</span>
        </a>
      </p>
    </div>
  );
  if (readOnly) {
    return <Dialog name="consent" title={t('consent.title')} body={body} confirmLabel={t('common.close')} cancelLabel={t('common.close')} onConfirm={onAccept} onCancel={onDecline} />;
  }
  return (
    <div data-testid="consent-dialog">
      <Dialog name="consent" title={t('consent.title')} body={body} confirmLabel={t('consent.accept')} cancelLabel={t('consent.decline')} confirmTestId="consent-accept" cancelTestId="consent-decline" onConfirm={onAccept} onCancel={onDecline} />
    </div>
  );
}

