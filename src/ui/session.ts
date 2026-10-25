// In-memory only (never stored, ADR 003: PDFs are not kept): object URLs of the PDFs read in
// this session, so 「元のPDFを見る」 can open an uploaded file (US-E3-01/AC3).
import type { ProfileForm } from '../domain/profile/profile.ts';

const urls = new Map<string, string>();

export function rememberSessionPdf(sha256: string, bytes: Uint8Array): void {
  if (urls.has(sha256) || typeof URL.createObjectURL !== 'function') return;
  try {
    urls.set(sha256, URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })));
  } catch {
    // Best effort: without an object URL the review offers the source URL only.
  }
}

export function sessionPdfUrl(sha256: string): string | undefined {
  return urls.get(sha256);
}

// Step-1 answers typed so far, kept while the parent visits settings from onboarding and comes back
// (US-E1-01/AC6). In memory only; the answers are stored by 「次へ」, as before.
let profileDraft: ProfileForm | null = null;

export const getProfileDraft = (): ProfileForm | null => profileDraft;
export const setProfileDraft = (form: ProfileForm | null): void => {
  profileDraft = form;
};
