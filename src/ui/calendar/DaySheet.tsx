// Day sheet (design/components.md §1.12, §3): the menu, the assessment with its explanation and
// the manual override, and the plan with exactly the actions the state machine allows (BR-02).
// Choosing homemade bento opens the recommendation view and writes nothing (US-E5-03/AC1).
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { OVERRIDE_STATES } from '../../domain/schema/menu.ts';
import { clearOverride, setOverride, type OverrideState } from '../../domain/assessment/override.ts';
import type { DayAction, DayView } from '../../domain/calendar/day-view.ts';
import { applyDecisionEvent } from '../../domain/decision/apply.ts';
import type { DecisionEvent } from '../../domain/decision/decision.ts';
import type { ExtractedDay } from '../../domain/schema/index.ts';
import type { LocalDate } from '../../domain/time/jst.ts';
import { formatDate, formatDateNoWeekday } from '../../i18n/format.ts';
import type { MessageKey } from '../../i18n/index.ts';
import { useApp, useStore } from '../app-store.tsx';
import { Banner, Dialog } from '../components/Controls.tsx';
import { AssessMark, BentoIcon } from '../components/Marks.tsx';
import { useFocusTrap, type SheetMode } from '../hooks.ts';
import { navigate, toHash } from '../router.ts';
import { useDayViewer } from './use-day-viewer.ts';
import { DECISION_KEYS, explanationText, recipeName, STATE_KEYS } from './labels.ts';

const OVERRIDE_KEYS: Record<OverrideState, MessageKey> = { 'likely-enjoyable': 'state.likely', 'mixed-uncertain': 'state.mixed', 'low-preference': 'state.low' };

export function DaySheet({ date, mode, onClose }: { date: LocalDate; mode: SheetMode; onClose: () => void }) {
  const { t, state, today } = useApp();
  const store = useStore();
  const viewer = useDayViewer();
  const lang = state.language;
  const v = viewer(store, date, today);
  const headId = useId();
  const headRef = useRef<HTMLHeadingElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const modal = mode !== 'panel';
  useFocusTrap(sheetRef, modal, onClose);

  // The header takes focus when a date opens (a11y §4); the cell gets it back when the sheet closes.
  useEffect(() => {
    headRef.current?.focus();
  }, [date]);

  const body = (
    <>
      <div className="sheet__head">
        <h2 id={headId} ref={headRef} tabIndex={-1} className="sheet__title" data-testid="day-sheet-title">
          {formatDate(t, lang, date)}
        </h2>
        {modal && (
          <button type="button" className="iconbtn" data-testid="day-sheet-close" aria-label={t('common.close')} onClick={onClose}>
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="sheet__body">
        <SheetContent v={v} />
      </div>
    </>
  );

  if (mode === 'panel') {
    return (
      <section ref={sheetRef} className="sheet sheet--panel" role="region" aria-labelledby={headId} data-testid="day-sheet" data-date={date}>
        {body}
      </section>
    );
  }
  return (
    <>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" data-testid="day-sheet-scrim" />
      <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby={headId} data-testid="day-sheet" data-date={date}>
        <div className="sheet__handle" aria-hidden="true" />
        {body}
      </div>
    </>
  );
}

function Section({ testId, heading, children, innerRef }: { testId?: string; heading?: string; children: ReactNode; innerRef?: RefObject<HTMLElement | null> }) {
  return (
    <section ref={innerRef} className="sheet__section" data-testid={testId}>
      {heading !== undefined && <h3 className="sheet__heading">{heading}</h3>}
      {children}
    </section>
  );
}

function SheetContent({ v }: { v: DayView }) {
  const { t } = useApp();
  const vt = v.type;
  return (
    <>
      <Banners v={v} />
      {(vt.type === 'school' || vt.type === 'snack-only') && <MenuSection v={v} day={vt.day} />}
      {(vt.type === 'no-lunch' || vt.type === 'bento-day') && (
        <Section testId="day-menu">
          <p>{t(vt.type === 'bento-day' ? 'day.bentoDay.body' : 'day.noLunch.body', { originalText: vt.noLunch.originalText })}</p>
          {vt.type === 'bento-day' && (
            <p className="card__body" lang="ja">
              {vt.noLunch.originalText}
            </p>
          )}
        </Section>
      )}
      {vt.type === 'outside' && (
        <Section testId="day-outside-note">
          <p>{t('day.outside')}</p>
        </Section>
      )}
      {vt.type === 'no-menu' && (
        <Section testId="day-outside-note">
          <p>{t('day.noMenu')}</p>
          <a className="btn btn--primary" href={toHash({ name: 'import' })} data-testid="day-import">
            {t('menuCard.import')}
          </a>
        </Section>
      )}
      {vt.type === 'snack-only' && (
        <Section>
          <p data-testid="day-snack-only">{t('day.snackOnly')}</p>
        </Section>
      )}
      {vt.type === 'school' && <AssessmentSection v={v} />}
      <PlanSection v={v} />
      {v.past && (
        <Section>
          <p className="note-row" data-testid="day-past-note">
            {t('day.past')}
          </p>
        </Section>
      )}
    </>
  );
}

function Banners({ v }: { v: DayView }) {
  const { t } = useApp();
  return (
    <>
      {v.conflict && (
        <Section>
          <Banner variant="warning" title={t('day.conflict.flag')} testId="day-banner-conflict" live={false}>
            <p className="banner__body">{t(v.displayed.conflict === 'plan-on-no-lunch' ? 'day.conflict.nowNoLunch' : 'day.conflict.removed')}</p>
            {!v.displayed.needsAck && <p className="banner__body">{t('day.conflict.kept')}</p>}
          </Banner>
        </Section>
      )}
      {v.overrideChanged && (
        <Section>
          <Banner variant="warning" testId="day-banner-changed" live={false}>
            <p className="banner__body">{t('assess.changed')}</p>
          </Banner>
        </Section>
      )}
    </>
  );
}

function MenuSection({ v, day }: { v: DayView; day: ExtractedDay }) {
  const { t, state, services } = useApp();
  const store = useStore();
  const lang = state.language;
  const dict = services.dictionary;
  const verdicts = v.assessment?.matched.itemVerdicts ?? [];
  const lunch = day.items.map((item, i) => ({ item, i })).filter((x) => x.item.kind !== 'snack');
  const snacks = day.items.filter((x) => x.kind === 'snack');
  const profile = store.profile;
  const declared = day.allergenDeclaration;
  const knownAllergens = profile !== null && profile.allergyStatus === 'has-known' ? profile.knownAllergenIds : [];
  const allergenLabel = (id: string) => dict.allergens.find((a) => a.id === id)?.[lang] ?? id;
  const matches = declared.status === 'declared' ? declared.allergenIds.filter((id) => knownAllergens.includes(id)) : [];
  const printed = declared.status === 'declared' ? (declared.rawText ?? declared.allergenIds.map(allergenLabel).join(lang === 'ja' ? '、' : ', ')) : null;
  return (
    <Section testId="day-menu" heading={t('day.menu.heading')}>
      <ul className="day-menu">
        {lunch.map(({ item, i }) => (
          <li key={i} className="day-menu__item">
            <span className={`day-menu__text${verdicts[i] === 'dislike' ? ' is-disliked' : ''}`} lang="ja">
              {item.text}
            </span>
            {verdicts[i] === 'dislike' && <span className="tag tag--low">{t('day.menu.dislikedTag')}</span>}
            {verdicts[i] === 'like' && <span className="tag">{t('day.menu.likedTag')}</span>}
          </li>
        ))}
      </ul>
      {snacks.length > 0 && (
        <>
          <h4 className="sheet__heading">{t('day.menu.snack')}</h4>
          <ul className="day-menu">
            {snacks.map((item, i) => (
              <li key={i} className="day-menu__item" lang="ja">
                {item.text}
              </li>
            ))}
          </ul>
        </>
      )}
      {printed !== null && (
        <p className="card__body">
          {t('day.menu.allergens', { list: '\u0000' }).split('\u0000')[0]}
          <span lang="ja">{printed}</span>
          {t('day.menu.allergens', { list: '\u0000' }).split('\u0000')[1]}
        </p>
      )}
      {matches.length > 0 && (
        <p className="note-row note-row--warning" data-testid="day-banner-allergen">
          {t('day.allergen.match', { allergen: matches.map(allergenLabel).join(lang === 'ja' ? '、' : ', ') })}
        </p>
      )}
      {knownAllergens.length > 0 && (declared.status === 'not-declared' || declared.status === 'unreadable') && (
        <p className="note-row" data-testid="day-allergen-not-declared">
          {t('day.allergen.notDeclared')}
        </p>
      )}
    </Section>
  );
}

function AssessmentSection({ v }: { v: DayView }) {
  const { t, state, today, now, commit, showSaveFailed, services } = useApp();
  const store = useStore();
  const lang = state.language;
  const a = v.assessment;
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState('');
  if (a === null) return null;
  const overridden = a.override !== null;
  const low = a.state === 'low-preference';
  const choose = async (next: OverrideState) => {
    const r = setOverride(store, v.date, next, { today, now: now() });
    if (!r.ok) return;
    if (await commit(r.store)) setLive(t('override.saved', { state: t(STATE_KEYS[next]) }));
    else showSaveFailed();
  };
  const reset = async () => {
    const r = clearOverride(store, v.date, { today, now: now() });
    if (!r.ok) return;
    if (await commit(r.store)) setOpen(false);
    else showSaveFailed();
  };
  return (
    <Section testId="day-assessment" heading={t('day.assess.heading')}>
      <div className={`assess-block${low ? ' is-low' : ''}`}>
        <span className={`assess-chip${low ? ' is-low' : ''}`} data-testid="assess-chip" data-state={a.state}>
          <AssessMark state={a.state} overridden={overridden} />
          {t(STATE_KEYS[a.state])}
        </span>
        {overridden && (
          <span className="tag" data-testid="assess-override-tag">
            {t('assess.override')}
          </span>
        )}
        {a.calculatedState === 'not-assessed' && !overridden ? (
          <>
            <p className="assess-explanation" data-testid="assess-explanation">
              {t('assess.notAssessed')}
            </p>
            <a className="btn btn--text" href={toHash({ name: 'profile' })} data-testid="assess-add-prefs">
              {t('assess.notAssessed.action')}
            </a>
          </>
        ) : overridden ? (
          <>
            <p className="assess-note" data-testid="assess-calc">
              {t('assess.override.calc', { state: t(STATE_KEYS[a.calculatedState]) })}
            </p>
            <p className="assess-explanation" data-testid="assess-explanation">
              {explanationText(t, lang, services.dictionary, a, a.calculatedExplanationKey)}
            </p>
          </>
        ) : (
          <p className="assess-explanation" data-testid="assess-explanation">
            {explanationText(t, lang, services.dictionary, a)}
          </p>
        )}
        <p className="assess-note">{t('assess.basis')}</p>
        {v.canOverride && (
          <>
            <button type="button" className="btn btn--text btn--small" data-testid="override-open" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
              {t('override.button')}
            </button>
            {open && (
              <fieldset className="override-group" data-testid="override-group">
                <legend>{t('override.legend')}</legend>
                {OVERRIDE_STATES.map((s) => (
                  <label key={s} className={`override-radio${a.state === s && overridden ? ' is-checked' : ''}`}>
                    <input type="radio" name="override" checked={overridden && a.state === s} readOnly onChange={() => undefined} onClick={() => void choose(s)} data-testid={`override-option-${s}`} />
                    <AssessMark state={s} />
                    {t(OVERRIDE_KEYS[s])}
                  </label>
                ))}
                <p className="assess-note">{t('override.note')}</p>
                {overridden && (
                  <button type="button" className="btn btn--text btn--small" data-testid="override-reset" onClick={() => void reset()}>
                    {t('override.reset')}
                  </button>
                )}
              </fieldset>
            )}
            <p className="visually-hidden" role="status" data-testid="override-live">
              {live}
            </p>
          </>
        )}
      </div>
    </Section>
  );
}

const SAVED_KEYS = {
  later: 'day.saved.later',
  school: 'day.saved.school',
  cleared: 'day.saved.cleared',
  kept: 'day.saved.kept',
} as const;

function PlanSection({ v }: { v: DayView }) {
  const { t, state, today, now, commit, showToast, showSaveFailed } = useApp();
  const store = useStore();
  const lang = state.language;
  const [ask, setAsk] = useState<'cancel-plan' | 'clear-plan' | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = v.displayed.state;
  const none = v.actions.length === 0 && !v.reservationOffered;
  const record = v.record;
  const date = formatDate(t, lang, v.date);
  const planRef = useRef<HTMLElement>(null);

  // A disabled or replaced button drops focus to BODY, where Escape no longer reaches the sheet
  // (US-E5-01/AC3, US-NF-02/AC1). When the save settles with focus lost, return it to the sheet header.
  useEffect(() => {
    if (busy) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const sheet = planRef.current?.closest('[data-testid="day-sheet"]');
    sheet?.querySelector<HTMLElement>('[data-testid="day-sheet-title"]')?.focus();
  }, [busy, shown]);

  const run =async (event: DecisionEvent, saved: MessageKey | null): Promise<boolean> => {
    if (busy) return false;
    const r = applyDecisionEvent(store, v.date, event, { today, now: now(), recipe: () => undefined });
    if (!r.ok) return false;
    setBusy(true);
    const ok = await commit(r.store);
    setBusy(false);
    if (ok) {
      if (saved !== null) showToast(t(saved, { date }));
    } else showSaveFailed();
    return ok;
  };

  const recommend = () => navigate({ name: 'recommend', date: v.date });
  const act = (action: DayAction) => {
    switch (action) {
      case 'bento':
      case 'plan-bento-day':
      case 'change-recipe':
        return recommend();
      case 'view-recipe':
        return record?.recipeId === undefined ? undefined : navigate({ name: 'recipe', id: record.recipeId, date: v.date });
      case 'later':
        return void run({ type: 'DEFER' }, SAVED_KEYS.later);
      case 'back-to-school':
        return shown === 'homemade-bento-planned' ? setAsk('cancel-plan') : void run({ type: 'SET_SCHOOL_LUNCH' }, SAVED_KEYS.school);
      case 'clear-plan':
        return setAsk('clear-plan');
      case 'keep':
        return void run({ type: 'KEEP_PLAN' }, SAVED_KEYS.kept);
    }
  };
  const label: Record<DayAction, MessageKey> = {
    bento: 'day.action.bento',
    'plan-bento-day': 'day.action.planBentoDay',
    later: 'day.action.later',
    'back-to-school': 'day.action.backToSchool',
    'view-recipe': 'day.action.viewRecipe',
    'change-recipe': 'day.action.changeRecipe',
    'clear-plan': 'day.action.clearPlan',
    keep: 'day.action.keep',
  };
  const sub: Partial<Record<DayAction, MessageKey>> = { bento: 'day.action.bento.sub', later: 'day.action.later.sub' };
  const testId: Record<DayAction, string> = {
    bento: 'day-action-bento',
    'plan-bento-day': 'day-action-plan-bento-day',
    later: 'day-action-later',
    'back-to-school': 'day-action-school',
    'view-recipe': 'day-action-view-recipe',
    'change-recipe': 'day-action-change-recipe',
    'clear-plan': 'day-action-clear-plan',
    keep: 'day-action-keep',
  };
  const primary: DayAction[] = ['bento', 'plan-bento-day', 'view-recipe'];
  const dangerous: DayAction[] = ['back-to-school', 'clear-plan'];

  if (shown === null && none) return null;
  const decisionLabel = shown === null ? '' : t(DECISION_KEYS[shown]);
  const planned = shown === 'homemade-bento-planned' && record !== undefined;
  // Dormant records are not shown (US-E3-05/AC12): a no-lunch or unlisted date has no plan section.
  if (v.type.type !== 'school' && v.type.type !== 'bento-day' && !planned) return null;

  return (
    <Section innerRef={planRef} testId="day-plan" heading={t('day.decision.heading')}>
      <p className="plan-status" data-testid="day-status" data-decision={shown ?? 'none'}>
        {planned ? <BentoIcon filled size={20} /> : shown === 'not-confirmed' ? <BentoIcon filled={false} size={20} /> : null}
        {t('day.decision.current', { decision: decisionLabel })}
      </p>
      {planned && record !== undefined && (
        <div className="recipe-card" data-testid="day-recipe-card">
          <span>{t('recipe.plannedFor', { date: formatDateNoWeekday(t, lang, v.date) })}</span>
          <span className="recipe-card__name" lang={lang === 'en' && record.recipeNameSnapshot?.en !== undefined ? 'en' : 'ja'}>
            {recipeName(record, lang)}
          </span>
        </div>
      )}
      {shown === 'school-lunch-planned' && (
        <p className="note-row" data-testid="day-reservation-note">
          {t('day.reservation.note')}
        </p>
      )}
      {v.reservationOffered && (
        <label className="check">
          <input
            type="checkbox"
            checked={v.reservationDone}
            disabled={busy}
            data-testid="check-reservation"
            onChange={(e) => void run({ type: 'MARK_RESERVATION', done: e.target.checked }, null)}
          />
          <span>
            {t('day.reservation.check')}
            <span className="field__hint" style={{ display: 'block' }}>
              {t('day.reservation.checkHint')}
            </span>
          </span>
        </label>
      )}
      {v.past && v.reservationDone && <p className="card__body">{t('day.reservation.check')}</p>}
      {v.actions.length > 0 && (
        <div className="plan-actions">
          {v.actions.map((action) => (
            <button
              key={action}
              type="button"
              className={`plan-action${primary.includes(action) ? ' plan-action--primary' : ''}${dangerous.includes(action) ? ' plan-action--danger' : ''}`}
              data-testid={testId[action]}
              disabled={busy}
              onClick={() => act(action)}
            >
              {t(label[action])}
              {sub[action] !== undefined && <span className="plan-action__sub">{t(sub[action] as MessageKey)}</span>}
            </button>
          ))}
        </div>
      )}
      {ask === 'cancel-plan' && (
        <Dialog
          name="cancel-plan"
          destructive
          title={t('day.cancel.title', { dateNoWd: formatDateNoWeekday(t, lang, v.date) })}
          body={<p>{t('day.cancel.body')}</p>}
          confirmLabel={t('day.cancel.confirm')}
          cancelLabel={t('common.cancel')}
          busy={busy}
          onConfirm={() => void run({ type: 'SET_SCHOOL_LUNCH' }, SAVED_KEYS.school).then((ok) => ok && setAsk(null))}
          onCancel={() => setAsk(null)}
        />
      )}
      {ask === 'clear-plan' && (
        <Dialog
          name="clear-plan"
          destructive
          title={t('day.clear.title', { dateNoWd: formatDateNoWeekday(t, lang, v.date) })}
          body={<p>{t('day.clear.body')}</p>}
          confirmLabel={t('day.clear.confirm')}
          cancelLabel={t('common.cancel')}
          busy={busy}
          onConfirm={() => void run({ type: 'CLEAR_PLAN' }, SAVED_KEYS.cleared).then((ok) => ok && setAsk(null))}
          onCancel={() => setAsk(null)}
        />
      )}
    </Section>
  );
}
