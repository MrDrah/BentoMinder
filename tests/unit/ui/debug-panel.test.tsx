// M4 slice C in jsdom: the development-only debug panel (US-E11-01, US-E11-02, US-E11-03). The production
// absence (E11-01/AC2) is proven on the built bundle in tests/e2e/m4-share-debug.spec.ts and by check:no-debug.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DebugPanel from '../../../src/debug/panel.tsx';
import { AI_MODES, sim, simulatedResult, wrapClock, wrapExtractor, wrapPdfSource } from '../../../src/debug/sim.ts';
import type { ExtractResult, FileExport, MenuExtractor, PdfSource } from '../../../src/domain/ports.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/index.ts';
import { createRepository } from '../../../src/domain/storage/repository.ts';
import { App } from '../../../src/ui/App.tsx';
import { AppProvider, type AppServices } from '../../../src/ui/app-store.tsx';
import { fixedClock, memoryStorage } from '../helpers/memory-storage.ts';
import { fakeExtractor, fakePdfSource } from '../helpers/app.tsx';
import { loadFixture } from '../helpers/fixtures.ts';
import { jst, november } from './m4-fixtures.ts';

afterEach(() => {
  sim.offset = null;
  sim.aiMode = 'off';
  vi.restoreAllMocks();
});

async function mount(store: BentoMinderStore, at: string) {
  const storage = memoryStorage({ 'bentominder.state': JSON.stringify(store) });
  const base = fixedClock(at);
  const clock = wrapClock(base);
  const extractor = fakeExtractor();
  const services = {
    pdfSource: fakePdfSource(),
    extractor,
    fileExport: { save: vi.fn<FileExport['save']>(() => Promise.resolve()) },
    isOnline: () => true,
    dictionary: loadFixture('../../data/dictionary.json'),
  } as unknown as AppServices;
  window.location.hash = '';
  render(
    <AppProvider repository={createRepository(storage, clock)} clock={clock} newDeviceId={() => '3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d'} services={services}>
      <App />
      <DebugPanel />
    </AppProvider>,
  );
  await screen.findByTestId(/^screen-/);
  return { storage, extractor, stored: () => JSON.parse(storage.data.get('bentominder.state') ?? 'null') as BentoMinderStore };
}

const clearedLog = (): BentoMinderStore => ({ ...november(), reminderLog: [] });
const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByTestId('debug-open'));
  return screen.getByTestId('debug-panel');
};
const setClock = async (user: ReturnType<typeof userEvent.setup>, value: string) => {
  const input = screen.getByTestId('debug-clock-input');
  await user.clear(input);
  await user.type(input, value);
  await user.click(screen.getByTestId('debug-clock-set'));
};

describe('US-E11-01 debug panel only in development', () => {
  it('US-E11-01/AC1 a 「Debug」 button is visible in a corner and opens the panel carrying the marker', async () => {
    const user = userEvent.setup();
    await mount(november(), jst('2026-11-01 10:00'));
    expect(screen.getByTestId('debug-open')).toHaveTextContent('Debug');
    expect(screen.queryByTestId('debug-panel')).toBeNull();
    const panel = await openPanel(user);
    expect(panel).toHaveAttribute('data-marker', 'BM_DEBUG_PANEL');
  });

  it('US-E11-01/AC2 nothing outside src/debug imports the debug module except the development-only branch of main.tsx', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (path.replaceAll('\\', '/').endsWith('src/debug')) continue;
          walk(path);
        } else if (/\.(ts|tsx)$/.test(name)) {
          const text = readFileSync(path, 'utf8');
          if (/from\s+['"][^'"]*debug\//.test(text)) offenders.push(`${path} (static import)`);
          if (/import\(\s*['"][^'"]*debug\//.test(text) && !path.replaceAll('\\', '/').endsWith('src/main.tsx')) offenders.push(`${path} (dynamic import)`);
        }
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
    const main = readFileSync(join(process.cwd(), 'src', 'main.tsx'), 'utf8');
    const dynamic = main.match(/import\.meta\.env\.DEV\s*\?[^\n]*import\(\s*['"]\.\/debug\//g) ?? [];
    expect(dynamic.length).toBe((main.match(/import\(\s*['"]\.\/debug\//g) ?? []).length);
  });
});

describe('US-E11-02 simulate time and trigger reminders', () => {
  it('US-E11-02/AC1 setting 2026-11-03 17:29 JST and advancing one minute makes the 2026-11-04 day-before reminder due, and today uses the simulated time', async () => {
    const user = userEvent.setup();
    await mount(clearedLog(), jst('2026-11-01 10:00'));
    await openPanel(user);
    await setClock(user, '2026-11-03T17:29');
    expect(await screen.findByTestId('debug-clock-simulated')).toBeInTheDocument();
    expect(screen.getByTestId('debug-clock-status')).toHaveTextContent('2026-11-03 17:29');
    expect(await screen.findByTestId('today-card')).toHaveTextContent(/Nov 3|11月3日/);
    expect(screen.queryByTestId('reminder-day-before-2026-11-04')).toBeNull();
    await user.click(screen.getByTestId('debug-clock-plus-minute'));
    expect(screen.getByTestId('debug-clock-status')).toHaveTextContent('2026-11-03 17:30');
    expect(await screen.findByTestId('reminder-day-before-2026-11-04')).toBeInTheDocument();
  });

  it('US-E11-02/AC2 「前日のお知らせを表示」 and 「週のまとめを表示」 show debug-triggered reminders for the simulated time and write nothing to the log', async () => {
    const user = userEvent.setup();
    const app = await mount(clearedLog(), jst('2026-11-01 10:00'));
    await openPanel(user);
    await setClock(user, '2026-11-03T12:00');
    await waitFor(() => expect(screen.getByTestId('debug-clock-status')).toHaveTextContent('12:00'));
    const before = JSON.stringify(app.stored().reminderLog);
    await user.click(screen.getByTestId('debug-trigger-day-before'));
    const first = await screen.findByTestId('debug-triggered');
    expect(first).toHaveAttribute('data-debug-key', 'day-before:2026-11-04');
    expect(first).toHaveTextContent('デバッグ表示');
    expect(within(first).getByTestId('reminder-day-before-2026-11-04')).toHaveTextContent('明日は手作りお弁当の日！');
    await user.click(screen.getByTestId('debug-trigger-weekly'));
    const weekly = await screen.findByTestId('debug-triggered');
    expect(weekly.getAttribute('data-debug-key')).toMatch(/^weekly:/);
    expect(weekly).toHaveTextContent('デバッグ表示');
    expect(JSON.stringify(app.stored().reminderLog)).toBe(before);
  });

  it('US-E11-02/AC3 「実時間に戻す」 uses the real (underlying) time again', async () => {
    const user = userEvent.setup();
    await mount(november(), jst('2026-11-01 10:00'));
    await openPanel(user);
    await setClock(user, '2026-12-24T09:00');
    expect(await screen.findByTestId('debug-clock-simulated')).toBeInTheDocument();
    await user.click(screen.getByTestId('debug-clock-real'));
    expect(screen.queryByTestId('debug-clock-simulated')).toBeNull();
    expect(screen.getByTestId('debug-clock-status')).toHaveTextContent('2026-11-01 10:00');
  });

  it('US-E11-02/AC1 an invalid date shows a line with an exclamation mark and leaves the clock alone', async () => {
    const user = userEvent.setup();
    await mount(november(), jst('2026-11-01 10:00'));
    await openPanel(user);
    await user.click(screen.getByTestId('debug-clock-set'));
    expect(screen.getByTestId('debug-clock-invalid')).toHaveTextContent(/^!/);
    expect(sim.offset).toBeNull();
  });
});

describe('US-E11-03 samples, AI failure simulation and storage tools', () => {
  it('US-E11-03/AC1 「サンプルのプロフィール」 loads the sample child and 「サンプルの献立（2026年11月）」 opens the review with no AI call', async () => {
    const user = userEvent.setup();
    const store = november();
    store.profile = null;
    store.decisions = {};
    store.menus = {};
    const app = await mount(store, jst('2026-11-01 10:00'));
    await openPanel(user);
    await user.click(screen.getByTestId('debug-sample-profile'));
    await waitFor(() => expect(app.stored().profile?.nickname).toBe('はなちゃん'));
    await user.click(screen.getByTestId('debug-sample-menu'));
    await waitFor(() => expect(window.location.hash).toBe('#/review/2026-11'));
    expect(await screen.findByTestId('screen-review-page')).toBeInTheDocument();
    expect(app.extractor.extract).not.toHaveBeenCalled();
    expect(app.stored().menus['2026-11' as keyof BentoMinderStore['menus']]).toBeDefined();
  });

  it('US-E11-03/AC2 each failure mode returns what its story describes, and the real extractor is untouched when off', async () => {
    const real: MenuExtractor = { extract: vi.fn(() => Promise.resolve({ ok: false, error: 'NETWORK', providerCalls: 0 } as ExtractResult)) };
    const menu = { marker: 'menu' } as never;
    sim.sampleMenu = () => menu;
    const extractor = wrapExtractor(real);
    const run = () => extractor.extract({ pdf: new Uint8Array(), targetMonth: '2026-11' });
    expect(await run()).toMatchObject({ error: 'NETWORK' });
    const expected: Record<(typeof AI_MODES)[number], unknown> = {
      'malformed-json': { ok: false, error: 'MALFORMED_OUTPUT', providerCalls: 2 }, // US-E2-05/AC2
      'malformed-then-valid': { ok: true, meta: { providerCalls: 2, model: 'simulated-primary' } }, // US-E2-05/AC1
      'rate-limited-primary': { ok: true, meta: { providerCalls: 2, model: 'simulated-fallback' } }, // US-E2-06/AC5
      'rate-limited': { ok: false, error: 'RATE_LIMITED', retryAfterSec: 60, providerCalls: 2 }, // US-E2-06/AC6
      unavailable: { ok: false, error: 'UNAVAILABLE', providerCalls: 2 }, // US-E2-06/AC2
      'url-unreachable': null, // US-E2-02/AC1: the PDF source fails, the extractor is not involved
    };
    for (const mode of AI_MODES) {
      sim.aiMode = mode;
      if (mode === 'url-unreachable') {
        const pdf: PdfSource = fakePdfSource();
        expect(await wrapPdfSource(pdf).fromUrl('https://example.test/menu.pdf')).toEqual({ ok: false, error: 'NETWORK' });
        expect(pdf.fromUrl).not.toHaveBeenCalled();
        continue;
      }
      expect(await run(), mode).toMatchObject(expected[mode] as object);
      expect(simulatedResult(mode, menu)).toMatchObject(expected[mode] as object);
    }
    sim.aiMode = 'off';
    const pdf = fakePdfSource();
    await wrapPdfSource(pdf).fromUrl('https://example.test/menu.pdf');
    expect(pdf.fromUrl).toHaveBeenCalledOnce();
  });

  it('US-E11-03/AC2 the mode picked in the panel makes an import behave as the story says', async () => {
    const user = userEvent.setup();
    await mount(november(), jst('2026-11-01 10:00'));
    await openPanel(user);
    await user.selectOptions(screen.getByTestId('debug-ai-mode'), 'rate-limited');
    expect(sim.aiMode).toBe('rate-limited');
    expect(screen.getByTestId('debug-ai-usage')).toHaveTextContent(/AI呼び出し：[0-9]+回/);
  });

  it('US-E11-03/AC3 the panel lists the stored decisions and overrides, and 「テストデータを消去」 clears the store after a confirmation', async () => {
    const user = userEvent.setup();
    const app = await mount(november(), jst('2026-11-01 10:00'));
    await openPanel(user);
    const table = screen.getByTestId('debug-decisions');
    expect(within(table).getByText('2026-11-04')).toBeInTheDocument();
    expect(within(table).getByText('homemade-bento-planned')).toBeInTheDocument();
    expect(within(table).getByText('rcp-delish-himawari-bento')).toBeInTheDocument();
    expect(screen.getByTestId('debug-overrides')).toBeInTheDocument();
    await user.click(screen.getByTestId('debug-clear'));
    await user.click(await screen.findByTestId('dialog-debug-clear-cancel'));
    expect(Object.keys(app.stored().decisions).length).toBeGreaterThan(0);
    await user.click(screen.getByTestId('debug-clear'));
    await user.click(await screen.findByTestId('dialog-debug-clear-confirm'));
    await waitFor(() => expect(app.storage.data.get('bentominder.state') ?? null).toBeNull());
  });
});
