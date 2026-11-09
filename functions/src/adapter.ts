// Edge adapter: a Cloud Functions (Express-style) request/response to the framework-neutral core
// (server/core/handle.ts). No Google SDK is imported here, so tests drive it with plain fakes.
// Body: the functions framework has already buffered it as `rawBody`; if it is absent the raw stream is read.
import { handle, TooLarge, type CoreRequest, type ProxyDeps } from '../../server/core/handle.ts';

export interface FnRequest {
  method: string;
  url?: string | undefined;
  originalUrl?: string | undefined;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  rawBody?: Uint8Array | undefined;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | string>;
}

export interface FnResponse {
  statusCode: number;
  writableEnded?: boolean;
  headersSent?: boolean;
  setHeader(name: string, value: string): unknown;
  end(body?: Uint8Array | string): unknown;
  on(event: 'close', listener: () => void): unknown;
}

function headersOf(req: FnRequest): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(req.headers)) headers[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  return headers;
}

async function readStream(req: FnRequest, limit: number): Promise<Uint8Array> {
  const iterate = req[Symbol.asyncIterator];
  if (iterate === undefined) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let it = iterate.call(req), step = await it.next(); step.done !== true; step = await it.next()) {
    const chunk = typeof step.value === 'string' ? new TextEncoder().encode(step.value) : step.value;
    size += chunk.byteLength;
    if (size > limit) throw new TooLarge();
    chunks.push(chunk);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return all;
}

export function toCoreRequest(req: FnRequest, signal: AbortSignal): CoreRequest {
  const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost');
  return {
    method: req.method,
    path: url.pathname,
    query: url.searchParams,
    headers: headersOf(req),
    readBody: (limit) => {
      if (req.rawBody !== undefined) {
        if (req.rawBody.byteLength > limit) return Promise.reject(new TooLarge());
        return Promise.resolve(req.rawBody);
      }
      return readStream(req, limit);
    },
    signal,
  };
}

/** The `(req, res)` function `onRequest` runs. `getDeps` is called per request (it memoises). */
export function createApiHandler(getDeps: () => ProxyDeps | Promise<ProxyDeps>) {
  return async (req: FnRequest, res: FnResponse): Promise<void> => {
    const controller = new AbortController();
    // The caller gave up: make no further provider call (as locally, US-E2-04/AC8).
    res.on('close', () => {
      if (res.writableEnded !== true) controller.abort();
    });
    let deps: ProxyDeps | undefined;
    try {
      deps = await getDeps();
      const out = await handle(toCoreRequest(req, controller.signal), deps);
      if (res.writableEnded === true) return;
      res.statusCode = out.status;
      for (const [name, value] of Object.entries(out.headers)) res.setHeader(name, value);
      res.end(out.body === null ? undefined : out.body);
    } catch (e) {
      // Class only, never the message (US-E14-06/AC2). `handle` already catches its own errors.
      deps?.log(`error endpoint=- class=${e instanceof Error && /^\w{1,40}$/.test(e.constructor.name) ? e.constructor.name : 'unknown'}`);
      if (res.headersSent !== true && res.writableEnded !== true) {
        try {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end('{"ok":false,"error":"INTERNAL"}');
        } catch {
          // the connection is gone; nothing more to do
        }
      }
    }
  };
}
