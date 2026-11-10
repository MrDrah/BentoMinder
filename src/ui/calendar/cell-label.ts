// The accessible name of a calendar tile: one full sentence from the catalog (design/copy.md §24,
// a11y-responsive.md §6, BA US-E5-01/AC14): date, state, allergen alert, changed, today / tomorrow / past, dash.
// No assessment, no recipe name, no colour words, never the word "button".
import type { DayView } from '../../domain/calendar/day-view.ts';
import type { LocalDate } from '../../domain/time/jst.ts';
import { formatDate } from '../../i18n/format.ts';
import type { Language, MessageKey, Translate } from '../../i18n/index.ts';
import { tileOf } from './tile.ts';

export function cellLabel(t: Translate, lang: Language, v: DayView, today: LocalDate): string {
  const date = formatDate(t, lang, v.date);
  const tile = tileOf(v, today);
  let label: string;
  if (tile.state !== null) label = t('cell.aria.tile', { date, state: t(`cell.state.${tile.state}` as MessageKey) });
  else if (v.type.type === 'no-lunch') label = t('cell.aria.noLunch', { date, originalText: v.type.noLunch.originalText });
  else if (v.type.type === 'no-menu') label = t('cell.aria.noMenu', { date });
  else label = t('cell.aria.outside', { date });
  if (tile.allergen) label += t('cell.aria.allergen');
  if (tile.changed) label += t('cell.aria.override');
  if (v.isToday) label += t('cell.aria.isToday');
  else if (tile.tomorrow) label += t('cell.aria.isTomorrow');
  else if (v.past) label += t('cell.aria.past');
  if (tile.dash) label += t('cell.aria.dash');
  return label;
}
