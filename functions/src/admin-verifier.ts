// Firebase ID-token verification behind the TokenVerifier port (ADR 015 §2). The Admin SDK itself is
// passed in (functions/src/index.ts), so this file names no Google SDK and tests use a fake `AuthLike`.
import type { TokenVerifier } from '../../server/core/hosted-policy.ts';

export interface DecodedLike {
  uid?: unknown;
  email?: unknown;
  email_verified?: unknown;
  aud?: unknown;
}
export interface AuthLike {
  verifyIdToken(token: string, checkRevoked?: boolean): Promise<DecodedLike>;
}

/**
 * Fail closed: without a project id or an Auth handle every token is refused. Revocation is not
 * checked (open question Q7). The audience must equal our project even though the SDK checks it too.
 */
export function createAdminVerifier(auth: AuthLike | null, projectId: string | undefined): TokenVerifier {
  return async (token) => {
    if (auth === null || projectId === undefined || projectId === '') return null;
    try {
      const d = await auth.verifyIdToken(token, false);
      if (typeof d.uid !== 'string' || d.uid === '' || d.aud !== projectId) return null;
      return {
        uid: d.uid,
        email: typeof d.email === 'string' ? d.email : undefined,
        emailVerified: d.email_verified === true,
      };
    } catch {
      return null;
    }
  };
}
