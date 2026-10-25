// The food picker says what kind of thing each result is (US-E1-02/AC8) and the explanation
// sentences (US-E4-02/AC1, AC3) and calendar text helpers.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createAssessor } from '../../../src/domain/assessment/assess.ts';
import { createTranslator } from '../../../src/i18n/index.ts';
import { explanationText, splitShortName } from '../../../src/ui/calendar/labels.ts';
import { renderApp } from '../helpers/app.tsx';
import { d, day, dict, menu, PS, profile } from '../helpers/menus.ts';

describe('US-E1-02/AC8 each search result says what kind of food it is', () => {
  it('US-E1-02/AC8 searching 「とりにく」 gives 鶏肉 as 食材 and as 種類, in the fixed group order 食材 → 料理 → 種類, each chip named with its kind', async () => {
    const user = userEvent.setup();
    await renderApp({ store: null });
    await screen.findByTestId('ob-step-1');
    await user.type(screen.getByTestId('picker-likes-search'), 'とりにく');
    const ingredient = await screen.findByTestId('picker-likes-group-ingredient');
    const category = screen.getByTestId('picker-likes-group-category');
    expect(ingredient).toHaveAccessibleName('食材');
    expect(category).toHaveAccessibleName('種類');
    expect(within(ingredient).getByTestId('picker-likes-option-ing-chicken')).toHaveAccessibleName('鶏肉（食材）');
    expect(within(category).getByTestId('picker-likes-option-cat-chicken')).toHaveAccessibleName('鶏肉（種類）');
    const order = [...document.querySelectorAll('[data-testid^="picker-likes-group-"]')].map((n) => n.getAttribute('data-testid'));
    expect(order).toEqual([...order].sort((a, b) => ['ingredient', 'dish', 'category'].indexOf(a!.split('-').pop()!) - ['ingredient', 'dish', 'category'].indexOf(b!.split('-').pop()!)));
  });

  it('US-E1-02/AC8 a dish result is marked 料理; a group without a match is not rendered', async () => {
    const user = userEvent.setup();
    await renderApp({ store: null });
    await screen.findByTestId('ob-step-1');
    await user.type(screen.getByTestId('picker-likes-search'), 'から揚げ');
    expect(await screen.findByTestId('picker-likes-option-dish-karaage')).toHaveAccessibleName('からあげ（料理）');
    expect(screen.getByTestId('picker-likes-group-dish')).toHaveAccessibleName('料理');
    expect(screen.queryByTestId('picker-likes-group-category')).toBeNull();
  });

  it('US-E1-02/AC8 a chosen chip carries its kind in its name, and as text only when another chosen chip has the same label', async () => {
    const user = userEvent.setup();
    await renderApp({ store: null });
    await screen.findByTestId('ob-step-1');
    await user.type(screen.getByTestId('picker-likes-search'), 'とりにく');
    await user.click(await screen.findByTestId('picker-likes-option-ing-chicken'));
    const chip = screen.getByTestId('picker-likes-chip-ing-chicken');
    expect(chip).toHaveAccessibleName('鶏肉（食材）');
    expect(chip).toHaveTextContent(/^鶏肉/);
    expect(chip.textContent).not.toContain('（食材）');
    await user.click(screen.getByTestId('picker-likes-option-cat-chicken'));
    expect(screen.getByTestId('picker-likes-chip-ing-chicken')).toHaveTextContent('鶏肉（食材）');
    expect(screen.getByTestId('picker-likes-chip-cat-chicken')).toHaveTextContent('鶏肉（種類）');
  });

  it('US-E1-02/AC8 in English the kinds read Ingredient, Dish and Food group', async () => {
    const user = userEvent.setup();
    await renderApp({ store: null });
    await screen.findByTestId('ob-step-1');
    await user.click(screen.getByRole('radio', { name: 'EN' }));
    await user.type(screen.getByTestId('picker-likes-search'), 'chicken');
    expect(await screen.findByTestId('picker-likes-option-cat-chicken')).toHaveAccessibleName('Chicken (Food group)');
    expect(screen.getByTestId('picker-likes-option-ing-chicken')).toHaveAccessibleName('Chicken (Ingredient)');
  });
});

describe('US-E4-02 explanation sentences', () => {
  const assess = createAssessor(dict);
  const text = (lang: 'ja' | 'en', p: typeof PS, items: string[], ingredients?: string[]) => {
    const a = assess({ date: d('2026-11-04'), menu: menu([day('2026-11-04', items, ingredients)]), profile: p })!;
    return explanationText(createTranslator(lang), lang, dict, a);
  };

  it('US-E4-02/AC1 low preference: 「水曜日の給食には、苦手な食材が2つ含まれています（ピーマン、なす）。」 and the English sentence', () => {
    const items = ['ピーマンとなすのみそ炒め', 'ごはん', 'すまし汁'];
    expect(text('ja', PS, items)).toBe('水曜日の給食には、苦手な食材が2つ含まれています（ピーマン、なす）。');
    expect(text('en', PS, items)).toMatch(/^Wednesday's lunch includes 2 foods your child dislikes \(green bell pepper, eggplant\)\.$/);
  });

  it('US-E4-02/AC1 more than three: the first 3 names and 「ほか2つ」, counters switch to 「個」 from ten', () => {
    const p = profile([], ['ing-green-pepper', 'ing-eggplant', 'ing-carrot', 'ing-ginger', 'ing-onion']);
    const items = ['ピーマンとなすのみそ炒め', 'にんじんのグラッセ', '豚のしょうが焼き', 'たまねぎのスープ'];
    expect(text('ja', p, items)).toBe('水曜日の給食には、苦手な食材が5つ含まれています（ピーマン、なす、にんじん、ほか2つ）。');
    expect(text('en', p, items)).toContain('green bell pepper, eggplant, carrot and 2 more');
    expect(createTranslator('ja')('assess.low', { wdLong: '水曜日', n: 12, labels: 'x' })).toBe('水曜日の給食には、苦手な食材が12個含まれています（x）。');
  });

  it('US-E4-02/AC3 an uncertain day lists up to 3 unmatched dish names', () => {
    expect(text('ja', PS, ['タンドリーチキン', 'ナン', 'ミネストローネ'])).toBe('わからない料理が多いため、判断できませんでした（ナン、ミネストローネ）。');
  });

  it('US-E4-02/AC4 the other keys render without placeholders left over', () => {
    for (const lang of ['ja', 'en'] as const) {
      for (const [p, items] of [
        [PS, ['コーンスープ', 'ごはん']],
        [PS, ['ごはん', 'すまし汁']],
        [PS, ['なすのにびたし', '卵焼き', 'ごはん']],
        [profile([], []), ['ごはん']],
      ] as const) {
        expect(text(lang, p, [...items])).not.toMatch(/\{|\}/);
      }
    }
  });
});

describe('US-E5-01/AC4 the cell\'s short name is split at a phrase boundary, never cut', () => {
  const words = (s: string) => (s === 'くまさんおにぎり' ? ['くまさん', 'おにぎり'] : s === 'ほしのオムレツ' ? ['ほしの', 'オムレツ'] : [s]);

  it('US-E5-01/AC4 up to 4 characters stay on one line; longer names split at the word boundary nearest the middle', () => {
    expect(splitShortName('くまおに')).toEqual(['くまおに']);
    expect(splitShortName('くまさんおにぎり', words)).toEqual(['くまさん', 'おにぎり']);
    expect(splitShortName('ほしのオムレツ', words)).toEqual(['ほしの', 'オムレツ']);
  });

  it('US-E5-01/AC4 with no usable boundary the split is after the 4th character and both lines stay within 4', () => {
    const [a, b] = splitShortName('ABCDEFGH', (s) => [s]);
    expect([a, b]).toEqual(['ABCD', 'EFGH']);
    for (const name of ['くまおにぎり', 'ほしオムレツ', 'ミニハンバーグ']) {
      for (const line of splitShortName(name, (s) => [s])) expect([...line].length).toBeLessThanOrEqual(4);
    }
  });
});
