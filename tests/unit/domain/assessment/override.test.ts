// Manual overrides (BR-05, BR-27; US-E4-03; contract rules override-school-day-only, override-no-past-write).
import { describe, expect, it } from 'vitest';
import { clearOverride, setOverride } from '../../../../src/domain/assessment/override.ts';
import { assessmentOverrideSchema } from '../../../../src/domain/schema/index.ts';
import { deleteProfile } from '../../../../src/domain/profile/profile.ts';
import { todayJst, type Instant } from '../../../../src/domain/time/jst.ts';
import { d, day, decisionRecord, menu, noLunch, override, PS, storeWith } from '../../helpers/menus.ts';

const at = (iso: string) => Date.parse(iso) as Instant;
const TODAY_ISO = '2026-11-10T01:00:00Z'; // 2026-11-10 10:00 JST
const env = (iso = TODAY_ISO) => ({ today: todayJst(at(iso)), now: at(iso) });

const store = () =>
  storeWith({
    profile: PS,
    menus: [menu(['2026-11-06', '2026-11-09', '2026-11-10', '2026-11-12', '2026-11-18'].map((x) => day(x, ['ごはん'])), [noLunch('2026-11-27')], { version: 2 })],
    decisions: [decisionRecord('2026-11-12', 'school-lunch-planned')],
    overrides: [override('2026-11-09', 'low-preference')],
  });

describe('US-E4-03 set, change and clear an override', () => {
  it('US-E4-03/AC1 sets an override with the current menu version, valid against the contract', () => {
    const r = setOverride(store(), d('2026-11-12'), 'low-preference', env());
    if (!r.ok) throw new Error(r.rule);
    expect(r.store.overrides['2026-11-12']).toMatchObject({ date: '2026-11-12', state: 'low-preference', menuVersionAtSet: 2, setAt: '2026-11-10T10:00:00+09:00' });
    expect(assessmentOverrideSchema.safeParse(r.store.overrides['2026-11-12']).success).toBe(true);
  });

  it('US-E4-03/AC5 an override never changes the decision (BR-01)', () => {
    const before = store();
    const r = setOverride(before, d('2026-11-12'), 'low-preference', env());
    if (!r.ok) throw new Error(r.rule);
    expect(r.store.decisions).toEqual(before.decisions);
  });

  it('US-E4-03/AC3 clearing removes it and leaves everything else', () => {
    const r = clearOverride(store(), d('2026-11-09'), env('2026-11-05T01:00:00Z'));
    if (!r.ok) throw new Error(r.rule);
    expect(r.store.overrides).toEqual({});
    expect(r.store.decisions).toEqual(store().decisions);
  });

  it('US-E4-03/AC7 setting the override again, to the same state too, moves menuVersionAtSet to the current version', () => {
    const r = setOverride({ ...store(), overrides: { '2026-11-18': override('2026-11-18', 'mixed-uncertain', 1) } }, d('2026-11-18'), 'mixed-uncertain', env());
    if (!r.ok) throw new Error(r.rule);
    expect(r.store.overrides['2026-11-18']?.menuVersionAtSet).toBe(2);
    expect(r.store.overrides['2026-11-18']?.createdAt).toBe('2026-10-28T20:00:00+09:00');
  });

  it('US-E4-03/AC4 no override on a no-lunch day, a date outside the menu or a month without a menu (override-school-day-only)', () => {
    for (const date of ['2026-11-27', '2026-11-14', '2026-12-02']) {
      expect(setOverride(store(), d(date), 'low-preference', env())).toEqual({ ok: false, rule: 'override-school-day-only' });
    }
  });

  it('US-E4-03/AC6 a forced write for a date before today is refused and the store is untouched (override-no-past-write); today works', () => {
    const s = store();
    expect(setOverride(s, d('2026-11-06'), 'low-preference', env())).toEqual({ ok: false, rule: 'override-no-past-write' });
    expect(setOverride(s, d('2026-11-09'), 'likely-enjoyable', env())).toEqual({ ok: false, rule: 'override-no-past-write' });
    expect(clearOverride(s, d('2026-11-09'), env())).toEqual({ ok: false, rule: 'override-no-past-write' });
    expect(setOverride(s, d('2026-11-10'), 'low-preference', env()).ok).toBe(true);
    expect(s.overrides['2026-11-09']?.state).toBe('low-preference');
  });

  it('US-E1-06/AC2 deleting the profile is the one bulk removal: overrides go, decisions and menus stay', () => {
    const after = deleteProfile(store(), at(TODAY_ISO));
    expect(after.overrides).toEqual({});
    expect(after.decisions).toEqual(store().decisions);
    expect(after.menus).toEqual(store().menus);
  });
});
