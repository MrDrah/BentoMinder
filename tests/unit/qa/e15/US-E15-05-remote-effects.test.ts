// QA E15: what the other device sees (US-E15-05/AC7 AC8, US-E15-06/AC11, US-E15-11/AC8, contract 14.2 device-only data) through the real controllers,
// HTTP adapter and Function. Device-only data never reaches the cloud and never changes the other parent's own language, theme or reminder log.
import { afterEach, describe, expect, it } from 'vitest';
import type { BentoMinderStore } from '../../../../src/domain/schema/store.ts';
import { pollDelayMs, retryNowOffered, nextDelay } from '../../../../src/domain/sync/schedule.ts';
import { DEVICE_A, DEVICE_B, UID1, UID2, storeWithData } from '../../domain/sync/helpers.ts';
import { makeCtl, settle, type Ctl } from './ctl.ts';
import { makeRig } from './qa-rig.ts';

const open: Ctl[] = [];
afterEach(() => {
  for (const c of open.splice(0)) c.stop();
});
const track = (c: Ctl): Ctl => {
  open.push(c);
  return c;
};

async function two() {
  const rig = makeRig();
  const aStore: BentoMinderStore = { ...storeWithData(DEVICE_A, UID1), settings: { ...storeWithData(DEVICE_A, UID1).settings, language: 'en', theme: 'dark' } };
  const a = track(makeCtl({ rig, uid: UID1, deviceId: DEVICE_A, store: aStore }));
  await settle();
  await a.controller.family.create();
  await settle(150);
  const code = (await a.controller.family.createInvite()).code;
  const b = track(makeCtl({ rig, uid: UID2, deviceId: DEVICE_B, store: null }));
  await settle();
  await b.controller.family.join(code);
  await settle(250);
  return { rig, a, b };
}

describe('US-E15-05/AC7 AC8 changes appear on the other device; allergies re-assess on read', () => {
  it('A adds an allergy, plans a day and changes the weekly reminder: B shows all three after its next poll; nothing stores an old assessment', async () => {
    const { a, b } = await two();
    const s = a.stored()!;
    const day = '2026-11-18';
    const edited: BentoMinderStore = {
      ...s,
      profile: { ...s.profile!, knownAllergenIds: [...s.profile!.knownAllergenIds, 'alg-egg'], updatedAt: '2026-11-10T12:00:00+09:00' },
      settings: { ...s.settings, reminders: { ...s.settings.reminders, weekly: { ...s.settings.reminders.weekly, time: '16:15' } }, updatedAt: '2026-11-10T12:00:00+09:00' },
      decisions: { ...s.decisions, [day]: { ...Object.values(s.decisions)[0]!, date: day, updatedAt: '2026-11-10T12:00:00+09:00' } },
    };
    await a.repository.save(edited, { force: true });
    await a.controller.localChanged(edited);
    a.clock.now += 15_000;
    a.controller.syncNow();
    await settle(200);
    b.clock.now = a.clock.now + 61_000;
    b.controller.syncNow();
    await settle(250);
    const got = b.stored()!;
    expect(got.profile!.knownAllergenIds).toContain('alg-egg');
    expect(got.settings.reminders.weekly.time).toBe('16:15');
    expect(got.decisions[day]).toBeDefined();
    // BR-06/BR-10: the stored data holds no assessment result that could keep an old "safe"
    expect(JSON.stringify(got)).not.toMatch(/"assessment"|"safeResult"|"verdict"/);
    // the poll interval of the app is 60 s while visible and online, none while hidden or offline
    expect(pollDelayMs({ visible: true, online: true })).toBe(60_000);
    expect(pollDelayMs({ visible: false, online: true })).toBeNull();
    expect(pollDelayMs({ visible: true, online: false })).toBeNull();
  });

  it('US-E15-06/AC11 US-E15-11/AC8 contract 14.2: language, theme, reminder log, AI consent and the device id are never in the cloud, and one parent\'s language and theme do not change the other\'s', async () => {
    const { rig, a, b } = await two();
    const cloud = JSON.stringify([...rig.db.docs.entries()]);
    expect(cloud).not.toContain('weekly:2026-11-02');
    // the device id exists in the cloud only as the deviceId metadata field of a record (tie-break), never inside a payload (checked below)
    for (const p of rig.db.paths().filter((x) => x.includes('/records/'))) {
      const payload = String(rig.db.get(p)!['payloadJson'] ?? '');
      expect(payload).not.toMatch(/"language"|"theme"|"reminderLog"|"aiNoticeVersion"|"nextMonthCardHiddenOn"|"deviceId"/);
      expect(payload).not.toContain(DEVICE_A);
    }
    expect(b.stored()!.settings.language).not.toBe('en');
    expect(b.stored()!.settings.theme).not.toBe('dark');
    expect(a.stored()!.settings.language).toBe('en');
    expect(a.stored()!.settings.theme).toBe('dark');
    expect(JSON.stringify(b.stored()!.reminderLog)).not.toContain('weekly:2026-11-02');
  });
});

describe('US-E15-06/AC5 back-off and the manual retry', () => {
  it('back-off starts at 5 s, doubles, caps at 5 minutes with at most 20 % jitter; 「今すぐ再試行」 is offered after 5 minutes of failure, not before', () => {
    expect(nextDelay(0, () => 0)).toBe(5_000);
    expect(nextDelay(1, () => 0)).toBe(10_000);
    expect(nextDelay(2, () => 0)).toBe(20_000);
    expect(nextDelay(10, () => 0)).toBe(300_000);
    expect(nextDelay(10, () => 1)).toBe(300_000);
    expect(nextDelay(0, () => 1)).toBe(6_000);
    expect(retryNowOffered(0, 299_999)).toBe(false);
    expect(retryNowOffered(0, 300_000)).toBe(true);
    expect(retryNowOffered(null, 1e12)).toBe(false);
  });
});
