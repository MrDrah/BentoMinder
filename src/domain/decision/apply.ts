// Applying a parent event to the store (BR-02): the one place `decisions` is written. The store
// is returned as a new object; the caller saves it (the repository validates every write, and
// refuses it when another tab saved first, ADR 003 change log 2026-10-25).
import { dayTypeOf, decisionKindOf } from '../menu/day-kind.ts';
import type { BentoMinderStore } from '../schema/index.ts';
import { monthOf, toJstTimestamp, type LocalDate } from '../time/jst.ts';
import { transition, type DayContext, type DecisionEvent, type DecisionError, type TransitionEnv } from './decision.ts';

/** The date's context in the store: its kind in the confirmed menu of its month. */
export function dayContextOf(store: BentoMinderStore, date: LocalDate): DayContext {
  const menu = store.menus[monthOf(date)]?.confirmed ?? null;
  return {
    date,
    kind: decisionKindOf(dayTypeOf(menu, date)),
    menuVersion: menu?.version ?? null,
    changedInCurrentVersion: menu?.changedDatesSincePrevious.includes(date) ?? false,
  };
}

export type ApplyResult = { ok: true; store: BentoMinderStore } | { ok: false; error: DecisionError };

export function applyDecisionEvent(store: BentoMinderStore, date: LocalDate, event: DecisionEvent, env: TransitionEnv): ApplyResult {
  const result = transition(dayContextOf(store, date), store.decisions[date], event, env);
  if (!result.ok) return result;
  const kept = Object.entries(store.decisions).filter(([key]) => key !== date);
  const decisions = Object.fromEntries(result.next === null ? kept : [...kept, [date, result.next]]);
  return { ok: true, store: { ...store, decisions, updatedAt: toJstTimestamp(env.now) } };
}
