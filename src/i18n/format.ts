// Date and time display (US-E8-03/AC1; ADR 001). Inputs are Asia/Tokyo civil dates, so the
// numbers come straight from the 'YYYY-MM-DD' string; Intl supplies only English month names
// (fixed to UTC so the device timezone can never shift them). No 令和 (US-E8-03/AC2).
import { dateParts, monthParts, weekdayOf, type LocalDate, type YearMonth } from '../domain/time/jst.ts';
import type { Language, Translate } from './index.ts';
import type { MessageKey } from './ja.ts';

function englishMonth(month: number, style: 'long' | 'short'): string {
  return new Intl.DateTimeFormat('en-US', { month: style, timeZone: 'UTC' }).format(Date.UTC(2000, month - 1, 15));
}

const wdKey = (date: LocalDate): MessageKey => `wd.short.${weekdayOf(date)}` as MessageKey;

/** ja 「2026年11月」, en "November 2026". */
export function formatMonth(t: Translate, lang: Language, month: YearMonth): string {
  const { year, month: m } = monthParts(month);
  return lang === 'ja'
    ? t('fmt.month', { year, monthNumber: m })
    : t('fmt.month', { year, monthName: englishMonth(m, 'long') });
}

/** ja 「11月4日（水）」, en "Wed, Nov 4". */
export function formatDate(t: Translate, lang: Language, date: LocalDate): string {
  const { month, day } = dateParts(date);
  return lang === 'ja'
    ? t('fmt.date', { monthNumber: month, day, wd: t(wdKey(date)) })
    : t('fmt.date', { wdShort: t(wdKey(date)), monShort: englishMonth(month, 'short'), day });
}

/** ja 「11月4日」, en "Nov 4" (no weekday; dialog titles). */
export function formatDateNoWeekday(t: Translate, lang: Language, date: LocalDate): string {
  const { month, day } = dateParts(date);
  return lang === 'ja' ? t('fmt.dateNoWd', { monthNumber: month, day }) : t('fmt.dateNoWd', { monShort: englishMonth(month, 'short'), day });
}

/** Times are 'HH:MM' 24-hour in both languages. */
export function formatTime(time: string): string {
  return time;
}
