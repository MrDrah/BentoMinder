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
  // US-E3-06/AC6 (OQ-24): the Tokyo date on which the next-month card was hidden; added to v1
  // at M1 prep before any store shipped, so no migration (ADR 003 change log).
  nextMonthCardHiddenOn: dateSchema.nullable(),
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

/**
 * Data contract 12.1 `meta-owner-matches-account` (store level): every record in an account's
 * store has `ownerId` equal to the uid in that store's key name. Not part of the zod schema
 * because it needs the account; the repository applies it when it is bound to one.
 */
export function ownerMismatches(store: BentoMinderStore, uid: string): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const check = (path: string, ownerId: string) => {
    if (ownerId !== uid) issues.push({ rule: 'meta-owner-matches-account', path });
  };
  check('settings.ownerId', store.settings.ownerId);
  if (store.profile !== null) check('profile.ownerId', store.profile.ownerId);
  for (const [k, m] of Object.entries(store.menus)) check(`menus.${k}.ownerId`, m.ownerId);
  for (const [k, o] of Object.entries(store.overrides)) check(`overrides.${k}.ownerId`, o.ownerId);
  for (const [k, d] of Object.entries(store.decisions)) check(`decisions.${k}.ownerId`, d.ownerId);
  return issues;
}

/** Flattens zod issues to `{ rule, path }` (the message is always the rule id when the contract names one). */
export function toRuleIssues(error: z.ZodError): RuleIssue[] {
  return error.issues.map((i) => ({ rule: i.message, path: i.path.map(String).join('.') }));
}
