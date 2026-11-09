// US-E13-07/AC1, US-E13-03, US-E13-06/AC4: the Firebase adapter's pure parts and the import boundary.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createFirebaseAuth, FIREBASE_ENV_NAMES, mapFirebaseAuthError, missingFirebaseEnv } from '../../../src/adapters/web/firebase-auth.ts';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const sources = walk(join(process.cwd(), 'src')).filter((f) => /\.(ts|tsx)$/.test(f));

describe('US-E13-07/AC1 auth sits behind the port', () => {
  it('US-E13-07/AC1 only src/adapters imports the Firebase SDK, and only through dynamic import', () => {
    const offenders = sources.filter((f) => /from\s+['"]firebase|import\(\s*['"]firebase|require\(\s*['"]firebase/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => relative(process.cwd(), f).split(sep).join('/'))).toEqual(['src/adapters/web/firebase-auth.ts']);
    expect(readFileSync(offenders[0] as string, 'utf8')).not.toMatch(/^import\s[^t].*from\s+['"]firebase/m);
  });

  it('US-E13-06/AC4 US-E13-06/AC3 no analytics, messaging or database module is loaded', () => {
    const text = readFileSync(join(process.cwd(), 'src/adapters/web/firebase-auth.ts'), 'utf8');
    expect(text).not.toMatch(/firebase\/(analytics|firestore|database|messaging|storage|functions)/);
  });
});

describe('US-E13-03 error mapping', () => {
  it('US-E13-03/AC1 closing the window is a cancel', () => {
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) expect(mapFirebaseAuthError(code)).toBe('cancelled');
  });
  it('US-E13-03/AC2 AC4 AC5 pop-up, network, disabled and everything else', () => {
    expect(mapFirebaseAuthError('auth/popup-blocked')).toBe('popupBlocked');
    expect(mapFirebaseAuthError('auth/network-request-failed')).toBe('offline');
    expect(mapFirebaseAuthError('auth/user-disabled')).toBe('disabled');
    expect(mapFirebaseAuthError('auth/internal-error')).toBe('other');
    expect(mapFirebaseAuthError(undefined)).toBe('other');
    expect(mapFirebaseAuthError('auth/internal-error', false)).toBe('offline');
  });
});

describe('US-E13-07 missing configuration', () => {
  it('US-E13-03/AC5 a missing variable is one console warning with names only, and sign-in fails with the other error', async () => {
    const warn = vi.fn();
    const hidden = 'placeholder-value-abc';
    const auth = createFirebaseAuth({ VITE_FIREBASE_API_KEY: hidden }, { warn });
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('VITE_FIREBASE_AUTH_DOMAIN');
    expect(message).not.toContain('VITE_FIREBASE_API_KEY'); // present, so not named
    expect(message).not.toContain(hidden);
    expect(await auth.signInWithGoogle()).toEqual({ ok: false, error: 'other' });
    expect(await auth.restore()).toBeNull();
    await expect(auth.signOut()).resolves.toBeUndefined();
  });

  it('lists the seven variables the PO sets and reports blanks as missing', () => {
    expect(FIREBASE_ENV_NAMES).toHaveLength(7);
    expect(missingFirebaseEnv(Object.fromEntries(FIREBASE_ENV_NAMES.map((n) => [n, 'x'])))).toEqual([]);
    expect(missingFirebaseEnv({ VITE_FIREBASE_API_KEY: '  ' })).toContain('VITE_FIREBASE_API_KEY');
  });
});
