// QA E15: a SyncPort that goes through the REAL stack: HTTP adapter -> request pipeline of the sync Function -> authorisation ->
// operations -> fake Firestore. The developers' FakeBackend is not used, so the engine is tested against the server it will meet.
import { createHttpSyncPort, type HttpSyncPort } from '../../../../src/adapters/web/sync-http.ts';
import { handleSync } from '../../../../functions/src/sync/service.ts';
import type { Rig } from './qa-rig.ts';
import { tokenOf } from './qa-rig.ts';

export interface Net {
  online: boolean;
  /** true = the request never reaches the server */
  dropBefore: () => boolean;
  /** true = the server commits, the reply is lost */
  dropAfter: () => boolean;
  calls: Array<{ op: string; status: number }>;
  /** every request as sent (op and parsed body) */
  requests: Array<{ op: string; body: Record<string, unknown> }>;
  /** replaces the database wrapper of the rig (cost counters) */
  deps?: () => import('../../../../functions/src/sync/service.ts').SyncDeps;
}

export const newNet = (): Net => ({ online: true, dropBefore: () => false, dropAfter: () => false, calls: [], requests: [] });

export function bridgePort(rig: Rig, uid: string, net: Net, options: { signedIn?: () => boolean } = {}): HttpSyncPort {
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!net.online) throw new TypeError('network down');
    if (net.dropBefore()) throw new TypeError('request lost');
    const url = new URL(String(input));
    const bytes = new TextEncoder().encode(String(init?.body ?? ''));
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    net.requests.push({ op: url.pathname.split('/').pop() ?? '', body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    const res = await handleSync({ method: init?.method ?? 'POST', path: url.pathname, query: url.searchParams, headers, readBody: () => Promise.resolve(bytes) }, net.deps === undefined ? rig.deps() : net.deps());
    net.calls.push({ op: url.pathname.split('/').pop() ?? '', status: res.status });
    if (net.dropAfter()) throw new TypeError('reply lost');
    return new Response(typeof res.body === 'string' ? res.body : null, { status: res.status });
  }) as typeof fetch;
  return createHttpSyncPort({
    base: 'https://sync.example.test',
    getToken: () => Promise.resolve(options.signedIn?.() === false ? null : tokenOf(uid)),
    fetchImpl,
    isOnline: () => net.online,
  });
}
