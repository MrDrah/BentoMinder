// Child profile form logic (US-E1-02…E1-06, BR-20): the editable form, its validation, the
// structured pickers' rules (likes/dislikes disjoint, ≤ 30 each, ≤ 3 themes) and the stored
// ChildProfile. Dictionary data is passed in, so tests use fixtures.
import type { BentoMinderStore, ChildProfile, Diet, Dictionary } from '../schema/index.ts';
import { childProfileSchema, toRuleIssues } from '../schema/index.ts';
import { LOCAL_OWNER_ID } from '../storage/defaults.ts';
import { normalizeForMatch } from '../text/normalize.ts';
import { toJstTimestamp, type Instant } from '../time/jst.ts';

export const NICKNAME_MAX = 20;
export const NOTE_MAX = 200;
export const FOODS_MAX = 30;
export const THEMES_MAX = 3;
export const PROFILE_ID = 'child-1';

export type AgeRange = ChildProfile['ageRange'];
export type AllergyStatus = ChildProfile['allergyStatus'];

export interface ProfileForm {
  nickname: string;
  ageRange: AgeRange | null;
  likedIds: string[];
  dislikedIds: string[];
  allergyStatus: AllergyStatus | null;
  knownAllergenIds: string[];
  excludedIngredientIds: string[];
  diet: Diet[];
  themeIds: string[];
  note: string;
}

export function emptyProfileForm(): ProfileForm {
  return {
    nickname: '',
    ageRange: null,
    likedIds: [],
    dislikedIds: [],
    allergyStatus: null,
    knownAllergenIds: [],
    excludedIngredientIds: [],
    diet: [],
    themeIds: [],
    note: '',
  };
}

export function profileToForm(p: ChildProfile): ProfileForm {
  return {
    nickname: p.nickname ?? '',
    ageRange: p.ageRange,
    likedIds: [...p.likedIds],
    dislikedIds: [...p.dislikedIds],
    allergyStatus: p.allergyStatus,
    knownAllergenIds: [...p.knownAllergenIds],
    excludedIngredientIds: [...p.excludedIngredientIds],
    diet: [...p.diet],
    themeIds: [...p.themeIds],
    note: p.note ?? '',
  };
}

/** Cuts a string to `max` Unicode code points (US-E1-02/AC5: input stops at the limit). */
export function clampCodePoints(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : chars.slice(0, max).join('');
}

export type ProfileError = 'age-required' | 'allergy-status-required' | 'allergen-required';

/** US-E1-02/AC4, US-E1-03/AC3–AC4: errors in field order (the first one gets focus). */
export function validateProfileForm(form: ProfileForm): ProfileError[] {
  const errors: ProfileError[] = [];
  if (form.ageRange === null) errors.push('age-required');
  if (form.allergyStatus === null) errors.push('allergy-status-required');
  else if (form.allergyStatus === 'has-known' && form.knownAllergenIds.length === 0 && form.excludedIngredientIds.length === 0) {
    errors.push('allergen-required');
  }
  return errors;
}

const clean = (s: string) => s.normalize('NFC').trim();

export type ToProfileResult = { ok: true; profile: ChildProfile } | { ok: false; errors: ProfileError[]; issues: string[] };

/**
 * US-E1-02/AC1, AC5, AC7, US-E1-03, US-E1-04: the stored profile. A blank nickname or note is
 * absent; allergy picks are kept only with 「アレルギーあり」 (contract `profile-allergy-status`);
 * vegetarian + pescatarian is reduced to vegetarian (`profile-diet-redundant`).
 */
export function formToProfile(form: ProfileForm, now: Instant, existing: ChildProfile | null = null): ToProfileResult {
  const errors = validateProfileForm(form);
  if (errors.length > 0 || form.ageRange === null || form.allergyStatus === null) return { ok: false, errors, issues: [] };
  const ts = toJstTimestamp(now);
  const nickname = clampCodePoints(clean(form.nickname), NICKNAME_MAX).trim();
  const note = clampCodePoints(clean(form.note), NOTE_MAX).trim();
  const hasKnown = form.allergyStatus === 'has-known';
  const diet = form.diet.includes('vegetarian') ? form.diet.filter((d) => d !== 'pescatarian') : form.diet;
  const candidate = {
    id: PROFILE_ID,
    ...(nickname === '' ? {} : { nickname }),
    ageRange: form.ageRange,
    likedIds: [...form.likedIds],
    dislikedIds: form.dislikedIds.filter((id) => !form.likedIds.includes(id)),
    allergyStatus: form.allergyStatus,
    knownAllergenIds: hasKnown ? [...form.knownAllergenIds] : [],
    excludedIngredientIds: hasKnown ? [...form.excludedIngredientIds] : [],
    diet: [...new Set(diet)],
    themeIds: form.themeIds.slice(0, THEMES_MAX),
    ...(note === '' ? {} : { note }),
    ownerId: LOCAL_OWNER_ID,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
  const parsed = childProfileSchema.safeParse(candidate);
  return parsed.success ? { ok: true, profile: parsed.data } : { ok: false, errors: [], issues: toRuleIssues(parsed.error).map((i) => i.rule) };
}

export type FoodList = 'likes' | 'dislikes';
export type ToggleOutcome = { form: ProfileForm; moved?: 'toLikes' | 'toDislikes'; refused?: 'limit' };

/**
 * US-E1-02/AC3 (BR-20): adding an id to one list moves it out of the other, with a notice;
 * tapping a selected id removes it; the 31st id is refused.
 */
export function toggleFood(form: ProfileForm, list: FoodList, id: string): ToggleOutcome {
  const mineKey = list === 'likes' ? 'likedIds' : 'dislikedIds';
  const otherKey = list === 'likes' ? 'dislikedIds' : 'likedIds';
  const mine = form[mineKey];
  if (mine.includes(id)) return { form: { ...form, [mineKey]: mine.filter((x) => x !== id) } };
  if (mine.length >= FOODS_MAX) return { form, refused: 'limit' };
  const wasOther = form[otherKey].includes(id);
  const next = { ...form, [mineKey]: [...mine, id], [otherKey]: form[otherKey].filter((x) => x !== id) };
  return wasOther ? { form: next, moved: list === 'likes' ? 'toLikes' : 'toDislikes' } : { form: next };
}

/** US-E1-04/AC3: at most 3 themes; the 4th is refused. */
export function toggleTheme(form: ProfileForm, id: string): ToggleOutcome {
  if (form.themeIds.includes(id)) return { form: { ...form, themeIds: form.themeIds.filter((x) => x !== id) } };
  if (form.themeIds.length >= THEMES_MAX) return { form, refused: 'limit' };
  return { form: { ...form, themeIds: [...form.themeIds, id] } };
}

export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export interface FoodOption {
  id: string;
  kind: 'ingredient' | 'category' | 'dish';
  ja: string;
  en: string;
}

/** Every pickable food: ingredients (not seasonings), categories and dishes. */
export function foodOptions(dict: Dictionary): FoodOption[] {
  return [
    ...dict.ingredients.filter((i) => !i.seasoning).map((i) => ({ id: i.id, kind: 'ingredient' as const, ja: i.ja, en: i.en })),
    ...dict.categories.map((c) => ({ id: c.id, kind: 'category' as const, ja: c.ja, en: c.en })),
    ...dict.dishes.map((d) => ({ id: d.id, kind: 'dish' as const, ja: d.ja, en: d.en })),
  ];
}

/**
 * US-E1-02/AC2: search by label, reading or any printed form (dictionary §1 matching:
 * NFKC + katakana→hiragana), or by the English label. Prefix matches first, then by length.
 */
export function searchFoods(dict: Dictionary, query: string, limit = 12, kinds: FoodOption['kind'][] = ['ingredient', 'category', 'dish']): FoodOption[] {
  const q = normalizeForMatch(query).toLowerCase();
  if (q === '') return [];
  const forms = new Map<string, string[]>();
  for (const i of dict.ingredients) forms.set(i.id, [i.ja, i.kana, ...i.forms]);
  for (const c of dict.categories) forms.set(c.id, [c.ja, c.kana]);
  for (const d of dict.dishes) forms.set(d.id, [d.ja, d.kana, ...d.forms]);
  const scored: { option: FoodOption; score: number }[] = [];
  for (const option of foodOptions(dict).filter((o) => kinds.includes(o.kind))) {
    const candidates = [...(forms.get(option.id) ?? []), option.en].map((f) => normalizeForMatch(f).toLowerCase());
    let best = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      if (c.startsWith(q)) best = Math.min(best, c.length);
      else if (c.includes(q)) best = Math.min(best, 1000 + c.length);
    }
    if (best !== Number.POSITIVE_INFINITY) scored.push({ option, score: best });
  }
  return scored.sort((a, b) => a.score - b.score || a.option.id.localeCompare(b.option.id)).slice(0, limit).map((s) => s.option);
}

/** US-E1-02/AC8: the kind of a pickable food (an id with no entry has none). */
export function foodKind(dict: Dictionary, id: string): FoodOption['kind'] | null {
  if (id.startsWith('ing-')) return dict.ingredients.some((i) => i.id === id) ? 'ingredient' : null;
  if (id.startsWith('cat-')) return dict.categories.some((c) => c.id === id) ? 'category' : null;
  if (id.startsWith('dish-')) return dict.dishes.some((x) => x.id === id) ? 'dish' : null;
  return null;
}

/** US-E1-02/AC8, components §6.3: result groups in the fixed order 食材 → 料理 → 種類, empty groups left out. */
export const FOOD_KIND_ORDER: readonly FoodOption['kind'][] = ['ingredient', 'dish', 'category'];

export function foodLabel(dict: Dictionary, id: string, lang: 'ja' | 'en'): string {
  const all: { id: string; ja: string; en: string }[] = [...dict.ingredients, ...dict.categories, ...dict.dishes, ...dict.allergens, ...dict.themes];
  const hit = all.find((x) => x.id === id);
  return hit === undefined ? id : hit[lang];
}

/** Design §6.3: 12 common choices shown while the search is empty (ids that exist in the dictionary). */
export const POPULAR_FOOD_IDS = [
  'ing-chicken',
  'ing-egg',
  'ing-corn',
  'ing-green-pepper',
  'ing-eggplant',
  'cat-fish',
  'ing-carrot',
  'ing-tomato',
  'ing-pumpkin',
  'ing-spinach',
  'ing-shiitake',
  'ing-natto',
] as const;

export function saveProfile(store: BentoMinderStore, profile: ChildProfile, now: Instant): BentoMinderStore {
  return { ...store, profile, updatedAt: toJstTimestamp(now) };
}

/**
 * US-E1-06/AC2: the profile is removed with the manual overrides (confirming the deletion is the
 * parent's explicit clearing action); menus and decisions stay (BR-02).
 */
export function deleteProfile(store: BentoMinderStore, now: Instant): BentoMinderStore {
  return { ...store, profile: null, overrides: {}, updatedAt: toJstTimestamp(now) };
}
