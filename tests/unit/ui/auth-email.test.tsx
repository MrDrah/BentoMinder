// US-E13-08: e-mail + password sign-in through the real shell with FakeAuth (no Google, no Firebase). Fixtures only.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeAuth, type AuthUser, type FakeAccount } from '../../../src/domain/auth/index.ts';
import { adoptLegacyStore } from '../../../src/domain/storage/adoption.ts';
import { createRepository } from '../../../src/domain/storage/repository.ts';
import { storeV1 } from '../helpers/fixtures.ts';
import { en } from '../../../src/i18n/en.ts';
import { ja } from '../../../src/i18n/ja.ts';
import { AuthRoot, type AccountEnv } from '../../../src/ui/auth/AuthRoot.tsx';
import { fixedClock, memoryStorage } from '../helpers/memory-storage.ts';

const clock = fixedClock('2026-11-14T15:30:00Z');
const FAST = { splashDelayMs: 5, splashMinMs: 10 } as const;
const PW = 'correct-horse-1';
const CONFIRMED: FakeAccount = { email: 'mama@example.test', uid: 'pw-uid-100', provider: 'password', password: PW, verified: true };
const UNCONFIRMED: FakeAccount = { email: 'papa@example.test', uid: 'pw-uid-101', provider: 'password', password: PW, verified: false };
const GOOGLE: FakeAccount = { email: 'g@example.test', uid: 'google-uid-1', provider: 'google', verified: true };
const userOf = (a: FakeAccount): AuthUser => ({ uid: a.uid, displayName: null, email: a.email, photoUrl: null, emailVerified: a.verified, provider: a.provider });

function mount(auth: FakeAuth, extra: Partial<Parameters<typeof AuthRoot>[0]> = {}, legacy = false) {
  const storage = memoryStorage(legacy ? { 'bentominder.state': JSON.stringify(storeV1()) } : {});
  const opened: string[] = [];
  const openAccount = async (_user: AuthUser, accountId: string | undefined): Promise<AccountEnv> => {
    opened.push(accountId ?? '');
    if (accountId !== undefined) await adoptLegacyStore(storage, clock, accountId);
    return {
      repository: createRepository(storage, clock, accountId === undefined ? {} : { accountId }),
      clock,
      newDeviceId: () => '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d',
      services: {},
      cancelReminders: () => Promise.resolve(),
    };
  };
  render(<AuthRoot auth={auth} accountOf={(u) => u.uid} openAccount={openAccount} {...FAST} {...extra} />);
  return { opened };
}

const fill = async (email: string, password: string) => {
  const user = userEvent.setup();
  const e = await screen.findByTestId('login-email');
  await user.clear(e);
  if (email !== '') await user.type(e, email);
  const p = screen.queryByTestId('login-password');
  if (p !== null && password !== '') await user.type(p, password);
  return user;
};
const submit = async () => userEvent.click(await screen.findByTestId('login-submit'));
const formError = () => screen.getByTestId('login-form-error').textContent;

afterEach(() => {
  vi.useRealTimers();
  window.location.hash = '';
});

describe('US-E13-08/AC1 AC10 the login screen offers both ways', () => {
  it('US-E13-08/AC1 Google, the e-mail form with sign-in and create, and no app screen', async () => {
    mount(new FakeAuth());
    expect(await screen.findByTestId('screen-login')).toBeInTheDocument();
    expect(screen.getByTestId('login-google')).toHaveTextContent(ja['auth.google.button']);
    expect(screen.getByTestId('login-submit')).toHaveTextContent('ログイン');
    expect(screen.getByTestId('login-mode-toggle')).toHaveTextContent('アカウントを作る');
    expect(screen.queryByTestId('appbar')).toBeNull();
    expect(screen.queryByTestId('screen-calendar')).toBeNull();
  });

  it('US-E13-08/AC10 labelled fields with the right types and autocomplete values, a show/hide control, no placeholders', async () => {
    mount(new FakeAuth());
    const email = await screen.findByLabelText(ja['auth.pw.email']);
    const password = screen.getByLabelText(ja['auth.pw.password']);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(email).toHaveAttribute('inputmode', 'email');
    expect(email).toHaveAttribute('name', 'email');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).not.toHaveAttribute('minlength');
    expect(email).not.toHaveAttribute('placeholder');
    const toggle = screen.getByTestId('login-password-toggle');
    expect(toggle).toHaveAccessibleName(ja['auth.pw.show.aria']);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAccessibleName(ja['auth.pw.hide.aria']);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByTestId('login-mode-toggle'));
    expect(screen.getByLabelText(ja['auth.pw.password'])).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText(ja['auth.pw.password'])).toHaveAttribute('type', 'password'); // hidden again on a mode change
    expect(screen.getByText(ja['auth.pw.hint'])).toBeInTheDocument();
  });

  it('US-E13-08/AC10 the strings follow the language toggle (en)', async () => {
    mount(new FakeAuth(), { initialLanguage: 'en' });
    expect(await screen.findByTestId('login-submit')).toHaveTextContent(en['auth.pw.signIn']);
    expect(screen.getByLabelText(en['auth.pw.email'])).toBeInTheDocument();
  });
});

describe('US-E13-08/AC2 AC3 AC4 create, confirm, resend', () => {
  it('US-E13-08/AC2 create sends one confirmation e-mail and shows the check-your-email screen, not the app', async () => {
    const auth = new FakeAuth();
    const h = mount(auth);
    await fill('new@example.test', 'password1');
    await userEvent.click(screen.getByTestId('login-mode-toggle'));
    await fill('new@example.test', 'password1');
    await submit();
    expect(await screen.findByTestId('screen-verify-email')).toBeInTheDocument();
    expect(auth.verificationsSent).toEqual(['new@example.test']);
    expect(screen.getByTestId('verify-address')).toHaveTextContent('new@example.test');
    expect(screen.getByTestId('verify-done')).toHaveTextContent(ja['auth.verify.done']);
    expect(screen.getByTestId('verify-resend')).toHaveAttribute('aria-disabled', 'true'); // the first e-mail was just sent
    expect(screen.getByTestId('verify-sign-out')).toHaveTextContent(ja['auth.signOut']);
    expect(screen.getByTestId('verify-live')).toHaveTextContent(ja['auth.verify.sent']);
    expect(screen.getByTestId('verify-title')).toHaveFocus();
    expect(screen.queryByTestId('appbar')).toBeNull();
    expect(h.opened).toEqual([]);
  });

  it('US-E13-08/AC3 an unconfirmed account (sign-in or reopen) sees only the verify screen; nothing starts: no account opened, no token asked', async () => {
    const auth = new FakeAuth({ user: userOf(UNCONFIRMED) }).addAccount(UNCONFIRMED);
    const h = mount(auth);
    expect(await screen.findByTestId('screen-verify-email')).toBeInTheDocument();
    expect(screen.getByTestId('verify-resend')).not.toHaveAttribute('aria-disabled'); // from a reopen the resend starts enabled
    await new Promise((r) => setTimeout(r, 60));
    expect(h.opened).toEqual([]);
    expect(auth.tokenRequests).toEqual([]);
    expect(auth.calls.reloadUser).toBe(0);
    expect(screen.queryByTestId('screen-onboarding')).toBeNull();
  });

  it('US-E13-08/AC3 signing in to an unconfirmed account also stops at the verify screen', async () => {
    const auth = new FakeAuth().addAccount(UNCONFIRMED);
    const h = mount(auth);
    await fill(UNCONFIRMED.email, PW);
    await submit();
    expect(await screen.findByTestId('screen-verify-email')).toBeInTheDocument();
    expect(h.opened).toEqual([]);
  });

  it('US-E13-08/AC3 "not yet" shows the plain message; after the link, 「確認しました」 opens the app with a refreshed token and no second sign-in', async () => {
    const auth = new FakeAuth({ user: userOf(UNCONFIRMED) }).addAccount(UNCONFIRMED);
    const h = mount(auth);
    await userEvent.click(await screen.findByTestId('verify-done'));
    await waitFor(() => expect(screen.getByTestId('verify-error')).toHaveTextContent(ja['auth.verify.notYet']));
    expect(h.opened).toEqual([]);
    auth.confirmEmail(UNCONFIRMED.email);
    await userEvent.click(screen.getByTestId('verify-done'));
    expect(await screen.findByTestId('screen-onboarding')).toBeInTheDocument();
    expect(h.opened).toEqual([UNCONFIRMED.uid]);
    expect(auth.tokenRequests).toContain(true); // forced refresh
    expect(auth.calls.signIn + auth.calls.signInWithEmail).toBe(0);
  });

  it('US-E13-08/AC3 an offline check shows the offline message and stays on the screen', async () => {
    const auth = new FakeAuth({ user: userOf(UNCONFIRMED) }).addAccount(UNCONFIRMED).queueError('offline');
    mount(auth);
    await userEvent.click(await screen.findByTestId('verify-done'));
    await waitFor(() => expect(screen.getByTestId('verify-error')).toHaveTextContent(ja['auth.error.offline']));
  });

  it('US-E13-08/AC4 resend: at most one e-mail per 60 seconds, the button counts down, then works again', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval'] });
    const auth = new FakeAuth({ user: userOf(UNCONFIRMED) }).addAccount(UNCONFIRMED);
    mount(auth);
    const resend = await screen.findByTestId('verify-resend');
    await act(async () => {
      fireEvent.click(resend);
    });
    expect(auth.verificationsSent).toEqual([UNCONFIRMED.email]);
    expect(resend).toHaveAttribute('aria-disabled', 'true');
    expect(resend).toHaveTextContent('あと60秒');
    expect(screen.getByTestId('verify-live')).toHaveTextContent(ja['auth.verify.sent']);
    await act(async () => {
      fireEvent.click(resend); // still cooling down: nothing is sent
    });
    expect(auth.verificationsSent).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(resend).toHaveTextContent('あと30秒');
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(resend).not.toHaveAttribute('aria-disabled');
    expect(resend).toHaveTextContent(ja['auth.verify.resend']);
    expect(screen.getByTestId('verify-live')).toHaveTextContent(ja['auth.verify.canResend']);
    await act(async () => {
      fireEvent.click(resend);
    });
    expect(auth.verificationsSent).toHaveLength(2);
  });

  it('US-E13-08/AC7 a resend refused for too many requests says so plainly', async () => {
    const auth = new FakeAuth({ user: userOf(UNCONFIRMED) }).addAccount(UNCONFIRMED).queueError('tooMany');
    mount(auth);
    await userEvent.click(await screen.findByTestId('verify-resend'));
    await waitFor(() => expect(screen.getByTestId('verify-error')).toHaveTextContent(ja['auth.pw.error.tooMany']));
  });

  it('US-E13-08/AC3 AC11 「ログアウト」 on the verify screen signs out at once and shows the login screen', async () => {
    const auth = new FakeAuth({ user: userOf(UNCONFIRMED) }).addAccount(UNCONFIRMED);
    mount(auth);
    await userEvent.click(await screen.findByTestId('verify-sign-out'));
    expect(await screen.findByTestId('screen-login')).toBeInTheDocument();
    expect(auth.calls.signOut).toBe(1);
  });
});

describe('US-E13-08/AC5 sign in with e-mail and password', () => {
  it('US-E13-08/AC5 a confirmed account opens the app keyed by its uid, like Google', async () => {
    const auth = new FakeAuth().addAccount(CONFIRMED);
    const h = mount(auth);
    await fill(CONFIRMED.email, PW);
    await submit();
    expect(await screen.findByTestId('screen-onboarding')).toBeInTheDocument();
    expect(h.opened).toEqual([CONFIRMED.uid]);
  });

  it('US-E13-08/AC5 a reopen keeps the session (persistence is the same as Google)', async () => {
    const auth = new FakeAuth({ user: userOf(CONFIRMED) }).addAccount(CONFIRMED);
    mount(auth);
    expect(await screen.findByTestId('screen-onboarding')).toBeInTheDocument();
    expect(auth.calls.signInWithEmail).toBe(0);
  });

  it('US-E13-08/AC5 Enter in a field submits', async () => {
    const auth = new FakeAuth().addAccount(CONFIRMED);
    mount(auth);
    const user = await fill(CONFIRMED.email, PW);
    await user.keyboard('{Enter}');
    expect(await screen.findByTestId('screen-onboarding')).toBeInTheDocument();
  });
});

describe('US-E13-08/AC6 forgot password', () => {
  it('US-E13-08/AC6 the same neutral message for an address with and without an account; only a real one gets an e-mail', async () => {
    for (const [address, sent] of [
      [CONFIRMED.email, [CONFIRMED.email]],
      ['nobody@example.test', []],
    ] as const) {
      const auth = new FakeAuth().addAccount(CONFIRMED);
      mount(auth);
      await userEvent.click(await screen.findByTestId('login-forgot'));
      expect(screen.getByTestId('login-title')).toHaveFocus();
      expect(screen.queryByTestId('login-google')).toBeNull(); // Google and the divider are hidden in forgot mode
      await fill(address, '');
      await submit();
      const panel = await screen.findByTestId('login-reset-sent');
      expect(panel).toHaveTextContent(ja['auth.pw.resetSent.title']);
      expect(panel).toHaveTextContent(ja['auth.pw.resetSent.body']);
      expect(auth.resetsSent).toEqual(sent);
      expect(screen.queryByTestId('login-email')).toBeNull();
      expect(screen.getByTestId('login-mode-toggle')).toHaveTextContent(ja['auth.pw.backToSignIn']);
      document.body.innerHTML = '';
    }
  });
});

describe('US-E13-08/AC7 AC8 plain errors', () => {
  it('US-E13-08/AC7 empty and invalid e-mail, empty and short password: each its own field message, before any request', async () => {
    const auth = new FakeAuth();
    mount(auth);
    await submit();
    expect(await screen.findByTestId('login-email-error')).toHaveTextContent(ja['auth.pw.error.emailEmpty']);
    expect(screen.getByTestId('login-email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('login-email')).toHaveFocus();
    await fill('bad', 'x');
    await submit();
    expect(screen.getByTestId('login-email-error')).toHaveTextContent(ja['auth.pw.error.emailInvalid']);
    await userEvent.click(screen.getByTestId('login-mode-toggle'));
    await fill('ok@example.test', '1234567');
    await submit();
    expect(screen.getByTestId('login-password-error')).toHaveTextContent(ja['auth.pw.error.passwordShort']);
    expect(auth.calls.createAccount + auth.calls.signInWithEmail).toBe(0);
  });

  it('US-E13-08/AC7 wrong e-mail or password is one message, never says which; the password is cleared and focused', async () => {
    const auth = new FakeAuth().addAccount(CONFIRMED);
    mount(auth);
    await fill(CONFIRMED.email, 'not-the-password');
    await submit();
    await waitFor(() => expect(formError()).toContain(ja['auth.pw.error.wrong']));
    const first = formError();
    expect(screen.getByTestId('login-password')).toHaveValue('');
    expect(screen.getByTestId('login-email')).toHaveValue(CONFIRMED.email);
    expect(screen.getByTestId('login-password')).toHaveFocus();
    await fill('nobody@example.test', 'not-the-password');
    await submit();
    await waitFor(() => expect(formError()).toBe(first));
  });

  it('US-E13-08/AC7 too many attempts and offline show their own plain messages, and no error code or technical text', async () => {
    const auth = new FakeAuth().queueError('tooMany').queueError('offline').queueError('other');
    mount(auth);
    const expected = [ja['auth.pw.error.tooMany'], ja['auth.error.offline'], ja['auth.error.other']];
    for (const text of expected) {
      await fill('a@example.test', 'password1');
      await submit();
      await waitFor(() => expect(formError()).toContain(text));
      expect(document.body.textContent).not.toMatch(/auth\/|FirebaseError|Error:/);
    }
  });

  it('US-E13-08/AC8 an address already used with Google gives the one plain message and nothing is merged', async () => {
    const auth = new FakeAuth().addAccount(GOOGLE);
    const h = mount(auth);
    await userEvent.click(await screen.findByTestId('login-mode-toggle'));
    await fill(GOOGLE.email, 'password1');
    await submit();
    await waitFor(() => expect(formError()).toContain(ja['auth.pw.error.inUse']));
    expect(auth.currentUser()).toBeNull();
    expect(h.opened).toEqual([]);
  });

  it('US-E13-08/AC7 an invalid e-mail or weak password reported by the provider lands on its field', async () => {
    const auth = new FakeAuth().queueError('invalidEmail').queueError('weakPassword');
    mount(auth);
    await userEvent.click(await screen.findByTestId('login-mode-toggle'));
    await fill('a@example.test', 'password1');
    await submit();
    expect(await screen.findByTestId('login-email-error')).toHaveTextContent(ja['auth.pw.error.emailInvalid']);
    await fill('a@example.test', 'password1');
    await submit();
    expect(await screen.findByTestId('login-password-error')).toHaveTextContent(ja['auth.pw.error.passwordShort']);
  });

  it('US-E13-08/AC7 a Google error stays under the Google button and a form error under the form', async () => {
    const auth = new FakeAuth().queueError('popupBlocked').queueError('wrong');
    mount(auth);
    await userEvent.click(await screen.findByTestId('login-google'));
    await waitFor(() => expect(screen.getByTestId('login-error')).toHaveTextContent(ja['auth.error.popupBlocked']));
    await fill('a@example.test', 'password1');
    await submit();
    await waitFor(() => expect(formError()).toContain(ja['auth.pw.error.wrong']));
    expect(screen.getByTestId('login-error')).toBeEmptyDOMElement();
  });
});

describe('US-E13-08/AC7 AC10 the password stays out of the page', () => {
  it('US-E13-08/AC7 AC10 while typing, after a failure and with it shown, the password is in no attribute, text, URL or storage', async () => {
    const typed = 'Zx9-unique-typed-pw';
    const auth = new FakeAuth().addAccount(CONFIRMED);
    mount(auth);
    await fill(CONFIRMED.email, typed);
    await userEvent.click(screen.getByTestId('login-password-toggle'));
    const leak = () => {
      const html = document.body.innerHTML;
      const withoutValue = html.replace(/<input[^>]*>/g, '');
      expect(withoutValue).not.toContain(typed);
      for (const el of document.querySelectorAll('input')) for (const a of Array.from(el.attributes)) expect(a.value, a.name).not.toContain(typed);
      expect(window.location.href).not.toContain(typed);
      expect(JSON.stringify({ ...window.localStorage })).not.toContain(typed);
      expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(typed);
      expect(document.title).not.toContain(typed);
    };
    leak();
    await submit();
    await waitFor(() => expect(formError()).toBe(''), { timeout: 500 }).catch(() => undefined);
    leak();
  });
});

describe('US-E13-08/AC11 the account section for a password account', () => {
  it('US-E13-08/AC11 shows the e-mail as the name, the "signed in with email" caption, an initial and no photo; sign-out works', async () => {
    window.location.hash = '#/settings';
    const auth = new FakeAuth({ user: { ...userOf(CONFIRMED), photoUrl: 'https://example.test/should-not-show.png' } }).addAccount(CONFIRMED);
    mount(auth, {}, true);
    const section = await screen.findByTestId('settings-account');
    expect(section).toHaveTextContent(CONFIRMED.email);
    expect(section).toHaveTextContent(ja['auth.account.password']);
    expect(screen.getByTestId('account-name')).toHaveTextContent(CONFIRMED.email);
    expect(screen.queryByTestId('account-email')).toBeNull(); // not repeated
    expect(section.querySelector('img')).toBeNull();
    expect(screen.getByTestId('account-avatar')).toHaveTextContent('m');
    await userEvent.click(screen.getByTestId('account-sign-out'));
    await userEvent.click(await screen.findByTestId('dialog-sign-out-confirm'));
    expect(await screen.findByTestId('screen-login')).toBeInTheDocument();
  });
});
