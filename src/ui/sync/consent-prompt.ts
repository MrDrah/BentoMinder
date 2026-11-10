// Whether the re-consent notice (upgrade state, US-E15-02/AC6) is showing. It opens by itself on the first open with a
// newer notice version; declining closes it for this session (the card keeps the "paused" banner and a way back in).
import { useSyncExternalStore } from 'react';

let dismissed = false;
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const l of [...listeners]) l();
};

export function dismissConsentPrompt(): void {
  dismissed = true;
  emit();
}

export function reopenConsentPrompt(): void {
  dismissed = false;
  emit();
}

/** Test support: a fresh session. */
export function resetConsentPrompt(): void {
  dismissed = false;
  emit();
}

export function useConsentPromptDismissed(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dismissed,
  );
}
