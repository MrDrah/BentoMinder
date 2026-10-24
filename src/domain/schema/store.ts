// Data contract §3.1 root store `BentoMinderStore` (ADR 003): one versioned document per device.
import { z } from 'zod';
import { dayDecisionSchema } from './decision.ts';
import { assessmentOverrideSchema, menuMonthSchema } from './menu.ts';
import { childProfileSchema } from './profile.ts';
import {
  dateSchema,
  intRange,
  issue,
  metaTimestampsOk,
  monthSchema,
  obj,
  timestampSchema,
} from './primitives.ts';
import { reminderLogEntrySchema, settingsSchema } from './settings.ts';

export const CURRENT_SCHEMA_VERSION = 1;

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const bentoMinderStoreSchema = obj({
  deviceId: z.string().regex(UUID_V4_RE, { error: 'device-id-invalid' }),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  settings: settingsSchema,
  profile: childProfileSchema.nullable(),
  menus: z.record(monthSchema, menuMonthSchema),
  overrides: z.record(dateSchema, assessmentOverrideSchema),
  decisions: z.record(dateSchema, dayDecisionSchema),
  reminderLog: z.array(reminderLogEntrySchema),
  consent: obj({ aiNoticeVersion: intRange(1), consentedAt: timestampSchema }).nullable(),
  aiUsage: z.record(monthSchema, intRange(0)),
}).superRefine((s, ctx) => {
  if (!metaTimestampsOk(s)) issue(ctx, 'meta-timestamps', ['updatedAt']);
  for (const [key, m] of Object.entries(s.menus)) if (m.month !== key) issue(ctx, 'store-key-mismatch', ['menus', key]);
  for (const [key, o] of Object.entries(s.overrides)) if (o.date !== key) issue(ctx, 'store-key-mismatch', ['overrides', key]);
  for (const [key, d] of Object.entries(s.decisions)) if (d.date !== key) issue(ctx, 'store-key-mismatch', ['decisions', key]);
  const keys = s.reminderLog.map((e) => e.key);
  if (new Set(keys).size !== keys.length) issue(ctx, 'reminder-key-unique', ['reminderLog']);
});
export type BentoMinderStore = z.infer<typeof bentoMinderStoreSchema>;

export interface RuleIssue {
  rule: string;
  path: string;
}

/** Flattens zod issues to `{ rule, path }` (the message is always the rule id when the contract names one). */
export function toRuleIssues(error: z.ZodError): RuleIssue[] {
  return error.issues.map((i) => ({ rule: i.message, path: i.path.map(String).join('.') }));
}
