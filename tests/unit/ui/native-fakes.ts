// A fake Capacitor plugin layer for the native adapter tests (US-E12-01): records calls, keeps pending notifications
// in memory like the OS would, and lets a test fire the listeners.
import type {
  ActionPerformedEvent,
  FilesystemPlugin,
  LocalNotificationsPlugin,
  PendingNotification,
  PermissionState,
  PreferencesPlugin,
  ScheduledNotification,
  SharePlugin,
} from '../../../src/adapters/native/plugins.ts';
import type { ReminderJob } from '../../../src/domain/ports.ts';

export interface FakeLocalNotifications extends LocalNotificationsPlugin {
  calls: string[];
  pending: Map<number, ScheduledNotification>;
  permission: PermissionState;
  /** What requestPermissions will answer. */
  onRequest: PermissionState;
  exact: PermissionState;
  warning: { code: string; message: string } | undefined;
  channels: string[];
  tap(event: ActionPerformedEvent): void;
  failSchedule: boolean;
}

export function fakeLocalNotifications(): FakeLocalNotifications {
  let tapListener: ((e: ActionPerformedEvent) => void) | null = null;
  const f: FakeLocalNotifications = {
    calls: [],
    pending: new Map(),
    permission: 'prompt',
    onRequest: 'granted',
    exact: 'denied',
    warning: undefined,
    channels: [],
    failSchedule: false,
    createChannel: (c) => {
      f.calls.push('createChannel');
      f.channels.push(c.id);
      return Promise.resolve();
    },
    schedule: ({ notifications }) => {
      f.calls.push('schedule');
      if (f.failSchedule) return Promise.reject(new Error('boom'));
      if (!f.channels.includes('reminders')) return Promise.reject(new Error('channel missing: the notification would not fire'));
      if (f.permission !== 'granted') return Promise.reject(new Error('permission'));
      for (const n of notifications) f.pending.set(n.id, n);
      return Promise.resolve(f.warning === undefined ? {} : { warning: f.warning });
    },
    cancel: ({ notifications }) => {
      f.calls.push('cancel');
      for (const n of notifications) f.pending.delete(n.id);
      return Promise.resolve();
    },
    getPending: () => {
      f.calls.push('getPending');
      return Promise.resolve({ notifications: [...f.pending.values()].map((n): PendingNotification => ({ id: n.id, extra: n.extra })) });
    },
    checkPermissions: () => {
      f.calls.push('checkPermissions');
      return Promise.resolve({ display: f.permission });
    },
    requestPermissions: () => {
      f.calls.push('requestPermissions');
      f.permission = f.onRequest;
      return Promise.resolve({ display: f.permission });
    },
    checkExactNotificationSetting: () => Promise.resolve({ exact_alarm: f.exact }),
    addListener: (_event, listener) => {
      tapListener = listener;
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
    tap: (e) => tapListener?.(e),
  };
  return f;
}

export function fakeApp() {
  let listener: ((s: { isActive: boolean }) => void) | null = null;
  return {
    addListener: (_e: 'appStateChange', l: (s: { isActive: boolean }) => void) => {
      listener = l;
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
    setActive: (isActive: boolean) => listener?.({ isActive }),
  };
}

export function fakePreferences(initial: Record<string, string> = {}): PreferencesPlugin & { data: Map<string, string>; failSet: boolean } {
  const data = new Map(Object.entries(initial));
  const p = {
    data,
    failSet: false,
    get: ({ key }: { key: string }) => Promise.resolve({ value: data.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      if (p.failSet) return Promise.reject(new Error('disk full'));
      data.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
  return p;
}

export function fakeShare(canShare = true): SharePlugin & { shared: unknown[]; fail: boolean } {
  const s = {
    shared: [] as unknown[],
    fail: false,
    canShare: () => Promise.resolve({ value: canShare }),
    share: (o: unknown) => {
      if (s.fail) return Promise.reject(new Error('Share canceled'));
      s.shared.push(o);
      return Promise.resolve({});
    },
  };
  return s;
}

export function fakeFilesystem(): FilesystemPlugin & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    writeFile: ({ path, data }) => {
      files.set(path, data);
      return Promise.resolve({ uri: `file:///cache/${path}` });
    },
  };
}

export function job(date: string, hour: number, extra: Partial<ReminderJob> = {}): ReminderJob {
  const dueAt = Date.parse(`${date}T${String(hour).padStart(2, '0')}:30:00+09:00`);
  return {
    key: `day-before:${date}`,
    numericId: Math.abs(Number(date.replaceAll('-', ''))) % 2 ** 31,
    type: 'day-before',
    dueAt,
    expiresAt: dueAt + 6.5 * 3600_000,
    target: { route: `#/recipe/r1?date=${date}` },
    content: { titleKey: 'reminders.dayBefore.title', bodyKey: 'reminders.dayBefore.body', params: { recipeNameJa: 'ひまわり弁当', recipeNameEn: 'Sunflower bento' } },
    contentHash: `h-${date}`,
    ...extra,
  } as ReminderJob;
}
