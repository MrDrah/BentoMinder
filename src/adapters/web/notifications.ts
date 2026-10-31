// NotificationScheduler web adapter: in-app reminders only (BR-18, ADR 005 §1-2, ADR 011). There is no
// system notification and no Notification permission prompt; `apply` keeps the planned jobs in memory
// (they are re-planned from the store on every start, so nothing is persisted here) and the UI shows
// the due ones. The extra methods are the web adapter's own: the UI reads the jobs and the refs back.
import type { NotificationScheduler, ReminderJob } from '../../domain/ports.ts';
import type { ScheduledRef } from '../../domain/reminders/plan.ts';

export interface WebNotifications extends NotificationScheduler {
  /** The jobs applied so far, in the planner's order (due, then key). */
  jobs(): ReminderJob[];
  /** Key and hash of every job (the `previous` input of the next plan). */
  scheduled(): ScheduledRef[];
  /** The route of a tapped reminder goes to the handler registered with `onTap`. */
  tap(route: string): void;
}

export function createWebNotifications(): WebNotifications {
  const held = new Map<string, ReminderJob>();
  let handler: ((route: string) => void) | null = null;
  const sorted = () => [...held.values()].sort((a, b) => a.dueAt - b.dueAt || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    capabilities: () => ({ background: false, exactTime: false }),
    permission: () => Promise.resolve('not-needed'),
    requestPermission: () => Promise.resolve('denied'),
    apply: (diff) => {
      for (const key of diff.remove) held.delete(key);
      for (const job of diff.upsert) held.set(job.key, job);
      return Promise.resolve();
    },
    cancelAll: () => {
      held.clear();
      return Promise.resolve();
    },
    onTap: (next) => {
      handler = next;
    },
    jobs: sorted,
    scheduled: () => sorted().map((j) => ({ key: j.key, contentHash: j.contentHash })),
    tap: (route) => handler?.(route),
  };
}

/** The device's IANA time zone (US-E7-07/AC2: times are labelled when it is not Asia/Tokyo). */
export function deviceIsTokyo(): boolean {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Tokyo';
  } catch {
    return true;
  }
}
