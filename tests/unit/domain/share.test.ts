// Pure share-text builder (US-E9-01, US-E9-02): the viewer is stubbed, so only the week rule and the line
// order are under test; wording is covered in tests/unit/ui/share.test.tsx.
import { describe, expect, it } from 'vitest';
import type { DayView, DayViewer } from '../../../src/domain/calendar/day-view.ts';
import { composeShareText, shareWeek, type ShareLabels } from '../../../src/domain/share/week-text.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/index.ts';
import type { LocalDate } from '../../../src/domain/time/jst.ts';

const labels: ShareLabels = {
  header: (a, b) => `H ${a}..${b}`,
  bento: (d, r) => `B ${d} ${r?.ja ?? ''}`,
  notConfirmed: (d) => `N ${d}`,
  others: 'OTHERS',
  reservation: 'RES',
  empty: 'EMPTY',
};
const store = { profile: { nickname: 'SECRET' } } as unknown as BentoMinderStore;
const view =
  (states: Record<string, DayView['displayed']['state']>): DayViewer =>
  (_s, date) =>
    ({
      displayed: { state: states[date] ?? 'school-lunch-planned' },
      record: states[date] === 'homemade-bento-planned' ? { recipeNameSnapshot: { ja: 'おにぎり', en: 'Onigiri' } } : undefined,
    }) as unknown as DayView;
const today = '2026-11-01' as LocalDate;

describe('US-E9-01 share week', () => {
  it('US-E9-01/AC1 the week is the 7 days from tomorrow, planned and not-confirmed days in date order, then others, then the reservation line', () => {
    const w = shareWeek(store, today, view({ '2026-11-06': 'not-confirmed', '2026-11-04': 'homemade-bento-planned' }));
    expect([w.from, w.to]).toEqual(['2026-11-02', '2026-11-08']);
    expect(composeShareText(w, labels)).toBe('H 2026-11-02..2026-11-08\nB 2026-11-04 おにぎり\nN 2026-11-06\nOTHERS\nRES');
  });

  it('US-E9-01/AC3 an empty week uses the empty line and no others line', () => {
    expect(composeShareText(shareWeek(store, today, view({})), labels)).toBe('H 2026-11-02..2026-11-08\nEMPTY\nRES');
  });

  it('US-E9-01/AC1 a week that is all planned or not-confirmed has no others line; a day outside the week is ignored', () => {
    const all: Record<string, DayView['displayed']['state']> = { '2026-11-01': 'not-confirmed', '2026-11-09': 'not-confirmed' };
    for (let d = 2; d <= 8; d += 1) all[`2026-11-0${d}`] = 'not-confirmed';
    const text = composeShareText(shareWeek(store, today, view(all)), labels);
    expect(text).not.toContain('OTHERS');
    expect(text).not.toContain('2026-11-01\n');
    expect(text.split('\n')).toHaveLength(9);
  });

  it('US-E9-02/AC1 the result and the text cannot contain anything from the profile', () => {
    const w = shareWeek(store, today, view({ '2026-11-04': 'homemade-bento-planned' }));
    expect(JSON.stringify(w)).not.toContain('SECRET');
    expect(composeShareText(w, labels)).not.toContain('SECRET');
  });
});
