// Ports (interfaces only): the domain talks to these; each environment plugs in adapters
// (architecture §3; ADR 002, 003, 005). Tests plug in fakes.
import type { ExtractedMenu } from './schema/extracted-menu.ts';
import type { Instant } from './time/jst.ts';

export interface Clock {
  now(): Instant;
}

/** ADR 003: one versioned document plus the last good copy. */
export type StorageKey = 'bentominder.state' | 'bentominder.state.prev';
export const STORAGE_KEYS: readonly StorageKey[] = ['bentominder.state', 'bentominder.state.prev'];

export interface Storage {
  read(key: StorageKey): Promise<string | null>;
  write(key: StorageKey, value: string): Promise<void>;
  remove(key: StorageKey): Promise<void>;
}

export type PdfBytes = Uint8Array;

export type ExtractError = 'RATE_LIMITED' | 'UNAVAILABLE' | 'MALFORMED_OUTPUT' | 'NOT_A_MENU' | 'TOO_LARGE' | 'NETWORK';
export type ProviderCalls = 0 | 1 | 2;

export type ExtractResult =
  | {
      ok: true;
      menu: ExtractedMenu;
      meta: { model: string; cached: boolean; promptVersion: number; schemaVersion: number; providerCalls: ProviderCalls };
    }
  | { ok: false; error: ExtractError; retryAfterSec?: number; providerCalls: ProviderCalls };

export interface MenuExtractor {
  extract(input: { pdf: PdfBytes; targetMonth: string }, signal?: AbortSignal): Promise<ExtractResult>;
}

export type PdfError = 'NETWORK' | 'NOT_FOUND' | 'NOT_A_PDF' | 'TOO_LARGE' | 'URL_NOT_ALLOWED' | 'UNAVAILABLE';
export type PdfResult =
  | { ok: true; bytes: PdfBytes; sha256: string; byteSize: number; filename?: string }
  | { ok: false; error: PdfError };

export interface PdfSource {
  fromUrl(url: string): Promise<PdfResult>;
  fromFile(file: Blob): Promise<PdfResult>;
}

/** ADR 004 §4: a planned reminder; keys follow the contract's ReminderLogEntry.key. */
export interface ReminderJob {
  key: string;
  numericId: number;
  type: 'weekly' | 'day-before';
  dueAt: Instant;
  expiresAt: Instant;
  target: { route: string };
  content: { titleKey: string; bodyKey: string; params: Record<string, string | number | string[]> };
  contentHash: string;
}

export type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'not-needed';

export interface NotificationScheduler {
  capabilities(): { background: boolean; exactTime: boolean };
  permission(): Promise<NotificationPermission>;
  requestPermission(): Promise<'granted' | 'denied'>;
  apply(diff: { remove: string[]; upsert: ReminderJob[] }): Promise<void>;
  cancelAll(): Promise<void>;
  onTap(handler: (route: string) => void): void;
}

export interface Share {
  share(text: string): Promise<'shared' | 'copied' | 'cancelled'>;
}
