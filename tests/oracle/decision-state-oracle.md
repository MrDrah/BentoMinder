# Decision state oracle (BR-01, BR-02, BR-03, BR-13, BR-17, BR-19, BR-25, BR-27) — specification

Owner: QA · 2026-10-24 · Status: **H1 oracle-ready** (rulings B6, B7, B10 and the H1 follow-ups of `docs/PLAN.md` §7, 2026-10-24, applied) · Stories: US-E5-02 … US-E5-08, US-E3-05/AC1–AC2, US-E1-05/AC1–AC2, US-E6-06, US-E10-05

Sources: `docs/PLAN.md` §3, the E5 state-machine table in `docs/ba/user-stories.md` (H1 final, incl. 「計画を取り消す」), `docs/ba/data-contract.md` §3.6 and its rules `decision-transition`, `decision-no-past-write`, `decision-bento-day-only`, `decision-bento-day-remove`, `decision-reservation-flag`, `decision-bento-requires-recipe`, `decision-recipe-resolves`, `decision-parent-only`.

## 1. Model

**Day kinds** (from the confirmed menu of the date's month):
| Kind | Meaning |
|------|---------|
| `school` | in `days` with ≥ 1 non-snack item (BR-25) |
| `bento-day` | in `noLunchDays` with reason `bento-day` |
| `other-no-lunch` | in `noLunchDays` with reason `no-lunch`, `closed` or `unknown` |
| `none` | not in the menu, snack-only, or the month has no confirmed menu |

**Displayed decision** = the stored `DayDecision.state` if a record exists, else derived: `school` → `school-lunch-planned`, `bento-day`/`other-no-lunch` → `no-school-lunch`, `none` → no decision.

**Observable outcome of every event**: (displayed state, `recipeId`, `reservationDoneExternally`, record stored yes/no) + the day-before reminder key `day-before:<date>` present/absent in the plan (BR-17) + whether the write was **rejected** (store byte-identical, nothing else changed).

**Parent events** (the only writers, BR-02):
| Event | UI |
|-------|----|
| `OPEN_BENTO` | 「手作りお弁当にする」 / 「お弁当を計画する」: opens recommendations, writes nothing |
| `CLOSE_RECS` | back or close on the recommendation view |
| `CONFIRM(r)` | 「この日に決定」 with recipe `r` (from recommendations or from the library, US-E6-05/AC2) |
| `LATER` | 「あとで決める」 |
| `TO_SCHOOL` → `TO_SCHOOL_OK` / `TO_SCHOOL_CANCEL` | 「給食に戻す」 (dialog only from `homemade-bento-planned`, US-E5-06/AC3) |
| `CHANGE(r2)` | 「レシピを変更」 then confirm `r2` |
| `CLEAR` → `CLEAR_OK` / `CLEAR_CANCEL` | 「計画を取り消す」 (bento days, US-E5-08/AC3) |
| `RESERVED(true/false)` | 「園で予約済み（自分で記録）」 tick / untick |
| `KEEP` | `KEEP_PLAN`: 「このままにする」 on a day flagged 「献立が変わりました」 (B7 + follow-up): sets `acknowledgedMenuVersion`, never changes state, recipe or reminder |

**Conflict days (rulings B7, follow-up).** A stored `homemade-bento-planned` record whose date a refresh turned into an `other-no-lunch` day, or removed from the menu, is a **conflict day**: the decision is kept (BR-13), the day is flagged 「献立が変わりました」 until `KEEP` (acknowledged for that menu version), and only `KEEP` and `CLEAR`/`CLEAR_OK` are accepted. Its day-before reminder stays until `CLEAR_OK`. A refresh that turns a planned school day into an お弁当の日 is **not** a conflict (BR-25): the day is a normal `bento-day` HB row.

**Dormant records (ruling B6 + follow-up).** A stored `not-confirmed` or `school-lunch-planned` record (and an override) on a date that a refresh turns into a no-lunch day is kept byte-identical but not shown: the day displays the derived `no-school-lunch` and behaves as G3/T31 (no action offered). If a later refresh makes the date a school day again, the record returns unchanged.

**`plannedAt` (rulings B10, RU1).** Set to `now` by the `CONFIRM` that creates the HB state; unchanged by `CHANGE`; cleared when the day leaves HB (`LATER`, `TO_SCHOOL_OK`, `CLEAR_OK`); `decidedAt` is updated by every accepted event. Used only by the reminder oracle.

**Recipe validity for `CONFIRM`/`CHANGE`**: `r` must resolve in the library and pass the hard filters for the current profile (BR-06 "never plannable"). Otherwise → rejected.

**Global guards (apply before the table)**
- G1 date < today in Asia/Tokyo → **rejected** for every parent event (BR-27). Today is writable (US-E5-03/AC4).
- G2 kind `none` → every parent event rejected; no action is even offered (US-E5-02/AC2, US-E4-01/AC10).
- G3 kind `other-no-lunch` with no stored record, or only a dormant NC/SL record → every parent event rejected (US-E5-08/AC2, B6 follow-up).
- G4 conflict day (HB record on an `other-no-lunch` or removed date) → only `KEEP`, `CLEAR`, `CLEAR_OK`, `CLEAR_CANCEL` accepted (B7). G4 is checked before G2/G3.

## 2. Transition table (parent events)
`—` = not offered and rejected if forced (store unchanged). "Rem" = day-before reminder for that date after the event (✓ exists, ✗ none). States: SL = school-lunch-planned, NC = not-confirmed, HB = homemade-bento-planned, NSL = no-school-lunch.

| # | From (kind, displayed state, record) | Event | Expected after | Rem | Story |
|---|---|---|---|---|---|
| T01 | school, SL derived (no record) | `OPEN_BENTO` | unchanged, no record written | ✗ | US-E5-03/AC1 |
| T02 | school, SL derived | `OPEN_BENTO`, `CLOSE_RECS` | unchanged | ✗ | US-E5-03/AC3 |
| T03 | school, SL derived | `CONFIRM(R1)` | HB, recipe R1, `recipeNameSnapshot` = R1 name, `decidedAt` = `plannedAt` = now, record stored | ✓ | US-E5-03/AC2 |
| T04 | school, SL derived | `LATER` | NC, record stored, no recipe | ✗ | US-E5-05/AC1 |
| T05 | school, SL derived | `TO_SCHOOL` | — rejected | ✗ | table |
| T06 | school, SL derived | `CHANGE(R2)` | — rejected | ✗ | table |
| T07 | school, SL derived | `CLEAR` | — rejected | ✗ | table |
| T08 | school, SL derived | `RESERVED(true)` | SL stored with flag true | ✗ | US-E5-07/AC3 |
| T09 | school, SL stored, flag true | `RESERVED(false)` | SL, flag false | ✗ | US-E5-07/AC3 |
| T10 | school, SL stored, flag true | `CONFIRM(R1)` | HB R1, **flag cleared** | ✓ | US-E5-07/AC3 |
| T11 | school, SL stored, flag true | `LATER` | NC, flag cleared (`decision-reservation-flag`) | ✗ | contract §3.6 |
| T12 | school, NC | `CONFIRM(R1)` | HB R1, `plannedAt` = now | ✓ | table |
| T13 | school, NC | `TO_SCHOOL` | SL (no dialog: there is no plan to cancel) | ✗ | table |
| T14 | school, NC | `LATER` | — rejected (already NC) | ✗ | table |
| T15 | school, NC | `CHANGE(R2)` / `CLEAR` / `RESERVED(true)` | — rejected | ✗ | table, contract |
| T16 | school, HB R1 | `TO_SCHOOL`, `TO_SCHOOL_OK` | SL, recipe link removed | ✗ (removed in the same action) | US-E5-06/AC2, US-E7-02/AC6 |
| T17 | school, HB R1 | `TO_SCHOOL`, `TO_SCHOOL_CANCEL` | unchanged HB R1 | ✓ | US-E5-06/AC3 |
| T18 | school, HB R1 | `LATER` | NC, recipe removed | ✗ (removed) | table, US-E7-02/AC6 |
| T19 | school, HB R1 | `CHANGE(R2)` | HB R2, snapshot R2, `decidedAt` updated, `plannedAt` **unchanged** (B10) | ✓, content refers to R2 | US-E5-06/AC1 |
| T20 | school, HB R1 | `CHANGE(R1)` (same recipe) | unchanged recipe (no-op accepted) | ✓ | QA assumption |
| T21 | school, HB R1 | `CONFIRM(R2)` (bento action again) | — rejected (use `CHANGE`) | ✓ unchanged | table |
| T22 | school, HB R1 | `CLEAR` | — rejected (school day) | ✓ | table |
| T23 | school, HB R1 | `RESERVED(true)` | — rejected (`decision-reservation-flag`) | ✓ | contract |
| T24 | bento-day, NSL derived | `OPEN_BENTO` | unchanged | ✗ | US-E5-08/AC1 |
| T25 | bento-day, NSL derived | `CONFIRM(R1)` | HB R1, record stored, `plannedAt` = now | ✓ | US-E5-08/AC1, AC4 |
| T26 | bento-day, NSL derived | `LATER` / `TO_SCHOOL` / `RESERVED(true)` | — rejected (never offered on a bento day) | ✗ | US-E5-08/AC3, `decision-bento-day-remove` |
| T27 | bento-day, HB R1 | `CHANGE(R2)` | HB R2 | ✓ R2 | table |
| T28 | bento-day, HB R1 | `CLEAR`, `CLEAR_OK` | record removed → NSL 「お弁当の日」 | ✗ (removed) | US-E5-08/AC3 |
| T29 | bento-day, HB R1 | `CLEAR`, `CLEAR_CANCEL` | unchanged | ✓ | table |
| T30 | bento-day, HB R1 | `LATER` / `TO_SCHOOL` | — rejected | ✓ | US-E5-08/AC3 |
| T31 | other-no-lunch, NSL derived | any parent event | — rejected, no action offered | ✗ | US-E5-08/AC2 |
| T32 | none (Saturday not in menu, snack-only day, unconfirmed month) | any parent event | — rejected, no action offered | ✗ | US-E5-02/AC2, US-E4-01/AC10, BR-12 |
| T33 | any kind/state, date < today JST | any parent event | — rejected, store unchanged; sheet shows decision and recipe read-only | unchanged | US-E5-02/AC3, BR-27 |
| T34 | school, SL derived, date = today JST (08:00) | `CONFIRM(R1)` | HB R1 | ✗ (due time already passed, see reminder oracle RM28) | US-E5-03/AC4 |
| T35 | school, SL derived, today 2026-11-04 00:30 JST, device in Europe/Paris (local date 2026-11-03) | `CONFIRM(R1)` for 2026-11-04 | accepted (today in Tokyo) | — | BR-15 |
| T36 | same clock | `CONFIRM(R1)` for 2026-11-03 | rejected (past in Tokyo although "today" in Paris) | — | BR-15, BR-27 |
| T37 | school, SL derived | `CONFIRM(rX)` where rX contains a known allergen of the child (forced via library or URL) | — rejected | ✗ | BR-06 |
| T38 | school, SL derived | `CONFIRM("rcp-does-not-exist")` | — rejected (`decision-recipe-resolves`) | ✗ | contract |
| T39 | school, HB R1 | `CHANGE(rX)` with a known allergen | — rejected, HB R1 kept | ✓ R1 | BR-06 |
| T40 | school, SL derived | direct store write of HB without `recipeId` | refused with rule `decision-bento-requires-recipe`, previous state kept | ✗ | US-E10-05/AC1 |
| T41 | school, HB R1 (record) | every successful event | `history` keeps the last 5 changes (6th change drops the oldest) | — | contract §3.6 |
| T42 | school 2026-11-04 HB R1; refresh FX-01c turns it into `other-no-lunch` (conflict day) | open the day sheet | HB R1 shown with flag 「献立が変わりました」; only 「このままにする」 (`KEEP`) and 「計画を取り消す」 (`CLEAR`) offered; record byte-identical to before the refresh | ✓ | B7, US-E3-05/AC2 |
| T43 | conflict day 11-04 (T42) | `KEEP` | state, recipe, `decidedAt`, `plannedAt`, `history` unchanged; `acknowledgedMenuVersion` = the refresh's version; flag hidden | ✓ | B7 follow-up (`KEEP_PLAN`) |
| T44 | conflict day 11-04 | `CLEAR`, `CLEAR_OK` | record removed → derived NSL 「給食なし」; afterwards no action offered (G3) | ✗ (removed in the same action) | B7 |
| T45 | conflict day 11-04 | `CLEAR`, `CLEAR_CANCEL` | unchanged, flag still shown | ✓ | B7 |
| T46 | conflict day 11-04 | each of `CHANGE(R2)`, `CONFIRM(R2)`, `LATER`, `TO_SCHOOL`, `RESERVED(true)` | — rejected, store byte-identical | ✓ R1 | B7 "only keep or CLEAR_PLAN" |
| T47 | school 2026-11-11 HB R2; refresh FX-01c removes 11-11 from the menu (kind `none`, conflict day) | open the day (calendar cell or upcoming summary) | sheet opens for the date: HB R2 + flag; only `KEEP` and `CLEAR` offered (G4 before G2) | ✓ | B7 removed date |
| T48 | removed-date conflict 11-11 (T47) | `KEEP` | unchanged; flag hidden | ✓ | B7 follow-up |
| T49 | removed-date conflict 11-11 | `CLEAR`, `CLEAR_OK` | record removed; the date then has no decision and no action (G2) | ✗ (removed in the same action) | B7 |
| T50 | removed-date conflict 11-11 | each of `CHANGE(R1)`, `LATER`, `TO_SCHOOL`, `RESERVED(true)` | — rejected | ✓ R2 | B7 |
| T51 | conflict day 11-04 (T42), clock 2026-11-05 09:00 JST | `KEEP`; `CLEAR_OK` | — rejected (G1, BR-27); read-only sheet shows HB R1 and the flag; the date is not in the upcoming summary (past) | key expired 2026-11-03T15:00Z, never visible again | BR-27 (was U3) |
| T52 | school 2026-11-04 HB R1; refresh turns 11-04 into an お弁当の日 (reason `bento-day`) | `CHANGE(R2)` | not a conflict, no flag; accepted → HB R2 (normal bento-day row T27) | ✓ R2 | follow-up: BR-25 |
| T53 | school 2026-11-12 NC record; refresh turns 11-12 into `other-no-lunch` | each parent event | displays derived NSL; NC record dormant and byte-identical; every event rejected (G3) | ✗ | B6 follow-up |
| T54 | T53, then a later refresh makes 11-12 a school day again | `TO_SCHOOL` | NC returned unchanged before the event; event accepted → SL | ✗ | B6 follow-up "return unchanged" |
| T55 | school 2026-11-12 NC record; refresh turns 11-12 into an お弁当の日 (NC dormant, displayed NSL 「お弁当の日」) | `CONFIRM(R1)` | accepted: HB R1 **replaces** the dormant NC record (`plannedAt` = now); a later refresh back to a school day shows HB R1, no NC returns | ✓ | closing ruling U5 |
| T56 | school 2026-11-04 HB R1 (`plannedAt` P1) | `LATER`, then `CONFIRM(R2)` | after `LATER`: NC, `plannedAt` **cleared**; after `CONFIRM(R2)`: HB R2, new `plannedAt` = now | ✗ then ✓/✗ by the new `plannedAt` (reminder RM41) | closing ruling RU1 |

## 3. System events: every one must leave decisions byte-identical (BR-01, BR-02, BR-13)
Starting store for each row: 2026-11-04 HB R1, 2026-11-11 NC, 2026-11-12 SL stored with flag true, 2026-11-20 (bento-day) HB R3, override `low-preference` on 2026-11-18, today 2026-11-02 JST. Expected for **every** row: the `decisions` map deep-equal to before (state, recipe, flag, `decidedAt`, `history`), 0 new records, 0 removed records.

| # | Event | Additional expectation | Story |
|---|-------|------------------------|-------|
| S01 | Confirm a menu for a month with 5 low-preference days and no decisions | 0 stored decisions; all 5 display SL | US-E5-04/AC1, AC2 |
| S02 | Assessment recomputed (any profile, any menu) | — | BR-01, US-E4-03/AC5 |
| S03 | Override set / cleared on 2026-11-12 and on 2026-11-04 | decision unchanged | US-E4-03/AC5 |
| S04 | Profile edit removes なす and ピーマン | assessment of 11-04 changes; decision unchanged | US-E1-05/AC1 |
| S05 | Profile edit adds an allergen that R1 contains | HB R1 kept; day shows the conflict warning; R1 no longer offered for other days; the 11-04 reminder carries the warning | US-E1-05/AC2 |
| S06 | Profile deleted | decisions kept, overrides removed | US-E1-06/AC2 |
| S07 | Menu refresh, same dishes | — | US-E3-05/AC1 |
| S08 | Menu refresh changes dishes of 2026-11-04 | HB kept; 「献立が更新されました」 info | US-E3-05/AC1 |
| S09 | Menu refresh turns 2026-11-04 (HB) into an `other-no-lunch` day | HB kept with recipe; flag 「献立が変わりました」 (the longer US-E3-05/AC2 sentence may follow it); listed in the upcoming summary; conflict day (G4: only `KEEP`/`CLEAR`); day-before reminder **still planned** until `CLEAR_OK` | US-E3-05/AC2, B7 |
| S10 | Menu refresh removes 2026-11-11 (NC) from the menu entirely | NC record byte-identical and **dormant**: not shown, no action offered (G2); 2026-11-11 is in the refresh's "needs review" list (NC records are listed) | BR-13, closing ruling S10 |
| S11 | Menu refresh turns 2026-11-20 (bento-day, HB) into a school day | HB kept, not flagged; normal school HB row afterwards | `decision-bento-day-only` keeps conflicts |
| S12 | Refresh fails validation or the parent cancels the review | previous confirmed menu still active; store byte-identical | US-E3-05/AC5, US-E2-06/AC3 |
| S13 | A reminder fires, is shown, dismissed | — | BR-02 |
| S14 | Clock advances 30 days (2026-11-04 becomes past) | HB R1 still stored; now read-only | US-E5-04/AC1 |
| S15 | Library update removes R1 | HB kept with `recipeNameSnapshot`; sheet says 「このレシピは見つかりません。別のレシピを選んでください。」 | US-E6-06/AC1 |
| S16 | Language switch ja ↔ en, theme switch, week-start switch | — | US-E5-01/AC8 |
| S17 | Export, reload, browser restart | restored exactly | US-E10-01/AC1, US-E0-01/AC2 |
| S18 | Import of another month (December) fails for any reason | November decisions byte-identical | US-E2-06/AC3 |
| S19 | Reminder settings changed or switched off | — | BR-02 |
| S20 | Menu refresh turns 2026-11-12 (SL stored, flag true) into an `other-no-lunch` day | record dormant and byte-identical; day shows derived NSL; the reservation tick is not shown | B6 follow-up |
| S21 | After S20, a later refresh makes 2026-11-12 a school day again | SL with flag true shown again, unchanged | B6 follow-up |
| S22 | Menu refresh turns 2026-11-04 (school, HB R1) into an お弁当の日 | HB R1 kept, **not** flagged, no conflict | follow-up, BR-25 |
| S23 | Menu refresh removes 2026-11-12 (SL stored, flag true), then a later refresh lists 2026-11-12 as a school day again | dormant while removed (not shown, no actions, **not** listed in "needs review": only NC records are); SL with flag true returns unchanged | closing ruling S10 |

## 4. Former unspecified rows: rulings applied, and what is still open
| # | Situation | Ruling (PLAN §7, 2026-10-24) | Asserted by |
|---|-----------|------------------------------|-------------|
| U1 | HB on a day a refresh made `other-no-lunch` | B7: decision kept, flagged 「献立が変わりました」, only keep (`KEEP_PLAN`, acknowledges the flag) or `CLEAR_PLAN`; reminder stays until cleared | T42–T46, S09, reminder RM32, RM38, RM40 |
| U2 | HB on a date a refresh removed | B7: same as U1 | T47–T50, reminder RM39 |
| U3 | U1/U2 day once in the past | BR-27 (read-only) + "upcoming" means today or later | T51 |
| — | HB on a school day a refresh turned into an お弁当の日 | follow-up: valid, not flagged | T52, S22 |
| — | NC / SL records on a date that becomes no-lunch | B6 follow-up: dormant, returned unchanged later | T53, T54, S20, S21 |

**Closing rulings (PLAN §7 "H1 closing rulings") — nothing is open:**
- **U4 → S10, S23** NC/SL records on a removed date stay dormant (not shown, no actions) and return unchanged if the date reappears; NC ones are listed in "needs review".
- **U5 → T55** an explicit `CONFIRM_RECIPE` on an お弁当の日 replaces any dormant record for that date.
- **RU1 → T56** `plannedAt` is cleared when the day leaves HB; planning again sets a new one.

## 5. Random comparison (built in M2, runs in the gate)
Seeded (gate seed `20261024`): 1,000 sequences of 1–30 events over a month of mixed day kinds, each event drawn from §2 and §3 (including invalid ones and clock jumps across today). After every step the engine's (accepted/rejected, displayed state, recipeId, flag, record present) and the set of planned day-before keys must equal the oracle's. Property checks on every sequence: (P1) a date reaches HB only through `CONFIRM` or `CHANGE`; (P2) no system event changes `decisions`; (P3) no stored record has state `no-school-lunch`; (P4) every HB record has a resolving `recipeId` at write time; (P5) no write for a past date. Any difference is P1.
Added at the H1 rulings: (P6) a conflict day accepts only `KEEP` and `CLEAR`; (P7) `plannedAt` is set only by a `CONFIRM` into HB and cleared when the day leaves HB; (P8) a dormant record is byte-identical from the refresh that made it dormant until a refresh makes the date a school day again. (P9) `plannedAt` is absent on every non-HB record. Refresh events are drawn from menu variants that add, remove and convert dates, including removal of NC/SL dates and `CONFIRM` on an お弁当の日 that carries a dormant record; no situation is excluded.

Case count: **56 transitions** (T01–T56; T42–T56 added at the rulings) + **23 system events** (S01–S23; S20–S23 added). All asserted; none runs as `todo`.
