// The accessible name of a calendar cell: one full sentence from the catalog (design/copy.md §8
// `cell.aria*`, a11y-responsive.md §6). Never colour words, never the word "button".
import type { DayView } from '../../domain/calendar/day-view.ts';
import { formatDate } from '../../i18n/format.ts';
import type { Language, Translate } from '../../i18n/index.ts';
import { DECISION_KEYS, recipeName, STATE_KEYS } from './labels.ts';

export function cellLabel(t: Translate, lang: Language, v: DayView): string {
  const date = formatDate(t, lang, v.date);
  const sep = lang === 'ja' ? '、' : ', ';
  // in English the state and decision words sit inside a sentence (a11y-responsive.md §6: "might not enjoy, school lunch")
  const word = (text: string) => (lang === 'en' ? text.charAt(0).toLowerCase() + text.slice(1) : text);
  const shown = v.displayed.state;
  const planned = shown === 'homemade-bento-planned' && v.record !== undefined ? t('cell.aria.planned', { recipe: recipeName(v.record, lang) }) : null;
  let base: string;
  switch (v.type.type) {
    case 'school': {
      const assessment = word(t(STATE_KEYS[v.assessment?.state ?? 'not-assessed']));
      base = t('cell.aria', { date, assessment, decision: planned ?? word(t(DECISION_KEYS[shown ?? 'school-lunch-planned'])) });
      break;
    }
    case 'no-lunch':
      base = planned === null ? t('cell.aria.noLunch', { date, originalText: v.type.noLunch.originalText }) : t('cell.aria', { date, assessment: word(t('state.noLunch')), decision: planned });
      break;
    case 'bento-day':
      base = t('cell.aria.bentoDay', { date, decision: planned ?? t('cell.aria.bentoDayOpen') });
      break;
    case 'no-menu':
      base = t('cell.aria.noMenu', { date });
      break;
    default:
      base = t('cell.aria.outside', { date });
      if (planned !== null) base += sep + planned; // a plan kept on a date the menu no longer lists (refresh conflict)
  }
  let label = (v.isToday ? t('cell.aria.today') : '') + base;
  if (v.assessment?.override != null) label += t('cell.aria.override');
  if (v.needsReviewBadge) label += t('cell.aria.changed');
  if (v.past) label += t('cell.aria.past');
  return label;
}
