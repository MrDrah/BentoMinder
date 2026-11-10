// Date and time words of the family screens (copy §22 placeholders `{expiry}`, `{when}`, `{until}`, `{consentDate}`).
// Times are Asia/Tokyo like every date in the app (BR-15); the copy sheet's examples show the same shape.
import { todayJst, wallTimeJst, addDays, type Instant } from '../../domain/time/jst.ts';
import { formatDate, formatDateNoWeekday } from '../../i18n/format.ts';
import type { Language, Translate } from '../../i18n/index.ts';

const instant = (iso: string): Instant => Date.parse(iso) as Instant;

/** ja 「11月13日（金）10:00」, en "Fri, Nov 13, 10:00". */
export function formatExpiry(t: Translate, lang: Language, iso: string): string {
  const at = instant(iso);
  const day = formatDate(t, lang, todayJst(at));
  return lang === 'ja' ? `${day}${wallTimeJst(at)}` : `${day}, ${wallTimeJst(at)}`;
}

/** ja 「今日 14:32」「昨日 14:32」「11月9日 14:32」, en "Today 14:32", "Yesterday 14:32", "Nov 9, 14:32". */
export function formatWhen(t: Translate, lang: Language, iso: string, nowMs: number): string {
  const at = instant(iso);
  const day = todayJst(at);
  const today = todayJst(nowMs as Instant);
  const time = wallTimeJst(at);
  if (day === today) return `${t('cal.today')} ${time}`;
  if (day === addDays(today, -1)) return `${t('sync.when.yesterday')} ${time}`;
  return lang === 'ja' ? `${formatDateNoWeekday(t, lang, day)} ${time}` : `${formatDateNoWeekday(t, lang, day)}, ${time}`;
}

/** ja 「2026年11月10日」, en "Nov 10, 2026" (the day only). */
export function formatLongDate(lang: Language, iso: string): string {
  const day = todayJst(instant(iso));
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return lang === 'ja'
    ? `${y}年${m}月${d}日`
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
}

/** ja 「11月13日（金）」, en "Fri, Nov 13" for `{until}`. */
export function formatUntil(t: Translate, lang: Language, iso: string): string {
  return formatDate(t, lang, todayJst(instant(iso)));
}
