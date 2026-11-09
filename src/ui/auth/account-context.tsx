// The signed-in account as the screens see it: who it is (display only, never stored, US-E13-06/AC1) and how to
// sign out. Absent (null) outside the sign-in shell, e.g. in the unit tests of single screens.
import { createContext, useContext } from 'react';
import type { AuthUser } from '../../domain/auth/types.ts';

export interface AccountValue {
  user: AuthUser;
  /** Cancels the reminders, then ends the session. False when it failed (the dialog stays open). */
  signOut: () => Promise<boolean>;
}

export const AccountContext = createContext<AccountValue | null>(null);

export const useAccount = (): AccountValue | null => useContext(AccountContext);
