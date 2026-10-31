// Recipe library (design/components.md 5.2, US-E6-05/AC1): every recipe, plannable ones first in name
// order, then the ones the child's allergens, exclusions or diet rule out, greyed with the reason.
import { libraryOrder } from '../../domain/recommend/views.ts';
import type { Recipe } from '../../domain/schema/recipe.ts';
import { useApp } from '../app-store.tsx';
import { TopBar } from '../components/Bars.tsx';
import { Icon } from '../components/Icon.tsx';
import { toHash } from '../router.ts';
import { useRank } from '../recommend/hooks.ts';
import { AllergenLines, Clock, conflictText, Disclaimer, RecipeArt, recipeNames } from '../recommend/parts.tsx';

export function LibraryScreen() {
  const { t, state, today, services } = useApp();
  const lang = state.language;
  const result = useRank(today);
  const { plannable, blocked } = libraryOrder(result);
  const total = services.library.length;

  const row = (recipe: Recipe, reasons: string[]) => {
    const names = recipeNames(recipe, lang);
    return (
      <li key={recipe.id} className={`library-row${reasons.length > 0 ? ' is-blocked' : ''}`} data-testid={`library-row-${recipe.id}`} data-blocked={reasons.length > 0 ? 'true' : undefined}>
        <a className="library-row__link" href={toHash({ name: 'recipe', id: recipe.id, date: null })} data-testid={`library-row-${recipe.id}-link`}>
          <RecipeArt size="thumb" />
          <span className="library-row__body">
            <span className="library-row__name" lang={names.main.lang}>
              {names.main.text}
            </span>
            <span className="rec-card__meta">
              <Clock />
              {t('fmt.minutes', { n: recipe.minutes })}
            </span>
            <AllergenLines recipe={recipe} testId={`library-row-${recipe.id}-allergens`} />
            {reasons.length > 0 && (
              <span className="library-row__reason" data-testid={`library-row-${recipe.id}-reason`}>
                {reasons.map((r) => (
                  <span key={r} className="rec-line">
                    {r}
                  </span>
                ))}
              </span>
            )}
          </span>
          <Icon name="chevronRight" />
        </a>
      </li>
    );
  };

  return (
    <div className="screen" data-testid="screen-library">
      <TopBar title={t('library.title')} />
      <main id="main" className="page page--wide">
        {total === 0 ? (
          <p data-testid="library-empty">{t('library.empty')}</p>
        ) : (
          <>
            <p data-testid="library-lead">{t('library.lead', { n: total })}</p>
            <ul className="library-list" data-testid="library-list">
              {plannable.map((r) => row(r, []))}
              {blocked.map((b) => row(b.recipe, b.reasons.map((x) => conflictText(t, lang, services.dictionary, x))))}
            </ul>
          </>
        )}
        <Disclaimer />
      </main>
    </div>
  );
}
