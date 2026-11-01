# Android feasibility (M6) - US-E12-01

Date: 2026-11-01 - Author: Developer (research agent) - Feeds: ADR 005 §3-§5, PLAN M6 / v1.
All web pages below were read on **2026-11-01**. Each page's own "last updated" stamp is given where the page showed one. Wording is ours. Items we could not confirm are marked **UNVERIFIED**.

Source keys:
- [C1] https://capacitorjs.com/docs/apis/local-notifications (Capacitor docs v8, no date shown)
- [C2] https://capacitorjs.com/docs/android (v8, no date shown)
- [C3] https://capacitorjs.com/docs/getting-started/environment-setup (no date shown)
- [A1] https://developer.android.com/develop/background-work/services/alarms/schedule (updated 2026-10-28)
- [A2] https://developer.android.com/develop/ui/views/notifications/notification-permission (updated 2026-10-28)
- [A3] https://developer.android.com/build/building-cmdline (updated 2026-02-26)
- [A4] https://developer.android.com/developer-verification (no date shown)
- [N1] https://registry.npmjs.org/@capacitor/local-notifications/latest (npm registry)
- [N2] https://registry.npmjs.org/@capacitor/core/latest (npm registry)

## 1. Recommendation

**GO for a v1 debug-APK spike (ADR 005 steps A0-A3), with the inexact-reminder fallback accepted from day one.** The build path is documented and standard, the plan keeps the existing web code, and only three adapters change. The real risks are late or lost reminders on some phones (exact-alarm permission, reboot, battery managers), which only a device test can settle. If the A2 device checklist fails, fall back to the ADR 005 §5 options (inexact only, `.ics` export, Web Push, or defer).

## 2. Capacitor version and setup

- Current Capacitor docs are v8 [C1][C2]. On 2026-11-01 the npm registry showed `@capacitor/core` 8.6.0 [N2] and `@capacitor/local-notifications` 8.3.1 [N1]. Whether v9 exists or is imminent: **UNVERIFIED** (ADR 005 recorded v9 as "next" on 2026-10-24; not re-checked). Pin the v8 line for the test build.
- Requirements: Node 22 or newer; Android Studio 2025.2.1 or newer; SDK Platform API 24 or higher (API 36 is the latest stable one named); no separate JDK, Android Studio installs it [C3]. Capacitor 8 runs on Android 7 (API 24) and up and needs a Chrome 60+ based WebView [C2].
- Project steps: `npm install @capacitor/android`, then `npx cap add android`; open with `npx cap open android` or run with `npx cap run android` [C2]. Plugin: `npm install @capacitor/local-notifications` then `cap sync` [C1]. The Vite/React/TS app is reused as the web assets (webDir = Vite `dist`); that wiring is standard Capacitor practice but was **not read on a page this pass: UNVERIFIED**, to be confirmed in A0.
- Debug APK on Windows: from `android/`, `gradlew assembleDebug` (PowerShell: `./gradlew assembleDebug`); the APK lands under `<module>/build/outputs/apk/` and is signed automatically with the SDK debug key, so it cannot go to Google Play [A3]. `installDebug` builds and installs on a connected device or emulator in one step; manual install is `adb -d install <apk>` after enabling USB debugging [A3].

## 3. Local Notifications plugin capabilities

| Capability | What the docs say | Source |
|---|---|---|
| One-shot schedule | `schedule()` takes a list; `at` is a specific Date. `repeats`, `every`, `on`, `count` exist for recurring | [C1] |
| Doze | `allowWhileIdle: true` fires during Doze, but at most once per 9 minutes per app (we need at most about 3 per day) | [C1] |
| Ids | Number; on Android must be a 32-bit integer | [C1] |
| Change / cancel | `update()` matches by id; `cancel()`, `cancelAll()`, `getPending()` | [C1] |
| Channels | Android 8+: a notification pointing at a channel that does not exist will not fire; create the channel first | [C1] |
| Tap | `localNotificationActionPerformed` returns the original notification (so our `extra.route` deep link) | [C1] |
| Exact alarms | From Android 12 notifications are inexact unless `SCHEDULE_EXACT_ALARM` is declared. `isExactNotification` defaults to true; if exact is not allowed on API 31+, `schedule()` opens the "Alarms & reminders" screen, and if the user declines it falls back to inexact and sets `ScheduleResult.warning`. `isExactNotification: false` forces inexact; `isExactMandatory: true` rejects instead. `update()` never prompts | [C1] |
| Exact-alarm revoke | Turning it off restarts the app and deletes the exact notifications; check `checkExactNotificationSetting()` at launch (e.g. on `appStateChange`) | [C1] |
| `USE_EXACT_ALARM` | Granted automatically and not revocable, but limited to specific use cases and subject to an upcoming Play policy; Capacitor says use it only when exact timing is core | [A1][C1] |
| `SCHEDULE_EXACT_ALARM` | User-granted, revocable, **not pre-granted on fresh installs targeting Android 13+**; denied after a backup restore on Android 14+. Check `canScheduleExactAlarms()`, explain, then send the user to settings | [A1] |
| Notification permission, Android 13+ | `POST_NOTIFICATIONS` is a runtime permission; notifications are **off by default** for new installs; "Don't allow" blocks all channels. Targeting API 33+ lets us pick the moment: Android advises asking after the user sees the value, triggered by a user action | [A2] |
| Plugin permission API | `checkPermissions()` / `requestPermissions()` return `prompt`, `prompt-with-rationale`, `granted`, `denied`; Android 12 and older return granted. Since 8.3.0 `schedule()`/`update()` also request permission if missing, so we must call them only after our own in-context step | [C1] |

**Not covered by the plugin docs:** reboot restore and time-zone handling of scheduled notifications. The Capacitor page says nothing on either [C1]. Android itself clears alarms on shutdown and expects a `BOOT_COMPLETED` receiver, which works only after the app was launched once [A1]. Whether the plugin's own receiver restores our notifications is **UNVERIFIED** (the research file read the plugin manifest on 2026-10-24: `docs/dev/research/android-notifications.md` N12; not re-read).

## 4. How the web reminder adapter maps to native

The `NotificationScheduler` port (architecture §3, ADR 004 `planReminders` -> `diffSchedule`) stays unchanged. Only the adapter behind `src/adapters/select.ts` changes, chosen when Capacitor reports a native platform (architecture §3 / ADR 001).

| Port action | Web (MVP, in-app only) | Android (`@capacitor/local-notifications`) |
|---|---|---|
| `apply(diff)` add/change | keep job in memory; show when `dueAt <= now < expiresAt` | `schedule()` one-shot `at` = JST-derived instant, `allowWhileIdle: true`, channel `reminders`, `extra` = route, key, expiry [C1] |
| remove | drop from memory | `cancel()` by 31-bit numeric id, then reconcile with `getPending()` [C1] |
| permission / capabilities | `{ background: false, exactTime: false }` | `checkPermissions()` / `requestPermissions()` in context; exact status via the exact-alarm calls [C1][A2] |
| tap | hash router | `localNotificationActionPerformed` -> `extra.route` -> hash router [C1] |
| denied permission | n/a | fall back to the web in-app behaviour plus a "go to system settings" row |

Why one-shot `at` only: an absolute instant avoids relying on `every`/`on`, whose time-zone behaviour the docs leave unstated [C1]; the 17:30 JST rule then holds when the phone changes zone (device test A2 to confirm).
Other adapters (ADR 005 §3): storage on Capacitor Preferences or a file, share via the Share plugin, PDF upload via a file input in the WebView. These plugins were **not read this pass: UNVERIFIED** (their docs are at capacitorjs.com; check in A1).

## 5. AI adapter call from the app (no key in the APK)

The Android app must never hold the AI provider key. It calls a hosted extractor over HTTPS (the ADR 002 proxy moved to a hosted function, PLAN risk R2); the key lives only on that server. Today the proxy runs on the PC at `localhost:8787`, unreachable from a phone. For the v1 test build, either import the menu in the web app and transfer it by the export/import file (ADR 003), or use the hosted adapter once the product owner approves it. That is a **product owner decision**, not a technical blocker. Scanning the APK for the key (US-E12-02/AC2) is a v1 test. No platform source is needed for this section; it follows from the project's own ADR 002/003.

## 6. Risks

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| 1 | Exact alarms default-denied on fresh installs [A1]; inexact fallback may be late | High / Medium | Ask in context; accept inexact with a visible warning; weekly summary tolerates delay |
| 2 | Reminder silently lost: notification permission off by default [A2]; exact revoke deletes exact notifications [C1][A1] | Medium / High | Re-check and re-plan on every app resume; in-app fallback |
| 3 | Reboot, force-stop and phone-maker battery managers (UNVERIFIED) | Medium / High | A2 device checklist on the owner's phone |
| 4 | Sideloading policy: global developer verification "2027 and beyond" on certified devices; Japan not named for 2026; limited-distribution accounts cover up to 20 devices [A4]. Whether adb/debug installs are affected is not stated | Low in 2026 / Medium later | Re-check before a 2027 test; keep the web version as the base |
| 5 | Toolchain weight (Android Studio plus SDK on Windows) | Certain / Low | One-time setup, A0 |

## 7. Effort estimate

Estimates are ours (no source), in developer days, for one person:
- A0 spike (Android Studio, `cap add android`, debug APK on emulator and phone): 1 day.
- A1 adapters (notifications, storage, share) with fake-plugin unit tests: 3-4 days.
- A2 device test checklist and fixes (permission denied/granted, exact granted/denied, app closed, reboot, time zone, decision change, Doze): 2-3 days.
- A3 hand-over plus the hosted extractor if approved: 1 day plus the extractor work (separate).
Total about 7-9 days; size L as in PLAN v1.

## 8. Options for the product owner

1. **Recommended: spike A0 now (1 day), then full v1 build** if the spike installs and a test notification fires on the owner's phone.
2. Inexact reminders only (no exact-alarm prompt): simplest, may be late.
3. `.ics` calendar export or Web Push via a small server: no Android build, other trade-offs (ADR 005 §5).
4. Defer Android; ship the web MVP with honest in-app reminders.
A Kotlin rewrite is excluded (brief §12).

## 9. What is not verified

- Capacitor v9 timing and any v8 -> v9 changes (v8 pinned; only the v8 npm versions above were seen).
- Reboot restore by the plugin; time-zone behaviour of scheduled notifications; force-stop and battery-manager behaviour. All need a real device.
- Whether the Vite `dist` output works as `webDir` without changes, APK size and start-up time.
- Capacitor Preferences, Share and file-picker plugin behaviour inside the WebView.
- Whether adb/debug installs are affected by the 2027 developer verification [A4]; sideloading by copying the APK to the phone was not read on any page.
- Behaviour on non-Pixel phones, and on Android 15+ features such as Private Space (the earlier research mentions it; not re-checked).
- Effort numbers are our judgement, not measured.
