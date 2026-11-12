// QA E13-email helpers (US-E13-08). Copy strings are taken from design/copy.md section 21 and 20, not from the app source.
// The seam keys are documented in the header of src/adapters/web/e2e-auth.ts (the e2e-only fake sign-in).
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export type Lang = 'ja' | 'en';
export const LANGS: Lang[] = ['ja', 'en'];
export const PW = 'correct-horse-1'; // what every seeded password account accepts (seam contract)

export const COPY = {
  ja: {
    google: 'Googleでログイン',
    signIn: 'ログイン',
    create: 'アカウントを作る',
    toCreate: 'アカウントを作る',
    toSignIn: 'ログインに戻る',
    forgot: 'パスワードを忘れた',
    sendReset: '再設定メールを送る',
    wrong: 'メールアドレスまたはパスワードが違います',
    inUse: 'このメールアドレスは、すでに使われています。Googleでログインするか、「パスワードを忘れた」からパスワードを設定してください。',
    tooMany: 'しばらくしてからもう一度お試しください',
    offline: 'インターネットにつながっていません。接続を確認して、もう一度お試しください。',
    other: 'ログインできませんでした。しばらくしてから、もう一度お試しください。',
    emailEmpty: 'メールアドレスを入力してください。',
    emailInvalid: 'メールアドレスの形式が正しくありません。',
    passwordEmpty: 'パスワードを入力してください。',
    passwordShort: 'パスワードは8文字以上にしてください。',
    resetTitle: 'メールを確認してください',
    resetBody: 'そのメールアドレスのアカウントがある場合、パスワードを再設定するメールをお送りしました。',
    verifyTitle: 'メールを確認してください',
    verifyDone: '確認しました',
    verifyResend: '確認メールを再送する',
    notYet: 'まだ確認できていません。メールのリンクを開いてから、もう一度押してください。',
    signOut: 'ログアウト',
    sent: '確認メールを送りました。',
    canResend: 'もう一度再送できます。',
    accountPassword: 'メールアドレスでログイン中',
    show: 'パスワードを表示',
    hide: 'パスワードを隠す',
  },
  en: {
    google: 'Continue with Google',
    signIn: 'Sign in',
    create: 'Create account',
    toCreate: 'Create an account',
    toSignIn: 'Back to sign in',
    forgot: 'Forgot your password?',
    sendReset: 'Send reset email',
    wrong: 'The email or password is incorrect.',
    inUse: 'This email address is already in use. Sign in with Google, or use "Forgot your password?" to set a password.',
    tooMany: 'Please try again in a little while.',
    offline: "You're offline. Please check your connection and try again.",
    other: "We couldn't sign you in. Please try again in a little while.",
    emailEmpty: 'Please enter your email address.',
    emailInvalid: "That email address doesn't look right.",
    passwordEmpty: 'Please enter your password.',
    passwordShort: 'Your password needs at least 8 characters.',
    resetTitle: 'Check your email',
    resetBody: "If an account exists for that address, we've sent an email to reset your password.",
    verifyTitle: 'Check your email',
    verifyDone: "I've confirmed",
    verifyResend: 'Resend confirmation email',
    notYet: "We can't see the confirmation yet. Open the link in the email, then try again.",
    signOut: 'Sign out',
    sent: 'Confirmation email sent.',
    canResend: 'You can resend the email now.',
    accountPassword: 'Signed in with email',
    show: 'Show password',
    hide: 'Hide password',
  },
} as const;

export const CONF = { email: 'mama@example.test', uid: 'pw-uid-conf', provider: 'password', verified: true };
export const UNC = { email: 'papa@example.test', uid: 'pw-uid-unc', provider: 'password', verified: false };
export const GOOG = { email: 'google@example.test', uid: 'g-uid-1', provider: 'google', verified: true };
export const A = { uid: 'test-uid-001', displayName: 'Test Parent', email: 'parent@example.test', photoUrl: null as string | null };
export const SYNC_BASE = 'https://sync.qa-e13e.test';

/** Sets localStorage once per browser context (not per tab: a second tab must not re-seed). */
let seedCount = 0;
export async function seed(page: Page, entries: Record<string, string>): Promise<void> {
  seedCount += 1;
  const flag = `qa-e13e-seeded-${Date.now()}-${seedCount}`;
  await page.addInitScript(
    ([e, f]) => {
      if (window.localStorage.getItem(f as string) !== null) return;
      window.localStorage.setItem(f as string, '1');
      for (const [k, v] of Object.entries(e as Record<string, string>)) window.localStorage.setItem(k, v);
    },
    [entries, flag] as const,
  );
}
export const out = (accounts: object[] = [], extra: Record<string, string> = {}) => ({
  'bentominder.fake-auth': 'signed-out',
  'bentominder.fake-auth-accounts': JSON.stringify(accounts),
  ...extra,
});
export const script = (...o: string[]) => ({ 'bentominder.fake-auth-script': JSON.stringify(o) });
export const verifiedList = (...e: string[]) => ({ 'bentominder.fake-auth-verified': JSON.stringify(e) });
export const userOf = (a: typeof CONF) => JSON.stringify({ uid: a.uid, displayName: null, email: a.email, photoUrl: null, emailVerified: a.verified, provider: 'password' });

export const logOf = (page: Page): Promise<string[]> => page.evaluate(() => JSON.parse(window.localStorage.getItem('bentominder.fake-auth-log') ?? '[]') as string[]);
export const dataKeys = (page: Page) => page.evaluate(() => Object.keys(window.localStorage).filter((k) => !k.includes('fake-auth') && !k.startsWith('qa-e13e-seeded')).sort());
export const dataSnapshot = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.keys(window.localStorage).filter((k) => !k.includes('fake-auth') && !k.startsWith('qa-e13e-seeded')).sort().map((k) => [k, window.localStorage.getItem(k)])));

export const APP_ONLY = ['appbar', 'tabbar', 'screen-calendar', 'screen-settings', 'screen-onboarding', 'screen-import', 'today-card', 'day-sheet', 'screen-join'];
export async function expectNoApp(page: Page): Promise<void> {
  for (const id of APP_ONLY) await expect(page.getByTestId(id), id).toHaveCount(0);
}

/** Records every request (url + body) and answers requests to the fake sync host so a call is visible, not fatal. */
export interface Traffic {
  urls: string[];
  bodies: string[];
  /** Anything that is not a static asset of the app itself. */
  external: () => string[];
  /** Calls to sync, the proxy or any other host. */
  forbidden: () => string[];
}
export async function watchTraffic(page: Page): Promise<Traffic> {
  const urls: string[] = [];
  const bodies: string[] = [];
  await page.context().route(`${SYNC_BASE}/**`, (route) => route.fulfill({ status: 500, body: '{}', headers: { 'access-control-allow-origin': '*' } }));
  page.on('request', (r) => {
    urls.push(r.url());
    const b = r.postData();
    if (b !== null) bodies.push(b);
  });
  const isStatic = (u: string) => new URL(u).origin === 'http://localhost:4173' && !new URL(u).pathname.startsWith('/api');
  return {
    urls,
    bodies,
    external: () => urls.filter((u) => !isStatic(u) && !u.startsWith('data:') && !u.startsWith('blob:')),
    forbidden: () => urls.filter((u) => !isStatic(u) && !u.startsWith('data:') && !u.startsWith('blob:')),
  };
}

export async function axeSerious(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

export async function fillForm(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId('login-email').fill(email);
  if (await page.getByTestId('login-password').count()) await page.getByTestId('login-password').fill(password);
}
export const text = async (page: Page, id: string): Promise<string> => ((await page.getByTestId(id).innerText()) ?? '').replace(/\s+/g, ' ').trim();
