// Development-only simulation state: the clock offset and the AI failure mode (US-E11-02, US-E11-03/AC2).
// The wrappers are installed by main.tsx in development only; production never imports this file.
import { createSystemClock } from '../adapters/web/clock.ts';
import type { Clock, ExtractResult, MenuExtractor, PdfSource } from '../domain/ports.ts';
import type { ExtractedMenu } from '../domain/schema/index.ts';
import type { Instant } from '../domain/time/jst.ts';

export const AI_MODES = ['malformed-json', 'malformed-then-valid', 'rate-limited-primary', 'rate-limited', 'unavailable', 'url-unreachable'] as const;
export type AiMode = (typeof AI_MODES)[number] | 'off';

export interface Sim {
  /** Milliseconds added to the real clock; null when the real time is used. */
  offset: number | null;
  aiMode: AiMode;
  /** The valid extraction the success modes return (set by the panel from the fixture). */
  sampleMenu: (() => ExtractedMenu) | null;
}

export const sim: Sim = { offset: null, aiMode: 'off', sampleMenu: null };
const listeners = new Set<() => void>();
export const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const emit = (): void => listeners.forEach((fn) => fn());

let underlying: Clock = createSystemClock();
/** The device time, without the simulated offset. */
export const realNow = (): Instant => underlying.now();

export function wrapClock(base: Clock): Clock {
  underlying = base;
  return { now: () => (base.now() + (sim.offset ?? 0)) as Instant };
}

/** What each failure mode returns; the story and the provider-call count are in the comment (US-E11-03/AC2). */
export function simulatedResult(mode: Exclude<AiMode, 'off' | 'url-unreachable'>, menu: ExtractedMenu): ExtractResult {
  const meta = (model: string) => ({ model, cached: false, promptVersion: 1, schemaVersion: 1, providerCalls: 2 as const });
  switch (mode) {
    case 'malformed-json': // US-E2-05/AC2
      return { ok: false, error: 'MALFORMED_OUTPUT', providerCalls: 2 };
    case 'malformed-then-valid': // US-E2-05/AC1
      return { ok: true, menu, meta: meta('simulated-primary') };
    case 'rate-limited-primary': // US-E2-06/AC5
      return { ok: true, menu, meta: meta('simulated-fallback') };
    case 'rate-limited': // US-E2-06/AC6
      return { ok: false, error: 'RATE_LIMITED', retryAfterSec: 60, providerCalls: 2 };
    case 'unavailable': // US-E2-06/AC2
      return { ok: false, error: 'UNAVAILABLE', providerCalls: 2 };
  }
}

export function wrapExtractor(base: MenuExtractor): MenuExtractor {
  return {
    extract(input, signal) {
      if (sim.aiMode === 'off' || sim.aiMode === 'url-unreachable' || sim.sampleMenu === null) return base.extract(input, signal);
      return Promise.resolve(simulatedResult(sim.aiMode, sim.sampleMenu()));
    },
  };
}

export function wrapPdfSource(base: PdfSource): PdfSource {
  return {
    fromUrl: (url, signal) => (sim.aiMode === 'url-unreachable' ? Promise.resolve({ ok: false, error: 'NETWORK' }) : base.fromUrl(url, signal)),
    fromFile: (file) => base.fromFile(file),
  };
}
