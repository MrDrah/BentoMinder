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
