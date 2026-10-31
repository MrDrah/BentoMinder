// Shared fixtures for the M4 UI tests: the November store with a real library recipe on 2026-11-04
// (the stored fixture's recipe is not in the shipped library).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BentoMinderStore, ReminderLogEntry } from '../../../src/domain/schema/index.ts';
import { clone, loadFixture } from '../helpers/fixtures.ts';

export const HIMAWARI = 'rcp-delish-himawari-bento'; // allergens: salmon, sesame, soybean
export const library = JSON.parse(readFileSync(join(process.cwd(), 'data', 'library.json'), 'utf8')) as { id: string }[];

/** 11-04 planned (plannedAt 11-01) with a real library recipe; the log keeps the fixture's dismissed weekly of 11-02. */
export function november(): BentoMinderStore {
  const s = clone(loadFixture<BentoMinderStore>('state/m2-november.json'));
  const d = s.decisions['2026-11-04'];
  if (d === undefined) throw new Error('fixture changed');
  d.recipeId = HIMAWARI;
  d.recipeNameSnapshot = { ja: 'ひまわり弁当', en: 'Sunflower bento (himawari bento)' };
  d.recipeShortNameSnapshot = { ja: 'ひまわり弁当', en: 'Himawari' };
  return s;
}

/** A JST wall time as an ISO instant string for the fake clock: jst('2026-11-03 17:30'). */
export const jst = (text: string): string => `${text.replace(' ', 'T')}:00+09:00`;

export const entry = (key: string, dueAt: string, expiresAt: string, extra: Partial<ReminderLogEntry> = {}): ReminderLogEntry => ({
  key,
  type: key.startsWith('weekly') ? 'weekly' : 'day-before',
  dueAt,
  expiresAt,
  ...extra,
});

/** A planned decision copied from 11-04 to `date`. */
export function planOn(store: BentoMinderStore, date: string): void {
  const base = store.decisions['2026-11-04'];
  if (base === undefined) throw new Error('fixture changed');
  store.decisions[date as keyof typeof store.decisions] = { ...clone(base), date: date as never };
}
