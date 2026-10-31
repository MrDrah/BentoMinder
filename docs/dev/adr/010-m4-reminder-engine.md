# ADR-010: M4 slice A, the pure reminder engine

Status: accepted 2026-10-31 · Owner: Developer · Builds on ADR 004 §4, ADR 005 §2 · Rules: BR-15..BR-18, US-E7-01/02/04/05/07, oracle `tests/oracle/reminder-oracle.md`

## Decision
- `src/domain/reminders/plan.ts` holds three pure functions: `planReminders` (jobs plus a diff against the previously scheduled `{key, contentHash}` list), `diffSchedule` and `visibleReminders` (the web in-app rule). No clock, no device timezone, no `decision` import (ADR 004 §5).
- The planner takes digested `ReminderDay[]`, not the store. `src/domain/calendar/reminder-days.ts` (`reminderDays`, `planRemindersForStore`) builds them through the existing `DayViewer`, so a conflict day is still a planned day (B7) and the decision engine stays the only source of what a day shows.
- Every instant is `jstWallToInstant(date, time)`; the device zone is never read. Day-before: due `(D-1) T_db`, expires `D 00:00` JST. Weekly: key `weekly:<S+1>`, due `S T_w`, expires `(S+8) 00:00` JST.
- Jobs are the unexpired, undismissed keys within the horizon (web 8 days, Android 35), sorted by due then key. Past (expired) keys are never returned. A key with `dismissedAt` in `reminderLog` is dropped, so a settings change never fires it again (US-E7-04/AC2).
- `visibleReminders`: `due <= now < expires`, or already shown (OQ-20, also after a time change); of several weeklies only the latest; `labelAt` is the log's original due time.
- Ids: 31-bit FNV-1a of the key, probed on collision inside one plan. `contentHash`: FNV-1a of key-sorted JSON of type, instants, route and content.
- Content is message keys plus params (dates, recipe ids and names from the decision snapshots, optional allergen ids the child registered, a conflict flag). No child name, profile, likes or dislikes. The UI slice renders the copy and the 「（日本時間）」 label (US-E7-07/AC2).

## Conflict found
The data contract §3.9 and ADR 004 §4 say suppress when `plannedAt >= dueAt`; the stories (US-E7-02/AC5 "after the due time") and the oracle (B10, RM36) say equality creates the reminder. The code follows the oracle and the story (`plannedAt > dueAt` suppresses). The contract and ADR 004 wording should be changed to "after" (Orchestrator).

## Revisit if
Android needs the diff to carry the log (a job already shown natively), the horizon changes, or reminders move server-side (v1).
