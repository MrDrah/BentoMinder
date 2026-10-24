// M1 provider transport: replays QA's recorded stand-ins (tests/fixtures/menus/*/recorded/)
// instead of calling Gemini (the real transport arrives in M5, ADR 002 §6). Selection:
//   1. a scenario (dev/test only, header `x-bm-mock-scenario`): a comma list, one entry per
//      provider call, each `<fixture-id>/<recorded-name>` or a synthetic failure `status:<code>`
//      / `timeout`; the last entry repeats. E.g. `fixture-menu-2026-11/hand-malformed,fixture-menu-2026-11/hand-1`.
//   2. otherwise the PDF's sha256: the committed fixture PDFs are hashed at start-up and map to
//      their `recorded/hand-1.json`.
//   3. an unknown PDF without a scenario → no transport (NOT_CONFIGURED, US-E2-06/AC4).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex, type ProviderReply, type ProviderTransport } from './extract.ts';

interface Recorded {
  response: { httpStatus: number; modelOutput?: unknown; rawText?: string; retryAfterSeconds?: number | null };
}

export const SCENARIO_HEADER = 'x-bm-mock-scenario';
const SCENARIO_ENTRY = /^(?:[a-z0-9-]+\/[a-z0-9-]+|status:\d{3}|timeout)$/;

export function replyOf(recorded: Recorded): ProviderReply {
  const r = recorded.response;
  if (r.httpStatus !== 200) return { kind: 'http', status: r.httpStatus, retryAfterSec: r.retryAfterSeconds ?? null };
  return { kind: 'ok', text: r.rawText ?? JSON.stringify(r.modelOutput) };
}

export interface FixtureTransports {
  /** The transport for one request, or null when nothing is configured for this PDF. */
  forRequest(sha256: string, scenario: string | undefined): ProviderTransport | null;
  /** sha256 → fixture id, for logs and tests. */
  readonly known: ReadonlyMap<string, string>;
}

export function createFixtureTransports(menusDir: string): FixtureTransports {
  const known = new Map<string, string>();
  if (existsSync(menusDir)) {
    for (const id of readdirSync(menusDir)) {
      const pdf = join(menusDir, id, 'menu.pdf');
      if (existsSync(pdf) && existsSync(join(menusDir, id, 'recorded', 'hand-1.json'))) known.set(sha256Hex(readFileSync(pdf)), id);
    }
  }
  const load = (entry: string): ProviderReply => {
    if (entry === 'timeout') return { kind: 'timeout' };
    const status = /^status:(\d{3})$/.exec(entry);
    if (status !== null) return { kind: 'http', status: Number(status[1]), retryAfterSec: null };
    const [fixture = '', name = ''] = entry.split('/');
    return replyOf(JSON.parse(readFileSync(join(menusDir, fixture, 'recorded', `${name}.json`), 'utf8')) as Recorded);
  };
  const sequence = (entries: string[]): ProviderTransport => {
    let n = 0;
    return {
      call() {
        const entry = entries[Math.min(n, entries.length - 1)] as string;
        n += 1;
        return Promise.resolve(load(entry));
      },
    };
  };
  return {
    known,
    forRequest(sha256, scenario) {
      if (scenario !== undefined && scenario !== '') {
        const entries = scenario.split(',').map((s) => s.trim());
        if (entries.every((e) => SCENARIO_ENTRY.test(e) && !e.includes('..'))) return sequence(entries);
        return null;
      }
      const id = known.get(sha256);
      return id === undefined ? null : sequence([`${id}/hand-1`]);
    },
  };
}
