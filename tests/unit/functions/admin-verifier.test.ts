// The Admin SDK seam (functions/src/admin-verifier.ts) with a fake Auth handle: no Google call, no certificate fetch.
import { describe, expect, it } from 'vitest';
import { createAdminVerifier, type AuthLike, type DecodedLike } from '../../../functions/src/admin-verifier.ts';

const PROJECT = 'bentominder-test';

function fakeAuth(result: DecodedLike | Error) {
  const calls: { token: string; revoked: boolean | undefined }[] = [];
  const auth: AuthLike = {
    verifyIdToken: (token, revoked) => {
      calls.push({ token, revoked });
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
  return { auth, calls };
}

describe('US-E14-01/AC2 the token must be valid for this project (Admin verifier port)', () => {
  it('US-E14-01/AC2 a valid token gives the uid, e-mail and email_verified from the token only; revocation is not checked', async () => {
    const { auth, calls } = fakeAuth({ uid: 'test-uid-001', email: 'allowed@example.test', email_verified: true, aud: PROJECT });
    expect(await createAdminVerifier(auth, PROJECT)('tok')).toEqual({ uid: 'test-uid-001', email: 'allowed@example.test', emailVerified: true });
    expect(calls).toEqual([{ token: 'tok', revoked: false }]);
  });

  it.each([
    ['email_verified missing', { uid: 'u', email: 'a@example.test', aud: PROJECT }],
    ['email_verified "true" (a string)', { uid: 'u', email: 'a@example.test', email_verified: 'true', aud: PROJECT }],
    ['email_verified false', { uid: 'u', email: 'a@example.test', email_verified: false, aud: PROJECT }],
  ])('US-E14-01/AC2 %s means emailVerified false', async (_l, decoded) => {
    const v = await createAdminVerifier(fakeAuth(decoded).auth, PROJECT)('tok');
    expect(v?.emailVerified).toBe(false);
  });

  it.each([
    ['a token for another project (audience)', { uid: 'u', aud: 'someone-elses-project' }],
    ['no audience', { uid: 'u' }],
    ['no uid', { aud: PROJECT }],
    ['an empty uid', { uid: '', aud: PROJECT }],
    ['a numeric uid', { uid: 7, aud: PROJECT }],
  ])('US-E14-01/AC2 %s is refused', async (_l, decoded) => {
    expect(await createAdminVerifier(fakeAuth(decoded).auth, PROJECT)('tok')).toBeNull();
  });

  it('US-E14-01/AC2 an expired, forged or malformed token (the SDK throws) is refused, never an exception', async () => {
    for (const message of ['auth/id-token-expired', 'auth/argument-error', 'Decoding Firebase ID token failed']) {
      expect(await createAdminVerifier(fakeAuth(new Error(message)).auth, PROJECT)('tok')).toBeNull();
    }
  });

  it.each([undefined, ''])('US-E14-01/AC2 fail closed: project id %j means every token is refused and the SDK is not asked', async (project) => {
    const { auth, calls } = fakeAuth({ uid: 'u', aud: PROJECT });
    expect(await createAdminVerifier(auth, project)('tok')).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('US-E14-01/AC2 fail closed: no Auth handle means every token is refused', async () => {
    expect(await createAdminVerifier(null, PROJECT)('tok')).toBeNull();
  });
});
