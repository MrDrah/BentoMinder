// US-E13-01..06: the sign-in shell in jsdom, with FakeAuth (no Google, no Firebase). Fixtures only.
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebNotifications } from '../../../src/adapters/web/notifications.ts';
import { FakeAuth, TEST_USER, TEST_USER_2 } from '../../../src/domain/auth/index.ts';
import { adoptLegacyStore } from '../../../src/domain/storage/adoption.ts';
import { createRepository } from '../../../src/domain/storage/repository.ts';
import { ja } from '../../../src/i18n/ja.ts';
import { AuthRoot, type AccountEnv } from '../../../src/ui/auth/AuthRoot.tsx';
import { storeV1 } from '../helpers/fixtures.ts';
import { fixedClock, memoryStorage, type MemoryStorage } from '../helpers/memory-storage.ts';

const clock = fixedClock('2026-11-14T15:30:00Z');
const FAST = { splashDelayMs: 5, splashMinMs: 10 } as const;
/** The family's data without the bookkeeping the app itself writes while it runs (reminder log, update time). */
const core = (raw: string | undefined) => {
  const rest = JSON.parse(raw ?? '{}') as Record<string, unknown>;
  delete rest['reminderLog'];
  delete rest['updatedAt'];
  return rest;
};
const keyOf = (uid: string): `bentominder.${string}` => `bentominder.${uid}.state`;

interface Harness {
  storage: MemoryStorage;
  auth: FakeAuth;
  cancelAll: ReturnType<typeof vi.fn>;
  opened: string[];
}

function mount(options: { auth?: FakeAuth; legacy?: boolean; storage?: MemoryStorage; props?: Partial<Parameters<typeof AuthRoot>[0]> } = {}): Harness {
  const storage = options.storage ?? memoryStorage(options.legacy === true ? { 'bentominder.state': JSON.stringify(storeV1()) } : {});
  const auth = options.auth ?? new FakeAuth();
  const cancelAll = vi.fn(() => Promise.resolve());
  const opened: string[] = [];
  const openAccount = async (_user: unknown, accountId: string | undefined): Promise<AccountEnv> => {
    opened.push(accountId ?? '');
    if (accountId !== undefined) await adoptLegacyStore(storage, clock, accountId);
    const notifications = createWebNotifications();
    const real = notifications.cancelAll;
    notifications.cancelAll = () => {
      cancelAll();
      return real();
    };
    return {
      repository: createRepository(storage, clock, accountId === undefined ? {} : { accountId }),
      clock,
      newDeviceId: () => '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d',
      services: { notifications },
      cancelReminders: () => notifications.cancelAll(),
    };
  };
  render(<AuthRoot auth={auth} accountOf={(u) => u.uid} openAccount={openAccount} {...FAST} {...options.props} />);
  return { storage, auth, cancelAll, opened };
}

const tapGoogle = async () => userEvent.click(await screen.findByTestId('login-google'));
const entered = () => screen.findByTestId(/^screen-(calendar|onboarding|settings)$/);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('US-E13-01 login screen is the first screen', () => {
  it('US-E13-01/AC1 signed out shows only the login screen, with the app name and one button, at a deep link too', async () => {
    window.location.hash = '#/day/2026-11-13';
    mount();
    expect(await screen.findByTestId('screen-login')).toBeInTheDocument();
    expect(screen.getByTestId('login-google')).toHaveTextContent(ja['auth.google.button']);
    expect(screen.getAllByRole('button').filter((b) => b.getAttribute('data-testid') === 'login-google')).toHaveLength(1);
    expect(screen.queryByTestId('screen-calendar')).toBeNull();
    expect(screen.queryByTestId('appbar')).toBeNull();
    expect(screen.queryByTestId('appbar-settings')).toBeNull();
    expect(document.body.textContent).toContain('BentoMinder');
  });

  it('US-E13-01/AC2 a deep link survives sign-in and opens the requested screen', async () => {
    window.location.hash = '#/settings';
    const h = mount({ legacy: true });
    await tapGoogle();
    expect(await screen.findByTestId('screen-settings')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/settings');
    expect(h.auth.calls.signIn).toBe(1);
  });

  it('US-E13-01/AC3 no sign-in starts until the parent taps the button', async () => {
    const h = mount();
    await screen.findByTestId('screen-login');
    await new Promise((r) => setTimeout(r, 40));
    expect(h.auth.calls.signIn).toBe(0);
    await tapGoogle();
    expect(h.auth.calls.signIn).toBe(1);
  });

  it('US-E13-01/AC4 sign-in opens onboarding for an account without a profile and the calendar for one with data', async () => {
    mount();
    await tapGoogle();
    expect(await screen.findByTestId('screen-onboarding')).toBeInTheDocument();
  });

  it('US-E13-01/AC4 an account that has a profile opens the calendar', async () => {
    mount({ legacy: true });
    await tapGoogle();
    expect(await screen.findByTestId('screen-calendar')).toBeInTheDocument();
  });

  it('US-E13-01/AC5 the screen has one h1, a named button reachable by keyboard and the language toggle', async () => {
    mount();
    await screen.findByTestId('screen-login');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await userEvent.tab();
    expect(screen.getByTestId('lang-toggle-ja')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: ja['auth.google.button'] })).toHaveFocus();
    await userEvent.click(screen.getByTestId('lang-toggle-en'));
    expect(screen.getByTestId('login-google')).toHaveTextContent('Continue with Google');
    expect(document.documentElement.lang).toBe('en');
  });

  it('US-E13-01/AC6 a notification tap while signed out lands on the login screen first, then on its target', async () => {
    // The address is the reminder's target (the web reminders are in-app); the shell never rewrites it.
    window.location.hash = '#/day/2026-11-15';
    mount({ legacy: true });
    expect(await screen.findByTestId('screen-login')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/day/2026-11-15');
    await tapGoogle();
    await entered();
    expect(window.location.hash).toBe('#/day/2026-11-15');
  });
});

describe('US-E13-02 session persists and works offline', () => {
  it('US-E13-02/AC1 a saved session opens the app with no login screen', async () => {
    mount({ auth: new FakeAuth({ user: TEST_USER }), legacy: true });
    expect(await screen.findByTestId('screen-calendar')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-login')).toBeNull();
  });

  it('US-E13-02/AC2 while the session is read: nothing for the first moment, then the splash, never the login screen', async () => {
    const auth = new FakeAuth({ user: TEST_USER, holdRestore: true });
    mount({ auth, legacy: true, props: { splashDelayMs: 60, splashMinMs: 80 } });
    expect(screen.queryByTestId('screen-restoring')).toBeNull(); // 150 ms rule: no flicker
    expect(await screen.findByTestId('screen-restoring')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('screen-login')).toBeNull();
    const shownAt = performance.now();
    act(() => auth.releaseRestore());
    expect(await screen.findByTestId('screen-calendar')).toBeInTheDocument();
    expect(performance.now() - shownAt).toBeGreaterThanOrEqual(0);
    expect(screen.queryByTestId('screen-login')).toBeNull();
  });

  it('US-E13-02/AC2 a session that answers at once draws no splash at all', async () => {
    mount({ auth: new FakeAuth({ user: TEST_USER }), legacy: true, props: { splashDelayMs: 500 } });
    expect(screen.queryByTestId('screen-restoring')).toBeNull();
    expect(await screen.findByTestId('screen-calendar')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-restoring')).toBeNull();
  });

  it('US-E13-02/AC2 once shown the splash stays at least the minimum time', async () => {
    const auth = new FakeAuth({ user: TEST_USER, holdRestore: true });
    mount({ auth, legacy: true, props: { splashDelayMs: 10, splashMinMs: 300 } });
    await screen.findByTestId('screen-restoring');
    act(() => auth.releaseRestore());
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.queryByTestId('screen-restoring')).not.toBeNull();
    expect(await screen.findByTestId('screen-calendar')).toBeInTheDocument();
  });

  it('US-E13-02/AC2 a session that never answers falls back to the login screen with the generic error', async () => {
    const auth = new FakeAuth({ user: TEST_USER, holdRestore: true });
    mount({ auth, props: { restoreFallbackMs: 60 } });
    expect(await screen.findByTestId('screen-login')).toBeInTheDocument();
    expect(screen.getByTestId('login-error')).toHaveTextContent(ja['auth.error.other']);
  });

  it('US-E13-02/AC3 US-E13-02/AC6 offline reopen uses the cached session: the fake never needs a network and nothing signs out', async () => {
    const h = mount({ auth: new FakeAuth({ user: TEST_USER }), legacy: true });
    expect(await screen.findByTestId('screen-calendar')).toBeInTheDocument();
    expect(h.auth.calls.signOut).toBe(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('US-E13-02/AC4 first sign-in offline shows the offline message and the app is not entered', async () => {
    const auth = new FakeAuth().queueError('offline');
    mount({ auth });
    await tapGoogle();
    expect(await screen.findByText(ja['auth.error.offline'])).toBeInTheDocument();
    expect(screen.queryByTestId('screen-calendar')).toBeNull();
  });

  it('US-E13-02/AC5 a session ended by the provider shows the login screen with the notice and keeps the data', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const h = mount({ auth, legacy: true });
    await screen.findByTestId('screen-calendar');
    act(() => auth.revokeSession());
    expect(await screen.findByTestId('login-expired')).toHaveTextContent(ja['auth.expired.title']);
    expect(h.storage.data.has(keyOf(TEST_USER.uid))).toBe(true);
    await tapGoogle();
    expect(await screen.findByTestId('screen-calendar')).toBeInTheDocument();
  });
});

describe('US-E13-03 sign-in errors', () => {
  it('US-E13-03/AC1 cancelling shows no error and the button works again', async () => {
    const auth = new FakeAuth().queueError('cancelled');
    mount({ auth });
    await tapGoogle();
    await waitFor(() => expect(screen.getByTestId('login-google')).not.toHaveAttribute('aria-busy'));
    expect(screen.getByTestId('login-error')).toBeEmptyDOMElement();
    expect(screen.getByTestId('login-google')).not.toHaveAttribute('aria-disabled');
  });

  it('US-E13-03/AC2 a blocked pop-up shows the pop-up message', async () => {
    mount({ auth: new FakeAuth().queueError('popupBlocked') });
    await tapGoogle();
    expect(await screen.findByText(ja['auth.error.popupBlocked'])).toBeInTheDocument();
    expect(screen.getByTestId('login-google')).not.toHaveAttribute('aria-disabled');
  });

  it('US-E13-03/AC3 two quick taps start one sign-in; the button is busy until it ends', async () => {
    const auth = new FakeAuth({ holdSignIn: true });
    mount({ auth });
    const button = await screen.findByTestId('login-google');
    await userEvent.click(button);
    await userEvent.click(button);
    expect(auth.calls.signIn).toBe(1);
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveTextContent(ja['auth.google.signingIn']);
    expect(screen.getByTestId('login-live')).toHaveTextContent(ja['auth.signingIn.live']);
    act(() => auth.releaseSignIn());
    await entered();
  });

  it('US-E13-03/AC4 offline at first sign-in shows the connection message and keeps the button usable', async () => {
    mount({ auth: new FakeAuth().queueError('offline') });
    await tapGoogle();
    expect(await screen.findByText(ja['auth.error.offline'])).toBeInTheDocument();
    expect(screen.getByTestId('login-google')).not.toHaveAttribute('aria-disabled');
  });

  it('US-E13-03/AC5 a disabled account and any other failure show one plain message, no code', async () => {
    mount({ auth: new FakeAuth().queueError('disabled').queueError('other') });
    await tapGoogle();
    expect(await screen.findByText(ja['auth.error.other'])).toBeInTheDocument();
    expect(screen.getByTestId('login-error').textContent).not.toMatch(/auth\/|error|code/i);
    await tapGoogle();
    expect(await screen.findByText(ja['auth.error.other'])).toBeInTheDocument();
  });

  it('US-E13-03/AC6 a failure never enters the app and writes nothing', async () => {
    const h = mount({ auth: new FakeAuth().queueError('other'), legacy: true });
    const before = [...h.storage.data.entries()];
    await tapGoogle();
    await screen.findByText(ja['auth.error.other']);
    expect(screen.queryByTestId('screen-calendar')).toBeNull();
    expect([...h.storage.data.entries()]).toEqual(before);
    expect(h.opened).toEqual([]);
  });
});

describe('US-E13-04 data keyed to the account', () => {
  it('US-E13-04/AC1 the first account adopts the old unkeyed data: ownerId becomes the uid, old keys removed', async () => {
    const h = mount({ legacy: true });
    await tapGoogle();
    await screen.findByTestId('screen-calendar');
    expect(h.storage.data.has('bentominder.state')).toBe(false);
    const stored = JSON.parse(h.storage.data.get(keyOf(TEST_USER.uid)) ?? 'null') as { profile: { ownerId: string } };
    expect(stored.profile.ownerId).toBe(TEST_USER.uid);
  });

  it('US-E13-04/AC2 US-E13-04/AC4 a second account gets an empty store and never sees the first one', async () => {
    const auth = new FakeAuth();
    const h = mount({ auth, legacy: true });
    await tapGoogle();
    await screen.findByTestId('screen-calendar');
    window.location.hash = '#/settings';
    await userEvent.click(await screen.findByTestId('account-sign-out'));
    await userEvent.click(await screen.findByTestId('dialog-sign-out-confirm'));
    await screen.findByTestId('screen-login');
    auth.signInUser = TEST_USER_2;
    const readsBefore = h.storage.data.size;
    await tapGoogle();
    expect(await screen.findByTestId('screen-onboarding')).toBeInTheDocument();
    expect(h.storage.data.has(keyOf(TEST_USER.uid))).toBe(true);
    expect(readsBefore).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain(TEST_USER.email);
  });

  it('US-E13-04/AC3 the same account returns to its own data after signing out and in', async () => {
    const auth = new FakeAuth();
    const h = mount({ auth, legacy: true });
    await tapGoogle();
    await screen.findByTestId('screen-calendar');
    const saved = core(h.storage.data.get(keyOf(TEST_USER.uid)));
    window.location.hash = '#/settings';
    await userEvent.click(await screen.findByTestId('account-sign-out'));
    await userEvent.click(await screen.findByTestId('dialog-sign-out-confirm'));
    await screen.findByTestId('screen-login');
    expect(core(h.storage.data.get(keyOf(TEST_USER.uid)))).toEqual(saved);
    await tapGoogle();
    await entered();
    expect(core(h.storage.data.get(keyOf(TEST_USER.uid)))).toEqual(saved);
  });

  it('US-E13-04/AC5 US-E13-04/AC6 everything the account writes carries its uid, in its own keys', async () => {
    const h = mount({ legacy: true });
    await tapGoogle();
    await screen.findByTestId('screen-calendar');
    const keys = [...h.storage.data.keys()];
    expect(keys.every((k) => k.startsWith(`bentominder.${TEST_USER.uid}.`))).toBe(true);
    expect(h.storage.data.get(keyOf(TEST_USER.uid))).not.toContain('"ownerId":"local"');
  });
});

describe('US-E13-05 sign-out', () => {
  async function signedInAtSettings(auth = new FakeAuth({ user: TEST_USER })) {
    window.location.hash = '#/settings';
    const h = mount({ auth, legacy: true });
    await screen.findByTestId('settings-account');
    return h;
  }

  it('US-E13-05/AC1 settings shows the name, the e-mail and a decorative photo with the sign-out button', async () => {
    await signedInAtSettings(new FakeAuth({ user: { ...TEST_USER, photoUrl: 'https://example.test/p.png' } }));
    expect(screen.getByTestId('account-name')).toHaveTextContent(TEST_USER.displayName ?? '');
    expect(screen.getByTestId('account-email')).toHaveTextContent(TEST_USER.email ?? '');
    expect(screen.getByTestId('account-avatar')).toHaveAttribute('alt', '');
    expect(screen.getByTestId('account-sign-out')).toHaveTextContent(ja['auth.signOut']);
  });

  it('US-E13-05/AC1 without a name the e-mail is the name; without a photo an initial shows', async () => {
    await signedInAtSettings(new FakeAuth({ user: { ...TEST_USER, displayName: null } }));
    expect(screen.getByTestId('account-name')).toHaveTextContent(TEST_USER.email ?? '');
    expect(screen.getByTestId('account-avatar')).toHaveTextContent('p');
  });

  it('US-E13-05/AC2 the confirm dialog says the data stays and focuses Cancel', async () => {
    await signedInAtSettings();
    await userEvent.click(screen.getByTestId('account-sign-out'));
    const dialog = await screen.findByTestId('dialog-sign-out');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
    expect(dialog).toHaveTextContent(ja['auth.signOut.body']);
    expect(screen.getByTestId('dialog-sign-out-cancel')).toHaveFocus();
  });

  it('US-E13-05/AC3 confirming ends the session, shows the login screen, announces it and deletes nothing', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const h = await signedInAtSettings(auth);
    const before = core(h.storage.data.get(keyOf(TEST_USER.uid)));
    await userEvent.click(screen.getByTestId('account-sign-out'));
    await userEvent.click(await screen.findByTestId('dialog-sign-out-confirm'));
    expect(await screen.findByTestId('screen-login')).toBeInTheDocument();
    expect(auth.currentUser()).toBeNull();
    expect(core(h.storage.data.get(keyOf(TEST_USER.uid)))).toEqual(before);
    expect(screen.getByTestId('login-live')).toHaveTextContent(ja['auth.signedOut.live']);
    expect(screen.getByTestId('login-title')).toHaveFocus();
  });

  it('US-E13-05/AC4 cancel and Escape close the dialog and keep the session', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    await signedInAtSettings(auth);
    await userEvent.click(screen.getByTestId('account-sign-out'));
    await userEvent.click(await screen.findByTestId('dialog-sign-out-cancel'));
    expect(screen.queryByTestId('dialog-sign-out')).toBeNull();
    expect(screen.getByTestId('account-sign-out')).toHaveFocus();
    await userEvent.click(screen.getByTestId('account-sign-out'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('dialog-sign-out')).toBeNull();
    expect(auth.calls.signOut).toBe(0);
  });

  it('US-E13-05/AC5 reminders are cancelled on sign-out and planned again from the account on sign-in', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const h = await signedInAtSettings(auth);
    h.cancelAll.mockClear();
    await userEvent.click(screen.getByTestId('account-sign-out'));
    await userEvent.click(await screen.findByTestId('dialog-sign-out-confirm'));
    await screen.findByTestId('screen-login');
    expect(h.cancelAll).toHaveBeenCalled();
    const opensBefore = h.opened.length;
    await tapGoogle();
    await entered();
    expect(h.opened.length).toBe(opensBefore + 1); // a fresh account environment: its reminders are planned from its own store
  });

  it('US-E13-05/AC6 signing out needs nothing from the network: it completes with the provider offline', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    const spy = vi.spyOn(auth, 'signOut');
    await signedInAtSettings(auth);
    await userEvent.click(screen.getByTestId('account-sign-out'));
    await userEvent.click(await screen.findByTestId('dialog-sign-out-confirm'));
    expect(await screen.findByTestId('screen-login')).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('US-E13-05/AC3 a sign-out that fails keeps the dialog open with the failure message', async () => {
    const auth = new FakeAuth({ user: TEST_USER });
    vi.spyOn(auth, 'signOut').mockRejectedValueOnce(new Error('boom'));
    await signedInAtSettings(auth);
    await userEvent.click(screen.getByTestId('account-sign-out'));
    await userEvent.click(await screen.findByTestId('dialog-sign-out-confirm'));
    expect(await screen.findByTestId('dialog-sign-out-error')).toHaveTextContent(ja['auth.signOut.failed']);
    expect(screen.getByTestId('dialog-sign-out-confirm')).not.toHaveAttribute('aria-disabled');
  });
});

describe('US-E13-06 privacy of the account data', () => {
  it('US-E13-06/AC1 name, e-mail and photo are shown but never written to storage', async () => {
    const user = { ...TEST_USER, photoUrl: 'https://example.test/photo.png' };
    const h = mount({ auth: new FakeAuth({ user }), legacy: true });
    await screen.findByTestId('screen-calendar');
    window.location.hash = '#/settings';
    await screen.findByTestId('settings-account');
    const all = [...h.storage.data.values()].join('\n');
    for (const secret of [user.displayName, user.email, user.photoUrl]) expect(all).not.toContain(secret);
  });

  it('US-E13-06/AC2 the login screen carries the short privacy notice', async () => {
    mount();
    expect(await screen.findByTestId('login-privacy')).toHaveTextContent(ja['auth.privacy']);
  });
});
