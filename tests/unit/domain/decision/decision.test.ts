// Decision state machine (BR-02, BR-03, BR-13, BR-17, BR-19, BR-25, BR-27; ADR 004 §2; user-stories
// E5 and E3-05): the transition table, the guards, the record fields and the refresh-conflict rows.
import { describe, expect, it } from 'vitest';
import { applyDecisionEvent, dayContextOf } from '../../../../src/domain/decision/apply.ts';
import { allowedEvents, displayedDecision, transition, type DecisionEvent, type RecipeRef, type TransitionEnv } from '../../../../src/domain/decision/decision.ts';
import { dayDecisionSchema, toRuleIssues } from '../../../../src/domain/schema/index.ts';
import type { BentoMinderStore, DayDecision } from '../../../../src/domain/schema/index.ts';
import { todayJst, type Instant } from '../../../../src/domain/time/jst.ts';
import { d, day, decisionRecord, menu, noLunch, PS, storeWith } from '../../helpers/menus.ts';

const R1: RecipeRef = { id: 'rcp-kuma-onigiri', name: { ja: 'くまさんおにぎり弁当', en: 'Bear onigiri bento' }, shortNameJa: 'くまおにぎり', shortNameEn: 'Bear oni' };
const R2: RecipeRef = { id: 'rcp-hoshi-omelette', name: { ja: '星のオムレツ弁当' }, shortNameJa: 'ほしオムレツ', shortNameEn: 'Star egg' };
const library = new Map([R1, R2].map((r) => [r.id, r]));

const NOW_ISO = '2026-11-02T01:00:00Z'; // 2026-11-02 10:00 JST
const at = (iso: string) => Date.parse(iso) as Instant;
const env = (iso = NOW_ISO, extra: Partial<TransitionEnv> = {}): TransitionEnv => ({ today: todayJst(at(iso)), now: at(iso), recipe: (id) => library.get(id), ...extra });

const SCHOOL = '2026-11-04';
const OTHER_SCHOOL = '2026-11-05';
const NC_DAY = '2026-11-11';
const BENTO_DAY = '2026-11-20';
const NO_LUNCH_DAY = '2026-11-27';

function november(decisions: DayDecision[] = [], version = 1, changed: string[] = []): BentoMinderStore {
  const lunch = ['2026-11-04', '2026-11-05', '2026-11-11', '2026-11-12', '2026-11-18'].map((date) => day(date, ['ごはん', 'ピーマンとなすのみそ炒め']));
  return storeWith({
    profile: PS,
    menus: [menu(lunch, [noLunch(BENTO_DAY, 'bento-day', 'お弁当の日'), noLunch(NO_LUNCH_DAY)], { version, changedDatesSincePrevious: changed })],
    decisions,
  });
}

const BENTO = (date: string, recipe: RecipeRef = R1, extra: Partial<DayDecision> = {}) =>
  decisionRecord(date, 'homemade-bento-planned', {
    recipeId: recipe.id,
    recipeNameSnapshot: recipe.name,
    recipeShortNameSnapshot: { ja: recipe.shortNameJa, en: recipe.shortNameEn },
    ...extra,
  });

function ok(store: BentoMinderStore, date: string, event: DecisionEvent, iso = NOW_ISO): BentoMinderStore {
  const r = applyDecisionEvent(store, d(date), event, env(iso));
  if (!r.ok) throw new Error(`rejected: ${r.error}`);
  return r.store;
}
const rejected = (store: BentoMinderStore, date: string, event: DecisionEvent, iso = NOW_ISO) => {
  const r = applyDecisionEvent(store, d(date), event, env(iso));
  expect(r.ok).toBe(false);
  return r.ok ? null : r.error;
};
const shown = (store: BentoMinderStore, date: string) => displayedDecision(dayContextOf(store, d(date)), store.decisions[date]);

const ALL: DecisionEvent[] = [
  { type: 'CONFIRM_RECIPE', recipeId: R2.id },
  { type: 'CHANGE_RECIPE', recipeId: R2.id },
  { type: 'DEFER' },
  { type: 'SET_SCHOOL_LUNCH' },
  { type: 'CLEAR_PLAN' },
  { type: 'KEEP_PLAN' },
  { type: 'MARK_RESERVATION', done: true },
];

describe('US-E5-03 choosing a bento records one confirmed recipe (BR-03)', () => {
  it('US-E5-03/AC2 CONFIRM_RECIPE plans the day: recipe, both name snapshots, decidedAt = plannedAt = now, history with that state', () => {
    const s = ok(november(), SCHOOL, { type: 'CONFIRM_RECIPE', recipeId: R1.id });
    expect(s.decisions[SCHOOL]).toMatchObject({
      state: 'homemade-bento-planned',
      recipeId: R1.id,
      recipeNameSnapshot: { ja: 'くまさんおにぎり弁当', en: 'Bear onigiri bento' },
      recipeShortNameSnapshot: { ja: 'くまおにぎり', en: 'Bear oni' },
      decidedAt: '2026-11-02T10:00:00+09:00',
      plannedAt: '2026-11-02T10:00:00+09:00',
      reservationDoneExternally: false,
      history: [{ state: 'homemade-bento-planned', recipeId: R1.id, at: '2026-11-02T10:00:00+09:00' }],
    });
    expect(dayDecisionSchema.safeParse(s.decisions[SCHOOL]).success).toBe(true);
  });

  it('US-E5-03/AC1 opening the recommendation view is not an event: nothing is stored without CONFIRM_RECIPE', () => {
    const store = november();
    expect(shown(store, SCHOOL).state).toBe('school-lunch-planned');
    expect(store.decisions).toEqual({});
  });

  it('US-E5-03/AC4 today can be planned (08:00 JST), the day before cannot', () => {
    const iso = '2026-11-03T23:00:00Z'; // 2026-11-04 08:00 JST
    expect(applyDecisionEvent(november(), d('2026-11-04'), { type: 'CONFIRM_RECIPE', recipeId: R1.id }, env(iso)).ok).toBe(true);
    expect(rejected(november(), '2026-11-04', { type: 'CONFIRM_RECIPE', recipeId: R1.id }, '2026-11-04T15:30:00Z')).toBe('DATE_IN_PAST');
  });

  it('US-E5-03/AC2 BR-03: a recipe that does not resolve or is refused by the hard filters is never planned', () => {
    expect(rejected(november(), SCHOOL, { type: 'CONFIRM_RECIPE', recipeId: 'rcp-does-not-exist' })).toBe('UNKNOWN_RECIPE');
    const r = applyDecisionEvent(november(), d(SCHOOL), { type: 'CONFIRM_RECIPE', recipeId: R1.id }, env(NOW_ISO, { isRecipeAllowed: () => false }));
    expect(r).toEqual({ ok: false, error: 'RECIPE_EXCLUDED' });
  });
});

describe('US-E5-04 / US-E5-05 low preference and not-confirmed never plan anything', () => {
  it('US-E5-04/AC1 US-E5-04/AC2 without a parent event every school day displays school-lunch-planned and no record exists', () => {
    const store = november();
    for (const date of ['2026-11-04', '2026-11-05', '2026-11-11']) expect(shown(store, date).state).toBe('school-lunch-planned');
    expect(Object.keys(store.decisions)).toHaveLength(0);
  });

  it('US-E5-05/AC1 DEFER stores not-confirmed without a recipe', () => {
    const s = ok(november(), NC_DAY, { type: 'DEFER' });
    expect(s.decisions[NC_DAY]).toMatchObject({ state: 'not-confirmed', reservationDoneExternally: false });
    expect(s.decisions[NC_DAY]).not.toHaveProperty('recipeId');
    expect(s.decisions[NC_DAY]).not.toHaveProperty('plannedAt');
  });

  it('US-E5-05/AC3 a not-confirmed day is not a planned day (no plannedAt, state is not bento)', () => {
    expect(shown(ok(november(), NC_DAY, { type: 'DEFER' }), NC_DAY).state).toBe('not-confirmed');
  });
});

describe('US-E5-06 change or cancel a bento plan', () => {
  const planned = () => november([BENTO(SCHOOL, R1, { plannedAt: '2026-11-01T10:00:00+09:00', decidedAt: '2026-11-01T10:00:00+09:00' })]);

  it('US-E5-06/AC1 CHANGE_RECIPE sets the new recipe and snapshots, decidedAt, keeps plannedAt', () => {
    const s = ok(planned(), SCHOOL, { type: 'CHANGE_RECIPE', recipeId: R2.id });
    expect(s.decisions[SCHOOL]).toMatchObject({
      recipeId: R2.id,
      recipeNameSnapshot: { ja: '星のオムレツ弁当' },
      recipeShortNameSnapshot: { ja: 'ほしオムレツ', en: 'Star egg' },
      plannedAt: '2026-11-01T10:00:00+09:00',
      decidedAt: '2026-11-02T10:00:00+09:00',
    });
    expect(s.decisions[SCHOOL]?.history.at(-1)).toEqual({ state: 'homemade-bento-planned', recipeId: R2.id, at: '2026-11-02T10:00:00+09:00' });
  });

  it('US-E5-06/AC1 changing to the same recipe is accepted and changes nothing', () => {
    const before = planned();
    const s = ok(before, SCHOOL, { type: 'CHANGE_RECIPE', recipeId: R1.id });
    expect(s.decisions[SCHOOL]).toEqual(before.decisions[SCHOOL]);
  });

  it('US-E5-06/AC2 SET_SCHOOL_LUNCH returns to school-lunch-planned, removes the recipe link and plannedAt', () => {
    const s = ok(planned(), SCHOOL, { type: 'SET_SCHOOL_LUNCH' });
    expect(s.decisions[SCHOOL]).toMatchObject({ state: 'school-lunch-planned', reservationDoneExternally: false });
    for (const field of ['recipeId', 'recipeNameSnapshot', 'recipeShortNameSnapshot', 'plannedAt']) expect(s.decisions[SCHOOL]).not.toHaveProperty(field);
    expect(dayDecisionSchema.safeParse(s.decisions[SCHOOL]).success).toBe(true);
  });

  it('US-E5-06/AC4 plannedAt is cleared when the day leaves homemade-bento-planned and set anew by the next first confirm', () => {
    const deferred = ok(planned(), SCHOOL, { type: 'DEFER' }, '2026-11-02T00:00:00Z');
    expect(deferred.decisions[SCHOOL]).not.toHaveProperty('plannedAt');
    const again = ok(deferred, SCHOOL, { type: 'CONFIRM_RECIPE', recipeId: R2.id }, '2026-11-02T11:00:00Z');
    expect(again.decisions[SCHOOL]?.plannedAt).toBe('2026-11-02T20:00:00+09:00');
    const changed = ok(again, SCHOOL, { type: 'CHANGE_RECIPE', recipeId: R1.id }, '2026-11-02T12:00:00Z');
    expect(changed.decisions[SCHOOL]?.plannedAt).toBe('2026-11-02T20:00:00+09:00');
    const school = ok(planned(), SCHOOL, { type: 'SET_SCHOOL_LUNCH' }, '2026-11-02T00:00:00Z');
    expect(school.decisions[SCHOOL]).not.toHaveProperty('plannedAt');
  });

  it('history keeps the last 5 changes: the 6th drops the oldest', () => {
    let s = november();
    const steps: DecisionEvent[] = [{ type: 'DEFER' }, { type: 'SET_SCHOOL_LUNCH' }, { type: 'CONFIRM_RECIPE', recipeId: R1.id }, { type: 'CHANGE_RECIPE', recipeId: R2.id }, { type: 'DEFER' }, { type: 'CONFIRM_RECIPE', recipeId: R1.id }];
    steps.forEach((e, i) => {
      s = ok(s, SCHOOL, e, `2026-11-02T0${i}:00:00Z`);
    });
    const h = s.decisions[SCHOOL]!.history;
    expect(h).toHaveLength(5);
    expect(h.map((x) => x.state)).toEqual(['school-lunch-planned', 'homemade-bento-planned', 'homemade-bento-planned', 'not-confirmed', 'homemade-bento-planned']);
  });
});

describe('US-E5 the allowed-transition table (anything else is rejected and writes nothing)', () => {
  const OFFER: Record<string, string[]> = {
    'school, derived school-lunch': ['CONFIRM_RECIPE', 'DEFER', 'MARK_RESERVATION'],
    'school, not-confirmed': ['CONFIRM_RECIPE', 'SET_SCHOOL_LUNCH'],
    'school, planned': ['DEFER', 'SET_SCHOOL_LUNCH', 'CHANGE_RECIPE'],
    'bento-day, not planned': ['CONFIRM_RECIPE'],
    'bento-day, planned': ['CHANGE_RECIPE', 'CLEAR_PLAN'],
    'other no-lunch day': [],
    'date outside the menu': [],
  };
  const setups: Record<string, [BentoMinderStore, string]> = {
    'school, derived school-lunch': [november(), SCHOOL],
    'school, not-confirmed': [november([decisionRecord(SCHOOL, 'not-confirmed')]), SCHOOL],
    'school, planned': [november([BENTO(SCHOOL)]), SCHOOL],
    'bento-day, not planned': [november(), BENTO_DAY],
    'bento-day, planned': [november([BENTO(BENTO_DAY)]), BENTO_DAY],
    'other no-lunch day': [november(), NO_LUNCH_DAY],
    'date outside the menu': [november(), '2026-11-07'],
  };

  it.each(Object.keys(OFFER))('US-E5-02/AC1 %s: exactly the table\'s events are accepted', (name) => {
    const [store, date] = setups[name]!;
    const accepted = ALL.filter((e) => applyDecisionEvent(store, d(date), e, env()).ok).map((e) => e.type);
    expect(accepted.sort()).toEqual([...OFFER[name]!].sort());
    // rejected events never write
    for (const e of ALL.filter((x) => !accepted.includes(x.type))) {
      const r = applyDecisionEvent(store, d(date), e, env());
      expect(r.ok).toBe(false);
    }
    expect(allowedEvents(dayContextOf(store, d(date)), store.decisions[date], todayJst(at(NOW_ISO))).sort()).toEqual([...OFFER[name]!].sort());
  });

  it('US-E5-08/AC2 US-E5-02/AC2 other no-lunch days and dates outside the menu are not plannable', () => {
    expect(rejected(november(), NO_LUNCH_DAY, { type: 'CONFIRM_RECIPE', recipeId: R1.id })).toBe('NOT_PLANNABLE_DAY');
    expect(rejected(november(), '2026-11-07', { type: 'DEFER' })).toBe('NOT_PLANNABLE_DAY');
  });

  it('US-E4-01/AC10 a snack-only date and a month without a confirmed menu take no decision (BR-25, BR-12)', () => {
    const snack = storeWith({ profile: PS, menus: [menu([day('2026-11-14', [['せんべい', 'snack']]), day(SCHOOL, ['ごはん'])])] });
    expect(rejected(snack, '2026-11-14', { type: 'DEFER' })).toBe('NOT_PLANNABLE_DAY');
    expect(rejected(november(), '2026-12-02', { type: 'DEFER' })).toBe('NOT_PLANNABLE_DAY');
  });

  it('US-E5-02/AC3 US-E5-04/AC1 dates before today are read-only for every event (BR-27); a stored plan stays', () => {
    const store = november([BENTO('2026-11-04')]);
    const later = '2026-11-05T01:00:00Z'; // 2026-11-05 10:00 JST: 11-04 is past
    for (const e of ALL) expect(rejected(store, SCHOOL, e, later)).toBe('DATE_IN_PAST');
    expect(shown(store, SCHOOL).state).toBe('homemade-bento-planned');
  });

  it('BR-15 "today" is the Tokyo date: at 00:30 JST with the device still on the previous day, 11-04 is writable and 11-03 is not', () => {
    const iso = '2026-11-03T15:30:00Z'; // 2026-11-04 00:30 JST
    expect(applyDecisionEvent(november(), d('2026-11-04'), { type: 'DEFER' }, env(iso)).ok).toBe(true);
    const store = storeWith({ profile: PS, menus: [menu([day('2026-11-03', ['ごはん']), day('2026-11-04', ['ごはん'])])] });
    expect(rejected(store, '2026-11-03', { type: 'DEFER' }, iso)).toBe('DATE_IN_PAST');
  });
});

describe('US-E5-07 the reservation record is the parent\'s own (BR-19)', () => {
  it('US-E5-07/AC3 ticking stores school-lunch-planned with the flag; unticking clears it; changing the state clears it too', () => {
    const ticked = ok(november(), OTHER_SCHOOL, { type: 'MARK_RESERVATION', done: true });
    expect(ticked.decisions[OTHER_SCHOOL]).toMatchObject({ state: 'school-lunch-planned', reservationDoneExternally: true });
    expect(ticked.decisions[OTHER_SCHOOL]?.history).toEqual([]); // the tick is not a state change
    const unticked = ok(ticked, OTHER_SCHOOL, { type: 'MARK_RESERVATION', done: false });
    expect(unticked.decisions[OTHER_SCHOOL]?.reservationDoneExternally).toBe(false);
    expect(ok(ticked, OTHER_SCHOOL, { type: 'CONFIRM_RECIPE', recipeId: R1.id }).decisions[OTHER_SCHOOL]?.reservationDoneExternally).toBe(false);
    expect(ok(ticked, OTHER_SCHOOL, { type: 'DEFER' }).decisions[OTHER_SCHOOL]?.reservationDoneExternally).toBe(false);
  });

  it('US-E5-07/AC3 unticking something never ticked is refused; ticking a bento or a bento-day is refused', () => {
    expect(rejected(november(), OTHER_SCHOOL, { type: 'MARK_RESERVATION', done: false })).toBe('INVALID_TRANSITION');
    expect(rejected(november([BENTO(SCHOOL)]), SCHOOL, { type: 'MARK_RESERVATION', done: true })).toBe('INVALID_TRANSITION');
    expect(rejected(november(), BENTO_DAY, { type: 'MARK_RESERVATION', done: true })).toBe('INVALID_TRANSITION');
  });
});

describe('US-E5-08 plan a bento on the school\'s お弁当の日', () => {
  it('US-E5-08/AC1 an お弁当の日 can be planned and then shows the plan', () => {
    const s = ok(november(), BENTO_DAY, { type: 'CONFIRM_RECIPE', recipeId: R1.id });
    expect(shown(s, BENTO_DAY)).toMatchObject({ state: 'homemade-bento-planned', conflict: 'none' });
  });

  it('US-E5-08/AC3 CLEAR_PLAN removes the stored decision; the day shows no-school-lunch; 給食に戻す and あとで決める are never offered', () => {
    const planned = ok(november(), BENTO_DAY, { type: 'CONFIRM_RECIPE', recipeId: R1.id });
    const cleared = ok(planned, BENTO_DAY, { type: 'CLEAR_PLAN' });
    expect(cleared.decisions[BENTO_DAY]).toBeUndefined();
    expect(shown(cleared, BENTO_DAY).state).toBe('no-school-lunch');
    for (const e of [{ type: 'DEFER' }, { type: 'SET_SCHOOL_LUNCH' }] as DecisionEvent[]) expect(rejected(planned, BENTO_DAY, e)).toBe('INVALID_TRANSITION');
  });

  it('US-E5-08/AC5 CONFIRM_RECIPE on an お弁当の日 replaces a dormant record; its old state stays only in history', () => {
    const dormant = decisionRecord(BENTO_DAY, 'not-confirmed');
    const store = november([dormant]);
    expect(shown(store, BENTO_DAY)).toMatchObject({ state: 'no-school-lunch', conflict: 'dormant' });
    const s = ok(store, BENTO_DAY, { type: 'CONFIRM_RECIPE', recipeId: R1.id });
    expect(s.decisions[BENTO_DAY]).toMatchObject({ state: 'homemade-bento-planned', recipeId: R1.id, plannedAt: '2026-11-02T10:00:00+09:00' });
    expect(s.decisions[BENTO_DAY]?.history.map((h) => h.state)).toEqual(['not-confirmed', 'homemade-bento-planned']);
    // a later refresh that makes the date a school day again shows the plan, not the old not-confirmed
    const school = { ...s, menus: { '2026-11': { ...s.menus['2026-11']!, confirmed: menu([day(BENTO_DAY, ['ごはん'])], [], { version: 3 }) } } };
    expect(shown(school, BENTO_DAY).state).toBe('homemade-bento-planned');
  });
});

describe('US-E3-05 refresh conflicts and dormant records (BR-13; B6, B7, S10)', () => {
  function refreshed(decisions: DayDecision[], lunchDates: string[], noLunchDays: ReturnType<typeof noLunch>[], version = 2, changed: string[] = []): BentoMinderStore {
    return storeWith({ profile: PS, menus: [menu(lunchDates.map((x) => day(x, ['ごはん'])), noLunchDays, { version, changedDatesSincePrevious: changed })], decisions });
  }

  it('US-E3-05/AC2 a plan on a date that became a no-lunch day is kept, shown with a conflict, and accepts only keep or clear', () => {
    const store = refreshed([BENTO(SCHOOL)], [OTHER_SCHOOL], [noLunch(SCHOOL)], 2, [SCHOOL]);
    expect(shown(store, SCHOOL)).toEqual({ state: 'homemade-bento-planned', conflict: 'plan-on-no-lunch', needsAck: true });
    expect(store.decisions[SCHOOL]).toEqual(BENTO(SCHOOL)); // untouched by the refresh
    const accepted = ALL.filter((e) => applyDecisionEvent(store, d(SCHOOL), e, env()).ok).map((e) => e.type);
    expect(accepted.sort()).toEqual(['CLEAR_PLAN', 'KEEP_PLAN']);
  });

  it('US-E3-05/AC2 a plan on an お弁当の日 made from a school day is not a conflict (BR-25)', () => {
    const store = refreshed([BENTO(SCHOOL)], [OTHER_SCHOOL], [noLunch(SCHOOL, 'bento-day', 'お弁当の日')], 2, [SCHOOL]);
    expect(shown(store, SCHOOL)).toEqual({ state: 'homemade-bento-planned', conflict: 'none', needsAck: false });
    expect(applyDecisionEvent(store, d(SCHOOL), { type: 'CHANGE_RECIPE', recipeId: R2.id }, env()).ok).toBe(true);
  });

  it('US-E3-05/AC6 a plan on a date the refresh removed is kept, flagged, and accepts only keep or clear', () => {
    const store = refreshed([BENTO('2026-11-25')], [OTHER_SCHOOL], [], 2, ['2026-11-25']);
    expect(shown(store, '2026-11-25')).toEqual({ state: 'homemade-bento-planned', conflict: 'plan-date-removed', needsAck: true });
    for (const e of ALL.filter((x) => x.type !== 'KEEP_PLAN' && x.type !== 'CLEAR_PLAN')) expect(rejected(store, '2026-11-25', e)).toBe('NOT_PLANNABLE_DAY');
  });

  it('US-E3-05/AC7 KEEP_PLAN sets acknowledgedMenuVersion only: state, recipe, plannedAt, decidedAt and history are unchanged', () => {
    const before = refreshed([BENTO(SCHOOL)], [OTHER_SCHOOL], [noLunch(SCHOOL)], 2, [SCHOOL]);
    const kept = ok(before, SCHOOL, { type: 'KEEP_PLAN' });
    const { acknowledgedMenuVersion, updatedAt, ...rest } = kept.decisions[SCHOOL]!;
    expect(acknowledgedMenuVersion).toBe(2);
    expect(updatedAt).toBe('2026-11-02T10:00:00+09:00');
    const { updatedAt: _u, ...was } = before.decisions[SCHOOL]!;
    void _u;
    expect(rest).toEqual(was);
    expect(shown(kept, SCHOOL)).toMatchObject({ conflict: 'plan-on-no-lunch', needsAck: false });
  });

  it('US-E3-05/AC7 CLEAR_PLAN on a conflict removes the stored decision; the day then shows no-school-lunch and takes no action', () => {
    const before = refreshed([BENTO(SCHOOL)], [OTHER_SCHOOL], [noLunch(SCHOOL)], 2, [SCHOOL]);
    const cleared = ok(before, SCHOOL, { type: 'CLEAR_PLAN' });
    expect(cleared.decisions[SCHOOL]).toBeUndefined();
    expect(shown(cleared, SCHOOL).state).toBe('no-school-lunch');
    expect(rejected(cleared, SCHOOL, { type: 'DEFER' })).toBe('NOT_PLANNABLE_DAY');
  });

  it('US-E3-05/AC14 a kept conflict stays kept until a later version changes that date again', () => {
    const kept = ok(refreshed([BENTO(SCHOOL)], [OTHER_SCHOOL], [noLunch(SCHOOL)], 2, [SCHOOL]), SCHOOL, { type: 'KEEP_PLAN' });
    const v3 = { ...kept, menus: { '2026-11': { ...kept.menus['2026-11']!, confirmed: menu([day(OTHER_SCHOOL, ['ごはん'])], [noLunch(SCHOOL)], { version: 3, changedDatesSincePrevious: [] }) } } };
    expect(shown(v3, SCHOOL)).toMatchObject({ conflict: 'plan-on-no-lunch', needsAck: false });
    const v4 = { ...kept, menus: { '2026-11': { ...kept.menus['2026-11']!, confirmed: menu([day(OTHER_SCHOOL, ['ごはん'])], [noLunch(SCHOOL)], { version: 4, changedDatesSincePrevious: [SCHOOL] }) } } };
    expect(shown(v4, SCHOOL)).toMatchObject({ conflict: 'plan-on-no-lunch', needsAck: true });
    expect(ok(v4, SCHOOL, { type: 'KEEP_PLAN' }).decisions[SCHOOL]?.acknowledgedMenuVersion).toBe(4);
  });

  it('US-E3-05/AC12 not-confirmed and school-lunch-planned records on a no-lunch or removed date are dormant: not shown, no action, unchanged; they return when the date is a school day again', () => {
    const nc = decisionRecord('2026-11-11', 'not-confirmed');
    const sl = decisionRecord('2026-11-12', 'school-lunch-planned', { reservationDoneExternally: true });
    const store = refreshed([nc, sl], [OTHER_SCHOOL], [noLunch('2026-11-12', 'closed', '休園')], 2, ['2026-11-11', '2026-11-12']);
    expect(shown(store, '2026-11-11')).toEqual({ state: null, conflict: 'dormant', needsAck: false });
    expect(shown(store, '2026-11-12')).toEqual({ state: 'no-school-lunch', conflict: 'dormant', needsAck: false });
    for (const date of ['2026-11-11', '2026-11-12']) {
      expect(allowedEvents(dayContextOf(store, d(date)), store.decisions[date], todayJst(at(NOW_ISO)))).toEqual([]);
    }
    expect(store.decisions['2026-11-11']).toEqual(nc);
    expect(store.decisions['2026-11-12']).toEqual(sl);
    const back = refreshed([nc, sl], ['2026-11-11', '2026-11-12'], [], 3, ['2026-11-11', '2026-11-12']);
    expect(shown(back, '2026-11-11').state).toBe('not-confirmed');
    expect(shown(back, '2026-11-12').state).toBe('school-lunch-planned');
    expect(back.decisions['2026-11-12']?.reservationDoneExternally).toBe(true);
  });

  it('US-E3-05/AC2 conflicts older than today are read-only: keep and clear are refused after the date (BR-27)', () => {
    const store = refreshed([BENTO(SCHOOL)], [OTHER_SCHOOL], [noLunch(SCHOOL)], 2, [SCHOOL]);
    expect(rejected(store, SCHOOL, { type: 'KEEP_PLAN' }, '2026-11-05T00:00:00Z')).toBe('DATE_IN_PAST');
    expect(rejected(store, SCHOOL, { type: 'CLEAR_PLAN' }, '2026-11-05T00:00:00Z')).toBe('DATE_IN_PAST');
  });
});

describe('BR-02 only a parent event writes a decision; transition takes no assessment', () => {
  it('BR-01 transition() has no assessment input: its signature is (context, record, event, env)', () => {
    expect(transition.length).toBe(4);
  });

  it('BR-02 an accepted event always yields a record that satisfies the contract (decision-no-lunch-not-stored, planned-at, snapshot rules)', () => {
    const results: (DayDecision | null)[] = [];
    for (const [store, date] of [
      [november(), SCHOOL],
      [november([BENTO(SCHOOL)]), SCHOOL],
      [november([decisionRecord(SCHOOL, 'not-confirmed')]), SCHOOL],
      [november(), BENTO_DAY],
    ] as [BentoMinderStore, string][]) {
      for (const e of ALL) {
        const r = transition(dayContextOf(store, d(date)), store.decisions[date], e, env());
        if (r.ok) results.push(r.next);
      }
    }
    expect(results.length).toBeGreaterThan(8);
    for (const rec of results) {
      if (rec === null) continue;
      const parsed = dayDecisionSchema.safeParse(rec);
      expect(parsed.success ? [] : toRuleIssues(parsed.error)).toEqual([]);
    }
  });
});
