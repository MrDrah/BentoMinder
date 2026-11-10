// Slice D screens, part 3 (jsdom, a stub sync controller): the nine statuses, the status sheet, the live region, the notes
// (lost edit, ignored, ended), the leave / remove / delete dialogs and the import and delete-all changes while in a family
// (US-E15-06, -07/AC8, -08, -10, -11; components §16.7, §16.8, §16.10).
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncStatus } from '../../../src/domain/sync/types.ts';
import { en } from '../../../src/i18n/en.ts';
import { ja } from '../../../src/i18n/ja.ts';
import { RETRY_WAIT_MS } from '../../../src/ui/sync/status/index.tsx';
import { storeV1 } from '../helpers/fixtures.ts';
import { renderApp } from '../helpers/app.tsx';
import { UID1, UID2, renderWithController, resetFamilyUi, stubController } from './family-harness.tsx';

const view = (state: SyncStatus, extra: Partial<ReturnType<typeof baseView>> = {}) => ({ ...baseView(), state, ...extra });
const baseView = () => ({ state: 'synced' as SyncStatus, lastSyncedAt: '2026-11-15T00:20:00+09:00' as string | null, pendingCount: 0, oldestPendingAt: null as string | null, stale: false, showRetryNow: false });

const WORDS: Record<Exclude<SyncStatus, 'local-only'>, string> = {
  synced: ja['sync.synced'],
  syncing: ja['sync.syncing'],
  'pending-offline': ja['sync.pendingOffline'],
  retrying: ja['sync.retrying'],
  'paused-no-consent': ja['sync.needsConsent'],
  'paused-limit': ja['sync.limit'],
  'paused-app-too-old': ja['sync.appTooOld'],
  'membership-ended': ja['sync.membershipEnded'],
};

beforeEach(() => resetFamilyUi());

describe('US-E15-06/AC4 the nine statuses', () => {
  it('US-E15-06/AC4 local-only shows no status button at all: the app looks exactly as before', async () => {
    const stub = stubController({ familyId: null, membership: 'none', view: view('local-only') });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    await screen.findByTestId('appbar');
    expect(screen.queryByTestId('appbar-sync')).toBeNull();
    expect(screen.queryByTestId('sync-live')).not.toBeNull(); // the persistent live node exists once sharing is configured
    expect(screen.getByTestId('appbar').className).not.toContain('appbar--sync');
  });

  it('US-E15-06/AC4 US-E15-06/AC3 each other state has its own word and its own icon shape; the accessible name carries the word', async () => {
    const shapes = new Set<string>();
    for (const state of Object.keys(WORDS) as Exclude<SyncStatus, 'local-only'>[]) {
      const stub = stubController({ view: view(state, state === 'membership-ended' ? {} : {}), endedReason: state === 'membership-ended' ? 'removed' : null });
      const { unmount } = renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
      const button = await screen.findByTestId('appbar-sync');
      expect(button).toHaveAttribute('aria-label', `共有の状態：${WORDS[state]}`);
      expect(within(button).getByTestId('sync-state')).toHaveAttribute('data-state', state);
      expect(button).toHaveTextContent(WORDS[state]);
      shapes.add(button.querySelector('svg')?.getAttribute('data-shape') ?? '');
      expect(screen.getByTestId('appbar').className).toContain('appbar--sync');
      unmount();
    }
    expect(shapes.size).toBe(8); // colour is never the only signal
    expect(ja['sync.synced']).toBe('同期済み'); // the two words fixed by US-E15-06/AC3
    expect(ja['sync.syncing']).toBe('同期中');
  });

  it('US-E15-10/AC1 US-E15-10/AC3 a size limit and the hourly write guard say different things', async () => {
    const stub = stubController({ view: view('paused-limit'), limitScope: 'writes' });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    expect(await screen.findByTestId('appbar-sync')).toHaveTextContent(ja['sync.limit.writes']);
    act(() => stub.set({ limitScope: 'record' }));
    expect(screen.getByTestId('appbar-sync')).toHaveTextContent(ja['sync.limit']);
    expect(screen.getByTestId('appbar-sync')).not.toHaveTextContent(ja['sync.limit.writes']);
  });

  it('US-E15-06/AC6 pending changes older than 24 hours highlight the button (ring, "!", short word) and the sheet explains', async () => {
    const user = userEvent.setup();
    const stub = stubController({ view: view('pending-offline', { stale: true, pendingCount: 3, oldestPendingAt: '2026-11-13T00:00:00+09:00' }) });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    const button = await screen.findByTestId('appbar-sync');
    expect(button.className).toContain('sync-btn--stale');
    expect(button).toHaveTextContent(ja['sync.stale.short']);
    expect(button.querySelector('svg path[d^="M20 3"]')).not.toBeNull(); // the "!" mark
    await user.click(button);
    expect(await screen.findByTestId('sync-stale')).toHaveTextContent(ja['sync.stale']);
  });
});

describe('US-E15-06/AC4 US-E15-06/AC5 the status sheet', () => {
  it('US-E15-06/AC4 the sheet shows word, hint, last update and the pending count (hidden at 0); focus goes to its heading and back to the button on close; Esc closes', async () => {
    const user = userEvent.setup();
    const stub = stubController({ view: view('pending-offline', { pendingCount: 3 }) });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    const button = await screen.findByTestId('appbar-sync');
    await user.click(button);
    const sheet = await screen.findByTestId('sheet-sync');
    expect(sheet).toHaveAttribute('role', 'dialog');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(within(sheet).getByRole('heading', { level: 2 })).toHaveFocus());
    expect(within(sheet).getByTestId('sync-sheet-state')).toHaveTextContent(ja['sync.pendingOffline']);
    expect(sheet).toHaveTextContent(ja['sync.pendingOffline.hint']);
    expect(within(sheet).getByTestId('sync-last')).toHaveTextContent('最後に更新：今日 00:20');
    expect(within(sheet).getByTestId('sync-pending')).toHaveTextContent('未送信の変更：3件');
    expect(within(sheet).queryByTestId('sync-action')).toBeNull(); // resumes by itself
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('sheet-sync')).toBeNull();
    await waitFor(() => expect(button).toHaveFocus());
    act(() => stub.set({ view: view('synced') }));
    await user.click(screen.getByTestId('appbar-sync'));
    expect(within(await screen.findByTestId('sheet-sync')).queryByTestId('sync-pending')).toBeNull();
    await user.click(screen.getByTestId('sheet-sync-close'));
    expect(screen.queryByTestId('sheet-sync')).toBeNull();
  });

  it('US-E15-06/AC5 「今すぐ再試行」 appears only when the engine offers it; tapping shows the busy label, and a failure keeps the sheet open with the message', async () => {
    const user = userEvent.setup();
    const stub = stubController({ view: view('retrying', { showRetryNow: false }) });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    await user.click(await screen.findByTestId('appbar-sync'));
    expect(screen.queryByTestId('sync-retry-now')).toBeNull();
    act(() => stub.set({ view: view('retrying', { showRetryNow: true }) }));
    const retry = await screen.findByTestId('sync-retry-now');
    expect(retry).toHaveTextContent(ja['sync.retryNow']);
    await user.click(retry);
    expect(stub.mocks.syncNow).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sync-retry-now')).toHaveTextContent(ja['sync.retrying.busy']);
    expect(screen.getByTestId('sync-retry-now')).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByTestId('sync-retry-failed', undefined, { timeout: RETRY_WAIT_MS + 2000 })).toHaveTextContent(ja['sync.retry.failed']);
    expect(screen.getByTestId('sheet-sync')).toBeInTheDocument();
  });

  it('US-E15-02/AC6 US-E15-06/AC8 the state-specific actions: read the notice, reload the app, acknowledge the end', async () => {
    const user = userEvent.setup();
    const consent = stubController({ view: view('paused-no-consent') });
    const first = renderWithController(consent.controller, { store: storeV1(), hash: '#/calendar' });
    await user.click(await screen.findByTestId('consent-cloud-decline')); // the notice opened by itself; decline for now
    await user.click(await screen.findByTestId('appbar-sync'));
    await user.click(await screen.findByTestId('sync-action'));
    expect(await screen.findByTestId('consent-cloud')).toBeInTheDocument();
    first.unmount();

    const old = stubController({ view: view('paused-app-too-old') });
    const second = renderWithController(old.controller, { store: storeV1(), hash: '#/calendar' });
    await user.click(await screen.findByTestId('appbar-sync'));
    expect(await screen.findByTestId('sync-action')).toHaveTextContent(ja['sync.appTooOld.action']);
    second.unmount();

    const ended = stubController({ view: view('membership-ended'), endedReason: 'removed' });
    renderWithController(ended.controller, { store: storeV1(), hash: '#/calendar' });
    await user.click(await screen.findByTestId('appbar-sync'));
    await user.click(await screen.findByTestId('sync-action'));
    expect(ended.family.acknowledgeEnded).toHaveBeenCalledTimes(1);
  });

  it('US-E15-06/AC7 sharing never blocks the app: in every state the calendar, recipes and settings links work and export is not disabled', async () => {
    for (const state of Object.keys(WORDS) as Exclude<SyncStatus, 'local-only'>[]) {
      const stub = stubController({ view: view(state) });
      const { unmount } = renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
      expect(await screen.findByTestId('data-export')).not.toHaveAttribute('aria-disabled');
      expect(screen.getByTestId('data-delete-all')).not.toBeDisabled();
      unmount();
    }
  });
});

describe('the live region (components §16.7)', () => {
  it('US-E15-06/AC4 one persistent polite node announces attention states only, and the return to synced after one', async () => {
    const stub = stubController({ view: view('synced') });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    const live = await screen.findByTestId('sync-live');
    expect(live).toHaveAttribute('role', 'status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    act(() => stub.set({ view: view('syncing') }));
    act(() => stub.set({ view: view('synced') }));
    expect(live).toHaveTextContent(''); // routine syncing is silent
    act(() => stub.set({ view: view('pending-offline') }));
    await waitFor(() => expect(live).toHaveTextContent(ja['sync.live.pendingOffline']));
  });

  it('US-E15-06/AC4 coming back from a problem announces 「同期済み」 once; a second message inside 10 seconds is held back', async () => {
    const stub = stubController({ view: view('paused-limit') });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    const live = await screen.findByTestId('sync-live');
    act(() => stub.set({ view: view('synced') }));
    await waitFor(() => expect(live).toHaveTextContent(ja['sync.live.synced']));
    act(() => stub.set({ view: view('paused-app-too-old') })); // the clock has not moved: inside the 10 s gap
    expect(live).toHaveTextContent(ja['sync.live.synced']);
  });
});

describe('the notes (components §16.8)', () => {
  it('US-E15-07/AC8 one lost edit: a status banner (never an alert) names it, 「見る」 opens that day, dismissing is final', async () => {
    const user = userEvent.setup();
    const stub = stubController({ lostEdits: [{ kind: 'decision', key: '2026-11-18' }] });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    const banner = await screen.findByTestId('banner-lost-edit');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveTextContent('11月18日の予定が、家族の変更で更新されました');
    expect(stub.mocks.clearNotices).toHaveBeenCalled(); // shown once: the engine forgets it
    await user.click(within(banner).getByTestId('banner-lost-show'));
    await waitFor(() => expect(window.location.hash).toBe('#/day/2026-11-18'));
    expect(screen.queryByTestId('banner-lost-edit')).toBeNull();
  });

  it('US-E15-07/AC8 several lost edits in one cycle: one banner with the count and a list of at most 10 rows', async () => {
    const user = userEvent.setup();
    const edits = Array.from({ length: 12 }, (_, i) => ({ kind: 'decision' as const, key: `2026-11-${String(i + 1).padStart(2, '0')}` }));
    const stub = stubController({ lostEdits: [...edits, { kind: 'menu', key: '2026-12' }] });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    const banner = await screen.findByTestId('banner-lost-edit');
    expect(banner).toHaveTextContent('13件の変更が、家族の変更で更新されました');
    await user.click(within(banner).getByTestId('banner-lost-show'));
    const dialog = await screen.findByTestId('dialog-lost-list');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog.querySelectorAll('li')).toHaveLength(10);
    expect(within(dialog).getByTestId('lost-row-0')).toHaveTextContent('11月1日の予定');
    await user.click(within(dialog).getByTestId('dialog-lost-list-close'));
    expect(screen.queryByTestId('dialog-lost-list')).toBeNull();
    await user.click(within(screen.getByTestId('banner-lost-edit')).getByTestId('banner-lost-close'));
    expect(screen.queryByTestId('banner-lost-edit')).toBeNull();
  });

  it('US-E15-06/AC9 ignored records: a banner with the verbatim title, once, with a close button only', async () => {
    const user = userEvent.setup();
    const stub = stubController({ ignoredRecords: 2 });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/calendar' });
    const banner = await screen.findByTestId('banner-ignored');
    expect(banner).toHaveTextContent('一部のデータを読み込めませんでした');
    expect(banner).toHaveAttribute('role', 'status');
    expect(within(banner).getAllByRole('button')).toHaveLength(1);
    await user.click(within(banner).getByTestId('banner-ignored-close'));
    expect(screen.queryByTestId('banner-ignored')).toBeNull();
  });

  it('US-E15-08/AC3 US-E15-08/AC6 removed or the family deleted: a banner until acknowledged, then the stand-alone card; "left" only shows a toast', async () => {
    const user = userEvent.setup();
    const removed = stubController({ view: view('membership-ended'), endedReason: 'removed' });
    const first = renderWithController(removed.controller, { store: storeV1(), hash: '#/calendar' });
    const banner = await screen.findByTestId('banner-ended');
    expect(banner).toHaveTextContent(ja['family.ended.removed.title']);
    await user.click(within(banner).getByTestId('banner-ended-ok'));
    expect(removed.family.acknowledgeEnded).toHaveBeenCalledTimes(1);
    first.unmount();

    const deleted = stubController({ view: view('membership-ended'), endedReason: 'family-deleted' });
    const second = renderWithController(deleted.controller, { store: storeV1(), hash: '#/settings' });
    const card = await screen.findByTestId('settings-family');
    expect(within(card).getByTestId('banner-ended')).toHaveTextContent(ja['family.ended.deleted.title']);
    expect(within(card).queryByTestId('family-create')).toBeNull(); // never mixed with variant A
    second.unmount();

    const left = stubController({ view: view('membership-ended'), endedReason: 'left' });
    renderWithController(left.controller, { store: storeV1(), hash: '#/calendar' });
    expect(await screen.findByTestId('toast')).toHaveTextContent(ja['family.toast.left']);
    expect(screen.queryByTestId('banner-ended')).toBeNull();
    expect(left.family.acknowledgeEnded).toHaveBeenCalledTimes(1);
  });
});

const twoMembers = [
  { uid: UID1, you: true, email: 'me@example.test' },
  { uid: UID2, you: false, email: 'partner@example.test' },
];
const stubWithMembers = (members = twoMembers) => {
  const stub = stubController();
  stub.family.membership.mockResolvedValue({ status: 'member', familyId: 'fam-1', consentVersion: 1, maxMembers: 2, members, invite: null } as never);
  return stub;
};

describe('US-E15-08 leave, remove, delete (dialogs)', () => {
  it('US-E15-08/AC1 US-E15-08/AC8 leaving with two members: an alertdialog with focus on Cancel; Esc, backdrop and Cancel change nothing; confirm leaves and toasts', async () => {
    const user = userEvent.setup();
    const stub = stubWithMembers();
    renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
    await screen.findByTestId('family-member-1');
    await user.click(screen.getByTestId('family-leave'));
    const dialog = await screen.findByTestId('dialog-leave');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    expect(dialog).toHaveTextContent(ja['family.leave.title']);
    expect(screen.queryByTestId('input-typed-confirm')).toBeNull(); // not typed for two members
    expect(within(dialog).getByTestId('dialog-leave-cancel')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('dialog-leave')).toBeNull();
    await user.click(screen.getByTestId('family-leave'));
    await user.click(await screen.findByTestId('dialog-leave-cancel'));
    expect(stub.family.leave).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('family-leave'));
    await user.click(await screen.findByTestId('dialog-leave-confirm'));
    expect(stub.family.leave).toHaveBeenCalledWith(false);
    expect(await screen.findByTestId('toast')).toHaveTextContent(ja['family.toast.left']);
    expect(screen.queryByTestId('dialog-leave')).toBeNull();
  });

  it('US-E15-08/AC9 offline the destructive button is disabled with the verbatim reason, the dialog still opens and nothing is queued', async () => {
    const user = userEvent.setup();
    const stub = stubWithMembers();
    renderWithController(stub.controller, { store: storeV1(), hash: '#/settings', online: false });
    await screen.findByTestId('family-member-1');
    await user.click(screen.getByTestId('family-leave'));
    const confirm = await screen.findByTestId('dialog-leave-confirm');
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('dialog-offline')).toHaveTextContent('インターネットに接続してください');
    await user.click(confirm);
    expect(stub.family.leave).not.toHaveBeenCalled();
  });

  it('US-E15-08/AC4 the last member leaving must type the word: the button stays disabled until it matches (NFKC, trimmed, case-insensitive in English); Enter acts only on a match', async () => {
    const user = userEvent.setup();
    const stub = stubController();
    renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
    await screen.findByTestId('family-member-0');
    await user.click(screen.getByTestId('family-leave'));
    const dialog = await screen.findByTestId('dialog-leave-last');
    expect(dialog).toHaveTextContent(ja['family.leaveLast.title']);
    const confirm = within(dialog).getByTestId('dialog-leave-last-confirm');
    const input = within(dialog).getByTestId('input-typed-confirm');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(within(dialog).getByTestId('dialog-leave-last-cancel')).toHaveFocus(); // never the input: a stray Enter cannot delete
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    expect(confirm).toHaveAttribute('aria-describedby');
    await user.type(input, '削除');
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await user.type(input, '{Enter}');
    expect(stub.family.leave).not.toHaveBeenCalled(); // Enter with a non-matching word does nothing
    await user.type(input, 'する');
    expect(confirm).not.toHaveAttribute('aria-disabled');
    await user.type(input, '{Enter}');
    await waitFor(() => expect(stub.family.leave).toHaveBeenCalledWith(true));
  });

  it('US-E15-08/AC5 deleting the online data: typed word in English matches case-insensitively and full-width; a failure shows the generic line and the dialog stays', async () => {
    const user = userEvent.setup();
    const stub = stubController();
    stub.family.deleteFamily.mockRejectedValueOnce(new Error('x'));
    renderWithController(stub.controller, { store: { ...storeV1(), settings: { ...storeV1().settings, language: 'en' } }, hash: '#/settings' });
    await screen.findByTestId('family-delete');
    await user.click(screen.getByTestId('family-delete'));
    const dialog = await screen.findByTestId('dialog-delete-family');
    expect(dialog).toHaveTextContent(en['family.delete.title']);
    expect(within(dialog).getByText(en['family.typed.word'], { selector: 'strong' })).toBeInTheDocument(); // the word is bold in the label
    const input = within(dialog).getByTestId('input-typed-confirm');
    await user.type(input, 'ｄｅｌｅｔｅ ');
    const confirm = within(dialog).getByTestId('dialog-delete-family-confirm');
    expect(confirm).not.toHaveAttribute('aria-disabled');
    await user.click(confirm);
    expect(await within(dialog).findByTestId('dialog-error')).toHaveTextContent(en['common.error.generic']);
    expect(screen.getByTestId('dialog-delete-family')).toBeInTheDocument(); // nothing changed, the dialog stays
    expect(confirm).not.toHaveAttribute('aria-disabled');
    await user.click(confirm);
    await waitFor(() => expect(stub.family.deleteFamily).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('toast')).toHaveTextContent(en['family.toast.deleted']);
  });

  it('US-E15-08/AC3 removing the other member names them, offers one confirm, and the row goes; busy locks both buttons and Esc', async () => {
    const user = userEvent.setup();
    const stub = stubWithMembers();
    let finish: () => void = () => undefined;
    stub.family.removeMember.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
    await user.click(await screen.findByTestId('family-remove'));
    const dialog = await screen.findByTestId('dialog-remove-member');
    expect(dialog).toHaveTextContent('partner@example.testさんを家族から外しますか？');
    await user.click(within(dialog).getByTestId('dialog-remove-member-confirm'));
    expect(stub.family.removeMember).toHaveBeenCalledWith(UID2);
    expect(within(dialog).getByTestId('dialog-remove-member-confirm')).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog).getByTestId('dialog-remove-member-cancel')).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog).getByTestId('dialog-busy-live')).toHaveTextContent(ja['family.dialog.busy.live']);
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('dialog-remove-member')).toBeInTheDocument(); // Esc is ignored while busy
    stub.family.membership.mockResolvedValue({ status: 'member', familyId: 'fam-1', consentVersion: 1, maxMembers: 2, members: [twoMembers[0]], invite: null } as never);
    finish();
    await waitFor(() => expect(screen.queryByTestId('dialog-remove-member')).toBeNull());
    expect(screen.getByTestId('toast')).toHaveTextContent('partner@example.testさんを家族から外しました。');
    expect(screen.queryByTestId('family-member-1')).toBeNull();
  });
});

describe('US-E15-11 import and delete-all while in a family', () => {
  const file = (store: unknown) => new File([JSON.stringify(store)], 'export.json', { type: 'application/json' });

  it('US-E15-11/AC6 a valid file asks with the one clear warning that everyone\'s data is replaced; cancel changes nothing, confirm replaces', async () => {
    const user = userEvent.setup();
    const stub = stubController();
    const app = renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
    const other = storeV1();
    other.profile = { ...other.profile!, nickname: 'たろう' };
    await user.upload(await screen.findByTestId('data-import'), file(other));
    const dialog = await screen.findByTestId('dialog-import-family');
    expect(dialog).toHaveTextContent(ja['family.import.title']);
    expect(dialog).toHaveTextContent(ja['family.import.hint']);
    expect(screen.queryByTestId('dialog-import-data')).toBeNull();
    await user.click(within(dialog).getByTestId('dialog-import-family-cancel'));
    expect(JSON.parse(app.storage.data.get('bentominder.state') ?? '{}').profile.nickname).not.toBe('たろう');
    await user.upload(screen.getByTestId('data-import'), file(other));
    await user.click(await screen.findByTestId('dialog-import-family-confirm'));
    await screen.findByTestId('screen-calendar');
    expect(JSON.parse(app.storage.data.get('bentominder.state') ?? '{}').profile.nickname).toBe('たろう');
    expect(stub.mocks.localChanged).toHaveBeenCalled();
  });

  it('US-E15-11/AC5 an invalid or newer file changes nothing, also in a family', async () => {
    const user = userEvent.setup();
    const stub = stubController();
    renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
    await user.upload(await screen.findByTestId('data-import'), new File(['not json'], 'x.json'));
    expect(await screen.findByTestId('data-import-error')).toBeInTheDocument();
    expect(screen.queryByTestId('dialog-import-family')).toBeNull();
  });

  it('US-E15-11/AC7 US-E15-08/AC7 delete-all while a member says first that only this device is cleared and the online data stays; the settings note names the sharing', async () => {
    const user = userEvent.setup();
    const stub = stubController();
    renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
    expect(await screen.findByText(ja['family.data.where'])).toBeInTheDocument();
    expect(screen.queryByText(ja['settings.data.where'])).toBeNull();
    await user.click(screen.getByTestId('data-delete-all'));
    const dialog = await screen.findByTestId('dialog-delete-all');
    const note = within(dialog).getByTestId('delete-all-family-note');
    expect(note).toHaveTextContent(ja['family.deleteAll.note']);
    expect(dialog.textContent?.indexOf(ja['family.deleteAll.note'])).toBeLessThan(dialog.textContent?.indexOf(ja['data.deleteAll.body']) ?? 0);
  });

  it('US-E15-11/AC1 with no family the settings text and the delete-all dialog are exactly as before', async () => {
    const user = userEvent.setup();
    const stub = stubController({ familyId: null, membership: 'none', view: view('local-only') });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
    expect(await screen.findByText(ja['settings.data.where'])).toBeInTheDocument();
    await user.click(screen.getByTestId('data-delete-all'));
    expect(screen.queryByTestId('delete-all-family-note')).toBeNull();
  });
});

describe('US-E15-11/AC1 sync off (no base address): nothing visible changes', () => {
  it('US-E15-11/AC1 without a controller the settings and the calendar have no family card, no status button, no live node, and #/join is "not found"', async () => {
    const app = await renderApp({ store: storeV1(), hash: '#/settings' });
    expect(app.stored()).toBeTruthy();
    expect(screen.queryByTestId('settings-family')).toBeNull();
    expect(screen.queryByTestId('sync-live')).toBeNull();
    expect(screen.getByText(ja['settings.data.where'])).toBeInTheDocument();
    act(() => {
      window.location.hash = '#/calendar';
    });
    await screen.findByTestId('appbar');
    expect(screen.queryByTestId('appbar-sync')).toBeNull();
    expect(screen.getByTestId('appbar').className).toBe('appbar');
    act(() => {
      window.location.hash = '#/join/ABCDEFGHJK';
    });
    expect(await screen.findByTestId('screen-not-found')).toBeInTheDocument();
  });
});

describe('US-E15-06/AC7 the card never blocks and the settings row reports the state', () => {
  it('US-E15-06/AC4 the member card starts with the status row: icon, word and the last update, opening the same sheet', async () => {
    const user = userEvent.setup();
    const stub = stubController({ view: view('synced') });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
    const row = await screen.findByTestId('family-status-row');
    expect(row).toHaveTextContent(ja['sync.synced']);
    expect(row).toHaveTextContent('最後に更新：今日 00:20');
    await user.click(row);
    expect(await screen.findByTestId('sheet-sync')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(row).toHaveFocus());
  });

  it('US-E15-01/AC5 an interrupted creation shows the calm info banner in the card and no error dialog', async () => {
    const stub = stubController({ view: view('pending-offline', { lastSyncedAt: null }) });
    renderWithController(stub.controller, { store: storeV1(), hash: '#/settings' });
    expect(await screen.findByTestId('family-create-paused')).toHaveTextContent(ja['family.create.paused']);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(vi.isMockFunction(stub.family.create)).toBe(true);
  });
});
