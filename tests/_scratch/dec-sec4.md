## 4. Former unspecified rows: rulings applied, and what is still open
| # | Situation | Ruling (PLAN §7, 2026-10-24) | Asserted by |
|---|-----------|------------------------------|-------------|
| U1 | HB on a day a refresh made `other-no-lunch` | B7: decision kept, flagged 「献立が変わりました」, only keep (`KEEP_PLAN`, acknowledges the flag) or `CLEAR_PLAN`; reminder stays until cleared | T42–T46, S09, reminder RM32, RM38, RM40 |
| U2 | HB on a date a refresh removed | B7: same as U1 | T47–T50, reminder RM39 |
| U3 | U1/U2 day once in the past | BR-27 (read-only) + "upcoming" means today or later | T51 |
| — | HB on a school day a refresh turned into an お弁当の日 | follow-up: valid, not flagged | T52, S22 |
| — | NC / SL records on a date that becomes no-lunch | B6 follow-up: dormant, returned unchanged later | T53, T54, S20, S21 |

**Still open (no fixed case depends on them; the random generator avoids them):**
- **U4** A stored `not-confirmed` or `school-lunch-planned` record on a date a refresh **removes** from the menu (B6 follow-up covers dates that become no-lunch, B7 covers HB only). The record is kept (BR-13, asserted in S10); what the day shows and which actions are allowed is not ruled. QA proposal: dormant, as for a no-lunch date.
- **U5** A dormant NC/SL record on a date that became an お弁当の日, where the parent then plans a bento (`CONFIRM` on a bento-day): does the HB record replace the dormant one, and what returns if the date becomes a school day again? QA proposal: `CONFIRM` replaces it (the dormant record is dropped and the history keeps it).
