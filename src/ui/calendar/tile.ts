// What a calendar tile shows (design/components.md §18.3; BA US-E5-01/AC3, AC9-AC16), derived from
// a DayView and the Tokyo "today". Presentation only: no rule is decided here (BR-01, BR-02, BR-03).
import type { DayView } from '../../domain/calendar/day-view.ts';
import { addDays, type LocalDate } from '../../domain/time/jst.ts';
import type { TileIconName } from '../components/Marks.tsx';

export type TileIconKind = 'school' | 'home' | 'unsure' | 'none';

export interface Tile {
  icon: TileIconKind;
  /** The state word key of the accessible name; absent on a number-only tile. */
  state: 'school' | 'home' | 'homeDay' | 'unsure' | null;
  /** A bento that is needed and not yet planned, today or later (AC13). */
  dash: boolean;
  /** An applied override or a stored decision shown on the tile: the red top border (AC10). */
  changed: boolean;
  tomorrow: boolean;
  /** The allergen alert of the day's menu, on a school-lunch tile only (AC16). */
  allergen: boolean;
}

export const TILE_ICON_NAMES: Record<Exclude<TileIconKind, 'none'>, TileIconName> = { school: 'lunchbox', home: 'home-bento', unsure: 'bento-unsure' };

export function tileOf(v: DayView, today: LocalDate): Tile {
  const shown = v.displayed.state;
  const type = v.type.type;
  let icon: TileIconKind = 'none';
  let state: Tile['state'] = null;
  let dash = false;
  if (shown === 'homemade-bento-planned' && v.record !== undefined) {
    icon = 'home';
    state = 'home';
  } else if (shown === 'not-confirmed' && v.displayed.conflict === 'none') {
    icon = 'unsure';
    state = 'unsure';
  } else if (type === 'school' && (shown === 'school-lunch-planned' || shown === null)) {
    icon = 'school';
    state = 'school';
  } else if (type === 'bento-day' && v.record === undefined) {
    icon = 'home';
    state = 'homeDay';
    dash = v.date >= today;
  }
  const changed = icon !== 'none' && (v.assessment?.override != null || v.record !== undefined);
  return { icon, state, dash, changed, tomorrow: v.date === addDays(today, 1), allergen: icon === 'school' && v.allergenAlert };
}
