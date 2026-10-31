// The calendar home and the day sheet in jsdom (US-E5-01, US-E5-02, US-E4-03, US-E5-05…E5-08,
// US-E3-05): grid cells, labels, keyboard model, month navigation, decisions through the sheet.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { BentoMinderStore } from '../../../src/domain/schema/index.ts';
import { renderApp } from '../helpers/app.tsx';
import { clone, loadFixture } from '../helpers/fixtures.ts';

const NOV2 = '2026-11-02T01:00:00Z'; // 2026-11-02 10:00 JST
const november = () => loadFixture<BentoMinderStore>('state/m2-november.json');
const cell = (date: string) => screen.getByTestId(`cal-cell-${date}`);
const button = (date: string) => within(cell(date)).getByRole('button');

async function open(user: ReturnType<typeof userEvent.setup>, date: string) {
  await user.click(button(date));
  return screen.findByTestId('day-sheet');
}

describe('US-E5-01 the calendar is the home screen', () => {
  it('US-E5-01/AC2 the week starts on Monday: header 月 火 水 木 金 土 日, Sunday 2026-11-01 in the last column of the first row', async () => {
    await renderApp({ store: november(), now: NOV2 });
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['月', '火', '水', '木', '金', '土', '日']);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', '2026年11月のカレンダー');
    const firstRow = screen.getAllByRole('row')[1] as HTMLElement;
    expect(within(firstRow).getAllByRole('gridcell').at(-1)).toBe(cell('2026-11-01'));
  });

  it('US-E5-01/AC1 the Tokyo month is shown with today marked', async () => {
    await renderApp({ store: november(), now: '2026-11-14T15:30:00Z' }); // 11-15 00:30 JST
    expect(cell('2026-11-15')).toHaveAttribute('aria-current', 'date');
    expect(screen.getByTestId('cal-title')).toHaveTextContent('2026年11月');
  });

  it('US-E5-01/AC3 US-E5-01/AC4 a school day shows the assessment and the decision separately; a suggestion is dashed, a plan is filled with the short name', async () => {
    await renderApp({ store: november(), now: NOV2 });
    // 11-12: low-preference, decision still school lunch: the suggestion
    expect(cell('2026-11-12')).toHaveAttribute('data-assessment', 'low-preference');
    expect(cell('2026-11-12')).toHaveAttribute('data-decision', 'school-lunch-planned');
    expect(cell('2026-11-12')).toHaveClass('is-suggest');
    expect(cell('2026-11-12')).toHaveTextContent('給食');
    expect(button('2026-11-12')).toHaveAccessibleName('11月12日（木）、苦手かも、給食');
    // 11-04: planned: filled, short name in the cell, full name in the accessible name
    expect(cell('2026-11-04')).toHaveClass('is-planned');
    expect(cell('2026-11-04')).toHaveAttribute('data-decision', 'homemade-bento-planned');
    expect(cell('2026-11-04')).toHaveTextContent('くまおにぎり');
    expect(button('2026-11-04')).toHaveAccessibleName('11月4日（水）、苦手かも、手作りお弁当：くまさんおにぎり弁当');
    expect(cell('2026-11-04')).not.toHaveClass('is-suggest');
  });

  it('US-E5-01/AC4 in English the cell shows shortNameEn and the label is English', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    await user.click(screen.getByRole('radio', { name: 'EN' }));
    await waitFor(() => expect(cell('2026-11-04')).toHaveTextContent('Bear oni'));
    expect(button('2026-11-04')).toHaveAccessibleName('Wed, Nov 4, might not enjoy, homemade bento: Bear onigiri bento');
  });

  it('US-E4-03/AC1 an override shows the overridden mark with the label in the accessible name', async () => {
    await renderApp({ store: november(), now: NOV2 });
    expect(cell('2026-11-05')).toHaveAttribute('data-override', 'mixed-uncertain');
    expect(button('2026-11-05')).toHaveAccessibleName('11月5日（木）、どちらとも、給食、手動で変更');
  });

  it('US-E5-08 US-E5-02/AC2 the bento day, the no-lunch day and a weekend outside the menu are named as such', async () => {
    await renderApp({ store: november(), now: NOV2 });
    expect(button('2026-11-20')).toHaveAccessibleName('11月20日（金）、お弁当の日、未計画');
    expect(button('2026-11-27')).toHaveAccessibleName('11月27日（金）、給食なし（午前保育（給食なし））');
    expect(button('2026-11-07')).toHaveAccessibleName('11月7日（土）、献立に記載なし');
    expect(cell('2026-11-07')).not.toHaveAttribute('data-assessment');
  });

  it('US-E5-02/AC3 days before today are marked past and carry the past suffix', async () => {
    await renderApp({ store: november(), now: '2026-11-10T01:00:00Z' });
    expect(cell('2026-11-09')).toHaveAttribute('data-past', 'true');
    expect(button('2026-11-09')).toHaveAccessibleName('11月9日（月）、たのしめそう、給食、過去の日');
    expect(cell('2026-11-10')).not.toHaveAttribute('data-past');
  });

  it('US-E5-01/AC5 US-E5-01/AC6 month navigation crosses the year; February 2028 has 29 days, 2027 has 28; 「今日」 returns', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    await user.click(screen.getByTestId('cal-next'));
    await user.click(screen.getByTestId('cal-next'));
    await waitFor(() => expect(screen.getByTestId('cal-title')).toHaveTextContent('2027年1月'));
    expect(button('2027-01-04')).toHaveAccessibleName('1月4日（月）、献立未取り込み');
    await user.click(screen.getByTestId('cal-today'));
    await waitFor(() => expect(screen.getByTestId('cal-title')).toHaveTextContent('2026年11月'));
    window.location.hash = '#/calendar/2028-02';
    await waitFor(() => expect(document.querySelectorAll('[data-testid^="cal-cell-2028-02-"]')).toHaveLength(29));
    window.location.hash = '#/calendar/2027-02';
    await waitFor(() => expect(document.querySelectorAll('[data-testid^="cal-cell-2027-02-"]')).toHaveLength(28));
  });

  it('US-E5-01/AC7 the attention row counts low-preference days in the next 7 days that are still school lunch or undecided', async () => {
    await renderApp({ store: november(), now: '2026-11-09T01:00:00Z' });
    expect(screen.getByTestId('upcoming-low')).toHaveTextContent('苦手かもの日が1日あります');
    expect(screen.getByTestId('upcoming-low')).toHaveTextContent('7日以内・まだ計画していません');
  });

  it('US-E5-01/AC7 the upcoming summary lists the planned day, and with none planned says so', async () => {
    await renderApp({ store: november(), now: NOV2 });
    const summary = screen.getByTestId('upcoming');
    expect(within(summary).getByTestId('upcoming-row-2026-11-04')).toHaveTextContent('11月4日（水）');
    expect(within(summary).getByTestId('upcoming-row-2026-11-04')).toHaveTextContent('くまさんおにぎり弁当');
    expect(within(summary).queryByTestId('upcoming-low')).toBeNull(); // the only low day within 7 days is the planned one
    const none = clone(november());
    none.decisions = {};
    document.body.innerHTML = '';
    await renderApp({ store: none, now: NOV2 });
    await screen.findByTestId('upcoming');
    expect(screen.getByTestId('upcoming-empty')).toHaveTextContent('予定している手作りお弁当はありません');
  });
});

describe('US-E5-01 the grid keyboard model (ARIA date-picker grid)', () => {
  it('US-E5-01/AC3 one tab stop on today; arrows move by day and week; Home and End go to the row ends', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    expect(button('2026-11-02')).toHaveAttribute('tabindex', '0');
    expect(button('2026-11-03')).toHaveAttribute('tabindex', '-1');
    button('2026-11-04').focus();
    await user.keyboard('{ArrowRight}');
    expect(button('2026-11-05')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(button('2026-11-12')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowUp}');
    expect(button('2026-11-04')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(button('2026-11-02')).toHaveFocus();
    await user.keyboard('{End}');
    expect(button('2026-11-08')).toHaveFocus();
    expect(button('2026-11-08')).toHaveAttribute('tabindex', '0');
  });

  it('US-E5-01/AC5 moving past a month edge loads the adjacent month; PageUp and PageDown change month and keep the day number, clamped', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    button('2026-11-30').focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByTestId('cal-title')).toHaveTextContent('2026年12月'));
    await waitFor(() => expect(button('2026-12-01')).toHaveFocus());
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(screen.getByTestId('cal-title')).toHaveTextContent('2026年11月'));
    await waitFor(() => expect(button('2026-11-30')).toHaveFocus());
    await user.keyboard('{PageDown}{PageDown}');
    await waitFor(() => expect(screen.getByTestId('cal-title')).toHaveTextContent('2027年1月'));
    await waitFor(() => expect(button('2027-01-30')).toHaveFocus());
    await user.keyboard('{PageDown}');
    await waitFor(() => expect(button('2027-02-28')).toHaveFocus()); // 30 clamped to the 28 days of February
    await user.keyboard('{PageUp}');
    await waitFor(() => expect(button('2027-01-28')).toHaveFocus());
  });

  it('US-E5-02/AC1 Enter opens the day sheet for the focused date; Esc closes it and the focus returns to the cell', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    button('2026-11-04').focus();
    await user.keyboard('{Enter}');
    const sheet = await screen.findByTestId('day-sheet');
    expect(sheet).toHaveAttribute('role', 'dialog');
    expect(sheet).toHaveAccessibleName('11月4日（水）');
    expect(window.location.hash).toBe('#/day/2026-11-04');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('day-sheet')).toBeNull());
    await waitFor(() => expect(button('2026-11-04')).toHaveFocus());
  });
});

describe('US-E5-02 the day sheet', () => {
  it('US-E5-02/AC1 shows the date, the menu with the dislike tag, the explanation, the current decision and only the allowed actions', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-12');
    const sheet = screen.getByTestId('day-sheet');
    expect(within(sheet).getByTestId('day-sheet-title')).toHaveTextContent('11月12日（木）');
    expect(within(sheet).getByTestId('day-menu')).toHaveTextContent('給食の献立');
    expect(within(sheet).getByTestId('assess-chip')).toHaveTextContent('苦手かも');
    expect(within(sheet).getByTestId('assess-explanation')).toHaveTextContent(/木曜日の給食には、苦手な食材が.+含まれています/);
    expect(within(sheet).getByTestId('day-status')).toHaveTextContent('いまの予定：給食');
    expect(within(sheet).getByTestId('day-action-bento')).toBeInTheDocument();
    expect(within(sheet).getByTestId('day-action-later')).toBeInTheDocument();
    for (const absent of ['day-action-school', 'day-action-change-recipe', 'day-action-clear-plan', 'day-action-keep', 'day-action-view-recipe']) {
      expect(within(sheet).queryByTestId(absent)).toBeNull();
    }
    expect(within(sheet).getByTestId('day-reservation-note')).toHaveTextContent('給食の予約は園の方法で行ってください（このアプリでは予約されません）');
  });

  it('US-E4-02/AC1 the explanation names the counted foods in English too', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    await user.click(screen.getByRole('radio', { name: 'EN' }));
    await open(user, '2026-11-12');
    expect(screen.getByTestId('assess-explanation')).toHaveTextContent(/Thursday's lunch includes \d foods? your child dislikes/);
  });

  it('US-E5-02/AC2 a weekend outside the menu says so and offers no decision action', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-07');
    expect(within(screen.getByTestId('day-sheet')).getByTestId('day-outside-note')).toHaveTextContent('この日は献立に記載がありません');
    expect(screen.queryByTestId('day-plan')).toBeNull();
  });

  it('US-E5-02/AC4 a weekday in a month without a confirmed menu says so', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2, hash: '#/calendar/2026-12' });
    await open(user, '2026-12-02');
    expect(screen.getByTestId('day-outside-note')).toHaveTextContent('この月の献立はまだ取り込まれていません');
    expect(screen.queryByTestId('assess-chip')).toBeNull();
    expect(screen.queryByTestId('day-plan')).toBeNull();
  });

  it('US-E5-02/AC3 US-E4-03/AC6 a past day shows its decision and assessment but offers no action and no override', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: '2026-11-10T01:00:00Z' });
    await open(user, '2026-11-04');
    const sheet = screen.getByTestId('day-sheet');
    expect(within(sheet).getByTestId('day-status')).toHaveTextContent('手作りお弁当');
    expect(within(sheet).getByTestId('day-past-note')).toHaveTextContent('過去の日のため、予定は変更できません。');
    expect(within(sheet).getByTestId('assess-chip')).toBeInTheDocument();
    for (const absent of ['day-action-later', 'day-action-school', 'day-action-change-recipe', 'override-open', 'check-reservation']) {
      expect(within(sheet).queryByTestId(absent)).toBeNull();
    }
  });

  it('US-E4-01/AC10 US-E4-05/AC2 the allergen line: not declared is shown as unknown, never as safe', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-06');
    expect(screen.getByTestId('day-allergen-not-declared')).toHaveTextContent('アレルゲンの記載がありません');
    expect(screen.getByTestId('day-sheet')).not.toHaveTextContent('アレルゲンなし');
  });

  it('US-E4-05/AC1 a declared allergen the child has is shown with the check-with-the-school sentence', async () => {
    const user = userEvent.setup();
    const store = november();
    store.profile = { ...store.profile!, knownAllergenIds: ['alg-shrimp', 'alg-egg'] };
    await renderApp({ store, now: NOV2 });
    await open(user, '2026-11-05');
    expect(screen.getByTestId('day-banner-allergen')).toHaveTextContent('献立表に卵の表示があります。園にご確認ください。');
  });
});

describe('US-E4-03 override through the day sheet (BR-05)', () => {
  it('US-E4-03/AC1 US-E4-03/AC3 US-E4-03/AC5 choose 「苦手かも」, see the label, the calculated state, the decision untouched; 「自動判定に戻す」 removes it', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-11');
    expect(screen.getByTestId('assess-chip')).toHaveTextContent('たのしめそう');
    await user.click(screen.getByTestId('override-open'));
    await user.click(screen.getByTestId('override-option-low-preference'));
    await waitFor(() => expect(app.stored().overrides['2026-11-11']).toMatchObject({ state: 'low-preference', menuVersionAtSet: 1 }));
    expect(screen.getByTestId('assess-override-tag')).toHaveTextContent('手動で変更');
    expect(screen.getByTestId('assess-chip')).toHaveTextContent('苦手かも');
    expect(screen.getByTestId('assess-calc')).toHaveTextContent('アプリの判定は「たのしめそう」でした。');
    expect(screen.getByTestId('override-live')).toHaveTextContent('判定を「苦手かも」にしました');
    expect(cell('2026-11-11')).toHaveAttribute('data-override', 'low-preference');
    expect(app.stored().decisions['2026-11-11']).toBeUndefined();
    await user.click(screen.getByTestId('override-reset'));
    await waitFor(() => expect(app.stored().overrides['2026-11-11']).toBeUndefined());
    expect(screen.queryByTestId('assess-override-tag')).toBeNull();
    expect(screen.getByTestId('assess-chip')).toHaveTextContent('たのしめそう');
  });

  it('US-E4-03/AC4 a no-lunch day offers no override control', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-27');
    expect(screen.queryByTestId('override-open')).toBeNull();
    expect(screen.getByTestId('day-menu')).toHaveTextContent('この日は給食がありません（献立表：「午前保育（給食なし）」）');
  });

  it('US-E10-02/AC6 a failed write shows the save error, the selection reverts and nothing is claimed', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-11');
    await user.click(screen.getByTestId('override-open'));
    app.storage.failWrites = true;
    await user.click(screen.getByTestId('override-option-low-preference'));
    await waitFor(() => expect(screen.getByTestId('banner-storage')).toBeInTheDocument());
    expect(screen.getByTestId('assess-chip')).toHaveTextContent('たのしめそう');
    expect(screen.queryByTestId('override-live')?.textContent).toBe('');
    expect(app.stored().overrides['2026-11-11']).toBeUndefined();
  });
});

describe('US-E5 decisions through the day sheet (BR-02)', () => {
  it('US-E5-03/AC1 US-E5-03/AC3 「手作りお弁当にする」 opens the recommendation view and writes nothing; going back leaves the decision unchanged', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: NOV2 });
    const before = app.storage.data.get('bentominder.state');
    await open(user, '2026-11-12');
    await user.click(screen.getByTestId('day-action-bento'));
    await screen.findByTestId('screen-recommend');
    expect(window.location.hash).toBe('#/recommend/2026-11-12');
    expect(app.stored().decisions['2026-11-12']).toBeUndefined();
    await user.click(screen.getByTestId('topbar-back'));
    await screen.findByTestId('day-sheet');
    expect(app.storage.data.get('bentominder.state')).toBe(before);
  });

  it('US-E5-05/AC1 「あとで決める」 stores not-confirmed and the cell shows 未定 with an outline marker', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-11');
    await user.click(screen.getByTestId('day-action-later'));
    await waitFor(() => expect(app.stored().decisions['2026-11-11']).toMatchObject({ state: 'not-confirmed' }));
    expect(screen.getByTestId('toast')).toHaveTextContent('11月11日（水）を「未定」にしました');
    expect(cell('2026-11-11')).toHaveAttribute('data-decision', 'not-confirmed');
    expect(cell('2026-11-11')).toHaveTextContent('未定');
    // the actions follow the state machine: bento or back to school lunch (no dialog)
    expect(screen.getByTestId('day-action-bento')).toBeInTheDocument();
    expect(screen.queryByTestId('day-action-later')).toBeNull();
    await user.click(screen.getByTestId('day-action-school'));
    await waitFor(() => expect(app.stored().decisions['2026-11-11']).toMatchObject({ state: 'school-lunch-planned' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('US-E5-06/AC2 US-E5-06/AC3 「給食に戻す」 on a plan asks first; cancel changes nothing, confirm returns to school lunch without recipe or plannedAt', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-04');
    expect(screen.getByTestId('day-recipe-card')).toHaveTextContent('くまさんおにぎり弁当');
    await user.click(screen.getByTestId('day-action-school'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('11月4日の手作りお弁当の予定を取り消しますか？');
    await user.click(within(dialog).getByTestId('dialog-cancel-plan-cancel'));
    expect(app.stored().decisions['2026-11-04']).toMatchObject({ state: 'homemade-bento-planned', recipeId: 'rcp-kuma-onigiri' });
    await user.click(screen.getByTestId('day-action-school'));
    await user.click(within(await screen.findByRole('alertdialog')).getByTestId('dialog-cancel-plan-confirm'));
    await waitFor(() => expect(app.stored().decisions['2026-11-04']?.state).toBe('school-lunch-planned'));
    expect(app.stored().decisions['2026-11-04']).not.toHaveProperty('recipeId');
    expect(app.stored().decisions['2026-11-04']).not.toHaveProperty('plannedAt');
    expect(cell('2026-11-04')).toHaveAttribute('data-decision', 'school-lunch-planned');
  });

  it('US-E5-07/AC3 ticking 「園で予約済み（自分で記録）」 stores the parent\'s own record; the note says nothing is booked', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-11');
    await user.click(screen.getByTestId('check-reservation'));
    await waitFor(() => expect(app.stored().decisions['2026-11-11']).toMatchObject({ state: 'school-lunch-planned', reservationDoneExternally: true }));
    expect(screen.getByTestId('check-reservation')).toBeChecked();
    await user.click(screen.getByTestId('day-action-bento'));
    await screen.findByTestId('screen-recommend');
  });

  it('US-E5-08/AC1 US-E5-08/AC2 the お弁当の日 offers 「お弁当を計画する」 only; other no-lunch days offer no plan', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-20');
    expect(screen.getByTestId('day-action-plan-bento-day')).toHaveTextContent('お弁当を計画する');
    expect(screen.queryByTestId('day-action-later')).toBeNull();
    expect(screen.queryByTestId('day-action-school')).toBeNull();
    await user.click(screen.getByTestId('day-sheet-close'));
    await open(user, '2026-11-27');
    expect(screen.queryByTestId('day-plan')).toBeNull();
  });

  it('US-E10-02/AC6 a failed write shows 「保存できませんでした」, not the success toast, and the decision stays', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: NOV2 });
    await open(user, '2026-11-11');
    app.storage.failWrites = true;
    await user.click(screen.getByTestId('day-action-later'));
    await waitFor(() => expect(screen.getByTestId('banner-storage')).toBeInTheDocument());
    expect(screen.queryByTestId('toast')?.textContent ?? '').not.toContain('未定');
    expect(cell('2026-11-11')).toHaveAttribute('data-decision', 'school-lunch-planned');
  });
});

describe('US-E3-05 refresh conflicts in the calendar and the sheet (B7)', () => {
  /** FX-01 as version 2: 11-04 (planned) is now a 午前保育 day, 11-25 (planned) is no longer listed. */
  function conflicted(): BentoMinderStore {
    const s = clone(november());
    const confirmed = s.menus['2026-11']!.confirmed!;
    confirmed.version = 2;
    confirmed.days = confirmed.days.filter((d) => d.date !== '2026-11-04' && d.date !== '2026-11-25');
    confirmed.noLunchDays = [...confirmed.noLunchDays, { date: '2026-11-04', reason: 'no-lunch' as const, originalText: '午前保育（給食なし）', verification: { status: 'ok' as const } }].sort((a, b) => a.date.localeCompare(b.date));
    confirmed.changedDatesSincePrevious = ['2026-11-04', '2026-11-25'];
    s.decisions['2026-11-25'] = { ...s.decisions['2026-11-04']!, date: '2026-11-25', plannedAt: '2026-11-01T10:12:00+09:00' };
    return s;
  }

  it('US-E3-05/AC2 a plan on a date that became a no-lunch day stays planned, flagged, and the sheet offers only keep and clear', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: conflicted(), now: NOV2 });
    expect(cell('2026-11-04')).toHaveAttribute('data-decision', 'homemade-bento-planned');
    expect(cell('2026-11-04')).toHaveAttribute('data-flag', 'changed');
    expect(button('2026-11-04')).toHaveAccessibleName(/給食なし、手作りお弁当：くまさんおにぎり弁当、献立が変わりました/);
    expect(screen.getByTestId('upcoming-conflict-2026-11-04')).toHaveTextContent('献立が変わりました：11月4日（水）');
    await open(user, '2026-11-04');
    const sheet = screen.getByTestId('day-sheet');
    expect(within(sheet).getByTestId('day-banner-conflict')).toHaveTextContent('献立の更新で、この日は給食なしになりました。予定を確認してください。');
    expect(within(sheet).getByTestId('day-action-keep')).toHaveTextContent('このまま');
    expect(within(sheet).getByTestId('day-action-clear-plan')).toHaveTextContent('計画を取り消す');
    for (const absent of ['day-action-change-recipe', 'day-action-school', 'day-action-later', 'day-action-bento']) expect(within(sheet).queryByTestId(absent)).toBeNull();
    expect(app.stored().decisions['2026-11-04']).toMatchObject({ state: 'homemade-bento-planned' });
  });

  it('US-E3-05/AC7 「このまま」 acknowledges: the summary row goes, the marker stays, the plan is unchanged; 「計画を取り消す」 asks and then removes the record', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: conflicted(), now: NOV2 });
    await open(user, '2026-11-04');
    await user.click(screen.getByTestId('day-action-keep'));
    await waitFor(() => expect(app.stored().decisions['2026-11-04']?.acknowledgedMenuVersion).toBe(2));
    expect(app.stored().decisions['2026-11-04']).toMatchObject({ state: 'homemade-bento-planned', recipeId: 'rcp-kuma-onigiri' });
    expect(screen.queryByTestId('upcoming-conflict-2026-11-04')).toBeNull();
    expect(screen.getByTestId('day-banner-conflict')).toHaveTextContent('このままにしました。前日のお知らせもそのままです。');
    expect(cell('2026-11-04')).toHaveAttribute('data-flag', 'changed');
    await user.click(screen.getByTestId('day-action-clear-plan'));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('11月4日の手作りお弁当の計画を取り消しますか？');
    await user.click(within(dialog).getByTestId('dialog-clear-plan-confirm'));
    await waitFor(() => expect(app.stored().decisions['2026-11-04']).toBeUndefined());
    expect(cell('2026-11-04')).toHaveAttribute('data-decision', 'no-school-lunch');
    expect(screen.queryByTestId('day-plan')).toBeNull();
  });

  it('US-E3-05/AC6 a plan on a date the menu no longer lists is opened from the calendar with the removed sentence', async () => {
    const user = userEvent.setup();
    await renderApp({ store: conflicted(), now: NOV2 });
    expect(button('2026-11-25')).toHaveAccessibleName(/献立に記載なし、手作りお弁当：くまさんおにぎり弁当、献立が変わりました/);
    await open(user, '2026-11-25');
    expect(screen.getByTestId('day-banner-conflict')).toHaveTextContent('献立の更新で、この日は献立表に載っていません。予定を確認してください。');
  });

  it('US-E3-05/AC3 an override on a date whose dishes changed shows the changed line until the override is set again (US-E4-03/AC7)', async () => {
    const user = userEvent.setup();
    const s = clone(november());
    s.menus['2026-11']!.confirmed!.version = 2;
    s.menus['2026-11']!.confirmed!.changedDatesSincePrevious = ['2026-11-05'];
    const app = await renderApp({ store: s, now: NOV2 });
    expect(cell('2026-11-05')).toHaveAttribute('data-flag', 'changed');
    await open(user, '2026-11-05');
    expect(screen.getByTestId('day-banner-changed')).toHaveTextContent('献立が変わりました。評価を見直してください。');
    await user.click(screen.getByTestId('override-open'));
    await user.click(screen.getByTestId('override-option-mixed-uncertain'));
    await waitFor(() => expect(app.stored().overrides['2026-11-05']?.menuVersionAtSet).toBe(2));
    expect(screen.queryByTestId('day-banner-changed')).toBeNull();
  });
});

describe('US-E3-06 the next-month card', () => {
  it('US-E3-06/AC2 US-E3-06/AC6 from the 20th the card shows; hiding it lasts for the Tokyo day and persists', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: '2026-11-20T01:00:00Z' });
    expect(screen.getByTestId('card-menu-next')).toHaveTextContent('来月（12月）の献立を取り込みましょう');
    await user.click(screen.getByTestId('card-menu-next-dismiss'));
    await waitFor(() => expect(app.stored().nextMonthCardHiddenOn).toBe('2026-11-20'));
    expect(screen.queryByTestId('card-menu-next')).toBeNull();
  });

  it('US-E3-06/AC2 on the 19th there is no card; with the setting at 25 the card first shows on the 25th', async () => {
    await renderApp({ store: november(), now: '2026-11-19T01:00:00Z' });
    expect(screen.queryByTestId('card-menu-next')).toBeNull();
    document.body.innerHTML = '';
    const s = clone(november());
    s.settings.nextMonthPromptFromDay = 25;
    await renderApp({ store: s, now: '2026-11-24T01:00:00Z' });
    await screen.findByTestId('upcoming');
    expect(screen.queryByTestId('card-menu-next')).toBeNull();
    document.body.innerHTML = '';
    await renderApp({ store: s, now: '2026-11-25T01:00:00Z' });
    await screen.findByTestId('upcoming');
    expect(screen.getByTestId('card-menu-next')).toBeInTheDocument();
  });

  it('US-E3-06/AC3 a past month without a menu has no outdated card', async () => {
    await renderApp({ store: november(), now: NOV2, hash: '#/calendar/2026-10' });
    expect(screen.queryByTestId('menu-card-missing')).toBeNull();
  });
});

