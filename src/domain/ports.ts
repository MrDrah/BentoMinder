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
  /**
   * Optional: calls `handler` when another tab, window or process changed a stored key (not for
   * this instance's own writes). Returns the unsubscribe function. ADR 003 change log 2026-10-25.
   */
  onExternalChange?(handler: () => void): () => void;
}

export type PdfBytes = Uint8Array;

/** ADR 002 §3 wire errors, plus NOT_A_PDF / NOT_CONFIGURED (M1) and NETWORK (proxy unreachable). */
export type ExtractError =
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'MALFORMED_OUTPUT'
  | 'NOT_A_MENU'
  | 'TOO_LARGE'
  | 'NOT_A_PDF'
  | 'NOT_CONFIGURED'
  | 'NETWORK';
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

/** US-E2-02/AC1, AC3, US-E2-03: BLOCKED = 403 / private address / > 3 redirects; EMPTY = 0 bytes. */
export type PdfError = 'NETWORK' | 'NOT_FOUND' | 'NOT_A_PDF' | 'TOO_LARGE' | 'BLOCKED' | 'EMPTY';
export type PdfResult =
  | { ok: true; bytes: PdfBytes; sha256: string; byteSize: number; filename?: string }
  | { ok: false; error: PdfError };

export interface PdfSource {
  fromUrl(url: string, signal?: AbortSignal): Promise<PdfResult>;
  fromFile(file: Blob & { name?: string }): Promise<PdfResult>;
}

/** Saving a file the parent keeps (export, US-E10-03/AC4); Android uses the share sheet in v1. */
export interface FileExport {
  save(filename: string, contents: string, mime: string): Promise<void>;
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
