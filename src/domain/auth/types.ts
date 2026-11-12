// ADR 014 / data contract 12.3: the sign-in port. No Firebase types leak through it.
export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  /** US-E13-08: false for a password account whose e-mail is not confirmed yet. Absent = confirmed (Google). */
  emailVerified?: boolean;
  /** US-E13-08: how the account signs in; absent = 'google'. */
  provider?: 'google' | 'password';
}

/** US-E13-08/AC3: a password account must confirm its e-mail before anything of the app starts. */
export const needsEmailVerification = (user: AuthUser): boolean => user.provider === 'password' && user.emailVerified !== true;

/** Why a sign-in attempt did not produce a user (US-E13-03, US-E13-08/AC7). */
export type SignInErrorKind =
  | 'cancelled'
  | 'popupBlocked'
  | 'offline'
  | 'disabled'
  | 'other'
  // E-mail + password only. `wrong` covers a wrong password, an unknown e-mail and bad credentials alike (never says which).
  | 'wrong'
  | 'inUse'
  | 'tooMany'
  | 'invalidEmail'
  | 'weakPassword';
/** Everything the login screen can show; `sessionEnded` comes from the provider, not from a tap. */
export type AuthErrorKind = SignInErrorKind | 'sessionEnded';

export type SignInResult = { ok: true; user: AuthUser } | { ok: false; error: SignInErrorKind };

/** The outcome of an action that gives no user (sending an e-mail). */
export type ActionResult = { ok: true } | { ok: false; error: SignInErrorKind };

/** `session-ended`: the provider revoked, disabled or deleted the session (US-E13-02/AC5). */
export type AuthChange = { user: AuthUser } | { user: null; reason: 'signed-out' | 'session-ended' };

export interface AuthPort {
  /** Reads the persisted session once; resolves from the cache, never needs the network (US-E13-02/AC3). */
  restore(): Promise<AuthUser | null>;
  /** Opens the provider window; call only from the parent's tap (US-E13-01/AC3). Never rejects. */
  signInWithGoogle(): Promise<SignInResult>;
  /** US-E13-08/AC2: creates the account, signs it in and sends the confirmation e-mail. Never rejects. */
  createAccount(email: string, password: string): Promise<SignInResult>;
  /** US-E13-08/AC5. Never rejects. The password is never kept. */
  signInWithEmail(email: string, password: string): Promise<SignInResult>;
  /** US-E13-08/AC4: sends the confirmation e-mail again to the signed-in account. Never rejects. */
  sendVerification(): Promise<ActionResult>;
  /** US-E13-08/AC3: re-reads the account from the provider and force-refreshes its ID token; the user carries the new `emailVerified`. */
  reloadUser(): Promise<SignInResult>;
  /** US-E13-08/AC6: neutral: succeeds whether or not the address has an account. */
  sendPasswordReset(email: string): Promise<ActionResult>;
  /** Ends the local session; works offline (US-E13-05/AC6) and never touches stored data. */
  signOut(): Promise<void>;
  /**
   * The current account's ID token for the hosted AI proxy (ADR 015, US-E14-07/AC4); `forceRefresh` asks the provider
   * for a new one. Null when nobody is signed in or the token cannot be had. Never stored, logged or exported by the app.
   */
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
  /** Later session changes (another tab, revoked session); returns unsubscribe. */
  onChange(handler: (change: AuthChange) => void): () => void;
}
