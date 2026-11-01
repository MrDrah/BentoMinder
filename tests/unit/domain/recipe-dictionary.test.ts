// Recipe (§3.7) and dictionary rules on synthetic fixtures, plus properties of the shipped
// dictionary (live data: properties only, never specific contents).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  derivedDietOk,
  dictionaryIssues,
  dictionarySchema,
  isApprovedHost,
  recipeLibraryIssues,
  recipeSchema,
  toRuleIssues,
  type Dictionary,
  type Recipe,
} from '../../../src/domain/schema/index.ts';
import { katakanaToHiragana, normalizeForMatch, stripDisambiguator } from '../../../src/domain/text/normalize.ts';
import { clone } from '../helpers/fixtures.ts';

const rules = (schema: z.ZodType, value: unknown): string[] => {
  const r = schema.safeParse(value);
  return r.success ? [] : toRuleIssues(r.error).map((i) => i.rule);
};

const ing = (id: string, extra: Partial<Dictionary['ingredients'][number]> = {}): Dictionary['ingredients'][number] => ({
  id,
  ja: id,
  kana: id,
  en: id,
  categoryIds: ['cat-grain'],
  parentIngredientId: null,
  forms: [id.replace('ing-', 'form-')],
  inherentAllergenIds: [],
  info: 'known',
  allergenGroupIds: [],
  animalOrigin: [],
  animalOriginKnown: true,
  seasoning: false,
  note: null,
  ...extra,
});

function miniDictionary(): Dictionary {
  return {
    version: '1',
    source: 'synthetic',
    allergenScheme: 'caa-2026-04',
    categories: [
      { id: 'cat-grain', ja: '主食', kana: 'しゅしょく', en: 'Grains', parentId: null },
      { id: 'cat-egg', ja: 'たまご', kana: 'たまご', en: 'Eggs', parentId: null },
    ],
    allergens: [
      { id: 'alg-egg', ja: '卵', kana: 'たまご', en: 'Egg', tier: 'mandatory', synonyms: [], retired: false },
      { id: 'alg-wheat', ja: '小麦', kana: 'こむぎ', en: 'Wheat', tier: 'mandatory', synonyms: [], retired: false },
      { id: 'alg-matsutake', ja: 'まつたけ', kana: 'まつたけ', en: 'matsutake', tier: 'recommended', synonyms: [], retired: true },
    ],
    ingredients: [
      ing('ing-rice', { forms: ['ごはん', 'ご飯'] }),
      ing('ing-egg', { categoryIds: ['cat-egg'], forms: ['たまご', '卵'], inherentAllergenIds: ['alg-egg'], animalOrigin: ['egg'] }),
      ing('ing-dashi', { forms: ['だし'], info: 'varies', animalOrigin: ['fish-seafood'], animalOriginKnown: false }),
    ],
    dishes: [
      {
        id: 'dish-tamagoyaki',
        ja: '卵焼き',
        kana: 'たまごやき',
        en: 'Rolled omelette',
        categoryId: null,
        role: 'side',
        forms: ['卵焼き'],
        nameIngredientIds: ['ing-egg'],
        conditionalNameIds: [],
        nameIngredientsNote: null,
        definingIngredientId: 'ing-egg',
      },
    ],
    themes: [{ id: 'theme-animals', ja: 'どうぶつ', en: 'Animals' }],
    allergenGroups: [],
    ambiguity: [{ id: 'amb-test', forms: ['あじ'], candidateIds: ['ing-rice'], candidatesNote: '', resolution: '' }],
  };
}

const l10n = (ja: string, en?: string) => (en === undefined ? { ja } : { ja, en });

function syntheticRecipe(): Recipe {
  return {
    id: 'rcp-synthetic-egg-rice',
    name: l10n('合成テスト用たまごごはん', 'Synthetic egg rice'),
    shortNameJa: 'たまごはん',
    shortNameEn: 'Egg rice',
    nameKana: 'ごうせいてすとようたまごごはん',
    style: 'japanese',
    themeId: 'theme-animals',
    description: l10n('テスト専用の合成レシピです。実在のレシピではありません。', 'A synthetic test record, not a real recipe.'),
    yield: l10n('幼児1人分', '1 child portion'),
    minutes: 15,
    makeAhead: null,
    ingredients: [
      {
        ingredientId: 'ing-rice',
        label: l10n('ごはん', 'cooked rice'),
        quantity: 120,
        unit: 'g',
        optional: false,
        allergenInfo: 'known',
        allergenIds: [],
        possibleAllergenIds: [],
        animalOrigin: [],
        animalOriginKnown: true,
      },
      {
        ingredientId: 'ing-egg',
        label: l10n('たまご', 'egg'),
        quantity: 1,
        unit: 'piece',
        optional: false,
        allergenInfo: 'known',
        allergenIds: ['alg-egg'],
        possibleAllergenIds: [],
        animalOrigin: ['egg'],
        animalOriginKnown: true,
      },
    ],
    steps: [l10n('手順1（合成）'), l10n('手順2（合成）')],
    storage: [l10n('保存メモ（合成）')],
    allergenIds: ['alg-egg'],
    mayContainAllergenIds: [],
    allergenDataComplete: true,
    allergenScheme: 'caa-2026-04',
    animalOrigin: ['egg'],
    dietDataComplete: true,
    dietOk: ['vegetarian', 'pescatarian', 'no-pork', 'no-beef', 'no-seafood'],
    adaptations: [],
    sources: [
      {
        id: 'src-synthetic',
        publisher: '白ごはん.com',
        title: 'synthetic',
        url: 'https://www.sirogohan.com/recipe/synthetic/',
        accessed: '2026-10-24',
        language: 'ja',
        usedFor: ['recipe'],
      },
    ],
    reviewedBy: 'ba-research',
  };
}

const HOSTS = ['sirogohan.com'];

describe('recipe record rules (contract §3.7)', () => {
  it('the synthetic recipe validates against the schema and the mini dictionary', () => {
    expect(rules(recipeSchema, syntheticRecipe())).toEqual([]);
    expect(recipeLibraryIssues([syntheticRecipe()], miniDictionary(), HOSTS)).toEqual([]);
  });

  it('checks quantities and possible allergens per ingredient', () => {
    const r = syntheticRecipe();
    r.ingredients[0]!.quantity = null;
    expect(rules(recipeSchema, r)).toContain('recipe-quantity');
    const r2 = syntheticRecipe();
    r2.ingredients[0]!.quantity = 1.234;
    expect(rules(recipeSchema, r2)).toContain('recipe-quantity');
    const r3 = syntheticRecipe();
    r3.ingredients[0]!.quantity = null;
    r3.ingredients[0]!.unit = 'to-taste';
    expect(rules(recipeSchema, r3)).toEqual([]);
    // A processed food whose cited label declares no allergens stays varies-by-product (never "known: none").
    const r4 = syntheticRecipe();
    r4.ingredients[0]!.allergenInfo = 'varies-by-product';
    expect(rules(recipeSchema, r4)).not.toContain('recipe-possible-allergens');
    const r5 = syntheticRecipe();
    r5.ingredients[0]!.allergenInfo = 'known';
    r5.ingredients[0]!.possibleAllergenIds = ['alg-wheat'];
    expect(rules(recipeSchema, r5)).toContain('recipe-possible-allergens');
  });

  it('checks the derived allergen, origin and diet fields', () => {
    expect(rules(recipeSchema, { ...syntheticRecipe(), allergenIds: [] })).toContain('recipe-allergen-union');
    expect(rules(recipeSchema, { ...syntheticRecipe(), mayContainAllergenIds: ['alg-wheat'] })).toContain('recipe-may-contain-union');
    expect(rules(recipeSchema, { ...syntheticRecipe(), allergenDataComplete: false })).toContain('recipe-allergen-complete-derived');
    expect(rules(recipeSchema, { ...syntheticRecipe(), animalOrigin: [] })).toContain('recipe-animal-origin-union');
    expect(rules(recipeSchema, { ...syntheticRecipe(), dietDataComplete: false })).toContain('recipe-diet-complete-derived');
    expect(rules(recipeSchema, { ...syntheticRecipe(), dietOk: ['vegetarian'] })).toContain('recipe-diet-derived');
    expect(rules(recipeSchema, { ...syntheticRecipe(), shortNameJa: 'たまごごはん弁当です' })).toContain('recipe-short-name');
    const badUrl = syntheticRecipe();
    badUrl.sources[0]!.url = 'ftp://example.test';
    expect(rules(recipeSchema, badUrl)).toContain('source-url-invalid');
  });

  it('derives diets from animal-origin tags only, and none when origin data is incomplete (§3.8)', () => {
    expect(derivedDietOk(['fish-seafood'], true)).toEqual(['pescatarian', 'no-pork', 'no-beef']);
    expect(derivedDietOk(['meat'], true)).toEqual(['no-seafood']);
    expect(derivedDietOk(['gelatin'], true)).toEqual(['no-beef', 'no-seafood']);
    expect(derivedDietOk([], false)).toEqual([]);
  });
});

describe('recipe library rules against the dictionary (contract §3.7, §4)', () => {
  const issuesOf = (recipes: Recipe[], dict = miniDictionary()) => recipeLibraryIssues(recipes, dict, HOSTS).map((i) => i.rule);

  it('ids and calendar short names are unique across the library', () => {
    const a = syntheticRecipe();
    const b = syntheticRecipe();
    expect(issuesOf([a, b])).toEqual(expect.arrayContaining(['recipe-id-unique', 'recipe-short-name-unique']));
  });

  it('references resolve: themes, allergens, ingredients', () => {
    expect(issuesOf([{ ...syntheticRecipe(), themeId: 'theme-robots' }])).toContain('ref-dictionary');
    expect(issuesOf([{ ...syntheticRecipe(), allergenIds: ['alg-egg', 'alg-kale'] }])).toContain('allergen-unknown');
    expect(issuesOf([{ ...syntheticRecipe(), mayContainAllergenIds: ['alg-matsutake'] }])).toContain('allergen-retired');
    const r = syntheticRecipe();
    r.ingredients[0]!.ingredientId = 'ing-unknown';
    expect(issuesOf([r])).toContain('recipe-ingredient-resolves');
  });

  it('ingredients carry the dictionary allergens and animal-origin tags', () => {
    const r = syntheticRecipe();
    r.ingredients[1]!.allergenIds = [];
    r.ingredients[1]!.animalOrigin = [];
    expect(issuesOf([r])).toEqual(expect.arrayContaining(['recipe-ingredient-inherent-allergen', 'recipe-ingredient-animal-origin']));
    const r2 = syntheticRecipe();
    r2.ingredients[1]!.animalOriginKnown = false;
    expect(issuesOf([r2])).toContain('recipe-animal-origin-known');
  });

  it('an unknown-origin ingredient is known only with a cited recipe or allergen source', () => {
    const r = syntheticRecipe();
    r.ingredients[0] = { ...r.ingredients[0]!, ingredientId: 'ing-dashi', animalOrigin: ['fish-seafood'], animalOriginKnown: true };
    expect(issuesOf([r])).not.toContain('recipe-animal-origin-known');
    r.sources[0]!.usedFor = ['storage'];
    expect(issuesOf([r])).toContain('recipe-animal-origin-known');
  });

  it('sources come from approved publishers only', () => {
    const r = syntheticRecipe();
    r.sources[0]!.url = 'https://cookpad.example/recipe/1';
    expect(issuesOf([r])).toContain('source-publisher-approved');
    expect(isApprovedHost('https://www.sirogohan.com/x', HOSTS)).toBe(true);
    expect(isApprovedHost('https://sirogohan.com.evil.test/x', HOSTS)).toBe(false);
    expect(isApprovedHost('::', HOSTS)).toBe(false);
  });
});

describe('dictionary rules (dictionary §8)', () => {
  const issuesOf = (dict: Dictionary) => dictionaryIssues(dict).map((i) => i.rule);

  it('the synthetic dictionary has no issues', () => {
    expect(rules(dictionarySchema, miniDictionary())).toEqual([]);
    expect(issuesOf(miniDictionary())).toEqual([]);
  });

  it('flags duplicate ids and unresolved parents, categories and allergens', () => {
    const d = miniDictionary();
    d.ingredients.push(clone(d.ingredients[0]!));
    d.categories[0]!.parentId = 'cat-missing';
    d.ingredients[1]!.categoryIds = ['cat-missing'];
    d.ingredients[1]!.parentIngredientId = 'ing-missing';
    d.ingredients[1]!.inherentAllergenIds = ['alg-missing'];
    d.ingredients[1]!.animalOrigin = ['egg', 'egg'];
    expect(issuesOf(d)).toEqual(
      expect.arrayContaining([
        'dict-id-unique',
        'dict-parent-resolves',
        'dict-category-resolves',
        'dict-allergen-resolves',
        'dict-animal-origin-valid',
      ]),
    );
  });

  it('checks dish categories, name ingredients, defining ingredients and ambiguity candidates', () => {
    const d = miniDictionary();
    d.dishes[0]!.categoryId = 'cat-missing';
    d.dishes[0]!.nameIngredientIds = ['ing-missing'];
    d.dishes[0]!.definingIngredientId = 'ing-rice';
    d.ambiguity[0]!.candidateIds = ['ing-missing'];
    expect(issuesOf(d)).toEqual(
      expect.arrayContaining(['dict-category-resolves', 'dict-parent-resolves', 'dict-defining-ingredient', 'dict-ambiguity-candidates-resolve']),
    );
  });

  it('one normalised surface form belongs to one entry or ambiguity group (rule 2)', () => {
    const d = miniDictionary();
    d.ingredients[0]!.forms.push('アジ');
    expect(dictionaryIssues(d)).toEqual([expect.objectContaining({ rule: 'dict-synonym-unique', id: 'ing-rice' })]);
  });

  it('US-E6-02/AC16 allergen group rules: unknown member, unknown group, group on a non-processed row', () => {
    const ok = miniDictionary();
    ok.allergenGroups = [{ id: 'grp-test', memberAllergenIds: ['alg-egg', 'alg-wheat'], basis: 'synthetic' }];
    ok.ingredients[2]!.allergenGroupIds = ['grp-test']; // ing-dashi is info = varies
    expect(issuesOf(ok)).toEqual([]);

    const member = clone(ok);
    member.allergenGroups[0]!.memberAllergenIds = ['alg-egg', 'alg-matsutake']; // retired
    expect(issuesOf(member)).toEqual(['dictionary-group-member-unknown']);
    member.allergenGroups[0]!.memberAllergenIds = ['alg-missing'];
    expect(issuesOf(member)).toEqual(['dictionary-group-member-unknown']);

    const unknown = clone(ok);
    unknown.ingredients[2]!.allergenGroupIds = ['grp-nope'];
    expect(issuesOf(unknown)).toEqual(['dictionary-ingredient-group-unknown']);

    const known = clone(ok);
    known.ingredients[0]!.allergenGroupIds = ['grp-test']; // ing-rice is info = known
    expect(issuesOf(known)).toEqual(['dictionary-group-ingredient-not-processed']);
  });

  it('US-E6-02/AC16 a group id in a recipe allergen field fails allergen-unknown', () => {
    const lib = (extra: Partial<Recipe>) => recipeLibraryIssues([{ ...syntheticRecipe(), ...extra }], miniDictionary(), HOSTS).map((i) => i.rule);
    expect(lib({ allergenIds: ['alg-egg', 'grp-fish'] })).toContain('allergen-unknown');
    expect(lib({ mayContainAllergenIds: ['grp-fish'] })).toContain('allergen-unknown');
  });

  it('normalises like dictionary §1 rule 1', () => {
    expect(normalizeForMatch('ピーマン・ナス（大）')).toBe('ぴーまんなす大');
    expect(normalizeForMatch('ＡＢＣ　ｶﾚｰ')).toBe('ABCかれー');
    expect(katakanaToHiragana('カレー')).toBe('かれー');
    expect(stripDisambiguator('なし（梨）')).toBe('なし');
  });
});

describe('shipped dictionary (live data: properties only)', () => {
  const shipped = JSON.parse(readFileSync(new URL('../../../data/dictionary.json', import.meta.url), 'utf8')) as unknown;

  it('validates and every reference resolves', () => {
    const parsed = dictionarySchema.parse(shipped);
    expect(dictionaryIssues(parsed)).toEqual([]);
  });

  it('US-E6-02/AC15 US-E6-02/AC16 groups: every group is defined, members are scheme allergens, carriers are processed', () => {
    const parsed = dictionarySchema.parse(shipped);
    expect(parsed.allergenGroups.length).toBeGreaterThan(0);
    for (const g of parsed.allergenGroups) expect(g.id).toMatch(/^grp-/);
    expect(parsed.ingredients.filter((i) => i.allergenGroupIds.length > 0).every((i) => i.info === 'varies')).toBe(true);
  });

  it('every ingredient has an animal-origin value and seasonings are flagged by category', () => {
    const parsed = dictionarySchema.parse(shipped);
    for (const i of parsed.ingredients) {
      expect(Array.isArray(i.animalOrigin)).toBe(true);
      expect(i.seasoning).toBe(i.categoryIds.includes('cat-seasoning'));
    }
  });
});
