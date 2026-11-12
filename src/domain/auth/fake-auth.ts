// US-E13-07/AC2: a scripted AuthPort for unit, component and e2e tests. Never touches Google or Firebase.
// Covers: signed out, signed in, cancelled, popup blocked, offline, disabled, other failure,
// session revoked, and a delayed session read.
import type { ActionResult, AuthChange, AuthPort, AuthUser, SignInResult } from './types.ts';

export const TEST_USER: AuthUser = { uid: 'test-uid-001', displayName: 'Test Parent', email: 'parent@example.test', photoUrl: null };
export const TEST_USER_2: AuthUser = { uid: 'test-uid-002', displayName: 'Other Parent', email: 'other@example.test', photoUrl: null };

/** A registered account the fake knows (US-E13-08/AC12): e-mail + password accounts and Google accounts (for AC8). */
export interface FakeAccount {
  email: string;
  uid: string;
  provider: 'google' | 'password';
  /** Password accounts only. */
  password?: string;
  verified: boolean;
}

export interface FakeAuthOptions {
  /** The persisted session; null/omitted = signed out. */
  user?: AuthUser | null;
  /** The session read waits until `releaseRestore()` (a delayed session read). */
  holdRestore?: boolean;
  /** Sign-in waits until `releaseSignIn()` (to test a double tap). */
  holdSignIn?: boolean;
}

export class FakeAuth implements AuthPort {
  /** Calls seen, so tests can assert "only one sign-in started" and "no window before a tap". */
  readonly calls = { restore: 0, signIn: 0, signOut: 0, createAccount: 0, signInWithEmail: 0, sendVerification: 0, reloadUser: 0, sendPasswordReset: 0 };
  /** What the provider would have e-mailed: confirmation e-mails (addresses) and password-reset e-mails (addresses that have an account). */
  readonly verificationsSent: string[] = [];
  readonly resetsSent: string[] = [];
  private readonly accounts = new Map<string, FakeAccount>();
  private nextUid = 1;
  /** Every token request seen (true = forced refresh), so tests can assert "one refresh and retry". */
  readonly tokenRequests: boolean[] = [];
  private refreshes = 0;
  private user: AuthUser | null;
  private readonly handlers = new Set<(change: AuthChange) => void>();
  private readonly script: SignInResult[] = [];
  private restoreGate: Promise<void> | null = null;
  private openRestore: (() => void) | null = null;
  private signInGate: Promise<void> | null = null;
  private openSignIn: (() => void) | null = null;
  /** Used when nothing is scripted: this user signs in. */
  signInUser: AuthUser = TEST_USER;

  constructor(options: FakeAuthOptions = {}) {
    this.user = options.user ?? null;
    if (options.holdRestore === true) this.restoreGate = new Promise((resolve) => (this.openRestore = resolve));
    if (options.holdSignIn === true) this.holdNextSignIn();
  }

  /** Registers an account the fake knows. */
  addAccount(account: FakeAccount): this {
    this.accounts.set(account.email.trim().toLowerCase(), { ...account });
    return this;
  }
  /** The parent opened the link in the e-mail: the next `reloadUser` sees it. */
  confirmEmail(email: string): void {
    const a = this.accounts.get(email.trim().toLowerCase());
    if (a !== undefined) a.verified = true;
  }
  /** Scripts the outcome of the next sign-in tap (a queue; one outcome per tap). */
  queueSignIn(result: SignInResult): this {
    this.script.push(result);
    return this;
  }
  queueError(error: Extract<SignInResult, { ok: false }>['error']): this {
    return this.queueSignIn({ ok: false, error });
  }

  holdNextSignIn(): void {
    this.signInGate = new Promise((resolve) => (this.openSignIn = resolve));
  }
  releaseRestore(): void {
    this.openRestore?.();
  }
  releaseSignIn(): void {
    this.openSignIn?.();
  }

  /** The provider ends the session (revoked, disabled, deleted); US-E13-02/AC5. Tells listeners. */
  revokeSession(): void {
    this.user = null;
    this.emit({ user: null, reason: 'session-ended' });
  }
  /** Another tab signed in or out. */
  externalChange(user: AuthUser | null): void {
    this.user = user;
    this.emit(user === null ? { user: null, reason: 'signed-out' } : { user });
  }
  /** A fixed-shape fake token per account; a forced refresh yields a different one. Null when signed out. */
  getIdToken(forceRefresh = false): Promise<string | null> {
    this.tokenRequests.push(forceRefresh);
    if (forceRefresh) this.refreshes += 1;
    return Promise.resolve(this.user === null ? null : `fake-id-token-${this.user.uid}-${this.refreshes}`);
  }
  currentUser(): AuthUser | null {
    return this.user;
  }

  async restore(): Promise<AuthUser | null> {
    this.calls.restore += 1;
    if (this.restoreGate !== null) await this.restoreGate;
    return this.user;
  }

  async signInWithGoogle(): Promise<SignInResult> {
    this.calls.signIn += 1;
    const gate = this.signInGate;
    if (gate !== null) {
      await gate;
      this.signInGate = null;
    }
    const result: SignInResult = this.script.shift() ?? { ok: true, user: this.signInUser };
    if (result.ok) {
      this.user = result.user;
      this.emit({ user: result.user });
    }
    return result;
  }

  // ---- US-E13-08: e-mail + password -------------------------------------------------------------------------------
  private async gate(): Promise<void> {
    const gate = this.signInGate;
    if (gate !== null) {
      await gate;
      this.signInGate = null;
    }
  }
  /** A scripted failure (queueError) for the next e-mail action, or undefined. Scripted successes are ignored here. */
  private scripted(): Extract<SignInResult, { ok: false }> | undefined {
    const r = this.script.shift();
    return r !== undefined && !r.ok ? r : undefined;
  }
  private userOf(a: FakeAccount): AuthUser {
    return { uid: a.uid, displayName: null, email: a.email, photoUrl: null, emailVerified: a.verified, provider: a.provider };
  }
  private enter(user: AuthUser): SignInResult {
    this.user = user;
    this.emit({ user });
    return { ok: true, user };
  }

  async createAccount(email: string, password: string): Promise<SignInResult> {
    this.calls.createAccount += 1;
    await this.gate();
    const failure = this.scripted();
    if (failure !== undefined) return failure;
    const key = email.trim().toLowerCase();
    if (this.accounts.has(key)) return { ok: false, error: 'inUse' };
    if (Array.from(password).length < 6) return { ok: false, error: 'weakPassword' };
    const account: FakeAccount = { email: key, uid: `pw-uid-${String(this.nextUid++).padStart(3, "0")}`, provider: 'password', password, verified: false };
    this.accounts.set(key, account);
    this.verificationsSent.push(key);
    return this.enter(this.userOf(account));
  }

  async signInWithEmail(email: string, password: string): Promise<SignInResult> {
    this.calls.signInWithEmail += 1;
    await this.gate();
    const failure = this.scripted();
    if (failure !== undefined) return failure;
    const a = this.accounts.get(email.trim().toLowerCase());
    // One answer for an unknown e-mail, a Google-only account and a wrong password (AC7).
    if (a === undefined || a.provider !== 'password' || a.password !== password) return { ok: false, error: 'wrong' };
    return this.enter(this.userOf(a));
  }

  sendVerification(): Promise<ActionResult> {
    this.calls.sendVerification += 1;
    const failure = this.scripted();
    if (failure !== undefined) return Promise.resolve(failure);
    if (this.user === null) return Promise.resolve({ ok: false, error: 'other' });
    this.verificationsSent.push(this.user.email ?? '');
    return Promise.resolve({ ok: true });
  }

  reloadUser(): Promise<SignInResult> {
    this.calls.reloadUser += 1;
    const failure = this.scripted();
    if (failure !== undefined) return Promise.resolve(failure);
    if (this.user === null) return Promise.resolve({ ok: false, error: 'other' });
    this.refreshes += 1; // the ID token is force-refreshed so the confirmed e-mail shows in it
    this.tokenRequests.push(true);
    const a = this.accounts.get((this.user.email ?? '').toLowerCase());
    const user = a === undefined ? this.user : this.userOf(a);
    this.user = user;
    return Promise.resolve({ ok: true, user });
  }

  sendPasswordReset(email: string): Promise<ActionResult> {
    this.calls.sendPasswordReset += 1;
    const failure = this.scripted();
    if (failure !== undefined) return Promise.resolve(failure);
    const key = email.trim().toLowerCase();
    if (this.accounts.get(key)?.provider === 'password') this.resetsSent.push(key); // no signal either way
    return Promise.resolve({ ok: true });
  }

  // Works with the network off (US-E13-05/AC6): it never needs anything but local state.
  signOut(): Promise<void> {
    this.calls.signOut += 1;
    this.user = null;
    this.emit({ user: null, reason: 'signed-out' });
    return Promise.resolve();
  }

  onChange(handler: (change: AuthChange) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(change: AuthChange): void {
    for (const h of [...this.handlers]) h(change);
  }
}
