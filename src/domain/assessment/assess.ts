// Preference assessment (BR-04, BR-05, BR-25; ADR 004 §1; data contract §3.5; user-stories E4).
// A pure function of the dictionary, the confirmed menu, the profile and the date's override.
// It has no parameter through which it could read or write decisions (BR-01, rule
// `assessment-independent`): the module imports nothing from the decision engine.
import { BR04 } from '../rules.ts';
import { dayTypeOf } from '../menu/day-kind.ts';
import type { AssessmentOverride, ChildProfile, ConfirmedMenu, ExtractedDay } from '../schema/index.ts';
import type { Dictionary } from '../schema/dictionary.ts';
import { weekdayOf, type LocalDate } from '../time/jst.ts';
import { dictIndex, type DictIndex } from './dictionary-index.ts';
import { matcherFor } from './matcher.ts';

export type AssessmentState = 'likely-enjoyable' | 'mixed-uncertain' | 'low-preference' | 'not-assessed' | 'no-school-lunch';
export type ExplanationKey =
  | 'assess.likely'
  | 'assess.mixedOne'
  | 'assess.mixedUnknown'
  | 'assess.mixedNeutral'
  | 'assess.low'
  | 'assess.notAssessed'
  | 'assess.noLunch'
  | 'assess.override';

export interface Assessment {
  date: LocalDate;
  calculatedState: AssessmentState;
  state: AssessmentState;
  explanationKey: ExplanationKey;
  /** The key of the calculated state, shown under `assess.override` ("the app's assessment was …"). */
  calculatedExplanationKey: ExplanationKey;
  explanationParams: {
    weekday: number;
    dislikedCount: number;
    likedCount: number;
    /** Japanese labels of the first 3 counted foods; the counts are always the full D and L. */
    dislikedLabels: string[];
    likedLabels: string[];
    /** The same foods as dictionary ids, so the screen can show them in the active language. */
    dislikedLabelIds: string[];
    likedLabelIds: string[];
    /** Up to 3 item texts that counted towards U, in menu order. */
    unmatched: string[];
    /** All items that counted towards U (for "and N more"). */
    unmatchedTotal: number;
  };
  matched: {
    likedIds: string[];
    dislikedIds: string[];
    unmatchedItems: string[];
    ambiguousItems: string[];
    /** Per item of the day (same order as `day.items`): the verdict of the foods found in it. */
    itemVerdicts: ('like' | 'dislike' | null)[];
  };
  menuVersion: number;
  override: AssessmentOverride | null;
}

export interface AssessInput {
  date: LocalDate;
  menu: ConfirmedMenu | null;
  profile: ChildProfile | null;
  override?: AssessmentOverride | null;
}

export type Assessor = (input: AssessInput) => Assessment | null;

type Verdict = 'like' | 'dislike' | null;

interface Food {
  rep: string;
  dish: string | null;
  /** Level-1 ingredient ids: the defining ingredient, or the descendant plus its folded ancestors. */
  members: string[];
  order: number;
}

interface Counted {
  verdict: Verdict;
  labelId: string | null;
}

const ORDER_ITEM = 10_000;
const ORDER_LIST = 10_000_000;
const SHOWN = 3;

const emptyParams = (date: LocalDate): Assessment['explanationParams'] => ({
  weekday: weekdayOf(date),
  dislikedCount: 0,
  likedCount: 0,
  dislikedLabels: [],
  likedLabels: [],
  dislikedLabelIds: [],
  likedLabelIds: [],
  unmatched: [],
  unmatchedTotal: 0,
});

const emptyMatched = (): Assessment['matched'] => ({ likedIds: [], dislikedIds: [], unmatchedItems: [], ambiguousItems: [], itemVerdicts: [] });

/** Verdict of one food by the most specific profile entry: ingredient → dish → category (H1 closing rulings). */
function verdictOf(food: Food, idx: DictIndex, likes: ReadonlySet<string>, dislikes: ReadonlySet<string>): Counted {
  const levels: { entryId: string; carrier: string }[][] = [];
  const seasoning = food.dish === null && food.members.length === 1 && idx.isSeasoning(food.rep);
  levels.push(food.members.map((m) => ({ entryId: m, carrier: m })));
  if (!seasoning) {
    // parent ingredients, nearest first
    const ancestors = food.members.map((m) => idx.ingredientAncestors(m));
    const depth = Math.max(0, ...ancestors.map((a) => a.length));
    for (let d = 0; d < depth; d += 1) {
      levels.push(ancestors.flatMap((a, i) => (a[d] === undefined ? [] : [{ entryId: a[d] as string, carrier: food.members[i] as string }])));
    }
    if (food.dish !== null) levels.push([{ entryId: food.dish, carrier: food.dish }]);
    // the categories of those ids, then the categories' ancestors, nearest first
    const carriers = [...food.members, ...(food.dish === null ? [] : [food.dish])];
    const catLevels = carriers.map((c) => idx.categoryLevels(c));
    const catDepth = Math.max(0, ...catLevels.map((l) => l.length));
    for (let d = 0; d < catDepth; d += 1) {
      levels.push(catLevels.flatMap((l, i) => (l[d] ?? []).map((c) => ({ entryId: c, carrier: carriers[i] as string }))));
    }
  }
  for (const level of levels) {
    const disliked = level.find((e) => dislikes.has(e.entryId));
    if (disliked !== undefined) return { verdict: 'dislike', labelId: disliked.carrier }; // a dislike beats a like at the same level
    const liked = level.find((e) => likes.has(e.entryId));
    if (liked !== undefined) return { verdict: 'like', labelId: liked.carrier };
  }
  return { verdict: null, labelId: null };
}

export function createAssessor(dict: Dictionary): Assessor {
  const idx = dictIndex(dict);
  const matcher = matcherFor(dict);

  function compute(day: ExtractedDay, profile: ChildProfile) {
    const likes = new Set(profile.likedIds);
    const dislikes = new Set(profile.dislikedIds);

    interface ItemInfo {
      index: number;
      text: string;
      ids: Set<string>;
      uncertain: 'unmatched' | 'ambiguous' | null;
    }
    const nodes = new Map<string, number>(); // id → order of first appearance
    const touch = (id: string, order: number) => {
      if (!nodes.has(id)) nodes.set(id, order);
    };
    const items: ItemInfo[] = [];
    day.items.forEach((item, index) => {
      if (item.kind === 'snack') return; // shown, never assessed (OQ-07)
      const m = matcher.match(item.text);
      const ids = new Set(m.found.map((f) => f.id));
      m.found.forEach((f) => touch(f.id, index * ORDER_ITEM + f.pos));
      let parentResolved = false;
      if (item.resolvedIds !== undefined && m.unresolved.length > 0) {
        // the parent's choice on review (contract §3.3 resolvedIds): used as-is, the form is no longer unresolved
        const candidates = new Set(m.unresolved.flatMap((u) => idx.groups.get(u.groupId)?.candidateIds ?? []));
        const at = m.unresolved[0]?.pos ?? 0;
        for (const id of item.resolvedIds) {
          if (candidates.has(id)) {
            ids.add(id);
            touch(id, index * ORDER_ITEM + at);
          }
        }
        parentResolved = true;
      }
      const uncertain: ItemInfo['uncertain'] = parentResolved ? null : m.unresolved.length > 0 ? 'ambiguous' : ids.size === 0 ? 'unmatched' : null;
      items.push({ index, text: item.text, ids, uncertain });
    });
    if (day.ingredientsStatus === 'listed') {
      const list = day.ingredients ?? [];
      const seasoningIn = (text: string | undefined): boolean =>
        text !== undefined && matcher.match(text, { kind: 'ingredient', neighbourSeasoning: false }).found.some((f) => idx.isSeasoning(f.id));
      list.forEach((ing, i) => {
        const m = matcher.match(ing.text, { kind: 'ingredient', neighbourSeasoning: seasoningIn(list[i - 1]?.text) || seasoningIn(list[i + 1]?.text) });
        m.found.forEach((f) => touch(f.id, ORDER_LIST + i * 100 + f.pos));
      });
    }

    // Foods (OQ-16 narrowed, never transitive): a dish and its defining ingredient found in the
    // same item are one food; an id identical to such a defining ingredient found anywhere else is
    // counted through that dish; an ancestor ingredient folds into each found descendant.
    const defining = new Map<string, string>();
    const absorbed = new Set<string>();
    for (const item of items) {
      for (const id of item.ids) {
        if (!id.startsWith('dish-')) continue;
        const g = idx.dishes.get(id)?.definingIngredientId ?? null;
        if (g !== null && item.ids.has(g)) {
          defining.set(id, g);
          absorbed.add(g);
        }
      }
    }
    const ingredientNodes = [...nodes.keys()].filter((id) => !id.startsWith('dish-') && !absorbed.has(id));
    const foldedInto = new Map<string, string[]>();
    const folded = new Set<string>();
    for (const x of ingredientNodes) {
      for (const a of idx.ingredientAncestors(x)) {
        if (ingredientNodes.includes(a)) {
          folded.add(a);
          foldedInto.set(x, [...(foldedInto.get(x) ?? []), a]);
        }
      }
    }
    const orderOf = (id: string) => nodes.get(id) ?? Number.MAX_SAFE_INTEGER;
    const foods: Food[] = [];
    for (const id of nodes.keys()) {
      if (id.startsWith('dish-')) {
        const g = defining.get(id);
        foods.push({ rep: id, dish: id, members: g === undefined ? [] : [g], order: Math.min(orderOf(id), g === undefined ? Infinity : orderOf(g)) });
      } else if (!absorbed.has(id) && !folded.has(id)) {
        const members = [id, ...(foldedInto.get(id) ?? [])];
        foods.push({ rep: id, dish: null, members, order: Math.min(...members.map(orderOf)) });
      }
    }
    foods.sort((a, b) => a.order - b.order || a.rep.localeCompare(b.rep));

    const counted = foods.map((food) => ({ food, ...verdictOf(food, idx, likes, dislikes) }));
    const disliked = counted.filter((c) => c.verdict === 'dislike');
    const liked = counted.filter((c) => c.verdict === 'like');

    const itemVerdicts: ('like' | 'dislike' | null)[] = day.items.map(() => null);
    for (const item of items) {
      const touches = (c: (typeof counted)[number]) => [c.food.rep, ...c.food.members, ...(c.food.dish === null ? [] : [c.food.dish])].some((id) => item.ids.has(id));
      itemVerdicts[item.index] = disliked.some(touches) ? 'dislike' : liked.some(touches) ? 'like' : null;
    }
    const uncertainItems = items.filter((i) => i.uncertain !== null);
    return {
      d: disliked.length,
      l: liked.length,
      assessed: items.length,
      uncertain: uncertainItems.length,
      disliked,
      liked,
      unmatchedItems: items.filter((i) => i.uncertain === 'unmatched').map((i) => i.text),
      ambiguousItems: items.filter((i) => i.uncertain === 'ambiguous').map((i) => i.text),
      uncertainTexts: uncertainItems.map((i) => i.text),
      itemVerdicts,
    };
  }

  return function assess({ date, menu, profile, override }) {
    const type = dayTypeOf(menu, date);
    if (menu === null) return null;
    const base = { date, menuVersion: menu.version };

    if (type.type === 'bento-day' || type.type === 'no-lunch') {
      // Rule 1 comes before the override (B6): an override on this date stays dormant, not applied.
      return {
        ...base,
        calculatedState: 'no-school-lunch',
        state: 'no-school-lunch',
        explanationKey: 'assess.noLunch',
        calculatedExplanationKey: 'assess.noLunch',
        explanationParams: emptyParams(date),
        matched: emptyMatched(),
        override: null,
      };
    }
    if (type.type !== 'school') return null; // BR-25: not a school day, no assessment

    let calculatedState: AssessmentState;
    let key: ExplanationKey;
    let params = emptyParams(date);
    let matched = emptyMatched();
    if (profile === null || (profile.likedIds.length === 0 && profile.dislikedIds.length === 0)) {
      calculatedState = 'not-assessed';
      key = 'assess.notAssessed';
    } else {
      const c = compute(type.day, profile);
      const unknownShare = BR04.uncertainShareDenominator * c.uncertain > BR04.uncertainShareNumerator * c.assessed; // U > 50%, exact
      if (c.d >= BR04.lowPreferenceDislikes || (c.d === 1 && c.l === 0)) {
        calculatedState = 'low-preference';
        key = 'assess.low';
      } else if (c.d === 1) {
        calculatedState = 'mixed-uncertain';
        key = 'assess.mixedOne';
      } else if (c.l >= 1 && !unknownShare) {
        calculatedState = 'likely-enjoyable';
        key = 'assess.likely';
      } else {
        calculatedState = 'mixed-uncertain';
        key = unknownShare ? 'assess.mixedUnknown' : 'assess.mixedNeutral';
      }
      const labelIds = (xs: { food: Food; labelId: string | null }[]) => xs.slice(0, SHOWN).map((x) => x.labelId ?? x.food.rep);
      const dislikedLabelIds = labelIds(c.disliked);
      const likedLabelIds = labelIds(c.liked);
      params = {
        weekday: weekdayOf(date),
        dislikedCount: c.d,
        likedCount: c.l,
        dislikedLabels: dislikedLabelIds.map((id) => idx.label(id, 'ja')),
        likedLabels: likedLabelIds.map((id) => idx.label(id, 'ja')),
        dislikedLabelIds,
        likedLabelIds,
        unmatched: c.uncertainTexts.slice(0, SHOWN),
        unmatchedTotal: c.uncertain,
      };
      matched = {
        likedIds: c.liked.map((x) => x.food.rep),
        dislikedIds: c.disliked.map((x) => x.food.rep),
        unmatchedItems: c.unmatchedItems,
        ambiguousItems: c.ambiguousItems,
        itemVerdicts: c.itemVerdicts,
      };
    }
    const applied = override ?? null;
    return {
      ...base,
      calculatedState,
      state: applied === null ? calculatedState : applied.state,
      explanationKey: applied === null ? key : 'assess.override',
      calculatedExplanationKey: key,
      explanationParams: params,
      matched,
      override: applied,
    };
  };
}
