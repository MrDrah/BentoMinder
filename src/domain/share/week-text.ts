// The weekly share text (US-E9-01, BR-21): built only from dates, decision labels, recipe names and the
// fixed lines. The function receives the day views, never the store's profile, so nothing about the child
// can reach the text (US-E9-02/AC1). Pure: today is passed in.
import type { DayViewer } from '../calendar/day-view.ts';
import type { BentoMinderStore } from '../schema/index.ts';
import { addDays, type LocalDate } from '../time/jst.ts';

export interface ShareItem {
  date: LocalDate;
  kind: 'bento' | 'not-confirmed';
  recipe?: { ja: string; en: string } | undefined;
}

export interface ShareWeek {
  from: LocalDate;
  to: LocalDate;
  items: ShareItem[];
  /** Some day of the week is neither planned nor not-confirmed, so 「ほかの日は…」 applies. */
  hasOthers: boolean;
}

/** The 7 days from tomorrow, independent of weekStartsOn (components §10). */
export function shareWeek(store: BentoMinderStore, today: LocalDate, view: DayViewer): ShareWeek {
  const items: ShareItem[] = [];
  let hasOthers = false;
  for (let i = 1; i <= 7; i += 1) {
    const date = addDays(today, i);
    const v = view(store, date, today);
    if (v.displayed.state === 'homemade-bento-planned') {
      const n = v.record?.recipeNameSnapshot;
      items.push({ date, kind: 'bento', recipe: n === undefined ? undefined : { ja: n.ja, en: n.en ?? n.ja } });
    } else if (v.displayed.state === 'not-confirmed') items.push({ date, kind: 'not-confirmed' });
    else hasOthers = true;
  }
  return { from: addDays(today, 1), to: addDays(today, 7), items, hasOthers };
}

/** Already-translated pieces; the domain only decides which lines appear and in what order. */
export interface ShareLabels {
  header: (from: LocalDate, to: LocalDate) => string;
  bento: (date: LocalDate, recipe: ShareItem['recipe']) => string;
  notConfirmed: (date: LocalDate) => string;
  others: string;
  reservation: string;
  empty: string;
}

export function composeShareText(week: ShareWeek, labels: ShareLabels): string {
  const lines = [labels.header(week.from, week.to)];
  if (week.items.length === 0) lines.push(labels.empty);
  else {
    for (const item of week.items) lines.push(item.kind === 'bento' ? labels.bento(item.date, item.recipe) : labels.notConfirmed(item.date));
    if (week.hasOthers) lines.push(labels.others);
  }
  lines.push(labels.reservation);
  return lines.join('\n');
}
