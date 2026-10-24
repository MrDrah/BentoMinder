// NotificationScheduler web adapter: in-app reminders only (BR-18, ADR 005). M0 stub: no-op.
// M4 renders due reminders inside the app; no system notifications on the web.
import type { NotificationScheduler } from '../../domain/ports.ts';

export function createWebNotifications(): NotificationScheduler {
  return {
    capabilities: () => ({ background: false, exactTime: false }),
    permission: () => Promise.resolve('not-needed'),
    requestPermission: () => Promise.resolve('denied'),
    apply: () => Promise.resolve(),
    cancelAll: () => Promise.resolve(),
    onTap: () => undefined,
  };
}
