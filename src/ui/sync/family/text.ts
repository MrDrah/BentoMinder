// Small text helpers of the family screens.
import { CLOUD_NOTICE_VERSION } from '../../../domain/sync/config.ts';

/** "ABCDE" -> "A B C D E": a screen reader speaks an invite code one character at a time (components §16.4). */
export const chunkText = (code: string): string => Array.from(code).join(' ');

/** The alphabet of an invite code (data contract 14.3): no 0, O, 1 or I. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 10;

/** Any case, spaces and hyphens are ignored (US-E15-04/AC2). */
export const normaliseCode = (typed: string): string => typed.normalize('NFKC').toUpperCase().replace(/[\s-]/g, '');

export function codeIsValid(typed: string): boolean {
  const c = normaliseCode(typed);
  return c.length === CODE_LENGTH && Array.from(c).every((ch) => CODE_ALPHABET.includes(ch));
}

/** `ABCDE-FGHJK` for the field after it loses focus. */
export function groupCode(typed: string): string {
  const c = normaliseCode(typed);
  return c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
}

/** True when the cached consent of this device covers the app's notice version (no second notice, US-E15-05/AC2). */
export const consentCurrent = (consent: { version: number } | null): boolean => consent !== null && consent.version >= CLOUD_NOTICE_VERSION;
