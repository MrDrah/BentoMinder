// The recommendation view for one date (design/components.md section 4, US-E5-03, US-E6-01,
// US-E6-03). Opening it, reading it and leaving it write nothing (BR-02); only 「この日に決定」
// writes, through the decision state machine. It never says a recipe is safe (BR-07).
import { useMemo, useState } from 'react';
import { createDayViewer } from '../../domain/calendar/day-view.ts';
import type { LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { useApp, useStore } from '../app-store.tsx';
import { Banner } from '../components/Controls.tsx';
import { TopBar } from '../components/Bars.tsx';
import { toHash } from '../router.ts';
import { RecCard } from '../recommend/cards.tsx';
import { useConfirmRecipe, useRank } from '../recommend/hooks.ts';
import { Disclaimer } from '../recommend/parts.tsx';

export function RecommendScreen({ date }: { date: LocalDate }) {
  const { t, state, today, services } = useApp();
  const store = useStore();
  const lang = state.language;
  const result = useRank(date);
  const { busyId, confirm } = useConfirmRecipe();
  const [more, setMore] = useState(false);
  const viewer = useMemo(() => createDayViewer(services.dictionary), [services.dictionary]);
  const v = viewer(store, date, today);
  // Past days and days with no plan action never get a confirm button (US-E5-03/AC4, BR-27).
  const canConfirm = v.actions.includes('bento') || v.actions.includes('plan-bento-day') || v.actions.includes('change-recipe');
  const currentId = v.displayed.state === 'homemade-bento-planned' ? v.record?.recipeId : undefined;
  const dateText = formatDate(t, lang, date);
  const n = result.suggestions.length;

  return (
    <div className="screen" data-testid="screen-recommend" data-date={date}>
      <TopBar title={t('rec.title', { date: dateText })} back={{ route: { name: 'day', date }, screen: dateText }} />
      <main id="main" className="page page--wide" data-testid="screen-recs">
        <p>{t('rec.lead')}</p>
        {store.profile?.allergyStatus === 'unknown' && (
          <Banner variant="warning" title={t('allergy.unknown.banner')} testId="banner-allergy-unknown" live={false} />
        )}
        <p className="visually-hidden" role="status" data-testid="recs-live">
          {t('live.recCount', { n })}
        </p>
        {n === 0 ? (
          <section className="rec-empty" data-testid="recs-empty">
            <h2 className="card__title">{t('rec.none')}</h2>
            <p className="card__body">{t('rec.none.body')}</p>
            <div className="stack">
              <a className="btn btn--secondary" href={toHash({ name: 'profile' })} data-testid="recs-empty-profile">
                {t('rec.none.profile')}
              </a>
              <a className="btn btn--secondary" href={toHash({ name: 'recipes' })} data-testid="recs-empty-library">
                {t('rec.none.library')}
              </a>
            </div>
          </section>
        ) : (
          <>
            {n < 3 && (
              <p className="note-row" data-testid="recs-fewer">
                {t('rec.fewer', { n })}
              </p>
            )}
            <div className="rec-grid" data-testid="recs-list">
              {result.suggestions.map((ranked, i) => (
                <RecCard
                  key={ranked.recipeId}
                  ranked={ranked}
                  prefix={`rec-card-${i}`}
                  rank={i + 1}
                  date={date}
                  current={ranked.recipeId === currentId}
                  canConfirm={canConfirm}
                  primary={i === 0}
                  busyId={busyId}
                  onConfirm={() => void confirm(date, ranked.recipeId)}
                />
              ))}
            </div>
            {result.all.length > n && (
              <button type="button" className="btn btn--text" data-testid="recs-more" aria-expanded={more} onClick={() => setMore((x) => !x)}>
                {t('rec.more')}
              </button>
            )}
            {more && (
              <section className="rec-more" aria-labelledby="recs-more-title">
                <h2 id="recs-more-title" className="card__title">
                  {t('rec.more.title')}
                </h2>
                <div className="rec-rows" data-testid="recs-more-list">
                  {result.all.map((ranked, i) => (
                    <RecCard
                      key={ranked.recipeId}
                      ranked={ranked}
                      prefix={`rec-row-${i}`}
                      date={date}
                      current={ranked.recipeId === currentId}
                      canConfirm={canConfirm}
                      primary={false}
                      busyId={busyId}
                      onConfirm={() => void confirm(date, ranked.recipeId)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <Disclaimer />
      </main>
    </div>
  );
}
