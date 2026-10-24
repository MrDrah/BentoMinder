## 4. Rulings applied (PLAN §7, 2026-10-24) and what is still open
- **B10** resolved: the day-before reminder is suppressed only if `plannedAt` (set by the first `CONFIRM_RECIPE` into HB, unchanged by `CHANGE_RECIPE`) is **after** the due instant; equality creates it. A recipe change never deletes a pending reminder. Cases: RM16, RM20, RM28 (unchanged expectations, now asserted), RM34–RM37.
- **B7** resolved: a conflict day keeps its reminder until `CLEAR_PLAN`; `KEEP_PLAN` changes nothing. Cases: RM32, RM38–RM40.

**Still open (no fixed case depends on them; the random generator avoids them):**
- **RU1 — `plannedAt` after the day left HB and is planned again.** Ruling B10 says both "the day *first* became HB" and "set on the first CONFIRM_RECIPE". If a day planned on 11-02 is moved to 「あとで決める」 (record kept as NC), 「給食に戻す」 (record kept as SL) or cleared on an お弁当の日 (record deleted), then confirmed again after 17:30 on the evening before, is `plannedAt` the original instant (reminder comes back and shows at once) or the new one (suppressed)? QA proposal: every `CONFIRM_RECIPE` into HB sets a new `plannedAt`; only `CHANGE_RECIPE` keeps it. The generator never re-confirms a day after its due instant.
- **B13 / strategy N3 — shown but not dismissed** (not ruled in the H1 rows). The fixed cases do not depend on it (RM22 follows US-E7-04/AC2 literally); the generator writes only dismissed log entries until it is ruled.

Case count: **40** (RM01–RM33 + RM34–RM40).
