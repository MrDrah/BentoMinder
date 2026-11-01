// QA: assessment oracle vs engine (tests/oracle/assessment-oracle.md). Expected values below are copied from the
// hand-computed decision table in that spec, not from the engine. The oracle (tests/oracle/impl) shares no code with src/.
import { describe, expect, it } from 'vitest';
import { createAssessor, matcherFor } from '../../../../src/domain/index.ts';
import { loadDict, OracleAssessor, type ODay, type OMenu, type OProfile } from '../../../oracle/impl/assessment.ts';
import { Prng } from '../../../oracle/impl/prng.ts';
import { d, day, dict, menu, noLunch, override, profile } from '../../helpers/menus.ts';

const engine = createAssessor(dict);
const oracle = new OracleAssessor(loadDict());
const K = { st: 'staple', mn: 'main', sd: 'side', sp: 'soup', dk: 'drink', ds: 'dessert', sn: 'snack' } as const;
type Abbr = keyof typeof K;
type It = [string, Abbr] | [string, Abbr, string[]];

const P: Record<string, [string[], string[]]> = {
  PS: [['ing-chicken', 'ing-egg', 'ing-corn'], ['ing-green-pepper', 'ing-eggplant', 'cat-fish']],
  P1: [[], []], PA: [['ing-corn'], ['ing-carrot']], PB: [['cat-fish'], ['ing-mackerel']], PC: [['ing-potato'], ['ing-chicken']],
  PD: [['ing-egg'], ['dish-curry-rice']], PE: [['ing-rice'], ['ing-miso']], PF: [['ing-rice'], ['cat-vegetable']], PG: [[], ['ing-carrot']],
  PH: [['ing-apple'], []], PI: [['dish-corn-soup', 'ing-corn'], ['ing-carrot']], PJ: [['ing-chicken'], ['ing-chicken-thigh']],
  PK: [['ing-mackerel'], ['cat-fish']], PL: [['ing-egg'], ['dish-saba-miso', 'ing-mackerel']], PM: [['ing-mackerel'], ['dish-saba-miso']],
  PN: [['ing-ginger'], ['ing-pork']], PO: [['dish-saba-miso'], ['cat-fish']],
};

interface Case {
  id: string;
  p: string | null;
  items: It[];
  listed?: string[];
  // expected from the spec table: state, key, D, L, unmatched/assessed
  state: string;
  key: string;
  D?: number;
  L?: number;
  U?: [number, number];
  ov?: string;
  calc?: string;
  ac: string;
}

const A09: It[] = [['ピーマンとなすのみそ炒め', 'mn'], ['ごはん', 'st'], ['すまし汁', 'sp']];
const T = (id: string, p: string | null, items: It[], state: string, key: string, D: number, L: number, U: [number, number], ac: string, listed?: string[]): Case => ({ id, p, items, state, key, D, L, U, ac, ...(listed ? { listed } : {}) });
const low = 'low-preference', mix = 'mixed-uncertain', likely = 'likely-enjoyable';

const CASES: Case[] = [
  T('A09', 'PS', A09, low, 'assess.low', 2, 0, [0, 3], 'US-E4-01/AC1'),
  T('A10', 'PS', [['ピーマンとなすのみそ炒め', 'mn'], ['鶏のから揚げ', 'mn'], ['ごはん', 'st']], low, 'assess.low', 2, 1, [0, 3], 'US-E4-01/AC2'),
  T('A11', 'PS', [['さばのみそ煮', 'mn'], ['白身魚のフライ', 'mn'], ['卵焼き', 'sd']], low, 'assess.low', 2, 1, [0, 3], 'US-E4-01/AC3'),
  T('A12', 'PF', [['ほうれん草のおひたし', 'sd'], ['にんじんサラダ', 'sd'], ['ごはん', 'st']], low, 'assess.low', 2, 1, [0, 3], 'US-E4-01/AC3'),
  T('A13', 'PS', [['なすのにびたし', 'sd'], ['ごはん', 'st'], ['すまし汁', 'sp']], low, 'assess.low', 1, 0, [0, 3], 'US-E4-01/AC2'),
  T('A14', 'PS', [['さけのしおやき', 'mn'], ['ごはん', 'st'], ['みそ汁', 'sp']], low, 'assess.low', 1, 0, [0, 3], 'US-E4-01/AC3'),
  T('A15', 'PS', [['八宝菜', 'mn'], ['ごはん', 'st'], ['牛乳', 'dk']], low, 'assess.low', 1, 0, [0, 3], 'US-E4-01/AC1', ['はくさい', 'にんじん', 'ピーマン', 'ぶた肉']),
  T('A16', 'PA', [['にんじんのグラッセ', 'sd'], ['ニンジンしりしり', 'sd'], ['人参スープ', 'sp']], low, 'assess.low', 1, 0, [0, 3], 'US-E4-01/AC4'),
  T('A17', 'PS', [['なすのにびたし', 'sd'], ['はりはり漬け', 'st'], ['ビビンバ', 'mn']], low, 'assess.low', 1, 0, [2, 3], 'US-E4-01/AC2'),
  T('A18', 'PS', [['鯵フライ', 'mn'], ['ごはん', 'st']], low, 'assess.low', 1, 0, [0, 2], 'US-E4-01/AC6'),
  T('A19', 'PD', [['カレー', 'mn', ['dish-curry-rice']], ['りんご', 'ds']], low, 'assess.low', 1, 0, [0, 2], 'US-E4-01/AC6'),
  T('A20', 'PS', [['なすのにびたし', 'sd'], ['卵焼き', 'sd'], ['ごはん', 'st']], mix, 'assess.mixedOne', 1, 1, [0, 3], 'US-E4-01/AC2'),
  T('A21', 'PS', [['ブロッコリーのおかかあえ', 'sd'], ['鶏のから揚げ', 'mn'], ['ごはん', 'st']], mix, 'assess.mixedOne', 1, 1, [0, 3], 'US-E4-01/AC3'),
  T('A22', 'PA', [['コーンスープ', 'sp'], ['にんじんのグラッセ', 'sd']], mix, 'assess.mixedOne', 1, 1, [0, 2], 'US-E4-01/AC5'),
  T('A23', 'PC', [['鶏もも肉のてりやき', 'mn'], ['ポテトサラダ', 'sd']], mix, 'assess.mixedOne', 1, 1, [0, 2], 'US-E4-01/AC3'),
  T('A24', 'PE', [['みそ汁', 'sp'], ['ごはん', 'st']], mix, 'assess.mixedOne', 1, 1, [0, 2], 'US-E4-01/AC3'),
  T('A25', 'PD', [['カレーライス', 'mn'], ['卵焼き', 'sd']], mix, 'assess.mixedOne', 1, 1, [0, 2], 'US-E4-01/AC3'),
  T('A26', 'PI', [['コーンスープ', 'sp'], ['にんじんのグラッセ', 'sd']], mix, 'assess.mixedOne', 1, 1, [0, 2], 'US-E4-01/AC5'),
  T('A27', 'PB', [['さばのみそ煮', 'mn'], ['ごはん', 'st']], low, 'assess.low', 1, 0, [0, 2], 'US-E4-01/AC3'),
  T('A28', 'PS', [['コーンスープ', 'sp'], ['ごはん', 'st'], ['はりはり漬け', 'st']], likely, 'assess.likely', 0, 1, [1, 3], 'US-E4-01/AC2'),
  T('A29', 'PS', [['コーンスープ', 'sp'], ['はりはり漬け', 'st']], likely, 'assess.likely', 0, 1, [1, 2], 'US-E4-01/AC2'),
  T('A30', 'PS', [['ちくわの磯辺揚げ', 'sd'], ['ごはん', 'st'], ['卵焼き', 'sd']], likely, 'assess.likely', 0, 1, [0, 3], 'US-E4-01/AC3'),
  T('A31', 'PA', [['もちもちとうもろこしパン', 'st'], ['はりはり漬け', 'st']], likely, 'assess.likely', 0, 1, [1, 2], 'US-E4-01/AC5'),
  T('A32', 'PS', [['カレー', 'mn'], ['卵焼き', 'sd']], likely, 'assess.likely', 0, 1, [1, 2], 'US-E4-01/AC6'),
  T('A33', 'PS', [['みそ汁', 'sp'], ['ごはん', 'st'], ['コーンスープ', 'sp']], likely, 'assess.likely', 0, 1, [0, 3], 'US-E4-01/AC2'),
  T('A34', 'PS', [['コーンスープ', 'sp'], ['ビビンバ', 'mn'], ['せんべい', 'sn']], likely, 'assess.likely', 0, 1, [1, 2], 'US-E4-01/AC9'),
  T('A35', 'PH', [['りんご', 'ds'], ['ごはん', 'st']], likely, 'assess.likely', 0, 1, [0, 2], 'US-E4-01/AC2'),
  T('A36', 'PS', [['親子丼', 'mn'], ['すまし汁', 'sp'], ['バナナ', 'ds']], likely, 'assess.likely', 0, 2, [0, 3], 'US-E4-01/AC1', ['鶏肉', '卵', '米', 'たまねぎ', 'みつば']),
  T('A37', 'PS', [['タンドリーチキン', 'mn'], ['ナン', 'st'], ['ミネストローネ', 'sp']], mix, 'assess.mixedUnknown', 0, 1, [2, 3], 'US-E4-02/AC3'),
  T('A38', 'PS', [['ごはん', 'st'], ['すまし汁', 'sp'], ['りんご', 'ds']], mix, 'assess.mixedNeutral', 0, 0, [0, 3], 'US-E4-01/AC2'),
  T('A39', 'PS', [['はりはり漬け', 'st'], ['ビビンバ', 'mn'], ['ナン', 'st']], mix, 'assess.mixedUnknown', 0, 0, [3, 3], 'US-E4-01/AC2'),
  T('A40', 'PS', [['アジフライ', 'mn'], ['ごはん', 'st']], mix, 'assess.mixedNeutral', 0, 0, [1, 2], 'US-E4-01/AC6'),
  T('A41', 'PD', [['カレー', 'mn'], ['りんご', 'ds']], mix, 'assess.mixedNeutral', 0, 0, [1, 2], 'US-E4-01/AC6'),
  T('A42', 'PG', [['ごはん', 'st'], ['すまし汁', 'sp']], mix, 'assess.mixedNeutral', 0, 0, [0, 2], 'US-E4-01/AC2'),
  T('A43', 'PS', [['親子丼', 'mn'], ['すまし汁', 'sp'], ['バナナ', 'ds']], mix, 'assess.mixedNeutral', 0, 0, [0, 3], 'US-E4-01/AC1'),
  T('A46', 'PS', [['コーンスープ', 'sp'], ['ごはん', 'st'], ['〓〓のソテー', 'mn']], likely, 'assess.likely', 0, 1, [1, 3], 'US-E4-01/AC2'),
  T('A48', 'PS', [['カレーうどん', 'mn'], ['はりはり漬け', 'st'], ['卵焼き', 'sd']], mix, 'assess.mixedUnknown', 0, 1, [2, 3], 'US-E4-01/AC6'),
  T('A50', 'PB', [['さばのみそ煮', 'mn'], ['さけのしおやき', 'mn'], ['ごはん', 'st']], mix, 'assess.mixedOne', 1, 1, [0, 3], 'US-E4-01/AC3'),
  T('A51', 'PJ', [['鶏もも肉のてりやき', 'mn'], ['ごはん', 'st']], low, 'assess.low', 1, 0, [0, 2], 'US-E4-01/AC3'),
  T('A52', 'PJ', [['鶏肉のソテー', 'mn'], ['鶏もも肉のてりやき', 'mn'], ['ごはん', 'st']], low, 'assess.low', 1, 0, [0, 3], 'US-E4-01/AC3'),
  T('A53', 'PK', [['さばのみそ煮', 'mn'], ['ごはん', 'st']], likely, 'assess.likely', 0, 1, [0, 2], 'US-E4-01/AC3'),
  T('A54', 'PK', [['さばのみそ煮', 'mn'], ['白身魚のフライ', 'mn'], ['ごはん', 'st']], mix, 'assess.mixedOne', 1, 1, [0, 3], 'US-E4-01/AC3'),
  T('A55', 'PS', [['はりはり漬け', 'st'], ['ビビンバ', 'mn'], ['ごはん', 'st']], mix, 'assess.mixedUnknown', 0, 0, [2, 3], 'US-E4-01/AC2'),
  T('A58', 'PL', [['さばのみそ煮', 'mn'], ['卵焼き', 'sd'], ['ごはん', 'st']], mix, 'assess.mixedOne', 1, 1, [0, 3], 'US-E4-01/AC5'),
  T('A59', 'PN', [['豚のしょうが焼き', 'mn'], ['ごはん', 'st']], mix, 'assess.mixedOne', 1, 1, [0, 2], 'US-E4-01/AC5'),
  T('A60', 'PN', [['豚のしょうが焼き', 'mn'], ['豚汁', 'sp'], ['ごはん', 'st']], low, 'assess.low', 2, 1, [0, 3], 'US-E4-01/AC18'),
  T('A61', 'PM', [['さばのみそ煮', 'mn'], ['ごはん', 'st']], likely, 'assess.likely', 0, 1, [0, 2], 'US-E4-01/AC3'),
  T('A62', 'PO', [['さばのみそ煮', 'mn'], ['ごはん', 'st']], likely, 'assess.likely', 0, 1, [0, 2], 'US-E4-01/AC3'),
  T('A63', 'PC', [['鶏肉のソテー', 'mn'], ['鶏もも肉のてりやき', 'mn'], ['ポテトサラダ', 'sd']], mix, 'assess.mixedOne', 1, 1, [0, 3], 'US-E4-01/AC5'),
  T('A64', 'PC', [['鶏肉のソテー', 'mn'], ['鶏もも肉のてりやき', 'mn'], ['鶏むね肉のサラダ', 'sd']], low, 'assess.low', 2, 0, [0, 3], 'US-E4-01/AC5'),
  T('A65', 'PC', [['鶏のから揚げ', 'mn'], ['鶏もも肉のてりやき', 'mn'], ['ポテトサラダ', 'sd']], low, 'assess.low', 2, 1, [0, 3], 'US-E4-01/AC5'),
];

function build(c: Case) {
  const [likes, dislikes] = c.p === null ? [[], []] : P[c.p]!;
  const prof = c.p === null ? null : profile(likes, dislikes);
  const eDay = day('2026-11-04', c.items.map(([text, k, r]) => ({ text, kind: K[k], ...(r ? { resolvedIds: r } : {}) })), c.listed);
  const oDay: ODay = {
    date: '2026-11-04',
    items: c.items.map(([text, k, r]) => ({ text, kind: K[k], ...(r ? { resolvedIds: r } : {}) })),
    ingredientsStatus: c.listed ? 'listed' : 'not-listed',
    ...(c.listed ? { ingredients: c.listed.map((text) => ({ text })) } : {}),
  };
  return { prof, eMenu: menu([eDay]), oMenu: { days: [oDay], noLunchDays: [] } as OMenu, oProf: prof === null ? null : ({ likedIds: likes, dislikedIds: dislikes } as OProfile) };
}

describe('QA oracle: assessment decision table (hand-computed rows A01-A65)', () => {
  for (const c of CASES) {
    it(`${c.ac} ${c.id} engine = spec = oracle: ${c.state} ${c.key} D${c.D} L${c.L} U${c.U?.join('/')}`, () => {
      const { prof, eMenu, oMenu, oProf } = build(c);
      const e = engine({ date: d('2026-11-04'), menu: eMenu, profile: prof })!;
      const o = oracle.assess('2026-11-04', oMenu, oProf, null)!;
      // spec expectation (hand-computed)
      expect(o.state, 'oracle vs spec table').toBe(c.state);
      expect(o.key).toBe(c.key);
      expect([o.dislikedCount, o.likedCount]).toEqual([c.D, c.L]);
      expect([o.unmatchedCount, o.assessedCount]).toEqual(c.U);
      // engine vs spec
      expect(e.state, 'engine vs spec table').toBe(c.state);
      expect(e.explanationKey).toBe(c.key);
      expect([e.explanationParams.dislikedCount, e.explanationParams.likedCount]).toEqual([c.D, c.L]);
      expect(new Set(e.matched.likedIds)).toEqual(new Set(o.likedIds));
      expect(new Set(e.matched.dislikedIds)).toEqual(new Set(o.dislikedIds));
      expect(e.explanationParams.unmatchedTotal).toBe(c.U![0]);
    });
  }

  it('US-E4-01/AC8 A01-A03 no-lunch days (bento-day and no-lunch) come before "not assessed", with or without a profile', () => {
    const m = menu([day('2026-11-04', ['ごはん'])], [noLunch('2026-11-20', 'bento-day', 'お弁当の日'), noLunch('2026-11-27')]);
    const om: OMenu = { days: [], noLunchDays: [{ date: '2026-11-20', reason: 'bento-day' }, { date: '2026-11-27', reason: 'no-lunch' }] };
    for (const date of ['2026-11-20', '2026-11-27']) {
      for (const prof of [null, profile(...P.PS!)]) {
        const e = engine({ date: d(date), menu: m, profile: prof })!;
        expect([e.state, e.explanationKey]).toEqual(['no-school-lunch', 'assess.noLunch']);
        expect(oracle.assess(date, om, null, null)!.state).toBe('no-school-lunch');
      }
    }
  });

  it('US-E4-01/AC2 A04-A05 no profile, or empty likes and dislikes (even with allergies), is not-assessed', () => {
    const m = menu([day('2026-11-04', ['ピーマンとなすのみそ炒め', 'ごはん'])]);
    const p1 = profile([], [], { allergyStatus: 'has-known', knownAllergenIds: ['alg-shrimp'] });
    for (const prof of [null, p1]) {
      const e = engine({ date: d('2026-11-04'), menu: m, profile: prof })!;
      expect([e.state, e.explanationKey]).toEqual(['not-assessed', 'assess.notAssessed']);
    }
  });

  it('US-E4-01/AC10 A06-A08 snack-only day, unlisted weekend and an unconfirmed month have no assessment at all (BR-25, BR-12)', () => {
    const m = menu([day('2026-11-14', [['せんべい', 'snack']]), day('2026-11-04', ['ごはん'])]);
    const prof = profile(...P.PS!);
    expect(engine({ date: d('2026-11-14'), menu: m, profile: prof })).toBeNull(); // A06
    expect(engine({ date: d('2026-11-07'), menu: m, profile: prof })).toBeNull(); // A07
    expect(engine({ date: d('2026-12-02'), menu: null, profile: prof })).toBeNull(); // A08 (no confirmed menu for the month)
    const om: OMenu = { days: [{ date: '2026-11-14', items: [{ text: 'せんべい', kind: 'snack' }], ingredientsStatus: 'not-listed' }], noLunchDays: [] };
    expect(oracle.assess('2026-11-14', om, { likedIds: [], dislikedIds: [] }, null)).toBeNull();
  });

  it('US-E4-03/AC1 A44-A45 an override replaces the state, keeps calculatedState, and applies on a not-assessed day', () => {
    const m = menu([day('2026-11-04', A09.map(([t, k]) => ({ text: t, kind: K[k] })))]);
    const e = engine({ date: d('2026-11-04'), menu: m, profile: profile(...P.PS!), override: override('2026-11-04', 'likely-enjoyable') })!;
    expect([e.state, e.calculatedState, e.explanationKey]).toEqual(['likely-enjoyable', 'low-preference', 'assess.override']);
    const e2 = engine({ date: d('2026-11-04'), menu: m, profile: profile([], []), override: override('2026-11-04', 'low-preference') })!;
    expect([e2.state, e2.calculatedState, e2.explanationKey]).toEqual(['low-preference', 'not-assessed', 'assess.override']);
  });

  it('US-E4-03/AC1 A47/A56 BR-05 dormant override: no-lunch rule 1 wins, the override returns unchanged when the date is a school day again', () => {
    const prof = profile(...P.PS!);
    const ov = override('2026-11-18', 'low-preference');
    const noLunchMenu = menu([day('2026-11-04', ['ごはん'])], [noLunch('2026-11-18')], { version: 2 });
    const e = engine({ date: d('2026-11-18'), menu: noLunchMenu, profile: prof, override: ov })!;
    expect([e.state, e.calculatedState, e.explanationKey]).toEqual(['no-school-lunch', 'no-school-lunch', 'assess.noLunch']);
    const schoolMenu = menu([day('2026-11-18', A09.map(([t, k]) => ({ text: t, kind: K[k] })))], [], { version: 3 });
    const back = engine({ date: d('2026-11-18'), menu: schoolMenu, profile: prof, override: ov })!;
    expect([back.state, back.calculatedState, back.explanationKey]).toEqual(['low-preference', 'low-preference', 'assess.override']);
  });

  it('US-E4-03/AC1 A57 a date removed from the menu has no assessment although an override record exists', () => {
    const m = menu([day('2026-11-04', ['ごはん'])]);
    expect(engine({ date: d('2026-11-11'), menu: m, profile: profile(...P.PS!), override: override('2026-11-11', 'likely-enjoyable') })).toBeNull();
  });

  it('US-E4-01/AC7 I1 item order, listed-ingredient order and like/dislike order never change the result', () => {
    for (const c of CASES) {
      const a = build(c);
      const rev = { ...c, items: [...c.items].reverse(), ...(c.listed ? { listed: [...c.listed].reverse() } : {}) };
      const b = build(rev);
      const [likes, dislikes] = c.p === null ? [[], []] : P[c.p]!;
      const prof2 = c.p === null ? null : profile([...likes].reverse(), [...dislikes].reverse());
      const x = engine({ date: d('2026-11-04'), menu: a.eMenu, profile: a.prof })!;
      const y = engine({ date: d('2026-11-04'), menu: b.eMenu, profile: prof2 })!;
      expect([y.state, y.explanationKey, y.explanationParams.dislikedCount, y.explanationParams.likedCount], c.id).toEqual([x.state, x.explanationKey, x.explanationParams.dislikedCount, x.explanationParams.likedCount]);
    }
  });

  it('US-E4-05/AC3 I4 the menu allergen declaration never changes an assessment', () => {
    for (const c of CASES.slice(0, 20)) {
      const { prof, eMenu } = build(c);
      const base = engine({ date: d('2026-11-04'), menu: eMenu, profile: prof })!;
      const withAllergens = JSON.parse(JSON.stringify(eMenu));
      withAllergens.days[0].allergenDeclaration = { status: 'declared', allergenIds: ['alg-egg', 'alg-milk', 'alg-shrimp'], rawText: '卵・乳・えび', verification: { status: 'ok' } };
      const e = engine({ date: d('2026-11-04'), menu: withAllergens, profile: prof })!;
      expect([e.state, e.explanationKey]).toEqual([base.state, base.explanationKey]);
    }
  });
});

describe('QA oracle: matcher text checks M01-M15 (dictionary rules 1-7)', () => {
  const matcher = matcherFor(dict);
  const ids = (text: string, listed = false) => matcher.match(text, listed ? { kind: 'ingredient', neighbourSeasoning: false } : undefined).found.map((f) => f.id).sort();
  const oids = (text: string, listed = false) => oracle.match(text, listed).found.map((f) => f.id).sort();
  const rows: [string, string, string[], boolean?][] = [
    ['M01', 'ピーマンとなすのみそ炒め', ['ing-green-pepper', 'ing-eggplant', 'ing-miso']],
    ['M02', 'コーンスープ', ['dish-corn-soup', 'ing-corn']],
    ['M03', '切り干し大根の煮物', ['dish-kiriboshi-nimono', 'ing-dried-daikon']],
    ['M04', 'ごま油', ['ing-sesame-oil'], true],
    ['M05', 'カニカマ', ['ing-crab-stick']],
    ['M07', 'しおあじ', ['ing-salt']], // 「あじ」 after a seasoning word is a taste suffix (no fish); 「しお」 itself is found
    ['M08', 'たこさんウインナー', ['dish-octopus-sausage', 'ing-sausage']],
    ['M09', 'フライパン', []],
    ['M10', '給食なし', []],
    ['M12', 'ｺｰﾝｽｰﾌﾟ', ['dish-corn-soup', 'ing-corn']],
    ['M13', 'と', []],
    ['M14', 'にんじ ん', ['ing-carrot']],
    ['M15', 'ピーマソ', []],
  ];
  for (const [id, text, expected, listed] of rows) {
    it(`US-E4-01/AC4 ${id} 「${text}」 engine = spec = oracle`, () => {
      expect(oids(text, listed)).toEqual([...expected].sort());
      expect(ids(text, listed)).toEqual([...expected].sort());
    });
  }
  it('US-E4-01/AC6 M06 「さけのしおやき」 is dish + salmon; 「さけ」 listed next to a seasoning stays unresolved', () => {
    expect(ids('さけのしおやき')).toEqual(['dish-salted-salmon', 'ing-salmon', 'ing-salt'].sort());
    const m = matcher.match('さけ', { kind: 'ingredient', neighbourSeasoning: true });
    expect(m.found.length).toBe(0);
    expect(m.unresolved.length).toBe(1);
  });
  it('US-E4-01/AC6 M11 「焼きそば」 is wheat noodles; a bare 「そば」 is buckwheat and flagged for review', () => {
    expect(ids('焼きそば')).toEqual(['dish-yakisoba', 'ing-chinese-noodles'].sort());
    const m = matcher.match('そば');
    expect(m.found.map((f) => f.id)).toEqual(['ing-soba']);
    expect(m.flags.length).toBeGreaterThan(0);
  });
});

// ---------- random comparison (spec §5): seeded, 1,000 days per run ----------
const SEED = Number(process.env['ORACLE_SEED'] ?? 20261024);

function pools() {
  const D = loadDict();
  const forms = new Set<string>();
  for (const x of D.dishes) x.forms.forEach((f) => forms.add(f));
  for (const x of D.ingredients) x.forms.forEach((f) => forms.add(f));
  for (const g of D.ambiguity) g.forms.forEach((f) => forms.add(f));
  for (const c of CASES) c.items.forEach(([t]) => forms.add(t));
  ['はりはり漬け', 'ビビンバ', 'ナン', 'ミネストローネ', 'ぎょうざ風', 'ぱえりあ', 'ラタトゥイユ', 'ケバブ', 'トムヤムクン', '〓〓のソテー', 'ガレット', 'キッシュ', 'クスクス', 'ブリトー', 'タジン', 'ピロシキ', 'ボルシチ', 'フォー', 'ナシゴレン', 'ガパオ'].forEach((f) => forms.add(f));
  return {
    D,
    texts: [...forms],
    snacks: ['せんべい', 'ビスケット', 'おやつ', 'ゼリー'],
    ids: [...D.ingredients.map((i) => i.id), ...D.categories.map((c) => c.id), ...D.dishes.map((x) => x.id)],
    ingChain: D.ingredients.filter((i) => i.parentIngredientId !== null).map((i) => [i.parentIngredientId!, i.id] as const),
    catChain: D.ingredients.filter((i) => i.categoryIds.length > 0).map((i) => [i.categoryIds[0]!, i.id] as const),
    dishChain: D.dishes.filter((x) => x.definingIngredientId !== null).map((x) => [x.id, x.definingIngredientId!] as const),
  };
}

describe('QA oracle: assessment random comparison (1,000 days, seeded)', () => {
  it(`US-E4-01/AC1 US-E4-01/AC2 US-E4-01/AC3 US-E4-01/AC5 US-E4-01/AC6 US-E4-01/AC9 US-E4-03/AC1 engine = oracle on 1,000 generated days, seed ${SEED}`, () => {
    const pool = pools();
    const rnd = new Prng(SEED);
    const diffs: string[] = [];
    for (let n = 0; n < 1000; n++) {
      // profile
      const likes: string[] = [];
      const dislikes: string[] = [];
      let prof: OProfile | null;
      if (rnd.chance(0.05)) prof = null;
      else {
        const used = new Set<string>();
        const take = (list: string[], id: string) => { if (!used.has(id)) { used.add(id); list.push(id); } };
        const nl = rnd.int(0, 6);
        const nd = rnd.int(0, 6);
        for (let k = 0; k < nl; k++) take(likes, rnd.pick(pool.ids));
        for (let k = 0; k < nd; k++) take(dislikes, rnd.pick(pool.ids));
        if (rnd.chance(0.3)) { const [a, b] = rnd.pick([...pool.ingChain, ...pool.catChain, ...pool.dishChain]); if (rnd.chance(0.5)) { take(likes, a); take(dislikes, b); } else { take(dislikes, a); take(likes, b); } }
        if (rnd.chance(0.2)) { const [a, b] = rnd.pick(pool.dishChain); take(rnd.chance(0.5) ? likes : dislikes, a); take(rnd.chance(0.5) ? likes : dislikes, b); }
        prof = { likedIds: likes, dislikedIds: dislikes };
      }
      // day
      const roll = rnd.next();
      const date = '2026-11-04';
      let items: { text: string; kind: string; resolvedIds?: string[] }[] = [];
      let listed: string[] | undefined;
      let noLunchDay = false;
      if (roll < 0.1) noLunchDay = true;
      else if (roll < 0.15) items = [{ text: rnd.pick(pool.snacks), kind: 'snack' }];
      else {
        const nItems = rnd.int(1, 6);
        const kinds = ['staple', 'main', 'side', 'soup', 'drink', 'dessert'];
        for (let k = 0; k < nItems; k++) items.push({ text: rnd.pick(pool.texts), kind: rnd.chance(0.1) ? 'snack' : rnd.pick(kinds) });
        if (!items.some((i) => i.kind !== 'snack')) items[0]!.kind = 'main';
        if (rnd.chance(0.3)) { const [dish, g] = rnd.pick(pool.dishChain); const dd = pool.D.dishes.find((x) => x.id === dish)!; items.push({ text: rnd.pick(dd.forms), kind: 'main' }); if (rnd.chance(0.5)) items.push({ text: pool.D.ingredients.find((i) => i.id === g)!.forms[0]!, kind: 'side' }); }
        if (rnd.chance(0.5)) { listed = []; const nL = rnd.int(1, 8); for (let k = 0; k < nL; k++) listed.push(rnd.pick(pool.D.ingredients).forms[0]!); }
        if (rnd.chance(0.1)) { const it = rnd.pick(items); if (/カレー|あじ|アジ|もも|モモ|なし|かき|カキ|いも|芋/.test(it.text)) it.resolvedIds = []; }
      }
      const ov = rnd.chance(0.1) ? rnd.pick(['likely-enjoyable', 'mixed-uncertain', 'low-preference']) : null;
      const eDay = day(date, items.map((i) => ({ text: i.text, kind: i.kind as never, ...(i.resolvedIds ? { resolvedIds: i.resolvedIds } : {}) })), listed);
      const eMenu = noLunchDay ? menu([day('2026-11-05', ['ごはん'])], [noLunch(date)]) : menu([eDay]);
      const oMenu: OMenu = noLunchDay
        ? { days: [], noLunchDays: [{ date, reason: 'no-lunch' }] }
        : { days: [{ date, items, ingredientsStatus: listed ? 'listed' : 'not-listed', ...(listed ? { ingredients: listed.map((text) => ({ text })) } : {}) }], noLunchDays: [] };
      const e = engine({ date: d(date), menu: eMenu, profile: prof === null ? null : profile(prof.likedIds, prof.dislikedIds), override: ov === null ? null : override(date, ov as never) });
      const o = oracle.assess(date, oMenu, prof, ov);
      const sum = (r: typeof o | null) => r === null ? null : [r.calculatedState, r.state, r.key, r.dislikedCount, r.likedCount, r.unmatchedCount, [...r.likedIds].sort().join(','), [...r.dislikedIds].sort().join(',')];
      const es = e === null ? null : [e.calculatedState, e.state, e.explanationKey, e.explanationParams.dislikedCount, e.explanationParams.likedCount, e.explanationParams.unmatchedTotal, [...e.matched.likedIds].sort().join(','), [...e.matched.dislikedIds].sort().join(',')];
      if (JSON.stringify(sum(o)) !== JSON.stringify(es)) diffs.push(`#${n} seed ${SEED}\n  items=${JSON.stringify(items.map((i) => i.text + '/' + i.kind))} listed=${JSON.stringify(listed)}\n  profile=${JSON.stringify(prof)}\n  engine=${JSON.stringify(es)}\n  oracle=${JSON.stringify(sum(o))}`);
      if (diffs.length >= 10) break;
    }
    expect(diffs, diffs.join('\n')).toEqual([]);
  }, 60_000);
});
