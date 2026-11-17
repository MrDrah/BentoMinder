// US-E12-01 (ADR 005 §3) with a fake Capacitor plugin layer: Preferences storage, share, file export, platform choice.
// The behaviour they carry: US-E10-02 (saved data is never lost), US-E9-01/AC2 (share falls back), US-E10-03/AC4 (export).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNativeFileExport } from '../../../src/adapters/native/file-export.ts';
import type { NativeAdapters } from '../../../src/adapters/native/index.ts';
import { createNativeShare } from '../../../src/adapters/native/share.ts';
import { createNativeStorage } from '../../../src/adapters/native/storage.ts';
import { isNativePlatform } from '../../../src/adapters/platform.ts';
import { selectAdapters } from '../../../src/adapters/select.ts';
import { withoutGoogle } from '../../../src/adapters/select-auth.ts';
import { fakeFilesystem, fakePreferences, fakeShare } from './native-fakes.ts';

const KEY = 'bentominder.u1.state' as const;
const PREV = 'bentominder.u1.state.prev' as const;

beforeEach(() => localStorage.clear());

describe('US-E12-01 Preferences storage', () => {
  it('US-E10-02 write then read round-trips through Preferences, never through localStorage', async () => {
    const prefs = fakePreferences();
    const s = createNativeStorage(prefs);
    await s.write(KEY, '{"a":1}');
    expect(await s.read(KEY)).toBe('{"a":1}');
    expect(prefs.data.get(KEY)).toBe('{"a":1}');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('US-E10-02 first read adopts the WebView localStorage copy into Preferences and then removes the old one (no data loss)', async () => {
    localStorage.setItem(KEY, 'old-state');
    localStorage.setItem(PREV, 'old-prev');
    const prefs = fakePreferences();
    const s = createNativeStorage(prefs);
    expect(await s.read(KEY)).toBe('old-state');
    expect(prefs.data.get(KEY)).toBe('old-state');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(await s.read(KEY)).toBe('old-state'); // now served from Preferences
    expect(await s.read(PREV)).toBe('old-prev');
  });

  it('US-E10-02 Preferences wins over a stale localStorage value', async () => {
    localStorage.setItem(KEY, 'stale');
    const prefs = fakePreferences({ [KEY]: 'current' });
    expect(await createNativeStorage(prefs).read(KEY)).toBe('current');
    expect(localStorage.getItem(KEY)).toBe('stale'); // untouched until a read finds Preferences empty
  });

  it('US-E10-02 if the copy fails the old value is still returned and kept for the next try', async () => {
    localStorage.setItem(KEY, 'old-state');
    const prefs = fakePreferences();
    prefs.failSet = true;
    const s = createNativeStorage(prefs);
    expect(await s.read(KEY)).toBe('old-state');
    expect(localStorage.getItem(KEY)).toBe('old-state');
    prefs.failSet = false;
    expect(await s.read(KEY)).toBe('old-state');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('US-E10-02 a missing key reads null; a failing write rejects so the app shows the save notice', async () => {
    const prefs = fakePreferences();
    const s = createNativeStorage(prefs);
    expect(await s.read(KEY)).toBeNull();
    prefs.failSet = true;
    await expect(s.write(KEY, 'x')).rejects.toThrow('disk full');
  });

  it('US-E10-02 remove clears both places so a removed key cannot come back from localStorage', async () => {
    localStorage.setItem(KEY, 'old');
    const prefs = fakePreferences({ [KEY]: 'new' });
    const s = createNativeStorage(prefs);
    await s.remove(KEY);
    expect(await s.read(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('US-E10-02 account keying is the caller\'s: two accounts stay apart', async () => {
    const s = createNativeStorage(fakePreferences());
    await s.write('bentominder.a.state', 'A');
    await s.write('bentominder.b.state', 'B');
    expect(await s.read('bentominder.a.state')).toBe('A');
    expect(await s.read('bentominder.b.state')).toBe('B');
  });

  it('US-E10-02 without any localStorage the adapter still works', async () => {
    const s = createNativeStorage(fakePreferences(), null);
    expect(await s.read(KEY)).toBeNull();
    await s.write(KEY, 'v');
    expect(await s.read(KEY)).toBe('v');
  });
});

describe('US-E12-01 share', () => {
  const clipboard = (ok = true) => ({ clipboard: { writeText: vi.fn(() => (ok ? Promise.resolve() : Promise.reject(new Error('blocked')))) } }) as unknown as Pick<Navigator, 'clipboard'>;

  it('US-E9-01/AC2 the OS share sheet first', async () => {
    const plugin = fakeShare();
    const s = createNativeShare(plugin, clipboard());
    expect(s.canShare()).toBe(true);
    expect(await s.share('plan')).toBe('shared');
    expect(plugin.shared).toEqual([{ text: 'plan' }]);
  });

  it('US-E9-01/AC2 a rejected or dismissed sheet falls back to the clipboard; with no clipboard it is cancelled', async () => {
    const plugin = fakeShare();
    plugin.fail = true;
    const nav = clipboard();
    expect(await createNativeShare(plugin, nav).share('plan')).toBe('copied');
    expect(nav.clipboard.writeText).toHaveBeenCalledWith('plan');
    expect(await createNativeShare(plugin, clipboard(false)).share('plan')).toBe('cancelled');
    expect(await createNativeShare(plugin, undefined).share('plan')).toBe('cancelled');
  });

  it('US-E9-01/AC2 a platform with no share support copies instead', async () => {
    expect(await createNativeShare(fakeShare(false), clipboard()).share('plan')).toBe('copied');
    expect(await createNativeShare(fakeShare(false), clipboard()).copy('x')).toBe(true);
  });
});

describe('US-E12-01 file export', () => {
  it('US-E10-03/AC4 the export is written to the cache and handed to the share sheet as a file (a WebView cannot download)', async () => {
    const filesystem = fakeFilesystem();
    const share = fakeShare();
    await createNativeFileExport({ filesystem, share }).save('bentominder-backup.json', '{"x":1}', 'application/json');
    expect(filesystem.files.get('bentominder-backup.json')).toBe('{"x":1}');
    expect(share.shared).toEqual([{ title: 'bentominder-backup.json', dialogTitle: 'bentominder-backup.json', files: ['file:///cache/bentominder-backup.json'] }]);
  });
});

describe('US-E12-01 platform selection', () => {
  const nativeStub = { storage: {}, notifications: { marker: 'native-n' }, share: { marker: 'native-share' }, fileExport: { marker: 'native-fe' } } as unknown as NativeAdapters;

  it('US-E12-01 isNativePlatform is false in a browser and true only when the Capacitor shell says so', () => {
    expect(isNativePlatform({})).toBe(false);
    expect(isNativePlatform(undefined)).toBe(false);
    expect(isNativePlatform({ Capacitor: {} })).toBe(false);
    expect(isNativePlatform({ Capacitor: { isNativePlatform: () => false } })).toBe(false);
    expect(isNativePlatform({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
    expect(isNativePlatform({ Capacitor: { isNativePlatform: () => { throw new Error('x'); } } })).toBe(false);
    expect(isNativePlatform()).toBe(false); // jsdom
  });

  it('US-E12-01 on the web the native loader is never called and the web adapters are returned', async () => {
    const loadNative = vi.fn();
    const a = await selectAdapters('u1', undefined, { isNative: () => false, loadNative });
    expect(loadNative).not.toHaveBeenCalled();
    expect(a.notifications.capabilities()).toEqual({ background: false, exactTime: false });
    expect(a.notifications.horizonDays).toBeUndefined();
  });

  it('US-E12-01 on native the native storage, notifications, share and export replace the web ones, the rest is shared', async () => {
    const loadNative = vi.fn(() => Promise.resolve(nativeStub));
    const web = await selectAdapters('u1', undefined, { isNative: () => false, loadNative });
    const a = await selectAdapters('u1', undefined, { isNative: () => true, loadNative });
    expect(loadNative).toHaveBeenCalledTimes(1);
    expect(a.storage).toBe(nativeStub.storage);
    expect(a.notifications).toBe(nativeStub.notifications);
    expect(a.share).toBe(nativeStub.share);
    expect(a.fileExport).toBe(nativeStub.fileExport);
    expect(Object.keys(a).sort()).toEqual(Object.keys(web).sort());
  });
});

describe('US-E12-01 Google sign-in seam on native', () => {
  it('US-E12-01 signInWithGoogle answers a plain "other" result; every other method is untouched', async () => {
    const base = { signInWithEmail: vi.fn(), signInWithGoogle: vi.fn() } as never;
    const wrapped = withoutGoogle(base);
    expect(await wrapped.signInWithGoogle()).toEqual({ ok: false, error: 'other' });
    expect(wrapped.signInWithEmail).toBe((base as { signInWithEmail: unknown }).signInWithEmail);
  });
});
