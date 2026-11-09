// A fresh store for first launch (contract §3.1, §3.9 defaults; BR-16, BR-23).
import { BR16 } from '../rules.ts';
import { CURRENT_SCHEMA_VERSION, type BentoMinderStore } from '../schema/store.ts';
import type { Settings } from '../schema/settings.ts';
import { toJstTimestamp, type Instant } from '../time/jst.ts';

export const LOCAL_OWNER_ID = 'local';

export function defaultSettings(now: Instant, ownerId: string = LOCAL_OWNER_ID): Settings {
  const ts = toJstTimestamp(now);
  return {
    language: 'ja',
    timezone: 'Asia/Tokyo',
    reminders: {
      weekly: { enabled: true, weekday: BR16.weeklyWeekday, time: BR16.weeklyTime },
      dayBefore: { enabled: true, time: BR16.dayBeforeTime },
    },
    nextMonthPromptFromDay: 20,
    weekStartsOn: 'monday',
    theme: 'auto',
    ownerId,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** `deviceId` is a random UUID v4 made by the caller (randomness stays outside the domain). */
export function createEmptyStore(input: { deviceId: string; now: Instant; ownerId?: string }): BentoMinderStore {
  const ts = toJstTimestamp(input.now);
  return {
    deviceId: input.deviceId,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: ts,
    updatedAt: ts,
    settings: defaultSettings(input.now, input.ownerId),
    profile: null,
    menus: {},
    overrides: {},
    decisions: {},
    reminderLog: [],
    consent: null,
    nextMonthCardHiddenOn: null,
    aiUsage: {},
  };
}
