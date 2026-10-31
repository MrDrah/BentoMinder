// Reminder settings (US-E7-04/AC3, BR-16): times are 15-minute steps from 00:00 to 23:45, the weekly day is 0..6.
import { BR16 } from '../rules.ts';
import type { BentoMinderStore, Settings } from '../schema/index.ts';
import { toJstTimestamp, type Instant } from '../time/jst.ts';

export const HOURS: readonly string[] = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
export const MINUTES: readonly string[] = Array.from({ length: 60 / BR16.timeStepMinutes }, (_, i) => String(i * BR16.timeStepMinutes).padStart(2, '0'));

const TIME_RE = /^([01]\d|2[0-3]):(00|15|30|45)$/;

export const isReminderTime = (value: string): boolean => TIME_RE.test(value);

export function splitTime(time: string): { hour: string; minute: string } {
  const [hour = '00', minute = '00'] = time.split(':');
  return { hour, minute };
}

export type ReminderSettingsPatch = {
  weekly?: Partial<Settings['reminders']['weekly']>;
  dayBefore?: Partial<Settings['reminders']['dayBefore']>;
};

/** The store with the patch applied, or null when a value is not allowed (nothing is changed then). */
export function updateReminderSettings(store: BentoMinderStore, patch: ReminderSettingsPatch, now: Instant): BentoMinderStore | null {
  const weekly = { ...store.settings.reminders.weekly, ...patch.weekly };
  const dayBefore = { ...store.settings.reminders.dayBefore, ...patch.dayBefore };
  if (!Number.isInteger(weekly.weekday) || weekly.weekday < 0 || weekly.weekday > 6) return null;
  if (!isReminderTime(weekly.time) || !isReminderTime(dayBefore.time)) return null;
  const ts = toJstTimestamp(now);
  return {
    ...store,
    updatedAt: ts,
    settings: { ...store.settings, reminders: { ...store.settings.reminders, weekly, dayBefore }, updatedAt: ts },
  };
}
