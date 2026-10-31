// The recommendation card (components 4.2) and its compact row form for 「ほかのレシピ」 (4.3).
import type { RankedRecipe } from '../../domain/recommend/rank.ts';
import { useApp } from '../app-store.tsx';
import { toHash } from '../router.ts';
import type { LocalDate } from '../../domain/time/jst.ts';
import { AllergenLines, Check, Clock, RecipeArt, reasonText, recipeNames, RecipeWarnings } from './parts.tsx';

export interface CardProps {
  ranked: RankedRecipe;
  /** Test id prefix: `rec-card-<i>` or `rec-row-<i>`. */
  prefix: string;
  /** 1-based rank for the badge (cards only). */
  rank?: number;
  date: LocalDate;
  /** The recipe already planned on this date (change mode): tagged, its button disabled. */
  current: boolean;
  /** The date accepts a plan (false: no confirm button, details only). */
  canConfirm: boolean;
  primary: boolean;
  busyId: string | null;
  onConfirm: () => void;
}

export function RecCard({ ranked, prefix, rank, date, current, canConfirm, primary, busyId, onConfirm }: CardProps) {
  const { t, state, services } = useApp();
  const lang = state.language;
  const recipe = ranked.recipe;
  const names = recipeNames(recipe, lang);
  const compact = rank === undefined;
  const busy = busyId === recipe.id;
  return (
    <article className={`rec-card${compact ? ' rec-card--row' : ''}`} data-testid={prefix} data-recipe-id={recipe.id} data-score={ranked.score}>
      <div className="rec-card__art">
        <RecipeArt size={compact ? 'thumb' : 'card'} />
        {rank !== undefined && <span className="rec-card__rank">{t('rec.rank', { n: rank })}</span>}
      </div>
      <div className="rec-card__main">
        <h3 className="rec-card__name" lang={names.main.lang} data-testid={`${prefix}-name`}>
          {names.main.text}
        </h3>
        {names.other !== null && (
          <p className="rec-card__other" lang={names.other.lang}>
            {names.other.text}
          </p>
        )}
        {current && (
          <span className="tag" data-testid={`${prefix}-current`}>
            {t('rec.current')}
          </span>
        )}
        {!ranked.complete && <RecipeWarnings recipe={recipe} prefix={prefix} incomplete />}
        <p className="rec-card__meta" data-testid={`${prefix}-minutes`}>
          <Clock />
          {t('fmt.minutes', { n: recipe.minutes })}
        </p>
        {ranked.reasons.length > 0 && (
          <ul className="rec-reasons" data-testid={`${prefix}-reasons`}>
            {ranked.reasons.map((r) => (
              <li key={r.key + ('id' in r.params ? r.params.id : '')} className="tag tag--ok">
                <Check />
                {reasonText(t, lang, services.dictionary, r)}
              </li>
            ))}
          </ul>
        )}
        <AllergenLines recipe={recipe} testId={`${prefix}-allergens`} />
        {ranked.complete && <RecipeWarnings recipe={recipe} prefix={prefix} incomplete={false} />}
        <div className="rec-card__actions">
          {canConfirm && (
            <button
              type="button"
              className={`btn ${primary ? 'btn--primary' : 'btn--secondary'}`}
              data-testid={`${prefix}-confirm`}
              disabled={current || busyId !== null}
              aria-busy={busy || undefined}
              onClick={onConfirm}
            >
              {busy ? t('rec.saving') : t('rec.confirm')}
            </button>
          )}
          <a className="btn btn--text" href={toHash({ name: 'recipe', id: recipe.id, date })} data-testid={`${prefix}-details`}>
            {t('rec.details')}
          </a>
        </div>
      </div>
    </article>
  );
}
