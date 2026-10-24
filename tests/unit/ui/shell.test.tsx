// The M0 shell in jsdom: Japanese by default, one-tap English, persistence, every visible
// string localized, recovery screens, storage-failure banner.
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Storage } from '../../../src/domain/ports.ts';
import { createRepository } from '../../../src/domain/storage/repository.ts';
import { App } from '../../../src/ui/App.tsx';
import { AppProvider, appReducer } from '../../../src/ui/app-store.tsx';
import { storeV1 } from '../helpers/fixtures.ts';
import { fixedClock, memoryStorage } from '../helpers/memory-storage.ts';

const clock = fixedClock('2026-11-14T15:30:00Z'); // 2026-11-15 00:30 JST
const DEVICE_ID = '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d';

async function renderApp(storage: Storage = memoryStorage(), hash = '') {
  window.location.hash = hash;
  const repository = createRepository(storage, clock);
  const utils = render(
    <AppProvider repository={repository} clock={clock} newDeviceId={() => DEVICE_ID}>
      <App />
    </AppProvider>,
  );
  await screen.findByTestId(/^screen-(calendar|newer-data|corrupt-data|not-found|day|recipe|recipes|settings|onboarding)$/);
  return utils;
}

const JAPANESE = /[぀-ヿ㐀-鿿＀-￯]/;

function visibleJapanese(root: HTMLElement): string[] {
  const texts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const text = n.textContent ?? '';
    const lang = n.parentElement?.closest('[lang]')?.getAttribute('lang');
    if (JAPANESE.test(text) && lang !== 'ja') texts.push(text);
  }
  const labels = [...root.querySelectorAll('[aria-label]')]
    .filter((el) => el.closest('[lang]')?.getAttribute('lang') !== 'ja')
    .map((el) => el.getAttribute('aria-label') ?? '')
    .filter((l) => JAPANESE.test(l));
  return [...texts, ...labels];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('US-E8-01 Japanese by default, one-tap English', () => {
  it('US-E8-01/AC1 opens in Japanese with <html lang="ja"> whatever the browser language', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    await renderApp();
    expect(document.documentElement.lang).toBe('ja');
    expect(screen.getByTestId('lang-toggle-ja')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('cal-title')).toHaveTextContent('2026年11月');
    expect(screen.getByRole('button', { name: '次の月' })).toBeInTheDocument();
  });

  it('US-E8-01/AC2 the toggle is in the calendar app bar and switches everything to EN without reload', async () => {
    const user = userEvent.setup();
    await renderApp();
    const toggle = within(screen.getByTestId('appbar-lang')).getByRole('radiogroup', { name: '表示言語' });
    await user.click(within(toggle).getByTestId('lang-toggle-en'));
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByTestId('cal-title')).toHaveTextContent('November 2026');
    expect(screen.getByRole('radiogroup', { name: 'Display language' })).toBeInTheDocument();
    await user.click(screen.getByTestId('lang-toggle-ja'));
    expect(document.documentElement.lang).toBe('ja');
  });

  it('US-E8-01/AC2 the toggle is reachable on other screens and supports arrow keys', async () => {
    const user = userEvent.setup();
    await renderApp(memoryStorage(), '#/settings');
    expect(screen.getByTestId('topbar-title')).toHaveTextContent('設定');
    screen.getByTestId('lang-toggle-ja').focus();
    await user.keyboard('{ArrowRight}');
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByTestId('lang-toggle-en')).toHaveFocus();
    expect(screen.getByTestId('topbar-title')).toHaveTextContent('Settings');
  });

  it('US-E8-01/AC3 the language choice persists across a reload', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const first = await renderApp(storage);
    await user.click(screen.getByTestId('lang-toggle-en'));
    await vi.waitFor(() => expect(storage.data.has('bentominder.state')).toBe(true));
    first.unmount();
    document.documentElement.lang = 'ja';
    await renderApp(storage);
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByTestId('cal-title')).toHaveTextContent('November 2026');
  });
});

describe('US-E8-02/AC2 no hard-coded strings', () => {
  it.each(['', '#/calendar/2027-01', '#/settings', '#/recipes', '#/day/2026-11-05', '#/onboarding/2', '#/nowhere'])(
    'US-E8-02/AC2 in EN, %s shows no Japanese except the 日本語 toggle label',
    async (hash) => {
      const user = userEvent.setup();
      const { container } = await renderApp(memoryStorage(), hash);
      await user.click(screen.getByTestId('lang-toggle-en'));
      expect(visibleJapanese(container)).toEqual([]);
      expect(document.title).not.toMatch(JAPANESE);
    },
  );
});

describe('calendar shell (placeholder until M2)', () => {
  it('US-E5-01/AC1 marks today in Tokyo (2026-11-15) though the clock reads 2026-11-14 UTC', async () => {
    await renderApp();
    expect(screen.getByTestId('cal-cell-2026-11-15')).toHaveAttribute('aria-current', 'date');
    expect(screen.getByTestId('cal-cell-2026-11-14')).not.toHaveAttribute('aria-current');
  });

  it('navigates months across the year end and back to today', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('cal-next'));
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await user.click(screen.getByTestId('cal-next'));
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('cal-title')).toHaveTextContent('2027年1月');
    expect(screen.getByTestId('cal-live')).toHaveTextContent('2027年1月を表示しています');
    expect(screen.getByTestId('menu-card-missing')).toHaveTextContent('1月の献立がまだありません');
    await user.click(screen.getByTestId('cal-prev'));
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('cal-title')).toHaveTextContent('2026年12月');
    await user.click(screen.getByTestId('cal-today'));
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByTestId('cal-title')).toHaveTextContent('2026年11月');
    expect(screen.queryByTestId('cal-today')).toBeNull();
  });

  it('applies the stored week start and theme', async () => {
    const stored = storeV1();
    stored.settings.weekStartsOn = 'sunday';
    stored.settings.theme = 'dark';
    await renderApp(memoryStorage({ 'bentominder.state': JSON.stringify(stored) }));
    expect(screen.getByTestId('cal-grid')).toHaveAttribute('data-week-starts-on', 'sunday');
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('日');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('stored-data states (design/components.md §12)', () => {
  it('shows the newer-data screen for a store from a newer version', async () => {
    await renderApp(memoryStorage({ 'bentominder.state': JSON.stringify({ ...storeV1(), schemaVersion: 99 }) }));
    expect(screen.getByTestId('screen-newer-data')).toHaveTextContent('新しいバージョンのデータです。アプリを更新してください。');
  });

  it('shows the recovery screen for unreadable data and the language switch writes nothing', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage({ 'bentominder.state': '{' });
    await renderApp(storage);
    expect(screen.getByTestId('screen-corrupt-data')).toHaveTextContent('保存されたデータを読み込めませんでした');
    await user.click(screen.getByTestId('lang-toggle-en'));
    expect(screen.getByTestId('screen-corrupt-data')).toHaveTextContent("Your saved data couldn't be read");
    expect(storage.writes).toBe(0);
  });

  it('US-E10-02/AC5 shows 「この端末に保存できません」 when a write fails', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    storage.failWrites = true;
    await renderApp(storage);
    await user.click(screen.getByTestId('lang-toggle-en'));
    expect(await screen.findByTestId('banner-storage')).toHaveTextContent("This device can't save data");
  });

  it('shows the not-found page for unknown routes, including /debug', async () => {
    await renderApp(memoryStorage(), '#/debug');
    expect(screen.getByTestId('screen-not-found')).toHaveTextContent('ページが見つかりません');
  });

  it('ignores store changes while not ready', () => {
    const loading = { phase: 'loading', language: 'ja' } as const;
    expect(appReducer(loading, { type: 'store-changed', store: storeV1() })).toBe(loading);
    expect(appReducer(loading, { type: 'save-result', ok: false })).toBe(loading);
  });
});
