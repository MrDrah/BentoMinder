// Preference assessment (BR-04, BR-05, BR-25; ADR 004 §1): the rule table, counting into foods,
// verdict precedence, explanation keys, overrides. Cases are written from the approved rule text
// (user-stories E4 and the H1 rulings) on the shipped dictionary's stable ids.
import { describe, expect, it } from 'vitest';
import { createAssessor, type Assessment } from '../../../../src/domain/assessment/assess.ts';
import type { ChildProfile } from '../../../../src/domain/schema/index.ts';
import { d, day, dict, menu, noLunch, override, profile, PS, type ItemSpec } from '../../helpers/menus.ts';

const assess = createAssessor(dict);
const K = { st: 'staple', mn: 'main', sd: 'side', sp: 'soup', dk: 'drink', ds: 'dessert', sn: 'snack' } as const;
type K = keyof typeof K;
type Row = [text: string, kind: K];
const items = (rows: Row[]): ItemSpec[] => rows.map(([t, k]) => [t, K[k]]);

const PA = profile(['ing-corn'], ['ing-carrot']);
const PB = profile(['cat-fish'], ['ing-mackerel']);
const PC = profile(['ing-potato'], ['ing-chicken']);
const PD = profile(['ing-egg'], ['dish-curry-rice']);
const PE = profile(['ing-rice'], ['ing-miso']);
const PF = profile(['ing-rice'], ['cat-vegetable']);
const PG = profile([], ['ing-carrot']);
const PH = profile(['ing-apple'], []);
const PI = profile(['dish-corn-soup', 'ing-corn'], ['ing-carrot']);
const PJ = profile(['ing-chicken'], ['ing-chicken-thigh']);
const PK = profile(['ing-mackerel'], ['cat-fish']);
const PL = profile(['ing-egg'], ['dish-saba-miso', 'ing-mackerel']);
const PM = profile(['ing-mackerel'], ['dish-saba-miso']);
const PN = profile(['ing-ginger'], ['ing-pork']);
const PO = profile(['dish-saba-miso'], ['cat-fish']);

const DATE = '2026-11-04'; // Wednesday

function run(p: ChildProfile | null, rows: Row[], ingredients?: string[], ov?: ReturnType<typeof override>): Assessment {
  const m = menu([day(DATE, items(rows), ingredients)]);
  const a = assess({ date: d(DATE), menu: m, profile: p, override: ov ?? null });
  if (a === null) throw new Error('no assessment');
  return a;
}

interface Case {
  id: string;
  p: ChildProfile;
  rows: Row[];
  ing?: string[];
  state: Assessment['calculatedState'];
  key: Assessment['explanationKey'];
  d: number;
  l: number;
  /** items that count towards U */
  u: number;
  disliked?: string[];
  liked?: string[];
  labels?: string[];
}

// Hand-computed from the rules; A-numbers are the case ids of the QA oracle's decision table.
const CASES: Case[] = [
  { id: 'A09', p: PS, rows: [['ピーマンとなすのみそ炒め', 'mn'], ['ごはん', 'st'], ['すまし汁', 'sp']], state: 'low-preference', key: 'assess.low', d: 2, l: 0, u: 0, labels: ['ピーマン', 'なす'] },
  { id: 'A10', p: PS, rows: [['ピーマンとなすのみそ炒め', 'mn'], ['鶏のから揚げ', 'mn'], ['ごはん', 'st']], state: 'low-preference', key: 'assess.low', d: 2, l: 1, u: 0 },
  { id: 'A11', p: PS, rows: [['さばのみそ煮', 'mn'], ['白身魚のフライ', 'mn'], ['卵焼き', 'sd']], state: 'low-preference', key: 'assess.low', d: 2, l: 1, u: 0 },
  { id: 'A12', p: PF, rows: [['ほうれん草のおひたし', 'sd'], ['にんじんサラダ', 'sd'], ['ごはん', 'st']], state: 'low-preference', key: 'assess.low', d: 2, l: 1, u: 0 },
  { id: 'A13', p: PS, rows: [['なすのにびたし', 'sd'], ['ごはん', 'st'], ['すまし汁', 'sp']], state: 'low-preference', key: 'assess.low', d: 1, l: 0, u: 0 },
  { id: 'A14', p: PS, rows: [['さけのしおやき', 'mn'], ['ごはん', 'st'], ['みそ汁', 'sp']], state: 'low-preference', key: 'assess.low', d: 1, l: 0, u: 0 },
  {
    id: 'A15',
    p: PS,
    rows: [['八宝菜', 'mn'], ['ごはん', 'st'], ['牛乳', 'dk']],
    ing: ['はくさい', 'にんじん', 'ピーマン', 'ぶた肉'],
    state: 'low-preference',
    key: 'assess.low',
    d: 1,
    l: 0,
    u: 0,
  },
  { id: 'A16', p: PA, rows: [['にんじんのグラッセ', 'sd'], ['ニンジンしりしり', 'sd'], ['人参スープ', 'sp']], state: 'low-preference', key: 'assess.low', d: 1, l: 0, u: 0 },
  { id: 'A17', p: PS, rows: [['なすのにびたし', 'sd'], ['はりはり漬け', 'st'], ['ビビンバ', 'mn']], state: 'low-preference', key: 'assess.low', d: 1, l: 0, u: 2 },
  { id: 'A18', p: PS, rows: [['鯵フライ', 'mn'], ['ごはん', 'st']], state: 'low-preference', key: 'assess.low', d: 1, l: 0, u: 0 },
  { id: 'A20', p: PS, rows: [['なすのにびたし', 'sd'], ['卵焼き', 'sd'], ['ごはん', 'st']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A21', p: PS, rows: [['ブロッコリーのおかかあえ', 'sd'], ['鶏のから揚げ', 'mn'], ['ごはん', 'st']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A22', p: PA, rows: [['コーンスープ', 'sp'], ['にんじんのグラッセ', 'sd']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A23', p: PC, rows: [['鶏もも肉のてりやき', 'mn'], ['ポテトサラダ', 'sd']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A24', p: PE, rows: [['みそ汁', 'sp'], ['ごはん', 'st']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A25', p: PD, rows: [['カレーライス', 'mn'], ['卵焼き', 'sd']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A26', p: PI, rows: [['コーンスープ', 'sp'], ['にんじんのグラッセ', 'sd']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A27', p: PB, rows: [['さばのみそ煮', 'mn'], ['ごはん', 'st']], state: 'low-preference', key: 'assess.low', d: 1, l: 0, u: 0 },
  { id: 'A28', p: PS, rows: [['コーンスープ', 'sp'], ['ごはん', 'st'], ['はりはり漬け', 'st']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 1 },
  { id: 'A29', p: PS, rows: [['コーンスープ', 'sp'], ['はりはり漬け', 'st']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 1 },
  { id: 'A30', p: PS, rows: [['ちくわの磯辺揚げ', 'sd'], ['ごはん', 'st'], ['卵焼き', 'sd']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 0 },
  { id: 'A31', p: PA, rows: [['もちもちとうもろこしパン', 'st'], ['はりはり漬け', 'st']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 1 },
  { id: 'A32', p: PS, rows: [['カレー', 'mn'], ['卵焼き', 'sd']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 1 },
  { id: 'A33', p: PS, rows: [['みそ汁', 'sp'], ['ごはん', 'st'], ['コーンスープ', 'sp']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 0 },
  { id: 'A34', p: PS, rows: [['コーンスープ', 'sp'], ['ビビンバ', 'mn'], ['せんべい', 'sn']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 1 },
  { id: 'A35', p: PH, rows: [['りんご', 'ds'], ['ごはん', 'st']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 0 },
  {
    id: 'A36',
    p: PS,
    rows: [['親子丼', 'mn'], ['すまし汁', 'sp'], ['バナナ', 'ds']],
    ing: ['鶏肉', '卵', '米', 'たまねぎ', 'みつば'],
    state: 'likely-enjoyable',
    key: 'assess.likely',
    d: 0,
    l: 2,
    u: 0,
  },
  { id: 'A37', p: PS, rows: [['タンドリーチキン', 'mn'], ['ナン', 'st'], ['ミネストローネ', 'sp']], state: 'mixed-uncertain', key: 'assess.mixedUnknown', d: 0, l: 1, u: 2 },
  { id: 'A38', p: PS, rows: [['ごはん', 'st'], ['すまし汁', 'sp'], ['りんご', 'ds']], state: 'mixed-uncertain', key: 'assess.mixedNeutral', d: 0, l: 0, u: 0 },
  { id: 'A39', p: PS, rows: [['はりはり漬け', 'st'], ['ビビンバ', 'mn'], ['ナン', 'st']], state: 'mixed-uncertain', key: 'assess.mixedUnknown', d: 0, l: 0, u: 3 },
  { id: 'A40', p: PS, rows: [['アジフライ', 'mn'], ['ごはん', 'st']], state: 'mixed-uncertain', key: 'assess.mixedNeutral', d: 0, l: 0, u: 1 },
  { id: 'A41', p: PD, rows: [['カレー', 'mn'], ['りんご', 'ds']], state: 'mixed-uncertain', key: 'assess.mixedNeutral', d: 0, l: 0, u: 1 },
  { id: 'A42', p: PG, rows: [['ごはん', 'st'], ['すまし汁', 'sp']], state: 'mixed-uncertain', key: 'assess.mixedNeutral', d: 0, l: 0, u: 0 },
  { id: 'A43', p: PS, rows: [['親子丼', 'mn'], ['すまし汁', 'sp'], ['バナナ', 'ds']], state: 'mixed-uncertain', key: 'assess.mixedNeutral', d: 0, l: 0, u: 0 },
  { id: 'A48', p: PS, rows: [['カレーうどん', 'mn'], ['はりはり漬け', 'st'], ['卵焼き', 'sd']], state: 'mixed-uncertain', key: 'assess.mixedUnknown', d: 0, l: 1, u: 2 },
  { id: 'A50', p: PB, rows: [['さばのみそ煮', 'mn'], ['さけのしおやき', 'mn'], ['ごはん', 'st']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A51', p: PJ, rows: [['鶏もも肉のてりやき', 'mn'], ['ごはん', 'st']], state: 'low-preference', key: 'assess.low', d: 1, l: 0, u: 0 },
  { id: 'A52', p: PJ, rows: [['鶏肉のソテー', 'mn'], ['鶏もも肉のてりやき', 'mn'], ['ごはん', 'st']], state: 'low-preference', key: 'assess.low', d: 1, l: 0, u: 0, disliked: ['ing-chicken-thigh'] },
  { id: 'A53', p: PK, rows: [['さばのみそ煮', 'mn'], ['ごはん', 'st']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 0 },
  { id: 'A54', p: PK, rows: [['さばのみそ煮', 'mn'], ['白身魚のフライ', 'mn'], ['ごはん', 'st']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A55', p: PS, rows: [['はりはり漬け', 'st'], ['ビビンバ', 'mn'], ['ごはん', 'st']], state: 'mixed-uncertain', key: 'assess.mixedUnknown', d: 0, l: 0, u: 2 },
  { id: 'A58', p: PL, rows: [['さばのみそ煮', 'mn'], ['卵焼き', 'sd'], ['ごはん', 'st']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0, disliked: ['dish-saba-miso'] },
  { id: 'A59', p: PN, rows: [['豚のしょうが焼き', 'mn'], ['ごはん', 'st']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A60', p: PN, rows: [['豚のしょうが焼き', 'mn'], ['豚汁', 'sp'], ['ごはん', 'st']], state: 'low-preference', key: 'assess.low', d: 2, l: 1, u: 0, disliked: ['dish-ginger-pork', 'dish-tonjiru'] },
  { id: 'A61', p: PM, rows: [['さばのみそ煮', 'mn'], ['ごはん', 'st']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 0 },
  { id: 'A62', p: PO, rows: [['さばのみそ煮', 'mn'], ['ごはん', 'st']], state: 'likely-enjoyable', key: 'assess.likely', d: 0, l: 1, u: 0 },
  { id: 'A63', p: PC, rows: [['鶏肉のソテー', 'mn'], ['鶏もも肉のてりやき', 'mn'], ['ポテトサラダ', 'sd']], state: 'mixed-uncertain', key: 'assess.mixedOne', d: 1, l: 1, u: 0 },
  { id: 'A64', p: PC, rows: [['鶏肉のソテー', 'mn'], ['鶏もも肉のてりやき', 'mn'], ['鶏むね肉のサラダ', 'sd']], state: 'low-preference', key: 'assess.low', d: 2, l: 0, u: 0, disliked: ['ing-chicken-thigh', 'ing-chicken-breast'] },
  { id: 'A65', p: PC, rows: [['鶏のから揚げ', 'mn'], ['鶏もも肉のてりやき', 'mn'], ['ポテトサラダ', 'sd']], state: 'low-preference', key: 'assess.low', d: 2, l: 1, u: 0, disliked: ['dish-karaage', 'ing-chicken-thigh'] },
];

describe('US-E4-01/AC2 the BR-04 rule table on hand-computed days', () => {
  it.each(CASES)('US-E4-01/AC2 $id → $state, $key, D $d, L $l, uncertain $u', (c) => {
    const a = run(c.p, c.rows, c.ing);
    expect(a.calculatedState).toBe(c.state);
    expect(a.state).toBe(c.state);
    expect(a.explanationKey).toBe(c.key);
    expect(a.explanationParams.dislikedCount).toBe(c.d);
    expect(a.explanationParams.likedCount).toBe(c.l);
    expect(a.matched.dislikedIds).toHaveLength(c.d);
    expect(a.matched.likedIds).toHaveLength(c.l);
    expect(a.matched.unmatchedItems.length + a.matched.ambiguousItems.length).toBe(c.u);
    if (c.disliked !== undefined) expect(new Set(a.matched.dislikedIds)).toEqual(new Set(c.disliked));
    if (c.liked !== undefined) expect(new Set(a.matched.likedIds)).toEqual(new Set(c.liked));
    if (c.labels !== undefined) expect(a.explanationParams.dislikedLabels).toEqual(c.labels);
  });
});

describe('US-E4-01 rule order and boundaries', () => {
  it('US-E4-01/AC1 two disliked ingredients make a low-preference day with D = 2 (weekday Wednesday)', () => {
    const a = run(PS, [['ピーマンとなすのみそ炒め', 'mn'], ['ごはん', 'st'], ['すまし汁', 'sp']]);
    expect(a).toMatchObject({ state: 'low-preference', explanationKey: 'assess.low' });
    expect(a.explanationParams).toMatchObject({ weekday: 3, dislikedCount: 2, dislikedLabels: ['ピーマン', 'なす'] });
  });

  it('US-E4-01/AC8 a no-lunch day is no-school-lunch whatever the profile (rule 1 before rule 2)', () => {
    const m = menu([day('2026-11-05', items([['ごはん', 'st']]))], [noLunch('2026-11-20', 'bento-day', 'お弁当の日'), noLunch('2026-11-27')]);
    for (const p of [PS, null]) {
      for (const date of ['2026-11-20', '2026-11-27']) {
        const a = assess({ date: d(date), menu: m, profile: p });
        expect(a).toMatchObject({ calculatedState: 'no-school-lunch', state: 'no-school-lunch', explanationKey: 'assess.noLunch' });
      }
    }
  });

  it('US-E4-01/AC8 no profile, or a profile with no likes and no dislikes, is not-assessed without matching anything', () => {
    for (const p of [null, profile([], [], { allergyStatus: 'has-known', knownAllergenIds: ['alg-shrimp'] })]) {
      const a = run(p, [['ピーマンとなすのみそ炒め', 'mn'], ['ごはん', 'st']]);
      expect(a).toMatchObject({ calculatedState: 'not-assessed', explanationKey: 'assess.notAssessed' });
      expect(a.matched.dislikedIds).toEqual([]);
    }
  });

  it('US-E4-01/AC10 a snack-only date, a date outside the menu and a month without a confirmed menu have no assessment (BR-25, BR-12)', () => {
    const m = menu([day('2026-11-14', items([['せんべい', 'sn']])), day('2026-11-04', items([['ごはん', 'st']]))]);
    expect(assess({ date: d('2026-11-14'), menu: m, profile: PS })).toBeNull();
    expect(assess({ date: d('2026-11-07'), menu: m, profile: PS })).toBeNull();
    expect(assess({ date: d('2026-12-02'), menu: null, profile: PS })).toBeNull();
  });

  it('US-E4-01/AC9 snack items are shown but not assessed: no D, L or U from them', () => {
    const sweetPotatoChild = profile(['ing-chicken'], ['ing-sweet-potato']);
    const a = run(sweetPotatoChild, [['ごはん', 'st'], ['とりのからあげ', 'mn'], ['さつまいもスティック', 'sn']]);
    expect(a.explanationParams.dislikedCount).toBe(0);
    expect(a.matched.itemVerdicts[2]).toBeNull();
    expect(a.matched.unmatchedItems).toEqual([]);
  });

  it('US-E4-01/AC2 the U = 50 % boundary: exactly half unknown still likely-enjoyable, one more unknown is mixed-uncertain', () => {
    expect(run(PS, [['コーンスープ', 'sp'], ['はりはり漬け', 'st']]).calculatedState).toBe('likely-enjoyable');
    expect(run(PS, [['コーンスープ', 'sp'], ['はりはり漬け', 'st'], ['ビビンバ', 'mn']]).calculatedState).toBe('mixed-uncertain');
  });
});

describe('US-E4-01 matching and counting rules', () => {
  const pepper = profile([], ['ing-green-pepper']);

  it('US-E4-01/AC3 a category dislike matches every ingredient in the category', () => {
    const a = run(profile([], ['cat-fish']), [['さけのしおやき', 'mn'], ['ごはん', 'st']]);
    expect(a.matched.dislikedIds).toEqual(['dish-salted-salmon']);
    expect(a.explanationParams.dislikedLabelIds).toEqual(['ing-salmon']);
  });

  it('US-E4-01/AC4 にんじん, 人参 and ニンジン are one id, counted once per day however often it appears', () => {
    for (const text of ['にんじん', '人参', 'ニンジン']) {
      expect(run(PA, [[text, 'sd'], ['ごはん', 'st']]).matched.dislikedIds).toEqual(['ing-carrot']);
    }
    expect(run(PA, [['にんじん', 'sd'], ['人参', 'sd'], ['ニンジン', 'sd']], ['にんじん']).explanationParams.dislikedCount).toBe(1);
  });

  it('US-E4-01/AC5 コーンスープ matches the dish and its corn; とうもろこし inside a longer unknown word still matches', () => {
    const likesCorn = profile(['ing-corn'], []);
    expect(run(likesCorn, [['コーンスープ', 'sp']]).matched.likedIds).toEqual(['dish-corn-soup']);
    expect(run(likesCorn, [['もちもちとうもろこしまぜごはん', 'st']]).matched.likedIds).toEqual(['ing-corn']);
  });

  it('US-E4-01/AC6 a standalone カレー is unresolved: it counts towards U and never decides the state', () => {
    const a = run(PD, [['カレー', 'mn'], ['りんご', 'ds']]);
    expect(a.matched.ambiguousItems).toEqual(['カレー']);
    expect(a.calculatedState).toBe('mixed-uncertain');
  });

  it('US-E4-01/AC6 a choice stored on review (resolvedIds) is used: カレーライス (dish) disliked by the profile', () => {
    const m = menu([day(DATE, [{ text: 'カレー', kind: 'main', resolvedIds: ['dish-curry-rice'] }, 'りんご'])]);
    const a = assess({ date: d(DATE), menu: m, profile: PD });
    expect(a).toMatchObject({ calculatedState: 'low-preference' });
    expect(a?.matched.ambiguousItems).toEqual([]);
  });

  it('US-E4-01/AC7 the same inputs give identical results 100 times, in either language state and any device timezone', () => {
    const m = menu([day(DATE, items([['ピーマンとなすのみそ炒め', 'mn'], ['鶏のから揚げ', 'mn'], ['ごはん', 'st']]), ['ピーマン'])]);
    const first = JSON.stringify(assess({ date: d(DATE), menu: m, profile: PS }));
    for (let i = 0; i < 100; i += 1) expect(JSON.stringify(assess({ date: d(DATE), menu: m, profile: PS }))).toBe(first);
    // the assessment holds ids and Japanese labels only: nothing in it depends on the UI language or the device timezone
    expect(first).not.toMatch(/Europe|Los_Angeles/);
  });

  it('US-E4-01/AC11 D counts different foods: さけ and さば under a disliked cat-fish are two, repeated さけ is one', () => {
    const fish = profile([], ['cat-fish']);
    const two = run(fish, [['さけのしおやき', 'mn'], ['さばのみそ煮', 'mn'], ['ごはん', 'st']]);
    expect(two).toMatchObject({ calculatedState: 'low-preference' });
    expect(two.explanationParams).toMatchObject({ dislikedCount: 2, dislikedLabelIds: ['ing-salmon', 'ing-mackerel'] });
    const one = run(fish, [['さけのしおやき', 'mn'], ['さけのしおやき', 'sd'], ['ごはん', 'st']], ['さけ']);
    expect(one.explanationParams.dislikedCount).toBe(1);
  });

  it('US-E4-01/AC12 the most specific entry wins: like fish + dislike mackerel; dislike chicken + like cat-chicken', () => {
    const a = run(profile(['cat-fish'], ['ing-mackerel']), [['さばのみそ煮', 'mn'], ['さけのしおやき', 'mn'], ['ごはん', 'st']]);
    expect(a.explanationParams).toMatchObject({ dislikedCount: 1, likedCount: 1 });
    expect(a.calculatedState).toBe('mixed-uncertain');
    const b = run(profile(['cat-chicken'], ['ing-chicken']), [['鶏もも肉のソテー', 'mn'], ['ごはん', 'st']]);
    expect(b.explanationParams).toMatchObject({ dislikedCount: 1, likedCount: 0 });
  });

  it('US-E4-01/AC13 an item with a match and an unresolved ambiguity counts towards U while its match still counts', () => {
    const udon = profile(['ing-udon'], []);
    const a = run(udon, [['カレーうどん', 'mn'], ['ごはん', 'st']]);
    expect(a.explanationParams.likedCount).toBe(1);
    expect(a.matched.ambiguousItems).toEqual(['カレーうどん']);
    expect(a.calculatedState).toBe('likely-enjoyable'); // U = 1/2
    const b = run(udon, [['カレーうどん', 'mn'], ['ごはん', 'st'], ['なぞのスープ', 'sp']]);
    expect(b.explanationParams.unmatchedTotal).toBe(2);
    expect(b.calculatedState).toBe('mixed-uncertain'); // U = 2/3
  });

  it('US-E4-01/AC14 a like and a dislike at the same level: the dislike wins (ground beef in cat-beef and cat-pork)', () => {
    const a = run(profile(['cat-beef'], ['cat-pork']), [['ハンバーグ', 'mn'], ['ごはん', 'st']], ['合いびき肉']);
    expect(a.explanationParams).toMatchObject({ dislikedCount: 1, likedCount: 0 });
  });

  it('US-E4-01/AC16 an ingredient and its descendant are one food (鶏肉 + 鶏もも肉 = 1; plus a disliked fish = 2)', () => {
    const chicken = profile([], ['ing-chicken']);
    const a = run(chicken, [['鶏肉と野菜のスープ', 'sp'], ['鶏もも肉のソテー', 'mn']], ['鶏肉', '鶏もも肉']);
    expect(a.matched.dislikedIds).toEqual(['ing-chicken-thigh']);
    expect(a.explanationParams.dislikedCount).toBe(1);
    const b = run(profile([], ['ing-chicken', 'cat-fish']), [['鶏肉と野菜のスープ', 'sp'], ['鶏もも肉のソテー', 'mn'], ['さけのしおやき', 'mn']], ['鶏肉', '鶏もも肉']);
    expect(b.explanationParams.dislikedCount).toBe(2);
  });

  it('US-E4-01/AC17 other ingredients named in a dish stay separate foods (豚のしょうが焼き = pork + ginger = 2)', () => {
    const a = run(profile([], ['ing-pork', 'ing-ginger']), [['豚のしょうが焼き', 'mn'], ['ごはん', 'st']]);
    expect(a).toMatchObject({ calculatedState: 'low-preference' });
    expect(a.explanationParams.dislikedCount).toBe(2);
  });

  it('US-E4-01/AC18 collapse is never chained across items; siblings under a found ancestor stay separate', () => {
    const chicken = profile([], ['ing-chicken']);
    expect(run(chicken, [['鶏の照り焼き', 'mn'], ['鶏のから揚げ', 'mn']]).explanationParams.dislikedCount).toBe(2);
    expect(run(chicken, [['鶏もも肉のソテー', 'mn'], ['鶏むね肉のサラダ', 'sd']], ['鶏肉', '鶏もも肉', '鶏むね肉']).explanationParams.dislikedCount).toBe(2);
  });

  it('US-E4-01/AC19 a dish and its defining ingredient are one food; ingredient → dish → category decides', () => {
    const rows: Row[] = [['さばのみそ煮', 'mn'], ['ごはん', 'st']];
    const both = run(profile([], ['dish-saba-miso', 'ing-mackerel']), rows, ['さば', 'みそ']);
    expect(both).toMatchObject({ calculatedState: 'low-preference' });
    expect(both.explanationParams).toMatchObject({ dislikedCount: 1, likedCount: 0 });
    expect(run(profile(['ing-mackerel'], ['dish-saba-miso']), rows, ['さば', 'みそ']).calculatedState).toBe('likely-enjoyable');
    expect(run(profile(['dish-saba-miso'], ['cat-fish']), rows).calculatedState).toBe('likely-enjoyable');
  });

  it('US-E4-01/AC20 a defining-ingredient link never crosses items (から揚げ + 鶏もも肉のてりやき = 2)', () => {
    const a = run(profile([], ['ing-chicken']), [['鶏のから揚げ', 'mn'], ['鶏もも肉のてりやき', 'mn']]);
    expect(a).toMatchObject({ calculatedState: 'low-preference' });
    expect(a.explanationParams.dislikedCount).toBe(2);
  });

  it('US-E4-01/AC21 the parent chose もも（果物）: ing-peach counts towards L; あじ unanswered counts towards U; the non-food reading adds nothing', () => {
    const p = profile(['ing-peach'], ['ing-horse-mackerel']);
    const choose = (aji: string[] | undefined) =>
      assess({
        date: d(DATE),
        menu: menu([day(DATE, [{ text: 'もも', resolvedIds: ['ing-peach'] }, aji === undefined ? 'あじ' : { text: 'あじ', resolvedIds: aji }])]),
        profile: p,
      });
    const unanswered = choose(undefined);
    expect(unanswered?.explanationParams).toMatchObject({ dislikedCount: 0, likedCount: 1, unmatchedTotal: 1 });
    expect(unanswered?.calculatedState).toBe('likely-enjoyable');
    const nonFood = choose([]);
    expect(nonFood?.explanationParams.unmatchedTotal).toBe(0);
    expect(nonFood?.matched.dislikedIds).toEqual([]);
  });

  it('seasonings are left out unless the profile names that exact id (dictionary §1 rule 8)', () => {
    expect(run(profile(['ing-rice'], ['cat-seasoning']), [['みそ汁', 'sp'], ['ごはん', 'st']]).explanationParams.dislikedCount).toBe(0);
    expect(run(PE, [['みそ汁', 'sp'], ['ごはん', 'st']]).explanationParams.dislikedCount).toBe(1);
  });

  it('listed ingredients count towards D and L but never towards U', () => {
    const a = run(PS, [['八宝菜', 'mn'], ['ごはん', 'st']], ['ピーマン', 'みつば']);
    expect(a.explanationParams.dislikedCount).toBe(1);
    expect(a.matched.unmatchedItems).toEqual([]);
  });

  it('typos are never corrected and a single kana never matches', () => {
    expect(run(pepper, [['ピーマソ', 'sd'], ['と', 'sd']]).matched.dislikedIds).toEqual([]);
  });
});

describe('US-E4-02 every case has exactly one explanation key (B4) and shows what is unknown', () => {
  it.each([
    [1, 1, 0, 'assess.mixedOne'],
    [0, 0, 51, 'assess.mixedUnknown'],
    [0, 0, 50, 'assess.mixedNeutral'],
    [0, 0, 0, 'assess.mixedNeutral'],
  ] as const)('US-E4-02/AC4 D %i, L %i, U %i%% → %s', (dd, ll, u, key) => {
    // 100 items give the exact percentages of the table
    const dislike = dd === 1 ? [['なすのにびたし', 'sd'] as Row] : [];
    const like = ll === 1 ? [['りんご', 'ds'] as Row] : [];
    const total = 100;
    const unknown = Math.round((u / 100) * total);
    const filler: Row[] = Array.from({ length: unknown }, (_, i) => [`なぞ${i}`, 'sd']);
    const known: Row[] = Array.from({ length: total - unknown - dislike.length - like.length }, () => ['ごはん', 'st']);
    const a = run(profile(['ing-apple'], ['ing-eggplant']), [...dislike, ...like, ...filler, ...known]);
    expect(a.calculatedState).toBe('mixed-uncertain');
    expect(a.explanationKey).toBe(key);
  });

  it('US-E4-02/AC3 an uncertain explanation lists up to 3 unmatched dish names in menu order, with the full count', () => {
    const a = run(PS, [['タンドリーチキン', 'mn'], ['ナン', 'st'], ['ミネストローネ', 'sp'], ['はりはり漬け', 'st'], ['ビビンバ', 'mn']]);
    expect(a.explanationKey).toBe('assess.mixedUnknown');
    expect(a.explanationParams.unmatched).toEqual(['ナン', 'ミネストローネ', 'はりはり漬け']);
    expect(a.explanationParams.unmatchedTotal).toBe(4);
  });

  it('US-E4-02/AC1 labels are the first 3 counted foods in order of appearance; the count stays the full D', () => {
    const p = profile([], ['ing-green-pepper', 'ing-eggplant', 'ing-carrot', 'ing-ginger']);
    const a = run(p, [['ピーマンとなすのみそ炒め', 'mn'], ['にんじんのグラッセ', 'sd'], ['豚のしょうが焼き', 'mn']]);
    expect(a.explanationParams.dislikedCount).toBe(4);
    expect(a.explanationParams.dislikedLabels).toEqual(['ピーマン', 'なす', 'にんじん']);
  });

  it('US-E4-02/AC2 every one of the 5 states and the override case has a key', () => {
    const keys = new Set<string>();
    keys.add(run(PS, [['なすのにびたし', 'sd'], ['ごはん', 'st']]).explanationKey);
    keys.add(run(PS, [['コーンスープ', 'sp']]).explanationKey);
    keys.add(run(PS, [['ごはん', 'st']]).explanationKey);
    keys.add(run(null, [['ごはん', 'st']]).explanationKey);
    keys.add(assess({ date: d('2026-11-27'), menu: menu([day(DATE, ['ごはん'])], [noLunch('2026-11-27')]), profile: PS })!.explanationKey);
    keys.add(run(PS, [['ごはん', 'st']], undefined, override(DATE, 'low-preference')).explanationKey);
    expect([...keys].sort()).toEqual(['assess.low', 'assess.likely', 'assess.mixedNeutral', 'assess.noLunch', 'assess.notAssessed', 'assess.override'].sort());
  });
});

describe('US-E4-03 overrides (BR-05)', () => {
  it('US-E4-03/AC1 an override sets the state and the key; the calculated state and counts stay visible under it', () => {
    const a = run(PS, [['ピーマンとなすのみそ炒め', 'mn'], ['ごはん', 'st']], undefined, override(DATE, 'likely-enjoyable'));
    expect(a).toMatchObject({ state: 'likely-enjoyable', calculatedState: 'low-preference', explanationKey: 'assess.override', calculatedExplanationKey: 'assess.low' });
    expect(a.explanationParams.dislikedCount).toBe(2);
    expect(a.override?.state).toBe('likely-enjoyable');
  });

  it('US-E4-03/AC2 an override on a not-assessed day is still applied (profile without likes and dislikes)', () => {
    const a = run(profile([], []), [['ごはん', 'st']], undefined, override(DATE, 'low-preference'));
    expect(a).toMatchObject({ calculatedState: 'not-assessed', state: 'low-preference', explanationKey: 'assess.override' });
  });

  it('US-E3-05/AC8 an override on a date that became a no-lunch day is dormant: no-school-lunch, no override shown; it applies again when the date is a school day', () => {
    const ov = override('2026-11-18', 'low-preference');
    const asNoLunch = assess({ date: d('2026-11-18'), menu: menu([day(DATE, ['ごはん'])], [noLunch('2026-11-18')], { version: 2 }), profile: PS, override: ov });
    expect(asNoLunch).toMatchObject({ state: 'no-school-lunch', explanationKey: 'assess.noLunch', override: null });
    const removed = assess({ date: d('2026-11-18'), menu: menu([day(DATE, ['ごはん'])], [], { version: 2 }), profile: PS, override: ov });
    expect(removed).toBeNull();
    const back = assess({ date: d('2026-11-18'), menu: menu([day('2026-11-18', items([['ピーマンとなすのみそ炒め', 'mn']]))], [], { version: 3 }), profile: PS, override: ov });
    expect(back).toMatchObject({ state: 'low-preference', explanationKey: 'assess.override', calculatedState: 'low-preference' });
  });
});
