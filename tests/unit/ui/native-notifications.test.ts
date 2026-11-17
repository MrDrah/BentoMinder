// US-E12-01 (Android feasibility, ADR 005 §3) with a fake Capacitor plugin layer: the native notification adapter.
// Reminder behaviour it must keep: US-E7-01 / US-E7-02 (reminders follow decisions), US-E7-05 (expired, missed).
import { describe, expect, it, vi } from 'vitest';
import { createNativeNotifications, idsFor, tapRoute } from '../../../src/adapters/native/notifications.ts';
import { renderNotificationText } from '../../../src/adapters/native/notification-text.ts';
import { numericIdForKey } from '../../../src/domain/reminders/plan.ts';
import type { Instant } from '../../../src/domain/time/jst.ts';
import { createTranslator } from '../../../src/i18n/index.ts';
import { fakeApp, fakeLocalNotifications, job } from './native-fakes.ts';

const NOW = Date.parse('2026-11-03T09:00:00+09:00');

function setup(over: Partial<{ permission: 'granted' | 'prompt' | 'denied' }> = {}) {
  const ln = fakeLocalNotifications();
  ln.permission = over.permission ?? 'granted';
  const app = fakeApp();
  let now = NOW;
  const navigate = vi.fn();
  const warn = vi.fn();
  const n = createNativeNotifications({ plugins: { localNotifications: ln, app }, now: () => now, navigate, warn });
  return { ln, app, n, navigate, warn, setNow: (t: number) => (now = t) };
}

describe('US-E12-01 scheduling', () => {
  it('US-E12-01 schedules a one-shot at the job instant, allowWhileIdle, on the reminders channel created first', async () => {
    const { ln, n } = setup();
    const j = job('2026-11-04', 17);
    await n.apply({ remove: [], upsert: [j] });
    expect(ln.calls.indexOf('createChannel')).toBeLessThan(ln.calls.indexOf('schedule'));
    const sent = ln.pending.get(j.numericId);
    expect(sent?.schedule).toEqual({ at: new Date(j.dueAt), allowWhileIdle: true });
    expect(sent?.channelId).toBe('reminders');
    expect(sent?.extra).toMatchObject({ route: j.target.route, key: j.key, hash: j.contentHash, expiresAt: j.expiresAt });
    expect(sent?.title).toBe('BentoMinder');
    expect(sent?.body).toContain('明日は手作りお弁当の日');
  });

  it('US-E7-02 the same plan applied twice schedules once (no duplicates after restarts)', async () => {
    const { ln, n } = setup();
    const j = job('2026-11-04', 17);
    await n.apply({ remove: [], upsert: [j] });
    await n.apply({ remove: [], upsert: [j] });
    expect(ln.calls.filter((c) => c === 'schedule')).toHaveLength(1);
    // a fresh adapter (app restarted) over the same device state does not duplicate either
    const again = createNativeNotifications({ plugins: { localNotifications: ln, app: fakeApp() }, now: () => NOW, warn: vi.fn() });
    await again.apply({ remove: [], upsert: [j] });
    expect(ln.pending.size).toBe(1);
    expect(ln.calls.filter((c) => c === 'schedule')).toHaveLength(1);
  });

  it('US-E7-02 a changed decision (new content hash) replaces the notification; a removed key cancels it', async () => {
    const { ln, n } = setup();
    const j = job('2026-11-04', 17);
    await n.apply({ remove: [], upsert: [j] });
    await n.apply({ remove: [], upsert: [{ ...j, contentHash: 'changed', content: { ...j.content, params: { recipeNameJa: 'さくら弁当' } } }] });
    expect(ln.pending.size).toBe(1);
    expect(ln.pending.get(j.numericId)?.largeBody).toContain('さくら弁当');
    await n.apply({ remove: [j.key], upsert: [] });
    expect(ln.pending.size).toBe(0);
  });

  it('US-E12-01 stale device notifications of ours are cancelled even after a restart lost the memory', async () => {
    const { ln, n } = setup();
    await n.apply({ remove: [], upsert: [job('2026-11-04', 17), job('2026-11-05', 17)] });
    const again = createNativeNotifications({ plugins: { localNotifications: ln, app: fakeApp() }, now: () => NOW, warn: vi.fn() });
    await again.apply({ remove: [], upsert: [job('2026-11-05', 17)] }); // 11-04 is no longer wanted
    expect([...ln.pending.values()].map((p) => (p.extra as { key: string }).key)).toEqual(['day-before:2026-11-05']);
  });

  it('US-E7-05 expired and already-due jobs are never scheduled', async () => {
    const { ln, n } = setup();
    await n.apply({ remove: [], upsert: [job('2026-11-03', 8), job('2026-11-02', 17, { expiresAt: (NOW - 1) as Instant })] });
    expect(ln.pending.size).toBe(0);
    expect(ln.calls).not.toContain('schedule');
  });

  it('US-E12-01 exact alarms only when the setting is already granted; the plugin warning is exposed, no settings screen is forced', async () => {
    const a = setup();
    await a.n.apply({ remove: [], upsert: [job('2026-11-04', 17)] });
    expect([...a.ln.pending.values()][0]?.isExactNotification).toBe(false);
    expect(a.n.capabilities()).toEqual({ background: true, exactTime: false });
    const b = setup();
    b.ln.exact = 'granted';
    await b.n.apply({ remove: [], upsert: [job('2026-11-04', 17)] });
    expect([...b.ln.pending.values()][0]?.isExactNotification).toBe(true);
    expect(b.n.capabilities().exactTime).toBe(true);
    const c = setup();
    c.ln.warning = { code: 'OS-PLUG-LNOT-0001', message: 'inexact' };
    await c.n.apply({ remove: [], upsert: [job('2026-11-04', 17)] });
    expect(c.n.status().inexactFallback).toBe(true);
  });

  it('US-E12-01 a failing plugin never rejects apply and the in-app jobs are still held', async () => {
    const { ln, n, warn } = setup();
    ln.failSchedule = true;
    await expect(n.apply({ remove: [], upsert: [job('2026-11-04', 17)] })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Reminder scheduling failed'));
    expect(n.jobs()).toHaveLength(1);
  });

  it('US-E12-01 cancelAll cancels ours on the device and empties the in-app jobs', async () => {
    const { ln, n } = setup();
    await n.apply({ remove: [], upsert: [job('2026-11-04', 17), job('2026-11-05', 17)] });
    await n.cancelAll();
    expect(ln.pending.size).toBe(0);
    expect(n.jobs()).toEqual([]);
  });
});

describe('US-E12-01 permission', () => {
  it('US-E12-01 nothing is requested by the adapter on its own: not at construction, apply or resume', async () => {
    const { ln, n, app } = setup({ permission: 'prompt' });
    await n.apply({ remove: [], upsert: [job('2026-11-04', 17)] });
    app.setActive(true);
    await n.idle();
    expect(ln.calls).not.toContain('requestPermissions');
    expect(await n.permission()).toBe('prompt');
  });

  it('US-E12-01 denied: in-app reminders keep working, nothing is scheduled with the system, capabilities say so', async () => {
    const { ln, n } = setup({ permission: 'denied' });
    await n.apply({ remove: [], upsert: [job('2026-11-04', 17)] });
    expect(n.jobs()).toHaveLength(1); // the banner list still gets it
    expect(ln.calls).not.toContain('schedule');
    expect(await n.permission()).toBe('denied');
    expect(n.capabilities()).toEqual({ background: false, exactTime: false });
  });

  it('US-E12-01 requestPermission asks once on demand, then schedules what was planned while it was off', async () => {
    const { ln, n } = setup({ permission: 'prompt' });
    await n.apply({ remove: [], upsert: [job('2026-11-04', 17)] });
    expect(ln.pending.size).toBe(0);
    expect(await n.requestPermission()).toBe('granted');
    expect(ln.calls.filter((c) => c === 'requestPermissions')).toHaveLength(1);
    expect(ln.pending.size).toBe(1);
  });

  it('US-E12-01 a refusal answers denied and schedules nothing; prompt-with-rationale counts as prompt', async () => {
    const { ln, n } = setup({ permission: 'prompt' });
    ln.onRequest = 'denied';
    expect(await n.requestPermission()).toBe('denied');
    ln.permission = 'prompt-with-rationale';
    expect(await n.permission()).toBe('prompt');
  });
});

describe('US-E12-01 resume', () => {
  it('US-E12-01 on resume the permission and exact setting are re-read, device state is reconciled and the in-app engine is told', async () => {
    const { ln, n, app } = setup();
    const resumed = vi.fn();
    n.onResume(resumed);
    await n.apply({ remove: [], upsert: [job('2026-11-04', 17)] });
    ln.pending.clear(); // e.g. exact-alarm revocation restarted the app and deleted the notifications
    ln.exact = 'granted';
    app.setActive(true);
    await n.idle();
    await vi.waitFor(() => expect(resumed).toHaveBeenCalledTimes(1));
    expect(ln.pending.size).toBe(1);
    expect(n.status().exactAllowed).toBe(true);
    app.setActive(false);
    await n.idle();
    expect(resumed).toHaveBeenCalledTimes(1); // going to the background does nothing
  });

  it('US-E12-01 the permission being switched off in the system settings is noticed on resume', async () => {
    const { ln, n, app } = setup();
    await n.apply({ remove: [], upsert: [job('2026-11-04', 17)] });
    ln.permission = 'denied';
    app.setActive(true);
    await n.idle();
    expect(n.status().permission).toBe('denied');
    expect(n.capabilities().background).toBe(false);
  });

  it('US-E12-01 the unsubscribe function stops the resume callback', async () => {
    const { n, app } = setup();
    const resumed = vi.fn();
    const off = n.onResume(resumed);
    await n.apply({ remove: [], upsert: [] });
    off();
    app.setActive(true);
    await n.idle();
    expect(resumed).not.toHaveBeenCalled();
  });
});

describe('US-E12-01 tap routing', () => {
  it('US-E12-01 a tap goes to the registered handler with the stored route', async () => {
    const { ln, n } = setup();
    const j = job('2026-11-04', 17);
    await n.apply({ remove: [], upsert: [j] });
    const handler = vi.fn();
    n.onTap(handler);
    ln.tap({ notification: { id: j.numericId, extra: ln.pending.get(j.numericId)?.extra } });
    expect(handler).toHaveBeenCalledWith(j.target.route);
  });

  it('US-E12-01 without a registered handler (cold start) the tap goes to the hash router', async () => {
    const { ln, n, navigate } = setup();
    const j = job('2026-11-04', 17);
    await n.apply({ remove: [], upsert: [j] });
    ln.tap({ notification: { id: j.numericId, extra: ln.pending.get(j.numericId)?.extra } });
    expect(navigate).toHaveBeenCalledWith(j.target.route);
  });

  it('US-E7-05 a tap on a notification whose reminder has expired opens the day, not the outdated recipe', async () => {
    const { ln, n, setNow, navigate } = setup();
    const j = job('2026-11-04', 17);
    await n.apply({ remove: [], upsert: [j] });
    setNow(j.expiresAt + 1);
    ln.tap({ notification: { id: j.numericId, extra: ln.pending.get(j.numericId)?.extra } });
    expect(navigate).toHaveBeenCalledWith('#/day/2026-11-04');
  });

  it('US-E12-01 a tap with foreign or broken extra data is ignored', async () => {
    const { ln, n, navigate } = setup();
    await n.apply({ remove: [], upsert: [] });
    ln.tap({ notification: { id: 1, extra: { nope: true } } });
    ln.tap({ notification: { id: 1 } });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('US-E7-05 tapRoute keeps the weekly route after expiry and the route before it', () => {
    const extra = { route: '#/calendar/2026-11', key: 'weekly:2026-11-02', hash: 'x', expiresAt: 100 };
    expect(tapRoute(extra, 200)).toBe('#/calendar/2026-11');
    expect(tapRoute({ ...extra, key: 'day-before:2026-11-04', route: '#/recipe/a' }, 50)).toBe('#/recipe/a');
  });
});

describe('US-E12-01 notification ids', () => {
  it('US-E12-01 the id is a deterministic positive 31-bit integer of the key', () => {
    const none = new Set<number>();
    const id = numericIdForKey('day-before:2026-11-04', none);
    expect(id).toBe(numericIdForKey('day-before:2026-11-04', none));
    expect(Number.isInteger(id) && id > 0 && id < 2 ** 31).toBe(true);
  });

  it('US-E12-01 a taken id is probed away, and many keys never collide', () => {
    const first = numericIdForKey('weekly:2026-11-02', new Set());
    expect(numericIdForKey('weekly:2026-11-02', new Set([first]))).not.toBe(first);
    const used = new Set<number>();
    for (let i = 0; i < 5000; i += 1) {
      const id = numericIdForKey(`day-before:${i}`, used);
      expect(used.has(id)).toBe(false);
      used.add(id);
    }
  });

  it('US-E12-01 idsFor repairs an invalid or duplicated planner id and keeps a valid one', () => {
    const a = job('2026-11-04', 17, { numericId: 42 });
    const b = job('2026-11-05', 17, { numericId: 42 }); // duplicate
    const c = job('2026-11-06', 17, { numericId: 2 ** 31 + 5 }); // not 31-bit
    const d = job('2026-11-07', 17, { numericId: 0 });
    const ids = idsFor([a, b, c, d]);
    expect(ids.get(a.key)).toBe(42);
    const all = [...ids.values()];
    expect(new Set(all).size).toBe(4);
    for (const id of all) expect(id > 0 && id < 2 ** 31 && Number.isInteger(id)).toBe(true);
  });
});

describe('US-E12-01 notification text', () => {
  it('US-E7-01 the weekly summary is worded from the same catalog strings, in the chosen language', () => {
    const weekly = job('2026-11-01', 14, {
      key: 'weekly:2026-11-02',
      type: 'weekly',
      content: { titleKey: 'reminders.weekly.title', bodyKey: 'reminders.weekly.summary', params: { from: '2026-11-02', to: '2026-11-08', bento: ['2026-11-04|ひまわり弁当|Sunflower bento'], undecided: ['2026-11-06'], low: [] } },
    });
    const ja = renderNotificationText(weekly, createTranslator('ja'), 'ja');
    expect(ja.title).toContain('週のまとめ');
    expect(ja.body).toContain('ひまわり弁当');
    expect(ja.body.split('\n')).toHaveLength(2);
    const en = renderNotificationText(weekly, createTranslator('en'), 'en');
    expect(en.body).toContain('Sunflower bento');
    const empty = renderNotificationText({ ...weekly, content: { ...weekly.content, bodyKey: 'reminders.weekly.noMenu' } }, createTranslator('ja'), 'ja');
    expect(empty.body).toBe('来週の献立がまだありません');
  });
});
