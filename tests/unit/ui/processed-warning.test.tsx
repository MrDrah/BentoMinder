// The processed-food allergen rule in the UI (ADR 013, design/components.md 5.4): the compact line on
// cards, 「ほかのレシピ」 rows, library rows and the plan-date picker; the notice and the markers on the
// recipe detail; none of it without a registered allergen; excluded rows show only their reason.
// The library is the synthetic fixture (its processed recipes: b-karaage soy sauce, d-sausage bread and
// sausage, h-pork soy sauce, l-chikuwa chikuwa); the child is the M2 November sample (registered: えび).
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { BentoMinderStore, Dictionary, Recipe } from '../../../src/domain/schema/index.ts';
import { en } from '../../../src/i18n/en.ts';
import { ja } from '../../../src/i18n/ja.ts';
import { renderApp } from '../helpers/app.tsx';
import { loadFixture } from '../helpers/fixtures.ts';

const NOV2 = '2026-11-02T01:00:00Z';
const dictionary = () => loadFixture<Dictionary>('../../data/dictionary.json');
const library = () => loadFixture<Recipe[]>('recipes/synthetic-library.json');
const november = () => loadFixture<BentoMinderStore>('state/m2-november.json');
const CARD_JA = '市販品の表示を確認';
const ITEM_JA = '市販品。表示を確認';

function child(patch: Partial<NonNullable<BentoMinderStore['profile']>>): BentoMinderStore {
  const s = november();
  s.profile = { ...(s.profile as NonNullable<BentoMinderStore['profile']>), ...patch };
  return s;
}
const has = (...knownAllergenIds: string[]) => child({ allergyStatus: 'has-known', knownAllergenIds, excludedIngredientIds: [] });
const NO_ALLERGY = () => child({ allergyStatus: 'none-known', knownAllergenIds: [], excludedIngredientIds: [] });
const UNKNOWN = () => child({ allergyStatus: 'unknown', knownAllergenIds: [], excludedIngredientIds: [] });

const open = (hash: string, store: BentoMinderStore) => renderApp({ store, hash, now: NOV2, services: { library: library() } });
const processedNodes = () => [...document.querySelectorAll('[data-testid$="-processed"], [data-testid="recipe-processed-notice"]')];
const label = (id: string, lang: 'ja' | 'en') => dictionary().allergens.find((a) => a.id === id)?.[lang] as string;

describe('US-E6-02/AC11 US-E6-04/AC4 recipe detail: one notice and a marker on each processed ingredient', () => {
  it('US-E6-02/AC11 US-E6-04/AC4 a peanut-only child: the notice names 落花生 once, above the list, with the hidden prefix and no role; markers only on processed rows', async () => {
    await open('#/recipe/rcp-syn-d-sausage', has('alg-peanut'));
    const notice = screen.getByTestId('recipe-processed-notice');
    expect(screen.getAllByTestId('recipe-processed-notice')).toHaveLength(1);
    expect(notice).toHaveTextContent('市販品には、登録したアレルゲン（落花生）が含まれる場合があります。パッケージの表示を確認してください。');
    expect(notice).not.toHaveAttribute('role');
    expect(notice.querySelector('.visually-hidden')).toHaveTextContent('注意');
    const table = screen.getByTestId('recipe-ingredients');
    expect(notice.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const id of ['ing-bread', 'ing-sausage']) {
      const marker = screen.getByTestId(`recipe-ingredient-${id}-processed`);
      expect(marker).toHaveTextContent(ITEM_JA);
      expect(table).toContainElement(marker);
      expect(marker.closest('th')).not.toBeNull(); // in the label cell, before the quantity cell
    }
    const processedRows = within(table).getAllByRole('row').filter((r) => r.querySelector('[data-testid$="-processed"]'));
    expect(processedRows).toHaveLength(2);
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(2);
  });

  it('US-E6-02/AC11 US-E6-03/AC4 the notice lists the child\'s FULL registered list in registered order, joined with 、 (ja) and ", " (en), never shortened', async () => {
    const all = dictionary().allergens.map((a) => a.id).reverse();
    const user = userEvent.setup();
    await open('#/recipe/rcp-syn-b-karaage', child({ allergyStatus: 'has-known', knownAllergenIds: ['alg-peanut', 'alg-shrimp', 'alg-egg', 'alg-milk'], excludedIngredientIds: [] }));
    // chicken and wheat are not registered, so the karaage passes
    expect(screen.getByTestId('recipe-processed-notice')).toHaveTextContent('（落花生、えび、卵、乳）');
    await user.click(screen.getByTestId('lang-toggle-en'));
    expect(screen.getByTestId('recipe-processed-notice')).toHaveTextContent('Store-bought products may contain the registered allergens (Peanut, Shrimp/prawn, Egg, Milk). Check the package label.');
    expect(screen.getByTestId('recipe-ingredient-ing-soy-sauce-processed')).toHaveTextContent('Store-bought product: check the label');
    cleanup();
    // 28 registered allergens that do not exclude the recipe: every one appears
    const registered = all.filter((id) => !['alg-chicken', 'alg-wheat'].includes(id));
    await open('#/recipe/rcp-syn-b-karaage', child({ allergyStatus: 'has-known', knownAllergenIds: registered, excludedIngredientIds: [] }));
    const text = screen.getByTestId('recipe-processed-notice').textContent as string;
    for (const id of registered) expect(text).toContain(label(id, 'ja'));
    expect(text).not.toMatch(/…|\.\.\.|ほか\d|他\d/);
  });

  it('US-E6-02/AC11 role="status" is not set when the notice is there on load (read in DOM order, not announced)', async () => {
    await open('#/recipe/rcp-syn-h-pork', has('alg-shrimp'));
    expect(screen.getByTestId('recipe-processed-notice')).not.toHaveAttribute('role', 'status');
    expect(screen.getByTestId('recipe-processed-notice').closest('[role=status]')).toBeNull();
  });

  it('US-E6-02/AC11 the trigger is the dictionary: a recipe without a processed ingredient shows no notice and no marker', async () => {
    await open('#/recipe/rcp-syn-a-tamago', has('alg-peanut'));
    expect(processedNodes()).toHaveLength(0);
  });

  it('US-E6-03/AC4 US-E6-02/AC11 no text of the warning says or implies safety', async () => {
    await open('#/recipe/rcp-syn-d-sausage', has('alg-peanut'));
    const text = [screen.getByTestId('recipe-processed-notice').textContent, ...processedNodes().map((n) => n.textContent)].join(' ');
    expect(text).not.toMatch(/安全|含まれていません|含みません|使用していません|大丈夫|free|safe/i);
  });
});

describe('US-E6-02/AC12 US-E6-03/AC5 US-E6-04/AC5 no registered allergen, no warning anywhere', () => {
  it.each([
    ['none-known', NO_ALLERGY],
    ['unknown', UNKNOWN],
    ['has-known with only an excluded food', () => child({ allergyStatus: 'has-known', knownAllergenIds: [], excludedIngredientIds: ['ing-corn'] })],
  ])('US-E6-02/AC12 US-E6-03/AC5 US-E6-04/AC5 %s: no card, row, library row, picker or detail shows a processed-food string', async (_name, make) => {
    const user = userEvent.setup();
    await open('#/recommend/2026-11-12', make());
    await user.click(screen.getByTestId('recs-more'));
    expect(processedNodes()).toHaveLength(0);
    expect(document.body.textContent).not.toContain(CARD_JA);
    cleanup();
    await open('#/recipes', make());
    expect(processedNodes()).toHaveLength(0);
    expect(document.body.textContent).not.toContain(CARD_JA);
    cleanup();
    await open('#/recipe/rcp-syn-d-sausage', make());
    expect(processedNodes()).toHaveLength(0);
    expect(document.body.textContent).not.toContain(ITEM_JA);
    expect(screen.getByTestId('disclaimer')).toBeInTheDocument();
    await user.click(screen.getByTestId('recipe-footer-action'));
    await screen.findByTestId('plan-pick');
    expect(screen.queryByTestId('plan-pick-processed')).toBeNull();
  });

  it('US-E6-02/AC12 an unknown allergy status keeps its banner and shows no processed-food notice next to it', async () => {
    await open('#/recipe/rcp-syn-d-sausage', UNKNOWN());
    expect(screen.getByTestId('banner-allergy-unknown')).toHaveTextContent('アレルギー情報が未登録です');
    expect(screen.queryByTestId('recipe-processed-notice')).toBeNull();
  });
});

describe('US-E6-02/AC11 US-E6-02/AC12 compact line on cards, rows, library rows and the plan-date picker', () => {
  it('US-E6-02/AC11 cards and 「ほかのレシピ」 rows show the line exactly when the recipe has a processed ingredient; verbatim, static, not focusable', async () => {
    const user = userEvent.setup();
    await open('#/recommend/2026-11-12', has('alg-peanut'));
    await user.click(screen.getByTestId('recs-more'));
    const processedIds = new Set(['rcp-syn-b-karaage', 'rcp-syn-d-sausage', 'rcp-syn-f-hamburg', 'rcp-syn-g-tofu', 'rcp-syn-h-pork', 'rcp-syn-i-shrimp', 'rcp-syn-j-macaroni', 'rcp-syn-l-chikuwa', 'rcp-syn-m-corn-curry']);
    const rows = [...screen.getByTestId('recs-more-list').querySelectorAll<HTMLElement>('[data-recipe-id]')];
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      const line = row.querySelector('[data-testid$="-processed"]');
      expect(line !== null).toBe(processedIds.has(row.dataset['recipeId'] as string));
      if (line !== null) {
        expect(line).toHaveTextContent(CARD_JA);
        expect(line.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        expect(line.querySelectorAll('a,button,input,[tabindex]')).toHaveLength(0);
        // placed under the allergen line (if any) and above the actions
        const actions = row.querySelector('.rec-card__actions') as HTMLElement;
        expect(line.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    }
    expect(screen.getAllByTestId(/^rec-card-\d-processed$/).length).toBeGreaterThan(0);
  });

  it('US-E6-02/AC12 the card line is in English when the language is English', async () => {
    const user = userEvent.setup();
    await open('#/recommend/2026-11-12', has('alg-peanut'));
    await user.click(screen.getByTestId('lang-toggle-en'));
    expect(screen.getAllByTestId(/^rec-card-\d-processed$/)[0]).toHaveTextContent('Check labels of store-bought items');
  });

  it('US-E6-02/AC9 US-E6-02/AC11 library: plannable processed rows carry the line; greyed rows show only their reason', async () => {
    await open('#/recipes', has('alg-salmon'));
    // l-chikuwa is excluded through the fish group; its reason names the child's own さけ
    const blocked = screen.getByTestId('library-row-rcp-syn-l-chikuwa');
    expect(blocked).toHaveAttribute('data-blocked', 'true');
    expect(screen.getByTestId('library-row-rcp-syn-l-chikuwa-reason')).toHaveTextContent('さけを含む');
    expect(screen.queryByTestId('library-row-rcp-syn-l-chikuwa-processed')).toBeNull();
    expect(screen.getByTestId('library-row-rcp-syn-d-sausage-processed')).toHaveTextContent(CARD_JA);
    expect(screen.queryByTestId('library-row-rcp-syn-a-tamago-processed')).toBeNull();
    for (const row of document.querySelectorAll('[data-blocked="true"]')) expect(row.querySelector('[data-testid$="-processed"]')).toBeNull();
  });

  it('US-E6-02/AC11 the plan-date picker header shows the line for a recipe with a processed ingredient only', async () => {
    const user = userEvent.setup();
    await open('#/recipe/rcp-syn-d-sausage', has('alg-peanut'));
    await user.click(screen.getByTestId('recipe-footer-action'));
    const picker = await screen.findByTestId('plan-pick');
    const line = within(picker).getByTestId('plan-pick-processed');
    expect(line).toHaveTextContent(CARD_JA);
    const title = within(picker).getByRole('heading');
    expect(title.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();
    await open('#/recipe/rcp-syn-a-tamago', has('alg-peanut'));
    await user.click(screen.getByTestId('recipe-footer-action'));
    await screen.findByTestId('plan-pick');
    expect(screen.queryByTestId('plan-pick-processed')).toBeNull();
  });
});

describe('US-E6-02/AC9 US-E6-02/AC15 inherent and fish-group allergens exclude with the allergen name', () => {
  it('US-E6-02/AC9 a wheat child: the bread recipe is not suggested, is greyed in the library with 「小麦を含む」 and cannot be planned', async () => {
    const user = userEvent.setup();
    const lib = library().map((r) => (r.id === 'rcp-syn-d-sausage' ? { ...r, allergenIds: ['alg-wheat'] } : r));
    await renderApp({ store: has('alg-wheat'), hash: '#/recommend/2026-11-12', now: NOV2, services: { library: lib } });
    await user.click(screen.getByTestId('recs-more'));
    expect(document.querySelector('[data-recipe-id="rcp-syn-d-sausage"]')).toBeNull();
    cleanup();
    await renderApp({ store: has('alg-wheat'), hash: '#/recipes', now: NOV2, services: { library: lib } });
    expect(screen.getByTestId('library-row-rcp-syn-d-sausage-reason')).toHaveTextContent('小麦を含む');
    await user.click(screen.getByTestId('library-row-rcp-syn-d-sausage-link'));
    expect(await screen.findByTestId('recipe-footer-action')).toBeDisabled();
    expect(screen.getByTestId('recipe-conflicts')).toHaveTextContent('小麦を含む');
    expect(screen.queryByTestId('recipe-processed-notice')).toBeNull();
  });

  it('US-E6-02/AC15 a salmon child: a recipe with chikuwa is excluded with 「さけを含む」 (the child\'s own allergen), never a group name', async () => {
    const user = userEvent.setup();
    await open('#/recommend/2026-11-12', has('alg-salmon'));
    await user.click(screen.getByTestId('recs-more'));
    expect(document.querySelector('[data-recipe-id="rcp-syn-l-chikuwa"]')).toBeNull();
    cleanup();
    await open('#/recipe/rcp-syn-l-chikuwa', has('alg-salmon'));
    expect(screen.getByTestId('recipe-conflicts')).toHaveTextContent('さけを含む');
    expect(document.body.textContent).not.toMatch(/grp-fish|魚類/);
    cleanup();
    await open('#/recipe/rcp-syn-l-chikuwa', has('alg-salmon-roe'));
    expect(screen.queryByTestId('recipe-conflicts')).toBeNull(); // roe is not a member of the group
    expect(screen.getByTestId('recipe-processed-notice')).toHaveTextContent('いくら');
  });
});

describe('US-E6-02/AC13 US-E6-04/AC6 the incomplete-data and may-contain notices are gone', () => {
  it('US-E6-02/AC13 US-E6-04/AC6 a recipe with allergenDataComplete false shows no incomplete-data row, and ranks by score only', async () => {
    const user = userEvent.setup();
    await open('#/recommend/2026-11-12', NO_ALLERGY());
    await user.click(screen.getByTestId('recs-more'));
    expect(document.body.textContent).not.toContain('一部の材料のアレルゲン情報がわかりません');
    expect(document.body.textContent).not.toContain('市販品は製品によりアレルゲンが異なります');
    expect(document.body.textContent).not.toContain('製品によって含むことがあるもの');
    const row = screen.getByTestId('recs-more-list').querySelector('[data-recipe-id="rcp-syn-m-corn-curry"]') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'この日に決定' })).toBeEnabled();
    cleanup();
    await open('#/recipe/rcp-syn-m-corn-curry', has('alg-shrimp'));
    expect(screen.queryByTestId('recipe-incomplete')).toBeNull();
    expect(screen.queryByTestId('recipe-varies')).toBeNull();
    expect(document.body.textContent).not.toContain('一部の材料のアレルゲン情報がわかりません');
  });

  it('US-E6-02/AC13 the retired keys are out of both catalogs and the new ones are in both (parity)', () => {
    for (const key of ['rec.mayContain', 'rec.variesByProduct', 'rec.incomplete', 'library.conflict.incomplete']) {
      expect(key in ja).toBe(false);
      expect(key in en).toBe(false);
    }
    for (const key of ['warn.processed.card', 'warn.processed.item', 'warn.processed.recipe', 'warn.processed.prefix', 'allergy.processed.hint'] as const) {
      expect(ja[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
    }
    expect(ja['warn.processed.recipe']).toContain('{allergens}');
    expect(en['warn.processed.recipe']).toContain('{allergens}');
  });
});

describe('US-E1-03/AC7 the hint under the allergen picker', () => {
  it('US-E1-03/AC7 shown only with 「アレルギーあり」 selected and at least one allergen chosen, verbatim; absent otherwise', async () => {
    const user = userEvent.setup();
    await renderApp();
    expect(screen.queryByTestId('allergy-processed-hint')).toBeNull();
    await user.click(screen.getByTestId('radio-allergy-has-known'));
    expect(screen.queryByTestId('allergy-processed-hint')).toBeNull();
    await user.click(screen.getByTestId('chip-allergen-alg-peanut'));
    expect(screen.getByTestId('allergy-processed-hint')).toHaveTextContent('市販品を使うレシピには、登録したアレルゲンを挙げて、パッケージの表示を確認するようご案内します。');
    await user.click(screen.getByTestId('chip-allergen-alg-peanut'));
    expect(screen.queryByTestId('allergy-processed-hint')).toBeNull();
    await user.click(screen.getByTestId('chip-allergen-alg-peanut'));
    await user.click(screen.getByTestId('radio-allergy-none-known'));
    expect(screen.queryByTestId('allergy-processed-hint')).toBeNull();
    await user.click(screen.getByTestId('lang-toggle-en'));
    await user.click(screen.getByTestId('radio-allergy-has-known'));
    expect(screen.getByTestId('allergy-processed-hint')).toHaveTextContent('For recipes that use store-bought products, the app lists the allergens you register and reminds you to check the package label.');
  });
});
