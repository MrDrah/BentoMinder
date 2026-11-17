// The text of a system notification, from the planner's job and the copy catalog (same strings as the in-app
// banners, no new copy). Pure: the language and the translator are passed in.
import type { ReminderJob } from '../../domain/ports.ts';
import type { LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { createTranslator, type Language, type Translate } from '../../i18n/index.ts';

export interface NotificationText {
  title: string;
  body: string;
}
export type TextRenderer = (job: ReminderJob) => NotificationText;

type Params = ReminderJob['content']['params'];
const text = (p: Params, k: string): string => (typeof p[k] === 'string' ? (p[k] as string) : '');
const list = (p: Params, k: string): string[] => (Array.isArray(p[k]) ? (p[k] as string[]) : []);

export function renderNotificationText(job: ReminderJob, t: Translate, lang: Language): NotificationText {
  const p = job.content.params;
  if (job.type === 'day-before') {
    const name = lang === 'en' ? text(p, 'recipeNameEn') || text(p, 'recipeNameJa') : text(p, 'recipeNameJa');
    return { title: t('app.name'), body: name === '' ? t('reminder.dayBefore') : `${t('reminder.dayBefore')}\n${t('reminder.dayBefore.recipe', { recipe: name })}` };
  }
  const date = (d: string) => formatDate(t, lang, d as LocalDate);
  const title = t('reminder.weekly.title', { range: t('fmt.range', { from: date(text(p, 'from')), to: date(text(p, 'to')) }) });
  if (job.content.bodyKey === 'reminders.weekly.noMenu') return { title, body: t('reminder.weekly.noMenu') };
  if (job.content.bodyKey === 'reminders.weekly.empty') return { title, body: t('reminder.weekly.none') };
  const lines: { date: string; line: string }[] = [
    ...list(p, 'low').map((d) => ({ date: d, line: t('reminder.weekly.low', { date: date(d) }) })),
    ...list(p, 'undecided').map((d) => ({ date: d, line: t('reminder.weekly.notConfirmed', { date: date(d) }) })),
    ...list(p, 'bento').map((entry) => {
      const [d = '', ja = '', en = ''] = entry.split('|');
      return { date: d, line: t('reminder.weekly.planned', { date: date(d), recipe: lang === 'en' && en !== '' ? en : ja }) };
    }),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { title, body: lines.map((l) => l.line).join('\n') };
}

/** Used until the UI registers the parent's language: Japanese, the app's default. */
export const defaultRenderer: TextRenderer = (job) => renderNotificationText(job, createTranslator('ja'), 'ja');
