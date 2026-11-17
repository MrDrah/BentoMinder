// NotificationScheduler native adapter (ADR 005 §3, feasibility §4): the in-app behaviour of the web adapter
// (it is composed in, so the banners and the Today view work exactly as on the web) plus one-shot system
// notifications through @capacitor/local-notifications.
//
// The device's pending notifications are reconciled with the planner's jobs after every `apply` and on every
// app resume (`sync`), so the system state never depends on what an earlier run remembered: stale ones are
// cancelled, missing or changed ones are scheduled, an unchanged one is left alone (no duplicates).
// Nothing here asks for the notification permission by itself: `requestPermission()` is called by the UI after
// a parent action. Without the permission the adapter stays in-app only (the web behaviour).
import type { NotificationPermission, ReminderJob } from '../../domain/ports.ts';
import { numericIdForKey } from '../../domain/reminders/plan.ts';
import { REMINDER_HORIZON_DAYS } from '../../domain/rules.ts';
import { createWebNotifications, type WebNotifications } from '../web/notifications.ts';
import { defaultRenderer, type TextRenderer } from './notification-text.ts';
import type { NativePlugins, PermissionState } from './plugins.ts';

export const REMINDER_CHANNEL_ID = 'reminders';

export interface NativeNotifications extends WebNotifications {
  horizonDays: number;
  onResume(handler: () => void): () => void;
  setTextRenderer(render: TextRenderer): void;
  /** Re-read the permission and the exact-alarm setting, then reconcile (called on resume). */
  refresh(): Promise<void>;
  /** The state the UI may show: system permission, whether exact alarms are allowed, whether the last schedule fell back to inexact. */
  status(): { permission: NotificationPermission; exactAllowed: boolean; inexactFallback: boolean };
  /** Resolves when every queued native call has finished (tests, and the UI before it reads `status`). */
  idle(): Promise<void>;
}

export interface NativeNotificationsDeps {
  plugins: Pick<NativePlugins, 'localNotifications' | 'app'>;
  now: () => number;
  /** Where a tap goes when the UI has not registered `onTap` (the hash router). */
  navigate?: (route: string) => void;
  render?: TextRenderer;
  warn?: (message: string) => void;
}

const mapPermission = (state: PermissionState): NotificationPermission => (state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt');

/** The notification's own data: what a tap needs and what the reconcile compares. */
interface Extra {
  route: string;
  key: string;
  hash: string;
  expiresAt: number;
}
const readExtra = (value: unknown): Extra | null => {
  if (typeof value !== 'object' || value === null) return null;
  const e = value as Record<string, unknown>;
  return typeof e['route'] === 'string' && typeof e['key'] === 'string' && typeof e['hash'] === 'string' && typeof e['expiresAt'] === 'number'
    ? { route: e['route'], key: e['key'], hash: e['hash'], expiresAt: e['expiresAt'] }
    : null;
};

/** A tap on an outdated notification opens the day (day-before) or the same screen, never an outdated action (ADR 005 §3 "Expired"). */
export function tapRoute(extra: Extra, now: number): string {
  if (extra.expiresAt > now) return extra.route;
  const day = /^day-before:(\d{4}-\d{2}-\d{2})$/.exec(extra.key);
  return day === null ? extra.route : `#/day/${day[1]}`;
}

/** Ids for one batch: the planner's id when it is a valid 31-bit one not yet used, else derived from the key. */
export function idsFor(jobs: readonly ReminderJob[]): Map<string, number> {
  const used = new Set<number>();
  const out = new Map<string, number>();
  for (const job of jobs) {
    const valid = Number.isInteger(job.numericId) && job.numericId > 0 && job.numericId < 2 ** 31 && !used.has(job.numericId);
    const id = valid ? job.numericId : numericIdForKey(job.key, used);
    used.add(id);
    out.set(job.key, id);
  }
  return out;
}

export function createNativeNotifications(deps: NativeNotificationsDeps): NativeNotifications {
  const { localNotifications: ln, app } = deps.plugins;
  const warn = deps.warn ?? ((m: string) => console.warn(m));
  const base = createWebNotifications();
  let render: TextRenderer = deps.render ?? defaultRenderer;
  let permission: NotificationPermission = 'prompt';
  let exactAllowed = false;
  let inexactFallback = false;
  let tapRegistered = false;
  const resumeHandlers = new Set<() => void>();
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (work: () => Promise<void>): Promise<void> => {
    queue = queue.then(work, work).catch((err: unknown) => warn(`Reminder scheduling failed: ${err instanceof Error ? err.name : 'unknown error'}`));
    return queue;
  };

  let channel: Promise<void> | null = null;
  const ensureChannel = (): Promise<void> => {
    channel ??= ln.createChannel({ id: REMINDER_CHANNEL_ID, name: 'BentoMinder', importance: 4, visibility: 1 }).catch((err: unknown) => {
      channel = null; // try again next time
      throw err;
    });
    return channel;
  };

  const deliver = (route: string) => {
    if (tapRegistered) base.tap(route);
    else if (deps.navigate !== undefined) deps.navigate(route);
    else if (typeof window !== 'undefined') window.location.hash = route;
  };

  const readStatus = async () => {
    permission = mapPermission((await ln.checkPermissions()).display);
    try {
      exactAllowed = (await ln.checkExactNotificationSetting()).exact_alarm === 'granted';
    } catch {
      exactAllowed = false;
    }
  };

  const reconcile = async () => {
    await readStatus();
    if (permission !== 'granted') return; // in-app reminders only
    await ensureChannel();
    const now = deps.now();
    const wanted = base.jobs().filter((j) => j.dueAt > now && j.expiresAt > now);
    const ids = idsFor(wanted);
    const pending = (await ln.getPending()).notifications;
    const byKey = new Map<string, { id: number; hash: string }>();
    const stale: { id: number }[] = [];
    for (const p of pending) {
      const extra = readExtra(p.extra);
      if (extra === null) continue; // not ours
      const job = wanted.find((j) => j.key === extra.key);
      if (job === undefined || ids.get(job.key) !== p.id || byKey.has(extra.key)) stale.push({ id: p.id });
      else byKey.set(extra.key, { id: p.id, hash: extra.hash });
    }
    if (stale.length > 0) await ln.cancel({ notifications: stale });
    const toSchedule = wanted.filter((j) => byKey.get(j.key)?.hash !== j.contentHash);
    if (toSchedule.length === 0) return;
    const result = await ln.schedule({
      notifications: toSchedule.map((job) => {
        const text = render(job);
        const extra: Extra = { route: job.target.route, key: job.key, hash: job.contentHash, expiresAt: job.expiresAt };
        return {
          id: ids.get(job.key) as number,
          title: text.title,
          body: text.body.split('\n')[0] ?? '',
          largeBody: text.body,
          schedule: { at: new Date(job.dueAt), allowWhileIdle: true },
          channelId: REMINDER_CHANNEL_ID,
          // Never opens the system "Alarms & reminders" screen by itself: exact only when it is already allowed.
          isExactNotification: exactAllowed,
          extra: { ...extra },
        };
      }),
    });
    inexactFallback = result.warning !== undefined;
  };

  let started: Promise<void> | null = null;
  const start = (): Promise<void> => {
    started ??= (async () => {
      await ln.addListener('localNotificationActionPerformed', (event) => {
        const extra = readExtra(event.notification.extra);
        if (extra !== null) deliver(tapRoute(extra, deps.now()));
      });
      await app.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        void enqueue(reconcile).then(() => {
          for (const h of [...resumeHandlers]) h();
        });
      });
    })().catch((err: unknown) => {
      started = null;
      warn(`Reminder listeners failed: ${err instanceof Error ? err.name : 'unknown error'}`);
    });
    return started;
  };

  return {
    ...base,
    horizonDays: REMINDER_HORIZON_DAYS.android,
    capabilities: () => ({ background: permission === 'granted', exactTime: permission === 'granted' && exactAllowed }),
    permission: () => enqueue(readStatus).then(() => permission),
    async requestPermission() {
      await enqueue(async () => {
        await ensureChannel();
        permission = mapPermission((await ln.requestPermissions()).display);
      });
      if (permission === 'granted') await enqueue(reconcile);
      return permission === 'granted' ? 'granted' : 'denied';
    },
    async apply(diff) {
      void start();
      await base.apply(diff);
      await enqueue(reconcile);
    },
    async cancelAll() {
      await base.cancelAll();
      await enqueue(async () => {
        const pending = (await ln.getPending()).notifications.filter((p) => readExtra(p.extra) !== null);
        if (pending.length > 0) await ln.cancel({ notifications: pending.map((p) => ({ id: p.id })) });
      });
    },
    onTap(handler) {
      tapRegistered = true;
      base.onTap(handler);
    },
    onResume(handler) {
      resumeHandlers.add(handler);
      return () => resumeHandlers.delete(handler);
    },
    setTextRenderer(next) {
      render = next;
    },
    refresh: () => enqueue(reconcile),
    status: () => ({ permission, exactAllowed, inexactFallback }),
    idle: () => queue,
  };
}
