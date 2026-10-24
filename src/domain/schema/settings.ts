// Data contract §3.9 Settings and ReminderSettings, §3.1 ReminderLogEntry.
import { z } from 'zod';
import { isLocalDate } from '../time/jst.ts';
import { clockTimeSchema, intRange, issue, metaShape, metaTimestampsOk, obj, timestampSchema } from './primitives.ts';

export const settingsSchema = obj({
  language: z.enum(['ja', 'en']),
  timezone: z.literal('Asia/Tokyo'),
  reminders: obj({
    weekly: obj({ enabled: z.boolean(), weekday: intRange(0, 6), time: clockTimeSchema }),
    dayBefore: obj({ enabled: z.boolean(), time: clockTimeSchema }),
    reservation: obj({ enabled: z.boolean(), time: clockTimeSchema }).optional(),
  }),
  nextMonthPromptFromDay: intRange(1, 28),
  weekStartsOn: z.enum(['monday', 'sunday']),
  theme: z.enum(['auto', 'light', 'dark']),
  ...metaShape,
}).superRefine((s, ctx) => {
  // US-E7-08 is v1 only: the reservation reminder must be absent or disabled in MVP builds.
  if (s.reminders.reservation?.enabled === true) issue(ctx, 'settings-reservation-v1-only', ['reminders', 'reservation']);
  if (!metaTimestampsOk(s)) issue(ctx, 'meta-timestamps', ['updatedAt']);
});
export type Settings = z.infer<typeof settingsSchema>;

const REMINDER_KEY_RE = /^(weekly|day-before):(\d{4}-\d{2}-\d{2})$/;

export const reminderLogEntrySchema = obj({
  key: z.string(),
  type: z.enum(['weekly', 'day-before']),
  dueAt: timestampSchema,
  expiresAt: timestampSchema,
  shownAt: timestampSchema.optional(),
  dismissedAt: timestampSchema.optional(),
  debug: z.boolean().optional(),
}).superRefine((e, ctx) => {
  const m = REMINDER_KEY_RE.exec(e.key);
  if (!m || m[1] !== e.type || !isLocalDate(m[2] ?? '')) issue(ctx, 'reminder-key-format', ['key']);
  if (!(Date.parse(e.expiresAt) > Date.parse(e.dueAt))) issue(ctx, 'reminder-expiry-after-due', ['expiresAt']);
});
export type ReminderLogEntry = z.infer<typeof reminderLogEntrySchema>;
