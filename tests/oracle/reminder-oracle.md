# Reminder oracle (BR-15, BR-16, BR-17, BR-18) — specification

Owner: QA · 2026-10-24 · Status: **H1 oracle-ready** (rulings B7, B10 of `docs/PLAN.md` §7, 2026-10-24, applied) · Stories: US-E7-01, US-E7-02, US-E7-04, US-E7-05, US-E7-07, US-E5-05/AC3, US-E5-06/AC1–AC2, US-E5-08/AC4, US-E11-02/AC1

Sources: `docs/PLAN.md` §3 BR-15…BR-18, the E7 reminder paragraph and ACs in `docs/ba/user-stories.md` (H1 final), `docs/ba/data-contract.md` §3.9 (`ReminderLogEntry`, expiry rules).

## 1. The rule, restated independently
All wall times are Asia/Tokyo (UTC+9, no daylight saving). The device timezone never changes a key, a due instant or an expiry (BR-15).

**Day-before** (enabled by `dayBefore.enabled`, time `T_db`, default 17:30):
- one reminder per date `D` whose displayed decision is `homemade-bento-planned` (school day or お弁当の日, incl. a conflict day kept after a refresh);
- key `day-before:D`; due = `(D − 1) T_db` JST; expires = `D 00:00` JST (contract §3.9);
- not created when the day's `plannedAt` (instant of the `CONFIRM_RECIPE` that made it HB; unchanged by `CHANGE_RECIPE`) is strictly **after** its due instant (US-E7-02/AC5, ruling B10); a recipe change never deletes or creates it;
- kept on a conflict day (HB on a date a refresh made no-lunch or removed) until `CLEAR_PLAN` (ruling B7);
- never for `not-confirmed`, `school-lunch-planned` or `no-school-lunch` days (US-E5-05/AC3).

**Weekly** (enabled by `weekly.enabled`, weekday `W`, time `T_w`, default Sunday 14:00):
- one reminder per occurrence of weekday `W` at date `S`; covers `S+1 … S+7`;
- key `weekly:<S+1>`; due = `S T_w` JST; expires = `(S+8) 00:00` JST (24:00 of the last covered date);
- always produced, also when there is nothing to report or no menu (US-E7-01/AC3, AC5).

**Visibility at instant `now`** (web, in-app): a reminder is shown iff `due ≤ now < expires` **and** its key has no `dismissedAt` in `reminderLog` (OQ-20: a shown but undismissed reminder shows again on every open until dismissed or expired). A settings change re-plans the due instant but never fires a key a second time as a new reminder. Of several unexpired weekly reminders only the most recent (latest due) is shown (US-E7-05/AC3). A missed reminder shows on next open with its original time (US-E7-05/AC2). Debug 「強制表示」 is the only bypass and is not logged (US-E11-02/AC2).

**Same action** (BR-17): a decision change, settings change or menu confirm updates the set of planned reminders before the action completes; there is never a moment where a cancelled plan still has its reminder.

Conversions used below: 17:30 JST = 08:30Z same day · 14:00 JST = 05:00Z · 00:00 JST of `D` = `(D − 1)T15:00Z` · Europe/Paris is UTC+1 from 2026-10-25 01:00Z (DST ends) · America/Los_Angeles is UTC−7 until 2026-11-01 09:00Z, then UTC−8.

## 2. Cases
Unless stated: default settings (weekly Sunday 14:00 on, day-before 17:30 on), plans made on 2026-10-28 10:00 JST, empty `reminderLog`. "Planned keys" = the keys the current decisions and settings produce, with their instants, independent of `now` (the planner may drop a key once it has expired; the oracle compares instants for unexpired keys and asserts expired ones are never visible); "Visible" = what the in-app banner shows at `now`.

| # | Decisions / settings | now (JST) | Device TZ | Planned keys → due (UTC) / expires (UTC) | Visible at now | Story |
|---|----------------------|-----------|-----------|------------------------------------------|----------------|-------|
| RM01 | 2026-11-04 HB | 2026-11-03 17:30 | Asia/Tokyo | `day-before:2026-11-04` → 2026-11-03T08:30:00Z / 2026-11-03T15:00:00Z | day-before:2026-11-04 (+ `weekly:2026-11-02` if not yet shown) | US-E7-02/AC1 |
| RM02 | same as RM01 | 2026-11-03 17:30 | Europe/Paris | identical to RM01 (shown as 09:30 local, labelled 「（日本時間）」 17:30) | day-before:2026-11-04 | US-E7-07/AC1, AC2 |
| RM03 | none | 2026-11-01 (Sun) 14:00 | Europe/Paris | `weekly:2026-11-02` → 2026-11-01T05:00:00Z / 2026-11-08T15:00:00Z; covers 11-02…11-08 | weekly:2026-11-02 | US-E7-01/AC1, US-E7-07/AC1 |
| RM04 | none | 2026-11-01 14:00 | America/Los_Angeles | same key and instants as RM03 (local time is **Sat 2026-10-31 22:00 PDT**) | weekly:2026-11-02 | BR-15: device date differs from Tokyo date |
| RM05 | none | 2026-10-25 (Sun) 14:00 | Europe/Paris | `weekly:2026-10-26` → 2026-10-25T05:00:00Z / 2026-11-01T15:00:00Z (local 06:00 CET, the morning DST ended) | weekly:2026-10-26 | no 1-hour shift across the device's DST change |
| RM06 | 2026-11-04 HB, 2026-11-05 NC | 2026-11-04 17:30 | Asia/Tokyo | `day-before:2026-11-04` only (no key for 11-05) | none (11-04's expired 2026-11-03T15:00Z) | US-E7-02/AC1, US-E5-05/AC3 |
| RM07 | 2027-01-29 (Fri) HB, 2027-02-01 (Mon) HB | 2027-01-28 17:30 | Asia/Tokyo | `day-before:2027-01-29` → 2027-01-28T08:30:00Z / 2027-01-28T15:00:00Z; `day-before:2027-02-01` → 2027-01-31T08:30:00Z / 2027-01-31T15:00:00Z | day-before:2027-01-29 | US-E7-02/AC3 month boundary |
| RM08 | 2027-01-01 (Fri) HB on a synthetic menu that lists it; weekly set to Thursday 20:00 | 2026-12-31 (Thu) 20:00 | Asia/Tokyo | `day-before:2027-01-01` → 2026-12-31T08:30:00Z / 2026-12-31T15:00:00Z; `weekly:2027-01-01` → 2026-12-31T11:00:00Z / 2027-01-07T15:00:00Z (covers 2027-01-01…01-07) | day-before:2027-01-01, weekly:2027-01-01 | year boundary 2026-12-31 → 2027-01-01 |
| RM09 | none (default Sunday) | 2026-12-27 (Sun) 14:00 | Asia/Tokyo | `weekly:2026-12-28` → 2026-12-27T05:00:00Z / 2027-01-03T15:00:00Z (covers 2026-12-28…2027-01-03) | weekly:2026-12-28 | weekly across the year boundary |
| RM10 | 2028-02-29 (Tue) HB, 2028-03-01 (Wed) HB | 2028-02-29 17:30 | Asia/Tokyo | `day-before:2028-02-29` → 2028-02-28T08:30:00Z / 2028-02-28T15:00:00Z; `day-before:2028-03-01` → 2028-02-29T08:30:00Z / 2028-02-29T15:00:00Z | day-before:2028-03-01 | US-E7-02/AC4 leap day |
| RM11 | 2026-11-04 HB; dayBefore **off** | 2026-11-03 17:30 | Asia/Tokyo | weekly keys only; no `day-before:*` | none (weekly:2026-11-02 if unshown) | US-E7-04/AC4 |
| RM12 | 2026-11-04 HB; weekly **off** | 2026-11-01 14:00 | Asia/Tokyo | `day-before:2026-11-04` only; no `weekly:*` | none | BR-16 switch off |
| RM13 | 2026-11-04 HB; both off | 2026-11-03 17:30 | Asia/Tokyo | none | none; today view still works | US-E7-04/AC4 |
| RM14 | 2026-11-04 HB, then 「給食に戻す」 confirmed on 2026-11-02 12:00 | 2026-11-03 17:30 | Asia/Tokyo | no `day-before:2026-11-04` | none | US-E5-06/AC2, US-E7-02/AC6 |
| RM15 | 2026-11-04 HB, then 「あとで決める」 on 2026-11-03 17:00 | 2026-11-03 17:30 | Asia/Tokyo | no `day-before:2026-11-04` | none | US-E7-02/AC6 |
| RM16 | 2026-11-04 planned at 2026-11-03 19:00 | 2026-11-03 19:00 | Asia/Tokyo | no `day-before:2026-11-04` (B10: `plannedAt` 2026-11-03T10:00Z > due 08:30Z) | none; today view on 11-04 covers it | US-E7-02/AC5 |
| RM17 | 2026-11-04 HB; app closed 17:00–21:00 | first open 2026-11-03 21:00 | Asia/Tokyo | as RM01 | day-before:2026-11-04, labelled 17:30 | US-E7-05/AC2 missed |
| RM18 | as RM17 | first open 2026-11-04 07:00 | Asia/Tokyo | as RM01 | none (expired); nothing new written to the log | US-E7-05/AC2 expired |
| RM19 | as RM01; reminder shown 17:30, dismissed 17:31 | reload at 17:45; then debug clock set to 2026-11-03 17:30 again | Asia/Tokyo | as RM01 | none, both times | US-E7-05/AC1 |
| RM20 | 2026-11-04 HB R1, changed to R2 at 2026-11-02 12:00 | 2026-11-03 17:30 | Asia/Tokyo | same key and instants as RM01 (B10: `plannedAt` stays 2026-10-28T01:00Z < due); content names R2 | day-before:2026-11-04 (R2) | US-E5-06/AC1, US-E7-02/AC6 |
| RM21 | weekly Saturday 20:00, day-before 19:15; 2026-11-11 HB | 2026-11-07 (Sat) 20:00 | Asia/Tokyo | `weekly:2026-11-08` → 2026-11-07T11:00:00Z / 2026-11-14T15:00:00Z (covers 11-08…11-14); `day-before:2026-11-11` → 2026-11-10T10:15:00Z / 2026-11-10T15:00:00Z | weekly:2026-11-08 | US-E7-04/AC2 |
| RM22 | 2026-11-04 HB; shown at 17:30 and **dismissed** 17:31, then day-before time changed to 19:15 | 2026-11-03 19:15 | Asia/Tokyo | key unchanged, due now 2026-11-03T10:15:00Z | none (dismissed) | US-E7-04/AC2 "not shown again" |
| RM23 | nothing shown since 2026-11-01 | first open 2026-11-08 (Sun) 15:00 | Asia/Tokyo | `weekly:2026-11-02` (expires 2026-11-08T15:00Z, still valid), `weekly:2026-11-09` (due 2026-11-08T05:00:00Z, expires 2026-11-15T15:00:00Z) | weekly:2026-11-09 only | US-E7-05/AC3 |
| RM24 | November confirmed, December not | 2026-11-29 (Sun) 14:00 | Asia/Tokyo | `weekly:2026-11-30` → 2026-11-29T05:00:00Z / 2026-12-06T15:00:00Z | weekly:2026-11-30; content lists 11-30 normally and 「12月の献立がまだありません」 for 12-01…12-06 | US-E7-01/AC4 |
| RM25 | no confirmed menu covers 2026-12-07…12-13 | 2026-12-06 (Sun) 14:00 | Asia/Tokyo | `weekly:2026-12-07` → 2026-12-06T05:00:00Z / 2026-12-13T15:00:00Z | weekly:2026-12-07 with 「来週の献立がまだありません」 | US-E7-01/AC5 always delivered |
| RM26 | 2026-11-20 (bento-day) HB | 2026-11-19 17:30 | Asia/Tokyo | `day-before:2026-11-20` → 2026-11-19T08:30:00Z / 2026-11-19T15:00:00Z | day-before:2026-11-20 | US-E5-08/AC4 |
| RM27 | 2026-11-20 (bento-day) **not** planned | 2026-11-19 17:30 | Asia/Tokyo | no `day-before:2026-11-20` | none | US-E5-08/AC4 |
| RM28 | 2026-11-04 planned on 2026-11-04 08:00 (today) | 2026-11-04 08:00 | Asia/Tokyo | no `day-before:2026-11-04` (B10: `plannedAt` 2026-11-03T23:00Z > due 2026-11-03T08:30Z) | none; today card 「今日は手作りお弁当：<recipe>」 | US-E5-03/AC4, US-E7-03/AC1 |
| RM29 | 2026-11-04 HB | debug clock 2026-11-03 17:29:00, then +1 min | Asia/Tokyo | as RM01 | none at 17:29; day-before:2026-11-04 at 17:30 | US-E11-02/AC1, due boundary `due ≤ now` |
| RM30 | 2026-11-04 HB, never shown | 2026-11-03T14:59:59.999Z, then 2026-11-03T15:00:00.000Z | Asia/Tokyo | as RM01 | visible, then **not** visible | expiry boundary `now < expires` |
| RM31 | 2026-11-04 HB | app open from 2026-11-03 12:00 JST; device TZ switches Asia/Tokyo → America/Los_Angeles at 12:05 | changes | keys and instants unchanged; "today" stays 2026-11-03 | at 17:30 JST: day-before:2026-11-04 | US-E7-07/AC3 |
| RM32 | 2026-11-04 HB, then a refresh makes 2026-11-04 `other-no-lunch` (decision kept, conflict flagged) | 2026-11-03 17:30 | Asia/Tokyo | `day-before:2026-11-04` still planned (decision unchanged), content carries the conflict notice | day-before:2026-11-04 | BR-13 + BR-16 (decision oracle S09) |
| RM33 | 2026-11-04 HB with recipe R1; profile then gets an allergen R1 contains | 2026-11-03 17:30 | Asia/Tokyo | key unchanged; content includes the warning 「選んだレシピに登録したアレルゲン（卵）が含まれています」 | day-before:2026-11-04 with warning | US-E1-05/AC2 |
| RM34 | 2026-11-04 HB R1 first confirmed 2026-11-02 12:00 (`plannedAt` 2026-11-02T03:00:00Z); app closed 17:00–18:00; `CHANGE(R2)` at 2026-11-03 18:00 | 2026-11-03 18:00 | Asia/Tokyo | `day-before:2026-11-04` kept → 2026-11-03T08:30:00Z / 2026-11-03T15:00:00Z (`plannedAt` < due, unchanged by the change) | day-before:2026-11-04, content names **R2** (missed, shown on open: 08:30Z ≤ 09:00Z < 15:00Z) | B10, US-E7-02/AC6, US-E7-05/AC2 |
| RM35 | as RM34 but the reminder was shown 17:30 and dismissed 17:31; `CHANGE(R2)` at 19:00 | 2026-11-03 19:00 | Asia/Tokyo | key kept, same instants | none (key already dismissed; one reminder per key) | B10, BR-17, US-E7-05/AC1 |
| RM36 | 2026-11-04 first confirmed at exactly 2026-11-03 17:30:00.000 JST (`plannedAt` = 2026-11-03T08:30:00.000Z = due) | 2026-11-03 17:30:00.000 | Asia/Tokyo | `day-before:2026-11-04` **created** (`plannedAt` is not after due) → 2026-11-03T08:30:00Z / 2026-11-03T15:00:00Z | day-before:2026-11-04 (`due ≤ now`) | B10 equality boundary (partner of RM16) |
| RM37 | 2026-11-04 first confirmed 2026-11-03 18:00 (R1, `plannedAt` 09:00Z > due 08:30Z), then `CHANGE(R2)` at 19:00 | 2026-11-03 19:00 | Asia/Tokyo | no `day-before:2026-11-04` (a change neither deletes nor creates it) | none; the 11-04 today card names R2 | B10, US-E7-02/AC5 |
| RM38 | 2026-11-04 HB R1 (planned 11-02 12:00); refresh FX-01c on 2026-11-03 09:00 makes 11-04 `other-no-lunch`; `CLEAR_OK` at 2026-11-03 12:00 | 2026-11-03 17:30 | Asia/Tokyo | no `day-before:2026-11-04` (removed in the CLEAR action) | none | B7, BR-17 (decision T44) |
| RM39 | 2026-11-11 HB R2 (planned 11-02 12:00); refresh FX-01c on 2026-11-03 removes 11-11 | 2026-11-10 17:30 | Asia/Tokyo | `day-before:2026-11-11` → 2026-11-10T08:30:00Z / 2026-11-10T15:00:00Z | day-before:2026-11-11 with the flag 「献立が変わりました」 | B7 removed date (decision T47) |
| RM40 | RM32 state, then `KEEP` at 2026-11-03 12:00 | 2026-11-03 17:30 | Asia/Tokyo | key and instants unchanged | day-before:2026-11-04 | B7 `KEEP_PLAN` (decision T43) |
| RM41 | 2026-11-04 HB R1 planned 2026-11-02 12:00; `LATER` at 2026-11-03 17:00 (`plannedAt` cleared, key removed); `CONFIRM(R2)` at 2026-11-03 18:00 (new `plannedAt` 09:00Z > due 08:30Z) | 2026-11-03 18:00 | Asia/Tokyo | no `day-before:2026-11-04` | none; the 11-04 today card names R2 | closing ruling RU1 (decision T56) |
| RM42 | 2026-11-04 HB; reminder shown at 17:30, app closed without dismissing | reopen 2026-11-03 19:00; reopen 2026-11-04 07:00 | Asia/Tokyo | as RM01 | 19:00: day-before:2026-11-04 shown again (label 17:30); 07:00: none (expired 2026-11-03T15:00Z) | OQ-20 (N3) |
| RM43 | as RM42, but the day-before time was changed to 19:15 at 18:00 | reopen 2026-11-03 18:30 | Asia/Tokyo | key unchanged, due now 2026-11-03T10:15:00Z | day-before:2026-11-04 (already shown at 17:30, undismissed: OQ-20 keeps it; the time change does not hide it and does not make it a new reminder) | OQ-20 + US-E7-04/AC2 |

43 cases (RM34–RM43 added at the H1 rulings).

## 3. Properties (M4, in the gate)
- RP1 Idempotence: running the planner twice on the same state gives the same set; the diff of the second run is empty.
- RP2 Keys are unique; at most one `weekly:*` and one `day-before:*` per date.
- RP3 For every key, `expires > due` (contract rule).
- RP4 Running the whole suite under `TZ=Asia/Tokyo`, `TZ=Europe/Paris` and `TZ=America/Los_Angeles` (unit) and Playwright `timezoneId` `Europe/Paris` (e2e) gives identical keys and instants.
- RP5 Random comparison, seeded (`20261024`): 1,000 states (0–10 decisions over a 60-day window around a random `now` between 2026-10-01 and 2028-03-31, random settings in 15-minute steps, random log) → planned keys, due/expires instants and visible set equal the oracle's. Any difference is P1.

## 4. Rulings applied (PLAN §7, 2026-10-24) and what is still open
- **B10** resolved: the day-before reminder is suppressed only if `plannedAt` (set by the first `CONFIRM_RECIPE` into HB, unchanged by `CHANGE_RECIPE`) is **after** the due instant; equality creates it. A recipe change never deletes a pending reminder. Cases: RM16, RM20, RM28 (unchanged expectations, now asserted), RM34–RM37.
- **B7** resolved: a conflict day keeps its reminder until `CLEAR_PLAN`; `KEEP_PLAN` changes nothing. Cases: RM32, RM38–RM40.

**Closing rulings (PLAN §7 "H1 closing rulings") — nothing is open:**
- **RU1 → RM41** `plannedAt` is cleared when the day leaves HB; planning it again sets a new one.
- **N3 = OQ-20 → RM42, RM43** a shown, undismissed reminder shows again until dismissed or expired; RM22 now dismisses explicitly. The generator writes shown-only and dismissed log entries and re-plans after `LATER`/`TO_SCHOOL`/`CLEAR` followed by `CONFIRM` before and after the due instant.

Case count: **43** (RM01–RM33 + RM34–RM43).
