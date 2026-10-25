// Renders the whole app in jsdom with fakes for storage, clock and the import adapters.
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { parseModelReply } from '../../../src/domain/menu/extraction.ts';
import type { ExtractResult, FileExport, MenuExtractor, PdfResult, PdfSource } from '../../../src/domain/ports.ts';
import type { BentoMinderStore, ExtractedMenu } from '../../../src/domain/schema/index.ts';
import { createRepository } from '../../../src/domain/storage/repository.ts';
import type { YearMonth } from '../../../src/domain/time/jst.ts';
import { App } from '../../../src/ui/App.tsx';
import { AppProvider, type AppServices } from '../../../src/ui/app-store.tsx';
import { loadFixture } from './fixtures.ts';
import { fixedClock, memoryStorage, type MemoryStorage } from './memory-storage.ts';

export const NOW_ISO = '2026-11-14T15:30:00Z'; // 2026-11-15 00:30 JST
export const DEVICE_ID = '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d';
export const FX01_SHA = 'f'.repeat(64);
export const PDF_BYTES = new TextEncoder().encode('%PDF-1.7 fixture');

/** The FX-01 journey stand-in as the proxy returns it (3 uncertain fields). */
export function fx01Menu(month = '2026-11', recorded = 'hand-1', fixture = 'fixture-menu-2026-11'): ExtractedMenu {
  const r = loadFixture<{ response: { modelOutput: unknown } }>(`menus/${fixture}/recorded/${recorded}.json`);
  const out = parseModelReply(JSON.stringify(r.response.modelOutput), {
    targetMonth: month as YearMonth,
    sha256: FX01_SHA,
    byteSize: PDF_BYTES.byteLength,
    model: 'gemini-3.8-flash',
    promptVersion: 1,
    at: '2026-11-15T00:30:00+09:00',
  });
  if (out.kind !== 'ok') throw new Error(out.kind);
  return out.menu;
}

export function fakePdfSource(result: PdfResult = { ok: true, bytes: PDF_BYTES, sha256: FX01_SHA, byteSize: PDF_BYTES.byteLength }) {
  return {
    fromUrl: vi.fn<PdfSource['fromUrl']>(() => Promise.resolve(result)),
    fromFile: vi.fn<PdfSource['fromFile']>((file) =>
      Promise.resolve(result.ok ? { ...result, ...(file.name ? { filename: file.name } : {}) } : result),
    ),
  };
}

export function fakeExtractor(result: ExtractResult | (() => Promise<ExtractResult>) = { ok: true, menu: fx01Menu(), meta: { model: 'gemini-3.8-flash', cached: false, promptVersion: 1, schemaVersion: 1, providerCalls: 1 } }) {
  return { extract: vi.fn<MenuExtractor['extract']>(() => (typeof result === 'function' ? result() : Promise.resolve(result))) };
}

export interface Rendered {
  storage: MemoryStorage;
  services: AppServices & { pdfSource: ReturnType<typeof fakePdfSource>; extractor: ReturnType<typeof fakeExtractor>; fileExport: { save: ReturnType<typeof vi.fn<FileExport['save']>> } };
  stored: () => BentoMinderStore;
}

export async function renderApp(options: { store?: BentoMinderStore | null; raw?: string; hash?: string; services?: Partial<Rendered['services']>; online?: boolean; now?: string } = {}): Promise<Rendered> {
  const initial = options.raw ?? (options.store ? JSON.stringify(options.store) : undefined);
  const storage = memoryStorage(initial === undefined ? {} : { 'bentominder.state': initial });
  const clock = fixedClock(options.now ?? NOW_ISO);
  const services = {
    pdfSource: fakePdfSource(),
    extractor: fakeExtractor(),
    fileExport: { save: vi.fn<FileExport['save']>(() => Promise.resolve()) },
    isOnline: () => options.online ?? true,
    dictionary: loadFixture('../../data/dictionary.json'),
    ...options.services,
  } as Rendered['services'];
  window.location.hash = options.hash ?? '';
  render(
    <AppProvider repository={createRepository(storage, clock)} clock={clock} newDeviceId={() => DEVICE_ID} services={services}>
      <App />
    </AppProvider>,
  );
  await screen.findByTestId(/^screen-/);
  return {
    storage,
    services,
    stored: () => JSON.parse(storage.data.get('bentominder.state') ?? 'null') as BentoMinderStore,
  };
}

/** A stored profile without any menu (onboarding resumes at step 2). */
export function profileOnly(): BentoMinderStore {
  const s = loadFixture<BentoMinderStore>('state/v1.json');
  return { ...s, menus: {}, overrides: {}, decisions: {}, reminderLog: [], consent: null, aiUsage: {} };
}
