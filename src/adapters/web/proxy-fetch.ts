// The fetch the two proxy adapters use (ADR 015 slice C, US-E14-07/AC1, AC4-AC6; US-E14-08/AC1, AC8).
// It turns "/api/..." paths into the configured base, and for a HOSTED base only:
//   - attaches "Authorization: Bearer <ID token>" from the signed-in account (never in a URL, never stored or logged);
//   - sends nothing at all when nobody is signed in (the request is refused here, AC8);
//   - on a 401 UNAUTHENTICATED reply fetches a fresh token and retries the same request exactly once.
// The token goes only to the configured base. The target of a "fetch this PDF" request travels in the JSON body
// to the proxy and is never a request address from here, so the token cannot reach it (AC6).
import type { ProxyBase } from '../../domain/proxy/base-url.ts';

/** `forceRefresh` asks the provider for a new token instead of the cached one; null = nobody signed in. */
export type IdTokenSupplier = (forceRefresh: boolean) => Promise<string | null>;

export interface ProxyFetchOptions {
  base: ProxyBase;
  getToken: IdTokenSupplier;
  fetchImpl?: typeof fetch;
}

export class NotSignedInError extends Error {
  constructor() {
    super('no signed-in account');
  }
}

async function isUnauthenticated(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    return ((await res.clone().json()) as { error?: unknown }).error === 'UNAUTHENTICATED';
  } catch {
    return false;
  }
}

export function createProxyFetch({ base, getToken, fetchImpl = (...args) => fetch(...args) }: ProxyFetchOptions): typeof fetch {
  return async (input, init) => {
    const path = String(input);
    if (!path.startsWith('/api/')) throw new Error('proxy paths start with /api/');
    if (base.mode === 'same-origin') return fetchImpl(path, init);
    const url = `${base.base}${path}`;
    if (base.mode === 'local') return fetchImpl(url, init);

    const send = async (token: string): Promise<Response> => {
      const headers = new Headers(init?.headers);
      headers.set('authorization', `Bearer ${token}`);
      return fetchImpl(url, { ...init, headers });
    };
    const token = await getToken(false);
    if (token === null) throw new NotSignedInError();
    const res = await send(token);
    if (!(await isUnauthenticated(res))) return res;
    const fresh = await getToken(true);
    if (fresh === null) return res;
    return send(fresh);
  };
}
