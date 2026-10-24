// Child profile form rules (US-E1-02…E1-06, BR-20), with a small fixture dictionary.
import { describe, expect, it } from 'vitest';
import {
  childProfileSchema,
  clampCodePoints,
  deleteProfile,
  emptyProfileForm,
  foodLabel,
  formToProfile,
  POPULAR_FOOD_IDS,
  profileToForm,
  saveProfile,
  searchFoods,
  toggleFood,
  toggleIn,
  toggleTheme,
  validateProfileForm,
  type Dictionary,
  type ProfileForm,
} from '../../../../src/domain/index.ts';
import type { Instant } from '../../../../src/domain/time/jst.ts';
import { loadFixture, storeV1 } from '../../helpers/fixtures.ts';

const NOW = Date.parse('2026-10-28T01:00:00Z') as Instant;
const ing = (id: string, ja: string, kana: string, en: string, forms: string[] = [ja], seasoning = false) => ({
  id, ja, kana, en, categoryIds: ['cat-meat'], parentIngredientId: null, forms, inherentAllergenIds: [], info: 'known' as const,
  animalOrigin: [], animalOriginKnown: true, seasoning, note: null,
});
const dict = {
  version: '1', source: 'fixture', allergenScheme: 'caa-2026-04',
  categories: [{ id: 'cat-fish', ja: 'さかな', kana: 'さかな', en: 'Fish', parentId: null }],
  allergens: [{ id: 'alg-egg', ja: '卵', kana: 'たまご', en: 'Egg', tier: 'mandatory' as const, synonyms: [], retired: false }],
  ingredients: [
    ing('ing-chicken', '鶏肉', 'とりにく', 'Chicken', ['鶏肉', 'とり肉', 'チキン']),
    ing('ing-egg', 'たまご', 'たまご', 'Egg', ['卵', 'たまご']),
    ing('ing-green-pepper', 'ピーマン', 'ぴーまん', 'Green bell pepper'),
    ing('ing-tomato', 'トマト', 'とまと', 'Tomato'),
    ing('ing-salt', '塩', 'しお', 'Salt', ['塩'], true),
  ],
  dishes: [{ id: 'dish-chicken-karaage', ja: '鶏のから揚げ', kana: 'とりのからあげ', en: 'Fried chicken', categoryId: null, role: null, forms: ['から揚げ'], nameIngredientIds: [], conditionalNameIds: [], nameIngredientsNote: null, definingIngredientId: null }],
  themes: [{ id: 'theme-animals', ja: 'どうぶつ', en: 'Animals' }],
  ambiguity: [],
} as unknown as Dictionary;

const minimal = (): ProfileForm => ({ ...emptyProfileForm(), ageRange: 'age-4-5', allergyStatus: 'none-known' });

describe('US-E1-02 create the child profile (BR-20)', () => {
  it('US-E1-02/AC1 a minimal profile: no nickname, age-4-5, none-known, empty lists', () => {
    const r = formToProfile(minimal(), NOW);
    if (!r.ok) throw new Error(r.errors.join());
    expect(r.profile).toMatchObject({ id: 'child-1', ageRange: 'age-4-5', allergyStatus: 'none-known', likedIds: [], dislikedIds: [], diet: [], themeIds: [] });
    expect(r.profile.nickname).toBeUndefined();
    expect(r.profile.createdAt).toBe('2026-10-28T10:00:00+09:00');
  });

  it('US-E1-02/AC2 likes and dislikes are dictionary ids, incl. a category', () => {
    let form = minimal();
    for (const id of ['ing-chicken', 'ing-egg']) form = toggleFood(form, 'likes', id).form;
    for (const id of ['ing-green-pepper', 'cat-fish']) form = toggleFood(form, 'dislikes', id).form;
    const r = formToProfile(form, NOW);
    if (!r.ok) throw new Error('x');
    expect(r.profile.likedIds).toEqual(['ing-chicken', 'ing-egg']);
    expect(r.profile.dislikedIds).toEqual(['ing-green-pepper', 'cat-fish']);
  });

  it('US-E1-02/AC3 adding a disliked food to likes moves it, with a notice', () => {
    const disliked = toggleFood(minimal(), 'dislikes', 'ing-green-pepper').form;
    const out = toggleFood(disliked, 'likes', 'ing-green-pepper');
    expect(out.moved).toBe('toLikes');
    expect(out.form.likedIds).toEqual(['ing-green-pepper']);
    expect(out.form.dislikedIds).toEqual([]);
    expect(toggleFood(out.form, 'dislikes', 'ing-green-pepper').moved).toBe('toDislikes');
    expect(toggleFood(out.form, 'likes', 'ing-green-pepper').form.likedIds).toEqual([]);
  });

  it('BR-20: the 31st food is refused', () => {
    let form = minimal();
    for (let i = 0; i < 30; i += 1) form = toggleFood(form, 'likes', `ing-x${i}`).form;
    const out = toggleFood(form, 'likes', 'ing-x31');
    expect(out.refused).toBe('limit');
    expect(out.form.likedIds).toHaveLength(30);
  });

  it('US-E1-02/AC4 age range is required and is the first error', () => {
    expect(validateProfileForm(emptyProfileForm())).toEqual(['age-required', 'allergy-status-required']);
    const r = formToProfile({ ...minimal(), ageRange: null }, NOW);
    expect(r).toMatchObject({ ok: false, errors: ['age-required'] });
  });

  it('US-E1-02/AC5 nickname: 20 accepted, input stops at 20, spaces only → absent', () => {
    expect(clampCodePoints('あ'.repeat(21), 20)).toBe('あ'.repeat(20));
    expect(clampCodePoints('😀'.repeat(21), 20)).toHaveLength(40);
    const twenty = formToProfile({ ...minimal(), nickname: 'あ'.repeat(20) }, NOW);
    expect(twenty.ok && twenty.profile.nickname).toBe('あ'.repeat(20));
    const spaces = formToProfile({ ...minimal(), nickname: '   ' }, NOW);
    expect(spaces.ok && spaces.profile.nickname).toBeUndefined();
  });

  it('US-E1-02/AC6 the profile contract has no birthdate, gender, height, weight, photo, name or school field', () => {
    const shape = Object.keys(childProfileSchema.shape);
    for (const f of ['birthdate', 'gender', 'height', 'weight', 'photo', 'realName', 'fullName', 'school']) expect(shape).not.toContain(f);
  });

  it('US-E1-02/AC7 the note is stored (max 200) and blank notes are absent', () => {
    const r = formToProfile({ ...minimal(), note: ' 野菜は細かく切ると食べます ' }, NOW);
    expect(r.ok && r.profile.note).toBe('野菜は細かく切ると食べます');
    const long = formToProfile({ ...minimal(), note: 'あ'.repeat(250) }, NOW);
    expect(long.ok && [...(long.profile.note ?? '')].length).toBe(200);
  });
});

describe('US-E1-03 allergies, or explicitly unknown (BR-20)', () => {
  it('US-E1-03/AC1, AC2 known allergens and other excluded foods are stored with has-known', () => {
    const r = formToProfile({ ...minimal(), allergyStatus: 'has-known', knownAllergenIds: ['alg-shrimp', 'alg-egg'], excludedIngredientIds: ['ing-tomato'] }, NOW);
    expect(r.ok && r.profile).toMatchObject({ allergyStatus: 'has-known', knownAllergenIds: ['alg-shrimp', 'alg-egg'], excludedIngredientIds: ['ing-tomato'] });
  });

  it('US-E1-03/AC3 the status is required', () => {
    expect(validateProfileForm({ ...minimal(), allergyStatus: null })).toEqual(['allergy-status-required']);
  });

  it('US-E1-03/AC4 has-known with nothing selected is refused', () => {
    expect(formToProfile({ ...minimal(), allergyStatus: 'has-known' }, NOW)).toMatchObject({ ok: false, errors: ['allergen-required'] });
  });

  it('US-E1-03/AC5 unknown status stores no allergens; switching away discards hidden picks', () => {
    const r = formToProfile({ ...minimal(), allergyStatus: 'unknown', knownAllergenIds: ['alg-egg'] }, NOW);
    expect(r.ok && r.profile).toMatchObject({ allergyStatus: 'unknown', knownAllergenIds: [], excludedIngredientIds: [] });
  });
});

describe('US-E1-04 diet and themes', () => {
  it('US-E1-04/AC2 several diets are stored; vegetarian + pescatarian reduces to vegetarian', () => {
    const r = formToProfile({ ...minimal(), diet: ['no-pork', 'no-beef'] }, NOW);
    expect(r.ok && r.profile.diet).toEqual(['no-pork', 'no-beef']);
    const v = formToProfile({ ...minimal(), diet: ['pescatarian', 'vegetarian'] }, NOW);
    expect(v.ok && v.profile.diet).toEqual(['vegetarian']);
    expect(toggleIn(['a'], 'a')).toEqual([]);
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('US-E1-04/AC3 3 themes are stored, the 4th is refused', () => {
    let form = minimal();
    for (const t of ['theme-a', 'theme-b', 'theme-c']) form = toggleTheme(form, t).form;
    expect(toggleTheme(form, 'theme-d')).toMatchObject({ refused: 'limit' });
    expect(toggleTheme(form, 'theme-a').form.themeIds).toEqual(['theme-b', 'theme-c']);
    const r = formToProfile(form, NOW);
    expect(r.ok && r.profile.themeIds).toEqual(['theme-a', 'theme-b', 'theme-c']);
  });
});

describe('US-E1-05 edit, US-E1-06 delete', () => {
  it('US-E1-05/AC1 an edit keeps createdAt and round-trips through the form', () => {
    const p = storeV1().profile!;
    const r = formToProfile(profileToForm(p), Date.parse('2026-12-01T00:00:00Z') as Instant, p);
    expect(r.ok && r.profile.createdAt).toBe(p.createdAt);
    expect(r.ok && { ...r.profile, updatedAt: p.updatedAt }).toEqual(p);
  });

  it('US-E1-06/AC2 deleting the profile removes it and the overrides, keeps menus and decisions (BR-02)', () => {
    const s = storeV1();
    const out = deleteProfile(s, NOW);
    expect(out.profile).toBeNull();
    expect(out.overrides).toEqual({});
    expect(out.menus).toEqual(s.menus);
    expect(out.decisions).toEqual(s.decisions);
    expect(saveProfile(out, s.profile!, NOW).profile).toEqual(s.profile);
  });

  it('formToProfile reports contract issues it can\'t catch in the form (an unknown id)', () => {
    const r = formToProfile({ ...minimal(), likedIds: ['NOT AN ID'] }, NOW);
    expect(r).toMatchObject({ ok: false, errors: [] });
  });
});

describe('US-E1-02/AC2 food search', () => {
  it('US-E1-02/AC2 finds foods by label, reading, katakana/hiragana form or English; seasonings are not offered', () => {
    expect(searchFoods(dict, 'とり').map((o) => o.id)).toEqual(['ing-chicken', 'dish-chicken-karaage']);
    expect(searchFoods(dict, 'ちきん').map((o) => o.id)).toContain('ing-chicken');
    expect(searchFoods(dict, 'さかな').map((o) => o.id)).toEqual(['cat-fish']);
    expect(searchFoods(dict, 'pepper').map((o) => o.id)).toEqual(['ing-green-pepper']);
    expect(searchFoods(dict, 'しお')).toEqual([]);
    expect(searchFoods(dict, '  ')).toEqual([]);
    expect(searchFoods(dict, 'とま', 12, ['ingredient']).map((o) => o.id)).toEqual(['ing-tomato']);
  });

  it('labels come from the dictionary in the UI language', () => {
    expect(foodLabel(dict, 'cat-fish', 'ja')).toBe('さかな');
    expect(foodLabel(dict, 'alg-egg', 'en')).toBe('Egg');
    expect(foodLabel(dict, 'ing-none', 'ja')).toBe('ing-none');
  });

  it('every popular food id exists in the shipped dictionary', () => {
    const shipped = loadFixture<Dictionary>('../../data/dictionary.json');
    const ids = new Set([...shipped.ingredients, ...shipped.categories].map((x) => x.id));
    for (const id of POPULAR_FOOD_IDS) expect(ids.has(id), id).toBe(true);
  });
});
