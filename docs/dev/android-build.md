# Android build: product owner steps (ADR 005, slice A0/A1)

Status 2026-11-17. The Capacitor project (`android/`, `capacitor.config.ts`) and the native adapters are in the repo and are
unit-tested with fake plugins. **Nothing here has run on a real Android device or emulator yet**: the build machine had no
JDK, Android Studio or SDK. Everything below that touches the toolchain is untested until you run it; report what differs.

## What is in the app

| Concern | Native behaviour | Code |
|---|---|---|
| Platform detection | `window.Capacitor.isNativePlatform()` (injected by the shell; `@capacitor/core` is not in the web bundle) | `src/adapters/platform.ts`, `src/adapters/select.ts` |
| Reminders | one-shot local notifications at the JST-derived instant, `allowWhileIdle`, channel `reminders`; reconciled with the device's pending list after every plan change and on every app resume; denied permission = in-app reminders only | `src/adapters/native/notifications.ts` |
| Storage | Capacitor Preferences; the old WebView `localStorage` copy is adopted once, without loss | `src/adapters/native/storage.ts` |
| Share | OS share sheet, clipboard fallback | `src/adapters/native/share.ts` |
| Export file | written to the app cache and handed to the share sheet (a WebView cannot download) | `src/adapters/native/file-export.ts` |
| PDF upload | unchanged: the web file input (the Android file picker opens from it) | |
| Sign-in | e-mail + password works unchanged; Google is hidden on native for now (see "Native Google sign-in") | `src/adapters/select-auth.ts` |

The notification permission is asked **once, right after the parent turns a reminder switch on in Settings** (not at launch).
The reminders are on by default, so on a fresh install switch one off and on again to get the Android prompt. (Product
decision for A2: also ask during onboarding. Not built; needs copy.)

## 1. One-time setup on your Windows PC

1. Install **Android Studio** (2025.2.1 or newer) from developer.android.com/studio. It brings its own JDK. First start: let it
   install the **Android SDK Platform 36** and the **SDK Platform-Tools** (Settings > Languages & Frameworks > Android SDK).
2. Install an emulator image: Device Manager > Create device > Pixel > API 34 or 35 or 36 (x86_64, Google APIs).
3. Make sure `adb` works in a terminal: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe version` (add the folder to PATH if you like).
4. Node 22 or newer is already needed for the web app.

## 2. Build the web assets for the app

The app is the same web build, copied into the Android project. Values the web app reads at build time come from the build
environment exactly as for the web deploy; **you supply them, they are never committed**. Put them in `.env.local`
(git-ignored) or set them in the shell before building:

| Variable | Meaning for the Android build |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID` | the same web-app values as the live site; without them sign-in is not configured and the login shows an error |
| `VITE_AI_PROXY_BASE_URL` | the hosted function URL (https). Unset = "this origin", which in the app is `https://localhost` and has no proxy, so menu import would fail |
| `VITE_SYNC_BASE_URL` | the hosted sync URL; unset = sync off |

Hosted functions must accept the app: the page origin inside the app is **`https://localhost`** (because `androidScheme` is
`https`). Add it to `ALLOWED_ORIGINS` (comma-separated, see `functions/params.example`) in your private
`functions/.env.<project>` and redeploy the functions. In the Firebase console, `localhost` is already an authorized domain for
Authentication by default; check it is still listed.

```
npm run cap:sync        # vite build, then copies dist/ into android/ and updates the plugin list
npm run cap:open        # opens the android/ project in Android Studio
```

`cap:sync` works without the Android SDK (it only copies files). Run it again after every web change.

## 3. Run the debug app

**Emulator.** In Android Studio wait for "Gradle sync" to finish, pick the emulator in the device list, press Run (green triangle).
First Gradle sync downloads a lot; allow 10 to 20 minutes.

**Your phone over USB.**
1. Phone: Settings > About phone > tap "Build number" 7 times; then Settings > System > Developer options > turn on **USB debugging**.
2. Plug in the cable, accept the "Allow USB debugging?" prompt on the phone.
3. `adb devices` must list the phone as `device`. Pick it in Android Studio and press Run.
4. Or build the file and install it yourself, from `android/` in PowerShell: `./gradlew assembleDebug`, then
   `adb -d install -r app\build\outputs\apk\debug\app-debug.apk`.

The debug APK is signed with the SDK's debug key: fine for your own devices, not uploadable to Google Play.

**Logs.**
- Native + plugin log: `adb logcat -s Capacitor Capacitor/Console` (or Android Studio's Logcat, filter `Capacitor`).
- The web app's own `console.warn` lines appear under `Capacitor/Console`. They contain variable names and error codes only.
- Web inspector for the page: on a PC Chrome open `chrome://inspect/#devices`, find BentoMinder, click "inspect" (needs USB debugging).
- Pending notifications: `adb shell dumpsys alarm | findstr bentominder` (alarms) and `adb shell dumpsys notification --noredact | findstr bentominder`.

## 4. Device test checklist (A2, from ADR 005 section 4)

Record the result of each line (pass / fail / note) and send it back. Use the emulator (API 34/35/36) and your phone.

1. [ ] First launch: login shows the e-mail form and the short Google note (no Google button). Sign in with e-mail + password. Create the profile and import or load a month.
2. [ ] Permission **not asked at launch**. In Settings turn a reminder off and on: the Android prompt appears (Android 13+). Test **Deny**: the app still shows in-app reminders; nothing arrives with the app closed. Then allow in system settings and reopen the app: it picks the permission up on resume.
3. [ ] Permission **Allow**: set the day-before time 2 minutes ahead (Settings) for tomorrow's planned bento day, or use the simulated clock only in a dev build; close the app and lock the screen: the notification arrives at that minute.
4. [ ] Exact alarms: Settings > Apps > BentoMinder > Alarms & reminders **allowed** vs **not allowed**: with it off the reminder may be a few minutes late and is still delivered; with it on it is on time. Switching it off while the app is installed must not lose the other reminders (reopen the app: they are re-planned).
5. [ ] Tap the notification with the app closed, and with the app open: it opens the recipe (`#/recipe/...`) or the day; an old notification (reminder past its expiry) opens the day sheet.
6. [ ] Decision change: change the planned recipe or make the day "not confirmed": the old notification is cancelled or replaced (no duplicate, no stale text). Change the reminder time: it moves.
7. [ ] No duplicates after killing and restarting the app 3 times.
8. [ ] Reboot the phone, do not open the app: a pending reminder still fires (plugin restore receiver; may not on some phones). Then open the app: it re-plans.
9. [ ] Time zone: set the phone to Europe/Paris: the day-before reminder still fires at 17:30 Japan time (01:30 or 09:30 local depending on season), not 17:30 Paris.
10. [ ] Doze: `adb shell dumpsys deviceidle force-idle`, then wait: the reminder still fires (it can be delayed).
11. [ ] Battery managers on your phone make/model (Xiaomi, Samsung, etc. "optimize battery"): note whether a reminder is lost after force-stop or after days of no use.
12. [ ] Storage: add data, force-stop, reopen: data is there. Uninstall/reinstall: data is gone unless you imported a backup (expected: no cloud). Android auto backup is allowed in the manifest (`allowBackup=true`); note what a restore does.
13. [ ] Share: the weekly plan opens the Android share sheet; cancelling falls back to the clipboard message.
14. [ ] Export: Settings > export opens the share sheet with a `.json` file; save it to Files; import it back.
15. [ ] PDF upload: Import > upload opens the Android file picker; a menu PDF is accepted (needs `VITE_AI_PROXY_BASE_URL`).
16. [ ] Hosted import and (if set) family sync work from the app (origin `https://localhost` accepted).
17. [ ] Back button, rotation, and returning from the background keep the screen and the data.
18. [ ] APK size and cold start time (note both).

## 5. Native Google sign-in (next slice; PO steps)

The Google popup of the web app cannot run in a WebView, so the first debug build offers e-mail + password only (the Google
button is replaced by a short note). Native Google sign-in needs your accounts and cannot be done by the agent:

1. **Firebase console > Project settings > Your apps > Add app > Android.** Package name = the application id in
   `capacitor.config.ts` (`app.bentominder` is a placeholder; decide the final id first, see below).
2. **SHA-1 (and SHA-256) fingerprints**: get the debug one with `./gradlew signingReport` in `android/` (or Android Studio's
   Gradle panel); add it to the Android app in Firebase. Add the release key's fingerprints later too, and the Play app-signing
   fingerprints once the app is in Play Console.
3. Download **`google-services.json`** and put it in `android/app/` (it is git-ignored: never commit it). Enable the Google
   provider in Firebase Authentication if it is not on.
4. The agent then adds a Capacitor Google sign-in plugin that uses the Android **Credential Manager** (Capacitor community
   plugin such as `@capgo/capacitor-social-login`, to be chosen and read in that slice) and signs in to Firebase with the
   returned Google ID token (`signInWithCredential`), replacing the seam in `src/adapters/select-auth.ts`.
5. Test on the emulator with a Google account added in the emulator's Settings, and on your phone.

## 6. Before anything is published

- **Application id.** `app.bentominder` is a placeholder. Once an app with an id is on Google Play (or installed from a signed
  release) it cannot be renamed. Decide it before the first release build; changing it later means editing
  `capacitor.config.ts`, `android/app/build.gradle` (`applicationId`, `namespace`), the Java package folder under
  `android/app/src/main/java/` and the Firebase Android app.
- **Signing keystore** and its passwords are yours alone: create it in Android Studio (Build > Generate Signed Bundle), keep it
  and the passwords outside the repo (`*.jks`, `*.keystore`, `keystore.properties` are git-ignored). Losing it means losing the
  ability to update the app.
- **Google Play Console** account, listing, privacy form (the child profile never leaves the device unless sync is on: say so)
  and data-safety answers are yours.
- Android's developer verification for sideloaded apps (2027 and later) is not yet applied to Japan as far as the feasibility
  note (2026-11-01) could confirm; re-check before distributing outside the Play Store.
- Small notification icon: the app launcher icon is used for now; Android prefers a white silhouette icon in
  `res/drawable` (a design task for A2).

## 7. Known limits of this slice (also in the report)

- The notification wording is rendered when the notification is scheduled, in the language selected at that time; changing the
  language does not re-word notifications that are already scheduled until their content changes.
- A reminder that became due while the phone was off is shown in the app's list on the next open, not as a late system notification
  (ADR 005 section 3 "Due-but-not-shown" is not implemented in this slice).
- Reboot restore, exact-alarm behaviour, Doze and battery managers depend on the plugin and the phone: only the checklist can settle them.
- No "go to system settings" button for a denied permission and no exact-alarm explanation row yet (needs copy).

## First real build (2026-11-18): lessons, all verified on this PC

- **Use JDK 21 for Gradle, not Android Studio's bundled JDK 25.** Gradle 8.14 with Android Gradle plugin 8.13 fails on Java 25
  ("Unsupported class file major version 69"). Install Temurin 21 (`winget install EclipseAdoptium.Temurin.21.JDK`) and set
  `JAVA_HOME` to it for the command line (`C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot`).
- **`android/local.properties`** (git-ignored) needs forward slashes: `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk`.
  Backslashes are escapes in a properties file and break the build ("filename syntax is incorrect").
- **Build-time settings.** `npm run cap:sync` builds the web app with whatever `VITE_*` values are in the environment: the
  Firebase web config (`VITE_FIREBASE_*`) plus `VITE_AI_PROXY_BASE_URL=https://asia-northeast1-bentominder.cloudfunctions.net/api`
  and `VITE_SYNC_BASE_URL=https://asia-northeast1-bentominder.cloudfunctions.net/sync`. Without the last two the APK has no
  hosted AI import and no family sync.
- **Command line build** (PowerShell, from the repo root):
  `npm run cap:sync` then `cd android; ./gradlew.bat assembleDebug --no-daemon`. Gradle downloads SDK Platform 36 on the first run.
- **Result:** `android/app/build/outputs/apk/debug/app-debug.apk` (about 6 MB, package `app.bentominder`, versionCode 1,
  minSdk 24, compileSdk 36). It is signed with the debug key: fine for your own phone, not for Google Play.
- **Install:** USB debugging + `adb install -r app-debug.apk`, or copy the APK to the phone and open it (allow "install unknown apps").
