// A November 2026 store with every kind of tile in it (design/components.md §18.5), built from the M2 fixture. Today is
// Tuesday 2026-11-17 (10:00 JST), so there are past, today, tomorrow and later tiles of every kind. Test data only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const TILES_NOW = new Date('2026-11-17T01:00:00Z');

/** What each date of the fixture is, for the assertions. */
export const TILE_DATES = {
  pastSchool: '2026-11-09', // plain school lunch
  pastHomeChanged: '2026-11-04', // homemade bento planned (stored decision: red top border)
  pastSchoolChanged: '2026-11-05', // an applied override
  pastUnsure: '2026-11-10', // not confirmed
  pastAllergen: '2026-11-11', // school lunch with the allergen alert
  todayAllergenChanged: '2026-11-17', // school lunch, allergen alert, stored decision
  tomorrow: '2026-11-18', // plain school lunch
  futureAllergen: '2026-11-19',
  dash: '2026-11-20', // bento day, no plan
  futureHome: '2026-11-24',
  futureUnsure: '2026-11-25',
  futureSchoolChanged: '2026-11-26', // an override
  noLunch: '2026-11-27',
  weekend: '2026-11-21', // number only
} as const;

export function tileStatesState(): string {
  const s = JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'state', 'm2-november.json'), 'utf8'));
  const at = '2026-11-01T10:05:00+09:00';
  const base = { ownerId: 'local', createdAt: at, updatedAt: at, decidedAt: at, reservationDoneExternally: false };
  s.profile = { ...s.profile, allergyStatus: 'has-known', knownAllergenIds: ['alg-egg'] };
  for (const d of s.menus['2026-11'].confirmed.days) {
    if ([TILE_DATES.pastAllergen, TILE_DATES.todayAllergenChanged, TILE_DATES.futureAllergen].includes(d.date)) {
      d.allergenDeclaration = { status: 'declared', allergenIds: ['alg-egg'], rawText: 'アレルゲン：卵', verification: { status: 'ok' } };
    }
  }
  const school = (date: string) => ({ date, state: 'school-lunch-planned', history: [{ state: 'school-lunch-planned', at }], ...base });
  s.decisions[TILE_DATES.todayAllergenChanged] = school(TILE_DATES.todayAllergenChanged);
  s.decisions[TILE_DATES.pastUnsure] = { date: TILE_DATES.pastUnsure, state: 'not-confirmed', history: [{ state: 'not-confirmed', at }], ...base };
  s.decisions[TILE_DATES.futureUnsure] = { date: TILE_DATES.futureUnsure, state: 'not-confirmed', history: [{ state: 'not-confirmed', at }], ...base };
  s.decisions[TILE_DATES.futureHome] = { ...s.decisions['2026-11-04'], date: TILE_DATES.futureHome };
  const override = (date: string) => ({ date, state: 'low-preference', setAt: at, menuVersionAtSet: 1, ownerId: 'local', createdAt: at, updatedAt: at });
  s.overrides[TILE_DATES.futureSchoolChanged] = override(TILE_DATES.futureSchoolChanged);
  return JSON.stringify(s);
}
