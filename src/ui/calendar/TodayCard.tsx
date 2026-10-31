// Today card (design/components.md §2.6, flows F11, US-E7-03): today's displayed decision, or the next
// school day when today has none. The Tokyo date comes from the app clock and rolls over every minute.
import { useMemo, type ReactNode } from 'react';
import { todayOverview, type NextDayState, type TodayOverview } from '../../domain/calendar/today.ts';
import { applyDecisionEvent } from '../../domain/decision/apply.ts';
import type { DayView } from '../../domain/calendar/day-view.ts';
import type { LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { useApp, useStore } from '../app-store.tsx';
import { Banner } from '../components/Controls.tsx';
import { AssessMark, BentoIcon } from '../components/Marks.tsx';
import { allergenLabel } from '../recommend/parts.tsx';
import { toHash } from '../router.ts';
import { recipeName, STATE_KEYS } from './labels.ts';
import { useDayViewer } from './use-day-viewer.ts';

function Bowl() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NoLunch() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M5 5l14 14M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const day = (date: LocalDate) => toHash({ name: 'day', date });

export function TodayCard() {
  const { t, state, today, now, commit, showSaveFailed, services } = useApp();
  const store = useStore();
  const viewer = useDayViewer();
  const lang = state.language;
  const overview: TodayOverview = useMemo(() => todayOverview(store, today, viewer), [store, today, viewer]);
  const eyebrow = t('today.label', { date: formatDate(t, lang, today) });
  const dict = services.dictionary;

  const recipeOf = (v: DayView): string => (v.record === undefined ? '' : recipeName(v.record, lang));
  const decisionText = (v: DayView, s: NextDayState): string =>
    s === 'school-lunch-planned' ? t('decision.school') : s === 'not-confirmed' ? t('decision.notConfirmed') : `${t('decision.bento')}：${recipeOf(v)}`;

  const markReservation = async (v: DayView, done: boolean) => {
    const r = applyDecisionEvent(store, v.date, { type: 'MARK_RESERVATION', done }, { today, now: now(), recipe: () => undefined });
    if (r.ok && !(await commit(r.store))) showSaveFailed();
  };

  const card = (kind: string, tile: ReactNode, headline: string, below: ReactNode, chip: ReactNode = null) => (
    <section className="today" data-testid="today-card" data-today={today} data-kind={kind} aria-labelledby="today-headline">
      <p className="today__eyebrow" data-testid="today-eyebrow">
        {eyebrow}
      </p>
      <div className="today__row">
        <span className="today__tile" aria-hidden="true">
          {tile}
        </span>
        <h2 id="today-headline" className="today__headline" tabIndex={-1} data-testid="today-headline">
          {headline}
        </h2>
      </div>
      {chip}
      {below}
    </section>
  );

  if (overview.kind === 'unknown') {
    return card(
      'next-unknown',
      <Bowl />,
      t('today.nextUnknown'),
      <a className="btn btn--text" href={toHash({ name: 'import' })} data-testid="today-cta">
        {t('menuCard.import')}
      </a>,
    );
  }

  if (overview.kind === 'next') {
    const v = overview.view;
    const headline = t('today.next', { date: formatDate(t, lang, v.date), decision: decisionText(v, overview.state) });
    // The whole card opens that day's sheet (no other action).
    return (
      <a className="today today--link" href={day(v.date)} data-testid="today-card" data-today={today} data-kind="next">
        <p className="today__eyebrow" data-testid="today-eyebrow">
          {eyebrow}
        </p>
        <span className="today__row">
          <span className="today__tile" aria-hidden="true">
            <Bowl />
          </span>
          <span id="today-headline" className="today__headline" tabIndex={-1} data-testid="today-headline">
            {headline}
          </span>
        </span>
      </a>
    );
  }

  const v = overview.view;
  const chip =
    v.type.type === 'school' && v.assessment !== null && (overview.state === 'school-lunch-planned' || overview.state === 'not-confirmed') ? (
      <span className={`assess-chip${v.assessment.state === 'low-preference' ? ' is-low' : ''}`} data-testid="today-assess" data-state={v.assessment.state}>
        <AssessMark state={v.assessment.state} />
        {t(STATE_KEYS[v.assessment.state])}
      </span>
    ) : null;

  switch (overview.state) {
    case 'homemade-bento-planned': {
      const id = v.record?.recipeId;
      const known = new Set(store.profile?.knownAllergenIds ?? []);
      const recipe = id === undefined ? undefined : services.library.find((r) => r.id === id);
      const hits = recipe === undefined ? [] : recipe.allergenIds.filter((a) => known.has(a));
      const href = id !== undefined && recipe !== undefined ? toHash({ name: 'recipe', id, date: today }) : day(today);
      return card(
        'homemade-bento-planned',
        <BentoIcon filled size={24} />,
        t('today.planned', { recipe: recipeOf(v) }),
        <>
          {hits.length > 0 && (
            <Banner variant="danger" testId="today-allergen" live={false}>
              <p className="banner__body">{t('day.recipeAllergen', { allergens: hits.map((a) => allergenLabel(dict, a, lang)).join(lang === 'ja' ? '、' : ', ') })}</p>
            </Banner>
          )}
          <a className="btn btn--primary" href={href} data-testid="today-cta">
            {t('today.cta.recipe')}
          </a>
        </>,
      );
    }
    case 'school-lunch-planned':
      return card(
        'school-lunch-planned',
        <Bowl />,
        t('today.school'),
        <>
          <p className="note-row" data-testid="today-reservation-note">
            {t('day.reservation.note')}
          </p>
          {v.reservationOffered && (
            <label className="check">
              <input type="checkbox" checked={v.reservationDone} data-testid="today-check-reservation" onChange={(e) => void markReservation(v, e.target.checked)} />
              <span>{t('day.reservation.check')}</span>
            </label>
          )}
        </>,
        chip,
      );
    case 'not-confirmed':
      return card(
        'not-confirmed',
        <BentoIcon filled={false} size={24} />,
        t('today.notConfirmed'),
        <a className="btn btn--secondary" href={day(today)} data-testid="today-cta">
          {t('today.cta.plan')}
        </a>,
        chip,
      );
    case 'no-school-lunch':
      return card(
        'no-school-lunch',
        <NoLunch />,
        t('today.noLunch'),
        overview.bentoDayNotPlanned ? (
          <a className="btn btn--secondary" href={day(today)} data-testid="today-cta">
            {t('day.action.planBentoDay')}
          </a>
        ) : null,
      );
  }
}
