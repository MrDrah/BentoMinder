// Picks the sign-in adapter at start-up (ADR 014). The fake is chosen ONLY by the build-time flag
// VITE_AUTH_FAKE=1, which the e2e preview build alone sets. Vite replaces the flag with a literal, so a normal
// build drops the whole branch and the fake adapter is never in the bundle.
import type { AuthPort, AuthUser } from '../domain/auth/types.ts';

export interface AuthSetup {
  auth: AuthPort;
  /** The storage account of a user (the uid); undefined = the old unkeyed keys (e2e compat mode only). */
  accountOf: (user: AuthUser) => string | undefined;
}

export async function selectAuth(): Promise<AuthSetup> {
  if (import.meta.env.VITE_AUTH_FAKE === '1') {
    const { createE2eAuth } = await import('./web/e2e-auth.ts');
    return createE2eAuth();
  }
  const { createFirebaseAuth } = await import('./web/firebase-auth.ts');
  return { auth: createFirebaseAuth(firebaseEnv()), accountOf: (user) => user.uid };
}

/** Vite inlines each name below at build time; nothing else of the environment is read or bundled. */
function firebaseEnv(): Record<string, unknown> {
  return {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
}
