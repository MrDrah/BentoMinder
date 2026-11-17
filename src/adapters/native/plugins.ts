// The slice of each Capacitor plugin the native adapters use, as plain interfaces. The adapters take these as an
// argument so unit tests plug in fakes; `loadNativePlugins` is the only place that imports the real packages,
// and it is only ever reached through a dynamic import behind `isNativePlatform()` (so none of this is in the
// web bundle's entry chunk).

export type PermissionState = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';

export interface PendingNotification {
  id: number;
  extra?: unknown;
}
export interface ScheduledNotification {
  id: number;
  title: string;
  body: string;
  largeBody?: string;
  schedule: { at: Date; allowWhileIdle: boolean };
  channelId: string;
  isExactNotification: boolean;
  extra: Record<string, unknown>;
}
export interface ActionPerformedEvent {
  notification: { id: number; extra?: unknown };
}
export interface ListenerHandle {
  remove(): Promise<void>;
}

export interface LocalNotificationsPlugin {
  createChannel(channel: { id: string; name: string; description?: string; importance?: 1 | 2 | 3 | 4 | 5; visibility?: 1 | 0 | -1 }): Promise<void>;
  schedule(options: { notifications: ScheduledNotification[] }): Promise<{ warning?: { code: string; message: string } }>;
  cancel(options: { notifications: { id: number }[] }): Promise<void>;
  getPending(): Promise<{ notifications: PendingNotification[] }>;
  checkPermissions(): Promise<{ display: PermissionState }>;
  requestPermissions(): Promise<{ display: PermissionState }>;
  checkExactNotificationSetting(): Promise<{ exact_alarm: PermissionState }>;
  addListener(event: 'localNotificationActionPerformed', listener: (event: ActionPerformedEvent) => void): Promise<ListenerHandle>;
}

export interface PreferencesPlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

export interface SharePlugin {
  canShare(): Promise<{ value: boolean }>;
  share(options: { text?: string; title?: string; dialogTitle?: string; files?: string[] }): Promise<unknown>;
}

export interface FilesystemPlugin {
  writeFile(options: { path: string; data: string; directory: 'CACHE'; encoding: 'utf8' }): Promise<{ uri: string }>;
}

export interface AppPlugin {
  addListener(event: 'appStateChange', listener: (state: { isActive: boolean }) => void): Promise<ListenerHandle>;
}

export interface NativePlugins {
  localNotifications: LocalNotificationsPlugin;
  preferences: PreferencesPlugin;
  share: SharePlugin;
  filesystem: FilesystemPlugin;
  app: AppPlugin;
}

export async function loadNativePlugins(): Promise<NativePlugins> {
  const [{ LocalNotifications }, { Preferences }, { Share }, { Filesystem, Directory, Encoding }, { App }] = await Promise.all([
    import('@capacitor/local-notifications'),
    import('@capacitor/preferences'),
    import('@capacitor/share'),
    import('@capacitor/filesystem'),
    import('@capacitor/app'),
  ]);
  return {
    localNotifications: LocalNotifications as unknown as LocalNotificationsPlugin,
    preferences: Preferences,
    share: Share,
    filesystem: {
      writeFile: (o) => Filesystem.writeFile({ path: o.path, data: o.data, directory: Directory.Cache, encoding: Encoding.UTF8 }),
    },
    app: App as unknown as AppPlugin,
  };
}
