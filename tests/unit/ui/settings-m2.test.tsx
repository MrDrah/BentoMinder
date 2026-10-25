// Settings in M2 (jsdom): week start, the next-month prompt day, and the settings entry on every
// onboarding step (US-E1-01/AC6, D-M1-03 ruling).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { stampOrigin } from '../../../src/domain/menu/extraction.ts';
import { recordExtraction } from '../../../src/domain/menu/store-ops.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/index.ts';
import type { Instant } from '../../../src/domain/time/jst.ts';
import { fx01Menu, profileOnly, renderApp } from '../helpers/app.tsx';
import { loadFixture } from '../helpers/fixtures.ts';

const november = () => loadFixture<BentoMinderStore>('state/m2-november.json');
const NOV2 = '2026-11-02T01:00:00Z';

describe('US-E5-01/AC8 week start can be set to Sunday', () => {
  it('US-E5-01/AC8 the header becomes 日 月 火 水 木 金 土, Sunday 2026-11-01 is in the first column, the setting is stored; decisions are untouched', async () => {
    const user = userEvent.setup();
    const base = november();
    const app = await renderApp({ store: base, now: NOV2, hash: '#/settings' });
    expect(await screen.findByTestId('radio-week-start-monday')).toBeChecked();
    await user.click(screen.getByTestId('radio-week-start-sunday'));
    await waitFor(() => expect(app.stored().settings.weekStartsOn).toBe('sunday'));
    expect(screen.getByTestId('settings-saved')).toHaveTextContent('設定を保存しました');
    expect(app.stored().decisions).toEqual(base.decisions);
    expect(app.stored().overrides).toEqual(base.overrides);
    window.location.hash = '#/calendar';
    await screen.findByTestId('cal-grid');
    expect(screen.getByTestId('cal-grid')).toHaveAttribute('data-week-starts-on', 'sunday');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['日', '月', '火', '水', '木', '金', '土']);
    const firstRow = screen.getAllByRole('row')[1] as HTMLElement;
    expect(within(firstRow).getAllByRole('gridcell')[0]).toBe(screen.getByTestId('cal-cell-2026-11-01'));
    // the assessment and the decision of a day are the same as with a Monday start
    expect(screen.getByTestId('cal-cell-2026-11-04')).toHaveAttribute('data-decision', 'homemade-bento-planned');
  });

  it('US-E5-01/AC8 the setting is still applied after a reload', async () => {
    const store = november();
    store.settings.weekStartsOn = 'sunday';
    await renderApp({ store, now: NOV2 });
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('日');
  });
});

describe('US-E3-06/AC7 the prompt day is a setting from 1 to 28', () => {
  it('US-E3-06/AC7 offers 「毎月1日から」 … 「毎月28日から」, default 「毎月20日から」, and stores the choice', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: NOV2, hash: '#/settings' });
    const select = (await screen.findByTestId('select-prompt-day')) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(Array.from({ length: 28 }, (_, i) => `毎月${i + 1}日から`));
    expect(select.value).toBe('20');
    await user.selectOptions(select, '25');
    await waitFor(() => expect(app.stored().settings.nextMonthPromptFromDay).toBe(25));
  });
});

describe('US-E1-01/AC6 settings from every onboarding step', () => {
  it('US-E1-01/AC6 US-E10-03/AC2 on a fresh device step 1 offers 「設定」; the profile and menu sections are left out; export is disabled; back returns to step 1 with the typed answers kept', async () => {
    const user = userEvent.setup();
    await renderApp({ store: null });
    await screen.findByTestId('ob-step-1');
    await user.type(screen.getByTestId('input-nickname'), 'そら');
    await user.click(screen.getByTestId('chip-age-age-4-5'));
    await user.click(screen.getByTestId('topbar-settings'));
    await screen.findByTestId('screen-settings');
    expect(window.location.hash).toBe('#/settings?from=1');
    expect(screen.queryByTestId('settings-profile-edit')).toBeNull();
    expect(screen.queryByTestId('settings-menu-import')).toBeNull();
    expect(screen.getByTestId('data-export')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('書き出すデータがありません')).toBeInTheDocument();
    expect(screen.getByTestId('data-delete-all')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-back')).toHaveAccessibleName('お子さまのことに戻る');
    await user.click(screen.getByTestId('topbar-back'));
    await screen.findByTestId('ob-step-1');
    expect(screen.getByTestId('input-nickname')).toHaveValue('そら');
    expect(screen.getByTestId('chip-age-age-4-5')).toHaveAttribute('aria-checked', 'true');
  });

  it('US-E1-01/AC6 step 2 offers 「設定」 and back returns to step 2', async () => {
    const user = userEvent.setup();
    await renderApp({ store: profileOnly() });
    await screen.findByTestId('ob-step-2');
    await user.click(screen.getByTestId('topbar-settings'));
    await screen.findByTestId('screen-settings');
    expect(screen.getByTestId('settings-profile-edit')).toBeInTheDocument(); // a profile exists: the sections are shown
    await user.click(screen.getByTestId('topbar-back'));
    await screen.findByTestId('ob-step-2');
  });

  it('US-E1-01/AC6 step 3 offers 「設定」 and back returns to the review with its menu', async () => {
    const user = userEvent.setup();
    const NOW = Date.parse('2026-11-14T15:30:00Z') as Instant;
    const store = recordExtraction(profileOnly(), stampOrigin(fx01Menu(), { kind: 'url', url: 'https://example-kinder.test/m.pdf' })!, NOW, 'https://example-kinder.test/m.pdf');
    await renderApp({ store, hash: '#/onboarding/3' });
    await screen.findByTestId('ob-step-3');
    await user.click(screen.getByTestId('topbar-settings'));
    // leaving the review asks first (US-E3-03/AC5); the edits are discarded, the pending extraction stays
    await user.click(await screen.findByTestId('dialog-leave-review-confirm'));
    await screen.findByTestId('screen-settings');
    await user.click(screen.getByTestId('topbar-back'));
    await screen.findByTestId('ob-step-3');
    expect(screen.getByTestId('screen-review')).toBeInTheDocument();
  });

  it('US-E10-04/AC1 US-E1-06/AC3 「すべてのデータを削除」 works from the onboarding entry and starts over at step 1', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: profileOnly() });
    await screen.findByTestId('ob-step-2');
    await user.click(screen.getByTestId('topbar-settings'));
    await user.click(await screen.findByTestId('data-delete-all'));
    await user.click(within(await screen.findByRole('alertdialog')).getByTestId('dialog-delete-all-confirm'));
    await screen.findByTestId('ob-step-1');
    expect(app.storage.data.get('bentominder.state')).toBeUndefined();
  });

  it('US-E10-03/AC2 once a store is saved by 「次へ」 the export is enabled', async () => {
    const user = userEvent.setup();
    await renderApp({ store: null });
    await screen.findByTestId('ob-step-1');
    await user.click(screen.getByTestId('chip-age-age-4-5'));
    await user.click(screen.getByTestId('radio-allergy-none-known'));
    await user.click(screen.getByTestId('ob-next'));
    await screen.findByTestId('ob-step-2');
    await user.click(screen.getByTestId('topbar-settings'));
    await screen.findByTestId('screen-settings');
    expect(screen.getByTestId('data-export')).not.toHaveAttribute('aria-disabled');
  });
});
