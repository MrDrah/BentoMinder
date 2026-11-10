// ADR 016 slice C: how the app shell talks to the sync controller. A stub controller records the calls; nothing is rendered
// for sync (slice D). Also: with no controller the app is exactly as before.
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRepository } from '../../../src/domain/storage/repository.ts';
import type { BentoMinderStore } from '../../../src/domain/schema/store.ts';
import { AppProvider, useApp } from '../../../src/ui/app-store.tsx';
import type { SyncController } from '../../../src/ui/sync/controller.ts';
import { DISABLED_SYNC_STATE } from '../../../src/ui/sync/state.ts';
import { useSyncState } from '../../../src/ui/sync/sync-context.tsx';
import { storeV1 } from '../helpers/fixtures.ts';
import { fixedClock, memoryStorage } from '../helpers/memory-storage.ts';

const clock = fixedClock('2026-11-14T15:30:00Z');

function stubController() {
  let applied: ((s: BentoMinderStore) => void) | null = null;
  const state = { ...DISABLED_SYNC_STATE, enabled: true };
  const stub = {
    getState: vi.fn(() => state),
    subscribe: vi.fn(() => () => undefined),
    start: vi.fn(),
    stop: vi.fn(),
    active: true,
    syncNow: vi.fn(),
    localChanged: vi.fn(() => Promise.resolve()),
    localDataDeleted: vi.fn(() => Promise.resolve()),
    metaChanged: vi.fn(() => Promise.resolve()),
    onStoreApplied: vi.fn((h: (s: BentoMinderStore) => void) => {
      applied = h;
      return () => undefined;
    }),
    clearNotices: vi.fn(),
  };
  return { stub: stub as unknown as SyncController & typeof stub, apply: (s: BentoMinderStore) => applied?.(s) };
}

let api: ReturnType<typeof useApp> | null = null;
function Probe() {
  const app = useApp();
  const sync = useSyncState();
  useEffect(() => {
    api = app;
  });
  return <div data-testid="screen-probe">{app.state.phase === 'ready' ? `${sync.enabled ? 'on' : 'off'}:${sync.view.state}:${app.state.store.settings.language}` : 'loading'}</div>;
}

async function renderProbe(sync?: SyncController | null) {
  const storage = memoryStorage({ 'bentominder.state': JSON.stringify(storeV1()) });
  render(
    <AppProvider repository={createRepository(storage, clock)} clock={clock} newDeviceId={() => 'dev-1'} {...(sync === undefined ? {} : { sync })}>
      <Probe />
    </AppProvider>,
  );
  await screen.findByText(/^(on|off):/);
  return storage;
}

const current = (): ReturnType<typeof useApp> => {
  if (api === null) throw new Error('not rendered');
  return api;
};

describe('US-E15-11/AC1 sync off: the app is exactly as before', () => {
  it('US-E15-11/AC1 without a controller commits, language changes and start-over work and the state is local-only and disabled', async () => {
    await renderProbe();
    expect(screen.getByTestId('screen-probe').textContent).toBe('off:local-only:ja');
    const state = current().state;
    const next = { ...(state.phase === 'ready' ? state.store : storeV1()) } as BentoMinderStore;
    await act(async () => {
      expect(await current().commit(next)).toBe(true);
    });
    await act(async () => {
      await current().startOver();
    });
  });
});

describe('slice A decision 4: every local commit is reported to the engine', () => {
  it('US-E15-06/AC1 commit, language change and import each call localChanged with the saved store, after the save', async () => {
    const { stub } = stubController();
    const storage = await renderProbe(stub);
    const store = (current().state as { store: BentoMinderStore }).store;
    const edited = { ...store, updatedAt: '2026-11-15T01:00:00+09:00' };
    await act(async () => {
      await current().commit(edited);
    });
    expect(stub.localChanged).toHaveBeenCalledTimes(1);
    expect(stub.localChanged).toHaveBeenLastCalledWith(edited);
    expect(JSON.parse(storage.data.get('bentominder.state') ?? '{}').updatedAt).toBe(edited.updatedAt);
    await act(async () => {
      current().setLanguage('en');
    });
    await vi.waitFor(() => expect(stub.localChanged).toHaveBeenCalledTimes(2));
    await act(async () => {
      await current().replaceStore({ ...edited, updatedAt: '2026-11-15T02:00:00+09:00' });
    });
    expect(stub.localChanged).toHaveBeenCalledTimes(3);
  });

  it('US-E15-06/AC1 a save that failed is not reported as a local change', async () => {
    const { stub } = stubController();
    const storage = await renderProbe(stub);
    storage.failWrites = true;
    const store = (current().state as { store: BentoMinderStore }).store;
    await act(async () => {
      expect(await current().commit({ ...store, updatedAt: '2026-11-15T01:00:00+09:00' })).toBe(false);
    });
    expect(stub.localChanged).not.toHaveBeenCalled();
  });

  it('US-E15-11/AC7 delete-all tells the engine, so the family data is downloaded again instead of deleted', async () => {
    const { stub } = stubController();
    await renderProbe(stub);
    await act(async () => {
      await current().startOver();
    });
    expect(stub.localDataDeleted).toHaveBeenCalledTimes(1);
  });
});

describe('US-E15-06/AC1 and AC10 the engine starts after the local copy loads and stops with the account', () => {
  it('US-E15-06/AC1 start is called once the local copy is loaded (the app never waits for sync); stop on unmount (sign-out)', async () => {
    const { stub } = stubController();
    const storage = memoryStorage({ 'bentominder.state': JSON.stringify(storeV1()) });
    const view = render(
      <AppProvider repository={createRepository(storage, clock)} clock={clock} newDeviceId={() => 'dev-1'} sync={stub}>
        <Probe />
      </AppProvider>,
    );
    await screen.findByText(/^on:/);
    expect(stub.start).toHaveBeenCalledTimes(1);
    expect(stub.stop).not.toHaveBeenCalled();
    view.unmount();
    expect(stub.stop).toHaveBeenCalled();
  });

  it('US-E15-05/AC7 a store the engine applied from the family is shown (the app state follows the saved copy)', async () => {
    const { stub, apply } = stubController();
    await renderProbe(stub);
    const store = (current().state as { store: BentoMinderStore }).store;
    expect(screen.getByTestId('screen-probe').textContent).toBe('on:local-only:ja');
    act(() => apply({ ...store, settings: { ...store.settings, language: 'en' } }));
    expect(screen.getByTestId('screen-probe').textContent).toBe('on:local-only:en');
  });
});
