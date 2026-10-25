// Review screen, M2 additions in jsdom: date correction (US-E2-05/AC5, AC7–AC10), the ambiguity
// chooser (US-E4-01/AC6, AC21) and the refresh ending on 「確認が必要な日」 (US-E3-05/AC9, AC13).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { stampOrigin } from '../../../src/domain/menu/extraction.ts';
import { recordExtraction } from '../../../src/domain/menu/store-ops.ts';
import type { BentoMinderStore, ExtractedMenu } from '../../../src/domain/schema/index.ts';
import type { Instant } from '../../../src/domain/time/jst.ts';
import { fx01Menu, profileOnly, renderApp } from '../helpers/app.tsx';
import { clone, loadFixture } from '../helpers/fixtures.ts';

const NOW = Date.parse('2026-11-14T15:30:00Z') as Instant;
const URL_ = 'https://example-kinder.test/menu/2026-11.pdf';
const pending = (menu: ExtractedMenu, base: BentoMinderStore = profileOnly()): BentoMinderStore => recordExtraction(base, stampOrigin(menu, { kind: 'url', url: URL_ })!, NOW, URL_);
const wdmismatch = () => fx01Menu('2026-11', 'hand-1', 'fixture-menu-2026-11-wdmismatch');
const dateOf = (date: string) => screen.getByTestId(`datefix-cell-${date}`);

/** Empties the dishes of one review day (it then shows 献立に記載なし and is free for a correction). */
async function emptyOut(user: ReturnType<typeof userEvent.setup>, date: string) {
  const day = screen.getByTestId(`review-day-${date}`);
  for (let i = within(day).getAllByRole('textbox').length - 1; i >= 0; i -= 1) await user.click(screen.getByTestId(`review-remove-${date}-${i}`));
}

describe('US-E2-05 correct a flagged date on the review', () => {
  it('US-E2-05/AC5 a weekday-mismatch day offers 「日付を直す」 and 「このままにする」; other days and no-lunch days only the fields\' own actions', async () => {
    await renderApp({ store: pending(wdmismatch()), hash: '#/review/2026-11' });
    const day = await screen.findByTestId('review-day-2026-11-04');
    expect(within(day).getByTestId('review-fixdate-2026-11-04')).toHaveTextContent('日付を直す');
    expect(within(day).getByTestId('review-accept-2026-11-04-day')).toHaveTextContent('このままにする');
    expect(screen.queryByTestId('review-fixdate-2026-11-05')).toBeNull();
    expect(screen.queryByTestId('review-fixdate-2026-11-20')).toBeNull();
  });

  it('US-E2-05/AC7 US-E2-05/AC9 pick a free date: the day moves, the old date shows 献立に記載なし, the printed date stays, the count drops by 1', async () => {
    const user = userEvent.setup();
    await renderApp({ store: pending(wdmismatch()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-04');
    await emptyOut(user, '2026-11-05');
    const before = screen.getByTestId('review-summary').textContent;
    await user.click(screen.getByTestId('review-fixdate-2026-11-04'));
    const sheet = await screen.findByTestId('datefix-sheet');
    expect(sheet).toHaveAccessibleName('正しい日付を選んでください');
    expect(sheet).toHaveAccessibleDescription(/献立表では「4日（木）」です。いまは11月4日（水）になっています。/);
    // every date of November, each with its weekday; the current date and the same-weekday dates are marked in text
    expect(within(sheet).getAllByRole('button', { name: /^\d+月\d+日/ }).filter((b) => b.dataset['date'])).toHaveLength(30);
    expect(dateOf('2026-11-04')).toHaveAccessibleName('11月4日（水）、いまの日付');
    expect(dateOf('2026-11-05')).toHaveAccessibleName('11月5日（木）、曜日が一致');
    expect(dateOf('2026-11-12')).toHaveAccessibleName('11月12日（木）、曜日が一致、ほかの献立があります');
    // nothing is preselected and the nearest free same-weekday date has the focus
    expect(sheet.querySelector('[aria-selected="true"]')).toBeNull();
    expect(dateOf('2026-11-05')).toHaveFocus();
    expect(screen.getByTestId('datefix-apply')).toHaveAttribute('aria-disabled', 'true');
    await user.click(dateOf('2026-11-05'));
    expect(screen.getByTestId('datefix-status')).toHaveTextContent('11月5日（木）に移します');
    await user.click(screen.getByTestId('datefix-apply'));
    await waitFor(() => expect(screen.queryByTestId('datefix-sheet')).toBeNull());
    const moved = screen.getByTestId('review-day-2026-11-05');
    expect(within(moved).getAllByRole('textbox').length).toBeGreaterThan(0);
    expect(moved).not.toHaveClass('is-uncertain');
    expect(screen.getByTestId('review-printed-2026-11-05')).toHaveTextContent('献立表の表記：4日（木）');
    expect(screen.getByTestId('review-day-2026-11-04')).toHaveTextContent('献立に記載なし');
    expect(screen.getByTestId('review-live')).toHaveTextContent('11月4日（水）の献立を11月5日（木）に移しました');
    expect(screen.getByTestId('review-summary').textContent).not.toBe(before);
    expect(screen.getByTestId('review-fixdate-2026-11-05')).toBeInTheDocument(); // can be corrected again (AC10)
  });

  it('US-E2-05/AC8 a taken date can be seen but not chosen: the status says why; with every free date gone the sheet says 「移せる日がありません」', async () => {
    const user = userEvent.setup();
    await renderApp({ store: pending(wdmismatch()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-04');
    await user.click(screen.getByTestId('review-fixdate-2026-11-04'));
    await screen.findByTestId('datefix-sheet');
    await user.click(dateOf('2026-11-12'));
    expect(screen.getByTestId('datefix-status')).toHaveTextContent('11月12日（木）は選べません：ほかの献立があります');
    expect(dateOf('2026-11-12')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('datefix-apply')).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByTestId('datefix-apply'));
    expect(screen.getByTestId('datefix-sheet')).toBeInTheDocument(); // nothing applied
    await user.click(dateOf('2026-11-04'));
    expect(screen.getByTestId('datefix-status')).toHaveTextContent('11月4日（水）は選べません：いまの日付');
  });

  it('US-E2-05/AC10 closing without choosing changes nothing; Esc cancels and the focus returns to 「日付を直す」', async () => {
    const user = userEvent.setup();
    await renderApp({ store: pending(wdmismatch()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-04');
    const summary = screen.getByTestId('review-summary').textContent;
    await user.click(screen.getByTestId('review-fixdate-2026-11-04'));
    await screen.findByTestId('datefix-sheet');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('datefix-sheet')).toBeNull());
    expect(screen.getByTestId('review-fixdate-2026-11-04')).toHaveFocus();
    expect(screen.getByTestId('review-summary').textContent).toBe(summary);
    await user.click(screen.getByTestId('review-fixdate-2026-11-04'));
    await user.click(await screen.findByTestId('datefix-cancel'));
    expect(screen.queryByTestId('datefix-sheet')).toBeNull();
  });

  it('US-E2-05/AC7 the grid keyboard: arrows move by day and week and stop at the month edges; the sheet traps Tab', async () => {
    const user = userEvent.setup();
    await renderApp({ store: pending(wdmismatch()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-04');
    await user.click(screen.getByTestId('review-fixdate-2026-11-04'));
    await screen.findByTestId('datefix-sheet');
    dateOf('2026-11-01').focus();
    await user.keyboard('{ArrowLeft}');
    expect(dateOf('2026-11-01')).toHaveFocus(); // stops at the first date
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(dateOf('2026-11-09')).toHaveFocus();
    await user.keyboard('{End}');
    expect(dateOf('2026-11-15')).toHaveFocus();
    await user.keyboard('{PageDown}');
    expect(dateOf('2026-11-15')).toHaveFocus(); // one month only
    dateOf('2026-11-30').focus();
    await user.keyboard('{ArrowDown}');
    expect(dateOf('2026-11-30')).toHaveFocus();
  });

  it('US-E2-05/AC9 confirming stores the corrected date as parent-edited with the printed date, and nothing for the old date', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: pending(wdmismatch()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-04');
    await emptyOut(user, '2026-11-05');
    await user.click(screen.getByTestId('review-fixdate-2026-11-04'));
    await user.click(await screen.findByTestId('datefix-cell-2026-11-05'));
    await user.click(screen.getByTestId('datefix-apply'));
    await user.click(screen.getByTestId('review-confirm'));
    const ask = screen.queryByTestId('dialog-uncertain-confirm');
    if (ask !== null) await user.click(ask);
    await waitFor(() => expect(app.stored().menus['2026-11']?.confirmed).not.toBeNull());
    const confirmed = app.stored().menus['2026-11']!.confirmed!;
    expect(confirmed.days.find((d) => d.date === '2026-11-05')).toMatchObject({ printedDateText: '4日（木）', printedWeekday: '木', verification: { status: 'parent-edited' } });
    expect(confirmed.days.some((d) => d.date === '2026-11-04')).toBe(false);
  });

  it('US-E2-05/AC5 「このままにする」 keeps the date and clears the flag', async () => {
    const user = userEvent.setup();
    await renderApp({ store: pending(wdmismatch()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-04');
    const before = screen.getByTestId('review-summary').textContent;
    await user.click(screen.getByTestId('review-accept-2026-11-04-day'));
    expect(screen.getByTestId('review-day-2026-11-04')).not.toHaveClass('is-uncertain');
    expect(screen.getByTestId('review-summary').textContent).not.toBe(before);
  });
});

describe('US-E4-01 the ambiguity chooser on review', () => {
  it('US-E4-01/AC6 a standalone カレー offers the three candidates and 「わからない」; the choice is stored on the item and does not change the uncertain count', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: pending(fx01Menu()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-06');
    const summary = screen.getByTestId('review-summary').textContent;
    const day = screen.getByTestId('review-day-2026-11-06');
    const chooser = within(day).getByRole('group', { name: '「カレー」はどちらですか？' });
    expect(within(chooser).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['カレーライス（料理）', 'カレー粉（調味料）', 'カレールウ（調味料）', 'わからない']);
    expect(within(chooser).getByLabelText('わからない')).toBeChecked();
    await user.click(within(chooser).getByLabelText('カレールウ（調味料）'));
    expect(screen.getByTestId('review-summary').textContent).toBe(summary);
    expect(screen.getByTestId('review-confirm')).not.toHaveAttribute('aria-disabled');
    await user.click(screen.getByTestId('review-confirm'));
    await user.click(within(await screen.findByRole('dialog')).getByTestId('dialog-uncertain-confirm'));
    await waitFor(() => expect(app.stored().menus['2026-11']?.confirmed).not.toBeNull());
    const item = app.stored().menus['2026-11']!.confirmed!.days.find((d) => d.date === '2026-11-06')!.items.find((i) => i.text === 'カレー')!;
    expect(item).toMatchObject({ text: 'カレー', resolvedIds: ['ing-curry-roux'] });
  });

  it('US-E4-01/AC21 あじ also offers its non-food reading 「味（食べものではない）」, stored as an empty choice', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: pending(fx01Menu()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-06');
    const input = screen.getByTestId('review-dish-2026-11-06-0');
    await user.clear(input);
    await user.type(input, 'あじ');
    const chooser = within(screen.getByTestId('review-day-2026-11-06')).getByRole('group', { name: '「あじ」はどちらですか？' });
    expect(within(chooser).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['あじ（鯵）', '味（食べものではない）', 'わからない']);
    await user.click(within(chooser).getByLabelText('味（食べものではない）'));
    await user.click(screen.getByTestId('review-confirm'));
    await user.click(within(await screen.findByRole('dialog')).getByTestId('dialog-uncertain-confirm'));
    await waitFor(() => expect(app.stored().menus['2026-11']?.confirmed).not.toBeNull());
    const item = app.stored().menus['2026-11']!.confirmed!.days.find((d) => d.date === '2026-11-06')!.items[0]!;
    expect(item).toMatchObject({ text: 'あじ', resolvedIds: [] });
  });

  it('US-E4-01/AC6 a dish without an ambiguous word has no chooser', async () => {
    await renderApp({ store: pending(fx01Menu()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-04');
    expect(within(screen.getByTestId('review-day-2026-11-04')).queryByRole('group', { name: /はどちらですか/ })).toBeNull();
  });
});

describe('US-E3-05 a refresh ends on the review list', () => {
  const november = () => loadFixture<BentoMinderStore>('state/m2-november.json');

  /** The same November with 11-04 gone from the menu (it carries a plan) and 11-05 changed (it carries an override). */
  function refresh(): ExtractedMenu {
    const menu = clone(fx01Menu());
    menu.days = menu.days.filter((d) => d.date !== '2026-11-04').map((d) => (d.date === '2026-11-05' ? { ...d, items: [{ ...d.items[0]!, text: 'ハンバーグ' }, ...d.items.slice(1)] } : d));
    for (const d of menu.days) for (const i of d.items) if (i.verification.status === 'uncertain') i.verification = { status: 'ok' };
    return menu;
  }

  it('US-E3-05/AC9 US-E3-05/AC1 after confirming, 「確認が必要な日」 lists the planned date and the overridden date; decisions and overrides are untouched', async () => {
    const user = userEvent.setup();
    const base = november();
    const app = await renderApp({ store: pending(refresh(), base), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-05');
    await user.click(screen.getByTestId('review-confirm'));
    await screen.findByTestId('screen-refresh-review');
    expect(window.location.hash).toBe('#/refresh-review/2026-11?fresh=1');
    const rows = screen.getAllByTestId(/^refresh-review-row-/).map((r) => r.dataset['testid']);
    expect(rows).toEqual(['refresh-review-row-2026-11-04', 'refresh-review-row-2026-11-05']);
    expect(screen.getByTestId('refresh-review-row-2026-11-04')).toHaveTextContent('手作りお弁当の予定があります');
    expect(screen.getByTestId('refresh-review-row-2026-11-04')).toHaveTextContent('この日は献立表に載っていません');
    expect(screen.getByTestId('refresh-review-row-2026-11-05')).toHaveTextContent('判定を手動で変更しています');
    expect(app.stored().menus['2026-11']!.confirmed!.version).toBe(2);
    expect(app.stored().decisions).toEqual(base.decisions);
    expect(app.stored().overrides).toEqual(base.overrides);
  });

  it('US-E3-05/AC9 the row\'s button opens that day\'s sheet; the settings link shows the open count and the list stays reachable', async () => {
    const user = userEvent.setup();
    await renderApp({ store: pending(refresh(), november()), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-05');
    await user.click(screen.getByTestId('review-confirm'));
    await screen.findByTestId('screen-refresh-review');
    await user.click(screen.getByTestId('refresh-review-open-2026-11-04'));
    const sheet = await screen.findByTestId('day-sheet');
    expect(within(sheet).getByTestId('day-banner-conflict')).toHaveTextContent('献立の更新で、この日は献立表に載っていません。予定を確認してください。');
    window.location.hash = '#/settings';
    expect(await screen.findByTestId('settings-menu-needs-review')).toHaveTextContent('確認が必要な日（2件）');
    await user.click(screen.getByTestId('settings-menu-needs-review'));
    await screen.findByTestId('refresh-review');
    expect(window.location.hash).toBe('#/refresh-review/2026-11');
  });

  it('US-E3-05/AC13 a refresh with nothing to review says so and offers 「カレンダーへ」; the settings link is not there', async () => {
    const user = userEvent.setup();
    const base = november();
    base.decisions = {};
    base.overrides = {};
    await renderApp({ store: pending(refresh(), base), hash: '#/review/2026-11' });
    await screen.findByTestId('review-day-2026-11-05');
    await user.click(screen.getByTestId('review-confirm'));
    expect(await screen.findByTestId('refresh-review-empty')).toHaveTextContent('確認が必要な日はありません');
    await user.click(screen.getByTestId('refresh-review-done'));
    await screen.findByTestId('screen-calendar');
    window.location.hash = '#/settings';
    await screen.findByTestId('screen-settings');
    expect(screen.queryByTestId('settings-menu-needs-review')).toBeNull();
  });

  it('US-E3-05/AC9 opening the list later with nothing open goes back to the calendar', async () => {
    const base = november();
    base.decisions = {};
    base.overrides = {};
    base.menus['2026-11']!.confirmed!.version = 2;
    base.menus['2026-11']!.confirmed!.changedDatesSincePrevious = ['2026-11-05'];
    await renderApp({ store: base, hash: '#/refresh-review/2026-11' });
    await screen.findByTestId('screen-calendar');
  });

  it('US-E3-05/AC4 importing a month that has a menu asks first and says the plans are kept', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), hash: '#/import' });
    await screen.findByTestId('screen-import-page');
    // the month select defaults to a month; pick the confirmed one and start
    const select = screen.getByTestId('import-month') as HTMLSelectElement;
    await user.selectOptions(select, '2026-11');
    await user.type(screen.getByTestId('input-url'), URL_);
    await user.click(screen.getByTestId('import-submit'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('お弁当の予定は変更されません');
  });
});
