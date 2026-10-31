# ADR-011: M4 slice B, in-app reminders, today card, reminder settings, theme

Status: accepted 2026-10-31 · Owner: Developer · Builds on ADR 005 §1-2, ADR 010 · Rules: BR-15..BR-18, US-E7-01..07, US-E8-03, US-E8-05

## Decision
- **Adapter** (`src/adapters/web/notifications.ts`): implements `NotificationScheduler`; `apply(diff)` keeps the jobs in memory, `capabilities()` = no background, no `Notification` prompt (BR-18). Extra web methods `jobs()`, `scheduled()`, `tap()` let the UI read the plan back. Android keeps the port only.
- **Engine** (`src/ui/reminders/use-reminders.tsx`): on open, every store change, every minute and on tab visibility or focus it runs `planRemindersForStore`, applies the diff to the adapter and derives the shown list with `visibleReminders`. Nothing is planned while no profile exists, so a fresh install never writes a store.
- **Log writes** (`src/domain/reminders/log.ts`, pure): `shownAt` is written once per key, and only when the reminder list is mounted on the calendar (a reminder the parent could not see is not "shown"); `dismissedAt` on dismiss; entries older than 60 days are pruned in the same write. Same inputs return the same array, so an unchanged log is never rewritten.
- **Labels**: a banner carries the original time (`reminder.missedAt`, plus 「（日本時間）」 when the device zone is not Asia/Tokyo) when it was missed or already shown. A reminder that falls due between two checks of the open session is live and has no label.
- **Today card** (`src/domain/calendar/today.ts`, pure): today's displayed decision, else the next day with school lunch, not-confirmed or a bento plan, else unknown. It sits on the calendar below the reminders (no tab bar, flows §13). The Tokyo date in `AppProvider` is state, re-read every minute and on visibility, so the card and the grid roll over at Tokyo midnight.
- **Settings**: reminders card (switch, weekly day, 15-minute hour and minute selects, always-visible web limit) writes through the pure `updateReminderSettings`; the planner re-runs from the store change. The repository repairs a stored time that is not a 15-minute step to the default (US-E7-04/AC3) instead of failing the store. Theme radios reuse the existing `data-theme` effect and the dark tokens.
- **Copy**: M4 keys were added to `ja.ts` and `en.ts` verbatim from `design/copy.md` §13-14 by key (the catalog's milestone-by-milestone rule). One placeholder differs: `settings.weekly.value` in en uses `{wdLong}` (the sheet says `{wdLongEn}`) so the catalog parity test holds.

## Consequences
- With at most one day-before reminder due at a time and only the latest weekly, at most 2 reminders show together; the "3 due" wording of US-E7-05/AC5 cannot arise, the disclosure is tested with 2.
- Weekly conflict dates (`conflict` param) have no copy yet and are not listed in the weekly banner.
- Existing tests that compared the whole stored document after opening the calendar now see a reminder-log write; they compare the data they care about.

## Revisit if
Android shows reminders natively (the log would need `shownAt` from the OS), the reminder copy gains a conflict line, or reminders move server-side (v1).
