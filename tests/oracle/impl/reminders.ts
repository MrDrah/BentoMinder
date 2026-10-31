// Reminder oracle (tests/oracle/reminder-oracle.md): a deliberately naive re-implementation of what is planned and what is
// visible. Imports nothing from src/ and no package. All wall times are Asia/Tokyo (UTC+9, no DST), written with plain
// Date.UTC arithmetic and never with the device timezone.
export interface OSettings {
  weekly: { enabled: boolean; weekday: number; time: string };
  dayBefore: { enabled: boolean; time: string };
}
export interface ODay {
  date: string;
  state: 'school-lunch-planned' | 'not-confirmed' | 'homemade-bento-planned' | 'no-school-lunch' | null;
  plannedAt?: number | undefined;
}
export interface OLog {
  key: string;
  dueAt: string;
  shownAt?: string;
  dismissedAt?: string;
}
export interface OJob {
  key: string;
  type: 'weekly' | 'day-before';
  due: number;
  expires: number;
}

const DAY = 86_400_000;
const JST = 9 * 3_600_000;

/** Epoch ms of 'YYYY-MM-DD' 00:00 UTC. */
const utcMidnight = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
};
const fmt = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const oAdd = (date: string, n: number): string => fmt(utcMidnight(date) + n * DAY);
/** The JST calendar date of an instant. */
export const oToday = (now: number): string => fmt(now + JST);
export const oWeekday = (date: string): number => new Date(utcMidnight(date)).getUTCDay();
/** Instant of `date` `HH:MM` JST. */
export const oInstant = (date: string, time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return utcMidnight(date) + (h! * 60 + m!) * 60_000 - JST;
};

/** Everything planned at `now` (unexpired, not dismissed, inside the horizon), sorted by due then key. */
export function oPlan(settings: OSettings, days: readonly ODay[], now: number, log: readonly OLog[], horizon = 8): OJob[] {
  const today = oToday(now);
  const last = oAdd(today, horizon);
  const dismissed = new Set(log.filter((l) => l.dismissedAt !== undefined).map((l) => l.key));
  const out: OJob[] = [];
  if (settings.dayBefore.enabled) {
    for (const d of days) {
      if (d.state !== 'homemade-bento-planned') continue;
      if (d.date <= today || d.date > last) continue;
      const due = oInstant(oAdd(d.date, -1), settings.dayBefore.time);
      if (d.plannedAt !== undefined && d.plannedAt > due) continue;
      out.push({ key: `day-before:${d.date}`, type: 'day-before', due, expires: oInstant(d.date, '00:00') });
    }
  }
  if (settings.weekly.enabled) {
    for (let s = oAdd(today, -7); s <= last; s = oAdd(s, 1)) {
      if (oWeekday(s) !== settings.weekly.weekday) continue;
      out.push({ key: `weekly:${oAdd(s, 1)}`, type: 'weekly', due: oInstant(s, settings.weekly.time), expires: oInstant(oAdd(s, 8), '00:00') });
    }
  }
  return out
    .filter((j) => j.expires > now && !dismissed.has(j.key))
    .sort((a, b) => a.due - b.due || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** The keys shown in the banner at `now`, with the label instant. */
export function oVisible(jobs: readonly OJob[], log: readonly OLog[], now: number): { key: string; label: number }[] {
  const byKey = new Map(log.map((l) => [l.key, l]));
  const shown = jobs.filter((j) => {
    const e = byKey.get(j.key);
    if (e?.dismissedAt !== undefined) return false;
    if (j.expires <= now) return false;
    return j.due <= now || e?.shownAt !== undefined;
  });
  let latest: OJob | undefined;
  for (const j of shown) if (j.type === 'weekly' && (latest === undefined || j.due > latest.due)) latest = j;
  return shown
    .filter((j) => j.type === 'day-before' || j === latest)
    .map((j) => ({ key: j.key, label: byKey.has(j.key) ? Date.parse(byKey.get(j.key)!.dueAt) : j.due }));
}
