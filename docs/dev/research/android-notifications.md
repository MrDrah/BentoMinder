# Research: reminders on the web and on Android (Capacitor)

Date: 2026-10-24 · Author: Developer (research agent) · Feeds: ADR 005 · Brief: `docs/ba/po-brief-2026-10-24.md` §11, §12

Citation keys `[Nn]` point to the table at the end (URL, date read 2026-10-24, the page's own "last updated" stamp). **UNVERIFIED** marks anything an official page did not state.

---

## C1. What a web app can do when it is closed

| Mechanism | Works when the tab/app is closed? | Needs | Status |
|-----------|-----------------------------------|-------|--------|
| `new Notification()` (non-persistent) | **No**: lifetime tied to the page [N1] | permission, secure context, user gesture to ask [N1] | On most mobile browsers the constructor **throws `TypeError`**; mobile must use service-worker notifications [N1] |
| `ServiceWorkerRegistration.showNotification()` (persistent) | Can stay interactive after the page closes [N1], but something must *wake the service worker* to show it | service worker | Shows a notification; does not schedule one |
| **Push API** | **Yes**: messages arrive "even when the app isn't in the foreground or currently loaded" [N2] | service worker + a push subscription + **an application server that sends the push** at 17:30 [N2] | Baseline widely available since March 2023 [N2]. iOS/iPadOS only from **16.4** and only for web apps **added to the Home Screen** with `display: standalone/fullscreen` [N3] |
| **Notification Triggers** (`showTrigger`, `TimestampTrigger`) | Would have allowed local scheduled notifications | — | **Development ended**: "it wasn't clear that we could provide consistent and reliable experiences across platforms"; never launched [N4] |
| **Periodic Background Sync** | Runs a service-worker task at a browser-chosen time | installed PWA in Chrome; engagement score decides frequency; `minInterval` is a minimum, not a guarantee [N5] | Experimental, not Baseline [N5]. Cannot hit 17:30 reliably |

**Conclusion.** Without a server that sends pushes, a closed web app **cannot** show a reminder at a chosen time on any browser. Notification Triggers would have solved this and was abandoned [N4]; Periodic Background Sync is experimental and timing is up to the browser [N5]. Push would work (also on installed iOS PWAs [N3]) but needs a server, a stored push subscription per device, and a scheduler: that is a v1 backend feature, contrary to the MVP's local-only, no-account design, and ADR 001 has no service worker in the MVP.

**What the browser MVP should promise** (honest wording, brief §11 "must not falsely promise"):
- Reminders are shown **inside the app when you open it**: a banner/inbox with today's status, tomorrow's bento (after 17:30 the day before), and the weekly summary (from Sunday 14:00), each until dismissed or expired.
- Optionally, while BentoMinder is **open in a tab** and permission is granted, a system notification when a reminder becomes due (desktop browsers; skipped on mobile where `new Notification()` throws [N1]). Labelled "only while BentoMinder is open".
- Settings say plainly: "ブラウザ版では、アプリを閉じている間は通知されません。確実な通知はAndroidアプリ版で対応予定です。" / "In the browser version, reminders only appear while the app is open. Reliable notifications are planned for the Android app."
- Plus a calendar export (`.ics` with the reminder times as alarms) is a possible cheap extra: the phone's own calendar does the alerting. Not researched further here (option in ADR 005).

## C2. Capacitor Local Notifications (Android)

**Versions.** Capacitor's current docs are **v8** (v9 is "next") [N6][N7]. Package `@capacitor/local-notifications`; recent features are tagged 8.1.0–8.3.0 [N6]. Capacitor 8 supports Android **API 24+ (Android 7+)** and needs a WebView with Chrome ≥ 60 [N7]; Node **22+** [N8].

### Scheduling
- One-shot: `schedule.at` is a JavaScript `Date` (an instant) [N6]. Recurring: `repeats`, `every` (`day`, `week`, `hour`…), `on` (cron-like `hour`, `weekday`…), `count` [N6].
- `allowWhileIdle: true` lets a notification fire during Doze, but such notifications "can only fire once per 9 minutes, per app" [N6]. We have at most 2–3 per day, so this is fine.
- IDs are **32-bit integers** [N6]. `cancel()`, `cancelAll()`, `getPending()`, `getByIds()`, `getAll()` exist [N6], so reschedule-by-id is supported.
- Android channels: `createChannel()`; a notification on a channel that does not exist **won't fire** [N6]. `smallIcon` in `res/drawable` [N6].
- Tap handling: `localNotificationActionPerformed` listener gets the notification back, including its `extra` data [N6] → we put the deep link in `extra` (`#/day/2026-11-05`, `#/recipe/<id>`) and route to it.

### Exact alarms (Android 12+)
- Android: from API 31 an app must declare an "Alarms & reminders" permission to set exact alarms [N9].
  - `SCHEDULE_EXACT_ALARM`: granted by the user, revocable; on revocation "your app stops, and all future exact alarms are canceled" [N9]. **"Not pre-granted to fresh installs of apps targeting Android 13 (API level 33) and higher"**; on Android 14 restored backups are denied too [N9; Android 14 behaviour change: https://developer.android.com/about/versions/14/changes/schedule-exact-alarms, read 2026-10-24]. In practice: default-deny for a new install of our app.
  - `USE_EXACT_ALARM`: granted automatically, cannot be revoked, "limited use cases" and "subject to an upcoming Google Play policy" [N9]; Android's own examples of a legitimate need are an alarm clock or a **calendar** app [N9]. Capacitor's docs advise using it only when exact timing is central to the app [N6].
  - Check `canScheduleExactAlarms()`; send users to settings with `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` after explaining why [N9].
- Capacitor 8.3 behaviour [N6]: `isExactNotification` defaults to `true`; on API 31+ `schedule()` **opens the "Alarms & reminders" settings screen** if permission is missing; if the user declines, it falls back to an **inexact** alarm and sets `ScheduleResult.warning`; `isExactMandatory: true` rejects instead; `update()` never prompts. `checkExactNotificationSetting()` / `changeExactNotificationSetting()` exist; if the user switches granted→denied, the app restarts and exact notifications are deleted; check the setting on launch (`App.appStateChange`) [N6].
- **Implication for us.** A 17:30 reminder arriving 10–30 minutes late is still useful; arriving after dinner is not. Inexact alarms respect Doze and batching [N9]; a forum report describes Capacitor notifications up to 70 minutes late on Android, tied to screen state/Doze [N10, anecdotal]. So: request `SCHEDULE_EXACT_ALARM` in context (after the parent turns reminders on, with a one-line reason), schedule with `allowWhileIdle`, accept the inexact fallback, and show "通知が数分〜数十分遅れる場合があります" when `warning` is set. Do **not** auto-open the settings screen on every schedule: call `schedule()` with `isExactNotification: false` until the parent has gone through the explained permission step (avoids a surprise settings screen).

### Notification permission (Android 13+)
- `POST_NOTIFICATIONS` is a runtime permission on API 33+; **notifications are off by default** for new installs [N11]. If denied, all channels are blocked [N11]. Ask in context (e.g. when the parent enables reminders), after the user knows the app [N11]. Capacitor: `checkPermissions()` / `requestPermissions()`; Android ≤ 12 returns granted [N6]. The plugin's manifest declares `POST_NOTIFICATIONS` [N12].
- Denial handling: keep in-app reminders working; show a settings row "通知がオフです" with a button to the system settings.

### Reboot, Doze, timezone
- Android cancels all alarms on shutdown; apps must re-register them on `BOOT_COMPLETED`, and that only works once the user has launched the app at least once [N9].
- The plugin's Android manifest has a `LocalNotificationRestoreReceiver` for `BOOT_COMPLETED`, `LOCKED_BOOT_COMPLETED` and `QUICKBOOT_POWERON`, plus `RECEIVE_BOOT_COMPLETED` and `WAKE_LOCK` [N12] → the plugin restores its stored notifications after reboot. The docs page itself does not describe reboot behaviour [N6] (**UNVERIFIED by test** — must be on the Android test checklist).
- Doze: alarms are deferred in Doze unless set with the allow-while-idle variants [N9][N6].
- Timezone: the docs do not say how `on`/`every` interpret time zones [N6] (**UNVERIFIED**). `at` is an absolute instant [N6]. **Use only one-shot `at` notifications computed from JST** (ADR 001's `jst` module: 17:30 JST = fixed UTC+9 instant), so device timezone changes cannot shift them. Recurring `every`/`on` are not needed: weekly summaries have different content each week anyway.
- Force-stop by the user, and OEM battery managers that kill background apps, can stop alarms (**UNVERIFIED** from official sources in this pass; treat as a known risk and test on the PO's phone).

### Known issues (summary)
1. Exact-alarm permission default-deny → inexact, possibly late reminders [N9][N6][N10].
2. Revoking exact-alarm permission restarts the app and deletes exact notifications [N6][N9] → re-check on every resume and reschedule.
3. Missing channel → silent non-delivery [N6].
4. Reboot restore relies on the plugin's receiver [N12]; verify on device.
5. Android 15+ Private Space: notifications not shown while the space is locked [N6].

## C3. Building for Android on Windows

| Need | Fact |
|------|------|
| Android Studio | Capacitor 8 requires **Android Studio 2025.2.1 or later** [N8] |
| JDK | Not installed separately: Android Studio installs the right JDK [N8] |
| SDK | SDK Tools + an SDK Platform for API ≥ 24 (latest stable then Android 16 / API 36) via SDK Manager [N8] |
| Node | 22+ [N8] (ADR 001 already needs ≥ 22.18) |
| Add platform | `npm install @capacitor/android` → `npx cap add android` → `npx cap open android` or `npx cap run android` [N7] |
| Debug APK | From `android/`: PowerShell `./gradlew assembleDebug` (cmd: `gradlew assembleDebug`); output `app/build/outputs/apk/debug/app-debug.apk`; signed automatically with the SDK debug key, cannot be published to Play [N13]. `gradlew installDebug` builds and installs in one step [N13] |
| Install on a phone | Enable Developer options (tap Build number 7×) and USB debugging; `adb -d install path/to/app-debug.apk` [N13]. Windows may need an OEM USB driver [N14]. Android 11+ supports **Wireless debugging** (pair once by QR/code) [N14] |
| Without a PC connection | Copying the APK to the phone and opening it ("install unknown apps") is the usual sideload path; not documented on the pages read (**UNVERIFIED** here) |
| Developer verification | Google's developer verification starts 2026-09-30 in Brazil, Indonesia, Singapore, Thailand; **"2027 and beyond"** global for apps on certified devices; Japan not named for 2026 [N15]. A free "limited distribution" account covers up to 20 devices for hobbyists [N15]. Whether `adb` debug installs are exempt is not stated (**UNVERIFIED**). Risk for a 2027 test build; none for 2026 |

**Feasibility.** Building a debug APK on Windows 11 with Capacitor 8 is a standard, documented path: install Android Studio (≈ several GB with SDK and an emulator image), no separate JDK, no Play account. Main practical blocker is not the build but **reaching the AI proxy from the phone**: the MVP proxy runs on the PC (`localhost:8787`). The Android test build either (a) imports the menu on the web app and transfers it (export/import file, ADR 003), (b) points the app at the PC's LAN address (cleartext HTTP from the WebView needs extra config; prefer HTTPS), or (c) uses the later hosted adapter (Cloudflare Worker, ADR 002). Reminders themselves need no network.

---

## Citations

All pages read on **2026-10-24**.

| Key | Source | URL | Updated |
|-----|--------|-----|---------|
| N1 | MDN: Notifications API | https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API | 2026-05-25 |
| N2 | MDN: Push API | https://developer.mozilla.org/en-US/docs/Web/API/Push_API | 2025-05-28 |
| N3 | WebKit: Web Push for Web Apps on iOS and iPadOS | https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ | 2023-02-16 |
| N4 | Chrome for Developers: Notification Triggers | https://developer.chrome.com/docs/web-platform/notification-triggers | 2019-10-24 (status banner: development ended) |
| N5 | MDN: Web Periodic Background Synchronization API | https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API | 2026-08-31 |
| N6 | Capacitor: Local Notifications plugin (v8) | https://capacitorjs.com/docs/apis/local-notifications | not shown |
| N7 | Capacitor: Android | https://capacitorjs.com/docs/android | not shown |
| N8 | Capacitor: Environment setup | https://capacitorjs.com/docs/getting-started/environment-setup | not shown |
| N9 | Android: Schedule alarms | https://developer.android.com/develop/background-work/services/alarms/schedule | 2026-10-21 |
| N10 | Ionic forum (anecdotal): local notifications not delivered on time | https://forum.ionicframework.com/t/android-ionic-local-notifications-are-not-delivered-on-time/238986 | — (via search result summary) |
| N11 | Android: Notification runtime permission | https://developer.android.com/develop/ui/views/notifications/notification-permission | 2026-10-23 |
| N12 | Capacitor plugins repo: local-notifications AndroidManifest.xml (main) | https://raw.githubusercontent.com/ionic-team/capacitor-plugins/main/local-notifications/android/src/main/AndroidManifest.xml | main branch as read |
| N13 | Android: Build your app from the command line | https://developer.android.com/build/building-cmdline | 2026-02-26 |
| N14 | Android: Run apps on a hardware device | https://developer.android.com/studio/run/device | 2026-10-16 |
| N15 | Android developer verification | https://developer.android.com/developer-verification | not shown |

### Not verified
- Timezone semantics of Capacitor `on`/`every` schedules (we avoid them).
- Reboot restore and force-stop/OEM battery behaviour on a real device (test checklist).
- Whether `adb`/debug installs are exempt from 2027 developer verification.
- Capacitor's web implementation of Local Notifications (not documented; we don't use it).
