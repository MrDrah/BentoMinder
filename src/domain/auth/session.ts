// Data contract 12.3: the runtime auth state as a pure reducer. Never stored, never exported.
import { isValidUid } from '../storage/keys.ts';
import type { AuthChange, AuthErrorKind, AuthUser, SignInResult } from './types.ts';

/** `loading` = the persisted session is being read (US-E13-02/AC2); the UI must not show the login screen then. */
export type AuthStatus = 'loading' | 'signedOut' | 'signingIn' | 'signedIn';

export interface AuthSession {
  status: AuthStatus;
  user?: AuthUser;
  lastError: AuthErrorKind | null;
}

export type AuthEvent =
  | { type: 'restored'; user: AuthUser | null }
  | { type: 'signInStarted' }
  | { type: 'signInFinished'; result: SignInResult }
  | { type: 'changed'; change: AuthChange }
  | { type: 'signedOut' };

export const initialAuthSession: AuthSession = { status: 'loading', lastError: null };

const signedOut = (lastError: AuthErrorKind | null): AuthSession => ({ status: 'signedOut', lastError });
const signedIn = (user: AuthUser): AuthSession => ({ status: 'signedIn', user, lastError: null });

export function authReducer(state: AuthSession, event: AuthEvent): AuthSession {
  switch (event.type) {
    case 'restored':
      if (state.status !== 'loading') return state;
      if (event.user === null) return signedOut(null);
      return isValidUid(event.user.uid) ? signedIn(event.user) : signedOut('other');
    case 'signInStarted':
      // US-E13-03/AC3: a second tap while one sign-in runs (or when already in) starts nothing.
      return state.status === 'signedOut' ? { status: 'signingIn', lastError: null } : state;
    case 'signInFinished': {
      if (state.status !== 'signingIn') return state;
      const r = event.result;
      if (!r.ok) return signedOut(r.error === 'cancelled' ? null : r.error); // US-E13-03/AC1 shows nothing
      return isValidUid(r.user.uid) ? signedIn(r.user) : signedOut('other'); // contract 12.2
    }
    case 'changed': {
      const c = event.change;
      if (c.user !== null) {
        if (state.status === 'signingIn' || state.status === 'loading') return state;
        return isValidUid(c.user.uid) ? signedIn(c.user) : state;
      }
      if (state.status !== 'signedIn') return state;
      return signedOut(c.reason === 'session-ended' ? 'sessionEnded' : null);
    }
    case 'signedOut':
      return state.status === 'signedIn' ? signedOut(null) : state;
  }
}
