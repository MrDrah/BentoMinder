# ADR-005: Notification adapter (web in-app + Android local notifications) and the Android phase

Status: **web part accepted** 2026-10-24 (§1–§2) · **Android part proposed** until M6 (§3–§5) · Owner: Developer

Binding rules: BR-15, BR-16, BR-17, BR-18 (`docs/PLAN.md` §3); OQ-14 (in-app only, accepted 2026-10-24). Reminder keys, expiry and `reminderLog`: data contract §3.1, §3.9.

Research and all citations: `docs/dev/research/android-notifications.md` (sources read 2026-10-24; keys `[Nn]` below refer to its table).

## Context
Reminders are a core feature (brief §11): weekly summary (default Sunday 14:00 JST), day-before reminder for confirmed bento days (default 17:30 JST, tap opens the recipe/day), same-day overview. Notifications must follow decision changes (reschedule/cancel), handle permission denial, timezone changes, duplicates and expired reminders, with configurable times. The browser version **must not falsely promise background notifications**; Android uses scheduled native local notifications, evaluated with Capacitor; no Kotlin rewrite; no Play publication needed; significant native complexity → document options (brief §12). ADR 004 §4 already defines the pure `planReminders` → `diffSchedule` pipeline (stable keys, JST-derived `dueAt`, `expiresAt`, `contentHash`); `docs/dev/architecture.md` §3 defines the `NotificationScheduler` port.

## Decision
One `NotificationScheduler` port, two adapters:
1. **Web (MVP): in-app reminders only.** Due reminders appear inside the app (banner + reminder list + Today view) when it is open or when it is next opened (BR-17, BR-18). No system notification of any kind, no `Notification` permission prompt (OQ-14, reconciliation R-4). `capabilities() = { background: false, exactTime: false }`. No service worker, no push.
2. **Android (v1 test build): `@capacitor/local-notifications` v8** with one-shot `at` notifications at JST-derived instants, `allowWhileIdle: true`, exact alarms when the parent grants them and an announced inexact fallback otherwise.

## 1. What the web MVP promises
- **Promise:** "Reminders appear when you open BentoMinder." The Today view and banners are always correct for the current time (driven by the `Clock` port), so opening the app at 17:40 shows tomorrow's bento reminder.
- **Not promised:** anything while the app is closed. Reason: without a push server a closed web app cannot show a timed notification on any browser [N1][N2]; Notification Triggers was abandoned [N4]; Periodic Background Sync is experimental with browser-chosen timing [N5]; `new Notification()` throws on most mobile browsers [N1].
- **Settings copy** (to the designer's copy sheet): 「ブラウザ版では、アプリを閉じている間は通知されません。確実な通知はAndroidアプリ版で対応予定です。」 / "In the browser version, reminders only appear while the app is open. Reliable notifications are planned for the Android app."
- **Not in the MVP (later option, R-4 closed):** a desktop system notification (`Notification` API) while the tab is open. Removed by OQ-14: it needs a permission prompt, still gives no background delivery, and would blur the BR-18 promise. Reconsider only together with a v1 notification story.
- **Copy check (BR-18):** 0 catalog strings claim reminders while the app or browser is closed; the banned-phrase test covers this; it reads the BA-owned list `data/banned-phrases.json` (PLAN §7 "H1 non-blocking", architecture §8).

## 2. Web adapter behaviour
- `apply(diff)` keeps the desired jobs in memory (they are re-planned from the store on every start, so nothing extra is persisted); nothing is scheduled with the OS.
- On start/resume and every minute while visible (the same tick that rolls the Today view over at Tokyo midnight, US-E7-03/AC3): jobs with `dueAt ≤ now < expiresAt` whose key has no `dismissedAt` in `store.reminderLog` → shown, labelled with their original time if missed (US-E7-05/AC2); `shownAt` / `dismissedAt` written to `reminderLog`; `expiresAt ≤ now` → dropped (ADR 004 "expired"). Log entries older than 60 days are pruned (contract §3.1).
- `onTap` → hash router.

## 3. Android adapter behaviour
| Concern | Rule |
|---------|------|
| Scheduling | `schedule({ notifications: [{ id: job.numericId, title, body, schedule: { at: new Date(job.dueAt), allowWhileIdle: true }, channelId: 'reminders', extra: { route: job.target.route, key: job.key, expiresAt } }] })`. `at` is an absolute instant [N6], so device timezone changes do not shift reminders; **no `every`/`on`** (their timezone semantics are undocumented [N6]) |
| Ids | ADR 004's 31-bit `numericId` (Android ids are 32-bit ints [N6]); scheduling the same id replaces it; `diffSchedule` makes the pipeline idempotent → no duplicates |
| Cancel / reschedule | `cancel({ notifications: remove.map(key => ({ id: numericId(key) })) })`, then schedule; after `apply`, reconcile with `getPending()` and store the refs |
| Horizon | 35 days (ADR 004 `horizonDays`; web uses 8); re-planned on every start/resume, state change and settings change |
| Channel | Create `reminders` channel at startup (a notification on a missing channel won't fire [N6]); small icon in `res/drawable` |
| `POST_NOTIFICATIONS` (13+) | Off by default for new installs [N11]. Ask **in context** when the parent turns reminders on (onboarding step "通知を受け取る"), not at launch [N11]. `checkPermissions()`/`requestPermissions()` [N6]. Denied → in-app reminders (web behaviour) + a settings row with a button to system settings |
| Exact alarms (12+) | Declare `SCHEDULE_EXACT_ALARM` (not `USE_EXACT_ALARM`: it is for limited use cases, irrevocable and subject to Play policy [N9]). Not pre-granted on fresh installs targeting 13+ [N9]. Until the parent has seen a one-line explanation and tapped "正確な時刻で通知", schedule with `isExactNotification: false`; then call `changeExactNotificationSetting()`. If `ScheduleResult.warning` is set (inexact fallback [N6]) show 「通知が数分〜数十分遅れる場合があります」 |
| Revocation | Revoking exact alarms restarts the app and deletes exact notifications [N6][N9] → on every `appStateChange` to active: `checkExactNotificationSetting()` + `checkPermissions()` + full re-plan |
| Due-but-not-shown | A job with `dueAt ≤ now < expiresAt` at re-plan time (e.g. phone was off) → shown immediately once as a local notification, otherwise only in-app (ADR 004) |
| Expired | Never scheduled; tap on a notification whose `extra.expiresAt` passed → open the calendar day instead of an outdated action |
| Reboot | Plugin restores stored notifications via its `BOOT_COMPLETED` receiver [N12]; Android only allows this after first launch [N9]. Also re-plan on next app open. **Must be verified on device** |
| Doze | `allowWhileIdle` fires during Doze, max once per 9 min per app [N6]; we fire ≤ 3/day |
| Tap | `localNotificationActionPerformed` → `extra.route` → hash router (`#/recipe/<id>?date=…`, `#/calendar/…`) [N6] |
| Other platform adapters | Storage → `@capacitor/preferences` or file; Share → `@capacitor/share`; PdfSource upload → file input in the WebView (ADR 001) |

## 4. Android phase plan
| Step | Content | Exit |
|------|---------|------|
| A0 Feasibility (≤ 1 day, after web M4) | Install Android Studio ≥ 2025.2.1 (JDK bundled, SDK API ≥ 24) on the Windows PC [N8]; `npm i @capacitor/core @capacitor/cli @capacitor/android`, `npx cap add android`, build `./gradlew assembleDebug` → `app-debug.apk` [N7][N13]; install with `adb -d install` or Wireless debugging [N13][N14] | Web app runs in the APK on the PO's phone; size and startup measured |
| A1 Adapters | Local notifications adapter (§3), Preferences storage, Share; menu import via export/import file or the hosted extractor if approved (ADR 002, architecture R2) | Unit tests with a fake plugin; manual test checklist below |
| A2 Device test | Checklist on the PO's phone + an emulator (API 34/35/36): permission denied/granted; exact granted/denied (inexact warning); fires with app closed and screen off; reboot; timezone change (set phone to Europe/Paris → still 17:30 JST); decision change cancels/reschedules; reminder time change; tap deep link; no duplicates after 3 app restarts; Doze (`adb shell dumpsys deviceidle force-idle`) | Checklist all green, recorded in `tests/reports/` |
| A3 Hand-over | Debug APK given to the PO (sideload, no Play) | PO confirms on own phone |

## 5. If native complexity turns out significant
Present to the PO, recommendation first:
1. **Accept inexact reminders** (no exact-alarm prompt at all, `isExactNotification: false`): simplest; reminders may arrive late in Doze (anecdotally up to ~1 h [N10]). Fine for the weekly summary; marginal for 17:30.
2. **Calendar export (`.ics`) from the web app**: the phone's own calendar app alerts at 17:30 with no Android build; but alerts don't update when decisions change unless re-exported. Works on iOS too.
3. **Web Push via a small server** (e.g. the same Cloudflare Worker + cron): reliable background notifications on Android Chrome and installed iOS PWAs (16.4+, Home Screen only [N3]); needs a backend, push subscriptions and storing the reminder plan server-side (child-data minimisation review) — a v1 project, not MVP.
4. **Defer Android**: ship the web MVP with honest in-app reminders only.
A Kotlin rewrite is excluded (brief §12).

## Why
- One port with honest `capabilities()` lets the UI tell the truth per platform, and the deterministic planner (ADR 004) stays the single source of what should fire.
- One-shot `at` + JST instants make timezone changes and content changes trivial: the diff reschedules by id.
- In-context permission requests follow Android guidance [N11] and avoid the surprise settings screen that `schedule()` opens by default on 12+ [N6].

## Alternatives considered
| Option | Why not (now) |
|--------|---------------|
| Desktop `Notification` while the tab is open (earlier draft) | OQ-14 / R-4: permission prompt for no background benefit; risks implying notifications the web can't deliver (BR-18). Later option |
| Service worker + Push in the MVP | Needs a server, subscriptions, a scheduler — contradicts local-only MVP; option 3 for later |
| Notification Triggers | Abandoned by Chrome, never shipped [N4] |
| Periodic Background Sync | Experimental, installed-PWA only, timing chosen by the browser [N5] |
| `USE_EXACT_ALARM` | Limited use cases, irrevocable, Play policy [N9]; `SCHEDULE_EXACT_ALARM` + fallback is enough |
| Capacitor `every`/`on` repeating schedules | Undocumented timezone semantics [N6]; weekly content differs each week |
| Native Kotlin WorkManager/AlarmManager plugin of our own | More native code to own; only if the Capacitor plugin fails the device checklist |
| Kotlin rewrite | Excluded by brief §12 |

## Consequences
- Web users get reminders only when they open the app; this is stated in Settings and onboarding.
- Android needs Android Studio on the PO's/developer's Windows PC (several GB) and a phone with USB or wireless debugging.
- The Android app cannot run AI import without a hosted extractor or menu transfer (ADR 002 open decision 2; architecture R2).
- Must test (unit, with fakes): permission states, `warning` handling, cancel+schedule ordering, resume re-plan, expired tap routing. Device-only items stay on the manual checklist.

## Known risks
1. **Late reminders**: exact-alarm permission is default-denied on fresh installs (13+) [N9]; inexact delivery can be delayed by Doze [N9][N10].
2. **Reminders silently lost**: notification permission off by default [N11]; exact-alarm revocation deletes exact notifications [N6][N9]; reboot restore and OEM battery killers/force-stop not verified on device.
3. **Platform drift**: Android developer verification goes global "2027 and beyond" for certified devices [N15] (debug/adb exemption not stated); Capacitor 9 is "next" [N7] — pin v8 for the test build.

## Revisit when
- The device checklist (A2) fails on reboot, Doze or exact timing → §5 options.
- A backend/accounts arrive (v1 sync) → Web Push becomes cheap (option 3).
- Developer verification rules for sideloading are published for Japan, or Capacitor 9 is released.
- Chrome/Android ship a standard way to schedule local notifications from the web.
- A v1 story asks for notifications on desktop browsers → reconsider the tab-open `Notification` option (§1) together with Web Push.

## Change log
- 2026-10-24 · proposed (research agent, kick-off).
- 2026-10-24 · **web part accepted** at H1 (Developer). R-4 / OQ-14: the optional desktop system notification while the tab is open removed from the MVP and listed as a later option; web reminders are in-app only. Field names aligned with ADR 004 and the data contract (`key`, `dueAt`, `expiresAt`, `reminderLog`). Android part (§3–§5) stays proposed until M6.
- 2026-10-24 · H1 fix round (Developer): banned phrases come from `data/banned-phrases.json`. Day-before suppression now uses `plannedAt`, and plans in refresh conflict keep their reminder until cleared (ADR 004 §4, PLAN §7 B7, B10); no change to the scheduler port.
