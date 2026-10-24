// Business-rule constants (ADR 004). These are approved rules from docs/PLAN.md §3, not a
// tunable policy: changing one is a BR change logged in PLAN §7, then a code + test change.
// The QA oracle and the engines read the same numbers from here.

/** BR-04: preference assessment thresholds. U is compared exactly: 2 × uncertain ≤ assessed. */
export const BR04 = {
  /** D at or above this → `low-preference`. */
  lowPreferenceDislikes: 2,
  /** U above this share (as a fraction numerator / denominator) blocks `likely-enjoyable`. */
  uncertainShareNumerator: 1,
  uncertainShareDenominator: 2,
} as const;

/** BR-09: recipe ranking score terms and limits. */
export const BR09 = {
  topCount: 3,
  perLikedId: 2,
  themeMatch: 1,
  perDislikedId: -3,
  recentlyPlanned: -2,
  recentWindowDays: 14,
  slowRecipe: -1,
  slowRecipeAboveMinutes: 20,
} as const;

/** BR-16: reminder defaults (both configurable in 15-minute steps, both can be switched off). */
export const BR16 = {
  weeklyWeekday: 0, // Sunday
  weeklyTime: '14:00',
  weeklyCoveredDays: 7,
  dayBeforeTime: '17:30',
  timeStepMinutes: 15,
} as const;

/** ADR 004 §4: how far ahead reminders are planned. */
export const REMINDER_HORIZON_DAYS = { web: 8, android: 35 } as const;

/** Contract §3.1: reminder log entries older than this may be pruned. */
export const REMINDER_LOG_RETENTION_DAYS = 60;

/** Contract §3.6: DayDecision.history keeps the last 5 changes. */
export const DECISION_HISTORY_LIMIT = 5;
