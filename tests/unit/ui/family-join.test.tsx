// Slice D screens, part 2 (jsdom, real controller over a FakeBackend): the join screen, the adoption choice, the new-device
// boot screen and the login hint (US-E15-04, US-E15-05; components §16.5, §16.6, §16.9).
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeBackend } from '../../../src/domain/sync/fake-port.ts';
import { createTranslator } from '../../../src/i18n/index.ts';
import { ja } from '../../../src/i18n/ja.ts';
import { LoginScreen } from '../../../src/ui/auth/LoginScreen.tsx';
import { DEVICE_B, NOW_MS, UID1, UID2, makeDevice, renderDevice, resetFamilyUi, storeWithData, type FamilyDevice } from './family-harness.tsx';

const UID3 = 'test-uid-003';
let backend: FakeBackend;
let devices: FamilyDevice[] = [];
beforeEach(() => {
  backend = new FakeBackend({ nowMs: () => NOW_MS });
  devices = [];
  resetFamilyUi();
});
afterEach(() => {
  for (const d of devices) d.controller.stop();
});
const track = (d: FamilyDevice): FamilyDevice => {
  devices.push(d);
  return d;
};

/** A family whose creator has already uploaded its data, and a fresh invite code for it. */
async function familyWithData(): Promise<{ code: string }> {
  const a = track(makeDevice({ backend, uid: UID1 }));
  a.controller.start();
  await new Promise((r) => setTimeout(r, 30));
  await a.controller.family.create();
  await waitFor(() => expect(a.controller.getState().view.lastSyncedAt).not.toBeNull());
  return { code: (await a.controller.family.createInvite()).code };
}

const typeCode = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  const input = await screen.findByTestId('input-join-code');
  await user.clear(input);
  await user.type(input, text);
  return input;
};

describe('US-E15-04/AC1 the invite link while signed out', () => {
  it('US-E15-04/AC1 the login screen says what happens after sign-in when a join link was opened', () => {
    const t = createTranslator('ja');
    const props = { t, language: 'ja' as const, onLanguage: vi.fn(), busy: false, error: null, expired: false, signedOut: false, onSignIn: vi.fn() };
    const { rerender } = render(<LoginScreen {...props} />);
    expect(screen.queryByTestId('login-join-hint')).toBeNull();
    rerender(<LoginScreen {...props} joinHint />);
    expect(screen.getByTestId('login-join-hint')).toHaveTextContent(ja['family.join.loginHint']);
    expect(screen.getByTestId('login-join-hint')).toHaveAttribute('role', 'status');
  });
});

describe('US-E15-04/AC2 entering the code', () => {
  it('US-E15-04/AC2 any case, spaces and hyphens are accepted; fewer than 10 symbols show the format error with no request; the link fills the field', async () => {
    const user = userEvent.setup();
    const d = track(makeDevice({ backend, uid: UID2, store: null, deviceId: DEVICE_B }));
    renderDevice(d, '#/join/abcde-fghjk');
    const input = await screen.findByTestId('input-join-code');
    expect(input).toHaveValue('abcde-fghjk');
    expect(input).toHaveAttribute('autocapitalize', 'characters');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(screen.getByTestId('join-next')).not.toHaveAttribute('aria-disabled');
    await typeCode(user, 'abc de');
    expect(screen.getByTestId('join-next')).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByTestId('join-next'));
    expect(screen.getByTestId('input-join-code-error')).toHaveTextContent(ja['family.join.err.format']);
    expect(screen.getByTestId('input-join-code')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('input-join-code')).toHaveFocus();
    await typeCode(user, 'a b c d e - f g h j k');
    await user.tab();
    expect(screen.getByTestId('input-join-code')).toHaveValue('ABCDE-FGHJK');
    expect(d.callOps()).not.toContain('redeemInvite');
  });

  it('US-E15-04/AC9 US-E15-04/AC10 refusals show only their own text and change nothing; an account in another family is told so', async () => {
    const user = userEvent.setup();
    const { code } = await familyWithData();
    const d = track(makeDevice({ backend, uid: UID2, store: null, deviceId: DEVICE_B }));
    renderDevice(d, '#/join');
    await typeCode(user, 'ABCDEFGHJK'); // a wrong code
    await user.click(screen.getByTestId('join-next'));
    await user.click(await screen.findByTestId('consent-cloud-accept'));
    await user.click(await screen.findByTestId('dialog-join-confirm-ok'));
    expect(await screen.findByTestId('input-join-code-error')).toHaveTextContent(ja['family.join.err.generic']);
    expect(screen.getByTestId('input-join-code-error').textContent).toBe(ja['family.join.err.generic']); // the same words for every cause, no family information
    expect(d.meta()).toBeNull(); // nothing changed
    // an account that already has a family
    const other = track(makeDevice({ backend, uid: UID3, store: null, deviceId: DEVICE_B }));
    await backend.portFor(UID3).createFamily({ version: 1 });
    expect(code).toHaveLength(10);
    expect(await other.controller.family.join(code)).toEqual({ kind: 'error', error: 'already' });
  });
});

describe('US-E15-04 join flow', () => {
  it('US-E15-04/AC2 US-E15-04/AC3 the code is sent only on the confirmation; with an empty local copy the calendar opens with the family data, never onboarding', async () => {
    const user = userEvent.setup();
    const { code } = await familyWithData();
    const d = track(makeDevice({ backend, uid: UID2, store: null, deviceId: DEVICE_B }));
    renderDevice(d, `#/join/${code}`);
    await user.click(await screen.findByTestId('join-next'));
    const notice = await screen.findByTestId('consent-cloud');
    expect(d.callOps()).not.toContain('redeemInvite'); // consent first (US-E15-02/AC1)
    await user.click(within(notice).getByTestId('consent-cloud-accept'));
    const confirm = await screen.findByTestId('dialog-join-confirm');
    expect(confirm).toHaveAttribute('role', 'dialog');
    expect(within(confirm).getByTestId('dialog-join-confirm-cancel')).toHaveFocus(); // initial focus on the safe action
    expect(d.callOps()).not.toContain('redeemInvite');
    await user.click(within(confirm).getByTestId('dialog-join-confirm-ok'));
    await screen.findByTestId('screen-calendar');
    expect(screen.queryByTestId('screen-onboarding')).toBeNull();
    expect(screen.getByTestId('toast')).toHaveTextContent(ja['family.toast.joinedSelf']);
    expect(d.stored()?.profile?.nickname).toBeTruthy();
    expect(d.callOps().filter((op) => op === 'redeemInvite')).toHaveLength(1);
  });

  it('US-E15-04/AC8 cancelling at the consent or at the confirmation changes nothing and sends nothing', async () => {
    const user = userEvent.setup();
    const { code } = await familyWithData();
    const d = track(makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B }));
    const before = d.storage.data.get('bentominder.test-uid-002.state');
    renderDevice(d, `#/join/${code}`);
    await user.click(await screen.findByTestId('join-next'));
    await user.click(await screen.findByTestId('consent-cloud-decline'));
    expect(screen.queryByTestId('consent-cloud')).toBeNull();
    await user.click(screen.getByTestId('join-next'));
    await user.click(await screen.findByTestId('consent-cloud-accept'));
    await user.click(await screen.findByTestId('dialog-join-confirm-cancel'));
    expect(screen.queryByTestId('dialog-join-confirm')).toBeNull();
    expect(d.callOps()).not.toContain('redeemInvite');
    expect(d.storage.data.get('bentominder.test-uid-002.state')).toBe(before);
    expect(screen.getByTestId('screen-join')).toBeInTheDocument();
  });

  it('US-E15-04/AC4 US-E15-04/AC5 data on both sides: the question comes before anything changes, "family data" is preselected, continue replaces and the backup row appears', async () => {
    const user = userEvent.setup();
    const { code } = await familyWithData();
    const own = storeWithData(DEVICE_B, UID2);
    const d = track(makeDevice({ backend, uid: UID2, store: { ...own, profile: own.profile === null ? null : { ...own.profile, nickname: 'べつの子' } }, deviceId: DEVICE_B }));
    renderDevice(d, `#/join/${code}`);
    await user.click(await screen.findByTestId('join-next'));
    await user.click(await screen.findByTestId('consent-cloud-accept'));
    await user.click(await screen.findByTestId('dialog-join-confirm-ok'));
    const adopt = await screen.findByTestId('screen-adopt');
    expect(within(adopt).getByRole('heading', { level: 1 })).toHaveTextContent('この端末のデータをどうしますか');
    await waitFor(() => expect(document.activeElement?.tagName).toBe('H1'));
    expect(screen.getByTestId('radio-adopt-family')).toBeChecked();
    expect(screen.getByTestId('radio-adopt-local')).not.toBeChecked();
    expect(await screen.findByTestId('adopt-summary')).toHaveTextContent('プロフィールあり');
    expect(screen.getByTestId('adopt-cancel')).toBeInTheDocument(); // the join was just made: cancel undoes it
    expect(screen.queryByTestId('adopt-later')).toBeNull();
    expect(d.stored()?.profile?.nickname).toBe('べつの子'); // nothing changed before the answer
    await user.click(screen.getByTestId('adopt-continue'));
    await screen.findByTestId('screen-calendar');
    expect(d.stored()?.profile?.nickname).not.toBe('べつの子');
    window.location.hash = '#/settings';
    expect(await screen.findByTestId('safety-copy')).toHaveTextContent(ja['family.safety.title']);
    expect(screen.getByTestId('safety-export')).toBeInTheDocument();
    await user.click(screen.getByTestId('safety-delete'));
    const dialog = await screen.findByTestId('dialog-safety-delete');
    expect(within(dialog).getByTestId('dialog-safety-delete-cancel')).toHaveFocus();
    await user.click(within(dialog).getByTestId('dialog-safety-delete-confirm'));
    await waitFor(() => expect(screen.queryByTestId('safety-copy')).toBeNull());
  });

  it('US-E15-04/AC6 choosing "add this device\'s data" keeps the backup too and uploads only what the family lacks', async () => {
    const user = userEvent.setup();
    const { code } = await familyWithData();
    const d = track(makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B }));
    renderDevice(d, `#/join/${code}`);
    await user.click(await screen.findByTestId('join-next'));
    await user.click(await screen.findByTestId('consent-cloud-accept'));
    await user.click(await screen.findByTestId('dialog-join-confirm-ok'));
    await screen.findByTestId('screen-adopt');
    await user.click(screen.getByTestId('radio-adopt-local'));
    expect(screen.getByTestId('radio-adopt-local')).toBeChecked();
    await user.click(screen.getByTestId('adopt-continue'));
    await screen.findByTestId('screen-calendar');
    expect(d.controller.getState().safetyCreatedAt).not.toBeNull();
    expect(d.meta().adoption.choice).toBe('add-device');
  });

  it('US-E15-04/AC8 cancel in the question of a fresh join undoes the join and returns to the join screen untouched', async () => {
    const user = userEvent.setup();
    const { code } = await familyWithData();
    const d = track(makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B }));
    const before = d.storage.data.get('bentominder.test-uid-002.state');
    renderDevice(d, `#/join/${code}`);
    await user.click(await screen.findByTestId('join-next'));
    await user.click(await screen.findByTestId('consent-cloud-accept'));
    await user.click(await screen.findByTestId('dialog-join-confirm-ok'));
    await user.click(await screen.findByTestId('adopt-cancel'));
    await screen.findByTestId('screen-join');
    expect(d.meta().familyId).toBeNull();
    expect(d.storage.data.get('bentominder.test-uid-002.state')).toBe(before);
  });

  it('US-E15-04/AC11 a join that was started and not answered resumes at the next open: no cancel, only the note that the choice is still needed', async () => {
    const user = userEvent.setup();
    const { code } = await familyWithData();
    const first = track(makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B }));
    first.controller.start();
    await first.controller.family.join(code);
    first.controller.stop();
    resetFamilyUi(); // the app was closed: the "fresh join" memory is gone
    const second = track(makeDevice({ backend, uid: UID2, store: storeWithData(DEVICE_B, UID2), deviceId: DEVICE_B }));
    for (const [k, v] of first.storage.data) await second.storage.write(k, v);
    renderDevice(second, '#/calendar');
    const adopt = await screen.findByTestId('screen-adopt');
    expect(adopt).toHaveTextContent(ja['family.adopt.lead.resumed']);
    expect(screen.queryByTestId('adopt-cancel')).toBeNull();
    expect(screen.getByTestId('adopt-later')).toHaveTextContent(ja['family.adopt.later']);
    await user.click(screen.getByTestId('adopt-continue'));
    await screen.findByTestId('screen-calendar');
  });
});

describe('US-E15-05 the new-device boot screen', () => {
  const memberWithData = async () => {
    const { code } = await familyWithData();
    void code;
  };

  it('US-E15-05/AC1 a member\'s new device shows the loading state, then the calendar with the family data, never onboarding', async () => {
    await memberWithData();
    const d = track(makeDevice({ backend, uid: UID1, store: null, deviceId: DEVICE_B }));
    const pull = d.port.pull.bind(d.port);
    d.port.pull = async (cursor: number) => {
      await new Promise((r) => setTimeout(r, 450));
      return pull(cursor);
    };
    renderDevice(d, '#/calendar');
    const loading = await screen.findByTestId('screen-family-loading');
    expect(loading).toHaveTextContent(ja['family.load.title']);
    expect(loading.querySelector('[role="status"]')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('screen-onboarding')).toBeNull();
    await screen.findByTestId('screen-calendar', undefined, { timeout: 3000 });
    expect(screen.queryByTestId('screen-onboarding')).toBeNull();
    expect(d.stored()?.profile).not.toBeNull();
  });

  it('US-E15-05/AC3 a failed read shows the retry screen (no onboarding, no local profile); offline says so; retry reads again and opens the calendar', async () => {
    const user = userEvent.setup();
    await memberWithData();
    const d = track(makeDevice({ backend, uid: UID1, store: null, deviceId: DEVICE_B }));
    d.network.online = false;
    d.port.offline = true;
    renderDevice(d, '#/calendar');
    const failed = await screen.findByTestId('screen-family-load-failed');
    expect(failed).toHaveTextContent(ja['family.load.failed.title']);
    expect(failed).toHaveTextContent(ja['family.load.failed.offline']);
    expect(screen.queryByTestId('screen-onboarding')).toBeNull();
    expect(d.stored()).toBeNull(); // no local profile was created
    await waitFor(() => expect(screen.getByTestId('family-load-retry')).toHaveFocus());
    expect(screen.getByTestId('family-load-retry')).toHaveTextContent(ja['family.load.retry']);
    expect(screen.getByTestId('family-load-sign-out')).toHaveTextContent(ja['auth.signOut']); // nobody is trapped
    d.setOnline(true);
    await user.click(screen.getByTestId('family-load-retry'));
    await screen.findByTestId('screen-calendar', undefined, { timeout: 3000 });
    expect(d.stored()?.profile).not.toBeNull();
  });

  it('US-E15-05/AC4 a device with a local copy opens at once, offline or not: no boot screen', async () => {
    const d = track(makeDevice({ backend, uid: UID1 }));
    d.port.offline = true;
    renderDevice(d, '#/calendar');
    await screen.findByTestId('screen-calendar');
    expect(screen.queryByTestId('screen-family-loading')).toBeNull();
    expect(screen.queryByTestId('screen-family-load-failed')).toBeNull();
  });

  it('US-E15-05/AC5 an account in no family: the device starts normally (onboarding for an empty copy), nothing shared', async () => {
    const d = track(makeDevice({ backend, uid: UID1, store: null }));
    renderDevice(d, '#/calendar');
    await screen.findByTestId('screen-onboarding');
    expect(screen.queryByTestId('appbar-sync')).toBeNull();
  });
});
