// Builders for assessment and decision tests: dictionary, profiles, days, menus, stores.
import dictionaryJson from '../../../data/dictionary.json';
import type { AssessmentOverride, BentoMinderStore, ChildProfile, ConfirmedMenu, DayDecision, ExtractedDay, NoLunchDay } from '../../../src/domain/schema/index.ts';
import type { Dictionary } from '../../../src/domain/schema/dictionary.ts';
import { createEmptyStore } from '../../../src/domain/storage/defaults.ts';
import type { Instant, LocalDate } from '../../../src/domain/time/jst.ts';

export const dict = dictionaryJson as Dictionary;
export const d = (s: string) => s as LocalDate;

type Kind = ExtractedDay['items'][number]['kind'];
export type ItemSpec = string | [string, Kind] | { text: string; kind?: Kind; resolvedIds?: string[] };

const ok = { status: 'ok' } as const;
const TS = '2026-10-28T20:00:00+09:00';

export function item(spec: ItemSpec): ExtractedDay['items'][number] {
  const o = typeof spec === 'string' ? { text: spec } : Array.isArray(spec) ? { text: spec[0], kind: spec[1] } : spec;
  return { text: o.text, kind: o.kind ?? 'main', verification: ok, ...('resolvedIds' in o && o.resolvedIds !== undefined ? { resolvedIds: o.resolvedIds } : {}) };
}

export function day(date: string, items: ItemSpec[], ingredients?: string[]): ExtractedDay {
  return {
    date,
    printedDateText: null,
    printedWeekday: null,
    items: items.map(item),
    ingredientsStatus: ingredients === undefined ? 'not-listed' : 'listed',
    ...(ingredients === undefined ? {} : { ingredients: ingredients.map((text) => ({ text, foodGroup: null, verification: ok })) }),
    allergenDeclaration: { status: 'not-declared', allergenIds: [], rawText: null, verification: ok },
    notes: [],
    verification: ok,
  };
}

export function noLunch(date: string, reason: NoLunchDay['reason'] = 'no-lunch', originalText = '午前保育（給食なし）'): NoLunchDay {
  return { date, reason, originalText, verification: ok };
}

export function menu(days: ExtractedDay[], noLunchDays: NoLunchDay[] = [], extra: Partial<ConfirmedMenu> = {}): ConfirmedMenu {
  return {
    month: '2026-11',
    version: 1,
    extractionId: null,
    confirmedAt: TS,
    days: [...days].sort((a, b) => a.date.localeCompare(b.date)),
    noLunchDays: [...noLunchDays].sort((a, b) => a.date.localeCompare(b.date)),
    changedDatesSincePrevious: [],
    ...extra,
  };
}

export function profile(likes: string[], dislikes: string[], extra: Partial<ChildProfile> = {}): ChildProfile {
  return {
    id: 'child-1',
    ageRange: 'age-4-5',
    likedIds: likes,
    dislikedIds: dislikes,
    allergyStatus: 'none-known',
    knownAllergenIds: [],
    excludedIngredientIds: [],
    diet: [],
    themeIds: [],
    ownerId: 'local',
    createdAt: TS,
    updatedAt: TS,
    ...extra,
  };
}

/** The sample child of the stories (US-E4-01/AC1). */
export const PS = profile(['ing-chicken', 'ing-egg', 'ing-corn'], ['ing-green-pepper', 'ing-eggplant', 'cat-fish'], {
  allergyStatus: 'has-known',
  knownAllergenIds: ['alg-shrimp'],
  themeIds: ['theme-animals'],
});

export function override(date: string, state: AssessmentOverride['state'], menuVersionAtSet = 1): AssessmentOverride {
  return { date, state, setAt: TS, menuVersionAtSet, ownerId: 'local', createdAt: TS, updatedAt: TS };
}

export function storeWith(parts: {
  menus?: ConfirmedMenu[];
  profile?: ChildProfile | null;
  decisions?: DayDecision[];
  overrides?: AssessmentOverride[];
}): BentoMinderStore {
  const base = createEmptyStore({ deviceId: '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d', now: Date.parse('2026-10-28T11:00:00Z') as Instant });
  const menus: BentoMinderStore['menus'] = {};
  for (const c of parts.menus ?? []) {
    menus[c.month] = { month: c.month, extractions: [], confirmed: c, ownerId: 'local', createdAt: TS, updatedAt: TS };
  }
  return {
    ...base,
    profile: parts.profile === undefined ? null : parts.profile,
    menus,
    decisions: Object.fromEntries((parts.decisions ?? []).map((x) => [x.date, x])),
    overrides: Object.fromEntries((parts.overrides ?? []).map((x) => [x.date, x])),
  };
}

export function decisionRecord(date: string, state: DayDecision['state'], extra: Partial<DayDecision> = {}): DayDecision {
  const bento = state === 'homemade-bento-planned';
  return {
    date,
    state,
    ...(bento
      ? {
          recipeId: 'rcp-kuma-onigiri',
          recipeNameSnapshot: { ja: 'くまさんおにぎり弁当', en: 'Bear onigiri bento' },
          recipeShortNameSnapshot: { ja: 'くまおにぎり', en: 'Bear oni' },
          plannedAt: '2026-11-01T10:12:00+09:00',
        }
      : {}),
    reservationDoneExternally: false,
    decidedAt: '2026-11-01T10:12:00+09:00',
    history: [{ state: state as Exclude<DayDecision['state'], 'no-school-lunch'>, ...(bento ? { recipeId: 'rcp-kuma-onigiri' } : {}), at: '2026-11-01T10:12:00+09:00' }],
    ownerId: 'local',
    createdAt: '2026-11-01T10:12:00+09:00',
    updatedAt: '2026-11-01T10:12:00+09:00',
    ...extra,
  };
}
