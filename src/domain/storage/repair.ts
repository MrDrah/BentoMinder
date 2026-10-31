// US-E7-04/AC3: a stored reminder time that is not an allowed value (「24:00」, 「17:31」) is replaced by the
// default instead of failing the whole store. Only these two fields are repaired; everything else is validated as is.
import { BR16 } from '../rules.ts';

const TIME_RE = /^([01]\d|2[0-3]):(00|15|30|45)$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function fix(group: unknown, fallback: string): unknown {
  if (!isRecord(group) || typeof group['time'] !== 'string' || TIME_RE.test(group['time'])) return group;
  return { ...group, time: fallback };
}

export function repairReminderTimes(doc: Record<string, unknown>): Record<string, unknown> {
  const settings = doc['settings'];
  if (!isRecord(settings) || !isRecord(settings['reminders'])) return doc;
  const r = settings['reminders'];
  const weekly = fix(r['weekly'], BR16.weeklyTime);
  const dayBefore = fix(r['dayBefore'], BR16.dayBeforeTime);
  if (weekly === r['weekly'] && dayBefore === r['dayBefore']) return doc;
  return { ...doc, settings: { ...settings, reminders: { ...r, weekly, dayBefore } } };
}
