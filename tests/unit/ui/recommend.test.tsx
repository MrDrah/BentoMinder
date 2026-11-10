// M3 slice B in jsdom: the recommendation view, choosing a recipe, recipe detail, the library, the
// plan-date picker and a planned recipe that is gone from the library. The library is the synthetic
// fixture (13 recipes, tests only); the child is the sample from the M2 November state.
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createRanker } from '../../../src/domain/recommend/rank.ts';
import type { BentoMinderStore, Dictionary, Recipe } from '../../../src/domain/schema/index.ts';
import { localDate } from '../../../src/domain/time/jst.ts';
import { renderApp } from '../helpers/app.tsx';
import { loadFixture } from '../helpers/fixtures.ts';

const NOV2 = '2026-11-02T01:00:00Z'; // 2026-11-02 10:00 JST
const DISCLAIMER = 'アレルギーの安全を保証するものではありません。使用する食品の表示を必ずご確認ください。';
const dictionary = () => loadFixture<Dictionary>('../../data/dictionary.json');
const library = () => loadFixture<Recipe[]>('recipes/synthetic-library.json');
const november = () => loadFixture<BentoMinderStore>('state/m2-november.json');
const allAllergens = () => dictionary().allergens.map((a) => a.id);

function withProfile(patch: Partial<NonNullable<BentoMinderStore['profile']>>): BentoMinderStore {
  const s = november();
  s.profile = { ...(s.profile as NonNullable<BentoMinderStore['profile']>), ...patch };
  return s;
}

const open = (hash: string, store: BentoMinderStore = november(), now = NOV2) => renderApp({ store, hash, now, services: { library: library() } });
const ids = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-recipe-id]')].map((e) => e.dataset['recipeId']);

describe('US-E6-01 three ranked suggestions (BR-09)', () => {
  it('US-E6-01/AC1 exactly three cards in the order the engine gives, the same on a second visit, none of them filtered out', async () => {
    const store = november();
    const expected = createRanker(dictionary(), library())({
      profile: store.profile as never,
      decisions: Object.values(store.decisions),
      targetDate: localDate('2026-11-12'),
    }).suggestions.map((s) => s.recipeId);
    await open('#/recommend/2026-11-12', store);
    const first = ids(screen.getByTestId('recs-list'));
    expect(first).toEqual(expected);
    expect(first).toHaveLength(3);
    expect(first).not.toContain('rcp-syn-i-shrimp'); // the child's registered allergen (BR-06)
    cleanup();
    await open('#/recommend/2026-11-12', store);
    expect(ids(screen.getByTestId('recs-list'))).toEqual(first);
    expect(screen.getByTestId('rec-card-0')).toHaveTextContent('1位');
    expect(screen.getByTestId('recs-live')).toHaveTextContent('おすすめのレシピが3件あります');
  });

  it('US-E6-01/AC2 each card shows the Japanese name, minutes, at most 2 reasons and the allergen line', async () => {
    await open('#/recommend/2026-11-12');
    for (const card of ['rec-card-0', 'rec-card-1', 'rec-card-2']) {
      const el = screen.getByTestId(card);
      expect(within(el).getByTestId(`${card}-name`)).toHaveAttribute('lang', 'ja');
      expect(el).toHaveTextContent(/約\d+分/);
      expect(within(el).queryAllByRole('listitem').length).toBeLessThanOrEqual(2);
      expect(screen.getByTestId(`${card}-allergens`).textContent).toMatch(/アレルゲン|製品によって/);
    }
    // the karaage is a liked food and the child's theme: both reasons, in the catalog's wording
    const row = await openMore();
    expect(within(row('rcp-syn-b-karaage')).getByTestId(/-reasons$/).textContent).toMatch(/好きな.+入り/);
    expect(within(row('rcp-syn-b-karaage')).getByTestId(/-reasons$/)).toHaveTextContent('どうぶつテーマ');
  });

  it('US-E6-01/AC7 the quick reason follows the 20-minute rule: 20 minutes qualifies, 25 and 30 never show it', async () => {
    await open('#/recommend/2026-11-12');
    const row = await openMore();
    expect(row('rcp-syn-c-salmon')).toHaveTextContent('約20分');
    expect(row('rcp-syn-c-salmon')).toHaveTextContent('20分以内でできます');
    for (const slow of ['rcp-syn-b-karaage', 'rcp-syn-f-hamburg']) expect(row(slow)).not.toHaveTextContent('20分以内でできます');
  });

  it('US-E6-01/AC4 two recipes pass: exactly two cards and 「条件に合うレシピは2件です」', async () => {
    // F1'': every allergen but egg, and the sausage and curry-roux foods, leave the egg recipe and the vegetable one
    const store = withProfile({ allergyStatus: 'has-known', knownAllergenIds: allAllergens().filter((a) => a !== 'alg-egg'), excludedIngredientIds: ['ing-sausage', 'ing-curry-roux'] });
    await open('#/recommend/2026-11-12', store);
    expect(screen.getByTestId('recs-fewer')).toHaveTextContent('条件に合うレシピは2件です');
    expect(ids(screen.getByTestId('recs-list'))).toHaveLength(2);
  });

  it('US-E6-01/AC5 US-E5-03/AC1 none pass: the empty state with both links, and the decision is unchanged', async () => {
    const left = ['rcp-syn-e-veggie', 'rcp-syn-d-sausage', 'rcp-syn-m-corn-curry']; // what no registered allergen rules out
    const foods = [...new Set(library().filter((r) => left.includes(r.id)).flatMap((r) => r.ingredients.map((i) => i.ingredientId)))];
    const store = withProfile({ allergyStatus: 'has-known', knownAllergenIds: allAllergens(), excludedIngredientIds: foods });
    const app = await open('#/recommend/2026-11-12', store);
    const before = app.storage.data.get('bentominder.state');
    const empty = screen.getByTestId('recs-empty');
    expect(empty).toHaveTextContent('条件に合うレシピがありません');
    expect(within(empty).getByTestId('recs-empty-profile')).toHaveTextContent('プロフィールを見直す');
    expect(within(empty).getByTestId('recs-empty-profile')).toHaveAttribute('href', '#/profile');
    expect(within(empty).getByTestId('recs-empty-library')).toHaveTextContent('レシピ一覧を見る');
    expect(within(empty).getByTestId('recs-empty-library')).toHaveAttribute('href', '#/recipes');
    expect(screen.queryByTestId('recs-more')).toBeNull();
    expect(app.storage.data.get('bentominder.state')).toBe(before);
  });

  it('US-E6-01/AC6 「ほかのレシピ」 lists the whole filtered ranked list, still without a filtered-out recipe', async () => {
    const user = userEvent.setup();
    await open('#/recommend/2026-11-12');
    expect(screen.queryByTestId('recs-more-list')).toBeNull();
    await user.click(screen.getByTestId('recs-more'));
    const all = ids(screen.getByTestId('recs-more-list'));
    const store = november();
    const expected = createRanker(dictionary(), library())({ profile: store.profile as never, decisions: Object.values(store.decisions), targetDate: localDate('2026-11-12') }).all.map((r) => r.recipeId);
    expect(all).toEqual(expected);
    expect(all.length).toBeGreaterThan(3);
    expect(all).not.toContain('rcp-syn-i-shrimp');
  });
});

async function openMore(): Promise<(id: string) => HTMLElement> {
  await userEvent.setup().click(screen.getByTestId('recs-more'));
  const list = screen.getByTestId('recs-more-list');
  return (id) => list.querySelector<HTMLElement>(`[data-recipe-id="${id}"]`) as HTMLElement;
}

describe('US-E6-02 and US-E6-03 honest allergen wording (BR-07)', () => {
  it('US-E6-03/AC1 the disclaimer is on the recommendation view and on every recipe detail, verbatim', async () => {
    await open('#/recommend/2026-11-12');
    expect(screen.getByTestId('disclaimer')).toHaveTextContent(DISCLAIMER);
    cleanup();
    for (const r of library()) {
      await open(`#/recipe/${r.id}`);
      expect(screen.getByTestId('disclaimer')).toHaveTextContent(DISCLAIMER);
      cleanup();
    }
  });

  it('US-E6-03/AC1 the disclaimer is in English when the language is English, and the library carries it too', async () => {
    const user = userEvent.setup();
    await open('#/recipes');
    expect(screen.getByTestId('disclaimer')).toHaveTextContent(DISCLAIMER);
    await user.click(screen.getByTestId('lang-toggle-en'));
    expect(screen.getByTestId('disclaimer')).toHaveTextContent("BentoMinder can't guarantee anything about allergies. Always check the labels of the foods you use.");
  });

  it('US-E6-03/AC3 a recipe with no allergen and nothing that varies reads 「使用していません（食品の表示をご確認ください）」, never 「アレルゲンなし」', async () => {
    await open('#/recipe/rcp-syn-e-veggie');
    const line = screen.getByTestId('recipe-allergens');
    expect(line).toHaveTextContent('表示対象のアレルゲン：使用していません（食品の表示をご確認ください）');
    expect(document.body.textContent).not.toContain('アレルゲンなし');
    expect(document.body.textContent).not.toMatch(/安全です|対応済み/);
  });

  it('US-E6-02/AC13 a recipe whose only allergen information is a label (varies-by-product) shows no allergen line and no retired may-contain or check-the-label rows', async () => {
    await open('#/recipe/rcp-syn-b-karaage');
    expect(screen.queryByTestId('recipe-varies')).toBeNull();
    expect(document.body.textContent).not.toContain('製品によって含むことがあるもの');
    expect(screen.getByTestId('recipe-allergens')).not.toHaveTextContent('使用していません');
  });

  it('US-E6-02/AC13 incomplete allergen data neither flags a recipe nor ranks it last (child with no known allergen)', async () => {
    const store = withProfile({ allergyStatus: 'none-known', knownAllergenIds: [], excludedIngredientIds: [] });
    await open('#/recommend/2026-11-12', store);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('recs-more'));
    const rows = ids(screen.getByTestId('recs-more-list'));
    const result = createRanker(dictionary(), library())({ profile: store.profile as never, decisions: Object.values(store.decisions), targetDate: localDate('2026-11-12') });
    expect(rows).toEqual(result.all.map((r) => r.recipeId)); // the ranker's order, no extra tier
    const row = screen.getByTestId('recs-more-list').querySelector('[data-recipe-id="rcp-syn-m-corn-curry"]') as HTMLElement;
    expect(row).not.toHaveTextContent('一部の材料のアレルゲン情報がわかりません');
    expect(within(row).getByRole('button', { name: 'この日に決定' })).toBeEnabled();
  });

  it('US-E1-03/AC5 an unknown allergy status shows the warning above the cards and on the recipe', async () => {
    const store = withProfile({ allergyStatus: 'unknown', knownAllergenIds: [], excludedIngredientIds: [] });
    await open('#/recommend/2026-11-12', store);
    const banner = screen.getByTestId('banner-allergy-unknown');
    expect(banner).toHaveTextContent('アレルギー情報が未登録です');
    expect(banner.compareDocumentPosition(screen.getByTestId('recs-list')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();
    await open('#/recipe/rcp-syn-a-tamago', store);
    expect(screen.getByTestId('banner-allergy-unknown')).toBeInTheDocument();
    cleanup();
    await open('#/recommend/2026-11-12');
    expect(screen.queryByTestId('banner-allergy-unknown')).toBeNull();
  });
});

describe('US-E5-03 choosing a recipe plans the day (BR-02, BR-03)', () => {
  it('US-E5-03/AC2 「この日に決定」 stores the plan with both snapshots and plannedAt = decidedAt, shows it on the calendar and survives a reload', async () => {
    const user = userEvent.setup();
    const app = await open('#/recommend/2026-11-12');
    const first = screen.getByTestId('rec-card-0').dataset['recipeId'] as string;
    const recipe = library().find((r) => r.id === first) as Recipe;
    await user.click(screen.getByTestId('rec-card-0-confirm'));
    await screen.findByTestId('day-sheet');
    expect(window.location.hash).toBe('#/day/2026-11-12');
    const d = app.stored().decisions['2026-11-12'];
    expect(d).toMatchObject({
      state: 'homemade-bento-planned',
      recipeId: first,
      recipeNameSnapshot: { ja: recipe.name.ja },
      recipeShortNameSnapshot: { ja: recipe.shortNameJa, en: recipe.shortNameEn },
    });
    expect(d?.plannedAt).toBeDefined();
    expect(d?.plannedAt).toBe(d?.decidedAt);
    expect(screen.getByTestId('toast')).toHaveTextContent('11月12日（木）を手作りお弁当にしました');
    // the tile shows the homemade-bento icon and no recipe name (US-E5-01/AC4); the sheet and the stored snapshots keep the names
    expect(screen.getByTestId('cal-cell-2026-11-12')).toHaveAttribute('data-icon', 'home');
    expect(screen.getByTestId('cal-cell-2026-11-12')).not.toHaveTextContent(recipe.shortNameJa);
    cleanup();
    await renderApp({ store: app.stored(), now: NOV2, services: { library: library() } });
    // the tile shows the homemade-bento icon and no recipe name (US-E5-01/AC4); the sheet and the stored snapshots keep the names
    expect(screen.getByTestId('cal-cell-2026-11-12')).toHaveAttribute('data-icon', 'home');
    expect(screen.getByTestId('cal-cell-2026-11-12')).not.toHaveTextContent(recipe.shortNameJa);
    expect(screen.getByTestId('cal-cell-2026-11-12')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  });

  it('US-E5-06/AC1 changing the recipe keeps plannedAt, tags the current recipe and disables its button', async () => {
    const user = userEvent.setup();
    const app = await open('#/recommend/2026-11-12');
    const first = screen.getByTestId('rec-card-0').dataset['recipeId'];
    await user.click(screen.getByTestId('rec-card-0-confirm'));
    await screen.findByTestId('day-sheet');
    const planned = app.stored().decisions['2026-11-12']?.plannedAt;
    window.location.hash = '#/recommend/2026-11-12';
    await screen.findByTestId('screen-recommend');
    const current = document.querySelector(`[data-recipe-id="${first}"]`) as HTMLElement;
    expect(current).toHaveTextContent('いまのレシピ');
    expect(within(current).getByRole('button', { name: 'この日に決定' })).toBeDisabled();
    const other = screen.getByTestId('rec-card-1');
    await user.click(within(other).getByRole('button', { name: 'この日に決定' }));
    await screen.findByTestId('day-sheet');
    const d = app.stored().decisions['2026-11-12'];
    expect(d?.recipeId).toBe(other.dataset['recipeId']);
    expect(d?.plannedAt).toBe(planned);
    expect(d?.history.at(-1)).toMatchObject({ state: 'homemade-bento-planned', recipeId: other.dataset['recipeId'] });
  });

  it('US-E5-03/AC3 leaving without confirming changes nothing; reading cards and details writes nothing', async () => {
    const user = userEvent.setup();
    const app = await open('#/recommend/2026-11-12');
    const before = app.storage.data.get('bentominder.state');
    await user.click(screen.getByTestId('rec-card-0-details'));
    await screen.findByTestId('recipe-footer-action');
    await user.click(screen.getByTestId('topbar-back'));
    await screen.findByTestId('screen-recommend');
    await user.click(screen.getByTestId('topbar-back'));
    await screen.findByTestId('day-sheet');
    expect(app.storage.data.get('bentominder.state')).toBe(before);
  });

  it('US-E5-03/AC4 a past day gets cards to read but nothing to confirm', async () => {
    await open('#/recommend/2026-11-01');
    expect(screen.getByTestId('rec-card-0')).toBeInTheDocument();
    expect(screen.queryByTestId('rec-card-0-confirm')).toBeNull();
  });

  it('US-E6-04/AC1 from a card, the recipe detail confirms the same way', async () => {
    const user = userEvent.setup();
    const app = await open('#/recommend/2026-11-12');
    const first = screen.getByTestId('rec-card-0').dataset['recipeId'];
    await user.click(screen.getByTestId('rec-card-0-details'));
    expect(window.location.hash).toBe(`#/recipe/${first}?date=2026-11-12`);
    await user.click(await screen.findByTestId('recipe-footer-action'));
    await screen.findByTestId('day-sheet');
    expect(app.stored().decisions['2026-11-12']?.recipeId).toBe(first);
  });
});

describe('US-E6-04 recipe detail', () => {
  it('US-E6-04/AC1 US-E6-04/AC2 name, minutes, servings, ingredients with quantities, numbered steps, storage, the 農林水産省 notes and the sources', async () => {
    // the shipped library: the synthetic records carry no sources
    const shipped = loadFixture<Recipe[]>('../../data/library.json');
    const r = shipped.find((x) => x.minutes === 25) as Recipe;
    await renderApp({ store: november(), hash: `#/recipe/${r.id}`, now: NOV2, services: { library: shipped } });
    expect(screen.getByTestId('topbar-title')).toHaveTextContent(r.name.ja);
    expect(screen.getByTestId('screen-recipe')).toHaveTextContent('約25分');
    expect(screen.getByTestId('screen-recipe')).toHaveTextContent(r.yield.ja);
    expect(within(screen.getByTestId('recipe-ingredients')).getAllByRole('row')).toHaveLength(r.ingredients.length);
    expect(within(screen.getByTestId('recipe-steps')).getAllByRole('listitem')).toHaveLength(r.steps.length);
    const safety = screen.getByTestId('recipe-safety');
    expect(safety).toHaveTextContent('ごはんやおかずは、よく冷ましてから詰めましょう。');
    expect(safety).toHaveTextContent('長い時間持ち運ぶときは、保冷剤や保冷バッグを使って涼しく保ちましょう。');
    expect(within(safety).getByTestId('recipe-safety-credit')).toHaveTextContent('出典：農林水産省');
    expect(within(safety).getByTestId('recipe-safety-credit').getAttribute('href')).toMatch(/^https:\/\/www\.maff\.go\.jp\//);
    const sources = within(screen.getByTestId('recipe-sources')).getAllByRole('link');
    expect(sources).toHaveLength(r.sources.length);
    for (const link of sources) expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('US-E6-04/AC1 US-E8-01/AC4 in English the English name and text are shown, the Japanese name beneath', async () => {
    const user = userEvent.setup();
    await open('#/recipe/rcp-syn-b-karaage');
    await user.click(screen.getByTestId('lang-toggle-en'));
    const r = library().find((x) => x.id === 'rcp-syn-b-karaage') as Recipe;
    await waitFor(() => expect(screen.getByTestId('topbar-title')).toHaveTextContent(r.name.en as string));
    expect(screen.getByTestId('recipe-other-name')).toHaveTextContent(r.name.ja);
    expect(screen.getByTestId('recipe-safety')).toHaveTextContent('Let rice and side dishes cool fully before packing them.');
  });

  it('US-E6-04/AC3 an unknown id shows 「レシピが見つかりません」 and a link to the calendar', async () => {
    await open('#/recipe/rcp-nope');
    const block = screen.getByTestId('recipe-not-found');
    expect(block).toHaveTextContent('レシピが見つかりません');
    expect(within(block).getByRole('link', { name: 'カレンダーに戻る' })).toHaveAttribute('href', '#/calendar');
  });
});

describe('US-E6-05 the recipe library', () => {
  it('US-E6-05/AC1 every recipe is listed; those the child cannot have come last, greyed, with the reason, and cannot be planned', async () => {
    const user = userEvent.setup();
    await open('#/recipes');
    const rows = [...screen.getByTestId('library-list').children] as HTMLElement[];
    expect(rows).toHaveLength(library().length);
    const blockedAt = rows.findIndex((r) => r.dataset['blocked'] === 'true');
    expect(blockedAt).toBeGreaterThan(0);
    expect(rows.slice(blockedAt).every((r) => r.dataset['blocked'] === 'true')).toBe(true);
    expect(rows.slice(0, blockedAt).every((r) => r.dataset['blocked'] === undefined)).toBe(true);
    expect(screen.getByTestId('library-row-rcp-syn-i-shrimp-reason')).toHaveTextContent('えびを含む');
    await user.click(screen.getByTestId('library-row-rcp-syn-i-shrimp-link'));
    const action = await screen.findByTestId('recipe-footer-action');
    expect(action).toBeDisabled();
    expect(action).toHaveTextContent('日付を選んで計画');
    expect(screen.getByTestId('recipe-footer-hint')).toHaveTextContent('この条件では計画できません');
    expect(screen.getByTestId('recipe-conflicts')).toHaveTextContent('えびを含む');
  });

  it('US-E6-05/AC2 US-E6-05/AC3 the picker lists school days and お弁当の日 from today in date order, no no-lunch day, and a pick plans through the same confirm', async () => {
    const user = userEvent.setup();
    const app = await open('#/recipe/rcp-syn-a-tamago');
    await user.click(screen.getByTestId('recipe-footer-action'));
    const picker = await screen.findByTestId('plan-pick');
    expect(picker).toHaveTextContent('どの日に作りますか？');
    expect(within(picker).getByTestId('plan-pick-confirm')).toBeDisabled();
    const dates = [...picker.querySelectorAll<HTMLInputElement>('input[type=radio]')].map((i) => i.value);
    expect(dates).toEqual([...dates].sort());
    expect(dates[0]).toBe('2026-11-02'); // today can be planned
    expect(dates).toContain('2026-11-20'); // an お弁当の日
    expect(dates).not.toContain('2026-11-27'); // a no-lunch day
    expect(dates).not.toContain('2026-11-07'); // outside the menu
    expect(dates).not.toContain('2026-11-01'); // past
    expect(within(picker).getByTestId('plan-pick-option-2026-11-04').closest('label')).toHaveTextContent('手作りお弁当'); // its current decision
    await user.click(within(picker).getByTestId('plan-pick-option-2026-11-18'));
    await user.click(within(picker).getByTestId('plan-pick-confirm'));
    await screen.findByTestId('day-sheet');
    expect(app.stored().decisions['2026-11-18']).toMatchObject({ state: 'homemade-bento-planned', recipeId: 'rcp-syn-a-tamago' });
  });

  it('US-E6-05/AC3 picking a day that is already planned changes its recipe (CHANGE_RECIPE) and keeps plannedAt', async () => {
    const user = userEvent.setup();
    const app = await open('#/recipe/rcp-syn-a-tamago');
    const planned = app.stored().decisions['2026-11-04']?.plannedAt;
    await user.click(screen.getByTestId('recipe-footer-action'));
    await user.click(await screen.findByTestId('plan-pick-option-2026-11-04'));
    await user.click(screen.getByTestId('plan-pick-confirm'));
    await screen.findByTestId('day-sheet');
    const d = app.stored().decisions['2026-11-04'];
    expect(d?.recipeId).toBe('rcp-syn-a-tamago');
    expect(d?.plannedAt).toBe(planned);
  });

  it('US-E6-05/AC4 with no plannable day the picker says so and offers no date', async () => {
    const user = userEvent.setup();
    await open('#/recipe/rcp-syn-a-tamago', november(), '2026-12-20T01:00:00Z');
    await user.click(screen.getByTestId('recipe-footer-action'));
    const picker = await screen.findByTestId('plan-pick');
    expect(picker).toHaveTextContent('計画できる日がありません。献立を取り込むと選べるようになります。');
    expect(picker.querySelectorAll('input[type=radio]')).toHaveLength(0);
    expect(screen.queryByTestId('plan-pick-confirm')).toBeNull();
  });

  it('US-E6-05/AC2 the picker is operable by keyboard: Escape closes it and returns the focus', async () => {
    const user = userEvent.setup();
    await open('#/recipe/rcp-syn-a-tamago');
    const trigger = screen.getByTestId('recipe-footer-action');
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByTestId('plan-pick');
    expect(screen.getByRole('heading', { name: 'どの日に作りますか？' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('plan-pick')).toBeNull());
    expect(trigger).toHaveFocus();
  });
});

describe('US-E6-06 planned recipe missing after a library change', () => {
  it('US-E6-06/AC1 the tile is unchanged (home icon, no recipe name); the sheet shows the stored name and the notice, offers a re-choice, and changes nothing', async () => {
    const user = userEvent.setup();
    const app = await open('');
    const before = app.storage.data.get('bentominder.state');
    expect(screen.getByTestId('cal-cell-2026-11-04')).toHaveAttribute('data-icon', 'home');
    expect(screen.getByTestId('cal-cell-2026-11-04')).not.toHaveTextContent('くまおにぎり');
    await user.click(within(screen.getByTestId('cal-cell-2026-11-04')).getByRole('button'));
    const sheet = await screen.findByTestId('day-sheet');
    expect(within(sheet).getByTestId('day-recipe-name')).toHaveTextContent('くまさんおにぎり弁当');
    expect(within(sheet).getByTestId('day-recipe-missing')).toHaveTextContent('このレシピは見つかりません。別のレシピを選んでください。');
    expect(within(sheet).queryByTestId('day-action-view-recipe')).toBeNull();
    expect(within(sheet).getByTestId('day-action-change-recipe')).toHaveTextContent('レシピを選び直す');
    expect(app.storage.data.get('bentominder.state')).toBe(before);
    expect(app.stored().decisions['2026-11-04']?.recipeId).toBe('rcp-kuma-onigiri');
  });

  it('US-E6-06/AC1 choosing another recipe replaces the missing one through CHANGE_RECIPE', async () => {
    const user = userEvent.setup();
    const app = await open('');
    await user.click(within(screen.getByTestId('cal-cell-2026-11-04')).getByRole('button'));
    await user.click(await screen.findByTestId('day-action-change-recipe'));
    await screen.findByTestId('screen-recommend');
    await user.click(screen.getByTestId('rec-card-0-confirm'));
    await screen.findByTestId('day-sheet');
    const d = app.stored().decisions['2026-11-04'];
    expect(d?.recipeId).not.toBe('rcp-kuma-onigiri');
    expect(d?.state).toBe('homemade-bento-planned');
    expect(d?.plannedAt).toBe('2026-11-01T10:12:00+09:00');
  });

  it('US-E6-06/AC1 a planned recipe still in the library opens its detail from the sheet, planned banner and change/back actions in the footer', async () => {
    const user = userEvent.setup();
    const store = november();
    const lib = library();
    store.decisions['2026-11-04'] = {
      ...(store.decisions['2026-11-04'] as NonNullable<(typeof store.decisions)[string]>),
      recipeId: 'rcp-syn-a-tamago',
      recipeNameSnapshot: { ja: (lib[0] as Recipe).name.ja },
      recipeShortNameSnapshot: { ja: (lib[0] as Recipe).shortNameJa, en: (lib[0] as Recipe).shortNameEn },
    };
    await renderApp({ store, now: NOV2, services: { library: lib } });
    await user.click(within(screen.getByTestId('cal-cell-2026-11-04')).getByRole('button'));
    expect(screen.queryByTestId('day-recipe-missing')).toBeNull();
    await user.click(await screen.findByTestId('day-action-view-recipe'));
    expect(await screen.findByTestId('recipe-planned-banner')).toHaveTextContent('11月4日のお弁当に決定');
    expect(screen.getByTestId('recipe-footer-action')).toHaveTextContent('レシピを変更');
    await user.click(screen.getByTestId('recipe-footer-school'));
    await user.click(await screen.findByTestId('dialog-cancel-plan-confirm'));
    await screen.findByTestId('day-sheet');
    expect(screen.getByTestId('day-status')).toHaveAttribute('data-decision', 'school-lunch-planned');
  });
});
