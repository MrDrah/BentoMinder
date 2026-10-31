// M4 slice B in jsdom: in-app reminders (US-E7-01, US-E7-02, US-E7-05), the today card (US-E7-03),
// reminder settings (US-E7-04, US-E7-06, US-E7-07/AC2), the theme (US-E8-05) and M3-D03.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../../src/i18n/en.ts';
import { ja } from '../../../src/i18n/ja.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/index.ts';
import { clone } from '../helpers/fixtures.ts';
import { renderApp } from '../helpers/app.tsx';
import { entry, HIMAWARI, jst, november, planOn } from './m4-fixtures.ts';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

const DAY_BEFORE_0304 = (extra = {}) => entry('day-before:2026-11-04', jst('2026-11-03 17:30'), jst('2026-11-04 00:00'), extra);
const WEEKLY_DONE = entry('weekly:2026-11-02', jst('2026-11-01 14:00'), jst('2026-11-09 00:00'), { shownAt: jst('2026-11-01 14:02'), dismissedAt: jst('2026-11-01 14:05') });
const noLow = (s: BentoMinderStore) => {
  if (s.profile !== null) s.profile.dislikedIds = [];
  return s;
};
const banner = (id: string) => screen.findByTestId(id);

describe('US-E7-02 day-before reminder in the app', () => {
  it('US-E7-02/AC1 at 17:30 JST the planned day shows 「明日は手作りお弁当の日！…」 with the recipe; the undecided day shows none; shownAt is written once', async () => {
    const app = await renderApp({ store: november(), now: jst('2026-11-03 17:30') });
    const b = await banner('reminder-day-before-2026-11-04');
    expect(b).toHaveTextContent('明日は手作りお弁当の日！レシピを確認しましょう。');
    expect(within(b).getByTestId('reminder-recipe')).toHaveTextContent('ひまわり弁当');
    expect(screen.queryByTestId('reminder-day-before-2026-11-05')).toBeNull();
    await waitFor(() => expect(app.stored().reminderLog.find((e) => e.key === 'day-before:2026-11-04')?.shownAt).toBe('2026-11-03T17:30:00+09:00'));
    const writes = app.storage.writes;
    await new Promise((r) => setTimeout(r, 50));
    expect(app.storage.writes).toBe(writes); // idempotent: nothing more is written
    expect(app.stored().reminderLog.filter((e) => e.key === 'day-before:2026-11-04')).toHaveLength(1);
  });

  it('US-E7-02/AC2 the button opens the planned recipe; a recipe missing from the library opens the day sheet', async () => {
    await renderApp({ store: november(), now: jst('2026-11-03 17:30') });
    expect(await screen.findByTestId('reminder-cta')).toHaveAttribute('href', `#/recipe/${HIMAWARI}?date=2026-11-04`);
    expect(screen.getByTestId('reminder-cta')).toHaveTextContent('レシピを見る');
  });

  it('US-E7-02/AC2 when the recipe is missing the button goes to the day sheet', async () => {
    await renderApp({ store: november(), now: jst('2026-11-03 17:30'), services: { library: [] } });
    expect(await screen.findByTestId('reminder-cta')).toHaveAttribute('href', '#/day/2026-11-04');
  });

  it('US-E7-02/AC1 US-E1-05/AC2 a recipe with an allergen the child registered shows the danger row in the reminder', async () => {
    const s = november();
    if (s.profile !== null) s.profile.knownAllergenIds = ['alg-sesame'];
    await renderApp({ store: s, now: jst('2026-11-03 17:30') });
    expect(await screen.findByTestId('reminder-allergen')).toHaveTextContent('選んだレシピに登録したアレルゲン（ごま）が含まれています');
  });

  it('US-E7-02/AC7 a recipe changed after the due time and before dismissing: the reminder is kept and names the new recipe', async () => {
    const s = november();
    s.reminderLog = [DAY_BEFORE_0304({ shownAt: jst('2026-11-03 17:30') })];
    const d = s.decisions['2026-11-04'];
    if (d !== undefined) d.recipeNameSnapshot = { ja: 'くまさんサンド', en: 'Bear sandwich' };
    await renderApp({ store: s, now: jst('2026-11-03 20:00') });
    expect(await screen.findByTestId('reminder-recipe')).toHaveTextContent('くまさんサンド');
  });
});

describe('US-E7-05 no duplicate or expired reminders', () => {
  it('US-E7-05/AC1 a dismissed reminder is stored with dismissedAt and is not shown after a reload', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: jst('2026-11-03 17:30') });
    await banner('reminder-day-before-2026-11-04');
    await user.click(within(screen.getByTestId('reminder-day-before-2026-11-04')).getByTestId('reminder-dismiss'));
    await waitFor(() => expect(app.stored().reminderLog.find((e) => e.key === 'day-before:2026-11-04')?.dismissedAt).toBe('2026-11-03T17:30:00+09:00'));
    expect(screen.queryByTestId('reminder-day-before-2026-11-04')).toBeNull();
    expect(screen.queryByTestId('reminder-list')).toBeNull();
    document.body.innerHTML = '';
    await renderApp({ store: app.stored(), now: jst('2026-11-03 17:45') });
    await screen.findByTestId('today-card');
    expect(screen.queryByTestId('reminder-day-before-2026-11-04')).toBeNull();
  });

  it('US-E7-05/AC2 opened at 21:00 JST the missed reminder is shown labelled 「11月3日（火） 17:30のお知らせ」', async () => {
    await renderApp({ store: november(), now: jst('2026-11-03 21:00') });
    const b = await banner('reminder-day-before-2026-11-04');
    expect(within(b).getByTestId('reminder-missed')).toHaveTextContent('11月3日（火） 17:30のお知らせ');
  });

  it('US-E7-05/AC2 opened first at 07:00 on the day it expired: no reminder, and the today card shows the plan (US-E7-03/AC1)', async () => {
    await renderApp({ store: november(), now: jst('2026-11-04 07:00') });
    await screen.findByTestId('today-card');
    expect(screen.queryByTestId('reminder-list')).toBeNull();
    expect(screen.getByTestId('today-headline')).toHaveTextContent('今日は手作りお弁当：ひまわり弁当');
  });

  it('US-E7-05/AC4 shown but not dismissed: shown again on the next open with its original time, still without dismissedAt; expired at midnight', async () => {
    const s = november();
    s.reminderLog = [WEEKLY_DONE, DAY_BEFORE_0304({ shownAt: jst('2026-11-03 17:30') })];
    const app = await renderApp({ store: s, now: jst('2026-11-03 21:00') });
    const b = await banner('reminder-day-before-2026-11-04');
    expect(within(b).getByTestId('reminder-missed')).toHaveTextContent('11月3日（火） 17:30のお知らせ');
    expect(app.stored().reminderLog.find((e) => e.key === 'day-before:2026-11-04')?.dismissedAt).toBeUndefined();
    document.body.innerHTML = '';
    await renderApp({ store: s, now: jst('2026-11-04 00:00') });
    await screen.findByTestId('today-card');
    expect(screen.queryByTestId('reminder-list')).toBeNull();
  });

  it('US-E7-05/AC3 only the latest weekly reminder is shown; the day-before comes first and the weekly sits under 「ほかに1件のお知らせ」 (AC5 pattern)', async () => {
    const user = userEvent.setup();
    const s = november();
    s.reminderLog = [];
    const app = await renderApp({ store: s, now: jst('2026-11-03 21:00') });
    await banner('reminder-day-before-2026-11-04');
    expect(screen.getByTestId('reminder-list').querySelectorAll('[data-reminder-key]')).toHaveLength(1);
    const more = screen.getByTestId('reminder-more');
    expect(more).toHaveTextContent('ほかに1件のお知らせ');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByTestId('reminder-weekly-2026-11-02')).toBeInTheDocument();
    expect(screen.getByTestId('reminder-list').querySelectorAll('[data-reminder-key]')).toHaveLength(2);
    // none of them is dismissed until the parent dismisses it
    expect(app.stored().reminderLog.every((e) => e.dismissedAt === undefined)).toBe(true);
  });

  it('US-E7-05/AC1 dismissing moves focus to the next banner, then to the today card heading', async () => {
    const user = userEvent.setup();
    const s = november();
    s.reminderLog = [];
    await renderApp({ store: s, now: jst('2026-11-03 21:00') });
    const first = await banner('reminder-day-before-2026-11-04');
    await user.click(screen.getByTestId('reminder-more'));
    await user.click(within(first).getByTestId('reminder-dismiss'));
    await waitFor(() => expect(screen.getByTestId('reminder-weekly-2026-11-02')).toHaveFocus());
    await user.click(within(screen.getByTestId('reminder-weekly-2026-11-02')).getByTestId('reminder-dismiss'));
    await waitFor(() => expect(screen.getByTestId('today-headline')).toHaveFocus());
  });
});

describe('US-E7-01 weekly reminder', () => {
  const sunday = jst('2026-11-08 14:30'); // the week 11-09 … 11-15
  const weekly = (s: BentoMinderStore) => {
    s.reminderLog = [];
    return s;
  };

  it('US-E7-01/AC1 lists the low-preference undecided day with 「計画する」 and the planned day with its recipe', async () => {
    const s = weekly(november());
    planOn(s, '2026-11-13');
    await renderApp({ store: s, now: sunday });
    const b = await banner('reminder-weekly-2026-11-09');
    expect(within(b).getByText('週のまとめ（11月9日（月）〜11月15日（日））')).toBeInTheDocument();
    expect(within(b).getByTestId('reminder-weekly-item-2026-11-12')).toHaveTextContent('11月12日（木）苦手かも・未計画');
    expect(within(b).getByTestId('reminder-weekly-plan-2026-11-12')).toHaveTextContent('計画する');
    expect(within(b).getByTestId('reminder-weekly-item-2026-11-13')).toHaveTextContent('11月13日（金）手作りお弁当：ひまわり弁当');
  });

  it('US-E7-01/AC2 「計画する」 opens that day sheet and changes no decision', async () => {
    const user = userEvent.setup();
    const s = weekly(november());
    const app = await renderApp({ store: s, now: sunday });
    await user.click(await screen.findByTestId('reminder-weekly-plan-2026-11-12'));
    expect(await screen.findByTestId('day-sheet')).toHaveAttribute('data-date', '2026-11-12');
    expect(app.stored().decisions).toEqual(s.decisions);
  });

  it('US-E7-01/AC3 nothing to report: 「来週は手作りお弁当の予定はありません」', async () => {
    const s = noLow(weekly(november()));
    s.decisions = {};
    await renderApp({ store: s, now: sunday });
    expect(await banner('reminder-weekly-2026-11-09')).toHaveTextContent('来週は手作りお弁当の予定はありません');
  });

  it('US-E7-01/AC4 a week across a month boundary says 「12月の献立がまだありません」', async () => {
    const s = noLow(weekly(november()));
    s.decisions = {};
    await renderApp({ store: s, now: jst('2026-11-29 14:30') });
    expect(await screen.findByTestId('reminder-weekly-nomenu-2026-12')).toHaveTextContent('12月の献立がまだありません');
  });

  it('US-E7-01/AC5 a week with no menu at all: 「来週の献立がまだありません」 with 「献立を取り込む」', async () => {
    const s = weekly(november());
    await renderApp({ store: s, now: jst('2026-12-06 14:30') });
    const b = await banner('reminder-weekly-2026-12-07');
    expect(b).toHaveTextContent('来週の献立がまだありません');
    expect(within(b).getByTestId('reminder-import')).toHaveAttribute('href', '#/import');
    expect(within(b).getByTestId('reminder-import')).toHaveTextContent('献立を取り込む');
  });

  it('US-E8-03/AC1 the weekly range and items use the English date format in en', async () => {
    const user = userEvent.setup();
    await renderApp({ store: weekly(november()), now: sunday });
    await banner('reminder-weekly-2026-11-09');
    await user.click(screen.getByTestId('lang-toggle-en'));
    const b = await banner('reminder-weekly-2026-11-09');
    expect(within(b).getByText('Weekly summary (Mon, Nov 9 – Sun, Nov 15)')).toBeInTheDocument();
    expect(within(b).getByTestId('reminder-weekly-item-2026-11-12')).toHaveTextContent('Thu, Nov 12 might not enjoy · not planned');
  });
});

describe('US-E7-03 today card', () => {
  const card = () => screen.findByTestId('today-card');

  it('US-E7-03/AC1 homemade bento: 「今日は手作りお弁当：<recipe>」 with 「レシピを見る」 to the recipe', async () => {
    await renderApp({ store: november(), now: jst('2026-11-04 08:00') });
    await card();
    expect(screen.getByTestId('today-headline')).toHaveTextContent('今日は手作りお弁当：ひまわり弁当');
    expect(screen.getByTestId('today-cta')).toHaveTextContent('レシピを見る');
    expect(screen.getByTestId('today-cta')).toHaveAttribute('href', `#/recipe/${HIMAWARI}?date=2026-11-04`);
  });

  it('US-E7-03/AC1 US-E5-07/AC1 school lunch: 「今日は給食」 and the reservation note', async () => {
    await renderApp({ store: november(), now: jst('2026-11-05 08:00') });
    await card();
    expect(screen.getByTestId('today-headline')).toHaveTextContent('今日は給食');
    expect(screen.getByTestId('today-reservation-note')).toHaveTextContent('給食の予約は園の方法で行ってください（このアプリでは予約されません）');
  });

  it('US-E7-03/AC1 US-E7-03/AC5 not confirmed: 「今日の予定は未定です」; 「予定を決める」 opens the day sheet and changes no decision', async () => {
    const user = userEvent.setup();
    const s = november();
    const { recipeId, recipeNameSnapshot, recipeShortNameSnapshot, plannedAt, ...rest } = clone(s.decisions['2026-11-04']) as Record<string, unknown>;
    void [recipeId, recipeNameSnapshot, recipeShortNameSnapshot, plannedAt];
    s.decisions['2026-11-05'] = { ...rest, date: '2026-11-05', state: 'not-confirmed', history: [{ state: 'not-confirmed', at: jst('2026-11-02 09:00') }] } as never;
    const app = await renderApp({ store: s, now: jst('2026-11-05 08:00') });
    await card();
    expect(screen.getByTestId('today-headline')).toHaveTextContent('今日の予定は未定です');
    await user.click(screen.getByTestId('today-cta'));
    expect(await screen.findByTestId('day-sheet')).toHaveAttribute('data-date', '2026-11-05');
    expect(app.stored().decisions).toEqual(s.decisions);
  });

  it('US-E7-03/AC1 no school lunch: 「今日は給食がありません」; a bento day not planned also offers 「お弁当を計画する」', async () => {
    await renderApp({ store: november(), now: jst('2026-11-27 08:00') });
    await card();
    expect(screen.getByTestId('today-headline')).toHaveTextContent('今日は給食がありません');
    expect(screen.queryByTestId('today-cta')).toBeNull();
    document.body.innerHTML = '';
    await renderApp({ store: november(), now: jst('2026-11-20 08:00') });
    await screen.findByTestId('upcoming');
    expect(await screen.findByTestId('today-cta')).toHaveTextContent('お弁当を計画する');
  });

  it('US-E7-03/AC2 on a Saturday the card shows 「次の登園日：11月9日（月）給食」 and the whole card opens that day', async () => {
    await renderApp({ store: november(), now: jst('2026-11-07 09:00') });
    await card();
    expect(screen.getByTestId('today-headline')).toHaveTextContent('次の登園日：11月9日（月）給食');
    expect(screen.getByTestId('today-card')).toHaveAttribute('href', '#/day/2026-11-09');
    expect(screen.getByTestId('today-eyebrow')).toHaveTextContent('今日・11月7日（土）');
  });

  it('US-E7-03/AC4 no upcoming school day known: 「次の登園日は、献立を取り込むと表示されます」 with the import button', async () => {
    const s = november();
    const menu = s.menus['2026-11']?.confirmed;
    if (menu != null) menu.days = menu.days.filter((d) => d.date <= '2026-11-27');
    await renderApp({ store: s, now: jst('2026-11-28 09:00') });
    await card();
    expect(screen.getByTestId('today-headline')).toHaveTextContent('次の登園日は、献立を取り込むと表示されます');
    expect(screen.getByTestId('today-cta')).toHaveAttribute('href', '#/import');
  });

  it('US-E7-03/AC1 the English card follows US-E8-03 dates', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: jst('2026-11-07 09:00') });
    await card();
    await user.click(screen.getByTestId('lang-toggle-en'));
    await waitFor(() => expect(screen.getByTestId('today-headline')).toHaveTextContent('Next school day: Mon, Nov 9 School lunch'));
    expect(screen.getByTestId('today-eyebrow')).toHaveTextContent('Today · Sat, Nov 7');
  });
});

describe('US-E7-04 reminder settings', () => {
  const open = (store = november(), now = jst('2026-11-02 10:00')) => renderApp({ store, now, hash: '#/settings' });

  it('US-E7-04/AC1 defaults: 週のまとめ 「日曜日 14:00」 and 前日のお知らせ 「17:30」, both on', async () => {
    await open();
    expect(await screen.findByTestId('switch-weekly')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('switch-day-before')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('settings-weekly-value')).toHaveTextContent('日曜日 14:00');
    expect(screen.getByTestId('settings-day-before-value')).toHaveTextContent('17:30');
    expect(screen.getByTestId('switch-weekly')).toHaveAccessibleName('週のまとめ');
    expect(screen.getByTestId('switch-weekly')).toHaveTextContent('オン');
  });

  it('US-E7-04/AC3 times come in 15-minute steps 00:00 … 23:45 and the day is 日〜土', async () => {
    await open();
    const hours = await screen.findByTestId('select-weekly-hour');
    expect([...(hours as HTMLSelectElement).options].map((o) => o.value)).toEqual(Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')));
    expect([...(screen.getByTestId('select-day-before-minute') as HTMLSelectElement).options].map((o) => o.value)).toEqual(['00', '15', '30', '45']);
    expect([...(screen.getByTestId('select-weekly-day') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日']);
  });

  it('US-E7-04/AC2 changing to Saturday 20:00 and 19:15 stores the times and announces 「設定を保存しました」', async () => {
    const user = userEvent.setup();
    const app = await open();
    await user.selectOptions(await screen.findByTestId('select-weekly-day'), '6');
    await user.selectOptions(screen.getByTestId('select-weekly-hour'), '20');
    await user.selectOptions(screen.getByTestId('select-day-before-hour'), '19');
    await user.selectOptions(screen.getByTestId('select-day-before-minute'), '15');
    await waitFor(() => expect(app.stored().settings.reminders).toMatchObject({ weekly: { enabled: true, weekday: 6, time: '20:00' }, dayBefore: { enabled: true, time: '19:15' } }));
    expect(screen.getByTestId('settings-saved')).toHaveTextContent('設定を保存しました');
    expect(screen.getByTestId('settings-weekly-value')).toHaveTextContent('土曜日 20:00');
  });

  it('US-E7-04/AC2 reminders already shown are not shown again after a time change; the planner re-runs for the new time', async () => {
    const user = userEvent.setup();
    const s = november();
    s.reminderLog = [DAY_BEFORE_0304({ shownAt: jst('2026-11-03 17:30'), dismissedAt: jst('2026-11-03 17:31') })];
    const app = await renderApp({ store: s, now: jst('2026-11-03 20:30'), hash: '#/settings' });
    await user.selectOptions(await screen.findByTestId('select-day-before-hour'), '20');
    await waitFor(() => expect(app.stored().settings.reminders.dayBefore.time).toBe('20:30'));
    window.location.hash = '#/calendar';
    await screen.findByTestId('today-card');
    expect(screen.queryByTestId('reminder-day-before-2026-11-04')).toBeNull();
  });

  it('US-E7-04/AC4 switching off 前日のお知らせ shows no day-before reminder and the today card still works', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: jst('2026-11-03 18:00'), hash: '#/settings' });
    await user.click(await screen.findByTestId('switch-day-before'));
    await waitFor(() => expect(app.stored().settings.reminders.dayBefore.enabled).toBe(false));
    expect(screen.getByTestId('switch-day-before')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('switch-day-before')).toHaveTextContent('オフ');
    expect(screen.getByTestId('select-day-before-hour')).toBeDisabled();
    window.location.hash = '#/calendar';
    await screen.findByTestId('today-card');
    expect(screen.queryByTestId('reminder-day-before-2026-11-04')).toBeNull();
    expect(screen.getByTestId('today-headline')).toBeInTheDocument();
  });

  it('US-E7-04/AC3 a stored 「24:00」 or 「17:31」 is replaced by the default instead of failing the store', async () => {
    const s = november();
    s.settings.reminders.weekly.time = '24:00';
    s.settings.reminders.dayBefore.time = '17:31';
    await open(s);
    expect(await screen.findByTestId('settings-weekly-value')).toHaveTextContent('日曜日 14:00');
    expect(screen.getByTestId('settings-day-before-value')).toHaveTextContent('17:30');
  });
});

describe('US-E7-06 honest promises on the web, US-E7-07 Japan time label', () => {
  it('US-E7-06/AC1 the settings say reminders appear while the app is open or on the next open, in ja and en', async () => {
    const user = userEvent.setup();
    await renderApp({ store: november(), now: jst('2026-11-02 10:00'), hash: '#/settings' });
    expect(await screen.findByTestId('settings-web-limit')).toHaveTextContent('ブラウザ版では、アプリを開いているとき・次に開いたときにお知らせします。閉じている間は通知できません。');
    await user.click(screen.getByTestId('lang-toggle-en'));
    await waitFor(() => expect(screen.getByTestId('settings-web-limit')).toHaveTextContent("In the browser, reminders appear while the app is open or the next time you open it. They can't reach you while it's closed."));
  });

  it('US-E7-06/AC2 no catalog string claims reminders arrive while the app or browser is closed', () => {
    const hits: string[] = [];
    const claims = [/閉じていても/, /even when (it'?s |the app is |the browser is )?closed/i, /push notification/i, /プッシュ通知/, /background notification/i];
    for (const [lang, cat] of [['ja', ja], ['en', en]] as const) for (const [k, v] of Object.entries(cat)) if (claims.some((c) => c.test(v))) hits.push(`${lang} ${k}`);
    expect(hits).toEqual([]);
  });

  it('US-E7-07/AC2 on a device outside Tokyo the reminder times in settings carry 「（日本時間）」; in Tokyo they do not', async () => {
    const zone = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions');
    zone.mockReturnValue({ timeZone: 'Europe/Paris' } as Intl.ResolvedDateTimeFormatOptions);
    await renderApp({ store: november(), now: jst('2026-11-02 10:00'), hash: '#/settings' });
    expect(await screen.findByTestId('settings-weekly-value')).toHaveTextContent('日曜日 14:00 （日本時間）');
    expect(screen.getByTestId('settings-day-before-value')).toHaveTextContent('17:30 （日本時間）');
    document.body.innerHTML = '';
    zone.mockReturnValue({ timeZone: 'Asia/Tokyo' } as Intl.ResolvedDateTimeFormatOptions);
    await renderApp({ store: november(), now: jst('2026-11-02 10:00'), hash: '#/settings' });
    await screen.findByTestId('switch-weekly');
    expect(screen.getByTestId('settings-weekly-value')).not.toHaveTextContent('日本時間');
  });

  it('US-E7-07/AC2 a missed reminder label carries 「（日本時間）」 outside Tokyo', async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'America/Los_Angeles' } as Intl.ResolvedDateTimeFormatOptions);
    await renderApp({ store: november(), now: jst('2026-11-03 21:00') });
    expect(await screen.findByTestId('reminder-missed')).toHaveTextContent('11月3日（火） 17:30のお知らせ （日本時間）');
  });
});

describe('US-E8-05 display theme', () => {
  const html = document.documentElement;

  it('US-E8-05/AC1 a fresh install follows the device: settings show 「自動」 checked and no data-theme is set', async () => {
    await renderApp({ store: november(), now: jst('2026-11-02 10:00'), hash: '#/settings' });
    expect(await screen.findByTestId('radio-theme-auto')).toBeChecked();
    expect(html.hasAttribute('data-theme')).toBe(false);
    expect(screen.getByText('端末の設定に合わせます。')).toBeInTheDocument();
  });

  it('US-E8-05/AC2 「ダーク」 sets data-theme="dark" and is stored; it is still applied after a reload; 「自動」 returns to the device', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: november(), now: jst('2026-11-02 10:00'), hash: '#/settings' });
    await user.click(await screen.findByTestId('radio-theme-dark'));
    await waitFor(() => expect(app.stored().settings.theme).toBe('dark'));
    expect(html.getAttribute('data-theme')).toBe('dark');
    document.body.innerHTML = '';
    html.removeAttribute('data-theme');
    const again = await renderApp({ store: app.stored(), now: jst('2026-11-02 10:00'), hash: '#/settings' });
    await waitFor(() => expect(html.getAttribute('data-theme')).toBe('dark'));
    expect(await screen.findByTestId('radio-theme-dark')).toBeChecked();
    await user.click(screen.getByTestId('radio-theme-light'));
    await waitFor(() => expect(html.getAttribute('data-theme')).toBe('light'));
    await user.click(screen.getByTestId('radio-theme-auto'));
    await waitFor(() => expect(again.stored().settings.theme).toBe('auto'));
    expect(html.hasAttribute('data-theme')).toBe(false);
  });
});

describe('M3-D03 an empty allergen container is not rendered', () => {
  it('US-E6-04/AC1 a recipe with no allergens but a varies-by-product ingredient shows the warning and no empty allergen container', async () => {
    await renderApp({ store: november(), now: jst('2026-11-02 10:00'), hash: '#/recipe/rcp-delish-niwatori-hiyoko-onigiri' });
    expect(await screen.findByTestId('recipe-varies')).toHaveTextContent('市販品は');
    expect(screen.queryByTestId('recipe-allergens')).toBeNull();
  });

  it('US-E6-04/AC1 a recipe with allergens still shows its allergen lines', async () => {
    await renderApp({ store: november(), now: jst('2026-11-02 10:00'), hash: `#/recipe/${HIMAWARI}` });
    expect(await screen.findByTestId('recipe-allergens')).not.toBeEmptyDOMElement();
  });
});
