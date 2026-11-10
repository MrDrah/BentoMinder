// Recipe detail (design/components.md 5.1, US-E6-04, US-E6-03/AC1): content, the always-present
// food-handling notes, allergen and diet badges, sources, the disclaimer and the footer action for
// the context the parent came from. Nothing here says the recipe is safe (BR-07).
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { createDayViewer } from '../../domain/calendar/day-view.ts';
import { applyDecisionEvent } from '../../domain/decision/apply.ts';
import type { DecisionEvent } from '../../domain/decision/decision.ts';
import type { Recipe, RecipeIngredient } from '../../domain/schema/recipe.ts';
import type { LocalDate } from '../../domain/time/jst.ts';
import { formatDate, formatDateNoWeekday } from '../../i18n/format.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { useApp, useStore } from '../app-store.tsx';
import { Banner, Dialog } from '../components/Controls.tsx';
import { TopBar } from '../components/Bars.tsx';
import { BentoIcon } from '../components/Marks.tsx';
import { navigate, toHash } from '../router.ts';
import { PlanPicker } from '../recommend/PlanPicker.tsx';
import { useBlocked, useConfirmRecipe, useProcessedWarning, useRecipe } from '../recommend/hooks.ts';
import { allergenLabel, AllergenLines, conflictText, dietKey, Disclaimer, ProcessedItemMarker, ProcessedNotice, RecipeArt, recipeNames, WarnRow } from '../recommend/parts.tsx';

/** 農林水産省, the guidance the general notes are credited to (copy.md recipe.safety.*). */
const MAFF_URL = 'https://www.maff.go.jp/j/syouan/seisaku/foodpoisoning/lunchbox.html';

function quantityText(t: Translate, i: RecipeIngredient): string {
  return t(`qty.${i.unit}` as MessageKey, i.quantity === null ? {} : { n: i.quantity });
}

const pick = (text: { ja: string; en?: string | undefined }, lang: Language): { text: string; lang: Language } =>
  lang === 'en' && text.en !== undefined ? { text: text.en, lang: 'en' } : { text: text.ja, lang: 'ja' };

export function RecipeScreen({ id, date }: { id: string; date: LocalDate | null }) {
  const { t, state } = useApp();
  const recipe = useRecipe(id);
  if (recipe === undefined) {
    return (
      <div className="screen" data-testid="screen-recipe" data-recipe-id={id}>
        <TopBar title={t('library.title')} />
        <main id="main" className="page">
          <section className="card" data-testid="recipe-not-found">
            <h2 className="card__title">{t('recipe.notFound')}</h2>
            <a className="btn btn--secondary" href={toHash({ name: 'calendar', month: null })} data-testid="recipe-not-found-back">
              {t('recipe.notFound.back')}
            </a>
          </section>
        </main>
      </div>
    );
  }
  return <RecipeDetail recipe={recipe} date={date} lang={state.language} />;
}

function RecipeDetail({ recipe, date, lang }: { recipe: Recipe; date: LocalDate | null; lang: Language }) {
  const { t, today, services } = useApp();
  const store = useStore();
  const blocked = useBlocked().get(recipe.id);
  const warning = useProcessedWarning(recipe.id);
  // role="status" only when the notice appears because the profile changed while the page is open.
  const hadWarningOnLoad = useRef(warning !== null);
  const viewer = useMemo(() => createDayViewer(services.dictionary), [services.dictionary]);
  const names = recipeNames(recipe, lang);
  const v = date === null ? null : viewer(store, date, today);
  const plannedHere = v !== null && v.displayed.state === 'homemade-bento-planned' && v.record?.recipeId === recipe.id;
  const profile = store.profile;
  const dict = services.dictionary;
  const theme = recipe.themeId === null ? null : (dict.themes.find((x) => x.id === recipe.themeId)?.[lang] ?? null);
  const diets = profile === null ? [] : profile.diet.filter((d) => recipe.dietOk.includes(d));
  const maff = recipe.sources.find((s) => /(^|\.)maff\.go\.jp$/.test(new URL(s.url).hostname))?.url ?? MAFF_URL;
  const allergenReason = blocked?.reasons.find((r) => r.kind === 'allergen');
  const dateText = date === null ? '' : formatDate(t, lang, date);
  const back =
    date === null
      ? { route: { name: 'recipes' } as const, screen: t('library.title') }
      : plannedHere
        ? { route: { name: 'day', date } as const, screen: dateText }
        : { route: { name: 'recommend', date } as const, screen: t('rec.title', { date: dateText }) };
  const ingredientName = (i: RecipeIngredient) => pick(i.label, lang);

  return (
    <div className="screen" data-testid="screen-recipe" data-recipe-id={recipe.id}>
      <TopBar title={names.main.text} back={back} />
      <main id="main" className="page page--wide recipe">
        {profile?.allergyStatus === 'unknown' && <Banner variant="warning" title={t('allergy.unknown.banner')} testId="banner-allergy-unknown" live={false} />}
        {plannedHere && date !== null && (
          <div className="recipe-card" data-testid="recipe-planned-banner">
            <span>
              <BentoIcon filled size={20} /> {t('recipe.plannedFor', { date: formatDateNoWeekday(t, lang, date) })}
            </span>
          </div>
        )}
        {plannedHere && allergenReason?.kind === 'allergen' && (
          <Banner variant="danger" testId="recipe-allergen-conflict">
            <p className="banner__body">{t('day.recipeAllergen', { allergens: allergenReason.allergenIds.map((a) => allergenLabel(dict, a, lang)).join(lang === 'ja' ? '、' : ', ') })}</p>
          </Banner>
        )}
        <div className="recipe__cols">
          <div className="recipe__left">
            <RecipeArt size="hero" />
            {names.other !== null && (
              <p className="rec-card__other" lang={names.other.lang} data-testid="recipe-other-name">
                {names.other.text}
              </p>
            )}
            <ul className="recipe__meta">
              <li>{t('recipe.time', { minutes: t('fmt.minutes', { n: recipe.minutes }) })}</li>
              <li>{t('recipe.yield', { yield: pick(recipe.yield, lang).text })}</li>
              {theme !== null && <li>{t('recipe.theme', { theme })}</li>}
            </ul>
            <AllergenLines recipe={recipe} testId="recipe-allergens" />
            {diets.length > 0 && (
              <ul className="rec-reasons" data-testid="recipe-diets">
                {diets.map((d) => (
                  <li key={d} className="tag">
                    {t('recipe.diet', { diet: t(`diet.${dietKey(d)}` as MessageKey) })}
                  </li>
                ))}
              </ul>
            )}
            {blocked !== undefined && (
              <div data-testid="recipe-conflicts">
                {blocked.reasons.map((r) => (
                  <WarnRow key={r.kind} text={conflictText(t, lang, dict, r)} />
                ))}
              </div>
            )}
            {warning !== null && <ProcessedNotice allergenIds={warning.allergenIds} live={!hadWarningOnLoad.current} />}
            <section aria-labelledby="recipe-ingredients-h">
              <h2 id="recipe-ingredients-h" className="recipe__h">
                {t('recipe.ingredients')}
              </h2>
              <table className="recipe__table" data-testid="recipe-ingredients">
                <tbody>
                  {recipe.ingredients.map((i, n) => {
                    const name = ingredientName(i);
                    return (
                      <tr key={n}>
                        <th scope="row" lang={name.lang}>
                          {name.text}
                          {i.optional && <span className="tag"> {t('common.optional')}</span>}
                          {warning?.processedIngredientIds.includes(i.ingredientId) === true && <ProcessedItemMarker testId={`recipe-ingredient-${i.ingredientId}-processed`} />}
                        </th>
                        <td>{quantityText(t, i)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>
          <div className="recipe__right">
            <RecipeFooter recipe={recipe} date={date} plannedHere={plannedHere} blockedReasons={blocked === undefined ? null : blocked.reasons.map((r) => conflictText(t, lang, dict, r))} />
            <section aria-labelledby="recipe-steps-h">
              <h2 id="recipe-steps-h" className="recipe__h">
                {t('recipe.steps')}
              </h2>
              <ol className="recipe__steps" role="list" data-testid="recipe-steps">
                {recipe.steps.map((step, n) => {
                  const s = pick(step, lang);
                  return (
                    <li key={n}>
                      <span className="recipe__step-n" aria-hidden="true">
                        {n + 1}
                      </span>
                      <span className="visually-hidden">{t('recipe.step.label', { n: n + 1 })}</span>
                      <span lang={s.lang}>{s.text}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
            <section aria-labelledby="recipe-storage-h" data-testid="recipe-safety">
              <h2 id="recipe-storage-h" className="recipe__h">
                {t('recipe.storage')}
              </h2>
              <ul className="recipe__notes">
                {recipe.storage.map((s, n) => {
                  const p = pick(s, lang);
                  return (
                    <li key={n} lang={p.lang}>
                      {p.text}
                    </li>
                  );
                })}
                {recipe.makeAhead !== null && <li lang={pick(recipe.makeAhead, lang).lang}>{pick(recipe.makeAhead, lang).text}</li>}
                <li data-testid="recipe-safety-cool">{t('recipe.safety.cool')}</li>
                <li data-testid="recipe-safety-carry">{t('recipe.safety.carry')}</li>
              </ul>
              <p className="card__body">
                <a href={maff} target="_blank" rel="noopener noreferrer" data-testid="recipe-safety-credit">
                  {t('recipe.safety.credit')}
                  <span className="visually-hidden">{t('common.newWindow')}</span>
                </a>
              </p>
            </section>
            {recipe.adaptations.length > 0 && <p className="note-row" data-testid="recipe-adapted">{t('recipe.adapted')}</p>}
            <section aria-labelledby="recipe-sources-h">
              <h2 id="recipe-sources-h" className="recipe__h">
                {t('recipe.sources')}
              </h2>
              <ul className="recipe__sources" data-testid="recipe-sources">
                {recipe.sources.map((s) => (
                  <li key={s.id}>
                    <span lang={s.language}>{s.publisher}</span>
                    <br />
                    <a href={s.url} target="_blank" rel="noopener noreferrer" lang={s.language}>
                      {s.title}
                      <span className="visually-hidden">{t('common.newWindow')}</span>
                    </a>
                    <br />
                    <span className="field__hint">{t('recipe.source.accessed', { date: formatDateNoWeekday(t, lang, s.accessed as LocalDate) })}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
        <Disclaimer />
      </main>
    </div>
  );
}

/** The context action (components 5.1 table): none on a past day or an unplannable one. */
function RecipeFooter({ recipe, date, plannedHere, blockedReasons }: { recipe: Recipe; date: LocalDate | null; plannedHere: boolean; blockedReasons: string[] | null }) {
  const { t, state, today, now, services, commit, showToast, showSaveFailed } = useApp();
  const store = useStore();
  const lang = state.language;
  const { busyId, confirm } = useConfirmRecipe();
  const [picker, setPicker] = useState(false);
  const [ask, setAsk] = useState<'cancel-plan' | 'clear-plan' | null>(null);
  const [busy, setBusy] = useState(false);
  const viewer = useMemo(() => createDayViewer(services.dictionary), [services.dictionary]);
  const v = date === null ? null : viewer(store, date, today);

  const finish = async (event: DecisionEvent, saved: MessageKey) => {
    if (date === null || busy) return;
    const r = applyDecisionEvent(store, date, event, { today, now: now(), recipe: () => undefined });
    if (!r.ok) return;
    setBusy(true);
    const ok = await commit(r.store);
    setBusy(false);
    if (ok) {
      showToast(t(saved, { date: formatDate(t, lang, date) }));
      setAsk(null);
      navigate({ name: 'day', date });
    } else showSaveFailed();
  };

  const cantPlan = blockedReasons !== null;
  const hint = cantPlan && (
    <p className="field__hint" id="recipe-footer-hint" data-testid="recipe-footer-hint">
      {t('library.conflict.cantPlan')}
    </p>
  );

  let body: ReactNode = null;
  if (date === null) {
    body = (
      <>
        <button type="button" className="btn btn--primary" data-testid="recipe-footer-action" disabled={cantPlan} aria-describedby={cantPlan ? 'recipe-footer-hint' : undefined} onClick={() => setPicker(true)}>
          {t('recipe.planPick')}
        </button>
        {hint}
      </>
    );
  } else if (v !== null && !v.past) {
    if (plannedHere) {
      if (v.actions.includes('change-recipe')) {
        body = (
          <div className="recipe__actions">
            <button type="button" className="btn btn--secondary" data-testid="recipe-footer-action" onClick={() => navigate({ name: 'recommend', date })}>
              {t('day.action.changeRecipe')}
            </button>
            {v.actions.includes('back-to-school') && (
              <button type="button" className="btn btn--destructive-text" data-testid="recipe-footer-school" onClick={() => setAsk('cancel-plan')}>
                {t('day.action.backToSchool')}
              </button>
            )}
            {v.actions.includes('clear-plan') && (
              <button type="button" className="btn btn--destructive-text" data-testid="recipe-footer-clear" onClick={() => setAsk('clear-plan')}>
                {t('day.action.clearPlan')}
              </button>
            )}
          </div>
        );
      }
    } else if (v.actions.includes('bento') || v.actions.includes('plan-bento-day') || v.actions.includes('change-recipe')) {
      body = (
        <>
          <button
            type="button"
            className="btn btn--primary"
            data-testid="recipe-footer-action"
            disabled={cantPlan || busyId !== null}
            aria-busy={busyId !== null || undefined}
            aria-describedby={cantPlan ? 'recipe-footer-hint' : undefined}
            onClick={() => void confirm(date, recipe.id)}
          >
            {busyId === recipe.id ? t('rec.saving') : t('rec.confirm')}
          </button>
          {hint}
        </>
      );
    }
  }

  return (
    <div className="recipe__footer">
      {body}
      {picker && <PlanPicker recipeId={recipe.id} onClose={() => setPicker(false)} />}
      {ask === 'cancel-plan' && date !== null && (
        <Dialog
          name="cancel-plan"
          destructive
          title={t('day.cancel.title', { dateNoWd: formatDateNoWeekday(t, lang, date) })}
          body={<p>{t('day.cancel.body')}</p>}
          confirmLabel={t('day.cancel.confirm')}
          cancelLabel={t('common.cancel')}
          busy={busy}
          onConfirm={() => void finish({ type: 'SET_SCHOOL_LUNCH' }, 'day.saved.school')}
          onCancel={() => setAsk(null)}
        />
      )}
      {ask === 'clear-plan' && date !== null && (
        <Dialog
          name="clear-plan"
          destructive
          title={t('day.clear.title', { dateNoWd: formatDateNoWeekday(t, lang, date) })}
          body={<p>{t('day.clear.body')}</p>}
          confirmLabel={t('day.clear.confirm')}
          cancelLabel={t('common.cancel')}
          busy={busy}
          onConfirm={() => void finish({ type: 'CLEAR_PLAN' }, 'day.saved.cleared')}
          onCancel={() => setAsk(null)}
        />
      )}
    </div>
  );
}

