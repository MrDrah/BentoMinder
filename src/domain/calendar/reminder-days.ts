// Builds the reminder planner's input from the store through the day viewer (the composition point;
// `reminders` itself never imports `decision`, ADR 004 §5). Pure: `now` is passed in.
import { planReminders, type PlanResult, type ReminderDay, type ScheduledRef } from '../reminders/plan.ts';
import { REMINDER_HORIZON_DAYS } from '../rules.ts';
import type { BentoMinderStore } from '../schema/index.ts';
import { addDays, todayJst, type Instant } from '../time/jst.ts';
import type { DayViewer } from './day-view.ts';

export interface ReminderEnv {
  /** Whether the recipe still exists in the library (false: the tap opens the day sheet, US-E7-02/AC2). */
  recipeExists?: (id: string) => boolean;
  /** Allergen ids the recipe contains (US-E1-05/AC2); only ids the child has registered are passed on. */
  recipeAllergenIds?: (id: string) => readonly string[];
  horizonDays?: number;
}

/** The days the planner may need: last week's weekly coverage up to the horizon plus a week. */
export function reminderDays(store: BentoMinderStore, view: DayViewer, now: Instant, env: ReminderEnv = {}): ReminderDay[] {
  const today = todayJst(now);
  const horizon = env.horizonDays ?? REMINDER_HORIZON_DAYS.web;
  const known = new Set(store.profile?.knownAllergenIds ?? []);
  const days: ReminderDay[] = [];
  for (let date = addDays(today, -6); date <= addDays(today, horizon + 8); date = addDays(date, 1)) {
    const v = view(store, date, today);
    const r = v.record;
    const bento = v.displayed.state === 'homemade-bento-planned' && r !== undefined && r.recipeId !== undefined;
    days.push({
      date,
      state: v.displayed.state,
      plannedAt: bento && r.plannedAt !== undefined ? (Date.parse(r.plannedAt) as Instant) : undefined,
      recipe:
        bento && r.recipeNameSnapshot !== undefined && r.recipeShortNameSnapshot !== undefined && r.recipeId !== undefined
          ? {
              id: r.recipeId,
              nameJa: r.recipeNameSnapshot.ja,
              nameEn: r.recipeNameSnapshot.en,
              shortJa: r.recipeShortNameSnapshot.ja,
              shortEn: r.recipeShortNameSnapshot.en,
              resolves: env.recipeExists?.(r.recipeId) ?? true,
            }
          : undefined,
      conflict: v.conflict,
      needsAck: v.displayed.needsAck,
      lowPreference: v.assessment?.state === 'low-preference',
      hasMenu: v.menuVersion !== null,
      allergenIds: bento && r.recipeId !== undefined ? (env.recipeAllergenIds?.(r.recipeId) ?? []).filter((a) => known.has(a)) : undefined,
    });
  }
  return days;
}

export function planRemindersForStore(
  store: BentoMinderStore,
  view: DayViewer,
  now: Instant,
  previous: readonly ScheduledRef[] = [],
  env: ReminderEnv = {},
): PlanResult {
  return planReminders({
    settings: store.settings.reminders,
    days: reminderDays(store, view, now, env),
    now,
    log: store.reminderLog,
    previous,
    horizonDays: env.horizonDays ?? REMINDER_HORIZON_DAYS.web,
  });
}
