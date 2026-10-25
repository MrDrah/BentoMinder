// Property tests for the core rules (BR-01, BR-02, BR-13, BR-27): assessment is order independent
// and never reads decisions; no operation without a parent action changes a decision; every
// accepted event leaves a record that satisfies the contract.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createAssessor } from '../../../src/domain/assessment/assess.ts';
import { clearOverride, setOverride } from '../../../src/domain/assessment/override.ts';
import { createDayViewer } from '../../../src/domain/calendar/day-view.ts';
import { applyDecisionEvent, dayContextOf } from '../../../src/domain/decision/apply.ts';
import { transition, type DecisionEvent, type RecipeRef } from '../../../src/domain/decision/decision.ts';
import { storeConfirmedMenu } from '../../../src/domain/menu/store-ops.ts';
import { saveProfile } from '../../../src/domain/profile/profile.ts';
import { dayDecisionSchema, type BentoMinderStore, type ChildProfile } from '../../../src/domain/schema/index.ts';
import { addDays, datesOfMonth, todayJst, type Instant, type LocalDate, type YearMonth } from '../../../src/domain/time/jst.ts';
import { d, day, decisionRecord, dict, menu, noLunch, profile, storeWith, type ItemSpec } from '../helpers/menus.ts';

const assess = createAssessor(dict);

// A pool of lunch texts: dishes, ingredients, ambiguity forms and unknown words (every group of the rules).
const ITEM_POOL = [
  'ピーマンとなすのみそ炒め', 'さけのしおやき', 'さばのみそ煮', '豚のしょうが焼き', '鶏のから揚げ', '鶏もも肉のてりやき', '鶏肉のソテー', '鶏むね肉のサラダ',
  'コーンスープ', 'みそ汁', 'ごはん', '卵焼き', 'ポテトサラダ', 'カレーうどん', 'カレー', 'カレーライス', 'もも', 'あじ', 'アジフライ', '給食なし', 'なし', 'いものにもの',
  'そば', '焼きそば', 'パン', 'フライパン', '白身魚のフライ', 'ちくわの磯辺揚げ', 'ナン', 'ふりかけ', 'ビビンバ', 'りんご', 'バナナ', '八宝菜', '親子丼', '豚汁',
] as const;
const INGREDIENT_POOL = ['ピーマン', 'なす', '鶏肉', '鶏もも肉', 'にんじん', '米', 'たまねぎ', 'ぶた肉', 'しょうが', 'さば', '鮭', 'みそ', '卵', 'みつば'] as const;
const FOOD_IDS = [
  ...dict.ingredients.filter((i) => !i.seasoning).map((i) => i.id),
  ...dict.categories.map((c) => c.id),
  ...dict.dishes.map((x) => x.id),
];

const itemArb = fc.constantFrom(...ITEM_POOL);
const kindArb = fc.constantFrom('main', 'side', 'staple', 'soup', 'snack');
const itemsArb = fc.array(fc.tuple(itemArb, kindArb), { minLength: 1, maxLength: 7 });
const profileArb = fc
  .tuple(fc.uniqueArray(fc.constantFrom(...FOOD_IDS), { maxLength: 6 }), fc.uniqueArray(fc.constantFrom(...FOOD_IDS), { maxLength: 6 }))
  .map(([likes, dislikes]) => {
    const dis = dislikes.filter((x) => !likes.includes(x));
    return profile(likes, dis);
  });

function assessOf(p: ChildProfile, items: [string, string][], ingredients: string[] | undefined) {
  const specs: ItemSpec[] = items.map(([text, kind]) => ({ text, kind: kind as 'main' }));
  const m = menu([day('2026-11-04', specs, ingredients)]);
  return assess({ date: d('2026-11-04'), menu: m, profile: p });
}

const essence = (a: ReturnType<typeof assessOf>) =>
  a === null
    ? null
    : {
        state: a.calculatedState,
        key: a.explanationKey,
        d: a.explanationParams.dislikedCount,
        l: a.explanationParams.likedCount,
        liked: [...a.matched.likedIds].sort(),
        disliked: [...a.matched.dislikedIds].sort(),
        u: a.matched.unmatchedItems.length + a.matched.ambiguousItems.length,
      };

describe('US-E4-01/AC7 assessment is deterministic and independent of order (BR-04)', () => {
  it('US-E4-01/AC7 shuffling the items, the listed ingredients and the likes and dislikes changes neither state, counts nor matched ids', () => {
    fc.assert(
      fc.property(
        profileArb,
        itemsArb,
        fc.option(fc.array(fc.constantFrom(...INGREDIENT_POOL), { minLength: 1, maxLength: 6 }), { nil: undefined }),
        fc.infiniteStream(fc.nat()),
        (p, items, ingredients, stream) => {
          const base = essence(assessOf(p, items, ingredients));
          const shuffle = <T,>(xs: T[]): T[] => {
            const out = [...xs];
            const it = stream[Symbol.iterator]();
            for (let i = out.length - 1; i > 0; i -= 1) {
              const j = it.next().value % (i + 1);
              [out[i], out[j]] = [out[j] as T, out[i] as T];
            }
            return out;
          };
          const shuffledProfile = profile(shuffle(p.likedIds), shuffle(p.dislikedIds));
          expect(essence(assessOf(shuffledProfile, shuffle(items), ingredients === undefined ? undefined : shuffle(ingredients)))).toEqual(base);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('US-E4-01/AC7 D and L never exceed the number of distinct found foods; the state follows the BR-04 rules for the reported D, L, U', () => {
    fc.assert(
      fc.property(profileArb, itemsArb, (p, items) => {
        const a = assessOf(p, items, undefined);
        if (a === null) return;
        const dd = a.explanationParams.dislikedCount;
        const ll = a.explanationParams.likedCount;
        const assessed = items.filter(([, k]) => k !== 'snack').length;
        const u = a.matched.unmatchedItems.length + a.matched.ambiguousItems.length;
        expect(u).toBeLessThanOrEqual(assessed);
        expect(a.matched.dislikedIds.length).toBe(dd);
        expect(new Set([...a.matched.dislikedIds, ...a.matched.likedIds]).size).toBe(dd + ll); // a food has at most one verdict
        const noPrefs = p.likedIds.length === 0 && p.dislikedIds.length === 0;
        const expected = noPrefs ? 'not-assessed' : dd >= 2 || (dd === 1 && ll === 0) ? 'low-preference' : dd === 1 ? 'mixed-uncertain' : ll >= 1 && 2 * u <= assessed ? 'likely-enjoyable' : 'mixed-uncertain';
        expect(a.calculatedState).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });
});

const TODAY_ISO = '2026-11-02T01:00:00Z';
const NOW = Date.parse(TODAY_ISO) as Instant;
const R1: RecipeRef = { id: 'rcp-kuma-onigiri', name: { ja: 'くまさんおにぎり弁当', en: 'Bear onigiri bento' }, shortNameJa: 'くまおにぎり', shortNameEn: 'Bear oni' };
const R2: RecipeRef = { id: 'rcp-hoshi-omelette', name: { ja: '星のオムレツ弁当' }, shortNameJa: 'ほしオムレツ', shortNameEn: 'Star egg' };
const library = new Map([R1, R2].map((r) => [r.id, r]));
const env = (now: Instant) => ({ today: todayJst(now), now, recipe: (id: string) => library.get(id) });

const MONTH = '2026-11' as YearMonth;
const DATES = datesOfMonth(MONTH);

function baseStore(): BentoMinderStore {
  const lunch = ['2026-11-02', '2026-11-04', '2026-11-05', '2026-11-11', '2026-11-12', '2026-11-18'].map((x) => day(x, ['ピーマンとなすのみそ炒め', 'ごはん']));
  return storeWith({
    profile: profile(['ing-egg'], ['ing-eggplant']),
    menus: [menu(lunch, [noLunch('2026-11-20', 'bento-day', 'お弁当の日'), noLunch('2026-11-27')])],
  });
}

const eventArb: fc.Arbitrary<DecisionEvent> = fc.oneof(
  fc.constantFrom(R1.id, R2.id, 'rcp-unknown').map((recipeId): DecisionEvent => ({ type: 'CONFIRM_RECIPE', recipeId })),
  fc.constantFrom(R1.id, R2.id).map((recipeId): DecisionEvent => ({ type: 'CHANGE_RECIPE', recipeId })),
  fc.constant<DecisionEvent>({ type: 'DEFER' }),
  fc.constant<DecisionEvent>({ type: 'SET_SCHOOL_LUNCH' }),
  fc.constant<DecisionEvent>({ type: 'CLEAR_PLAN' }),
  fc.constant<DecisionEvent>({ type: 'KEEP_PLAN' }),
  fc.boolean().map((done): DecisionEvent => ({ type: 'MARK_RESERVATION', done })),
);
const dateArb = fc.constantFrom(...DATES);
const clockArb = fc.constantFrom('2026-11-02T01:00:00Z', '2026-11-04T23:30:00Z', '2026-11-11T05:00:00Z', '2026-11-20T01:00:00Z');

describe('BR-02 every decision change comes from an accepted parent event', () => {
  it('BR-02 over random event sequences: a rejected event changes nothing, only the targeted date changes, no past write, every record satisfies the contract', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(dateArb, eventArb, clockArb), { minLength: 1, maxLength: 30 }), (steps) => {
        let store = baseStore();
        for (const [date, event, iso] of steps) {
          const now = Date.parse(iso) as Instant;
          const before = store;
          const result = applyDecisionEvent(store, d(date), event, env(now));
          if (!result.ok) {
            expect(store).toBe(before);
            continue;
          }
          expect(date >= todayJst(now)).toBe(true); // BR-27: no write for a past date
          store = result.store;
          for (const other of Object.keys(before.decisions).filter((x) => x !== date)) expect(store.decisions[other]).toEqual(before.decisions[other]);
          const rec = store.decisions[date];
          if (rec !== undefined) {
            expect(dayDecisionSchema.safeParse(rec).success).toBe(true);
            expect(rec.state).not.toBe('no-school-lunch'); // decision-no-lunch-not-stored
            expect(rec.plannedAt !== undefined).toBe(rec.state === 'homemade-bento-planned');
            expect(rec.history.length).toBeLessThanOrEqual(5);
            if (rec.state === 'homemade-bento-planned') expect(library.has(rec.recipeId ?? '')).toBe(true);
          }
          // a date reaches homemade-bento-planned only through CONFIRM_RECIPE or stays there through CHANGE_RECIPE / KEEP_PLAN
          if (rec?.state === 'homemade-bento-planned' && before.decisions[date]?.state !== 'homemade-bento-planned') expect(event.type).toBe('CONFIRM_RECIPE');
          // a school-lunch reservation tick is never set outside school-lunch-planned
          expect(rec === undefined || !rec.reservationDoneExternally || rec.state === 'school-lunch-planned').toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('BR-02 with no event, no sequence of assessments, profile edits, overrides, menu refreshes and clock advances changes a decision (US-E5-04/AC1)', () => {
    const decisions = [decisionRecord('2026-11-04', 'homemade-bento-planned'), decisionRecord('2026-11-05', 'not-confirmed'), decisionRecord('2026-11-12', 'school-lunch-planned', { reservationDoneExternally: true })];
    const start = { ...baseStore(), decisions: Object.fromEntries(decisions.map((x) => [x.date, x])) };
    const view = createDayViewer(dict);
    const opArb = fc.oneof(
      fc.constantFrom(...DATES).map((date) => ({ kind: 'assess' as const, date })),
      fc.constantFrom(...DATES).map((date) => ({ kind: 'clock' as const, date })),
      profileArb.map((p) => ({ kind: 'profile' as const, p })),
      fc.tuple(dateArb, fc.constantFrom('likely-enjoyable', 'mixed-uncertain', 'low-preference'), fc.boolean()).map(([date, state, clear]) => ({ kind: 'override' as const, date, state, clear })),
      fc.uniqueArray(dateArb, { minLength: 1, maxLength: 8 }).map((dates) => ({ kind: 'refresh' as const, dates })),
    );
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 25 }), (ops) => {
        let store: BentoMinderStore = start;
        for (const op of ops) {
          if (op.kind === 'assess') view(store, d(op.date), d('2026-11-02'));
          else if (op.kind === 'clock') {
            const today = addDays(d(op.date), 1);
            view(store, d(op.date), today);
          } else if (op.kind === 'profile') store = saveProfile(store, { ...op.p, id: 'child-1' } as ChildProfile, NOW);
          else if (op.kind === 'override') {
            const r = op.clear ? clearOverride(store, d(op.date), env(NOW)) : setOverride(store, d(op.date), op.state as 'low-preference', env(NOW));
            if (r.ok) store = r.store;
          } else {
            const sorted = [...op.dates].sort() as LocalDate[];
            const lunch = sorted.filter((x, i) => i % 2 === 0).map((x) => day(x, ['ごはん', 'みそ汁']));
            const nl = sorted.filter((x, i) => i % 2 === 1).map((x) => noLunch(x));
            const prev = store.menus[MONTH]?.confirmed;
            store = storeConfirmedMenu(store, menu(lunch, nl, { version: (prev?.version ?? 0) + 1, changedDatesSincePrevious: prev === undefined || prev === null ? [] : sorted }), NOW);
          }
          expect(store.decisions).toEqual(start.decisions);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('BR-01 the displayed assessment never depends on decisions, and a decision event never changes an assessment', () => {
    const view = createDayViewer(dict);
    fc.assert(
      fc.property(fc.array(fc.tuple(dateArb, eventArb), { maxLength: 12 }), (steps) => {
        const plain = baseStore();
        const assessments = (s: BentoMinderStore) => DATES.map((date) => JSON.stringify(view(s, date, d('2026-11-02')).assessment));
        const reference = assessments(plain);
        let store = plain;
        for (const [date, event] of steps) {
          const r = applyDecisionEvent(store, d(date), event, env(NOW));
          if (r.ok) store = r.store;
          expect(assessments(store)).toEqual(reference);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('BR-01 transition takes (context, record, event, env) and nothing that could carry an assessment', () => {
    expect(transition.length).toBe(4);
    const ctx = dayContextOf(baseStore(), d('2026-11-04'));
    expect(Object.keys(ctx).sort()).toEqual(['changedInCurrentVersion', 'date', 'kind', 'menuVersion']);
  });
});
