// ADR 016 slice C: builds the sync pieces of one signed-in account at start-up. Two steps because the repository needs the
// owner scope (family id from the saved metadata) before its first load, and the controller needs the repository.
import { createHttpSyncPort } from '../../adapters/web/sync-http.ts';
import { createWebSyncHost } from '../../adapters/web/sync-host.ts';
import type { IdTokenSupplier } from '../../adapters/web/proxy-fetch.ts';
import type { Clock, Storage } from '../../domain/ports.ts';
import { createEmptyStore } from '../../domain/storage/defaults.ts';
import type { Repository } from '../../domain/storage/repository.ts';
import { createOwnerScope, type OwnerScope } from '../../domain/sync/owner-scope.ts';
import type { SyncHost } from '../../domain/sync/host.ts';
import { createSyncController, loadSyncMeta, type SyncController } from './controller.ts';

export interface PrepareSyncOptions {
  uid: string;
  /** The validated https base (`parseSyncBase`). */
  base: string;
  getToken: IdTokenSupplier;
  storage: Storage;
  clock: Clock;
  newDeviceId: () => string;
  isOnline: () => boolean;
  host?: SyncHost;
  fetchImpl?: typeof fetch;
  random?: () => number;
}

export interface PreparedSync {
  /** Pass `scope.ids` as the repository's `allowedOwnerIds`. */
  scope: OwnerScope;
  attach(repository: Repository): SyncController;
}

export async function prepareSync(o: PrepareSyncOptions): Promise<PreparedSync> {
  const scope = createOwnerScope(o.uid);
  const alive = { current: true };
  let dropped = 0;
  const port = createHttpSyncPort({
    base: o.base,
    // After sign-out (stop) the token is never asked for: nothing is sent, nothing under another account.
    getToken: (force) => (alive.current ? o.getToken(force) : Promise.resolve(null)),
    isOnline: o.isOnline,
    onDropped: (n) => {
      dropped += n;
    },
    ...(o.fetchImpl === undefined ? {} : { fetchImpl: o.fetchImpl }),
  });
  scope.setFamilyId((await loadSyncMeta(o.storage, o.uid)).meta.familyId);
  return {
    scope,
    attach: (repository) =>
      createSyncController({
        uid: o.uid,
        port,
        repository,
        storage: o.storage,
        scope,
        host: o.host ?? createWebSyncHost(),
        nowMs: () => o.clock.now(),
        random: o.random ?? Math.random,
        freshStore: () => createEmptyStore({ deviceId: o.newDeviceId(), now: o.clock.now(), ownerId: o.uid }),
        alive,
        ignoredFromAdapter: {
          take: () => {
            const n = dropped;
            dropped = 0;
            return n;
          },
        },
      }),
  };
}
