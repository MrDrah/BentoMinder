// System clock adapter: the only place that reads the device clock (ADR 001).
import type { Clock } from '../../domain/ports.ts';
import type { Instant } from '../../domain/time/jst.ts';

export function createSystemClock(): Clock {
  return { now: () => Date.now() as Instant };
}

/** Random UUID v4 for `BentoMinderStore.deviceId` (never sent anywhere). */
export function newDeviceId(): string {
  return crypto.randomUUID();
}
