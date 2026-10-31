// Pieces shared by the recommendation cards, the recipe detail and the library
// (design/components.md 4.2, 5.1, 5.2). Every string comes from the catalog.
import { dictIndex } from '../../domain/assessment/dictionary-index.ts';
import { allergenSummary } from '../../domain/recommend/views.ts';
import type { ExclusionReason, RankReason } from '../../domain/recommend/rank.ts';
import type { Dictionary } from '../../domain/schema/dictionary.ts';
import type { Recipe } from '../../domain/schema/recipe.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { useApp } from '../app-store.tsx';
import { inSentence } from '../calendar/labels.ts';
import { Banner, BannerIcon } from '../components/Controls.tsx';

const joiner = (lang: Language) => (lang === 'ja' ? '、' : ', ');

export const allergenLabel = (dict: Dictionary, id: string, lang: Language): string => dict.allergens.find((a) => a.id === id)?.[lang] ?? id;
const allergenList = (dict: Dictionary, ids: readonly string[], lang: Language) => ids.map((id) => allergenLabel(dict, id, lang)).join(joiner(lang));

/** The recipe name in the active language and the other one beneath (ja only when there is no English). */
export function recipeNames(recipe: Recipe, lang: Language): { main: { text: string; lang: Language }; other: { text: string; lang: Language } | null } {
  const en = recipe.name.en;
  if (lang === 'en') {
    return en === undefined ? { main: { text: recipe.name.ja, lang: 'ja' }, other: null } : { main: { text: en, lang: 'en' }, other: { text: recipe.name.ja, lang: 'ja' } };
  }
  return { main: { text: recipe.name.ja, lang: 'ja' }, other: en === undefined ? null : { text: en, lang: 'en' } };
}

/** The reason chip text for one ranking reason key (US-E6-01/AC2). */
export function reasonText(t: Translate, lang: Language, dict: Dictionary, reason: RankReason): string {
  switch (reason.key) {
    case 'rank.liked':
      return t('rec.reason.liked', { food: inSentence(dictIndex(dict).label(reason.params.id, lang), lang) });
    case 'rank.theme':
      return t('rec.reason.theme', { theme: dict.themes.find((x) => x.id === reason.params.themeId)?.[lang] ?? reason.params.themeId });
    case 'rank.quick':
      return t('rec.reason.quick');
  }
}

/** Why a recipe is greyed in the library (US-E6-05/AC1, US-E6-02/AC1, AC6, AC8). */
export function conflictText(t: Translate, lang: Language, dict: Dictionary, reason: ExclusionReason): string {
  switch (reason.kind) {
    case 'allergen':
      return t('library.conflict.allergen', { allergen: allergenList(dict, reason.allergenIds, lang) });
    case 'excluded-ingredient': {
      const idx = dictIndex(dict);
      return t('library.conflict.excluded', { food: reason.ids.map((id) => inSentence(idx.label(id, lang), lang)).join(joiner(lang)) });
    }
    case 'diet':
      return t('library.conflict.diet', { diet: reason.diets.map((d) => t(`diet.${dietKey(d)}` as MessageKey)).join(joiner(lang)) });
    case 'diet-incomplete':
      return t('library.conflict.dietIncomplete');
    case 'allergen-incomplete':
      return t('library.conflict.incomplete');
  }
}

/** The catalog key suffix of a diet id (`no-pork` is `diet.noPork`). */
export const dietKey = (diet: string): string => diet.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

export function Disclaimer() {
  const { t } = useApp();
  return (
    <Banner variant="info" testId="disclaimer" live={false}>
      <p className="banner__body">{t('allergy.disclaimer')}</p>
    </Banner>
  );
}

export function WarnRow({ testId, text }: { testId?: string; text: string }) {
  return (
    <p className="note-row note-row--warning rec-warn" data-testid={testId}>
      <BannerIcon variant="warning" />
      <span>{text}</span>
    </p>
  );
}

/** US-E6-03/AC3: an empty allergen list is never worded as 「アレルゲンなし」. */
export function AllergenLines({ recipe, testId }: { recipe: Recipe; testId: string }) {
  const { t, state, services } = useApp();
  const lang = state.language;
  const s = allergenSummary(recipe);
  // M3-D03: a recipe with no allergens and a varies-by-product ingredient has nothing to list here (its warning is the WarnRow).
  if (!s.none && s.allergenIds.length === 0 && s.mayContainIds.length === 0) return null;
  return (
    <div className="rec-allergens" data-testid={testId}>
      {s.none && <p className="rec-line">{t('rec.allergensNone')}</p>}
      {s.allergenIds.length > 0 && <p className="rec-line">{t('rec.allergens', { list: allergenList(services.dictionary, s.allergenIds, lang) })}</p>}
      {s.mayContainIds.length > 0 && <p className="rec-line">{t('rec.mayContain', { list: allergenList(services.dictionary, s.mayContainIds, lang) })}</p>}
    </div>
  );
}

/** The varies-by-product and incomplete-data warnings (US-E6-02/AC4, AC5). */
export function RecipeWarnings({ recipe, prefix, incomplete }: { recipe: Recipe; prefix: string; incomplete: boolean }) {
  const { t } = useApp();
  const varies = allergenSummary(recipe).varies;
  return (
    <>
      {incomplete && <WarnRow testId={`${prefix}-incomplete`} text={t('rec.incomplete')} />}
      {varies && <WarnRow testId={`${prefix}-varies`} text={t('rec.variesByProduct')} />}
    </>
  );
}

export function RecipeArt({ size }: { size: 'card' | 'thumb' | 'hero' }) {
  return (
    <div className={`recipe-art recipe-art--${size}`} aria-hidden="true">
      <span className="recipe-art__stripe" />
    </div>
  );
}

export function Clock() {
  return (
    <svg className="icon rec-clock" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Check() {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
