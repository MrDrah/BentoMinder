// Menu review / manual entry (design/components.md §6.8, flows F3; US-E3-01…E3-04, US-E2-05/AC4–AC6).
// The draft is in memory only: leaving asks first and discards edits (OQ-23); confirming stores
// the ConfirmedMenu (BR-12). All rules are in src/domain/menu/review.ts.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  acceptField,
  addItem,
  canAddItem,
  confirmBlock,
  draftFromExtraction,
  editItemText,
  emptyDraft,
  fieldErrors,
  fieldIds,
  markNoLunch,
  NO_LUNCH_REASONS,
  removeItem,
  restoreLunch,
  reviewRows,
  setNoLunchReason,
  setNoLunchText,
  toConfirmedMenu,
  uncertainFields,
  type DraftDay,
  type MenuWarning,
  type NoLunchReason,
  type ReviewDraft,
  type UncertainField,
} from '../../domain/menu/review.ts';
import { storeConfirmedMenu } from '../../domain/menu/store-ops.ts';
import type { Verification } from '../../domain/schema/extracted-menu.ts';
import { stripDisambiguator } from '../../domain/text/normalize.ts';
import { toJstTimestamp, type LocalDate, type YearMonth } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { createTranslator, type MessageKey } from '../../i18n/index.ts';
import { useApp, useStore } from '../app-store.tsx';
import { Banner, BannerIcon, Dialog, FieldError } from '../components/Controls.tsx';
import { navigate, setLeaveGuard, type Route } from '../router.ts';
import { monthLabel } from './ImportScreen.tsx';
import { sessionPdfUrl } from '../session.ts';

const REASON_KEYS: Record<NoLunchReason, MessageKey> = {
  'bento-day': 'review.noLunch.bentoDay',
  'no-lunch': 'review.noLunch.noLunch',
  closed: 'review.noLunch.closed',
  unknown: 'review.noLunch.unknown',
};
const WARNING_KEYS: Record<MenuWarning, MessageKey> = {
  'month-mismatch': 'review.warn.monthMismatch',
  'pages-unreadable': 'review.warn.pagesUnreadable',
  'layout-unrecognised': 'review.warn.layout',
  'partial-extraction': 'review.warn.partial',
};
const tJa = createTranslator('ja');
/** US-E3-02/AC6: the wording defaults to the reason's (Japanese) label without its bracketed part. */
const defaultWording = (reason: NoLunchReason) => stripDisambiguator(tJa(REASON_KEYS[reason]));

function reasonKey(reason: Verification['reason']): MessageKey {
  switch (reason) {
    case 'low-legibility':
      return 'review.reason.lowLegibility';
    case 'weekday-mismatch':
      return 'review.reason.weekdayMismatch';
    case 'duplicate-date':
      return 'review.reason.duplicateDate';
    case 'ambiguous-term':
      return 'review.reason.ambiguous';
    default:
      return 'review.reason.other';
  }
}

export function ReviewScreen({ month, manual, onboarding }: { month: YearMonth; manual: boolean; onboarding: boolean }) {
  const { t, state, now, commit, showToast, flash, setFlash } = useApp();
  const store = useStore();
  const lang = state.language;
  const menuMonth = store.menus[month];
  const extraction = manual ? undefined : menuMonth?.extractions.find((e) => e.id === menuMonth.pendingReviewExtractionId);
  const [draft, setDraft] = useState<ReviewDraft | null>(() => (manual ? emptyDraft(month) : extraction === undefined ? null : draftFromExtraction(extraction)));
  const [sameFile] = useState(() => flash.sameFile === true);
  const [confirmAsk, setConfirmAsk] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<Route | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cursor = useRef<string | null>(null);

  useEffect(() => {
    if (flash.sameFile === true) setFlash({});
  }, [flash, setFlash]);

  useEffect(() => {
    if (draft === null) {
      navigate(onboarding ? { name: 'onboarding', step: 2, month: null, manual: false } : { name: 'import' });
      return undefined;
    }
    // US-E3-03/AC5: leaving asks first.
    setLeaveGuard((target) => {
      setLeaveTarget(target);
      return false;
    });
    return () => setLeaveGuard(null);
  }, [draft === null, onboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  const uncertain = useMemo(() => (draft === null ? [] : uncertainFields(draft)), [draft]);
  const errors = useMemo(() => (draft === null ? new Map() : fieldErrors(draft)), [draft]);
  const block = draft === null ? 'empty' : confirmBlock(draft);
  if (draft === null) return null;

  const update = (next: ReviewDraft) => setDraft(next);
  const nextUncertain = () => {
    const ids = uncertain.map((f) => f.id);
    const active = document.activeElement?.closest('[data-field]')?.getAttribute('data-field') ?? cursor.current;
    const at = active === null ? -1 : ids.indexOf(active);
    const target = ids[(at + 1) % ids.length];
    cursor.current = target ?? null;
    if (target !== undefined) document.querySelector<HTMLElement>(`[data-field="${target}"] input, [data-field="${target}"] button`)?.focus();
  };

  const doConfirm = async () => {
    setBusy(true);
    const result = toConfirmedMenu(draft, { confirmedAt: toJstTimestamp(now()), previous: store.menus[month]?.confirmed ?? null });
    if (!result.ok) {
      setBusy(false);
      setSaveError(t('toast.saveFailed'));
      return;
    }
    const ok = await commit(storeConfirmedMenu(store, result.menu, now()));
    setBusy(false);
    if (!ok) {
      setSaveError(t('toast.saveFailed'));
      showToast(t('toast.saveFailed'));
      return;
    }
    setConfirmAsk(false);
    showToast(t('review.done', { m: monthLabel(t, lang, month) }));
    navigate({ name: 'calendar', month }, { force: true });
  };

  const onConfirmClick = () => {
    if (block !== null) return;
    if (uncertain.length > 0) setConfirmAsk(true);
    else void doConfirm();
  };

  const blockHint = block === 'errors' ? t('review.confirm.hasErrors') : block === 'empty' ? t('review.confirm.emptyManual') : null;
  const sourceUrl = extraction?.source.url;
  const pdfHref = extraction === undefined ? undefined : (sessionPdfUrl(extraction.source.sha256 ?? '') ?? sourceUrl);

  return (
    <div className="review" data-testid="screen-review">
      <h2 className="section-title">{t(draft.mode === 'manual' ? 'review.manual.title' : 'review.title', { m: monthLabel(t, lang, month) })}</h2>
      <p>{t('review.lead')}</p>
      {sameFile && (
        <Banner variant="info" title={t('import.sameFile')} testId="banner-same-file">
          <p className="banner__body">{t('import.sameFile.sub')}</p>
        </Banner>
      )}
      {draft.warnings.map((w) => (
        <Banner key={w} variant="warning" testId={`banner-review-${w}`} live={false}>
          {t(WARNING_KEYS[w], { m: monthLabel(t, lang, month) })}
        </Banner>
      ))}

      <div className="review__summary" data-testid="review-summary">
        <BannerIcon variant={uncertain.length > 0 ? 'warning' : 'success'} />
        <span role="status">{uncertain.length > 0 ? t('review.uncertain.summary', { n: uncertain.length }) : t('review.uncertain.none')}</span>
        {uncertain.length > 0 && (
          <button type="button" className="btn btn--secondary btn--small" data-testid="review-next-uncertain" onClick={nextUncertain}>
            {t('review.uncertain.next')}
          </button>
        )}
        {pdfHref !== undefined && (
          <a className="btn btn--text btn--small" href={pdfHref} target="_blank" rel="noopener noreferrer" data-testid="review-open-pdf">
            {t('review.openPdf')}
            <span className="visually-hidden">{t('common.newWindow')}</span>
          </a>
        )}
      </div>
      <p className="field__hint">{t('review.day.weekendNote')}</p>

      <div className="review__rows">
        {reviewRows(draft).map(({ date, day }) => (
          <DayRow key={date} date={date} day={day} draft={draft} update={update} uncertain={uncertain} errors={errors} />
        ))}
      </div>

      {draft.outOfMonth.length > 0 && (
        <details className="review__outside" data-testid="review-out-of-month">
          <summary>{t('review.outOfMonth.title')}</summary>
          <ul>
            {draft.outOfMonth.map((e) => {
              const date = (e.kind === 'lunch-day' ? e.day.date : e.noLunchDay.date) as LocalDate;
              const text = e.kind === 'lunch-day' ? e.day.items.map((i) => i.text).join('、') : e.noLunchDay.originalText;
              return (
                <li key={`${date}-${e.kind}`}>
                  {formatDate(t, lang, date)} <span lang="ja">{text}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <div className="sticky-footer">
        <button
          type="button"
          className={`btn btn--primary btn--block${block !== null ? ' is-disabled' : ''}`}
          data-testid="review-confirm"
          aria-disabled={block !== null || undefined}
          aria-describedby={blockHint === null ? undefined : 'review-confirm-hint'}
          aria-busy={busy || undefined}
          onClick={onConfirmClick}
        >
          {t('review.confirm')}
        </button>
        {blockHint !== null && (
          <p id="review-confirm-hint" className="field__hint" data-testid="review-confirm-hint">
            {blockHint}
          </p>
        )}
      </div>

      {confirmAsk && (
        <Dialog
          name="uncertain"
          title={t('review.uncertainDialog.title', { n: uncertain.length })}
          confirmLabel={t('review.uncertainDialog.confirm')}
          cancelLabel={t('review.uncertainDialog.back')}
          busy={busy}
          error={saveError}
          onConfirm={() => void doConfirm()}
          onCancel={() => {
            setSaveError(null);
            setConfirmAsk(false);
          }}
        />
      )}
      {leaveTarget !== null && (
        <Dialog
          name="leave-review"
          title={t('review.leave.title')}
          body={<p>{t('review.leave.body')}</p>}
          confirmLabel={t('review.leave.confirm')}
          cancelLabel={t('review.leave.stay')}
          onConfirm={() => {
            const target = leaveTarget;
            setLeaveTarget(null);
            navigate(target, { force: true });
          }}
          onCancel={() => setLeaveTarget(null)}
        />
      )}
    </div>
  );
}

interface RowProps {
  date: LocalDate;
  day: DraftDay | null;
  draft: ReviewDraft;
  update: (d: ReviewDraft) => void;
  uncertain: UncertainField[];
  errors: Map<string, string>;
}

function UncertainNote({ field, onAccept }: { field: UncertainField; onAccept: () => void }) {
  const { t } = useApp();
  return (
    <div className="uncertain-note" id={`reason-${field.id}`}>
      <span className="tag tag--warning" data-testid={`review-tag-${field.id}`}>
        <BannerIcon variant="warning" />
        {t('review.uncertain.tag')}
      </span>
      <span>{t(reasonKey(field.reason), { printed: field.printed ?? '' })}</span>
      <button type="button" className="btn btn--text btn--small" data-testid={`review-accept-${field.id}`} onClick={onAccept}>
        {t('review.accept')}
      </button>
    </div>
  );
}

function DayRow({ date, day, draft, update, uncertain, errors }: RowProps) {
  const { t, state } = useApp();
  const lang = state.language;
  const label = formatDate(t, lang, date);
  const u = (id: string) => uncertain.find((f) => f.id === id);
  const dayFlag = u(fieldIds.day(date));
  const inputRef = useRef<Record<number, HTMLInputElement | null>>({});
  const accept = (id: string) => update(acceptField(draft, id));

  if (day !== null && day.noLunch !== null) {
    const n = day.noLunch;
    const textId = fieldIds.noLunch(date);
    const textError = errors.get(textId) !== undefined;
    const flag = u(textId);
    return (
      <fieldset className={`review-day is-no-lunch${flag ? ' is-uncertain' : ''}`} data-testid={`review-day-${date}`} data-field={flag ? textId : undefined}>
        <legend className="review-day__date">{label}</legend>
        <p className="review-day__state">{t('review.day.noLunch')}</p>
        {flag && <UncertainNote field={flag} onAccept={() => accept(textId)} />}
        <fieldset className="field">
          <legend className="field__sublabel">{t('review.noLunch.reason')}</legend>
          <div className="radios">
            {NO_LUNCH_REASONS.map((reason) => (
              <label key={reason} className={`radio${n.reason === reason ? ' is-checked' : ''}`}>
                <input
                  type="radio"
                  name={`nolunch-${date}`}
                  checked={n.reason === reason}
                  onChange={() => update(setNoLunchReason(draft, date, reason, defaultWording(reason)))}
                  data-testid={`radio-nolunch-${date}-${reason}`}
                />
                {t(REASON_KEYS[reason])}
              </label>
            ))}
          </div>
        </fieldset>
        <div className={`field${textError ? ' has-error' : ''}`}>
          <label className="field__sublabel" htmlFor={`nolunch-text-${date}`}>
            {t('review.noLunch.text')}
          </label>
          <input
            id={`nolunch-text-${date}`}
            className="input"
            value={n.text}
            lang="ja"
            onChange={(e) => update(setNoLunchText(draft, date, e.target.value))}
            aria-invalid={textError || undefined}
            data-testid={`review-nolunch-text-${date}`}
          />
          {textError && <FieldError id={`nolunch-text-${date}-error`} text={t('review.confirm.hasErrors')} testId={`review-nolunch-text-${date}-error`} />}
        </div>
        {day.items.length > 0 && <p className="field__hint">{t('review.noLunch.hiddenDishes', { n: day.items.length })}</p>}
        <button type="button" className="btn btn--text" data-testid={`review-restore-${date}`} onClick={() => update(restoreLunch(draft, date))}>
          {t('review.noLunch.restore')}
        </button>
      </fieldset>
    );
  }

  const items = day?.items ?? [];
  const canAdd = canAddItem(day);
  const allergenFlag = u(fieldIds.allergen(date));
  return (
    <fieldset className={`review-day${dayFlag ? ' is-uncertain' : ''}`} data-testid={`review-day-${date}`} data-field={dayFlag ? dayFlag.id : undefined}>
      <legend className="review-day__date">
        {label}
        {day?.printedDateText !== undefined && day.printedDateText !== null && (
          <span className="review-day__printed" lang="ja">
            {' '}
            {day.printedDateText}
          </span>
        )}
      </legend>
      {dayFlag && <UncertainNote field={dayFlag} onAccept={() => accept(dayFlag.id)} />}
      {items.length === 0 && <p className="review-day__state">{t('review.day.empty')}</p>}
      <ul className="review-day__items">
        {items.map((item, i) => {
          const id = fieldIds.item(date, i);
          const flag = u(id);
          const error = errors.get(id) !== undefined;
          const describedBy = [flag ? `reason-${id}` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
          return (
            <li key={i} className={`dish${flag ? ' is-uncertain' : ''}${error ? ' has-error' : ''}`} data-field={flag ? id : undefined}>
              <div className="dish__row">
                <label className="visually-hidden" htmlFor={`dish-${id}`}>
                  {t('review.dish.label')}
                </label>
                <input
                  id={`dish-${id}`}
                  ref={(el) => {
                    inputRef.current[i] = el;
                  }}
                  className="input"
                  lang="ja"
                  value={item.text}
                  onChange={(e) => update(editItemText(draft, date, i, e.target.value))}
                  aria-invalid={error || undefined}
                  aria-describedby={describedBy === '' ? undefined : describedBy}
                  data-testid={`review-dish-${date}-${i}`}
                  data-verification={item.verification.status}
                />
                {item.kind === 'snack' && <span className="tag">{t('review.dish.snack')}</span>}
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={t('review.dish.remove', { dish: item.text })}
                  data-testid={`review-remove-${date}-${i}`}
                  onClick={() => update(removeItem(draft, date, i))}
                >
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {flag && (
                <div data-testid={`review-dish-${date}-${i}-uncertain`}>
                  <UncertainNote field={flag} onAccept={() => accept(id)} />
                </div>
              )}
              {error && <FieldError id={`${id}-error`} text={t('review.dish.error')} testId={`review-dish-${date}-${i}-error`} />}
            </li>
          );
        })}
      </ul>
      <div className="review-day__actions">
        <button
          type="button"
          className={`btn btn--secondary btn--small${canAdd ? '' : ' is-disabled'}`}
          aria-disabled={!canAdd || undefined}
          aria-describedby={canAdd ? undefined : `add-hint-${date}`}
          data-testid={`review-add-${date}`}
          onClick={() => {
            if (!canAdd) return;
            update(addItem(draft, date));
            setTimeout(() => inputRef.current[items.length]?.focus(), 0);
          }}
        >
          {t('review.dish.add')}
        </button>
        {!canAdd && (
          <span id={`add-hint-${date}`} className="field__hint" data-testid={`review-add-limit-${date}`}>
            {t('review.dish.addLimit')}
          </span>
        )}
        <button type="button" className="btn btn--text btn--small" data-testid={`review-nolunch-${date}`} onClick={() => update(markNoLunch(draft, date, defaultWording('no-lunch')))}>
          {t('review.noLunch.toggle')}
        </button>
      </div>
      {day !== null && items.length > 0 && (
        <div className="review-day__meta">
          <p className="field__sublabel">{t('review.ingredients')}</p>
          {day.ingredientsStatus === 'listed' ? (
            <ul className="inline-list" lang="ja">
              {(day.ingredients ?? []).map((ing, i) => {
                const flag = u(fieldIds.ingredient(date, i));
                return (
                  <li key={i} data-field={flag ? flag.id : undefined}>
                    {ing.text}
                    {flag && <UncertainNote field={flag} onAccept={() => accept(flag.id)} />}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="field__hint">{t(day.ingredientsStatus === 'unreadable' ? 'review.ingredients.unreadable' : 'review.ingredients.notListed')}</p>
          )}
          <p className="field__sublabel">{t('review.allergens')}</p>
          <p className="field__hint" data-field={allergenFlag ? allergenFlag.id : undefined}>
            {allergenText(day, t)}
          </p>
          {allergenFlag && <UncertainNote field={allergenFlag} onAccept={() => accept(allergenFlag.id)} />}
          {day.notes.length > 0 && (
            <p className="field__hint" lang="ja">
              {day.notes.join('、')}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}

function allergenText(day: DraftDay, t: ReturnType<typeof useApp>['t']): string {
  const a = day.allergenDeclaration;
  // BR-08: never summarised as "none"; declared-none quotes the sheet.
  if (a.status === 'declared') return a.rawText ?? a.allergenIds.join('、');
  if (a.status === 'declared-none') return t('review.allergens.declaredNone', { raw: a.rawText ?? '' });
  if (a.status === 'unreadable') return t('review.allergens.unreadable');
  return t('review.allergens.notDeclared');
}
