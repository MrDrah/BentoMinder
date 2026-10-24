// MenuExtractor web adapter. M0 stub: always UNAVAILABLE with 0 provider calls.
// M1 adds the mocked flow, M5 the real POST /api/menu/extract (ADR 002).
import type { MenuExtractor } from '../../domain/ports.ts';

export function createWebExtractor(): MenuExtractor {
  return {
    extract: () => Promise.resolve({ ok: false, error: 'UNAVAILABLE', providerCalls: 0 }),
  };
}
