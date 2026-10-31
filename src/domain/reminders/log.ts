// The reminder log (data contract §3.1 ReminderLogEntry, ADR 005 §2, ADR 011): shown and dismissed
// are written once per key; calling these again with the same inputs returns the same array object,
// so a caller can skip the write. Pure: `at` is passed in.
import type { ReminderJob } from '../ports.ts';
import { REMINDER_LOG_RETENTION_DAYS } from '../rules.ts';
import type { ReminderLogEntry } from '../schema/index.ts';
import { toJstTimestamp, type Instant } from '../time/jst.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

const entryOf = (job: ReminderJob, at: Instant): ReminderLogEntry => ({
  key: job.key,
  type: job.type,
  dueAt: toJstTimestamp(job.dueAt),
  expiresAt: toJstTimestamp(job.expiresAt),
  shownAt: toJstTimestamp(at),
});

/** Drops entries whose expiry is more than 60 days old (contract §3.1); same array when none. */
export function pruneLog(log: readonly ReminderLogEntry[], at: Instant): readonly ReminderLogEntry[] {
  const cutoff = at - REMINDER_LOG_RETENTION_DAYS * DAY_MS;
  const kept = log.filter((e) => Date.parse(e.expiresAt) >= cutoff);
  return kept.length === log.length ? log : kept;
}

/** Sets `shownAt` on the entries of the shown jobs that have none (creating the entry); never overwrites. */
export function recordShown(log: readonly ReminderLogEntry[], jobs: readonly ReminderJob[], at: Instant): readonly ReminderLogEntry[] {
  let next: ReminderLogEntry[] | null = null;
  for (const job of jobs) {
    const list = next ?? log;
    const i = list.findIndex((e) => e.key === job.key);
    const existing = i < 0 ? undefined : list[i];
    if (existing?.shownAt !== undefined) continue;
    next ??= [...log];
    if (existing === undefined) next.push(entryOf(job, at));
    else next[i] = { ...existing, shownAt: toJstTimestamp(at) };
  }
  return next ?? log;
}

/** Sets `dismissedAt` once (a dismissed reminder is never shown again, US-E7-05/AC1). */
export function recordDismissed(log: readonly ReminderLogEntry[], job: ReminderJob, at: Instant): readonly ReminderLogEntry[] {
  const i = log.findIndex((e) => e.key === job.key);
  const existing = i < 0 ? undefined : log[i];
  if (existing?.dismissedAt !== undefined) return log;
  const stamp = toJstTimestamp(at);
  const entry: ReminderLogEntry = { ...(existing ?? entryOf(job, at)), dismissedAt: stamp };
  if (entry.shownAt === undefined) entry.shownAt = stamp;
  return i < 0 ? [...log, entry] : log.map((e, n) => (n === i ? entry : e));
}
