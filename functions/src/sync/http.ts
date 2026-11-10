// Edge adapter for `sync`: a Cloud Functions request/response to handleSync. Same shape as the `api` adapter; no Google SDK.
import { toCoreRequest, type FnRequest, type FnResponse } from '../adapter.ts';
import { handleSync, type SyncDeps } from './service.ts';

/** The `(req, res)` function `onRequest` runs. `getDeps` is called per request (it memoises). */
export function createSyncHandler(getDeps: () => SyncDeps | Promise<SyncDeps>) {
  return async (req: FnRequest, res: FnResponse): Promise<void> => {
    const controller = new AbortController();
    res.on('close', () => {
      if (res.writableEnded !== true) controller.abort();
    });
    let deps: SyncDeps | undefined;
    try {
      deps = await getDeps();
      const out = await handleSync(toCoreRequest(req, controller.signal), deps);
      if (res.writableEnded === true) return;
      res.statusCode = out.status;
      for (const [name, value] of Object.entries(out.headers)) res.setHeader(name, value);
      res.end(out.body === null ? undefined : out.body);
    } catch (e) {
      deps?.log(`error op=- class=${e instanceof Error && /^\w{1,40}$/.test(e.constructor.name) ? e.constructor.name : 'unknown'}`);
      if (res.headersSent !== true && res.writableEnded !== true) {
        try {
          res.statusCode = 503;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end('{"ok":false,"error":"UNAVAILABLE"}');
        } catch {
          // the connection is gone
        }
      }
    }
  };
}
