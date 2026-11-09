// Pure pieces shared by the core and the mock transport, kept free of node:fs so the hosted bundle
// never pulls in the recorded-fixture code (ADR 015 §1).
import type { ProviderTransport } from '../menu/extract.ts';

/** Dev/test header that selects a recorded scenario; the hosted proxy never honours it. */
export const SCENARIO_HEADER = 'x-bm-mock-scenario';

export interface FixtureTransports {
  /** The transport for one request, or null when nothing is configured for this PDF. */
  forRequest(sha256: string, scenario: string | undefined): ProviderTransport | null;
  /** sha256 → fixture id, for logs and tests. */
  readonly known: ReadonlyMap<string, string>;
}
