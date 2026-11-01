// Reminder planning (BR-15, BR-16, BR-17, BR-18; ADR 004 §4, ADR 005 §2, ADR 010). Pure: no clock,
// no device timezone (every instant comes from JST wall-time arithmetic), no decision import.
// `reminders` receives digested days; `calendar/reminder-days.ts` builds them from the store.
import type { ReminderJob } from '../ports.ts';
import type { ReminderLogEntry, Settings } from '../schema/index.ts';
import { addDays, jstWallToInstant, monthOf, todayJst, weekdayOf, type Instant, type LocalDate, type WallTime } from '../time/jst.ts';
import { REMINDER_HORIZON_DAYS } from '../rules.ts';

export type ReminderDayState = 'school-lunch-planned' | 'not-confirmed' | 'homemade-bento-planned' | 'no-school-lunch';

/** What the planner needs to know about one date: the displayed decision and a few flags. */
export interface ReminderDay {
  date: LocalDate;
  /** The displayed decision; null outside the menu. A refresh-conflict plan is still `homemade-bento-planned` (B7). */
  state: ReminderDayState | null;
  /** First confirm into homemade-bento-planned (B10); unchanged by a recipe change. */
  plannedAt?: Instant | undefined;
  recipe?: { id: string; nameJa: string; nameEn?: string | undefined; shortJa: string; shortEn: string; resolves: boolean } | undefined;
  /** Refresh conflict (plan on a now-no-lunch or removed date). */
  conflict: boolean;
  /** The conflict is not yet acknowledged (shown in the weekly content). */
  needsAck: boolean;
  /** Assessment is low-preference (苦手かも). */
  lowPreference: boolean;
  /** The date's month has a confirmed menu. */
  hasMenu: boolean;
  /** Allergen ids of the child that the planned recipe contains (ids only, US-E1-05/AC2). */
  allergenIds?: readonly string[] | undefined;
}

export type ScheduledRef = { key: string; contentHash: string };
export interface ScheduleDiff {
  remove: string[];
  upsert: ReminderJob[];
}

export interface PlanInput {
  settings: Settings['reminders'];
  days: readonly ReminderDay[];
  now: Instant;
  log: readonly ReminderLogEntry[];
  /** The jobs currently scheduled (key and hash only); default none. */
  previous?: readonly ScheduledRef[];
  /** Web 8, Android 35 (ADR 004 §4). */
  horizonDays?: number;
  /** US-E7-05 (M5-D04): reminders due before this instant (the profile's creation) are never planned, not even as missed. */
  notBefore?: Instant | undefined;
}

export interface PlanResult {
  jobs: ReminderJob[];
  diff: ScheduleDiff;
}

type Params = ReminderJob['content']['params'];
type Draft = Omit<ReminderJob, 'numericId'>;

const dayStart = (date: LocalDate): Instant => jstWallToInstant(date, '00:00'); // 00:00 JST of `date`

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Key-sorted JSON so a hash does not depend on property order. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const part = (text: string): string => text.replaceAll('|', ' ');

function build(key: string, type: ReminderJob['type'], dueAt: Instant, expiresAt: Instant, route: string, titleKey: string, bodyKey: string, params: Params): Draft {
  const content = { titleKey, bodyKey, params };
  const contentHash = fnv1a(stable({ type, dueAt, expiresAt, route, content })).toString(16).padStart(8, '0');
  return { key, type, dueAt, expiresAt, target: { route }, content, contentHash };
}

function dayBeforeJob(day: ReminderDay, time: WallTime | string): Draft | null {
  if (day.state !== 'homemade-bento-planned') return null;
  const dueAt = jstWallToInstant(addDays(day.date, -1), time);
  // B10: suppressed only when first planned strictly after the due instant (equality creates it, RM36).
  if (day.plannedAt !== undefined && day.plannedAt > dueAt) return null;
  const r = day.recipe;
  const route = r !== undefined && r.resolves ? `#/recipe/${r.id}?date=${day.date}` : `#/day/${day.date}`;
  const params: Params = { date: day.date };
  if (r !== undefined) {
    params['recipeId'] = r.id;
    params['recipeNameJa'] = r.nameJa;
    if (r.nameEn !== undefined) params['recipeNameEn'] = r.nameEn;
  }
  if (day.conflict) params['conflict'] = 1;
  if (day.allergenIds !== undefined && day.allergenIds.length > 0) params['allergenIds'] = [...day.allergenIds].sort();
  return build(`day-before:${day.date}`, 'day-before', dueAt, dayStart(day.date), route, 'reminders.dayBefore.title', 'reminders.dayBefore.body', params);
}

function weeklyJob(sunday: LocalDate, time: WallTime | string, byDate: ReadonlyMap<LocalDate, ReminderDay>): Draft {
  const from = addDays(sunday, 1);
  const to = addDays(sunday, 7);
  const bento: string[] = [];
  const low: string[] = [];
  const undecided: string[] = [];
  const conflict: string[] = [];
  const noMenu = new Set<string>();
  let withMenu = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(from, i);
    const day = byDate.get(date);
    if (day === undefined || !day.hasMenu) noMenu.add(monthOf(date));
    else withMenu += 1;
    if (day === undefined) continue;
    if (day.state === 'homemade-bento-planned') {
      bento.push(`${date}|${part(day.recipe?.shortJa ?? '')}|${part(day.recipe?.shortEn ?? '')}`);
      if (day.conflict && day.needsAck) conflict.push(date);
    } else if (day.lowPreference && (day.state === 'school-lunch-planned' || day.state === 'not-confirmed')) low.push(date);
    else if (day.state === 'not-confirmed') undecided.push(date);
  }
  const params: Params = { from, to };
  if (bento.length > 0) params['bento'] = bento;
  if (low.length > 0) params['low'] = low;
  if (undecided.length > 0) params['undecided'] = undecided;
  if (conflict.length > 0) params['conflict'] = conflict;
  if (withMenu > 0 && noMenu.size > 0) params['noMenuMonths'] = [...noMenu].sort();
  const bodyKey =
    withMenu === 0
      ? 'reminders.weekly.noMenu'
      : bento.length + low.length + undecided.length + conflict.length + noMenu.size === 0
        ? 'reminders.weekly.empty'
        : 'reminders.weekly.summary';
  return build(`weekly:${from}`, 'weekly', jstWallToInstant(sunday, time), dayStart(addDays(sunday, 8)), `#/calendar/${monthOf(from)}`, 'reminders.weekly.title', bodyKey, params);
}

/** Stable 31-bit id of a key (Android notification id); a collision inside one plan is probed away. */
function assignIds(drafts: Draft[]): ReminderJob[] {
  const used = new Set<number>();
  return drafts.map((draft) => {
    let salt = 0;
    let id = fnv1a(draft.key) & 0x7fffffff;
    while (id === 0 || used.has(id)) {
      salt += 1;
      id = fnv1a(`${draft.key}#${salt}`) & 0x7fffffff;
    }
    used.add(id);
    return { ...draft, numericId: id };
  });
}

export function diffSchedule(current: readonly ScheduledRef[], desired: readonly ReminderJob[]): ScheduleDiff {
  const have = new Map(current.map((c) => [c.key, c.contentHash]));
  const want = new Set(desired.map((j) => j.key));
  return {
    remove: [...have.keys()].filter((k) => !want.has(k)).sort(),
    upsert: desired.filter((j) => have.get(j.key) !== j.contentHash),
  };
}

/**
 * The reminders that should exist at `now`: unexpired, not dismissed, within the horizon, sorted by
 * `dueAt` then key. Same inputs give the same jobs; applying the diff and planning again gives an
 * empty diff (BR-17).
 */
export function planReminders(input: PlanInput): PlanResult {
  const { settings, days, now, log } = input;
  const horizon = input.horizonDays ?? REMINDER_HORIZON_DAYS.web;
  const today = todayJst(now);
  const last = addDays(today, horizon);
  const dismissed = new Set(log.filter((e) => e.dismissedAt !== undefined).map((e) => e.key));
  const byDate = new Map<LocalDate, ReminderDay>(days.map((d) => [d.date, d]));
  const found: Draft[] = [];

  if (settings.dayBefore.enabled) {
    for (const day of byDate.values()) {
      if (day.date <= today || day.date > last) continue; // D 00:00 JST <= now: expired
      const job = dayBeforeJob(day, settings.dayBefore.time);
      if (job !== null) found.push(job);
    }
  }
  if (settings.weekly.enabled) {
    for (let s = addDays(today, -7); s <= last; s = addDays(s, 1)) {
      if (weekdayOf(s) === settings.weekly.weekday) found.push(weeklyJob(s, settings.weekly.time, byDate));
    }
  }
  const wanted = found
    .filter((j) => j.expiresAt > now && !dismissed.has(j.key) && (input.notBefore === undefined || j.dueAt >= input.notBefore))
    .sort((a, b) => a.dueAt - b.dueAt || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const jobs = assignIds(wanted);
  return { jobs, diff: diffSchedule(input.previous ?? [], jobs) };
}

export interface VisibleReminder {
  job: ReminderJob;
  /** The time to label it with: the original due time (US-E7-05/AC2, AC4). */
  labelAt: Instant;
}

/**
 * Web, in-app: which planned reminders show at `now` (oracle section 1). `due <= now < expires`, or
 * already shown (OQ-20: a shown, undismissed reminder keeps showing until dismissed or expired, also
 * after a time change); never a dismissed key; of several weekly reminders only the latest.
 */
export function visibleReminders(jobs: readonly ReminderJob[], log: readonly ReminderLogEntry[], now: Instant): VisibleReminder[] {
  const entries = new Map(log.map((e) => [e.key, e]));
  const shown = jobs.filter((job) => {
    const entry = entries.get(job.key);
    if (entry?.dismissedAt !== undefined) return false;
    return job.expiresAt > now && (job.dueAt <= now || entry?.shownAt !== undefined);
  });
  const latest = shown.filter((j) => j.type === 'weekly').reduce<ReminderJob | null>((best, j) => (best === null || j.dueAt > best.dueAt ? j : best), null);
  return shown
    .filter((j) => j.type !== 'weekly' || j === latest)
    .map((job) => {
      const original = entries.get(job.key);
      return { job, labelAt: original !== undefined ? (Date.parse(original.dueAt) as Instant) : job.dueAt };
    });
}
