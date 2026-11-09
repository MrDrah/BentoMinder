// US-E13-07/AC2: a scripted AuthPort for unit, component and e2e tests. Never touches Google or Firebase.
// Covers: signed out, signed in, cancelled, popup blocked, offline, disabled, other failure,
// session revoked, and a delayed session read.
import type { AuthChange, AuthPort, AuthUser, SignInResult } from './types.ts';

export const TEST_USER: AuthUser = { uid: 'test-uid-001', displayName: 'Test Parent', email: 'parent@example.test', photoUrl: null };
export const TEST_USER_2: AuthUser = { uid: 'test-uid-002', displayName: 'Other Parent', email: 'other@example.test', photoUrl: null };

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
  readonly calls = { restore: 0, signIn: 0, signOut: 0 };
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
