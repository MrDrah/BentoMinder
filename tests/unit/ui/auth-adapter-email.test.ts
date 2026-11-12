// US-E13-08/AC7, AC12: the Firebase adapter's e-mail error mapping, and that the new methods never throw or call out
// when the configuration is missing (no real Firebase in unit tests).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createFirebaseAuth, mapFirebaseEmailError } from '../../../src/adapters/web/firebase-auth.ts';

describe('US-E13-08/AC7 Firebase error codes become plain kinds', () => {
  it('US-E13-08/AC7 wrong password, unknown user and bad credentials are one kind (never says which)', () => {
    for (const code of ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials']) expect(mapFirebaseEmailError(code)).toBe('wrong');
  });
  it('US-E13-08/AC8 an address already in use is its own kind', () => {
    expect(mapFirebaseEmailError('auth/email-already-in-use')).toBe('inUse');
  });
  it('US-E13-08/AC7 invalid e-mail, weak password, too many attempts, offline, disabled, anything else', () => {
    expect(mapFirebaseEmailError('auth/invalid-email')).toBe('invalidEmail');
    expect(mapFirebaseEmailError('auth/weak-password')).toBe('weakPassword');
    expect(mapFirebaseEmailError('auth/too-many-requests')).toBe('tooMany');
    expect(mapFirebaseEmailError('auth/network-request-failed')).toBe('offline');
    expect(mapFirebaseEmailError('auth/user-disabled')).toBe('disabled');
    expect(mapFirebaseEmailError('auth/internal-error')).toBe('other');
    expect(mapFirebaseEmailError(undefined)).toBe('other');
    expect(mapFirebaseEmailError('auth/internal-error', false)).toBe('offline');
  });
});

describe('US-E13-08/AC12 the adapter fails softly without configuration', () => {
  it('US-E13-08/AC12 every e-mail action resolves to the other error and nothing is logged with a password or address', async () => {
    const warn = vi.fn();
    const auth = createFirebaseAuth({}, { warn });
    const typed = 'S3cret-pass-1';
    expect(await auth.createAccount('a@example.test', typed)).toEqual({ ok: false, error: 'other' });
    expect(await auth.signInWithEmail('a@example.test', typed)).toEqual({ ok: false, error: 'other' });
    expect(await auth.sendVerification()).toEqual({ ok: false, error: 'other' });
    expect(await auth.reloadUser()).toEqual({ ok: false, error: 'other' });
    expect(await auth.sendPasswordReset('a@example.test')).toEqual({ ok: false, error: 'other' });
    for (const call of warn.mock.calls) {
      expect(String(call[0])).not.toContain(typed);
      expect(String(call[0])).not.toContain('a@example.test');
    }
  });
});

describe('US-E13-08/AC3 AC10 the adapter source', () => {
  const src = readFileSync(join(process.cwd(), 'src/adapters/web/firebase-auth.ts'), 'utf8');
  it('US-E13-08/AC3 reloading the user also force-refreshes the ID token', () => {
    expect(src).toMatch(/user\.reload\(\)[\s\S]{0,120}getIdToken\(true\)/);
  });
  it('US-E13-08/AC10 the password is never passed to a log or warning', () => {
    expect(src).not.toMatch(/warn\([^)]*password/i);
  });
});
