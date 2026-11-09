// ADR 014 / data contract 12.3: the sign-in port. No Firebase types leak through it.
export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
}

/** Why a sign-in attempt did not produce a user (US-E13-03). */
export type SignInErrorKind = 'cancelled' | 'popupBlocked' | 'offline' | 'disabled' | 'other';
/** Everything the login screen can show; `sessionEnded` comes from the provider, not from a tap. */
export type AuthErrorKind = SignInErrorKind | 'sessionEnded';

export type SignInResult = { ok: true; user: AuthUser } | { ok: false; error: SignInErrorKind };

/** `session-ended`: the provider revoked, disabled or deleted the session (US-E13-02/AC5). */
export type AuthChange = { user: AuthUser } | { user: null; reason: 'signed-out' | 'session-ended' };

export interface AuthPort {
  /** Reads the persisted session once; resolves from the cache, never needs the network (US-E13-02/AC3). */
  restore(): Promise<AuthUser | null>;
  /** Opens the provider window; call only from the parent's tap (US-E13-01/AC3). Never rejects. */
  signInWithGoogle(): Promise<SignInResult>;
  /** Ends the local session; works offline (US-E13-05/AC6) and never touches stored data. */
  signOut(): Promise<void>;
  /** Later session changes (another tab, revoked session); returns unsubscribe. */
  onChange(handler: (change: AuthChange) => void): () => void;
}
