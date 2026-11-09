// QA E14: US-E14-08/AC1-AC5 and US-E14-03/AC4 in the import screen (jsdom, fake extractor / pdf source / account).
// What the parent sees for each hosted reply, which buttons exist, and that nothing is stored.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, expect, it } from 'vitest';
import type { ExtractResult, PdfResult } from '../../../../src/domain/ports.ts';
import type { BentoMinderStore } from '../../../../src/domain/schema/index.ts';
import { createRepository } from '../../../../src/domain/storage/repository.ts';
import { AccountContext } from '../../../../src/ui/auth/account-context.tsx';
import { App } from '../../../../src/ui/App.tsx';
import { AppProvider, type AppServices } from '../../../../src/ui/app-store.tsx';
import { DEVICE_ID, fakeExtractor, fakePdfSource, NOW_ISO, profileOnly } from '../../helpers/app.tsx';
import { loadFixture } from '../../helpers/fixtures.ts';
import { fixedClock, memoryStorage } from '../../helpers/memory-storage.ts';

const TEXT = {
  expired: 'ログインの有効期限が切れました。もう一度ログインしてください。',
  notAllowed: 'このアカウントでは献立の読み取りを使えません。',
  hour: '読み取りの回数が上限に達しました。1時間ほどしてからもう一度お試しください。',
  day: '今日の読み取り回数の上限に達しました。明日もう一度お試しください。',
  fetch: 'URLからの取得回数が上限に達しました。PDFをアップロードするか、しばらくしてからお試しください。',
  unreachable: '読み取りサービスに接続できませんでした。時間をおいて再度お試しください。登録済みの献立と予定はそのままです。',
};

async function mount(opts: { extract?: ExtractResult; url?: PdfResult; signedIn?: boolean }) {
  const store: BentoMinderStore = { ...profileOnly(), consent: { aiNoticeVersion: 1, consentedAt: '2026-11-01T10:00:00+09:00' } };
  const storage = memoryStorage({ 'bentominder.state': JSON.stringify(store) });
  const clock = fixedClock(NOW_ISO);
  const signOut = vi.fn(() => Promise.resolve(true));
  const extractor = fakeExtractor(opts.extract);
  const pdfSource = fakePdfSource(opts.url);
  const services = { pdfSource, extractor, fileExport: { save: vi.fn(() => Promise.resolve()) }, isOnline: () => true, dictionary: loadFixture('../../data/dictionary.json') } as unknown as AppServices;
  window.location.hash = '#/import';
  render(
    <AccountContext.Provider value={opts.signedIn === false ? null : { user: { uid: 'test-uid-001', displayName: 'Test Parent', email: 'parent@example.test', photoUrl: null }, signOut }}>
      <AppProvider repository={createRepository(storage, clock)} clock={clock} newDeviceId={() => DEVICE_ID} services={services}>
        <App />
      </AppProvider>
    </AccountContext.Provider>,
  );
  await screen.findByTestId('screen-import');
  const before = storage.data.get('bentominder.state');
  const user = userEvent.setup();
  const go = async () => {
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/menu/2026-11.pdf');
    await user.click(screen.getByTestId('import-submit'));
  };
  return { user, go, extractor, pdfSource, signOut, stored: () => storage.data.get('bentominder.state'), before };
}

const fail = (e: Record<string, unknown>): ExtractResult => ({ ok: false, providerCalls: 0, ...e }) as ExtractResult;
const err = async () => screen.findByTestId('import-error');
const has = (id: string) => screen.queryByTestId(id) !== null;

describe('US-E14-08/AC1 token problem', () => {
  it('US-E14-08/AC1 UNAUTHENTICATED: expiry text, 「ログインし直す」, upload and 「手入力する」, no retry; nothing stored; sign-in-again signs out', async () => {
    const m = await mount({ extract: fail({ error: 'UNAUTHENTICATED' }) });
    await m.go();
    expect(await err()).toHaveTextContent(TEXT.expired);
    expect(screen.getByTestId('import-error-signin')).toHaveTextContent('ログインし直す');
    expect(has('import-upload')).toBe(true);
    expect(has('import-manual')).toBe(true);
    expect(has('import-error-retry')).toBe(false);
    expect(m.stored()).toBe(m.before);
    expect(m.extractor.extract).toHaveBeenCalledTimes(1);
    await m.user.click(screen.getByTestId('import-error-signin'));
    expect(m.signOut).toHaveBeenCalledTimes(1);
    expect(m.extractor.extract).toHaveBeenCalledTimes(1);
  });
});

describe('US-E14-08/AC2 account not allowed', () => {
  it('US-E14-08/AC2 NOT_ALLOWED from extraction: text and 「手入力する」 only: no retry, no upload, no sign-in-again; nothing stored', async () => {
    const m = await mount({ extract: fail({ error: 'NOT_ALLOWED' }) });
    await m.go();
    expect(await err()).toHaveTextContent(TEXT.notAllowed);
    expect(has('import-manual')).toBe(true);
    expect(has('import-error-retry')).toBe(false);
    expect(has('import-upload')).toBe(false);
    expect(has('import-error-signin')).toBe(false);
    expect(m.stored()).toBe(m.before);
  });
  it('US-E14-08/AC2 NOT_ALLOWED from the URL fetch itself: same panel, no upload', async () => {
    const m = await mount({ url: { ok: false, error: 'NOT_ALLOWED' } as PdfResult });
    await m.go();
    expect(await err()).toHaveTextContent(TEXT.notAllowed);
    expect(has('import-upload')).toBe(false);
    expect(has('import-error-retry')).toBe(false);
    expect(has('import-manual')).toBe(true);
    expect(m.extractor.extract).not.toHaveBeenCalled();
  });
  it('US-E14-08/AC2 NOT_ALLOWED leaves every other screen working (the calendar still opens)', async () => {
    const m = await mount({ extract: fail({ error: 'NOT_ALLOWED' }) });
    await m.go();
    await err();
    window.location.hash = '#/calendar';
    expect(await screen.findByTestId(/^screen-/)).toBeInTheDocument();
    expect(JSON.parse(m.stored() as string).menus).toEqual({}); // the calendar's own reminder bookkeeping may write, menus must not
  });
});

describe('US-E14-03/AC4 US-E14-08/AC3 limit reached', () => {
  it('US-E14-03/AC4 scope hour: text, retry button following the countdown from retryAfterSec, upload, manual; nothing stored', async () => {
    const m = await mount({ extract: fail({ error: 'ACCOUNT_LIMIT', scope: 'hour', retryAfterSec: 120 }) });
    await m.go();
    expect(await err()).toHaveTextContent(TEXT.hour);
    const retry = screen.getByTestId('import-error-retry');
    expect(retry).toHaveTextContent('もう一度（あと120秒）');
    expect(retry).toHaveAttribute('aria-disabled', 'true');
    expect(has('import-upload')).toBe(true);
    expect(has('import-manual')).toBe(true);
    expect(m.stored()).toBe(m.before);
    await m.user.click(retry); // disabled while the countdown runs: no new request
    expect(m.extractor.extract).toHaveBeenCalledTimes(1);
  });
  it('US-E14-03/AC4 scope hour without a usable retryAfterSec: retry is offered (no countdown)', async () => {
    const m = await mount({ extract: fail({ error: 'ACCOUNT_LIMIT', scope: 'hour' }) });
    await m.go();
    await err();
    expect(screen.getByTestId('import-error-retry')).toHaveTextContent('もう一度');
  });
  it('US-E14-03/AC4 scope day: text, NO retry button, upload and manual; nothing stored', async () => {
    const m = await mount({ extract: fail({ error: 'ACCOUNT_LIMIT', scope: 'day', retryAfterSec: 30000 }) });
    await m.go();
    expect(await err()).toHaveTextContent(TEXT.day);
    expect(has('import-error-retry')).toBe(false);
    expect(has('import-upload')).toBe(true);
    expect(has('import-manual')).toBe(true);
    expect(m.stored()).toBe(m.before);
  });
  it('US-E14-03/AC4 scope fetch (URL fetch refused): text, no retry, upload and manual; no extraction attempted', async () => {
    const m = await mount({ url: { ok: false, error: 'ACCOUNT_LIMIT', scope: 'fetch', retryAfterSec: 60 } as PdfResult });
    await m.go();
    expect(await err()).toHaveTextContent(TEXT.fetch);
    expect(has('import-error-retry')).toBe(false);
    expect(has('import-upload')).toBe(true);
    expect(has('import-manual')).toBe(true);
    expect(m.extractor.extract).not.toHaveBeenCalled();
    expect(m.stored()).toBe(m.before);
  });
  it('US-E14-03/AC4 a limit refusal (providerCalls 0) is not added to the app\'s own AI usage tally', async () => {
    const m = await mount({ extract: fail({ error: 'ACCOUNT_LIMIT', scope: 'day' }) });
    await m.go();
    await err();
    expect(JSON.parse(m.stored() as string).aiUsage ?? []).toEqual(JSON.parse(m.before as string).aiUsage ?? []);
  });
});

describe('US-E14-08/AC4 AC5 unreachable and origin refused: the unreachable message, one request per tap', () => {
  for (const [name, reply] of [
    ['NETWORK', fail({ error: 'NETWORK' })],
    ['UNAVAILABLE (503 fail closed)', fail({ error: 'UNAVAILABLE' })],
    ['ORIGIN_NOT_ALLOWED', fail({ error: 'ORIGIN_NOT_ALLOWED' })],
  ] as const) {
    it(`US-E14-08/AC4 ${name}: message with 「もう一度」, upload, manual; a tap on retry sends exactly one more request`, async () => {
      const m = await mount({ extract: reply });
      await m.go();
      expect(await err()).toHaveTextContent(TEXT.unreachable);
      expect(has('import-upload')).toBe(true);
      expect(has('import-manual')).toBe(true);
      expect(m.stored()).toBe(m.before);
      expect(m.extractor.extract).toHaveBeenCalledTimes(1);
      await m.user.click(screen.getByTestId('import-error-retry'));
      expect(m.extractor.extract).toHaveBeenCalledTimes(2);
    });
  }
  it('US-E14-08/AC4 unreachable during the URL step: the fetch error panel with the URL kept, upload offered', async () => {
    const m = await mount({ url: { ok: false, error: 'NETWORK' } });
    await m.go();
    await err();
    expect(has('import-upload')).toBe(true);
    expect(screen.getByTestId('input-url')).toHaveValue('https://example-kinder.test/menu/2026-11.pdf');
  });
});
