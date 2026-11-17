// US-E12-01: in the Android app the Google popup cannot run in a WebView, so the login screen offers e-mail only.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../src/i18n/index.ts';
import { LoginScreen } from '../../../src/ui/auth/LoginScreen.tsx';

const props = (extra: Record<string, unknown> = {}) => ({
  t: createTranslator('ja'),
  language: 'ja' as const,
  onLanguage: vi.fn(),
  busy: false,
  error: null,
  expired: false,
  signedOut: false,
  onSignIn: vi.fn(),
  onSubmit: vi.fn(),
  onReset: vi.fn(),
  ...extra,
});

describe('US-E12-01 login screen on native', () => {
  it('US-E12-01 the Google button is replaced by a short note and the e-mail form stays', () => {
    render(<LoginScreen {...props({ googleAvailable: false })} />);
    expect(screen.queryByTestId('login-google')).toBeNull();
    expect(screen.getByTestId('login-google-native-note')).toHaveTextContent('メールアドレスとパスワード');
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });

  it('US-E12-01 on the web the Google button is unchanged', () => {
    render(<LoginScreen {...props()} />);
    expect(screen.getByTestId('login-google')).toBeInTheDocument();
    expect(screen.queryByTestId('login-google-native-note')).toBeNull();
  });
});
