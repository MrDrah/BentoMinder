// QA: decision-state oracle vs engine (tests/oracle/decision-state-oracle.md). Expectations in the table tests are
// copied from the spec's transition table (T01-T56) and system-event table (S01-S23), not from the engine.
import { describe, expect, it } from 'vitest';
import {
  allowedEvents,
  applyDecisionEvent,
  clearOverride,
  dayContextOf,
  dayDecisionSchema,
  displayedDecision,
  refreshReview,
  setOverride,
  todayJst,
  type DecisionEvent,
  type Instant,
  type TransitionEnv,
} from '../../../../src/domain/index.ts';
import type { BentoMinderStore, DayDecision } from '../../../../src/domain/index.ts';
import { DecisionOracle, kindOf, type Assign, type Ev } from '../../../oracle/impl/decision.ts';
import { Prng } from '../../../oracle/impl/prng.ts';
import { d, day, decisionRecord, menu, noLunch, PS, storeWith } from '../../helpers/menus.ts';

interface RecipeFixture {
  id: string;
  name: { ja: string; en?: string };
  shortNameJa: string;
  shortNameEn: string;
}
const R: Record<'R1' | 'R2' | 'RX', RecipeFixture> = {
  R1: { id: 'rcp-kuma-onigiri', name: { ja: 'くまさんおにぎり弁当', en: 'Bear onigiri bento' }, shortNameJa: 'くまおにぎり', shortNameEn: 'Bear oni' },
  R2: { id: 'rcp-hoshi-omelette', name: { ja: '星のオムレツ弁当' }, shortNameJa: 'ほしオムレツ', shortNameEn: 'Star egg' },
  RX: { id: 'rcp-with-allergen', name: { ja: 'エビ弁当' }, shortNameJa: 'えびべんとう', shortNameEn: 'Shrimp' },
};
const lib = new Map(Object.values(R).map((r) => [r.id, r]));
const ID = { R1: R.R1.id, R2: R.R2.id, RX: R.RX.id, NOPE: 'rcp-does-not-exist' };
const valid = new Set([ID.R1, ID.R2]);
const at = (iso: string) => Date.parse(iso) as Instant;
const envAt = (iso: string): TransitionEnv => ({ today: todayJst(at(iso)), now: at(iso), recipe: (id) => lib.get(id), isRecipeAllowed: (id) => id !== ID.RX });
const NOW = '2026-11-02T01:00:00Z'; // 2026-11-02 10:00 JST

const toEngine = (e: Ev): DecisionEvent => {
  switch (e.t) {
    case 'CONFIRM': return { type: 'CONFIRM_RECIPE', recipeId: e.r };
    case 'CHANGE': return { type: 'CHANGE_RECIPE', recipeId: e.r };
    case 'LATER': return { type: 'DEFER' };
    case 'TO_SCHOOL_OK': return { type: 'SET_SCHOOL_LUNCH' };
    case 'CLEAR_OK': return { type: 'CLEAR_PLAN' };
    case 'KEEP': return { type: 'KEEP_PLAN' };
    case 'RESERVED': return { type: 'MARK_RESERVATION', done: e.done };
  }
};

function menuFor(assign: Map<string, Assign>, version: number, changed: Iterable<string>) {
  const days = [...assign].filter(([, a]) => a === 'school').map(([date]) => day(date, ['ごはん', 'ピーマンとなすのみそ炒め']))
    .concat([...assign].filter(([, a]) => a === 'snack').map(([date]) => day(date, [['せんべい', 'snack']])));
  const nl = [...assign].filter(([, a]) => a === 'bento' || a === 'nolunch').map(([date, a]) => noLunch(date, a === 'bento' ? 'bento-day' : 'no-lunch', a === 'bento' ? 'お弁当の日' : '午前保育（給食なし）'));
  return menu(days, nl, { version, changedDatesSincePrevious: [...changed].sort() });
}
const rec = (date: string, o: { state: 'school-lunch-planned' | 'not-confirmed' | 'homemade-bento-planned'; recipe?: keyof typeof R; flag?: boolean }): DayDecision => {
  const r = R[o.recipe ?? 'R1'];
  return o.state === 'homemade-bento-planned'
    ? decisionRecord(date, o.state, { recipeId: r.id, recipeNameSnapshot: r.name.en ? { ja: r.name.ja, en: r.name.en } : { ja: r.name.ja }, recipeShortNameSnapshot: { ja: r.shortNameJa, en: r.shortNameEn } })
    : decisionRecord(date, o.state, { reservationDoneExternally: o.flag === true });
};

// ---------- fixed transition table ----------
const KIND_DATE: Record<string, [string, Assign]> = { school: ['2026-11-04', 'school'], bento: ['2026-11-20', 'bento'], nolunch: ['2026-11-27', 'nolunch'], none: ['2026-11-07', 'absent'], snack: ['2026-11-14', 'snack'] };
type RecTok = 'none' | 'SL' | 'SLf' | 'NC' | 'HB1';
type Exp = { ok: boolean; shown: string | null; recipe?: string | null; flag?: boolean; stored?: boolean };
const HB = 'homemade-bento-planned', SL = 'school-lunch-planned', NC = 'not-confirmed', NSL = 'no-school-lunch';

interface Row { id: string; ac: string; kind: keyof typeof KIND_DATE; rec: RecTok; ev: Ev; exp: Exp; now?: string; version?: number; changed?: string[] }
const rows: Row[] = [
  { id: 'T03', ac: 'US-E5-03/AC2', kind: 'school', rec: 'none', ev: { t: 'CONFIRM', r: ID.R1 }, exp: { ok: true, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T04', ac: 'US-E5-05/AC1', kind: 'school', rec: 'none', ev: { t: 'LATER' }, exp: { ok: true, shown: NC, recipe: null, stored: true } },
  { id: 'T05', ac: 'US-E5-03/AC1', kind: 'school', rec: 'none', ev: { t: 'TO_SCHOOL_OK' }, exp: { ok: false, shown: SL, stored: false } },
  { id: 'T06', ac: 'US-E5-06/AC1', kind: 'school', rec: 'none', ev: { t: 'CHANGE', r: ID.R2 }, exp: { ok: false, shown: SL, stored: false } },
  { id: 'T07', ac: 'US-E5-08/AC3', kind: 'school', rec: 'none', ev: { t: 'CLEAR_OK' }, exp: { ok: false, shown: SL, stored: false } },
  { id: 'T08', ac: 'US-E5-07/AC3', kind: 'school', rec: 'none', ev: { t: 'RESERVED', done: true }, exp: { ok: true, shown: SL, flag: true, stored: true } },
  { id: 'T09', ac: 'US-E5-07/AC3', kind: 'school', rec: 'SLf', ev: { t: 'RESERVED', done: false }, exp: { ok: true, shown: SL, flag: false, stored: true } },
  { id: 'T10', ac: 'US-E5-07/AC3', kind: 'school', rec: 'SLf', ev: { t: 'CONFIRM', r: ID.R1 }, exp: { ok: true, shown: HB, recipe: ID.R1, flag: false, stored: true } },
  { id: 'T11', ac: 'US-E5-07/AC3', kind: 'school', rec: 'SLf', ev: { t: 'LATER' }, exp: { ok: true, shown: NC, flag: false, stored: true } },
  { id: 'T12', ac: 'US-E5-03/AC2', kind: 'school', rec: 'NC', ev: { t: 'CONFIRM', r: ID.R1 }, exp: { ok: true, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T13', ac: 'US-E5-05/AC2', kind: 'school', rec: 'NC', ev: { t: 'TO_SCHOOL_OK' }, exp: { ok: true, shown: SL, stored: true } },
  { id: 'T14', ac: 'US-E5-05/AC1', kind: 'school', rec: 'NC', ev: { t: 'LATER' }, exp: { ok: false, shown: NC, stored: true } },
  { id: 'T15a', ac: 'US-E5-05/AC1', kind: 'school', rec: 'NC', ev: { t: 'CHANGE', r: ID.R2 }, exp: { ok: false, shown: NC, stored: true } },
  { id: 'T15b', ac: 'US-E5-05/AC1', kind: 'school', rec: 'NC', ev: { t: 'CLEAR_OK' }, exp: { ok: false, shown: NC, stored: true } },
  { id: 'T15c', ac: 'US-E5-07/AC3', kind: 'school', rec: 'NC', ev: { t: 'RESERVED', done: true }, exp: { ok: false, shown: NC, stored: true } },
  { id: 'T16', ac: 'US-E5-06/AC2', kind: 'school', rec: 'HB1', ev: { t: 'TO_SCHOOL_OK' }, exp: { ok: true, shown: SL, recipe: null, stored: true } },
  { id: 'T18', ac: 'US-E5-06/AC2', kind: 'school', rec: 'HB1', ev: { t: 'LATER' }, exp: { ok: true, shown: NC, recipe: null, stored: true } },
  { id: 'T19', ac: 'US-E5-06/AC1', kind: 'school', rec: 'HB1', ev: { t: 'CHANGE', r: ID.R2 }, exp: { ok: true, shown: HB, recipe: ID.R2, stored: true } },
  { id: 'T20', ac: 'US-E5-06/AC1', kind: 'school', rec: 'HB1', ev: { t: 'CHANGE', r: ID.R1 }, exp: { ok: true, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T21', ac: 'US-E5-06/AC1', kind: 'school', rec: 'HB1', ev: { t: 'CONFIRM', r: ID.R2 }, exp: { ok: false, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T22', ac: 'US-E5-08/AC3', kind: 'school', rec: 'HB1', ev: { t: 'CLEAR_OK' }, exp: { ok: false, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T23', ac: 'US-E5-07/AC3', kind: 'school', rec: 'HB1', ev: { t: 'RESERVED', done: true }, exp: { ok: false, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T25', ac: 'US-E5-08/AC1', kind: 'bento', rec: 'none', ev: { t: 'CONFIRM', r: ID.R1 }, exp: { ok: true, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T26a', ac: 'US-E5-08/AC3', kind: 'bento', rec: 'none', ev: { t: 'LATER' }, exp: { ok: false, shown: NSL, stored: false } },
  { id: 'T26b', ac: 'US-E5-08/AC3', kind: 'bento', rec: 'none', ev: { t: 'TO_SCHOOL_OK' }, exp: { ok: false, shown: NSL, stored: false } },
  { id: 'T26c', ac: 'US-E5-07/AC3', kind: 'bento', rec: 'none', ev: { t: 'RESERVED', done: true }, exp: { ok: false, shown: NSL, stored: false } },
  { id: 'T27', ac: 'US-E5-08/AC1', kind: 'bento', rec: 'HB1', ev: { t: 'CHANGE', r: ID.R2 }, exp: { ok: true, shown: HB, recipe: ID.R2, stored: true } },
  { id: 'T28', ac: 'US-E5-08/AC3', kind: 'bento', rec: 'HB1', ev: { t: 'CLEAR_OK' }, exp: { ok: true, shown: NSL, stored: false } },
  { id: 'T30a', ac: 'US-E5-08/AC3', kind: 'bento', rec: 'HB1', ev: { t: 'LATER' }, exp: { ok: false, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T30b', ac: 'US-E5-08/AC3', kind: 'bento', rec: 'HB1', ev: { t: 'TO_SCHOOL_OK' }, exp: { ok: false, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T31a', ac: 'US-E5-08/AC2', kind: 'nolunch', rec: 'none', ev: { t: 'CONFIRM', r: ID.R1 }, exp: { ok: false, shown: NSL, stored: false } },
  { id: 'T31b', ac: 'US-E5-08/AC2', kind: 'nolunch', rec: 'none', ev: { t: 'LATER' }, exp: { ok: false, shown: NSL, stored: false } },
  { id: 'T32a', ac: 'US-E5-02/AC2', kind: 'none', rec: 'none', ev: { t: 'CONFIRM', r: ID.R1 }, exp: { ok: false, shown: null, stored: false } },
  { id: 'T32b', ac: 'US-E4-01/AC10', kind: 'snack', rec: 'none', ev: { t: 'CONFIRM', r: ID.R1 }, exp: { ok: false, shown: null, stored: false } },
  { id: 'T33a', ac: 'US-E5-02/AC3', kind: 'school', rec: 'HB1', ev: { t: 'CHANGE', r: ID.R2 }, now: '2026-11-10T01:00:00Z', exp: { ok: false, shown: HB, recipe: ID.R1, stored: true } },
  { id: 'T33b', ac: 'US-E5-02/AC3', kind: 'school', rec: 'none', ev: { t: 'CONFIRM', r: ID.R1 }, now: '2026-11-10T01:00:00Z', exp: { ok: false, shown: SL, stored: false } },
  { id: 'T34', ac: 'US-E5-03/AC4', kind: 'school', rec: 'none', ev: { t: 'CONFIRM', r: ID.R1 }, now: '2026-11-03T23:00:00Z', exp: { ok: true, shown: HB, recipe: ID.R1, stored: true } }, // 11-04 08:00 JST
  { id: 'T35', ac: 'US-E5-03/AC4', kind: 'school', rec: 'none', ev: { t: 'CONFIRM', r: ID.R1 }, now: '2026-11-03T15:30:00Z', exp: { ok: true, shown: HB, recipe: ID.R1, stored: true } }, // 11-04 00:30 JST = 11-03 in Paris
  { id: 'T37', ac: 'US-E5-03/AC2', kind: 'school', rec: 'none', ev: { t: 'CONFIRM', r: ID.RX }, exp: { ok: false, shown: SL, stored: false } },
  { id: 'T38', ac: 'US-E5-03/AC2', kind: 'school', rec: 'none', ev: { t: 'CONFIRM', r: ID.NOPE }, exp: { ok: false, shown: SL, stored: false } },
  { id: 'T39', ac: 'US-E5-06/AC1', kind: 'school', rec: 'HB1', ev: { t: 'CHANGE', r: ID.RX }, exp: { ok: false, shown: HB, recipe: ID.R1, stored: true } },
];

function scenario(row: Row) {
  const [date, assign] = KIND_DATE[row.kind]!;
  const assignMap = new Map<string, Assign>([['2026-11-04', 'school'], ['2026-11-03', 'school'], ['2026-11-20', 'bento'], ['2026-11-27', 'nolunch'], ['2026-11-14', 'snack']]);
  assignMap.set(date, assign);
  const records: DayDecision[] = [];
  const oracle = new DecisionOracle(valid);
  oracle.menu = new Map([...assignMap].filter(([, a]) => a !== 'absent'));
  oracle.today = todayJst(at(row.now ?? NOW));
  const mk = { SL: { state: SL }, SLf: { state: SL, flag: true }, NC: { state: NC }, HB1: { state: HB } } as const;
  if (row.rec !== 'none') {
    const spec = mk[row.rec];
    records.push(rec(date, { ...spec } as never));
    oracle.recs.set(date, { state: spec.state as never, recipeId: spec.state === HB ? ID.R1 : null, flag: 'flag' in spec, planned: spec.state === HB, ack: null, last: '' });
  }
  const store = storeWith({ profile: PS, menus: [menuFor(oracle.menu, row.version ?? 1, row.changed ?? [])], decisions: records });
  return { date, store, oracle };
}

describe('QA oracle: decision transition table T01-T56 (hand-written rows, engine = spec = oracle)', () => {
  for (const row of rows) {
    it(`${row.ac} ${row.id} ${row.kind}/${row.rec} + ${row.ev.t} -> ${row.exp.ok ? 'accepted' : 'rejected'}, shows ${row.exp.shown}`, () => {
      const { date, store, oracle } = scenario(row);
      const ok = oracle.apply(date, row.ev);
      expect(ok, 'oracle vs spec').toBe(row.exp.ok);
      expect(oracle.shown(date)).toBe(row.exp.shown);
      const res = applyDecisionEvent(store, d(date), toEngine(row.ev), envAt(row.now ?? NOW));
      expect(res.ok, 'engine vs spec').toBe(row.exp.ok);
      const after = res.ok ? res.store : store;
      if (!res.ok) expect(after, 'a rejected event leaves the store byte-identical').toBe(store);
      const shown = displayedDecision(dayContextOf(after, d(date)), after.decisions[date]);
      expect(shown.state).toBe(row.exp.shown);
      const r = after.decisions[date];
      expect(r !== undefined, 'record stored').toBe(row.exp.stored ?? false);
      if (row.exp.recipe !== undefined) expect(r?.recipeId ?? null).toBe(row.exp.recipe);
      if (row.exp.flag !== undefined) expect(r?.reservationDoneExternally).toBe(row.exp.flag);
      if (r) expect(dayDecisionSchema.safeParse(r).success, 'record satisfies the data contract').toBe(true);
    });
  }

  it('US-E5-03/AC2 T03 a confirmed plan stores the recipe name snapshot and decidedAt = plannedAt = now (JST)', () => {
    const { date, store } = scenario({ id: 'x', ac: '', kind: 'school', rec: 'none', ev: { t: 'LATER' }, exp: { ok: true, shown: NC } });
    const res = applyDecisionEvent(store, d(date), { type: 'CONFIRM_RECIPE', recipeId: ID.R1 }, envAt(NOW));
    if (!res.ok) throw new Error(res.error);
    const r = res.store.decisions[date]!;
    expect(r.recipeNameSnapshot?.ja).toBe(R.R1.name.ja);
    expect(r.decidedAt).toBe('2026-11-02T10:00:00+09:00');
    expect(r.plannedAt).toBe(r.decidedAt);
  });

  it('US-E5-03/AC4 T36 BR-15 a date that is "today" in Paris but yesterday in Tokyo is read-only (00:30 JST on 11-04)', () => {
    const { store } = scenario({ id: 'x', ac: '', kind: 'school', rec: 'none', ev: { t: 'LATER' }, exp: { ok: true, shown: NC }, now: '2026-11-03T15:30:00Z' });
    const res = applyDecisionEvent(store, d('2026-11-03'), { type: 'CONFIRM_RECIPE', recipeId: ID.R1 }, envAt('2026-11-03T15:30:00Z'));
    expect(res.ok).toBe(false);
  });

  it('US-E5-06/AC1 T41 history keeps the last 5 changes: the 6th change drops the oldest', () => {
    const { date, store } = scenario({ id: 'x', ac: '', kind: 'school', rec: 'none', ev: { t: 'LATER' }, exp: { ok: true, shown: NC } });
    const seq: DecisionEvent[] = [
      { type: 'CONFIRM_RECIPE', recipeId: ID.R1 }, { type: 'DEFER' }, { type: 'CONFIRM_RECIPE', recipeId: ID.R2 },
      { type: 'CHANGE_RECIPE', recipeId: ID.R1 }, { type: 'SET_SCHOOL_LUNCH' }, { type: 'DEFER' }, { type: 'CONFIRM_RECIPE', recipeId: ID.R2 },
    ];
    let s: BentoMinderStore = store;
    seq.forEach((e, i) => {
      const r = applyDecisionEvent(s, d(date), e, envAt(NOW));
      if (!r.ok) throw new Error(`${i}: ${r.error}`);
      s = r.store;
      expect(s.decisions[date]!.history.length).toBe(Math.min(5, i + 1));
    });
    expect(s.decisions[date]!.history.map((h) => h.state)).toEqual(['homemade-bento-planned', 'homemade-bento-planned', 'school-lunch-planned', 'not-confirmed', 'homemade-bento-planned']);
  });

  it('US-E5-06/AC1 T56 BR-17 plannedAt is cleared when the day leaves HB and is new when planned again; CHANGE keeps it', () => {
    const { date, store } = scenario({ id: 'x', ac: '', kind: 'school', rec: 'HB1', ev: { t: 'LATER' }, exp: { ok: true, shown: NC } });
    const planned = store.decisions[date]!.plannedAt;
    const changed = applyDecisionEvent(store, d(date), { type: 'CHANGE_RECIPE', recipeId: ID.R2 }, envAt('2026-11-02T05:00:00Z'));
    if (!changed.ok) throw new Error(changed.error);
    expect(changed.store.decisions[date]!.plannedAt).toBe(planned);
    const later = applyDecisionEvent(changed.store, d(date), { type: 'DEFER' }, envAt('2026-11-02T06:00:00Z'));
    if (!later.ok) throw new Error(later.error);
    expect(later.store.decisions[date]!.plannedAt).toBeUndefined();
    const again = applyDecisionEvent(later.store, d(date), { type: 'CONFIRM_RECIPE', recipeId: ID.R2 }, envAt('2026-11-02T07:00:00Z'));
    if (!again.ok) throw new Error(again.error);
    expect(again.store.decisions[date]!.plannedAt).toBe('2026-11-02T16:00:00+09:00');
  });
});

// ---------- refresh conflicts T42-T55 ----------
describe('QA oracle: refresh conflicts and dormant records (T42-T55, S08-S11, S20-S23)', () => {
  const planned = (kindAfter: Assign, extra: Partial<{ rec: 'HB1' | 'NC' | 'SLf' }> = {}, date = '2026-11-04') => {
    const assign = new Map<string, Assign>([[date, kindAfter], ['2026-11-05', 'school'], ['2026-11-20', 'bento']]);
    const spec = extra.rec ?? 'HB1';
    const record = spec === 'HB1' ? rec(date, { state: HB }) : spec === 'NC' ? rec(date, { state: NC }) : rec(date, { state: SL, flag: true });
    const store = storeWith({ profile: PS, menus: [menuFor(assign, 2, [date])], decisions: [record] });
    return { store, date, record };
  };
  const shownOf = (s: BentoMinderStore, date: string) => displayedDecision(dayContextOf(s, d(date)), s.decisions[date]);
  const allowed = (s: BentoMinderStore, date: string, iso = NOW) => allowedEvents(dayContextOf(s, d(date)), s.decisions[date], todayJst(at(iso))).filter((t) => t !== 'MARK_RESERVATION').sort();

  for (const [id, after] of [['T42', 'nolunch'], ['T47', 'absent']] as const) {
    it(`US-E3-05/AC2 ${id} a planned bento on a date the refresh made ${after === 'absent' ? 'unlisted' : 'a no-lunch day'} is kept, flagged, and offers only keep or cancel`, () => {
      const { store, date, record } = planned(after);
      const s = shownOf(store, date);
      expect([s.state, s.needsAck]).toEqual([HB, true]);
      expect(s.conflict).not.toBe('none');
      expect(allowed(store, date)).toEqual(['CLEAR_PLAN', 'KEEP_PLAN']);
      expect(store.decisions[date]).toEqual(record);
    });
    it(`US-E3-05/AC14 ${id.replace('T42', 'T43').replace('T47', 'T48')} keeping sets only acknowledgedMenuVersion; state, recipe, plannedAt and history stay`, () => {
      const { store, date } = planned(after);
      const r = applyDecisionEvent(store, d(date), { type: 'KEEP_PLAN' }, envAt(NOW));
      if (!r.ok) throw new Error(r.error);
      const a = r.store.decisions[date]!;
      const b = store.decisions[date]!;
      expect(a.acknowledgedMenuVersion).toBe(2);
      expect([a.state, a.recipeId, a.plannedAt, a.decidedAt, a.history]).toEqual([b.state, b.recipeId, b.plannedAt, b.decidedAt, b.history]);
      expect(shownOf(r.store, date).needsAck).toBe(false);
    });
    it(`US-E3-05/AC2 ${id.replace('T42', 'T44').replace('T47', 'T49')} CLEAR_PLAN removes the record; afterwards no decision action is offered`, () => {
      const { store, date } = planned(after);
      const r = applyDecisionEvent(store, d(date), { type: 'CLEAR_PLAN' }, envAt(NOW));
      if (!r.ok) throw new Error(r.error);
      expect(r.store.decisions[date]).toBeUndefined();
      expect(allowed(r.store, date)).toEqual([]);
      expect(shownOf(r.store, date).state).toBe(after === 'absent' ? null : NSL);
    });
    it(`US-E3-05/AC2 ${id.replace('T42', 'T46').replace('T47', 'T50')} every other event is rejected and the store stays byte-identical`, () => {
      const { store, date } = planned(after);
      for (const ev of [{ type: 'CHANGE_RECIPE', recipeId: ID.R2 }, { type: 'CONFIRM_RECIPE', recipeId: ID.R2 }, { type: 'DEFER' }, { type: 'SET_SCHOOL_LUNCH' }, { type: 'MARK_RESERVATION', done: true }] as DecisionEvent[]) {
        expect(applyDecisionEvent(store, d(date), ev, envAt(NOW)).ok, ev.type).toBe(false);
      }
    });
  }

  it('US-E3-05/AC2 T51 BR-27 once the conflict date is past, keep and cancel are refused (read-only)', () => {
    const { store, date } = planned('nolunch');
    for (const ev of [{ type: 'KEEP_PLAN' }, { type: 'CLEAR_PLAN' }] as DecisionEvent[]) expect(applyDecisionEvent(store, d(date), ev, envAt('2026-11-05T00:00:00Z')).ok).toBe(false);
    expect(allowed(store, date, '2026-11-05T00:00:00Z')).toEqual([]);
  });

  it('US-E3-05/AC14 a kept conflict stays kept until a refresh changes that date again (needsAck by version)', () => {
    const { store, date } = planned('nolunch');
    const kept = applyDecisionEvent(store, d(date), { type: 'KEEP_PLAN' }, envAt(NOW));
    if (!kept.ok) throw new Error(kept.error);
    const assign = new Map<string, Assign>([[date, 'nolunch'], ['2026-11-05', 'school'], ['2026-11-20', 'bento']]);
    const v3 = { ...kept.store, menus: { '2026-11': { ...kept.store.menus['2026-11']!, confirmed: menuFor(assign, 3, ['2026-11-05']) } } };
    expect(shownOf(v3, date).needsAck, 'v3 does not change the date: stays acknowledged').toBe(false);
    expect(shownOf(v3, date).state).toBe(HB);
    const v4 = { ...kept.store, menus: { '2026-11': { ...kept.store.menus['2026-11']!, confirmed: menuFor(assign, 4, [date]) } } };
    expect(shownOf(v4, date).needsAck, 'v4 changes the date again: flagged again').toBe(true);
  });

  it('US-E3-05/AC12 T53 S20 NC and SL records on a no-lunch date stay dormant: shown as no-school-lunch, no action offered, byte-identical', () => {
    for (const spec of ['NC', 'SLf'] as const) {
      const { store, date, record } = planned('nolunch', { rec: spec });
      expect(shownOf(store, date).state).toBe(NSL);
      expect(allowed(store, date)).toEqual([]);
      expect(applyDecisionEvent(store, d(date), { type: 'DEFER' }, envAt(NOW)).ok).toBe(false);
      expect(store.decisions[date]).toEqual(record);
    }
  });

  it('US-E3-05/AC12 T54 S21 when the date becomes a school day again the dormant records return unchanged', () => {
    for (const [spec, state] of [['NC', NC], ['SLf', SL]] as const) {
      const { store, date, record } = planned('school', { rec: spec });
      expect(shownOf(store, date).state).toBe(state);
      expect(store.decisions[date]).toEqual(record);
    }
  });

  it('US-E5-08/AC4 T55 CONFIRM on an お弁当の日 with a dormant NC record replaces it; no NC returns later', () => {
    const { store, date } = planned('bento', { rec: 'NC' });
    expect(shownOf(store, date).state).toBe(NSL);
    const r = applyDecisionEvent(store, d(date), { type: 'CONFIRM_RECIPE', recipeId: ID.R1 }, envAt(NOW));
    if (!r.ok) throw new Error(r.error);
    expect(r.store.decisions[date]!.state).toBe(HB);
    expect(r.store.decisions[date]!.plannedAt).toBe('2026-11-02T10:00:00+09:00');
    const assign = new Map<string, Assign>([[date, 'school'], ['2026-11-05', 'school']]);
    const back = { ...r.store, menus: { '2026-11': { ...r.store.menus['2026-11']!, confirmed: menuFor(assign, 3, [date]) } } };
    expect(shownOf(back, date).state).toBe(HB);
  });

  it('US-E3-05/AC2 T52 S22 a planned school day that becomes an お弁当の日 is not a conflict and accepts CHANGE', () => {
    const { store, date } = planned('bento');
    const s = shownOf(store, date);
    expect([s.state, s.needsAck, s.conflict]).toEqual([HB, false, 'none']);
    expect(applyDecisionEvent(store, d(date), { type: 'CHANGE_RECIPE', recipeId: ID.R2 }, envAt(NOW)).ok).toBe(true);
  });

  it('US-E3-05/AC1 US-E5-04/AC1 S08 S11 a refresh that changes dishes or turns an お弁当の日 into a school day keeps the plan, unflagged', () => {
    const date = '2026-11-20';
    const assign = new Map<string, Assign>([[date, 'school'], ['2026-11-05', 'school']]);
    const store = storeWith({ profile: PS, menus: [menuFor(assign, 2, [date])], decisions: [rec(date, { state: HB })] });
    const s = shownOf(store, date);
    expect([s.state, s.needsAck, s.conflict]).toEqual([HB, false, 'none']);
  });

  it('US-E3-05/AC9 AC11 AC12 AC13 needs-review list: HB, NC and override dates among the changed dates only; SL alone never; none says so', () => {
    const assign = new Map<string, Assign>([['2026-11-04', 'nolunch'], ['2026-11-18', 'school'], ['2026-11-19', 'school'], ['2026-11-25', 'school']]);
    const m = menuFor(assign, 2, ['2026-11-04', '2026-11-18', '2026-11-19']);
    const decisions = { '2026-11-04': rec('2026-11-04', { state: HB }), '2026-11-11': rec('2026-11-11', { state: NC }), '2026-11-25': rec('2026-11-25', { state: SL }) };
    const ov = { '2026-11-18': { date: '2026-11-18', state: 'low-preference', setAt: 'x', menuVersionAtSet: 1, ownerId: 'local', createdAt: 'x', updatedAt: 'x' } as never };
    const list = refreshReview(m, decisions, ov);
    expect(list.map((i) => i.date)).toEqual(['2026-11-04', '2026-11-18']);
    expect(refreshReview(menuFor(assign, 2, ['2026-11-19']), decisions, ov)).toEqual([]);
    // removed NC date (AC12) is listed; SL on a no-lunch date is not
    const m2 = menuFor(new Map<string, Assign>([['2026-11-12', 'nolunch']]), 3, ['2026-11-11', '2026-11-12']);
    const dec2 = { '2026-11-11': rec('2026-11-11', { state: NC }), '2026-11-12': rec('2026-11-12', { state: SL, flag: true }) };
    expect(refreshReview(m2, dec2, {}).map((i) => i.date)).toEqual(['2026-11-11']);
  });
});

// ---------- random sequences (spec §5) ----------
const SEED = Number(process.env['ORACLE_SEED'] ?? 20261024);
const DATES = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);

function randomAssign(rnd: Prng, from?: Map<string, Assign>): Map<string, Assign> {
  const kinds: Assign[] = ['school', 'school', 'school', 'bento', 'nolunch', 'snack', 'absent'];
  const out = new Map<string, Assign>();
  for (const date of DATES) {
    const old = from?.get(date);
    const a = old !== undefined && !rnd.chance(0.25) ? old : rnd.pick(kinds);
    if (a !== 'absent') out.set(date, a);
  }
  return out;
}

describe('QA oracle: decision state random sequences (1,000 sequences, seeded)', () => {
  it(`US-E5-02/AC2 US-E5-03/AC2 US-E5-05/AC1 US-E5-06/AC1 US-E5-07/AC3 US-E5-08/AC3 US-E3-05/AC2 US-E3-05/AC9 US-E4-03/AC4 engine = oracle after every step of 1,000 sequences, seed ${SEED}`, () => {
    const rnd = new Prng(SEED);
    const diffs: string[] = [];
    const cover = { accepted: 0, rejected: 0, conflictSeen: 0, kept: 0 };
    for (let n = 0; n < 1000 && diffs.length < 5; n++) {
      const o = new DecisionOracle(valid);
      o.menu = randomAssign(rnd);
      let nowIso = '2026-11-02T01:00:00Z';
      let store: BentoMinderStore = storeWith({ profile: PS, menus: [menuFor(o.menu, 1, [])] });
      const trace: string[] = [];
      const fail = (msg: string) => diffs.push(`#${n} seed ${SEED}: ${msg}\n  trace: ${trace.slice(-8).join(' | ')}`);
      const steps = rnd.int(1, 30);
      for (let k = 0; k < steps; k++) {
        o.today = todayJst(at(nowIso));
        const choice = rnd.next();
        const hot = DATES.filter((x) => o.recs.has(x));
        const date = hot.length > 0 && rnd.chance(0.4) ? rnd.pick(hot) : rnd.chance(0.8) ? rnd.pick(DATES.filter((x) => x >= o.today).concat(DATES.slice(0, 3))) : rnd.pick(DATES);
        const before = JSON.stringify(store.decisions);
        if (choice < 0.12) {
          const next = randomAssign(rnd, o.menu);
          o.refresh(next);
          const cm = menuFor(next, o.version, o.changed);
          store = { ...store, menus: { '2026-11': { ...store.menus['2026-11']!, confirmed: cm } } };
          trace.push(`refresh v${o.version}`);
          if (JSON.stringify(store.decisions) !== before) fail('a refresh changed decisions (BR-13)');
          const want = JSON.stringify([...o.review()].map(([dt, r]) => [dt, [...r].sort()]));
          const got = JSON.stringify(refreshReview(cm, store.decisions, store.overrides).map((i) => [i.date, [...i.reasons].sort()]));
          if (want !== got) fail(`needs-review list: oracle ${want} engine ${got}`);
        } else if (choice < 0.11) {
          nowIso = new Date(at(nowIso) + rnd.int(1, 5) * 86_400_000 + rnd.int(0, 20) * 3_600_000).toISOString();
          trace.push(`clock ${nowIso}`);
          if (JSON.stringify(store.decisions) !== before) fail('time changed decisions');
        } else if (choice < 0.16) {
          const set = rnd.chance(0.7);
          const env = { today: todayJst(at(nowIso)), now: at(nowIso) };
          const res = set ? setOverride(store, d(date), 'low-preference', env) : clearOverride(store, d(date), env);
          const want = set ? o.setOverride(date) : o.clearOverride(date);
          trace.push(`${set ? 'setOv' : 'clrOv'} ${date}`);
          if (res.ok !== want) fail(`override ${set ? 'set' : 'clear'} ${date}: oracle ${want} engine ${res.ok}`);
          if (res.ok) store = res.store;
          if (JSON.stringify(store.decisions) !== before) fail('an override changed decisions (BR-01)');
          if (Object.keys(store.overrides).sort().join() !== [...o.overrides].sort().join()) fail('override sets differ');
        } else {
          const rcp = rnd.pick([ID.R1, ID.R1, ID.R2, ID.R2, ID.RX, ID.NOPE]);
          const flagState = o.recs.get(date)?.flag ?? false;
          const evs: Ev[] = [{ t: 'CONFIRM', r: rcp }, { t: 'CONFIRM', r: rcp }, { t: 'CHANGE', r: rcp }, { t: 'LATER' }, { t: 'TO_SCHOOL_OK' }, { t: 'CLEAR_OK' }, { t: 'KEEP' }, { t: 'KEEP' }, { t: 'RESERVED', done: !flagState }];
          const ev = rnd.pick(evs);
          const want = o.apply(date, ev);
          const res = applyDecisionEvent(store, d(date), toEngine(ev), envAt(nowIso));
          trace.push(`${date} ${JSON.stringify(ev)} -> ${want}`);
          if (want) cover.accepted += 1; else cover.rejected += 1;
          if (want && ev.t === 'KEEP') cover.kept += 1;
          if (res.ok !== want) fail(`${date} ${JSON.stringify(ev)}: oracle accepted=${want} engine accepted=${res.ok}${res.ok ? '' : ' (' + res.error + ')'}`);
          if (res.ok) store = res.store;
          else if (JSON.stringify(store.decisions) !== before) fail('rejected event changed decisions');
        }
        // compare every date
        cover.conflictSeen += DATES.filter((x) => o.conflict(x)).length;
        for (const dt of DATES) {
          const ctx = dayContextOf(store, d(dt));
          const r = store.decisions[dt];
          const s = displayedDecision(ctx, r);
          const or = o.recs.get(dt);
          if (({ 'school-day': 'school', 'bento-day': 'bento-day', 'other-no-lunch': 'other-no-lunch', 'not-in-menu': 'none' } as Record<string, string>)[ctx.kind] !== kindOf(o.menu.get(dt) ?? 'absent')) fail(`${dt} kind ${ctx.kind}`);
          if (s.state !== o.shown(dt)) fail(`${dt} displayed ${s.state} vs oracle ${o.shown(dt)}`);
          if (s.needsAck !== o.needsAck(dt)) fail(`${dt} needsAck ${s.needsAck} vs oracle ${o.needsAck(dt)}`);
          if ((r !== undefined) !== (or !== undefined)) fail(`${dt} record presence engine ${r !== undefined} oracle ${or !== undefined}`);
          if (r && or) {
            if (r.state !== or.state || (r.recipeId ?? null) !== or.recipeId || r.reservationDoneExternally !== or.flag || (r.plannedAt !== undefined) !== or.planned) fail(`${dt} record ${r.state}/${r.recipeId}/${r.reservationDoneExternally}/${r.plannedAt} vs oracle ${JSON.stringify(or)}`);
            if (r.history.length > 5) fail(`${dt} history longer than 5`);
            if ((r.acknowledgedMenuVersion ?? null) !== or.ack) fail(`${dt} ack ${r.acknowledgedMenuVersion} vs ${or.ack}`);
          }
          if (r && !dayDecisionSchema.safeParse(r).success) fail(`${dt} stored record violates the data contract`);
          if (r && (r.state as string) === NSL) fail(`${dt} P3: stored no-school-lunch`);
          // allowed actions
          {
            const eng = allowedEvents(ctx, r, o.today as never).filter((t) => t !== 'MARK_RESERVATION').sort().join();
            const orc = ([['CONFIRM_RECIPE', { t: 'CONFIRM', r: ID.R1 }], ['CHANGE_RECIPE', { t: 'CHANGE', r: ID.R1 }], ['DEFER', { t: 'LATER' }], ['SET_SCHOOL_LUNCH', { t: 'TO_SCHOOL_OK' }], ['CLEAR_PLAN', { t: 'CLEAR_OK' }], ['KEEP_PLAN', { t: 'KEEP' }]] as [string, Ev][])
              .filter(([, e]) => o.accepts(dt, e)).map(([t]) => t).sort().join();
            if (eng !== orc) fail(`${dt} offered actions engine [${eng}] oracle [${orc}]`);
          }
        }
        if (diffs.length) break;
      }
    }
    expect(diffs, diffs.join('\n')).toEqual([]);
    // the generator must exercise the machine, not only rejections (guards against a vacuous pass)
    expect(cover.accepted).toBeGreaterThan(1000);
    expect(cover.rejected).toBeGreaterThan(1000);
    expect(cover.conflictSeen).toBeGreaterThan(50);
    expect(cover.kept).toBeGreaterThan(5);
  }, 60_000);
});
