// US-E14-07/AC1-AC3, AC5: what VITE_AI_PROXY_BASE_URL means. Pure: no DOM, no network.
//   same-origin  unset, empty or rejected: the endpoints are called on the app's own origin (dev proxy), no token.
//   local        http://127.0.0.1 or http://localhost: the local proxy, still no token (AC5).
//   hosted       any other https URL: requests carry the account's ID token (AC4).
export type ProxyBase = { mode: 'same-origin' } | { mode: 'local'; base: string } | { mode: 'hosted'; base: string };

export interface ParsedProxyBase {
  base: ProxyBase;
  /** True when a value was given but rejected (AC3): the caller logs one warning naming the variable, never the value. */
  rejected: boolean;
}

export const PROXY_BASE_VARIABLE = 'VITE_AI_PROXY_BASE_URL';

const SAME_ORIGIN: ParsedProxyBase = { base: { mode: 'same-origin' }, rejected: false };
const REJECTED: ParsedProxyBase = { base: { mode: 'same-origin' }, rejected: true };

export function parseProxyBase(raw: unknown): ParsedProxyBase {
  if (raw === undefined || raw === null) return SAME_ORIGIN;
  if (typeof raw !== 'string') return REJECTED;
  const text = raw.trim();
  if (text === '') return SAME_ORIGIN;
  // A query or fragment marker anywhere is a rejection, even an empty one ("https://x/?").
  if (text.includes('?') || text.includes('#')) return REJECTED;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return REJECTED;
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return REJECTED;
  const base = `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  if (url.protocol === 'https:') return { base: { mode: 'hosted', base }, rejected: false };
  if (url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost')) return { base: { mode: 'local', base }, rejected: false };
  return REJECTED;
}
