// M4 slice C in jsdom: the weekly share (US-E9-01, US-E9-02) and its pure text builder.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDayViewer } from '../../../src/domain/calendar/day-view.ts';
import type { Share } from '../../../src/domain/ports.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/index.ts';
import { composeShareText, shareWeek, type ShareLabels } from '../../../src/domain/share/week-text.ts';
import type { LocalDate } from '../../../src/domain/time/jst.ts';
import { createWebShare } from '../../../src/adapters/web/share.ts';
import { en } from '../../../src/i18n/en.ts';
import { ja } from '../../../src/i18n/ja.ts';
import { clone, loadFixture } from '../helpers/fixtures.ts';
import { renderApp } from '../helpers/app.tsx';
import { jst, november } from './m4-fixtures.ts';

afterEach(() => {
  vi.restoreAllMocks();
  window.getSelection()?.removeAllRanges();
});

const AC1_JA = [
  '【BentoMinder】11月2日（月）〜11月8日（日）のお弁当予定',
  '11月4日（水）手作りお弁当：ひまわり弁当',
  '11月6日（金）未定',
  'ほかの日は給食（または給食なし）です。',
  '※給食の予約は園の方法で行ってください。',
].join('\n');
const viewer = () => createDayViewer(loadFixture('../../data/dictionary.json'));
const today = '2026-11-01' as LocalDate;
const NOW = jst('2026-11-01 10:00');

/** The week of the AC1 example: 11-04 planned, 11-06 not confirmed, today 2026-11-01. */
function weekStore(): BentoMinderStore {
  const s = november();
  const base = clone(s.decisions['2026-11-05' as LocalDate]!);
  const undecided = { ...base, date: '2026-11-06', state: 'not-confirmed', history: [{ state: 'not-confirmed', at: base.decidedAt }] } as Record<string, unknown>;
  undecided['reservationDoneExternally'] = false;
  s.decisions['2026-11-06' as LocalDate] = undecided as never;
  return s;
}

function fakeShare(over: Partial<Share> = {}): Share & { shared: string[]; copied: string[] } {
  const shared: string[] = [];
  const copied: string[] = [];
  return {
    shared,
    copied,
    canShare: () => true,
    share: (text) => {
      shared.push(text);
      return Promise.resolve('shared');
    },
    copy: (text) => {
      copied.push(text);
      return Promise.resolve(true);
    },
    ...over,
  };
}

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByTestId('share-button'));
  return screen.getByTestId('share-preview');
};

describe('US-E9-01 weekly share text', () => {
  it('US-E9-01/AC1 the text is exactly the header, the planned and not-confirmed days, the others line and the reservation note (ja)', async () => {
    const user = userEvent.setup();
    await renderApp({ store: weekStore(), now: NOW, services: { share: fakeShare() } });
    const preview = await open(user);
    expect(preview.textContent).toBe(AC1_JA);
    expect(screen.getByRole('button', { name: ja['share.button'] })).toBeInTheDocument();
  });

  it('US-E9-01/AC1 the text follows the language (en)', async () => {
    const user = userEvent.setup();
    await renderApp({ store: weekStore(), now: NOW, services: { share: fakeShare() } });
    await screen.findByTestId('share-button');
    await user.click(screen.getByTestId('lang-toggle-en'));
    await waitFor(() => expect(screen.getByTestId('share-button')).toHaveTextContent(en['share.button']));
    const preview = await open(user);
    expect(preview.textContent).toContain('[BentoMinder] Bento plan for Mon, Nov 2 – Sun, Nov 8');
    expect(preview.textContent).toContain('Wed, Nov 4 Homemade bento: Sunflower bento (himawari bento)');
    expect(preview.textContent).toContain('Fri, Nov 6 Not decided');
    expect(preview.textContent).toContain(en['share.text.reservation']);
  });

  it('US-E9-01/AC2 with navigator.share the 「共有する」 button hands the text to the OS sheet', async () => {
    const user = userEvent.setup();
    const share = fakeShare();
    await renderApp({ store: weekStore(), now: NOW, services: { share } });
    await open(user);
    await user.click(screen.getByTestId('share-native'));
    expect(share.shared).toEqual([AC1_JA]);
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('US-E9-01/AC2 without navigator.share there is no 「共有する」 button; 「コピーする」 copies and 「コピーしました」 shows', async () => {
    const user = userEvent.setup();
    const share = fakeShare({ canShare: () => false });
    await renderApp({ store: weekStore(), now: NOW, services: { share } });
    await open(user);
    expect(screen.queryByTestId('share-native')).toBeNull();
    await user.click(screen.getByTestId('share-copy'));
    expect(share.copied).toEqual([AC1_JA]);
    expect(await screen.findByTestId('toast')).toHaveTextContent(ja['share.copied']);
  });

  it('US-E9-01/AC2 a rejected or missing navigator.share falls back to the clipboard (adapter)', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const clipboard = { writeText } as unknown as Clipboard;
    const rejected = createWebShare({ share: () => Promise.reject(new Error('AbortError')), clipboard });
    expect(rejected.canShare()).toBe(true);
    expect(await rejected.share('x')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('x');
    const missing = createWebShare({ clipboard } as Pick<Navigator, 'share' | 'clipboard'>);
    expect(missing.canShare()).toBe(false);
    expect(await missing.share('y')).toBe('copied');
  });

  it('US-E9-01/AC3 a week with nothing planned says so, without the others line (exact ja text)', async () => {
    const user = userEvent.setup();
    const s = november();
    s.decisions = {};
    await renderApp({ store: s, now: NOW, services: { share: fakeShare() } });
    const preview = await open(user);
    expect(preview.textContent).toBe(
      ['【BentoMinder】11月2日（月）〜11月8日（日）のお弁当予定', '今週は手作りお弁当の予定はありません。', '※給食の予約は園の方法で行ってください。'].join('\n'),
    );
  });

  it('US-E9-01/AC4 when copying fails too the message shows, the text is selected and 「コピーしました」 does not', async () => {
    const user = userEvent.setup();
    const share = fakeShare({ canShare: () => false, copy: () => Promise.resolve(false) });
    await renderApp({ store: weekStore(), now: NOW, services: { share } });
    const preview = await open(user);
    await user.click(screen.getByTestId('share-copy'));
    expect(await screen.findByTestId('share-copy-failed')).toHaveTextContent(ja['share.copyFailed']);
    await waitFor(() => expect(window.getSelection()?.toString()).toBe(preview.textContent));
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('US-E9-01/AC4 a share that delivers nothing (native and clipboard both failed) shows the same message', async () => {
    const user = userEvent.setup();
    await renderApp({ store: weekStore(), now: NOW, services: { share: fakeShare({ share: () => Promise.resolve('cancelled') }) } });
    await open(user);
    await user.click(screen.getByTestId('share-native'));
    expect(await screen.findByTestId('share-copy-failed')).toBeInTheDocument();
    const blocked = createWebShare({ share: () => Promise.reject(new Error('no')), clipboard: { writeText: () => Promise.reject(new Error('blocked')) } as unknown as Clipboard });
    expect(await blocked.share('z')).toBe('cancelled');
  });

  it('US-E9-01/AC1 nothing is shared or copied until the parent taps (user-triggered only)', async () => {
    const user = userEvent.setup();
    const share = fakeShare();
    await renderApp({ store: weekStore(), now: NOW, services: { share } });
    await open(user);
    expect(share.shared).toEqual([]);
    expect(share.copied).toEqual([]);
  });
});

describe('US-E9-02 the shared text carries only the plan', () => {
  const labels = (lang: 'ja' | 'en'): ShareLabels => {
    const c = lang === 'ja' ? ja : en;
    return {
      header: (a, b) => c['share.text.header'].replace('{range}', `${a}~${b}`),
      bento: (d, r) => c['share.text.bento'].replace('{date}', d).replace('{recipe}', r === undefined ? '' : r[lang]),
      notConfirmed: (d) => c['share.text.notConfirmed'].replace('{date}', d),
      others: c['share.text.others'],
      reservation: c['share.text.reservation'],
      empty: c['share.text.empty'],
    };
  };

  it('US-E9-02/AC1 no nickname, age range, likes, dislikes, allergens, diet, themes or note reaches the text, in either language', () => {
    const s = weekStore();
    const p = s.profile;
    expect(p?.nickname).toBe('はなちゃん');
    const private_: string[] = [p?.nickname, p?.note, p?.ageRange, ...(p?.likedIds ?? []), ...(p?.dislikedIds ?? []), ...(p?.knownAllergenIds ?? []), ...(p?.themeIds ?? [])].filter(
      (v): v is string => typeof v === 'string' && v.length > 1,
    );
    expect(private_.length).toBeGreaterThan(8);
    for (const lang of ['ja', 'en'] as const) {
      const text = composeShareText(shareWeek(s, today, viewer()), labels(lang));
      for (const value of private_) expect(text).not.toContain(value);
      for (const line of text.split('\n')) {
        const l = labels(lang);
        expect(line.startsWith('【BentoMinder】') || line.startsWith('[BentoMinder]') || /^\d{4}-\d{2}-\d{2}/.test(line) || line === l.others || line === l.reservation).toBe(true);
      }
    }
  });

  it('US-E9-02/AC1 the sheet shows what will be sent, free of the nickname, beside 「お子さまのプロフィールは含まれません。」', async () => {
    const user = userEvent.setup();
    await renderApp({ store: weekStore(), now: NOW, services: { share: fakeShare() } });
    const preview = await open(user);
    expect(screen.getByTestId('share-privacy')).toHaveTextContent(ja['share.sheet.privacy']);
    expect(preview.textContent).not.toContain('はなちゃん');
  });

  it('US-E9-02/AC2 the sheet says 「共有した時点の予定です。自動では同期されません。」 and no shipped string claims automatic sync', async () => {
    const user = userEvent.setup();
    await renderApp({ store: weekStore(), now: NOW, services: { share: fakeShare() } });
    await open(user);
    expect(screen.getByTestId('share-note')).toHaveTextContent('共有した時点の予定です。自動では同期されません。');
    for (const [key, text] of [...Object.entries(ja), ...Object.entries(en)]) {
      if (key === 'share.sheet.note') continue;
      expect(text, key).not.toMatch(/自動で同期|自動的に同期|syncs automatically|automatically sync|auto-sync/i);
    }
  });
});
