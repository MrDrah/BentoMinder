// The in-app reminder engine (ADR 005 §2, ADR 011): plans from the store on open, on every store change,
// every minute and when the tab becomes visible again; applies the diff to the web adapter; shows the
// due reminders (visibleReminders) and writes shownAt / dismissedAt to the store's reminderLog, once per key.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { planRemindersForStore } from '../../domain/calendar/reminder-days.ts';
import type { ReminderJob } from '../../domain/ports.ts';
import { pruneLog, recordDismissed, recordShown, visibleReminders } from '../../domain/reminders/index.ts';
import { toJstTimestamp, type Instant } from '../../domain/time/jst.ts';
import { useApp, useStore } from '../app-store.tsx';
import { useDayViewer } from '../calendar/use-day-viewer.ts';

export interface ShownReminder {
  job: ReminderJob;
  /** The original due time (US-E7-05/AC2, AC4). */
  labelAt: Instant;
  /** Not shown live in this session: missed while closed, or shown before (the banner carries the time label). */
  late: boolean;
}

interface RemindersValue {
  shown: readonly ShownReminder[];
  dismiss: (key: string) => Promise<boolean>;
  markShown: (jobs: readonly ReminderJob[]) => Promise<void>;
}

const RemindersContext = createContext<RemindersValue>({ shown: [], dismiss: () => Promise.resolve(false), markShown: () => Promise.resolve() });

export const useReminders = (): RemindersValue => useContext(RemindersContext);

/** Day-before reminders first, then the weekly one; newest first inside a type (components §8.2). */
const byOrder = (a: ShownReminder, b: ShownReminder) =>
  a.job.type === b.job.type ? b.job.dueAt - a.job.dueAt || (a.job.key < b.job.key ? -1 : 1) : a.job.type === 'day-before' ? -1 : 1;

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { services, now, commit, showSaveFailed } = useApp();
  const store = useStore();
  const viewer = useDayViewer();
  const [tick, setTick] = useState(0);
  const [shown, setShown] = useState<readonly ShownReminder[]>([]);
  const live = useRef(new Set<string>());
  const lastEval = useRef<Instant | null>(null);
  const writing = useRef(false);
  const storeRef = useRef(store);
  storeRef.current = store;
  const { notifications, library } = services;

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const id = setInterval(bump, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', bump);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', bump);
    };
  }, []);

  useEffect(() => {
    const at = now();
    const before = lastEval.current;
    lastEval.current = at;
    let cancelled = false;
    // Nothing is planned until a profile exists: a fresh install must not write a store or show reminders.
    const plan =
      store.profile === null
        ? { jobs: [] as ReminderJob[], diff: { remove: notifications.scheduled().map((r) => r.key), upsert: [] as ReminderJob[] } }
        : planRemindersForStore(store, viewer, at, notifications.scheduled(), {
            recipeExists: (id) => library.some((r) => r.id === id),
            recipeAllergenIds: (id) => library.find((r) => r.id === id)?.allergenIds ?? [],
          });
    void notifications.apply(plan.diff).then(() => {
      if (cancelled) return;
      const visible = visibleReminders(notifications.jobs(), store.reminderLog, at);
      for (const v of visible) {
        // A reminder that became due between two checks of this session is live; any other is missed or repeated.
        if (before !== null && v.job.dueAt > before && !store.reminderLog.some((e) => e.key === v.job.key && e.shownAt !== undefined)) live.current.add(v.job.key);
      }
      setShown(visible.map((v) => ({ job: v.job, labelAt: v.labelAt, late: !live.current.has(v.job.key) })).sort(byOrder));
    });
    return () => {
      cancelled = true;
    };
  }, [store, viewer, tick, now, notifications, library]);

  // Called by the reminder list once its banners are on screen: shownAt is written once per key, so
  // nothing is written for reminders the parent could not have seen (e.g. while on the settings screen).
  const markShown = useCallback(
    async (jobs: readonly ReminderJob[]) => {
      if (writing.current) return;
      const current = storeRef.current;
      const at = now();
      const log = recordShown(pruneLog(current.reminderLog, at), jobs, at);
      if (log === current.reminderLog) return;
      writing.current = true;
      const ok = await commit({ ...current, reminderLog: [...log], updatedAt: toJstTimestamp(at) });
      writing.current = false;
      if (!ok) showSaveFailed();
    },
    [now, commit, showSaveFailed],
  );

  const dismiss = useCallback(
    async (key: string) => {
      const job = notifications.jobs().find((j) => j.key === key);
      if (job === undefined) return false;
      const at = now();
      const log = recordDismissed(store.reminderLog, job, at);
      if (log === store.reminderLog) return true;
      const ok = await commit({ ...store, reminderLog: [...log], updatedAt: toJstTimestamp(at) });
      if (!ok) showSaveFailed();
      return ok;
    },
    [notifications, now, store, commit, showSaveFailed],
  );

  const value = useMemo(() => ({ shown, dismiss, markShown }), [shown, dismiss, markShown]);
  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}
