// ADR 016 section 3 (schedule.ts), contract 14.10: write coalescing, the hourly write guard, back-off and polling.
// All pure: the clock and the random source are arguments. No timers here (the engine owns them, slice C).
import { SYNC_LIMITS, HOUR_MS } from './config.ts';
import type { RecordKey } from './types.ts';

export interface ScheduleState {
  /** When each record was last sent (ms). */
  lastSentAt: Record<RecordKey, number>;
  /** Times (ms) of the writes of the last hour: the runaway guard's sliding window. */
  writeLog: number[];
}

export const emptySchedule = (): ScheduleState => ({ lastSentAt: {}, writeLog: [] });

export interface DueSelection {
  /** Record keys to send now, in the order given. */
  send: RecordKey[];
  /** Waiting for the coalesce window (the latest content is sent when it ends). */
  coalesced: RecordKey[];
  /** The guard stopped the rest: status paused-limit, the queue keeps filling (US-E15-10/AC3). */
  limitHit: boolean;
  /** Earliest time (ms) something deferred becomes sendable; null when nothing is deferred. */
  nextAt: number | null;
}

const recent = (log: readonly number[], nowMs: number): number[] => log.filter((t) => t > nowMs - HOUR_MS);

/**
 * Of the pending record keys, which may be sent now. A record is sent at most once per `writeCoalesceSeconds`
 * (US-E15-10/AC2: 30 edits in 10 seconds are one write of the latest content); a device sends at most
 * `maxWritesPerDevicePerHour` record writes in any 60 minutes (AC3).
 */
export function selectDue(state: ScheduleState, pendingKeys: readonly RecordKey[], nowMs: number): DueSelection {
  const window = recent(state.writeLog, nowMs);
  let budget = SYNC_LIMITS.maxWritesPerDevicePerHour - window.length;
  const send: RecordKey[] = [];
  const coalesced: RecordKey[] = [];
  let limitHit = false;
  let nextAt: number | null = null;
  const note = (t: number) => {
    nextAt = nextAt === null ? t : Math.min(nextAt, t);
  };
  for (const key of pendingKeys) {
    const last = state.lastSentAt[key];
    const readyAt = last === undefined ? nowMs : last + SYNC_LIMITS.writeCoalesceSeconds * 1000;
    if (readyAt > nowMs) {
      coalesced.push(key);
      note(readyAt);
      continue;
    }
    if (budget <= 0) {
      limitHit = true;
      // The window slides: the oldest write leaves it one hour after it was made.
      const oldest = window[0];
      if (oldest !== undefined) note(oldest + HOUR_MS);
      continue;
    }
    budget -= 1;
    send.push(key);
  }
  return { send, coalesced, limitHit, nextAt };
}

/** Records that the given keys were sent at `nowMs` (one write each) and forgets what left the window. */
export function recordWrites(state: ScheduleState, keys: readonly RecordKey[], nowMs: number): ScheduleState {
  const lastSentAt: Record<RecordKey, number> = {};
  // Entries older than the window cannot matter any more (the window is far longer than the coalesce time).
  for (const [k, t] of Object.entries(state.lastSentAt)) if (t > nowMs - HOUR_MS) lastSentAt[k] = t;
  const writeLog = recent(state.writeLog, nowMs);
  for (const k of keys) {
    lastSentAt[k] = nowMs;
    writeLog.push(nowMs);
  }
  return { lastSentAt, writeLog };
}

/**
 * Back-off before retry number `attempt` (0 = first retry): 5 s doubling to at most 5 minutes, plus up to 20 %
 * jitter (never above the 5 minute cap). `random` returns a number in [0, 1).
 */
export function nextDelay(attempt: number, random: () => number): number {
  const base = Math.min(SYNC_LIMITS.backoffStartMs * 2 ** Math.max(0, attempt), SYNC_LIMITS.backoffMaxMs);
  return Math.min(Math.round(base * (1 + SYNC_LIMITS.backoffJitter * random())), SYNC_LIMITS.backoffMaxMs);
}

/** US-E15-06/AC5: 「今すぐ再試行」 is offered after 5 minutes of failure. */
export function retryNowOffered(firstFailureAtMs: number | null, nowMs: number): boolean {
  return firstFailureAtMs !== null && nowMs - firstFailureAtMs >= SYNC_LIMITS.retryNowAfterMs;
}

/** Poll interval: 60 s while the app is visible and online, none while hidden (an immediate pull on focus is the caller's). */
export function pollDelayMs(facts: { visible: boolean; online: boolean }): number | null {
  return facts.visible && facts.online ? SYNC_LIMITS.liveUpdateSeconds * 1000 : null;
}
