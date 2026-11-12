// US-E13-08/AC7: client-side checks of the e-mail + password form, and the 60 s resend limit (AC4). Pure.
export type Mode = 'signin' | 'create' | 'forgot';
export type FieldError = 'emailEmpty' | 'emailInvalid' | 'pwEmpty' | 'pwShort';

export const MIN_PASSWORD_LENGTH = 8;
export const RESEND_COOLDOWN_MS = 60_000;

/** A plain shape check (one @, something either side, a dot in the domain, no spaces); the provider has the last word. */
export const isPlausibleEmail = (email: string): boolean => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);

/** Order: e-mail empty, e-mail invalid, password empty, password short (create only; sign-in never judges length). */
export function validateForm(mode: Mode, email: string, password: string): { email?: FieldError; password?: FieldError } {
  const e = email.trim();
  const out: { email?: FieldError; password?: FieldError } = {};
  if (e === '') out.email = 'emailEmpty';
  else if (!isPlausibleEmail(e)) out.email = 'emailInvalid';
  if (mode === 'forgot') return out;
  if (password === '') out.password = 'pwEmpty';
  else if (mode === 'create' && Array.from(password).length < MIN_PASSWORD_LENGTH) out.password = 'pwShort';
  return out;
}

/** Whole seconds left before the next confirmation e-mail may be sent; 0 = now. */
export function resendSecondsLeft(lastSentAtMs: number | null, nowMs: number, cooldownMs: number = RESEND_COOLDOWN_MS): number {
  if (lastSentAtMs === null) return 0;
  const left = Math.min(cooldownMs, cooldownMs - (nowMs - lastSentAtMs)); // a clock set back never shows more than the limit
  return left <= 0 ? 0 : Math.ceil(left / 1000);
}
