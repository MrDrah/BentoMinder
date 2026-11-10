// UI refresh 2026-11, slice 2: the calendar day tile (design/components.md §18, copy §24, a11y §6 / §12.2;
// BA US-E5-01/AC3-AC4, AC9-AC16). The tile shows the day number, one state icon, the allergen mark and the
// edge markers; fixtures only, no live data.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { DayView } from '../../../src/domain/calendar/day-view.ts';
import { createDayViewer } from '../../../src/domain/calendar/day-view.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/index.ts';
import type { LocalDate, YearMonth } from '../../../src/domain/time/jst.ts';
import { createTranslator, type Language, type MessageKey } from '../../../src/i18n/index.ts';
import { en } from '../../../src/i18n/en.ts';
import { ja } from '../../../src/i18n/ja.ts';
import { CalendarGrid } from '../../../src/ui/calendar/CalendarGrid.tsx';
import { cellLabel } from '../../../src/ui/calendar/cell-label.ts';
import { tileOf } from '../../../src/ui/calendar/tile.ts';
import { renderApp } from '../helpers/app.tsx';
import { clone, loadFixture } from '../helpers/fixtures.ts';
import { dict } from '../helpers/menus.ts';

afterEach(() => cleanup());

const TODAY = '2026-11-17' as LocalDate; // a Tuesday
const DATES = { past: '2026-11-10', today: '2026-11-17', tomorrow: '2026-11-18', future: '2026-11-24' } as const;
type Time = keyof typeof DATES;
type Kind = 'school' | 'home' | 'unsure' | 'none';

const day = { date: '2026-11-17', items: [{ text: 'ごはん', kind: 'main' }], allergenDeclaration: { status: 'not-declared' } };
const record = { date: '', state: 'homemade-bento-planned', recipeId: 'r1', recipeNameSnapshot: { ja: 'くまさんおにぎり弁当' }, recipeShortNameSnapshot: { ja: 'くまおにぎり', en: 'Bear oni' } };

/** A DayView fixture: only the fields the tile reads are meaningful. */
function view(time: Time, kind: Kind, o: { changed?: boolean; dash?: boolean; allergen?: boolean } = {}): DayView {
  const date = DATES[time] as LocalDate;
  const base = {
    date,
    month: '2026-11',
    type: { type: 'outside' },
    isToday: time === 'today',
    past: time === 'past',
    menuVersion: 1,
    assessment: null,
    displayed: { state: null, conflict: 'none', needsAck: false },
    record: undefined,
    override: undefined,
    conflict: false,
    overrideChanged: false,
    needsReviewBadge: false,
    allergenAlert: o.allergen === true,
    reservationOffered: false,
    reservationDone: false,
    canOverride: false,
    actions: [],
  } as unknown as DayView;
  const over: Partial<DayView> = {};
  if (kind === 'school') Object.assign(over, { type: { type: 'school', day: { ...day, date } }, displayed: { state: 'school-lunch-planned', conflict: 'none', needsAck: false } });
  if (kind === 'home') Object.assign(over, o.dash ? { type: { type: 'bento-day', noLunch: { date, reason: 'bento-day', originalText: 'お弁当の日' } }, displayed: { state: 'no-school-lunch', conflict: 'none', needsAck: false } } : { type: { type: 'school', day: { ...day, date } }, displayed: { state: 'homemade-bento-planned', conflict: 'none', needsAck: false }, record: { ...record, date } });
  if (kind === 'unsure') Object.assign(over, { type: { type: 'school', day: { ...day, date } }, displayed: { state: 'not-confirmed', conflict: 'none', needsAck: false }, record: { ...record, date, state: 'not-confirmed' } });
  const v = { ...base, ...over } as DayView;
  // "changed" without a stored decision: an applied override (school day); with a stored record it is already changed
  if (o.changed === true && v.record === undefined) (v as { assessment: unknown }).assessment = { state: 'mixed-uncertain', override: { state: 'mixed-uncertain' } };
  return v;
}

const tFor = (lang: Language) => createTranslator(lang);

function renderTile(v: DayView, lang: Language = 'ja') {
  const t = tFor(lang);
  render(<CalendarGrid t={t} lang={lang} month={"2026-11" as YearMonth} today={TODAY} weekStartsOn="monday" views={new Map([[v.date, v]])} selected={null} onOpen={() => {}} onMonth={() => {}} />);
  return screen.getByTestId(`cal-cell-${v.date}`);
}

/** The accessible-name sentence expected from copy §24, built from the catalog keys (ja). */
function expectedName(v: DayView, tile: ReturnType<typeof tileOf>): string {
  const t = tFor('ja');
  const date = `11月${Number(v.date.slice(8))}日（${'日月火水木金土'[new Date(v.date + 'T00:00:00Z').getUTCDay()]}）`;
  let s = tile.state === null ? t('cell.aria.outside', { date }) : t('cell.aria.tile', { date, state: t(`cell.state.${tile.state}` as MessageKey) });
  if (tile.allergen) s += t('cell.aria.allergen');
  if (tile.changed) s += t('cell.aria.override');
  s += v.isToday ? t('cell.aria.isToday') : tile.tomorrow ? t('cell.aria.isTomorrow') : v.past ? t('cell.aria.past') : '';
  if (tile.dash) s += t('cell.aria.dash');
  return s;
}

const ACS: Record<Time, string> = { past: 'US-E5-01/AC9', today: 'US-E5-01/AC11', tomorrow: 'US-E5-01/AC12', future: 'US-E5-01/AC3' };
const ICON: Record<Kind, string | null> = { school: 'lunchbox', home: 'home-bento', unsure: 'bento-unsure', none: null };
const TIMES: Time[] = ['past', 'today', 'tomorrow', 'future'];

interface Combo {
  title: string;
  time: Time;
  kind: Kind;
  changed: boolean;
  dash: boolean;
}
// The 31 base combinations of components §18.5: 4 times x 4 kinds, changed on 3 kinds x 4 times, dash on 3 times.
const combos: Combo[] = [
  ...TIMES.flatMap((time) => (['school', 'home', 'unsure', 'none'] as Kind[]).map((kind) => ({ title: `${ACS[time]} ${time} ${kind}`, time, kind, changed: false, dash: false }))),
  ...TIMES.flatMap((time) => (['school', 'home', 'unsure'] as Kind[]).map((kind) => ({ title: `US-E5-01/AC10 ${time} ${kind} changed (red top border)`, time, kind, changed: true, dash: false }))),
  ...(['today', 'tomorrow', 'future'] as Time[]).map((time) => ({ title: `US-E5-01/AC13 ${time} bento day not planned (red dash)`, time, kind: 'home' as Kind, changed: false, dash: true })),
];

describe('the 31 base combinations of the tile matrix (components §18.5)', () => {
  it('US-E5-01/AC3 there are 31 combinations', () => {
    expect(combos).toHaveLength(31);
  });

  it.each(combos)('$title: classes, data hooks, icon, edge markers and the name', ({ time, kind, changed, dash }) => {
    const v = view(time, kind, { changed, dash });
    const el = renderTile(v);
    const t = tileOf(v, TODAY);
    // data hooks and classes
    expect(el).toHaveAttribute('data-icon', kind);
    expect(el.classList.contains('has-icon')).toBe(kind !== 'none');
    expect(el.classList.contains('is-today')).toBe(time === 'today');
    expect(el.classList.contains('is-tomorrow')).toBe(time === 'tomorrow');
    expect(el.classList.contains('is-past')).toBe(time === 'past');
    expect(el.hasAttribute('data-changed')).toBe(changed || (kind === 'home' && !dash) || kind === 'unsure');
    expect(el.hasAttribute('data-dash')).toBe(dash);
    // exactly the number, at most one icon, at most one dash, no allergen mark, nothing else (content budget, AC16)
    expect(el.querySelector('.cell__num')).toHaveTextContent(String(Number(v.date.slice(8))));
    const icons = el.querySelectorAll('svg');
    expect(icons).toHaveLength(kind === 'none' ? 0 : 1);
    if (ICON[kind] !== null) expect(icons[0]).toHaveAttribute('data-icon', ICON[kind]);
    expect(el.querySelectorAll('.cell__dash')).toHaveLength(dash ? 1 : 0);
    expect(el.querySelectorAll('.cell__allergen')).toHaveLength(0);
    expect(el.querySelector('.cell__top ~ *:not(svg):not(.cell__dash):not(.cell__allergen):not(.visually-hidden)')).toBeNull();
    expect(el.querySelector('.cell__btn')?.textContent).toBe(`${expectedName(v, t)}${Number(v.date.slice(8))}`);
    // the accessible name
    expect(within(el).getByRole('button')).toHaveAccessibleName(expectedName(v, t));
    // today is the only filled tile and carries aria-current
    expect(el.hasAttribute('aria-current')).toBe(time === 'today');
    // no assessment symbol, word or recipe name on the tile
    expect(el.querySelector('.mark, .cell__mark, .cell__word, .cell__pill, .flag-badge, .bento-icon')).toBeNull();
  });

  it('US-E5-01/AC13 the dash never occurs with the top bar, and a past bento day shows no dash', () => {
    for (const time of TIMES) {
      const v = view(time, 'home', { dash: true });
      const t = tileOf(v, TODAY);
      expect(t.dash).toBe(time !== 'past');
      expect(t.dash && t.changed).toBe(false);
    }
  });
});

describe('US-E5-01/AC16 the allergen mark (reuses the day-sheet predicate; US-E1-05/AC2)', () => {
  it.each(TIMES)('US-E5-01/AC16 a school-lunch tile with the alert shows one mark and names it (%s)', (time) => {
    const v = view(time, 'school', { allergen: true });
    const el = renderTile(v);
    expect(el).toHaveAttribute('data-allergen', 'true');
    expect(el).toHaveClass('has-allergen');
    expect(el.querySelectorAll('.cell__allergen')).toHaveLength(1);
    expect(el.querySelector('.cell__allergen')).toHaveAttribute('aria-hidden', 'true');
    expect(el.querySelector('.cell__allergen')).toHaveTextContent('!');
    expect(within(el).getByRole('button')).toHaveAccessibleName(expectedName(v, tileOf(v, TODAY)));
    // the alert comes right after the state
    expect(within(el).getByRole('button').textContent).toContain(ja['cell.state.school'] + ja['cell.aria.allergen']);
  });

  it('US-E5-01/AC16 English: "allergen alert" right after the state', () => {
    const v = view('future', 'school', { allergen: true, changed: true });
    const el = renderTile(v, 'en');
    expect(within(el).getByRole('button')).toHaveAccessibleName('Tue, Nov 24, school lunch, allergen alert, changed by you');
  });

  it('US-E5-01/AC16 no mark on home, unsure, bento-day, number-only; the red dash and the mark never meet', () => {
    for (const [kind, dash] of [['home', false], ['home', true], ['unsure', false], ['none', false]] as [Kind, boolean][]) {
      const v = view('future', kind, { allergen: true, dash });
      expect(tileOf(v, TODAY).allergen, `${kind} ${dash}`).toBe(false);
    }
    expect(tileOf(view('future', 'school', { allergen: true }), TODAY).dash).toBe(false);
  });

  it('US-E5-01/AC16 US-E1-05/AC2 the mark comes from the same predicate as the day banner: only the child\'s registered allergens', () => {
    const view_ = createDayViewer(dict);
    const store = clone(loadFixture<BentoMinderStore>('state/m2-november.json'));
    const confirmed = store.menus['2026-11']!.confirmed!;
    const declared = confirmed.days.find((d) => d.allergenDeclaration.status === 'declared')!;
    const ids = (declared.allergenDeclaration as { allergenIds: string[] }).allergenIds;
    expect(ids.length).toBeGreaterThan(0);
    const dateOf = declared.date as LocalDate;
    expect(view_(store, dateOf, '2026-11-02' as LocalDate).allergenAlert).toBe(false); // registered: shrimp only
    store.profile = { ...store.profile!, allergyStatus: 'has-known', knownAllergenIds: [ids[0]!] };
    const v = view_(store, dateOf, '2026-11-02' as LocalDate);
    expect(v.allergenAlert).toBe(true);
    expect(tileOf(v, '2026-11-02' as LocalDate).allergen).toBe(true);
    store.profile = { ...store.profile, allergyStatus: 'none-known', knownAllergenIds: [], excludedIngredientIds: [] };
    expect(view_(store, dateOf, '2026-11-02' as LocalDate).allergenAlert).toBe(false);
  });

  it('US-E5-01/AC16 needs-review and refresh-conflict never put a flag on the tile', () => {
    const v = view('future', 'home');
    (v as { needsReviewBadge: boolean }).needsReviewBadge = true;
    const el = renderTile(v);
    expect(el.querySelector('.flag-badge, [data-flag]')).toBeNull();
    expect(el).not.toHaveAttribute('data-flag');
  });
});

describe('US-E5-01/AC14 accessible names in ja and en (a11y-responsive.md section 6)', () => {
  const cases: [string, DayView, string, string][] = [
    ['school lunch, ordinary', view('future', 'school'), '11月24日（火）、給食', 'Tue, Nov 24, school lunch'],
    ['school lunch, changed, tomorrow', view('tomorrow', 'school', { changed: true }), '11月18日（水）、給食、手動で変更、明日', 'Wed, Nov 18, school lunch, changed by you, tomorrow'],
    ['school lunch, allergen alert, changed, today', view('today', 'school', { allergen: true, changed: true }), '11月17日（火）、給食、アレルギーに注意、手動で変更、今日', 'Tue, Nov 17, school lunch, allergen alert, changed by you, today'],
    ['past school day with the alert', view('past', 'school', { allergen: true }), '11月10日（火）、給食、アレルギーに注意、過去の日', 'Tue, Nov 10, school lunch, allergen alert, past day'],
    ['homemade bento, today', view('today', 'home'), '11月17日（火）、手作りお弁当、手動で変更、今日', 'Tue, Nov 17, homemade bento, changed by you, today'],
    ['bento day, no plan, tomorrow', view('tomorrow', 'home', { dash: true }), '11月18日（水）、手作りお弁当の日、明日、お弁当の準備が未定', 'Wed, Nov 18, bento day, tomorrow, bento still to plan'],
    ['bento day, no plan, later', view('future', 'home', { dash: true }), '11月24日（火）、手作りお弁当の日、お弁当の準備が未定', 'Tue, Nov 24, bento day, bento still to plan'],
    ['not confirmed', view('future', 'unsure'), '11月24日（火）、未定、手動で変更', 'Tue, Nov 24, undecided, changed by you'],
    ['past, changed (keeps its red top border)', view('past', 'home'), '11月10日（火）、手作りお弁当、手動で変更、過去の日', 'Tue, Nov 10, homemade bento, changed by you, past day'],
    ['number-only, today', view('today', 'none'), '11月17日（火）、献立に記載なし、今日', 'Tue, Nov 17, not on the menu, today'],
  ];
  it.each(cases)('US-E5-01/AC14 %s', (_name, v, jaName, enName) => {
    expect(cellLabel(tFor('ja'), 'ja', v, TODAY)).toBe(jaName);
    expect(cellLabel(tFor('en'), 'en', v, TODAY)).toBe(enName);
  });

  it('US-E5-01/AC14 the name has no assessment, no recipe name, no colour word, no "button"', () => {
    const v = view('future', 'home');
    for (const lang of ['ja', 'en'] as const) {
      const label = cellLabel(tFor(lang), lang, v, TODAY);
      expect(label).not.toMatch(/くま|Bear|苦手|たのしめそう|might|likely|赤|グレー|red|grey|button|ボタン/i);
    }
  });

  it('US-E5-01/AC12 tomorrow is the next calendar date: Saturday to Sunday, and the end of the month to the 1st', () => {
    const sun = view('future', 'none');
    (sun as { date: string }).date = '2026-11-15';
    expect(tileOf(sun, '2026-11-14' as LocalDate).tomorrow).toBe(true);
    const dec1 = view('future', 'none');
    (dec1 as { date: string }).date = '2026-12-01';
    expect(tileOf(dec1, '2026-11-30' as LocalDate).tomorrow).toBe(true);
    expect(tileOf(dec1, '2026-11-29' as LocalDate).tomorrow).toBe(false);
  });

  it('US-E5-01/AC10 a dormant override or record shows nothing: a number-only tile never has a top bar', () => {
    const v = view('future', 'none');
    (v as { record: unknown }).record = { ...record, state: 'school-lunch-planned' };
    expect(tileOf(v, TODAY)).toMatchObject({ icon: 'none', changed: false, dash: false });
  });
});

describe('US-E5-01/AC15 legend 「表示の見かた」', () => {
  it.each(['ja', 'en'] as const)('US-E5-01/AC15 lists the lead sentence and ten rows with samples (%s) and nothing about assessment marks or recipe names', async (lang) => {
    const user = userEvent.setup();
    await renderApp({ store: loadFixture<BentoMinderStore>('state/m2-november.json'), now: '2026-11-02T01:00:00Z' });
    if (lang === 'en') await user.click(screen.getByRole('radio', { name: 'EN' }));
    await user.click(screen.getByTestId('legend-toggle'));
    const body = document.getElementById('legend-body')!;
    expect(body).toBeVisible();
    const c = lang === 'ja' ? ja : en;
    expect(within(body).getByText(c['legend.intro'])).toBeInTheDocument();
    const keys = ['legend.school', 'legend.home', 'legend.unsure', 'legend.dash', 'legend.allergen', 'legend.changedEdge', 'legend.today', 'legend.tomorrow', 'legend.past', 'legend.weekend'] as const;
    const rows = within(body).getAllByTestId('legend-row');
    expect(rows.map((r) => r.textContent?.replace(/^\d+!?/, '').replace(/^\d+/, ''))).toEqual(keys.map((k) => expect.stringContaining(c[k])));
    for (const row of rows) expect(row.querySelector('[aria-hidden="true"]')).not.toBeNull();
    // the samples use the real tile styles
    const sample = (i: number) => rows[i]!.querySelector('.legend__sample')!;
    expect(sample(0).querySelector('[data-icon="lunchbox"]')).not.toBeNull();
    expect(sample(1).querySelector('[data-icon="home-bento"]')).not.toBeNull();
    expect(sample(2).querySelector('[data-icon="bento-unsure"]')).not.toBeNull();
    expect(sample(3).querySelector('.cell__dash')).not.toBeNull();
    expect(sample(4).querySelector('.cell__allergen')).toHaveTextContent('!');
    expect(sample(5)).toHaveClass('is-changed');
    expect(sample(6)).toHaveClass('is-today');
    expect(sample(7)).toHaveClass('is-tomorrow');
    expect(sample(8)).toHaveClass('is-past');
    expect(body.querySelector('.mark, .bento-icon, .flag-badge, .cell__word, [data-testid="cal-cell-2026-11-04"]')).toBeNull();
    for (const old of ['legend.rule', 'legend.planned', 'legend.suggest', 'legend.override'] as const) expect((c as Record<string, string>)[old]).toBeUndefined();
  });
});

describe('US-NF-02/AC1 import focus order (PLAN ruling 2026-11-10)', () => {
  it('US-NF-02/AC1 the submit button comes after the PDF upload and manual entry in DOM order, inside the action bar', async () => {
    await renderApp({ store: loadFixture<BentoMinderStore>('state/m2-november.json'), hash: '#/import' });
    const submit = await screen.findByTestId('import-submit');
    const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(after(screen.getByTestId('input-url'), submit)).toBe(true);
    expect(after(screen.getByTestId('import-upload'), submit)).toBe(true);
    expect(after(screen.getByTestId('import-manual'), submit)).toBe(true);
    expect(submit.closest('.action-bar')).not.toBeNull();
  });
});

describe('US-NF-02/AC3 the copy catalog holds every row of copy §24 (verbatim) and no superseded cell row', () => {
  it('US-NF-02/AC4 cell.aria.* and cell.state.* rows, ja and en', () => {
    const rows: Record<string, [string, string]> = {
      'cell.aria.tile': ['{date}、{state}', '{date}, {state}'],
      'cell.state.school': ['給食', 'school lunch'],
      'cell.state.home': ['手作りお弁当', 'homemade bento'],
      'cell.state.homeDay': ['手作りお弁当の日', 'bento day'],
      'cell.state.unsure': ['未定', 'undecided'],
      'cell.aria.isToday': ['、今日', ', today'],
      'cell.aria.isTomorrow': ['、明日', ', tomorrow'],
      'cell.aria.allergen': ['、アレルギーに注意', ', allergen alert'],
      'cell.aria.dash': ['、お弁当の準備が未定', ', bento still to plan'],
      'legend.intro': ['日付の下の絵は、その日の予定です。給食の見立てやレシピ名は、日付を開くと見られます。', "The picture under the date is that day's plan. Open a day to see the lunch assessment and the recipe name."],
      'legend.school': ['給食の日', 'School lunch day'],
      'legend.home': ['手作りお弁当の日', 'Homemade bento day'],
      'legend.unsure': ['お弁当かも？（未定・あとで決める）', 'Maybe a bento? (undecided, decide later)'],
      'legend.dash': ['赤い短い線：お弁当の準備が未定（今日から先の日）', 'Short red line: bento still to plan (today and later)'],
      'legend.allergen': ['！：登録したアレルギーに注意が必要な給食の日', '! mark: school lunch day that needs allergen attention (your registered allergens)'],
      'legend.changedEdge': ['赤い上の線：手動で変更した日', 'Red line along the top: a day you changed'],
      'legend.today': ['塗りつぶし：今日', 'Filled tile: today'],
      'legend.tomorrow': ['太い枠：明日', 'Thick frame: tomorrow'],
      'legend.past': ['グレー：過去の日', 'Grey: past day'],
    };
    for (const [key, [j, e]] of Object.entries(rows)) {
      expect((ja as Record<string, string>)[key], key).toBe(j);
      expect((en as Record<string, string>)[key], key).toBe(e);
    }
    for (const gone of ['cell.word.school', 'cell.word.notConfirmed', 'cell.word.noLunch', 'cell.word.bentoDay', 'cell.aria', 'cell.aria.planned', 'cell.aria.today', 'cell.aria.changed', 'cell.aria.bentoDay', 'cell.aria.bentoDayOpen', 'legend.rule', 'legend.planned', 'legend.notConfirmed', 'legend.suggest', 'legend.noLunch', 'legend.bentoDay', 'legend.changed', 'legend.override']) {
      expect(gone in ja, gone).toBe(false);
      expect(gone in en, gone).toBe(false);
    }
    for (const kept of ['cell.word.holiday', 'cell.flag.changed', 'cell.flag.allergen', 'cell.aria.holiday', 'cell.aria.override', 'cell.aria.past', 'cell.aria.noLunch', 'cell.aria.outside', 'cell.aria.noMenu', 'legend.weekend', 'legend.title']) expect(kept in ja && kept in en, kept).toBe(true);
  });
});

describe('US-NF-02/AC3 tile contrast pairs T01-T31 (a11y-responsive.md section 12.2), from design/tokens.json', () => {
  const tokens = JSON.parse(readFileSync('design/tokens.json', 'utf8')) as { color: Record<'light' | 'dark', Record<string, { value: string }>> };
  const lum = (hex: string) => {
    const n = hex.replace('#', '');
    const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
    return (x + 0.05) / (y + 0.05);
  };
  const pairs: [string, string, string, number][] = [
    ['T01', 'ink-1', 'surface-2', 4.5],
    ['T02', 'ink-3', 'surface-1', 4.5],
    ['T03', 'ink-inverse', 'navy-fill', 4.5],
    ['T04', 'ink-2', 'surface-2', 3],
    ['T05', 'ink-3', 'surface-1', 3],
    ['T06', 'ink-inverse', 'navy-fill', 3],
    ['T07', 'ink-2', 'surface-3', 3],
    ['T08', 'ink-1', 'surface-3', 4.5],
    ['T09', 'accent', 'surface-2', 3],
    ['T10', 'accent', 'surface-1', 3],
    ['T11', 'accent', 'surface-3', 3],
    ['T12', 'planned-edge', 'navy-fill', 3],
    ['T13', 'planned-edge', 'surface-1', 3],
    ['T14', 'ink-1', 'surface-2', 3],
    ['T15', 'ink-1', 'surface-1', 3],
    ['T16', 'navy-fill', 'surface-1', 3],
    ['T17', 'ink-1', 'surface-2', 3],
    ['T18', 'ink-inverse', 'navy-fill', 3],
    ['T19', 'sunday', 'surface-2', 4.5],
    ['T20', 'saturday', 'surface-2', 4.5],
    ['T21', 'sunday', 'surface-1', 4.5],
    ['T22', 'saturday', 'surface-1', 4.5],
    ['T25', 'focus-ring', 'focus-halo', 3],
    ['T26', 'focus-ring', 'surface-1', 3],
    ['T27', 'danger', 'danger-soft', 4.5],
    ['T28', 'danger', 'surface-2', 3],
    ['T29', 'danger', 'surface-1', 3],
    ['T30', 'danger', 'surface-3', 3],
    ['T31', 'danger-soft', 'navy-fill', 3],
  ];
  it.each(pairs)('US-NF-02/AC3 %s: %s on %s needs %s:1 in light and dark', (_id, fg, bg, need) => {
    for (const theme of ['light', 'dark'] as const) {
      const c = tokens.color[theme];
      expect(ratio(c[fg]!.value, c[bg]!.value), `${theme} ${fg}/${bg}`).toBeGreaterThanOrEqual(need);
    }
  });
});
