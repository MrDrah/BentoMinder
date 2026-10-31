// Review / edit / confirm (US-E3-01…E3-04) in jsdom, on the FX-01 journey stand-in.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { stampOrigin } from '../../../src/domain/menu/extraction.ts';
import { recordExtraction } from '../../../src/domain/menu/store-ops.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/index.ts';
import type { Instant } from '../../../src/domain/time/jst.ts';
import { fx01Menu, profileOnly, renderApp } from '../helpers/app.tsx';

const NOW = Date.parse('2026-11-14T15:30:00Z') as Instant;
const URL_ = 'https://example-kinder.test/menu/2026-11.pdf';
const withPending = (menu = fx01Menu()): BentoMinderStore => recordExtraction(profileOnly(), stampOrigin(menu, { kind: 'url', url: URL_ })!, NOW, URL_);
const open = (store: BentoMinderStore = withPending(), hash = '#/review/2026-11') => renderApp({ store, hash });

describe('US-E3-01 review the extracted menu', () => {
  it('US-E3-01/AC1 every Mon–Fri of November, 「献立に記載なし」 for unlisted weekdays, 「給食なし」 for no-lunch days', async () => {
    await open();
    expect(await screen.findByTestId('screen-review')).toHaveTextContent('11月の献立を確認');
    expect(screen.getByTestId('review-day-2026-11-03')).toHaveTextContent('献立に記載なし');
    expect(screen.getByTestId('review-day-2026-11-27')).toHaveTextContent('給食なし');
    expect(screen.getByTestId('review-day-2026-11-14')).toBeInTheDocument();
    expect(screen.queryByTestId('review-day-2026-11-15')).toBeNull();
    expect(screen.getByTestId('review-day-2026-11-04')).toHaveTextContent('11月4日（水）');
  });

  it('US-E3-01/AC2 the summary counts 3 uncertain fields, each marked with an icon and text; 「次の要確認へ」 moves focus', async () => {
    const user = userEvent.setup();
    await open();
    expect(await screen.findByTestId('review-summary')).toHaveTextContent('確認が必要な項目：3件');
    expect(screen.getByTestId('review-dish-2026-11-05-0-uncertain')).toHaveTextContent('要確認');
    await user.click(screen.getByTestId('review-next-uncertain'));
    expect(screen.getByTestId('review-dish-2026-11-05-0')).toHaveFocus();
    await user.click(screen.getByTestId('review-next-uncertain'));
    expect(screen.getByTestId('review-dish-2026-11-18-2')).toHaveFocus();
  });

  it('US-E3-01/AC3 「元のPDFを見る」 opens the source URL in a new view', async () => {
    await open();
    const link = await screen.findByTestId('review-open-pdf');
    expect(link).toHaveAttribute('href', 'https://example-kinder.test/menu/2026-11.pdf');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('US-E3-01/AC4 a warning is shown above the days and confirm stays available', async () => {
    await open(withPending({ ...fx01Menu(), warnings: ['partial-extraction'] }));
    expect(await screen.findByTestId('banner-review-partial-extraction')).toHaveTextContent('一部の日だけ読み取れました。足りない日は入力してください。');
    expect(screen.getByTestId('review-confirm')).not.toHaveAttribute('aria-disabled');
  });

  it('US-E2-05/AC4 out-of-month entries are listed under 「対象月以外の日付（取り込みません）」', async () => {
    await open(withPending(fx01Menu('2026-11', 'hand-out-of-month')));
    const list = await screen.findByTestId('review-out-of-month');
    expect(list).toHaveTextContent('対象月以外の日付（取り込みません）');
    expect(list).toHaveTextContent('12月1日（火）');
  });

  it('US-E2-05/AC5 a weekday mismatch flags the whole day and shows the printed weekday', async () => {
    await open(withPending(fx01Menu('2026-11', 'hand-unflagged', 'fixture-menu-2026-11-wdmismatch')));
    const day = await screen.findByTestId('review-day-2026-11-04');
    expect(day).toHaveClass('is-uncertain');
    expect(day).toHaveTextContent('日付と曜日が合いません（献立表では「木」）');
  });

  it('US-E2-05/AC6 a duplicate date is one entry with all items, flagged', async () => {
    await open(withPending(fx01Menu('2026-11', 'hand-duplicate')));
    const day = await screen.findByTestId('review-day-2026-11-05');
    expect(within(day).getAllByRole('textbox')).toHaveLength(5);
    expect(day).toHaveTextContent('同じ日付が複数あったため、1つにまとめました');
  });
});

describe('US-E3-02 edit extracted items', () => {
  it('US-E3-02/AC1 editing a dish makes it parent-edited and removes its flag', async () => {
    const user = userEvent.setup();
    await open();
    const input = await screen.findByTestId('review-dish-2026-11-05-0');
    await user.clear(input);
    await user.type(input, 'さばのみそ煮');
    expect(input).toHaveAttribute('data-verification', 'parent-edited');
    expect(screen.getByTestId('review-summary')).toHaveTextContent('確認が必要な項目：2件');
  });

  it('US-E3-02/AC2 add and remove dishes', async () => {
    const user = userEvent.setup();
    await open();
    const day = await screen.findByTestId('review-day-2026-11-12');
    const before = within(day).getAllByRole('textbox').length;
    await user.click(screen.getByTestId('review-add-2026-11-12'));
    await user.type(screen.getByTestId(`review-dish-2026-11-12-${before}`), 'ポテトサラダ');
    expect(within(day).getAllByRole('textbox')).toHaveLength(before + 1);
    await user.click(screen.getByTestId(`review-remove-2026-11-12-${before}`));
    expect(within(day).getAllByRole('textbox')).toHaveLength(before);
  });

  it('US-E3-02/AC3 US-E3-02/AC6 「給食なしの日にする」: reason preselected, wording follows it, restorable', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(await screen.findByTestId('review-nolunch-2026-11-26'));
    expect(screen.getByTestId('radio-nolunch-2026-11-26-no-lunch')).toBeChecked();
    expect(screen.getByTestId('review-nolunch-text-2026-11-26')).toHaveValue('給食なし');
    await user.click(screen.getByTestId('radio-nolunch-2026-11-26-bento-day'));
    expect(screen.getByTestId('review-nolunch-text-2026-11-26')).toHaveValue('お弁当の日');
    expect(screen.getByTestId('review-day-2026-11-26')).toHaveTextContent(/この日の料理\d+品は、確定するまで元に戻せます/);
    await user.clear(screen.getByTestId('review-nolunch-text-2026-11-26'));
    expect(screen.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('review-confirm-hint')).toHaveTextContent('入力の誤りを直すと確定できます');
    await user.type(screen.getByTestId('review-nolunch-text-2026-11-26'), '行事');
    await user.click(screen.getByTestId('radio-nolunch-2026-11-26-closed'));
    expect(screen.getByTestId('review-nolunch-text-2026-11-26')).toHaveValue('行事');
    await user.click(screen.getByTestId('review-restore-2026-11-26'));
    expect(screen.getByTestId('review-dish-2026-11-26-0')).toBeInTheDocument();
  });

  it('US-E3-02/AC4 41 characters show 「料理名は1〜40文字で入力してください」 and disable confirm', async () => {
    const user = userEvent.setup();
    await open();
    const input = await screen.findByTestId('review-dish-2026-11-02-0');
    await user.clear(input);
    await user.type(input, 'あ'.repeat(41));
    expect(screen.getByTestId('review-dish-2026-11-02-0-error')).toHaveTextContent('料理名は1〜40文字で入力してください');
    expect(screen.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
    await user.type(input, '{Backspace}');
    expect(screen.queryByTestId('review-dish-2026-11-02-0-error')).toBeNull();
  });

  it('US-E3-02/AC5 at 12 dishes 「料理を追加」 is disabled with 「1日12品まで」', async () => {
    const user = userEvent.setup();
    await open(undefined, '#/review/2026-11?manual=1');
    for (let i = 0; i < 12; i += 1) await user.click(await screen.findByTestId('review-add-2026-11-02'));
    expect(screen.getByTestId('review-add-2026-11-02')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('review-add-limit-2026-11-02')).toHaveTextContent('1日12品まで');
  });
});

describe('US-E3-03 confirm the menu (BR-12)', () => {
  it('US-E3-03/AC2 uncertain fields ask first; 「戻る」 stores nothing', async () => {
    const user = userEvent.setup();
    const app = await open();
    const before = app.storage.data.get('bentominder.state');
    await user.click(await screen.findByTestId('review-confirm'));
    expect(screen.getByTestId('dialog-uncertain')).toHaveTextContent('確認が必要な項目が3件あります。このまま確定しますか？');
    await user.click(screen.getByTestId('dialog-uncertain-cancel'));
    expect(screen.queryByTestId('dialog-uncertain')).toBeNull();
    expect(app.storage.data.get('bentominder.state')).toBe(before);
  });

  it('US-E3-03/AC1 US-E3-03/AC2 「確定する」 stores the ConfirmedMenu with uncertain-accepted fields and opens the calendar', async () => {
    const user = userEvent.setup();
    const app = await open();
    await user.click(await screen.findByTestId('review-confirm'));
    await user.click(screen.getByTestId('dialog-uncertain-confirm'));
    expect(await screen.findByTestId('screen-calendar')).toBeInTheDocument();
    expect(screen.getByTestId('cal-title')).toHaveTextContent('2026年11月');
    const menu = app.stored().menus['2026-11']!;
    expect(menu.confirmed).toMatchObject({ month: '2026-11', version: 1, extractionId: menu.extractions[0]!.id });
    expect(menu.pendingReviewExtractionId).toBeUndefined();
    expect(menu.confirmed!.days.find((d) => d.date === '2026-11-05')!.items[0]!.verification.status).toBe('uncertain-accepted');
    expect(screen.getByTestId('toast')).toHaveTextContent('11月の献立を確定しました');
    expect(Object.keys(app.stored().decisions)).toEqual([]);
  });

  it('US-E3-03/AC4 「このままにする」 accepts one field and the count drops', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(await screen.findByTestId('review-accept-2026-11-18-item-2'));
    expect(screen.getByTestId('review-summary')).toHaveTextContent('確認が必要な項目：2件');
  });

  it('US-E3-03/AC5 US-E3-03/AC3 leaving asks; 「確認を続ける」 keeps edits, 「中断する」 discards them and the calendar offers the pending review', async () => {
    const user = userEvent.setup();
    const app = await open();
    const before = app.storage.data.get('bentominder.state');
    const input = await screen.findByTestId('review-dish-2026-11-05-0');
    await user.clear(input);
    await user.type(input, 'さばのみそ煮');
    await user.click(screen.getByTestId('topbar-back'));
    expect(await screen.findByTestId('dialog-leave-review')).toHaveTextContent('確認を中断しますか？');
    await user.click(screen.getByTestId('dialog-leave-review-cancel'));
    expect(screen.getByTestId('review-dish-2026-11-05-0')).toHaveValue('さばのみそ煮');
    await user.click(screen.getByTestId('topbar-back'));
    await user.click(await screen.findByTestId('dialog-leave-review-confirm'));
    expect(await screen.findByTestId('card-menu-pending')).toHaveTextContent('確認待ちの献立があります');
    // Discarding writes no menu data. The calendar may log a due reminder as shown (M4), so compare the data, not the whole document.
    const data = (raw: string | undefined) => {
      const { menus, decisions, overrides, profile } = JSON.parse(raw ?? 'null') as Record<string, unknown>;
      return { menus, decisions, overrides, profile };
    };
    expect(data(app.storage.data.get('bentominder.state'))).toEqual(data(before));
    await user.click(screen.getByTestId('card-menu-pending-action'));
    expect(await screen.findByTestId('review-dish-2026-11-05-0')).toHaveValue('さばのみそに');
  });

  it('US-E10-02/AC6 a failed write shows 「保存できませんでした。」 and never the confirmed toast', async () => {
    const user = userEvent.setup();
    const app = await open();
    app.storage.failWrites = true;
    await user.click(await screen.findByTestId('review-accept-2026-11-05-item-0'));
    await user.click(screen.getByTestId('review-accept-2026-11-18-item-2'));
    await user.click(screen.getByTestId('review-accept-2026-11-25-item-0'));
    await user.click(screen.getByTestId('review-confirm'));
    expect(await screen.findByTestId('toast')).toHaveTextContent('保存できませんでした。もう一度お試しください。');
    expect(screen.getByTestId('screen-review')).toBeInTheDocument();
    expect(app.stored().menus['2026-11']!.confirmed).toBeNull();
  });
});

describe('US-E3-04 manual entry', () => {
  it('US-E3-04/AC2 an empty manual menu cannot be confirmed', async () => {
    await open(profileOnly(), '#/review/2026-11?manual=1');
    expect(await screen.findByTestId('screen-review')).toHaveTextContent('11月の献立を入力');
    expect(screen.getByTestId('review-confirm')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('review-confirm-hint')).toHaveTextContent('少なくとも1日分を入力してください');
  });

  it('US-E3-04/AC1 entered dishes are stored parent-entered without an extraction', async () => {
    const user = userEvent.setup();
    const app = await open(profileOnly(), '#/review/2026-11?manual=1');
    await user.click(await screen.findByTestId('review-add-2026-11-02'));
    await user.type(screen.getByTestId('review-dish-2026-11-02-0'), 'カレーライス');
    await user.click(screen.getByTestId('review-confirm'));
    await screen.findByTestId('screen-calendar');
    await waitFor(() => expect(app.stored().menus['2026-11']?.confirmed?.extractionId).toBeNull());
    expect(app.stored().menus['2026-11']!.confirmed!.days[0]!.items[0]).toMatchObject({ text: 'カレーライス', verification: { status: 'parent-entered' } });
  });
});
