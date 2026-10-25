// Onboarding (US-E1-01…E1-04) and the import step (US-E2-01…E2-08) in jsdom with fake adapters.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { recordExtraction } from '../../../src/domain/menu/store-ops.ts';
import type { Instant } from '../../../src/domain/time/jst.ts';
import { createWebPdfSource } from '../../../src/adapters/web/pdf-source.ts';
import { fakeExtractor, fakePdfSource, fx01Menu, profileOnly, renderApp } from '../helpers/app.tsx';

const NOW = Date.parse('2026-11-14T15:30:00Z') as Instant;

async function fillMinimalProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('chip-age-age-4-5'));
  await user.click(screen.getByTestId('radio-allergy-none-known'));
}

describe('US-E1-01 first launch starts onboarding', () => {
  it('US-E1-01/AC1 no profile and no menu opens step 1 of 3 「お子さまのこと」', async () => {
    await renderApp();
    expect(await screen.findByTestId('ob-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-title')).toHaveTextContent('お子さまのこと');
    expect(screen.getByTestId('stepper')).toHaveTextContent('ステップ 1 / 3');
    expect(screen.queryByTestId('topbar-back')).toBeNull();
  });

  it('US-E1-01/AC3 a stored profile without a menu resumes at step 2 「献立の取り込み」', async () => {
    await renderApp({ store: profileOnly() });
    expect(await screen.findByTestId('ob-step-2')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-title')).toHaveTextContent('献立の取り込み');
    expect(screen.queryByTestId('input-nickname')).toBeNull();
  });

  it('US-E1-01/AC4 step-1 answers are kept: back from step 2 shows them', async () => {
    const user = userEvent.setup();
    await renderApp({ store: profileOnly() });
    await screen.findByTestId('ob-step-2');
    await user.click(screen.getByTestId('topbar-back'));
    expect(await screen.findByTestId('ob-step-1')).toBeInTheDocument();
    expect(screen.getByTestId('chip-age-age-4-5')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('input-nickname')).toHaveValue('はなちゃん');
  });

  it('US-E1-01/AC5 「あとで取り込む」 shows the calendar with 「今月の献立がまだありません」 and 「献立を取り込む」', async () => {
    const user = userEvent.setup();
    await renderApp({ store: profileOnly() });
    await user.click(await screen.findByTestId('import-later'));
    const card = await screen.findByTestId('menu-card-missing');
    expect(card).toHaveTextContent('今月の献立がまだありません');
    expect(within(card).getByTestId('card-menu-import')).toHaveTextContent('献立を取り込む');
  });
});

describe('US-E1-02 create the child profile (BR-20)', () => {
  it('US-E1-02/AC1 a minimal profile is stored and step 2 opens', async () => {
    const user = userEvent.setup();
    const app = await renderApp();
    await fillMinimalProfile(user);
    await user.click(screen.getByTestId('ob-next'));
    expect(await screen.findByTestId('ob-step-2')).toBeInTheDocument();
    expect(app.stored().profile).toMatchObject({ ageRange: 'age-4-5', allergyStatus: 'none-known', likedIds: [], dislikedIds: [], diet: [], themeIds: [] });
    expect(app.stored().profile?.nickname).toBeUndefined();
  });

  it('US-E1-02/AC2 likes and dislikes are picked as dictionary ids, incl. the category さかな', async () => {
    const user = userEvent.setup();
    const app = await renderApp();
    await fillMinimalProfile(user);
    await user.click(screen.getByTestId('picker-likes-option-ing-chicken'));
    await user.click(screen.getByTestId('picker-likes-option-ing-egg'));
    await user.click(screen.getByTestId('picker-dislikes-option-ing-green-pepper'));
    await user.type(screen.getByTestId('picker-dislikes-search'), 'さかな');
    await user.click(screen.getByTestId('picker-dislikes-option-cat-fish'));
    await user.click(screen.getByTestId('ob-next'));
    await screen.findByTestId('ob-step-2');
    expect(app.stored().profile).toMatchObject({ likedIds: ['ing-chicken', 'ing-egg'], dislikedIds: ['ing-green-pepper', 'cat-fish'] });
  });

  it('US-E1-02/AC3 adding a disliked food to likes moves it and says so', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('picker-dislikes-option-ing-green-pepper'));
    await user.click(screen.getByTestId('picker-likes-option-ing-green-pepper'));
    expect(screen.getByTestId('profile-notice')).toHaveTextContent('「ピーマン」を苦手から好きに移しました');
    expect(screen.getByTestId('picker-likes-chip-ing-green-pepper')).toBeInTheDocument();
    expect(screen.queryByTestId('picker-dislikes-chip-ing-green-pepper')).toBeNull();
    await user.click(within(screen.getByTestId('picker-likes-chip-ing-green-pepper')).getByRole('button', { name: '「ピーマン（食材）」を外す' }));
    expect(screen.queryByTestId('picker-likes-chip-ing-green-pepper')).toBeNull();
  });

  it('US-E1-02/AC4 without an age range nothing is stored, the error shows and focus moves to the age group', async () => {
    const user = userEvent.setup();
    const app = await renderApp();
    await user.click(screen.getByTestId('radio-allergy-none-known'));
    await user.click(screen.getByTestId('ob-next'));
    expect(screen.getByTestId('age-error')).toHaveTextContent('年齢を選んでください');
    expect(screen.getByTestId('group-age')).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByTestId('form-errors')).toHaveTextContent('入力内容に1件の誤りがあります');
    expect(app.storage.data.size).toBe(0);
  });

  it('US-E1-02/AC5 the nickname stops at 20 characters', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.type(screen.getByTestId('input-nickname'), 'あ'.repeat(21));
    expect(screen.getByTestId('input-nickname')).toHaveValue('あ'.repeat(20));
    expect(screen.getByText('20/20')).toBeInTheDocument();
  });

  it('US-E1-02/AC6 there is no field for birthdate, gender, height, weight, photo, name or school', async () => {
    await renderApp();
    const labels = [...document.querySelectorAll('label, legend')].map((l) => l.textContent ?? '').join(' ');
    for (const word of ['生年月日', '性別', '身長', '体重', '写真', '氏名', '園名', '学校名']) expect(labels).not.toContain(word);
    expect(document.querySelector('input[type="date"], input[type="file"]')).toBeNull();
  });

  it('US-E1-02/AC7 the note is stored (max 200 characters)', async () => {
    const user = userEvent.setup();
    const app = await renderApp();
    await fillMinimalProfile(user);
    await user.type(screen.getByTestId('input-note'), '野菜は細かく切ると食べます');
    await user.click(screen.getByTestId('ob-next'));
    await screen.findByTestId('ob-step-2');
    expect(app.stored().profile?.note).toBe('野菜は細かく切ると食べます');
  });
});

describe('US-E1-03 allergies, or explicitly unknown', () => {
  it('US-E1-03/AC3 three explicit options, none preselected; missing status is an error', async () => {
    const user = userEvent.setup();
    const app = await renderApp();
    const group = screen.getByTestId('group-allergy');
    expect(within(group).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['特になし', 'アレルギーあり', 'わからない・未確認']);
    expect(within(group).getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    await user.click(screen.getByTestId('chip-age-age-4-5'));
    await user.click(screen.getByTestId('ob-next'));
    expect(screen.getByTestId('allergy-error')).toHaveTextContent('アレルギーについて、どれか1つを選んでください');
    expect(app.storage.data.size).toBe(0);
  });

  it('US-E1-03/AC1 US-E1-03/AC4 has-known needs an allergen; えび and 卵 are stored as ids', async () => {
    const user = userEvent.setup();
    const app = await renderApp();
    await user.click(screen.getByTestId('chip-age-age-4-5'));
    await user.click(screen.getByTestId('radio-allergy-has-known'));
    await user.click(screen.getByTestId('ob-next'));
    expect(screen.getByTestId('allergy-error')).toHaveTextContent('アレルギーの食材を1つ以上選んでください');
    await user.click(screen.getByTestId('chip-allergen-alg-shrimp'));
    await user.click(screen.getByTestId('chip-allergen-alg-egg'));
    await user.click(screen.getByTestId('ob-next'));
    await screen.findByTestId('ob-step-2');
    expect(app.stored().profile).toMatchObject({ allergyStatus: 'has-known', knownAllergenIds: ['alg-shrimp', 'alg-egg'] });
  });

  it('US-E1-03/AC2 a food outside the labelling list is stored under excludedIngredientIds', async () => {
    const user = userEvent.setup();
    const app = await renderApp();
    await user.click(screen.getByTestId('chip-age-age-4-5'));
    await user.click(screen.getByTestId('radio-allergy-has-known'));
    await user.type(screen.getByTestId('picker-other-foods-search'), 'トマト');
    await user.click(screen.getByTestId('picker-other-foods-option-ing-tomato'));
    await user.click(screen.getByTestId('ob-next'));
    await screen.findByTestId('ob-step-2');
    expect(app.stored().profile?.excludedIngredientIds).toEqual(['ing-tomato']);
  });

  it('US-E1-03/AC5 「わからない・未確認」 previews the unknown-allergy banner', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByTestId('radio-allergy-unknown'));
    expect(screen.getByTestId('banner-allergy-unknown')).toHaveTextContent('アレルギー情報が未登録です。材料の表示を必ずご確認ください。');
  });

  it('US-E1-03/AC6 the helper says the app filters by registered information only, no safety promise', async () => {
    await renderApp();
    const group = screen.getByTestId('group-allergy');
    expect(group).toHaveTextContent('登録した情報だけをもとにレシピを絞り込みます');
    expect(document.body.textContent).not.toMatch(/安全です|アレルギー対応済み/);
  });
});

describe('US-E1-04 diet and themes', () => {
  it('US-E1-04/AC2 US-E1-04/AC3 diets are stored; a 4th theme is refused with 「テーマは3つまで選べます」', async () => {
    const user = userEvent.setup();
    const app = await renderApp();
    await fillMinimalProfile(user);
    await user.click(screen.getByTestId('chip-diet-no-pork'));
    await user.click(screen.getByTestId('chip-diet-no-beef'));
    for (const id of ['theme-animals', 'theme-dinosaurs', 'theme-vehicles']) await user.click(screen.getByTestId(`chip-theme-${id}`));
    await user.click(screen.getByTestId('chip-theme-theme-flowers'));
    expect(screen.getByTestId('theme-limit')).toHaveTextContent('テーマは3つまで選べます');
    expect(screen.getByTestId('chip-theme-theme-flowers')).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByTestId('ob-next'));
    await screen.findByTestId('ob-step-2');
    expect(app.stored().profile).toMatchObject({ diet: ['no-pork', 'no-beef'], themeIds: ['theme-animals', 'theme-dinosaurs', 'theme-vehicles'] });
  });
});

describe('US-E2-01 import from the school URL', () => {
  it('US-E2-01/AC2 an http URL is refused before any request', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: profileOnly() });
    await user.type(await screen.findByTestId('input-url'), 'http://example-kinder.test/menu/2026-11.pdf');
    await user.click(screen.getByTestId('import-submit'));
    expect(screen.getByTestId('input-url-error')).toHaveTextContent('PDFのURL（https://…）を入力してください');
    expect(app.services.pdfSource.fromUrl).not.toHaveBeenCalled();
  });

  it('US-E2-01/AC5 the import offers this month and next (today 2026-11-15: November selected)', async () => {
    await renderApp({ store: profileOnly() });
    const select = (await screen.findByTestId('import-month')) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['2026年11月', '2026年12月']);
    expect(select.value).toBe('2026-11');
  });

  it('US-E2-01/AC1 US-E2-08/AC1 the consent notice comes before the first extraction; accepting stores it and opens review', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: profileOnly() });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/menu/2026-11.pdf');
    await user.click(screen.getByTestId('import-submit'));
    const dialog = await screen.findByTestId('consent-dialog');
    expect(app.services.extractor.extract).not.toHaveBeenCalled();
    for (const fact of ['Gemini', 'お子さまの名前・年齢・アレルギー・好み', '無料枠', '担当者が内容を読む', '18歳以上', '日本国内']) expect(dialog).toHaveTextContent(fact);
    expect(within(dialog).getByTestId('consent-link')).toHaveAttribute('href', 'https://ai.google.dev/gemini-api/terms');
    await user.click(screen.getByTestId('consent-accept'));
    expect(await screen.findByTestId('screen-review')).toBeInTheDocument();
    expect(app.services.extractor.extract).toHaveBeenCalledTimes(1);
    const stored = app.stored();
    expect(stored.consent?.aiNoticeVersion).toBe(1);
    expect(stored.menus['2026-11']?.sourceUrl).toBe('https://example-kinder.test/menu/2026-11.pdf');
    expect(stored.menus['2026-11']?.extractions[0]?.source).toMatchObject({ kind: 'url', url: 'https://example-kinder.test/menu/2026-11.pdf' });
    expect(stored.aiUsage['2026-11']).toBe(1);
  });

  it('US-E2-04/AC7 the extractor receives only the PDF and the target month', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: { ...profileOnly(), consent: { aiNoticeVersion: 1, consentedAt: '2026-11-01T10:00:00+09:00' } } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/menu/2026-11.pdf');
    await user.click(screen.getByTestId('import-submit'));
    await screen.findByTestId('screen-review');
    const input = app.services.extractor.extract.mock.calls[0]![0];
    expect(Object.keys(input).sort()).toEqual(['pdf', 'targetMonth']);
  });

  it('US-E2-01/AC4 the saved URL is prefilled next time', async () => {
    const store = recordExtraction(profileOnly(), fx01Menu(), NOW, 'https://example-kinder.test/menu/2026-11.pdf');
    await renderApp({ store, hash: '#/import' });
    expect(await screen.findByTestId('input-url')).toHaveValue('https://example-kinder.test/menu/2026-11.pdf');
  });
});

describe('US-E2-08 privacy notice', () => {
  it('US-E2-08/AC2 declining makes no AI call and offers manual entry', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: profileOnly() });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/menu/2026-11.pdf');
    await user.click(screen.getByTestId('import-submit'));
    await user.click(await screen.findByTestId('consent-decline'));
    expect(app.services.extractor.extract).not.toHaveBeenCalled();
    expect(screen.getByTestId('banner-consent-declined')).toHaveTextContent('AIは使いません。献立は手入力できます。');
    expect(screen.getByTestId('import-manual')).toHaveClass('btn--primary');
    expect(app.stored().consent).toBeNull();
  });

  it('US-E2-08/AC3 a stored consent for version 1 is not asked again', async () => {
    const user = userEvent.setup();
    await renderApp({ store: { ...profileOnly(), consent: { aiNoticeVersion: 1, consentedAt: '2026-11-01T10:00:00+09:00' } } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/menu/2026-11.pdf');
    await user.click(screen.getByTestId('import-submit'));
    expect(await screen.findByTestId('screen-review')).toBeInTheDocument();
    expect(screen.queryByTestId('consent-dialog')).toBeNull();
  });
});

const consented = () => ({ ...profileOnly(), consent: { aiNoticeVersion: 1, consentedAt: '2026-11-01T10:00:00+09:00' } });

describe('US-E2-02 fall back to upload', () => {
  it('US-E2-02/AC1 a 404 shows its message, keeps the URL and makes no AI call; upload becomes primary', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: consented(), services: { pdfSource: fakePdfSource({ ok: false, error: 'NOT_FOUND' }) } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/menu/2026-11.pdf');
    await user.click(screen.getByTestId('import-submit'));
    const panel = await screen.findByTestId('import-error');
    expect(panel).toHaveTextContent('ファイルが見つかりませんでした。URLを確かめるか、PDFをアップロードしてください。');
    expect(panel).toHaveTextContent('入力したURLはそのまま残しています。');
    expect(screen.getByTestId('input-url')).toHaveValue('https://example-kinder.test/menu/2026-11.pdf');
    expect(app.services.extractor.extract).not.toHaveBeenCalled();
    expect(screen.getByTestId('import-upload').closest('label')).toHaveClass('btn--primary');
  });

  it.each([
    ['NETWORK', 'URLから取得できませんでした。PDFをアップロードしてください。'],
    ['BLOCKED', 'このサイトからは自動で取得できません。PDFを保存してから、アップロードしてください。'],
    ['NOT_A_PDF', 'PDFではないようです。献立表PDFのURLを入力するか、PDFをアップロードしてください。'],
    ['TOO_LARGE', 'ファイルが大きすぎます（10MBまで）'],
  ] as const)('US-E2-02/AC1 US-E2-02/AC3 %s shows its message', async (error, message) => {
    const user = userEvent.setup();
    await renderApp({ store: consented(), services: { pdfSource: fakePdfSource({ ok: false, error }) } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/m.pdf');
    await user.click(screen.getByTestId('import-submit'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent(message);
  });

  it('US-E2-02/AC2 an upload after a failed URL stores the filename and the URL', async () => {
    const user = userEvent.setup();
    const pdf = fakePdfSource({ ok: false, error: 'NETWORK' });
    pdf.fromFile.mockResolvedValue({ ok: true, bytes: new Uint8Array([37, 80, 68, 70, 45]), sha256: 'f'.repeat(64), byteSize: 5, filename: '11gatsu.pdf' });
    const app = await renderApp({ store: consented(), services: { pdfSource: pdf } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/m.pdf');
    await user.click(screen.getByTestId('import-submit'));
    await screen.findByTestId('import-error');
    await user.upload(screen.getByTestId('import-upload'), new File(['%PDF-'], '11gatsu.pdf', { type: 'application/pdf' }));
    await screen.findByTestId('screen-review');
    expect(app.stored().menus['2026-11']?.extractions[0]?.source).toMatchObject({ kind: 'upload', filename: '11gatsu.pdf', url: 'https://example-kinder.test/m.pdf' });
  });
});

describe('US-E2-03 upload a PDF file (BR-14, real file checks)', () => {
  const real = () => createWebPdfSource(() => Promise.reject(new Error('no network in tests')));

  it('US-E2-03/AC2 a file whose first bytes are not %PDF- is refused before any AI call', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: consented(), services: { pdfSource: real() as never } });
    await user.upload(await screen.findByTestId('import-upload'), new File(['<html>'], 'menu.pdf', { type: 'application/pdf' }));
    expect(await screen.findByTestId('import-error')).toHaveTextContent('PDFファイルを選んでください');
    expect(app.services.extractor.extract).not.toHaveBeenCalled();
  });

  it('US-E2-03/AC4 a 0-byte file is refused with 「このPDFは読み取れませんでした」', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: consented(), services: { pdfSource: real() as never } });
    await user.upload(await screen.findByTestId('import-upload'), new File([], 'empty.pdf', { type: 'application/pdf' }));
    expect(await screen.findByTestId('import-error')).toHaveTextContent('このPDFは読み取れませんでした');
    expect(app.services.extractor.extract).not.toHaveBeenCalled();
  });

  it('US-E2-03/AC3 a file over 10,485,760 bytes is refused; exactly 10 MB passes the size check', async () => {
    const pdf = real();
    const big = new File([new Uint8Array(10_485_761)], 'big.pdf');
    expect(await pdf.fromFile(big)).toEqual({ ok: false, error: 'TOO_LARGE' });
    const exact = new Uint8Array(10_485_760);
    exact.set([37, 80, 68, 70, 45]);
    const r = await pdf.fromFile(new File([exact], 'exact.pdf'));
    expect(r.ok && r.byteSize).toBe(10_485_760);
    expect(r.ok && r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('US-E2-03/AC1 a valid PDF upload is extracted and opens review', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: consented(), services: { pdfSource: real() as never } });
    await user.upload(await screen.findByTestId('import-upload'), new File(['%PDF-1.7 menu'], 'fixture-menu-2026-11.pdf', { type: 'application/pdf' }));
    expect(await screen.findByTestId('screen-review')).toBeInTheDocument();
    expect(app.services.extractor.extract).toHaveBeenCalledTimes(1);
  });
});

describe('US-E2-05 / US-E2-06 extraction failures', () => {
  it('US-E2-05/AC2 malformed twice shows the message with 「もう一度」, upload and 「手入力する」; nothing is stored but aiUsage', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: consented(), services: { extractor: fakeExtractor({ ok: false, error: 'MALFORMED_OUTPUT', providerCalls: 2 }) } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/m.pdf');
    await user.click(screen.getByTestId('import-submit'));
    const panel = await screen.findByTestId('import-error');
    expect(panel).toHaveTextContent('献立を読み取れませんでした。時間をおいて再度お試しください。');
    expect(screen.getByTestId('import-error-retry')).toHaveTextContent('もう一度');
    expect(screen.getByTestId('import-upload')).toBeInTheDocument();
    expect(screen.getByTestId('import-manual')).toBeInTheDocument();
    expect(app.stored().menus).toEqual({});
    expect(app.stored().aiUsage).toEqual({ '2026-11': 2 });
    // US-E2-07/AC2: 「もう一度」 is a new action.
    await user.click(screen.getByTestId('import-error-retry'));
    await waitFor(() => expect(app.services.extractor.extract).toHaveBeenCalledTimes(2));
  });

  it('US-E2-06/AC6 US-E2-06/AC9 busy: the retry is disabled with a countdown, upload and manual stay', async () => {
    const user = userEvent.setup();
    await renderApp({ store: consented(), services: { extractor: fakeExtractor({ ok: false, error: 'RATE_LIMITED', retryAfterSec: 60, providerCalls: 2 }) } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/m.pdf');
    await user.click(screen.getByTestId('import-submit'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent('混み合っています。1分ほどしてからもう一度お試しください。');
    const retry = screen.getByTestId('import-error-retry');
    expect(retry).toHaveTextContent('もう一度（あと60秒）');
    expect(retry).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('import-manual')).toBeEnabled();
    await waitFor(() => expect(retry).toHaveTextContent('もう一度（あと59秒）'), { timeout: 2500 });
  });

  it('US-E2-06/AC2 unavailable shows that saved menus and plans are unchanged', async () => {
    const user = userEvent.setup();
    await renderApp({ store: consented(), services: { extractor: fakeExtractor({ ok: false, error: 'UNAVAILABLE', providerCalls: 2 }) } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/m.pdf');
    await user.click(screen.getByTestId('import-submit'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent('登録済みの献立と予定はそのままです。');
  });

  it('US-E2-06/AC4 not configured offers only manual entry', async () => {
    const user = userEvent.setup();
    await renderApp({ store: consented(), services: { extractor: fakeExtractor({ ok: false, error: 'NOT_CONFIGURED', providerCalls: 0 }) } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/m.pdf');
    await user.click(screen.getByTestId('import-submit'));
    expect(await screen.findByTestId('import-error')).toHaveTextContent('読み取り機能が設定されていません');
    expect(screen.queryByTestId('import-error-retry')).toBeNull();
    expect(screen.queryByTestId('import-upload')).toBeNull();
  });

  it('US-E2-04/AC8 「中止する」 returns to the import with the URL kept; only aiUsage changes', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const slow = fakeExtractor(() => new Promise((resolve) => {
      release = () => resolve({ ok: true, menu: fx01Menu(), meta: { model: 'm', cached: false, promptVersion: 1, schemaVersion: 1, providerCalls: 1 } });
    }));
    const app = await renderApp({ store: consented(), services: { extractor: slow } });
    await user.type(await screen.findByTestId('input-url'), 'https://example-kinder.test/m.pdf');
    await user.click(screen.getByTestId('import-submit'));
    expect(await screen.findByTestId('import-progress')).toHaveTextContent('献立を読み取っています…');
    await user.click(screen.getByTestId('import-cancel'));
    expect(await screen.findByTestId('input-url')).toHaveValue('https://example-kinder.test/m.pdf');
    await act(async () => release?.());
    await waitFor(() => expect(app.stored().aiUsage).toEqual({ '2026-11': 1 }));
    expect(app.stored().menus).toEqual({});
    expect(screen.queryByTestId('screen-review')).toBeNull();
  });
});

describe('US-E2-07 one AI extraction per PDF', () => {
  it('US-E2-07/AC1 the same PDF reopens the stored reading with 「同じファイルです」 and no AI call', async () => {
    const user = userEvent.setup();
    const store = recordExtraction(consented(), fx01Menu(), NOW, 'https://example-kinder.test/menu/2026-11.pdf');
    const app = await renderApp({ store, hash: '#/import' });
    await user.click(await screen.findByTestId('import-submit'));
    expect(await screen.findByTestId('banner-same-file')).toHaveTextContent('同じファイルです');
    expect(app.services.extractor.extract).not.toHaveBeenCalled();
  });
});

describe('US-E10-01/AC3 import while offline', () => {
  it('US-E10-01/AC3 offline: 「オフラインのため取り込めません」, import disabled, manual entry available', async () => {
    await renderApp({ store: consented(), online: false });
    expect(await screen.findByTestId('banner-offline')).toHaveTextContent('オフラインのため取り込めません');
    expect(screen.getByTestId('import-submit')).toBeDisabled();
    expect(screen.getByTestId('input-url')).toBeDisabled();
    expect(screen.getByTestId('import-manual')).toBeEnabled();
  });
});
