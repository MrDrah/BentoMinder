// Profile edit/delete (US-E1-05, US-E1-06), export/import/delete-all (US-E10-03, US-E10-04) and
// the recovery screens (US-E10-02/AC3, AC4, AC7) in jsdom.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { bentoMinderStoreSchema } from '../../../src/domain/schema/index.ts';
import { storeV1 } from '../helpers/fixtures.ts';
import { renderApp } from '../helpers/app.tsx';

describe('US-E10-03 export my data', () => {
  it('US-E10-03/AC4 the file is the stored store as is, named with the Tokyo date', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: storeV1(), hash: '#/settings' });
    await user.click(await screen.findByTestId('data-export'));
    await waitFor(() => expect(app.services.fileExport.save).toHaveBeenCalledTimes(1));
    const [name, contents, mime] = app.services.fileExport.save.mock.calls[0]!;
    expect(name).toBe('bentominder-export-2026-11-15.json');
    expect(mime).toBe('application/json');
    const doc = JSON.parse(contents) as Record<string, unknown>;
    expect(doc).toEqual(storeV1());
    expect(bentoMinderStoreSchema.safeParse(doc).success).toBe(true);
    expect(screen.getByTestId('toast')).toHaveTextContent('書き出しました');
  });

  it('US-E10-03/AC2 with nothing stored the export is disabled with 「書き出すデータがありません」', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: storeV1(), hash: '#/settings' });
    await user.click(await screen.findByTestId('data-delete-all'));
    await user.click(screen.getByTestId('dialog-delete-all-confirm'));
    await screen.findByTestId('ob-step-1');
    window.location.hash = '#/settings';
    const button = await screen.findByTestId('data-export');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('書き出すデータがありません')).toBeInTheDocument();
    await user.click(button);
    expect(app.services.fileExport.save).not.toHaveBeenCalled();
  });

  it('US-E10-03/AC3 a valid export replaces the data after confirmation', async () => {
    const user = userEvent.setup();
    const other = storeV1();
    other.profile = { ...other.profile!, nickname: 'たろう' };
    const app = await renderApp({ store: storeV1(), hash: '#/settings' });
    await user.upload(await screen.findByTestId('data-import'), new File([JSON.stringify(other)], 'export.json', { type: 'application/json' }));
    expect(await screen.findByTestId('dialog-import-data')).toHaveTextContent('今のデータを置き換えますか？');
    await user.click(screen.getByTestId('dialog-import-data-confirm'));
    await screen.findByTestId('screen-calendar');
    expect(app.stored().profile?.nickname).toBe('たろう');
  });

  it('US-E10-03/AC5 US-E10-03/AC6 an invalid or newer file changes nothing and opens no dialog', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: storeV1(), hash: '#/settings' });
    const before = app.storage.data.get('bentominder.state');
    await user.upload(await screen.findByTestId('data-import'), new File(['not json'], 'x.json'));
    expect(await screen.findByTestId('data-import-error')).toHaveTextContent('このファイルは読み込めません。BentoMinderから書き出したファイルを選んでください。');
    await user.upload(screen.getByTestId('data-import'), new File([JSON.stringify({ ...storeV1(), schemaVersion: 99 })], 'x.json'));
    expect(await screen.findByTestId('data-import-error')).toHaveTextContent('このファイルは新しいバージョンのアプリで作られています。アプリを更新してください。');
    expect(screen.queryByTestId('dialog-import-data')).toBeNull();
    expect(app.storage.data.get('bentominder.state')).toBe(before);
  });
});

describe('US-E10-04 delete all data (BR-22)', () => {
  it('US-E10-04/AC2 cancel keeps everything', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: storeV1(), hash: '#/settings' });
    const before = app.storage.data.get('bentominder.state');
    await user.click(await screen.findByTestId('data-delete-all'));
    expect(screen.getByTestId('dialog-delete-all')).toHaveTextContent('すべてのデータを削除しますか？');
    await user.click(screen.getByTestId('dialog-delete-all-cancel'));
    expect(app.storage.data.get('bentominder.state')).toBe(before);
  });

  it('US-E10-04/AC1 one confirmation removes every key and returns to onboarding in Japanese', async () => {
    const user = userEvent.setup();
    const english = storeV1();
    english.settings.language = 'en';
    const app = await renderApp({ store: english, hash: '#/settings' });
    expect(document.documentElement.lang).toBe('en');
    await user.click(await screen.findByTestId('data-delete-all'));
    await user.click(screen.getByTestId('dialog-delete-all-confirm'));
    expect(await screen.findByTestId('ob-step-1')).toBeInTheDocument();
    expect(app.storage.data.size).toBe(0);
    expect(document.documentElement.lang).toBe('ja');
  });
});

describe('US-E1-05 edit the profile', () => {
  it('US-E1-05/AC1 saving changes the profile and keeps decisions', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: storeV1(), hash: '#/profile' });
    await user.click(await screen.findByTestId('picker-dislikes-option-ing-eggplant'));
    await user.click(screen.getByTestId('profile-save'));
    await screen.findByTestId('screen-settings');
    expect(app.stored().decisions).toEqual(storeV1().decisions);
    expect(app.stored().profile?.dislikedIds).not.toEqual(storeV1().profile?.dislikedIds);
    expect(screen.getByTestId('toast')).toHaveTextContent('プロフィールを保存しました。');
  });

  it('US-E1-05/AC3 「キャンセル」 with changes asks, then leaves the stored profile unchanged', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: storeV1(), hash: '#/profile' });
    const before = app.storage.data.get('bentominder.state');
    await user.click(await screen.findByTestId('chip-age-age-5-6'));
    await user.click(screen.getByTestId('profile-cancel'));
    expect(screen.getByTestId('dialog-discard-profile')).toHaveTextContent('変更を保存せずに戻りますか？');
    await user.click(screen.getByTestId('dialog-discard-profile-confirm'));
    expect(await screen.findByTestId('screen-settings')).toBeInTheDocument();
    expect(app.storage.data.get('bentominder.state')).toBe(before);
  });
});

describe('US-E1-06 delete the profile', () => {
  it('US-E1-06/AC1 US-E1-06/AC2 the dialog explains what is kept; confirming removes the profile and overrides only', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ store: storeV1(), hash: '#/settings' });
    await user.click(await screen.findByTestId('settings-profile-delete'));
    const dialog = screen.getByTestId('dialog-delete-profile');
    expect(dialog).toHaveTextContent('献立表とお弁当の予定は残ります。');
    expect(screen.getByTestId('dialog-delete-profile-confirm')).toHaveTextContent('削除する');
    expect(screen.getByTestId('dialog-delete-profile-cancel')).toHaveTextContent('キャンセル');
    await user.click(screen.getByTestId('dialog-delete-profile-confirm'));
    expect(await screen.findByTestId('ob-step-1')).toBeInTheDocument();
    const stored = app.stored();
    expect(stored.profile).toBeNull();
    expect(stored.overrides).toEqual({});
    expect(stored.menus).toEqual(storeV1().menus);
    expect(stored.decisions).toEqual(storeV1().decisions);
  });
});

describe('US-E10-02 recovery screens', () => {
  it('US-E10-02/AC3 newer data: export the stored text as is, nothing written', async () => {
    const user = userEvent.setup();
    const raw = JSON.stringify({ ...storeV1(), schemaVersion: 99 });
    const app = await renderApp({ raw });
    expect(screen.getByTestId('screen-newer-data')).toHaveTextContent('新しいバージョンのデータです。アプリを更新してください。');
    await user.click(screen.getByTestId('recovery-export'));
    expect(app.services.fileExport.save).toHaveBeenCalledWith('bentominder-export-2026-11-15.json', raw, 'application/json');
    expect(screen.queryByTestId('recovery-reset')).toBeNull();
    expect(app.storage.writes).toBe(0);
  });

  it('US-E10-02/AC4 US-E10-02/AC7 corrupt data: export as is; 「初期化する」 asks, cancel keeps it, confirm starts over in Japanese', async () => {
    const user = userEvent.setup();
    const app = await renderApp({ raw: '{ broken' });
    expect(screen.getByTestId('screen-corrupt-data')).toBeInTheDocument();
    await user.click(screen.getByTestId('recovery-export'));
    expect(app.services.fileExport.save).toHaveBeenCalledWith('bentominder-export-2026-11-15.json', '{ broken', 'application/json');
    await user.click(screen.getByTestId('lang-toggle-en'));
    await user.click(screen.getByTestId('recovery-reset'));
    expect(screen.getByTestId('dialog-reset-store')).toBeInTheDocument();
    await user.click(screen.getByTestId('dialog-reset-store-cancel'));
    expect(app.storage.data.get('bentominder.state')).toBe('{ broken');
    expect(screen.getByTestId('screen-corrupt-data')).toBeInTheDocument();
    await user.click(screen.getByTestId('recovery-reset'));
    await user.click(screen.getByTestId('dialog-reset-store-confirm'));
    expect(await screen.findByTestId('ob-step-1')).toBeInTheDocument();
    expect(app.storage.data.size).toBe(0);
    expect(document.documentElement.lang).toBe('ja');
  });
});
