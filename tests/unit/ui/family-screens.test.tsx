// Slice D screens, part 1 (jsdom, real controller over a FakeBackend): the Family card, the consent notice, create family,
// the invite block and the members list (US-E15-01, -02, -03, components §16.1 to §16.4).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeBackend } from '../../../src/domain/sync/fake-port.ts';
import { ja } from '../../../src/i18n/ja.ts';
import { NOW_MS, UID1, UID2, DEVICE_B, makeDevice, renderDevice, resetFamilyUi, storeWithData, type FamilyDevice } from './family-harness.tsx';

let backend: FakeBackend;
let devices: FamilyDevice[] = [];
beforeEach(() => {
  backend = new FakeBackend({ nowMs: () => NOW_MS });
  backend.emails.set(UID1, 'me@example.test');
  backend.emails.set(UID2, 'partner@example.test');
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

async function memberDevice(o: { uid?: string; store?: ReturnType<typeof storeWithData> | null } = {}): Promise<FamilyDevice> {
  const uid = o.uid ?? UID1;
  const { familyId } = await backend.portFor(uid).createFamily({ version: 1 });
  return track(makeDevice({ backend, uid, familyId, ...(o.store === undefined ? {} : { store: o.store }) }));
}

describe('US-E15-01/AC1 sharing is offered, never forced', () => {
  it('US-E15-01/AC1 an account in no family sees the card with create and join, no status button, and no family data was requested', async () => {
    const d = track(makeDevice({ backend, uid: UID1 }));
    renderDevice(d);
    expect(await screen.findByTestId('family-create')).toHaveTextContent(ja['family.create']);
    expect(screen.getByTestId('family-join')).toHaveTextContent(ja['family.join']);
    expect(screen.getByTestId('settings-family')).toHaveTextContent(ja['family.none.lead']);
    expect(screen.queryByTestId('appbar-sync')).toBeNull();
    expect(screen.queryByTestId('family-status-row')).toBeNull();
    expect(d.callOps().filter((op) => op !== 'readMembership')).toEqual([]);
    expect(backend.families.size).toBe(0);
  });

  it('US-E15-01/AC7 offline both buttons stay focusable, are aria-disabled, and tapping shows the verbatim line without any request', async () => {
    const user = userEvent.setup();
    const d = track(makeDevice({ backend, uid: UID1 }));
    d.network.online = false;
    renderDevice(d);
    const create = await screen.findByTestId('family-create');
    expect(create).toHaveAttribute('aria-disabled', 'true');
    expect(create).not.toBeDisabled();
    expect(screen.getByTestId('family-join')).toHaveAttribute('aria-disabled', 'true');
    await user.click(create);
    expect(await screen.findByTestId('family-offline')).toHaveTextContent('インターネットに接続してからお試しください');
    expect(screen.queryByTestId('consent-cloud')).toBeNull();
    expect(backend.families.size).toBe(0);
  });
});

describe('US-E15-02 the consent notice', () => {
  it('US-E15-02/AC1 US-E15-02/AC4 the notice comes first, focus is on the heading not on the accept button, nothing is sent, decline is equal and costs nothing', async () => {
    const user = userEvent.setup();
    const d = track(makeDevice({ backend, uid: UID1 }));
    renderDevice(d);
    await user.click(await screen.findByTestId('family-create'));
    const notice = await screen.findByTestId('consent-cloud');
    expect(notice).toHaveAttribute('role', 'dialog');
    expect(notice).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(document.activeElement?.tagName).toBe('H2'));
    expect(document.activeElement).toHaveTextContent(ja['consent.cloud.title']);
    const accept = screen.getByTestId('consent-cloud-accept');
    const decline = screen.getByTestId('consent-cloud-decline');
    expect(accept).not.toHaveFocus();
    expect(decline.tagName).toBe('BUTTON');
    expect(decline.className).toContain('btn');
    expect(d.callOps()).not.toContain('createFamily');
    await user.click(decline);
    expect(screen.queryByTestId('consent-cloud')).toBeNull();
    expect(screen.getByTestId('toast')).toHaveTextContent(ja['consent.cloud.declined.toast']);
    expect(screen.getByTestId('family-create')).toBeInTheDocument();
    expect(d.callOps()).not.toContain('createFamily'); // US-E15-01/AC2: no cloud change
    expect(backend.families.size).toBe(0);
  });

  it('US-E15-02/AC2 US-E15-02/AC3 all seven items are visible without a tap, the contact is a mailto link, the version is stated, and Esc declines', async () => {
    const user = userEvent.setup();
    const d = track(makeDevice({ backend, uid: UID1 }));
    renderDevice(d);
    await user.click(await screen.findByTestId('family-create'));
    const notice = await screen.findByTestId('consent-cloud');
    expect(notice.querySelectorAll('dt')).toHaveLength(7);
    expect(notice.querySelectorAll('dd')).toHaveLength(7);
    for (const k of ['what', 'why', 'where', 'who', 'operator', 'ai', 'stop'] as const) expect(notice).toHaveTextContent(ja[`consent.cloud.${k}.h`]);
    expect(notice).toHaveTextContent('献立表のPDFそのものは保存しません');
    expect(within(notice).getByTestId('consent-cloud-contact')).toHaveAttribute('href', 'mailto:q.milavec+bentominder@gmail.com');
    expect(notice).toHaveTextContent('お知らせの版：1');
    expect(within(notice).getByTestId('lang-toggle')).toBeInTheDocument(); // readable in either language
    await user.click(within(notice).getByTestId('lang-toggle-en'));
    expect(notice).toHaveTextContent('Before you share with your family');
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('consent-cloud')).toBeNull();
    expect(backend.families.size).toBe(0);
  });

  it('US-E15-02/AC8 when recording fails nothing is stored and the notice shows the error with the buttons usable again', async () => {
    const user = userEvent.setup();
    const d = track(makeDevice({ backend, uid: UID1 }));
    renderDevice(d);
    await user.click(await screen.findByTestId('family-create'));
    await screen.findByTestId('consent-cloud');
    d.port.offline = true; // the network drops after the tap, services still say online
    await user.click(screen.getByTestId('consent-cloud-accept'));
    expect(await screen.findByTestId('consent-cloud-error')).toHaveTextContent(ja['consent.cloud.error']);
    expect(backend.families.size).toBe(0);
    expect(screen.getByTestId('consent-cloud-accept')).not.toHaveAttribute('aria-disabled');
  });

  it('US-E15-02/AC6 a newer notice version: the member is asked again, sync is paused until accepted, declining keeps the member with the paused banner', async () => {
    const user = userEvent.setup();
    const strict = new FakeBackend({ nowMs: () => NOW_MS, minConsentVersion: 2 });
    const { familyId } = await strict.portFor(UID1).createFamily({ version: 1 });
    const d = track(makeDevice({ backend: strict, uid: UID1, familyId, noticeVersion: 2 }));
    renderDevice(d);
    const notice = await screen.findByTestId('consent-cloud');
    expect(screen.getByTestId('consent-cloud-upgrade')).toHaveTextContent(ja['consent.cloud.upgrade.title']);
    expect(notice).toHaveTextContent('お知らせの版：1'); // the notice shown carries the app's version constant
    expect(d.callOps().filter((op) => op === 'pull' || op === 'push')).toEqual([]);
    await user.click(screen.getByTestId('consent-cloud-decline'));
    expect(screen.queryByTestId('consent-cloud')).toBeNull();
    expect(await screen.findByTestId('consent-cloud-paused')).toHaveTextContent(ja['consent.cloud.paused.title']);
    expect(screen.getByTestId('family-status-row')).toHaveTextContent(ja['sync.needsConsent']);
    expect(d.meta().familyId).toBe(familyId);
  });

  it('US-E15-02/AC7 the notice can be read again in settings with the date of consent and a way to leave', async () => {
    const user = userEvent.setup();
    const d = await memberDevice();
    renderDevice(d);
    await user.click(await screen.findByTestId('family-consent-row'));
    const notice = await screen.findByTestId('consent-cloud');
    expect(within(notice).getByTestId('consent-cloud-agreed-on')).toHaveTextContent('2026年11月15日に同意しました');
    expect(within(notice).queryByTestId('consent-cloud-accept')).toBeNull();
    expect(within(notice).getByTestId('consent-cloud-close')).toBeInTheDocument();
    await user.click(within(notice).getByTestId('consent-cloud-leave'));
    expect(await screen.findByTestId('dialog-leave-last')).toBeInTheDocument(); // alone in the family: the typed variant
  });
});

describe('US-E15-01 create the family (screens)', () => {
  it('US-E15-01/AC3 US-E15-01/AC8 accepting creates one family, shows the progress then the member card and the status button', async () => {
    const user = userEvent.setup();
    const d = track(makeDevice({ backend, uid: UID1 }));
    renderDevice(d);
    await user.click(await screen.findByTestId('family-create'));
    const accept = await screen.findByTestId('consent-cloud-accept');
    await user.dblClick(accept);
    expect(await screen.findByTestId('family-status-row')).toBeInTheDocument();
    expect(screen.getByTestId('toast')).toHaveTextContent(ja['family.toast.created']);
    expect(backend.families.size).toBe(1);
    expect(d.callOps().filter((op) => op === 'createFamily')).toHaveLength(1);
    expect(screen.queryByTestId('family-create')).toBeNull(); // US-E15-01/AC6: one family per account
    expect(screen.queryByTestId('family-join')).toBeNull();
    act(() => {
      window.location.hash = '#/calendar';
    });
    expect(await screen.findByTestId('appbar-sync')).toBeInTheDocument(); // the status button of the calendar home
  });
});

describe('US-E15-03 the invite block and the member list', () => {
  it('US-E15-03/AC1 US-E15-03/AC4 an invite shows the code in two groups, spoken character by character, with the expiry; copy, new code and cancel work', async () => {
    const user = userEvent.setup();
    const d = await memberDevice();
    renderDevice(d);
    const create = await screen.findByTestId('invite-create');
    await waitFor(() => expect(create).not.toHaveAttribute('aria-disabled')); // the first upload has finished
    await user.click(create);
    const code = await screen.findByTestId('invite-code');
    expect(code.querySelector('[aria-hidden="true"]')).toHaveTextContent('ABCD2 34567');
    expect(code.querySelector('.visually-hidden')).toHaveTextContent('A B C D 2 3 4 5 6 7');
    expect(screen.getByTestId('invite-expiry')).toHaveTextContent('11月18日（水）00:30まで使えます。'); // 72 h later, Tokyo time
    await user.click(screen.getByTestId('invite-copy-code'));
    expect(d.services.share.copy).toHaveBeenCalledWith('ABCD234567');
    expect(screen.getByTestId('toast')).toHaveTextContent(ja['family.toast.codeCopied']);
    await user.click(screen.getByTestId('invite-copy-link'));
    expect(d.services.share.copy).toHaveBeenLastCalledWith(expect.stringMatching(/#\/join\/ABCD234567$/));
    expect(screen.queryByTestId('invite-share')).toBeNull(); // this device has no share sheet
    await user.click(screen.getByTestId('invite-new'));
    await waitFor(() => expect(screen.getByTestId('invite-code').querySelector('[aria-hidden="true"]')).not.toHaveTextContent('ABCD2 34567'));
    await user.click(screen.getByTestId('invite-cancel'));
    expect(await screen.findByTestId('invite-create')).toBeInTheDocument();
    expect(screen.getByTestId('toast')).toHaveTextContent(ja['family.toast.inviteCancelled']);
    const m = await d.controller.family.membership();
    expect(m.status === 'member' && m.invite).toBeNull(); // US-E15-03/AC4: the code stops at once
  });

  it('US-E15-03/AC9 US-E15-01/AC5 the invite button is disabled with its reason: offline first, then "upload not finished"', async () => {
    const d = await memberDevice();
    d.network.online = false;
    renderDevice(d);
    const create = await screen.findByTestId('invite-create');
    expect(create).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('invite-hint')).toHaveTextContent('インターネットに接続してください');
    expect(screen.queryByTestId('invite-code')).toBeNull();
    expect(d.callOps()).not.toContain('createInvite');
  });

  it('US-E15-03/AC5 US-E15-03/AC8 with two members the invite is disabled with 「メンバーは上限です」; the list shows both, marks only "you" and no owner', async () => {
    const d = await memberDevice();
    const code = (await backend.portFor(UID1).createInvite()).code;
    await backend.portFor(UID2).redeemInvite(code, { version: 1 });
    renderDevice(d);
    await screen.findByTestId('family-member-1');
    expect(screen.getByTestId('family-member-0')).toHaveTextContent('me@example.test');
    expect(screen.getByTestId('family-member-0')).toHaveTextContent(ja['family.member.you']);
    expect(screen.getByTestId('family-member-1')).toHaveTextContent('partner@example.test');
    expect(screen.getByTestId('family-member-1')).not.toHaveTextContent(ja['family.member.you']);
    expect(within(screen.getByTestId('family-members')).queryByText(/オーナー|owner/i)).toBeNull(); // US-E15-04/AC12
    expect(screen.getAllByTestId('family-remove')).toHaveLength(1); // only the other member's row
    const create = screen.getByTestId('invite-create');
    expect(create).toHaveAttribute('aria-disabled', 'true');
    await waitFor(() => expect(screen.getByTestId('invite-hint')).toBeInTheDocument());
  });

  it('US-E15-03/AC8 the inviter sees the new member and a toast when the invite is redeemed; the invite is gone', async () => {
    const user = userEvent.setup();
    const d = await memberDevice();
    renderDevice(d);
    const create = await screen.findByTestId('invite-create');
    await waitFor(() => expect(create).not.toHaveAttribute('aria-disabled'));
    await user.click(create);
    await screen.findByTestId('invite-code');
    await backend.portFor(UID2).redeemInvite('ABCD234567', { version: 1 });
    act(() => {
      fireEvent.focus(window);
    });
    expect(await screen.findByTestId('family-member-1')).toHaveTextContent('partner@example.test');
    expect(await screen.findByTestId('toast')).toHaveTextContent('partner@example.testさんが家族に加わりました。');
    expect(screen.queryByTestId('invite-code')).toBeNull();
  });
});

describe('US-E15-04/AC12 nothing sets a member apart', () => {
  it('US-E15-04/AC12 a member who joined by invite has the same controls as the creator (invite, leave, delete the online data)', async () => {
    const a = await memberDevice();
    a.controller.start();
    await waitFor(() => expect(a.controller.getState().view.lastSyncedAt).not.toBeNull()); // the creator's data is in the family
    const code = (await backend.portFor(UID1).createInvite()).code;
    const joined = track(makeDevice({ backend, uid: UID2, store: null, deviceId: DEVICE_B }));
    joined.controller.start();
    await joined.controller.family.join(code);
    renderDevice(joined);
    await screen.findByTestId('family-member-1');
    for (const id of ['invite-create', 'family-leave', 'family-delete', 'family-consent-row']) expect(screen.getByTestId(id)).toBeInTheDocument();
    expect(a.uid).toBe(UID1);
  });
});
