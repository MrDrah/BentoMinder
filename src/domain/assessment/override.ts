// Manual overrides (BR-05, BR-27; data contract §3.5): set, change or clear one date's override.
// Only a parent action calls these; nothing here reads or writes decisions (BR-01).
import { dayTypeOf } from '../menu/day-kind.ts';
import { LOCAL_OWNER_ID } from '../storage/defaults.ts';
import type { AssessmentOverride, BentoMinderStore } from '../schema/index.ts';
import { monthOf, toJstTimestamp, type Instant, type LocalDate } from '../time/jst.ts';

export type OverrideState = AssessmentOverride['state'];
/** The contract rule that refused the write. */
export type OverrideRule = 'override-no-past-write' | 'override-school-day-only';

export type OverrideResult = { ok: true; store: BentoMinderStore } | { ok: false; rule: OverrideRule };

export interface OverrideEnv {
  /** Today in Asia/Tokyo (BR-15). */
  today: LocalDate;
  now: Instant;
}

/** US-E4-03/AC1, AC4, AC6, AC7: only on a school day from today on; the version at set time is the current one. */
export function setOverride(store: BentoMinderStore, date: LocalDate, state: OverrideState, env: OverrideEnv): OverrideResult {
  if (date < env.today) return { ok: false, rule: 'override-no-past-write' };
  const menu = store.menus[monthOf(date)]?.confirmed ?? null;
  if (menu === null || dayTypeOf(menu, date).type !== 'school') return { ok: false, rule: 'override-school-day-only' };
  const ts = toJstTimestamp(env.now);
  const previous = store.overrides[date];
  const next: AssessmentOverride = {
    date,
    state,
    setAt: ts,
    menuVersionAtSet: menu.version,
    ownerId: previous?.ownerId ?? LOCAL_OWNER_ID,
    createdAt: previous?.createdAt ?? ts,
    updatedAt: ts,
  };
  return { ok: true, store: { ...store, overrides: { ...store.overrides, [date]: next }, updatedAt: ts } };
}

/** US-E4-03/AC3, AC6: 「自動判定に戻す」 removes the override; refused for a date before today. */
export function clearOverride(store: BentoMinderStore, date: LocalDate, env: OverrideEnv): OverrideResult {
  if (date < env.today) return { ok: false, rule: 'override-no-past-write' };
  if (store.overrides[date] === undefined) return { ok: true, store };
  const overrides = Object.fromEntries(Object.entries(store.overrides).filter(([key]) => key !== date));
  return { ok: true, store: { ...store, overrides, updatedAt: toJstTimestamp(env.now) } };
}
