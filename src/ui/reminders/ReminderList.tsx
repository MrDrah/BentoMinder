// Reminder stack and banners (design/components.md §8). The content is the planner's message keys and
// params rendered with the copy catalog (ADR 010); the web promise is stated in settings (BR-18).
import { useEffect, useRef, useState } from 'react';
import { deviceIsTokyo } from '../../adapters/web/notifications.ts';
import type { ReminderJob } from '../../domain/ports.ts';
import type { DayDecision } from '../../domain/schema/index.ts';
import { todayJst, wallTimeJst, type LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import { useApp, useStore } from '../app-store.tsx';
import { recipeName } from '../calendar/labels.ts';
import { Banner } from '../components/Controls.tsx';
import { allergenLabel } from '../recommend/parts.tsx';
import { useReminders, type ShownReminder } from './use-reminders.tsx';

type Params = ReminderJob['content']['params'];
const text = (p: Params, k: string): string => (typeof p[k] === 'string' ? (p[k] as string) : '');
const list = (p: Params, k: string): string[] => (Array.isArray(p[k]) ? (p[k] as string[]) : []);

function Bell() {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The original time of a missed or repeated reminder, with 「（日本時間）」 when the device is not in Tokyo (US-E7-07/AC2). */
function MissedLabel({ at }: { at: ShownReminder['labelAt'] }) {
  const { t, state } = useApp();
  const label = t('reminder.missedAt', { date: formatDate(t, state.language, todayJst(at)), time: wallTimeJst(at) });
  return (
    <p className="reminder__missed" data-testid="reminder-missed">
      {label}
      {deviceIsTokyo() ? '' : ` ${t('common.japanTime')}`}
    </p>
  );
}

function DayBeforeBody({ job }: { job: ReminderJob }) {
  const { t, state, services } = useApp();
  const lang = state.language;
  const p = job.content.params;
  const name = lang === 'en' ? text(p, 'recipeNameEn') || text(p, 'recipeNameJa') : text(p, 'recipeNameJa');
  const allergens = list(p, 'allergenIds');
  return (
    <>
      <strong className="reminder__title">{t('reminder.dayBefore')}</strong>
      {name !== '' && (
        <p className="reminder__line" data-testid="reminder-recipe" lang={lang === 'en' && text(p, 'recipeNameEn') !== '' ? 'en' : 'ja'}>
          {t('reminder.dayBefore.recipe', { recipe: name })}
        </p>
      )}
      {allergens.length > 0 && (
        <Banner variant="danger" testId="reminder-allergen" live={false}>
          <p className="banner__body">{t('day.recipeAllergen', { allergens: allergens.map((a) => allergenLabel(services.dictionary, a, lang)).join(lang === 'ja' ? '、' : ', ') })}</p>
        </Banner>
      )}
      <a className="btn btn--primary btn--small" href={job.target.route} data-testid="reminder-cta">
        {t('reminder.dayBefore.cta')}
      </a>
    </>
  );
}

function WeeklyBody({ job }: { job: ReminderJob }) {
  const { t, state } = useApp();
  const store = useStore();
  const lang = state.language;
  const p = job.content.params;
  const date = (d: string) => formatDate(t, lang, d as LocalDate);
  const range = t('fmt.range', { from: date(text(p, 'from')), to: date(text(p, 'to')) });
  const items: { date: string; kind: 'low' | 'undecided' | 'bento'; recipe?: string }[] = [
    ...list(p, 'low').map((d) => ({ date: d, kind: 'low' as const })),
    ...list(p, 'undecided').map((d) => ({ date: d, kind: 'undecided' as const })),
    ...list(p, 'bento').map((entry) => {
      const [d = '', ja = '', en = ''] = entry.split('|');
      const record = store.decisions[d as LocalDate] as DayDecision | undefined;
      const full = record === undefined ? '' : recipeName(record, lang);
      return { date: d, kind: 'bento' as const, recipe: full !== '' ? full : lang === 'en' && en !== '' ? en : ja };
    }),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const noMenu = job.content.bodyKey === 'reminders.weekly.noMenu';
  const empty = job.content.bodyKey === 'reminders.weekly.empty';
  return (
    <>
      <strong className="reminder__title">{t('reminder.weekly.title', { range })}</strong>
      {noMenu && (
        <>
          <p className="reminder__line">{t('reminder.weekly.noMenu')}</p>
          <a className="btn btn--primary btn--small" href="#/import" data-testid="reminder-import">
            {t('reminder.weekly.import')}
          </a>
        </>
      )}
      {empty && <p className="reminder__line">{t('reminder.weekly.none')}</p>}
      {!noMenu && !empty && (
        <>
          <ul className="reminder__items">
            {items.map((item) => (
              <li key={`${item.kind}-${item.date}`} className="reminder__item" data-testid={`reminder-weekly-item-${item.date}`}>
                <span>
                  {item.kind === 'low' && t('reminder.weekly.low', { date: date(item.date) })}
                  {item.kind === 'undecided' && t('reminder.weekly.notConfirmed', { date: date(item.date) })}
                  {item.kind === 'bento' && t('reminder.weekly.planned', { date: date(item.date), recipe: item.recipe ?? '' })}
                </span>
                {item.kind !== 'bento' && (
                  <a className="btn btn--small" href={`#/day/${item.date}`} data-testid={`reminder-weekly-plan-${item.date}`}>
                    {t('reminder.weekly.plan')}
                  </a>
                )}
              </li>
            ))}
          </ul>
          {list(p, 'noMenuMonths').map((m) => (
            <p key={m} className="reminder__line" data-testid={`reminder-weekly-nomenu-${m}`}>
              {t('reminder.weekly.noMenuMonth', { m: Number(m.slice(5)) })}
            </p>
          ))}
        </>
      )}
    </>
  );
}

export function ReminderBanner({ r, onDismiss }: { r: ShownReminder; onDismiss: (key: string) => void }) {
  const { t } = useApp();
  const suffix = r.job.key.split(':')[1] ?? '';
  const type = r.job.type;
  return (
    <div className={`reminder reminder--${type}`} role="status" tabIndex={-1} data-reminder-key={r.job.key} data-testid={type === 'weekly' ? `reminder-weekly-${suffix}` : `reminder-day-before-${suffix}`}>
      <span className="reminder__stripe" aria-hidden="true" />
      <span className="reminder__icon" aria-hidden="true">
        <Bell />
      </span>
      <div className="reminder__body">
        {r.late && <MissedLabel at={r.labelAt} />}
        {type === 'weekly' ? <WeeklyBody job={r.job} /> : <DayBeforeBody job={r.job} />}
      </div>
      <button type="button" className="iconbtn reminder__close" data-testid="reminder-dismiss" aria-label={t('reminder.dismissName')} onClick={() => onDismiss(r.job.key)}>
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** components §8.2: the first banner in full, the others under 「ほかにn件のお知らせ」; empty renders nothing. */
export function ReminderList() {
  const { t } = useApp();
  const { shown, dismiss, markShown } = useReminders();
  const [open, setOpen] = useState(false);
  const focusNext = useRef<string | null>(null);
  const keys = shown.map((s) => s.job.key).join(',');

  // After a dismissal focus goes to the next banner, or to the today card heading (components §8.1).
  useEffect(() => {
    const target = focusNext.current;
    if (target === null) return;
    focusNext.current = null;
    const el = target === 'today' ? document.querySelector<HTMLElement>('[data-testid="today-headline"]') : document.querySelector<HTMLElement>(`[data-reminder-key="${target}"]`);
    el?.focus();
  }, [keys]);

  // The list is on screen: record shownAt once per key (ADR 011).
  useEffect(() => {
    if (shown.length > 0) void markShown(shown.map((s) => s.job));
  }, [shown, markShown]);

  if (shown.length === 0) return null;
  const [first, ...rest] = shown as [ShownReminder, ...ShownReminder[]];
  const onDismiss = (key: string) => {
    const i = shown.findIndex((s) => s.job.key === key);
    const next = shown[i + 1] ?? shown[i - 1];
    focusNext.current = next?.job.key ?? 'today';
    void dismiss(key).then((ok) => {
      if (!ok) focusNext.current = null;
    });
  };
  return (
    <section className="reminders" aria-label={t('reminder.region')} data-testid="reminder-list">
      <ReminderBanner r={first} onDismiss={onDismiss} />
      {rest.length > 0 && (
        <>
          <button type="button" className="btn btn--text reminders__more" aria-expanded={open} aria-controls="reminder-more-list" data-testid="reminder-more" onClick={() => setOpen(!open)}>
            {t('reminder.more', { n: rest.length })}
          </button>
          <div id="reminder-more-list" hidden={!open}>
            {open && rest.map((r) => <ReminderBanner key={r.job.key} r={r} onDismiss={onDismiss} />)}
          </div>
        </>
      )}
    </section>
  );
}
