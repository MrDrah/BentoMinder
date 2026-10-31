// Plan-date picker (design/components.md 5.3, US-E6-05/AC2-AC4): the dates a recipe can be planned
// on, from today, then the same confirm as US-E5-03/AC2 (CONFIRM_RECIPE or CHANGE_RECIPE).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createDayViewer } from '../../domain/calendar/day-view.ts';
import { plannableDates } from '../../domain/recommend/views.ts';
import type { LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { useApp, useStore } from '../app-store.tsx';
import { DECISION_KEYS } from '../calendar/labels.ts';
import { useFocusTrap } from '../hooks.ts';
import { useConfirmRecipe } from './hooks.ts';

export function PlanPicker({ recipeId, onClose }: { recipeId: string; onClose: () => void }) {
  const { t, state, today, services } = useApp();
  const store = useStore();
  const lang = state.language;
  const { busyId, confirm } = useConfirmRecipe();
  const [picked, setPicked] = useState<LocalDate | null>(null);
  const titleId = useId();
  const headRef = useRef<HTMLHeadingElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const viewer = useMemo(() => createDayViewer(services.dictionary), [services.dictionary]);
  const dates = useMemo(() => plannableDates(store, today, viewer), [store, today, viewer]);
  useFocusTrap(boxRef, true, onClose);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    headRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  return (
    <>
      <div className="sheet-scrim" aria-hidden="true" onClick={onClose} data-testid="plan-pick-scrim" />
      <div ref={boxRef} className="picker" role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="plan-pick">
        <h2 id={titleId} ref={headRef} tabIndex={-1} className="picker__title">
          {t('recipe.planPick.title')}
        </h2>
        {dates.length === 0 ? (
          <p data-testid="plan-pick-empty">{t('recipe.planPick.empty')}</p>
        ) : (
          <fieldset className="picker__list">
            <legend className="field__hint">{t('recipe.planPick.lead')}</legend>
            {dates.map(({ date, state: decision }) => (
              <label key={date} className={`override-radio${picked === date ? ' is-checked' : ''}`}>
                <input type="radio" name="plan-date" value={date} checked={picked === date} onChange={() => setPicked(date)} data-testid={`plan-pick-option-${date}`} />
                {t('recipe.planPick.option', { date: formatDate(t, lang, date), decision: decision === null ? '' : t(DECISION_KEYS[decision]) })}
              </label>
            ))}
          </fieldset>
        )}
        <div className="picker__actions">
          {dates.length > 0 && (
            <button
              type="button"
              className="btn btn--primary"
              data-testid="plan-pick-confirm"
              disabled={picked === null || busyId !== null}
              aria-busy={busyId !== null || undefined}
              onClick={() => picked !== null && void confirm(picked, recipeId)}
            >
              {busyId !== null ? t('rec.saving') : t('rec.confirm')}
            </button>
          )}
          <button type="button" className="btn btn--secondary" data-testid="plan-pick-close" onClick={onClose}>
            {dates.length > 0 ? t('common.cancel') : t('common.close')}
          </button>
        </div>
      </div>
    </>
  );
}
