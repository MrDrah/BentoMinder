// QA (UI refresh 2026-11): the oracle against the worked examples of design/a11y-responsive.md §6 and the BA's AC14 examples,
// and the tile and button colour pairs recomputed from design/tokens.json (not from design/_scratch).
// Stories: US-E5-01/AC9 US-E5-01/AC10 US-E5-01/AC11 US-E5-01/AC12 US-E5-01/AC13 US-E5-01/AC14 US-E5-01/AC16 US-NF-02/AC1 US-NF-02/AC4 US-E8-05/AC3
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, expectedName, expectedTile, type DaySpec } from '../../../oracle/ui-refresh-tile.ts';

const tokens = JSON.parse(readFileSync(join(process.cwd(), 'design', 'tokens.json'), 'utf8')) as { color: Record<'light' | 'dark', Record<string, { value: string }>> };
const c = (theme: 'light' | 'dark', name: string) => tokens.color[theme][name]!.value;

const school: DaySpec = { kind: 'school' };
const examples: { label: string; date: string; today: string; spec: DaySpec; ja: string; en: string }[] = [
  { label: 'school ordinary', date: '2026-11-04', today: '2026-11-02', spec: school, ja: '11月4日（水）、給食', en: 'Wed, Nov 4, school lunch' },
  { label: 'allergen', date: '2026-11-19', today: '2026-11-02', spec: { ...school, alert: true }, ja: '11月19日（木）、給食、アレルギーに注意', en: 'Thu, Nov 19, school lunch, allergen alert' },
  { label: 'allergen changed today', date: '2026-11-17', today: '2026-11-17', spec: { ...school, alert: true, stored: 'school' }, ja: '11月17日（火）、給食、アレルギーに注意、手動で変更、今日', en: 'Tue, Nov 17, school lunch, allergen alert, changed by you, today' },
  { label: 'past allergen', date: '2026-11-06', today: '2026-11-10', spec: { ...school, alert: true }, ja: '11月6日（金）、給食、アレルギーに注意、過去の日', en: 'Fri, Nov 6, school lunch, allergen alert, past day' },
  { label: 'BA example: changed tomorrow', date: '2026-11-04', today: '2026-11-03', spec: { ...school, override: true }, ja: '11月4日（水）、給食、手動で変更、明日', en: 'Wed, Nov 4, school lunch, changed by you, tomorrow' },
  { label: 'home planned', date: '2026-11-18', today: '2026-11-10', spec: { ...school, stored: 'home' }, ja: '11月18日（水）、手作りお弁当、手動で変更', en: 'Wed, Nov 18, homemade bento, changed by you' },
  { label: 'home today', date: '2026-11-17', today: '2026-11-17', spec: { ...school, stored: 'home' }, ja: '11月17日（火）、手作りお弁当、手動で変更、今日', en: 'Tue, Nov 17, homemade bento, changed by you, today' },
  { label: 'bento day dash', date: '2026-11-20', today: '2026-11-10', spec: { kind: 'bento-day' }, ja: '11月20日（金）、手作りお弁当の日、お弁当の準備が未定', en: 'Fri, Nov 20, bento day, bento still to plan' },
  { label: 'bento day tomorrow', date: '2026-11-20', today: '2026-11-19', spec: { kind: 'bento-day' }, ja: '11月20日（金）、手作りお弁当の日、明日、お弁当の準備が未定', en: 'Fri, Nov 20, bento day, tomorrow, bento still to plan' },
  { label: 'bento day planned', date: '2026-11-20', today: '2026-11-10', spec: { kind: 'bento-day', stored: 'home' }, ja: '11月20日（金）、手作りお弁当、手動で変更', en: 'Fri, Nov 20, homemade bento, changed by you' },
  { label: 'not confirmed', date: '2026-11-24', today: '2026-11-10', spec: { ...school, stored: 'unsure' }, ja: '11月24日（火）、未定、手動で変更', en: 'Tue, Nov 24, undecided, changed by you' },
  { label: 'past school', date: '2026-11-05', today: '2026-11-10', spec: school, ja: '11月5日（木）、給食、過去の日', en: 'Thu, Nov 5, school lunch, past day' },
  { label: 'past changed', date: '2026-11-04', today: '2026-11-10', spec: { ...school, stored: 'home' }, ja: '11月4日（水）、手作りお弁当、手動で変更、過去の日', en: 'Wed, Nov 4, homemade bento, changed by you, past day' },
];

describe('tile oracle reproduces the worked examples of a11y §6', () => {
  for (const e of examples) {
    it(`US-E5-01/AC14 ${e.label}`, () => {
      expect(expectedName(e.date, e.today, e.spec, 'ja')).toBe(e.ja);
      expect(expectedName(e.date, e.today, e.spec, 'en')).toBe(e.en);
    });
  }
  it('US-E5-01/AC13 the dash needs a bento day without a plan from today on; never on a past day, a school day or a planned day', () => {
    const bd: DaySpec = { kind: 'bento-day' };
    expect(expectedTile('2026-11-18', '2026-11-18', bd).dash).toBe(true);
    expect(expectedTile('2026-11-18', '2026-11-10', bd).dash).toBe(true);
    expect(expectedTile('2026-11-18', '2026-11-19', bd).dash).toBe(false);
    expect(expectedTile('2026-11-18', '2026-11-10', { kind: 'bento-day', stored: 'home' })).toMatchObject({ dash: false, changed: true, icon: 'home' });
    expect(expectedTile('2026-11-18', '2026-11-10', { kind: 'school', stored: 'unsure' }).dash).toBe(false);
    expect(expectedTile('2026-11-18', '2026-11-10', { kind: 'no-lunch' })).toMatchObject({ dash: false, icon: 'none' });
  });
  it('US-E5-01/AC12 tomorrow is the next calendar date, across a weekend and a month end', () => {
    expect(expectedTile('2026-11-15', '2026-11-14', school).tomorrow).toBe(true);
    expect(expectedTile('2026-12-01', '2026-11-30', { kind: 'outside' }).tomorrow).toBe(true);
    expect(expectedTile('2026-11-16', '2026-11-14', school).tomorrow).toBe(false);
  });
  it('US-E5-01/AC10 dormant overrides and dormant records give no top border; a planned bento day has it', () => {
    expect(expectedTile('2026-11-27', '2026-11-10', { kind: 'no-lunch', override: true }).changed).toBe(false);
    expect(expectedTile('2026-11-03', '2026-11-10', { kind: 'outside', stored: 'unsure' }).changed).toBe(false);
    expect(expectedTile('2026-11-20', '2026-11-10', { kind: 'bento-day', stored: 'unsure' })).toMatchObject({ changed: false, dash: true });
    expect(expectedTile('2026-11-12', '2026-11-10', { kind: 'school', override: true }).changed).toBe(true);
    expect(expectedTile('2026-11-12', '2026-11-10', { kind: 'school', stored: 'school' }).changed).toBe(true);
  });
  it('US-E5-01/AC16 the allergen mark only on a school-lunch tile', () => {
    expect(expectedTile('2026-11-12', '2026-11-10', { kind: 'school', alert: true }).allergen).toBe(true);
    expect(expectedTile('2026-11-12', '2026-11-10', { kind: 'school', alert: true, stored: 'home' }).allergen).toBe(false);
    expect(expectedTile('2026-11-12', '2026-11-10', { kind: 'school', alert: true, stored: 'unsure' }).allergen).toBe(false);
    expect(expectedTile('2026-11-12', '2026-11-10', { kind: 'school', alert: false }).allergen).toBe(false);
  });
});

// [name, foreground token, background token, needed]
const PAIRS: [string, string, string, number][] = [
  ['day number on a tile', 'ink-1', 'surface-2', 4.5],
  ['past number on page', 'ink-3', 'surface-1', 4.5],
  ['today number', 'ink-inverse', 'navy-fill', 4.5],
  ['icon on a tile', 'ink-2', 'surface-2', 3],
  ['past icon', 'ink-3', 'surface-1', 3],
  ['today icon', 'ink-inverse', 'navy-fill', 3],
  ['icon on hover fill', 'ink-2', 'surface-3', 3],
  ['number on hover fill', 'ink-1', 'surface-3', 4.5],
  ['red dash and bar on a tile', 'accent', 'surface-2', 3],
  ['red bar on a past tile', 'accent', 'surface-1', 3],
  ['red dash on hover', 'accent', 'surface-3', 3],
  ['dash and bar on today', 'planned-edge', 'navy-fill', 3],
  ['today bar against page', 'planned-edge', 'surface-1', 3],
  ['tomorrow frame on tile', 'ink-1', 'surface-2', 3],
  ['tomorrow frame on page', 'ink-1', 'surface-1', 3],
  ['today fill on page', 'navy-fill', 'surface-1', 3],
  ['selected ring', 'ink-1', 'surface-2', 3],
  ['selected ring on today', 'ink-inverse', 'navy-fill', 3],
  ['sunday on tile', 'sunday', 'surface-2', 4.5],
  ['saturday on tile', 'saturday', 'surface-2', 4.5],
  ['sunday past', 'sunday', 'surface-1', 4.5],
  ['saturday past', 'saturday', 'surface-1', 4.5],
  ['allergen glyph', 'danger', 'danger-soft', 4.5],
  ['allergen ring on tile', 'danger', 'surface-2', 3],
  ['allergen ring on past', 'danger', 'surface-1', 3],
  ['allergen ring on hover', 'danger', 'surface-3', 3],
  ['allergen fill on today', 'danger-soft', 'navy-fill', 3],
  ['focus ring on halo', 'focus-ring', 'focus-halo', 3],
  ['focus ring on page', 'focus-ring', 'surface-1', 3],
  // buttons (components §1.3)
  ['primary label', 'ink-inverse', 'accent-strong', 4.5],
  ['primary label hover', 'ink-inverse', 'accent-strong-hover', 4.5],
  ['secondary label', 'ink-1', 'surface-2', 4.5],
  ['secondary label hover', 'ink-1', 'surface-3', 4.5],
  ['destructive label', 'ink-inverse', 'danger-strong', 4.5],
  ['destructive label hover', 'ink-inverse', 'danger-strong-hover', 4.5],
  ['destructive text on page', 'danger', 'surface-1', 4.5],
  ['destructive text on card', 'danger', 'surface-2', 4.5],
  ['text button on page', 'ink-1', 'surface-1', 4.5],
  ['disabled label', 'ink-3', 'surface-3', 4.5],
  ['disabled dashed border', 'line-ui', 'surface-1', 3],
  ['about badge', 'ink-1', 'surface-1', 3],
  ['about badge open', 'ink-inverse', 'ink-1', 3],
];

describe('contrast recomputed from design/tokens.json (WCAG 2.1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, fg, bg, need] of PAIRS) {
      it(`US-NF-02/AC1 US-E8-05/AC3 ${theme}: ${name} (${fg} on ${bg}) >= ${need}`, () => {
        expect(contrast(c(theme, fg), c(theme, bg))).toBeGreaterThanOrEqual(need);
      });
    }
  }
});
